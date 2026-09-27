import { findMatches } from '../search/fold';

export const HIGHLIGHT_NAME = 'housemd-search';

/**
 * Evidenzia i termini nell'anteprima con la CSS Custom Highlight API, senza toccare il DOM.
 * Stile in global.css: ::highlight(housemd-search).
 */
export function highlightTerms(root: Node, terms: string[]): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  CSS.highlights.delete(HIGHLIGHT_NAME);
  if (terms.length === 0) return;
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const [start, end] of findMatches(node.nodeValue ?? '', terms)) {
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  if (ranges.length > 0) CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
}
