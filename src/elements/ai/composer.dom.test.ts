import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { ChangeSet } from '@codemirror/state';

import '../define';
import { AiController, type AiState } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import { createMemoryAiStores } from '../../ai/stores';
import type { PromptPreset, SelectionScope } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';

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

test('a scopeLost send clears a stale note', () => {
  const { el, ai, send, input, note } = mount();
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
  // Testo inserito da script, senza evento input: la nota resterebbe.
  input().value = 'fix';
  el.selection = { from: 0, to: 3 };
  el.getSelection = () => undefined;
  send().click();
  assert.equal(note().textContent, '');
  assert.deepEqual(ai.reports, [{ code: 'scopeLost' }]);
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

test('without a document Send says so, keeps the draft and the focus; a document opened clears the note', () => {
  const { ai, send, type, note, input } = mount();
  ai.sendBlockerValue = 'noDocument';
  type('draft');
  send().focus();
  send().click();
  assert.deepEqual(ai.calls, []);
  assert.equal(input().value, 'draft');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  assert.equal(document.activeElement, send());
  ai.sendBlockerValue = null;
  ai.set({});
  assert.equal(note().textContent, '');
});

test('during an update Send says so; typing clears the note as for the other notes, and so does the end of the update', () => {
  const { ai, send, type, note } = mount();
  ai.sendBlockerValue = 'updating';
  type('draft');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  type('draft more');
  assert.equal(note().textContent, '');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  ai.sendBlockerValue = null;
  ai.set({});
  assert.equal(note().textContent, '');
});

test('a suggestion (or Enter) during a generation says so, the draft stays, the note goes when the generation ends', async () => {
  const { el, ai, key, note, type, input, running } = mount();
  running(true);
  type('draft');
  el.sendPreset('p1');
  assert.deepEqual(ai.calls, []);
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
  assert.equal(input().value, 'draft');
  key('Enter');
  // La stessa nota di nuovo: svuotata subito e riscritta dopo `ANNOUNCE_DELAY_MS`, così lo screen reader la rilegge.
  assert.equal(note().textContent, '');
  await waitFor(() => note().textContent === EN_MESSAGES['ai.composer.generating']);
  running(false);
  assert.equal(note().textContent, '');
});

test('the order of the reasons: the controller first (generation, document, update), then the profile, then the text', () => {
  const { ai, send, key, note, running } = mount(false);
  // Durante la generazione il pulsante è Stop: la ragione si vede con Invio.
  running(true);
  key('Enter');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
  running(false);
  ai.sendBlockerValue = 'noDocument';
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  ai.sendBlockerValue = null;
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needProfile']);
  ai.set({ profiles: [defaultProfile('ollama', 'o')], profileId: 'o' });
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
});

/** Il controller vero (store in memoria, provider finto mai chiamato) al posto di `fakeAi`: le notifiche arrivano solo da lui. */
async function realController() {
  const world = { doc: { path: 'a.md', textLf: 'uno\ndue\ntre', conflict: null as unknown, updating: false } as { path: string; textLf: string; conflict: unknown; updating: boolean } | null };
  const controller = new AiController(createMemoryAiStores({ writerId: 'test', now: () => 100 }), { getDoc: () => world.doc, snapshotBeforeAi() {}, openFile() {} }, () => ({
    async listModels() { return []; },
    async *stream() { throw new Error('mai chiamato'); },
  }));
  await controller.initialize();
  return { controller, world };
}

test('with the real controller: the updating note goes when cancel() ends the update, the no-document note when a document opens; no other user action', async () => {
  const { controller, world } = await realController();
  const { el, send, type, note, input } = mount();
  el.controller = controller;
  assert.equal(await controller.prepare(), 'durable');
  type('draft');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  assert.equal(input().value, 'draft');
  controller.cancel();
  assert.equal(controller.sendBlocker(), null);
  assert.equal(note().textContent, '');
  world.doc = null;
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  world.doc = { path: 'b.md', textLf: 'B', conflict: null, updating: false };
  // Come WorkspaceView quando apre un documento: documentChanged con reset.
  controller.documentChanged('b.md', ChangeSet.empty(1), true);
  assert.equal(note().textContent, '');
  assert.equal(input().value, 'draft');
});

test('a double click on Send sends once and does not stop: only the click right after the sending one (detail + 1) is ignored on Stop', () => {
  const { ai, send, type, running, key } = mount();
  const click = (detail: number) => send().dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
  const calls = () => ai.calls.map((c) => c[0]);
  type('fix');
  click(1);
  running(true);
  click(2);
  assert.deepEqual(calls(), ['send'], 'la seconda metà del doppio clic');
  // Una serie rapida su Stop (detail 3) ferma: chi ha un tremore clicca così.
  click(3);
  assert.deepEqual(calls(), ['send', 'stop']);
  // Invio dalla tastiera, poi un clic singolo su Stop: ferma.
  running(false);
  type('again');
  key('Enter');
  running(true);
  click(1);
  assert.deepEqual(calls(), ['send', 'stop', 'send', 'stop']);
});

test('the draft: given before connecting it fills the box; typing and sending tell it out with hmd-ai-draft', () => {
  const ai = fakeAi({ presets: [PRESET] }, defaultProfile('ollama', 'o'));
  const el = document.createElement('hmd-ai-composer');
  el.draft = 'half written';
  el.controller = ai;
  el.text = TEXT;
  el.i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const drafts: string[] = [];
  el.addEventListener('hmd-ai-draft', (event) => drafts.push(event.detail.text));
  document.body.append(el);
  const input = el.querySelector('textarea')!;
  assert.equal(input.value, 'half written');
  input.value = 'half written, done';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.deepEqual(drafts, ['half written, done', '']);
  // Dopo la costruzione la bozza non riscrive più la casella.
  el.draft = 'other';
  assert.equal(input.value, '');
});
