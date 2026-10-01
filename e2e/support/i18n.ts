import { readFileSync } from 'node:fs';

import type { Messages } from '../../src/i18n/i18n.ts';

export type E2ELocale = 'en' | 'it';

const cache = new Map<E2ELocale, Messages>();

/** Messaggi reali dell'app (stessi file del bundle), così le spec non scrivono testi a mano. */
export function messagesFor(locale: E2ELocale): Messages {
  let messages = cache.get(locale);
  if (!messages) {
    const url = new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url);
    messages = JSON.parse(readFileSync(url, 'utf8')) as Messages;
    cache.set(locale, messages);
  }
  return messages;
}
