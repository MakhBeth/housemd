import type { ModelOption, ModelProfile, ProviderKind } from './types';
import { defaultProfile } from './profiles';
export const ANTHROPIC_MODELS: ModelOption[] = ['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-fable-5-1'].map(value => ({ value, label: value }));
export const CLAUDE_CODE_MODELS: ModelOption[] = ['', 'opus', 'sonnet', 'haiku', ...ANTHROPIC_MODELS.map(model => model.value)].map(value => ({ value, label: value || 'Default' }));
export const OLLAMA_MODELS: ModelOption[] = ['qwen3.6:35b-mlx', 'qwen3:8b', 'llama3.2'].map(value => ({ value, label: value }));
export function staticModels(kind: ProviderKind): ModelOption[] { return kind === 'anthropic' ? ANTHROPIC_MODELS : kind === 'claude-code' ? CLAUDE_CODE_MODELS : kind === 'ollama' ? OLLAMA_MODELS : []; }
export function knownModel(kind: ProviderKind, model: string, live: ModelOption[] = []): boolean { return [...live, ...staticModels(kind)].some(option => option.value === model); }
export function modelOptions(kind: ProviderKind, current: string, live?: ModelOption[] | null): ModelOption[] { const options = live?.length ? live : staticModels(kind); return options.some(o => o.value === current) || !current ? [...options] : [...options, { value: current, label: current }]; }
export function modelForProvider(kind: ProviderKind, model: string, live?: ModelOption[]): string { return knownModel(kind, model, live) ? model : staticModels(kind)[0]?.value ?? ''; }
export function changeProvider(profile: ModelProfile, kind: ProviderKind): ModelProfile { const defaults = defaultProfile(kind, profile.id); return { ...profile, kind, baseUrl: defaults.baseUrl, model: modelForProvider(kind, profile.model), params: defaults.params, contextTokens: null, secretId: null }; }
