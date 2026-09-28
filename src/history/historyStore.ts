import { DB_NAME, HISTORY_STORE, openDb, request, transactionDone } from '../lib/db';
import { movedPath } from '../lib/paths';
import { toPrune } from './policy';

/** Perché è stato preso lo snapshot. */
export type SnapshotReason = 'save' | 'before-reload' | 'before-overwrite' | 'before-restore';
export const SNAPSHOT_REASONS: readonly SnapshotReason[] = ['save', 'before-reload', 'before-overwrite', 'before-restore'];

export interface Snapshot {
  id: number;
  workspaceId: string;
  path: string;
  savedAt: number;
  text: string;
  reason: SnapshotReason;
}

export type NewSnapshot = Omit<Snapshot, 'id'>;

/** Cronologia locale delle versioni di ogni file, per workspace. */
export interface HistoryStore {
  add(snapshot: NewSnapshot): Promise<number>;
  /** Snapshot di un file, dal più recente. */
  list(workspaceId: string, path: string): Promise<Snapshot[]>;
  get(id: number): Promise<Snapshot | null>;
  /** Sposta la cronologia di `from` e di tutto ciò che contiene (rinomina di file o cartelle). */
  move(workspaceId: string, from: string, to: string): Promise<void>;
  /** Elimina gli snapshot del file oltre i limiti della policy. */
  prune(workspaceId: string, path: string, now: number): Promise<void>;
}

const newestFirst = (a: Snapshot, b: Snapshot) => b.savedAt - a.savedAt || b.id - a.id;

export function memoryHistoryStore(): HistoryStore {
  const items = new Map<number, Snapshot>();
  let seq = 0;
  const listOf = (workspaceId: string, path: string) =>
    [...items.values()].filter((s) => s.workspaceId === workspaceId && s.path === path).sort(newestFirst);
  return {
    async add(snapshot) {
      const id = ++seq;
      items.set(id, { ...snapshot, id });
      return id;
    },
    async list(workspaceId, path) {
      return listOf(workspaceId, path).map((s) => ({ ...s }));
    },
    async get(id) {
      const found = items.get(id);
      return found ? { ...found } : null;
    },
    async move(workspaceId, from, to) {
      for (const [id, s] of items) {
        if (s.workspaceId !== workspaceId) continue;
        const next = movedPath(s.path, from, to);
        if (next !== null) items.set(id, { ...s, path: next });
      }
    },
    async prune(workspaceId, path, now) {
      for (const id of toPrune(listOf(workspaceId, path), now)) items.delete(id);
    },
  };
}

export function indexedDbHistoryStore(dbName = DB_NAME): HistoryStore {
  const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> => {
    const db = await openDb(dbName);
    try {
      const tx = db.transaction(HISTORY_STORE, mode);
      const done = transactionDone(tx);
      const result = await fn(tx.objectStore(HISTORY_STORE));
      await done;
      return result;
    } finally {
      db.close();
    }
  };
  /** Tutti gli snapshot di un file, sull'indice [workspaceId, path, savedAt]. */
  const fileRange = (workspaceId: string, path: string) =>
    IDBKeyRange.bound([workspaceId, path, -Infinity], [workspaceId, path, Infinity]);

  return {
    add: (snapshot) => withStore('readwrite', async (store) => (await request(store.add(snapshot))) as number),
    list: (workspaceId, path) =>
      withStore('readonly', async (store) =>
        ((await request(store.index('byFile').getAll(fileRange(workspaceId, path)))) as Snapshot[]).sort(newestFirst),
      ),
    get: (id) => withStore('readonly', async (store) => ((await request(store.get(id))) as Snapshot | undefined) ?? null),
    move: (workspaceId, from, to) =>
      withStore('readwrite', async (store) => {
        // Da [ws, from] a [ws, from + "/￿"]: il file stesso e tutto ciò che contiene (più
        // qualche vicino come "from-x", scartato da movedPath).
        const range = IDBKeyRange.bound([workspaceId, from], [workspaceId, `${from}/￿`]);
        const found = (await request(store.index('byFile').getAll(range))) as Snapshot[];
        for (const s of found) {
          const next = movedPath(s.path, from, to);
          if (next !== null) store.put({ ...s, path: next });
        }
      }),
    prune: (workspaceId, path, now) =>
      withStore('readwrite', async (store) => {
        const found = (await request(store.index('byFile').getAll(fileRange(workspaceId, path)))) as Snapshot[];
        for (const id of toPrune(found, now)) store.delete(id);
      }),
  };
}
