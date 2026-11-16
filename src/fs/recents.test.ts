import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { addRecent, loadRecents, MAX_RECENTS, parseRecents, pushRecent, recentKey, type Recent } from './recents';

type H = { id: string };
const same = async (a: H, b: H) => a.id === b.id;
const entry = (kind: 'folder' | 'file', id: string, openedAt: number, workspaceId?: string): Recent<H> => ({ kind, name: `${id}`, handle: { id }, openedAt, ...(workspaceId ? { workspaceId } : {}) });

test('a new entry goes first and replaces the same element of the same kind', async () => {
  const list = [entry('folder', 'a', 1, 'wa'), entry('file', 'x', 2)];
  const next = await pushRecent(list, entry('folder', 'a', 3), same);
  assert.deepEqual(next.map((r) => [r.kind, r.name, r.openedAt]), [['folder', 'a', 3], ['file', 'x', 2]]);
  assert.equal(next[0]!.workspaceId, 'wa', 'a reopened folder keeps its identity');
});

test('a folder and a file with the same handle id are two entries', async () => {
  const next = await pushRecent([entry('folder', 'a', 1)], entry('file', 'a', 2), same);
  assert.equal(next.length, 2);
});

test('at most MAX_RECENTS entries, the oldest go away', async () => {
  let list: Recent<H>[] = [];
  for (let i = 0; i < MAX_RECENTS + 3; i++) list = await pushRecent(list, entry('file', `f${i}`, i), same);
  assert.equal(list.length, MAX_RECENTS);
  assert.equal(list[0]!.name, `f${MAX_RECENTS + 2}`);
});

test('unreadable stored entries are dropped', () => {
  assert.deepEqual(parseRecents('x'), []);
  assert.equal(parseRecents([{ kind: 'folder', name: 'a', handle: {}, openedAt: 1 }, { kind: 'nope' }, null]).length, 1);
});

test('the key is stable per entry', () => {
  assert.equal(recentKey({ kind: 'file', name: 'a.md', openedAt: 5 }), 'file:5:a.md');
});

test('IndexedDB: added entries come back, newest first', async () => {
  const db = `recents-${Math.random()}`;
  await addRecent({ kind: 'folder', name: 'notes', handle: { id: 'n' }, openedAt: 1, workspaceId: 'w' }, same, db);
  await addRecent({ kind: 'file', name: 'a.md', handle: { id: 'a' }, openedAt: 2 }, same, db);
  await addRecent({ kind: 'folder', name: 'notes', handle: { id: 'n' }, openedAt: 3 }, same, db);
  const list = await loadRecents(db);
  assert.deepEqual(list.map((r) => [r.name, r.workspaceId]), [['notes', 'w'], ['a.md', undefined]]);
});
