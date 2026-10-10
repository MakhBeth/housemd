import type { DocSession } from '../../editor/docSession';

/** Blocco di una riga come lo misura CodeMirror (`lineBlockAt`): posizione e altezza in pixel. */
export interface LineBox {
  top: number;
  height: number;
}

/**
 * Nuovo documento (altro file, ricarica): la sessione riparte dal testo, senza cronologia né selezione
 * (era la prima riga dell'effetto [resetKey] di Editor.tsx). Una sessione già creata per quella chiave resta.
 */
export function adoptResetKey(session: DocSession, resetKey: string, text: string): void {
  if (session.resetKey === resetKey) return;
  session.resetKey = resetKey;
  session.textLf = text;
  session.history = undefined;
  session.selection = undefined;
}

/** Riga (0-based, frazionaria) in cima alla vista: `number` è la riga 1-based del blocco in cima. */
export function topLine(number: number, box: LineBox, scrollTop: number): number {
  const fraction = box.height > 0 ? Math.min(1, Math.max(0, (scrollTop - box.top) / box.height)) : 0;
  return number - 1 + fraction;
}

/** Riga 1-based da mostrare per la riga sorgente `line` (0-based, frazionaria), dentro il documento. */
export function lineNumberFor(line: number, lines: number): number {
  return Math.min(Math.max(Math.floor(line) + 1, 1), lines);
}

/** scrollTop che porta in cima la parte frazionaria di `line` dentro il blocco della sua riga. */
export function scrollTopFor(line: number, box: LineBox): number {
  return box.top + (line - Math.floor(line)) * box.height;
}
