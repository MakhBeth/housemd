import test from 'node:test';
import assert from 'node:assert/strict';

import { saveSecretBlocker, syncNowBlocker } from './blockers';

test('Save key is blocked only by an empty key field', () => {
  assert.equal(saveSecretBlocker(''), 'ai.saveSecret.needKey');
  assert.equal(saveSecretBlocker('sk-test'), null);
});

test('Sync now is blocked only while a sync is running', () => {
  assert.equal(syncNowBlocker('syncing'), 'ai.syncNow.running');
  for (const status of ['idle', 'synced', 'error', 'offline']) assert.equal(syncNowBlocker(status), null);
});
