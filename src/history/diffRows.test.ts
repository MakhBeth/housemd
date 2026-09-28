import test from 'node:test';
import assert from 'node:assert/strict';

import { diffRows, isIdentical } from './diffRows';

test('diffRows lists removed and added lines in order', () => {
  assert.deepEqual(diffRows('a\nb\nc\n', 'a\nB\nc\nd\n'), [
    { kind: 'same', text: 'a' },
    { kind: 'removed', text: 'b' },
    { kind: 'added', text: 'B' },
    { kind: 'same', text: 'c' },
    { kind: 'added', text: 'd' },
  ]);
});

test('diffRows ignores CRLF vs LF differences', () => {
  const rows = diffRows('a\r\nb\r\n', 'a\nb\n');
  assert.ok(isIdentical(rows));
  assert.deepEqual(rows.map((r) => r.text), ['a', 'b']);
});

test('diffRows handles a last line without newline and empty texts', () => {
  assert.deepEqual(diffRows('', 'x'), [{ kind: 'added', text: 'x' }]);
  assert.deepEqual(diffRows('a', 'a'), [{ kind: 'same', text: 'a' }]);
  assert.deepEqual(diffRows('', ''), []);
  assert.ok(isIdentical([]));
});

test('diffRows keeps markup as plain text', () => {
  assert.deepEqual(diffRows('', '<img src=x onerror=alert(1)>\n'), [{ kind: 'added', text: '<img src=x onerror=alert(1)>' }]);
});
