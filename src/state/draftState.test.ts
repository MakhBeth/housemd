import test from 'node:test';
import assert from 'node:assert/strict';

import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft } from './draftState';

const a = { id: 'a', name: 'A' };
const b = { id: 'b', name: 'B' };

test('a freshly opened item is clean; editing it makes it dirty; editing it back makes it clean', () => {
  const opened = openDraft(emptyDraft<typeof a>(), a);
  assert.equal(isDirty(opened), false);
  const edited = editDraft(opened, { ...a, name: 'A2' });
  assert.equal(isDirty(edited), true);
  assert.equal(isDirty(editDraft(edited, a)), false);
});

test('selecting another item while clean switches right away', () => {
  const next = selectDraft(openDraft(emptyDraft<typeof a>(), a), b);
  assert.deepEqual(next.draft, b);
  assert.equal(next.pending, null);
});

test('selecting while dirty waits for confirmation; confirm switches, cancel keeps the edits', () => {
  const dirty = editDraft(openDraft(emptyDraft<typeof a>(), a), { ...a, name: 'A2' });
  const waiting = selectDraft(dirty, b);
  assert.deepEqual(waiting.pending, b);
  assert.deepEqual(waiting.draft, { ...a, name: 'A2' });
  const confirmed = confirmSwitch(waiting);
  assert.deepEqual(confirmed.draft, b);
  assert.equal(confirmed.pending, null);
  assert.equal(isDirty(confirmed), false);
  const cancelled = cancelSwitch(waiting);
  assert.deepEqual(cancelled.draft, { ...a, name: 'A2' });
  assert.equal(cancelled.pending, null);
});

test('opening null (after a delete) leaves nothing selected and nothing dirty', () => {
  const cleared = openDraft(openDraft(emptyDraft<typeof a>(), a), null);
  assert.equal(cleared.draft, null);
  assert.equal(isDirty(cleared), false);
});
