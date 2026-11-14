import type { AttachedFile } from './contextAttach';
import { estimateTokens } from './prompt';
import type { ChatRequest, ModelProfile } from './types';

/** Limite di corpo del bridge (`MAX_BODY` in `bridge/claude-bridge.mjs`). */
export const BRIDGE_MAX_BODY = 5 * 1024 * 1024;

export type ContextCheck =
  | { kind: 'ok'; totalTokens: number; limit: number | null }
  | { kind: 'overLimit'; totalTokens: number; limit: number; excess: number; top: { path: string; tokens: number; via?: string }[] }
  | { kind: 'bridgeTooLarge'; bytes: number };

/**
 * Controlla il request completo prima dell'invio: byte del bridge (indipendente dalla finestra), poi token contro la finestra
 * con la stessa formula di `runRequest` (system + messaggi + uscita massima). Mai troncamenti: chi chiama mostra la nota.
 */
export function checkContext(request: ChatRequest, profile: ModelProfile, maxOutput: number, files: AttachedFile[], via: Map<string, string>): ContextCheck {
  if (profile.kind === 'claude-code') {
    const bytes = new TextEncoder().encode(JSON.stringify(request)).length;
    if (bytes > BRIDGE_MAX_BODY) return { kind: 'bridgeTooLarge', bytes };
  }
  const totalTokens = estimateTokens(request.system + request.messages.map((m) => m.text).join('')) + maxOutput;
  const limit = profile.contextTokens;
  if (!limit || totalTokens <= limit) return { kind: 'ok', totalTokens, limit: limit ?? null };
  const top = files
    .map((f) => ({ path: f.path, tokens: estimateTokens(f.text), via: via.get(f.path) }))
    .sort((a, b) => b.tokens - a.tokens || (a.path < b.path ? -1 : 1))
    .slice(0, 5)
    .map(({ path, tokens, via: v }) => (v === undefined ? { path, tokens } : { path, tokens, via: v }));
  return { kind: 'overLimit', totalTokens, limit, excess: totalTokens - limit, top };
}

/** `1,5 MB`, `300 kB`: unità e separatori della lingua. */
export function formatSize(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  const value = mb ? bytes / (1024 * 1024) : bytes / 1024;
  return new Intl.NumberFormat(locale, { style: 'unit', unit: mb ? 'megabyte' : 'kilobyte', maximumFractionDigits: 1, unitDisplay: 'short' }).format(value);
}
