import test from 'node:test';
import assert from 'node:assert/strict';

import { afterSwitch } from './screens';

const value = { stored: 'S', workspace: 'W' };

test('a successful switch shows the new workspace', () => {
  assert.deepEqual(afterSwitch({ kind: 'opened', value }, true), { kind: 'show', screen: { kind: 'open', stored: 'S', workspace: 'W' } });
});

test('an error stays in the open workspace as a toast, or goes back to the start screen', () => {
  assert.deepEqual(afterSwitch({ kind: 'error', detail: 'boom' }, true), { kind: 'reportError', detail: 'boom' });
  assert.deepEqual(afterSwitch({ kind: 'error', detail: 'boom' }, false), { kind: 'show', screen: { kind: 'start', error: 'boom' } });
});

test('cancelled or blocked: nothing changes', () => {
  assert.deepEqual(afterSwitch({ kind: 'cancelled' }, true), { kind: 'stay' });
  assert.deepEqual(afterSwitch({ kind: 'blocked' }, false), { kind: 'stay' });
});
