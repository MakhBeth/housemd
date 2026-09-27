import en from './locales/en.json';
import type { Locale, Messages } from './i18n';

/** Chiavi dell'interfaccia: `en.json` è il riferimento. */
export type MessageKey = keyof typeof en;

export const EN_MESSAGES: Messages = en;

/** Le lingue diverse dall'inglese sono chunk separati (inclusi nel precache della PWA). */
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
  it: () => import('./locales/it.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
  pt: () => import('./locales/pt.json'),
  nl: () => import('./locales/nl.json'),
  pl: () => import('./locales/pl.json'),
  ja: () => import('./locales/ja.json'),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'en') return EN_MESSAGES;
  try {
    return (await LOADERS[locale]()).default;
  } catch {
    // chunk non raggiungibile (offline senza precache): meglio l'inglese che una pagina vuota
    return EN_MESSAGES;
  }
}
