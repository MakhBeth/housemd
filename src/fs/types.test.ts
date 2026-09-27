import test from 'node:test';
import assert from 'node:assert/strict';

import { isAccessError } from './types';

test('[final fix 9] only NotAllowedError counts as access lost; SecurityError is a normal error', () => {
  assert.equal(isAccessError(Object.assign(new Error('x'), { name: 'NotAllowedError' })), true);
  assert.equal(isAccessError(Object.assign(new Error('x'), { name: 'SecurityError' })), false);
  assert.equal(isAccessError(Object.assign(new Error('x'), { name: 'NotFoundError' })), false);
  assert.equal(isAccessError(null), false);
});
