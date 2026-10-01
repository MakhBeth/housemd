import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouteStore, type RouteWindow } from './routeStore';

/** Finestra finta: cronologia a voci, hashchange solo dove il browser lo emette (hash, back). */
function fakeWindow(initialHash = '') {
  const entries = [initialHash];
  let index = 0;
  const listeners = new Set<() => void>();
  const fire = () => listeners.forEach((l) => l());
  const win: RouteWindow = {
    hash: () => entries[index],
    pushState: (url) => {
      entries.splice(index + 1, Infinity, url.startsWith('#') ? url : '');
      index++;
    },
    replaceState: (url) => {
      entries[index] = url.startsWith('#') ? url : '';
    },
    back: () => {
      index--;
      fire();
    },
    setHash: (hash) => {
      entries.splice(index + 1, Infinity, hash);
      index++;
      fire();
    },
    cleanUrl: () => '/',
    onHashChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return { win, entries: () => entries.slice(0, index + 1), listeners, goBack: () => win.back() };
}

test('the initial route comes from the hash', () => {
  assert.deepEqual(createRouteStore(fakeWindow('#settings/ai-sync').win).getState(), { view: 'settings', section: 'ai-sync' });
  assert.deepEqual(createRouteStore(fakeWindow('').win).getState(), { view: 'workspace' });
});

test('opening the settings adds a history entry; changing section replaces it; closing goes back', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  store.navigate({ view: 'settings', section: 'general' });
  assert.deepEqual(store.getState(), { view: 'settings', section: 'general' });
  assert.deepEqual(f.entries(), ['', '#settings']);
  store.navigate({ view: 'settings', section: 'ai-presets' });
  assert.deepEqual(f.entries(), ['', '#settings/ai-presets']);
  store.navigate({ view: 'workspace' });
  assert.deepEqual(store.getState(), { view: 'workspace' });
  assert.deepEqual(f.entries(), ['']);
});

test('Back with unsaved changes puts the settings entry back and asks for confirmation', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  let blocked = 0;
  store.setGuard({ canLeave: () => false, onBlocked: () => blocked++ });
  store.navigate({ view: 'settings', section: 'general' });
  f.goBack();
  assert.equal(blocked, 1);
  assert.deepEqual(store.getState(), { view: 'settings', section: 'general' });
  assert.deepEqual(f.entries(), ['', '#settings']);
});

test('settings opened from a link (no entry pushed by the app): closing replaces the URL', () => {
  const f = fakeWindow('#settings');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  store.navigate({ view: 'workspace' });
  assert.deepEqual(store.getState(), { view: 'workspace' });
  assert.deepEqual(f.entries(), ['']);
});

test('the hashchange listener exists only while someone is subscribed', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  assert.equal(f.listeners.size, 0);
  const off = store.subscribe(() => {});
  assert.equal(f.listeners.size, 1);
  off();
  assert.equal(f.listeners.size, 0);
});
