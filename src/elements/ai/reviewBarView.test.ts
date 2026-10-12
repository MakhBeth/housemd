import test from 'node:test';
import assert from 'node:assert/strict';

import type { ReviewStatus } from '../../ai/reviewStatus';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { actionBlocker, generationOutcome, statusLine } from './reviewBarView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const none: ReviewStatus = { kind: 'none' };
const generating: ReviewStatus = { kind: 'generating', seconds: 3 };

test('while generating the arrows and Accept all say so; Discard stops and discards; otherwise the arrows and Discard are free', () => {
  for (const action of ['previous', 'next', 'acceptAll'] as const) assert.equal(actionBlocker(action, generating, 'generating'), 'ai.review.generating', action);
  assert.equal(actionBlocker('discard', generating, 'generating'), null, 'Scarta = Ferma + scarta');
  assert.equal(actionBlocker('continue', generating, 'generating'), null);
  for (const action of ['previous', 'next', 'discard', 'continue'] as const) assert.equal(actionBlocker(action, none, 'truncated'), null, action);
});

test('Continue during an update says so (it would be ignored in silence); otherwise it goes', () => {
  const partial: ReviewStatus = { kind: 'partial' };
  assert.equal(actionBlocker('continue', partial, 'updating'), 'ai.review.updating');
  assert.equal(actionBlocker('continue', partial, 'notAcceptable'), null);
  assert.equal(actionBlocker('continue', partial, null), null);
});

test('Accept all carries the reason of the controller, one key per reason', () => {
  assert.equal(actionBlocker('acceptAll', none, null), null);
  assert.equal(actionBlocker('acceptAll', { kind: 'truncated' }, 'truncated'), 'ai.review.truncated');
  assert.equal(actionBlocker('acceptAll', { kind: 'scopeLost' }, 'scopeLost'), 'ai.review.scopeLost');
  assert.equal(actionBlocker('acceptAll', none, 'conflict'), 'ai.review.conflict');
  assert.equal(actionBlocker('acceptAll', none, 'updating'), 'ai.review.updating');
  assert.equal(actionBlocker('acceptAll', none, 'notAcceptable'), 'ai.review.notAcceptable');
});

test('every note key exists in en.json', () => {
  for (const reason of ['generating', 'updating', 'conflict', 'scopeLost', 'truncated', 'notAcceptable']) assert.ok(`ai.review.${reason}` in EN_MESSAGES, reason);
});

test('the status line: nothing, the counter with progress and a live region, partial with Continue, the alert of the lost selection', () => {
  assert.equal(statusLine(none, t), null);
  assert.deepEqual(statusLine({ kind: 'generating', seconds: 3 }, t), { text: t('ai.generating', { seconds: 3 }), spoken: t('ai.generatingStarted'), alert: false, withContinue: false });
  assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.text, `${t('ai.generating', { seconds: 3 })} 1/3`);
  // Quello che si annuncia non contiene i secondi: cambia solo con il progresso.
  assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.spoken, t('ai.generatingProgress', { done: 1, total: 3 }));
  assert.equal(statusLine({ kind: 'generating', seconds: 9, done: 1, total: 3 }, t)!.spoken, statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.spoken);
  assert.deepEqual(statusLine({ kind: 'partial' }, t), { text: t('ai.status.partial'), spoken: null, alert: false, withContinue: true });
  assert.deepEqual(statusLine({ kind: 'truncated' }, t), { text: t('ai.status.truncated'), spoken: null, alert: false, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'scopeLost' }, t), { text: t('ai.error.scopeLost'), spoken: null, alert: true, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'applied' }, t), { text: t('ai.applied'), spoken: null, alert: false, withContinue: false });
});

test('the outcome of a generation: ready, partial, truncated; nothing without a proposal or for a lost selection (it has its alert)', () => {
  assert.equal(generationOutcome({ kind: 'none' }, true, 3, 'en', t), 'Proposal ready: 3 blocks to review');
  assert.equal(generationOutcome({ kind: 'none' }, true, 1, 'en', t), 'Proposal ready: 1 block to review', 'singular');
  assert.notEqual(generationOutcome({ kind: 'none' }, true, 3, 'en', t), t('ai.proposalReady'), 'not the text the chat log already says');
  assert.equal(generationOutcome({ kind: 'none' }, true, 0, 'en', t), t('ai.proposalReady'), 'no blocks counted: the plain text');
  assert.equal(generationOutcome({ kind: 'partial' }, true, 3, 'en', t), t('ai.status.partial'));
  assert.equal(generationOutcome({ kind: 'truncated' }, true, 3, 'en', t), t('ai.status.truncated'));
  assert.equal(generationOutcome({ kind: 'none' }, false, 3, 'en', t), null);
  assert.equal(generationOutcome({ kind: 'scopeLost' }, true, 3, 'en', t), null);
});
