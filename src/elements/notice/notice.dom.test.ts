import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';

installPopoverStub();

function mount(props: Partial<{ message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' }> = {}) {
  const el = document.createElement('hmd-notice');
  Object.assign(el, { message: 'msg', dismissLabel: 'chiudi', ...props });
  document.body.append(el);
  return { el, box: el.querySelector('[role="status"]') as HTMLElement };
}

test('it opens as a manual popover with the message, placed at the bottom by default', () => {
  const { el, box } = mount();
  assert.equal(box.getAttribute('popover'), 'manual');
  assert.ok(isPopoverOpen(box));
  assert.equal(box.dataset.placement, 'bottom');
  assert.equal(box.querySelector('p')!.textContent, 'msg');
  assert.equal(box.querySelectorAll('button').length, 0);
  el.remove();
});

test('action and dismiss buttons exist only when asked, and send their events', () => {
  const { el, box } = mount({ actionLabel: 'Aggiorna', dismissible: true, placement: 'top' });
  const [action, dismiss] = box.querySelectorAll('button');
  assert.equal(action.textContent, 'Aggiorna');
  assert.equal(dismiss.getAttribute('aria-label'), 'chiudi');
  assert.equal(dismiss.getAttribute('data-tooltip'), 'chiudi');
  assert.equal(box.dataset.placement, 'top');
  const events: string[] = [];
  el.addEventListener('hmd-notice-action', () => events.push('action'));
  el.addEventListener('hmd-notice-dismiss', () => events.push('dismiss'));
  action.click();
  dismiss.click();
  assert.deepEqual(events, ['action', 'dismiss']);
  el.remove();
});

test('busy disables the same action button; not dismissible removes the dismiss button', () => {
  const { el, box } = mount({ actionLabel: 'Aggiorna', dismissible: true });
  const action = box.querySelector('button')!;
  Object.assign(el, { busy: true, dismissible: false });
  assert.equal(box.querySelector('button'), action);
  assert.equal(action.disabled, true);
  assert.equal(box.querySelectorAll('button').length, 1);
  el.remove();
});

test('detached it does not call hidePopover; attached again it reopens', () => {
  const proto = HTMLElement.prototype as unknown as Record<'showPopover' | 'hidePopover', () => void>;
  const realShow = proto.showPopover;
  const realHide = proto.hidePopover;
  const calls = { show: 0, hide: 0 };
  proto.showPopover = function (this: HTMLElement) {
    calls.show++;
    realShow.call(this);
  };
  proto.hidePopover = function (this: HTMLElement) {
    calls.hide++;
    realHide.call(this);
  };
  try {
    const { el, box } = mount();
    assert.equal(calls.show, 1);
    el.remove();
    assert.equal(calls.hide, 0);
    box.removeAttribute('data-test-popover-open');
    document.body.append(el);
    assert.equal(calls.show, 2);
    assert.ok(isPopoverOpen(box));
    el.remove();
  } finally {
    proto.showPopover = realShow;
    proto.hidePopover = realHide;
  }
});

const buttonsOf = (box: HTMLElement) => [...box.querySelectorAll('button')];

test('dismiss only (no action): the only button is dismiss, right after the paragraph', () => {
  const { el, box } = mount({ dismissible: true });
  const buttons = buttonsOf(box);
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0].classList.contains('dismiss'));
  assert.equal(box.querySelector('p')!.nextElementSibling, buttons[0]);
  el.remove();
});

test('toggling busy and dismissible keeps the order [action, dismiss] and the same action node', () => {
  const { el, box } = mount({ actionLabel: 'Aggiorna', dismissible: true });
  const action = box.querySelector('button.action')!;
  Object.assign(el, { busy: true, dismissible: false });
  Object.assign(el, { busy: false, dismissible: true });
  const buttons = buttonsOf(box);
  assert.equal(buttons.length, 2);
  assert.ok(buttons[0].classList.contains('action'));
  assert.ok(buttons[1].classList.contains('dismiss'));
  assert.equal(buttons[0], action);
  el.remove();
});

test('adding an action label later puts the action before the same dismiss node', () => {
  const { el, box } = mount({ dismissible: true });
  const dismiss = box.querySelector('button.dismiss')!;
  el.actionLabel = 'Aggiorna';
  const buttons = buttonsOf(box);
  assert.equal(buttons.length, 2);
  assert.ok(buttons[0].classList.contains('action'));
  assert.equal(buttons[1], dismiss);
  el.remove();
});
