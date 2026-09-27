import { DB_NAME, openDb, request, transactionDone } from '../lib/db';

export interface StoredWorkspace<H = FileSystemDirectoryHandle> {
  handle: H;
  /** Identità della cartella scelta: cambia quando si sceglie una cartella diversa. */
  workspaceId: string;
}

const KEY = 'current';

/** `workspaceId` esplicito: usato per tenere lo stesso id quando si riseleziona la stessa cartella. */
export async function saveWorkspace<H>(handle: H, dbName = DB_NAME, workspaceId: string = crypto.randomUUID()): Promise<StoredWorkspace<H>> {
  const stored: StoredWorkspace<H> = { handle, workspaceId };
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put(stored, KEY);
  await transactionDone(tx);
  db.close();
  return stored;
}

export async function loadWorkspace<H = FileSystemDirectoryHandle>(dbName = DB_NAME): Promise<StoredWorkspace<H> | null> {
  const db = await openDb(dbName);
  const stored = await request(db.transaction('workspace', 'readonly').objectStore('workspace').get(KEY));
  db.close();
  return (stored as StoredWorkspace<H> | undefined) ?? null;
}

export async function clearWorkspace(dbName = DB_NAME): Promise<void> {
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').delete(KEY);
  await transactionDone(tx);
  db.close();
}
