import test from 'node:test';
import assert from 'node:assert/strict';

import type { Locale, Messages } from '../i18n/i18n';
import type { LoadedMessages } from '../i18n/messages';
import { createI18nStore } from './i18nStore';

const EN: Messages = { hello: 'Hello {name}' };
const IT: Messages = { hello: 'Ciao {name}' };
const FR: Messages = { hello: 'Bonjour {name}' };

/** Loader controllato dal test: ogni richiesta resta in sospeso finché non la si risolve. */
function deferredLoader() {
  const pending = new Map<Locale, (value: LoadedMessages) => void>();
  return {
    load: (locale: Locale) => new Promise<LoadedMessages>((resolve) => pending.set(locale, resolve)),
    resolve: (locale: Locale, value: LoadedMessages) => pending.get(locale)!(value),
  };
}

test('translates with the current messages', () => {
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'en', messages: EN }), persist: () => {} });
  assert.equal(store.t('hello', { name: 'Ada' }), 'Hello Ada');
});

test('setLocale loads, persists the loaded language and notifies', async () => {
  const saved: Locale[] = [];
  let notified = 0;
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'it', messages: IT }), persist: (l) => saved.push(l) });
  store.subscribe(() => notified++);
  await store.setLocale('it');
  assert.equal(store.getState().locale, 'it');
  assert.equal(store.t('hello', { name: 'Ada' }), 'Ciao Ada');
  assert.deepEqual(saved, ['it']);
  assert.equal(notified, 1);
});

test('the last request wins, even if an earlier one resolves later', async () => {
  const loader = deferredLoader();
  const store = createI18nStore({ locale: 'en', messages: EN, load: loader.load, persist: () => {} });
  const first = store.setLocale('it');
  const second = store.setLocale('fr');
  loader.resolve('fr', { locale: 'fr', messages: FR });
  await second;
  loader.resolve('it', { locale: 'it', messages: IT });
  await first;
  assert.equal(store.getState().locale, 'fr');
});

test('a failed chunk falls back to English, and English is what gets saved', async () => {
  const saved: Locale[] = [];
  const store = createI18nStore({ locale: 'it', messages: IT, load: async () => ({ locale: 'en', messages: EN }), persist: (l) => saved.push(l) });
  await store.setLocale('ja');
  assert.equal(store.getState().locale, 'en');
  assert.deepEqual(saved, ['en']);
});

test('unsubscribe stops the notifications', async () => {
  let notified = 0;
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'it', messages: IT }), persist: () => {} });
  const off = store.subscribe(() => notified++);
  off();
  await store.setLocale('it');
  assert.equal(notified, 0);
});
