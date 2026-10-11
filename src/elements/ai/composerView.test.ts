import test from 'node:test';
import assert from 'node:assert/strict';

import type { PromptPreset } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { CONTROLLER_NOTES, outgoing, selectionChipText, sendBlocker, sendButton } from './composerView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);

test('selection chip: lines for several lines, characters for one, nothing for spaces or no selection', () => {
  const text = 'uno\ndue\ntre';
  assert.equal(selectionChipText(t, text, { from: 0, to: 7 }, null), t('ai.selectionLines', { count: 2 }));
  assert.equal(selectionChipText(t, text, { from: 0, to: 3 }, null), t('ai.selectionChars', { count: 3 }));
  assert.equal(selectionChipText(t, 'a   b', { from: 1, to: 4 }, null), null);
  assert.equal(selectionChipText(t, text, null, null), null);
});

test('selection chip: the ignored selection hides it, a different one brings it back', () => {
  const text = 'uno\ndue\ntre';
  assert.equal(selectionChipText(t, text, { from: 0, to: 3 }, { from: 0, to: 3 }), null);
  assert.equal(selectionChipText(t, text, { from: 4, to: 7 }, { from: 0, to: 3 }), t('ai.selectionChars', { count: 3 }));
});

test('outgoing: the preset label, else the trimmed text; nothing for blanks', () => {
  const preset = { id: 'p', name: '', builtInId: 'traduci' } as PromptPreset;
  assert.equal(outgoing('typed', preset, t), EN_MESSAGES['ai.preset.traduci']);
  assert.equal(outgoing('  hi \n', undefined, t), 'hi');
  assert.equal(outgoing('  \n ', undefined, t), null);
});

test('send button: Stop while running, Send otherwise (never disabled)', () => {
  assert.deepEqual(sendButton(true), { label: 'ai.stop', icon: 'stop' });
  assert.deepEqual(sendButton(false), { label: 'ai.send', icon: 'send' });
});

test('why a message cannot be sent: the profile first (without it nothing can be sent), then the text', () => {
  assert.equal(sendBlocker('', false, false), 'ai.composer.needProfile');
  assert.equal(sendBlocker('fix', false, false), 'ai.composer.needProfile');
  assert.equal(sendBlocker('  \n ', true, false), 'ai.composer.needText');
  assert.equal(sendBlocker('fix', true, false), null);
});

test('a preset needs a profile but no text', () => {
  assert.equal(sendBlocker('', false, true), 'ai.composer.needProfile');
  assert.equal(sendBlocker('', true, true), null);
});

test('a reason of the controller comes before profile and text: generation, no document, update', () => {
  assert.equal(sendBlocker('', false, false, 'running'), 'ai.composer.generating');
  assert.equal(sendBlocker('fix', true, false, 'noDocument'), 'ai.composer.noDocument');
  assert.equal(sendBlocker('fix', true, true, 'updating'), 'ai.composer.updating');
  assert.equal(sendBlocker('fix', true, false, null), null);
  assert.deepEqual(CONTROLLER_NOTES, { running: 'ai.composer.generating', noDocument: 'ai.composer.noDocument', updating: 'ai.composer.updating' });
});
