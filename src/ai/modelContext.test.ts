import test from 'node:test';
import assert from 'node:assert/strict';
import { AiController } from './aiController';
import { createMemoryAiStores } from './stores';
import { defaultProfile, effectiveParams, effectiveProfile, modelSelection } from './profiles';
import { createCursor, runRequest, type RunInput } from './runner';
import { builtInPresets } from './presets';
import type { ChatRequest, ModelProfile } from './types';

async function fixture(contextTokens = 32000) {
  const store = createMemoryAiStores();
  const profile = { ...defaultProfile('lmstudio'), model: 'large', contextTokens };
  const requests: ChatRequest[] = [], providerProfiles: ModelProfile[] = [];
  const doc = { path: 'notes.md', textLf: 'Contenuto lungo. '.repeat(250), conflict: null, updating: false };
  const controller = new AiController(store, { getDoc: () => doc, snapshotBeforeAi() {}, openFile() {} }, profile => {
    providerProfiles.push(profile);
    return { async listModels() { return [{ value: 'small', label: 'Small', contextTokens: 512 }]; }, async *stream(request) { requests.push(request); yield { type: 'text', text: 'Risposta.' }; yield { type: 'done', stop: 'end' }; } };
  });
  await controller.initialize(); await controller.saveProfile(profile); controller.selectProfile(profile.id);
  return { controller, store, profile, requests, providerProfiles, doc };
}

test('selezione modello: limite live, valore manuale invariato e reset senza metadati', () => {
  const profile = { ...defaultProfile('lmstudio'), model: 'large', contextTokens: 32000 };
  assert.deepEqual(modelSelection(profile, 'small', { value: 'small', label: 'Small', contextTokens: 4096 }), { model: 'small', contextTokens: 4096 });
  assert.deepEqual(modelSelection(profile, 'large'), { model: 'large', contextTokens: 32000 });
  assert.deepEqual(modelSelection(profile, 'custom'), { model: 'custom', contextTokens: null });
  assert.equal(modelSelection(profile, 'custom', { value: 'other', label: 'Other', contextTokens: 500 }).contextTokens, null);
  assert.equal(modelSelection(profile, 'custom', { value: 'custom', label: 'Custom', contextTokens: NaN }).contextTokens, null);
  assert.equal(effectiveProfile(profile, { model: 'custom' }).contextTokens, null);
  assert.equal(effectiveProfile(profile, { model: 'large' }).contextTokens, 32000);
  assert.deepEqual(effectiveParams(profile, { model: 'small', contextTokens: 512, temperature: .8 }), { temperature: .8 });
});

test('contesto live selezionato blocca chat troppo lunga prima di stream e si salva fuori params', async () => {
  const f = await fixture();
  const models = await (await f.controller.provider(f.profile)).listModels(new AbortController().signal);
  const selection = modelSelection(f.profile, 'small', models![0]);
  f.controller.override({ ...selection, temperature: .8 });
  await f.controller.send('Correggi');
  assert.equal(f.requests.length, 0);
  assert.equal(f.controller.getState().chat.messages.at(-1)?.error, 'tooLong');
  assert.equal(f.providerProfiles.at(-1)?.contextTokens, 512);
  assert.equal(f.controller.profile()?.contextTokens, 32000);
  await f.controller.saveOverrides();
  const saved = (await f.store.load()).profiles.find(p => p.id === f.profile.id)!;
  assert.equal(saved.model, 'small'); assert.equal(saved.contextTokens, 512);
  assert.deepEqual(saved.params, { temperature: .8 });
  assert.deepEqual(f.controller.getState().chat.overrides, {});
});

test('cambio modello senza metadati non eredita un budget obsoleto e Salva come conserva originale', async () => {
  const f = await fixture(100);
  f.controller.override({ model: 'custom' });
  await f.controller.send('Correggi');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].model, 'custom');
  assert.equal(f.providerProfiles.at(-1)?.contextTokens, null);
  await f.controller.saveOverrides(true);
  const saved = (await f.store.load()).profiles;
  assert.equal(saved.find(p => p.id === f.profile.id)?.contextTokens, 100);
  const duplicate = saved.find(p => p.id === f.controller.getState().profileId)!;
  assert.notEqual(duplicate.id, f.profile.id);
  assert.equal(duplicate.model, 'custom'); assert.equal(duplicate.contextTokens, null);
  assert.ok(!('contextTokens' in duplicate.params));
  f.controller.selectProfile(f.profile.id);
  f.controller.override({ model: 'large', topP: .5 });
  await f.controller.saveOverrides();
  assert.equal(f.controller.profile()?.contextTokens, 100);
});

test('contesto live dimensiona le parti dei preset entro il budget del modello selezionato', async () => {
  const profile = { ...defaultProfile('lmstudio'), model: 'large', contextTokens: 32000 };
  const selected = effectiveProfile(profile, modelSelection(profile, 'small', { value: 'small', label: 'Small', contextTokens: 700 }));
  const input: RunInput = { path: 'notes.md', document: 'Paragrafo da elaborare senza omissioni.\n\n'.repeat(150), request: 'Correggi', history: [], profile: selected, params: {}, preset: builtInPresets()[0] };
  const cursor = createCursor(input);
  assert.ok(cursor.chunks.length > 1);
  let calls = 0;
  const stream = runRequest(input, { async listModels() { return []; }, async *stream(request) { calls++; assert.equal(request.model, 'small'); const chars = request.system.length + request.messages.map(m => m.text).join('').length; assert.ok(Math.ceil(chars / 4) <= 700); yield { type: 'text', text: 'Trasformato\n\n' }; yield { type: 'done', stop: 'end' }; } }, new AbortController().signal, cursor);
  for await (const event of stream) { if (event.type === 'done') assert.equal(event.truncated, false); }
  assert.equal(calls, cursor.chunks.length);
});
