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

  test(`${name}: [codex F9 round 2] list returns the buffered paths of one workspace only`, async () => {
    const store = make();
    assert.deepEqual(await store.list('ws-1'), []);
    await store.save('ws-1', 'b.md', 'B', 'b');
    await store.save('ws-1', 'n/a.md', 'A', 'a');
    await store.save('ws-10', 'x.md', 'altro prefisso', 'x');
    await store.save('ws-2', 'y.md', 'altro workspace', 'y');
    assert.deepEqual((await store.list('ws-1')).sort(), ['b.md', 'n/a.md']);
    await store.clear('ws-1', 'b.md');
    assert.deepEqual(await store.list('ws-1'), ['n/a.md']);
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

test('indexedDB: a corrupt buffer record loads as null instead of throwing', async () => {
  const dbName = `buffers-corrupt-${++dbCount}`;
  const store = indexedDbBufferStore(dbName);
  await store.save('ws', 'ok.md', 'text', 'base');
  const db = await openDb(dbName);
  const tx = db.transaction('buffers', 'readwrite');
  tx.objectStore('buffers').put({ text: 42 }, 'ws\u0000bad.md');
  tx.objectStore('buffers').put(null, 'ws\u0000null.md');
  await transactionDone(tx);
  db.close();
  assert.equal(await store.load('ws', 'bad.md'), null);
  assert.equal(await store.load('ws', 'null.md'), null);
  assert.deepEqual(await store.load('ws', 'ok.md'), { text: 'text', base: 'base' });
  // Comportamento attuale: il percorso resta nell'elenco (le bozze orfane lo mostrano, il caricamento dà null).
  assert.deepEqual((await store.list('ws')).sort(), ['bad.md', 'null.md', 'ok.md']);
});
