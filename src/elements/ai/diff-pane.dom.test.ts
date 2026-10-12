import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorView } from '@codemirror/view';
import { undo, undoDepth } from '@codemirror/commands';

import '../define';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { AcceptBlocker } from '../../ai/aiController';
import type { HmdEvents } from '../events';

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Il focus è su `node`. Mai `assert.equal` tra nodi di jsdom: il messaggio del RED (util.inspect dell'albero) non finisce più. */
const focusOn = (node: Element | null | undefined, what: string) => assert.ok(!!node && document.activeElement === node, `focus on ${what}, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);

/** Incolla delle immagini nella vista (jsdom non ha ClipboardEvent né DataTransfer). */
function pasteImages(view: EditorView, ...names: string[]): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const files = names.map((name) => new File(['x'], name, { type: 'image/png' }));
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } });
  view.contentDOM.dispatchEvent(event);
}

/** saveImage finto che resta in attesa finché il test non risponde. */
function slowSave() {
  const saved: string[] = [];
  const pending: ((link: string) => void)[] = [];
  const saveImage = (file: File) => (saved.push(file.name), new Promise<string | null>((resolve) => pending.push(resolve)));
  return { saveImage, saved, pending };
}

function i18nStore() {
  return countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.acceptBlock': 'ACCETTA', 'ai.rejectBlock': 'RIFIUTA' } }),
      persist() {},
    }),
  );
}

interface Options {
  original?: string;
  proposal?: string;
  acceptBlocker?: AcceptBlocker | null;
  rejectBlocker?: AcceptBlocker | null;
  streaming?: boolean;
  beforeAccept?: () => boolean;
}

/** Diff montato come lo monta ReviewView: documento dalla sessione, proposta a destra. Aspetta il primo disegno. */
async function mount(options: Options = {}) {
  const original = options.original ?? 'A\n\nB\n\nC';
  const { store, listeners } = i18nStore();
  const el = document.createElement('hmd-ai-diff-pane');
  Object.assign(el, {
    text: original,
    resetKey: 'a.md#1',
    session: createDocSession('a.md#1', original),
    restore: null,
    readOnly: false,
    i18n: store,
    proposal: options.proposal ?? 'A2\n\nB\n\nC2',
    range: null,
    acceptBlocker: options.acceptBlocker ?? null,
    rejectBlocker: options.rejectBlocker ?? null,
    streaming: options.streaming ?? false,
    beforeAccept: options.beforeAccept ?? (() => true),
  });
  const events: [keyof HmdEvents, unknown][] = [];
  for (const type of ['hmd-doc-change', 'hmd-selection', 'hmd-ai-proposal-edit', 'hmd-ai-all-rejected', 'hmd-ai-block-blocked'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  document.body.append(el);
  await tick();
  const editors = () => [...el.querySelectorAll<HTMLElement>('.cm-mergeView .cm-editor')].map((dom) => EditorView.findFromDOM(dom)!);
  return {
    el,
    events,
    i18n: store,
    listeners,
    a: () => editors()[0],
    b: () => editors()[1],
    buttons: (action: 'accept' | 'reject') => [...el.querySelectorAll<HTMLButtonElement>(`.cm-merge-revert button[data-action="${action}"]`)],
  };
}

const mousedown = (button: HTMLElement) => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
const key = (button: HTMLElement, name: string) => button.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

test('the tree of DiffPane.tsx: div.diff with the MergeView, two buttons per block with drawn tooltips', async () => {
  const { el, a, b, buttons } = await mount();
  const box = el.firstElementChild!;
  assert.deepEqual([box.localName, box.className, box.firstElementChild!.className], ['div', 'diff', 'cm-mergeView']);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  const revert = el.querySelector('.cm-merge-revert > .revert')!;
  assert.deepEqual([...revert.children].map((button) => [button.localName, button.className, button.getAttribute('type'), button.textContent]), [
    ['button', 'tooltip', 'button', '←'],
    ['button', 'tooltip', 'button', '→'],
  ]);
  assert.deepEqual(buttons('accept').map((button) => [button.getAttribute('aria-label'), button.dataset.tooltip]), [
    [EN_MESSAGES['ai.acceptBlock'], EN_MESSAGES['ai.acceptBlock']],
    [EN_MESSAGES['ai.acceptBlock'], EN_MESSAGES['ai.acceptBlock']],
  ]);
  assert.equal(buttons('reject')[0].getAttribute('aria-label'), EN_MESSAGES['ai.rejectBlock']);
  el.remove();
});

test('accept: beforeAccept first, the block goes into the document, the focus follows it (Ctrl+Z undoes it)', async () => {
  let asked = 0;
  const { el, a, buttons, events } = await mount({ beforeAccept: () => (asked++, true) });
  events.length = 0;
  mousedown(buttons('accept')[0]);
  await tick();
  assert.equal(asked, 1);
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC');
  assert.equal(document.activeElement, a().contentDOM);
  assert.equal(events[0][0], 'hmd-doc-change');
  assert.equal(undo(a()), true);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  el.remove();
});

test('accept refused by beforeAccept: nothing happens and nothing is said (the controller checked again)', async () => {
  let asked = 0;
  const { el, a, buttons, events } = await mount({ beforeAccept: () => (asked++, false) });
  events.length = 0;
  mousedown(buttons('accept')[0]);
  await tick();
  assert.equal(asked, 1);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events, []);
  el.remove();
});

test('accept blocked (a conflict): never disabled, activated it says why with an event and does not ask beforeAccept', async () => {
  let asked = 0;
  const { el, a, buttons, events } = await mount({ acceptBlocker: 'conflict', beforeAccept: () => (asked++, true) });
  for (const button of [...buttons('accept'), ...buttons('reject')]) {
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-disabled'), false);
  }
  events.length = 0;
  mousedown(buttons('accept')[1]);
  await tick();
  assert.equal(asked, 0);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events, [['hmd-ai-block-blocked', { action: 'accept', reason: 'conflict' }]]);
  el.remove();
});

test('keyboard: Enter on accept accepts, Space on reject rejects', async () => {
  const { el, a, b, buttons } = await mount();
  key(buttons('accept')[0], 'Enter');
  await tick();
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC');
  key(buttons('reject')[0], ' ');
  await tick();
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC');
  el.remove();
});

test('reject: the original goes back into the proposal (an edit), focus on it; the last one closes the review', async () => {
  const { el, a, b, buttons, events } = await mount();
  events.length = 0;
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A\n\nB\n\nC2');
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events, [['hmd-ai-proposal-edit', { text: 'A\n\nB\n\nC2' }]]);
  assert.equal(document.activeElement, b().contentDOM);
  assert.equal(undo(b()), true);
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  mousedown(buttons('reject')[0]);
  await tick();
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events.at(-1), ['hmd-ai-all-rejected', null]);
  el.remove();
});

test('while generating: proposal read-only, both buttons active; from the keyboard they say why and keep the focus; then they work', async () => {
  const { el, b, buttons, events } = await mount({ streaming: true, acceptBlocker: 'generating', rejectBlocker: 'generating' });
  assert.equal(b().state.readOnly, true);
  assert.deepEqual([buttons('accept')[0].disabled, buttons('reject')[0].disabled], [false, false]);
  events.length = 0;
  const reject = buttons('reject')[0];
  reject.focus();
  key(reject, ' ');
  await tick();
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  focusOn(reject, 'the reject button');
  const accept = buttons('accept')[1];
  accept.focus();
  key(accept, 'Enter');
  await tick();
  focusOn(accept, 'the accept button');
  mousedown(buttons('reject')[1]);
  await tick();
  assert.deepEqual(events, [
    ['hmd-ai-block-blocked', { action: 'reject', reason: 'generating' }],
    ['hmd-ai-block-blocked', { action: 'accept', reason: 'generating' }],
    ['hmd-ai-block-blocked', { action: 'reject', reason: 'generating' }],
  ]);
  el.streaming = false;
  el.acceptBlocker = null;
  el.rejectBlocker = null;
  await tick();
  assert.equal(b().state.readOnly, false);
  events.length = 0;
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A\n\nB\n\nC2');
  assert.deepEqual(events.map(([type]) => type), ['hmd-ai-proposal-edit']);
  el.remove();
});

test('the focused block button goes away while generating (its block is gone): the focus goes to the same action of the nearest block left', async () => {
  const { el, buttons } = await mount({ streaming: true, acceptBlocker: 'generating', rejectBlocker: 'generating' });
  const reject = buttons('reject')[1];
  reject.focus();
  // La proposta che arriva cambia i blocchi: ne resta uno, e la MergeView toglie i controlli del secondo.
  el.proposal = 'A2\n\nB\n\nC';
  await tick();
  await tick();
  assert.equal(buttons('reject').length, 1);
  assert.equal(reject.isConnected, false);
  focusOn(buttons('reject')[0], 'the reject button of the block left');
  // Una proposta che cambia testo ma non il numero dei blocchi: i controlli restano gli stessi, il focus non si muove.
  const kept = buttons('reject')[0];
  el.proposal = 'A3\n\nB\n\nC';
  await tick();
  await tick();
  assert.ok(buttons('reject')[0] === kept, 'the same control');
  focusOn(kept, 'the same reject button');
  el.remove();
});

test('a block button removed while the focus is elsewhere: the focus is not taken', async () => {
  const { el, a, buttons } = await mount({ streaming: true, acceptBlocker: 'generating', rejectBlocker: 'generating' });
  buttons('reject')[1].focus();
  a().focus();
  el.proposal = 'A2\n\nB\n\nC';
  await tick();
  await tick();
  assert.equal(buttons('reject').length, 1);
  focusOn(a().contentDOM, 'the document side');
  el.remove();
});

test('a block button removed after the focus left on purpose (blur to the body): the focus is not taken back', async () => {
  const { el, buttons } = await mount({ streaming: true, acceptBlocker: 'generating', rejectBlocker: 'generating' });
  const reject = buttons('reject')[1];
  reject.focus();
  reject.blur();
  assert.ok(document.activeElement === document.body, 'the focus is on the body');
  el.proposal = 'A2\n\nB\n\nC';
  await tick();
  await tick();
  assert.equal(buttons('reject').length, 1);
  assert.ok(document.activeElement === document.body, `focus stays on the body, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);
  el.remove();
});

test('a new proposal from outside replaces the right side, outside its history and without an edit event', async () => {
  const { el, b, events } = await mount();
  events.length = 0;
  el.proposal = 'A3\n\nB\n\nC3';
  await tick();
  assert.equal(b().state.doc.toString(), 'A3\n\nB\n\nC3');
  assert.deepEqual(events, []);
  assert.equal(undo(b()), false);
  el.remove();
});

test('late confirmations of edits made here never pull the proposal back (text, cursor, history)', async () => {
  const { el, b, events } = await mount();
  const view = b();
  const typeAtEnd = (char: string) => {
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: char }, selection: { anchor: end + 1 }, userEvent: 'input.type' });
  };
  events.length = 0;
  typeAtEnd('1');
  typeAtEnd('2');
  const typed = 'A2\n\nB\n\nC212';
  const edits = events.map(([, detail]) => (detail as { text: string }).text);
  assert.deepEqual(edits, ['A2\n\nB\n\nC21', typed]);
  const depth = undoDepth(view.state);
  // ReviewView conferma in ritardo, una battuta alla volta, quando l'utente ha già scritto la seconda.
  el.proposal = edits[0];
  await tick();
  assert.equal(view.state.doc.toString(), typed);
  assert.equal(view.state.selection.main.head, typed.length);
  assert.equal(undoDepth(view.state), depth);
  el.proposal = edits[1];
  await tick();
  assert.equal(view.state.doc.toString(), typed);
  assert.equal(undoDepth(view.state), depth);
  assert.equal(events.length, 2);
  // Una proposta nuova da fuori (il modello) sostituisce ancora il lato destro, senza voci nuove nella
  // cronologia (CodeMirror scarta quelle delle battute sostituite, come con DiffPane.tsx).
  el.proposal = 'A3\n\nB\n\nC3';
  await tick();
  assert.equal(view.state.doc.toString(), 'A3\n\nB\n\nC3');
  assert.ok(undoDepth(view.state) <= depth);
  assert.equal(events.length, 2);
  el.remove();
});

test('with a selection range, edits to the proposal outside it are dropped', async () => {
  const { el, b } = await mount({ original: 'keep BAD keep', proposal: 'keep GOOD keep' });
  el.range = { from: 5, to: 9 };
  b().dispatch({ changes: { from: 0, to: 4, insert: 'lost' }, userEvent: 'input.type' });
  assert.equal(b().state.doc.toString(), 'keep GOOD keep');
  b().dispatch({ changes: { from: 5, to: 9, insert: 'FINE' }, userEvent: 'input.type' });
  assert.equal(b().state.doc.toString(), 'keep FINE keep');
  el.remove();
});

test('replace (Accept all) is one undoable transaction on the document; next and previous walk the blocks', async () => {
  const { el, a } = await mount();
  // Cursore all'inizio, sul primo blocco: «successivo» va al blocco di C, «precedente» torna a quello di A.
  el.next();
  assert.equal(a().state.selection.main.head, 'A\n\nB\n\n'.length);
  el.previous();
  assert.equal(a().state.selection.main.head, 0);
  el.replace('A2\n\nB\n\nC2');
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC2');
  assert.equal(undo(a()), true);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  el.remove();
});

test('restore: a transaction on the document (never setState on the MergeView editor)', async () => {
  const { el, a } = await mount();
  const view = a();
  el.restore = { seq: 1, textLf: 'restored' };
  await tick();
  assert.equal(a(), view);
  assert.equal(view.state.doc.toString(), 'restored');
  assert.equal(undo(view), true);
  el.remove();
});

test('a new resetKey recreates the MergeView from the new session and gives the focus back', async () => {
  const { el, a, events } = await mount();
  const old = el.querySelector('.cm-mergeView');
  el.focus();
  assert.equal(document.activeElement, a().contentDOM);
  events.length = 0;
  el.resetKey = 'a.md#2';
  el.session = createDocSession('a.md#2', 'reloaded');
  el.text = 'reloaded';
  await tick();
  assert.notEqual(el.querySelector('.cm-mergeView'), old);
  assert.equal(el.querySelectorAll('.cm-mergeView').length, 1);
  assert.equal(a().state.doc.toString(), 'reloaded');
  assert.equal(document.activeElement, a().contentDOM);
  assert.deepEqual(events, [['hmd-selection', { range: null }]]);
  el.remove();
});

test('a language change relabels the drawn buttons in place; detached, no listener is left', async () => {
  const { el, i18n, listeners, buttons } = await mount();
  const button = buttons('accept')[0];
  await i18n.setLocale('it');
  assert.equal(buttons('accept')[0], button);
  assert.deepEqual([button.getAttribute('aria-label'), button.dataset.tooltip], ['ACCETTA', 'ACCETTA']);
  assert.equal(buttons('reject')[0].getAttribute('aria-label'), 'RIFIUTA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(el.querySelector('.cm-mergeView'), null);
});

test('an image pasted in the document side and still saving when the diff goes away: no link, no further saves', async () => {
  const { el, a } = await mount();
  const session = el.session!;
  const slow = slowSave();
  el.saveImage = slow.saveImage;
  pasteImages(a(), 'one.png', 'two.png');
  el.remove();
  slow.pending[0]('assets/one.png');
  await tick();
  assert.deepEqual(slow.saved, ['one.png']);
  assert.equal(session.textLf, 'A\n\nB\n\nC');
});

test('a listener that assigns another document while a new one is announced: the restore goes to its own document', async () => {
  const { el, events, a } = await mount();
  const b = createDocSession('b.md#1', 'B');
  const c = createDocSession('c.md#1', 'C');
  el.addEventListener('hmd-selection', () => {
    Object.assign(el, { resetKey: 'c.md#1', text: 'C', session: c, restore: { seq: 2, textLf: 'C restored' } });
  }, { once: true });
  events.length = 0;
  Object.assign(el, { resetKey: 'b.md#1', text: 'B', session: b });
  await tick();
  assert.equal(el.querySelectorAll('.cm-mergeView').length, 1);
  assert.equal(a().state.doc.toString(), 'C restored');
  assert.equal(c.textLf, 'C restored');
  assert.equal(b.textLf, 'B');
  assert.deepEqual(events.map(([type]) => type), ['hmd-selection', 'hmd-selection', 'hmd-doc-change', 'hmd-selection']);
  el.remove();
});
