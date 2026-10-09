import test from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { chatEntries } from './chatLogView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const msg = (patch: Partial<ChatMessage>): ChatMessage => ({ id: 'm', role: 'assistant', text: '', docPath: null, status: 'done', ...patch });

test('the document button shows only when the document changes from the message before', () => {
  const entries = chatEntries(
    [msg({ id: '1', role: 'user', docPath: 'a.md' }), msg({ id: '2', docPath: 'a.md' }), msg({ id: '3', role: 'user', docPath: 'b.md' }), msg({ id: '4', docPath: null })],
    t,
  );
  assert.deepEqual(entries.map((e) => e.file), ['a.md', null, 'b.md', null]);
});

test('user text stays as typed; an empty reply says working or ready', () => {
  const [user, streaming, done, filled] = chatEntries(
    [msg({ id: '1', role: 'user', text: '<b>x</b>' }), msg({ id: '2', status: 'streaming' }), msg({ id: '3', status: 'done' }), msg({ id: '4', text: '**ok**', status: 'streaming' })],
    t,
  );
  assert.deepEqual([user.role, user.text, user.meta], ['user', '<b>x</b>', null]);
  assert.equal(streaming.text, EN_MESSAGES['ai.working']);
  assert.equal(done.text, EN_MESSAGES['ai.proposalReady']);
  assert.equal(filled.text, '**ok**');
});

test('notices in order (summary, error, warnings); Retry on errors, Reset · Retry on a rejected parameter', () => {
  const [entry] = chatEntries(
    [msg({ status: 'error', error: 'paramRejected', summary: { parts: 2, originalWords: 10, proposalWords: 12 }, warnings: [{ code: 'code' }, { code: 'urls' }] })],
    t,
  );
  assert.deepEqual(entry.notices, [
    `2 · 10 → 12 ${EN_MESSAGES['ai.words']}`,
    EN_MESSAGES['ai.error.paramRejected'],
    EN_MESSAGES['ai.warning.code'],
    EN_MESSAGES['ai.warning.urls'],
  ]);
  assert.equal(entry.retry, EN_MESSAGES['ai.retry']);
  assert.equal(entry.reset, `${EN_MESSAGES['ai.reset']} · ${EN_MESSAGES['ai.retry']}`);
  const [ok] = chatEntries([msg({ status: 'done' })], t);
  assert.deepEqual([ok.notices, ok.retry, ok.reset], [[], null, null]);
  // Un errore senza status 'error' (richiesta interrotta) non offre Riprova.
  const [aborted] = chatEntries([msg({ status: 'aborted', error: 'aborted' })], t);
  assert.equal(aborted.retry, null);
});

test('reply metadata: profile, model and tokens, skipping what is missing (empty string when nothing)', () => {
  const metas = chatEntries(
    [
      msg({ id: '1', profileName: 'ollama', model: 'qwen', usage: { inputTokens: 12, outputTokens: 34 } }),
      msg({ id: '2', profileName: 'ollama', usage: { inputTokens: 5 } }),
      msg({ id: '3', model: 'qwen', usage: { outputTokens: 9 } }),
      msg({ id: '4' }),
    ],
    t,
  ).map((e) => e.meta);
  assert.deepEqual(metas, ['ollama · qwen · 12 → 34', 'ollama · 5 → 0', 'qwen', '']);
});
