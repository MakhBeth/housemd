import test from 'node:test';
import assert from 'node:assert/strict';

import type { SettleResult } from '../workspace/workspace';
import { createUpdateFlow, UPDATE_TIMEOUT_MS, type UpdateHost } from './updateFlow';

/** Timer finto: `fire()` fa scattare i timer ancora attivi. */
function fakeTimer() {
  const pending = new Map<number, { callback: () => void; ms: number }>();
  let next = 0;
  return {
    pending,
    setTimer(callback: () => void, ms: number) {
      const id = next++;
      pending.set(id, { callback, ms });
      return () => {
        pending.delete(id);
      };
    },
    fire() {
      for (const [id, { callback }] of [...pending]) {
        pending.delete(id);
        callback();
      }
    },
  };
}

function fakeHost(result: SettleResult) {
  const calls: string[] = [];
  const timer = fakeTimer();
  const host: UpdateHost = {
    setTimer: timer.setTimer,
    prepare: async () => {
      calls.push('prepare');
      return result;
    },
    cancel: () => calls.push('cancel'),
    reload: () => calls.push('reload'),
  };
  return { host, calls, timer };
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
    setTimer: fakeTimer().setTimer,
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

test('without a controlling event after apply, the update gives the document back after a timeout', async () => {
  const { host, calls, timer } = fakeHost('durable');
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  flow.needRefresh();
  await flow.apply();
  assert.deepEqual([...timer.pending.values()].map((t) => t.ms), [UPDATE_TIMEOUT_MS]);
  timer.fire();
  assert.deepEqual(calls, ['prepare', 'updateSW', 'cancel']);
  assert.deepEqual(flow.getState(), { available: true, busy: false }, 'il toast resta per riprovare');
  await flow.apply(); // riprova: di nuovo SKIP_WAITING
  assert.deepEqual(calls, ['prepare', 'updateSW', 'cancel', 'prepare', 'updateSW']);
});

test('a controlling event in time clears the timeout', async () => {
  const { host, calls, timer } = fakeHost('durable');
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  await flow.apply();
  await flow.needReload();
  assert.equal(timer.pending.size, 0);
  assert.deepEqual(calls, ['prepare', 'updateSW', 'prepare', 'reload']);
});

test('a rejecting prepare counts as failed and resets the flow', async () => {
  const { host, calls } = fakeHost('durable');
  host.prepare = async () => {
    calls.push('prepare');
    throw new Error('boom');
  };
  const flow = createUpdateFlow(host, async () => {
    calls.push('updateSW');
  });
  await flow.apply();
  assert.deepEqual(calls, ['prepare', 'cancel']);
  assert.deepEqual(flow.getState(), { available: false, busy: false });
  await flow.needReload(); // non rifiuta: chiamata con `void` dall'adattatore
  assert.deepEqual(calls, ['prepare', 'cancel', 'prepare', 'cancel']);
  assert.deepEqual(flow.getState(), { available: true, busy: false });
  host.prepare = async () => {
    calls.push('prepare');
    return 'durable';
  };
  await flow.apply(); // non bloccato da un `reloading` rimasto a true
  assert.deepEqual(calls.slice(-2), ['prepare', 'reload']);
});
