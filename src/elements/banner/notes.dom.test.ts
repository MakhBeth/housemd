import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { installDialogStub } from '../../testing/dialogStub';
import type { AiErrorCode } from '../../ai/types';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { WorkspaceState } from '../../workspace/workspace';
import { openModal } from '../dialogs/modal';
import { activeModal } from '../dialogs/modal';
import type { HmdBanner } from './banner.element';
import { aiErrorItems, aiErrorKind, noticeRoutes, type NoticeContext } from '../workspace/workspaceView';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

function mount(): HmdBanner {
  const banner = document.createElement('hmd-banner');
  document.body.append(banner);
  return banner;
}

const AI_CODES: readonly AiErrorCode[] = [
  'unreachable', 'bridgeDown', 'bridgeIncompatible', 'secretBinding', 'scopeLost', 'bridgeCli', 'originRejected', 'unauthorized', 'forbidden',
  'notFound', 'noModel', 'rateLimited', 'paramRejected', 'tooLong', 'refused', 'truncated', 'timeout', 'server', 'badStream', 'aborted',
  'syncInvalid', 'syncPermission', 'syncBackupFailed', 'syncWriteFailed', 'syncLocked', 'syncStale', 'aiPendingUpdate',
];

test('all 27 AI error codes are covered', () => {
  assert.equal(AI_CODES.length, 27);
  assert.equal(new Set(AI_CODES).size, 27);
});

for (const code of AI_CODES) {
  test(`AI ${code}: ARIA role and text in the workspace banner`, () => {
    const items = aiErrorItems(code, null, t);
    assert.equal(items.length, 1);
    const banner = mount();
    banner.items = items;
    const expected = EN_MESSAGES[`ai.error.${code}` as keyof typeof EN_MESSAGES];
    assert.ok(expected && !expected.includes('{'), 'catalogue text, placeholders filled');
    const role = aiErrorKind(code) === 'alert' ? 'alert' : 'status';
    const row = role === 'alert' ? banner.querySelector('p[role="alert"]') : banner.querySelector('[role="status"] p');
    assert.ok(row, `a ${role} row`);
    assert.equal(row.textContent, expected);
    assert.equal(banner.querySelector('.alerts [role="status"]'), null);
    assert.ok(banner.querySelector('button.close:not([hidden])'), 'Close available');
    assert.equal(document.querySelector('hmd-toasts'), null, 'no toast');
  });
}

test('only preventive or voluntary AI outcomes are status rows', () => {
  assert.deepEqual(AI_CODES.filter((code) => aiErrorKind(code) === 'status'), ['scopeLost', 'aborted', 'syncLocked', 'aiPendingUpdate']);
});

test('PWA progress and notices are banner rows (no popover, no toast)', () => {
  assert.equal(document.querySelector('hmd-toasts, hmd-notice'), null);
});

const CONTEXT: NoticeContext = { sidebarOpen: true, dialogOpen: false, silenced: new Set() };
const routes = (toasts: unknown[], context: NoticeContext = CONTEXT, docPath: string | null = 'a.md') =>
  noticeRoutes(toasts as WorkspaceState['toasts'], docPath, t, 'en', false, context);

test('local notes: Salva tutto, folder, history and restore leave the workspace banner', () => {
  const r = routes([
    { id: 1, kind: 'info', code: 'saveAllDone' },
    { id: 2, kind: 'info', code: 'saveAllSkipped', params: { count: 2 } },
    { id: 3, kind: 'error', code: 'bufferFailed', params: { detail: 'q' } },
    { id: 4, kind: 'error', code: 'openFolderFailed', params: { detail: 'd' } },
    { id: 5, kind: 'error', code: 'historyFailed', params: { detail: 'h' } },
    { id: 6, kind: 'info', code: 'restoreCancelled' },
    { id: 7, kind: 'error', code: 'alreadyExists', params: { path: 'x.md' } },
  ]);
  assert.deepEqual(r.saveAll.map((i) => i.key), ['ws-1', 'ws-2', 'ws-3']);
  assert.deepEqual(r.sidebar.map((i) => i.key), ['ws-4', 'ws-7']);
  assert.deepEqual(r.history.map((i) => i.key), ['ws-5', 'ws-6']);
  assert.deepEqual(r.workspace, []);
  const hidden = routes([{ id: 4, kind: 'error', code: 'openFolderFailed', params: { detail: 'd' } }], { ...CONTEXT, sidebarOpen: false });
  assert.deepEqual(hidden.workspace.map((i) => i.key), ['ws-4'], 'sidebar hidden: workspace banner');
});

test('a local note describes its control while it holds an outcome, and gives the reference back', () => {
  const button = document.createElement('button');
  button.setAttribute('aria-describedby', 'other');
  document.body.append(button);
  const banner = mount();
  banner.items = [{ key: 'ws-1', kind: 'status', text: 'All changes saved', closeLabel: 'Close', describes: button }];
  const id = banner.querySelector('[role="status"] p')!.id;
  assert.ok(id);
  assert.equal(button.getAttribute('aria-describedby'), `other ${id}`);
  assert.equal(button.textContent, '', 'accessible name untouched');
  banner.items = [];
  assert.equal(button.getAttribute('aria-describedby'), 'other', 'other references preserved');
  const bare = document.createElement('button');
  banner.items = [{ key: 'ws-2', kind: 'status', text: 'x', describes: bare }];
  assert.ok(bare.hasAttribute('aria-describedby'));
  banner.items = [];
  assert.ok(!bare.hasAttribute('aria-describedby'));
});

test('data-risk events with a modal open: one alert row inside the dialog, the banner row stays silent', () => {
  const toasts = [{ id: 1, kind: 'error', code: 'saveFailed', params: { detail: 'x' }, path: 'a.md' }];
  const open = routes(toasts, { ...CONTEXT, dialogOpen: true });
  assert.deepEqual(open.dialog.map((i) => [i.kind, i.text, i.closeLabel]), [['alert', 'Save failed: x', undefined]]);
  assert.deepEqual(open.announcedInDialog, [1]);
  assert.equal(open.document[0]!.quiet, true, 'banner keeps the state without announcing');
  // Dopo la chiusura l'ID resta silenziato: nessun secondo annuncio.
  const closed = routes(toasts, { ...CONTEXT, silenced: new Set([1]) });
  assert.deepEqual(closed.dialog, []);
  assert.equal(closed.document[0]!.quiet, true);
});

test('the alert row in the dialog has role alert and does not move the focus', () => {
  const input = document.createElement('input');
  const { dialog, closed } = openModal({ labelledBy: 't', closedby: 'any' }, input);
  input.focus();
  assert.ok(activeModal() === dialog, 'active modal found');
  const banner = document.createElement('hmd-banner');
  dialog.append(banner);
  banner.items = routes([{ id: 1, kind: 'error', code: 'draftNotPersisted' }], { ...CONTEXT, dialogOpen: true }).dialog;
  const row = dialog.querySelector('p[role="alert"]');
  assert.ok(row, 'alert row inside the dialog');
  assert.equal(row.textContent, EN_MESSAGES['toast.draftNotPersisted']);
  assert.ok(document.activeElement === input, 'focus did not move');
  dialog.close('');
  return closed.then(() => assert.equal(activeModal(), null));
});

test('non data-risk events during a dialog are deferred, and only summarised once', () => {
  const toasts = [{ id: 9, kind: 'info', code: 'configInvalidJson', params: { file: 'c.json', detail: 'x' } }];
  const open = routes(toasts, { ...CONTEXT, dialogOpen: true });
  assert.deepEqual(open.deferred, [9]);
  assert.deepEqual(open.dialog, []);
  assert.equal(open.workspace[0]!.quiet, true);
  assert.deepEqual(routes(toasts, { ...CONTEXT, dialogOpen: true, silenced: new Set([9]) }).deferred, [], 'not deferred twice');
});

test('closing a local note with the focus on its Close returns the focus to the described control', () => {
  const control = document.createElement('button');
  document.body.append(control);
  const banner = mount();
  banner.items = [{ key: 'ws-1', kind: 'status', text: 'Saved', closeLabel: 'Close', describes: control }];
  const close = banner.querySelector<HTMLButtonElement>('button.close')!;
  close.focus();
  close.click();
  assert.ok(document.activeElement === control, 'focus on the described control');
});

test('opening, closing and reopening a dialog without registry changes announces nothing again', () => {
  const toasts = [
    { id: 1, kind: 'info', code: 'configInvalidJson', params: { file: 'c.json', detail: 'x' } },
    { id: 2, kind: 'error', code: 'draftNotPersisted' },
  ];
  const known = new Set([1, 2]);
  for (const silenced of [new Set<number>(), new Set([2])]) {
    const open = routes(toasts, { ...CONTEXT, dialogOpen: true, silenced, known });
    assert.deepEqual(open.dialog, [], 'no alert row for an event already announced');
    assert.deepEqual(open.deferred, [], 'no summary for an event already shown');
    assert.equal(open.workspace[0]!.quiet, false, 'the visible state is kept as it was');
  }
  const fresh = routes([...toasts, { id: 3, kind: 'info', code: 'unreadableFiles', params: { count: 2, paths: 'a, b' } }], { ...CONTEXT, dialogOpen: true, silenced: new Set(), known });
  assert.deepEqual(fresh.deferred, [3], 'only the new event is deferred');
});
