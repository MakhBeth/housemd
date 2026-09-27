import test from 'node:test';
import assert from 'node:assert/strict';

import { harness } from './testing/harness';
import type { Workspace } from './workspace';

const doc = (ws: Workspace) => ws.getState().doc!;
const off = { autosave: { mode: 'off' as const, delayMs: 1000 } };

test('beginUpdate makes the document read-only and secures it', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  assert.equal(await ws.beginUpdate(), 'durable');
  assert.equal(ws.getState().updating, true);
  assert.equal(await ops.textOf('a.md'), 'mio');
  ws.edit('ignorato');
  assert.equal(doc(ws).text, 'mio', 'durante l’aggiornamento le modifiche sono ignorate');
});

test('beginUpdate in off mode secures the text in the buffer, not on disk', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('mio');
  assert.equal(await ws.beginUpdate(), 'durable');
  assert.equal(await ops.textOf('a.md'), 'A');
  assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'mio', base: 'A' });
});

test('when the document cannot be secured, endUpdate gives editing back', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  buffers.save = async () => {
    throw new Error('QuotaExceededError');
  };
  ws.edit('importante');
  assert.equal(await ws.beginUpdate(), 'failed');
  assert.equal(ws.getState().toasts.at(-1)?.code, 'draftNotPersisted');
  ws.endUpdate();
  assert.equal(ws.getState().updating, false);
  ws.edit('ancora');
  assert.equal(doc(ws).text, 'ancora');
});
