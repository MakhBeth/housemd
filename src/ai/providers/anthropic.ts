import type { ChatEvent, ChatProvider, ModelProfile, StoredSecret } from '../types';
import { resolveSecret } from '../profiles';
import { ANTHROPIC_MODELS } from '../models';
import { AiError, mapError } from '../errors';
import { filterParams, capabilities } from '../capabilities';
import { checkResponse, stopReason, type ProviderDeps, type AnthropicClient } from './shared';
export function anthropic(profile: ModelProfile, secret?: StoredSecret | null, deps: ProviderDeps = {}): ChatProvider {
  return {
    async testConnection(signal) {
      try {
        const key=resolveSecret(profile,secret);if(!key)throw new AiError('unauthorized');
        const response=await (deps.fetch??fetch)('https://api.anthropic.com/v1/models?limit=1',{signal,redirect:'error',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}});
        await checkResponse(response,profile,secret);
      } catch(error){throw mapError(error,profile.kind,secret?[secret.value]:[]);}
    },
    async *stream(req, signal): AsyncIterable<ChatEvent> {
      try {
        const apiKey = resolveSecret(profile, secret); if (!apiKey) throw new AiError('unauthorized');
        const options = { apiKey, fetch: deps.fetch ?? fetch, dangerouslyAllowBrowser: true as const, maxRetries: 0 as const };
        const client: AnthropicClient = deps.anthropic ? await deps.anthropic(options) : new (await import('@anthropic-ai/sdk')).default(options) as unknown as AnthropicClient;
        const params = filterParams(req.params, 'anthropic', req.model);
        const body = { model: req.model, system: req.system, messages: req.messages.map(m => ({ role: m.role, content: m.text })), max_tokens: params.maxOutputTokens ?? 64000, ...(!capabilities('anthropic', req.model).temperature ? { thinking: { type: 'adaptive' }, output_config: params.effort ? { effort: params.effort } : undefined } : { temperature: params.temperature, top_p: params.topP }) };
        let finish: ChatEvent & { type: 'done' } | undefined;
        for await (const raw of client.messages.stream(body, { signal })) {
          signal.throwIfAborted();
          const e = raw as { type: string; delta?: { type?: string; text?: string; stop_reason?: string }; content_block?: { type: string }; message?: { usage?: { input_tokens?: number; output_tokens?: number } }; usage?: { input_tokens?: number; output_tokens?: number } };
          if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') yield { type: 'text', text: e.delta.text ?? '' };
          if (e.content_block?.type === 'thinking' || e.delta?.type === 'thinking_delta') yield { type: 'thinking' };
          const usage = e.usage ?? e.message?.usage; if (usage) yield { type: 'usage', inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
          if (e.delta?.stop_reason) finish = { type: 'done', stop: stopReason(e.delta.stop_reason) };
        }
        if (!finish) throw new AiError('badStream'); yield finish;
      } catch (error) { throw mapError(error, profile.kind, secret ? [secret.value] : []); }
    },
    async listModels(signal) { signal.throwIfAborted(); resolveSecret(profile, secret); return ANTHROPIC_MODELS; },
  };
}
