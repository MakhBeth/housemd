import test from 'node:test';
import assert from 'node:assert/strict';

import { findMatches, fold } from './fold';

test('fold lowercases and strips accents', () => {
  assert.equal(fold('Perché CAFFÈ'), 'perche caffe');
});

test('findMatches finds accent- and case-insensitive occurrences', () => {
  assert.deepEqual(findMatches('Il Caffè e il caffe', ['caffe']), [[3, 8], [14, 19]]);
});

test('findMatches handles decomposed (NFD) text', () => {
  assert.deepEqual(findMatches('pèrché no', ['perche']), [[0, 8]]);
  assert.deepEqual(findMatches('caffè', ['caffe']), [[0, 6]]);
});

test('findMatches merges overlapping matches and ignores empty terms', () => {
  assert.deepEqual(findMatches('burnout', ['burn', 'burnout', '']), [[0, 7]]);
  assert.deepEqual(findMatches('niente', ['xyz']), []);
});
