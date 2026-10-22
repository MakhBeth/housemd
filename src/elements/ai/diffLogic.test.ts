import test from 'node:test';
import assert from 'node:assert/strict';
import { Chunk } from '@codemirror/merge';
import { ChangeSet, EditorState } from '@codemirror/state';

import { blockCount, insideRange, rejectBlocker, rejectChange } from './diffLogic';

/** Rifiuta il blocco `index` come farebbe hmd-ai-diff-pane e restituisce la proposta che ne esce. */
function reject(original: string, proposal: string, index = 0): string {
  const a = EditorState.create({ doc: original });
  const b = EditorState.create({ doc: proposal });
  const chunk = Chunk.build(a.doc, b.doc)[index];
  return b.update({ changes: rejectChange(a, b, chunk) }).state.doc.toString();
}

test('reject: the original lines go back into the proposal, the other blocks stay', () => {
  assert.equal(reject('A\n\nB\n\nC', 'A2\n\nB\n\nC2'), 'A\n\nB\n\nC2');
  assert.equal(reject('A\n\nB\n\nC', 'A2\n\nB\n\nC2', 1), 'A2\n\nB\n\nC');
});

test('reject of an added or a removed line', () => {
  assert.equal(reject('A\nB', 'A\nnew\nB'), 'A\nB');
  assert.equal(reject('A\nold\nB', 'A\nB'), 'A\nold\nB');
});

test('edits to the proposal: anywhere without a range, only inside it with one', () => {
  const change = (from: number, to: number) => ChangeSet.of({ from, to, insert: 'x' }, 20);
  assert.equal(insideRange(change(0, 1), null), true);
  assert.equal(insideRange(change(5, 8), { from: 5, to: 10 }), true);
  assert.equal(insideRange(change(4, 6), { from: 5, to: 10 }), false);
  assert.equal(insideRange(change(9, 11), { from: 5, to: 10 }), false);
});

test('block buttons never switch off: reject says why only while generating or with the selection lost (proposal read-only)', () => {
  assert.equal(rejectBlocker({ kind: 'generating', seconds: 2 }), 'generating');
  assert.equal(rejectBlocker({ kind: 'scopeLost' }), 'scopeLost');
  for (const kind of ['none', 'partial', 'truncated', 'applied'] as const) assert.equal(rejectBlocker({ kind }), null, kind);
});

test('blockCount: the blocks the diff shows, as many as Chunk.build finds', () => {
  assert.equal(blockCount('a\nb\nc', 'a\nb\nc'), 0);
  assert.equal(blockCount('a\nb\nc', 'a\nB\nc'), 1);
  assert.equal(blockCount('a\nb\nc\nd\ne', 'A\nb\nc\nd\nE'), 2);
  assert.equal(blockCount('a\r\nb', 'a\r\nB'), 1, 'CRLF is one line break');
  assert.equal(blockCount('', 'new'), 1);
});
