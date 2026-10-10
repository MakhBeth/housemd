import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';
import type { TreeNode } from '../../ui/tree';
import type { HmdEvents } from '../events';

installPopoverStub();

// jsdom non ha requestAnimationFrame: coda a mano, svuotata dal test.
const frames: FrameRequestCallback[] = [];
Object.assign(globalThis, { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback) });
const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

const file = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'file', children: [] });
const asset = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'asset', children: [] });
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'directory', children });
const NODES = [dir('docs', [file('docs/guide.md')]), file('a.md'), file('z.md')];

test.afterEach(() => {
  document.body.replaceChildren();
  frames.length = 0;
});

function mount(nodes: TreeNode[] = NODES, openPath: string | null = null) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'tree.label': 'FILE', 'tree.rename': 'RINOMINA' } }),
      persist() {},
    }),
  );
  const el = document.createElement('hmd-file-tree');
  el.nodes = nodes;
  el.openPath = openPath;
  el.i18n = i18n;
  document.body.append(el);
  const opened: string[] = [];
  const actions: HmdEvents['hmd-tree-action']['detail'][] = [];
  el.addEventListener('hmd-open', (event) => opened.push(event.detail.path));
  el.addEventListener('hmd-tree-action', (event) => actions.push(event.detail));
  const row = (path: string) => el.querySelector<HTMLElement>(`[data-tree-item="${path}"]`);
  const trigger = (name: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${EN_MESSAGES['tree.actions'].replace('{name}', name)}"]`);
  const menu = el.querySelector<HTMLElement>('[popover]')!;
  const key = (target: Element, key: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  return { el, i18n, listeners, opened, actions, row, trigger, menu, key };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus (il crash della 4c);
 * jsdom no: qui lo si manda a mano, dentro `remove()`, cioè nel mezzo di reconcileList.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

test('the same DOM as FileTree.tsx: nav, nested lists, details for folders, buttons for files', () => {
  const { el, row } = mount();
  const nav = el.querySelector('nav')!;
  assert.equal(nav.className, 'tree');
  assert.equal(nav.getAttribute('aria-label'), EN_MESSAGES['tree.label']);
  assert.deepEqual([...nav.children].map((c) => c.localName), ['ul', 'div']);
  const summary = row('docs')!;
  assert.equal(summary.localName, 'summary');
  assert.equal(summary.className, 'row');
  assert.equal(summary.getAttribute('aria-keyshortcuts'), 'Shift+F10');
  assert.equal(summary.parentElement!.localName, 'details');
  // Anche i file dentro una cartella chiusa sono nel DOM, come con React.
  assert.equal(row('docs/guide.md')!.localName, 'button');
  assert.equal(row('a.md')!.className, 'file');
  assert.equal(row('a.md')!.parentElement!.className, 'row');
  assert.equal(row('a.md')!.textContent, 'a.md');
});

test('one tab stop: the open file, then the first row; the ⋯ buttons are never tab stops', () => {
  const { el, row } = mount(NODES, 'a.md');
  assert.deepEqual([...el.querySelectorAll('[tabindex="0"]')], [row('a.md')]);
  assert.ok([...el.querySelectorAll<HTMLElement>('[data-menu-trigger]')].every((b) => b.tabIndex === -1));
  el.openPath = null;
  assert.deepEqual([...el.querySelectorAll('[tabindex="0"]')], [row('docs')]);
});

test('the open file is marked; its ancestors open once, a folder closed afterwards stays closed', () => {
  const { el, row } = mount();
  el.openPath = 'docs/guide.md';
  const details = row('docs')!.parentElement as HTMLDetailsElement;
  assert.equal(details.open, true);
  assert.equal(row('docs/guide.md')!.getAttribute('aria-current'), 'page');
  assert.equal(row('docs/guide.md')!.parentElement!.dataset.active, 'true');
  assert.equal(row('a.md')!.parentElement!.dataset.active, 'false');
  details.open = false;
  details.dispatchEvent(new Event('toggle'));
  el.nodes = [...NODES];
  assert.equal(details.open, false);
});

test('a click on a file sends hmd-open; assets have neither button nor menu', () => {
  const { el, row, opened, trigger } = mount([file('a.md'), asset('pic.png')]);
  row('a.md')!.click();
  assert.deepEqual(opened, ['a.md']);
  assert.equal(row('pic.png'), null);
  assert.equal(trigger('pic.png'), null);
  assert.equal(el.querySelector('.asset')!.textContent, 'pic.png');
});

test('arrows move the focus; right opens a folder, left closes it; the tab stop follows the focus', () => {
  const { row, key } = mount(NODES, 'a.md');
  row('a.md')!.focus();
  key(row('a.md')!, 'Home');
  assert.equal(document.activeElement, row('docs'));
  assert.equal(row('docs')!.tabIndex, 0);
  assert.equal(row('a.md')!.tabIndex, -1);
  key(row('docs')!, 'ArrowRight');
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, true);
  key(row('docs')!, 'ArrowRight');
  assert.equal(document.activeElement, row('docs/guide.md'));
  key(row('docs/guide.md')!, 'ArrowLeft');
  assert.equal(document.activeElement, row('docs'));
  key(row('docs')!, 'ArrowLeft');
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, false);
});

test('Shift+F10 opens the menu anchored to the row ⋯, focus on the first entry; an entry sends hmd-tree-action and closes it', () => {
  const { row, trigger, menu, key, actions } = mount(NODES, 'a.md');
  row('a.md')!.focus();
  key(row('a.md')!, 'F10', { shiftKey: true });
  assert.ok(isPopoverOpen(menu));
  assert.equal(trigger('a.md')!.style.getPropertyValue('anchor-name'), '--housemd-tree-menu, --tooltip-anchor');
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['History', 'Rename', 'Delete']);
  flushFrames();
  assert.equal(document.activeElement, menu.querySelector('button'));
  (menu.querySelectorAll('button')[1] as HTMLButtonElement).click();
  assert.equal(isPopoverOpen(menu), false);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'rename');
  assert.equal(actions[0].node?.path, 'a.md');
});

test('the ⋯ of a folder: menu for folders, the folder does not toggle; another ⋯ moves the anchor', () => {
  const { trigger, menu, row } = mount();
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  trigger('docs')!.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, false);
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['New file', 'New folder', 'Rename', 'Delete']);
  assert.equal(menu.querySelector('.danger')!.textContent, 'Delete');
  trigger('a.md')!.click();
  assert.equal(trigger('docs')!.style.getPropertyValue('anchor-name'), '');
  assert.notEqual(trigger('a.md')!.style.getPropertyValue('anchor-name'), '');
});

test('menu closed with the focus lost: back on the row it was opened from', () => {
  const { row, menu, key } = mount(NODES, 'a.md');
  row('z.md')!.focus();
  key(row('z.md')!, 'ContextMenu');
  flushFrames();
  menu.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
  assert.equal(document.activeElement, row('z.md'));
});

test('the draft mark, the empty folder note, the no-files note', () => {
  const { el, row } = mount([dir('empty', []), file('a.md')]);
  el.drafts = new Set(['a.md']);
  const mark = row('a.md')!.querySelector('[role="img"]')!;
  assert.equal(mark.getAttribute('aria-label'), EN_MESSAGES['tree.draft']);
  assert.equal(mark.getAttribute('data-tooltip'), EN_MESSAGES['tree.draft']);
  assert.equal(el.querySelector('.emptyDir')!.textContent, EN_MESSAGES['tree.emptyFolder']);
  el.drafts = new Set();
  assert.equal(row('a.md')!.querySelector('[role="img"]'), null);
  el.nodes = [];
  assert.deepEqual([...el.querySelector('nav')!.children].map((c) => c.localName), ['p', 'div']);
  assert.equal(el.querySelector('nav > p')!.textContent, EN_MESSAGES['tree.noFiles']);
});

test('the row with the focus disappears: the focus goes to the tab stop row (decision 3)', () => {
  const { el, row, trigger } = mount(NODES, 'a.md');
  trigger('z.md')!.focus();
  el.nodes = [NODES[0], NODES[1]];
  assert.equal(row('z.md'), null);
  assert.equal(document.activeElement, row('a.md'));
});

test('rows are reused by path: the focused row keeps the focus across new node arrays', () => {
  const { el, row } = mount(NODES, 'a.md');
  const before = row('z.md')!;
  before.focus();
  el.nodes = [...NODES, file('zz.md')];
  assert.equal(row('z.md'), before);
  assert.equal(document.activeElement, before);
});

test('a listener that changes the nodes while handling hmd-tree-action does not break the tree', () => {
  const { el, row, key, menu } = mount(NODES, 'a.md');
  el.addEventListener('hmd-tree-action', () => {
    el.nodes = [file('a.md')];
  });
  row('z.md')!.focus();
  key(row('z.md')!, 'F10', { shiftKey: true });
  (menu.querySelectorAll('button')[2] as HTMLButtonElement).click();
  assert.equal(row('z.md'), null);
  assert.deepEqual([...el.querySelectorAll('[data-tree-item]')].map((r) => (r as HTMLElement).dataset.treeItem), ['a.md']);
});

test('a listener that changes the nodes from a focusout while a focused row is being removed: rendered once, no duplicates', () => {
  const { el, row } = mount(NODES, 'a.md');
  row('z.md')!.focus();
  focusoutOnRemove(row('z.md')!.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.nodes = [file('a.md'), file('b.md')];
  });
  el.nodes = [NODES[0], NODES[1]];
  assert.deepEqual([...el.querySelectorAll<HTMLElement>('[data-tree-item]')].map((r) => r.dataset.treeItem), ['a.md', 'b.md']);
  assert.equal(el.querySelectorAll('nav > ul > li').length, 2);
});

test('a listener that opens another menu from a focusout while the menu is being redrawn: one set of entries, the last menu', () => {
  const { el, trigger, menu } = mount(NODES, 'a.md');
  trigger('a.md')!.click();
  const history = menu.querySelector('button')!;
  history.focus();
  focusoutOnRemove(history);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    trigger('z.md')!.click();
  });
  // Il menu di una cartella toglie «Cronologia» (che ha il focus): il listener apre quello di z.md.
  trigger('docs')!.click();
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['History', 'Rename', 'Delete']);
  assert.notEqual(trigger('z.md')!.style.getPropertyValue('anchor-name'), '');
  assert.equal(trigger('docs')!.style.getPropertyValue('anchor-name'), '');
});

test('deleting the last file leaves no tab stop and does not move the focus (decision 3: no target)', () => {
  const { el, row } = mount([file('a.md'), asset('pic.png')], 'a.md');
  row('a.md')!.focus();
  assert.doesNotThrow(() => (el.nodes = [asset('pic.png')]));
  assert.equal(el.querySelector('[tabindex="0"]'), null);
  assert.equal(document.activeElement, document.body);
  el.nodes = [];
  assert.equal(el.querySelector('[tabindex="0"]'), null);
  assert.equal(document.activeElement, document.body);
  assert.equal(el.querySelector('nav > p')!.textContent, EN_MESSAGES['tree.noFiles']);
});

test('language change relabels the tree and the menu; detached, no listener left', async () => {
  const { el, i18n, listeners, menu, trigger } = mount();
  trigger('a.md')!.click();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('nav')!.getAttribute('aria-label'), 'FILE');
  assert.ok([...menu.querySelectorAll('button')].some((b) => b.textContent === 'RINOMINA'));
  el.remove();
  assert.equal(listeners(), 0);
  await tick();
});

test('the focused row disappears and a focusout listener changes the nodes again: the focus goes to the tab stop of the final tree', () => {
  const { el, row } = mount([file('a.md'), file('b.md')]);
  row('b.md')!.focus();
  focusoutOnRemove(row('b.md')!.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.nodes = [file('c.md')];
  });
  el.nodes = [file('a.md')];
  // La riga di c.md esiste solo dopo la seconda passata: il recupero va fatto lì, non nella prima.
  assert.equal(row('c.md')!.tabIndex, 0);
  assert.equal(document.activeElement, row('c.md'));
});

test('a focusout listener that asks another render and then drops the i18n store: no render without the store', () => {
  const { el, row } = mount(NODES, 'a.md');
  row('z.md')!.focus();
  focusoutOnRemove(row('z.md')!.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.nodes = [file('a.md')];
    el.i18n = null;
  });
  assert.doesNotThrow(() => (el.nodes = [NODES[0], NODES[1]]));
});

test('a focusout listener that detaches the tree while a menu opens: no popover, no focus scheduled', () => {
  const { el, trigger, menu } = mount(NODES, 'a.md');
  trigger('a.md')!.click();
  flushFrames();
  const history = menu.querySelector('button')!;
  assert.equal(document.activeElement, history);
  focusoutOnRemove(history);
  el.addEventListener('focusout', () => el.remove(), { once: true });
  // Un'eccezione in un listener di click jsdom non la rilancia: la segnala con un ErrorEvent su window.
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    errors.push(event.error);
  };
  window.addEventListener('error', onError);
  let shown = 0;
  const show = menu.showPopover;
  menu.showPopover = function (this: HTMLElement) {
    shown++;
    show.call(this);
  };
  // Il menu di una cartella toglie «Cronologia» (che ha il focus): il listener stacca l'albero.
  trigger('docs')!.click();
  window.removeEventListener('error', onError);
  assert.deepEqual(errors, []);
  assert.equal(el.isConnected, false);
  assert.equal(shown, 0);
  assert.equal(frames.length, 0);
});

test('a folder opened by a click keeps open if a render arrives before its toggle event', () => {
  const { el, row } = mount();
  const details = row('docs')!.parentElement as HTMLDetailsElement;
  // Il clic sul <summary> apre subito; il toggle arriva in un task dopo, e nel mezzo una notifica ridisegna.
  details.open = true;
  el.nodes = [...NODES];
  assert.equal(details.open, true);
  details.dispatchEvent(new Event('toggle'));
  el.nodes = [...NODES];
  assert.equal(details.open, true);
});
