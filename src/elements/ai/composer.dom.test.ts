import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { AiState } from '../../ai/aiController';
import type { PromptPreset, SelectionScope } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const TEXT = 'uno\ndue\ntre';
const PRESET = { id: 'p1', name: 'Fix it', builtInId: undefined, order: 0, hidden: false } as unknown as PromptPreset;
const SCOPE = { from: 0, to: 3, originalText: 'uno', status: 'valid' } as SelectionScope;

function mount(withProfile = true) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.request': 'CHIEDI', 'ai.send': 'INVIA', 'ai.composer.needText': 'SCRIVI' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ presets: [PRESET] }, withProfile ? defaultProfile('ollama', 'o') : undefined);
  const el = document.createElement('hmd-ai-composer');
  el.controller = ai;
  el.text = TEXT;
  el.selection = null;
  el.getSelection = () => SCOPE;
  el.i18n = i18n;
  document.body.append(el);
  const input = () => el.querySelector('textarea')!;
  const send = () => el.querySelector<HTMLButtonElement>('button.send')!;
  const chip = () => el.querySelector<HTMLElement>('.selection');
  const note = () => el.querySelector<HTMLElement>('[role="status"]')!;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    input().dispatchEvent(event);
    return event;
  };
  const running = (on: boolean) => ai.set({ running: on ? { messageId: 'm', path: 'a.md', startedAt: 0 } : null } as Partial<AiState>);
  return { el, ai, i18n, listeners, input, send, chip, note, type, key, running };
}

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus; jsdom no: qui lo si
 * manda a mano dentro `remove()`, cioè nel mezzo di un render.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    // Come Chromium: solo se il nodo è nel documento e contiene il focus (un nodo già tolto non manda nulla).
    if (this.isConnected && this.contains(document.activeElement)) this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

test('the same DOM as Composer.tsx: box, textarea, row with the two chips and Send; then the empty status note', () => {
  const { el, input, send, chip, note } = mount();
  assert.deepEqual([...el.children].map((c) => `${c.localName}.${c.className}`), ['div.composer', 'p.note']);
  assert.equal(note().textContent, '');
  const box = el.firstElementChild!;
  assert.equal(box.className, 'composer');
  assert.deepEqual([...box.children].map((c) => c.localName), ['textarea', 'div']);
  assert.equal(input().className, 'input');
  assert.equal(input().getAttribute('aria-label'), EN_MESSAGES['ai.request']);
  assert.equal(input().getAttribute('placeholder'), EN_MESSAGES['ai.request']);
  const row = box.lastElementChild!;
  assert.equal(row.className, 'row');
  assert.deepEqual([...row.children].map((c) => c.localName), ['hmd-ai-model-chip', 'hmd-ai-effort-chip', 'button']);
  assert.equal(send().className, 'send tooltip');
  assert.equal(send().type, 'button');
  assert.equal(send().getAttribute('aria-label'), EN_MESSAGES['ai.send']);
  assert.equal(send().getAttribute('data-tooltip'), EN_MESSAGES['ai.send']);
  assert.equal(send().disabled, false);
  assert.equal(send().hasAttribute('aria-disabled'), false);
  assert.equal(chip(), null);
  assert.equal(el.querySelector('hmd-ai-model-chip')!.controller, el.controller);
  assert.equal(el.querySelector('hmd-ai-effort-chip')!.i18n, el.i18n);
});

test('Send is never disabled: without text it says why in the status note, keeps the focus, and typing clears the note', () => {
  const { ai, send, type, note } = mount();
  type('  ');
  assert.equal(send().disabled, false);
  send().focus();
  send().click();
  assert.deepEqual(ai.calls, []);
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
  assert.equal(document.activeElement, send());
  type('fix');
  assert.equal(note().textContent, '');
  send().click();
  assert.deepEqual(ai.calls, [['send', 'fix', undefined, undefined]]);
});

test('Enter with an empty box shows the note too; a successful send clears it', () => {
  const { ai, key, note, input } = mount();
  assert.equal(key('Enter').defaultPrevented, true);
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
  // Il testo arriva senza evento input (incollato da uno script): l'invio riuscito toglie comunque la nota.
  input().value = 'fix';
  key('Enter');
  assert.deepEqual(ai.calls, [['send', 'fix', undefined, undefined]]);
  assert.equal(note().textContent, '');
});

test('without a profile Send asks for one first, even with text; choosing a profile clears the note', () => {
  const { ai, send, type, note } = mount(false);
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needProfile']);
  type('fix');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needProfile']);
  assert.deepEqual(ai.calls, []);
  ai.set({ profiles: [defaultProfile('ollama', 'o')], profileId: 'o' });
  assert.equal(note().textContent, '');
});

test('a generation that starts from anywhere clears the note; while running a click on Stop shows none', () => {
  const { send, note, running } = mount();
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
  // Per esempio «Riprova» nel registro: la generazione parte dal controller, non dal composer.
  running(true);
  assert.equal(note().textContent, '');
  send().click();
  assert.equal(note().textContent, '');
});

test('a preset without a profile shows the profile note, keeps the draft and the focus; with a profile it sends even with an empty box', () => {
  const { el, ai, input, type, note } = mount(false);
  type('draft');
  input().focus();
  el.sendPreset('p1');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needProfile']);
  assert.equal(input().value, 'draft');
  assert.deepEqual(ai.calls, []);
  assert.notEqual(document.activeElement, document.body);
  ai.set({ profiles: [defaultProfile('ollama', 'o')], profileId: 'o' });
  type('');
  el.sendPreset('p1');
  assert.deepEqual(ai.calls, [['send', 'Fix it', PRESET, undefined]]);
  assert.equal(note().textContent, '');
});

test('Enter sends the trimmed text and empties the box; Shift+Enter, Ctrl+Enter and IME do not', () => {
  const { ai, type, key, input } = mount();
  type('  fix it  ');
  assert.equal(key('Enter', { shiftKey: true }).defaultPrevented, false);
  assert.equal(key('Enter', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(key('Enter', { isComposing: true } as KeyboardEventInit).defaultPrevented, false);
  assert.deepEqual(ai.calls, []);
  assert.equal(key('Enter').defaultPrevented, true);
  assert.deepEqual(ai.calls, [['send', 'fix it', undefined, undefined]]);
  assert.equal(input().value, '');
});

test('while running the button is Stop (same node): Escape and the button stop; Enter does not send again', () => {
  const { ai, send, type, key, running, input } = mount();
  const node = send();
  running(true);
  assert.equal(send(), node);
  assert.equal(node.getAttribute('aria-label'), EN_MESSAGES['ai.stop']);
  assert.equal(node.disabled, false);
  type('more');
  key('Enter');
  assert.equal(input().value, 'more');
  assert.equal(key('Escape').defaultPrevented, true);
  node.click();
  assert.deepEqual(ai.calls, [['stop'], ['stop']]);
  running(false);
  assert.equal(node.getAttribute('aria-label'), EN_MESSAGES['ai.send']);
});

test('the box is never rewritten by a store notification or a new text', () => {
  const { el, ai, input, type } = mount();
  type('half typed');
  input().setSelectionRange(4, 4);
  ai.override({ temperature: 1 });
  el.text = 'another document';
  assert.equal(input().value, 'half typed');
  assert.equal(input().selectionStart, 4);
});

test('the selection chip: text, ✕ that hides it until another selection, the scope sent with it', () => {
  const { el, ai, chip, type, key } = mount();
  el.selection = { from: 0, to: 7 };
  assert.equal(chip()!.firstChild!.textContent, t('ai.selectionLines', { count: 2 }));
  assert.equal(chip()!.parentElement!.firstElementChild, chip());
  const ignore = chip()!.querySelector('button')!;
  assert.equal(ignore.className, 'selectionClose tooltip');
  assert.equal(ignore.getAttribute('aria-label'), EN_MESSAGES['ai.selectionIgnore']);
  type('scoped');
  key('Enter');
  assert.deepEqual(ai.calls.at(-1), ['send', 'scoped', undefined, SCOPE]);
  ignore.click();
  assert.equal(chip(), null);
  type('whole');
  key('Enter');
  assert.deepEqual(ai.calls.at(-1), ['send', 'whole', undefined, undefined]);
  el.selection = { from: 4, to: 7 };
  assert.equal(chip()!.firstChild!.textContent, t('ai.selectionChars', { count: 3 }));
});

test('a selection lost before sending reports scopeLost and keeps the text', () => {
  const { el, ai, type, key, input } = mount();
  el.selection = { from: 0, to: 3 };
  el.getSelection = () => undefined;
  type('fix');
  key('Enter');
  assert.deepEqual(ai.calls, []);
  assert.deepEqual(ai.reports, [{ code: 'scopeLost' }]);
  assert.equal(input().value, 'fix');
});

test('sendPreset sends the preset label and keeps what is typed; nothing while running', () => {
  const { el, ai, type, input, running } = mount();
  type('draft');
  el.sendPreset('p1');
  assert.deepEqual(ai.calls, [['send', 'Fix it', PRESET, undefined]]);
  assert.equal(input().value, 'draft');
  running(true);
  el.sendPreset('p1');
  assert.equal(ai.calls.length, 1);
});

test('✕ with the focus: the chip goes away and the focus goes to the box (decision 3)', () => {
  const { el, chip, input } = mount();
  el.selection = { from: 0, to: 3 };
  const ignore = chip()!.querySelector('button')!;
  ignore.focus();
  ignore.click();
  assert.equal(chip(), null);
  assert.equal(document.activeElement, input());
});

test('a listener that changes the selection from a focusout while the chip is being removed: one chip at most, focus in the box', () => {
  const { el, chip, input } = mount();
  el.selection = { from: 0, to: 3 };
  const chipNode = chip()!;
  chipNode.querySelector('button')!.focus();
  focusoutOnRemove(chipNode);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.selection = null;
  });
  el.selection = { from: 1, to: 1 };
  assert.equal(el.querySelectorAll('.selection').length, 0);
  assert.equal(document.activeElement, input());
});

test('language change relabels, the note too; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, input, send, note } = mount();
  send().click();
  await i18n.setLocale('it');
  assert.equal(note().textContent, 'SCRIVI');
  assert.equal(input().getAttribute('placeholder'), 'CHIEDI');
  assert.equal(send().getAttribute('aria-label'), 'INVIA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
