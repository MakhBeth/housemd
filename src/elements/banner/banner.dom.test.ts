import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { NOTICE_CHANNEL, NOTICE_CODES, type NoticeCode } from '../../workspace/notices';
import type { WorkspaceState } from '../../workspace/workspace';
import { noticeRoutes, type NoticeContext } from '../workspace/workspaceView';

const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

function mount() {
  const banner = document.createElement('hmd-banner');
  document.body.append(banner);
  return banner;
}

test('the live container is mounted empty, stays in the tree and takes no space', () => {
  const banner = mount();
  const live = banner.querySelector('[role="status"]')!;
  assert.ok(live, 'status container present before any message');
  assert.equal(live.textContent, '');
  assert.equal(banner.querySelectorAll('[role="alert"], button').length, 0);
  banner.items = [{ key: 'a', kind: 'status', text: 'Hello' }];
  banner.items = [];
  assert.ok(banner.querySelector('[role="status"]') === live, 'same container node');
  assert.equal(live.textContent, '');
  for (const node of [banner, live]) {
    assert.ok(!node.hasAttribute('hidden') && !node.hasAttribute('aria-hidden'), 'never hidden');
  }
});

test('status rows live inside the polite container, alert rows beside it, buttons outside both', () => {
  const banner = mount();
  banner.items = [
    { key: 'a', kind: 'status', text: 'Done', closeLabel: 'Close' },
    { key: 'b', kind: 'alert', text: 'Broke' },
  ];
  const live = banner.querySelector('[role="status"]')!;
  const alert = banner.querySelector('[role="alert"]')!;
  assert.equal(live.textContent, 'Done');
  assert.ok(!live.contains(alert), 'no nested live regions');
  assert.equal(alert.textContent, 'Broke');
  assert.equal(live.querySelectorAll('button').length, 0);
  const close = banner.querySelector('button.close:not([hidden])') as HTMLButtonElement;
  assert.equal(close.textContent, 'Close');
  assert.equal(close.getAttribute('aria-describedby'), live.querySelector('p')!.id);
  banner.items = [{ key: 'b', kind: 'alert', text: 'Broke' }];
  assert.equal(banner.querySelectorAll('button:not([hidden])').length, 0, 'describedby goes away with the message');
});

test('Close and the action emit their events with the row key', () => {
  const banner = mount();
  const seen: string[] = [];
  banner.addEventListener('hmd-banner-close', (e) => seen.push(`close:${(e as CustomEvent).detail.key}`));
  banner.addEventListener('hmd-banner-action', (e) => seen.push(`action:${(e as CustomEvent).detail.key}`));
  banner.items = [{ key: 'k', kind: 'status', text: 'x', actionLabel: 'Go', closeLabel: 'Close' }];
  (banner.querySelector('button.action') as HTMLButtonElement).click();
  (banner.querySelector('button.close') as HTMLButtonElement).click();
  assert.deepEqual(seen, ['action:k', 'close:k']);
});

/** Un esempio per codice: parametri, ruolo atteso e percorso del documento di origine. */
const CASES: Record<NoticeCode, { kind: 'error' | 'info'; role: 'alert' | 'status'; params?: Record<string, string | number> }> = {
  saveFailed: { kind: 'error', role: 'alert', params: { detail: 'ENOSPC' } },
  configInvalidJson: { kind: 'info', role: 'status', params: { file: '.housemd.json', detail: 'Unexpected token' } },
  configInvalidSaveTo: { kind: 'info', role: 'status', params: { file: '.housemd.json' } },
  configInvalidLinkPrefix: { kind: 'info', role: 'status', params: { file: '.housemd.json' } },
  restoredDraft: { kind: 'info', role: 'status', params: { path: 'a.md' } },
  restoredDraftDeleted: { kind: 'info', role: 'status', params: { path: 'a.md' } },
  deletedOutside: { kind: 'info', role: 'status', params: { path: 'a.md' } },
  unreadableFiles: { kind: 'info', role: 'status', params: { count: 2, paths: 'x.md, y.md' } },
  alreadyExists: { kind: 'error', role: 'alert', params: { path: 'a.md' } },
  notFound: { kind: 'error', role: 'alert', params: { path: 'a.md' } },
  operationFailed: { kind: 'error', role: 'alert', params: { detail: 'boom' } },
  saveAllSkipped: { kind: 'info', role: 'status', params: { count: 3 } },
  saveAllDone: { kind: 'info', role: 'status' },
  draftNotPersisted: { kind: 'error', role: 'alert' },
  bufferFailed: { kind: 'error', role: 'alert', params: { detail: 'quota' } },
  historyFailed: { kind: 'error', role: 'alert', params: { detail: 'idb' } },
  restoreCancelled: { kind: 'info', role: 'status' },
  newVersion: { kind: 'info', role: 'status' },
  reloadOtherTabs: { kind: 'info', role: 'status' },
  openFolderFailed: { kind: 'error', role: 'alert', params: { detail: 'denied' } },
};

const SLOTS = ['document', 'workspace', 'saveAll', 'sidebar', 'history'] as const;
const CONTEXT: NoticeContext = { sidebarOpen: true, dialogOpen: false, silenced: new Set() };
const bannerItems = (notices: WorkspaceState['notices'], docPath: string | null) => noticeRoutes(notices, docPath, t, 'en', false, CONTEXT);

for (const code of NOTICE_CODES.filter((c) => NOTICE_CHANNEL[c] !== 'app')) {
  test(`${code}: ARIA role and text in its banner`, () => {
    const { kind, role, params } = CASES[code];
    const notices = [{ id: 1, kind, code, params, path: NOTICE_CHANNEL[code] === 'document' ? 'a.md' : undefined }] as unknown as WorkspaceState['notices'];
    const banners = bannerItems(notices, 'a.md');
    const slots = SLOTS.filter((slot) => banners[slot].length > 0);
    assert.equal(slots.length, 1, `${code} goes to exactly one banner`);
    const banner = mount();
    banner.items = banners[slots[0]!];
    const expected = translate(EN_MESSAGES, code === 'unreadableFiles' || code === 'saveAllSkipped' ? `notice.${code}.other` : `notice.${code}`, params);
    const node = banner.querySelector(`[role="${role}"] p, p[role="${role}"]`) ?? banner.querySelector(`p[role="${role}"]`);
    assert.ok(node, `a ${role} row`);
    assert.equal(node.textContent, expected);
    assert.ok(expected.length > 0 && !expected.includes('{'), 'every placeholder filled');
    const closable = banner.querySelector('button.close:not([hidden])');
    assert.equal(!!closable, !['saveFailed', 'bufferFailed', 'draftNotPersisted', 'deletedOutside'].includes(code), 'data-risk errors have no Close');
  });
}

test('singular forms for one file / one change', () => {
  const one = bannerItems([{ id: 1, kind: 'info', code: 'unreadableFiles', params: { count: 1, paths: 'x.md' } }] as unknown as WorkspaceState['notices'], null);
  assert.equal(one.workspace[0]!.text, 'Could not read 1 file: x.md');
  const skipped = bannerItems([{ id: 1, kind: 'info', code: 'saveAllSkipped', params: { count: 1 } }] as unknown as WorkspaceState['notices'], null);
  assert.match(skipped.saveAll[0]!.text, /^1 change not saved/);
});

test('a quiet row is visible but outside every live region', () => {
  const banner = mount();
  banner.items = [{ key: 'q', kind: 'alert', text: 'Quiet one', quiet: true }];
  assert.equal(banner.querySelector('[role="status"]')!.textContent, '');
  assert.equal(banner.querySelector('[role="alert"]'), null);
  assert.equal(banner.querySelector('.quiet')!.textContent, 'Quiet one');
});
