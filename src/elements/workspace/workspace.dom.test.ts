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
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-toasts']);
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
  assert.equal(toolbar.querySelector<HTMLButtonElement>(`button[aria-label="${EN_MESSAGES['toolbar.history']}"]`)!.disabled, true);
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
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-settings', 'hmd-toasts']);
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
