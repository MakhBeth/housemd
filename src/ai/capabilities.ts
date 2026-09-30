import type { GenParams, ProviderKind } from './types';
export function capabilities(kind: ProviderKind, model: string, info?: { effort?: boolean }) {
  const cli = kind === 'claude-code';
  const recent = /(?:opus|sonnet)-(?:5|[6-9])|opus-4-[7-9]/.test(model);
  return { temperature: !cli && !(kind === 'anthropic' && recent), topP: !cli && !(kind === 'anthropic' && recent), maxOutputTokens: !cli, effort: kind === 'anthropic' || (!cli && !!info?.effort), chunkChars: true };
}
export function filterParams(params: GenParams, kind: ProviderKind, model: string, info?: { effort?: boolean }): GenParams {
  const allowed = capabilities(kind, model, info);
  return Object.fromEntries(Object.entries(params).filter(([k, v]) => allowed[k as keyof typeof allowed] && v !== undefined));
}
