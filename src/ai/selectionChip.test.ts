import test from 'node:test';
import assert from 'node:assert/strict';

import { sameRange, selectionLabel } from './selectionChip';

const text = 'uno\ndue\ntre\n\n   \nquattro';

test('no range or an empty range gives no chip', () => {
  assert.equal(selectionLabel(text, null), null);
  assert.equal(selectionLabel(text, { from: 2, to: 2 }), null);
});

test('a selection of only spaces or newlines gives no chip', () => {
  const blank = text.indexOf('\n\n');
  assert.equal(selectionLabel(text, { from: blank, to: blank + 6 }), null);
});

test('a single-line selection counts characters', () => {
  assert.deepEqual(selectionLabel(text, { from: 0, to: 3 }), { lines: 1, chars: 3 });
});

test('a multi-line selection counts lines, ignoring a trailing newline', () => {
  assert.deepEqual(selectionLabel(text, { from: 0, to: 11 }), { lines: 3, chars: 11 });
  assert.deepEqual(selectionLabel(text, { from: 0, to: 12 }), { lines: 3, chars: 12 }, 'uno\\ndue\\ntre\\n');
});

test('a range past the end of the text is clamped', () => {
  assert.deepEqual(selectionLabel('abc', { from: 1, to: 99 }), { lines: 1, chars: 2 });
});

test('sameRange compares positions and nulls', () => {
  assert.equal(sameRange(null, null), true);
  assert.equal(sameRange({ from: 1, to: 2 }, { from: 1, to: 2 }), true);
  assert.equal(sameRange({ from: 1, to: 2 }, { from: 1, to: 3 }), false);
  assert.equal(sameRange(null, { from: 1, to: 2 }), false);
});
