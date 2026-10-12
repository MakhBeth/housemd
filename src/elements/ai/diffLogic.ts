import { Chunk } from '@codemirror/merge';
import { Text, type ChangeDesc, type EditorState } from '@codemirror/state';

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

/** Pulsanti dei blocchi: «accetta» solo quando si può accettare, «rifiuta» mai durante la generazione. */
export function controlDisabled(action: ControlAction, state: { canAccept: boolean; streaming: boolean }): boolean {
  return action === 'reject' ? state.streaming : !state.canAccept;
}

/** Quanti blocchi mostra il diff tra il documento e la proposta (gli stessi di `MergeView`, con la sua configurazione di default). */
export function blockCount(original: string, proposal: string): number {
  const lines = (text: string) => Text.of(text.split(/\r\n?|\n/));
  return Chunk.build(lines(original), lines(proposal)).length;
}
