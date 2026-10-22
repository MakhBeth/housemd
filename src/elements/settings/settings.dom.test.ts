import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { builtInPresets } from '../../ai/presets';
import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createThemeStore } from '../../state/themeStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
installPopoverStub();
test.afterEach(() => document.body.replaceChildren());

/** jsdom non scorre: si registra quale sezione è stata portata in vista. */
const scrolled: string[] = [];
window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
  scrolled.push(this.id);
};

const IT = { ...EN_MESSAGES, 'settings.title': 'Impostazioni' };

function mount(options: { ai?: boolean } = {}) {
  const loaded: string[] = [];
  const { store: i18n, listeners } = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => (loaded.push(locale), { locale, messages: locale === 'it' ? IT : EN_MESSAGES }), persist() {} }),
  );
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const ai = fakeAi({ profiles: [defaultProfile()], presets: [builtInPresets()[0]] } as Partial<AiState>);
  Object.assign(ai, { reload: async () => {}, store: { getMeta: async () => null, setMeta: async () => {} } });
  const el = document.createElement('hmd-settings');
  el.section = 'general';
  el.ai = options.ai ? (ai as never) : null;
  el.syncBinding = null;
  el.theme = theme;
  el.autosave = { mode: 'afterDelay', delayMs: 1000 };
  el.textWidth = { editor: null, preview: 72 };
  el.i18n = i18n;
  scrolled.length = 0;
  document.body.append(el);
  const events: [string, unknown][] = [];
  for (const type of ['hmd-settings-section', 'hmd-settings-close', 'hmd-settings-autosave', 'hmd-settings-text-width', 'hmd-settings-focus', 'hmd-settings-save-all'] as const) {
    el.addEventListener(type, (event) => events.push([type, event.detail]));
  }
  const field = (label: string) => [...el.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)!.querySelector('input, select') as HTMLInputElement;
  const radio = (text: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === text)!.querySelector('input')!;
  const close = () => el.querySelector<HTMLButtonElement>('.navHeader button')!;
  return { el, i18n, theme, ai, listeners, loaded, events, field, radio, close };
}

test('the same DOM as SettingsView.tsx: a region with the index and the general section; the focus goes to the title', () => {
  const { el } = mount();
  const view = el.firstElementChild!;
  assert.equal(view.getAttribute('role'), 'region');
  assert.equal(view.getAttribute('aria-label'), EN_MESSAGES['settings.title']);
  assert.deepEqual([...view.children].map((c) => `${c.localName}.${c.className}`), ['nav.nav', 'div.content']);
  const nav = view.firstElementChild!;
  assert.deepEqual([...nav.children].map((c) => c.localName), ['div', 'a']);
  assert.equal(nav.querySelector('a')!.getAttribute('href'), '#settings');
  assert.equal(nav.querySelector('a')!.getAttribute('aria-current'), 'true');
  const general = el.querySelector('#settings-general')!;
  assert.deepEqual([...general.children].map((c) => c.localName), ['h2', 'label', 'fieldset', 'fieldset', 'fieldset', 'fieldset', 'button']);
  assert.ok(document.activeElement === el.querySelector('h1'), 'focus on the title');
});

test('with the AI controller: four links and the three AI sections with their elements, in order', () => {
  const { el } = mount({ ai: true });
  assert.deepEqual([...el.querySelectorAll('nav a')].map((a) => a.getAttribute('href')), ['#settings', '#settings/ai-profiles', '#settings/ai-presets', '#settings/ai-sync']);
  assert.deepEqual([...el.querySelectorAll('.content > section')].map((s) => s.id), ['settings-general', 'settings-ai-profiles', 'settings-ai-presets', 'settings-ai-sync']);
  assert.deepEqual([...el.querySelectorAll('.content > section > :last-child')].slice(1).map((c) => c.localName), ['hmd-settings-profiles', 'hmd-settings-presets', 'hmd-settings-sync']);
});

test('the section of the route is scrolled into view, again when it changes; a link asks for its section and scrolls', () => {
  const { el, events } = mount({ ai: true });
  assert.deepEqual(scrolled, ['settings-general']);
  el.section = 'ai-sync';
  assert.deepEqual(scrolled, ['settings-general', 'settings-ai-sync']);
  el.querySelectorAll<HTMLAnchorElement>('nav a')[2].click();
  assert.deepEqual(events, [['hmd-settings-section', { section: 'ai-presets' }]]);
  assert.equal(scrolled.at(-1), 'settings-ai-presets');
});

test('language and theme go straight to their stores; the radios and the select follow them', async () => {
  const { field, radio, theme, loaded, i18n, el } = mount();
  const language = field(EN_MESSAGES['settings.language']) as unknown as HTMLSelectElement;
  language.value = 'it';
  language.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => i18n.getState().locale === 'it');
  assert.deepEqual(loaded, ['it']);
  assert.equal(el.firstElementChild!.getAttribute('aria-label'), 'Impostazioni');
  radio(EN_MESSAGES['theme.option.dark']).click();
  assert.equal(theme.getState(), 'dark');
  assert.equal(radio(EN_MESSAGES['theme.option.dark']).checked, true);
});

test('autosave: a mode is an event; the delay field shows only for afterDelay and is committed on Enter and blur, clamped', () => {
  const { el, field, radio, events } = mount();
  const delay = field(EN_MESSAGES['settings.delay']);
  delay.value = '50';
  delay.dispatchEvent(new Event('input', { bubbles: true }));
  delay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(delay.value, '500');
  assert.deepEqual(events, [['hmd-settings-autosave', { autosave: { mode: 'afterDelay', delayMs: 500 } }]]);
  radio(EN_MESSAGES['settings.autosave.off']).click();
  assert.deepEqual(events.at(-1), ['hmd-settings-autosave', { autosave: { mode: 'off', delayMs: 1000 } }]);
  el.autosave = { mode: 'off', delayMs: 1000 };
  assert.ok(!el.textContent!.includes(EN_MESSAGES['settings.delay']));
});

test('closing commits both width fields, then closes; Save all is an event', () => {
  const { field, close, events, el } = mount();
  const editor = field(EN_MESSAGES['settings.textWidth.editor']);
  editor.value = '10';
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  close().click();
  assert.deepEqual(events, [
    ['hmd-settings-text-width', { textWidth: { editor: 30, preview: 72 } }],
    ['hmd-settings-close', null],
  ]);
  assert.equal(editor.value, '30');
  [...el.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['settings.saveAll'])!.click();
  assert.deepEqual(events.at(-1), ['hmd-settings-save-all', null]);
});

test('with a dirty section, closing (✕, Esc, requestClose) asks once; Discard clears dirty and closes', async () => {
  const { el, close, events } = mount({ ai: true });
  const presets = el.querySelector('hmd-settings-presets')!;
  presets.querySelector<HTMLButtonElement>('.list button')!.click();
  const name = presets.querySelector<HTMLInputElement>('.detail input')!;
  name.value = 'Changed';
  name.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(el.dirty, true);
  close().click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  el.requestClose();
  assert.equal(document.querySelectorAll('dialog').length, 1);
  assert.deepEqual(events, []);
  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.discardChanges'])!.click();
  await waitFor(() => events.length === 1);
  assert.deepEqual(events, [['hmd-settings-close', null]]);
  assert.equal(el.dirty, false);
});

test('detached: no keydown listener left (Esc does nothing), the dialog closes, the stores are free', async () => {
  const { el, listeners, events } = mount({ ai: true });
  el.remove();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(events, []);
  assert.equal(listeners(), 0);
});

test('Esc that opens the confirmation is consumed: the same key press does not close the new dialog', () => {
  const { el } = mount({ ai: true });
  const presets = el.querySelector('hmd-settings-presets')!;
  presets.querySelector<HTMLButtonElement>('.list button')!.click();
  const name = presets.querySelector<HTMLInputElement>('.detail input')!;
  name.value = 'Changed';
  name.dispatchEvent(new Event('input', { bubbles: true }));
  const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  window.dispatchEvent(esc);
  assert.equal(esc.defaultPrevented, true, 'Chrome would use the same Esc to close the dialog just opened');
  assert.equal(document.querySelectorAll('dialog[open]').length, 1);
  // Senza modifiche Esc chiude e basta: anche lì il tasto è consumato.
});

test('every section is a region named by its h2; the width hint describes both width fields', () => {
  const { el, field } = mount({ ai: true });
  for (const section of el.querySelectorAll<HTMLElement>('.content > section')) {
    const h2 = section.querySelector('h2')!;
    assert.ok(h2.id, `${section.id}: the h2 has an id`);
    assert.equal(section.getAttribute('aria-labelledby'), h2.id, section.id);
  }
  const hint = el.querySelector<HTMLElement>('.hint')!;
  for (const key of ['settings.textWidth.editor', 'settings.textWidth.preview'] as const) assert.equal(field(EN_MESSAGES[key]).getAttribute('aria-describedby'), hint.id, key);
});

test('a link activated from the keyboard scrolls to its section and moves the focus to the section title', () => {
  const { el } = mount({ ai: true });
  const link = el.querySelectorAll<HTMLAnchorElement>('nav a')[3];
  link.focus();
  link.click();
  const h2 = el.querySelector('#settings-ai-sync h2')!;
  assert.equal(h2.getAttribute('tabindex'), '-1');
  assert.ok(document.activeElement === h2, `the Sync title, not ${document.activeElement?.localName}`);
});

test('the Writing group: the focus checkbox, two always-active unit radios, the hint that describes the group', () => {
  const { el, events } = mount();
  const group = el.querySelector('fieldset[aria-describedby="settings-writing-hint"]')!;
  assert.equal(group.querySelector('legend')!.textContent, EN_MESSAGES['settings.writing']);
  assert.equal(document.getElementById('settings-writing-hint')!.textContent, EN_MESSAGES['settings.writing.hint']);
  const checkbox = group.querySelector<HTMLInputElement>('input[type=checkbox]')!;
  const radios = [...group.querySelectorAll<HTMLInputElement>('input[name=focusUnit]')];
  assert.deepEqual(radios.map((r) => r.value), ['paragraph', 'sentence']);
  assert.equal(checkbox.checked, false);
  assert.ok(radios.every((r) => !r.disabled), 'the radios are active even when the focus is off');
  assert.equal(radios[0].checked, true);
  radios[1].click();
  checkbox.click();
  assert.deepEqual(events, [
    ['hmd-settings-focus', { focus: false, unit: 'sentence' }],
    ['hmd-settings-focus', { focus: true, unit: 'paragraph' }],
  ]);
  el.writing = { focus: true, unit: 'sentence' };
  assert.equal(checkbox.checked, true);
  assert.equal(radios[1].checked, true);
});
