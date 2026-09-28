import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTOSAVE_MODES,
  AUTOSAVE_TRIGGERS,
  autosaveAllows,
  clampDelay,
  DEFAULT_AUTOSAVE,
  parseAutosave,
  type AutosaveMode,
  type AutosaveTrigger,
} from './autosave';

test('autosaveAllows: full table', () => {
  const allowed: Record<AutosaveMode, readonly AutosaveTrigger[]> = {
    afterDelay: AUTOSAVE_TRIGGERS,
    onFocusChange: ['blur', 'switch'],
    off: [],
  };
  for (const mode of AUTOSAVE_MODES) {
    for (const trigger of AUTOSAVE_TRIGGERS) {
      assert.equal(autosaveAllows(mode, trigger), allowed[mode].includes(trigger), `${mode} / ${trigger}`);
    }
  }
});

test('the default is afterDelay with a 1000 ms pause', () => {
  assert.deepEqual(DEFAULT_AUTOSAVE, { mode: 'afterDelay', delayMs: 1000 });
});

test('parseAutosave falls back to defaults and clamps the delay', () => {
  assert.deepEqual(parseAutosave(undefined), DEFAULT_AUTOSAVE);
  assert.deepEqual(parseAutosave(null), DEFAULT_AUTOSAVE);
  assert.deepEqual(parseAutosave('off'), DEFAULT_AUTOSAVE);
  assert.deepEqual(parseAutosave({ mode: 'sometimes', delayMs: 'abc' }), DEFAULT_AUTOSAVE);
  assert.deepEqual(parseAutosave({ mode: 'off', delayMs: 50 }), { mode: 'off', delayMs: 500 });
  assert.deepEqual(parseAutosave({ mode: 'onFocusChange', delayMs: 99_999 }), { mode: 'onFocusChange', delayMs: 10_000 });
  assert.deepEqual(parseAutosave({ mode: 'afterDelay', delayMs: 2500 }), { mode: 'afterDelay', delayMs: 2500 });
});

test('clampDelay rounds and keeps the delay within 500–10000 ms', () => {
  assert.equal(clampDelay(1234.6), 1235);
  assert.equal(clampDelay(-5), 500);
  assert.equal(clampDelay(Number.NaN), 1000);
  assert.equal(clampDelay(Number.POSITIVE_INFINITY), 1000);
});
