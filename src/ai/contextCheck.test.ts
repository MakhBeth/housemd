import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BRIDGE_MAX_BODY, checkContext, formatSize } from './contextCheck';
import { defaultProfile, needsContextConfirmation } from './profiles';
import type { ChatRequest } from './types';

const req = (text: string, system = 's'): ChatRequest => ({ model: 'm', system, messages: [{ role: 'user', text }], params: {} });
const files = [{ path: 'a.md', text: 'x'.repeat(400) }, { path: 'b.md', text: 'x'.repeat(4000) }];

test('ok con limite noto e ignoto; il totale conta system, messaggi e uscita', () => {
  const p = { ...defaultProfile(), contextTokens: 1000 };
  assert.deepEqual(checkContext(req('x'.repeat(400)), p, 100, [], new Map()), { kind: 'ok', totalTokens: 1 + 100 + 100, limit: 1000 });
  assert.deepEqual(checkContext(req('x'.repeat(400)), defaultProfile(), 0, [], new Map()), { kind: 'ok', totalTokens: 101, limit: null });
});

test('overLimit: eccedenza e file principali con via', () => {
  const p = { ...defaultProfile(), contextTokens: 500 };
  const r = checkContext(req('x'.repeat(4400)), p, 0, files, new Map([['b.md', 'note']]));
  assert.equal(r.kind, 'overLimit');
  if (r.kind === 'overLimit') {
    assert.equal(r.excess, r.totalTokens - 500);
    assert.deepEqual(r.top, [{ path: 'b.md', tokens: 1000, via: 'note' }, { path: 'a.md', tokens: 100 }]);
  }
});

test('overLimit: al massimo 5 file', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ path: `f${i}.md`, text: 'x'.repeat(40 + i) }));
  const r = checkContext(req('x'.repeat(4000)), { ...defaultProfile(), contextTokens: 10 }, 0, many, new Map());
  assert.ok(r.kind === 'overLimit' && r.top.length === 5);
});

test('bridge: oltre 5 MiB, indipendentemente dalla finestra', () => {
  const p = { ...defaultProfile('claude-code'), contextTokens: null };
  const r = checkContext(req('x'.repeat(BRIDGE_MAX_BODY + 1)), p, 0, [], new Map());
  assert.equal(r.kind, 'bridgeTooLarge');
  assert.equal(checkContext(req('piccolo'), p, 0, [], new Map()).kind, 'ok');
});

test('needsContextConfirmation: per ogni provider e openai-compatible su localhost', () => {
  assert.equal(needsContextConfirmation(defaultProfile('ollama')), false);
  assert.equal(needsContextConfirmation(defaultProfile('lmstudio')), false);
  assert.equal(needsContextConfirmation({ ...defaultProfile('ollama'), baseUrl: 'http://192.168.1.5:11434' }), true);
  assert.equal(needsContextConfirmation(defaultProfile('anthropic')), true);
  assert.equal(needsContextConfirmation(defaultProfile('claude-code')), true);
  assert.equal(needsContextConfirmation(defaultProfile('openai-compatible')), true);
  assert.equal(needsContextConfirmation({ ...defaultProfile('openai-compatible'), baseUrl: 'http://localhost:8080' }), true);
});

test('formatSize usa le unità della lingua', () => {
  assert.match(formatSize(2048, 'en'), /2\s?kB/);
  assert.match(formatSize(1.5 * 1024 * 1024, 'en'), /1\.5\s?MB/);
  assert.match(formatSize(1.5 * 1024 * 1024, 'it'), /1,5\s?MB/);
});
