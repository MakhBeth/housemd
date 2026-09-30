import { acquireLock } from './lock';
import { compareEpoch } from './merge';
import { fileSnapshot, makeFile, parseFile } from './schema';
import { readSync, writeSync } from './syncFile';
import { nextStamp } from './stamp';
import type { SyncOptions } from './syncCycle';
export async function restoreBackup(options: SyncOptions, path: string): Promise<void> {
  const { store, fs } = options, now = options.now ?? Date.now;
  if (!/^housemd-backups\/[^/]+\.json$/.test(path)) throw new Error('syncInvalid');
  const source = await fs.readFile(path); if (!source) throw new Error('syncInvalid');
  const restored = fileSnapshot(parseFile(await source.blob.text()));
  const writerId = await store.getMeta<string>('writerId') ?? crypto.randomUUID();
  const release = await acquireLock(fs, writerId, options); if (!release) throw new Error('syncLocked');
  try {
    const current = await readSync(fs), local = await store.snapshot();
    const latest = compareEpoch(current?.file.restore ?? null, local.epoch) > 0 ? current!.file.restore : local.epoch;
    restored.epoch = { restoredAt: nextStamp(now(), latest?.restoredAt ?? 0), restoredFrom: path, restoreId: crypto.randomUUID() };
    restored.tombstones = [];
    await writeSync(fs, makeFile(restored, writerId, now(), 'restore'), current, writerId, now(), 'pre-restore');
    await store.replaceSnapshot(restored);
  } finally { await release(); }
}
