import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadWorkspace } from '../fs/handleStore';
import { indexedDbBufferStore } from '../workspace/buffers';
import { DB_VERSION, onDbBlocked, openDb } from './db';

/** Il database com'era in v1: versione 1 con gli store workspace e buffers, senza onversionchange. */
function openV1(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('workspace');
      req.result.createObjectStore('buffers');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openRaw(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(db: IDBDatabase, store: string, value: unknown, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

test('openDb migrates a v1 database keeping buffers and folders', async () => {
  const name = 'db-migrate';
  const v1 = await openV1(name);
  await put(v1, 'buffers', { text: 'bozza', base: 'base' }, 'ws-1\u0000a.md');
  await put(v1, 'workspace', { handle: { name: 'blog' }, workspaceId: 'id-blog' }, 'current');
  v1.close();

  const db = await openDb(name);
  assert.equal(db.version, DB_VERSION);
  for (const store of ['workspace', 'buffers', 'history']) assert.ok(db.objectStoreNames.contains(store), store);
  const history = db.transaction('history', 'readonly').objectStore('history');
  assert.equal(history.keyPath, 'id');
  assert.equal(history.autoIncrement, true);
  assert.deepEqual(history.index('byFile').keyPath, ['workspaceId', 'path', 'savedAt']);
  db.close();

  assert.deepEqual(await indexedDbBufferStore(name).load('ws-1', 'a.md'), { text: 'bozza', base: 'base' });
  assert.equal((await loadWorkspace(name))?.workspaceId, 'id-blog');
});

test('openDb rejects with VersionError when a newer version exists', async () => {
  const name = 'db-newer';
  (await openRaw(name, DB_VERSION + 1)).close();
  await assert.rejects(openDb(name), (err: unknown) => (err as DOMException).name === 'VersionError');
});

test('a connection closes itself when a newer version is requested', async () => {
  const name = 'db-versionchange';
  await openDb(name); // resta aperta, come in una scheda di HouseMD
  let blocked = false;
  const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION + 1);
    req.onblocked = () => {
      blocked = true;
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(blocked, false, 'la connessione vecchia si è chiusa da sola');
  upgraded.close();
});

test('openDb waits for an old tab and notifies after the delay', async () => {
  const name = 'db-blocked';
  const oldTab = await openV1(name); // come il codice v1: non chiude la connessione
  let notified = 0;
  const stop = onDbBlocked(() => notified++);
  const opening = openDb(name, { blockedNoticeMs: 10 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(notified, 1, 'avviso "salva e chiudi le altre schede"');
  oldTab.close();
  const db = await opening;
  assert.equal(db.version, DB_VERSION);
  db.close();
  stop();
});
