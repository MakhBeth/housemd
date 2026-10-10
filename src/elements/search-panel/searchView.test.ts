import test from 'node:test';
import assert from 'node:assert/strict';

import type { SearchResult } from '../../search/searchIndex';
import { searchItemKey, searchItems } from './searchView';

const result = (path: string): SearchResult => ({ path, title: path, snippet: '', terms: [] });

test('no list for an empty or blank query, whatever the results', () => {
  assert.equal(searchItems('', [result('a.md')]), null);
  assert.equal(searchItems('   ', [result('a.md')]), null);
});

test('a query without results shows the "none" row; with results, one row each', () => {
  assert.deepEqual(searchItems('fox', []), [{ kind: 'none' }]);
  const a = result('a.md');
  assert.deepEqual(searchItems('fox', [a]), [{ kind: 'result', result: a }]);
});

test('keys: one per path, and the "none" row never equals a path key', () => {
  assert.equal(searchItemKey({ kind: 'result', result: result('a.md') }), 'r:a.md');
  assert.notEqual(searchItemKey({ kind: 'none' }), searchItemKey({ kind: 'result', result: result('none') }));
});
