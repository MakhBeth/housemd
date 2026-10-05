import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { TreeNode } from '../../ui/tree';
import { runTreeDialog, type TreeDialogDeps } from './treeDialogs';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const file: TreeNode = { name: 'b.md', path: 'docs/b.md', kind: 'file', children: [] };
const folder: TreeNode = { name: 'docs', path: 'docs', kind: 'directory', children: [] };
const dialog = () => document.querySelector('dialog')!;

function deps(paths: string[]) {
  const calls: string[] = [];
  const value: TreeDialogDeps = {
    t,
    paths: () => paths,
    workspace: {
      createFile: async (path) => void calls.push(`file ${path}`),
      createFolder: async (path) => void calls.push(`folder ${path}`),
      rename: async (from, to) => void calls.push(`rename ${from} ${to}`),
      remove: async (path) => void calls.push(`remove ${path}`),
    },
  };
  return { value, calls };
}

function typeAndSubmit(name: string) {
  const input = dialog().querySelector('input')!;
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
}

test('new file: titled, created inside the folder with .md added', async () => {
  const { value, calls } = deps([]);
  const done = runTreeDialog({ kind: 'new-file', dir: 'docs' }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['file.new']);
  typeAndSubmit('idea');
  await done;
  assert.deepEqual(calls, ['file docs/idea.md']);
});

test('new folder at the root', async () => {
  const { value, calls } = deps([]);
  const done = runTreeDialog({ kind: 'new-folder', dir: '' }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['folder.new']);
  typeAndSubmit('drafts');
  await done;
  assert.deepEqual(calls, ['folder drafts']);
});

test('an existing name (any case) is refused with the paths read at submit time', async () => {
  const paths: string[] = [];
  const { value, calls } = deps(paths);
  const done = runTreeDialog({ kind: 'new-file', dir: '' }, value);
  // Il file compare mentre il dialog è aperto (modifica esterna): il controllo deve vederlo.
  paths.push('Idea.md');
  typeAndSubmit('idea');
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['name.error.taken']);
  typeAndSubmit('other');
  await done;
  assert.deepEqual(calls, ['file other.md']);
});

test('rename: initial name, rename in the same folder, case-only change allowed', async () => {
  const { value, calls } = deps(['docs/b.md', 'docs/c.md']);
  let done = runTreeDialog({ kind: 'rename', node: file }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, t('dialog.rename.title', { name: 'b.md' }));
  assert.equal(dialog().querySelector('input')!.value, 'b.md');
  typeAndSubmit('c.md');
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['name.error.taken']);
  typeAndSubmit('B.md');
  await done;
  done = runTreeDialog({ kind: 'rename', node: folder }, value);
  typeAndSubmit('manuals');
  await done;
  // La cartella docs sta alla radice: dirname('docs') è '' e la destinazione è 'manuals'.
  assert.deepEqual(calls, ['rename docs/b.md docs/B.md', 'rename docs manuals']);
});

test('delete: file and folder messages; Cancel does nothing, the confirm removes', async () => {
  const { value, calls } = deps(['docs', 'docs/b.md']);
  let done = runTreeDialog({ kind: 'delete', node: file }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, t('dialog.delete.title', { name: 'b.md' }));
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['dialog.delete.file']);
  dialog().querySelectorAll('button')[0].click();
  await done;
  assert.deepEqual(calls, []);

  done = runTreeDialog({ kind: 'delete', node: folder }, value);
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['dialog.delete.folder']);
  dialog().querySelectorAll('button')[1].click();
  await done;
  assert.deepEqual(calls, ['remove docs']);
});

test('an abort closes the dialog without touching the workspace', async () => {
  const { value, calls } = deps([]);
  const controller = new AbortController();
  const done = runTreeDialog({ kind: 'new-file', dir: '' }, { ...value, signal: controller.signal });
  controller.abort();
  await done;
  assert.equal(document.querySelector('dialog'), null);
  assert.deepEqual(calls, []);
});
