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
  const { el, box } = mount();
  el.remove();
  assert.doesNotThrow(() => document.body.append(el));
  assert.ok(isPopoverOpen(box));
  el.remove();
});
