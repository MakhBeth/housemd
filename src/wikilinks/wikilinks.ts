import { dirname, isMarkdown, joinPath, normalizePath, splitPath, stripMd } from '../lib/paths';

export interface WikiTarget {
  target: string;
  label: string;
}

/** Contenuto tra "[[" e "]]": "destinazione" oppure "destinazione|etichetta". */
export function parseWikiInner(inner: string): WikiTarget | null {
  const bar = inner.indexOf('|');
  const target = (bar === -1 ? inner : inner.slice(0, bar)).trim();
  const label = bar === -1 ? target : inner.slice(bar + 1).trim() || target;
  return target ? { target, label } : null;
}

const key = (path: string) => stripMd(normalizePath(path)).normalize('NFC').toLowerCase();

const withoutHeading = (target: string) => target.split('#')[0].trim();

/** Percorso del file a cui punta `[[target]]`, oppure null se non esiste. */
export function resolveWikiLink(target: string, fromFile: string, files: string[]): string | null {
  const wanted = key(withoutHeading(target));
  if (!wanted) return null;
  const candidates = files.filter((file) => {
    if (!isMarkdown(file)) return false;
    const k = key(file);
    return k === wanted || k.endsWith(`/${wanted}`);
  });
  if (candidates.length === 0) return null;

  const here = splitPath(dirname(fromFile));
  const common = (file: string) => {
    const dir = splitPath(dirname(file));
    let i = 0;
    while (i < dir.length && i < here.length && dir[i] === here[i]) i++;
    return i;
  };
  candidates.sort((a, b) => common(b) - common(a) || a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return candidates[0];
}

/** Dove creare la nota quando si clicca un wikilink senza destinazione. */
export function newNotePath(target: string, fromFile: string): string {
  return `${stripMd(joinPath(dirname(fromFile), withoutHeading(target)))}.md`;
}
