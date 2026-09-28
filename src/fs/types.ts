export interface Version {
  lastModified: number;
  size: number;
}

export function sameVersion(a: Version | null | undefined, b: Version | null | undefined): boolean {
  if (!a || !b) return a === b;
  return a.lastModified === b.lastModified && a.size === b.size;
}

export interface FileEntry {
  kind: 'file';
  path: string;
  version: Version;
}

export interface DirEntry {
  kind: 'directory';
  path: string;
}

export type Entry = FileEntry | DirEntry;

/** File system della cartella aperta. Percorsi relativi alla radice, separatore '/'. */
export interface WorkspaceFS {
  /** Scansione ricorsiva: file .md (con versione) e cartelle da mostrare. */
  list(): Promise<Entry[]>;
  read(path: string): Promise<{ text: string; version: Version }>;
  readBlob(path: string): Promise<Blob>;
  /** Crea o sovrascrive, creando le cartelle intermedie. */
  write(path: string, data: string | Blob): Promise<{ version: Version }>;
  /** Versione del file, oppure null se non esiste. */
  stat(path: string): Promise<Version | null>;
  mkdir(path: string): Promise<void>;
  /** Rinomina file o cartella restando nella stessa cartella padre. */
  rename(from: string, to: string): Promise<void>;
  /** Elimina file o cartella (ricorsivamente); nessun errore se non esiste. */
  remove(path: string): Promise<void>;
}

export class FsNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Non trovato: ${path}`);
    this.name = 'FsNotFoundError';
  }
}

export class FsExistsError extends Error {
  constructor(readonly path: string) {
    super(`Esiste già: ${path}`);
    this.name = 'FsExistsError';
  }
}

/**
 * Il browser ha revocato l'accesso alla cartella (o la cartella non è più raggiungibile).
 * Solo NotAllowedError significa questo: SecurityError è un errore normale (mostrato come toast),
 * non implica che l'accesso alla cartella sia perso.
 */
export function isAccessError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'NotAllowedError';
}
