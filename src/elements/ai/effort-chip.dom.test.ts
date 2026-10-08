import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { fakeAi } from '../../testing/fakeAi';

function mount(kind: 'anthropic' | 'ollama' = 'anthropic') {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.default': 'PREDEFINITO' } }), persist() {} });
  const ai = fakeAi({}, defaultProfile(kind, 'p'));
  const el = document.createElement('hmd-ai-effort-chip');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  return { el, ai, i18n, select: () => el.querySelector('select') };
}

test('a labelled chip select with Default and the five levels', () => {
  const { el, select } = mount();
  assert.equal(select()!.className, 'chip');
  assert.equal(select()!.getAttribute('aria-label'), EN_MESSAGES['ai.param.effort']);
  assert.deepEqual([...select()!.options].map((o) => [o.value, o.textContent]), [
    ['', EN_MESSAGES['ai.default']], ['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['xhigh', 'xhigh'], ['max', 'max'],
  ]);
  assert.equal(select()!.value, '');
  el.remove();
});

test('no chip for a profile without effort', () => {
  const { el, select } = mount('ollama');
  assert.equal(select(), null);
  el.remove();
});

test('choosing a level overrides the effort, keeping the other overrides; Default removes it', () => {
  const { el, ai, select } = mount();
  ai.set({ chat: { id: 'c', messages: [], overrides: { temperature: 0.3 } } });
  select()!.value = 'high';
  select()!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { temperature: 0.3, effort: 'high' });
  select()!.value = '';
  select()!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { temperature: 0.3, effort: undefined });
  el.remove();
});

test('store updates keep the same select and follow the override', () => {
  const { el, ai, select } = mount();
  const node = select();
  ai.set({ chat: { id: 'c', messages: [], overrides: { effort: 'max' } } });
  assert.equal(select(), node);
  assert.equal(node!.value, 'max');
  el.remove();
});

test('language change relabels Default; detached, no listener left', async () => {
  const { el, ai, i18n, select } = mount();
  await i18n.setLocale('it');
  assert.equal(select()!.options[0].textContent, 'PREDEFINITO');
  el.remove();
  assert.equal(ai.listeners(), 0);
});
