import test from 'node:test';
import assert from 'node:assert/strict';

import { nextIndex, recentLabel } from './openView';

test('arrows go round the menu items; Home and End to the ends; other keys do nothing', () => {
  assert.equal(nextIndex(-1, 3, 'ArrowDown'), 0);
  assert.equal(nextIndex(2, 3, 'ArrowDown'), 0);
  assert.equal(nextIndex(0, 3, 'ArrowUp'), 2);
  assert.equal(nextIndex(1, 3, 'Home'), 0);
  assert.equal(nextIndex(1, 3, 'End'), 2);
  assert.equal(nextIndex(1, 3, 'a'), null);
  assert.equal(nextIndex(0, 0, 'ArrowDown'), null);
});

test('a recent entry is labelled with its kind', () => {
  assert.equal(recentLabel('folder'), 'open.recentFolder');
  assert.equal(recentLabel('file'), 'open.recentFile');
});
