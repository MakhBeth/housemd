import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);

const OLLAMA: ModelProfile = defaultProfile('ollama', 'o');
const CLOUD: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud', secretId: 'secret-id-1' };
const KEYLESS: ModelProfile = { ...defaultProfile('anthropic', 'k'), name: 'Keyless' };

function mount(profiles: ModelProfile[] = [OLLAMA, CLOUD], profileId = 'o') {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.local': 'LOCALI', 'ai.profile': 'PROFILO' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ profiles, profileId });
  const el = document.createElement('hmd-ai-model-chip');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  let manage = 0;
  el.addEventListener('hmd-ai-manage', () => manage++);
  const chip = () => el.querySelector<HTMLButtonElement>('button.chip')!;
  const popover = () => el.querySelector<HTMLElement>('[popover]')!;
  /** L'evento `toggle` da solo (asincrono in Chromium: può arrivare quando lo stato è già un altro). */
  const toggleEvent = (newState: 'open' | 'closed') => popover().dispatchEvent(Object.assign(new Event('toggle'), { newState }));
  /** Apertura o chiusura vera: lo stato del popover, poi il suo evento. */
  const toggle = (newState: 'open' | 'closed') => {
    if (newState === 'open') popover().showPopover();
    else popover().hidePopover();
    toggleEvent(newState);
  };
  /** Richieste dell'elenco dei modelli fatte dai selettori del popover (attraverso il controller). */
  let lists = 0;
  (ai as unknown as { provider: () => Promise<unknown> }).provider = async () => {
    lists++;
    return { listModels: async () => null };
  };
  const radio = (name: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === name)?.querySelector('input') ?? null;
  const button = (key: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES[key as keyof typeof EN_MESSAGES])!;
  return { el, ai, i18n, listeners, chip, popover, toggle, toggleEvent, radio, button, manages: () => manage, lists: () => lists };
}

test('the same DOM as ModelChip.tsx: anchor span with the chip and its popover; parts in order, no model select while closed', () => {
  const { el, chip, popover } = mount();
  const anchor = el.firstElementChild!;
  assert.equal(anchor.localName, 'span');
  assert.equal(anchor.className, 'chipAnchor');
  assert.equal(chip().className, 'chip tooltip');
  assert.equal(chip().type, 'button');
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model}`);
  assert.equal(chip().getAttribute('aria-label'), `${EN_MESSAGES['ai.profile']}: ollama · ${OLLAMA.model}`);
  assert.equal(chip().getAttribute('data-tooltip'), EN_MESSAGES['ai.localPrivacy']);
  assert.equal(chip().getAttribute('popovertarget'), popover().id);
  assert.equal(chip().getAttribute('aria-describedby'), `${popover().id}-privacy`);
  assert.equal(popover().getAttribute('popover'), 'auto');
  assert.equal(popover().className, 'popover');
  assert.deepEqual([...popover().children].map((c) => c.localName), ['p', 'fieldset', 'fieldset', 'hmd-ai-parameters', 'div']);
  const note = popover().querySelector('p')!;
  assert.equal(note.id, `${popover().id}-privacy`);
  assert.equal(note.className, 'popoverNote');
  assert.equal(note.textContent, EN_MESSAGES['ai.localPrivacy']);
  assert.deepEqual([...popover().querySelectorAll('legend')].map((l) => l.textContent), [EN_MESSAGES['ai.local'], EN_MESSAGES['ai.cloud']]);
  assert.deepEqual([...popover().querySelectorAll('.popoverActions > button')].map((b) => b.textContent), [
    EN_MESSAGES['ai.saveProfile'], EN_MESSAGES['ai.saveAs'], EN_MESSAGES['ai.reset'], EN_MESSAGES['ai.manage'],
  ]);
  assert.equal(popover().querySelector('.popoverActions > button:last-child')!.className, 'link');
});

test('two chips get different popover ids; the radios share a group name per chip', () => {
  const first = mount();
  const second = mount();
  assert.notEqual(first.popover().id, second.popover().id);
  const names = new Set([...first.el.querySelectorAll<HTMLInputElement>('input[type=radio]')].map((r) => r.name));
  assert.deepEqual([...names], [`${first.popover().id}-profile`]);
});

test('profiles grouped local then cloud; the active one checked; a cloud profile without key marked ⚠', () => {
  const { radio } = mount([CLOUD, KEYLESS, OLLAMA], 'c');
  assert.equal(radio('ollama')!.checked, false);
  assert.equal(radio('Cloud')!.checked, true);
  assert.ok(radio('Keyless ⚠'));
});

test('choosing a profile selects it; the chip, the note and the radios follow', () => {
  const { ai, radio, chip } = mount();
  radio('Cloud')!.checked = true;
  radio('Cloud')!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.calls, [['selectProfile', 'c']]);
  assert.match(chip().getAttribute('aria-label')!, /: Cloud · /);
  assert.equal(chip().getAttribute('data-tooltip'), t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  assert.equal(radio('ollama')!.checked, false);
  assert.equal(radio('Cloud')!.checked, true);
});

test('an override puts the dot in the chip and reaches the parameters; Reset empties it', () => {
  const { el, ai, chip, button } = mount();
  ai.override({ temperature: 1 });
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model} •`);
  assert.deepEqual(el.querySelector('hmd-ai-parameters')!.value, { ...OLLAMA.params, temperature: 1 });
  assert.equal(el.querySelector('hmd-ai-parameters')!.hideEffort, true);
  button('ai.reset').click();
  assert.deepEqual(ai.overrides.at(-1), {});
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model}`);
});

test('a parameter changed in the popover overrides it, keeping the other overrides', () => {
  const { el, ai } = mount();
  ai.override({ model: 'llama3.2' });
  el.querySelector('hmd-ai-parameters')!.dispatchEvent(new CustomEvent('hmd-params-change', { detail: { params: { temperature: 0.7 } }, bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { model: 'llama3.2', temperature: 0.7 });
});

test('the model select is there only while the popover is open, a new one at each opening, with the effective profile', async () => {
  const { el, ai, popover, toggle } = mount();
  ai.override({ model: 'llama3.2' });
  toggle('open');
  const select = popover().querySelector('hmd-ai-model-select')!;
  assert.equal(select.nextElementSibling!.localName, 'hmd-ai-parameters');
  assert.equal(select.profile!.model, 'llama3.2');
  select.dispatchEvent(new CustomEvent('hmd-ai-model-change', { detail: { selection: { model: 'qwen3:8b', contextTokens: null } }, bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { model: 'qwen3:8b', contextTokens: null });
  toggle('closed');
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  toggle('open');
  assert.notEqual(popover().querySelector('hmd-ai-model-select'), select);
  await tick();
  el.remove();
});

test('Save profile, Save as new: the controller saves; a failure is reported', async () => {
  const { ai, button } = mount();
  button('ai.saveProfile').click();
  button('ai.saveAs').click();
  assert.deepEqual(ai.calls, [['saveOverrides', false], ['saveOverrides', true]]);
  const failure = { code: 'server' };
  (ai as unknown as { saveOverrides: () => Promise<void> }).saveOverrides = async () => Promise.reject(failure);
  button('ai.saveProfile').click();
  await tick();
  assert.deepEqual(ai.reports, [failure]);
});

test('Manage profiles… closes the popover and sends hmd-ai-manage; without a profile the chip itself does', async () => {
  const { el, popover, button, manages } = mount();
  popover().showPopover();
  button('ai.manage').click();
  assert.equal(popover().hasAttribute('data-test-popover-open'), false);
  assert.equal(manages(), 1);
  const empty = mount([], '');
  const only = empty.el.querySelector('button')!;
  assert.deepEqual([...empty.el.children].map((c) => c.localName), ['button']);
  assert.equal(only.className, 'chip');
  assert.equal(only.textContent, EN_MESSAGES['ai.manage']);
  only.click();
  assert.equal(empty.manages(), 1);
  el.remove();
});

test('profiles appearing and disappearing swap the manage chip and the anchor; the focus stays on the chip', () => {
  const { el, ai, chip } = mount([], '');
  const manage = el.querySelector('button')!;
  manage.focus();
  ai.set({ profiles: [OLLAMA], profileId: 'o' });
  assert.equal(el.firstElementChild!.className, 'chipAnchor');
  assert.equal(document.activeElement, chip());
  ai.set({ profiles: [], profileId: '' });
  assert.equal(el.firstElementChild, manage);
  assert.equal(document.activeElement, manage);
});

test('the focused radio of a profile that goes away: the focus goes to the chip (decision 3)', () => {
  const { ai, radio, chip } = mount();
  radio('Cloud')!.focus();
  ai.set({ profiles: [OLLAMA] });
  assert.equal(radio('Cloud'), null);
  assert.equal(document.activeElement, chip());
});

test('a late toggle that says open while the popover is closed mounts nothing and asks nothing', async () => {
  const { popover, toggle, toggleEvent, lists } = mount();
  // Staccato e ricollegato prima del task dell'evento: il popover è chiuso, l'evento dice ancora «open».
  toggleEvent('open');
  await tick();
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  assert.equal(lists(), 0);
  toggle('open');
  await tick();
  assert.ok(popover().querySelector('hmd-ai-model-select'));
  assert.equal(lists(), 1);
  // E il contrario: un «closed» in ritardo con il popover di nuovo aperto non toglie il selettore.
  toggleEvent('closed');
  assert.ok(popover().querySelector('hmd-ai-model-select'));
});

test('profiles gone and back with the popover open: the model select is not reattached and asks nothing more', async () => {
  const { ai, popover, toggle, lists } = mount();
  toggle('open');
  await tick();
  assert.equal(lists(), 1);
  ai.set({ profiles: [], profileId: '' });
  ai.set({ profiles: [OLLAMA, CLOUD], profileId: 'o' });
  await tick();
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  assert.equal(lists(), 1);
});

test('detached with the popover open and attached again: no model select until it opens again', () => {
  const { el, popover, toggle } = mount();
  toggle('open');
  assert.ok(popover().querySelector('hmd-ai-model-select'));
  el.remove();
  document.body.append(el);
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
});

test('the saved key id never reaches the DOM', () => {
  const { el, toggle } = mount([OLLAMA, CLOUD], 'c');
  toggle('open');
  assert.ok(!el.outerHTML.includes('secret-id-1'));
});

test('language change relabels the chip and the popover; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, chip, popover } = mount();
  await i18n.setLocale('it');
  assert.match(chip().getAttribute('aria-label')!, /^PROFILO: /);
  assert.equal(popover().querySelector('legend')!.textContent, 'LOCALI');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
