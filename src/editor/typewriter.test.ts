import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorSelection, EditorState } from '@codemirror/state';

import { centerInput, shouldCenter, typewriterExtensions } from './typewriter';

test('centers on typing and keyboard moves, never on the mouse', () => {
  assert.equal(shouldCenter({ selection: false, docChanged: true, pointer: false }), true);
  assert.equal(shouldCenter({ selection: true, docChanged: false, pointer: false }), true);
  assert.equal(shouldCenter({ selection: true, docChanged: false, pointer: true }), false);
  assert.equal(shouldCenter({ selection: false, docChanged: false, pointer: false }), false);
});

test('the transaction extender adds the centering in the same transaction', () => {
  const on = EditorState.create({ doc: 'a\nb\nc', extensions: typewriterExtensions(true) });
  const key = on.update({ selection: EditorSelection.cursor(2), userEvent: 'select' });
  assert.equal(key.effects.length, 1, 'arrow key');
  assert.equal(on.update({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' }).effects.length, 1, 'typing');
  assert.equal(on.update({ selection: EditorSelection.cursor(2), userEvent: 'select.pointer' }).effects.length, 0, 'mouse');
  assert.equal(on.update({ changes: { from: 0, insert: 'x' }, selection: EditorSelection.cursor(1), userEvent: 'input.drop' }).effects.length, 0, 'text dropped with the mouse');
  assert.equal(on.update({ changes: { from: 0, to: 1 }, userEvent: 'move.drop' }).effects.length, 0, 'text moved with the mouse');
  assert.equal(on.update({}).effects.length, 0, 'empty transaction');
  const off = EditorState.create({ doc: 'a\nb\nc', extensions: typewriterExtensions(false) });
  assert.equal(off.update({ selection: EditorSelection.cursor(2), userEvent: 'select' }).effects.length, 0, 'off');
});

test('centerInput reads selection, doc and pointer from the transaction', () => {
  const state = EditorState.create({ doc: 'abc' });
  assert.deepEqual(centerInput(state.update({ selection: EditorSelection.cursor(1), userEvent: 'select.pointer' })), { selection: true, docChanged: false, pointer: true });
});
