import { diffRows, isIdentical, type DiffRow } from '../../history/diffRows';
import type { Snapshot } from '../../history/historyStore';

/** Segno davanti a ogni riga del diff (il testo resta testo: nodi di testo, mai HTML). */
export const MARK: Record<DiffRow['kind'], string> = { added: '+ ', removed: '− ', same: '  ' };

/** Voce dell'elenco delle versioni: una versione, oppure «caricamento…» finché l'elenco non arriva. */
export type VersionItem = { kind: 'version'; version: Snapshot } | { kind: 'loading' };

/** Cosa mostra la sezione sotto l'elenco: invito a scegliere, testo identico, o diff con «Ripristina». */
export type DiffView = { kind: 'pick' } | { kind: 'identical' } | { kind: 'diff'; version: Snapshot; rows: DiffRow[] };

export function versionItems(versions: readonly Snapshot[] | null): VersionItem[] {
  return versions === null ? [{ kind: 'loading' }] : versions.map((version) => ({ kind: 'version', version }));
}

export const versionItemKey = (item: VersionItem): string => (item.kind === 'loading' ? 'loading' : `v:${item.version.id}`);

/** La sezione del diff per la versione scelta (cercata nell'elenco: una versione sparita torna all'invito). */
export function diffView(versions: readonly Snapshot[] | null, selected: number | null, currentText: string): DiffView {
  const version = versions?.find((v) => v.id === selected) ?? null;
  if (!version) return { kind: 'pick' };
  const rows = diffRows(currentText, version.text);
  return isIdentical(rows) ? { kind: 'identical' } : { kind: 'diff', version, rows };
}
