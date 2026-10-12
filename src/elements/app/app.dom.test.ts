import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../../testing/memoryStorage';
installMemoryStorage();

import '../define';
import type { StoredWorkspace } from '../../fs/handleStore';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { memoryOps } from '../../fs/testing/memoryOps';
import { EN_MESSAGES } from '../../i18n/messages';
import type { UpdateFlow } from '../../pwa/updateFlow';
import { createI18nStore } from '../../state/i18nStore';
import { createRouteStore } from '../../state/routeStore';
import { createThemeStore } from '../../state/themeStore';
import { installDialogStub } from '../../testing/dialogStub';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';
import { memoryBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';
import type { HmdApp } from './app.element';
import type { AppDeps } from './appDeps';

installDialogStub();
installPopoverStub();
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });
test.afterEach(() => document.body.replaceChildren());

const handle = (name: string) => ({ name, isSameEntry: async () => false }) as unknown as FileSystemDirectoryHandle;

function deps(overrides: Partial<AppDeps> = {}) {
  const log: string[] = [];
  let blocked: (() => void) | null = null;
  const opened: Workspace[] = [];
  const d: AppDeps = {
    isSupported: () => true,
    unsupportedReason: () => 'firefox',
    loadWorkspace: async () => null,
    hasAccess: async () => true,
    requestAccess: async () => true,
    pickFolder: async () => handle('picked'),
    knownWorkspaceId: async () => null,
    saveWorkspace: async (stored) => void log.push(`save ${stored.handle.name}`),
    async openWorkspace(stored: StoredWorkspace) {
      const ops = memoryOps();
      ops.setFile('a.md', '# A');
      const workspace = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: stored.workspaceId, name: stored.handle.name, buffers: memoryBufferStore() });
      await workspace.load();
      opened.push(workspace);
      return workspace;
    },
    onDbBlocked: (listener) => ((blocked = listener), () => void (blocked = null)),
    setUpdateWorkspace: (workspace) => void log.push(`update ${workspace ? 'open' : 'none'}`),
    ...overrides,
  };
  return { deps: d, log, opened, block: () => blocked?.() };
}

function mount(d: AppDeps) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const el = document.createElement('hmd-app') as HmdApp;
  el.deps = d;
  el.updates = { subscribe: () => () => {}, getState: () => ({ kind: 'idle' }) } as unknown as UpdateFlow;
  el.i18n = i18n;
  el.theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  el.route = createRouteStore({ hash: () => '', pushState() {}, replaceState() {}, back() {}, setHash() {}, cleanUrl: () => '/', onHashChange: () => () => {} });
  document.body.append(el);
  return el;
}

const kinds = (el: Element) => [...el.children].map((c) => c.localName);

test('an unsupported browser: the start screen in its unsupported mode, and the update notice', () => {
  const el = mount(deps({ isSupported: () => false }).deps);
  assert.equal(el.screen, 'unsupported');
  assert.deepEqual(kinds(el), ['hmd-start-screen', 'hmd-update-notice']);
  assert.equal(el.querySelector('hmd-start-screen')!.mode, 'unsupported');
});

test('no saved folder: the start screen; picking a folder opens it, saves it and tells the update flow', async () => {
  const { deps: d, log } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  const start = el.querySelector('hmd-start-screen')!;
  start.dispatchEvent(new CustomEvent('hmd-start-pick', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
  assert.deepEqual(kinds(el), ['hmd-workspace', 'hmd-update-notice']);
  assert.deepEqual(log, ['update none', 'save picked', 'update open']);
});

test('a saved folder without permission: resume; granted, the folder opens', async () => {
  const el = mount(deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false }).deps);
  await waitFor(() => el.screen === 'resume');
  assert.equal(el.querySelector('hmd-start-screen')!.folderName, 'notes');
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-resume', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
});

test('changing folder from the workspace makes a new hmd-workspace (also for the same folder) and disposes the old one', async () => {
  const { deps: d, opened } = deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) });
  const el = mount(d);
  await waitFor(() => el.screen === 'open');
  const first = el.querySelector('hmd-workspace')!;
  first.dispatchEvent(new CustomEvent('hmd-workspace-change-folder', { bubbles: true, detail: null }));
  await waitFor(() => el.querySelector('hmd-workspace') !== first && !!el.querySelector('hmd-workspace'));
  assert.equal(opened.length, 2);
  assert.equal(first.isConnected, false);
});

test('a blocked database shows the dismissible notice at the top; dismissed, it goes', async () => {
  const { deps: d, block } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  block();
  const notice = el.querySelector('hmd-notice')!;
  assert.equal(notice.message, EN_MESSAGES['toast.reloadOtherTabs']);
  assert.equal(notice.placement, 'top');
  notice.dispatchEvent(new CustomEvent('hmd-notice-dismiss', { bubbles: true, detail: null }));
  assert.equal(el.querySelector('hmd-notice'), null);
});

test('detached while the folder is opening: the folder opened afterwards is disposed', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const disposed: string[] = [];
  const { deps: d } = deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) });
  const open = d.openWorkspace;
  let opening = false;
  d.openWorkspace = async (stored) => {
    opening = true;
    await gate;
    const w = await open(stored);
    const dispose = w.dispose.bind(w);
    w.dispose = () => (disposed.push('w'), dispose());
    return w;
  };
  const el = mount(d);
  await waitFor(() => opening);
  el.remove();
  release();
  await waitFor(() => disposed.length === 1);
  assert.equal(el.screen, 'boot');
});
