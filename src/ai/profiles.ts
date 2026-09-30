import type { GenParams, ModelOption, ModelProfile, ProfileOverrides, PromptPreset, ProviderKind, StoredSecret } from './types';
import { filterParams } from './capabilities';
import { AiError } from './errors';
import { staticModels } from './models';
export const PROVIDER_KINDS: ProviderKind[] = ['ollama', 'lmstudio', 'openai-compatible', 'anthropic', 'claude-code'];
export const DEFAULT_URLS: Record<ProviderKind, string> = { ollama: 'http://localhost:11434', lmstudio: 'http://localhost:1234', 'openai-compatible': 'https://api.openai.com', anthropic: 'https://api.anthropic.com', 'claude-code': 'http://localhost:11436' };
export function normalizeBaseUrl(raw: string): string { const url = new URL(raw); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new AiError('unreachable'); return url.href.replace(/\/+$/, '').replace(/\/v1$/, ''); }
export function profileOrigin(profile: ModelProfile): string { return new URL(profile.kind === 'anthropic' ? DEFAULT_URLS.anthropic : normalizeBaseUrl(profile.baseUrl)).origin; }
export function resolveSecret(profile: ModelProfile, secret?: StoredSecret | null): string | undefined {
  if (!secret) { if (profile.secretId || profile.kind === 'anthropic') throw new AiError('unauthorized'); return; }
  if (secret.binding.kind !== profile.kind || secret.binding.origin !== profileOrigin(profile) || (profile.secretId && profile.secretId !== secret.id)) throw new AiError('secretBinding');
  return secret.value || undefined;
}
export function defaultProfile(kind: ProviderKind = 'ollama', id = `default:${kind}`): ModelProfile { return { id, kind, name: kind, baseUrl: DEFAULT_URLS[kind], model: staticModels(kind)[0]?.value ?? '', secretId: null, params: { temperature: 0.3 }, contextTokens: null, updatedAt: 0, updatedBy: 'seed' }; }
export function validateParams(raw: unknown): GenParams { const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>; const out: GenParams = {}; for (const [key, max] of [['temperature', 2], ['topP', 1], ['maxOutputTokens', 10000000], ['chunkChars', 10000000]] as const) { const n = v[key]; if (typeof n === 'number' && Number.isFinite(n) && n >= (key === 'temperature' || key === 'topP' ? 0 : 1) && n <= max) out[key] = n; } if (['low', 'medium', 'high', 'xhigh', 'max'].includes(String(v.effort))) out.effort = v.effort as GenParams['effort']; return out; }
export function validateProfile(raw: unknown): ModelProfile { const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<ModelProfile>; const kind = PROVIDER_KINDS.includes(v.kind!) ? v.kind! : 'ollama'; const d = defaultProfile(kind); let baseUrl = d.baseUrl; try { baseUrl = normalizeBaseUrl(v.baseUrl ?? d.baseUrl); } catch { /* Profilo corrotto: default sicuro. */ } return { ...d, id: typeof v.id === 'string' ? v.id : d.id, name: typeof v.name === 'string' ? v.name : d.name, model: typeof v.model === 'string' ? v.model : d.model, baseUrl, secretId: typeof v.secretId === 'string' ? v.secretId : null, params: validateParams(v.params), contextTokens: typeof v.contextTokens === 'number' && Number.isFinite(v.contextTokens) && v.contextTokens > 0 ? v.contextTokens : null, updatedAt: typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) && v.updatedAt >= 0 ? v.updatedAt : 0, updatedBy: typeof v.updatedBy === 'string' ? v.updatedBy : 'seed' }; }
/** Il contesto appartiene al modello: non riutilizza il limite del modello precedente. */
export function modelSelection(profile: Pick<ModelProfile, 'model' | 'contextTokens'>, model: string, option?: ModelOption): Pick<ModelProfile, 'model' | 'contextTokens'> {
  const live = option?.value === model ? option.contextTokens : undefined;
  const contextTokens = typeof live === 'number' && Number.isFinite(live) && live > 0 ? live : model === profile.model ? profile.contextTokens : null;
  return { model, contextTokens };
}
export function effectiveProfile(profile: ModelProfile, overrides: ProfileOverrides = {}): ModelProfile {
  const selection = modelSelection(profile, overrides.model ?? profile.model);
  return { ...profile, ...selection, contextTokens: overrides.contextTokens === undefined ? selection.contextTokens : overrides.contextTokens };
}
export function effectiveParams(profile: ModelProfile, overrides: ProfileOverrides = {}, preset?: Pick<PromptPreset, 'params'>): GenParams { return filterParams(validateParams({ ...profile.params, ...preset?.params, ...overrides }), profile.kind, overrides.model ?? profile.model, { effort: !!profile.params.effort }); }
export function isLocalProfile(profile: ModelProfile): boolean { if (profile.kind === 'anthropic') return false; try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname); } catch { return false; } }
