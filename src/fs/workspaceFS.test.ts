import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkspaceFS } from './workspaceFS';
import { memoryOps } from './testing/memoryOps';
import { FsExistsError, FsNotFoundError } from './types';

function setup(options = {}) {
  const ops = memoryOps(options);
  return { ops, fs: createWorkspaceFS(ops) };
}

test('list returns markdown files and folders that contain them, skipping hidden and node_modules', async () => {
  const { ops, fs } = setup();
  ops.setFile('posts/a.md', '# A');
  ops.setFile('posts/a.it.md', '# A it');
  ops.setFile('static/images/x.jpg', 'jpg');
  ops.setFile('README.md', 'readme');
  ops.setFile('.git/HEAD.md', 'no');
  ops.setFile('node_modules/pkg/readme.md', 'no');
  ops.setFile('.obsidian/x.md', 'no');
  ops.setFile('notes/deep/n.md', 'n');
  await ops.mkdir('empty');

  const entries = await fs.list();
  assert.deepEqual(
    entries.map((e) => `${e.kind}:${e.path}`),
    [
      'file:README.md',
      'directory:empty',
      'directory:notes',
      'directory:notes/deep',
      'file:notes/deep/n.md',
      'directory:posts',
      'file:posts/a.it.md',
      'file:posts/a.md',
    ],
  );
  const a = entries.find((e) => e.path === 'posts/a.md');
  assert.equal(a?.kind === 'file' && a.version.size, 3);
});

test('nested empty folders stay visible, image-only folders do not', async () => {
  const { ops, fs } = setup();
  await ops.mkdir('progetti/nuovo');
  ops.setFile('static/images/x.jpg', 'jpg');
  const entries = await fs.list();
  assert.deepEqual(entries.map((e) => e.path), ['progetti', 'progetti/nuovo']);
});

test('read and write return versions; stat returns null for missing files', async () => {
  const { fs } = setup();
  const { version } = await fs.write('notes/new.md', 'ciao');
  const read = await fs.read('notes/new.md');
  assert.equal(read.text, 'ciao');
  assert.deepEqual(read.version, version);
  assert.deepEqual(await fs.stat('notes/new.md'), version);
  assert.equal(await fs.stat('nope.md'), null);
  await assert.rejects(fs.read('nope.md'), FsNotFoundError);
});

test('mkdir refuses existing paths', async () => {
  const { fs } = setup();
  await fs.mkdir('a');
  await assert.rejects(fs.mkdir('a'), FsExistsError);
});

test('rename file uses moveFile when available', async () => {
  const { ops, fs } = setup({ withMove: true });
  ops.setFile('n/a.md', 'A');
  await fs.rename('n/a.md', 'n/b.md');
  assert.equal(await ops.textOf('n/b.md'), 'A');
  assert.equal(await ops.textOf('n/a.md'), null);
  assert.ok(ops.log.includes('move n/a.md b.md'));
});

test('rename file falls back to copy + remove without moveFile', async () => {
  const { ops, fs } = setup();
  ops.setFile('n/a.md', 'A');
  await fs.rename('n/a.md', 'n/b.md');
  assert.equal(await ops.textOf('n/b.md'), 'A');
  assert.equal(await ops.textOf('n/a.md'), null);
});

test('[final fix 1] rename falls back to copy + remove when moveFile is rejected (e.g. NotAllowedError)', async () => {
  const { ops, fs } = setup({ withMove: true });
  ops.setFile('n/a.md', 'A');
  ops.moveFile = async () => {
    throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
  };
  await fs.rename('n/a.md', 'n/b.md');
  assert.equal(await ops.textOf('n/b.md'), 'A');
  assert.equal(await ops.textOf('n/a.md'), null);
});

test('rename refuses existing targets and other parent folders', async () => {
  const { ops, fs } = setup();
  ops.setFile('a.md', 'A');
  ops.setFile('b.md', 'B');
  await assert.rejects(fs.rename('a.md', 'b.md'), FsExistsError);
  await assert.rejects(fs.rename('a.md', 'x/a.md'), /stessa cartella/);
  await assert.rejects(fs.rename('missing.md', 'c.md'), FsNotFoundError);
});

test('case-only rename works on case-insensitive file systems', async () => {
  const { ops, fs } = setup({ caseInsensitive: true });
  ops.setFile('notes/nota.md', 'N');
  await fs.rename('notes/nota.md', 'notes/Nota.md');
  assert.deepEqual([...ops.files.keys()], ['notes/Nota.md']);
  assert.equal(await ops.textOf('notes/Nota.md'), 'N');
});

test('[codex F4] case-only rename refuses a distinct file with that exact name on case-sensitive file systems', async () => {
  const { ops, fs } = setup();
  ops.setFile('notes/a.md', 'minuscolo');
  ops.setFile('notes/A.md', 'maiuscolo');
  await assert.rejects(fs.rename('notes/a.md', 'notes/A.md'), FsExistsError);
  assert.equal(await ops.textOf('notes/a.md'), 'minuscolo');
  assert.equal(await ops.textOf('notes/A.md'), 'maiuscolo');
});

test('[codex F4] case-only rename still works on case-sensitive file systems when the target does not exist', async () => {
  const { ops, fs } = setup();
  ops.setFile('notes/a.md', 'A');
  await fs.rename('notes/a.md', 'notes/A.md');
  assert.deepEqual([...ops.files.keys()], ['notes/A.md']);
});

test('rename directory copies recursively and removes the original', async () => {
  const { ops, fs } = setup();
  ops.setFile('old/a.md', 'A');
  ops.setFile('old/sub/b.md', 'B');
  ops.setFile('old/img.png', 'PNG');
  await fs.rename('old', 'new');
  assert.equal(await ops.textOf('new/a.md'), 'A');
  assert.equal(await ops.textOf('new/sub/b.md'), 'B');
  assert.equal(await ops.textOf('new/img.png'), 'PNG');
  assert.equal(await ops.exists('old'), null);
});

test('rename directory rolls back the partial copy when a write fails', async () => {
  const { ops, fs } = setup({ failWrite: (p: string) => p === 'new/sub/b.md' });
  ops.setFile('old/a.md', 'A');
  ops.setFile('old/sub/b.md', 'B');
  await assert.rejects(fs.rename('old', 'new'));
  assert.equal(await ops.exists('new'), null);
  assert.equal(await ops.textOf('old/a.md'), 'A');
  assert.equal(await ops.textOf('old/sub/b.md'), 'B');
});

test('remove deletes files and folders recursively and ignores missing paths', async () => {
  const { ops, fs } = setup();
  ops.setFile('d/a.md', 'A');
  ops.setFile('d/e/b.md', 'B');
  await fs.remove('d');
  assert.equal(await ops.exists('d'), null);
  assert.equal(ops.files.size, 0);
  await fs.remove('d');
});
