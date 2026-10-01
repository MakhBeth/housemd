import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { HISTORY_STORE, openDb, transactionDone } from '../lib/db';
import { MAX_SNAPSHOT_AGE_MS } from './policy';
import { indexedDbHistoryStore, memoryHistoryStore, type HistoryStore, type NewSnapshot } from './historyStore';

let dbCount = 0;
const factories: Array<[string, () => HistoryStore]> = [
  ['memory', () => memoryHistoryStore()],
  ['indexedDB', () => indexedDbHistoryStore(`history-${++dbCount}`)],
];

const at = (workspaceId: string, path: string, savedAt: number, text = `t${savedAt}`): NewSnapshot => ({
  workspaceId,
  path,
  savedAt,
  text,
  reason: 'save',
});

for (const [name, make] of factories) {
  test(`${name}: add, list newest first per workspace and path, get`, async () => {
    const store = make();
    const first = await store.add(at('ws-1', 'a.md', 100));
    await store.add(at('ws-1', 'a.md', 300));
    await store.add(at('ws-1', 'b.md', 200));
    await store.add(at('ws-2', 'a.md', 400));
    const list = await store.list('ws-1', 'a.md');
    assert.deepEqual(list.map((s) => s.savedAt), [300, 100]);
    assert.ok(list.every((s) => typeof s.id === 'number'));
    assert.deepEqual(await store.get(first), { ...at('ws-1', 'a.md', 100), id: first });
    assert.equal(await store.get(99_999), null);
  });

  test(`${name}: move follows file and folder renames within one workspace`, async () => {
    const store = make();
    await store.add(at('ws-1', 'old/a.md', 1));
    await store.add(at('ws-1', 'old/sub/b.md', 2));
    await store.add(at('ws-1', 'older/c.md', 3));
    await store.add(at('ws-2', 'old/a.md', 4));
    await store.move('ws-1', 'old', 'new');
    assert.equal((await store.list('ws-1', 'new/a.md')).length, 1);
    assert.equal((await store.list('ws-1', 'new/sub/b.md')).length, 1);
    assert.equal((await store.list('ws-1', 'old/a.md')).length, 0);
    assert.equal((await store.list('ws-1', 'older/c.md')).length, 1, 'solo il prefisso esatto');
    assert.equal((await store.list('ws-2', 'old/a.md')).length, 1, 'solo il workspace indicato');
  });

  test(`${name}: prune applies the policy to one file only`, async () => {
    const store = make();
    const now = MAX_SNAPSHOT_AGE_MS * 2;
    for (let i = 0; i < 52; i++) await store.add(at('ws-1', 'a.md', now - i));
    await store.add(at('ws-1', 'b.md', 0)); // vecchissimo, ma di un altro file
    await store.prune('ws-1', 'a.md', now);
    assert.equal((await store.list('ws-1', 'a.md')).length, 50);
    assert.equal((await store.list('ws-1', 'b.md')).length, 1);
  });
}

test('indexedDB: a corrupt snapshot is left out of the list and reads as null', async () => {
  const dbName = 'history-corrupt';
  const store = indexedDbHistoryStore(dbName);
  const good = await store.add({ workspaceId: 'ws', path: 'a.md', savedAt: 1, text: 'ok', reason: 'save' });
  const db = await openDb(dbName);
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  const badId = (await new Promise<IDBValidKey>((resolve, reject) => {
    const req = tx.objectStore(HISTORY_STORE).add({ workspaceId: 'ws', path: 'a.md', savedAt: 2, text: 42, reason: 'nope' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  })) as number;
  await transactionDone(tx);
  db.close();
  assert.deepEqual((await store.list('ws', 'a.md')).map((s) => s.id), [good]);
  assert.equal(await store.get(badId), null);
  assert.equal((await store.get(good))?.text, 'ok');
});

test('indexedDB: moving a snapshot keeps fields this version does not know (written by a newer one)', async () => {
  const dbName = 'history-unknown-fields';
  const store = indexedDbHistoryStore(dbName);
  const db = await openDb(dbName);
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  tx.objectStore(HISTORY_STORE).add({ workspaceId: 'ws', path: 'a.md', savedAt: 1, text: 'x', reason: 'save', author: 'futuro' });
  await transactionDone(tx);
  db.close();
  await store.move('ws', 'a.md', 'b.md');
  const [moved] = await store.list('ws', 'b.md');
  const raw = await new Promise<unknown>((resolve, reject) => {
    void openDb(dbName).then((db2) => {
      const req = db2.transaction(HISTORY_STORE).objectStore(HISTORY_STORE).get(moved.id);
      req.onsuccess = () => {
        db2.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  });
  assert.equal((raw as { author?: string }).author, 'futuro');
});
