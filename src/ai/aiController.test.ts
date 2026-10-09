import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeSet, Text } from '@codemirror/state';
import { AiController, type AiState } from './aiController';
import { createMemoryAiStores } from './stores';
import type { ChatEvent, ChatRequest, ModelProfile, SelectionScope } from './types';
import { builtInPresets } from './presets';
import { AiError } from './errors';
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function untilAbort(signal: AbortSignal): Promise<never> { signal.throwIfAborted(); return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true })); }
function stateWhen(controller: AiController, predicate: (state: AiState) => boolean): Promise<void> {
  if (predicate(controller.getState())) return Promise.resolve();
  return new Promise((resolve, reject) => { const timer = setTimeout(() => { unsubscribe(); reject(new Error('Stato atteso non raggiunto')); }, 2000); const unsubscribe = controller.subscribe(() => { if (predicate(controller.getState())) { clearTimeout(timer); unsubscribe(); resolve(); } }); });
}
async function fixture(stream?: (req: ChatRequest, signal: AbortSignal, call: number) => AsyncIterable<ChatEvent>) {
  const world = { doc: { path: 'a.md', textLf: 'Originale A', conflict: null as unknown, updating: false }, snapshots: 0 };
  const requests: ChatRequest[] = []; const profiles: ModelProfile[] = [];
  const store = createMemoryAiStores({ writerId: 'test', now: () => 100 });
  const controller = new AiController(store, { getDoc: () => world.doc, snapshotBeforeAi() { world.snapshots++; }, openFile(path) { world.doc = { ...world.doc, path }; } }, p => {
    profiles.push(p);
    return { async listModels() { return []; }, async *stream(req, signal) { requests.push(req); if (stream) yield* stream(req, signal, requests.length); else { yield { type: 'text', text: '<housemd-proposal>Proposta</housemd-proposal>' }; yield { type: 'done', stop: 'end' }; } } };
  });
  await controller.initialize(); return { controller, world, store, requests, profiles };
}
test('file cambiato durante stream: proposta e chat restano correlate al file iniziale', async () => {
  const gate = deferred();
  const f = await fixture(async function* () { yield { type: 'text', text: '<housemd-proposal>Pro' }; await gate.promise; yield { type: 'text', text: 'posta</housemd-proposal>' }; yield { type: 'done', stop: 'end' }; });
  const running = f.controller.send('Correggi A'); await stateWhen(f.controller, s => s.proposals.get('a.md')?.status === 'streaming');
  f.world.doc = { ...f.world.doc, path: 'b.md', textLf: 'Proposta' }; assert.equal(f.controller.canAccept(f.controller.getState().proposals.get('a.md')!), false);
  gate.resolve(); await running;
  const state = f.controller.getState(); assert.equal(state.proposals.get('a.md')?.text, 'Proposta'); assert.equal(state.proposals.has('b.md'), false);
  assert.ok(state.chat.messages.every(m => m.docPath === 'a.md')); assert.equal(f.controller.hasPendingWork(), true);
});
test('una richiesta alla volta, Stop rende il frammento leggibile senza accetta tutto', async () => {
  const f = await fixture(async function* (_req, signal) { yield { type: 'text', text: '<housemd-proposal>Frammento' }; await untilAbort(signal); });
  const running = f.controller.send('Prima'); await stateWhen(f.controller, s => !!s.proposals.size);
  const streaming = f.controller.getState().proposals.get('a.md')!; assert.equal(f.controller.canAccept(streaming), false);
  await f.controller.send('Seconda'); assert.equal(f.requests.length, 1); f.controller.stop(); await running;
  const state = f.controller.getState(); const stopped = state.proposals.get('a.md')!;
  assert.equal(stopped.status, 'truncated'); assert.equal(stopped.text, 'Frammento'); assert.equal(f.controller.canAccept(stopped), true); assert.equal(f.controller.canAccept(stopped, true), false);
  assert.equal(state.chat.messages.at(-1)?.status, 'aborted'); assert.equal(state.running, null);
});
test('Nuova chat interrompe e impedisce ai messaggi della vecchia richiesta di ricomparire', async () => {
  const f = await fixture(async function* (_req, signal) { yield { type: 'thinking' }; await untilAbort(signal); });
  const running = f.controller.send('Vecchia'); await stateWhen(f.controller, s => !!s.running); const oldId = f.controller.getState().chat.id;
  f.controller.newChat(); await running;
  assert.notEqual(f.controller.getState().chat.id, oldId); assert.deepEqual(f.controller.getState().chat.messages, []); assert.equal(f.controller.getState().running, null);
});
test('preset a parti: Stop preserva parti finite e originali; Continua non rifà la prima', async () => {
  const secondStarted = deferred();
  const f = await fixture(async function* (_req, signal, call) { if (call === 2) { secondStarted.resolve(); await untilAbort(signal); } yield { type: 'text', text: call === 1 ? 'Prima corretta' : 'Seconda corretta' }; yield { type: 'done', stop: 'end' }; });
  f.world.doc.textLf = 'A'.repeat(100) + '\n\n' + 'B'.repeat(100); f.controller.override({ chunkChars: 100 });
  const running = f.controller.send('Sbobina', builtInPresets()[0]); await secondStarted.promise; f.controller.stop(); await running;
  const partial = f.controller.getState().proposals.get('a.md')!; assert.equal(partial.status, 'partial'); assert.equal(partial.text, 'Prima corretta\n\n' + 'B'.repeat(100)); assert.equal(f.controller.canAccept(partial, true), true);
  await f.controller.continue('a.md'); assert.equal(f.requests.length, 3); const final = f.controller.getState().proposals.get('a.md')!;
  assert.equal(final.status, 'complete'); assert.equal(final.text, 'Prima corretta\n\nSeconda corretta');
});
test('proposta ritoccata non viene sovrascritta durante stream; Stop conserva i ritocchi', async () => {
  const f = await fixture(async function* (_req, signal, call) { yield { type: 'text', text: `<housemd-proposal>${call === 1 ? 'Prima' : 'Nuova'}` }; if (call > 1) await untilAbort(signal); yield { type: 'text', text: '</housemd-proposal>' }; yield { type: 'done', stop: 'end' }; });
  await f.controller.send('Prima'); f.controller.edited('a.md', 'Ritocco manuale');
  const running = f.controller.send('Seconda'); await stateWhen(f.controller, s => s.streamingPreview !== null);
  assert.equal(f.controller.getState().proposals.get('a.md')?.text, 'Ritocco manuale'); assert.equal(f.controller.getState().streamingPreview, 'Nuova');
  f.controller.stop(); await running; assert.equal(f.controller.getState().proposals.get('a.md')?.text, 'Ritocco manuale'); assert.equal(f.controller.getState().proposals.get('a.md')?.origin, 'edited');
});
test('snapshot una sola volta per proposta; conflitto e aggiornamento disabilitano accettazione', async () => {
  const f = await fixture(); await f.controller.send('Proponi'); let p = f.controller.getState().proposals.get('a.md')!;
  f.world.doc.conflict = { text: 'Conflitto' }; assert.equal(f.controller.beforeAccept(p), false); assert.equal(f.world.snapshots, 0);
  f.world.doc.conflict = null; f.world.doc.updating = true; assert.equal(f.controller.canAccept(p), false); f.world.doc.updating = false;
  assert.equal(f.controller.beforeAccept(p), true); p = f.controller.getState().proposals.get('a.md')!; assert.equal(f.controller.beforeAccept(p), true); assert.equal(f.world.snapshots, 1);
});
test('pending impedisce update; dopo scarto prepare blocca nuove richieste fino a cancel', async () => {
  const f = await fixture(); await f.controller.send('Proponi'); assert.equal(f.controller.hasPendingWork(), true); assert.equal(await f.controller.prepare(), 'failed'); assert.equal(f.controller.getState().error, 'aiPendingUpdate');
  f.controller.discard('a.md'); assert.equal(f.controller.hasPendingWork(), false); assert.equal(await f.controller.prepare(), 'durable');
  await f.controller.send('Bloccata'); assert.equal(f.requests.length, 1); f.controller.cancel(); await f.controller.send('Ammessa'); assert.equal(f.requests.length, 2);
  f.world.doc.textLf = 'Proposta'; assert.equal(f.controller.hasPendingWork(), false);
});
test('richiesta senza testo ancora prodotto è comunque lavoro pendente per update', async () => {
  const f = await fixture(async function* (_req, signal) { yield { type: 'thinking' }; await untilAbort(signal); });
  const running = f.controller.send('Proponi'); await stateWhen(f.controller, s => !!s.running);
  assert.equal(await f.controller.prepare(), 'failed'); f.controller.stop(); await running; assert.equal(f.controller.hasPendingWork(), false);
});
test('override al volo, salvataggio nel profilo e duplicazione rispettano la priorità utente', async () => {
  const f = await fixture(); f.controller.override({ model: 'custom', temperature: .7 }); await f.controller.send('Proponi', builtInPresets()[0]);
  assert.equal(f.requests[0].model, 'custom'); assert.equal(f.requests[0].params.temperature, .7);
  const original = f.controller.profile()!.id; await f.controller.saveOverrides(); assert.equal(f.controller.profile()!.model, 'custom'); assert.deepEqual(f.controller.getState().chat.overrides, {});
  f.controller.override({ model: 'another' }); await f.controller.saveOverrides(true); assert.notEqual(f.controller.profile()!.id, original); assert.equal(f.controller.profile()!.model, 'another'); assert.equal(f.controller.getState().profiles.length, 2);
});
test('usage Anthropic input/output separati non perdono inputTokens', async () => {
  const f = await fixture(async function* () { yield { type: 'usage', inputTokens: 20 }; yield { type: 'text', text: 'Commento' }; yield { type: 'usage', outputTokens: 7 }; yield { type: 'done', stop: 'end' }; });
  await f.controller.send('Domanda'); assert.deepEqual(f.controller.getState().chat.messages.at(-1)?.usage, { inputTokens: 20, outputTokens: 7 }); assert.equal(f.controller.getState().proposals.size, 0);
});
test('selezione: rimappatura fuori intervallo, perdita dentro e proposta intera nella chat successiva', async () => {
  const f = await fixture(); f.world.doc.textLf = 'abc DEF ghi'; const scope: SelectionScope = { from: 4, to: 7, originalText: 'DEF', status: 'valid' };
  await f.controller.send('Correggi selezione', undefined, scope); let p = f.controller.getState().proposals.get('a.md')!; assert.equal(f.controller.proposalText(p), 'abc Proposta ghi');
  await f.controller.send('Ora tutto'); assert.match(f.requests[1].messages.at(-1)!.text, /<current-proposal>\nabc Proposta ghi\n<\/current-proposal>/);
  f.controller.discard('a.md'); await f.controller.send('Selezione ancora', undefined, scope);
  const before = ChangeSet.of({ from: 0, insert: 'X' }, f.world.doc.textLf.length); const changedText = before.apply(Text.of(f.world.doc.textLf.split('\n'))).toString();
  f.controller.documentChanged('a.md', before); f.world.doc.textLf = changedText; p = f.controller.getState().proposals.get('a.md')!; assert.equal(p.scope?.from, 5); assert.equal(p.scope?.status, 'valid');
  const inside = ChangeSet.of({ from: 6, to: 7, insert: 'Z' }, f.world.doc.textLf.length); f.controller.documentChanged('a.md', inside); p = f.controller.getState().proposals.get('a.md')!;
  assert.equal(p.scope?.status, 'lost'); assert.equal(f.controller.canAccept(p), false);
});
test('errore provider resta nel messaggio senza lasciare running bloccato', async () => {
  const f = await fixture(async function* () { throw new AiError('unauthorized'); yield { type: 'thinking' }; });
  await f.controller.send('Proponi'); const state = f.controller.getState(); assert.equal(state.running, null); assert.equal(state.chat.messages.at(-1)?.error, 'unauthorized'); assert.equal(state.chat.messages.at(-1)?.status, 'error');
});

test('regressione: scartare mentre la nuova richiesta ragiona non fa risorgere la proposta precedente', async () => {
  const waiting = deferred();
  const f = await fixture(async function* (_req, signal, call) {
    if (call > 1) { waiting.resolve(); await untilAbort(signal); }
    yield { type: 'text', text: '<housemd-proposal>Precedente</housemd-proposal>' }; yield { type: 'done', stop: 'end' };
  });
  await f.controller.send('Prima'); const running = f.controller.send('Seconda'); await waiting.promise;
  f.controller.discard('a.md'); await running; assert.equal(f.controller.getState().proposals.has('a.md'), false);
});
test('regressione: snapshot una volta anche se due controlli hanno la stessa referenza proposta', async () => {
  const f = await fixture(); await f.controller.send('Proponi'); const p = f.controller.getState().proposals.get('a.md')!;
  assert.equal(f.controller.beforeAccept(p), true); assert.equal(f.controller.beforeAccept(p), true); assert.equal(f.world.snapshots, 1);
});
test('regressione: proposta ritoccata non accettabile mentre una nuova generazione è in corso', async () => {
  const f = await fixture(async function* (_req, signal, call) {
    yield { type: 'text', text: '<housemd-proposal>Nuova' };
    if (call > 1) await untilAbort(signal);
    yield { type: 'text', text: '</housemd-proposal>' }; yield { type: 'done', stop: 'end' };
  });
  await f.controller.send('Prima'); f.controller.edited('a.md', 'Ritoccata'); const running = f.controller.send('Seconda');
  await stateWhen(f.controller, s => s.streamingPreview !== null);
  const allowed = f.controller.canAccept(f.controller.getState().proposals.get('a.md')!);
  f.controller.stop(); await running; assert.equal(allowed, false);
});

test('applicazione completa riconosciuta anche dopo cambio file; ritocco successivo torna pendente', async () => {
  const f = await fixture(); await f.controller.send('Proponi'); const p = f.controller.getState().proposals.get('a.md')!;
  assert.equal(f.controller.beforeAccept(p, true), true);
  const changes = ChangeSet.of({ from: 0, to: f.world.doc.textLf.length, insert: p.text }, f.world.doc.textLf.length);
  f.controller.documentChanged('a.md', changes); f.world.doc.textLf = p.text;
  assert.equal(f.controller.hasPendingWork(), false);
  f.world.doc = { ...f.world.doc, path: 'b.md', textLf: 'Altro documento' }; assert.equal(f.controller.hasPendingWork(), false);
  f.world.doc = { ...f.world.doc, path: 'a.md', textLf: p.text };
  f.controller.edited('a.md', 'Una nuova revisione manuale'); assert.equal(f.controller.hasPendingWork(), true);
});


test('Riprova rimappa la selezione anche prima che esista una proposta, senza colpire testo omonimo', async () => {
  const f = await fixture(async function* (_req, _signal, call) {
    if (call === 1) throw new AiError('server');
    yield { type: 'text', text: '<housemd-proposal>NEW</housemd-proposal>' };
    yield { type: 'done', stop: 'end' };
  });
  f.world.doc.textLf = 'AAA AAA';
  await f.controller.send('Correggi secondo AAA', undefined, { from: 4, to: 7, originalText: 'AAA', status: 'valid' });
  const messageId = f.controller.getState().chat.messages.at(-1)!.id;
  const changes = ChangeSet.of({ from: 0, insert: 'BBB ' }, f.world.doc.textLf.length);
  f.controller.documentChanged('a.md', changes);
  f.world.doc.textLf = changes.apply(Text.of([f.world.doc.textLf])).toString();
  await f.controller.retry(messageId);
  const p = f.controller.getState().proposals.get('a.md')!;
  assert.deepEqual(p.scope, { from: 8, to: 11, originalText: 'AAA', status: 'valid' });
  assert.equal(f.controller.proposalText(p), 'BBB AAA NEW');
});

test('Riprova non riabilita una selezione invalidata da una modifica interna', async () => {
  const f = await fixture(async function* (_req, _signal, call) {
    if (call === 1) throw new AiError('server');
    yield { type: 'text', text: '<housemd-proposal>NEW</housemd-proposal>' };
    yield { type: 'done', stop: 'end' };
  });
  f.world.doc.textLf = 'AAA AAA';
  await f.controller.send('Correggi secondo AAA', undefined, { from: 4, to: 7, originalText: 'AAA', status: 'valid' });
  const messageId = f.controller.getState().chat.messages.at(-1)!.id;
  for (const insert of ['B', 'A']) {
    const changes = ChangeSet.of({ from: 5, to: 6, insert }, f.world.doc.textLf.length);
    f.controller.documentChanged('a.md', changes);
    f.world.doc.textLf = changes.apply(Text.of([f.world.doc.textLf])).toString();
  }
  await f.controller.retry(messageId);
  const p = f.controller.getState().proposals.get('a.md')!;
  assert.equal(p.scope?.status, 'lost');
  assert.equal(f.controller.canAccept(p, true), false);
});


test('selezione: accetta tutto ripetuto conserva prefisso e suffisso del documento', async () => {
  const f = await fixture(); f.world.doc.textLf = 'prefisso DEF suffisso';
  await f.controller.send('Correggi', undefined, { from: 9, to: 12, originalText: 'DEF', status: 'valid' });
  for (let i = 0; i < 2; i++) {
    const p = f.controller.getState().proposals.get('a.md')!;
    assert.equal(f.controller.beforeAccept(p, true), true);
    const target = f.controller.proposalText(p)!;
    assert.equal(target, 'prefisso Proposta suffisso');
    const changes = ChangeSet.of({ from: 0, to: f.world.doc.textLf.length, insert: target }, f.world.doc.textLf.length);
    f.controller.documentChanged('a.md', changes); f.world.doc.textLf = target;
    const accepted = f.controller.getState().proposals.get('a.md')!;
    assert.deepEqual(accepted.scope, { from: 9, to: 17, originalText: 'Proposta', status: 'valid' });
    assert.equal(f.controller.proposalText(accepted), target);
    assert.equal(f.controller.hasPendingWork(), false);
  }
  assert.equal(f.world.snapshots, 1);
});

test('selezione: accetta blocchi a righe senza incorporare il contesto esterno allo scope', async () => {
  const f = await fixture(async function* () { yield { type: 'text', text: '<housemd-proposal>GOOD\ncentro\nGOOD</housemd-proposal>' }; yield { type: 'done', stop: 'end' }; });
  const original = 'prefisso BAD\ncentro\nBAD suffisso'; f.world.doc.textLf = original;
  await f.controller.send('Correggi', undefined, { from: 9, to: original.length - 9, originalText: 'BAD\ncentro\nBAD', status: 'valid' });
  const apply = (from: number, to: number, insert: string) => {
    const p = f.controller.getState().proposals.get('a.md')!;
    assert.equal(f.controller.beforeAccept(p), true);
    const changes = ChangeSet.of({ from, to, insert }, f.world.doc.textLf.length);
    const next = changes.apply(Text.of(f.world.doc.textLf.split('\n'))).toString();
    f.controller.documentChanged('a.md', changes); f.world.doc.textLf = next;
    assert.equal(f.controller.proposalText(f.controller.getState().proposals.get('a.md')!), 'prefisso GOOD\ncentro\nGOOD suffisso');
  };
  apply(0, 'prefisso BAD\n'.length, 'prefisso GOOD\n');
  assert.equal(f.controller.getState().proposals.get('a.md')!.scope!.from, 9);
  const start = f.world.doc.textLf.lastIndexOf('BAD');
  apply(start, f.world.doc.textLf.length, 'GOOD suffisso');
  assert.equal(f.world.doc.textLf, 'prefisso GOOD\ncentro\nGOOD suffisso');
  assert.equal(f.controller.hasPendingWork(), false); assert.equal(f.world.snapshots, 1);
});

test('Riprova segna il messaggio fallito come già ritentato: un secondo Riprova sullo stesso messaggio non riparte', async () => {
  let calls = 0;
  const f = await fixture(async function* (_req, _signal, call) {
    calls = call;
    if (call === 1) throw new AiError('server');
    yield { type: 'text', text: '<housemd-proposal>NEW</housemd-proposal>' };
    yield { type: 'done', stop: 'end' };
  });
  await f.controller.send('Correggi');
  const failed = f.controller.getState().chat.messages.at(-1)!;
  assert.equal(failed.status, 'error');
  await f.controller.retry(failed.id);
  const after = f.controller.getState().chat.messages.find((m) => m.id === failed.id)!;
  assert.equal(after.status, 'error');
  assert.equal(after.retried, true);
  assert.equal(calls, 2);
  await f.controller.retry(failed.id);
  assert.equal(calls, 2);
});
