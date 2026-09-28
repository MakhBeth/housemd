import test from 'node:test';
import assert from 'node:assert/strict';

import type { SnapshotReason } from './historyStore';
import { MAX_SNAPSHOT_AGE_MS, MAX_SNAPSHOTS_PER_FILE, SAVE_THROTTLE_MS, shouldSnapshot, toPrune } from './policy';

const NOW = 1_800_000_000_000;
const snap = (text: string, reason: SnapshotReason, ago: number) => ({ text, reason, savedAt: NOW - ago });

test('the first snapshot of a file is always taken', () => {
  assert.equal(shouldSnapshot([], { text: 'a', reason: 'save' }, NOW), true);
});

test('a snapshot identical to the last one is never taken, whatever the reason', () => {
  const recent = [snap('uguale', 'save', SAVE_THROTTLE_MS * 10)];
  assert.equal(shouldSnapshot(recent, { text: 'uguale', reason: 'save' }, NOW), false);
  assert.equal(shouldSnapshot(recent, { text: 'uguale', reason: 'before-reload' }, NOW), false);
});

test('saves are throttled to one every 5 minutes', () => {
  assert.equal(shouldSnapshot([snap('v1', 'save', SAVE_THROTTLE_MS - 1)], { text: 'v2', reason: 'save' }, NOW), false);
  assert.equal(shouldSnapshot([snap('v1', 'save', SAVE_THROTTLE_MS)], { text: 'v2', reason: 'save' }, NOW), true);
  // Conta l'ultimo "save", non l'ultimo snapshot di qualunque tipo.
  const recent = [snap('r', 'before-reload', 1000), snap('v1', 'save', SAVE_THROTTLE_MS - 1)];
  assert.equal(shouldSnapshot(recent, { text: 'v2', reason: 'save' }, NOW), false);
});

test('before-* snapshots are always taken when the text differs', () => {
  const recent = [snap('v1', 'save', 1)];
  for (const reason of ['before-reload', 'before-overwrite', 'before-restore'] as const) {
    assert.equal(shouldSnapshot(recent, { text: 'altro', reason }, NOW), true, reason);
  }
});

test('toPrune keeps the 50 most recent per file and drops those older than 30 days', () => {
  const many = Array.from({ length: 55 }, (_, i) => ({ id: i + 1, savedAt: NOW - i * 1000 }));
  assert.deepEqual(toPrune(many, NOW).sort((a, b) => a - b), [51, 52, 53, 54, 55]);
  assert.equal(MAX_SNAPSHOTS_PER_FILE, 50);
  const old = [
    { id: 1, savedAt: NOW - MAX_SNAPSHOT_AGE_MS - 1 },
    { id: 2, savedAt: NOW - MAX_SNAPSHOT_AGE_MS },
    { id: 3, savedAt: NOW },
  ];
  assert.deepEqual(toPrune(old, NOW), [1]);
});
