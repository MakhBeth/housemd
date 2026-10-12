import test from 'node:test';
import assert from 'node:assert/strict';

import type { AiController } from '../../ai/aiController';
import { createMemoryAiStores } from '../../ai/stores';
import type { WorkspaceState } from '../../workspace/workspace';
import { aiWorkspace, openAiSession, type AiSessionDeps } from './aiSession';

function workspace(doc: Partial<NonNullable<WorkspaceState['doc']>> | null = null, updating = false) {
  const opened: string[] = [];
  return {
    getState: () => ({ doc, updating }) as unknown as WorkspaceState,
    snapshotBeforeAi: () => {},
    openFile: async (path: string) => void opened.push(path),
    opened,
  };
}

function deps(options: { idbFails?: boolean } = {}) {
  const registered: AiController[] = [];
  let unregistered = 0;
  const d: AiSessionDeps = {
    idbStores: async () => (options.idbFails ? Promise.reject(new Error('no idb')) : createMemoryAiStores()),
    memoryStores: () => createMemoryAiStores(),
    savedProfile: () => undefined,
    register: (controller) => (registered.push(controller), () => void unregistered++),
  };
  return { deps: d, registered, unregistered: () => unregistered };
}

test('the AI workspace binding reads the open document as the controller wants it', () => {
  const ws = workspace({ path: 'a.md', text: 'A', conflict: undefined } as never, true);
  const binding = aiWorkspace(ws as never);
  assert.deepEqual(binding.getDoc(), { path: 'a.md', textLf: 'A', conflict: undefined, updating: true });
  void binding.openFile('b.md');
  assert.deepEqual(ws.opened, ['b.md']);
  assert.equal(aiWorkspace(workspace() as never).getDoc(), null);
});

test('a session: the controller is initialised, registered for updates, and closed once', async () => {
  const { deps: d, registered, unregistered } = deps();
  const session = await openAiSession(workspace() as never, d, new AbortController().signal);
  assert.ok(session);
  assert.equal(registered.length, 1);
  assert.ok(session.controller.getState().profiles.length > 0);
  assert.equal(session.controller.getState().error, null);
  session.close();
  assert.equal(unregistered(), 1);
});

test('without IndexedDB the chat lives in memory and the error says so', async () => {
  const { deps: d } = deps({ idbFails: true });
  const session = await openAiSession(workspace() as never, d, new AbortController().signal);
  assert.equal(session!.controller.getState().error, 'server');
});

test('aborted before it is ready: nothing registered, null', async () => {
  const { deps: d, registered } = deps();
  const abort = new AbortController();
  const pending = openAiSession(workspace() as never, d, abort.signal);
  abort.abort();
  assert.equal(await pending, null);
  assert.equal(registered.length, 0);
});

test('aborted while the stores load: the controller is never initialised, null', async () => {
  const { deps: d, registered } = deps();
  let release!: () => void;
  const loading = new Promise<void>((resolve) => (release = resolve));
  let initialised = 0;
  const abort = new AbortController();
  const pending = openAiSession(workspace() as never, {
    ...d,
    idbStores: async () => (await loading, createMemoryAiStores()),
    // Letto solo da `initialize`: se lo si chiede, la sessione è andata avanti dopo l'interruzione.
    savedProfile: () => void initialised++,
  }, abort.signal);
  abort.abort();
  release();
  assert.equal(await pending, null);
  assert.equal(initialised, 0);
  assert.equal(registered.length, 0);
});
