import type { Locale } from '../../i18n/i18n';

/** `date:` del frontmatter: un giorno ISO diventa testo nella lingua dell'interfaccia, il resto resta com'è. */
export function formatCardDate(value: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
