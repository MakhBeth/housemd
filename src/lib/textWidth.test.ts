import test from 'node:test';
import assert from 'node:assert/strict';

import { clampTextWidth, DEFAULT_TEXT_WIDTH, MAX_TEXT_WIDTH, MIN_TEXT_WIDTH, parseTextWidth, textWidthVars } from './textWidth';

test('clampTextWidth keeps the value within the limits and rounds it', () => {
  assert.equal(clampTextWidth(80), 80);
  assert.equal(clampTextWidth('100'), 100);
  assert.equal(clampTextWidth(80.6), 81);
  assert.equal(clampTextWidth(5), MIN_TEXT_WIDTH);
  assert.equal(clampTextWidth(0), MIN_TEXT_WIDTH, 'zero non vuol dire "nessun limite": solo il campo vuoto');
  assert.equal(clampTextWidth('-3'), MIN_TEXT_WIDTH);
  assert.equal(clampTextWidth(10_000), MAX_TEXT_WIDTH);
});

test('empty or non-numeric means no limit', () => {
  for (const value of ['', '  ', 'abc', null, undefined, NaN, {}]) assert.equal(clampTextWidth(value), null, String(value));
});

test('parseTextWidth falls back to the defaults for missing or broken prefs', () => {
  assert.deepEqual(parseTextWidth(undefined), DEFAULT_TEXT_WIDTH);
  assert.deepEqual(parseTextWidth('x'), DEFAULT_TEXT_WIDTH);
  assert.deepEqual(parseTextWidth({ editor: 90 }), { editor: 90, preview: DEFAULT_TEXT_WIDTH.preview });
  assert.deepEqual(parseTextWidth({ editor: null, preview: null }), { editor: null, preview: null }, 'nessun limite è una scelta salvata');
  assert.deepEqual(parseTextWidth({ editor: 1, preview: 9999 }), { editor: MIN_TEXT_WIDTH, preview: MAX_TEXT_WIDTH });
});

test('textWidthVars gives characters, or 100% without a limit', () => {
  assert.deepEqual(textWidthVars({ editor: 80, preview: null }), { '--editor-text-width': '80ch', '--preview-text-width': '100%' });
});
