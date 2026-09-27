import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkspaceFS } from '../fs/workspaceFS';
import type { AutosaveMode } from './autosave';
import { memoryBufferStore } from './buffers';
import { clockScheduler, gate, harness, tick } from './testing/harness';
import { Workspace } from './workspace';

const doc = (ws: Workspace) => ws.getState().doc!;
const autosave = (mode: AutosaveMode, delayMs = 1000) => ({ autosave: { mode, delayMs } });
const notAllowed = ['onFocusChange', 'off'] as const;

test('afterDelay saves after the configured pause, not before', async () => {
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('afterDelay', 3000));
  await ws.openFile('a.md');
  ws.edit('nuovo');
  scheduler.advance(2999);
  await tick();
  assert.equal(await ops.textOf('a.md'), 'A');
  scheduler.advance(1);
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
  assert.equal(doc(ws).saveState, 'saved');
});

test('onFocusChange never saves on a timer: it checkpoints the buffer and saves on blur', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('onFocusChange'));
  await ws.openFile('a.md');
  ws.edit('nuovo');
  scheduler.advance(60_000);
  await tick();
  assert.equal(await ops.textOf('a.md'), 'A', 'nessun salvataggio a tempo');
  assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'nuovo', base: 'A' }, 'checkpoint nel buffer');
  assert.equal(doc(ws).saveState, 'dirty');
  await ws.blur();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(await buffers.load('ws-1', 'a.md'), null);
});

test('off writes to disk only on explicit save: blur just checkpoints the buffer', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  ws.edit('nuovo');
  await ws.blur();
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'nuovo');
  scheduler.advance(60_000);
  await tick();
  assert.equal(await ops.textOf('a.md'), 'A');
  await ws.saveNow();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(await buffers.load('ws-1', 'a.md'), null);
});

for (const mode of notAllowed) {
  test(`checkpoint is written within 5 s of continuous typing (maxWait) in ${mode}`, async () => {
    const { buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave(mode));
    await ws.openFile('a.md');
    ws.edit('v0');
    for (let i = 1; i <= 9; i++) {
      scheduler.advance(500);
      ws.edit(`v${i}`);
    }
    // 4,5 s di digitazione continua: il debounce di 1 s non è mai scaduto.
    assert.equal(await buffers.load('ws-1', 'a.md'), null);
    scheduler.advance(500); // t = 5 s: scatta l'attesa massima
    assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'v9');
    ws.edit('v10');
    scheduler.advance(1000); // dopo un checkpoint torna a valere il debounce
    assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'v10');
  });
}

test('the checkpoint maxWait keeps working while an external scan is stuck', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  const originalReadDir = ops.readDir.bind(ops);
  const slow = gate();
  ops.readDir = async (dir) => {
    await slow.wait;
    return originalReadDir(dir);
  };
  const checking = ws.checkExternal();
  await tick(); // la scansione è ferma, con le scritture su disco sospese
  ws.edit('v0');
  for (let i = 1; i <= 9; i++) {
    scheduler.advance(500);
    ws.edit(`v${i}`);
  }
  scheduler.advance(500); // t = 5 s
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'v9', 'maxWait rispettato anche a scansione ferma');
  slow.open();
  await checking;
  ops.readDir = originalReadDir;
  assert.equal(await ops.textOf('a.md'), 'A');
});

test('switching file writes to disk in afterDelay and onFocusChange, only the draft in off', async () => {
  for (const mode of ['afterDelay', 'onFocusChange', 'off'] as const) {
    const { ops, buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, autosave(mode));
    await ws.openFile('a.md');
    ws.edit('A2');
    await ws.openFile('b.md');
    assert.equal(doc(ws).path, 'b.md', mode);
    if (mode === 'off') {
      assert.equal(await ops.textOf('a.md'), 'A', 'off: niente disco');
      assert.deepEqual(await buffers.load('ws-1', 'a.md'), { text: 'A2', base: 'A' }, 'off: bozza con la sua base');
      assert.deepEqual(ws.getState().drafts, ['a.md']);
    } else {
      assert.equal(await ops.textOf('a.md'), 'A2', `${mode}: su disco`);
      assert.equal(await buffers.load('ws-1', 'a.md'), null);
    }
  }
});

test('a draft left in off mode is restored as dirty (not a conflict) when the file is reopened', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, autosave('off'));
  await ws.openFile('a.md');
  ws.edit('A2');
  await ws.openFile('b.md');
  await ws.openFile('a.md');
  assert.equal(doc(ws).text, 'A2');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.equal(doc(ws).conflict, false);
  assert.equal(await ops.textOf('a.md'), 'A');
});

test('setAutosave to off with a pending timed save does not write and buffers the text', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('afterDelay'));
  await ws.openFile('a.md');
  ws.edit('nuovo');
  assert.equal(scheduler.pending(), 1, 'salvataggio a tempo in attesa');
  ws.setAutosave({ mode: 'off', delayMs: 1000 });
  assert.deepEqual(ws.getState().autosave, { mode: 'off', delayMs: 1000 });
  scheduler.advance(60_000);
  await tick();
  assert.equal(await ops.textOf('a.md'), 'A');
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'nuovo');
});

test('setAutosave back to afterDelay reschedules the timed save with the new delay', async () => {
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  ws.edit('nuovo');
  ws.setAutosave({ mode: 'afterDelay', delayMs: 2000 });
  scheduler.advance(1999);
  await tick();
  assert.equal(await ops.textOf('a.md'), 'A');
  scheduler.advance(1);
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
});

test('resume() in off mode buffers instead of writing', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  ops.writeFile = async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  };
  ws.edit('uno');
  await ws.saveNow();
  assert.equal(ws.getState().status, 'access-lost');
  ws.edit('uno e due');
  ops.writeFile = originalWrite;
  await ws.resume();
  assert.equal(ws.getState().status, 'ready');
  assert.equal(await ops.textOf('a.md'), 'A', 'resume non scrive su disco in off');
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'uno e due');
});

test('resume() in afterDelay still saves right away', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A' }, autosave('afterDelay'));
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  ops.writeFile = async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  };
  ws.edit('uno');
  await ws.flush();
  ops.writeFile = originalWrite;
  await ws.resume();
  assert.equal(await ops.textOf('a.md'), 'uno');
});

for (const mode of notAllowed) {
  test(`a restored draft is not saved on a timer in ${mode}`, async () => {
    const buffers = memoryBufferStore();
    await buffers.save('ws-1', 'a.md', 'bozza', 'A');
    const { ops, scheduler, ws } = await harness({ 'a.md': 'A' }, { ...autosave(mode), buffers });
    await ws.openFile('a.md');
    assert.equal(doc(ws).saveState, 'dirty');
    scheduler.advance(60_000);
    await tick();
    assert.equal(await ops.textOf('a.md'), 'A');
  });

  test(`edits typed during an explicit save are not saved on a timer in ${mode}`, async () => {
    const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave(mode));
    await ws.openFile('a.md');
    const originalWrite = ops.writeFile.bind(ops);
    const slow = gate();
    ops.writeFile = async (path, data) => {
      await slow.wait;
      return originalWrite(path, data);
    };
    ws.edit('uno');
    const saving = ws.saveNow();
    ws.edit('due');
    slow.open();
    await saving;
    ops.writeFile = originalWrite;
    assert.equal(await ops.textOf('a.md'), 'uno');
    assert.equal(doc(ws).saveState, 'dirty');
    scheduler.advance(60_000);
    await tick();
    assert.equal(await ops.textOf('a.md'), 'uno', 'nessun salvataggio automatico dopo la scrittura');
    assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'due', 'ma il testo è nel buffer');
  });

  test(`edits typed during checkExternal are not saved on a timer in ${mode}`, async () => {
    const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave(mode));
    await ws.openFile('a.md');
    const originalReadDir = ops.readDir.bind(ops);
    let typed = false;
    ops.readDir = async (dir) => {
      if (!typed) {
        typed = true;
        ws.edit('scritto durante il controllo');
      }
      return originalReadDir(dir);
    };
    await ws.checkExternal();
    ops.readDir = originalReadDir;
    scheduler.advance(60_000);
    await tick();
    assert.equal(await ops.textOf('a.md'), 'A');
    assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'scritto durante il controllo');
  });
}

test('text typed during an explicit save in off mode keeps its checkpoint, rebased on the written text', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    await slow.wait;
    return originalWrite(path, data);
  };
  ws.edit('uno');
  const saving = ws.saveNow();
  ws.edit('due');
  scheduler.advance(1000); // checkpoint di "due" mentre "uno" si sta ancora scrivendo
  slow.open();
  await saving;
  ops.writeFile = originalWrite;
  assert.equal(await ops.textOf('a.md'), 'uno');
  assert.deepEqual(
    await buffers.load('ws-1', 'a.md'),
    { text: 'due', base: 'uno' },
    'la fine della scrittura non cancella il checkpoint più nuovo e lo riferisce al disco appena scritto',
  );
  // Ripresa immediata (ricarica o crash prima del prossimo checkpoint): una bozza normale, non un conflitto.
  const reopened = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: 'ws-1', name: 'test', buffers, scheduler: clockScheduler() });
  await reopened.load();
  await reopened.openFile('a.md');
  assert.equal(reopened.getState().doc!.text, 'due');
  assert.equal(reopened.getState().doc!.conflict, false);
  assert.equal(reopened.getState().doc!.saveState, 'dirty');
});

test('undoing back to the written text while the checkpoint is being checked drops the stale draft', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  const slowWrite = gate();
  ops.writeFile = async (path, data) => {
    await slowWrite.wait;
    return originalWrite(path, data);
  };
  ws.edit('uno');
  const saving = ws.saveNow();
  ws.edit('due');
  scheduler.advance(1000); // checkpoint { due, base A } durante la scrittura di "uno"
  const originalLoad = buffers.load.bind(buffers);
  const slowLoad = gate();
  buffers.load = async (id, path) => {
    await slowLoad.wait;
    return originalLoad(id, path);
  };
  slowWrite.open();
  await tick(); // la scrittura è finita, la manutenzione del checkpoint sta leggendo il buffer
  ws.edit('uno'); // Ctrl+Z: di nuovo il testo appena scritto
  slowLoad.open();
  await saving;
  ops.writeFile = originalWrite;
  buffers.load = originalLoad;
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(await buffers.load('ws-1', 'a.md'), null, 'niente bozza vecchia');
  assert.deepEqual(ws.getState().drafts, []);
  // Ripresa immediata: il file si riapre pulito, il testo annullato non ricompare.
  const reopened = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: 'ws-1', name: 'test', buffers, scheduler: clockScheduler() });
  await reopened.load();
  await reopened.openFile('a.md');
  assert.equal(reopened.getState().doc!.text, 'uno');
  assert.equal(reopened.getState().doc!.saveState, 'saved');
  assert.equal(reopened.getState().doc!.conflict, false);
});

test('in off mode a rename moves the draft and the drafts list follows it', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, autosave('off'));
  await ws.openFile('a.md');
  ws.edit('bozza');
  await ws.rename('a.md', 'z.md');
  assert.equal(doc(ws).path, 'z.md');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.deepEqual(await buffers.load('ws-1', 'z.md'), { text: 'bozza', base: 'A' });
  assert.equal(await buffers.load('ws-1', 'a.md'), null);
  assert.deepEqual(ws.getState().drafts, ['z.md']);
  scheduler.advance(60_000);
  await tick();
  assert.equal(await ops.textOf('z.md'), 'A', 'nessuna scrittura automatica dopo la rinomina');
});

test('drafts lists buffered paths: loaded at start, added by checkpoints, removed by saves', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'bozza b', 'B');
  const { scheduler, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { ...autosave('off'), buffers });
  assert.deepEqual(ws.getState().drafts, ['b.md']);
  assert.deepEqual(await ws.draftPaths(), ['b.md']);
  await ws.openFile('a.md');
  ws.edit('A2');
  scheduler.advance(1000);
  await tick();
  assert.deepEqual(ws.getState().drafts, ['a.md', 'b.md']);
  await ws.saveNow();
  assert.deepEqual(ws.getState().drafts, ['b.md']);
});
