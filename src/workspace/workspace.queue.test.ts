import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryBufferStore } from './buffers';
import { gate, harness, tick } from './testing/harness';
import type { Workspace } from './workspace';

const doc = (ws: Workspace) => ws.getState().doc!;
const off = { autosave: { mode: 'off' as const, delayMs: 1000 } };

test('queued operations run in call order, one at a time', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  const originalMkdir = ops.mkdir.bind(ops);
  const slow = gate();
  ops.mkdir = async (path) => {
    await slow.wait;
    return originalMkdir(path);
  };
  const order: string[] = [];
  const creating = ws.createFolder('x').then(() => order.push('createFolder'));
  const opening = ws.openFile('b.md').then(() => order.push('openFile'));
  await tick();
  assert.equal(doc(ws).path, 'a.md', "l'apertura aspetta la creazione della cartella");
  slow.open();
  await Promise.all([creating, opening]);
  ops.mkdir = originalMkdir;
  assert.deepEqual(order, ['createFolder', 'openFile']);
  assert.equal(doc(ws).path, 'b.md');
});

test('keystrokes on the old file during the read of the new one are still saved (with the queue)', async () => {
  const { ops, fs, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  const originalRead = fs.read.bind(fs);
  const slow = gate();
  fs.read = async (path) => {
    if (path === 'b.md') await slow.wait;
    return originalRead(path);
  };
  const opening = ws.openFile('b.md');
  await tick(); // l'apertura è partita ed è ferma sulla lettura di b.md
  ws.edit('a modificato');
  slow.open();
  await opening;
  fs.read = originalRead;
  assert.equal(await ops.textOf('a.md'), 'a modificato');
  assert.equal(doc(ws).path, 'b.md');
});

test('saveAll saves the open document from memory before the checkpoint', async () => {
  const { ops, buffers, scheduler, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('uno');
  scheduler.advance(1000); // checkpoint: nel buffer c'è "uno"
  ws.edit('due'); // ancora solo in memoria
  await ws.saveAll();
  assert.equal(await ops.textOf('a.md'), 'due', 'vince il testo in memoria, non quello del buffer');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(await buffers.load('ws-1', 'a.md'), null);
  assert.deepEqual(ws.getState().drafts, []);
  assert.equal(ws.getState().toasts.at(-1)?.code, 'saveAllDone');
});

test('edits typed while saveAll writes stay dirty', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A' });
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    await slow.wait;
    return originalWrite(path, data);
  };
  ws.edit('due');
  const saving = ws.saveAll();
  await tick();
  ws.edit('tre');
  slow.open();
  await saving;
  ops.writeFile = originalWrite;
  assert.equal(await ops.textOf('a.md'), 'due');
  assert.equal(doc(ws).text, 'tre');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.notEqual(ws.getState().toasts.at(-1)?.code, 'saveAllDone');
});

test('saveAll writes valid drafts and skips conflicting ones', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B2', 'B'); // il disco è ancora "B": si può scrivere
  await buffers.save('ws-1', 'c.md', 'C2', 'vecchia'); // il disco è cambiato: conflitto
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' }, { buffers });
  await ws.openFile('a.md');
  await ws.saveAll();
  assert.equal(await ops.textOf('b.md'), 'B2');
  assert.equal(await ops.textOf('c.md'), 'C');
  assert.equal(await buffers.load('ws-1', 'b.md'), null);
  assert.deepEqual(await buffers.load('ws-1', 'c.md'), { text: 'C2', base: 'vecchia' });
  assert.deepEqual(ws.getState().drafts, ['c.md']);
  assert.equal(ws.search.search('B2')[0]?.path, 'b.md');
  const last = ws.getState().toasts.at(-1);
  assert.equal(last?.code, 'saveAllSkipped');
  assert.equal(last?.params?.count, 1);
});

test('saveAll skips drafts of files deleted on disk and does not recreate them', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'sparito.md', 'bozza', 'originale');
  const { ops, ws } = await harness({ 'a.md': 'A' }, { buffers });
  await ws.saveAll();
  assert.equal(await ops.textOf('sparito.md'), null);
  assert.equal((await buffers.load('ws-1', 'sparito.md'))?.text, 'bozza');
  assert.equal(ws.getState().toasts.at(-1)?.code, 'saveAllSkipped');
});

test('saveAll does not recreate a deleted file whose draft is open; Ctrl+S still does', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'sparito.md', 'bozza', 'originale');
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A' }, { buffers }); // afterDelay, il default
  await ws.openFile('sparito.md');
  assert.equal(doc(ws).deletedOnDisk, true);
  await ws.saveAll();
  assert.equal(await ops.textOf('sparito.md'), null, '"Salva tutto" non ricrea il file');
  scheduler.advance(60_000); // nemmeno più tardi, con un salvataggio a tempo lasciato da "Salva tutto"
  await tick();
  assert.equal(await ops.textOf('sparito.md'), null, 'niente salvataggio automatico programmato da "Salva tutto"');
  assert.equal((await buffers.load('ws-1', 'sparito.md'))?.text, 'bozza');
  const last = ws.getState().toasts.at(-1);
  assert.equal(last?.code, 'saveAllSkipped');
  assert.equal(last?.params?.count, 1);
  await ws.saveNow(); // recupero esplicito
  assert.equal(await ops.textOf('sparito.md'), 'bozza');
});

test('saveAll does not recreate a clean document deleted outside the app; Ctrl+S still does', async () => {
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A' });
  await ws.openFile('a.md');
  await ops.removeEntry('a.md', false);
  await ws.checkExternal();
  assert.equal(doc(ws).deletedOnDisk, true);
  assert.equal(doc(ws).saveState, 'saved');
  await ws.saveAll();
  scheduler.advance(60_000);
  await tick();
  assert.equal(await ops.textOf('a.md'), null, '"Salva tutto" non passa da saveNow, che lo ricreerebbe');
  await ws.saveNow(); // solo il comando esplicito ricrea il file
  assert.equal(await ops.textOf('a.md'), 'A');
});

test('saveAll reports an open document that could not be saved (conflict)', async () => {
  const { ops, ws } = await harness({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'loro');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, true);
  await ws.saveAll();
  assert.equal(await ops.textOf('a.md'), 'loro');
  const last = ws.getState().toasts.at(-1);
  assert.equal(last?.code, 'saveAllSkipped', 'niente "tutto salvato" con un conflitto aperto');
  assert.equal(last?.params?.count, 1);
});

test('saveAll interrupted by lost access does not claim success and counts the untouched drafts', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B2', 'B');
  await buffers.save('ws-1', 'c.md', 'C2', 'C');
  const { ops, fs, ws } = await harness({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' }, { buffers });
  fs.read = async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  };
  await ws.saveAll();
  assert.equal(ws.getState().status, 'access-lost');
  assert.equal(await ops.textOf('b.md'), 'B');
  const last = ws.getState().toasts.at(-1);
  assert.equal(last?.code, 'saveAllSkipped');
  assert.equal(last?.params?.count, 2);
  assert.ok(!ws.getState().toasts.some((t) => t.code === 'saveAllDone'));
});

test('the checkpoint maxWait keeps working while saveAll is stuck writing another draft', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B2', 'B');
  const { ops, scheduler, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { ...off, buffers });
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    if (path === 'b.md') await slow.wait;
    return originalWrite(path, data);
  };
  const saving = ws.saveAll();
  await tick(); // "Salva tutto" è fermo sulla bozza di b.md, con le scritture su disco sospese
  ws.edit('v0');
  for (let i = 1; i <= 9; i++) {
    scheduler.advance(500);
    ws.edit(`v${i}`);
  }
  scheduler.advance(500); // t = 5 s
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'v9', 'maxWait rispettato durante "Salva tutto"');
  slow.open();
  await saving;
  ops.writeFile = originalWrite;
  assert.equal(await ops.textOf('a.md'), 'A');
  assert.equal(await ops.textOf('b.md'), 'B2');
});

test('saveAll then rename of a draft: the rename waits and nothing is recreated at the old path', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B2', 'B');
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { buffers });
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    if (path === 'b.md') await slow.wait;
    return originalWrite(path, data);
  };
  const saving = ws.saveAll();
  await tick();
  const renaming = ws.rename('b.md', 'z.md');
  await tick();
  assert.equal(await ops.textOf('z.md'), null, 'la rinomina aspetta il suo turno');
  slow.open();
  await Promise.all([saving, renaming]);
  ops.writeFile = originalWrite;
  assert.equal(await ops.textOf('b.md'), null, 'niente file ricreato al vecchio percorso');
  assert.equal(await ops.textOf('z.md'), 'B2');
  assert.equal(await buffers.load('ws-1', 'b.md'), null);
  assert.equal(await buffers.load('ws-1', 'z.md'), null);
});

test('saveAll then remove of a draft: the file is not recreated after the removal', async () => {
  const buffers = memoryBufferStore();
  await buffers.save('ws-1', 'b.md', 'B2', 'B');
  const { ops, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, { buffers });
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    if (path === 'b.md') await slow.wait;
    return originalWrite(path, data);
  };
  const saving = ws.saveAll();
  await tick();
  const removing = ws.remove('b.md');
  slow.open();
  await Promise.all([saving, removing]);
  ops.writeFile = originalWrite;
  assert.equal(await ops.textOf('b.md'), null);
  assert.ok(!ws.files().includes('b.md'));
  assert.equal(await buffers.load('ws-1', 'b.md'), null);
});

test('a save finishing after the switch to another file does not change the base of the new document', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A', 'b.md': 'B' }, off);
  await ws.openFile('a.md');
  ws.edit('A2');
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    if (path === 'a.md') await slow.wait;
    return originalWrite(path, data);
  };
  const originalSave = buffers.save.bind(buffers);
  let calls = 0;
  let saving: Promise<void> | null = null;
  buffers.save = async (id, path, text, base) => {
    await originalSave(id, path, text, base);
    // Ctrl+S sul vecchio documento mentre l'ultimo settle() dell'apertura mette la bozza nel buffer:
    // la scrittura di a.md finisce quando è già aperto b.md.
    if (path === 'a.md' && ++calls === 2) saving = ws.saveNow();
  };
  await ws.openFile('b.md');
  assert.equal(doc(ws).path, 'b.md');
  assert.ok(saving, 'la scrittura di a.md è partita durante il cambio di file');
  slow.open();
  await saving;
  ops.writeFile = originalWrite;
  buffers.save = originalSave;
  assert.equal(await ops.textOf('a.md'), 'A2');
  assert.equal(await buffers.load('ws-1', 'a.md'), null, 'a.md è su disco: la sua bozza si scarta');
  ws.edit('B2');
  await ws.blur(); // off: checkpoint nel buffer
  assert.deepEqual(await buffers.load('ws-1', 'b.md'), { text: 'B2', base: 'B' }, 'la base resta quella di b.md');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, false, 'nessun falso conflitto: la versione nota resta quella di b.md');
  assert.equal(await ops.textOf('b.md'), 'B');
});

test('a save started while a rename secures the document finishes before the move, not at the old path', async () => {
  const { ops, buffers, ws } = await harness({ 'a.md': 'A' }, off);
  await ws.openFile('a.md');
  ws.edit('A2');
  const originalWrite = ops.writeFile.bind(ops);
  const slow = gate();
  ops.writeFile = async (path, data) => {
    if (path === 'a.md') await slow.wait;
    return originalWrite(path, data);
  };
  const originalSave = buffers.save.bind(buffers);
  let saving: Promise<void> | null = null;
  buffers.save = async (id, path, text, base) => {
    await originalSave(id, path, text, base);
    // Ctrl+S mentre il settle() della rinomina mette la bozza nel buffer.
    if (path === 'a.md' && !saving) saving = ws.saveNow();
  };
  const renaming = ws.rename('a.md', 'z.md');
  await tick();
  assert.equal(await ops.textOf('z.md'), null, 'la rinomina aspetta la scrittura in corso');
  slow.open();
  await renaming;
  await saving;
  ops.writeFile = originalWrite;
  buffers.save = originalSave;
  assert.equal(doc(ws).path, 'z.md');
  assert.equal(await ops.textOf('a.md'), null, 'niente file ricreato al vecchio percorso');
  assert.equal(await ops.textOf('z.md'), 'A2');
  assert.equal(doc(ws).saveState, 'saved');
});
