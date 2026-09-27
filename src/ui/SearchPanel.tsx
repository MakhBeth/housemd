import { forwardRef, useEffect, useState, type ReactNode } from 'react';

import { findMatches } from '../search/fold';
import type { SearchIndex, SearchResult } from '../search/searchIndex';
import styles from './SearchPanel.module.css';

interface Props {
  index: SearchIndex;
  /** Cambia quando l'indice viene aggiornato: la ricerca viene rifatta. */
  indexRevision: number;
  onOpen: (path: string, terms: string[]) => void;
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const [start, end] of findMatches(text, terms)) {
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    last = end;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export const SearchPanel = forwardRef<HTMLInputElement, Props>(function SearchPanel({ index, indexRevision, onOpen }, ref) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setResults(index.search(query)), 120);
    return () => clearTimeout(timer);
  }, [query, index, indexRevision]);

  return (
    <div className={styles.search} role="search">
      <input
        ref={ref}
        type="search"
        className={styles.input}
        placeholder="Cerca (Ctrl+K)"
        aria-label="Cerca nei file"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Invio non aspetta il debounce: cerca subito sulla query corrente.
          if (e.key === 'Enter') {
            const first = index.search(query)[0];
            if (first) onOpen(first.path, first.terms);
          }
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {query.trim() && (
        <ul className={styles.results} aria-label="Risultati della ricerca">
          {results.length === 0 && <li className={styles.none}>Nessun risultato</li>}
          {results.map((r) => (
            <li key={r.path}>
              <button className={styles.result} onClick={() => onOpen(r.path, r.terms)}>
                <span className={styles.title}>{r.title}</span>
                <span className={styles.path}>{r.path}</span>
                <span className={styles.snippet}>
                  <Highlighted text={r.snippet} terms={r.terms} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
