import test from 'node:test';
import assert from 'node:assert/strict';

import type { Entry, Version } from '../fs/types';
import { decideExternal, diffScan, type ExternalCheck } from './external';

const v = (lastModified: number, size: number): Version => ({ lastModified, size });

function check(overrides: Partial<ExternalCheck>): ExternalCheck {
  return {
    known: v(1, 5),
    knownText: 'ciao!',
    dirty: false,
    stat: async () => v(1, 5),
    read: async () => ({ text: 'ciao!', version: v(1, 5) }),
    ...overrides,
  };
}

test('same version means unchanged, without reading the file', async () => {
  let reads = 0;
  const d = await decideExternal(check({ read: async () => { reads++; return { text: '', version: v(0, 0) }; } }));
  assert.deepEqual(d, { kind: 'unchanged' });
  assert.equal(reads, 0);
});

test('missing file is deleted', async () => {
  assert.deepEqual(await decideExternal(check({ stat: async () => null })), { kind: 'deleted' });
});

test('new version with identical content only updates the version', async () => {
  const d = await decideExternal(check({ stat: async () => v(2, 5), read: async () => ({ text: 'ciao!', version: v(2, 5) }) }));
  assert.deepEqual(d, { kind: 'update-version', version: v(2, 5) });
});

test('changed content reloads a clean document', async () => {
  const d = await decideExternal(check({ stat: async () => v(2, 4), read: async () => ({ text: 'ciao', version: v(2, 4) }) }));
  assert.deepEqual(d, { kind: 'reload', text: 'ciao', version: v(2, 4) });
});

test('changed content conflicts with a dirty document', async () => {
  const d = await decideExternal(check({ dirty: true, stat: async () => v(2, 4), read: async () => ({ text: 'ciao', version: v(2, 4) }) }));
  assert.deepEqual(d, { kind: 'conflict' });
});

test('same timestamp but different size is still a change', async () => {
  const d = await decideExternal(check({ stat: async () => v(1, 6), read: async () => ({ text: 'ciao!!', version: v(1, 6) }) }));
  assert.equal(d.kind, 'reload');
});

test('diffScan lists added, changed and removed files', () => {
  const known = new Map([['a.md', v(1, 1)], ['b.md', v(1, 1)], ['c.md', v(1, 1)]]);
  const entries: Entry[] = [
    { kind: 'file', path: 'a.md', version: v(1, 1) },
    { kind: 'file', path: 'b.md', version: v(2, 1) },
    { kind: 'directory', path: 'n' },
    { kind: 'file', path: 'n/d.md', version: v(1, 1) },
  ];
  assert.deepEqual(diffScan(known, entries), { changed: ['b.md', 'n/d.md'], removed: ['c.md'] });
});
