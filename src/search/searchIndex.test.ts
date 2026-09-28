import test from 'node:test';
import assert from 'node:assert/strict';

import { SearchIndex, makeSnippet } from './searchIndex';

function sample() {
  const index = new SearchIndex();
  index.upsert('posts/burnout.md', '---\ntitle: La storia dei miei burnout\n---\nUn ciuffo bianco e una campagna.');
  index.upsert('notes/caffe.md', '# Caffè\n\nAppunti sul caffè al bar.');
  index.upsert(
    'notes/lungo.md',
    '# Altro\n\n' + 'parole di riempimento '.repeat(40) + 'caffè ' + 'ancora testo '.repeat(40),
  );
  return index;
}

test('finds documents by body words, prefixes and without accents', () => {
  const index = sample();
  assert.equal(index.search('ciuffo')[0]?.path, 'posts/burnout.md');
  assert.equal(index.search('ciuf')[0]?.path, 'posts/burnout.md');
  assert.ok(index.search('caffe').some((r) => r.path === 'notes/caffe.md'));
});

test('tolerates a typo', () => {
  assert.equal(sample().search('burnoit')[0]?.path, 'posts/burnout.md');
});

test('title matches rank first', () => {
  const results = sample().search('caffè');
  assert.equal(results[0].path, 'notes/caffe.md');
  assert.equal(results[0].title, 'Caffè');
});

test('upsert replaces the old content and remove drops the document', () => {
  const index = sample();
  index.upsert('posts/burnout.md', 'testo nuovo');
  assert.equal(index.search('ciuffo').length, 0);
  assert.equal(index.search('nuovo')[0]?.path, 'posts/burnout.md');
  index.remove('posts/burnout.md');
  assert.equal(index.search('nuovo').length, 0);
  assert.equal(index.has('posts/burnout.md'), false);
  index.remove('posts/burnout.md');
});

test('empty queries return nothing; titles lists every document', () => {
  const index = sample();
  assert.deepEqual(index.search('   '), []);
  assert.deepEqual(index.titles(), [
    { path: 'notes/caffe.md', title: 'Caffè' },
    { path: 'notes/lungo.md', title: 'Altro' },
    { path: 'posts/burnout.md', title: 'La storia dei miei burnout' },
  ]);
});

test('snippets show the matched term with ellipses', () => {
  const snippet = sample().search('caffè').find((r) => r.path === 'notes/lungo.md')!.snippet;
  assert.match(snippet, /^…/);
  assert.match(snippet, /…$/);
  assert.match(snippet, /caffè/);
  assert.equal(makeSnippet('breve testo', ['nulla']), 'breve testo');
});
