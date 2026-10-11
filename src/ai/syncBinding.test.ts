import test from 'node:test';
import assert from 'node:assert/strict';

import type { AiSyncState } from './aiSync';
import { SyncBinding, type SyncBindingDeps, type SyncHost, type SyncService } from './syncBinding';

const handle = (name: string) => ({ name }) as FileSystemDirectoryHandle;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeService() {
  let state: AiSyncState = { status: 'idle', error: null, lastSync: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const log: string[] = [];
  const service: SyncService & { set(patch: Partial<AiSyncState>): void; log: string[]; listeners: () => number } = {
    getState: () => state,
    subscribe: (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    start: () => void log.push('start'),
    localChanged: () => void log.push('localChanged'),
    dispose: () => void log.push('dispose'),
    set(patch) {
      state = { ...state, ...patch };
      for (const fn of [...listeners]) fn();
    },
    log,
    listeners: () => listeners.size,
  };
  return service;
}

function setup(saved: FileSystemDirectoryHandle | null, access = true) {
  const meta = new Map<string, unknown>([['folderHandle', saved]]);
  const reports: unknown[] = [];
  let reloads = 0;
  const host: SyncHost = {
    store: {
      getMeta: async <T>(key: string) => (meta.get(key) ?? null) as T | null,
      setMeta: async (key: string, value: unknown) => void meta.set(key, value),
    } as SyncHost['store'],
    report: (error) => void reports.push(error),
    reload: async () => void reloads++,
  };
  const services: ReturnType<typeof fakeService>[] = [];
  const deps: SyncBindingDeps & { picked: FileSystemDirectoryHandle | null; granted: boolean } = {
    picked: null,
    granted: true,
    hasAccess: async () => access,
    requestAccess: async () => deps.granted,
    pickFolder: async () => deps.picked,
    createSync: () => {
      const service = fakeService();
      services.push(service);
      return service;
    },
  };
  const binding = new SyncBinding(host, deps);
  let notified = 0;
  binding.subscribe(() => notified++);
  return { binding, host, deps, meta, services, reports, reloads: () => reloads, notified: () => notified };
}

test('a saved folder with permission starts one sync service, linked to the settings changes', async () => {
  const { binding, host, services } = setup(handle('sync'));
  await flush();
  assert.equal(binding.getState().handle?.name, 'sync');
  assert.equal(binding.getState().permission, true);
  assert.equal(services.length, 1);
  assert.equal(binding.getState().sync, services[0]);
  assert.deepEqual(services[0].log, ['start']);
  host.onSettingsChanged?.();
  assert.deepEqual(services[0].log, ['start', 'localChanged']);
  assert.equal(binding.needsPermission, false);
});

test('a saved folder without permission: no service, the sidebar must offer to reactivate', async () => {
  const { binding, services, deps } = setup(handle('sync'), false);
  await flush();
  assert.equal(binding.getState().sync, null);
  assert.equal(services.length, 0);
  assert.equal(binding.needsPermission, true);
  deps.granted = true;
  await binding.reactivate();
  assert.equal(binding.needsPermission, false);
  assert.equal(services.length, 1);
});

test('no saved folder: nothing; choosing one saves it and starts the service; disabling stops it', async () => {
  const { binding, deps, meta, services, host, notified } = setup(null);
  await flush();
  assert.equal(binding.getState().handle, null);
  assert.equal(notified(), 0);
  deps.picked = null;
  await binding.choose();
  assert.equal(services.length, 0);
  deps.picked = handle('new');
  await binding.choose();
  assert.equal((meta.get('folderHandle') as FileSystemDirectoryHandle).name, 'new');
  assert.equal(services.length, 1);
  await binding.disable();
  assert.equal(meta.get('folderHandle'), null);
  assert.equal(binding.getState().sync, null);
  assert.deepEqual(services[0].log, ['start', 'dispose']);
  assert.equal(services[0].listeners(), 0);
  assert.equal(host.onSettingsChanged, undefined);
});

test('a syncPermission error drops the permission and the service; every finished sync reloads the controller', async () => {
  const { binding, services, reloads } = setup(handle('sync'));
  await flush();
  const service = services[0];
  service.set({ status: 'syncing' });
  assert.equal(reloads(), 0);
  service.set({ status: 'written' });
  assert.equal(reloads(), 1);
  service.set({ status: 'error', error: 'syncPermission' });
  assert.equal(binding.getState().permission, false);
  assert.equal(binding.getState().sync, null);
  assert.ok(service.log.includes('dispose'));
  assert.equal(binding.needsPermission, true);
});

test('state is saved before the listeners hear about it', async () => {
  const { binding, deps } = setup(null);
  await flush();
  const seen: (string | null)[] = [];
  binding.subscribe(() => seen.push(binding.getState().handle?.name ?? null));
  deps.picked = handle('x');
  await binding.choose();
  assert.deepEqual(seen, ['x']);
});

test('disposed: the service stops, late answers change nothing, listeners are dropped', async () => {
  const { binding, services, deps } = setup(handle('sync'));
  await flush();
  binding.dispose();
  assert.ok(services[0].log.includes('dispose'));
  deps.picked = handle('late');
  await binding.choose();
  assert.equal(binding.getState().handle?.name, 'sync');
  assert.equal(services.length, 1);
});

test('a failed read of the saved folder is reported to the controller', async () => {
  const reports: unknown[] = [];
  const host: SyncHost = {
    store: { getMeta: async () => Promise.reject({ code: 'server' }), setMeta: async () => {} } as unknown as SyncHost['store'],
    report: (error) => void reports.push(error),
    reload: async () => {},
  };
  new SyncBinding(host, { hasAccess: async () => true, requestAccess: async () => true, pickFolder: async () => null, createSync: () => fakeService() });
  await flush();
  assert.deepEqual(reports, [{ code: 'server' }]);
});

test('rule: the binding never writes to the folder, only the sync service does (backup first)', async () => {
  // Una cartella che esplode a ogni accesso diverso da `name`: scelta, riattivazione e disattivazione non la toccano.
  const touched: string[] = [];
  const folder = new Proxy({ name: 'sync' }, { get: (target, key) => (key === 'name' ? target.name : key === 'then' ? undefined : (touched.push(String(key)), undefined)) }) as unknown as FileSystemDirectoryHandle;
  const { binding, deps, services } = setup(null);
  await flush();
  deps.picked = folder;
  await binding.choose();
  await binding.disable();
  await binding.choose();
  await binding.reactivate();
  assert.deepEqual(touched, []);
  // L'unica scrittura possibile è quella del servizio: il legame gli passa la cartella e nient'altro.
  assert.ok(services.length >= 1);
});
