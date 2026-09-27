import test from 'node:test';
import assert from 'node:assert/strict';

import en from './locales/en.json';
import { NAME_ERRORS } from '../ui/names';
import { THEME_PREFS } from '../theme/theme';
import { TOAST_CODES } from '../workspace/toasts';
import { UNSUPPORTED_REASONS } from '../fs/access';
import { AUTOSAVE_MODES } from '../workspace/autosave';
import { SNAPSHOT_REASONS } from '../history/historyStore';

const keys = new Set(Object.keys(en));

test('every toast code has a message in en.json', () => {
  for (const code of TOAST_CODES) assert.ok(keys.has(`toast.${code}`), `manca toast.${code}`);
});

test('every name validation error has a message in en.json', () => {
  for (const code of NAME_ERRORS) assert.ok(keys.has(`name.error.${code}`), `manca name.error.${code}`);
  assert.ok(keys.has('name.error.taken'));
});

test('every unsupported-browser reason has a message in en.json', () => {
  for (const reason of UNSUPPORTED_REASONS) assert.ok(keys.has(`unsupported.${reason}`), `manca unsupported.${reason}`);
});

test('every theme preference has its switcher tooltip and settings label', () => {
  for (const pref of THEME_PREFS) {
    assert.ok(keys.has(`theme.${pref}`), `manca theme.${pref}`);
    assert.ok(keys.has(`theme.option.${pref}`), `manca theme.option.${pref}`);
  }
});

test('every autosave mode has its settings label', () => {
  for (const mode of AUTOSAVE_MODES) assert.ok(keys.has(`settings.autosave.${mode}`), `manca settings.autosave.${mode}`);
});

test('every snapshot reason has its label in en.json', () => {
  for (const reason of SNAPSHOT_REASONS) assert.ok(keys.has(`history.reason.${reason}`), `manca history.reason.${reason}`);
});
