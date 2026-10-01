import { match } from 'ts-pattern';

import type { FolderSwitch } from '../../app/switchFolder';

/** Schermata dell'app. `S` è la cartella salvata, `W` lo workspace aperto. */
export type Screen<S, W> =
  | { kind: 'boot' }
  | { kind: 'unsupported' }
  | { kind: 'start'; error?: string }
  | { kind: 'resume'; stored: S }
  | { kind: 'open'; stored: S; workspace: W };

export type SwitchOutcome<S, W> =
  | { kind: 'show'; screen: Screen<S, W> }
  | { kind: 'reportError'; detail: string }
  | { kind: 'stay' };

/**
 * Esito di un cambio cartella. Con una cartella aperta un errore resta lì come toast; dall'avvio
 * torna alla schermata iniziale con l'errore.
 */
export function afterSwitch<S, W>(
  result: FolderSwitch<{ stored: S; workspace: W }>,
  hasOpenWorkspace: boolean,
): SwitchOutcome<S, W> {
  return match(result)
    .returnType<SwitchOutcome<S, W>>()
    .with({ kind: 'opened' }, ({ value }) => ({ kind: 'show', screen: { kind: 'open', ...value } }))
    .with({ kind: 'error' }, ({ detail }) =>
      hasOpenWorkspace ? { kind: 'reportError', detail } : { kind: 'show', screen: { kind: 'start', error: detail } },
    )
    .with({ kind: 'cancelled' }, { kind: 'blocked' }, () => ({ kind: 'stay' }))
    .exhaustive();
}
