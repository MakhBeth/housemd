/** Punto di riferimento: la riga sorgente `line` è a `top` pixel dall'inizio dell'anteprima. */
export interface Anchor {
  line: number;
  top: number;
}

/** Offset verticale per una riga sorgente (anchors ordinati per riga). */
export function offsetForLine(anchors: Anchor[], line: number): number {
  if (anchors.length === 0) return 0;
  let prev = anchors[0];
  for (const a of anchors) {
    if (a.line > line) {
      const span = a.line - prev.line;
      const t = span > 0 ? (line - prev.line) / span : 0;
      return prev.top + t * (a.top - prev.top);
    }
    prev = a;
  }
  return prev.top;
}

/** Riga sorgente (frazionaria) per un offset verticale. */
export function lineForOffset(anchors: Anchor[], top: number): number {
  if (anchors.length === 0) return 0;
  let prev = anchors[0];
  for (const a of anchors) {
    if (a.top > top) {
      const span = a.top - prev.top;
      const t = span > 0 ? (top - prev.top) / span : 0;
      return prev.line + t * (a.line - prev.line);
    }
    prev = a;
  }
  return prev.line;
}
