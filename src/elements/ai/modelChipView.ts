import type { AiController } from '../../ai/aiController';
import { effectiveProfile, isLocalProfile } from '../../ai/profiles';
import type { ModelProfile, ProfileOverrides } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';
import type { AiChipController } from './aiChips';
import type { ModelSelectController } from './modelSelectView';

/**
 * Quello che il chip usa del controller: stato e override (come gli altri chip), il provider per il
 * selettore del modello, la scelta e il salvataggio del profilo.
 */
export type ModelChipController = AiChipController & ModelSelectController & Pick<AiController, 'selectProfile' | 'saveOverrides'>;

/** Nota privacy del profilo (tooltip del chip e prima riga del popover), come ModelChip.tsx. */
export function privacyNote(t: I18nStore['t'], profile: ModelProfile): string {
  if (profile.kind === 'claude-code') return t('ai.claudePrivacy');
  if (isLocalProfile(profile)) return t('ai.localPrivacy');
  let host = '';
  try {
    host = new URL(profile.baseUrl).host;
  } catch {
    // URL non valido: la nota resta senza host.
  }
  return t('ai.cloudPrivacy', { host });
}

/** Testo del chip: «profilo · modello», o «Predefinito della CLI» senza modello. */
export function chipLabel(t: I18nStore['t'], profile: ModelProfile, overrides: ProfileOverrides): string {
  return `${profile.name} · ${effectiveProfile(profile, overrides).model || t('ai.cliDefault')}`;
}

/** La chat ha override (pallino « •» dopo il testo del chip). */
export const hasOverrides = (overrides: ProfileOverrides): boolean => Object.keys(overrides).length > 0;

export interface ProfileGroup {
  local: boolean;
  profiles: ModelProfile[];
}

/** Gruppi del popover: prima i profili locali, poi quelli cloud; un gruppo senza profili non c'è. */
export function profileGroups(profiles: readonly ModelProfile[]): ProfileGroup[] {
  return [true, false]
    .map((local) => ({ local, profiles: profiles.filter((p) => isLocalProfile(p) === local) }))
    .filter((group) => group.profiles.length > 0);
}

/** Nome nella riga del profilo: un profilo Anthropic senza chiave salvata ha « ⚠». */
export const profileName = (profile: ModelProfile): string => (profile.kind === 'anthropic' && !profile.secretId ? `${profile.name} ⚠` : profile.name);

/** Righe di un gruppo (un <fieldset>): la legenda, poi un profilo per riga. */
export type GroupRow = { kind: 'legend' } | { kind: 'profile'; profile: ModelProfile };

export const groupRows = (group: ProfileGroup): GroupRow[] => [{ kind: 'legend' }, ...group.profiles.map((profile) => ({ kind: 'profile' as const, profile }))];

export const groupRowKey = (row: GroupRow): string => (row.kind === 'legend' ? 'legend' : `profile:${row.profile.id}`);

/** Parti del popover nell'ordine di ModelChip.tsx: il selettore del modello c'è solo a popover aperto. */
export type PopoverPart = 'note' | 'group:local' | 'group:cloud' | 'model' | 'params' | 'actions';

export function popoverParts(groups: readonly ProfileGroup[], open: boolean): PopoverPart[] {
  return [
    'note',
    ...groups.map((group): PopoverPart => (group.local ? 'group:local' : 'group:cloud')),
    ...(open ? (['model'] as const) : []),
    'params',
    'actions',
  ];
}
