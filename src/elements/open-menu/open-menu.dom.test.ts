import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';
import type { HmdOpenMenu } from './open-menu.element';

installPopoverStub();
test.afterEach(() => document.body.replaceChildren());

function mount(recents: HmdOpenMenu['recents'] = []) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const el = document.createElement('hmd-open-menu') as HmdOpenMenu;
  el.i18n = i18n;
  el.recents = recents;
  document.body.append(el);
  const events: unknown[] = [];
  el.addEventListener('hmd-open-choose', (event) => events.push(event.detail));
  const trigger = el.querySelector<HTMLButtonElement>('button.trigger')!;
  const menu = el.querySelector<HTMLElement>('.menu')!;
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('button')];
  return { el, events, trigger, menu, items };
}

test('the trigger is a button named Open that opens the menu, with the focus on Open folder', () => {
  const { trigger, menu, items } = mount();
  assert.equal(trigger.textContent, EN_MESSAGES['open.menu']);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.click();
  assert.ok(isPopoverOpen(menu));
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(items().map((b) => b.textContent), [EN_MESSAGES['open.folder'], EN_MESSAGES['open.file']]);
  assert.ok(document.activeElement === items()[0], 'focus on Open folder');
});

test('each item sends what to open, closes the menu and gives the focus back to the trigger', () => {
  const { trigger, menu, items, events } = mount([{ key: 'folder:1:notes', kind: 'folder', name: 'notes' }]);
  trigger.click();
  items()[1]!.click();
  assert.equal(isPopoverOpen(menu), false);
  assert.ok(document.activeElement === trigger);
  trigger.click();
  items()[2]!.click();
  trigger.click();
  items()[0]!.click();
  assert.deepEqual(events, [{ action: 'file' }, { action: 'recent', key: 'folder:1:notes' }, { action: 'folder' }]);
});

test('recents: a titled list after the actions, each named with its kind and its visible name', () => {
  const { trigger, menu } = mount([
    { key: 'file:2:a.md', kind: 'file', name: 'a.md' },
    { key: 'folder:1:notes', kind: 'folder', name: 'notes' },
  ]);
  trigger.click();
  const list = menu.querySelector('ul')!;
  assert.equal(document.getElementById(list.getAttribute('aria-labelledby')!)!.textContent, EN_MESSAGES['open.recent']);
  assert.deepEqual([...list.querySelectorAll('button')].map((b) => [b.getAttribute('aria-label'), b.textContent]), [
    ['File a.md', 'a.md'],
    ['Folder notes', 'notes'],
  ]);
});

test('no recents: no title and no list', () => {
  const { menu } = mount();
  assert.equal(menu.querySelector('ul'), null);
  assert.equal(menu.querySelector('.recentTitle'), null);
});

test('arrows move between the items, round the ends', () => {
  const { trigger, items, menu } = mount([{ key: 'k', kind: 'file', name: 'a.md' }]);
  trigger.click();
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.ok(document.activeElement === items()[2], 'up from the first goes to the last');
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.ok(document.activeElement === items()[0]);
});
