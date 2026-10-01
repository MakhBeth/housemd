import { findMatches } from '../../search/fold';

/** Pezzo di testo di un risultato di ricerca: evidenziato (`<mark>`) o no. */
export interface Segment {
  text: string;
  mark: boolean;
}

/** Divide `text` attorno ai termini cercati, con la stessa piegatura (maiuscole, accenti) dell'indice. */
export function segments(text: string, terms: string[]): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const [start, end] of findMatches(text, terms)) {
    if (start > last) out.push({ text: text.slice(last, start), mark: false });
    out.push({ text: text.slice(start, end), mark: true });
    last = end;
  }
  if (last < text.length || out.length === 0) out.push({ text: text.slice(last), mark: false });
  return out;
}
