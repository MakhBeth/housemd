import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import type { UpdateFlow, UpdateState } from '../../pwa/updateFlow';
import { createI18nStore } from '../../state/i18nStore';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

function fakeFlow() {
  let state: UpdateState = { available: false, busy: false };
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const flow = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    needRefresh() {},
    dismiss: () => calls.push('dismiss'),
    apply: async () => void calls.push('apply'),
    needReload: async () => {},
  } satisfies UpdateFlow;
  const set = (next: UpdateState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return { flow, set, calls, listeners };
}

function mount() {
  const { flow, set, calls, listeners } = fakeFlow();
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'update.apply': 'AGGIORNA' } }),
    persist() {},
  });
  const el = document.createElement('hmd-update-notice');
  el.flow = flow;
  el.i18n = i18n;
  document.body.append(el);
  return { el, set, calls, i18n, listeners };
}

test('no message until an update is available; the empty status container is already there', () => {
  const { el, set } = mount();
  assert.equal(el.querySelector('[role="status"]')!.textContent, '');
  set({ available: true, busy: false });
  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['toast.newVersion']);
  assert.equal(el.querySelector('button.action')!.textContent, EN_MESSAGES['update.apply']);
  assert.equal(el.querySelector('button.close')!.textContent, EN_MESSAGES['update.dismiss']);
  set({ available: false, busy: false });
  assert.equal(el.querySelector('[role="status"]')!.textContent, '');
  el.remove();
});

test('a language change relabels the banner; detached it unsubscribes', async () => {
  const { el, set, i18n, listeners } = mount();
  set({ available: true, busy: false });
  await i18n.setLocale('it');
  assert.equal(el.querySelector('button.action')!.textContent, 'AGGIORNA');
  el.remove();
  assert.equal(listeners.size, 0);
});

test('app banner: newVersion and update.applying are status rows with Update, reloadOtherTabs a status row with Close', () => {
  const { el, set, calls } = mount();
  assert.ok(el.querySelector('[role="status"]'), 'container mounted before the first message');
  assert.equal(el.querySelector('[role="status"]')!.textContent, '');
  set({ available: true, busy: false });
  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['toast.newVersion']);
  (el.querySelector('button.action') as HTMLButtonElement).click();
  (el.querySelector('button.close') as HTMLButtonElement).click();
  assert.deepEqual(calls, ['apply', 'dismiss']);
  set({ available: true, busy: true });
  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['update.applying']);
  assert.equal(el.querySelectorAll('button.close:not([hidden])').length, 0, 'no Later while applying');
  el.dbBlocked = true;
  const rows = [...el.querySelectorAll('[role="status"] p')].map((p) => p.textContent);
  assert.ok(rows.includes(EN_MESSAGES['toast.reloadOtherTabs']));
  assert.equal(el.querySelector('[role="alert"]'), null);
  assert.equal(el.querySelectorAll('[role="status"] button').length, 0, 'buttons outside the live text');
});

test('Later removes the focused button: the focus goes to the app content, not the body', () => {
  const host = document.createElement('div');
  const content = document.createElement('main');
  const first = document.createElement('button');
  content.append(first);
  const { el, set } = mount();
  host.append(el, content);
  document.body.append(host);
  set({ available: true, busy: false });
  const later = el.querySelector('button.close') as HTMLButtonElement;
  later.focus();
  later.click();
  assert.ok(document.activeElement === first, 'focus on the first control of the content');
  host.remove();
});

test('with two messages each button row shows which message it belongs to', () => {
  const banner = document.createElement('hmd-banner');
  document.body.append(banner);
  banner.items = [
    { key: 'a', kind: 'status', text: 'First message', closeLabel: 'Close' },
    { key: 'b', kind: 'status', text: 'Second message', closeLabel: 'Close' },
  ];
  assert.deepEqual([...banner.querySelectorAll('.context')].map((n) => n.textContent), ['First message', 'Second message']);
  banner.items = [{ key: 'b', kind: 'status', text: 'Second message', closeLabel: 'Close' }];
  assert.equal(banner.querySelector('.context')!.textContent, '');
  banner.remove();
});
