import type { ChatEvent, ChatProvider, ChatRequest, ModelOption, ModelProfile, StoredSecret } from '../types';
import { normalizeBaseUrl } from '../profiles';
import { parseSseJson } from '../sse';
import { AiError, mapError } from '../errors';
import { filterParams } from '../capabilities';
import { checkResponse, headers, stopReason, type ProviderDeps } from './shared';
import { ollamaModels, openaiModels, tokens } from './shapes';
export function openaiCompatible(profile: ModelProfile, secret?: StoredSecret | null, deps: ProviderDeps = {}): ChatProvider {
  const fetcher = deps.fetch ?? fetch;
  return {
    async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
      try {
        if (!req.model && profile.kind === 'lmstudio') throw new AiError('noModel');
        const params = filterParams(req.params, profile.kind, req.model, { effort: !!profile.params.effort });
        const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}/v1/chat/completions`, { method: 'POST', redirect: 'error', signal, headers: headers(profile, secret), body: JSON.stringify({ model: req.model, messages: [{ role: 'system', content: req.system }, ...req.messages.map(m => ({ role: m.role, content: m.text }))], stream: true, stream_options: { include_usage: true }, temperature: params.temperature, top_p: params.topP, max_tokens: params.maxOutputTokens, reasoning_effort: params.effort }) });
        await checkResponse(response, profile, secret); if (!response.body) throw new AiError('badStream');
        let finish: ChatEvent & { type: 'done' } | undefined;
        for await (const raw of parseSseJson(response.body, signal)) {
          const value = raw as { error?: unknown; choices?: { delta?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
          if (!value || typeof value !== 'object' || value.error) throw new AiError('badStream');
          const choice = value.choices?.[0];
          if (choice?.delta?.content != null && typeof choice.delta.content !== 'string') throw new AiError('badStream');
          if (choice?.delta?.content) yield { type: 'text', text: choice.delta.content };
          if (choice?.delta?.reasoning_content) yield { type: 'thinking' };
          if (value.usage) yield { type: 'usage', inputTokens: tokens(value.usage.prompt_tokens), outputTokens: tokens(value.usage.completion_tokens) };
          if (choice?.finish_reason) finish = { type: 'done', stop: stopReason(choice.finish_reason) };
        }
        if (!finish) throw new AiError('badStream'); yield finish;
      } catch (error) { throw mapError(error, profile.kind, secret ? [secret.value] : []); }
    },
    async listModels(signal): Promise<ModelOption[] | null> {
      const auth = headers(profile, secret);
      try {
        const base = normalizeBaseUrl(profile.baseUrl); const path = profile.kind === 'ollama' ? '/api/tags' : profile.kind === 'lmstudio' ? '/api/v0/models' : '/v1/models';
        let response = await fetcher(base + path, { signal, headers: auth, redirect: 'error' });
        if (profile.kind === 'lmstudio' && response.status === 404) response = await fetcher(base + '/v1/models', { signal, headers: headers(profile, secret), redirect: 'error' });
        await checkResponse(response, profile, secret);
        const value: unknown = await response.json();
        return profile.kind === 'ollama' ? ollamaModels(value) : openaiModels(value);
      } catch (error) { const mapped = mapError(error, profile.kind, secret ? [secret.value] : []); if (mapped.code === 'unreachable') return null; throw mapped; }
    },
  };
}
