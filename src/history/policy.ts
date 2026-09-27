import type { Snapshot, SnapshotReason } from './historyStore';

/** Al più uno snapshot "save" ogni 5 minuti per file. */
export const SAVE_THROTTLE_MS = 5 * 60 * 1000;
export const MAX_SNAPSHOTS_PER_FILE = 50;
export const MAX_SNAPSHOT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Va fatto lo snapshot? `recent` sono gli snapshot del file dal più recente. Mai se il testo è
 * uguale all'ultimo; per "save" solo se l'ultimo "save" ha almeno 5 minuti; i before-* sempre.
 */
export function shouldSnapshot(
  recent: readonly Pick<Snapshot, 'text' | 'savedAt' | 'reason'>[],
  candidate: { text: string; reason: SnapshotReason },
  now: number,
): boolean {
  if (recent[0] && recent[0].text === candidate.text) return false;
  if (candidate.reason !== 'save') return true;
  const lastSave = recent.find((s) => s.reason === 'save');
  return !lastSave || now - lastSave.savedAt >= SAVE_THROTTLE_MS;
}

/** Id da eliminare: oltre i 50 più recenti del file e quelli più vecchi di 30 giorni. */
export function toPrune(snapshots: readonly Pick<Snapshot, 'id' | 'savedAt'>[], now: number): number[] {
  const newestFirst = [...snapshots].sort((a, b) => b.savedAt - a.savedAt || b.id - a.id);
  return newestFirst
    .filter((s, index) => index >= MAX_SNAPSHOTS_PER_FILE || now - s.savedAt > MAX_SNAPSHOT_AGE_MS)
    .map((s) => s.id);
}
