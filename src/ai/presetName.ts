import type { MessageKey } from '../i18n/messages';
import type { PromptPreset } from './types';

/** Nome visualizzato di un preset: il nome scelto, la traduzione del built-in o "senza nome". */
export function presetLabel(preset: Pick<PromptPreset, 'name' | 'builtInId'>, t: (key: MessageKey) => string): string {
  if (preset.name.trim()) return preset.name;
  return t(preset.builtInId ? (`ai.preset.${preset.builtInId}` as MessageKey) : 'ai.untitled');
}
