import { dom } from './domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

test('DOM globals all come from the same jsdom window', () => {
  assert.equal(globalThis.document, dom.window.document);
  assert.equal(globalThis.HTMLElement, dom.window.HTMLElement);
  assert.equal(globalThis.AbortController, dom.window.AbortController);
  assert.ok(document.createElement('div') instanceof HTMLElement);
});

// jsdom rifiuta l'AbortSignal di Node con un TypeError: per questo anche AbortController viene dalla window.
test('a listener bound to a global AbortController signal stops after abort', () => {
  const button = document.createElement('button');
  const controller = new AbortController();
  let clicks = 0;
  button.addEventListener('click', () => clicks++, { signal: controller.signal });
  button.click();
  controller.abort();
  button.click();
  assert.equal(clicks, 1);
});

test('custom elements defined on the global registry are upgraded and connected', () => {
  let connected = 0;
  customElements.define('hmd-env-probe', class extends HTMLElement {
    connectedCallback() {
      connected++;
    }
  });
  document.body.append(document.createElement('hmd-env-probe'));
  assert.equal(connected, 1);
});
