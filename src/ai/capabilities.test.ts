import test from 'node:test';
import assert from 'node:assert/strict';

import { EFFORT_LEVELS } from './capabilities';

test('the effort levels are the five of GenParams, in order', () => {
  assert.deepEqual([...EFFORT_LEVELS], ['low', 'medium', 'high', 'xhigh', 'max']);
});
