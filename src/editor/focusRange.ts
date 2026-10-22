import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState, Text } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

/** Unità accesa dalla modalità focus: il paragrafo (blocco Markdown) o la frase. */
export type FocusUnit = 'paragraph' | 'sentence';

/** Tratto semiaperto `[from, to)` del documento. */
export interface Span {
  from: number;
  to: number;
}

/** Blocchi che si accendono interi anche in modalità frase. */
const WHOLE = new Set(['FencedCode', 'CodeBlock', 'HTMLBlock', 'CommentBlock', 'ProcessingInstructionBlock', 'HorizontalRule', 'LinkReference', 'SetextHeading1', 'SetextHeading2']);
const LISTS = new Set(['BulletList', 'OrderedList']);
const FIRST_LINE_PREFIX = {
  paragraph: /^\s*/,
  quote: /^[\s>]*/,
  item: /^[\s>]*(?:(?:[-*+]|\d{1,9}[.)])\s+)?(?:\[[ xX]\]\s+)?/,
  heading: /^[\s>]*#{1,6}\s+/,
};
const CONTINUATION_PREFIX = /^[\s>]*/;
const BLANK = /^[\s>]*$/;
const DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Frontmatter `---…---` all'inizio del documento: fino alla fine della riga di chiusura. */
function frontmatter(doc: Text): Span | null {
  if (doc.lines < 2 || doc.line(1).text.trimEnd() !== '---') return null;
  for (let n = 2; n <= doc.lines; n++) if (doc.line(n).text.trimEnd() === '---') return { from: 0, to: doc.line(n).to };
  return null;
}

function lineSpan(doc: Text, from: number, to: number): Span {
  return { from: doc.lineAt(from).from, to: doc.lineAt(Math.max(from, to)).to };
}

/** Tabella GFM (il parser Markdown dell'editor è CommonMark: per lui è un paragrafo): la seconda riga è `|---|---|`. */
function isTable(doc: Text, span: Span): boolean {
  const first = doc.lineAt(span.from).number;
  if (first >= doc.lineAt(span.to).number) return false;
  return doc.line(first).text.includes('|') && DELIMITER_ROW.test(doc.line(first + 1).text) && doc.line(first + 1).text.includes('-');
}

interface Block {
  span: Span;
  /** Come togliere i marcatori dalla prima riga; null = blocco intero, anche in modalità frase. */
  prefix: RegExp | null;
}

/** Il blocco più interno che contiene la riga di `pos`, secondo la tabella del design; null su una riga vuota. */
function blockAt(state: EditorState, pos: number): Block | null {
  const doc = state.doc;
  const front = frontmatter(doc);
  if (front && pos <= front.to) return { span: front, prefix: null };
  const line = doc.lineAt(pos);
  const trimmed = line.text.trimEnd();
  // Ultimo carattere non vuoto della riga: ogni riga appartiene a un solo blocco, e da lì si risale.
  const probe = trimmed.length > 0 ? line.from + trimmed.length : line.from;
  const tree = ensureSyntaxTree(state, Math.min(doc.length, line.to + 1), 50) ?? syntaxTree(state);
  let node: SyntaxNode | null = tree.resolveInner(probe, -1);
  const inside = (names: Set<string>) => {
    for (let n: SyntaxNode | null = node; n; n = n.parent) if (names.has(n.name)) return n;
    return null;
  };
  const whole = inside(WHOLE);
  if (whole) return { span: lineSpan(doc, whole.from, whole.to), prefix: null };
  if (BLANK.test(line.text)) return null;
  for (; node; node = node.parent) {
    if (/^ATXHeading/.test(node.name)) return { span: lineSpan(doc, node.from, node.to), prefix: FIRST_LINE_PREFIX.heading };
    if (node.name === 'ListItem') return { span: itemSpan(doc, node), prefix: FIRST_LINE_PREFIX.item };
    if (node.name === 'Paragraph') {
      const span = lineSpan(doc, node.from, node.to);
      if (isTable(doc, span)) return { span, prefix: null };
      return { span, prefix: node.parent?.name === 'Blockquote' ? FIRST_LINE_PREFIX.quote : FIRST_LINE_PREFIX.paragraph };
    }
  }
  // Riga senza blocco riconoscibile (albero ancora incompleto): la riga stessa.
  return { span: { from: line.from, to: line.to }, prefix: FIRST_LINE_PREFIX.paragraph };
}

/** Voce di elenco con le righe di continuazione, senza le sottovoci annidate. */
function itemSpan(doc: Text, item: SyntaxNode): Span {
  const first = doc.lineAt(item.from);
  let to = item.to;
  for (let child = item.firstChild; child; child = child.nextSibling) {
    if (!LISTS.has(child.name)) continue;
    to = Math.max(first.to, doc.lineAt(child.from).from - 1);
    break;
  }
  return lineSpan(doc, item.from, to);
}

/** Frasi del blocco: segmenti semiaperti, il marcatore di riga sta con la frase che inizia su quella riga. */
function sentenceAt(doc: Text, block: Block, pos: number, locale: string): Span {
  const { from, to } = block.span;
  const firstLine = doc.lineAt(from).number;
  const lastLine = doc.lineAt(to).number;
  let text = '';
  // Posizione nel documento del primo carattere di ogni riga (dopo i marcatori) e di inizio riga.
  const starts: { stripped: number; raw: number; rawLine: number }[] = [];
  for (let n = firstLine; n <= lastLine; n++) {
    const line = doc.line(n);
    const content = n === firstLine ? line.text.slice(from - line.from) : line.text;
    const offset = n === firstLine ? from - line.from : 0;
    const strip = (n === firstLine ? block.prefix! : CONTINUATION_PREFIX).exec(content)?.[0].length ?? 0;
    if (n > firstLine) text += '\n';
    starts.push({ stripped: text.length, raw: line.from + offset + strip, rawLine: line.from + offset });
    text += content.slice(strip);
  }
  // ICU chiude la frase a ogni a capo: nel testo segmentato diventa uno spazio (stessa lunghezza, stessi indici).
  // Indice del testo ripulito → posizione nel documento; l'inizio di una riga prende anche il suo marcatore.
  const toDoc = (index: number): number => {
    if (index >= text.length) return to;
    let k = starts.length - 1;
    while (starts[k].stripped > index) k--;
    return index === starts[k].stripped ? starts[k].rawLine : starts[k].raw + (index - starts[k].stripped);
  };
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
  let last: Span = { from, to };
  for (const { index, segment } of segmenter.segment(text.replaceAll('\n', ' '))) {
    const span = { from: toDoc(index), to: toDoc(index + segment.length) };
    if (pos < span.to || span.to >= to) return span;
    last = span;
  }
  return last;
}

/** Unità che contiene `pos`, null su una riga vuota (non si accende niente). */
export function unitAt(state: EditorState, pos: number, unit: FocusUnit, locale: string): Span | null {
  const block = blockAt(state, pos);
  if (!block) return null;
  if (unit === 'paragraph' || !block.prefix) return block.span;
  return sentenceAt(state.doc, block, Math.min(Math.max(pos, block.span.from), block.span.to), locale);
}

/**
 * Tratti accesi: per ogni intervallo della selezione l'unione di tutte le unità toccate, dalla prima all'ultima
 * (il testo selezionato non è mai spento). Ordinati e uniti.
 */
export function focusSpans(state: EditorState, unit: FocusUnit, locale: string): Span[] {
  const spans: Span[] = [];
  for (const range of state.selection.ranges) {
    // Una selezione che finisce all'inizio di una riga non tocca quella riga.
    const end = range.empty ? range.head : range.to - 1;
    const a = unitAt(state, range.from, unit, locale);
    const b = unitAt(state, Math.max(range.from, end), unit, locale);
    if (a && b) spans.push({ from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) });
    else if (a || b) spans.push((a ?? b)!);
  }
  spans.sort((x, y) => x.from - y.from);
  const merged: Span[] = [];
  for (const span of spans) {
    const prev = merged[merged.length - 1];
    if (prev && span.from <= prev.to) prev.to = Math.max(prev.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

/** I tratti di `visible` che non sono in `lit`: quelli da spegnere. */
export function dimSpans(lit: readonly Span[], visible: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (const { from, to } of visible) {
    let at = from;
    for (const span of lit) {
      if (span.to <= at) continue;
      if (span.from >= to) break;
      if (span.from > at) out.push({ from: at, to: span.from });
      at = Math.max(at, span.to);
    }
    if (at < to) out.push({ from: at, to });
  }
  return out;
}
