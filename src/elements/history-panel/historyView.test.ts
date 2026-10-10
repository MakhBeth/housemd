import test from 'node:test';
import assert from 'node:assert/strict';

import type { Snapshot } from '../../history/historyStore';
import { diffView, versionItemKey, versionItems } from './historyView';

const snap = (id: number, text: string): Snapshot => ({ id, workspaceId: 'w', path: 'a.md', savedAt: id * 1000, text, reason: 'save' });

test('while loading the list is one "loading" row; then one row per version, keyed by id', () => {
  assert.deepEqual(versionItems(null), [{ kind: 'loading' }]);
  const items = versionItems([snap(2, 'b'), snap(1, 'a')]);
  assert.deepEqual(items.map(versionItemKey), ['v:2', 'v:1']);
  assert.notEqual(versionItemKey({ kind: 'loading' }), versionItemKey(items[0]));
});

test('no selection, or a selection that is not in the list: pick a version', () => {
  assert.deepEqual(diffView([snap(1, 'a')], null, 'a'), { kind: 'pick' });
  assert.deepEqual(diffView([snap(1, 'a')], 7, 'a'), { kind: 'pick' });
  assert.deepEqual(diffView(null, 1, 'a'), { kind: 'pick' });
});

test('a version equal to the current text (line endings aside) is identical', () => {
  assert.deepEqual(diffView([snap(1, 'a\r\nb')], 1, 'a\nb'), { kind: 'identical' });
});

test('a different version gives the rows from the current text to the version', () => {
  const version = snap(1, 'one\ntwo');
  assert.deepEqual(diffView([version], 1, 'one\nthree'), {
    kind: 'diff',
    version,
    rows: [{ kind: 'same', text: 'one' }, { kind: 'removed', text: 'three' }, { kind: 'added', text: 'two' }],
  });
});
