/**
 * Primitive di file system su cui è costruito `WorkspaceFS`.
 * Implementazioni: `fsaOps` (File System Access API) e `memoryOps` (test).
 */
export interface OpsDirEntry {
  name: string;
  kind: 'file' | 'directory';
}

export interface StoredFile {
  blob: Blob;
  lastModified: number;
}

export interface FsOps {
  /** Contenuto di una cartella ('' = radice), oppure null se non esiste. */
  readDir(dir: string): Promise<OpsDirEntry[] | null>;
  /** File, oppure null se non esiste. */
  readFile(path: string): Promise<StoredFile | null>;
  /** Crea o sovrascrive, creando le cartelle intermedie. */
  writeFile(path: string, data: Blob | string): Promise<void>;
  /** Crea la cartella e le intermedie; nessun errore se esiste. */
  mkdir(path: string): Promise<void>;
  /** Elimina; nessun errore se non esiste. */
  removeEntry(path: string, recursive: boolean): Promise<void>;
  exists(path: string): Promise<'file' | 'directory' | null>;
  /** Rinomina di un file nella stessa cartella. Assente se la piattaforma non la offre. */
  moveFile?(from: string, toName: string): Promise<void>;
}
