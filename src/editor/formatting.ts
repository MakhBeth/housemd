/**
 * Formattazione markdown della selezione (puro, testato): grassetto, corsivo, barrato, codice e link
 * avvolgono il testo con i marcatori (e li tolgono se ci sono già); titolo, citazione ed elenchi
 * agiscono sulle righe toccate. Ogni funzione restituisce la transazione da applicare, o null.
 */
import { ChangeSet, EditorSelection, type ChangeSpec, type EditorState, type SelectionRange, type TransactionSpec } from '@codemirror/state';

export type InlineFormat = 'bold' | 'italic' | 'strike' | 'code';
export type LineFormat = 'heading' | 'quote' | 'bullet' | 'ordered' | 'task';
export type FormatAction = InlineFormat | 'link' | LineFormat;

export const FORMAT_ACTIONS: readonly FormatAction[] = ['bold', 'italic', 'strike', 'code', 'link', 'heading', 'quote', 'bullet', 'ordered', 'task'];

/** Scorciatoie in notazione CodeMirror (Mod = Ctrl, Cmd su macOS). */
export const FORMAT_KEYS: Partial<Record<FormatAction, string>> = {
  bold: 'Mod-b',
  italic: 'Mod-i',
  strike: 'Mod-Shift-x',
  code: 'Mod-e',
  link: 'Mod-Shift-k',
};

const MARKERS: Record<InlineFormat, string> = { bold: '**', italic: '*', strike: '~~', code: '`' };

export function formatTransaction(state: EditorState, action: FormatAction): TransactionSpec | null {
  if (state.readOnly) return null;
  if (action === 'link') return link(state);
  if (action in MARKERS) return toggleInline(state, MARKERS[action as InlineFormat]);
  return toggleLines(state, action as LineFormat);
}

// --- in linea ---

/** Quanti `char` consecutivi ci sono prima di `pos` (fino a `limit`) o dopo. */
function runBefore(doc: string, pos: number, char: string, limit = 0): number {
  let n = 0;
  while (pos - n > limit && doc[pos - n - 1] === char) n++;
  return n;
}
function runAfter(doc: string, pos: number, char: string, limit = doc.length): number {
  let n = 0;
  while (pos + n < limit && doc[pos + n] === char) n++;
  return n;
}

/**
 * Una sequenza di `n` marcatori contiene questo formato? `*` e `**` condividono il carattere:
 * `**` da solo è grassetto e non corsivo, `***` è entrambi.
 */
function covers(marker: string, n: number): boolean {
  if (marker === '*') return n === 1 || n >= 3;
  return n >= marker.length;
}

interface Segment { from: number; to: number }

/** Il tratto spezzato per riga, senza gli spazi ai bordi (`** a**` non è grassetto). */
function segments(state: EditorState, range: SelectionRange): Segment[] {
  const doc = state.doc;
  const out: Segment[] = [];
  for (let pos = range.from; pos <= range.to;) {
    const line = doc.lineAt(pos);
    let from = Math.max(line.from, range.from);
    let to = Math.min(line.to, range.to);
    const text = doc.sliceString(from, to);
    from += text.length - text.trimStart().length;
    to -= text.length - text.trimEnd().length;
    if (to > from) out.push({ from, to });
    pos = line.to + 1;
  }
  return out;
}

function toggleInline(state: EditorState, marker: string): TransactionSpec {
  const doc = state.doc.toString();
  const char = marker[0];
  const w = marker.length;
  const insideWrapped = (s: Segment) =>
    s.to - s.from >= 2 * w &&
    covers(marker, Math.min(runAfter(doc, s.from, char, s.to), runBefore(doc, s.to, char, s.from)));

  return state.changeByRange((range) => {
    if (range.empty) {
      const pos = range.from;
      // Tra una coppia vuota (`**|**`): la toglie; altrimenti la inserisce col cursore in mezzo.
      if (runBefore(doc, pos, char) === w && runAfter(doc, pos, char) === w) {
        return { changes: { from: pos - w, to: pos + w }, range: EditorSelection.cursor(pos - w) };
      }
      return { changes: { from: pos, insert: marker + marker }, range: EditorSelection.cursor(pos + w) };
    }
    const parts = segments(state, range);
    if (parts.length === 0) return { range };
    let changes: ChangeSpec[];
    // Selezionato solo il testo interno (`**|a|**`): si tolgono i marcatori attorno.
    const outside = parts.length === 1 && covers(marker, Math.min(runBefore(doc, parts[0].from, char), runAfter(doc, parts[0].to, char)));
    if (outside) {
      changes = [{ from: parts[0].from - w, to: parts[0].from }, { from: parts[0].to, to: parts[0].to + w }];
    } else if (parts.every(insideWrapped)) {
      changes = parts.flatMap((s) => [{ from: s.from, to: s.from + w }, { from: s.to - w, to: s.to }]);
    } else {
      changes = parts.filter((s) => !insideWrapped(s)).flatMap((s) => [{ from: s.from, insert: marker }, { from: s.to, insert: marker }]);
    }
    const set = ChangeSet.of(changes, state.doc.length);
    // Resta selezionato il testo di una riga senza marcatori, di più righe con i marcatori:
    // in entrambi i casi un secondo comando li toglie.
    const inner = parts.length === 1 ? 1 : -1;
    const from = outside ? parts[0].from - w : set.mapPos(range.from, inner);
    const to = outside ? parts[0].to - w : set.mapPos(range.to, -inner);
    return { changes: set, range: EditorSelection.range(range.anchor <= range.head ? from : to, range.anchor <= range.head ? to : from) };
  });
}

function link(state: EditorState): TransactionSpec {
  const placeholder = 'https://';
  return state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    // Selezionato un indirizzo: diventa la destinazione, il cursore va sul testo del link.
    if (/^https?:\/\/\S+$/.test(text)) {
      return { changes: { from: range.from, to: range.to, insert: `[](${text})` }, range: EditorSelection.cursor(range.from + 1) };
    }
    const insert = `[${text}](${placeholder})`;
    const urlFrom = range.from + text.length + 3;
    const changes = { from: range.from, to: range.to, insert };
    // Senza testo il cursore va tra le quadre; altrimenti si seleziona l'indirizzo da sostituire.
    return { changes, range: text === '' ? EditorSelection.cursor(range.from + 1) : EditorSelection.range(urlFrom, urlFrom + placeholder.length) };
  });
}

// --- per riga ---

const HEADING = /^(#{1,6}) +/;
const QUOTE = /^> ?/;
const TASK = /^(\s*)[-*+] \[[ xX]\] /;
const BULLET = /^(\s*)[-*+] /;
const ORDERED = /^(\s*)\d+[.)] /;

/** Numeri delle righe toccate dalle selezioni, in ordine e senza doppioni. */
function touchedLines(state: EditorState): number[] {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    // Una selezione che finisce a inizio riga non tocca quella riga.
    const endLine = state.doc.lineAt(range.to);
    const last = range.to > range.from && endLine.from === range.to ? endLine.number - 1 : endLine.number;
    for (let n = first; n <= Math.max(first, last); n++) lines.add(n);
  }
  return [...lines].sort((a, b) => a - b);
}

/** Solo il tratto che cambia davvero: le posizioni nel resto della riga (cursore) restano dove sono. */
function minimalChange(at: number, before: string, after: string): ChangeSpec {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return { from: at + start, to: at + before.length - end, insert: after.slice(start, after.length - end) };
}

/** Toglie l'eventuale marcatore d'elenco, restituisce rientro e resto della riga. */
function stripList(text: string): { indent: string; rest: string } {
  const m = TASK.exec(text) ?? BULLET.exec(text) ?? ORDERED.exec(text);
  if (m) return { indent: m[1], rest: text.slice(m[0].length) };
  const indent = /^\s*/.exec(text)![0];
  return { indent, rest: text.slice(indent.length) };
}

function toggleLines(state: EditorState, format: LineFormat): TransactionSpec {
  const lines = touchedLines(state).map((n) => state.doc.line(n));
  const filled = lines.filter((l) => l.text.trim() !== '');
  // Gli elenchi saltano le righe vuote; titolo e citazione no (su una riga vuota si comincia a scrivere).
  const skipBlank = format === 'bullet' || format === 'task' || format === 'ordered';
  const replace = (fn: (text: string, index: number) => string): ChangeSpec[] => {
    const changes: ChangeSpec[] = [];
    let index = 0;
    for (const line of lines) {
      if (skipBlank && line.text.trim() === '') continue;
      changes.push(minimalChange(line.from, line.text, fn(line.text, index++)));
    }
    return changes;
  };

  let changes: ChangeSpec[];
  switch (format) {
    case 'heading': {
      // Ciclo sulla prima riga: niente → # → ## → ### → niente.
      const level = HEADING.exec(lines[0].text)?.[1].length ?? 0;
      const next = level >= 3 ? 0 : level + 1;
      changes = replace((text) => (next ? '#'.repeat(next) + ' ' : '') + text.replace(HEADING, ''));
      break;
    }
    case 'quote': {
      const all = filled.length > 0 && filled.every((l) => QUOTE.test(l.text));
      changes = replace((text) => (all ? text.replace(QUOTE, '') : text.trim() === '' ? '>' : '> ' + text));
      break;
    }
    case 'bullet': {
      const all = filled.length > 0 && filled.every((l) => BULLET.test(l.text) && !TASK.test(l.text));
      changes = replace((text) => { const { indent, rest } = stripList(text); return all ? indent + rest : `${indent}- ${rest}`; });
      break;
    }
    case 'task': {
      const all = filled.length > 0 && filled.every((l) => TASK.test(l.text));
      changes = replace((text) => { const { indent, rest } = stripList(text); return all ? indent + rest : `${indent}- [ ] ${rest}`; });
      break;
    }
    case 'ordered': {
      const all = filled.length > 0 && filled.every((l) => ORDERED.test(l.text));
      changes = replace((text, i) => { const { indent, rest } = stripList(text); return all ? indent + rest : `${indent}${i + 1}. ${rest}`; });
      break;
    }
  }
  const set = ChangeSet.of(changes, state.doc.length);
  // Il cursore a inizio riga resta dopo il nuovo marcatore.
  const selection = EditorSelection.create(
    state.selection.ranges.map((r) => EditorSelection.range(set.mapPos(r.anchor, 1), set.mapPos(r.head, 1))),
    state.selection.mainIndex,
  );
  return { changes: set, selection };
}
