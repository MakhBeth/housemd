import test from 'node:test';
import assert from 'node:assert/strict';

import { errorDetail, sameNotice } from './notices';

test('sameNotice compares kind, code and params, not the id', () => {
  assert.equal(sameNotice({ kind: 'error', code: 'saveFailed', params: { detail: 'x' } }, { kind: 'error', code: 'saveFailed', params: { detail: 'x' } }), true);
  assert.equal(sameNotice({ kind: 'error', code: 'saveFailed', params: { detail: 'x' } }, { kind: 'error', code: 'saveFailed', params: { detail: 'y' } }), false);
  assert.equal(sameNotice({ kind: 'info', code: 'saveAllDone' }, { kind: 'info', code: 'saveAllDone', params: {} }), true);
  assert.equal(sameNotice({ kind: 'info', code: 'saveAllDone' }, { kind: 'error', code: 'saveAllDone' }), false);
});

test('errorDetail uses the message of an Error and stringifies anything else', () => {
  assert.equal(errorDetail(new Error('ENOSPC')), 'ENOSPC');
  assert.equal(errorDetail('boom'), 'boom');
});

test('every code has a channel; counted messages use pluralKey; data-risk errors cannot be closed', async () => {
  const { NOTICE_CHANNEL, NOTICE_CODES, isClosable, noticeKey } = await import('./notices');
  for (const code of NOTICE_CODES) assert.ok(NOTICE_CHANNEL[code], code);
  assert.equal(noticeKey('unreadableFiles', { count: 1 }, 'en'), 'notice.unreadableFiles.one');
  assert.equal(noticeKey('saveAllSkipped', { count: 3 }, 'en'), 'notice.saveAllSkipped.other');
  assert.equal(noticeKey('saveAllSkipped', { count: 1 }, 'ja'), 'notice.saveAllSkipped.other');
  assert.equal(noticeKey('saveFailed', undefined, 'en'), 'notice.saveFailed');
  for (const code of ['saveFailed', 'bufferFailed', 'draftNotPersisted', 'deletedOutside'] as const) assert.equal(isClosable(code), false, code);
  assert.equal(isClosable('saveAllDone'), true);
});
