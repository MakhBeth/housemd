import type { ChatEvent, ChatProvider, ModelProfile, StoredSecret } from '../types';
import { normalizeBaseUrl } from '../profiles';
import { AiError, mapError } from '../errors';
import { CLAUDE_CODE_MODELS } from '../models';
import { checkResponse, headers, stopReason, type ProviderDeps } from './shared';
export function compatibleBridge(value: unknown): boolean { const h = value as { app?: string; protocol?: number; protections?: Record<string, unknown> }; return !!h && h.app === 'housemd-bridge' && h.protocol === 1 && ['originCheck', 'noTools', 'noSessionPersistence'].every(k => h.protections?.[k] === true); }
export function claudeCode(profile: ModelProfile, secret?: StoredSecret | null, deps: ProviderDeps = {}): ChatProvider {
  const fetcher = deps.fetch ?? fetch; let verified = false;
  async function health(signal: AbortSignal) {
    const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}/health`, { signal, headers: headers(profile, secret), redirect: 'error' });
    if (response.status === 403) throw new AiError('originRejected');
    if (!response.ok) throw new AiError('bridgeIncompatible');
    let value: unknown; try { value = await response.json(); } catch { throw new AiError('bridgeIncompatible'); }
    if (!compatibleBridge(value)) throw new AiError('bridgeIncompatible'); verified = true;
  }
  return {
    async *stream(req, signal): AsyncIterable<ChatEvent> {
      try { if (!verified) await health(signal); yield { type: 'thinking' };
        const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}/v1/chat/completions`, { method: 'POST', signal, redirect: 'error', headers: headers(profile, secret), body: JSON.stringify({ model: req.model, stream: false, messages: [{ role: 'system', content: req.system }, ...req.messages.map(m => ({ role: m.role, content: m.text }))] }) });
        await checkResponse(response, profile, secret);
        const value = await response.json() as { choices?: { message?: { content?: string }; finish_reason?: string }[] }; const choice = value.choices?.[0];
        if (typeof choice?.message?.content !== 'string') throw new AiError('badStream');
        yield { type: 'text', text: choice.message.content }; yield { type: 'done', stop: stopReason(choice.finish_reason) };
      } catch (error) { verified = false; throw mapError(error, profile.kind, secret ? [secret.value] : []); }
    },
    async listModels(signal) { try { await health(signal); return CLAUDE_CODE_MODELS; } catch (error) { verified = false; throw mapError(error, profile.kind, secret ? [secret.value] : []); } },
  };
}
