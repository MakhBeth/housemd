import type { PromptPreset } from './types';
const definitions = [
  ['sbobina', 'side', 'Rewrite this raw transcript as clean readable Markdown in the same language. Fix punctuation, remove filler words and repetitions, add paragraphs and headings. Keep speaker labels and timestamps. Do NOT summarize, omit content or add information.', 0.3],
  ['traduci', 'side', 'Translate the Markdown into {targetLanguage}. Preserve its structure exactly. Do not translate code, URLs, image paths, HTML tags or wikilink targets (only aliases).', 0.2],
  ['consecutio', 'diff', 'You are an Italian copy editor. Correct ONLY verb tenses and moods and the minimum required around them. Do not change style, word choice or punctuation. Return unchanged text when correct.', 0],
] as const;
export function builtInPresets(): PromptPreset[] {
  return definitions.map(([builtInId, view, instructions, temperature], order) => ({ id: `builtin:${builtInId}`, builtInId, name: '', updatedAt: 0, updatedBy: 'seed', instructions: instructions + ' Output only the transformed text.', variables: builtInId === 'traduci' ? { targetLanguage: 'English' } : undefined, view, strategy: 'chunked', frontmatter: 'keep', params: { temperature }, order, hidden: false }));
}
export function restorePreset(preset: PromptPreset): PromptPreset {
  const seed = builtInPresets().find(p => p.builtInId === preset.builtInId);
  return seed ? { ...seed, id: preset.id, updatedAt: preset.updatedAt, updatedBy: preset.updatedBy } : preset;
}
export function presetInstructions(preset: PromptPreset): string { return preset.instructions.replaceAll('{targetLanguage}', preset.variables?.targetLanguage || 'English'); }
export function validatePreset(value: unknown): PromptPreset | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as PromptPreset;
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || typeof p.instructions !== 'string' || !Number.isFinite(p.updatedAt) || typeof p.updatedBy !== 'string') return null;
  return { ...p, view: p.view === 'side' ? 'side' : 'diff', strategy: p.strategy === 'whole' ? 'whole' : 'chunked', frontmatter: p.frontmatter === 'include' ? 'include' : 'keep', order: Number.isFinite(p.order) ? p.order : 0, hidden: !!p.hidden };
}
