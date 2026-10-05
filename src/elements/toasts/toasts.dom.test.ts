import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';
import type { ToastItem } from './toasts.element';

installPopoverStub();

function mount() {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'toast.close': 'CHIUDI' } }),
    persist() {},
  });
  const el = document.createElement('hmd-toasts');
  el.i18n = i18n;
  document.body.append(el);
  const dismissed: string[] = [];
  el.addEventListener('hmd-toast-dismiss', (event) => dismissed.push(event.detail.key));
  return { el, i18n, dismissed, box: el.querySelector('[popover]') as HTMLElement };
}

const info: ToastItem = { key: 'ws-1', kind: 'info', text: 'salvato' };
const error: ToastItem = { key: 'ai-error', kind: 'error', text: 'errore' };

test('the popover opens with toasts and closes without; roles follow the kind', () => {
  const { el, box } = mount();
  assert.equal(isPopoverOpen(box), false);
  el.items = [info, error];
  assert.ok(isPopoverOpen(box));
  const toasts = box.querySelectorAll('.toast');
  assert.deepEqual([...toasts].map((t) => t.getAttribute('role')), ['status', 'alert']);
  assert.deepEqual([...toasts].map((t) => (t as HTMLElement).dataset.kind), ['info', 'error']);
  assert.equal(toasts[0].querySelector('p')!.textContent, 'salvato');
  el.items = [];
  assert.equal(isPopoverOpen(box), false);
  el.remove();
});

test('nodes are reused by key; the close button sends hmd-toast-dismiss', () => {
  const { el, box, dismissed } = mount();
  el.items = [info];
  const first = box.querySelector('.toast')!;
  el.items = [info, error];
  assert.equal(box.querySelector('.toast'), first);
  const close = first.querySelector('button')!;
  assert.equal(close.getAttribute('aria-label'), EN_MESSAGES['toast.close']);
  close.click();
  assert.deepEqual(dismissed, ['ws-1']);
  el.remove();
});

test('info toasts close after 6 s, errors stay; a new items array restarts the info timers', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { el, dismissed } = mount();
    el.items = [info, error];
    mock.timers.tick(5000);
    el.items = [info, error, { key: 'ws-2', kind: 'info', text: 'altro' }];
    mock.timers.tick(5000);
    assert.deepEqual(dismissed, []);
    mock.timers.tick(1000);
    assert.deepEqual(dismissed.sort(), ['ws-1', 'ws-2']);
    el.remove();
  } finally {
    mock.timers.reset();
  }
});

test('detached: timers cleared, no hidePopover on a detached node', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { el, dismissed } = mount();
    el.items = [info];
    el.remove();
    mock.timers.tick(7000);
    assert.deepEqual(dismissed, []);
  } finally {
    mock.timers.reset();
  }
});

test('a language change relabels the close buttons', async () => {
  const { el, i18n, box } = mount();
  el.items = [info];
  await i18n.setLocale('it');
  assert.equal(box.querySelector('.toast button')!.getAttribute('aria-label'), 'CHIUDI');
  el.remove();
});

test('items set to undefined renders zero toasts and closes the popover', () => {
  const { el, box } = mount();
  el.items = [info];
  assert.ok(isPopoverOpen(box));
  assert.doesNotThrow(() => (el.items = undefined as never));
  assert.equal(box.querySelectorAll('.toast').length, 0);
  assert.equal(isPopoverOpen(box), false);
  el.remove();
});

test('without an i18n store the close buttons carry no empty label', () => {
  const el = document.createElement('hmd-toasts');
  document.body.append(el);
  el.items = [info];
  const close = el.querySelector('.toast button')!;
  assert.equal(close.hasAttribute('aria-label'), false);
  assert.equal(close.hasAttribute('data-tooltip'), false);
  el.remove();
});

test('a store change while open does not reopen the popover; detach and attach does', () => {
  const proto = HTMLElement.prototype as unknown as Record<'showPopover', () => void>;
  const realShow = proto.showPopover;
  let shows = 0;
  proto.showPopover = function (this: HTMLElement) {
    shows++;
    realShow.call(this);
  };
  try {
    const { el, box } = mount();
    el.items = [info];
    assert.equal(shows, 1);
    el.i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
    assert.equal(shows, 1);
    assert.ok(isPopoverOpen(box));
    el.remove();
    box.removeAttribute('data-test-popover-open');
    document.body.append(el);
    assert.equal(shows, 2);
    assert.ok(isPopoverOpen(box));
    el.remove();
  } finally {
    proto.showPopover = realShow;
  }
});
