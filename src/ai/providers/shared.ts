import { httpError, sanitizeDetail } from '../errors';
import type { ModelProfile, StoredSecret } from '../types';
import { resolveSecret } from '../profiles';
export interface ProviderDeps { fetch?: typeof fetch; anthropic?: (options: { apiKey: string; fetch: typeof fetch; dangerouslyAllowBrowser: true; maxRetries: 0 }) => Promise<AnthropicClient> }
export interface AnthropicClient { messages: { stream(body: Record<string, unknown>, options: { signal: AbortSignal }): AsyncIterable<unknown> } }
export function headers(profile: ModelProfile, secret?: StoredSecret | null): Record<string, string> { const key = resolveSecret(profile, secret); return { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }; }
export async function checkResponse(response: Response, profile: ModelProfile, secret?: StoredSecret | null): Promise<void> { if (!response.ok) { const detail = sanitizeDetail(await response.text(), secret ? [secret.value] : []); throw httpError(response.status, detail, profile.kind, response.headers.get('retry-after') ?? undefined); } }
export function stopReason(reason: unknown): 'end' | 'length' | 'refusal' | 'other' { return ['stop', 'end_turn', 'stop_sequence'].includes(String(reason)) ? 'end' : ['length', 'max_tokens'].includes(String(reason)) ? 'length' : ['content_filter', 'refusal'].includes(String(reason)) ? 'refusal' : 'other'; }
