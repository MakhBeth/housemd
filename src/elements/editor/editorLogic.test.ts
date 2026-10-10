import test from 'node:test';
import assert from 'node:assert/strict';

import { createDocSession } from '../../editor/docSession';
import { adoptResetKey, lineNumberFor, scrollTopFor, topLine } from './editorLogic';

test('a new reset key restarts the session from the text; the same key leaves it alone', () => {
  const session = createDocSession('a.md#1', 'old');
  session.history = {} as never;
  session.selection = {} as never;
  adoptResetKey(session, 'a.md#1', 'ignored');
  assert.equal(session.textLf, 'old');
  assert.ok(session.history && session.selection);
  adoptResetKey(session, 'a.md#2', 'new');
  assert.deepEqual(session, { resetKey: 'a.md#2', textLf: 'new', history: undefined, selection: undefined });
});

test('top line: block line plus the scrolled fraction, clamped to the block', () => {
  assert.equal(topLine(1, { top: 0, height: 20 }, 0), 0);
  assert.equal(topLine(5, { top: 100, height: 20 }, 110), 4.5);
  assert.equal(topLine(5, { top: 100, height: 20 }, 90), 4);
  assert.equal(topLine(5, { top: 100, height: 20 }, 130), 5);
  assert.equal(topLine(3, { top: 40, height: 0 }, 41), 2);
});

test('line to show: 1-based, inside the document', () => {
  assert.deepEqual([lineNumberFor(0, 10), lineNumberFor(2.7, 10), lineNumberFor(-3, 10), lineNumberFor(42, 10)], [1, 3, 1, 10]);
});

test('scroll offset for a fractional line inside its block', () => {
  assert.equal(scrollTopFor(4, { top: 80, height: 20 }), 80);
  assert.equal(scrollTopFor(4.25, { top: 80, height: 20 }), 85);
});
