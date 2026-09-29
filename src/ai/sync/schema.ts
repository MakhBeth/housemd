import type { ModelProfile, PromptPreset, GenParams } from '../types';
import type { RestoreEpoch, SyncSnapshot, Tombstone } from '../stores';
export interface SyncFile { app: 'housemd'; schemaVersion: 1; updatedAt: number; writer: { id: string; kind: 'app' | 'restore' }; restore: RestoreEpoch; stores: { profiles: Omit<ModelProfile, 'secretId'>[]; presets: PromptPreset[] }; tombstones: Tombstone[] }
const fail = (): never => { throw new Error('syncInvalid'); };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const str = (v: unknown): string => typeof v === 'string' ? v : fail();
const num = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const one = <const T extends string>(v: unknown, allowed: T[]): T => allowed.includes(v as T) ? v as T : fail();
const params = (value: unknown): GenParams => {
  const p = obj(value), out: GenParams = {};
  for (const key of ['temperature', 'topP', 'maxOutputTokens', 'chunkChars'] as const) if (p[key] !== undefined) out[key] = num(p[key]);
  if ((out.temperature ?? 0) > 2 || (out.topP ?? 0) > 1) fail();
  for (const key of ['maxOutputTokens', 'chunkChars'] as const) if (out[key] !== undefined && (!Number.isSafeInteger(out[key]) || out[key]! <= 0)) fail();
  if (p.effort !== undefined) out.effort = one(p.effort, ['low', 'medium', 'high', 'xhigh', 'max']);
  return out;
};
export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(value), null, 2) + '\n';
}
function base(v: Record<string, unknown>) { const id = str(v.id); if (!id) fail(); return { id, updatedAt: num(v.updatedAt), updatedBy: str(v.updatedBy) }; }
export function cleanProfile(value: unknown): Omit<ModelProfile, 'secretId'> {
  const p = obj(value), baseUrl = str(p.baseUrl);
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) fail();
  } catch { fail(); }
  return { ...base(p), name: str(p.name), kind: one(p.kind, ['ollama', 'lmstudio', 'openai-compatible', 'anthropic', 'claude-code']), baseUrl, model: str(p.model), params: params(p.params), contextTokens: p.contextTokens === null ? null : num(p.contextTokens) };
}
export function cleanPreset(value: unknown): PromptPreset {
  const p = obj(value);
  const r: PromptPreset = { ...base(p), name: str(p.name), instructions: str(p.instructions), view: one(p.view, ['diff', 'side']), strategy: one(p.strategy, ['whole', 'chunked']), frontmatter: one(p.frontmatter, ['keep', 'include']), order: num(p.order), hidden: bool(p.hidden) };
  if (p.builtInId !== undefined) r.builtInId = one(p.builtInId, ['sbobina', 'traduci', 'consecutio']);
  if (p.params !== undefined) r.params = params(p.params);
  if (p.variables !== undefined) { const v = obj(p.variables); r.variables = v.targetLanguage === undefined ? {} : { targetLanguage: str(v.targetLanguage) }; }
  return r;
}
function unique<T>(v: unknown, parse: (v: unknown) => T, key: (v: T) => string): T[] {
  if (!Array.isArray(v)) return fail(); const rows = v.map(parse); if (new Set(rows.map(key)).size !== rows.length) fail(); return rows.sort((a, b) => key(a) < key(b) ? -1 : 1);
}
export function validateFile(value: unknown): SyncFile {
  const f = obj(value), s = obj(f.stores), w = obj(f.writer);
  if (f.app !== 'housemd' || f.schemaVersion !== 1) fail();
  let restore: RestoreEpoch = null;
  if (f.restore !== null) { const r = obj(f.restore); restore = { restoredAt: num(r.restoredAt), restoredFrom: str(r.restoredFrom), restoreId: str(r.restoreId) }; }
  return { app: 'housemd', schemaVersion: 1, updatedAt: num(f.updatedAt), writer: { id: str(w.id), kind: one(w.kind, ['app', 'restore']) }, restore,
    stores: { profiles: unique(s.profiles, cleanProfile, r => r.id), presets: unique(s.presets, cleanPreset, r => r.id) },
    tombstones: unique(f.tombstones, value => { const t = obj(value); return { store: one(t.store, ['profiles', 'presets']), id: str(t.id), deletedAt: num(t.deletedAt) }; }, t => t.store + ':' + t.id) };
}
export function parseFile(text: string): SyncFile {
  try {
    const value: unknown = JSON.parse(text);
    // Un file esterno non può introdurre campi segreti nei backup grezzi.
    const check = (v: unknown): void => {
      if (!v || typeof v !== 'object') return;
      for (const [key, child] of Object.entries(v)) {
        if (['secretId', 'secrets', 'apiKey', 'authorization', 'binding', 'accessToken'].includes(key)) fail();
        check(child);
      }
    };
    check(value); return validateFile(value);
  } catch { return fail(); }
}
export function fileSnapshot(file: SyncFile): SyncSnapshot { return { profiles: file.stores.profiles.map(p => ({ ...p, secretId: null })), presets: file.stores.presets, tombstones: file.tombstones, epoch: file.restore }; }
export function makeFile(snapshot: SyncSnapshot, writerId: string, now: number, kind: 'app' | 'restore' = 'app'): SyncFile {
  return validateFile({ app: 'housemd', schemaVersion: 1, updatedAt: now, writer: { id: writerId, kind }, restore: snapshot.epoch, stores: { profiles: snapshot.profiles, presets: snapshot.presets }, tombstones: snapshot.tombstones });
}
export const snapshotContent = (s: SyncSnapshot): string => canonical(makeFile(s, '', 0));
