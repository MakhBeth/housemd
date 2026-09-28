/** Lingue dell'interfaccia, traduzione con segnaposto e date relative (puro, testato). */

export const SUPPORTED_LOCALES = ['it', 'en', 'es', 'fr', 'de', 'pt', 'nl', 'pl', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type Messages = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

/** Nome di ogni lingua nella lingua stessa: non si traduce. */
export const LOCALE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ja: '日本語',
};

export function isLocale(value: unknown): value is Locale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value);
}

/** Preferenza salvata → lingua, oppure null se assente o sconosciuta. */
export function parseLocale(raw: unknown): Locale | null {
  return isLocale(raw) ? raw : null;
}

/** Prima lingua del browser supportata (confronto sul prefisso: `pt-BR` → `pt`), altrimenti inglese. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** `{nome}` → valore; un segnaposto senza valore resta visibile, una chiave mancante mostra la chiave. */
export function translate(messages: Messages, key: string, params?: Params): string {
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

export function formatDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "oggi 14:32", "ieri 09:10", altrimenti data e ora brevi. */
export function formatRelative(locale: Locale, date: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0 || days === 1) {
    const day = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days === 0 ? 0 : -1, 'day');
    const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
    return `${day} ${time}`;
  }
  return formatDate(locale, date);
}
