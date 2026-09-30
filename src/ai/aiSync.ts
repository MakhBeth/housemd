import { syncCycle, type SyncOptions, type SyncResult } from './sync/syncCycle';
import { restoreBackup } from './sync/restore';
import { parseFile } from './sync/schema';
import { listBackups } from './sync/syncFile';
export interface AiSyncState { status: 'idle' | 'syncing' | 'error' | SyncResult['status']; error: string | null; lastSync: number | null; conflicts: string[] }
export class AiSync {
  private state: AiSyncState = { status: 'idle', error: null, lastSync: null, conflicts: [] };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active: Promise<void> | null = null;
  private disposed = false;
  private pending = false;
  constructor(private options: SyncOptions) {}
  getState = (): AiSyncState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<AiSyncState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  start() { if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus); void this.syncNow(); }
  private onFocus = () => { void this.syncNow(); };
  localChanged() { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; void this.syncNow(); }, 500); }
  syncNow(): Promise<void> {
    if (this.active) { this.pending = true; return this.active; }
    if (this.disposed) return Promise.resolve();
    this.update({ status: 'syncing', error: null });
    this.active = syncCycle(this.options).then(result => { this.update({ ...result, lastSync: (this.options.now ?? Date.now)() }); }).catch(error => {
      const code = error instanceof Error && /^sync[A-Z][A-Za-z]+$/.test(error.message) ? error.message : error instanceof Error && error.name === 'NotAllowedError' ? 'syncPermission' : 'syncWriteFailed';
      this.update({ status: 'error', error: code });
    }).finally(() => { this.active = null; if (this.pending && !this.disposed) { this.pending = false; queueMicrotask(() => { void this.syncNow(); }); } });
    return this.active;
  }
  async restore(path: string): Promise<void> {
    while (this.active) await this.active;
    if (this.disposed) return;
    this.update({ status: 'syncing', error: null });
    this.active = restoreBackup(this.options, path).then(() => {
      this.update({ status: 'restored', error: null, lastSync: (this.options.now ?? Date.now)() });
    }).catch(error => {
      this.update({ status: 'error', error: error instanceof Error && /^sync[A-Z][A-Za-z]+$/.test(error.message) ? error.message : 'syncWriteFailed' });
      throw error;
    }).finally(() => { this.active = null; if (this.pending && !this.disposed) { this.pending = false; queueMicrotask(() => { void this.syncNow(); }); } });
    return this.active;
  }
  async backupCounts(path:string):Promise<{profiles:number;presets:number}>{if(!/^housemd-backups\/[^/]+\.json$/.test(path))throw new Error('syncInvalid');const file=await this.options.fs.readFile(path);if(!file)throw new Error('syncInvalid');const data=parseFile(await file.blob.text());return{profiles:data.stores.profiles.length,presets:data.stores.presets.length};}
  listBackups(): Promise<string[]> { return listBackups(this.options.fs); }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer); if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus); this.listeners.clear(); }
}
