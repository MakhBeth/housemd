import { sameVersion, type Entry, type Version } from '../fs/types';

export type ExternalDecision =
  | { kind: 'unchanged' }
  | { kind: 'deleted' }
  | { kind: 'update-version'; version: Version }
  | { kind: 'reload'; text: string; version: Version }
  | { kind: 'conflict' };

export interface ExternalCheck {
  /** Ultima versione nota su disco del file aperto. */
  known: Version | null;
  /** Ultimo contenuto noto su disco. */
  knownText: string;
  /** L'editor ha modifiche non salvate. */
  dirty: boolean;
  stat: () => Promise<Version | null>;
  read: () => Promise<{ text: string; version: Version }>;
}

/** Cosa fare del file aperto quando la finestra torna in primo piano. */
export async function decideExternal(check: ExternalCheck): Promise<ExternalDecision> {
  const disk = await check.stat();
  if (!disk) return { kind: 'deleted' };
  if (sameVersion(check.known, disk)) return { kind: 'unchanged' };
  const { text, version } = await check.read();
  if (text === check.knownText) return { kind: 'update-version', version };
  return check.dirty ? { kind: 'conflict' } : { kind: 'reload', text, version };
}

/** File .md aggiunti o cambiati (da rileggere) e spariti rispetto alle versioni note. */
export function diffScan(known: ReadonlyMap<string, Version>, entries: Entry[]): { changed: string[]; removed: string[] } {
  const seen = new Set<string>();
  const changed: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    seen.add(entry.path);
    if (!sameVersion(known.get(entry.path), entry.version)) changed.push(entry.path);
  }
  const removed = [...known.keys()].filter((path) => !seen.has(path));
  return { changed, removed };
}
