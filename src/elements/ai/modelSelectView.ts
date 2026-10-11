import type { AiController } from '../../ai/aiController';
import { modelOptions } from '../../ai/models';
import type { ModelOption, ModelProfile } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';

/** Valore dell'opzione «Altro…»: mostra il campo libero (come ModelSelect.tsx). */
export const CUSTOM = '__custom';

/**
 * Quello che il selettore usa del controller: il provider del profilo, che è l'unico a fare la richiesta
 * di rete (src/ai/providers, CLAUDE.md §AI), e la segnalazione degli errori. Le chiavi non passano di qui.
 */
export type ModelSelectController = Pick<AiController, 'provider' | 'report'>;

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Opzioni della select nell'ordine di ModelSelect.tsx: la vuota («Predefinito della CLI» o «Scegli un
 * modello»), i modelli (elenco del server se c'è, altrimenti quelli noti, più quello scelto), «Altro…».
 * I valori vuoti si saltano come prima; un valore doppio si tiene una volta sola (sono le chiavi delle righe).
 */
export function modelSelectOptions(
  profile: Pick<ModelProfile, 'kind' | 'model'>,
  models: readonly ModelOption[] | null,
  t: I18nStore['t'],
): SelectOption[] {
  const seen = new Set(['', CUSTOM]);
  const listed: SelectOption[] = [];
  for (const { value, label } of modelOptions(profile.kind, profile.model, models ? [...models] : null)) {
    if (seen.has(value)) continue;
    seen.add(value);
    listed.push({ value, label });
  }
  return [
    { value: '', label: t(profile.kind === 'claude-code' ? 'ai.cliDefault' : 'ai.chooseModel') },
    ...listed,
    { value: CUSTOM, label: t('ai.other') },
  ];
}

/** Valore mostrato dalla select: «Altro…» con il campo libero aperto, altrimenti il modello del profilo. */
export const selectValue = (custom: boolean, model: string): string => (custom ? CUSTOM : model);

/**
 * Chiave dell'elenco dei modelli: cambia (e l'elenco si richiede) solo con tipo di provider, indirizzo,
 * chiave salvata o «Aggiorna», come le dipendenze dell'effetto di ModelSelect.tsx. Resta in memoria:
 * mai in un attributo.
 */
export const modelListKey = (profile: Pick<ModelProfile, 'kind' | 'baseUrl' | 'secretId'>, revision: number): string =>
  JSON.stringify([profile.kind, profile.baseUrl, profile.secretId, revision]);
