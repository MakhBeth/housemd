import test from 'node:test';
import assert from 'node:assert/strict';

import { ImageUrlCache } from './imageCache';

test('get reads each image once and returns an object URL', async () => {
  let n = 0;
  const reads: string[] = [];
  const cache = new ImageUrlCache(
    async (path) => {
      reads.push(path);
      return new Blob([path]);
    },
    () => `blob:${++n}`,
    () => undefined,
  );
  assert.equal(await cache.get('a.png'), 'blob:1');
  assert.equal(await cache.get('a.png'), 'blob:1');
  assert.deepEqual(reads, ['a.png']);
});

test('missing images return null and are retried later', async () => {
  let exists = false;
  const cache = new ImageUrlCache(
    async () => {
      if (!exists) throw new Error('not found');
      return new Blob(['x']);
    },
    () => 'blob:x',
    () => undefined,
  );
  assert.equal(await cache.get('a.png'), null);
  exists = true;
  assert.equal(await cache.get('a.png'), 'blob:x');
});

test('retain revokes URLs no longer used and clear revokes everything', async () => {
  const revoked: string[] = [];
  const cache = new ImageUrlCache(async (p) => new Blob([p]), (b) => `blob:${b.size}`, (u) => revoked.push(u));
  await cache.get('a.png');
  await cache.get('bb.png');
  await cache.retain(['bb.png']);
  assert.deepEqual(revoked, ['blob:5']);
  await cache.clear();
  assert.deepEqual(revoked, ['blob:5', 'blob:6']);
});
