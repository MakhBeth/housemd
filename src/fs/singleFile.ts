/**
 * Modalità file singolo: un solo file `.md` aperto senza la sua cartella («Apri un file», «Apri con… HouseMD»).
 * Lo `Workspace` resta lo stesso: vede una cartella finta che contiene solo quel file (`singleFileOps`).
 * Due sorgenti: il file vero sulla File System Access API (`fsaFile` in `fsaOps.ts`) e, dove l'API manca,
 * una copia in memoria che si salva scaricandola (`memoryFile`).
 */
import type { FsOps, StoredFile } from './ops';

export interface SingleFile {
  readonly name: string;
  /** Vero se le scritture finiscono sul file del disco; falso se restano in memoria finché non si scarica. */
  readonly writesToDisk: boolean;
  read(): Promise<StoredFile>;
  write(data: Blob | string): Promise<void>;
  /** Chiede di nuovo il permesso di scrittura (solo con la File System Access API). */
  requestAccess?(): Promise<boolean>;
}

/** Copia in memoria (browser senza File System Access API): si salva scaricandola. */
export interface MemoryFile extends SingleFile {
  readonly writesToDisk: false;
  /** Ci sono modifiche scritte dopo l'ultimo download (o dall'apertura). */
  readonly pendingDownload: boolean;
  /** Contenuto attuale da scaricare; da chiamare solo a download partito. */
  takeDownload(): Blob;
  subscribe(listener: () => void): () => void;
}

/** Il file singolo non permette di creare, rinominare o eliminare: niente cartella da toccare. */
export class SingleFileUnsupportedError extends Error {
  constructor() {
    super('Operazione non disponibile con un file singolo');
    this.name = 'SingleFileUnsupportedError';
  }
}

export function memoryFile(file: { name: string; blob: Blob; lastModified: number }, now: () => number = Date.now): MemoryFile {
  let current: StoredFile = { blob: file.blob, lastModified: file.lastModified };
  let pending = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    name: file.name,
    writesToDisk: false,
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
      if (!pending) {
        pending = true;
        notify();
      }
    },
    takeDownload() {
      if (pending) {
        pending = false;
        notify();
      }
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
