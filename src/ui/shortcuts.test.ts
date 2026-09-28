import test from 'node:test';
import assert from 'node:assert/strict';

import { shortcutFor, type KeyInput } from './shortcuts';

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  code: '',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  ...extra,
});

test('Ctrl or Cmd with S, K, B and backslash map to their shortcuts', () => {
  assert.equal(shortcutFor(key('s')), 'save');
  assert.equal(shortcutFor(key('S')), 'save', 'anche con Maiuscolo (Ctrl+Shift+S)');
  assert.equal(shortcutFor(key('k')), 'search');
  assert.equal(shortcutFor(key('b')), 'toggleSidebar');
  assert.equal(shortcutFor(key('b', { ctrlKey: false, metaKey: true })), 'toggleSidebar');
  assert.equal(shortcutFor(key('\\')), 'cycleMode');
  assert.equal(shortcutFor(key('x')), null);
});

test('Ctrl+Alt+S is save all, recognised by the physical key', () => {
  assert.equal(shortcutFor(key('ß', { altKey: true, code: 'KeyS' })), 'saveAll', 'su macOS Alt+S scrive ß');
  assert.equal(shortcutFor(key('s', { altKey: true, code: 'KeyS', ctrlKey: false, metaKey: true })), 'saveAll');
  assert.equal(shortcutFor(key('k', { altKey: true, code: 'KeyK' })), null);
});

test('without Ctrl or Cmd nothing is a shortcut', () => {
  assert.equal(shortcutFor(key('s', { ctrlKey: false })), null);
  assert.equal(shortcutFor(key('b', { ctrlKey: false })), null);
});
