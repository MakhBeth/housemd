import type { FsOps } from '../../fs/ops';
import type { AiStores, SyncSnapshot } from '../stores';
import { acquireLock, type LockOptions } from './lock';
import { compareEpoch, merge } from './merge';
import { canonical, fileSnapshot, makeFile, snapshotContent } from './schema';
import { backup, cleanup, readSync, writeSync } from './syncFile';
export interface SyncOptions extends LockOptions { store: AiStores; fs: FsOps }
export type SyncResult = { status: 'created' | 'restored' | 'unchanged' | 'written' | 'stale'; conflicts: string[] };
const pruneTombs = (s: SyncSnapshot, now: number): SyncSnapshot => ({ ...s, tombstones: s.tombstones.filter(t => now - t.deletedAt <= 90 * 86400000) });
export async function syncCycle(options: SyncOptions): Promise<SyncResult> {
  const { fs, store } = options, now = options.now ?? Date.now;
  const writerId = await store.getMeta<string>('writerId') ?? crypto.randomUUID();
  const conflicts = await cleanup(fs, now());
  for (let attempt = 0; attempt < 3; attempt++) {
    const initial = await readSync(fs), local = await store.snapshot();
    if (initial && compareEpoch(initial.file.restore, local.epoch) > 0) {
      await backup(fs, canonical(makeFile(local, writerId, now())), writerId, now(), 'local-before-restore');
      if (!await store.compareAndReplaceSnapshot(local, fileSnapshot(initial.file))) continue;
      return { status: 'restored', conflicts };
    }
    const remote = initial ? fileSnapshot(initial.file) : null;
    const merged = remote && compareEpoch(remote.epoch, local.epoch) === 0 ? merge(local, remote).merged : local;
    if (!await store.applySnapshot(local, merged)) continue;
    const current = await store.snapshot();
    if (remote && snapshotContent(current) === snapshotContent(remote)) return { status: 'unchanged', conflicts };
    const release = await acquireLock(fs, writerId, options);
    if (!release) return { status: 'stale', conflicts };
    try {
      const checked = await readSync(fs);
      if (checked?.text !== initial?.text || checked?.lastModified !== initial?.lastModified) continue;
      // Rileggere anche il database evita di pubblicare uno snapshot superato nella stessa scheda.
      const latest = await store.snapshot();
      const published = pruneTombs(latest, now());
      await writeSync(fs, makeFile(published, writerId, now()), checked, writerId, now());
      await store.applySnapshot(latest, published);
      return { status: initial ? 'written' : 'created', conflicts };
    } finally { await release(); }
  }
  return { status: 'stale', conflicts };
}
