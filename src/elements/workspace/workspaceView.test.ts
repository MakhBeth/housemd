import test from 'node:test';
import assert from 'node:assert/strict';

import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { WorkspaceState } from '../../workspace/workspace';
import { docKey, folderBlocker, historyBlocker, reopenPlan, shownMode, toastItems, toastTarget, unloadNeedsConfirm } from './workspaceView';

const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

test('AI mode without the controller shows the split view; the others stay', () => {
  assert.equal(shownMode('ai', false), 'split');
  assert.equal(shownMode('ai', true), 'ai');
  assert.equal(shownMode('preview', false), 'preview');
});

test('the document key follows path and revision (no document: undefined#undefined, as with React)', () => {
  assert.equal(docKey({ path: 'a.md', revision: 3 }), 'a.md#3');
  assert.equal(docKey(null), 'undefined#undefined');
});

test('toasts: the workspace ones keyed ws-<id>, then the AI error; dismissing goes back to the right owner', () => {
  const toasts = [{ id: 7, kind: 'info', code: 'saveAllDone' }] as unknown as WorkspaceState['toasts'];
  assert.deepEqual(toastItems(toasts, 'server', t), [
    { key: 'ws-7', kind: 'info', text: EN_MESSAGES['toast.saveAllDone'] },
    { key: 'ai-error', kind: 'error', text: EN_MESSAGES['ai.error.server'] },
  ]);
  assert.deepEqual(toastItems([], null, t), []);
  assert.deepEqual(toastTarget('ai-error'), { kind: 'ai' });
  assert.deepEqual(toastTarget('ws-7'), { kind: 'workspace', id: 7 });
});

test('beforeunload asks only when text is in memory, unless the protected update reload is ready', () => {
  const doc = (saveState: string) => ({ saveState }) as NonNullable<WorkspaceState['doc']>;
  assert.equal(unloadNeedsConfirm({ doc: doc('saved'), drafts: [], updateReady: false }, false), false);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: false }, false), true);
  assert.equal(unloadNeedsConfirm({ doc: null, drafts: ['a.md'], updateReady: false }, false), true);
  assert.equal(unloadNeedsConfirm({ doc: null, drafts: [], updateReady: false }, true), true);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: true }, false), false);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: true }, true), true);
});

test('reopening the last file: open it if it is still there, otherwise only through its draft', () => {
  assert.deepEqual(reopenPlan(null, ['a.md']), { kind: 'none' });
  assert.deepEqual(reopenPlan('a.md', ['a.md']), { kind: 'open', path: 'a.md' });
  assert.deepEqual(reopenPlan('gone.md', ['a.md']), { kind: 'draft', path: 'gone.md' });
});

test('History is blocked only with no document open', () => {
  assert.equal(historyBlocker(null), 'toolbar.history.noDocument');
  assert.equal(historyBlocker({} as never), null);
});

test('the folder button is blocked only while a folder is opening', () => {
  assert.equal(folderBlocker(true), 'folder.opening');
  assert.equal(folderBlocker(false), null);
});
