/** Chip della selezione nel composer (puro): cosa mostrare per il tratto selezionato nell'editor. */
export type TextRange = { from: number; to: number };

export function selectionLabel(text: string, range: TextRange | null): { lines: number; chars: number } | null {
  if (!range) return null;
  const from = Math.max(0, Math.min(range.from, text.length));
  const to = Math.max(from, Math.min(range.to, text.length));
  const selected = text.slice(from, to);
  if (selected.trim() === '') return null;
  // Un a capo finale non apre una riga in più: "a\nb\n" sono due righe.
  const lines = selected.replace(/\n$/, '').split('\n').length;
  return { lines, chars: selected.length };
}

export function sameRange(a: TextRange | null, b: TextRange | null): boolean {
  if (a === null || b === null) return a === b;
  return a.from === b.from && a.to === b.to;
}
