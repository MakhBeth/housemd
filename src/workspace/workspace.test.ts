import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkspaceFS } from '../fs/workspaceFS';
import { memoryOps, type MemoryOpsOptions } from '../fs/testing/memoryOps';
import { FsNotFoundError } from '../fs/types';
import { memoryBufferStore } from './buffers';
import { Workspace, type Scheduler } from './workspace';

function manualScheduler() {
  const timers = new Map<number, () => void>();
  let seq = 0;
  const scheduler: Scheduler & { pending(): number; fire(): void } = {
    set(fn) {
      timers.set(++seq, fn);
      return seq;
    },
    clear(handle) {
      timers.delete(handle as number);
    },
    pending: () => timers.size,
    fire() {
      const fns = [...timers.values()];
      timers.clear();
      for (const fn of fns) fn();
    },
  };
  return scheduler;
}

async function setup(files: Record<string, string>, options: MemoryOpsOptions = {}, workspaceId = 'ws-1') {
  const ops = memoryOps(options);
  for (const [path, text] of Object.entries(files)) ops.setFile(path, text);
  const buffers = memoryBufferStore();
  const scheduler = manualScheduler();
  const ws = new Workspace({
    fs: createWorkspaceFS(ops),
    workspaceId,
    name: 'test',
    buffers,
    scheduler,
    now: () => new Date(2026, 8, 27, 14, 32, 5),
  });
  await ws.load();
  return { ops, buffers, scheduler, ws };
}

const doc = (ws: Workspace) => ws.getState().doc!;

test('load lists entries, builds the search index and is ready', async () => {
  const { ws } = await setup({ 'posts/a.md': '# A\n\nciuffo bianco', 'notes/b.md': 'B' });
  const state = ws.getState();
  assert.equal(state.status, 'ready');
  assert.deepEqual(ws.files(), ['notes/b.md', 'posts/a.md']);
  assert.equal(ws.search.search('ciuffo')[0]?.path, 'posts/a.md');
  assert.deepEqual(state.config, { images: { saveTo: 'assets', linkPrefix: null } });
});

test('a broken .housemd.json shows a non-blocking warning', async () => {
  const { ws } = await setup({ '.housemd.json': '{ rotto', 'a.md': 'A' });
  assert.equal(ws.getState().status, 'ready');
  assert.match(ws.getState().toasts[0]?.message ?? '', /\.housemd\.json/);
});

test('edits are saved automatically after the debounce', async () => {
  const { ops, scheduler, ws } = await setup({ 'a.md': 'vecchio' });
  await ws.openFile('a.md');
  ws.edit('nuovo');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.equal(scheduler.pending(), 1);
  scheduler.fire();
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(ws.search.search('nuovo')[0]?.path, 'a.md');
});

test('workspace preserves CRLF line endings on save', async () => {
  const { ops, ws } = await setup({ 'a.md': '---\r\ntitle: A\r\n---\r\ntesto\r\n' });
  await ws.openFile('a.md');
  ws.edit('---\ntitle: A\n---\ntesto\naltro\n');
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), '---\r\ntitle: A\r\n---\r\ntesto\r\naltro\r\n');
  assert.equal(doc(ws).saveState, 'saved');
});

test('edits made during an in-flight save stay dirty and are saved next', async () => {
  const { ops, scheduler, ws } = await setup({ 'a.md': '' });
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  ops.writeFile = async (path, data) => {
    await gate;
    return originalWrite(path, data);
  };

  ws.edit('uno');
  const saving = ws.flush();
  assert.equal(doc(ws).saveState, 'saving');
  ws.edit('due');
  release();
  await saving;
  assert.equal(await ops.textOf('a.md'), 'uno');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.ok(scheduler.pending() >= 1);

  scheduler.fire();
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'due');
  assert.equal(doc(ws).saveState, 'saved');
});

test('a failed write keeps the text in the emergency buffer and retries on the next save', async () => {
  let failing = true;
  const { ops, buffers, ws } = await setup({ 'a.md': 'A' }, { failWrite: () => failing });
  await ws.openFile('a.md');
  ws.edit('bozza');
  await ws.flush();
  assert.equal(doc(ws).saveState, 'error');
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /Salvataggio non riuscito/);
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'bozza');

  failing = false;
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'bozza');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(await buffers.load('ws-1', 'a.md'), null);
});

test('lost access switches to access-lost and keeps the text', async () => {
  const { ops, buffers, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ops.writeFile = async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  };
  ws.edit('importante');
  await ws.flush();
  assert.equal(ws.getState().status, 'access-lost');
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'importante');
  assert.equal(doc(ws).text, 'importante');
});

test('opening a file restores its emergency buffer, only for the same workspace', async () => {
  const { buffers, ws } = await setup({ 'a.md': 'disco', 'b.md': 'disco b' });
  await buffers.save('ws-1', 'a.md', 'non salvato', 'disco');
  await buffers.save('ws-2', 'b.md', 'di un altra cartella', 'disco b');
  await ws.openFile('a.md');
  assert.equal(doc(ws).text, 'non salvato');
  assert.equal(doc(ws).saveState, 'dirty');
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /Ripristinate/);
  await ws.openFile('b.md');
  assert.equal(doc(ws).text, 'disco b');
});

test('edits made while switching files are saved, not lost', async () => {
  const { ops, ws } = await setup({ 'a.md': '', 'b.md': 'B' });
  await ws.openFile('a.md');
  const originalWrite = ops.writeFile.bind(ops);
  let release!: () => void;
  let gate = new Promise<void>((r) => (release = r));
  ops.writeFile = async (path, data) => {
    await gate;
    return originalWrite(path, data);
  };

  ws.edit('uno');
  const switching = ws.openFile('b.md');
  ws.edit('due');
  const first = release;
  gate = Promise.resolve();
  first();
  await switching;
  assert.equal(await ops.textOf('a.md'), 'due');
  assert.equal(doc(ws).path, 'b.md');
});

test('a failed removal keeps the open file and its unsaved text', async () => {
  const { ops, scheduler, ws } = await setup({ 'n/a.md': 'alfa' });
  await ws.openFile('n/a.md');
  ws.edit('modificato');
  ops.removeEntry = async () => {
    throw new Error('EBUSY');
  };
  await ws.remove('n');
  assert.equal(doc(ws).path, 'n/a.md');
  assert.equal(doc(ws).text, 'modificato');
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /EBUSY/);
  assert.equal(scheduler.pending(), 1, 'il salvataggio automatico riprende');
});

test('opening another file saves the current one first', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  ws.edit('A2');
  await ws.openFile('b.md');
  assert.equal(await ops.textOf('a.md'), 'A2');
  assert.equal(doc(ws).path, 'b.md');
});

test('checkExternal reindexes files changed, added and removed outside the app', async () => {
  const { ops, ws } = await setup({ 'a.md': 'alfa', 'b.md': 'beta' });
  ops.setFile('a.md', 'gamma');
  ops.setFile('n/c.md', 'delta');
  await ops.removeEntry('b.md', false);
  await ws.checkExternal();
  assert.equal(ws.search.search('gamma')[0]?.path, 'a.md');
  assert.equal(ws.search.search('delta')[0]?.path, 'n/c.md');
  assert.equal(ws.search.search('beta').length, 0);
  assert.deepEqual(ws.files(), ['a.md', 'n/c.md']);
});

test('an external change reloads a clean open document', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  const revision = doc(ws).revision;
  ops.setFile('a.md', 'A da vim');
  await ws.checkExternal();
  assert.equal(doc(ws).text, 'A da vim');
  assert.equal(doc(ws).revision, revision + 1);
  assert.equal(doc(ws).conflict, false);
});

test('an external change conflicts with unsaved edits and pauses autosave', async () => {
  const { ops, scheduler, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'loro');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, true);
  scheduler.fire();
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'loro', 'niente salvataggio durante il conflitto');

  await ws.resolveConflict('overwrite');
  assert.equal(await ops.textOf('a.md'), 'mio');
  assert.equal(doc(ws).conflict, false);
  assert.equal(doc(ws).saveState, 'saved');
});

test('resolving a conflict with reload takes the disk version', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'loro');
  await ws.checkExternal();
  await ws.resolveConflict('reload');
  assert.equal(doc(ws).text, 'loro');
  assert.equal(doc(ws).saveState, 'saved');
  assert.equal(doc(ws).conflict, false);
});

test('a new version with the same content is not a conflict', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'A');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, false);
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'mio');
});

test('a file deleted outside the app is flagged and can be saved again', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  await ops.removeEntry('a.md', false);
  await ws.checkExternal();
  assert.equal(doc(ws).deletedOnDisk, true);
  ws.edit('A ricreato');
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'A ricreato');
  assert.equal(doc(ws).deletedOnDisk, false);
  assert.ok(ws.files().includes('a.md'));
});

test('renaming the open file or its folder updates path, index and buffers', async () => {
  const { buffers, ws } = await setup({ 'old/a.md': 'alfa', 'old/b.md': 'beta' });
  await ws.openFile('old/a.md');
  await buffers.save('ws-1', 'old/b.md', 'bozza b', 'beta');
  await ws.rename('old/a.md', 'old/z.md');
  assert.equal(doc(ws).path, 'old/z.md');
  await ws.rename('old', 'new');
  assert.equal(doc(ws).path, 'new/z.md');
  assert.deepEqual(ws.files(), ['new/b.md', 'new/z.md']);
  assert.equal(ws.search.search('alfa')[0]?.path, 'new/z.md');
  assert.equal((await buffers.load('ws-1', 'new/b.md'))?.text, 'bozza b');
});

test('removing the open file or its folder closes it', async () => {
  const { ws } = await setup({ 'n/a.md': 'alfa', 'b.md': 'beta' });
  await ws.openFile('n/a.md');
  ws.edit('modificato');
  await ws.remove('n');
  assert.equal(ws.getState().doc, null);
  assert.deepEqual(ws.files(), ['b.md']);
  assert.equal(ws.search.search('alfa').length, 0);
});

test('createFile creates and opens; existing names are refused', async () => {
  const { ws } = await setup({ 'a.md': 'A' });
  await ws.createFile('notes/nuova.md');
  assert.equal(doc(ws).path, 'notes/nuova.md');
  assert.ok(ws.files().includes('notes/nuova.md'));
  await ws.createFile('a.md');
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /Esiste già/);
});

test('followWikiLink opens existing notes and creates missing ones next to the current file', async () => {
  const { ws } = await setup({ 'notes/a.md': '[[idea]]', 'archivio/idea.md': 'I' });
  await ws.openFile('notes/a.md');
  await ws.followWikiLink('idea');
  assert.equal(doc(ws).path, 'archivio/idea.md');
  await ws.openFile('notes/a.md');
  await ws.followWikiLink('nuova idea');
  assert.equal(doc(ws).path, 'notes/nuova idea.md');
});

test('saveImage stores pasted images with unique names and returns the link', async () => {
  const config = JSON.stringify({ images: { saveTo: 'static/images', linkPrefix: '/images' } });
  const { ops, ws } = await setup({ '.housemd.json': config, 'posts/a.md': 'A' });
  await ws.openFile('posts/a.md');
  const img = new Blob(['jpg'], { type: 'image/jpeg' });
  assert.equal(await ws.saveImage(img, 'Foto Mare.jpg'), '/images/foto-mare.jpg');
  assert.equal(await ws.saveImage(img, 'Foto Mare.jpg'), '/images/foto-mare-1.jpg');
  assert.equal(await ws.saveImage(img, 'image.png'), '/images/incollata-2026-09-27-143205.jpg');
  assert.equal(await ops.textOf('static/images/foto-mare.jpg'), 'jpg');
});

// --- fix round 1: findings from the task review (see task-10-fix1.md) --------------------------

test('[finding 1] autosave during a folder rename does not write to the old path', async () => {
  const { ops, scheduler, ws } = await setup({ 'old/a.md': 'alfa' });
  await ws.openFile('old/a.md');
  const originalRemove = ops.removeEntry.bind(ops);
  ops.removeEntry = async (path, recursive) => {
    if (path === 'old') {
      // Simula un'edit e lo scatto dell'autosalvataggio proprio mentre la cartella sta per sparire.
      ws.edit('nuovo');
      scheduler.fire();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return originalRemove(path, recursive);
  };
  await ws.rename('old', 'new');
  await ws.flush();
  assert.equal(doc(ws).path, 'new/a.md');
  assert.equal(await ops.textOf('new/a.md'), 'nuovo');
  assert.equal(await ops.textOf('old/a.md'), null);
});

test('[finding 2] a save that finishes during a removal does not resurrect the deleted file', async () => {
  const { ops, scheduler, ws } = await setup({ 'n/a.md': 'alfa', 'b.md': 'b' });
  await ws.openFile('n/a.md');
  const originalWrite = ops.writeFile.bind(ops);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  ops.writeFile = async (path, data) => {
    await gate;
    return originalWrite(path, data);
  };
  ws.edit('uno');
  const saving = ws.flush();
  ws.edit('due'); // arriva mentre il salvataggio di 'uno' è ancora in corso

  const originalRemove = ops.removeEntry.bind(ops);
  ops.removeEntry = async (path, recursive) => {
    await originalRemove(path, recursive);
    // Un eventuale autosalvataggio ripianificato dal completamento del salvataggio di 'uno'
    // (mentre l'eliminazione era già in corso) non deve poter scattare qui e ricreare il file.
    scheduler.fire();
    await new Promise((resolve) => setTimeout(resolve, 5));
  };
  const removing = ws.remove('n');
  release();
  await saving;
  await removing;

  assert.equal(ws.getState().doc, null);
  assert.equal(await ops.textOf('n/a.md'), null);
  assert.ok(!ws.files().includes('n/a.md'));
  assert.equal(ws.search.search('due').length, 0);
});

test('[finding 3] a clean document deleted outside the app is not resurrected by switching files', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  await ops.removeEntry('a.md', false);
  await ws.checkExternal();
  assert.equal(doc(ws).deletedOnDisk, true);
  assert.equal(doc(ws).saveState, 'saved');
  await ws.openFile('b.md');
  assert.equal(await ops.textOf('a.md'), null, 'niente resurrezione: non c-erano modifiche utente');
  assert.ok(!ws.files().includes('a.md'));
});

test('[finding 4] an unresolved conflict is not lost by switching files and reopening', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A', 'b.md': 'B' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'loro');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, true);

  await ws.openFile('b.md');
  await ws.openFile('a.md');
  assert.equal(doc(ws).conflict, true, 'il conflitto resta segnalato dopo la riapertura');
  assert.equal(doc(ws).text, 'mio');

  await ws.resolveConflict('overwrite');
  assert.equal(await ops.textOf('a.md'), 'mio');
  assert.equal(doc(ws).conflict, false);
});

test('[finding 5] edits typed during a conflict are buffered instead of lost', async () => {
  const { ops, buffers, scheduler, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ws.edit('mio');
  ops.setFile('a.md', 'loro');
  await ws.checkExternal();
  assert.equal(doc(ws).conflict, true);

  ws.edit('mio, molto lavoro');
  assert.equal(scheduler.pending(), 1);
  scheduler.fire();
  assert.equal((await buffers.load('ws-1', 'a.md'))?.text, 'mio, molto lavoro');
  assert.equal(await ops.textOf('a.md'), 'loro', 'niente scrittura su disco durante il conflitto');
});

test('[finding 6] an edit typed during checkExternal is not overwritten by a reload', async () => {
  const { ops, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  ops.setFile('a.md', 'vim');
  const fs = (ws as unknown as { deps: { fs: { stat: (p: string) => Promise<unknown> } } }).deps.fs;
  const originalStat = fs.stat.bind(fs);
  fs.stat = async (path: string) => {
    const v = await originalStat(path);
    ws.edit('digitato'); // l'utente scrive mentre il controllo delle modifiche esterne è in corso
    return v;
  };
  await ws.checkExternal();
  fs.stat = originalStat;
  assert.equal(doc(ws).text, 'digitato');
  assert.equal(doc(ws).conflict, true, 'diventa un conflitto invece di essere sovrascritto');
});

test('[finding 7] load finishes even if reading one file fails, with a warning toast', async () => {
  const ops = memoryOps();
  ops.setFile('a.md', 'A');
  ops.setFile('b.md', 'B');
  const fs = createWorkspaceFS(ops);
  const originalRead = fs.read.bind(fs);
  fs.read = async (path) => {
    if (path === 'b.md') throw new Error('EIO');
    return originalRead(path);
  };
  const ws = new Workspace({ fs, workspaceId: 'w', name: 't', buffers: memoryBufferStore(), scheduler: manualScheduler() });
  await ws.load();
  assert.equal(ws.getState().status, 'ready');
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /Impossibile leggere/);
  assert.equal(ws.search.search('A')[0]?.path, 'a.md');
});

test('[finding 7] load still becomes ready if listing the folder fails outright', async () => {
  const ops = memoryOps();
  ops.setFile('a.md', 'A');
  const fs = createWorkspaceFS(ops);
  fs.list = async () => {
    throw new Error('EIO listing');
  };
  const ws = new Workspace({ fs, workspaceId: 'w', name: 't', buffers: memoryBufferStore(), scheduler: manualScheduler() });
  await ws.load();
  assert.equal(ws.getState().status, 'ready');
  assert.deepEqual(ws.getState().entries, []);
  assert.match(ws.getState().toasts.at(-1)?.message ?? '', /EIO listing/);
});

test('[finding 8] a rename updates the open file immediately even if reindexing another file fails', async () => {
  const { ops, ws } = await setup({ 'old/a.md': 'alfa', 'old/b.md': 'beta' });
  await ws.openFile('old/a.md');
  const fs = (ws as unknown as { deps: { fs: { read: (p: string) => Promise<{ text: string; version: unknown }> } } }).deps.fs;
  const originalRead = fs.read.bind(fs);
  fs.read = async (path: string) => {
    if (path === 'new/b.md') throw new FsNotFoundError(path);
    return originalRead(path);
  };
  await ws.rename('old', 'new');
  fs.read = originalRead;
  assert.equal(doc(ws).path, 'new/a.md');
  assert.deepEqual(ws.files().sort(), ['new/a.md', 'new/b.md']);
  ws.edit('altro');
  await ws.flush();
  assert.equal(await ops.textOf('new/a.md'), 'altro');
  assert.equal(await ops.textOf('old/a.md'), null);
});

test('[minor] a successful write is not reported as failed if a post-save cleanup step fails', async () => {
  const { ops, buffers, ws } = await setup({ 'a.md': 'A' });
  await ws.openFile('a.md');
  buffers.clear = async () => {
    throw new Error('boom');
  };
  ws.edit('nuovo');
  await ws.flush();
  assert.equal(await ops.textOf('a.md'), 'nuovo');
  assert.equal(doc(ws).saveState, 'saved');
  assert.ok(!ws.getState().toasts.some((t) => /Salvataggio non riuscito/.test(t.message)));
});

test('[minor] identical error toasts are not stacked', async () => {
  const { ws } = await setup({ 'a.md': 'A' }, { failWrite: () => true });
  await ws.openFile('a.md');
  ws.edit('uno');
  await ws.flush();
  ws.edit('due');
  await ws.flush();
  const errorToasts = ws.getState().toasts.filter((t) => /Salvataggio non riuscito/.test(t.message));
  assert.equal(errorToasts.length, 1);
});
