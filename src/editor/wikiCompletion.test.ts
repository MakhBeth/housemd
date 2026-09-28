import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';

import { wikiCompletionSource } from './wikiCompletion';

const source = wikiCompletionSource(() => [
  { path: 'notes/idea.md', title: 'Una grande idea' },
  { path: 'posts/burnout.md', title: 'burnout' },
]);

function complete(doc: string, pos = doc.length) {
  return source(new CompletionContext(EditorState.create({ doc }), pos, false));
}

test('completes after [[ with file paths and titles', () => {
  const result = complete('vedi [[ide');
  assert.equal(result?.from, 7);
  assert.deepEqual(result?.options.map((o) => [o.label, o.detail, o.apply]), [
    ['notes/idea', 'Una grande idea', 'notes/idea]]'],
    ['posts/burnout', undefined, 'posts/burnout]]'],
  ]);
});

test('does not add ]] when it is already there', () => {
  const result = complete('vedi [[ide]]', 10);
  assert.equal(result?.options[0].apply, 'notes/idea');
});

test('does nothing outside [[', () => {
  assert.equal(complete('vedi [ide'), null);
  assert.equal(complete('[[a]] poi'), null);
  assert.equal(complete('[[a|etich'), null);
});
