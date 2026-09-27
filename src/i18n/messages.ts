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

export interface LoadedMessages {
  locale: Locale;
  messages: Messages;
}

/** Carica un chunk di lingua, ricadendo su EN_MESSAGES (e sulla lingua `en`) se il loader fallisce. */
export async function loadWithFallback(
  locale: Exclude<Locale, 'en'>,
  loader: () => Promise<{ default: Messages }>,
): Promise<LoadedMessages> {
  try {
    return { locale, messages: (await loader()).default };
  } catch {
    // chunk non raggiungibile (offline senza precache): meglio l'inglese che una pagina vuota
    return { locale: 'en', messages: EN_MESSAGES };
  }
}

/** La lingua restituita è quella effettivamente caricata: `en` se il chunk richiesto è fallito. */
export async function loadMessages(locale: Locale): Promise<LoadedMessages> {
  if (locale === 'en') return { locale: 'en', messages: EN_MESSAGES };
  return loadWithFallback(locale, LOADERS[locale]);
}
