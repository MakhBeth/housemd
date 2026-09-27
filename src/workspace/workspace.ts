import { CONFIG_FILE, DEFAULT_CONFIG, parseConfig, type HouseConfig } from '../config/config';
import { imageFileName, imageLink, uniquePath } from '../config/images';
import { FsExistsError, FsNotFoundError, isAccessError, type Entry, type Version, type WorkspaceFS } from '../fs/types';
import { detectEol, withEol, type Eol } from '../lib/paths';
import { SearchIndex } from '../search/searchIndex';
import { newNotePath, resolveWikiLink } from '../wikilinks/wikilinks';
import type { BufferStore } from './buffers';
import { decideExternal, diffScan } from './external';

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

export interface Toast {
  id: number;
  kind: 'error' | 'info';
  message: string;
}

export interface WorkspaceState {
  status: 'loading' | 'ready' | 'access-lost';
  name: string;
  entries: Entry[];
  config: HouseConfig;
  doc: OpenDoc | null;
  toasts: Toast[];
  /** Aumenta a ogni modifica dell'indice di ricerca / lista dei file. */
  indexRevision: number;
}

export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const AUTOSAVE_MS = 1000;

export interface WorkspaceDeps {
  fs: WorkspaceFS;
  workspaceId: string;
  name: string;
  buffers: BufferStore;
  scheduler?: Scheduler;
  now?: () => Date;
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
  private timer: unknown = null;
  private saving: Promise<void> | null = null;
  private toastSeq = 0;

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

  private toast(kind: Toast['kind'], message: string): void {
    this.set({ toasts: [...this.state.toasts, { id: ++this.toastSeq, kind, message }] });
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
        await this.deps.buffers.save(this.deps.workspaceId, doc.path, doc.text).catch(() => undefined);
      }
      this.set({ status: 'access-lost' });
      return;
    }
    const message = err instanceof FsExistsError ? err.message : `Operazione non riuscita: ${(err as Error).message}`;
    this.toast('error', message);
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
      const { config, warning } = parseConfig(configText);
      if (warning) this.toast('info', warning);
      for (const entry of entries) {
        if (entry.kind !== 'file') continue;
        const { text, version } = await this.deps.fs.read(entry.path);
        this.search.upsert(entry.path, text);
        this.versions.set(entry.path, version);
      }
      this.set({ entries, config, status: 'ready', indexRevision: this.state.indexRevision + 1 });
    });
  }

  private async refreshEntries(): Promise<void> {
    this.set({ entries: await this.deps.fs.list() });
  }

  // --- file aperto --------------------------------------------------------------

  async openFile(path: string): Promise<void> {
    await this.settle();
    await this.run(async () => {
      const { text, version } = await this.deps.fs.read(path);
      this.knownText = text;
      this.knownVersion = version;
      this.versions.set(path, version);
      const buffered = await this.deps.buffers.load(this.deps.workspaceId, path);
      const restored = buffered !== null && buffered !== text;
      if (buffered !== null && !restored) await this.deps.buffers.clear(this.deps.workspaceId, path);
      this.set({
        doc: {
          path,
          text: restored ? buffered : text,
          eol: detectEol(text),
          saveState: restored ? 'dirty' : 'saved',
          conflict: false,
          deletedOnDisk: false,
          revision: (this.state.doc?.revision ?? 0) + 1,
        },
      });
      if (restored) {
        this.toast('info', `Ripristinate le modifiche non salvate di ${path}`);
        this.schedule();
      }
    });
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
    this.schedule();
  }

  private schedule(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
    if (this.state.doc?.conflict) return;
    this.timer = this.scheduler.set(() => {
      this.timer = null;
      void this.flush();
    }, AUTOSAVE_MS);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
    if (this.saving) await this.saving;
    const doc = this.state.doc;
    if (!doc || doc.conflict || this.state.status === 'access-lost') return;
    if (doc.saveState !== 'dirty' && doc.saveState !== 'error') return;
    this.saving = this.writeDoc(doc.path, doc.text).finally(() => {
      this.saving = null;
    });
    await this.saving;
  }

  /**
   * Prima di lasciare il file aperto: salva finché non restano modifiche (anche quelle arrivate
   * durante un salvataggio). Se non si riesce (errore, conflitto, accesso perso), il testo finisce
   * nel buffer di emergenza, così non va mai perso.
   */
  private async settle(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const doc = this.state.doc;
      if (!doc || doc.saveState === 'saved' || doc.conflict || this.state.status === 'access-lost') break;
      await this.flush();
      if (this.state.doc?.saveState === 'error') break;
    }
    const doc = this.state.doc;
    if (doc && doc.saveState !== 'saved') {
      await this.deps.buffers.save(this.deps.workspaceId, doc.path, doc.text).catch(() => undefined);
    }
  }

  private async writeDoc(path: string, text: string): Promise<void> {
    this.setDoc({ saveState: 'saving' });
    try {
      const { version } = await this.deps.fs.write(path, text);
      this.knownText = text;
      this.knownVersion = version;
      this.versions.set(path, version);
      this.search.upsert(path, text);
      await this.deps.buffers.clear(this.deps.workspaceId, path);
      if (!this.state.entries.some((e) => e.path === path)) await this.refreshEntries();
      this.bumpIndex();
      const current = this.state.doc;
      if (current?.path !== path) return;
      if (current.text === text) {
        this.setDoc({ saveState: 'saved', deletedOnDisk: false });
      } else {
        this.setDoc({ saveState: 'dirty', deletedOnDisk: false });
        this.schedule();
      }
    } catch (err) {
      const current = this.state.doc;
      const pending = current?.path === path ? current.text : text;
      await this.deps.buffers.save(this.deps.workspaceId, path, pending).catch(() => undefined);
      if (current?.path === path) this.setDoc({ saveState: 'error' });
      if (isAccessError(err)) {
        this.set({ status: 'access-lost' });
        return;
      }
      this.toast('error', `Salvataggio non riuscito: ${(err as Error).message}`);
    }
  }

  // --- modifiche esterne --------------------------------------------------------

  async checkExternal(): Promise<void> {
    if (this.state.status !== 'ready') return;
    if (this.saving) await this.saving;
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
      const decision = await decideExternal({
        known: this.knownVersion,
        knownText: this.knownText,
        dirty: doc.saveState !== 'saved',
        stat: () => this.deps.fs.stat(doc.path),
        read: () => this.deps.fs.read(doc.path),
      });
      switch (decision.kind) {
        case 'unchanged':
          return;
        case 'deleted':
          if (!doc.deletedOnDisk) this.toast('info', `${doc.path} è stato eliminato fuori da HouseMD`);
          this.setDoc({ deletedOnDisk: true, saveState: 'dirty' });
          this.search.remove(doc.path);
          this.versions.delete(doc.path);
          return;
        case 'update-version':
          this.knownVersion = decision.version;
          this.versions.set(doc.path, decision.version);
          return;
        case 'reload':
          this.knownText = decision.text;
          this.knownVersion = decision.version;
          this.versions.set(doc.path, decision.version);
          this.search.upsert(doc.path, decision.text);
          this.setDoc({ text: decision.text, eol: detectEol(decision.text), saveState: 'saved', deletedOnDisk: false, revision: doc.revision + 1 });
          this.bumpIndex();
          return;
        case 'conflict':
          if (this.timer !== null) this.scheduler.clear(this.timer);
          this.timer = null;
          this.setDoc({ conflict: true });
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
      this.knownText = text;
      this.knownVersion = version;
      this.versions.set(doc.path, version);
      this.search.upsert(doc.path, text);
      await this.deps.buffers.clear(this.deps.workspaceId, doc.path);
      this.setDoc({ text, eol: detectEol(text), saveState: 'saved', conflict: false, revision: doc.revision + 1 });
      this.bumpIndex();
    });
  }

  async resume(): Promise<void> {
    this.set({ status: 'ready' });
    await this.checkExternal();
    await this.flush();
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
    await this.run(async () => {
      await this.deps.fs.rename(from, to);
      await this.deps.buffers.move(this.deps.workspaceId, from, to);
      for (const path of [...this.versions.keys()]) {
        const next = movedPath(path, from, to);
        if (next === null) continue;
        this.search.remove(path);
        this.versions.delete(path);
        const { text, version } = await this.deps.fs.read(next);
        this.search.upsert(next, text);
        this.versions.set(next, version);
      }
      const doc = this.state.doc;
      const docPath = doc ? movedPath(doc.path, from, to) : null;
      if (docPath !== null) {
        this.knownVersion = this.versions.get(docPath) ?? (await this.deps.fs.stat(docPath));
        this.setDoc({ path: docPath });
      }
      await this.refreshEntries();
      this.bumpIndex();
    });
  }

  async remove(path: string): Promise<void> {
    const doc = this.state.doc;
    const closing = doc !== null && inside(doc.path, path);
    if (closing) {
      // Niente salvataggi automatici mentre eliminiamo: riscriverebbero il file.
      if (this.timer !== null) this.scheduler.clear(this.timer);
      this.timer = null;
      if (this.saving) await this.saving;
    }
    await this.run(async () => {
      await this.deps.fs.remove(path);
      if (closing) this.set({ doc: null });
      for (const p of [...this.versions.keys()]) {
        if (!inside(p, path)) continue;
        this.search.remove(p);
        this.versions.delete(p);
        await this.deps.buffers.clear(this.deps.workspaceId, p);
      }
      await this.refreshEntries();
      this.bumpIndex();
    });
    // Eliminazione fallita: il file resta aperto con le sue modifiche, riprendiamo a salvare.
    const current = this.state.doc;
    if (closing && current && current.saveState !== 'saved') this.schedule();
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
    this.listeners.clear();
  }
}
