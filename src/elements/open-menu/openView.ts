import type { MessageKey } from '../../i18n/messages';
import type { RecentKind } from '../../fs/recents';

/** Voce dei recenti come la vede l'interfaccia: niente handle, solo ciò che si mostra e la chiave per il clic. */
export interface RecentItem {
  key: string;
  kind: RecentKind;
  name: string;
}

/** Nome accessibile di una voce recente: il tipo prima del nome visibile (il nome resta nel testo, WCAG 2.5.3). */
export function recentLabel(kind: RecentKind): MessageKey {
  return kind === 'folder' ? 'open.recentFolder' : 'open.recentFile';
}

/** Prossima voce del menu con le frecce (giro completo); -1 = nessuna voce con il focus. */
export function nextIndex(current: number, count: number, key: string): number | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % count;
  if (key === 'ArrowUp') return current < 0 ? count - 1 : (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
