import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';

function mount() {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'conflict.reload': 'RICARICA' } }),
    persist() {},
  });
  const el = document.createElement('hmd-conflict-bar');
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n };
}

test('an alert with the message and the two choices', () => {
  const { el } = mount();
  const alert = el.querySelector('[role="alert"]')!;
  assert.match(alert.textContent!, new RegExp(EN_MESSAGES['conflict.message'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual([...alert.querySelectorAll('button')].map((b) => b.textContent), [EN_MESSAGES['conflict.reload'], EN_MESSAGES['conflict.overwrite']]);
  assert.ok(alert.querySelector('.icon'));
  el.remove();
});

test('each button sends hmd-conflict with its choice', () => {
  const { el } = mount();
  const choices: string[] = [];
  el.addEventListener('hmd-conflict', (event) => choices.push(event.detail.choice));
  const [reload, overwrite] = el.querySelectorAll('button');
  reload.click();
  overwrite.click();
  assert.deepEqual(choices, ['reload', 'overwrite']);
  el.remove();
});

test('a language change relabels the buttons without recreating them', async () => {
  const { el, i18n } = mount();
  const reload = el.querySelector('button')!;
  await i18n.setLocale('it');
  assert.equal(el.querySelector('button'), reload);
  assert.equal(reload.textContent, 'RICARICA');
  el.remove();
});

test('detached, a language change no longer relabels the buttons', async () => {
  const { el, i18n } = mount();
  const reload = el.querySelector('button')!;
  el.remove();
  await i18n.setLocale('it');
  assert.equal(reload.textContent, EN_MESSAGES['conflict.reload']);
});

test('a new i18n store while connected keeps the buttons and relabels from the new store', () => {
  const { el } = mount();
  const buttons = [...el.querySelectorAll('button')];
  const other = createI18nStore({
    locale: 'en',
    messages: { ...EN_MESSAGES, 'conflict.reload': 'ALTRO', 'conflict.overwrite': 'SOVRASCRIVI' },
    load: async (locale) => ({ locale, messages: EN_MESSAGES }),
    persist() {},
  });
  el.i18n = other;
  assert.deepEqual([...el.querySelectorAll('button')], buttons);
  assert.deepEqual(buttons.map((b) => b.textContent), ['ALTRO', 'SOVRASCRIVI']);
  el.remove();
});
