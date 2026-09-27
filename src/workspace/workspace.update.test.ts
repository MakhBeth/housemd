import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryHistoryStore } from '../history/historyStore';
import { gate, harness, tick } from './testing/harness';
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

test('a restore still loading when the update begins is cancelled', async () => {
  const history = memoryHistoryStore();
  const { ws } = await harness({ 'a.md': 'A' }, { history });
  await ws.openFile('a.md');
  ws.edit('v1');
  await ws.flush();
  await ws.historyIdle();
  const [v1] = await history.list('ws-1', 'a.md');
  ws.edit('v2');
  const originalGet = history.get;
  const slow = gate();
  history.get = async (id: number) => {
    await slow.wait;
    return originalGet(id);
  };
  const restoring = ws.restoreVersion(v1.id);
  await tick();
  const updating = ws.beginUpdate();
  slow.open();
  await restoring;
  assert.equal(await updating, 'durable');
  assert.equal(doc(ws).text, 'v2', 'l’editor è in sola lettura: niente testo che il modello non ha');
  assert.equal(doc(ws).restore, null);
  assert.equal(ws.getState().toasts.at(-1)?.code, 'restoreCancelled');
});
