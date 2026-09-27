import test from 'node:test';
import assert from 'node:assert/strict';

import en from './locales/en.json';
import { NAME_ERRORS } from '../ui/names';
import { TOAST_CODES } from '../workspace/toasts';

const keys = new Set(Object.keys(en));

test('every toast code has a message in en.json', () => {
  for (const code of TOAST_CODES) assert.ok(keys.has(`toast.${code}`), `manca toast.${code}`);
});

test('every name validation error has a message in en.json', () => {
  for (const code of NAME_ERRORS) assert.ok(keys.has(`name.error.${code}`), `manca name.error.${code}`);
  assert.ok(keys.has('name.error.taken'));
});
