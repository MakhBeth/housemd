import test from 'node:test';
import assert from 'node:assert/strict';

import { composerAction, type ComposerKey } from './composerKeys';

const key = (k: string, extra: Partial<ComposerKey> = {}): ComposerKey => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

test('Enter sends, Shift+Enter goes to a new line', () => {
  assert.equal(composerAction(key('Enter'), false), 'send');
  assert.equal(composerAction(key('Enter', { shiftKey: true }), false), 'newline');
});

test('Enter during IME composition does nothing', () => {
  assert.equal(composerAction(key('Enter', { isComposing: true }), false), 'none');
  assert.equal(composerAction(key('Process', { isComposing: true }), false), 'none');
});

test('Ctrl, Cmd and Alt with Enter do nothing (the old Ctrl+Enter is gone)', () => {
  assert.equal(composerAction(key('Enter', { ctrlKey: true }), false), 'none');
  assert.equal(composerAction(key('Enter', { metaKey: true }), false), 'none');
  assert.equal(composerAction(key('Enter', { altKey: true }), false), 'none');
});

test('Escape stops only while running', () => {
  assert.equal(composerAction(key('Escape'), true), 'stop');
  assert.equal(composerAction(key('Escape'), false), 'none');
});

test('Enter while running still reports send (the caller ignores it)', () => {
  assert.equal(composerAction(key('Enter'), true), 'send');
});

test('other keys do nothing', () => {
  assert.equal(composerAction(key('a'), false), 'none');
  assert.equal(composerAction(key('ArrowUp'), true), 'none');
});
