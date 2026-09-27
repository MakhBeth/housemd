import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLocale, formatDate, formatRelative, parseLocale, placeholders, translate } from './i18n';
import { EN_MESSAGES, loadMessages, loadWithFallback } from './messages';

test('detectLocale matches on the language prefix, case-insensitively', () => {
  assert.equal(detectLocale(['pt-BR', 'en']), 'pt');
  assert.equal(detectLocale(['EN-us']), 'en');
  assert.equal(detectLocale(['ja-JP']), 'ja');
  assert.equal(detectLocale(['zh-CN', 'de-AT', 'it']), 'de', 'la prima supportata, non la prima della lista');
});

test('detectLocale falls back to English', () => {
  assert.equal(detectLocale([]), 'en');
  assert.equal(detectLocale(['zh', 'ko-KR']), 'en');
});

test('parseLocale rejects unknown values', () => {
  assert.equal(parseLocale('fr'), 'fr');
  assert.equal(parseLocale('xx'), null);
  assert.equal(parseLocale(42), null);
  assert.equal(parseLocale(undefined), null);
});

test('translate interpolates placeholders and leaves missing ones visible', () => {
  const messages = { hi: 'Ciao {name}, hai {count} bozze', plain: 'Salvato' };
  assert.equal(translate(messages, 'hi', { name: 'Davide', count: 2 }), 'Ciao Davide, hai 2 bozze');
  assert.equal(translate(messages, 'hi', { name: 'Davide' }), 'Ciao Davide, hai {count} bozze');
  assert.equal(translate(messages, 'plain'), 'Salvato');
  assert.equal(translate(messages, 'missing.key'), 'missing.key', 'una chiave mancante mostra la chiave');
});

test('placeholders lists each placeholder once, sorted', () => {
  assert.deepEqual(placeholders('{b} e {a} e {b}'), ['a', 'b']);
  assert.deepEqual(placeholders('niente'), []);
});

test('formatRelative says today/yesterday with the time, otherwise a short date', () => {
  const now = new Date(2026, 8, 27, 18, 0);
  assert.equal(formatRelative('it', new Date(2026, 8, 27, 14, 32), now), 'oggi 14:32');
  assert.equal(formatRelative('it', new Date(2026, 8, 26, 9, 10), now), 'ieri 09:10');
  assert.equal(formatRelative('ja', new Date(2026, 8, 27, 14, 32), now), '今日 14:32');
  assert.ok(formatRelative('en', new Date(2026, 8, 27, 14, 32), now).startsWith('today '));
  const older = new Date(2026, 8, 20, 9, 5);
  assert.equal(formatRelative('it', older, now), formatDate('it', older));
  assert.equal(formatDate('it', older), new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(older));
});

test('loadMessages returns English synchronously available and loads the others', async () => {
  assert.deepEqual(await loadMessages('en'), { locale: 'en', messages: EN_MESSAGES });
  const { locale, messages } = await loadMessages('it');
  assert.equal(locale, 'it');
  assert.equal(messages['start.openFolder'], 'Apri cartella');
});

test('loadMessages falls back to English (locale included) if the chunk fails to load', async () => {
  const failing = () => Promise.reject(new Error('chunk non raggiungibile'));
  assert.deepEqual(await loadWithFallback('de', failing), { locale: 'en', messages: EN_MESSAGES });
});
