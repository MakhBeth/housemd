import { diffLines } from 'diff';

export interface DiffRow {
  kind: 'added' | 'removed' | 'same';
  text: string;
}

const toLf = (text: string) => text.replace(/\r\n/g, '\n');

/**
 * Righe del diff dal testo attuale alla versione scelta: `removed` = righe che il ripristino
 * toglierebbe, `added` = righe che porterebbe. Le fine riga CRLF/LF non contano come differenze.
 * Il testo resta testo: il pannello lo mostra come nodi di testo, mai come HTML.
 */
export function diffRows(current: string, version: string): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const change of diffLines(toLf(current), toLf(version))) {
    const kind: DiffRow['kind'] = change.added ? 'added' : change.removed ? 'removed' : 'same';
    const lines = change.value.split('\n');
    if (lines.at(-1) === '') lines.pop();
    for (const text of lines) rows.push({ kind, text });
  }
  return rows;
}

export function isIdentical(rows: readonly DiffRow[]): boolean {
  return rows.every((row) => row.kind === 'same');
}
