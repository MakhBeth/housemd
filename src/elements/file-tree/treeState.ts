import { ancestorsOf } from '../../ui/tree';

/** Percorsi delle cartelle aperte nell'albero dei file. */
export type Expanded = ReadonlySet<string>;

/** Apre o chiude una cartella. Stesso oggetto se è già così: chi disegna non deve ridisegnare. */
export function toggleExpanded(expanded: Expanded, path: string, open: boolean): Expanded {
  if (expanded.has(path) === open) return expanded;
  const next = new Set(expanded);
  if (open) next.add(path);
  else next.delete(path);
  return next;
}

/** Apre le cartelle che contengono `path` (il file aperto), senza chiudere le altre. */
export function revealPath(expanded: Expanded, path: string): Expanded {
  const missing = ancestorsOf(path).filter((dir) => !expanded.has(dir));
  return missing.length === 0 ? expanded : new Set([...expanded, ...missing]);
}
