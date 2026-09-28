import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryBufferStore } from './buffers';
import { gate, harness, tick } from './testing/harness';
import type { Workspace } from './workspace';

const doc = (ws: Workspace) => ws.getState().doc!;
const off = { autosave: { mode: 'off' as const, delayMs: 1000 } };

test('settle is durable for a clean document and after saving to disk', async () => {
  const { ws } = await harness({ 'a.md': 'A' });
  await ws.openFile('a.md');
  assert.equal(await ws.settle(), 'durable');
  ws.edit('A2');
  assert.equal(await ws.settle(), 'durable');
  assert.equal(doc(ws).saveState, 'saved');
});

test('settle in off mode is durable once the text is in the buffer', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('A2');
  assert.equal(await ws.settle(), 'durable');
  assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'A2', base: 'A' });
});

test('a buffer error while switching file keeps the document open', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, off);
  await ws.openFile('a.md');
  buffers.save = async () => {
    throw new Error('QuotaExceededError');
  };
  ws.edit('importante');
  await ws.openFile('b.md');
  assert.equal(doc(ws).path, 'a.md', 'il documento resta aperto');
  assert.equal(doc(ws).text, 'importante');
  assert.equal(ws.getState().toasts.at(-1)?.code, 'draftNotPersisted');
  assert.equal(await ops.textOf('a.md'), 'A');
});

test('when both the disk write and the buffer fail, the document stays open', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { ops: { failWrite: (path) => path === 'a.md' } });
  await ws.openFile('a.md');
  buffers.save = async () => {
    throw new Error('IndexedDB non disponibile');
  };
  ws.edit('importante');
  await ws.openFile('b.md');
  assert.equal(doc(ws).path, 'a.md');
  const codes = ws.getState().toasts.map((t) => t.code);
  assert.ok(codes.includes('saveFailed'));
  assert.equal(codes.at(-1), 'draftNotPersisted');
});

test('edits arriving while settling are persisted too', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('uno');
  const originalSave = buffers.save.bind(buffers);
  let calls = 0;
  buffers.save = async (id, path, text, base) => {
    calls++;
    await originalSave(id, path, text, base);
    if (calls === 1) ws.edit('uno e due'); // una battuta arriva mentre il buffer si sta scrivendo
  };
  assert.equal(await ws.settle(), 'durable');
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'uno e due');
  assert.equal(calls, 2);
});

test('settle gives up after 3 unstable attempts and the file switch does not happen', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, off);
  await ws.openFile('a.md');
  ws.edit('0');
  const originalSave = buffers.save.bind(buffers);
  let calls = 0;
  buffers.save = async (id, path, text, base) => {
    await originalSave(id, path, text, base);
    ws.edit(String(++calls)); // l'utente non smette mai di scrivere
  };
  await ws.openFile('b.md');
  assert.equal(doc(ws).path, 'a.md');
  assert.equal(calls, 3);
  assert.equal(ws.getState().toasts.at(-1)?.code, 'draftNotPersisted');
});

test('keystrokes during the cleanup of the destination buffer are secured before switching', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B', 'B'); // bozza di b.md identica al disco: verrà scartata
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { buffers });
  await ws.openFile('a.md');
  const originalClear = buffers.clear.bind(buffers);
  const slow = gate();
  buffers.clear = async (id, path) => {
    if (path === 'b.md') await slow.wait;
    return originalClear(id, path);
  };
  const opening = ws.openFile('b.md');
  await tick(); // l'apertura è ferma sulla pulizia del buffer di b.md
  ws.edit('a modificato');
  slow.open();
  await opening;
  buffers.clear = originalClear;
  assert.equal(doc(ws).path, 'b.md');
  assert.equal(await ops.textOf('a.md'), 'a modificato', 'la battuta sul vecchio documento non va persa');
  assert.equal(await buffers.load('ws-1', 'b.md'), null);
});

test('closeFile returns false and keeps the document when it cannot be secured', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  buffers.save = async () => {
    throw new Error('QuotaExceededError');
  };
  ws.edit('importante');
  assert.equal(await ws.closeFile(), false);
  assert.equal(doc(ws).text, 'importante');
});

test('closeFile returns true and closes a document once it is secured', async () => {
  const { buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('bozza');
  assert.equal(await ws.closeFile(), true);
  assert.equal(ws.getState().doc, null);
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'bozza');
});

// --- review di fdaa4f6: settle() aspetta un salvataggio esplicito in corso -------------------------

/** In `off`: "T1" si sta scrivendo (Ctrl+S, scrittura ferma su un cancello), poi l'utente scrive "T2" e lascia il documento. */
async function leavingDuringExplicitSave(writeOk: boolean, leave: (ws: Workspace) => Promise<unknown>) {
  const h = await harness({ 'a.md': 'A', 'b.md': 'B' }, off);
  await h.ws.openFile('a.md');
  const originalWrite = h.ops.writeFile.bind(h.ops);
  const slow = gate();
  h.ops.writeFile = async (path, data) => {
    await slow.wait;
    if (!writeOk) throw new Error('EIO');
    return originalWrite(path, data);
  };
  h.ws.edit('T1');
  const saving = h.ws.saveNow();
  h.ws.edit('T2');
  const leaving = leave(h.ws);
  await tick();
  slow.open();
  const left = await leaving;
  await saving;
  h.ops.writeFile = originalWrite;
  return { ...h, left };
}

for (const [name, leave] of [
  ['switching file', (ws: Workspace) => ws.openFile('b.md')],
  ['closeFile', (ws: Workspace) => ws.closeFile()],
] as const) {
  test(`${name} during an explicit save that succeeds keeps the newer text as a draft on the written text`, async () => {
    const { ops, buffers, ws, left } = await leavingDuringExplicitSave(true, leave);
    if (name === 'closeFile') assert.equal(left, true);
    assert.equal(ws.getState().doc?.path ?? null, name === 'closeFile' ? null : 'b.md');
    assert.equal(await ops.textOf('a.md'), 'T1');
    assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'T2', base: 'T1' }, 'T2 non va perso');
  });

  test(`${name} during an explicit save that fails keeps the newer text as a draft`, async () => {
    const { ops, buffers, ws, left } = await leavingDuringExplicitSave(false, leave);
    if (name === 'closeFile') assert.equal(left, true);
    assert.equal(ws.getState().doc?.path ?? null, name === 'closeFile' ? null : 'b.md');
    assert.equal(await ops.textOf('a.md'), 'A');
    assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'T2', base: 'A' }, 'T2 non va perso');
  });
}

test('a buffer failure during a suspended scan shows a single toast when leaving the document', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  const originalReadDir = ops.readDir.bind(ops);
  const slow = gate();
  ops.readDir = async (dir) => {
    await slow.wait;
    return originalReadDir(dir);
  };
  const checking = ws.checkExternal();
  await tick(); // scritture su disco sospese
  buffers.save = async () => {
    throw new Error('QuotaExceededError');
  };
  ws.edit('importante');
  const before = ws.getState().toasts.length;
  await ws.openFile('b.md');
  assert.equal(ws.getState().doc?.path, 'a.md');
  assert.deepEqual(ws.getState().toasts.slice(before).map((t) => t.code), ['draftNotPersisted']);
  slow.open();
  await checking;
  ops.readDir = originalReadDir;
});

for (const [name, prepare] of [
  [
    'conflicted',
    async (h: Awaited<ReturnType<typeof harness>>) => {
      h.ws.edit('mio');
      h.ops.setFile('a.md', 'loro');
      await h.ws.checkExternal();
      assert.equal(doc(h.ws).conflict, true);
    },
  ],
  [
    'deleted on disk',
    async (h: Awaited<ReturnType<typeof harness>>) => {
      h.ws.edit('mio');
      await h.ws.blur();
      h.ops.files.delete('a.md');
      await h.ws.checkExternal();
      assert.equal(doc(h.ws).deletedOnDisk, true);
    },
  ],
] as const) {
  test(`reopening the ${name} open document keeps the live text instead of a stale draft`, async () => {
    const h = await harness({ 'a.md': 'A' }, off);
    const { buffers, ws } = h;
    await ws.openFile('a.md');
    await prepare(h);
    const originalLoad = buffers.load.bind(buffers);
    const slow = gate();
    buffers.load = async (id, path) => {
      await slow.wait;
      return originalLoad(id, path);
    };
    const revision = doc(ws).revision;
    const reopening = ws.openFile('a.md');
    await tick(); // lettura della bozza in corso (se ci fosse)
    ws.edit('più nuovo');
    slow.open();
    await reopening;
    buffers.load = originalLoad;
    assert.equal(doc(ws).text, 'più nuovo', 'il testo digitato durante la riapertura resta');
    assert.equal(doc(ws).revision, revision, 'l’editor non viene reimpostato');
    await ws.blur();
    assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'più nuovo', 'il buffer non torna al testo vecchio');
  });
}
