import type { ModelProfile, PromptPreset, StoredSecret } from './types';
import { cleanProfile, cleanPreset } from './sync/schema';
import { nextStamp } from './sync/stamp';
export interface RestoreMark { restoredAt: number; restoredFrom: string; restoreId: string }
export type RestoreEpoch = RestoreMark | null;
export interface Tombstone { store: 'profiles' | 'presets'; id: string; deletedAt: number }
export interface SyncSnapshot { profiles: ModelProfile[]; presets: PromptPreset[]; tombstones: Tombstone[]; epoch: RestoreEpoch }
export interface AiStores {
  load(): Promise<{ profiles: ModelProfile[]; presets: PromptPreset[] }>;
  saveProfile(value: ModelProfile): Promise<ModelProfile>;
  savePreset(value: PromptPreset): Promise<PromptPreset>;
  deleteProfile(id: string): Promise<void>; deletePreset(id: string): Promise<void>;
  getSecret(id: string): Promise<StoredSecret | null>; saveSecret(value: StoredSecret): Promise<void>; deleteSecret(id: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>; setMeta(key: string, value: unknown): Promise<void>;
  snapshot(): Promise<SyncSnapshot>;
  applySnapshot(expected: SyncSnapshot, next: SyncSnapshot): Promise<boolean>;
  replaceSnapshot(next: SyncSnapshot): Promise<void>;
  compareAndReplaceSnapshot(expected: SyncSnapshot, next: SyncSnapshot): Promise<boolean>;
  seed(profiles: ModelProfile[], presets: PromptPreset[]): Promise<void>;
}
export interface StoreData extends SyncSnapshot { secrets: StoredSecret[]; meta: Record<string, unknown> }
export type StoreAccess = <T>(change: (data: StoreData) => T) => Promise<T>;
export const emptyData = (writerId: string): StoreData => ({ profiles: [], presets: [], tombstones: [], epoch: null, secrets: [], meta: { writerId } });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function storesFromAccess(access: StoreAccess, now = Date.now): AiStores {
  const snapshot = (d: StoreData): SyncSnapshot => structuredClone({ profiles: d.profiles, presets: d.presets, tombstones: d.tombstones, epoch: d.epoch });
  const save = <K extends 'profiles' | 'presets'>(key: K, value: StoreData[K][number]) => access(d => {
    const previous = d[key].find(r => r.id === value.id);
    const deleted = d.tombstones.find(t => t.store === key && t.id === value.id);
    const validated = key === 'profiles' ? { ...cleanProfile(value), secretId: (value as ModelProfile).secretId } : cleanPreset(value);
    const record = { ...validated, updatedAt: nextStamp(now(), Math.max(previous?.updatedAt ?? 0, value.updatedAt, deleted?.deletedAt ?? 0)), updatedBy: String(d.meta.writerId) };
    (d[key] as (ModelProfile | PromptPreset)[]) = [...d[key].filter(r => r.id !== value.id), record];
    return record;
  });
  const remove = (key: 'profiles' | 'presets', id: string) => access(d => {
    const r = d[key].find(r => r.id === id);
    if (key === 'presets' && (r as PromptPreset | undefined)?.builtInId) throw new Error('builtinPreset');
    const old = d.tombstones.find(t => t.store === key && t.id === id);
    d.tombstones = [...d.tombstones.filter(t => t.store !== key || t.id !== id), { store: key, id, deletedAt: nextStamp(now(), Math.max(r?.updatedAt ?? 0, old?.deletedAt ?? 0)) }];
    d[key] = d[key].filter(r => r.id !== id) as ModelProfile[] & PromptPreset[];
  });
  const retainSecrets = (d: StoreData, n: SyncSnapshot) => n.profiles.map(p => ({ ...p, secretId: d.profiles.find(r => r.id === p.id)?.secretId ?? null }));
  return {
    load: () => access(d => structuredClone({ profiles: d.profiles, presets: d.presets })),
    snapshot: () => access(snapshot),
    saveProfile: value => save('profiles', value) as Promise<ModelProfile>,
    savePreset: value => save('presets', value) as Promise<PromptPreset>,
    deleteProfile: id => remove('profiles', id), deletePreset: id => remove('presets', id),
    getSecret: id => access(d => structuredClone(d.secrets.find(s => s.id === id) ?? null)),
    saveSecret: value => access(d => { d.secrets = [...d.secrets.filter(s => s.id !== value.id), structuredClone(value)]; }),
    deleteSecret: id => access(d => { d.secrets = d.secrets.filter(s => s.id !== id); }),
    getMeta: key => access(d => structuredClone(d.meta[key])) as Promise<never>,
    setMeta: (key, value) => access(d => { d.meta[key] = value; }),
    seed: (profiles, presets) => access(d => {
      if (!d.meta.seeded) { if (!d.profiles.length) d.profiles = structuredClone(profiles); if (!d.presets.length) d.presets = structuredClone(presets); d.meta.seeded = true; }
    }),
    replaceSnapshot: next => access(d => { const profiles = retainSecrets(d, next); Object.assign(d, structuredClone(next), { profiles }); }),
    compareAndReplaceSnapshot: (expected, next) => access(d => {
      if (!equal(snapshot(d), expected)) return false;
      const profiles = retainSecrets(d, next); Object.assign(d, structuredClone(next), { profiles }); return true;
    }),
    applySnapshot: (expected, next) => access(d => {
      if (!equal(d.epoch, expected.epoch)) return false;
      let complete = true;
      for (const key of ['profiles', 'presets'] as const) {
        const ids = new Set([...expected[key], ...next[key]].map(r => r.id));
        for (const id of ids) {
          const before = expected[key].find(r => r.id === id), current = d[key].find(r => r.id === id);
          const oldT = expected.tombstones.find(t => t.store === key && t.id === id), currentT = d.tombstones.find(t => t.store === key && t.id === id);
          if (!equal(before, current) || !equal(oldT, currentT)) { complete = false; continue; }
          let incoming = next[key].find(r => r.id === id);
          if (incoming && key === 'profiles') incoming = { ...incoming, secretId: (current as ModelProfile | undefined)?.secretId ?? null } as ModelProfile;
          d[key] = [...d[key].filter(r => r.id !== id), ...(incoming ? [structuredClone(incoming)] : [])] as ModelProfile[] & PromptPreset[];
        }
      }
      const tombKeys = new Map([...expected.tombstones, ...next.tombstones].map(t => [t.store + ':' + t.id, t]));
      for (const { store, id } of tombKeys.values()) {
        const before = expected.tombstones.find(t => t.store === store && t.id === id);
        const current = d.tombstones.find(t => t.store === store && t.id === id);
        if (!equal(before, current)) { complete = false; continue; }
        const incoming = next.tombstones.find(t => t.store === store && t.id === id);
        d.tombstones = [...d.tombstones.filter(t => t.store !== store || t.id !== id), ...(incoming ? [structuredClone(incoming)] : [])];
      }
      return complete;
    }),
  };
}
export function createMemoryAiStores(options: { writerId?: string; now?: () => number } = {}): AiStores {
  const data = emptyData(options.writerId ?? crypto.randomUUID());
  return storesFromAccess(async change => change(data), options.now);
}
