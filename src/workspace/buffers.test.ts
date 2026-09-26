import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { indexedDbBufferStore, memoryBufferStore, type BufferStore } from './buffers';

let dbCount = 0;
const factories: Array<[string, () => BufferStore]> = [
  ['memory', () => memoryBufferStore()],
  ['indexedDB', () => indexedDbBufferStore(`buffers-${++dbCount}`)],
];

for (const [name, make] of factories) {
  test(`${name}: save, load and clear per workspace and path`, async () => {
    const store = make();
    await store.save('ws-1', 'a.md', 'bozza');
    assert.equal(await store.load('ws-1', 'a.md'), 'bozza');
    assert.equal(await store.load('ws-2', 'a.md'), null, 'un altro workspace non vede il buffer');
    await store.clear('ws-1', 'a.md');
    assert.equal(await store.load('ws-1', 'a.md'), null);
  });

  test(`${name}: move renames file buffers and everything inside a folder`, async () => {
    const store = make();
    await store.save('ws-1', 'old/a.md', 'A');
    await store.save('ws-1', 'old/sub/b.md', 'B');
    await store.save('ws-1', 'older/c.md', 'C');
    await store.save('ws-2', 'old/a.md', 'altro');
    await store.move('ws-1', 'old', 'new');
    assert.equal(await store.load('ws-1', 'new/a.md'), 'A');
    assert.equal(await store.load('ws-1', 'new/sub/b.md'), 'B');
    assert.equal(await store.load('ws-1', 'old/a.md'), null);
    assert.equal(await store.load('ws-1', 'older/c.md'), 'C', 'solo il prefisso esatto');
    assert.equal(await store.load('ws-2', 'old/a.md'), 'altro', 'solo il workspace indicato');
  });
}
