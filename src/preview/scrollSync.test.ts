import test from 'node:test';
import assert from 'node:assert/strict';

import { lineForOffset, offsetForLine, type Anchor } from './scrollSync';

const anchors: Anchor[] = [
  { line: 0, top: 0 },
  { line: 10, top: 100 },
  { line: 20, top: 300 },
];

test('offsetForLine interpolates between anchors and clamps at the ends', () => {
  assert.equal(offsetForLine(anchors, 5), 50);
  assert.equal(offsetForLine(anchors, 15), 200);
  assert.equal(offsetForLine(anchors, 25), 300);
  assert.equal(offsetForLine([], 3), 0);
});

test('lineForOffset is the inverse', () => {
  assert.equal(lineForOffset(anchors, 50), 5);
  assert.equal(lineForOffset(anchors, 200), 15);
  assert.equal(lineForOffset(anchors, 400), 20);
  assert.equal(lineForOffset([], 10), 0);
});
