import '../testing/domEnv';
import '../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, StateEffect, type ChangeDesc } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';

import type { TextRange } from '../ai/selectionChip';
import { translate } from '../i18n/i18n';
import { EN_MESSAGES } from '../i18n/messages';
import { docExtensions, editable, readOnlyExtensions, type DocHost } from './docExtensions';
import { createDocSession, docStateConfig, type DocSession } from './docSession';

// Ogni vista creata qui si distrugge sempre, anche se il test fallisce a metà: una vista viva tiene
// acceso il processo e lascia listener globali (il `pointerup` della barra di formattazione).
const views = new Set<EditorView>();
test.afterEach(() => {
  for (const view of views) view.destroy();
  views.clear();
  document.body.replaceChildren();
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ospite finto: registra le chiamate; `key`, `readOnly` e `saveImage` li decide il test. */
function fakeHost(patch: { key?: string; readOnly?: boolean; session?: DocSession | null; saveImage?: (file: File) => Promise<string | null> } = {}) {
  const calls: (['change', ChangeDesc, { before: string; after: string }] | ['selection', TextRange | null])[] = [];
  const state = { key: patch.key ?? 'a.md#1', readOnly: patch.readOnly ?? false };
  const host: DocHost = {
    resetKey: () => state.key,
    readOnly: () => state.readOnly,
    session: () => patch.session ?? null,
    t: () => (key) => translate(EN_MESSAGES, key),
    getDocs: () => [],
    saveImage: patch.saveImage ?? (async () => null),
    docChanged: (changes, texts) => void calls.push(['change', changes, texts]),
    selectionChanged: (range) => void calls.push(['selection', range]),
  };
  return { host, calls, state };
}

function mount(doc: string, host: DocHost, session?: DocSession) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({ parent, state: EditorState.create(session ? docStateConfig(session, docExtensions(host)) : { doc, extensions: docExtensions(host) }) });
  views.add(view);
  const done = () => {
    views.delete(view);
    view.destroy();
    parent.remove();
  };
  return { view, done };
}

test('a text change reaches the host with before and after, then the selection; the session follows', () => {
  const session = createDocSession('a.md#1', 'abc');
  const { host, calls } = fakeHost({ session });
  const { view, done } = mount('', host, session);
  view.dispatch({ changes: { from: 3, insert: 'd' }, selection: { anchor: 1, head: 4 }, userEvent: 'input.type' });
  assert.deepEqual(calls.map((c) => c[0]), ['change', 'selection']);
  const [, changes, texts] = calls[0] as ['change', ChangeDesc, { before: string; after: string }];
  assert.deepEqual(texts, { before: 'abc', after: 'abcd' });
  assert.equal(changes.length, 3);
  assert.deepEqual(calls[1], ['selection', { from: 1, to: 4 }]);
  assert.equal(session.textLf, 'abcd');
  assert.equal(session.selection?.main.head, 4);
  assert.ok(session.history);
  done();
});

test('moving the cursor reports an empty selection as null, without a text change', () => {
  const { host, calls } = fakeHost();
  const { view, done } = mount('hello', host);
  view.dispatch({ selection: { anchor: 2 } });
  assert.deepEqual(calls, [['selection', null]]);
  done();
});

test('the history saved in the session survives a new state (the other side of the review)', () => {
  const session = createDocSession('a.md#1', 'one');
  const { host } = fakeHost({ session });
  const first = mount('', host, session);
  first.view.dispatch({ changes: { from: 3, insert: ' two' }, userEvent: 'input.type' });
  first.done();
  const second = mount('', host, session);
  assert.equal(second.view.state.doc.toString(), 'one two');
  assert.equal(undo(second.view), true);
  assert.equal(second.view.state.doc.toString(), 'one');
  second.done();
});

test('read-only from the host, and the compartment that switches it', () => {
  const { host } = fakeHost({ readOnly: true });
  const { view, done } = mount('locked', host);
  assert.equal(view.state.readOnly, true);
  assert.equal(view.contentDOM.getAttribute('contenteditable'), 'false');
  view.dispatch({ effects: editable.reconfigure(readOnlyExtensions(false)) });
  assert.equal(view.state.readOnly, false);
  assert.equal(view.contentDOM.getAttribute('contenteditable'), 'true');
  done();
});

/** Incolla dei file: jsdom non ha ClipboardEvent né DataTransfer, basta un evento con `clipboardData`. */
function paste(view: EditorView, ...files: File[]): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } });
  view.contentDOM.dispatchEvent(event);
}

test('a pasted image is saved by the host and linked at the cursor', async () => {
  const saved: string[] = [];
  const { host } = fakeHost({ saveImage: async (file) => (saved.push(file.name), `assets/${file.name}`) });
  const { view, done } = mount('ab', host);
  view.dispatch({ selection: { anchor: 1 } });
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  await tick();
  assert.deepEqual(saved, ['pic.png']);
  assert.equal(view.state.doc.toString(), 'a![](assets/pic.png)\nb');
  done();
});

test('an image saved after a document change is not linked (resetKey read again)', async () => {
  let release!: (link: string) => void;
  const { host, state } = fakeHost({ saveImage: () => new Promise((resolve) => (release = resolve)) });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  state.key = 'b.md#1';
  release('assets/pic.png');
  await tick();
  assert.equal(view.state.doc.toString(), 'ab');
  done();
});

test('a paste without images is left to CodeMirror', () => {
  const { host } = fakeHost({ saveImage: async () => assert.fail('nessuna immagine da salvare') });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'notes.txt', { type: 'text/plain' }));
  assert.equal(view.state.doc.toString(), 'ab');
  done();
});

test('a view destroyed while an image is saving: no link, no further saves', async () => {
  const saving: ((link: string) => void)[] = [];
  const saved: string[] = [];
  const { host } = fakeHost({ saveImage: (file) => (saved.push(file.name), new Promise((resolve) => saving.push(resolve))) });
  const { view, done } = mount('ab', host);
  const changes: number[] = [];
  const watch = EditorView.updateListener.of((update) => void (update.docChanged && changes.push(1)));
  view.dispatch({ effects: StateEffect.appendConfig.of(watch) });
  paste(view, new File(['1'], 'one.png', { type: 'image/png' }), new File(['2'], 'two.png', { type: 'image/png' }));
  done();
  saving[0]('assets/one.png');
  await tick();
  assert.deepEqual(saved, ['one.png']);
  assert.deepEqual(changes, []);
});

test('a new state in the same view (another document, same key): the pending image is dropped', async () => {
  let release!: (link: string) => void;
  const { host } = fakeHost({ saveImage: () => new Promise((resolve) => (release = resolve)) });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  view.setState(EditorState.create({ doc: 'other', extensions: docExtensions(host) }));
  release('assets/pic.png');
  await tick();
  assert.equal(view.state.doc.toString(), 'other');
  done();
});
