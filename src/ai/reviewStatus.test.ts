import test from 'node:test';
import assert from 'node:assert/strict';

import type { Proposal } from './types';
import { isBusy, reviewStatus } from './reviewStatus';

const proposal = (extra: Partial<Proposal> = {}): Proposal => ({
  path: 'a.md',
  baseText: 'a',
  text: 'b',
  origin: 'ai',
  status: 'complete',
  snapshotTaken: false,
  createdAt: 1,
  ...extra,
});
const base = { path: 'a.md', running: null, elapsedSeconds: 0, applied: false };

test('no proposal and no run on this path shows nothing', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: undefined }), { kind: 'none' });
  assert.deepEqual(reviewStatus({ ...base, proposal: undefined, running: { path: 'b.md' } }), { kind: 'none' });
});

test('a run on this path before the first proposal is already generating', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: undefined, path: 'a.md', running: { path: 'a.md' }, elapsedSeconds: 2 }), {
    kind: 'generating',
    seconds: 2,
  });
});

test('a run on this path is generating, with parts when known', () => {
  const p = proposal({ status: 'streaming', progress: { done: 3, total: 7 } });
  assert.deepEqual(reviewStatus({ ...base, proposal: p, running: { path: 'a.md' }, elapsedSeconds: 12 }), {
    kind: 'generating',
    seconds: 12,
    done: 3,
    total: 7,
  });
});

test('a run on another path does not make this proposal generating', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal(), running: { path: 'b.md' } }), { kind: 'none' });
});

test('a streaming proposal without a run is still generating, never applied', () => {
  const status = reviewStatus({ ...base, proposal: proposal({ status: 'streaming' }), applied: true });
  assert.deepEqual(status, { kind: 'generating', seconds: 0 });
  assert.equal(isBusy(status), true);
});

test('a lost selection wins over partial, truncated and applied', () => {
  const lost = { originalText: 'x', from: 0, to: 1, status: 'lost' as const };
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'partial', scope: lost }), applied: true }), { kind: 'scopeLost' });
});

test('partial and truncated proposals say so', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'partial' }) }), { kind: 'partial' });
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'truncated' }) }), { kind: 'truncated' });
});

test('a complete proposal is applied or shows nothing', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal(), applied: true }), { kind: 'applied' });
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal() }), { kind: 'none' });
  assert.equal(isBusy({ kind: 'none' }), false);
});
