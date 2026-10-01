/**
 * Larghezza massima del testo nell'editor e nell'anteprima, in caratteri (puro). `null` = nessun
 * limite. Il valore diventa una variabile CSS: `ch` si risolve col carattere di ciascun pannello.
 */

export interface TextWidth {
  editor: number | null;
  preview: number | null;
}

export type TextWidthPane = keyof TextWidth;
export const TEXT_WIDTH_PANES: readonly TextWidthPane[] = ['editor', 'preview'];

export const MIN_TEXT_WIDTH = 30;
export const MAX_TEXT_WIDTH = 300;
export const DEFAULT_TEXT_WIDTH: TextWidth = { editor: null, preview: 72 };

/** Numero → caratteri nei limiti; vuoto, zero o non numerico → nessun limite. */
export function clampTextWidth(value: unknown): number | null {
  const n = typeof value === 'string' ? (value.trim() === '' ? NaN : Number(value)) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_TEXT_WIDTH, Math.max(MIN_TEXT_WIDTH, Math.round(n)));
}

export function parseTextWidth(raw: unknown): TextWidth {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_TEXT_WIDTH;
  const value = raw as Record<string, unknown>;
  const pick = (pane: TextWidthPane) => (pane in value ? clampTextWidth(value[pane]) : DEFAULT_TEXT_WIDTH[pane]);
  return { editor: pick('editor'), preview: pick('preview') };
}

/** Variabili CSS: senza limite vale 100% (il CSS aggiunge il padding, quindi non limita mai). */
export function textWidthVars(width: TextWidth): Record<'--editor-text-width' | '--preview-text-width', string> {
  const css = (n: number | null) => (n === null ? '100%' : `${n}ch`);
  return { '--editor-text-width': css(width.editor), '--preview-text-width': css(width.preview) };
}
