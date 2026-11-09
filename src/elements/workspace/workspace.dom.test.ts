import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { countListeners } from '../../testing/countListeners';
import { installMemoryStorage } from '../../testing/memoryStorage';
const storage = installMemoryStorage();

import '../define';
import type { AiController } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { SyncBinding } from '../../ai/syncBinding';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { memoryOps } from '../../fs/testing/memoryOps';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createRouteStore, type RouteWindow } from '../../state/routeStore';
import { createThemeStore } from '../../state/themeStore';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';
import { memoryBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';
import type { HmdWorkspace } from './workspace.element';

installDialogStub();
installPopoverStub();
window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom non ha ResizeObserver (l'anteprima lo usa per le ancore): basta che esista.
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });

test.afterEach(() => {
  document.body.replaceChildren();
  storage.clear();
});

/** Finestra finta della rotta: l'hash e i suoi listener. */
function routeWindow(): RouteWindow & { hashValue: string } {
  const listeners = new Set<() => void>();
  const win = {
    hashValue: '',
    hash: () => win.hashValue,
    pushState: (url: string) => void (win.hashValue = url.startsWith('#') ? url : ''),
    replaceState: (url: string) => void (win.hashValue = url.startsWith('#') ? url : ''),
    back: () => {
      win.hashValue = '';
      listeners.forEach((l) => l());
    },
    setHash: (hash: string) => {
      win.hashValue = hash;
      listeners.forEach((l) => l());
    },
    cleanUrl: () => '/',
    onHashChange: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
  };
  return win;
}

async function mount(options: { files?: Record<string, string>; ai?: boolean; lastFile?: string } = {}) {
  const ops = memoryOps();
  for (const [path, text] of Object.entries(options.files ?? { 'a.md': '# A', 'b.md': '# B' })) ops.setFile(path, text);
  const workspace = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: 'ws', name: 'notes', buffers: memoryBufferStore() });
  await workspace.load();
  if (options.lastFile) storage.set('housemd:lastFile:ws', JSON.stringify(options.lastFile));
  const counted = countListeners(createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} }));
  const i18n = counted.store;
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const win = routeWindow();
  const countedRoute = countListeners(createRouteStore(win));
  const route = countedRoute.store;
  const ai = fakeAi({ profiles: [defaultProfile()] }, defaultProfile());
  const documents: string[] = [];
  Object.assign(ai, {
    documentChanged: (path: string, _c: unknown, reset: boolean) => void documents.push(`${path}:${reset}`),
    hasPendingWork: () => false,
    clearError: () => {},
    reload: async () => {},
    store: { getMeta: async () => null, setMeta: async () => {} },
  });
  let closed = 0;
  const el = document.createElement('hmd-workspace') as HmdWorkspace;
  el.openAi = async () => (options.ai ? { controller: ai as unknown as AiController, close: () => void closed++ } : null);
  el.syncFor = () => ({ subscribe: () => () => {}, getState: () => ({ sync: null, handle: null, permission: false }), needsPermission: false, dispose() {} }) as unknown as SyncBinding;
  el.workspaceId = 'ws';
  el.handle = null;
  el.i18n = i18n;
  el.theme = theme;
  el.route = route;
  el.workspace = workspace;
  document.body.append(el);
  if (options.ai) await waitFor(() => !!el.querySelector('[aria-label="' + EN_MESSAGES['mode.ai'] + '"]'));
  const button = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const listeners = () => counted.listeners() + countedRoute.listeners();
  return { el, workspace, ops, ai, route, win, documents, button, listeners, closed: () => closed };
}

test('the same DOM as WorkspaceView.tsx with no file open: layout with sidebar, separator and main, then the toasts', async () => {
  const { el } = await mount();
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-toasts', 'p']);
  const layout = el.firstElementChild as HTMLElement;
  assert.equal(layout.className, 'layout');
  assert.equal(layout.style.gridTemplateColumns, '280px 5px minmax(0, 1fr)');
  assert.deepEqual([...layout.children].map((c) => `${c.localName}.${c.className}`), ['aside.sidebar', 'div.resizer', 'main.main']);
  const aside = layout.firstElementChild!;
  assert.deepEqual([...aside.children].map((c) => c.localName), ['div', 'hmd-search-panel', 'hmd-file-tree']);
  const main = layout.lastElementChild!;
  assert.deepEqual([...main.children].map((c) => `${c.localName}.${c.className}`), ['header.toolbar', 'div.empty']);
  const toolbar = main.firstElementChild!;
  assert.deepEqual([...toolbar.children].map((c) => c.className), ['lead', 'modes', 'actions']);
  assert.deepEqual([...toolbar.querySelectorAll('.modes button')].map((b) => b.getAttribute('aria-label')), [EN_MESSAGES['mode.editor'], EN_MESSAGES['mode.split'], EN_MESSAGES['mode.preview']]);
  assert.equal(toolbar.querySelector<HTMLButtonElement>(`button[aria-label="${EN_MESSAGES['toolbar.history']}"]`)!.disabled, false);
  assert.equal(document.title, 'HouseMD');
});

test('a file opened: split panes with the editor and the preview, the path, the title; preview only drops the editor', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  const panes = el.querySelector('.panes')!;
  assert.equal(panes.getAttribute('data-mode'), 'split');
  assert.deepEqual([...panes.children].map((c) => `${c.getAttribute('aria-label')}>${c.firstElementChild!.localName}`), [`${EN_MESSAGES['pane.editor']}>hmd-editor`, `${EN_MESSAGES['pane.preview']}>hmd-preview`]);
  assert.equal(el.querySelector('.path')!.textContent, 'a.md');
  assert.equal(document.title, 'HMD - a.md');
  const editor = panes.querySelector('hmd-editor');
  button(EN_MESSAGES['mode.preview']).click();
  assert.deepEqual([...panes.children].map((c) => c.firstElementChild!.localName), ['hmd-preview']);
  // Tornando alla vista divisa l'editor è un elemento nuovo, come quando React lo rimontava.
  button(EN_MESSAGES['mode.split']).click();
  assert.ok(panes.querySelector('hmd-editor') !== editor, 'a new editor');
  assert.equal(storage.get('housemd:mode'), '"split"');
});

test('the last file of the folder is reopened once', async () => {
  const { el } = await mount({ lastFile: 'b.md' });
  await waitFor(() => el.querySelector('.path')!.textContent === 'b.md');
});

test('the settings come from the route: on top of an inert layout, the title follows, closing brings the focus back', async () => {
  const { el, button, route } = await mount();
  const settingsButton = button(EN_MESSAGES['toolbar.settings']);
  settingsButton.focus();
  settingsButton.click();
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-settings', 'hmd-toasts', 'p']);
  assert.equal((el.firstElementChild as HTMLElement).inert, true);
  assert.equal(document.title, `HMD - ${EN_MESSAGES['settings.title']}`);
  el.querySelector<HTMLButtonElement>('hmd-settings .navHeader button')!.click();
  assert.equal(route.getState().view, 'workspace');
  assert.equal(el.querySelector('hmd-settings'), null);
  assert.equal((el.firstElementChild as HTMLElement).inert, false);
  assert.ok(document.activeElement === settingsButton, 'focus back on the settings button');
});

test('shortcuts on the window: Ctrl+B toggles the sidebar and is remembered; detached, nothing listens', async () => {
  const { el } = await mount();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  assert.equal(el.querySelector('aside'), null);
  assert.equal((el.firstElementChild as HTMLElement).style.gridTemplateColumns, 'minmax(0, 1fr)');
  assert.equal(storage.get('housemd:sidebarOpen'), 'false');
  el.remove();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  assert.equal(storage.get('housemd:sidebarOpen'), 'false');
});

/** Percorsi dei nodi (cartelle comprese) dell'albero dei file, o null se la sidebar è nascosta. */
function treePaths(el: HTMLElement): string[] | null {
  const tree = el.querySelector('hmd-file-tree') as (HTMLElement & { nodes: { path: string }[] }) | null;
  return tree ? tree.nodes.map((n) => n.path) : null;
}

const toggleSidebar = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));

test('a file created while the sidebar is hidden is in the tree when the sidebar comes back', async () => {
  const { el, workspace } = await mount();
  await workspace.openFile('a.md');
  toggleSidebar();
  assert.equal(el.querySelector('aside'), null);
  await workspace.createFile('c.md', 'C');
  assert.ok(workspace.getState().entries.some((e) => e.path === 'c.md'));
  toggleSidebar();
  assert.ok(treePaths(el)!.includes('c.md'), 'c.md in the tree');
});

test('an external change found while the sidebar is hidden is in the tree when the sidebar comes back', async () => {
  const { el, workspace, ops } = await mount();
  await workspace.openFile('a.md');
  toggleSidebar();
  ops.setFile('d.md', 'D');
  await workspace.checkExternal();
  assert.ok(workspace.getState().entries.some((e) => e.path === 'd.md'));
  toggleSidebar();
  assert.ok(treePaths(el)!.includes('d.md'), 'd.md in the tree');
});

test('the separator: arrows resize the panel and save the width', async () => {
  const { el } = await mount();
  const separator = el.querySelector<HTMLElement>('[role="separator"]')!;
  assert.equal(separator.getAttribute('aria-valuenow'), '280');
  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(separator.getAttribute('aria-valuenow'), '296');
  assert.equal(storage.get('housemd:sidebarWidth'), '296');
});

test('beforeunload asks only with text in memory', async () => {
  const { workspace } = await mount();
  await workspace.openFile('a.md');
  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  assert.equal(clean.defaultPrevented, false);
  workspace.edit('# A changed');
  const dirty = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirty);
  assert.equal(dirty.defaultPrevented, true);
});

test('with the AI session: four modes, AI mode shows the AI sidebar and the review, the chat hears about the document', async () => {
  const { el, workspace, button, documents } = await mount({ ai: true });
  await workspace.openFile('a.md');
  assert.deepEqual(documents, ['a.md:true']);
  button(EN_MESSAGES['mode.ai']).click();
  assert.deepEqual([...el.querySelector('aside')!.children].map((c) => c.localName), ['hmd-ai-sidebar']);
  const review = el.querySelector('hmd-ai-review')!;
  assert.ok(review);
  // Un doc nuovo a ogni notifica dello workspace: la revisione rilegge canAccept (conflitto, aggiornamento).
  const before = review.doc;
  workspace.dismissToast(-1);
  workspace.edit('# A!');
  assert.ok(review.doc !== before, 'a new doc object');
});

test('detached: the AI session is closed and the title goes back to the app name', async () => {
  const { el, workspace, closed } = await mount({ ai: true });
  await workspace.openFile('a.md');
  el.remove();
  assert.equal(closed(), 1);
  assert.equal(document.title, 'HouseMD');
});

test('detached: no store or window listener is left', async () => {
  const { el, workspace, listeners } = await mount({ ai: true });
  await workspace.openFile('a.md');
  workspace.edit('# A changed');
  assert.ok(listeners() > 0);
  el.remove();
  assert.equal(listeners(), 0);
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, false);
});

test('the focus never falls on the body when the sidebar goes: Hide sidebar and Ctrl+B to the toolbar toggle, AI mode to its button', async () => {
  const { el, workspace, button } = await mount({ ai: true });
  await workspace.openFile('a.md');
  const focusOn = (node: Element | null, what: string) => assert.ok(node !== null && document.activeElement === node, `${what}, not ${document.activeElement?.localName}`);
  // «Hide sidebar» dentro la sidebar: il pulsante sparisce con lei.
  const hide = el.querySelector<HTMLButtonElement>(`aside button[aria-label="${EN_MESSAGES['sidebar.hide']}"]`)!;
  hide.focus();
  hide.click();
  assert.equal(el.querySelector('aside'), null);
  focusOn(button(EN_MESSAGES['sidebar.show']), 'Show sidebar in the toolbar');
  // Ctrl+B con il focus nella ricerca.
  toggleSidebar();
  el.querySelector<HTMLInputElement>('hmd-search-panel input')!.focus();
  toggleSidebar();
  focusOn(button(EN_MESSAGES['sidebar.show']), 'Show sidebar after Ctrl+B');
  // Modalità AI con il focus nell'albero: l'albero lascia il posto alla chat.
  toggleSidebar();
  el.querySelector<HTMLElement>('hmd-file-tree [tabindex="0"]')!.focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }));
  assert.ok(el.querySelector('hmd-ai-sidebar'));
  focusOn(button(EN_MESSAGES['mode.ai']), 'the AI mode button');
  // Con il focus fuori dalla sidebar non si sposta niente.
  button(EN_MESSAGES['mode.split']).focus();
  button(EN_MESSAGES['mode.split']).click();
  toggleSidebar();
  focusOn(button(EN_MESSAGES['mode.split']), 'the button that had it');
});

test('the separator: Home and End take the panel to its minimum and maximum', async () => {
  const { el } = await mount();
  const separator = el.querySelector<HTMLElement>('[role="separator"]')!;
  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(separator.getAttribute('aria-valuenow'), '180');
  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(separator.getAttribute('aria-valuenow'), '480');
  assert.equal(storage.get('housemd:sidebarWidth'), '480');
});

test('leaving AI mode with the focus in the chat (Ctrl+Shift+E): the focus goes to the tree, not to Hide sidebar', async () => {
  const { el, workspace, button } = await mount({ ai: true });
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.ai']).click();
  el.querySelector<HTMLTextAreaElement>('hmd-ai-composer textarea')!.focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }));
  assert.ok(el.querySelector('hmd-file-tree'));
  const row = el.querySelector('hmd-file-tree [tabindex="0"]');
  assert.ok(row !== null && document.activeElement === row, `the tree row with the tab stop, not ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.localName}`);
});

test('AI mode: the draft of the composer survives going to the editor and back (LAB-10)', async () => {
  const { el, workspace, button } = await mount({ ai: true });
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.ai']).click();
  const box = () => el.querySelector<HTMLTextAreaElement>('hmd-ai-composer textarea')!;
  box().value = 'fix the title';
  box().dispatchEvent(new Event('input', { bubbles: true }));
  button(EN_MESSAGES['mode.editor']).click();
  assert.equal(el.querySelector('hmd-ai-composer'), null);
  button(EN_MESSAGES['mode.ai']).click();
  assert.equal(box().value, 'fix the title');
});

test('History with no document open: never disabled, says why in a status right after the toolbar, keeps the focus, goes away when a file opens', async () => {
  const { el, workspace, button } = await mount();
  const history = button(EN_MESSAGES['toolbar.history']);
  const note = () => el.querySelector<HTMLElement>('main > p.note.toolbarNote[role="status"]');
  assert.equal(history.hasAttribute('aria-disabled'), false);
  assert.equal(note(), null, 'la nota entra su richiesta');
  history.focus();
  history.click();
  assert.equal(el.querySelector('header.toolbar')!.nextElementSibling, note());
  await waitFor(() => note()!.textContent === EN_MESSAGES['toolbar.history.noDocument']);
  assert.equal(document.activeElement, history);
  assert.equal(el.querySelector('.panes'), null);
  history.click();
  assert.equal(note()!.textContent, '');
  await waitFor(() => note()!.textContent === EN_MESSAGES['toolbar.history.noDocument']);
  await workspace.openFile('a.md');
  assert.equal(note(), null);
  assert.equal(history.getAttribute('aria-pressed'), 'false');
});

test('History with no document in AI mode: the mode does not change, only the note', async () => {
  const { el, button } = await mount({ ai: true });
  button(EN_MESSAGES['mode.ai']).click();
  assert.equal(button(EN_MESSAGES['mode.ai']).getAttribute('aria-pressed'), 'true');
  button(EN_MESSAGES['toolbar.history']).click();
  await waitFor(() => el.querySelector('.toolbarNote')?.textContent === EN_MESSAGES['toolbar.history.noDocument']);
  assert.equal(button(EN_MESSAGES['mode.ai']).getAttribute('aria-pressed'), 'true');
});

test('the folder during a switch: never disabled, data-busy, the note after the sidebar header, no second change; it goes away at the end', async () => {
  const { el } = await mount();
  let changes = 0;
  el.addEventListener('hmd-workspace-change-folder', () => changes++);
  const folder = el.querySelector<HTMLButtonElement>('.folder')!;
  const note = () => el.querySelector<HTMLElement>('aside > p.note.sidebarNote[role="status"]');
  assert.equal(folder.disabled, false);
  assert.equal(note(), null);
  folder.focus();
  folder.click();
  assert.equal(changes, 1);
  el.switchingFolder = true;
  assert.equal(folder.disabled, false);
  assert.equal(folder.hasAttribute('data-busy'), true);
  assert.equal(note(), null, 'la nota non parte da sola');
  folder.click();
  assert.equal(changes, 1);
  assert.equal(el.querySelector('.sidebarHeader')!.nextElementSibling, note());
  await waitFor(() => note()!.textContent === EN_MESSAGES['folder.opening']);
  assert.equal(document.activeElement, folder);
  el.switchingFolder = false;
  assert.equal(note(), null);
  assert.equal(folder.hasAttribute('data-busy'), false);
  assert.equal(document.activeElement, folder);
});

test('the focus button sits between Save all and the theme, toggles aria-pressed, is never disabled and keeps the preference', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  const focus = button(EN_MESSAGES['toolbar.focus']);
  const actions = [...el.querySelectorAll('.actions > *')];
  assert.equal(actions.indexOf(focus), actions.indexOf(button(EN_MESSAGES['toolbar.saveAll'])) + 1);
  assert.equal(focus.getAttribute('aria-pressed'), 'false');
  focus.click();
  assert.equal(focus.getAttribute('aria-pressed'), 'true');
  assert.equal(focus.disabled, false);
  assert.equal(storage.get('housemd:focusMode'), 'true');
  assert.equal(el.querySelector<HTMLElement & { focusMode: boolean }>('hmd-editor')!.focusMode, true);
  // In Anteprima il pulsante resta attivo e una nota lo spiega, solo se lo si accende lì.
  button(EN_MESSAGES['mode.preview']).click();
  assert.equal(el.querySelectorAll('p.toolbarNote[role=status]:not(:empty)').length, 0, 'already on: no note');
  focus.click();
  focus.click();
  assert.equal(focus.getAttribute('aria-pressed'), 'true');
  assert.equal(storage.get('housemd:focusMode'), 'true');
});

test('settings: changing only the unit does not rewrite the focus note, and the typewriter is saved and reaches the editor', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.preview']).click();
  button(EN_MESSAGES['toolbar.focus']).click();
  const note = () => el.querySelector('p.toolbarNote')!;
  await waitFor(() => note().textContent === EN_MESSAGES['toolbar.focus.elsewhere']);
  button(EN_MESSAGES['toolbar.settings']).click();
  const settings = el.querySelector('hmd-settings')!;
  const send = (detail: { focus: boolean; unit: 'paragraph' | 'sentence'; typewriter: boolean }) => settings.dispatchEvent(new CustomEvent('hmd-settings-focus', { bubbles: true, detail }));
  // Solo l'unità: l'annuncio non riparte (con la nota svuotata e riscritta dopo il ritardo il testo sparirebbe).
  send({ focus: true, unit: 'sentence', typewriter: false });
  await Promise.resolve();
  assert.equal(note().textContent, EN_MESSAGES['toolbar.focus.elsewhere'], 'unit only: the note is not rewritten');
  send({ focus: true, unit: 'sentence', typewriter: true });
  assert.equal(storage.get('housemd:typewriter'), 'true');
  assert.equal(storage.get('housemd:focusUnit'), '"sentence"');
  el.querySelector<HTMLButtonElement>('hmd-settings .navHeader button')!.click();
  button(EN_MESSAGES['mode.split']).click();
  assert.equal(el.querySelector<HTMLElement & { typewriter: boolean }>('hmd-editor')!.typewriter, true);
});

test('Ctrl+Shift+F over the preview writes only the note: the hidden status stays empty (no double announcement)', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.preview']).click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, cancelable: true }));
  await waitFor(() => el.querySelector('p.toolbarNote')!.textContent === EN_MESSAGES['toolbar.focus.elsewhere']);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(el.querySelector('p.visually-hidden')!.textContent, '');
});

test('Ctrl+Shift+F toggles the focus and announces it once in a hidden status region', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, cancelable: true }));
  assert.equal(button(EN_MESSAGES['toolbar.focus']).getAttribute('aria-pressed'), 'true');
  await waitFor(() => el.querySelector('p.visually-hidden')!.textContent === EN_MESSAGES['focus.announce.on']);
  assert.equal(el.querySelector('p.visually-hidden')!.getAttribute('role'), 'status');
});
