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

test('no notice until an update is available', () => {
  const { el, set } = mount();
  assert.equal(el.querySelector('hmd-notice'), null);
  set({ available: true, busy: false });
  const notice = el.querySelector('hmd-notice')!;
  assert.equal(notice.message, EN_MESSAGES['toast.newVersion']);
  assert.equal(notice.actionLabel, EN_MESSAGES['update.apply']);
  assert.equal(notice.dismissLabel, EN_MESSAGES['update.dismiss']);
  assert.equal(notice.dismissible, true);
  set({ available: false, busy: false });
  assert.equal(el.querySelector('hmd-notice'), null);
  el.remove();
});

test('Update calls apply; Later calls dismiss; while busy it cannot be dismissed', () => {
  const { el, set, calls } = mount();
  set({ available: true, busy: false });
  const notice = el.querySelector('hmd-notice')!;
  notice.dispatchEvent(new CustomEvent('hmd-notice-action', { detail: null, bubbles: true }));
  notice.dispatchEvent(new CustomEvent('hmd-notice-dismiss', { detail: null, bubbles: true }));
  assert.deepEqual(calls, ['apply', 'dismiss']);
  set({ available: true, busy: true });
  assert.equal(el.querySelector('hmd-notice'), notice);
  assert.equal(notice.busy, true);
  assert.equal(notice.dismissible, false);
  el.remove();
});

test('a language change relabels the notice; detached it unsubscribes', async () => {
  const { el, set, i18n, listeners } = mount();
  set({ available: true, busy: false });
  await i18n.setLocale('it');
  assert.equal(el.querySelector('hmd-notice')!.actionLabel, 'AGGIORNA');
  el.remove();
  assert.equal(listeners.size, 0);
});
