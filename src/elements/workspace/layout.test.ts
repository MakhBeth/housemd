import test from 'node:test';
import assert from 'node:assert/strict';

import { clampWidth, gridColumns, MODES, nextPaneMode, PANE_MODES, panesMode, resizeByKey, sidePanel, WIDTH_LIMITS } from './layout';

test('four modes; Ctrl+\\ cycles only the three document views', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['editor', 'split', 'preview', 'ai']);
  assert.deepEqual(PANE_MODES.map((m) => m.id), ['editor', 'split', 'preview']);
  assert.equal(nextPaneMode('editor'), 'split');
  assert.equal(nextPaneMode('split'), 'preview');
  assert.equal(nextPaneMode('preview'), 'editor');
  assert.equal(nextPaneMode('ai'), 'editor');
});

test('the side panel is the AI chat in AI mode, the file sidebar otherwise', () => {
  assert.equal(sidePanel('ai'), 'ai');
  for (const mode of ['editor', 'split', 'preview'] as const) assert.equal(sidePanel(mode), 'sidebar');
});

test('widths are clamped to the limits of their panel; only the file sidebar is rounded (as today)', () => {
  assert.deepEqual(WIDTH_LIMITS.sidebar, { min: 180, max: 480, initial: 280 });
  assert.deepEqual(WIDTH_LIMITS.ai, { min: 300, max: 640, initial: 380 });
  assert.equal(clampWidth('sidebar', 100), 180);
  assert.equal(clampWidth('sidebar', 900), 480);
  assert.equal(clampWidth('sidebar', 300.6), 301);
  assert.equal(clampWidth('ai', 200), 300);
  assert.equal(clampWidth('ai', 700), 640);
  assert.equal(clampWidth('ai', 400.4), 400.4);
});

test('arrow keys resize by 16px within the limits; other keys do nothing', () => {
  assert.equal(resizeByKey('sidebar', 280, 'ArrowRight'), 296);
  assert.equal(resizeByKey('sidebar', 280, 'ArrowLeft'), 264);
  assert.equal(resizeByKey('sidebar', 475, 'ArrowRight'), 480);
  assert.equal(resizeByKey('ai', 305, 'ArrowLeft'), 300);
  assert.equal(resizeByKey('sidebar', 280, 'Enter'), null);
});

test('grid columns: side panel, 5px resizer and the main area; only the main area when closed', () => {
  assert.equal(gridColumns(true, 280), '280px 5px minmax(0, 1fr)');
  assert.equal(gridColumns(false, 280), 'minmax(0, 1fr)');
});

test('with the history open, Editor mode shows two panes like Split', () => {
  assert.equal(panesMode('editor', true), 'split');
  assert.equal(panesMode('editor', false), 'editor');
  assert.equal(panesMode('preview', true), 'preview');
});
