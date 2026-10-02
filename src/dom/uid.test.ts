import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { uid } from './uid';

test('ids carry the prefix and never repeat', () => {
  const ids = Array.from({ length: 50 }, () => uid('review'));
  for (const id of ids) assert.match(id, /^review-\d+$/);
  assert.equal(new Set(ids).size, ids.length);
});

test('an id already in the document is skipped', () => {
  const n = Number(uid('probe').split('-')[1]);
  for (const taken of [n + 1, n + 2]) {
    const div = document.createElement('div');
    div.id = `probe-${taken}`;
    document.body.append(div);
  }
  assert.equal(uid('probe'), `probe-${n + 3}`);
});
