import test from 'node:test';
import assert from 'node:assert/strict';

import type { SettleResult } from '../workspace/workspace';
import { createUpdateFlow, type UpdateHost } from './updateFlow';

function fakeHost(result: SettleResult) {
  const calls: string[] = [];
  const host: UpdateHost = {
    prepare: async () => {
      calls.push('prepare');
      return result;
    },
    cancel: () => calls.push('cancel'),
    reload: () => calls.push('reload'),
  };
  return { host, calls };
}

test('needRefresh shows the update notice and notifies subscribers', () => {
  const { host } = fakeHost('durable');
  const flow = createUpdateFlow(host, async () => undefined);
  let notified = 0;
  flow.subscribe(() => notified++);
  assert.deepEqual(flow.getState(), { available: false, busy: false });
  flow.needRefresh();
  assert.deepEqual(flow.getState(), { available: true, busy: false });
  assert.equal(notified, 1);
  flow.dismiss();
  assert.equal(flow.getState().available, false);
});

test('apply secures the workspace, then activates the new service worker', async () => {
  const { host, calls } = fakeHost('durable');
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  flow.needRefresh();
  await flow.apply();
  assert.deepEqual(calls, ['prepare', 'updateSW']);
  assert.deepEqual(flow.getState(), { available: true, busy: true }, 'resta in sola lettura fino al reload');
});

test('apply does not update when the workspace cannot be secured', async () => {
  const { host, calls } = fakeHost('failed');
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  flow.needRefresh();
  await flow.apply();
  assert.deepEqual(calls, ['prepare', 'cancel']);
  assert.deepEqual(flow.getState(), { available: true, busy: false });
});

test('a failing updateSW gives the document back', async () => {
  const { host, calls } = fakeHost('durable');
  const flow = createUpdateFlow(host, async () => {
    throw new Error('nessun service worker in attesa');
  });
  await flow.apply();
  assert.deepEqual(calls, ['prepare', 'cancel']);
  assert.equal(flow.getState().busy, false);
});

test('apply ignores a second click while busy', async () => {
  const { host, calls } = fakeHost('durable');
  let release!: () => void;
  host.prepare = () => {
    calls.push('prepare');
    return new Promise<SettleResult>((resolve) => {
      release = () => resolve('durable');
    });
  };
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  const first = flow.apply();
  await flow.apply();
  release();
  await first;
  assert.deepEqual(calls, ['prepare', 'updateSW']);
});

test('needReload reloads only when the workspace is durable', async () => {
  const durable = fakeHost('durable');
  await createUpdateFlow(durable.host, async () => undefined).needReload();
  assert.deepEqual(durable.calls, ['prepare', 'reload']);

  const failed = fakeHost('failed');
  const flow = createUpdateFlow(failed.host, async () => undefined);
  await flow.needReload();
  assert.deepEqual(failed.calls, ['prepare', 'cancel'], 'nessun reload: resta sulla versione vecchia');
  assert.deepEqual(flow.getState(), { available: true, busy: false }, 'con il toast per riprovare');
});

test('after a failed needReload, "Update" retries only the guarded reload (no second updateSW)', async () => {
  const calls: string[] = [];
  const results: SettleResult[] = ['failed', 'durable'];
  const host: UpdateHost = {
    prepare: async () => {
      calls.push('prepare');
      return results.shift()!;
    },
    cancel: () => calls.push('cancel'),
    reload: () => calls.push('reload'),
  };
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW'); // non deve essere chiamato: il nuovo worker controlla già la pagina
  });
  await flow.needReload(); // documento non al sicuro: niente reload
  assert.deepEqual(flow.getState(), { available: true, busy: false });
  await flow.apply(); // l'utente ha salvato e riprova
  assert.deepEqual(calls, ['prepare', 'cancel', 'prepare', 'reload']);
  assert.equal(flow.getState().busy, true, 'resta in sola lettura fino al reload');
});
