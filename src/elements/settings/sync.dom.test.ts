import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiSyncState } from '../../ai/aiSync';
import { SyncBinding, type SyncService } from '../../ai/syncBinding';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installDialogStub } from '../../testing/dialogStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
test.afterEach(() => document.body.replaceChildren());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function service(backups: string[][]) {
  let state: AiSyncState = { status: 'idle', error: null, lastSync: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const pending: ((paths: string[]) => void)[] = [];
  const calls: string[] = [];
  return {
    getState: () => state,
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    start: () => {},
    localChanged: () => {},
    dispose: () => {},
    syncNow: async () => void calls.push('syncNow'),
    /** Ogni richiesta resta in attesa finché il test non la risolve con `answer`. */
    listBackups: () => new Promise<string[]>((resolve) => pending.push(resolve)),
    answer: (i: number) => pending[i](backups[i]),
    backupCounts: async () => ({ profiles: 2, presets: 3 }),
    restore: async (path: string) => void calls.push(`restore ${path}`),
    set(patch: Partial<AiSyncState>) {
      state = { ...state, ...patch };
      for (const fn of [...listeners]) fn();
    },
    calls,
    requests: () => pending.length,
  };
}

async function mount(saved: FileSystemDirectoryHandle | null, access = true) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const meta = new Map<string, unknown>([['folderHandle', saved]]);
  const services: ReturnType<typeof service>[] = [];
  const reports: unknown[] = [];
  let reloads = 0;
  const controller = {
    store: { getMeta: async (key: string) => meta.get(key) ?? null, setMeta: async (key: string, value: unknown) => void meta.set(key, value) },
    report: (error: unknown) => void reports.push(error),
    reload: async () => void reloads++,
  };
  const binding = new SyncBinding(controller as never, {
    hasAccess: async () => access,
    requestAccess: async () => true,
    pickFolder: async () => ({ name: 'picked' }) as FileSystemDirectoryHandle,
    createSync: () => {
      const s = service([['a.json', 'b.json'], ['c.json']]);
      services.push(s);
      return s as unknown as SyncService;
    },
  });
  await flush();
  const el = document.createElement('hmd-settings-sync');
  el.controller = controller as never;
  el.binding = binding;
  el.i18n = i18n;
  document.body.append(el);
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label);
  return { el, binding, services, reports, reloads: () => reloads, button };
}

test('no folder: the notice and Choose only', async () => {
  const { el } = await mount(null);
  const detail = el.firstElementChild!;
  assert.equal(detail.className, 'detail');
  assert.deepEqual([...detail.children].map((c) => c.localName), ['p', 'div']);
  assert.deepEqual([...detail.querySelectorAll('.actions > *')].map((c) => c.textContent), [EN_MESSAGES['ai.syncChoose']]);
});

test('a folder without permission: its name, Disable and Reactivate; reactivated, the details appear', async () => {
  const { el, button } = await mount({ name: 'sync' } as FileSystemDirectoryHandle, false);
  assert.deepEqual([...el.querySelectorAll('.actions > *')].map((c) => c.textContent), [EN_MESSAGES['ai.syncChoose'], 'sync', EN_MESSAGES['ai.syncDisable'], EN_MESSAGES['ai.syncReactivate']]);
  button(EN_MESSAGES['ai.syncReactivate'])!.click();
  await waitFor(() => el.querySelector('details') !== null);
  assert.equal(button(EN_MESSAGES['ai.syncReactivate']), undefined);
});

test('with the service: status, Sync now off while syncing, and the backups asked again after every sync; a stale list is dropped', async () => {
  const { el, services, button } = await mount({ name: 'sync' } as FileSystemDirectoryHandle);
  const s = services[0];
  assert.deepEqual([...el.firstElementChild!.children].map((c) => c.localName), ['p', 'div', 'p', 'div', 'details']);
  s.set({ status: 'syncing' });
  assert.equal(button(EN_MESSAGES['ai.syncNow'])!.disabled, true);
  s.set({ status: 'written', lastSync: 1000 });
  assert.equal(button(EN_MESSAGES['ai.syncNow'])!.disabled, false);
  assert.equal(s.requests(), 2);
  // La risposta più nuova arriva prima: quella vecchia, arrivata dopo, non la sostituisce.
  s.answer(1);
  await waitFor(() => el.querySelectorAll('details > p').length === 1);
  s.answer(0);
  await flush();
  assert.deepEqual([...el.querySelectorAll('details > p')].map((p) => p.firstChild!.textContent), ['c.json']);
});

test('restoring a backup: the confirmation says how many profiles and presets; confirmed, it restores and reloads', async () => {
  const { el, services, reloads } = await mount({ name: 'sync' } as FileSystemDirectoryHandle);
  services[0].answer(0);
  await waitFor(() => el.querySelectorAll('details > p').length === 2);
  el.querySelector<HTMLButtonElement>('details > p button')!.click();
  await waitFor(() => document.querySelector('dialog') !== null);
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.textContent!.includes(EN_MESSAGES['ai.syncCounts'].replace('{profiles}', '2').replace('{presets}', '3')));
  // Un secondo clic con la conferma aperta non ne apre un'altra.
  el.querySelector<HTMLButtonElement>('details > p button')!.click();
  await flush();
  assert.equal(document.querySelectorAll('dialog').length, 1);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.restoreBackup'])!.click();
  await waitFor(() => reloads() === 1);
  assert.deepEqual(services[0].calls, ['restore a.json']);
});
