import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { ChatProvider, ModelProfile } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
installPopoverStub();
test.afterEach(() => document.body.replaceChildren());

const OLLAMA = defaultProfile('ollama', 'o');
const CLOUD: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud' };

function mount() {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const ai = fakeAi({ profiles: [OLLAMA, CLOUD] } as Partial<AiState>);
  const secrets: unknown[][] = [];
  const saved: ModelProfile[] = [];
  let connection: 'ok' | 'down' = 'ok';
  Object.assign(ai, {
    setSecret: async (...args: unknown[]) => void secrets.push(args),
    saveProfile: async (p: ModelProfile) => void saved.push(p),
    deleteProfile: async () => {},
    provider: async () => ({ listModels: async () => (connection === 'ok' ? [] : null) }) as unknown as ChatProvider,
  });
  const el = document.createElement('hmd-settings-profiles');
  el.controller = ai as never;
  el.i18n = i18n;
  document.body.append(el);
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label);
  const field = (label: string) => ([...el.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)?.querySelector('input, select') ?? null) as HTMLInputElement | null;
  return { el, ai, secrets, saved, button, field, down: () => (connection = 'down') };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('a local profile: name, provider, url, help, model, parameters, context, effort and the actions; no key field', () => {
  const { el, button, field } = mount();
  button('ollama')!.click();
  const detail = el.querySelector('.detail')!;
  assert.deepEqual([...detail.children].map((c) => c.localName), ['label', 'label', 'label', 'p', 'hmd-ai-model-select', 'hmd-ai-parameters', 'label', 'label', 'div']);
  assert.equal(field(EN_MESSAGES['ai.provider'])!.value, 'ollama');
  assert.equal(field(EN_MESSAGES['ai.secret']), null);
  assert.equal(el.querySelector('hmd-ai-model-select')!.profile?.id, 'o');
});

test('a cloud profile: the key field, Remember, the notice and Save key (off while the field is empty); the url is off for Anthropic', () => {
  const { el, button, field } = mount();
  button('Cloud')!.click();
  assert.equal(field(EN_MESSAGES['ai.url'])!.disabled, true);
  const key = field(EN_MESSAGES['ai.secret'])!;
  assert.equal(key.type, 'password');
  assert.equal(key.autocomplete, 'off');
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.disabled, true);
  type(key, 'sk-test');
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.disabled, false);
  // La chiave non finisce mai in un attributo.
  assert.ok(!el.outerHTML.includes('sk-test'));
});

test('Save key hands the key to the controller once and empties the field', async () => {
  const { button, field, secrets } = mount();
  button('Cloud')!.click();
  type(field(EN_MESSAGES['ai.secret'])!, 'sk-test');
  button(EN_MESSAGES['ai.saveSecret'])!.click();
  await waitFor(() => secrets.length === 1);
  assert.equal(secrets[0][1], 'sk-test');
  assert.equal(secrets[0][2], false);
  await waitFor(() => field(EN_MESSAGES['ai.secret'])!.value === '');
});

test('changing provider sets its default url and forgets the typed key', () => {
  const { button, field } = mount();
  button('Cloud')!.click();
  type(field(EN_MESSAGES['ai.secret'])!, 'sk-test');
  const provider = field(EN_MESSAGES['ai.provider'])! as unknown as HTMLSelectElement;
  provider.value = 'openai-compatible';
  provider.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(field(EN_MESSAGES['ai.url'])!.value, 'https://api.openai.com');
  assert.equal(field(EN_MESSAGES['ai.secret'])!.value, '');
});

test('Connection: «Connected» as a status only after a good answer; an unreachable server is reported', async () => {
  const { el, ai, button, down } = mount();
  button('ollama')!.click();
  button(EN_MESSAGES['ai.connection'])!.click();
  await waitFor(() => el.querySelector('[role="status"]') !== null);
  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['ai.connected']);
  down();
  button(EN_MESSAGES['ai.connection'])!.click();
  assert.equal(el.querySelector('[role="status"]'), null);
  await waitFor(() => ai.reports.length === 1);
  assert.deepEqual(ai.reports, [{ code: 'unreachable' }]);
});

test('Save validates the profile and makes the draft clean', async () => {
  const { el, button, field, saved } = mount();
  button('ollama')!.click();
  type(field(EN_MESSAGES['ai.name'])!, 'Local');
  assert.equal(el.dirty, true);
  button(EN_MESSAGES['ai.save'])!.click();
  await waitFor(() => saved.length === 1 && !el.dirty);
  assert.equal(saved[0].name, 'Local');
});
