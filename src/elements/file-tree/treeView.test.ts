import test from 'node:test';
import assert from 'node:assert/strict';

import type { TreeNode } from '../../ui/tree';
import { MENU_LABELS, menuActions, nodeKey, nodesByPath } from './treeView';

const file = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'file', children: [] });
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'directory', children });

test('menu entries by kind, in the order of the old menu', () => {
  assert.deepEqual(menuActions('directory'), ['new-file', 'new-folder', 'rename', 'delete']);
  assert.deepEqual(menuActions('file'), ['history', 'rename', 'delete']);
  assert.deepEqual(menuActions(null), ['rename', 'delete']);
  assert.deepEqual(menuActions('asset'), ['rename', 'delete']);
});

test('every menu entry has a label', () => {
  for (const action of [...menuActions('directory'), ...menuActions('file')]) assert.ok(MENU_LABELS[action], action);
});

test('the row key changes with the kind of the node', () => {
  assert.notEqual(nodeKey(file('a')), nodeKey(dir('a', [])));
  assert.equal(nodeKey(file('a/b.md')), nodeKey(file('a/b.md')));
});

test('nodesByPath reaches every depth', () => {
  const guide = file('docs/deep/guide.md');
  const map = nodesByPath([dir('docs', [dir('docs/deep', [guide])]), file('a.md')]);
  assert.deepEqual([...map.keys()].sort(), ['a.md', 'docs', 'docs/deep', 'docs/deep/guide.md']);
  assert.equal(map.get('docs/deep/guide.md'), guide);
});
