import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { openDb, transactionDone } from '../lib/db';
import { clearWorkspace, findKnownWorkspaceId, loadWorkspace, saveWorkspace } from './handleStore';

test('saveWorkspace stores the handle with a fresh workspaceId', async () => {
  const db = 'hs-1';
  assert.equal(await loadWorkspace(db), null);
  const first = await saveWorkspace({ name: 'blog' }, db);
  assert.match(first.workspaceId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await loadWorkspace(db), first);

  const second = await saveWorkspace({ name: 'note' }, db);
  assert.notEqual(second.workspaceId, first.workspaceId);
  assert.deepEqual((await loadWorkspace<{ name: string }>(db))?.handle, { name: 'note' });
});

test('saveWorkspace keeps an explicit workspaceId instead of generating one', async () => {
  const db = 'hs-3';
  const stored = await saveWorkspace({ name: 'blog' }, db, 'keep-me');
  assert.equal(stored.workspaceId, 'keep-me');
  assert.equal((await loadWorkspace(db))?.workspaceId, 'keep-me');
});

test('clearWorkspace forgets the folder', async () => {
  const db = 'hs-2';
  await saveWorkspace({ name: 'blog' }, db);
  await clearWorkspace(db);
  assert.equal(await loadWorkspace(db), null);
});

/** Handle finto: isSameEntry confronta il nome, come farebbe il browser con la stessa cartella. */
const picked = (name: string) => ({ name, isSameEntry: async (other: { name: string }) => other.name === name });

test('[codex F8] switching folders A -> B -> A keeps the original workspaceId of A', async () => {
  const db = 'hs-4';
  assert.equal(await findKnownWorkspaceId(picked('a'), db), null);
  const a = await saveWorkspace({ name: 'a' }, db);
  await saveWorkspace({ name: 'b' }, db);
  assert.equal(await findKnownWorkspaceId(picked('a'), db), a.workspaceId);
  assert.equal(await findKnownWorkspaceId(picked('c'), db), null);
});

test('[codex F8 round 2] known folders are never evicted: the first of 25 is still found', async () => {
  const db = 'hs-5';
  const first = await saveWorkspace({ name: 'f0' }, db);
  for (let i = 1; i < 25; i++) await saveWorkspace({ name: `f${i}` }, db);
  assert.equal(await findKnownWorkspaceId(picked('f0'), db), first.workspaceId);

  // Riselezionare la stessa cartella con lo stesso id non la duplica né cambia id.
  const again = await saveWorkspace({ name: 'f5' }, db, (await findKnownWorkspaceId(picked('f5'), db))!);
  assert.equal(await findKnownWorkspaceId(picked('f5'), db), again.workspaceId);
});

test('[codex F8 round 2] a pre-list `current` folder is migrated into the known list on the next save', async () => {
  const db = 'hs-7';
  const conn = await openDb(db);
  const tx = conn.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put({ handle: { name: 'vecchia' }, workspaceId: 'id-vecchio' }, 'current');
  await transactionDone(tx);
  conn.close();

  await saveWorkspace({ name: 'nuova' }, db);
  assert.equal(await findKnownWorkspaceId(picked('vecchia'), db), 'id-vecchio');
});

test('[codex F8] a database from before the known list still finds the current folder', async () => {
  const db = 'hs-6';
  const conn = await openDb(db);
  const tx = conn.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put({ handle: { name: 'vecchia' }, workspaceId: 'id-vecchio' }, 'current');
  await transactionDone(tx);
  conn.close();
  assert.equal(await findKnownWorkspaceId(picked('vecchia'), db), 'id-vecchio');
});

test('a corrupt current record means no saved folder', async () => {
  const dbName = 'hs-corrupt-1';
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put({ handle: null, workspaceId: '' }, 'current');
  await transactionDone(tx);
  db.close();
  assert.equal(await loadWorkspace(dbName), null);
});

test('corrupt entries in the known list are skipped, valid ones still match', async () => {
  const dbName = 'hs-corrupt-2';
  const a = await saveWorkspace({ name: 'a' }, dbName);
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  const store = tx.objectStore('workspace');
  store.put(['garbage', { handle: { name: 'x' } }, { handle: { name: 'a' }, workspaceId: a.workspaceId }], 'known');
  await transactionDone(tx);
  db.close();
  assert.equal(await findKnownWorkspaceId(picked('a'), dbName), a.workspaceId);
  // Il salvataggio successivo riscrive la lista senza le voci illeggibili.
  await saveWorkspace({ name: 'b' }, dbName);
  assert.equal(await findKnownWorkspaceId(picked('a'), dbName), a.workspaceId);
});
