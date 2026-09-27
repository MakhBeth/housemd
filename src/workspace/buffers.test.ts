import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { openDb, transactionDone } from '../lib/db';
import { indexedDbBufferStore, memoryBufferStore, type BufferStore } from './buffers';

let dbCount = 0;
const factories: Array<[string, () => BufferStore]> = [
  ['memory', () => memoryBufferStore()],
  ['indexedDB', () => indexedDbBufferStore(`buffers-${++dbCount}`)],
];

for (const [name, make] of factories) {
  test(`${name}: save, load and clear per workspace and path`, async () => {
    const store = make();
    await store.save('ws-1', 'a.md', 'bozza', 'base');
    assert.deepEqual(await store.load('ws-1', 'a.md'), { text: 'bozza', base: 'base' });
    assert.equal(await store.load('ws-2', 'a.md'), null, 'un altro workspace non vede il buffer');
    await store.clear('ws-1', 'a.md');
    assert.equal(await store.load('ws-1', 'a.md'), null);
  });

  test(`${name}: move renames file buffers and everything inside a folder`, async () => {
    const store = make();
    await store.save('ws-1', 'old/a.md', 'A', 'base-a');
    await store.save('ws-1', 'old/sub/b.md', 'B', 'base-b');
    await store.save('ws-1', 'older/c.md', 'C', 'base-c');
    await store.save('ws-2', 'old/a.md', 'altro', 'base-altro');
    await store.move('ws-1', 'old', 'new');
    assert.deepEqual(await store.load('ws-1', 'new/a.md'), { text: 'A', base: 'base-a' });
    assert.deepEqual(await store.load('ws-1', 'new/sub/b.md'), { text: 'B', base: 'base-b' });
    assert.equal(await store.load('ws-1', 'old/a.md'), null);
    assert.deepEqual(await store.load('ws-1', 'older/c.md'), { text: 'C', base: 'base-c' }, 'solo il prefisso esatto');
    assert.deepEqual(await store.load('ws-2', 'old/a.md'), { text: 'altro', base: 'base-altro' }, 'solo il workspace indicato');
  });
}

test('indexedDB: a legacy plain-string buffer (formato precedente) is read as { text, base }', async () => {
  const dbName = `buffers-${++dbCount}`;
  // Scrive direttamente nel formato precedente (una stringa), come avrebbe fatto una versione
  // di HouseMD antecedente all'introduzione della base del conflitto.
  const db = await openDb(dbName);
  const tx = db.transaction('buffers', 'readwrite');
  tx.objectStore('buffers').put('bozza legacy', `ws-1\u0000a.md`);
  await transactionDone(tx);
  db.close();

  const store = indexedDbBufferStore(dbName);
  assert.deepEqual(await store.load('ws-1', 'a.md'), { text: 'bozza legacy', base: 'bozza legacy' });
});
