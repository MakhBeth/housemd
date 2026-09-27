export const DB_NAME = 'HouseMD';
/** 1 = v1 (workspace, buffers); 2 = v1.1 (+ history). */
export const DB_VERSION = 2;
export const HISTORY_STORE = 'history';
/** Dopo quanto, se un'altra scheda blocca l'aggiornamento del database, lo si dice all'utente. */
export const DB_BLOCKED_NOTICE_MS = 3000;

export interface OpenDbOptions {
  blockedNoticeMs?: number;
}

const blockedListeners = new Set<() => void>();

/** Avvisa quando l'apertura resta bloccata da una scheda con una versione precedente. */
export function onDbBlocked(listener: () => void): () => void {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
}

/** Upgrade incrementale: crea solo ciò che manca, senza toccare gli store esistenti. */
function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('workspace')) db.createObjectStore('workspace');
  if (!db.objectStoreNames.contains('buffers')) db.createObjectStore('buffers');
  if (!db.objectStoreNames.contains(HISTORY_STORE)) {
    const history = db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
    history.createIndex('byFile', ['workspaceId', 'path', 'savedAt']);
  }
}

export function openDb(name = DB_NAME, options: OpenDbOptions = {}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    let notice: ReturnType<typeof setTimeout> | null = null;
    const stopNotice = () => {
      if (notice !== null) clearTimeout(notice);
      notice = null;
    };
    req.onupgradeneeded = () => upgrade(req.result);
    req.onblocked = () => {
      // Un'altra scheda tiene aperta la versione precedente: si aspetta che la chiuda; se ci mette
      // troppo, lo si dice (toast reloadOtherTabs).
      if (notice !== null) return;
      notice = setTimeout(() => {
        for (const listener of blockedListeners) listener();
      }, options.blockedNoticeMs ?? DB_BLOCKED_NOTICE_MS);
    };
    req.onsuccess = () => {
      stopNotice();
      const db = req.result;
      // Una scheda più nuova vuole aggiornare il database: si chiude subito per non bloccarla.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      stopNotice();
      reject(req.error);
    };
  });
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
