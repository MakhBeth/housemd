import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../testing/memoryStorage';
import { readLastFile, readPref, writeLastFile, writePref } from '../lib/prefs';

const items = installMemoryStorage();

test('missing preferences give the defaults', () => {
  items.clear();
  assert.equal(readPref('mode'), 'split');
  assert.equal(readPref('sidebarOpen'), true);
  assert.equal(readPref('sidebarWidth'), 280);
  assert.equal(readPref('aiSidebarWidth'), 380);
  assert.equal(readPref('aiProfile'), '');
  assert.equal(readLastFile('ws'), null);
});

test('valid saved values are read back', () => {
  items.clear();
  writePref('mode', 'ai');
  writePref('sidebarOpen', false);
  writePref('sidebarWidth', 333);
  writePref('aiProfile', 'p1');
  writeLastFile('ws', 'docs/a.md');
  assert.equal(readPref('mode'), 'ai');
  assert.equal(readPref('sidebarOpen'), false);
  assert.equal(readPref('sidebarWidth'), 333);
  assert.equal(readPref('aiProfile'), 'p1');
  assert.equal(readLastFile('ws'), 'docs/a.md');
});

test('corrupt or hand-edited values fall back to the defaults', () => {
  items.clear();
  items.set('housemd:mode', '42');
  items.set('housemd:sidebarOpen', '"yes"');
  items.set('housemd:sidebarWidth', '"abc"');
  items.set('housemd:aiSidebarWidth', '{broken');
  items.set('housemd:aiProfile', 'null');
  items.set('housemd:lastFile:ws', '[1]');
  assert.equal(readPref('mode'), 'split');
  assert.equal(readPref('sidebarOpen'), true);
  assert.equal(readPref('sidebarWidth'), 280);
  assert.equal(readPref('aiSidebarWidth'), 380);
  assert.equal(readPref('aiProfile'), '');
  assert.equal(readLastFile('ws'), null);
});

test('the last file is per workspace', () => {
  items.clear();
  writeLastFile('a', 'x.md');
  assert.equal(readLastFile('a'), 'x.md');
  assert.equal(readLastFile('b'), null);
});

test('focus preferences default to off and paragraph, survive a reload and reject junk', () => {
  items.clear();
  assert.equal(readPref('focusMode'), false);
  assert.equal(readPref('focusUnit'), 'paragraph');
  writePref('focusMode', true);
  writePref('focusUnit', 'sentence');
  assert.equal(readPref('focusMode'), true);
  assert.equal(readPref('focusUnit'), 'sentence');
  items.set('housemd:focusUnit', '"line"');
  items.set('housemd:focusMode', '"on"');
  assert.equal(readPref('focusUnit'), 'paragraph');
  assert.equal(readPref('focusMode'), false);
});
