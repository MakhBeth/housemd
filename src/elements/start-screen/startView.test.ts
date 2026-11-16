import test from 'node:test';
import assert from 'node:assert/strict';

import { startView } from './startView';

test('unsupported: the reason message and only the single file button', () => {
  assert.deepEqual(startView({ mode: 'unsupported', reason: 'firefox' }), { message: { key: 'unsupported.firefox' }, buttons: ['pick-file'] });
  assert.deepEqual(startView({ mode: 'unsupported' }), { message: { key: 'unsupported.other' }, buttons: ['pick-file'] });
});

test('unsupported: a failed file open shows the error instead of the reason', () => {
  assert.deepEqual(startView({ mode: 'unsupported', reason: 'firefox', error: 'boom' }), { message: { key: 'start.openError', params: { detail: 'boom' } }, buttons: ['pick-file'] });
});

test('start: the open button, with the error message only after a failed open', () => {
  assert.deepEqual(startView({ mode: 'start' }), { message: null, buttons: ['pick', 'pick-file'] });
  assert.deepEqual(startView({ mode: 'start', error: 'boom' }), { message: { key: 'start.openError', params: { detail: 'boom' } }, buttons: ['pick', 'pick-file'] });
  // Un errore vuoto è comunque un errore (come `error !== undefined` in StartScreen.tsx).
  assert.deepEqual(startView({ mode: 'start', error: '' }).message, { key: 'start.openError', params: { detail: '' } });
});

test('resume: resume first, then open another folder or a single file', () => {
  assert.deepEqual(startView({ mode: 'resume' }), { message: null, buttons: ['resume', 'pick-other', 'pick-file'] });
});

test('a copy to recover: a last secondary button in every mode', () => {
  assert.deepEqual(startView({ mode: 'start', recover: true }).buttons, ['pick', 'pick-file', 'recover']);
  assert.deepEqual(startView({ mode: 'unsupported', recover: true }).buttons, ['pick-file', 'recover']);
});
