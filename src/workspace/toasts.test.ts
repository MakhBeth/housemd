import test from 'node:test';
import assert from 'node:assert/strict';

import { errorDetail, sameToast } from './toasts';

test('sameToast compares kind, code and params, not the id', () => {
  assert.equal(sameToast({ kind: 'error', code: 'saveFailed', params: { detail: 'x' } }, { kind: 'error', code: 'saveFailed', params: { detail: 'x' } }), true);
  assert.equal(sameToast({ kind: 'error', code: 'saveFailed', params: { detail: 'x' } }, { kind: 'error', code: 'saveFailed', params: { detail: 'y' } }), false);
  assert.equal(sameToast({ kind: 'info', code: 'saveAllDone' }, { kind: 'info', code: 'saveAllDone', params: {} }), true);
  assert.equal(sameToast({ kind: 'info', code: 'saveAllDone' }, { kind: 'error', code: 'saveAllDone' }), false);
});

test('errorDetail uses the message of an Error and stringifies anything else', () => {
  assert.equal(errorDetail(new Error('ENOSPC')), 'ENOSPC');
  assert.equal(errorDetail('boom'), 'boom');
});
