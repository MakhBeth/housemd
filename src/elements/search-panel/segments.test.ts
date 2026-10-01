import test from 'node:test';
import assert from 'node:assert/strict';

import { segments } from './segments';

test('marks the matched term and keeps the text around it', () => {
  assert.deepEqual(segments('The quick fox', ['fox']), [
    { text: 'The quick ', mark: false },
    { text: 'fox', mark: true },
  ]);
});

test('matches ignore case and accents, like the search index', () => {
  assert.deepEqual(segments('Città e città', ['citta']), [
    { text: 'Città', mark: true },
    { text: ' e ', mark: false },
    { text: 'città', mark: true },
  ]);
});

test('adjacent matches merge into one marked segment (findMatches)', () => {
  assert.deepEqual(segments('foxfox!', ['fox']), [
    { text: 'foxfox', mark: true },
    { text: '!', mark: false },
  ]);
});

test('no terms or no match: one plain segment; empty text: one empty segment', () => {
  assert.deepEqual(segments('abc', []), [{ text: 'abc', mark: false }]);
  assert.deepEqual(segments('abc', ['zzz']), [{ text: 'abc', mark: false }]);
  assert.deepEqual(segments('', ['a']), [{ text: '', mark: false }]);
});
