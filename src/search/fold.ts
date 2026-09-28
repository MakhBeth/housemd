/** Minuscolo senza accenti: base comune per indice, ricerca ed evidenziazione. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const COMBINING = /[̀-ͯ]/;

/**
 * Testo "piegato" più, per ogni suo carattere, la posizione nel testo originale.
 * Gestisce anche il testo in NFD (lettera + accento combinante, tipico di macOS).
 */
function foldWithMap(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  let i = 0;
  for (const ch of text) {
    for (const c of fold(ch)) {
      folded += c;
      origin.push(i);
    }
    i += ch.length;
  }
  return { folded, origin };
}

export function findMatches(text: string, terms: string[]): Array<[number, number]> {
  const { folded, origin } = foldWithMap(text);
  const ranges: Array<[number, number]> = [];
  for (const term of new Set(terms.map(fold).filter((t) => t.length > 0))) {
    for (let i = folded.indexOf(term); i !== -1; i = folded.indexOf(term, i + term.length)) {
      const start = origin[i];
      let end = i + term.length < origin.length ? origin[i + term.length] : text.length;
      // Non lasciare fuori un accento combinante che segue l'ultima lettera.
      while (end < text.length && COMBINING.test(text[end])) end++;
      ranges.push([start, end]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
