import type { RestoreEpoch, SyncSnapshot } from '../stores';
import { canonical, cleanProfile, snapshotContent } from './schema';
export function compareEpoch(a: RestoreEpoch, b: RestoreEpoch): number {
  if (!a || !b) return a ? 1 : b ? -1 : 0;
  return a.restoredAt - b.restoredAt || compare(a.restoredFrom, b.restoredFrom) || compare(a.restoreId, b.restoreId);
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function merge(local: SyncSnapshot, remote: SyncSnapshot) {
  const merged: SyncSnapshot = { profiles: [], presets: [], tombstones: [], epoch: local.epoch };
  const tombs = new Map<string, SyncSnapshot['tombstones'][number]>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const key = t.store + ':' + t.id, previous = tombs.get(key);
    if (!previous || t.deletedAt > previous.deletedAt) tombs.set(key, t);
  }
  merged.tombstones = [...tombs.values()].sort((a, b) => compare(a.store + a.id, b.store + b.id));
  for (const key of ['profiles', 'presets'] as const) {
    const rows = new Map<string, (typeof local)[typeof key][number]>();
    for (const row of [...local[key], ...remote[key]]) {
      const old = rows.get(row.id);
      const payload = (r: typeof row) => canonical(key === 'profiles' ? cleanProfile(r) : r);
      if (!old || row.updatedAt > old.updatedAt || (row.updatedAt === old.updatedAt && (compare(row.updatedBy, old.updatedBy) || compare(payload(row), payload(old))) > 0)) rows.set(row.id, row);
    }
    merged[key] = [...rows.values()].filter(r => (tombs.get(key + ':' + r.id)?.deletedAt ?? -1) <= r.updatedAt).sort((a, b) => compare(a.id, b.id)) as SyncSnapshot['profiles'] & SyncSnapshot['presets'];
  }
  return { merged, localChanges: snapshotContent(merged) !== snapshotContent(local), remoteChanged: snapshotContent(merged) !== snapshotContent(remote) };
}
