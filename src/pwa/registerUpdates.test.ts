import test from 'node:test';
import assert from 'node:assert/strict';

import type { SettleResult } from '../workspace/workspace';
import { registerUpdates, type RegisterOptions, type RegisterSW } from './registerUpdates';
import type { UpdateHost } from './updateFlow';

function setup(result: SettleResult) {
  const captured: { options?: RegisterOptions } = {};
  const calls: string[] = [];
  const registerSW: RegisterSW = (options) => {
    captured.options = options;
    return async () => {
      calls.push('updateSW');
    };
  };
  const host: UpdateHost = {
    prepare: async () => {
      calls.push('prepare');
      return result;
    },
    cancel: () => calls.push('cancel'),
    reload: () => calls.push('reload'),
  };
  const flow = registerUpdates(registerSW, host);
  return { captured, calls, flow };
}

const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('registerUpdates always passes onNeedReload and routes it through the protected flow', async () => {
  const { captured, calls, flow } = setup('durable');
  const options = captured.options!;
  assert.equal(typeof options.onNeedReload, 'function', 'senza onNeedReload il plugin ricaricherebbe la pagina da solo');
  assert.equal(typeof options.onNeedRefresh, 'function');
  options.onNeedRefresh!();
  assert.equal(flow.getState().available, true);
  await flow.apply();
  assert.deepEqual(calls, ['prepare', 'updateSW']);
  options.onNeedReload!();
  await settled();
  assert.deepEqual(calls, ['prepare', 'updateSW', 'prepare', 'reload']);
});

test('onNeedReload in a tab whose workspace cannot be secured does not reload', async () => {
  const { captured, calls } = setup('failed');
  captured.options!.onNeedReload!();
  await settled();
  assert.deepEqual(calls, ['prepare', 'cancel']);
});
