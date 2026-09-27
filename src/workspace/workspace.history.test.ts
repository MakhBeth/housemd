import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryHistoryStore, type HistoryStore } from '../history/historyStore';
import { SAVE_THROTTLE_MS } from '../history/policy';
import { gate, harness, tick } from './testing/harness';
import type { Workspace } from './workspace';

const doc = (ws: Workspace) => ws.getState().doc!;
const entries = async (history: HistoryStore, path: string) =>
  (await history.list('ws-1', path)).map((s) => [s.reason, s.text]);

/** a.md in conflitto: testo non salvato "mio", su disco "loro". */
async function conflicted(history: HistoryStore) {
  const h = await harness({ 'a.md': 'A', 'b.md': 'B' }, { history });
  await h.ws.openFile('a.md');
  h.ws.edit('mio');
  h.ops.setFile('a.md', 'loro');
  await h.ws.checkExternal();
  assert.equal(h.ws.getState().doc!.conflict, true);
  return h;
}

test('snapshot after a successful save, throttled to one every 5 minutes', async () => {
  const history = memoryHistoryStore();
  let clock = new Date(2026, 8, 27, 14, 0, 0);
  const { ws } = await harness({ 'a.md': 'A' }, { history, now: () => clock });
  await ws.openFile('a.md');
  ws.edit('uno');
  await ws.flush();
  ws.edit('due');
  await ws.flush(); // meno di 5 minuti dopo: niente snapshot
  clock = new Date(clock.getTime() + SAVE_THROTTLE_MS);
  ws.edit('tre');
  await ws.flush();
  await ws.historyIdle();
  assert.deepEqual(await entries(history, 'a.md'), [['save', 'tre'], ['save', 'uno']]);
});

test('before-reload snapshot of the text lost when a clean document is reloaded from disk', async () => {
  const history = memoryHistoryStore();
  const { ops, ws } = await harness({ 'a.md': 'A' }, { history });
  await ws.openFile('a.md');
  ops.setFile('a.md', 'A da vim');
  await ws.checkExternal();
  await ws.historyIdle();
  assert.equal(doc(ws).text, 'A da vim');
  assert.deepEqual(await entries(history, 'a.md'), [['before-reload', 'A']]);
});

test('before-reload snapshot of the unsaved text when a conflict is resolved with "reload"', async () => {
  const history = memoryHistoryStore();
  const { ws } = await conflicted(history);
  await ws.resolveConflict('reload');
  await ws.historyIdle();
  assert.equal(doc(ws).text, 'loro');
  assert.deepEqual(await entries(history, 'a.md'), [['before-reload', 'mio']]);
});

test('before-overwrite snapshot of the disk text when a conflict is resolved with "overwrite"', async () => {
  const history = memoryHistoryStore();
  const { ops, ws } = await conflicted(history);
  await ws.resolveConflict('overwrite');
  await ws.historyIdle();
  assert.equal(await ops.textOf('a.md'), 'mio');
  assert.equal(doc(ws).conflict, false);
  assert.deepEqual(await entries(history, 'a.md'), [['save', 'mio'], ['before-overwrite', 'loro']]);
});

test('overwrite is cancelled if the user types during the protected disk read', async () => {
  const history = memoryHistoryStore();
  const { ops, fs, ws } = await conflicted(history);
  const originalRead = fs.read.bind(fs);
  const slow = gate();
  fs.read = async (path) => {
    if (path === 'a.md') await slow.wait;
    return originalRead(path);
  };
  const overwriting = ws.resolveConflict('overwrite');
  await tick(); // la lettura protetta è in corso
  ws.edit('mio, e ancora');
  slow.open();
  await overwriting;
  fs.read = originalRead;
  assert.equal(await ops.textOf('a.md'), 'loro', 'sovrascrittura annullata');
  assert.equal(doc(ws).conflict, true, "il conflitto resta: l'utente può scegliere di nuovo");
  assert.equal(doc(ws).text, 'mio, e ancora');
  await ws.historyIdle();
  assert.deepEqual(await entries(history, 'a.md'), [], 'nessuno snapshot di una sovrascrittura annullata');
});

test('a file switch requested during overwrite runs after it', async () => {
  const history = memoryHistoryStore();
  const { ops, fs, ws } = await conflicted(history);
  const originalRead = fs.read.bind(fs);
  const slow = gate();
  fs.read = async (path) => {
    if (path === 'a.md') await slow.wait;
    return originalRead(path);
  };
  const overwriting = ws.resolveConflict('overwrite');
  const opening = ws.openFile('b.md');
  await tick();
  assert.equal(doc(ws).path, 'a.md', 'il cambio file aspetta in coda');
  slow.open();
  await overwriting;
  await opening;
  fs.read = originalRead;
  assert.equal(await ops.textOf('a.md'), 'mio');
  assert.equal(doc(ws).path, 'b.md');
  await ws.historyIdle();
  assert.ok((await entries(history, 'a.md')).some(([reason, text]) => reason === 'before-overwrite' && text === 'loro'));
});

test('before-restore snapshot and restoreVersion replaces the text as a user edit', async () => {
  const history = memoryHistoryStore();
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A' }, { history });
  await ws.openFile('a.md');
  ws.edit('v1');
  await ws.flush();
  await ws.historyIdle();
  const [v1] = await history.list('ws-1', 'a.md');
  ws.edit('v2');
  await ws.restoreVersion(v1.id);
  assert.equal(doc(ws).text, 'v1');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.deepEqual(doc(ws).restore, { seq: 1, textLf: 'v1' });
  await ws.historyIdle();
  assert.deepEqual((await entries(history, 'a.md'))[0], ['before-restore', 'v2']);
  scheduler.advance(1000); // segue la modalità di autosave come una modifica dell'utente
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'v1');
});

test('a restore command is dropped at the next real edit', async () => {
  const history = memoryHistoryStore();
  const { ws } = await harness({ 'a.md': 'A' }, { history });
  await ws.openFile('a.md');
  ws.edit('v1');
  await ws.flush();
  await ws.historyIdle();
  const [v1] = await history.list('ws-1', 'a.md');
  ws.edit('v2');
  await ws.restoreVersion(v1.id);
  ws.edit('v1'); // l'editor applica il ripristino e rimanda lo stesso testo: il comando resta
  assert.equal(doc(ws).restore?.seq, 1);
  ws.edit('v1 e poi altro'); // battuta dell'utente
  assert.equal(doc(ws).restore, null, 'un editor rimontato non deve riapplicarlo');
  assert.equal(doc(ws).text, 'v1 e poi altro');
});

test('restoreVersion is cancelled if the user types while the version is loading', async () => {
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
  ws.edit('v2 e altro');
  slow.open();
  await restoring;
  history.get = originalGet;
  assert.equal(doc(ws).text, 'v2 e altro', 'la digitazione non viene sovrascritta');
  assert.equal(doc(ws).restore, null);
  assert.equal(ws.getState().toasts.at(-1)?.code, 'restoreCancelled');
  await ws.historyIdle();
  assert.ok(!(await entries(history, 'a.md')).some(([reason]) => reason === 'before-restore'));
});

test('restoreVersion then a file switch run in order', async () => {
  const history = memoryHistoryStore();
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { history });
  await ws.openFile('a.md');
  ws.edit('v1');
  await ws.flush();
  await ws.historyIdle();
  const [v1] = await history.list('ws-1', 'a.md');
  ws.edit('v2');
  const restoring = ws.restoreVersion(v1.id);
  const opening = ws.openFile('b.md');
  await restoring;
  await opening;
  assert.equal(doc(ws).path, 'b.md');
  assert.equal(doc(ws).text, 'B', 'il ripristino non finisce in B');
  assert.equal(await ops.textOf('a.md'), 'v1', 'A ripristinato e salvato al cambio file');
});

test('restoring a version of a CRLF file keeps CRLF line endings on save', async () => {
  const history = memoryHistoryStore();
  const { ops, ws } = await harness({ 'a.md': 'a\r\nb\r\n' }, { history });
  await ws.openFile('a.md');
  ws.edit('a\nb\nc\n');
  await ws.flush();
  await ws.historyIdle();
  assert.equal(await ops.textOf('a.md'), 'a\r\nb\r\nc\r\n');
  const [version] = await history.list('ws-1', 'a.md');
  ws.edit('x\n');
  await ws.restoreVersion(version.id);
  assert.equal(doc(ws).restore?.textLf, 'a\nb\nc\n', "all'editor arriva il testo con \\n");
  await ws.saveNow();
  assert.equal(await ops.textOf('a.md'), 'a\r\nb\r\nc\r\n');
});

test('renaming moves the history, deleting keeps it', async () => {
  const history = memoryHistoryStore();
  const { ws } = await harness({ 'old/a.md': 'A' }, { history });
  await ws.openFile('old/a.md');
  ws.edit('uno');
  await ws.flush();
  await ws.rename('old', 'new');
  await ws.historyIdle();
  assert.equal((await history.list('ws-1', 'new/a.md')).length, 1);
  assert.equal((await history.list('ws-1', 'old/a.md')).length, 0);
  await ws.remove('new/a.md');
  await ws.historyIdle();
  assert.equal((await history.list('ws-1', 'new/a.md')).length, 1, "l'eliminazione non cancella la cronologia");
});

test('a failing history store does not block saving and shows one toast', async () => {
  const history = memoryHistoryStore();
  history.add = async () => {
    throw new Error('QuotaExceededError');
  };
  const { ops, ws } = await harness({ 'a.md': 'A' }, { history });
  await ws.openFile('a.md');
  ws.edit('uno');
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'uno');
  assert.equal(doc(ws).saveState, 'saved');
  ws.edit('uno e due');
  await ws.flush();
  await ws.historyIdle();
  assert.equal(await ops.textOf('a.md'), 'uno e due');
  assert.equal(ws.getState().toasts.filter((t) => t.code === 'historyFailed').length, 1);
});

test('a slow history store never delays saving, typing or switching files', async () => {
  const history = memoryHistoryStore();
  const originalList = history.list;
  const slow = gate();
  history.list = async (workspaceId: string, path: string) => {
    await slow.wait;
    return originalList(workspaceId, path);
  };
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { history });
  await ws.openFile('a.md');
  ws.edit('uno');
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'uno');
  assert.equal(doc(ws).saveState, 'saved');
  ws.edit('due');
  await ws.openFile('b.md');
  assert.equal(doc(ws).path, 'b.md');
  assert.equal(await ops.textOf('a.md'), 'due');
  slow.open();
  await ws.historyIdle();
  history.list = originalList;
  assert.deepEqual(await entries(history, 'a.md'), [['save', 'uno']], '"due" arriva entro 5 minuti');
  assert.deepEqual(await entries(history, 'b.md'), []);
});
