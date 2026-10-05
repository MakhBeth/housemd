import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { icon } from '../dom/icon';
import { installPopoverStub } from '../testing/popoverStub';
import './define';

installPopoverStub();

/** Elemento di prova: le proprietà esistono sull'istanza prima del render, come vuole React 19 (spec WC §5.1). */
class HmdInteropProbe extends HTMLElement {
  #items: string[] = [];
  get items(): string[] {
    return this.#items;
  }
  set items(value: string[]) {
    this.#items = value;
  }
}
customElements.define('hmd-interop-probe', HmdInteropProbe);

test('React 19 assigns properties to a defined hmd-* tag and listens to its hmd-* events', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const items = ['a'];
  let detail: unknown = null;
  flushSync(() =>
    root.render(createElement('hmd-interop-probe', { items, 'onhmd-pick': (event: CustomEvent) => (detail = event.detail) })),
  );
  const probe = host.querySelector('hmd-interop-probe') as HmdInteropProbe;
  assert.equal(probe.items, items);
  assert.equal(probe.hasAttribute('items'), false);
  probe.dispatchEvent(new CustomEvent('hmd-pick', { detail: 42, bubbles: true }));
  assert.equal(detail, 42);
  flushSync(() => root.unmount());
});

test('modules that import icons load under tsx (assetHooks)', () => {
  assert.equal(icon('close').localName, 'span');
});

test('React 19 sends undefined when a prop disappears: hmd-notice drops the action button', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(createElement('hmd-notice', { message: 'msg', actionLabel: 'Go' })));
  const notice = host.querySelector('hmd-notice')!;
  assert.equal(notice.querySelectorAll('button').length, 1);
  flushSync(() => root.render(createElement('hmd-notice', { message: 'msg' })));
  assert.equal(notice.querySelectorAll('button').length, 0);
  flushSync(() => root.unmount());
});
