import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { defineElements } from './define';

class DefineProbe extends HTMLElement {}

test('defining again (Vite HMR re-runs define.ts) skips the names already defined', () => {
  defineElements([['hmd-define-probe', DefineProbe]]);
  assert.doesNotThrow(() => defineElements([['hmd-define-probe', class extends HTMLElement {}]]));
  assert.equal(customElements.get('hmd-define-probe'), DefineProbe);
});
