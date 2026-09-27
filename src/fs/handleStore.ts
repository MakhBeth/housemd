import { DB_NAME, openDb, request, transactionDone } from '../lib/db';

export interface StoredWorkspace<H = FileSystemDirectoryHandle> {
  handle: H;
  /** Identità della cartella scelta: cambia quando si sceglie una cartella diversa. */
  workspaceId: string;
}

const KEY = 'current';
/**
 * Tutte le cartelle aperte in passato (la più recente per prima), per ritrovarne il workspaceId.
 * Nessun limite: le voci sono minuscole e scartarne una renderebbe orfane le sue bozze.
 */
const KNOWN_KEY = 'known';

/** `workspaceId` esplicito: usato per tenere lo stesso id quando si riseleziona la stessa cartella. */
export async function saveWorkspace<H>(handle: H, dbName = DB_NAME, workspaceId: string = crypto.randomUUID()): Promise<StoredWorkspace<H>> {
  const stored: StoredWorkspace<H> = { handle, workspaceId };
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  const store = tx.objectStore('workspace');
  const [knownList, previous] = (await Promise.all([request(store.get(KNOWN_KEY)), request(store.get(KEY))])) as [
    StoredWorkspace<H>[] | undefined,
    StoredWorkspace<H> | undefined,
  ];
  // Chi arriva da una versione precedente ha solo `current`: la si porta nella lista prima di
  // sovrascriverla, altrimenti la sua identità (e le sue bozze) andrebbero perse.
  const known = knownList ?? [];
  if (previous && !known.some((k) => k.workspaceId === previous.workspaceId)) known.push(previous);
  store.put(stored, KEY);
  store.put([stored, ...known.filter((k) => k.workspaceId !== workspaceId)], KNOWN_KEY);
  await transactionDone(tx);
  db.close();
  return stored;
}

/**
 * workspaceId di una cartella già aperta in passato, oppure null: così
 * passando A → B → A i buffer di emergenza e l'ultimo file aperto di A restano raggiungibili.
 */
export async function findKnownWorkspaceId<H extends { isSameEntry(other: H): Promise<boolean> }>(
  handle: H,
  dbName = DB_NAME,
): Promise<string | null> {
  const db = await openDb(dbName);
  const store = db.transaction('workspace', 'readonly').objectStore('workspace');
  // Chi arriva da una versione precedente ha solo la cartella corrente, non ancora la lista.
  const [knownList, current] = (await Promise.all([request(store.get(KNOWN_KEY)), request(store.get(KEY))])) as [
    StoredWorkspace<H>[] | undefined,
    StoredWorkspace<H> | undefined,
  ];
  const known = knownList ?? [];
  db.close();
  for (const entry of current ? [...known, current] : known) {
    if (await handle.isSameEntry(entry.handle).catch(() => false)) return entry.workspaceId;
  }
  return null;
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
