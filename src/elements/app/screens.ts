import { match } from 'ts-pattern';

import type { FolderSwitch } from '../../app/switchFolder';

/** Schermata dell'app. `S` è la cartella salvata, `W` lo workspace aperto, `F` il file singolo aperto. */
export type Screen<S, W, F = never> =
  | { kind: 'boot' }
  | { kind: 'unsupported'; error?: string }
  | { kind: 'start'; error?: string }
  | { kind: 'resume'; stored: S }
  | { kind: 'open'; stored: S; workspace: W }
  | { kind: 'file'; file: F; workspaceId: string; workspace: W };

export type SwitchOutcome<S, W, F = never> =
  | { kind: 'show'; screen: Screen<S, W, F> }
  | { kind: 'reportError'; detail: string }
  | { kind: 'stay' };

/**
 * Esito di un cambio cartella. Con una cartella aperta un errore resta lì come notice; dall'avvio
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

/**
 * Esito dell'apertura di un file singolo. Con uno workspace aperto un errore resta lì come notice; dall'avvio torna
 * alla schermata iniziale con l'errore (quella senza cartelle, se il browser non le apre).
 */
export function afterFileOpen<S, W, F>(
  result: FolderSwitch<{ file: F; workspaceId: string; workspace: W }>,
  hasOpenWorkspace: boolean,
  foldersSupported: boolean,
): SwitchOutcome<S, W, F> {
  return match(result)
    .returnType<SwitchOutcome<S, W, F>>()
    .with({ kind: 'opened' }, ({ value }) => ({ kind: 'show', screen: { kind: 'file', ...value } }))
    .with({ kind: 'error' }, ({ detail }) =>
      hasOpenWorkspace
        ? { kind: 'reportError', detail }
        : { kind: 'show', screen: { kind: foldersSupported ? 'start' : 'unsupported', error: detail } },
    )
    .with({ kind: 'cancelled' }, { kind: 'blocked' }, () => ({ kind: 'stay' }))
    .exhaustive();
}
