import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryBufferStore } from '../workspace/buffers';
import { Workspace } from '../workspace/workspace';
import { listPending, memoryFile, mirrorPending, pendingDownload, recoverPending, PENDING_WORKSPACE, singleFileOps, SingleFileUnsupportedError, type SingleFile } from './singleFile';
import { createWorkspaceFS } from './workspaceFS';

const note = (text = '# Note', now = () => 5_000) => memoryFile({ name: 'note.md', blob: new Blob([text]), lastModified: 1_000 }, now);

test('the workspace sees a folder with only the file: listed, readable and writable', async () => {
  const fs = createWorkspaceFS(singleFileOps(note()));
  assert.deepEqual(await fs.list(), [{ kind: 'file', path: 'note.md', version: { lastModified: 1_000, size: 6 } }]);
  assert.equal((await fs.read('note.md')).text, '# Note');
  const { version } = await fs.write('note.md', 'new');
  assert.deepEqual(version, { lastModified: 5_000, size: 3 });
  assert.equal(await fs.stat('other.md'), null);
});

test('creating, renaming or removing has nowhere to go: a clear error, the file is untouched', async () => {
  const file = note();
  const fs = createWorkspaceFS(singleFileOps(file));
  await assert.rejects(fs.write('other.md', 'x'), SingleFileUnsupportedError);
  await assert.rejects(fs.mkdir('dir'), SingleFileUnsupportedError);
  await assert.rejects(fs.remove('note.md'), SingleFileUnsupportedError);
  await assert.rejects(fs.rename('note.md', 'renamed.md'), SingleFileUnsupportedError);
  assert.equal(await (await file.read()).blob.text(), '# Note');
  assert.equal(file.pendingDownload, false);
});

test('a memory file: a write marks it pending until it is downloaded, notifying every write and download', async () => {
  const file = note();
  let calls = 0;
  const off = file.subscribe(() => calls++);
  assert.equal(pendingDownload(file), false);
  await file.write('one');
  await file.write('two');
  assert.equal(pendingDownload(file), true);
  assert.equal(calls, 2);
  assert.equal(await file.takeDownload().text(), 'two');
  assert.equal(pendingDownload(file), false);
  assert.equal(calls, 3);
  off();
  await file.write('three');
  assert.equal(calls, 3, 'no listener after unsubscribe');
});

test('a memory file: the version always moves forward, even with a clock behind the file date', async () => {
  const file = note('x', () => 10);
  await file.write('a');
  const first = (await file.read()).lastModified;
  await file.write('b');
  assert.ok(first > 1_000 && (await file.read()).lastModified > first);
});

test('pendingDownload: false for no file and for a file written to disk', () => {
  const disk: SingleFile = { name: 'a.md', writesToDisk: true, read: async () => ({ blob: new Blob([]), lastModified: 0 }), write: async () => {} };
  assert.equal(pendingDownload(null), false);
  assert.equal(pendingDownload(disk), false);
});

test('the whole Workspace on a memory file: open, edit, save, and the change waits for the download', async () => {
  const file = note();
  const ws = new Workspace({ fs: createWorkspaceFS(singleFileOps(file)), workspaceId: 'file:1', name: 'note.md', buffers: memoryBufferStore() });
  await ws.load();
  await ws.openFile('note.md');
  ws.edit('# Changed');
  await ws.flush(true);
  assert.equal(ws.getState().doc?.saveState, 'saved');
  assert.equal(pendingDownload(file), true);
  assert.equal(await file.takeDownload().text(), '# Changed');
  ws.dispose();
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 10));

test('the emergency copy follows the memory file: kept while not downloaded, gone after the download', async () => {
  const store = memoryBufferStore();
  const file = note();
  mirrorPending(file, store, 'file:s1');
  await file.write('# Changed');
  await settled();
  assert.deepEqual(await listPending(store), [{ key: 'file:s1/note.md', sessionId: 'file:s1', name: 'note.md' }]);
  assert.equal((await store.load(PENDING_WORKSPACE, 'file:s1/note.md'))?.text, '# Changed');
  file.takeDownload();
  await settled();
  assert.deepEqual(await listPending(store), []);
});

test('two files with the same name in two sessions stay two copies', async () => {
  const store = memoryBufferStore();
  const [a, b] = [note(), note()];
  mirrorPending(a, store, 'file:a');
  mirrorPending(b, store, 'file:b');
  await a.write('A');
  await b.write('B');
  await settled();
  assert.deepEqual((await listPending(store)).map((copy) => copy.key).sort(), ['file:a/note.md', 'file:b/note.md']);
});

test('a recovered copy: same session, the saved text, still to download', async () => {
  const store = memoryBufferStore();
  const file = note();
  mirrorPending(file, store, 'file:s1');
  await file.write('RECOVER ME');
  await settled();
  const [copy] = await listPending(store);
  const recovered = (await recoverPending(store, copy!))!;
  assert.equal(recovered.sessionId, 'file:s1');
  assert.equal(recovered.pendingDownload, true);
  assert.equal(await (await recovered.read()).blob.text(), 'RECOVER ME');
});
