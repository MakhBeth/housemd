import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { HmdElement, type Subscribable } from './element';

function fakeStore(): Subscribable & { listeners: Set<() => void>; notify(): void } {
  const listeners = new Set<() => void>();
  return {
    listeners,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
}

const store = fakeStore();

class Probe extends HmdElement {
  connects = 0;
  renders = 0;
  events = 0;
  signals: AbortSignal[] = [];

  protected connect(signal: AbortSignal): void {
    this.connects++;
    this.signals.push(signal);
    window.addEventListener('probe', () => this.events++, { signal });
    this.watch(store, () => this.renders++, signal);
  }
}
customElements.define('hmd-element-probe', Probe);

const probe = () => document.createElement('hmd-element-probe') as Probe;

/** Espone `watch` per chiamarlo fuori da `connect`. */
class WatchProbe extends HmdElement {
  protected connect(): void {}
  watchFrom(store: Subscribable, fn: () => void, signal: AbortSignal): void {
    this.watch(store, fn, signal);
  }
}
customElements.define('hmd-watch-probe', WatchProbe);

test('watch with an already aborted signal neither subscribes nor calls fn', () => {
  const other = fakeStore();
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  (document.createElement('hmd-watch-probe') as WatchProbe).watchFrom(other, () => calls++, controller.signal);
  assert.equal(other.listeners.size, 0);
  assert.equal(calls, 0);
});

test('connect runs once per connection, also if connectedCallback repeats', () => {
  const el = probe();
  document.body.append(el);
  el.connectedCallback();
  assert.equal(el.connects, 1);
  el.remove();
});

test('detaching aborts the signal: listeners and subscriptions stop', () => {
  const el = probe();
  document.body.append(el);
  window.dispatchEvent(new Event('probe'));
  store.notify();
  assert.equal(el.events, 1);
  assert.equal(el.renders, 2); // subito + una notifica

  el.remove();
  assert.equal(el.signals[0].aborted, true);
  assert.equal(store.listeners.size, 0);
  window.dispatchEvent(new Event('probe'));
  store.notify();
  assert.equal(el.events, 1);
  assert.equal(el.renders, 2);
});

test('moving the element reconnects it with a fresh signal and no duplicate listeners', () => {
  const el = probe();
  const other = document.createElement('div');
  document.body.append(el, other);
  other.append(el);
  assert.equal(el.connects, 2);
  assert.equal(el.signals[0].aborted, true);
  assert.equal(el.signals[1].aborted, false);
  assert.equal(store.listeners.size, 1);
  window.dispatchEvent(new Event('probe'));
  assert.equal(el.events, 1);
  other.remove();
  assert.equal(store.listeners.size, 0);
});

class ReconnectProbe extends HmdElement {
  signals: AbortSignal[] = [];
  protected connect(signal: AbortSignal): void {
    this.signals.push(signal);
  }
  again(): void {
    this.reconnect();
  }
}
customElements.define('hmd-reconnect-probe', ReconnectProbe);

test('reconnect aborts the current signal and connects again; detached it does nothing', () => {
  const el = document.createElement('hmd-reconnect-probe') as ReconnectProbe;
  el.again();
  assert.equal(el.signals.length, 0);
  document.body.append(el);
  el.again();
  assert.equal(el.signals.length, 2);
  assert.equal(el.signals[0].aborted, true);
  assert.equal(el.signals[1].aborted, false);
  el.remove();
  assert.equal(el.signals[1].aborted, true);
});
