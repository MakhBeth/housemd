import type { AiErrorCode, ProviderKind } from './types';
export type { AiErrorCode } from './types';
export function sanitizeDetail(value: unknown, secrets: string[] = []): string {
  let text = String(value ?? '');
  for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
  return text.replace(/(authorization|x-api-key)["']?\s*[:=]\s*["']?[^\r\n,}]+/gi, '$1: [redacted]').replace(/\b(?:sk|key|token)-[a-zA-Z0-9_-]+/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 500);
}
export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, public readonly detail = '', public readonly retryAfter?: string) { super(sanitizeDetail(detail)); this.name = 'AiError'; this.detail = this.message; }
}
export function httpError(status: number, detail = '', kind?: ProviderKind, retryAfter?: string): AiError {
  const code: AiErrorCode = kind === 'claude-code' && status >= 500 && /timeout/i.test(detail) ? 'timeout' : status === 401 ? 'unauthorized' : status === 403 ? kind === 'claude-code' ? 'originRejected' : 'forbidden' : status === 404 ? 'notFound' : status === 429 ? 'rateLimited' : status === 413 ? 'tooLong' : status === 408 || status === 504 ? 'timeout' : status === 400 ? /temperature|top_p|max_tokens|effort/i.test(detail) ? 'paramRejected' : 'badStream' : kind === 'claude-code' ? 'bridgeCli' : 'server';
  return new AiError(code, detail, retryAfter);
}
export function mapError(error: unknown, kind?: ProviderKind, secrets: string[] = []): AiError {
  if (error instanceof AiError) return new AiError(error.code, sanitizeDetail(error.detail, secrets), error.retryAfter);
  const e = error as { name?: string; message?: string; status?: number; headers?: Headers; constructor?: { name?: string } };
  if (e?.status) return httpError(e.status, sanitizeDetail(e.message, secrets), kind, e.headers?.get?.('retry-after') ?? undefined);
  return new AiError(e?.name === 'SyntaxError' ? 'badStream' : e?.name === 'AbortError' || e?.constructor?.name === 'APIUserAbortError' ? 'aborted' : e?.name === 'TimeoutError' || e?.constructor?.name === 'APIConnectionTimeoutError' ? 'timeout' : kind === 'claude-code' ? 'bridgeDown' : 'unreachable', sanitizeDetail(e?.message, secrets));
}
