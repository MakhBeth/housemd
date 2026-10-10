import type { SearchResult } from '../../search/searchIndex';

/** Pausa dopo l'ultima battuta prima di cercare (come SearchPanel.tsx); Invio non la aspetta. */
export const SEARCH_DEBOUNCE_MS = 120;

/** Voce dell'elenco sotto la casella: un risultato, oppure la riga «nessun risultato». */
export type SearchItem = { kind: 'result'; result: SearchResult } | { kind: 'none' };

/**
 * Elenco sotto la casella: nessuno con la query vuota (o di soli spazi); altrimenti i risultati
 * dell'ultima ricerca, o «nessun risultato» se sono zero. I risultati possono essere di una query
 * precedente finché la pausa non finisce, come con React.
 */
export function searchItems(query: string, results: readonly SearchResult[]): SearchItem[] | null {
  if (!query.trim()) return null;
  if (results.length === 0) return [{ kind: 'none' }];
  return results.map((result) => ({ kind: 'result', result }));
}

/** Chiave per reconcileList: i risultati per percorso; «nessun risultato» non collide con un percorso. */
export const searchItemKey = (item: SearchItem): string => (item.kind === 'none' ? '\u0000none' : `r:${item.result.path}`);
