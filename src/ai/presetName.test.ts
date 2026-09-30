import test from 'node:test';
import assert from 'node:assert/strict';

import { presetLabel } from './presetName';

const t = (key: string) => `<${key}>`;

test('a preset with a name shows its name', () => {
  assert.equal(presetLabel({ name: 'Mio', builtInId: 'traduci' }, t), 'Mio');
  assert.equal(presetLabel({ name: 'Mio' }, t), 'Mio');
});

test('a built-in without a name shows its translation', () => {
  assert.equal(presetLabel({ name: '', builtInId: 'sbobina' }, t), '<ai.preset.sbobina>');
});

test('a custom preset without a name is untitled, never ai.preset.undefined', () => {
  assert.equal(presetLabel({ name: '' }, t), '<ai.untitled>');
  assert.equal(presetLabel({ name: '   ' }, t), '<ai.untitled>');
});
