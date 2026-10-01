import test from 'node:test';
import assert from 'node:assert/strict';

import { saveIndicator } from './saveIndicator';

test('no open document: nothing to show', () => {
  assert.deepEqual(saveIndicator(null), { state: 'none', label: null, live: 'polite', role: undefined, draftIcon: false });
});

test('each save state has its label; only "dirty" shows the draft icon', () => {
  const at = (saveState: 'saved' | 'dirty' | 'saving' | 'error') => saveIndicator({ saveState, deletedOnDisk: false });
  assert.equal(at('saved').label, 'save.saved');
  assert.equal(at('dirty').label, 'save.dirty');
  assert.equal(at('saving').label, 'save.saving');
  assert.equal(at('error').label, 'save.error');
  assert.equal(at('dirty').draftIcon, true);
  assert.equal(at('saved').draftIcon, false);
});

test('a save error is announced right away (role alert, assertive)', () => {
  const error = saveIndicator({ saveState: 'error', deletedOnDisk: false });
  assert.equal(error.role, 'alert');
  assert.equal(error.live, 'assertive');
  const saved = saveIndicator({ saveState: 'saved', deletedOnDisk: false });
  assert.equal(saved.role, undefined);
  assert.equal(saved.live, 'polite');
});

test('a file deleted on disk says so, without the draft icon', () => {
  const deleted = saveIndicator({ saveState: 'dirty', deletedOnDisk: true });
  assert.equal(deleted.label, 'save.deleted');
  assert.equal(deleted.draftIcon, false);
  assert.equal(deleted.state, 'dirty');
});
