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
import type { HistoryStore, Snapshot, SnapshotReason } from '../history/historyStore';
import { shouldSnapshot } from '../history/policy';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** Esito di settle(): `failed` = il documento non è al sicuro e non va lasciato. */
export type SettleResult = 'durable' | 'failed';

const MAX_SETTLE_ATTEMPTS = 3;

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
  /** Ripristino dalla cronologia da applicare nell'editor come transazione (annullabile con Ctrl+Z). */
  restore: { seq: number; textLf: string } | null;
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
  /** Aggiornamento dell'app in corso: modifiche ignorate, editor in sola lettura. */
  updating: boolean;
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
  /** Cronologia locale; senza, niente snapshot (i test v1 non la passano). */
  history?: HistoryStore;
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
  /** Coda seriale delle operazioni su file e documento (vedi runExclusive). */
  private queue: Promise<unknown> = Promise.resolve();
  /** Scritture della cronologia in fila: fire-and-forget per chi le lancia, in ordine tra loro. */
  private historyChain: Promise<void> = Promise.resolve();
  private historyErrorShown = false;
  /** Aumenta a ogni cambio di testo o di documento: invalida ripristini e sovrascritture partiti prima. */
  private generation = 0;
  private restoreSeq = 0;

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
      updating: false,
    };
  }

  // --- stato osservabile ------------------------------------------------------

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<WorkspaceState>): void {
    if ('doc' in patch) {
      const previous = this.state.doc;
      const next = patch.doc ?? null;
      if (previous?.path !== next?.path || previous?.text !== next?.text) this.generation++;
    }
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

  /** Errore nello scegliere o aprire un'altra cartella: si resta qui, con un toast. */
  reportFolderError(detail: string): void {
    this.toast('error', 'openFolderFailed', { detail });
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

  /**
   * Coda seriale: le operazioni che toccano file o cambiano documento girano una alla volta,
   * nell'ordine di chiamata, e ognuna parte solo dopo il salvataggio del documento già in corso.
   * Così "Salva tutto" non scrive su un percorso che una rinomina/eliminazione sta spostando, e
   * viceversa. Un'operazione in coda non deve MAI chiamarne un'altra pubblica in coda (aspetterebbe
   * sé stessa): usa le versioni interne `do…`.
   */
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = async () => {
      while (this.saving) await this.saving;
      return operation();
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  // --- operazioni in coda ---------------------------------------------------------

  openFile(path: string): Promise<void> {
    return this.runExclusive(() => this.doOpenFile(path));
  }

  closeFile(): Promise<boolean> {
    return this.runExclusive(() => this.doCloseFile());
  }

  createFile(path: string, text = ''): Promise<void> {
    return this.runExclusive(() => this.doCreateFile(path, text));
  }

  createFolder(path: string): Promise<void> {
    return this.runExclusive(() => this.doCreateFolder(path));
  }

  rename(from: string, to: string): Promise<void> {
    return this.runExclusive(() => this.doRename(from, to));
  }

  remove(path: string): Promise<void> {
    return this.runExclusive(() => this.doRemove(path));
  }

  resolveConflict(choice: 'reload' | 'overwrite'): Promise<void> {
    return this.runExclusive(() => this.doResolveConflict(choice));
  }

  saveAll(): Promise<void> {
    return this.runExclusive(() => this.doSaveAll());
  }

  restoreVersion(id: number): Promise<void> {
    return this.runExclusive(() => this.doRestoreVersion(id));
  }

  /**
   * Aggiornamento dell'app: da subito le modifiche sono ignorate (editor in sola lettura), poi — in
   * coda, dopo l'operazione in corso — il documento si mette al sicuro. `failed`: chi chiama deve
   * chiamare endUpdate() e non ricaricare.
   */
  beginUpdate(): Promise<SettleResult> {
    this.set({ updating: true });
    return this.runExclusive(() => this.settle());
  }

  endUpdate(): void {
    if (this.state.updating) this.set({ updating: false });
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

  private async doOpenFile(path: string): Promise<void> {
    const already = this.state.doc;
    if (already && already.path === path && !already.deletedOnDisk && !already.conflict) return;
    if ((await this.settle()) === 'failed') return;
    await this.run(async () => {
      let disk: { text: string; version: Version } | null;
      try {
        disk = await this.deps.fs.read(path);
      } catch (err) {
        if (!(err instanceof FsNotFoundError)) throw err;
        disk = null;
      }
      let draft = await this.deps.buffers.load(this.deps.workspaceId, path);
      // File sparito dal disco e nessuna bozza da recuperare: resta un semplice "non trovato".
      if (disk === null && draft === null) throw new FsNotFoundError(path);
      if (disk !== null && draft !== null && draft.text === disk.text) {
        // La bozza coincide col disco: non c'è nulla da ripristinare. Si scarta ADESSO, prima
        // dell'ultimo settle, così dopo non resta nessuna attesa.
        await this.clearBuffer(path);
        draft = null;
      }

      // L'utente può aver continuato a scrivere sul vecchio documento durante le await qui sopra:
      // lo si mette al sicuro adesso. Da qui alla sostituzione del documento niente più await.
      if ((await this.settle()) === 'failed') return;

      if (disk === null) {
        // Il file è stato eliminato ma c'è una bozza nel buffer di emergenza: la si apre come
        // documento eliminato su disco e da salvare, così salvando si ricrea il file. La base resta
        // quella del buffer, per non perderla se la bozza torna nel buffer prima di essere salvata.
        const orphan = draft!;
        this.knownText = '';
        this.knownVersion = null;
        this.versions.delete(path);
        this.bufferBase = orphan.base;
        this.set({
          doc: {
            path,
            text: orphan.text,
            eol: detectEol(orphan.text),
            saveState: 'dirty',
            conflict: false,
            deletedOnDisk: true,
            revision: (this.state.doc?.revision ?? 0) + 1,
            restore: null,
          },
        });
        this.toast('info', 'restoredDraftDeleted', { path });
        return;
      }
      const { text, version } = disk;

      this.knownText = text;
      this.knownVersion = version;
      this.versions.set(path, version);
      // Base per un eventuale buffer di emergenza: normalmente il disco appena letto; resta quella
      // originale se si sta ripristinando un conflitto già in corso.
      this.bufferBase = text;

      let docText = text;
      let saveState: SaveState = 'saved';
      let conflict = false;
      if (draft !== null) {
        // Se il disco è ancora quello su cui si basava la bozza, è una semplice ripresa di
        // modifiche non salvate; altrimenti il disco è cambiato nel frattempo: è un conflitto.
        docText = draft.text;
        saveState = 'dirty';
        conflict = draft.base !== text;
        if (conflict) this.bufferBase = draft.base;
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
          restore: null,
        },
      });
      if (draft !== null) {
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

  /** Chiude il documento dopo averlo messo al sicuro; `false` (e documento ancora aperto) se non si può. */
  private async doCloseFile(): Promise<boolean> {
    if ((await this.settle()) === 'failed') return false;
    this.set({ doc: null });
    return true;
  }

  edit(textLf: string): void {
    const doc = this.state.doc;
    if (!doc || this.state.updating) return;
    const text = withEol(textLf, doc.eol);
    if (text === doc.text) return;
    // Una modifica vera rende il comando di ripristino ormai vecchio: non va più riapplicato.
    this.setDoc({ text, saveState: 'dirty', restore: null });
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

  /**
   * "Salva tutto": prima il documento aperto dal testo in memoria (con flush, come Ctrl+S tranne che
   * non ricrea mai un file eliminato su disco: base e versione aggiornate, battute arrivate durante la
   * scrittura restano dirty),
   * poi le bozze degli altri file, con l'autosalvataggio sospeso. Una bozza si scrive solo se il disco
   * coincide ancora con la sua base; altrimenti resta dov'è (è un conflitto da aprire a mano).
   */
  private async doSaveAll(): Promise<void> {
    while (this.checking) await this.checking;
    /** Modifiche che dopo "Salva tutto" restano non salvate su disco (documento aperto compreso). */
    let left = 0;
    const open = this.state.doc;
    if (open?.deletedOnDisk) {
      // File eliminato su disco: "Salva tutto" non lo ricrea MAI (né subito né con un salvataggio a
      // tempo), come per le bozze orfane non aperte. Se ha modifiche restano nel buffer; lo ricrea
      // solo Ctrl+S (saveNow), esplicitamente. Documento pulito: nulla da salvare.
      if (open.saveState !== 'saved') {
        await this.bufferCurrentDoc();
        left++;
      }
    } else if (open) {
      // flush e non saveNow: saveNow ricreerebbe un file eliminato fuori da HouseMD.
      await this.flush();
      const after = this.state.doc;
      // Scrittura non riuscita (errore, conflitto, accesso perso): il testo è al sicuro nel buffer
      // ma non su disco. Battute arrivate durante la scrittura, invece, non sono un fallimento.
      if (after && (after.saveState === 'error' || after.conflict || this.state.status === 'access-lost')) left++;
    }
    const openPath = this.state.doc?.path ?? null;
    let paths: string[];
    try {
      paths = (await this.draftPaths()).filter((path) => path !== openPath);
    } catch (err) {
      this.toast('error', 'bufferFailed', { detail: errorDetail(err) });
      return;
    }
    let written = 0;
    let processed = 0;
    this.suspended++;
    try {
      await this.run(async () => {
        for (const path of paths) {
          const outcome = await this.saveDraft(path);
          processed++;
          if (outcome === 'saved') written++;
          else if (outcome === 'skipped') left++;
        }
      });
    } finally {
      this.suspended--;
      const current = this.state.doc;
      // Riprende l'autosave sospeso, ma mai per un documento eliminato su disco: sarebbe "Salva tutto"
      // a ricrearlo, un secondo dopo.
      if (current && current.saveState !== 'saved' && !current.deletedOnDisk) this.schedule('afterWrite');
    }
    // Ciclo interrotto (accesso perso, gestito da run()): le bozze non elaborate restano tutte.
    left += paths.length - processed;
    if (written > 0) this.bumpIndex();
    if (left > 0) this.toast('info', 'saveAllSkipped', { count: left });
    else if (!this.state.doc || this.state.doc.saveState === 'saved') this.toast('info', 'saveAllDone');
  }

  /** Scrive la bozza di un file non aperto se il disco coincide ancora con la sua base. */
  private async saveDraft(path: string): Promise<'saved' | 'skipped' | 'none'> {
    try {
      const draft = await this.deps.buffers.load(this.deps.workspaceId, path);
      if (!draft) return 'none';
      let disk: string | null = null;
      try {
        disk = (await this.deps.fs.read(path)).text;
      } catch (err) {
        if (!(err instanceof FsNotFoundError)) throw err;
      }
      // File cambiato su disco o eliminato: la bozza resta da risolvere aprendo il file.
      if (disk !== draft.base) return 'skipped';
      const { version } = await this.deps.fs.write(path, draft.text);
      this.versions.set(path, version);
      this.search.upsert(path, draft.text);
      this.snapshot(path, draft.text, 'save');
      // La bozza si cancella solo se nel frattempo nessuno l'ha riscritta.
      const current = await this.deps.buffers.load(this.deps.workspaceId, path);
      if (current && current.text === draft.text && current.base === draft.base) await this.clearBuffer(path);
      return 'saved';
    } catch (err) {
      if (isAccessError(err)) throw err; // accesso perso: lo gestisce run()
      return 'skipped';
    }
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
   * Mette al sicuro il documento aperto prima di lasciarlo (cambio file, chiusura, cambio cartella,
   * ricarica per aggiornamento): su disco se la modalità lo consente, altrimenti — o se la scrittura
   * non riesce — nel buffer di emergenza con la sua base. `durable` = testo su disco o nel buffer e
   * nessuna modifica arrivata nel frattempo. `failed` (buffer non scrivibile, oppure modifiche che non
   * si fermano dopo 3 tentativi) = chi chiama NON deve lasciare il documento.
   */
  async settle(): Promise<SettleResult> {
    for (let attempt = 0; attempt < MAX_SETTLE_ATTEMPTS; attempt++) {
      // Un salvataggio già in corso (anche esplicito, in `off`) va lasciato finire prima di decidere:
      // altrimenti, finendo a documento già lasciato, scarterebbe o sovrascriverebbe la bozza più nuova.
      while (this.saving) await this.saving;
      const doc = this.state.doc;
      if (!doc || doc.saveState === 'saved') return 'durable';
      // Scritture su disco sospese (controllo esterno, "Salva tutto"): flush() andrebbe comunque nel
      // buffer, con un suo toast; si passa direttamente al buffer qui sotto (un solo toast se fallisce).
      const toDisk =
        autosaveAllows(this.state.autosave.mode, 'switch') && !doc.conflict && this.state.status !== 'access-lost' && this.suspended === 0;
      if (toDisk) {
        await this.flush();
        const after = this.state.doc;
        if (!after || after.saveState === 'saved') return 'durable';
        // Battute arrivate durante la scrittura: si riprova a scriverle.
        if (after.saveState === 'dirty' && after.text !== doc.text) continue;
        // Scrittura fallita (o sospesa): si passa al buffer.
      }
      const current = this.state.doc;
      if (!current) return 'durable';
      const text = current.text;
      this.clearCheckpoint();
      try {
        await this.saveBuffer(current.path, text, this.bufferBase);
      } catch {
        this.toast('error', 'draftNotPersisted');
        return 'failed';
      }
      const after = this.state.doc;
      if (!after || (after.path === current.path && after.text === text)) return 'durable';
      // Modifiche arrivate mentre il buffer si scriveva: si ripete.
    }
    this.toast('error', 'draftNotPersisted');
    return 'failed';
  }

  private async writeDoc(path: string, text: string): Promise<void> {
    this.setDoc({ saveState: 'saving' });
    let version: Version;
    try {
      ({ version } = await this.deps.fs.write(path, text));
    } catch (err) {
      const current = this.state.doc;
      if (current?.path === path) {
        await this.saveBuffer(path, current.text, this.bufferBase).catch(() => undefined);
        this.setDoc({ saveState: 'error' });
      } else {
        // Documento lasciato durante la scrittura: la bozza messa lì da settle() è più nuova (o uguale)
        // del testo che si stava scrivendo e non va sovrascritta. Solo se manca si salva questo.
        const draft = await this.deps.buffers.load(this.deps.workspaceId, path).catch(() => null);
        if (draft === null) await this.saveBuffer(path, text, text).catch(() => undefined);
      }
      if (isAccessError(err)) {
        this.set({ status: 'access-lost' });
        return;
      }
      this.toast('error', 'saveFailed', { detail: errorDetail(err) });
      return;
    }
    // La scrittura è riuscita: quel che segue è manutenzione best-effort e non deve far
    // sembrare fallito un salvataggio che in realtà è andato a buon fine.
    const open = this.state.doc?.path === path;
    if (open) {
      // Testo, base e versione noti sono quelli del documento APERTO: se nel frattempo se n'è aperto
      // un altro (es. Ctrl+S durante l'ultimo settle() di un cambio file) non vanno toccati.
      this.knownText = text;
      this.bufferBase = text;
      this.knownVersion = version;
    }
    this.versions.set(path, version);
    this.search.upsert(path, text);
    this.snapshot(path, text, 'save');
    // Il buffer si scarta solo se non ci sono battute più nuove di quelle appena scritte: in `off` un
    // checkpoint arrivato durante la scrittura contiene testo che su disco non c'è ancora.
    const newer = open && this.state.doc!.text !== text;
    if (!open) {
      // Documento lasciato durante la scrittura: la bozza lasciata da settle() può contenere battute
      // più nuove. Si scarta solo se coincide con quanto scritto, altrimenti la si riferisce al disco.
      const left = await this.deps.buffers.load(this.deps.workspaceId, path).catch(() => null);
      if (left === null || left.text === text) await this.clearBuffer(path).catch(() => undefined);
      else await this.saveBuffer(path, left.text, text).catch(() => undefined);
    } else if (!newer) {
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
          // Il testo che la ricarica sta per sostituire (catturato ora, scritto senza attendere).
          this.snapshot(current.path, current.text, 'before-reload');
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

  private async doResolveConflict(choice: 'reload' | 'overwrite'): Promise<void> {
    const doc = this.state.doc;
    if (!doc?.conflict) return;
    if (choice === 'overwrite') {
      await this.run(() => this.overwrite(doc.path));
      return;
    }
    await this.run(async () => {
      const { text, version } = await this.deps.fs.read(doc.path);
      // Durante la lettura l'utente può aver aperto un altro file, risolto il conflitto in altro
      // modo o continuato a scrivere: in tutti questi casi il testo letto non va applicato,
      // altrimenti finirebbe in un altro documento o cancellerebbe battute non salvate.
      const current = this.state.doc;
      if (!current || current.path !== doc.path || !current.conflict || current.text !== doc.text) return;
      this.snapshot(doc.path, current.text, 'before-reload');
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

  /**
   * "Sovrascrivi": il testo su disco che sta per andare perso si legge (await) mentre il conflitto è
   * ancora attivo, quindi con l'autosalvataggio fermo. Dopo la lettura si rivalida percorso e
   * generation: se l'utente ha scritto o il documento è cambiato, si annulla e il conflitto resta.
   * Solo allora, senza altri await: snapshot before-overwrite (fire-and-forget), fine del conflitto e
   * scrittura.
   */
  private async overwrite(path: string): Promise<void> {
    const generation = this.generation;
    let diskText: string | null = null;
    if (this.deps.history) {
      try {
        diskText = (await this.deps.fs.read(path)).text;
      } catch (err) {
        if (!(err instanceof FsNotFoundError)) throw err; // file sparito: niente da mettere da parte
      }
      const current = this.state.doc;
      if (!current || current.path !== path || !current.conflict || this.generation !== generation) return;
    }
    if (diskText !== null) this.snapshot(path, diskText, 'before-overwrite');
    this.setDoc({ conflict: false, saveState: 'dirty' });
    await this.flush();
  }

  /**
   * Ripristina una versione della cronologia nel documento aperto come una modifica dell'utente
   * (segue la modalità di autosave; nell'editor è una transazione, quindi annullabile con Ctrl+Z).
   */
  private async doRestoreVersion(id: number): Promise<void> {
    const history = this.deps.history;
    const doc = this.state.doc;
    if (!history || !doc) return;
    const path = doc.path;
    const generation = this.generation;
    let version: Snapshot | null;
    try {
      version = await history.get(id);
    } catch (err) {
      this.historyError(err);
      return;
    }
    const current = this.state.doc;
    if (
      !version ||
      version.workspaceId !== this.deps.workspaceId ||
      version.path !== path ||
      !current ||
      current.path !== path ||
      this.generation !== generation
    ) {
      this.toast('info', 'restoreCancelled');
      return;
    }
    // Da qui niente await: snapshot del testo corrente (fire-and-forget) e sostituzione.
    this.snapshot(path, current.text, 'before-restore');
    const textLf = version.text.replace(/\r\n/g, '\n');
    this.edit(textLf);
    this.setDoc({ restore: { seq: ++this.restoreSeq, textLf } });
  }

  // --- cronologia locale ------------------------------------------------------------

  /**
   * Snapshot nella cronologia senza attesa: il testo è catturato adesso, la scrittura parte in fila
   * alle precedenti e un suo errore non blocca mai salvataggi, digitazione o cambi di file.
   */
  private snapshot(path: string, text: string, reason: SnapshotReason): void {
    const history = this.deps.history;
    if (!history) return;
    const workspaceId = this.deps.workspaceId;
    const now = this.now().getTime();
    this.historyChain = this.historyChain.then(async () => {
      try {
        const recent = await history.list(workspaceId, path);
        if (!shouldSnapshot(recent, { text, reason }, now)) return;
        await history.add({ workspaceId, path, savedAt: now, text, reason });
        // Subito dopo l'aggiunta, con lo stesso `now`: lo snapshot appena scritto è sempre il più fresco.
        await history.prune(workspaceId, path, now);
      } catch (err) {
        this.historyError(err);
      }
    });
  }

  private moveHistory(from: string, to: string): void {
    const history = this.deps.history;
    if (!history) return;
    const workspaceId = this.deps.workspaceId;
    this.historyChain = this.historyChain.then(() => history.move(workspaceId, from, to).catch((err) => this.historyError(err)));
  }

  /** Al massimo un toast: la cronologia è un di più, non deve disturbare a ogni salvataggio. */
  private historyError(err: unknown): void {
    if (this.historyErrorShown) return;
    this.historyErrorShown = true;
    this.toast('info', 'historyFailed', { detail: errorDetail(err) });
  }

  /** Si risolve quando le scritture della cronologia già lanciate sono finite. */
  historyIdle(): Promise<void> {
    return this.historyChain;
  }

  /** Versioni di un file, dalla più recente (vuoto senza cronologia o se non è leggibile). */
  async listHistory(path: string): Promise<Snapshot[]> {
    const history = this.deps.history;
    if (!history) return [];
    await this.historyChain;
    try {
      return await history.list(this.deps.workspaceId, path);
    } catch (err) {
      this.historyError(err);
      return [];
    }
  }

  async resume(): Promise<void> {
    this.set({ status: 'ready' });
    await this.checkExternal();
    if (autosaveAllows(this.state.autosave.mode, 'resume')) await this.flush();
    else await this.checkpoint();
  }

  // --- operazioni sui file ------------------------------------------------------

  private async doCreateFile(path: string, text: string): Promise<void> {
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
    if (created) await this.doOpenFile(path);
  }

  private async doCreateFolder(path: string): Promise<void> {
    await this.run(async () => {
      await this.deps.fs.mkdir(path);
      await this.refreshEntries();
    });
  }

  private async doRename(from: string, to: string): Promise<void> {
    // L'esito non conta: con la rinomina il documento resta aperto (cambia solo percorso).
    await this.settle();
    this.suspended++;
    this.moving++;
    // Un salvataggio partito mentre settle() scriveva il buffer (es. Ctrl+S) finisce prima di spostare
    // il file: altrimenti scriverebbe al vecchio percorso, ricreandolo, a rinomina fatta.
    try {
      while (this.saving) await this.saving;
      await this.run(async () => {
        await this.deps.fs.rename(from, to);
        this.moveHistory(from, to);

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

  private async doRemove(path: string): Promise<void> {
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
