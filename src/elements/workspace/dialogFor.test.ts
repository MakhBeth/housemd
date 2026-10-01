import test from 'node:test';
import assert from 'node:assert/strict';

import type { TreeNode } from '../../ui/tree';
import { dialogFor } from './dialogFor';

const file: TreeNode = { name: 'b.md', path: 'docs/b.md', kind: 'file', children: [] };
const folder: TreeNode = { name: 'docs', path: 'docs', kind: 'directory', children: [] };

test('new file/folder: in the folder itself, next to a file, or at the root from the sidebar', () => {
  assert.deepEqual(dialogFor('new-file', folder), { kind: 'dialog', dialog: { kind: 'new-file', dir: 'docs' } });
  assert.deepEqual(dialogFor('new-folder', file), { kind: 'dialog', dialog: { kind: 'new-folder', dir: 'docs' } });
  assert.deepEqual(dialogFor('new-file', null), { kind: 'dialog', dialog: { kind: 'new-file', dir: '' } });
});

test('rename and delete need a node', () => {
  assert.deepEqual(dialogFor('rename', file), { kind: 'dialog', dialog: { kind: 'rename', node: file } });
  assert.deepEqual(dialogFor('delete', folder), { kind: 'dialog', dialog: { kind: 'delete', node: folder } });
  assert.deepEqual(dialogFor('rename', null), { kind: 'none' });
});

test('history opens the panel for that file, nothing without a node', () => {
  assert.deepEqual(dialogFor('history', file), { kind: 'history', path: 'docs/b.md' });
  assert.deepEqual(dialogFor('history', null), { kind: 'none' });
});
