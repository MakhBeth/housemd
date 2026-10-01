import { match } from 'ts-pattern';

import type { MessageKey } from '../../i18n/messages';
import type { OpenDoc, SaveState } from '../../workspace/workspace';

/** Cosa mostra (e come annuncia) l'indicatore di salvataggio nella barra degli strumenti. */
export interface SaveIndicator {
  /** Valore di `data-state`, per il CSS. */
  state: SaveState | 'none';
  label: MessageKey | null;
  live: 'polite' | 'assertive';
  role: 'alert' | undefined;
  /** Pallino delle modifiche non salvate. */
  draftIcon: boolean;
}

export function saveIndicator(doc: Pick<OpenDoc, 'saveState' | 'deletedOnDisk'> | null): SaveIndicator {
  if (!doc) return { state: 'none', label: null, live: 'polite', role: undefined, draftIcon: false };
  const label: MessageKey = doc.deletedOnDisk
    ? 'save.deleted'
    : match(doc.saveState)
        .with('saved', () => 'save.saved' as const)
        .with('dirty', () => 'save.dirty' as const)
        .with('saving', () => 'save.saving' as const)
        .with('error', () => 'save.error' as const)
        .exhaustive();
  const error = doc.saveState === 'error';
  return {
    state: doc.saveState,
    label,
    live: error ? 'assertive' : 'polite',
    role: error ? 'alert' : undefined,
    draftIcon: doc.saveState === 'dirty' && !doc.deletedOnDisk,
  };
}
