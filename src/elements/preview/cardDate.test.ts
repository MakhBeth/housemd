import test from 'node:test';
import assert from 'node:assert/strict';

import { formatCardDate } from './cardDate';

test('an ISO day is written out in the interface language', () => {
  assert.equal(formatCardDate('2026-01-15', 'en'), 'January 15, 2026');
  assert.equal(formatCardDate('2026-01-15', 'it'), '15 gennaio 2026');
});

test('anything that is not YYYY-MM-DD is shown as written', () => {
  assert.equal(formatCardDate('next week', 'en'), 'next week');
  assert.equal(formatCardDate('2026-1-5', 'en'), '2026-1-5');
});

test('an impossible month stays as written; an overflowing day rolls over (Date semantics, as today)', () => {
  assert.equal(formatCardDate('2026-13-45', 'en'), '2026-13-45');
  assert.equal(formatCardDate('2026-02-30', 'en'), 'March 2, 2026');
});
