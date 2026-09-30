import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from './index';
import { defaultProfile, effectiveParams, isLocalProfile, normalizeBaseUrl, resolveSecret, validateProfile } from '../profiles';
import { capabilities } from '../capabilities';
import { knownModel, modelOptions, modelForProvider } from '../models';
import { AiError, httpError, sanitizeDetail, mapError } from '../errors';
import { parseSse } from '../sse';
import type { ChatRequest, ProviderKind, StoredSecret } from '../types';
const signal = () => new AbortController().signal;
const req: ChatRequest = { model: 'test', system: 'system', messages: [{ role: 'user', text: 'documento' }], params: { temperature: .2 } };
const collect = async <T>(items: AsyncIterable<T>) => { const result: T[] = []; for await (const item of items) result.push(item); return result; };
const fakeFetch = (fn: (url: string, init?: RequestInit) => Promise<Response> | Response): typeof fetch => (async (url, init) => fn(String(url), init)) as typeof fetch;
const health = { app: 'housemd-bridge', protocol: 1, protections: { originCheck: true, noTools: true, noSessionPersistence: true } };
function chunks(parts: string[]) { return new ReadableStream<Uint8Array>({ start(controller) { for (const part of parts) controller.enqueue(new TextEncoder().encode(part)); controller.close(); } }); }
test('SSE: chunk spezzati, CRLF, multilinea, keepalive e DONE', async () => {
  assert.deepEqual(await collect(parseSse(chunks([':ping\r', '\ndata: uno\r', '\ndata: due\r\n\r', '\ndata: [DO', 'NE]\n\ndata: ignorato\n\n']))), ['uno\ndue', '[DONE]']);
});
test('profili, default, capacità e priorità parametri', () => {
  const p = defaultProfile(); assert.equal(normalizeBaseUrl('http://localhost:11434/v1/'), p.baseUrl);
  assert.equal(validateProfile({ kind: 'invalid', params: { topP: 9, temperature: NaN } }).kind, 'ollama');
  assert.deepEqual(effectiveParams(p, { temperature: .8 }, { params: { temperature: .1, topP: .5 } }), { temperature: .8, topP: .5 });
  assert.equal(capabilities('anthropic', 'claude-opus-5').temperature, false);
  assert.equal(capabilities('anthropic', 'claude-sonnet-4-5').temperature, true);
  assert.equal(capabilities('claude-code', 'opus').maxOutputTokens, false);
  assert.equal(isLocalProfile(p), true); assert.equal(isLocalProfile({ ...p, baseUrl: 'https://example.com' }), false);
  assert.throws(() => normalizeBaseUrl('https://user:password@example.com'), AiError);
});
test('modelli conosciuti, cambio provider e personalizzati', () => {
  assert.equal(knownModel('claude-code', 'opus'), true); assert.equal(modelForProvider('claude-code', 'opus'), 'opus');
  assert.equal(modelForProvider('claude-code', 'unknown'), ''); assert.equal(modelOptions('lmstudio', 'my-custom')[0].value, 'my-custom');
});
test('binding blocca chat ed elenco prima di fetch; origine e provider devono coincidere', async () => {
  const p = { ...defaultProfile('openai-compatible'), secretId: 'key' }; const secret: StoredSecret = { id: 'key', value: 'secret', binding: { kind: p.kind, origin: p.baseUrl } };
  assert.equal(resolveSecret(p, secret), 'secret'); assert.throws(() => resolveSecret({ ...p, kind: 'ollama' }, secret), { code: 'secretBinding' });
  let calls = 0; const provider = createProvider({ ...p, baseUrl: 'https://evil.example' }, secret, { fetch: fakeFetch(() => { calls++; return Response.json({}); }) });
  await assert.rejects(collect(provider.stream(req, signal())), { code: 'secretBinding' }); await assert.rejects(provider.listModels(signal()), { code: 'secretBinding' }); assert.equal(calls, 0);
});
for (const kind of ['ollama', 'lmstudio', 'openai-compatible'] as ProviderKind[]) test(`${kind}: stream testo, usage e fine; nessun redirect`, async () => {
  const p = defaultProfile(kind); const provider = createProvider(p, null, { fetch: fakeFetch((url, init) => { assert.equal(url, p.baseUrl + '/v1/chat/completions'); assert.equal(init?.redirect, 'error'); const body = JSON.parse(String(init?.body)); assert.equal(body.stream, true); assert.equal(body.messages[1].content, 'documento'); return new Response(chunks(['data: {"choices":[{"delta":{"content":"ciao"}}]}\n\n', 'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\ndata: [DONE]\n\n'])); }) });
  assert.deepEqual(await collect(provider.stream(req, signal())), [{ type: 'text', text: 'ciao' }, { type: 'usage', inputTokens: 4, outputTokens: 2 }, { type: 'done', stop: 'end' }]);
});
test('elenchi Ollama, LM Studio fallback 404, errori rete', async () => {
  const ollama = createProvider(defaultProfile(), null, { fetch: fakeFetch(url => { assert.ok(url.endsWith('/api/tags')); return Response.json({ models: [{ name: 'qwen' }] }); }) }); assert.equal((await ollama.listModels(signal()))?.[0].value, 'qwen');
  const urls: string[] = []; const lm = createProvider(defaultProfile('lmstudio'), null, { fetch: fakeFetch(url => { urls.push(url); return url.endsWith('/api/v0/models') ? new Response('', { status: 404 }) : Response.json({ data: [{ id: 'local' }] }); }) });
  assert.equal((await lm.listModels(signal()))?.[0].value, 'local'); assert.equal(urls.length, 2);
  const down = createProvider(defaultProfile(), null, { fetch: fakeFetch(() => { throw new TypeError('network'); }) }); assert.equal(await down.listModels(signal()), null);
});
test('JSON malformato e stream troncato non passano per completati', async () => {
  for (const text of ['data: {oops}\n\n', 'data: {"choices":[{"delta":{"content":"part"}}]}\n\n']) { const p = createProvider(defaultProfile(), null, { fetch: fakeFetch(() => new Response(text)) }); await assert.rejects(collect(p.stream(req, signal())), { code: 'badStream' }); }
});
test('abort a metà stream conserva errore aborted', async () => {
  const abort = new AbortController(); const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"part"}}]}\n\n')); } });
  const p = createProvider(defaultProfile(), null, { fetch: fakeFetch(() => new Response(body)) }); const iterator = p.stream(req, abort.signal)[Symbol.asyncIterator](); assert.equal((await iterator.next()).value.type, 'text'); abort.abort(); await assert.rejects(iterator.next(), { code: 'aborted' });
});
test('bridge health incompatibile non riceve documento; 403 è origine respinta', async () => {
  for (const value of [null, { ...health, app: 'tg-digest' }, { ...health, protocol: 2 }, { ...health, protections: { ...health.protections, noTools: false } }]) {
    let calls = 0; const p = createProvider(defaultProfile('claude-code'), null, { fetch: fakeFetch(url => { calls++; assert.ok(url.endsWith('/health')); return value ? Response.json(value) : new Response('', { status: 404 }); }) });
    await assert.rejects(collect(p.stream(req, signal())), { code: 'bridgeIncompatible' }); assert.equal(calls, 1);
  }
  const p = createProvider(defaultProfile('claude-code'), null, { fetch: fakeFetch(() => new Response('', { status: 403 })) }); await assert.rejects(p.listModels(signal()), { code: 'originRejected' });
});
test('bridge risposta intera, cache health e riverifica dopo errore rete', async () => {
  let checks = 0; let fail = false; const p = createProvider(defaultProfile('claude-code'), null, { fetch: fakeFetch((url, init) => { if (url.endsWith('/health')) { checks++; return Response.json(health); } if (fail) throw new TypeError('offline'); assert.equal(JSON.parse(String(init?.body)).stream, false); return Response.json({ choices: [{ message: { content: 'risposta' }, finish_reason: 'stop' }] }); }) });
  const events = await collect(p.stream(req, signal())); assert.equal(events[1].type, 'text'); await collect(p.stream(req, signal())); assert.equal(checks, 1); fail = true; await assert.rejects(collect(p.stream(req, signal())), { code: 'bridgeDown' }); fail = false; await collect(p.stream(req, signal())); assert.equal(checks, 2); await p.listModels(signal()); assert.equal(checks, 3);
});
for (const stop of ['end_turn', 'max_tokens', 'refusal']) test(`Anthropic SDK finto: ${stop}, testo/ragionamento/usage`, async () => {
  const p = defaultProfile('anthropic'); const secret: StoredSecret = { id: 'a', value: 'test', binding: { kind: p.kind, origin: p.baseUrl } };
  const provider = createProvider(p, secret, { anthropic: async options => { assert.equal(options.maxRetries, 0); return ({ messages: { async *stream(body) { assert.equal(body.max_tokens, 64000); assert.deepEqual(body.thinking, { type: 'adaptive' }); assert.equal(body.temperature, undefined); yield { type: 'content_block_start', content_block: { type: 'thinking' } }; yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'testo' } }; yield { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 2 } }; } } }); } });
  const events = await collect(provider.stream({ ...req, model: 'claude-opus-5' }, signal())); assert.equal(events[0].type, 'thinking'); assert.equal(events[1].type, 'text'); assert.equal(events[2].type, 'usage'); assert.deepEqual(events[3], { type: 'done', stop: stop === 'end_turn' ? 'end' : stop === 'max_tokens' ? 'length' : 'refusal' });
});
test('errori HTTP e segreti ripuliti', () => {
  for (const [status, code] of [[401, 'unauthorized'], [404, 'notFound'], [429, 'rateLimited'], [500, 'server']] as const) assert.equal(httpError(status).code, code);
  assert.equal(httpError(400, 'temperature unsupported').code, 'paramRejected'); assert.equal(httpError(429, '', undefined, '10').retryAfter, '10'); assert.ok(!sanitizeDetail('Authorization: Bearer abc\nx-api-key: secret\nsk-ant-test').includes('secret')); assert.equal(sanitizeDetail('custom=hidden', ['hidden']), 'custom=[redacted]');
});
test('LM Studio esclude embedding e conserva contesto dei modelli scaricati', async () => {
  const p = createProvider(defaultProfile('lmstudio'), null, { fetch: fakeFetch(() => Response.json({ data: [{ id: 'embed', type: 'embeddings' }, { id: 'chat', type: 'llm', max_context_length: 32000 }] })) });
  assert.deepEqual(await p.listModels(signal()), [{ value: 'chat', label: 'chat', contextTokens: 32000 }]);
});
test('errori HTTP adapter non espongono una chiave arbitraria restituita dal server', async () => {
  const profile = defaultProfile('openai-compatible'); const secret: StoredSecret = { id: 'key', value: 'arbitrary-secret-value', binding: { kind: profile.kind, origin: profile.baseUrl } };
  const p = createProvider(profile, secret, { fetch: fakeFetch(() => Response.json({ error: 'unauthorized arbitrary-secret-value' }, { status: 401 })) });
  await assert.rejects(collect(p.stream(req, signal())), (error: unknown) => error instanceof AiError && error.code === 'unauthorized' && !error.detail.includes(secret.value));
});

test('classi errore SDK native: abort e timeout restano distinti senza import anticipato', async () => {
  const { APIUserAbortError, APIConnectionTimeoutError } = await import('@anthropic-ai/sdk');
  assert.equal(mapError(new APIUserAbortError(), 'anthropic').code, 'aborted');
  assert.equal(mapError(new APIConnectionTimeoutError(), 'anthropic').code, 'timeout');
});
