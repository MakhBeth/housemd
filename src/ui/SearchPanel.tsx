import { forwardRef, useEffect, useState } from 'react';

import { useT } from '../i18n/I18nProvider';
import { segments } from '../elements/search-panel/segments';
import type { SearchIndex, SearchResult } from '../search/searchIndex';
import { Icon } from './Icon';
import styles from './SearchPanel.module.css';

interface Props {
  index: SearchIndex;
  /** Cambia quando l'indice viene aggiornato: la ricerca viene rifatta. */
  indexRevision: number;
  onOpen: (path: string, terms: string[]) => void;
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return <>{segments(text, terms).map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : part.text))}</>;
}

export const SearchPanel = forwardRef<HTMLInputElement, Props>(function SearchPanel({ index, indexRevision, onOpen }, ref) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setResults(index.search(query)), 120);
    return () => clearTimeout(timer);
  }, [query, index, indexRevision]);

  return (
    <div className={styles.search} role="search">
      <Icon name="search" size={16} className={styles.searchIcon} />
      <input
        ref={ref}
        type="search"
        className={styles.input}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
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
        <ul className={styles.results} aria-label={t('search.results')}>
          {results.length === 0 && <li className={styles.none}>{t('search.none')}</li>}
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
