import test from 'node:test';
import assert from 'node:assert/strict';

import { revealPath, toggleExpanded } from './treeState';

test('toggle opens and closes a folder', () => {
  const open = toggleExpanded(new Set(), 'docs', true);
  assert.deepEqual([...open], ['docs']);
  assert.deepEqual([...toggleExpanded(open, 'docs', false)], []);
});

test('toggle to the current state returns the same object', () => {
  const expanded = new Set(['docs']);
  assert.equal(toggleExpanded(expanded, 'docs', true), expanded);
  assert.equal(toggleExpanded(expanded, 'other', false), expanded);
});

test('revealPath opens every ancestor and closes nothing', () => {
  const next = revealPath(new Set(['notes']), 'a/b/c.md');
  assert.deepEqual([...next].sort(), ['a', 'a/b', 'notes']);
});

test('revealPath with ancestors already open (or a root file) returns the same object', () => {
  const expanded = new Set(['a', 'a/b']);
  assert.equal(revealPath(expanded, 'a/b/c.md'), expanded);
  assert.equal(revealPath(expanded, 'root.md'), expanded);
});
