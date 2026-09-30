import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareParticipants, registerUpdateParticipant, updateHost, setUpdateWorkspace, type UpdateParticipant } from './updateHost';
import type { SettleResult } from '../workspace/workspace';
function participant(name: string, events: string[], result: SettleResult | Error = 'durable'): UpdateParticipant {
  return { async prepare() { events.push('prepare:' + name); if (result instanceof Error) throw result; return result; }, cancel() { events.push('cancel:' + name); } };
}
test('tutti durable consentono update senza cancel prematuro', async () => {
  const events: string[] = [];
  assert.equal(await prepareParticipants([participant('workspace', events), participant('ai', events)]), 'durable');
  assert.deepEqual(events, ['prepare:workspace', 'prepare:ai']);
});
test('AI pendente annulla in ordine inverso i partecipanti già preparati', async () => {
  const events: string[] = [];
  assert.equal(await prepareParticipants([participant('workspace', events), participant('secondo', events), participant('ai', events, 'failed'), participant('non-avviato', events)]), 'failed');
  assert.deepEqual(events, ['prepare:workspace', 'prepare:secondo', 'prepare:ai', 'cancel:ai', 'cancel:secondo', 'cancel:workspace']);
});
test('eccezione di prepare diventa failed e libera update del workspace', async () => {
  const events: string[] = [];
  assert.equal(await prepareParticipants([participant('workspace', events), participant('ai', events, new Error('store'))]), 'failed');
  assert.deepEqual(events, ['prepare:workspace', 'prepare:ai', 'cancel:ai', 'cancel:workspace']);
});
test('registrazione e cleanup partecipante, cancel comune dopo prepare', async () => {
  const events: string[] = []; setUpdateWorkspace(null);
  const remove = registerUpdateParticipant(participant('ai', events));
  try { assert.equal(await updateHost.prepare(), 'durable'); updateHost.cancel(); } finally { remove(); }
  assert.deepEqual(events, ['prepare:ai', 'cancel:ai']); events.length = 0;
  assert.equal(await updateHost.prepare(), 'durable'); assert.deepEqual(events, []);
});
