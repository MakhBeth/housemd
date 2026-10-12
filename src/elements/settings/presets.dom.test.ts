import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { builtInPresets } from '../../ai/presets';
import type { PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
test.afterEach(() => document.body.replaceChildren());

const MINE: PromptPreset = { ...builtInPresets()[0], id: 'mine', builtInId: undefined, name: 'Mine', instructions: 'do it', order: 5 };
const BUILT_IN: PromptPreset = { ...builtInPresets()[0], order: 1 };

function mount(presets: PromptPreset[] = [MINE, BUILT_IN]) {
  const { store: i18n, listeners } = countListeners(createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} }));
  const ai = fakeAi({ presets } as Partial<AiState>);
  const saved: PromptPreset[] = [];
  const deleted: string[] = [];
  Object.assign(ai, {
    savePreset: async (p: PromptPreset) => void saved.push(p),
    deletePreset: async (id: string) => void deleted.push(id),
  });
  const el = document.createElement('hmd-settings-presets');
  el.controller = ai as never;
  el.i18n = i18n;
  document.body.append(el);
  const dirty: boolean[] = [];
  el.addEventListener('hmd-settings-dirty', (event) => dirty.push(event.detail.dirty));
  const items = () => [...el.querySelectorAll<HTMLButtonElement>('.list > button')];
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!;
  const name = () => el.querySelector<HTMLInputElement>('.detail input')!;
  return { el, ai, i18n, listeners, saved, deleted, dirty, items, button, name };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('the same DOM as the React section: a split with the sorted list and + Create, no detail until one is opened', () => {
  const { el, items } = mount();
  const split = el.firstElementChild!;
  assert.equal(split.className, 'split');
  assert.deepEqual([...split.children].map((c) => c.className), ['list']);
  assert.deepEqual(items().map((b) => b.textContent), [EN_MESSAGES[`ai.preset.${BUILT_IN.builtInId}` as keyof typeof EN_MESSAGES] ?? BUILT_IN.name, 'Mine', `+ ${EN_MESSAGES['ai.create']}`]);
  assert.equal(items().at(-1)!.className, 'create');
});

test('opening a preset shows its detail in the order of the React form; the open item is aria-current', () => {
  const { el, items, name } = mount();
  items()[1].click();
  const detail = el.querySelector('.detail')!;
  assert.deepEqual([...detail.children].map((c) => c.localName), ['label', 'label', 'label', 'label', 'label', 'label', 'label', 'hmd-ai-parameters', 'div']);
  assert.equal(name().value, 'Mine');
  assert.equal(items()[1].getAttribute('aria-current'), 'true');
  assert.equal(items()[0].hasAttribute('aria-current'), false);
  // Un preset suo: Elimina; uno predefinito: Ripristina l'originale, nello stesso posto.
  assert.deepEqual([...detail.querySelectorAll('.actions button')].map((b) => b.textContent), [EN_MESSAGES['ai.duplicate'], EN_MESSAGES['ai.delete'], EN_MESSAGES['ai.save']]);
  items()[0].click();
  assert.deepEqual([...detail.querySelectorAll('.actions button')].map((b) => b.textContent), [EN_MESSAGES['ai.duplicate'], EN_MESSAGES['ai.restoreOriginal'], EN_MESSAGES['ai.save']]);
});

test('typing makes the draft dirty (one event), the focused field is never rewritten, Save makes it clean again', async () => {
  const { el, items, name, dirty, saved, button } = mount();
  items()[1].click();
  name().focus();
  type(name(), 'Mine 2');
  type(name(), 'Mine 23');
  assert.deepEqual(dirty, [true]);
  assert.equal(el.dirty, true);
  assert.equal(name().value, 'Mine 23');
  button(EN_MESSAGES['ai.save']).click();
  await waitFor(() => saved.length === 1);
  assert.equal(saved[0].name, 'Mine 23');
  await waitFor(() => dirty.length === 2);
  assert.deepEqual(dirty, [true, false]);
});

test('switching with unsaved changes asks first: Cancel keeps the draft, Discard opens the other preset', async () => {
  const { items, name, button } = mount();
  items()[1].click();
  type(name(), 'Draft');
  items()[0].click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.open);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['dialog.cancel'])!.click();
  await waitFor(() => document.querySelector('dialog') === null);
  assert.equal(name().value, 'Draft');
  items()[0].click();
  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.discardChanges'])!.click();
  await waitFor(() => name().value !== 'Draft');
  assert.ok(button(EN_MESSAGES['ai.restoreOriginal']));
});

test('Delete asks first and removes the preset; the detail goes away', async () => {
  const { el, items, button, deleted } = mount();
  items()[1].click();
  button(EN_MESSAGES['ai.delete']).click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.textContent!.includes(EN_MESSAGES['ai.deleteMessage']));
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.delete'])!.click();
  await waitFor(() => deleted.length === 1);
  assert.deepEqual(deleted, ['mine']);
  await waitFor(() => el.querySelector('.detail') === null);
});

test('detached: the confirmation closes, the store and language listeners are gone', async () => {
  const { el, ai, listeners, items, name } = mount();
  items()[1].click();
  type(name(), 'Draft');
  items()[0].click();
  assert.ok(document.querySelector('dialog'));
  el.remove();
  await waitFor(() => document.querySelector('dialog') === null);
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
