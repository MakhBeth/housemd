import { CONFIG_FILE, DEFAULT_CONFIG, parseConfig, type HouseConfig } from '../config/config';
import { imageFileName, imageLink, uniquePath } from '../config/images';
import { FsExistsError, FsNotFoundError, isAccessError, type Entry, type Version, type WorkspaceFS } from '../fs/types';
import { detectEol, withEol, type Eol } from '../lib/paths';
import { SearchIndex } from '../search/searchIndex';
import { newNotePath, resolveWikiLink } from '../wikilinks/wikilinks';
import type { BufferStore } from './buffers';
import {
  autosaveAllows,
  CHECKPOINT_DEBOUNCE_MS,
  CHECKPOINT_MAX_WAIT_MS,
  DEFAULT_AUTOSAVE,
  parseAutosave,
  type AutosaveSettings,
  type AutosaveTrigger,
} from './autosave';
import { decideExternal, diffScan } from './external';
import { errorDetail, sameToast, type Toast, type ToastCode, type ToastParams } from './toasts';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface OpenDoc {
  path: string;
  /** Testo corrente, con le fine riga del file. */
  text: string;
  eol: Eol;
  saveState: SaveState;
  /** Il file è cambiato su disco mentre c'erano modifiche non salvate. */
  conflict: boolean;
  deletedOnDisk: boolean;
  /** Aumenta quando il testo cambia da fuori dall'editor (apertura, ricarica). */
  revision: number;
}

export type { Toast } from './toasts';

export interface WorkspaceState {
  status: 'loading' | 'ready' | 'access-lost';
  name: string;
  entries: Entry[];
  config: HouseConfig;
  doc: OpenDoc | null;
  toasts: Toast[];
  /** Aumenta a ogni modifica dell'indice di ricerca / lista dei file. */
  indexRevision: number;
  /** Modalità di salvataggio automatico corrente. */
  autosave: AutosaveSettings;
  /** Percorsi con una bozza nel buffer di emergenza (anche di file non aperti), in ordine. */
  drafts: string[];
}

export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface WorkspaceDeps {
  fs: WorkspaceFS;
  workspaceId: string;
  name: string;
  buffers: BufferStore;
  scheduler?: Scheduler;
  now?: () => Date;
  autosave?: AutosaveSettings;
}

/** Nuovo percorso dopo aver rinominato `from` in `to`, oppure null se `path` non è coinvolto. */
function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return null;
}

const inside = (path: string, target: string) => path === target || path.startsWith(`${target}/`);

export class Workspace {
  readonly search = new SearchIndex();
  private state: WorkspaceState;
  private readonly listeners = new Set<() => void>();
  private readonly scheduler: Scheduler;
  private readonly now: () => Date;
  /** Ultima versione nota su disco di ogni .md. */
  private readonly versions = new Map<string, Version>();
  /** Ultimo contenuto e versione noti su disco del file aperto. */
  private knownText = '';
  private knownVersion: Version | null = null;
  /**
   * Base da usare per il buffer di emergenza del file aperto: normalmente coincide con `knownText`,
   * ma quando si sta ripristinando (o restando in) un conflitto resta quella originale da cui
   * l'utente è partito, non il testo esterno che ha causato il conflitto — altrimenti, dopo un
   * altro giro di apri/chiudi, il conflitto risulterebbe "risolto" da solo.
   */
  private bufferBase = '';
  private timer: unknown = null;
  private saving: Promise<void> | null = null;
  private toastSeq = 0;
  /**
   * Contatore di sospensione dell'autosalvataggio (rinomina/eliminazione in corso): mentre è > 0,
   * `flush()` non scrive su disco, ma le modifiche continuano a essere segnalate come da salvare.
   */
  private suspended = 0;
  /** checkExternal() in corso: le chiamate concorrenti (focus + visibilitychange) si accodano invece di rifare la scansione. */
  private checking: Promise<void> | null = null;
  /**
   * Rinomina/eliminazione del documento in corso (> 0): il suo percorso è in transizione, quindi né
   * disco né buffer. Distinto da `suspended`, che ferma solo le scritture su disco (controllo esterno,
   * "Salva tutto") mentre il buffer di emergenza continua a ricevere i checkpoint.
   */
  private moving = 0;
  /** Checkpoint del buffer di emergenza (modalità senza salvataggio a tempo): debounce e attesa massima. */
  private checkpointTimer: unknown = null;
  private checkpointDeadline: unknown = null;

  constructor(private readonly deps: WorkspaceDeps) {
    this.scheduler = deps.scheduler ?? realScheduler;
    this.now = deps.now ?? (() => new Date());
    this.state = {
      status: 'loading',
      name: deps.name,
      entries: [],
      config: DEFAULT_CONFIG,
      doc: null,
      toasts: [],
      indexRevision: 0,
      autosave: parseAutosave(deps.autosave ?? DEFAULT_AUTOSAVE),
      drafts: [],
    };
  }

  // --- stato osservabile ------------------------------------------------------

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<WorkspaceState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private setDoc(patch: Partial<OpenDoc>): void {
    if (this.state.doc) this.set({ doc: { ...this.state.doc, ...patch } });
  }

  private bumpIndex(): void {
    this.set({ indexRevision: this.state.indexRevision + 1 });
  }

  private toast(kind: Toast['kind'], code: ToastCode, params?: ToastParams): void {
    const next = { kind, code, params };
    const last = this.state.toasts.at(-1);
    if (last && sameToast(last, next)) return;
    this.set({ toasts: [...this.state.toasts, { id: ++this.toastSeq, ...next }] });
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  files(): string[] {
    return this.state.entries.filter((e) => e.kind === 'file').map((e) => e.path);
  }

  /** Esegue un'operazione mostrando gli errori come toast; accesso revocato → schermata "Riprendi accesso". */
  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      await this.handleError(err);
    }
  }

  private async handleError(err: unknown): Promise<void> {
    if (isAccessError(err)) {
      const doc = this.state.doc;
      if (doc && doc.saveState !== 'saved') {
        await this.saveBuffer(doc.path, doc.text, this.bufferBase).catch(() => undefined);
      }
      this.set({ status: 'access-lost' });
      return;
    }
    if (err instanceof FsExistsError) this.toast('error', 'alreadyExists', { path: err.path });
    else if (err instanceof FsNotFoundError) this.toast('error', 'notFound', { path: err.path });
    else this.toast('error', 'operationFailed', { detail: errorDetail(err) });
  }

  // --- caricamento ------------------------------------------------------------

  async load(): Promise<void> {
    this.set({ status: 'loading' });
    await this.run(async () => {
      const entries = await this.deps.fs.list();
      const configText = await this.deps.fs.read(CONFIG_FILE).then((r) => r.text, (err) => {
        if (err instanceof FsNotFoundError) return null;
        throw err;
      });
      const { config, problems } = parseConfig(configText);
      for (const problem of problems) {
        if (problem.code === 'invalidJson') this.toast('info', 'configInvalidJson', { file: CONFIG_FILE, detail: problem.detail });
        else this.toast('info', problem.code === 'invalidSaveTo' ? 'configInvalidSaveTo' : 'configInvalidLinkPrefix', { file: CONFIG_FILE });
      }
      const unreadable: string[] = [];
      for (const entry of entries) {
        if (entry.kind !== 'file') continue;
        try {
          const { text, version } = await this.deps.fs.read(entry.path);
          this.search.upsert(entry.path, text);
          this.versions.set(entry.path, version);
        } catch (err) {
          // Un accesso revocato riguarda l'intera cartella: non ha senso continuare a leggere gli altri file.
          if (isAccessError(err)) throw err;
          unreadable.push(entry.path);
        }
      }
      if (unreadable.length > 0) {
        this.toast('info', 'unreadableFiles', { count: unreadable.length, paths: unreadable.join(', ') });
      }
      const drafts = await this.deps.buffers.list(this.deps.workspaceId).catch(() => [] as string[]);
      this.set({ entries, config, drafts: [...drafts].sort(), status: 'ready', indexRevision: this.state.indexRevision + 1 });
    });
    // Un errore nella scansione o nella config non deve lasciare l'app bloccata su "loading".
    if (this.state.status === 'loading') {
      this.set({ status: 'ready', entries: [], config: DEFAULT_CONFIG });
    }
  }

  private async refreshEntries(): Promise<void> {
    this.set({ entries: await this.deps.fs.list() });
  }

  // --- file aperto --------------------------------------------------------------

  async openFile(path: string): Promise<void> {
    const already = this.state.doc;
    if (already && already.path === path && !already.deletedOnDisk && !already.conflict) return;
    await this.settle();
    await this.run(async () => {
      let disk: { text: string; version: Version } | null;
      try {
        disk = await this.deps.fs.read(path);
      } catch (err) {
        if (!(err instanceof FsNotFoundError)) throw err;
        disk = null;
      }
      const buffered = await this.deps.buffers.load(this.deps.workspaceId, path);
      // File sparito dal disco e nessuna bozza da recuperare: resta un semplice "non trovato".
      if (disk === null && buffered === null) throw new FsNotFoundError(path);

      // L'utente potrebbe aver continuato a scrivere sul vecchio file aperto durante le due await
      // qui sopra: settle() prima di rimpiazzare il documento, altrimenti quelle battute si perdono
      // senza essere né salvate né bufferizzate.
      if (this.state.doc && this.state.doc.saveState !== 'saved') await this.settle();

      if (disk === null) {
        // Il file è stato eliminato ma c'è una bozza nel buffer di emergenza: la si apre come
        // documento eliminato su disco e da salvare, così salvando si ricrea il file. La base resta
        // quella del buffer, per non perderla se la bozza torna nel buffer prima di essere salvata.
        const draft = buffered!;
        this.knownText = '';
        this.knownVersion = null;
        this.versions.delete(path);
        this.bufferBase = draft.base;
        this.set({
          doc: {
            path,
            text: draft.text,
            eol: detectEol(draft.text),
            saveState: 'dirty',
            conflict: false,
            deletedOnDisk: true,
            revision: (this.state.doc?.revision ?? 0) + 1,
          },
        });
        this.toast('info', 'restoredDraftDeleted', { path });
        return;
      }
      const { text, version } = disk;

      this.knownText = text;
      this.knownVersion = version;
      this.versions.set(path, version);
      // Base di partenza per un eventuale buffer di emergenza: normalmente il disco appena letto;
      // viene sostituita più sotto se si sta ripristinando un conflitto già in corso, per non
      // perdere la base originale da cui l'utente era partito.
      this.bufferBase = text;

      let docText = text;
      let saveState: SaveState = 'saved';
      let conflict = false;
      let restored = false;
      if (buffered !== null) {
        if (buffered.text === text) {
          // Il buffer coincide col disco: non c'è nulla da ripristinare, si può scartare.
          await this.clearBuffer(path);
        } else {
          // Se il disco è ancora quello su cui si basava il buffer, è una semplice ripresa di
          // modifiche non salvate. Altrimenti il disco è cambiato nel frattempo: è un conflitto,
          // non va sovrascritto silenziosamente dall'autosalvataggio.
          docText = buffered.text;
          saveState = 'dirty';
          conflict = buffered.base !== text;
          if (conflict) this.bufferBase = buffered.base;
          restored = true;
        }
      }

      this.set({
        doc: {
          path,
          text: docText,
          eol: detectEol(text),
          saveState,
          conflict,
          deletedOnDisk: false,
          revision: (this.state.doc?.revision ?? 0) + 1,
        },
      });
      if (restored) {
        this.toast('info', 'restoredDraft', { path });
        this.schedule('restoredDraft');
      }
    });
  }

  /** Esiste una bozza nel buffer di emergenza per `path`? (anche se il file non è più su disco) */
  async hasDraft(path: string): Promise<boolean> {
    return (await this.deps.buffers.load(this.deps.workspaceId, path).catch(() => null)) !== null;
  }

  /** Bozze nel buffer di emergenza di file che non esistono più su disco, in ordine. */
  async orphanDrafts(): Promise<string[]> {
    const onDisk = new Set(this.files());
    const paths = await this.deps.buffers.list(this.deps.workspaceId).catch(() => [] as string[]);
    return paths.filter((p) => !onDisk.has(p)).sort();
  }

  /** Percorsi con una bozza nel buffer di emergenza (anche di file non più su disco). */
  async draftPaths(): Promise<string[]> {
    return [...(await this.deps.buffers.list(this.deps.workspaceId))].sort();
  }

  /** Cambia modalità: il timer pendente si annulla e si riprogramma secondo la nuova modalità. */
  setAutosave(settings: AutosaveSettings): void {
    this.set({ autosave: parseAutosave(settings) });
    this.clearSaveTimer();
    this.clearCheckpoint();
    const doc = this.state.doc;
    if (doc && doc.saveState !== 'saved') this.schedule('timer');
  }

  /**
   * La finestra perde il focus, la pagina viene nascosta o chiusa: salva su disco se la modalità lo
   * consente, altrimenti mette il testo nel buffer di emergenza.
   */
  async blur(): Promise<void> {
    if (autosaveAllows(this.state.autosave.mode, 'blur')) await this.flush();
    else await this.checkpoint();
  }

  async closeFile(): Promise<void> {
    await this.settle();
    this.set({ doc: null });
  }

  edit(textLf: string): void {
    const doc = this.state.doc;
    if (!doc) return;
    const text = withEol(textLf, doc.eol);
    if (text === doc.text) return;
    this.setDoc({ text, saveState: 'dirty' });
    this.schedule('timer');
  }

  /**
   * Unico punto delle scritture automatiche: se la modalità consente il trigger si programma il
   * salvataggio su disco, altrimenti solo il checkpoint del buffer di emergenza.
   */
  private schedule(trigger: AutosaveTrigger): void {
    if (autosaveAllows(this.state.autosave.mode, trigger)) this.scheduleSave();
    else this.scheduleCheckpoint();
  }

  private scheduleSave(): void {
    this.clearSaveTimer();
    this.timer = this.scheduler.set(() => {
      this.timer = null;
      void this.onAutosaveTimer();
    }, this.state.autosave.delayMs);
  }

  private clearSaveTimer(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
  }

  /** Debounce di 1 s, ma al più 5 s dalla prima modifica non ancora messa al sicuro. */
  private scheduleCheckpoint(): void {
    if (this.checkpointTimer !== null) this.scheduler.clear(this.checkpointTimer);
    this.checkpointTimer = this.scheduler.set(() => void this.checkpoint(), CHECKPOINT_DEBOUNCE_MS);
    if (this.checkpointDeadline === null) {
      this.checkpointDeadline = this.scheduler.set(() => void this.checkpoint(), CHECKPOINT_MAX_WAIT_MS);
    }
  }

  private clearCheckpoint(): void {
    if (this.checkpointTimer !== null) this.scheduler.clear(this.checkpointTimer);
    if (this.checkpointDeadline !== null) this.scheduler.clear(this.checkpointDeadline);
    this.checkpointTimer = null;
    this.checkpointDeadline = null;
  }

  /** Checkpoint: il testo non salvato va nel buffer di emergenza (mai su disco). */
  private async checkpoint(): Promise<void> {
    this.clearCheckpoint();
    // Rinomina/eliminazione in corso: il percorso è in transizione; chi l'ha avviata ripianifica alla
    // fine. Durante un controllo esterno o "Salva tutto" (solo le scritture su disco sono sospese) il
    // percorso è stabile e il checkpoint si scrive: l'attesa massima di 5 s vale sempre.
    if (this.moving > 0) return;
    await this.bufferCurrentDoc();
  }

  /**
   * Scaduto il debounce. Rinomina/eliminazione in corso: niente, il percorso è in transizione e sarà
   * rename()/remove() a ripianificare. Scritture su disco sospese (controllo esterno, "Salva tutto"),
   * conflitto irrisolto o accesso perso: il testo va nel buffer di emergenza. Altrimenti su disco.
   */
  private async onAutosaveTimer(): Promise<void> {
    if (this.moving > 0) return;
    if (this.suspended > 0 || this.state.status === 'access-lost' || this.state.doc?.conflict) {
      await this.bufferCurrentDoc();
      return;
    }
    await this.flush();
  }

  private async bufferCurrentDoc(): Promise<void> {
    const doc = this.state.doc;
    if (!doc || doc.saveState === 'saved') return;
    try {
      await this.saveBuffer(doc.path, doc.text, this.bufferBase);
    } catch (err) {
      this.toast('error', 'bufferFailed', { detail: errorDetail(err) });
    }
  }

  /** Scrive il buffer di emergenza e tiene aggiornato `drafts`. Gli errori risalgono a chi chiama. */
  private async saveBuffer(path: string, text: string, base: string): Promise<void> {
    await this.deps.buffers.save(this.deps.workspaceId, path, text, base);
    if (!this.state.drafts.includes(path)) this.set({ drafts: [...this.state.drafts, path].sort() });
  }

  private async clearBuffer(path: string): Promise<void> {
    await this.deps.buffers.clear(this.deps.workspaceId, path);
    if (this.state.drafts.includes(path)) this.set({ drafts: this.state.drafts.filter((p) => p !== path) });
  }

  private async refreshDrafts(): Promise<void> {
    const paths = await this.draftPaths().catch(() => null);
    if (paths) this.set({ drafts: paths });
  }

  /**
   * Forza il salvataggio, anche quando il documento è 'saved' ma il file è stato eliminato fuori
   * da HouseMD (in quel caso `flush()` da solo sarebbe un no-op): usato da Ctrl+S per poter
   * ricreare il file.
   */
  async saveNow(): Promise<void> {
    const doc = this.state.doc;
    if (doc?.deletedOnDisk && doc.saveState === 'saved') {
      this.setDoc({ saveState: 'dirty' });
    }
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
    while (this.saving) await this.saving;
    if (this.suspended > 0) {
      // Scritture su disco sospese (controllo esterno, "Salva tutto"): il timer è appena stato
      // cancellato, quindi il testo va nel buffer. Non durante rinomina/eliminazione (`moving`): il
      // percorso è in transizione e sarà rename()/remove() a ripianificare.
      if (this.moving === 0) await this.bufferCurrentDoc();
      return;
    }
    const doc = this.state.doc;
    if (!doc) return;
    if (doc.conflict || this.state.status === 'access-lost') {
      // Su disco non si può scrivere, ma il timer è appena stato cancellato: senza questo buffer le
      // modifiche fatte dall'ultimo salvataggio del buffer resterebbero solo in memoria.
      await this.bufferCurrentDoc();
      return;
    }
    if (doc.saveState !== 'dirty' && doc.saveState !== 'error') return;
    this.saving = this.writeDoc(doc.path, doc.text).finally(() => {
      this.saving = null;
    });
    await this.saving;
  }

  /**
   * Prima di lasciare il file aperto: se la modalità lo consente salva su disco finché non restano
   * modifiche (anche quelle arrivate durante un salvataggio); altrimenti, o se non si riesce, il
   * testo finisce nel buffer di emergenza con la sua base.
   */
  private async settle(): Promise<void> {
    if (autosaveAllows(this.state.autosave.mode, 'switch')) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const doc = this.state.doc;
        if (!doc || doc.saveState === 'saved' || doc.conflict || this.state.status === 'access-lost') break;
        await this.flush();
        if (this.state.doc?.saveState === 'error') break;
      }
    }
    const doc = this.state.doc;
    if (doc && doc.saveState !== 'saved') {
      this.clearCheckpoint();
      await this.saveBuffer(doc.path, doc.text, this.bufferBase).catch(() => undefined);
    }
  }

  private async writeDoc(path: string, text: string): Promise<void> {
    this.setDoc({ saveState: 'saving' });
    let version: Version;
    try {
      ({ version } = await this.deps.fs.write(path, text));
    } catch (err) {
      const current = this.state.doc;
      const pending = current?.path === path ? current.text : text;
      const base = current?.path === path ? this.bufferBase : text;
      await this.saveBuffer(path, pending, base).catch(() => undefined);
      if (current?.path === path) this.setDoc({ saveState: 'error' });
      if (isAccessError(err)) {
        this.set({ status: 'access-lost' });
        return;
      }
      this.toast('error', 'saveFailed', { detail: errorDetail(err) });
      return;
    }
    // La scrittura è riuscita: quel che segue è manutenzione best-effort e non deve far
    // sembrare fallito un salvataggio che in realtà è andato a buon fine.
    this.knownText = text;
    this.bufferBase = text;
    this.knownVersion = version;
    this.versions.set(path, version);
    this.search.upsert(path, text);
    // Il buffer si scarta solo se non ci sono battute più nuove di quelle appena scritte: in `off` un
    // checkpoint arrivato durante la scrittura contiene testo che su disco non c'è ancora.
    const newer = this.state.doc?.path === path && this.state.doc.text !== text;
    if (!newer) {
      await this.clearBuffer(path).catch(() => undefined);
    } else {
      // Il checkpoint più nuovo resta, ma va riferito a ciò che ORA c'è su disco: con la vecchia base,
      // riaprendo il file (o dopo un crash) sembrerebbe un cambiamento esterno, cioè un conflitto.
      const retained = await this.deps.buffers.load(this.deps.workspaceId, path).catch(() => null);
      const latest = this.state.doc;
      if (retained && latest?.path === path) {
        if (latest.text === text) {
          // Durante la lettura l'utente è tornato (es. Ctrl+Z) al testo appena scritto: la bozza è
          // vecchia e riaprendo resusciterebbe testo annullato. Si scarta.
          await this.clearBuffer(path).catch(() => undefined);
        } else {
          await this.saveBuffer(path, latest.text, text).catch(() => undefined);
          // Stesso caso, ma l'annullamento è arrivato durante la scrittura del buffer riferito.
          const after = this.state.doc;
          if (after?.path === path && after.text === text) await this.clearBuffer(path).catch(() => undefined);
        }
      }
    }
    try {
      if (!this.state.entries.some((e) => e.path === path)) await this.refreshEntries();
    } catch {
      // La lista dei file si aggiornerà al prossimo giro: non invalida il salvataggio.
    }
    this.bumpIndex();
    const current = this.state.doc;
    if (current?.path !== path) return;
    if (current.text === text) {
      this.setDoc({ saveState: 'saved', deletedOnDisk: false });
    } else {
      this.setDoc({ saveState: 'dirty', deletedOnDisk: false });
      this.schedule('afterWrite');
    }
  }

  // --- modifiche esterne --------------------------------------------------------

  checkExternal(): Promise<void> {
    if (this.checking) return this.checking;
    this.checking = this.doCheckExternal().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  private async doCheckExternal(): Promise<void> {
    if (this.state.status !== 'ready') return;
    if (this.suspended > 0) return; // una rinomina/eliminazione sta riscrivendo l'albero
    while (this.saving) await this.saving;
    // Per tutto il controllo l'autosalvataggio resta sospeso: un salvataggio partito durante la
    // scansione scriverebbe sopra il cambiamento esterno e aggiornerebbe la versione nota prima del
    // confronto, facendo sparire il conflitto. Le battute restano 'dirty' e si salvano alla fine.
    this.suspended++;
    try {
      await this.scanExternal();
    } finally {
      this.suspended--;
      const current = this.state.doc;
      if (current && current.saveState !== 'saved') this.schedule('afterExternal');
    }
  }

  private async scanExternal(): Promise<void> {
    await this.run(async () => {
      const entries = await this.deps.fs.list();
      const { changed, removed } = diffScan(this.versions, entries);
      const openPath = this.state.doc?.path;
      for (const path of changed) {
        if (path === openPath) continue;
        const { text, version } = await this.deps.fs.read(path);
        this.search.upsert(path, text);
        this.versions.set(path, version);
      }
      for (const path of removed) {
        if (path === openPath) continue;
        this.search.remove(path);
        this.versions.delete(path);
      }
      this.set({ entries });
      if (changed.length > 0 || removed.length > 0) this.bumpIndex();

      const doc = this.state.doc;
      if (!doc) return;
      // Istantanea presa PRIMA delle await di decideExternal: ci serve per accorgerci se, nel
      // frattempo, l'utente ha continuato a scrivere o un salvataggio è partito/arrivato a destinazione.
      const snapshotText = doc.text;
      const snapshotVersion = this.knownVersion;
      const decision = await decideExternal({
        known: this.knownVersion,
        knownText: this.knownText,
        dirty: doc.saveState !== 'saved',
        stat: () => this.deps.fs.stat(doc.path),
        read: () => this.deps.fs.read(doc.path),
      });

      const current = this.state.doc;
      if (!current || current.path !== doc.path) return; // il file aperto è cambiato durante il controllo
      if (this.saving) return; // un salvataggio è partito nel frattempo: il prossimo controllo rivaluterà
      if (this.knownVersion !== snapshotVersion) return; // idem, ma il salvataggio è già arrivato a destinazione

      switch (decision.kind) {
        case 'unchanged':
          return;
        case 'deleted':
          if (!current.deletedOnDisk) this.toast('info', 'deletedOutside', { path: current.path });
          // Solo una modifica dell'utente (dirty) deve poter ricreare il file: niente 'dirty' forzato qui.
          this.setDoc({ deletedOnDisk: true });
          this.search.remove(current.path);
          this.versions.delete(current.path);
          return;
        case 'update-version':
          this.knownVersion = decision.version;
          this.versions.set(current.path, decision.version);
          return;
        case 'reload': {
          if (current.text !== snapshotText) {
            // L'utente ha digitato durante il controllo: le sue battute non vanno buttate via.
            if (this.timer !== null) this.scheduler.clear(this.timer);
            this.timer = null;
            this.setDoc({ conflict: true });
            // Il timer appena cancellato non scriverà più nulla: il testo va messo al sicuro subito.
            await this.bufferCurrentDoc();
            return;
          }
          this.knownText = decision.text;
          this.bufferBase = decision.text;
          this.knownVersion = decision.version;
          this.versions.set(current.path, decision.version);
          this.search.upsert(current.path, decision.text);
          this.setDoc({ text: decision.text, eol: detectEol(decision.text), saveState: 'saved', deletedOnDisk: false, revision: current.revision + 1 });
          this.bumpIndex();
          return;
        }
        case 'conflict':
          if (this.timer !== null) this.scheduler.clear(this.timer);
          this.timer = null;
          this.setDoc({ conflict: true });
          // Il timer appena cancellato non scriverà più nulla: il testo va messo al sicuro subito.
          await this.bufferCurrentDoc();
          return;
      }
    });
  }

  async resolveConflict(choice: 'reload' | 'overwrite'): Promise<void> {
    const doc = this.state.doc;
    if (!doc?.conflict) return;
    if (choice === 'overwrite') {
      this.setDoc({ conflict: false, saveState: 'dirty' });
      await this.flush();
      return;
    }
    await this.run(async () => {
      const { text, version } = await this.deps.fs.read(doc.path);
      // Durante la lettura l'utente può aver aperto un altro file, risolto il conflitto in altro
      // modo o continuato a scrivere: in tutti questi casi il testo letto non va applicato,
      // altrimenti finirebbe in un altro documento o cancellerebbe battute non salvate.
      const current = this.state.doc;
      if (!current || current.path !== doc.path || !current.conflict || current.text !== doc.text) return;
      this.knownText = text;
      this.bufferBase = text;
      this.knownVersion = version;
      this.versions.set(doc.path, version);
      this.search.upsert(doc.path, text);
      if (this.timer !== null) this.scheduler.clear(this.timer);
      this.timer = null;
      this.setDoc({ text, eol: detectEol(text), saveState: 'saved', conflict: false, revision: current.revision + 1 });
      this.bumpIndex();
      // Il buffer si scarta solo DOPO aver applicato la ricarica (nessuna await in mezzo al controllo).
      await this.clearBuffer(doc.path);
    });
  }

  async resume(): Promise<void> {
    this.set({ status: 'ready' });
    await this.checkExternal();
    if (autosaveAllows(this.state.autosave.mode, 'resume')) await this.flush();
    else await this.checkpoint();
  }

  // --- operazioni sui file ------------------------------------------------------

  async createFile(path: string, text = ''): Promise<void> {
    let created = false;
    await this.run(async () => {
      if (await this.deps.fs.stat(path)) throw new FsExistsError(path);
      const { version } = await this.deps.fs.write(path, text);
      this.versions.set(path, version);
      this.search.upsert(path, text);
      await this.refreshEntries();
      this.bumpIndex();
      created = true;
    });
    if (created) await this.openFile(path);
  }

  async createFolder(path: string): Promise<void> {
    await this.run(async () => {
      await this.deps.fs.mkdir(path);
      await this.refreshEntries();
    });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.settle();
    this.suspended++;
    this.moving++;
    try {
      await this.run(async () => {
        await this.deps.fs.rename(from, to);

        // Aggiorna SUBITO il file aperto: se un autosalvataggio scattasse durante la reindicizzazione
        // che segue, deve scrivere al nuovo percorso invece di ricreare quello appena rinominato.
        const openDoc = this.state.doc;
        const docPath = openDoc ? movedPath(openDoc.path, from, to) : null;
        if (docPath !== null) {
          this.setDoc({ path: docPath });
          this.knownVersion = await this.deps.fs.stat(docPath);
        }

        // refreshEntries()/bumpIndex() devono comunque girare anche se la reindicizzazione
        // qui sotto incontra un errore (non solo un file mancante, che è tollerato).
        try {
          await this.deps.buffers.move(this.deps.workspaceId, from, to);
          await this.refreshDrafts();
          for (const path of [...this.versions.keys()]) {
            const next = movedPath(path, from, to);
            if (next === null) continue;
            try {
              // Non si tocca l'indice finché non sappiamo se il file è davvero raggiungibile al
              // nuovo percorso: così un errore transitorio non fa perdere la voce a metà.
              const { text, version } = await this.deps.fs.read(next);
              this.search.remove(path);
              this.versions.delete(path);
              this.search.upsert(next, text);
              this.versions.set(next, version);
            } catch (err) {
              // Sparito davvero durante la rinomina (es. cambiamento esterno concorrente): via
              // anche dal vecchio indice. Qualunque altro errore invece resta a metà e risale.
              if (!(err instanceof FsNotFoundError)) throw err;
              this.search.remove(path);
              this.versions.delete(path);
            }
          }
        } finally {
          await this.refreshEntries();
          this.bumpIndex();
        }
      });
    } finally {
      this.suspended--;
      this.moving--;
      const current = this.state.doc;
      if (current && current.saveState !== 'saved') this.schedule('afterRename');
    }
  }

  async remove(path: string): Promise<void> {
    const doc = this.state.doc;
    const closing = doc !== null && inside(doc.path, path);
    if (closing) {
      // Sospende l'autosalvataggio per tutta l'eliminazione, incluso il tempo speso ad aspettare
      // un salvataggio già in corso: altrimenti potrebbe ripianificarsi e ricreare il file appena
      // eliminato (vedi il timer ripulito solo DOPO aver aspettato, qui sotto).
      this.suspended++;
      this.moving++;
      if (this.saving) await this.saving;
      if (this.timer !== null) this.scheduler.clear(this.timer);
      this.timer = null;
    }
    try {
      await this.run(async () => {
        await this.deps.fs.remove(path);
        // Si chiude il documento aperto ADESSO, non quello catturato all'inizio: durante l'attesa
        // l'utente può aver aperto (e modificato) un altro file, che non va toccato.
        const current = this.state.doc;
        if (current && inside(current.path, path)) {
          if (this.timer !== null) this.scheduler.clear(this.timer);
          this.timer = null;
          this.set({ doc: null });
        }
        for (const p of [...this.versions.keys()]) {
          if (!inside(p, path)) continue;
          this.search.remove(p);
          this.versions.delete(p);
          await this.clearBuffer(p);
        }
        await this.refreshEntries();
        this.bumpIndex();
      });
    } finally {
      if (closing) {
        this.suspended--;
        this.moving--;
        // Eliminazione fallita: il file resta aperto con le sue modifiche, riprendiamo a salvare.
        const current = this.state.doc;
        if (current && current.saveState !== 'saved') this.schedule('afterRename');
      }
    }
  }

  async followWikiLink(target: string): Promise<void> {
    const from = this.state.doc?.path ?? '';
    const found = resolveWikiLink(target, from, this.files());
    if (found) await this.openFile(found);
    else await this.createFile(newNotePath(target, from));
  }

  // --- immagini -----------------------------------------------------------------

  async saveImage(data: Blob, originalName: string | null): Promise<string | null> {
    const doc = this.state.doc;
    if (!doc) return null;
    let link: string | null = null;
    await this.run(async () => {
      const { saveTo } = this.state.config.images;
      const name = imageFileName(originalName, data.type, this.now());
      const path = await uniquePath(saveTo, name, async (p) => (await this.deps.fs.stat(p)) !== null);
      await this.deps.fs.write(path, data);
      link = imageLink(path, doc.path, this.state.config);
    });
    return link;
  }

  readBlob(path: string): Promise<Blob> {
    return this.deps.fs.readBlob(path);
  }

  dispose(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
    this.clearCheckpoint();
    this.listeners.clear();
  }
}
