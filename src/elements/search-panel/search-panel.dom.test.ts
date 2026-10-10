import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import type { SearchResult } from '../../search/searchIndex';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { SearchSource } from './search-panel.element';

const result = (path: string, snippet = `about ${path}`, terms = ['about']): SearchResult => ({ path, title: path.toUpperCase(), snippet, terms });

test.beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
test.afterEach(() => {
  mock.timers.reset();
  document.body.replaceChildren();
});

/** Indice finto: risultati decisi dal test per ogni query; registra le query cercate. */
function fakeIndex(table: Record<string, SearchResult[]>) {
  const queries: string[] = [];
  const index: SearchSource = { search: (query) => (queries.push(query), table[query] ?? []) };
  return { index, queries, table };
}

/** Come nell'albero: il `focusout` sincrono di Chromium alla rimozione del nodo con il focus, dentro reconcileList. */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

function mount(table: Record<string, SearchResult[]> = { fox: [result('a.md'), result('b.md')] }) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'search.label': 'CERCA', 'search.none': 'NIENTE' } }),
      persist() {},
    }),
  );
  const fake = fakeIndex(table);
  const el = document.createElement('hmd-search-panel');
  el.index = fake.index;
  el.indexRevision = 1;
  el.i18n = i18n;
  document.body.append(el);
  const opened: { path: string; terms: string[] }[] = [];
  el.addEventListener('hmd-search-open', (event) => opened.push(event.detail));
  const input = el.querySelector('input')!;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (key: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('.result')];
  return { el, i18n, listeners, fake, opened, input, type, key, buttons };
}

test('the same DOM as SearchPanel.tsx: role=search box, icon, labelled search input, no list', () => {
  const { el, input } = mount();
  const box = el.querySelector('.search')!;
  assert.equal(box.getAttribute('role'), 'search');
  assert.deepEqual([...box.children].map((c) => c.localName), ['span', 'input']);
  assert.equal(box.firstElementChild!.className, 'icon searchIcon');
  assert.equal(input.type, 'search');
  assert.equal(input.className, 'input');
  assert.equal(input.getAttribute('aria-label'), EN_MESSAGES['search.label']);
  assert.equal(input.getAttribute('placeholder'), EN_MESSAGES['search.placeholder']);
  assert.equal(el.querySelector('ul'), null);
});

test('results 120 ms after the last key, with marks in the snippet', () => {
  const { el, type, buttons, fake } = mount({ fox: [result('a.md', 'the fox runs', ['fox'])] });
  type('fo');
  type('fox');
  // Prima della pausa: l'elenco c'è (query non vuota) con i risultati di prima, cioè nessuno.
  assert.equal(el.querySelector('ul')!.getAttribute('aria-label'), EN_MESSAGES['search.results']);
  assert.equal(el.querySelector('.none')!.textContent, EN_MESSAGES['search.none']);
  mock.timers.tick(119);
  assert.deepEqual(fake.queries, []);
  mock.timers.tick(1);
  assert.deepEqual(fake.queries, ['fox']);
  assert.equal(el.querySelector('.none'), null);
  const [button] = buttons();
  assert.deepEqual([...button.children].map((c) => c.className), ['title', 'path', 'snippet']);
  assert.equal(button.querySelector('.title')!.textContent, 'A.MD');
  assert.deepEqual([...button.querySelector('.snippet')!.childNodes].map((n) => [n.nodeName, n.textContent]), [['#text', 'the '], ['MARK', 'fox'], ['#text', ' runs']]);
});

test('a new index revision searches again after the pause; the field is never replaced', () => {
  const { el, type, buttons, fake, input } = mount({ fox: [] });
  type('fox');
  mock.timers.tick(120);
  assert.equal(buttons().length, 0);
  fake.table.fox = [result('new.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(buttons().length, 1);
  assert.equal(el.querySelector('input'), input);
  assert.equal(input.value, 'fox');
});

test('Enter opens the first result at once, without waiting; with no result nothing', () => {
  const { type, key, opened } = mount();
  type('fox');
  key('Enter');
  assert.deepEqual(opened, [{ path: 'a.md', terms: ['about'] }]);
  type('zzz');
  key('Enter');
  assert.equal(opened.length, 1);
});

test('a click on a result sends hmd-search-open with its terms', () => {
  const { type, buttons, opened } = mount();
  type('fox');
  mock.timers.tick(120);
  buttons()[1].click();
  assert.deepEqual(opened, [{ path: 'b.md', terms: ['about'] }]);
});

test('Esc empties the field and removes the list', () => {
  const { el, type, key, input } = mount();
  type('fox');
  mock.timers.tick(120);
  key('Escape');
  assert.equal(input.value, '');
  assert.equal(el.querySelector('ul'), null);
});

test('result rows are reused by path: the focused result keeps the focus', () => {
  const { el, type, buttons, fake } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  fake.table.fox = [result('b.md'), result('c.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(buttons()[0], b);
  assert.equal(document.activeElement, b);
});

test('the focused result disappears: the focus goes back to the field (decision 3)', () => {
  const { el, type, buttons, fake, input } = mount();
  type('fox');
  mock.timers.tick(120);
  buttons()[0].focus();
  fake.table.fox = [];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(document.activeElement, input);
});

test('a listener that empties the query from a focusout while a focused result is being removed: no list left', () => {
  const { el, type, buttons, fake, key, input } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  focusoutOnRemove(b.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    key('Escape');
  });
  fake.table.fox = [result('a.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  // Esc arriva nel mezzo del render: alla fine la query è vuota e l'elenco non c'è (niente righe rimaste).
  assert.equal(input.value, '');
  assert.equal(el.querySelector('ul'), null);
  assert.equal(el.querySelectorAll('li').length, 0);
});

test('typed, detached before the pause and attached again: the pending search runs once', () => {
  const { el, type, fake } = mount();
  type('fox');
  mock.timers.tick(60);
  el.remove();
  mock.timers.tick(120);
  document.body.append(el);
  mock.timers.tick(119);
  assert.deepEqual(fake.queries, []);
  mock.timers.tick(1);
  assert.deepEqual(fake.queries, ['fox']);
  assert.equal(el.querySelectorAll('.result').length, 2);
});

test('a new index revision while detached searches after attaching again; a language change alone starts nothing', async () => {
  const { el, type, fake, i18n } = mount();
  type('fox');
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox']);
  el.remove();
  el.indexRevision = 5;
  document.body.append(el);
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox', 'fox']);
  await i18n.setLocale('it');
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox', 'fox']);
});

test('focusInput() puts the focus in the field', () => {
  const { el, input } = mount();
  el.focusInput();
  assert.equal(document.activeElement, input);
});

test('a pending search after detaching does nothing; no listener left', () => {
  const { el, type, fake, listeners } = mount();
  type('fox');
  el.remove();
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, []);
  assert.equal(listeners(), 0);
});

test('language change relabels the field and the "none" row, keeping what was typed', async () => {
  const { el, i18n, type, input } = mount({});
  type('zzz');
  await i18n.setLocale('it');
  assert.equal(input.getAttribute('aria-label'), 'CERCA');
  assert.equal(el.querySelector('.none')!.textContent, 'NIENTE');
  assert.equal(el.querySelector('input'), input);
  assert.equal(input.value, 'zzz');
});

test('a focusout listener that asks another render and then drops the i18n store: no render without the store', () => {
  const { el, type, buttons, fake, key } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  focusoutOnRemove(b.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    key('Escape');
    el.i18n = null;
  });
  fake.table.fox = [result('a.md')];
  el.indexRevision = 2;
  assert.doesNotThrow(() => mock.timers.tick(120));
});

test('the query emptied by a listener while the focus stays on a result: the list goes and the focus goes back to the field', () => {
  const { el, type, buttons, fake, key, input } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  // Un listener sincrono durante la riconciliazione (qui alla rimozione di un altro risultato) svuota la query:
  // la seconda passata toglie l'elenco con il risultato che ha il focus.
  focusoutOnRemove(buttons()[0].closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    key('Escape');
  });
  fake.table.fox = [result('b.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(el.querySelector('ul'), null);
  assert.equal(document.activeElement, input);
});
