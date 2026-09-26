import { DB_NAME, openDb, request, transactionDone } from '../lib/db';

/** Buffer di emergenza: testo non salvato, per workspace e percorso. */
export interface BufferStore {
  save(workspaceId: string, path: string, text: string): Promise<void>;
  load(workspaceId: string, path: string): Promise<string | null>;
  clear(workspaceId: string, path: string): Promise<void>;
  /** Sposta i buffer di `from` e di tutto ciò che contiene (rinomina di file o cartelle). */
  move(workspaceId: string, from: string, to: string): Promise<void>;
}

const SEP = '\u0000';
const bufferKey = (workspaceId: string, path: string) => `${workspaceId}${SEP}${path}`;

/** Nuovo percorso dopo aver rinominato `from` in `to`, oppure null se `path` non è coinvolto. */
function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return null;
}

export function memoryBufferStore(): BufferStore {
  const entries = new Map<string, string>();
  return {
    async save(ws, path, text) {
      entries.set(bufferKey(ws, path), text);
    },
    async load(ws, path) {
      return entries.get(bufferKey(ws, path)) ?? null;
    },
    async clear(ws, path) {
      entries.delete(bufferKey(ws, path));
    },
    async move(ws, from, to) {
      const prefix = `${ws}${SEP}`;
      for (const [key, text] of [...entries]) {
        if (!key.startsWith(prefix)) continue;
        const next = movedPath(key.slice(prefix.length), from, to);
        if (next === null) continue;
        entries.delete(key);
        entries.set(bufferKey(ws, next), text);
      }
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
    save: (ws, path, text) => withStore('readwrite', (s) => void s.put(text, bufferKey(ws, path))),
    load: (ws, path) => withStore('readonly', async (s) => ((await request(s.get(bufferKey(ws, path)))) as string | undefined) ?? null),
    clear: (ws, path) => withStore('readwrite', (s) => void s.delete(bufferKey(ws, path))),
    move: (ws, from, to) =>
      withStore('readwrite', async (s) => {
        const prefix = `${ws}${SEP}`;
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
        const keys = (await request(s.getAllKeys(range))) as string[];
        for (const key of keys) {
          const next = movedPath(key.slice(prefix.length), from, to);
          if (next === null) continue;
          const text = await request(s.get(key));
          s.delete(key);
          s.put(text, bufferKey(ws, next));
        }
      }),
  };
}
