import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../../testing/memoryStorage';
installMemoryStorage();

import '../define';
import type { StoredWorkspace } from '../../fs/handleStore';
import { memoryFile, singleFileOps, type SingleFile } from '../../fs/singleFile';
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
  let launch: ((file: SingleFile) => void) | null = null;
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
    pickFile: async () => textFile('note.md', '# Note'),
    async openFileWorkspace(file, workspaceId) {
      log.push(`file ${file.name}`);
      const workspace = new Workspace({ fs: createWorkspaceFS(singleFileOps(file)), workspaceId, name: file.name, buffers: memoryBufferStore() });
      await workspace.load();
      opened.push(workspace);
      return workspace;
    },
    listRecoverable: async () => [],
    recoverFile: async () => null,
    onLaunchFile: (listener) => void (launch = listener),
    onDbBlocked: (listener) => ((blocked = listener), () => void (blocked = null)),
    setUpdateWorkspace: (workspace) => void log.push(`update ${workspace ? 'open' : 'none'}`),
    ...overrides,
  };
  return { deps: d, log, opened, block: () => blocked?.(), launch: (file: SingleFile) => launch?.(file) };
}

const textFile = (name: string, text: string) => memoryFile({ name, blob: new Blob([text]), lastModified: 1 });

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
  assert.deepEqual(kinds(el), ['hmd-update-notice', 'hmd-start-screen']);
  assert.equal(el.querySelector('hmd-start-screen')!.mode, 'unsupported');
});

test('no saved folder: the start screen; picking a folder opens it, saves it and tells the update flow', async () => {
  const { deps: d, log } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  const start = el.querySelector('hmd-start-screen')!;
  start.dispatchEvent(new CustomEvent('hmd-start-pick', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
  assert.deepEqual(kinds(el), ['hmd-update-notice', 'hmd-workspace']);
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

test('a blocked database shows a status row in the app banner, before the content; Close removes it', async () => {
  const { deps: d, block } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  block();
  const banner = el.querySelector('hmd-update-notice hmd-banner')!;
  assert.equal(banner.querySelector('[role="status"]')!.textContent, EN_MESSAGES['notice.reloadOtherTabs']);
  assert.ok(el.firstElementChild === el.querySelector('hmd-update-notice'), 'app banner first');
  (banner.querySelector('button.close') as HTMLButtonElement).click();
  assert.equal(banner.querySelector('[role="status"]')!.textContent, '');
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

for (const mode of ['pick', 'resume'] as const) {
  test(`detached while ${mode === 'pick' ? 'a picked folder' : 'the resumed folder'} opens: the late folder is disposed, nothing is shown, saved or published`, async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const disposed: string[] = [];
    const { deps: d, log } = deps(
      mode === 'resume' ? { loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false } : {},
    );
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
    await waitFor(() => el.screen === (mode === 'resume' ? 'resume' : 'start'));
    el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent(`hmd-start-${mode}`, { bubbles: true }));
    await waitFor(() => opening);
    el.remove();
    release();
    await waitFor(() => disposed.length === 1);
    assert.equal(el.screen, mode === 'resume' ? 'resume' : 'start');
    assert.deepEqual(log.filter((line) => line !== 'update none'), [], 'né setUpdateWorkspace con la cartella, né saveWorkspace');
  });
}

test('detached and reattached while booting: the boot starts again, the old one stays void', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let loads = 0;
  const el = mount(deps({ loadWorkspace: async () => (++loads, await gate, null) }).deps);
  el.remove();
  document.body.append(el);
  release();
  await waitFor(() => el.screen === 'start');
  assert.equal(loads, 2, 'un secondo avvio alla riconnessione');
});

test('the focus follows the folder: from the start screen button to the tree, after picking and after resuming', async () => {
  for (const mode of ['pick', 'resume'] as const) {
    const el = mount(deps(mode === 'resume' ? { loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false } : {}).deps);
    await waitFor(() => el.screen === (mode === 'resume' ? 'resume' : 'start'));
    const label = mode === 'resume' ? EN_MESSAGES['start.resume'].replace('{folder}', 'notes') : EN_MESSAGES['start.openFolder'];
    const button = [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === label)!;
    button.focus();
    button.click();
    // Chrome toglie il focus a un pulsante che diventa `disabled` (la schermata iniziale è `busy` durante il
    // cambio); jsdom no: lo si fa a mano.
    button.blur();
    await waitFor(() => el.screen === 'open');
    const row = el.querySelector('hmd-file-tree [tabindex="0"]');
    assert.ok(row !== null && document.activeElement === row, `${mode}: the tree row with the tab stop, not ${document.activeElement?.localName}`);
    el.remove();
  }
});

test('detached while the picked folder is being recognised (knownWorkspaceId): it is not even opened', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let asked = false;
  const { deps: d, opened, log } = deps({ knownWorkspaceId: async () => ((asked = true), await gate, null) });
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick', { bubbles: true }));
  await waitFor(() => asked);
  el.remove();
  release();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(opened.length, 0, 'openWorkspace mai chiamato');
  assert.deepEqual(log.filter((line) => line !== 'update none'), []);
});

test('an empty folder picked from the start screen: the focus goes to New file in the sidebar header', async () => {
  const { deps: d } = deps();
  d.openWorkspace = async (stored) => {
    const workspace = new Workspace({ fs: createWorkspaceFS(memoryOps()), workspaceId: stored.workspaceId, name: stored.handle.name, buffers: memoryBufferStore() });
    await workspace.load();
    return workspace;
  };
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  const button = [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === EN_MESSAGES['start.openFolder'])!;
  button.focus();
  button.click();
  button.blur();
  await waitFor(() => el.screen === 'open');
  const active = document.activeElement;
  assert.ok(active?.getAttribute('aria-label') === EN_MESSAGES['file.new'] && !!active.closest('aside'), `New file in the sidebar, not ${active?.localName} ${active?.getAttribute('aria-label')}`);
  const header = el.querySelector('aside > .sidebarHeader')!;
  assert.ok(active === header.querySelector(`[aria-label="${EN_MESSAGES['file.new']}"]`), 'the node of the New file button of the header, not another one');
});

test('the saved folder reopened by the boot: the focus is not moved (nothing that had it went away)', async () => {
  const el = mount(deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) }).deps);
  await waitFor(() => el.screen === 'open');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(document.activeElement === document.body, `body, not ${document.activeElement?.localName}`);
});

test('an unsupported browser: Open a file opens the single file in the workspace, with its name and the file open', async () => {
  const { deps: d, log } = deps({ isSupported: () => false });
  const el = mount(d);
  const button = [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === EN_MESSAGES['start.openFile']);
  assert.ok(button, 'Open a file on the unsupported start screen');
  button.click();
  await waitFor(() => el.screen === 'file');
  const workspace = el.querySelector('hmd-workspace')!;
  assert.equal(workspace.singleFile?.name, 'note.md');
  assert.match(workspace.workspaceId, /^file:/);
  await waitFor(() => workspace.workspace?.getState().doc?.path === 'note.md');
  assert.deepEqual(log.filter((line) => line !== 'update none'), ['file note.md', 'update open'], 'nothing saved as the current folder');
});

test('a file that fails to open on an unsupported browser: back to the unsupported screen with the error', async () => {
  const el = mount(deps({ isSupported: () => false, pickFile: async () => { throw new Error('boom'); } }).deps);
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick-file', { bubbles: true, detail: null }));
  await waitFor(() => el.querySelector('hmd-start-screen')!.error === 'boom');
  assert.equal(el.screen, 'unsupported');
});

test('Open with HouseMD: the launched file wins over the saved folder, even while the boot is still loading it', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { deps: d, launch, opened } = deps({ loadWorkspace: async () => (await gate, { handle: handle('notes'), workspaceId: 'w' }) });
  const el = mount(d);
  launch(textFile('launched.md', 'x'));
  await waitFor(() => el.screen === 'file');
  release();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(el.screen, 'file');
  assert.equal(opened.length, 1, 'the saved folder is never opened');
});

test('with a single file open, the name button in the sidebar opens another file, not a folder', async () => {
  const { deps: d, opened } = deps();
  let folders = 0;
  d.pickFolder = async () => (folders++, null);
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick-file', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'file');
  const first = el.querySelector('hmd-workspace')!;
  first.dispatchEvent(new CustomEvent('hmd-workspace-change-folder', { bubbles: true, detail: null }));
  await waitFor(() => el.querySelector('hmd-workspace') !== first && !!el.querySelector('hmd-workspace'));
  assert.equal(folders, 0);
  assert.equal(opened.length, 2);
});

test('leaving a single file with changes not downloaded asks first: Cancel stays, going on opens the other file', async () => {
  const first = textFile('a.md', '# A');
  const files = [first, textFile('b.md', '# B')];
  const { deps: d } = deps({ isSupported: () => false, pickFile: async () => files.shift() ?? null });
  const el = mount(d);
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick-file', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'file');
  await first.write('# A changed');
  const workspace = el.querySelector('hmd-workspace')!;
  const change = () => workspace.dispatchEvent(new CustomEvent('hmd-workspace-change-folder', { bubbles: true, detail: null }));
  change();
  await waitFor(() => !!document.querySelector('dialog[open]'));
  assert.equal(document.querySelector('dialog h2')!.textContent, EN_MESSAGES['singleFile.leaveTitle']);
  (document.querySelector('dialog button.secondary') as HTMLButtonElement).click();
  await waitFor(() => !document.querySelector('dialog[open]'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(el.querySelector('hmd-workspace') === workspace, 'cancel: still on a.md');
  assert.equal(files.length, 1, 'no file picked');
  change();
  await waitFor(() => !!document.querySelector('dialog[open]'));
  (document.querySelector('dialog button.danger') as HTMLButtonElement).click();
  await waitFor(() => el.querySelector('hmd-workspace')?.singleFile?.name === 'b.md');
});

test('a copy not downloaded from an earlier session: offered on the start screen and reopened in its session, still to download', async () => {
  const copy = { key: 'file:old/note.md', sessionId: 'file:old', name: 'note.md' };
  const { deps: d } = deps({
    isSupported: () => false,
    listRecoverable: async () => [copy],
    recoverFile: async () => memoryFile({ name: 'note.md', blob: new Blob(['RECOVER ME']), lastModified: 1, pending: true, sessionId: 'file:old' }),
  });
  const el = mount(d);
  const label = EN_MESSAGES['start.recover'].replace('{file}', 'note.md');
  await waitFor(() => [...el.querySelectorAll('hmd-start-screen button')].some((b) => b.textContent === label));
  [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === label)!.click();
  await waitFor(() => el.screen === 'file');
  const workspace = el.querySelector('hmd-workspace')!;
  assert.equal(workspace.workspaceId, 'file:old');
  await waitFor(() => workspace.workspace?.getState().doc?.text === 'RECOVER ME');
});

test('a real file (File System Access) with autosave off: leaving it writes nothing nobody asked for', async () => {
  let writes = 0;
  const disk: SingleFile = { name: 'real.md', writesToDisk: true, read: async () => ({ blob: new Blob(['original']), lastModified: 1 }), write: async () => void writes++ };
  const picks = [disk];
  const { deps: d } = deps({ pickFile: async () => picks.shift() ?? null });
  d.openFileWorkspace = async (file, workspaceId) => {
    const workspace = new Workspace({ fs: createWorkspaceFS(singleFileOps(file)), workspaceId, name: file.name, buffers: memoryBufferStore(), autosave: { mode: 'off', delayMs: 1000 } });
    await workspace.load();
    return workspace;
  };
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick-file', { bubbles: true, detail: null }));
  await waitFor(() => el.querySelector('hmd-workspace')?.workspace?.getState().doc?.path === 'real.md');
  el.querySelector('hmd-workspace')!.workspace!.edit('UNREQUESTED WRITE');
  el.querySelector('hmd-workspace')!.dispatchEvent(new CustomEvent('hmd-workspace-change-folder', { bubbles: true, detail: null }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(writes, 0);
  assert.equal(document.querySelector('dialog[open]'), null, 'no download question for a real file');
});

test('a saved, authorised folder and a copy to recover: the folder is not reopened by itself, both are offered', async () => {
  const copy = { key: 'file:old/note.md', sessionId: 'file:old', name: 'note.md' };
  const { deps: d, opened } = deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), listRecoverable: async () => [copy] });
  const el = mount(d);
  await waitFor(() => el.screen === 'resume');
  const labels = [...el.querySelectorAll('hmd-start-screen button')].map((b) => b.textContent);
  assert.ok(labels.includes(EN_MESSAGES['start.recover'].replace('{file}', 'note.md')));
  assert.ok(labels.includes(EN_MESSAGES['start.resume'].replace('{folder}', 'notes')));
  assert.equal(opened.length, 0);
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-resume', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
});
