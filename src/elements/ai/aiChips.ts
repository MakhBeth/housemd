import type { AiController, AiState } from '../../ai/aiController';
import { capabilities } from '../../ai/capabilities';
import { effectiveProfile } from '../../ai/profiles';
import type { GenParams, ModelProfile, ProfileOverrides, PromptPreset } from '../../ai/types';

/** Quello che i chip AI usano del controller: così i test passano un controller finto. */
export type AiChipController = Pick<AiController, 'subscribe' | 'getState' | 'profile' | 'override'>;

/** Preset proposti come suggerimenti: solo con la chat vuota e nessuna richiesta in corso. */
export function suggestionPresets(state: Pick<AiState, 'chat' | 'running' | 'presets'>): PromptPreset[] {
  if (state.chat.messages.length > 0 || state.running) return [];
  return state.presets.filter((p) => !p.hidden).sort((a, b) => a.order - b.order);
}

/** Chip dell'effort: solo se il profilo effettivo lo supporta; valore dell'override, poi del profilo. */
export function effortChipState(profile: ModelProfile | undefined, overrides: ProfileOverrides): { visible: false } | { visible: true; value: string } {
  if (!profile) return { visible: false };
  const effective = effectiveProfile(profile, overrides);
  if (!capabilities(effective.kind, effective.model, { effort: !!profile.params.effort }).effort) return { visible: false };
  return { visible: true, value: overrides.effort ?? profile.params.effort ?? '' };
}

export type ParamKey = 'temperature' | 'topP' | 'maxOutputTokens' | 'chunkChars';
export type ParamField = { key: ParamKey; kind: 'number'; min: number; max?: number; step: number } | { key: 'effort'; kind: 'effort' };

const NUMERIC: readonly ParamKey[] = ['temperature', 'topP', 'maxOutputTokens', 'chunkChars'];

/** Campi dei parametri per il profilo (era Parameters.tsx); l'effort in fondo, se non ha già il suo chip. */
export function parameterFields(profile: ModelProfile, hideEffort: boolean): ParamField[] {
  const caps = capabilities(profile.kind, profile.model, { effort: !!profile.params.effort });
  const fields: ParamField[] = NUMERIC.filter((key) => caps[key]).map((key) => {
    const unit = key === 'temperature' || key === 'topP';
    return { key, kind: 'number', min: unit ? 0 : 1, ...(key === 'temperature' ? { max: 2 } : key === 'topP' ? { max: 1 } : {}), step: unit ? 0.1 : 1 };
  });
  if (caps.effort && !hideEffort) fields.push({ key: 'effort', kind: 'effort' });
  return fields;
}

/** Il valore dei parametri dopo una modifica: stringa vuota = parametro tolto (come Parameters.tsx). */
export function withParam(value: GenParams, key: ParamKey | 'effort', raw: string): GenParams {
  if (key === 'effort') return { ...value, effort: (raw as GenParams['effort']) || undefined };
  return { ...value, [key]: raw === '' ? undefined : Number(raw) };
}
