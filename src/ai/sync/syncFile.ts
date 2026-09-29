import type { FsOps } from '../../fs/ops';
import { canonical, parseFile, validateFile, type SyncFile } from './schema';
export const SYNC_FILE = 'housemd-sync.json';
export const BACKUP_DIR = 'housemd-backups';
export interface ReadSync { text: string; lastModified: number; file: SyncFile }
export async function readSync(fs: FsOps): Promise<ReadSync | null> {
  const raw = await fs.readFile(SYNC_FILE); if (!raw) return null;
  const text = await raw.blob.text(); return { text, lastModified: raw.lastModified, file: parseFile(text) };
}
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
async function digest(text: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(n => n.toString(16).padStart(2, '0')).join('');
}
async function verify(fs: FsOps, path: string, text: string): Promise<void> {
  const f = await fs.readFile(path); if (!f) throw new Error('syncWriteFailed');
  const bytes = await f.blob.text();
  if (new TextEncoder().encode(bytes).length !== new TextEncoder().encode(text).length || await digest(bytes) !== await digest(text)) throw new Error('syncWriteFailed');
}
export async function backup(fs: FsOps, text: string, writerId: string, now: number, suffix = ''): Promise<string> {
  try {
    await fs.mkdir(BACKUP_DIR);
    // Il writerId è condiviso dalle schede: un token evita collisioni tra backup concorrenti.
    const base = `${BACKUP_DIR}/housemd-sync.${new Date(now).toISOString().replace(/:/g, '-')}.${safe(writerId)}.${crypto.randomUUID()}${suffix ? '.' + safe(suffix) : ''}`;
    let path = base + '.json', i = 0;
    while (await fs.exists(path)) path = `${base}-${++i}.json`;
    await fs.writeFile(path, text); await verify(fs, path, text); return path;
  } catch { throw new Error('syncBackupFailed'); }
}
export async function listBackups(fs: FsOps): Promise<string[]> {
  return (await fs.readDir(BACKUP_DIR) ?? []).filter(e => e.kind === 'file' && e.name.endsWith('.json')).map(e => BACKUP_DIR + '/' + e.name).sort().reverse();
}
async function prune(fs: FsOps): Promise<void> {
  const all = (await listBackups(fs)).filter(p => !p.includes('pre-restore') && !p.includes('local-before-restore'));
  for (const path of all.slice(20)) await fs.removeEntry(path, false);
}
export async function cleanup(fs: FsOps, now: number): Promise<string[]> {
  const entries = await fs.readDir('') ?? [], conflicts: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    if (/^housemd-sync\..+\.part$/.test(entry.name)) { const f = await fs.readFile(entry.name); if (f && now - f.lastModified > 3600000) await fs.removeEntry(entry.name, false); }
    else if (entry.name.startsWith('housemd-sync') && entry.name.endsWith('.json') && entry.name !== SYNC_FILE) conflicts.push(entry.name);
  }
  return conflicts;
}
/** Il chiamante rilegge sotto lock: il backup è quello di quella lettura. */
export async function writeSync(fs: FsOps, file: SyncFile, previous: ReadSync | null, writerId: string, now: number, suffix = ''): Promise<void> {
  const text = canonical(validateFile(file));
  if (previous) await backup(fs, previous.text, writerId, now, suffix);
  const part = `housemd-sync.${safe(writerId)}.${crypto.randomUUID()}.part`;
  try {
    await fs.writeFile(part, text); await verify(fs, part, text);
    let moved = false;
    if (fs.moveFile) {
      try { await fs.moveFile(part, SYNC_FILE); moved = true; }
      catch (e) { if (!(e instanceof Error) || !['NotSupportedError', 'NotAllowedError'].includes(e.name)) throw e; }
    }
    if (!moved) await fs.writeFile(SYNC_FILE, text);
    await verify(fs, SYNC_FILE, text);
    if (!moved) await fs.removeEntry(part, false);
  } catch { throw new Error('syncWriteFailed'); }
  // La manutenzione non invalida una pubblicazione già verificata.
  await prune(fs).catch(() => {});
}
