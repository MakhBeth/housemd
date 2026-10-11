import test from 'node:test';
import assert from 'node:assert/strict';

import type { ReviewStatus } from '../../ai/reviewStatus';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { statusLine } from './reviewBarView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const none: ReviewStatus = { kind: 'none' };

test('the status line: nothing, the counter with progress and a live region, partial with Continue, the alert of the lost selection', () => {
  assert.equal(statusLine(none, t), null);
  assert.deepEqual(statusLine({ kind: 'generating', seconds: 3 }, t), { text: t('ai.generating', { seconds: 3 }), live: true, alert: false, withContinue: false });
  assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.text, `${t('ai.generating', { seconds: 3 })} 1/3`);
  assert.deepEqual(statusLine({ kind: 'partial' }, t), { text: t('ai.status.partial'), live: false, alert: false, withContinue: true });
  assert.deepEqual(statusLine({ kind: 'truncated' }, t), { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'scopeLost' }, t), { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'applied' }, t), { text: t('ai.applied'), live: false, alert: false, withContinue: false });
});
