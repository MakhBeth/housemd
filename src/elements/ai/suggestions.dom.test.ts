import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { fakeAi } from '../../testing/fakeAi';

const preset = (id: string, order: number, name = '', builtInId?: PromptPreset['builtInId']) => ({ id, order, name, builtInId, hidden: false }) as PromptPreset;
const presets = [preset('builtin:sbobina', 0, '', 'sbobina'), preset('mine', 1, 'Mine')];

function mount() {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.suggestions': 'SUGGERIMENTI' } }), persist() {} });
  const ai = fakeAi({ presets });
  const el = document.createElement('hmd-ai-suggestions');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  return { el, ai, i18n, group: () => el.querySelector<HTMLDivElement>('[role="group"]') };
}

test('a group of preset buttons, labelled, in preset order', () => {
  const { el, group } = mount();
  assert.equal(group()!.className, 'suggestions');
  assert.equal(group()!.getAttribute('aria-label'), EN_MESSAGES['ai.suggestions']);
  assert.deepEqual([...group()!.querySelectorAll('button')].map((b) => [b.type, b.className, b.textContent]), [
    ['button', 'suggestion', EN_MESSAGES['ai.preset.sbobina']],
    ['button', 'suggestion', 'Mine'],
  ]);
  el.remove();
});

test('a click sends hmd-ai-suggestion with the preset id', () => {
  const { el, group } = mount();
  const ids: string[] = [];
  el.addEventListener('hmd-ai-suggestion', (event) => ids.push(event.detail.presetId));
  group()!.querySelectorAll('button')[1].click();
  assert.deepEqual(ids, ['mine']);
  el.remove();
});

test('the group goes away with messages or a running request, and comes back reusing the buttons', () => {
  const { el, ai, group } = mount();
  const first = group()!.querySelector('button');
  ai.set({ chat: { id: 'c', messages: [{}] as never, overrides: {} } });
  assert.equal(group(), null);
  ai.set({ chat: { id: 'c', messages: [], overrides: {} }, running: { messageId: 'm', path: 'a.md', startedAt: 0 } });
  assert.equal(group(), null);
  ai.set({ running: null });
  assert.equal(group()!.querySelector('button'), first);
  el.remove();
});

test('no visible presets: no group', () => {
  const { el, ai, group } = mount();
  ai.set({ presets: [{ ...presets[0], hidden: true }] });
  assert.equal(group(), null);
  el.remove();
});

test('language change relabels; detached, the controller has no listener left', async () => {
  const { el, ai, i18n, group } = mount();
  await i18n.setLocale('it');
  assert.equal(group()!.getAttribute('aria-label'), 'SUGGERIMENTI');
  el.remove();
  assert.equal(ai.listeners(), 0);
});
