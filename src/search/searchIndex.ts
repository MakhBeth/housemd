import MiniSearch from 'minisearch';

import { documentTitle, splitFrontmatter } from '../preview/frontmatter';
import { findMatches, fold } from './fold';

interface IndexedDoc {
  path: string;
  title: string;
  body: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  terms: string[];
}

export interface DocTitle {
  path: string;
  title: string;
}

export function makeSnippet(body: string, terms: string[], radius = 60): string {
  const first = findMatches(body, terms)[0];
  const start = first ? Math.max(0, first[0] - radius) : 0;
  const end = first ? Math.min(body.length, first[1] + radius) : Math.min(body.length, radius * 2);
  const text = body.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${text}${end < body.length ? '…' : ''}`;
}

export class SearchIndex {
  private readonly mini = new MiniSearch<IndexedDoc>({
    idField: 'path',
    fields: ['title', 'path', 'body'],
    storeFields: ['title'],
    processTerm: (term) => fold(term),
    searchOptions: { boost: { title: 3, path: 2 }, prefix: true, fuzzy: 0.2 },
  });
  private readonly docs = new Map<string, IndexedDoc>();

  upsert(path: string, text: string): void {
    const doc: IndexedDoc = { path, title: documentTitle(path, text), body: splitFrontmatter(text).body };
    if (this.mini.has(path)) this.mini.replace(doc);
    else this.mini.add(doc);
    this.docs.set(path, doc);
  }

  remove(path: string): void {
    if (this.mini.has(path)) this.mini.discard(path);
    this.docs.delete(path);
  }

  has(path: string): boolean {
    return this.docs.has(path);
  }

  paths(): string[] {
    return [...this.docs.keys()].sort();
  }

  titles(): DocTitle[] {
    return this.paths().map((path) => ({ path, title: this.docs.get(path)!.title }));
  }

  search(query: string, limit = 30): SearchResult[] {
    if (!query.trim()) return [];
    return this.mini
      .search(query)
      .slice(0, limit)
      .map((r) => {
        const doc = this.docs.get(r.id as string)!;
        return { path: doc.path, title: doc.title, terms: r.terms, snippet: makeSnippet(doc.body, r.terms) };
      });
  }
}
