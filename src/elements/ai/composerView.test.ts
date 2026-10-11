import test from 'node:test';
import assert from 'node:assert/strict';

import type { PromptPreset } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { outgoing, selectionChipText, sendButton } from './composerView';

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

test('send button: Stop while running (never disabled), Send disabled without text or profile', () => {
  assert.deepEqual(sendButton(true, '', false), { label: 'ai.stop', icon: 'stop', disabled: false });
  assert.deepEqual(sendButton(false, 'x', true), { label: 'ai.send', icon: 'send', disabled: false });
  assert.equal(sendButton(false, '  ', true).disabled, true);
  assert.equal(sendButton(false, 'x', false).disabled, true);
});
