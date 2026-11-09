import test from 'node:test';
import assert from 'node:assert/strict';

import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { WorkspaceState } from '../../workspace/workspace';
import { aiErrorItems, docKey, folderBlocker, historyBlocker, noticeRoutes, reopenPlan, shownMode, toastTarget, unloadNeedsConfirm } from './workspaceView';

const CTX = { sidebarOpen: false, dialogOpen: false, silenced: new Set<number>() };
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

test('the AI error is a closable workspace banner row; closing goes back to the right owner', () => {
  assert.deepEqual(aiErrorItems('server', null, t), [{ key: 'ai-error-server', kind: 'alert', text: EN_MESSAGES['ai.error.server'], closeLabel: 'Close' }]);
  assert.deepEqual(aiErrorItems(null, null, t), []);
  assert.deepEqual(toastTarget('ai-error-server'), { kind: 'ai' });
  assert.deepEqual(toastTarget('ws-7'), { kind: 'workspace', id: 7 });
});

test('banners: document messages follow their document, the others go to the workspace banner with the path', () => {
  const toasts = [
    { id: 1, kind: 'error', code: 'saveFailed', params: { detail: 'x' }, path: 'a.md' },
    { id: 2, kind: 'info', code: 'saveAllDone' },
    { id: 3, kind: 'info', code: 'restoredDraft', params: { path: 'a.md' }, path: 'a.md' },
  ] as unknown as WorkspaceState['toasts'];
  const here = noticeRoutes(toasts, 'a.md', t, 'en', false, CTX);
  assert.deepEqual(here.document.map((i) => [i.key, i.kind, i.closeLabel]), [['ws-1', 'alert', undefined], ['ws-3', 'status', 'Close']]);
  assert.deepEqual(here.saveAll.map((i) => i.key), ['ws-2']);
  const other = noticeRoutes(toasts, 'b.md', t, 'en', false, CTX);
  assert.deepEqual(other.document, []);
  assert.equal(other.workspace[0]!.text, 'a.md: Save failed: x');
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
