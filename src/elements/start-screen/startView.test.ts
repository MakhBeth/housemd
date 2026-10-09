import test from 'node:test';
import assert from 'node:assert/strict';

import { startView } from './startView';

test('unsupported: the reason message and no buttons', () => {
  assert.deepEqual(startView({ mode: 'unsupported', reason: 'firefox' }), { message: { key: 'unsupported.firefox' }, buttons: [] });
  assert.deepEqual(startView({ mode: 'unsupported' }), { message: { key: 'unsupported.other' }, buttons: [] });
});

test('start: the open button, with the error message only after a failed open', () => {
  assert.deepEqual(startView({ mode: 'start' }), { message: null, buttons: ['pick'] });
  assert.deepEqual(startView({ mode: 'start', error: 'boom' }), { message: { key: 'start.openError', params: { detail: 'boom' } }, buttons: ['pick'] });
  // Un errore vuoto è comunque un errore (come `error !== undefined` in StartScreen.tsx).
  assert.deepEqual(startView({ mode: 'start', error: '' }).message, { key: 'start.openError', params: { detail: '' } });
});

test('resume: resume first, then open another folder', () => {
  assert.deepEqual(startView({ mode: 'resume' }), { message: null, buttons: ['resume', 'pick-other'] });
});
