/**
 * Modalità file singolo: un solo file `.md` aperto senza la sua cartella («Apri un file», «Apri con… HouseMD»).
 * Lo `Workspace` resta lo stesso: vede una cartella finta che contiene solo quel file (`singleFileOps`).
 * Due sorgenti: il file vero sulla File System Access API (`fsaFile` in `fsaOps.ts`) e, dove l'API manca,
 * una copia in memoria che si salva scaricandola (`memoryFile`).
 */
import type { BufferStore } from '../workspace/buffers';
import type { FsOps, StoredFile } from './ops';

export interface SingleFile {
  readonly name: string;
  /** Vero se le scritture finiscono sul file del disco; falso se restano in memoria finché non si scarica. */
  readonly writesToDisk: boolean;
  /** Sessione da riprendere (copia recuperata): lo workspace riusa questo id, con le sue bozze. */
  readonly sessionId?: string;
  read(): Promise<StoredFile>;
  write(data: Blob | string): Promise<void>;
  /** Chiede di nuovo il permesso di scrittura (solo con la File System Access API). */
  requestAccess?(): Promise<boolean>;
}

/** Copia in memoria (browser senza File System Access API): si salva scaricandola. */
export interface MemoryFile extends SingleFile {
  readonly writesToDisk: false;
  /** Ci sono modifiche scritte dopo l'ultimo download (o dall'apertura, o in una copia recuperata). */
  readonly pendingDownload: boolean;
  /** Contenuto attuale da scaricare; da chiamare solo a download partito. */
  takeDownload(): Blob;
  /** Avvisa a ogni scrittura e a ogni download. */
  subscribe(listener: () => void): () => void;
}

/** Il file singolo non permette di creare, rinominare o eliminare: niente cartella da toccare. */
export class SingleFileUnsupportedError extends Error {
  constructor() {
    super('Operazione non disponibile con un file singolo');
    this.name = 'SingleFileUnsupportedError';
  }
}

export function memoryFile(
  file: { name: string; blob: Blob; lastModified: number; pending?: boolean; sessionId?: string },
  now: () => number = Date.now,
): MemoryFile {
  let current: StoredFile = { blob: file.blob, lastModified: file.lastModified };
  let pending = file.pending ?? false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    name: file.name,
    writesToDisk: false,
    sessionId: file.sessionId,
    get pendingDownload() {
      return pending;
    },
    async read() {
      return current;
    },
    async write(data) {
      const blob = typeof data === 'string' ? new Blob([data], { type: 'text/markdown' }) : data;
      // lastModified sempre crescente: lo Workspace confronta le versioni per riconoscere le modifiche esterne.
      current = { blob, lastModified: Math.max(now(), current.lastModified + 1) };
      pending = true;
      notify();
    },
    takeDownload() {
      pending = false;
      notify();
      return current.blob;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export function isMemoryFile(file: SingleFile | null): file is MemoryFile {
  return !!file && !file.writesToDisk;
}

/** Modifiche che esistono solo in memoria, in attesa di un download. */
export function pendingDownload(file: SingleFile | null): boolean {
  return isMemoryFile(file) && file.pendingDownload;
}

/** `FsOps` di una cartella finta con dentro solo il file: lettura e scrittura sì, il resto no. */
export function singleFileOps(file: SingleFile): FsOps {
  const isFile = (path: string) => path === file.name;
  const unsupported = async (): Promise<never> => {
    throw new SingleFileUnsupportedError();
  };
  return {
    async readDir(dir) {
      return dir === '' ? [{ name: file.name, kind: 'file' }] : null;
    },
    async readFile(path) {
      return isFile(path) ? file.read() : null;
    },
    async writeFile(path, data) {
      // Lo Workspace scrive solo il documento aperto; ogni altro percorso (nuovo file, copia) non ha dove andare.
      if (!isFile(path)) return unsupported();
      await file.write(data);
    },
    mkdir: unsupported,
    removeEntry: unsupported,
    async exists(path) {
      if (path === '') return 'directory';
      return isFile(path) ? 'file' : null;
    },
  };
}

/**
 * Copie in memoria non ancora scaricate, tenute nel buffer di emergenza sotto un id proprio (lo Workspace
 * scarta il suo buffer appena «salva» in memoria): sopravvivono a un crash e si riprendono dalla schermata
 * iniziale. La chiave è `<sessione>/<nome>`, mai il solo nome: due file omonimi restano distinti.
 */
export const PENDING_WORKSPACE = 'single-file:pending';

export interface PendingCopy {
  key: string;
  sessionId: string;
  name: string;
}

const pendingKey = (sessionId: string, name: string) => `${sessionId}/${name}`;

function parseKey(key: string): PendingCopy | null {
  const slash = key.indexOf('/');
  return slash > 0 && slash < key.length - 1 ? { key, sessionId: key.slice(0, slash), name: key.slice(slash + 1) } : null;
}

/** Tiene la copia di emergenza allineata al file: scritta a ogni modifica, tolta al download. */
export function mirrorPending(file: MemoryFile, store: BufferStore, sessionId: string): () => void {
  const key = pendingKey(sessionId, file.name);
  // In fila: una scrittura lenta non deve finire dopo un download e far risorgere la copia.
  let chain: Promise<unknown> = Promise.resolve();
  const sync = () => {
    chain = chain
      .then(async () => {
        if (!file.pendingDownload) return store.clear(PENDING_WORKSPACE, key);
        const text = await (await file.read()).blob.text();
        if (file.pendingDownload) await store.save(PENDING_WORKSPACE, key, text, '');
      })
      .catch(() => undefined);
  };
  if (file.pendingDownload) sync();
  return file.subscribe(sync);
}

export async function listPending(store: BufferStore): Promise<PendingCopy[]> {
  const keys = await store.list(PENDING_WORKSPACE).catch(() => [] as string[]);
  return keys.map(parseKey).filter((copy): copy is PendingCopy => copy !== null);
}

/** La copia ripresa: in memoria, ancora da scaricare, nella stessa sessione (stesse bozze e stessa chiave). */
export async function recoverPending(store: BufferStore, copy: PendingCopy, now: () => number = Date.now): Promise<MemoryFile | null> {
  const saved = await store.load(PENDING_WORKSPACE, copy.key);
  if (!saved) return null;
  return memoryFile({ name: copy.name, blob: new Blob([saved.text], { type: 'text/markdown' }), lastModified: now(), pending: true, sessionId: copy.sessionId }, now);
}
