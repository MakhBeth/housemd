import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import { StrictMode, createElement, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import '../define';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import type { HmdEvents } from '../events';
import type { HmdEditor } from './editor.element';

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
type Recorded = [keyof HmdEvents, unknown];

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

function mount(text: string, key = 'a.md#1') {
  const session = createDocSession(key, text);
  const el = document.createElement('hmd-editor');
  el.text = text;
  el.resetKey = key;
  el.session = session;
  el.restore = null;
  el.readOnly = false;
  el.i18n = i18n;
  const events: Recorded[] = [];
  for (const type of ['hmd-doc-change', 'hmd-selection', 'hmd-top-line'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  document.body.append(el);
  const view = () => EditorView.findFromDOM(el.querySelector<HTMLElement>('.cm-editor')!)!;
  return { el, session, events, view };
}

test('the tree of Editor.tsx: a div.editor holding the CodeMirror view, filled from the session', () => {
  const { el, view } = mount('# Title');
  const box = el.firstElementChild!;
  assert.deepEqual([box.localName, box.className, el.childElementCount], ['div', 'editor', 1]);
  assert.equal(box.firstElementChild, view().dom);
  assert.equal(view().state.doc.toString(), '# Title');
  el.remove();
});

test('the session selection is announced after mounting, in a microtask', async () => {
  const session = createDocSession('a.md#1', 'hello world');
  session.selection = EditorSelection.single(0, 5);
  const el = document.createElement('hmd-editor');
  Object.assign(el, { text: 'hello world', resetKey: 'a.md#1', session, i18n });
  const ranges: unknown[] = [];
  el.addEventListener('hmd-selection', (event) => ranges.push(event.detail.range));
  document.body.append(el);
  assert.deepEqual(ranges, []);
  await tick();
  assert.deepEqual(ranges, [{ from: 0, to: 5 }]);
  el.remove();
});

test('typing: hmd-doc-change with before and after, then hmd-selection; the session follows', async () => {
  const { el, session, events, view } = mount('abc');
  await tick();
  events.length = 0;
  view().dispatch({ changes: { from: 3, insert: 'd' }, selection: { anchor: 4 }, userEvent: 'input.type' });
  assert.deepEqual(events.map(([type]) => type), ['hmd-doc-change', 'hmd-selection']);
  const change = events[0][1] as HmdEvents['hmd-doc-change']['detail'];
  assert.deepEqual([change.before, change.after, change.changes.length], ['abc', 'abcd', 3]);
  assert.equal(session.textLf, 'abcd');
  el.remove();
});

test('a new text alone changes nothing (it comes back from the editor while typing)', async () => {
  const { el, view } = mount('mine');
  el.text = 'stale';
  await tick();
  assert.equal(view().state.doc.toString(), 'mine');
  el.remove();
});

test('a new resetKey replaces the text in the same view, clears the history, announces the selection', async () => {
  const { el, events, view } = mount('old');
  const first = view();
  first.dispatch({ changes: { from: 3, insert: '!' }, userEvent: 'input.type' });
  await tick();
  events.length = 0;
  // React assegna le proprietà nell'ordine del JSX: resetKey può arrivare prima della sessione nuova.
  el.resetKey = 'b.md#1';
  el.text = 'new';
  el.session = createDocSession('b.md#1', 'new');
  await tick();
  assert.equal(view(), first);
  assert.equal(first.state.doc.toString(), 'new');
  assert.equal(undo(first), false);
  assert.deepEqual(events, [['hmd-selection', { range: null }]]);
  el.remove();
});

test('restore: a transaction (undoable), applied once; the one present at mount counts as applied', async () => {
  const { el, view } = mount('v2');
  el.restore = { seq: 1, textLf: 'v1' };
  await tick();
  assert.equal(view().state.doc.toString(), 'v1');
  assert.equal(undo(view()), true);
  assert.equal(view().state.doc.toString(), 'v2');
  // Lo stesso comando (un nuovo render di React) non si riapplica.
  el.restore = { seq: 1, textLf: 'v1' };
  await tick();
  assert.equal(view().state.doc.toString(), 'v2');
  el.remove();
  const late = document.createElement('hmd-editor');
  Object.assign(late, { text: 'v1', resetKey: 'a.md#1', session: createDocSession('a.md#1', 'v1'), restore: { seq: 5, textLf: 'other' }, i18n });
  document.body.append(late);
  await tick();
  assert.equal(EditorView.findFromDOM(late.querySelector<HTMLElement>('.cm-editor')!)!.state.doc.toString(), 'v1');
  late.remove();
});

test('read-only follows the property', async () => {
  const { el, view } = mount('text');
  el.readOnly = true;
  await tick();
  assert.equal(view().state.readOnly, true);
  assert.equal(view().contentDOM.getAttribute('contenteditable'), 'false');
  el.readOnly = false;
  await tick();
  assert.equal(view().state.readOnly, false);
  el.remove();
});

test('scroll: the top line goes out as hmd-top-line, except right after scrollToLine', async () => {
  let now = 1000;
  mock.method(performance, 'now', () => now);
  const { el, events, view } = mount(Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n'));
  await tick();
  events.length = 0;
  const scroller = view().scrollDOM;
  scroller.dispatchEvent(new Event('scroll'));
  assert.deepEqual(events.map(([type]) => type), ['hmd-top-line']);
  assert.equal(typeof (events[0][1] as { line: number }).line, 'number');
  el.scrollToLine(10);
  assert.ok(scroller.scrollTop > 0);
  now += 149;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, 1);
  now += 2;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, 2);
  mock.restoreAll();
  el.remove();
});

test('focus() puts the focus in the text', () => {
  const { el, view } = mount('text');
  el.focus();
  assert.equal(document.activeElement, view().contentDOM);
  el.remove();
});

test('detached: the session keeps text and history, a new view picks them up', async () => {
  const { el, session, view } = mount('one');
  view().dispatch({ changes: { from: 3, insert: ' two' }, userEvent: 'input.type' });
  el.remove();
  assert.equal(el.querySelector('.cm-editor'), null);
  assert.equal(session.textLf, 'one two');
  document.body.append(el);
  assert.equal(view().state.doc.toString(), 'one two');
  assert.equal(undo(view()), true);
  assert.equal(view().state.doc.toString(), 'one');
  el.remove();
});

test('removed while a new document is still pending: each session keeps its own text', async () => {
  const { el, session, view } = mount('old');
  view().dispatch({ changes: { from: 3, insert: '!' }, userEvent: 'input.type' });
  const next = createDocSession('b.md#1', 'new');
  el.resetKey = 'b.md#1';
  el.session = next;
  el.text = 'new';
  el.remove();
  await tick();
  assert.equal(session.textLf, 'old!');
  assert.equal(next.textLf, 'new');
});

test('an image still saving when the editor is detached goes nowhere, even if it comes back with the same document', async () => {
  const { el, session, view } = mount('ab');
  const slow = slowSave();
  el.saveImage = slow.saveImage;
  pasteImages(view(), 'one.png', 'two.png');
  el.remove();
  document.body.append(el); // stessa chiave: una vista nuova dalla sessione
  slow.pending[0]('assets/one.png');
  await tick();
  assert.deepEqual(slow.saved, ['one.png']);
  assert.equal(view().state.doc.toString(), 'ab');
  assert.equal(session.textLf, 'ab');
});

test('under React StrictMode: properties (also saveImage) set before connecting, the view is never recreated', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const saveImage = async () => null;
  let editor: HmdEditor | null = null;
  function Parent() {
    const ref = useRef<HmdEditor>(null);
    // Come ReviewView: il genitore dà il focus all'editor appena montato.
    useEffect(() => ref.current?.focus(), []);
    return createElement('hmd-editor', { ref, text: 'abc', resetKey: 'a.md#1', session: createDocSession('a.md#1', 'abc'), saveImage, i18n });
  }
  flushSync(() => root.render(createElement(StrictMode, null, createElement(Parent))));
  editor = host.querySelector('hmd-editor');
  assert.equal(editor!.saveImage, saveImage);
  assert.equal(host.querySelectorAll('.cm-editor').length, 1);
  assert.equal(document.activeElement, editor!.querySelector('.cm-content'));
  flushSync(() => root.unmount());
  host.remove();
});
