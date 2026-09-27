import { DB_NAME, openDb, request, transactionDone } from '../lib/db';

/** Testo non salvato più la sua base: l'ultimo contenuto noto su disco quando il buffer è stato scritto. */
export interface BufferedText {
  text: string;
  base: string;
}

/** Buffer di emergenza: testo non salvato, per workspace e percorso. */
export interface BufferStore {
  save(workspaceId: string, path: string, text: string, base: string): Promise<void>;
  load(workspaceId: string, path: string): Promise<BufferedText | null>;
  clear(workspaceId: string, path: string): Promise<void>;
  /** Sposta i buffer di `from` e di tutto ciò che contiene (rinomina di file o cartelle). */
  move(workspaceId: string, from: string, to: string): Promise<void>;
  /** Percorsi che hanno un buffer in questo workspace (anche di file non più su disco). */
  list(workspaceId: string): Promise<string[]>;
}

const SEP = '\u0000';
const bufferKey = (workspaceId: string, path: string) => `${workspaceId}${SEP}${path}`;

/** Nuovo percorso dopo aver rinominato `from` in `to`, oppure null se `path` non è coinvolto. */
function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return null;
}

/** Un buffer scritto dal formato precedente (semplice stringa) diventa `{ text, base: text }`. */
function normalizeStored(value: BufferedText | string): BufferedText {
  return typeof value === 'string' ? { text: value, base: value } : value;
}

export function memoryBufferStore(): BufferStore {
  const entries = new Map<string, BufferedText | string>();
  return {
    async save(ws, path, text, base) {
      entries.set(bufferKey(ws, path), { text, base });
    },
    async load(ws, path) {
      const value = entries.get(bufferKey(ws, path));
      return value === undefined ? null : normalizeStored(value);
    },
    async clear(ws, path) {
      entries.delete(bufferKey(ws, path));
    },
    async move(ws, from, to) {
      const prefix = `${ws}${SEP}`;
      for (const [key, value] of [...entries]) {
        if (!key.startsWith(prefix)) continue;
        const next = movedPath(key.slice(prefix.length), from, to);
        if (next === null) continue;
        entries.delete(key);
        entries.set(bufferKey(ws, next), value);
      }
    },
    async list(ws) {
      const prefix = `${ws}${SEP}`;
      return [...entries.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
    },
  };
}

export function indexedDbBufferStore(dbName = DB_NAME): BufferStore {
  const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> => {
    const db = await openDb(dbName);
    try {
      const tx = db.transaction('buffers', mode);
      const done = transactionDone(tx);
      const result = await fn(tx.objectStore('buffers'));
      await done;
      return result;
    } finally {
      db.close();
    }
  };

  return {
    save: (ws, path, text, base) => withStore('readwrite', (s) => void s.put({ text, base }, bufferKey(ws, path))),
    load: (ws, path) =>
      withStore('readonly', async (s) => {
        const value = (await request(s.get(bufferKey(ws, path)))) as BufferedText | string | undefined;
        return value === undefined ? null : normalizeStored(value);
      }),
    clear: (ws, path) => withStore('readwrite', (s) => void s.delete(bufferKey(ws, path))),
    move: (ws, from, to) =>
      withStore('readwrite', async (s) => {
        const prefix = `${ws}${SEP}`;
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
        const keys = (await request(s.getAllKeys(range))) as string[];
        for (const key of keys) {
          const next = movedPath(key.slice(prefix.length), from, to);
          if (next === null) continue;
          const value = await request(s.get(key));
          s.delete(key);
          s.put(value, bufferKey(ws, next));
        }
      }),
    list: (ws) =>
      withStore('readonly', async (s) => {
        const prefix = `${ws}${SEP}`;
        const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
        const keys = (await request(s.getAllKeys(range))) as string[];
        return keys.map((key) => key.slice(prefix.length));
      }),
  };
}
