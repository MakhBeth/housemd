import { Chunk } from '@codemirror/merge';
import { Text, type ChangeDesc, type EditorState } from '@codemirror/state';

import type { AcceptBlocker } from '../../ai/aiController';
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { TextRange } from '../../ai/selectionChip';

/** Un blocco della MergeView (`Chunk` di @codemirror/merge): tratti nel documento (a) e nella proposta (b). */
export interface ChunkRange {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
}

/**
 * Rifiuto di un blocco: il testo originale torna nella proposta, verso opposto al «revert» della libreria
 * (stessa regola dell'a capo finale di `revertClicked` in @codemirror/merge).
 */
export function rejectChange(a: EditorState, b: EditorState, chunk: ChunkRange): { from: number; to: number; insert: string } {
  let insert = a.sliceDoc(chunk.fromA, Math.max(chunk.fromA, chunk.toA - 1));
  if (chunk.fromA !== chunk.toA && chunk.toB <= b.doc.length) insert += a.lineBreak;
  return { from: chunk.fromB, to: Math.min(b.doc.length, chunk.toB), insert };
}

/** Le modifiche alla proposta restano dentro il tratto selezionato (senza tratto: tutto ammesso). */
export function insideRange(changes: ChangeDesc, range: TextRange | null): boolean {
  if (!range) return true;
  let inside = true;
  changes.iterChangedRanges((from, to) => {
    if (from < range.from || to > range.to) inside = false;
  });
  return inside;
}

export type ControlAction = 'accept' | 'reject';

/**
 * Perché «→ rifiuta» di un blocco non può adesso, o null: la proposta è in sola lettura durante la generazione e con
 * la selezione persa. Il pulsante resta attivo (regola «mai disabled»): la ragione va nella nota della barra.
 * «← accetta» ha la ragione del controller per il singolo blocco (`acceptBlocker(p, false)`).
 */
export function rejectBlocker(status: ReviewStatus): AcceptBlocker | null {
  if (status.kind === 'generating') return 'generating';
  return status.kind === 'scopeLost' ? 'scopeLost' : null;
}

/** Quanti blocchi mostra il diff tra il documento e la proposta (gli stessi di `MergeView`, con la sua configurazione di default). */
export function blockCount(original: string, proposal: string): number {
  const lines = (text: string) => Text.of(text.split(/\r\n?|\n/));
  return Chunk.build(lines(original), lines(proposal)).length;
}
