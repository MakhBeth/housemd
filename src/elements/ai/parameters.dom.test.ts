import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { GenParams } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';

function mount(kind: 'anthropic' | 'ollama' = 'ollama', value: GenParams = {}, hideEffort = false) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.param.topP': 'TOP P' } }), persist() {} });
  const el = document.createElement('hmd-ai-parameters');
  el.profile = defaultProfile(kind, 'p');
  el.value = value;
  el.hideEffort = hideEffort;
  el.i18n = i18n;
  document.body.append(el);
  const changes: GenParams[] = [];
  el.addEventListener('hmd-params-change', (event) => changes.push(event.detail.params));
  const input = (name: string) => [...el.querySelectorAll('label')].find((l) => l.querySelector('span')!.textContent === name)!.querySelector('input')!;
  return { el, i18n, changes, input };
}

test('a section with one label per field: span text and a number input with its limits', () => {
  const { el } = mount('ollama', { temperature: 0.7 });
  const section = el.firstElementChild!;
  assert.equal(section.className, 'section');
  assert.deepEqual([...section.querySelectorAll('label')].map((l) => {
    const i = l.querySelector('input')!;
    return [l.querySelector('span')!.textContent, i.type, i.min, i.max, i.step, i.value];
  }), [
    [EN_MESSAGES['ai.param.temperature'], 'number', '0', '2', '0.1', '0.7'],
    [EN_MESSAGES['ai.param.topP'], 'number', '0', '1', '0.1', ''],
    [EN_MESSAGES['ai.param.maxOutputTokens'], 'number', '1', '', '1', ''],
    [EN_MESSAGES['ai.param.chunkChars'], 'number', '1', '', '1', ''],
  ]);
  el.remove();
});

test('typing sends the new params; an empty field removes the key', () => {
  const { el, changes, input } = mount('ollama', { temperature: 0.7, topP: 0.9 });
  const t = input(EN_MESSAGES['ai.param.temperature']);
  t.value = '1.2';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  t.value = '';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(changes, [{ temperature: 1.2, topP: 0.9 }, { temperature: undefined, topP: 0.9 }]);
  el.remove();
});

test('a new value object with the same number does not rewrite the text the user typed ("1.50")', () => {
  const { el, input } = mount('ollama', { topP: 1.5 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  p.value = '1.50';
  // React ripassa un oggetto nuovo a ogni render: lo stesso numero non deve toccare il campo.
  el.value = { topP: 1.5 };
  assert.equal(p.value, '1.50');
  el.value = { topP: 0.4 };
  assert.equal(p.value, '0.4');
  el.value = {};
  assert.equal(p.value, '');
  el.remove();
});

test('a number the input cannot parse sends the parameter removed, and getting undefined back writes nothing', () => {
  const { el, changes, input } = mount('ollama', { topP: 0.9 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  // jsdom, come Chromium, espone value "" per un numero non valido mentre si scrive ("0."): il testo
  // visibile resta solo se l'elemento non riscrive il campo. Qui si contano le scritture su `value`
  // (che il testo resti lo verifica in Chromium l'e2e «typing a partial number keeps the text»).
  p.value = '';
  p.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(changes.at(-1), { topP: undefined });
  const proto = Object.getPrototypeOf(p) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')!;
  let writes = 0;
  Object.defineProperty(p, 'value', { configurable: true, get: () => desc.get!.call(p), set: (v: string) => { writes++; desc.set!.call(p, v); } });
  el.value = { topP: undefined };
  assert.equal(writes, 0);
  el.remove();
});

test('the inputs stay the same nodes across value updates and profile changes with the same fields', () => {
  const { el, input } = mount('ollama');
  const t = input(EN_MESSAGES['ai.param.temperature']);
  el.value = { temperature: 1 };
  el.profile = { ...defaultProfile('ollama', 'other') };
  assert.equal(input(EN_MESSAGES['ai.param.temperature']), t);
  el.remove();
});

test('effort: a select at the end for profiles that support it, unless hidden', () => {
  const shown = mount('anthropic', { effort: 'high' });
  const label = [...shown.el.querySelectorAll('label')].at(-1)!;
  assert.equal(label.querySelector('span')!.textContent, EN_MESSAGES['ai.param.effort']);
  const select = label.querySelector('select')!;
  assert.deepEqual([...select.options].map((o) => o.value), ['', 'low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(select.options[0].textContent, EN_MESSAGES['ai.default']);
  assert.equal(select.value, 'high');
  select.value = '';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(shown.changes.at(-1), { effort: undefined });
  shown.el.remove();
  const hidden = mount('anthropic', {}, true);
  assert.equal(hidden.el.querySelector('select'), null);
  hidden.el.remove();
});

test('language change relabels in place', async () => {
  const { el, i18n } = mount();
  const span = el.querySelectorAll('label span')[1];
  await i18n.setLocale('it');
  assert.equal(el.querySelectorAll('label span')[1], span);
  assert.equal(span.textContent, 'TOP P');
  el.remove();
});

test('a value changed from outside while the field has focus shows up once the focus leaves', async () => {
  const { el, input } = mount('ollama', { topP: 0.5 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  p.focus();
  assert.equal(document.activeElement, p);
  el.value = { topP: 0.9 };
  assert.equal(p.value, '0.5');
  p.blur();
  // Il render del focusout è rimandato a un microtask: non rientra mai in una riconciliazione in corso.
  assert.equal(p.value, '0.5');
  await Promise.resolve();
  assert.equal(p.value, '0.9');
  el.remove();
});

test('a focusout that arrives while the element is being removed does not render afterwards', async () => {
  const { el, input } = mount('ollama', { topP: 0.5 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  p.focus();
  el.value = { topP: 0.9 };
  p.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.remove();
  await Promise.resolve();
  assert.equal(p.value, '0.5');
});
