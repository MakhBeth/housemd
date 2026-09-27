import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { clearWorkspace, loadWorkspace, saveWorkspace } from './handleStore';

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
