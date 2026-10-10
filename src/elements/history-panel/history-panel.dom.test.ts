import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { Snapshot } from '../../history/historyStore';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { HistorySource } from './history-panel.element';

const snap = (id: number, text: string, reason: Snapshot['reason'] = 'save'): Snapshot => ({
  id, workspaceId: 'w', path: 'note.md', savedAt: Date.parse('2026-10-01T08:00:00Z') + id * 60_000, text, reason,
});

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Workspace finto: ogni richiesta resta in sospeso finché il test non la risolve, nell'ordine che vuole. */
function fakeWorkspace() {
  let state = { indexRevision: 1 };
  const listeners = new Set<() => void>();
  const requests: { path: string; resolve: (list: Snapshot[]) => void }[] = [];
  const workspace: HistorySource = {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getState: () => state,
    listHistory: (path) => new Promise((resolve) => requests.push({ path, resolve })),
  };
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const save = () => {
    state = { indexRevision: state.indexRevision + 1 };
    notify();
  };
  /** Una notifica che non cambia i salvataggi (una battuta, un toast). */
  const poke = notify;
  return { workspace, requests, save, poke, listeners: () => listeners.size };
}

function mount(path = 'note.md', currentText = 'v2') {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'history.restore': 'RIPRISTINA', 'history.title': 'STORIA {path}' } }),
      persist() {},
    }),
  );
  const ws = fakeWorkspace();
  const el = document.createElement('hmd-history-panel');
  el.workspace = ws.workspace;
  el.path = path;
  el.currentText = currentText;
  el.i18n = i18n;
  document.body.append(el);
  const restored: number[] = [];
  let closed = 0;
  el.addEventListener('hmd-history-restore', (event) => restored.push(event.detail.id));
  el.addEventListener('hmd-history-close', () => closed++);
  const versions = () => [...el.querySelectorAll<HTMLButtonElement>('.version')];
  const restore = () => el.querySelector<HTMLButtonElement>('.restore');
  return { el, i18n, listeners, ws, restored, closed: () => closed, versions, restore };
}

test('the same DOM as HistoryPanel.tsx: header with title and close, busy list while loading, the pick note', () => {
  const { el } = mount();
  const panel = el.querySelector('.panel')!;
  assert.deepEqual([...panel.children].map((c) => c.localName), ['header', 'ul', 'section']);
  assert.equal(el.querySelector('h2')!.textContent, 'History of note.md');
  const close = el.querySelector('.close')!;
  assert.equal(close.className, 'close tooltip');
  assert.equal(close.getAttribute('aria-label'), EN_MESSAGES['history.close']);
  assert.equal(close.getAttribute('data-tooltip'), EN_MESSAGES['history.close']);
  const list = el.querySelector('ul')!;
  assert.equal(list.getAttribute('aria-busy'), 'true');
  assert.equal(list.textContent, EN_MESSAGES['history.loading']);
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.pick']);
});

test('the versions arrive: one button each with date and reason; an empty history says so', async () => {
  const first = mount();
  first.ws.requests[0].resolve([snap(2, 'v2'), snap(1, 'v1', 'before-ai')]);
  await tick();
  assert.equal(first.el.querySelector('ul')!.getAttribute('aria-busy'), 'false');
  assert.deepEqual(first.versions().map((b) => b.getAttribute('aria-pressed')), ['false', 'false']);
  assert.equal(first.versions()[1].querySelector('.reason')!.textContent, EN_MESSAGES['history.reason.before-ai']);
  assert.ok(first.versions()[0].firstElementChild!.textContent);
  first.el.remove();
  const second = mount();
  second.ws.requests[0].resolve([]);
  await tick();
  const panel = second.el.querySelector('.panel')!;
  assert.deepEqual([...panel.children].map((c) => c.localName), ['header', 'p', 'ul', 'section']);
  assert.equal(panel.children[1].textContent, EN_MESSAGES['history.empty']);
});

test('picking a version shows the diff from the current text, with Restore; an identical one says so', async () => {
  const { el, ws, versions, restore, restored } = mount('note.md', 'one\nthree');
  ws.requests[0].resolve([snap(2, 'one\nthree'), snap(1, 'one\ntwo')]);
  await tick();
  versions()[1].click();
  assert.deepEqual(versions().map((b) => b.getAttribute('aria-pressed')), ['false', 'true']);
  const lines = [...el.querySelectorAll<HTMLElement>('.line')];
  assert.deepEqual(lines.map((l) => [l.dataset.kind, l.textContent]), [['same', '  one\n'], ['removed', '− three\n'], ['added', '+ two\n']]);
  assert.equal(el.querySelector('section .note')!.textContent, EN_MESSAGES['history.legend']);
  restore()!.click();
  assert.deepEqual(restored, [1]);
  versions()[0].click();
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.identical']);
  assert.equal(restore(), null);
});

test('the diff follows the current text; Restore keeps its node (and its focus) while the text changes', async () => {
  const { el, ws, versions, restore } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  const button = restore()!;
  button.focus();
  el.currentText = 'c';
  assert.equal(restore(), button);
  assert.equal(document.activeElement, button);
  assert.equal(el.querySelectorAll('.line')[0].textContent, '− c\n');
});

test('a workspace notification that changes nothing keeps the diff rows (and a text selection in them); no new diff', async () => {
  const { el, ws, versions } = mount('note.md', 'a\nb');
  // Conta le letture del testo della versione: il diff lo legge solo quando si ricalcola.
  let reads = 0;
  const version = snap(1, 'a\nc');
  const text = version.text;
  Object.defineProperty(version, 'text', { get: () => (reads++, text) });
  ws.requests[0].resolve([version]);
  await tick();
  versions()[0].click();
  const lines = el.querySelector('.lines')!;
  const first = lines.firstChild;
  const before = reads;
  assert.ok(before > 0);
  ws.poke();
  ws.poke();
  assert.equal(lines.firstChild, first);
  assert.equal(reads, before);
  el.currentText = 'a\nd';
  assert.notEqual(lines.firstChild, first);
  assert.equal(el.querySelectorAll('.line')[1].textContent, '− d\n');
});

test('Restore disappears with the focus (identical text): the focus goes to the chosen version (decision 3)', async () => {
  const { el, ws, versions, restore } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  restore()!.focus();
  el.currentText = 'b';
  assert.equal(restore(), null);
  assert.equal(document.activeElement, versions()[0]);
});

test('a save reloads the list (new version on top); a notification without a save does not', async () => {
  const { ws, versions } = mount();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  ws.poke();
  assert.equal(ws.requests.length, 1);
  ws.save();
  assert.equal(ws.requests.length, 2);
  ws.requests[1].resolve([snap(2, 'v2'), snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 2);
});

test('a late answer for an older request or another file is dropped; a new path starts from loading', async () => {
  const { el, ws, versions } = mount();
  ws.save();
  // Arriva prima la risposta nuova, poi quella vecchia: resta la nuova.
  ws.requests[1].resolve([snap(2, 'v2'), snap(1, 'v1')]);
  await tick();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 2);
  versions()[0].click();
  el.path = 'other.md';
  assert.equal(el.querySelector('ul')!.getAttribute('aria-busy'), 'true');
  assert.equal(el.querySelector('h2')!.textContent, 'History of other.md');
  assert.equal(ws.requests[2].path, 'other.md');
  ws.requests[2].resolve([]);
  await tick();
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.pick']);
});

test('a request still pending when the workspace goes away and the path changes is dropped', async () => {
  const { el, ws, versions } = mount();
  el.workspace = null;
  el.path = 'b.md';
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(el.querySelector('h2')!.textContent, 'History of b.md');
  assert.equal(versions().length, 0);
  assert.equal(el.querySelector('ul')!.getAttribute('aria-busy'), 'true');
});

test('a request still pending when the workspace changes is dropped, the new workspace is asked', async () => {
  const { el, ws, versions } = mount();
  const other = fakeWorkspace();
  el.workspace = other.workspace;
  assert.equal(other.requests.length, 1);
  ws.requests[0].resolve([snap(1, 'old'), snap(2, 'old')]);
  await tick();
  assert.equal(versions().length, 0);
  other.requests[0].resolve([snap(3, 'new')]);
  await tick();
  assert.equal(versions().length, 1);
});

test('an answer arriving after detaching does nothing; no listener left', async () => {
  const { el, ws, listeners, versions } = mount();
  el.remove();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 0);
  assert.equal(listeners(), 0);
  assert.equal(ws.listeners(), 0);
});

test('close sends hmd-history-close; language change relabels title and Restore', async () => {
  const { el, i18n, ws, versions, restore, closed } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  (el.querySelector('.close') as HTMLButtonElement).click();
  assert.equal(closed(), 1);
  await i18n.setLocale('it');
  assert.equal(el.querySelector('h2')!.textContent, 'STORIA note.md');
  assert.equal(restore()!.textContent, 'RIPRISTINA');
  // Il cambio di lingua non richiede di nuovo l'elenco.
  assert.equal(ws.requests.length, 1);
});

/** Come nell'albero: il `focusout` sincrono di Chromium alla rimozione del nodo con il focus, dentro reconcileList. */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

test('a focusout listener that asks another render and then drops the i18n store: no render without the store', async () => {
  const { el, ws, versions } = mount();
  ws.requests[0].resolve([snap(2, 'v2'), snap(1, 'v1')]);
  await tick();
  const version = versions()[1];
  version.focus();
  focusoutOnRemove(version.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.currentText = 'v3';
    el.i18n = null;
  });
  // Un altro file: l'elenco torna a «caricamento» e la versione con il focus sparisce.
  assert.doesNotThrow(() => (el.path = 'other.md'));
});
