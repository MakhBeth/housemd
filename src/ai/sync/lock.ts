import type { FsOps } from '../../fs/ops';
export const LOCK_FILE = 'housemd-sync.lock';
export interface LockOptions { now?: () => number; wait?: (ms: number) => Promise<void>; token?: () => string }
export async function acquireLock(fs: FsOps, writerId: string, options: LockOptions = {}): Promise<null | (() => Promise<void>)> {
  const now = options.now ?? Date.now, wait = options.wait ?? (ms => new Promise(r => setTimeout(r, ms))), start = now();
  const token = (options.token ?? (() => crypto.randomUUID()))();
  const read = async (): Promise<{ acquiredAt: number; token: string } | null> => {
    const f = await fs.readFile(LOCK_FILE); if (!f) return null;
    try { return JSON.parse(await f.blob.text()); } catch { return { acquiredAt: f.lastModified, token: '' }; }
  };
  for (let tries = 0; tries < 60 && now() - start < 3000; tries++) {
    const old = await read();
    if (!old || now() - old.acquiredAt > 10000) {
      await fs.writeFile(LOCK_FILE, JSON.stringify({ writerId, token, acquiredAt: now() })); await wait(50);
      if ((await read())?.token === token) return async () => { if ((await read())?.token === token) await fs.removeEntry(LOCK_FILE, false); };
    }
    await wait(50);
  }
  return null;
}
