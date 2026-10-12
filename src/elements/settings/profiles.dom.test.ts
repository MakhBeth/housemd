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

test('a cloud profile: the key field, Remember, the notice and Save key; no button is ever disabled; the Anthropic url is read-only and described by the help', () => {
  const { el, button, field } = mount();
  button('Cloud')!.click();
  const url = field(EN_MESSAGES['ai.url'])!;
  assert.equal(url.disabled, false);
  assert.equal(url.readOnly, true);
  const help = el.querySelector<HTMLElement>(`#${url.getAttribute('aria-describedby')}`)!;
  assert.equal(help.textContent, EN_MESSAGES['ai.help.anthropic']);
  const key = field(EN_MESSAGES['ai.secret'])!;
  assert.equal(key.type, 'password');
  assert.equal(key.autocomplete, 'off');
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.disabled, false);
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.hasAttribute('aria-disabled'), false);
  // La chiave non finisce mai in un attributo.
  type(key, 'sk-test');
  assert.ok(!el.outerHTML.includes('sk-test'));
});

test('the url is editable again for a provider other than Anthropic, and loses the description', () => {
  const { button, field } = mount();
  button('Cloud')!.click();
  const provider = field(EN_MESSAGES['ai.provider'])! as unknown as HTMLSelectElement;
  provider.value = 'openai-compatible';
  provider.dispatchEvent(new Event('change', { bubbles: true }));
  const url = field(EN_MESSAGES['ai.url'])!;
  assert.equal(url.readOnly, false);
  assert.equal(url.hasAttribute('aria-describedby'), false);
});

test('Save key with an empty field says why in a status right after the button; no call, the focus stays; the note empties when a key is typed', async () => {
  const { el, button, field, secrets } = mount();
  button('Cloud')!.click();
  const save = button(EN_MESSAGES['ai.saveSecret'])!;
  assert.equal(el.querySelector('.detail > p.note'), null, 'la nota entra su richiesta');
  save.focus();
  save.click();
  const note = () => el.querySelector<HTMLElement>('.detail > p.note[role="status"]')!;
  assert.equal(save.nextElementSibling, note());
  await waitFor(() => note().textContent === EN_MESSAGES['ai.saveSecret.needKey']);
  assert.equal(secrets.length, 0);
  assert.equal(document.activeElement, save);
  // Un altro clic la ri-annuncia: si svuota e torna.
  save.click();
  assert.equal(note().textContent, '');
  await waitFor(() => note().textContent === EN_MESSAGES['ai.saveSecret.needKey']);
  type(field(EN_MESSAGES['ai.secret'])!, 's');
  assert.equal(el.querySelector('.detail > p.note'), null);
  assert.equal(document.activeElement, save);
});

test('the Save key note goes away when the profile or the provider changes', async () => {
  const { el, button, field } = mount();
  button('Cloud')!.click();
  button(EN_MESSAGES['ai.saveSecret'])!.click();
  const note = () => el.querySelector<HTMLElement>('.detail > p.note[role="status"]');
  await waitFor(() => note()?.textContent === EN_MESSAGES['ai.saveSecret.needKey']);
  const provider = field(EN_MESSAGES['ai.provider'])! as unknown as HTMLSelectElement;
  provider.value = 'openai-compatible';
  provider.dispatchEvent(new Event('change', { bubbles: true }));
  assert.ok(!note() || note()!.textContent === '');
  button(EN_MESSAGES['ai.saveSecret'])!.click();
  await waitFor(() => note()?.textContent === EN_MESSAGES['ai.saveSecret.needKey']);
  button('ollama')!.click();
  assert.equal(note(), null);
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

test('Connection: «Connected» as a status only after a good answer, entering empty and written a frame later; an unreachable server is reported', async () => {
  const { el, ai, button, down } = mount();
  button('ollama')!.click();
  // Il testo della regione a ogni mutazione: entra vuota e il testo arriva dopo, come una mutazione che lo
  // screen reader legge (LAB-42 P8).
  const seen: string[] = [];
  new MutationObserver(() => {
    const status = el.querySelector('[role="status"]');
    if (status && seen.at(-1) !== status.textContent) seen.push(status.textContent!);
  }).observe(el, { subtree: true, childList: true, characterData: true });
  button(EN_MESSAGES['ai.connection'])!.click();
  await waitFor(() => el.querySelector('[role="status"]')?.textContent === EN_MESSAGES['ai.connected']);
  assert.deepEqual(seen, ['', EN_MESSAGES['ai.connected']]);
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

test('Delete asks first; once the profile is gone the focus goes to the first item, not the body', async () => {
  const { el, button } = mount();
  const items = () => [...el.querySelectorAll<HTMLButtonElement>('.list > button')];
  items()[1].click();
  const remove = button(EN_MESSAGES['ai.delete'])!;
  remove.click();
  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.delete'])!.click();
  // Chiuso il dialog, il browser ridà il focus a chi l'aveva aperto (lo stub di jsdom no).
  remove.focus();
  await waitFor(() => el.querySelector('.detail') === null);
  assert.ok(document.activeElement === items()[0], `the first item, not ${document.activeElement?.localName}`);
});
