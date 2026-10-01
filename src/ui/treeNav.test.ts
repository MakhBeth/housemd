import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTree } from './tree';
import { tabStop, treeKey, visibleItems } from './treeNav';

const nodes = buildTree([
  { path: 'docs', kind: 'directory' },
  { path: 'docs/a.md', kind: 'file' },
  { path: 'docs/img.png', kind: 'asset' },
  { path: 'empty', kind: 'directory' },
  { path: 'z.md', kind: 'file' },
] as never);

const paths = (expanded: string[]) => visibleItems(nodes, new Set(expanded)).map((i) => i.path);

test('visible items skip assets and the content of closed folders', () => {
  assert.deepEqual(paths([]), ['docs', 'empty', 'z.md']);
  assert.deepEqual(paths(['docs']), ['docs', 'docs/a.md', 'empty', 'z.md']);
});

test('the tab stop is the focused row, then the open file, then the first row', () => {
  const items = visibleItems(nodes, new Set(['docs']));
  assert.equal(tabStop(items, 'z.md', 'docs/a.md'), 'z.md');
  assert.equal(tabStop(items, 'gone.md', 'docs/a.md'), 'docs/a.md', 'riga sparita (cartella chiusa, file eliminato)');
  assert.equal(tabStop(visibleItems(nodes, new Set()), null, 'docs/a.md'), 'docs', 'file aperto in una cartella chiusa');
  assert.equal(tabStop([], null, null), null);
});

test('up/down/home/end move between visible rows and stop at the edges', () => {
  const items = visibleItems(nodes, new Set(['docs']));
  assert.deepEqual(treeKey(items, 'docs', { key: 'ArrowDown' }), { focus: 'docs/a.md' });
  assert.deepEqual(treeKey(items, 'docs/a.md', { key: 'ArrowUp' }), { focus: 'docs' });
  assert.equal(treeKey(items, 'z.md', { key: 'ArrowDown' }), null);
  assert.equal(treeKey(items, 'docs', { key: 'ArrowUp' }), null);
  assert.deepEqual(treeKey(items, 'empty', { key: 'Home' }), { focus: 'docs' });
  assert.deepEqual(treeKey(items, 'docs', { key: 'End' }), { focus: 'z.md' });
});

test('right opens a folder, then enters it; left closes it, then goes to the parent', () => {
  const closed = visibleItems(nodes, new Set());
  const open = visibleItems(nodes, new Set(['docs']));
  assert.deepEqual(treeKey(closed, 'docs', { key: 'ArrowRight' }), { expand: 'docs' });
  assert.deepEqual(treeKey(open, 'docs', { key: 'ArrowRight' }), { focus: 'docs/a.md' });
  assert.equal(treeKey(visibleItems(nodes, new Set(['empty'])), 'empty', { key: 'ArrowRight' }), null, 'cartella aperta ma vuota');
  assert.equal(treeKey(open, 'z.md', { key: 'ArrowRight' }), null);
  assert.deepEqual(treeKey(open, 'docs', { key: 'ArrowLeft' }), { collapse: 'docs' });
  assert.deepEqual(treeKey(open, 'docs/a.md', { key: 'ArrowLeft' }), { focus: 'docs' });
  assert.equal(treeKey(open, 'z.md', { key: 'ArrowLeft' }), null);
});

test('Shift+F10 and the context-menu key open the row menu; modified arrows are left alone', () => {
  const items = visibleItems(nodes, new Set());
  assert.deepEqual(treeKey(items, 'z.md', { key: 'F10', shiftKey: true }), { menu: 'z.md' });
  assert.deepEqual(treeKey(items, 'z.md', { key: 'ContextMenu' }), { menu: 'z.md' });
  assert.equal(treeKey(items, 'docs', { key: 'ArrowDown', ctrlKey: true }), null);
  assert.equal(treeKey(items, 'docs', { key: 'ArrowDown', shiftKey: true }), null);
  assert.equal(treeKey(items, 'docs', { key: 'a' }), null);
});
