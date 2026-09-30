import test from 'node:test';
import assert from 'node:assert/strict';
import { createCursor, partialText, runRequest, type RunInput, type RunCursor, type RunEvent } from './runner';
import { defaultProfile } from './profiles';
import { builtInPresets } from './presets';
import { AiError } from './errors';
import type { ChatEvent, ChatProvider, ChatRequest } from './types';
const signal = () => new AbortController().signal;
const collect = async (items: AsyncIterable<RunEvent>) => { const events: RunEvent[] = []; for await (const item of items) events.push(item); return events; };
const input = (patch: Partial<RunInput> = {}): RunInput => ({ path: 'doc.md', document: 'Originale', request: 'Correggi', history: [], profile: defaultProfile(), params: {}, ...patch });
const provider = (stream: (req: ChatRequest, signal: AbortSignal) => AsyncIterable<ChatEvent>): ChatProvider => ({ stream, async listModels() { return []; } });
const transform = () => builtInPresets()[0];
test('chat libera conserva originale e proposta distinti, tag frammentati e commento', async () => {
  const i = input({ proposal: 'Proposta precedente' }); const cursor = createCursor(i); assert.deepEqual(cursor.chunks, ['Originale']);
  const p = provider(async function* (req) {
    assert.match(req.messages.at(-1)!.text, /<document path="doc.md">\nOriginale\n<\/document>/);
    assert.match(req.messages.at(-1)!.text, /<current-proposal>\nProposta precedente\n<\/current-proposal>/);
    for (const text of ['Commento<house', 'md-proposal>Nuovo', '</housemd-proposal>Fine']) yield { type: 'text', text };
    yield { type: 'done', stop: 'end' };
  });
  const events = await collect(runRequest(i, p, signal(), cursor));
  assert.deepEqual(events.at(-1), { type: 'done', text: 'Nuovo', comment: 'CommentoFine', truncated: false });
});
test('chat senza tag non genera proposta', async () => {
  const i = input(); const p = provider(async function* () { yield { type: 'text', text: 'Solo una spiegazione' }; yield { type: 'done', stop: 'end' }; });
  assert.deepEqual((await collect(runRequest(i, p, signal(), createCursor(i)))).at(-1), { type: 'done', text: null, comment: 'Solo una spiegazione', truncated: false });
});
test('preset protegge frontmatter, rimuove recinto e usa proposta come sorgente', async () => {
  const i = input({ preset: transform(), document: 'vecchio', proposal: '---\ntitle: Segreto\n---\nNuovo testo' }); const cursor = createCursor(i);
  assert.equal(cursor.prefix + cursor.chunks.join(''), i.proposal);
  const p = provider(async function* (req) { assert.ok(!JSON.stringify(req).includes('title: Segreto')); yield { type: 'text', text: '```markdown\nTrasformato\n```' }; yield { type: 'done', stop: 'end' }; });
  const last = (await collect(runRequest(i, p, signal(), cursor))).at(-1);
  assert.equal(last?.type, 'done'); if (last?.type === 'done') assert.equal(last.text, cursor.prefix + 'Trasformato');
});
test('parti: ordine sequenziale, contesto sola lettura, separatori e usage cumulativo', async () => {
  const i = input({ preset: transform() }); const cursor: RunCursor = { chunks: ['Prima\n\n', 'Seconda'], prefix: '', next: 0, results: [] }; let calls = 0;
  const p = provider(async function* (req) {
    const part = calls++;
    if (part === 1) assert.match(req.messages.at(-1)!.text, /<read-only-context>A\n\n<\/read-only-context>/);
    yield { type: 'thinking' }; yield { type: 'usage', inputTokens: 10 + part, outputTokens: 0 };
    yield { type: 'text', text: part ? 'B' : 'A' }; yield { type: 'usage', outputTokens: 4 + part };
    yield { type: 'done', stop: 'end' };
  });
  const events = await collect(runRequest(i, p, signal(), cursor));
  assert.equal(calls, 2); assert.equal(cursor.next, 2); assert.equal(partialText(cursor), 'A\n\nB');
  assert.deepEqual(events.filter(e => e.type === 'usage').at(-1), { type: 'usage', inputTokens: 21, outputTokens: 9 });
  assert.equal(events.filter(e => e.type === 'thinking').length, 2);
});
test('errore parte due conserva prima e originali; Continua riprende solo la parte incompleta', async () => {
  const i = input({ preset: transform() }); const cursor: RunCursor = { chunks: ['Prima\n\n', 'Seconda', 'Terza'], prefix: 'YAML\n', next: 0, results: [] }; let calls = 0;
  const failing = provider(async function* () { if (calls++ === 1) throw new AiError('server'); yield { type: 'text', text: 'A' }; yield { type: 'done', stop: 'end' }; });
  await assert.rejects(collect(runRequest(i, failing, signal(), cursor)), { code: 'server' });
  assert.equal(cursor.next, 1); assert.equal(partialText(cursor), 'YAML\nA\n\nSecondaTerza');
  let resumed = 0; const p = provider(async function* () { yield { type: 'text', text: ++resumed === 1 ? 'B' : 'C' }; yield { type: 'done', stop: 'end' }; });
  const events = await collect(runRequest(i, p, signal(), cursor)); assert.equal(resumed, 2); assert.equal(cursor.next, 3);
  assert.deepEqual(events.at(-1), { type: 'done', text: 'YAML\nA\n\nBC', comment: '', truncated: false });
});
test('stop length conserva stato troncato e non avvia parti successive; refusal è errore', async () => {
  const i = input({ preset: transform() }); const cursor: RunCursor = { chunks: ['Prima', 'Seconda'], prefix: '', next: 0, results: [] }; let calls = 0;
  const p = provider(async function* () { calls++; yield { type: 'text', text: 'Parziale' }; yield { type: 'done', stop: 'length' }; });
  const events = await collect(runRequest(i, p, signal(), cursor)); assert.equal(calls, 1); assert.equal(cursor.next, 0);
  assert.deepEqual(events.at(-1), { type: 'done', text: 'ParzialeSeconda', comment: '', truncated: true });
  const refusing = provider(async function* () { yield { type: 'done', stop: 'refusal' }; });
  await assert.rejects(collect(runRequest(i, refusing, signal(), createCursor(i))), { code: 'refused' });
});
test('budget contesto include prompt/storico/output: tooLong prima di qualunque chiamata', async () => {
  const i = input({ profile: { ...defaultProfile(), contextTokens: 100 }, params: { maxOutputTokens: 80 } }); let calls = 0;
  const p = provider(async function* () { calls++; yield { type: 'done', stop: 'end' }; });
  await assert.rejects(collect(runRequest(i, p, signal(), createCursor(i))), { code: 'tooLong' }); assert.equal(calls, 0);
});
test('abort prima dell’esecuzione non contatta il provider', async () => {
  const abort = new AbortController(); abort.abort(); let calls = 0; const i = input();
  const p = provider(async function* () { calls++; yield { type: 'done', stop: 'end' }; });
  await assert.rejects(collect(runRequest(i, p, abort.signal, createCursor(i))), { name: 'AbortError' }); assert.equal(calls, 0);
});
