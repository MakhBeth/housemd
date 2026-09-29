import type { ChatProvider, ModelProfile, StoredSecret } from '../types';
import { openaiCompatible } from './openaiCompatible';
import { claudeCode } from './claudeCode';
import { anthropic } from './anthropic';
import type { ProviderDeps } from './shared';
export type { ProviderDeps, AnthropicClient } from './shared';
export function createProvider(profile: ModelProfile, secret?: StoredSecret | null, deps: ProviderDeps = {}): ChatProvider { const snapshot = structuredClone(profile); const key = secret ? structuredClone(secret) : secret; return snapshot.kind === 'anthropic' ? anthropic(snapshot, key, deps) : snapshot.kind === 'claude-code' ? claudeCode(snapshot, key, deps) : openaiCompatible(snapshot, key, deps); }
