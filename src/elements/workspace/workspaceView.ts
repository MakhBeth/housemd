import type { AiErrorCode } from '../../ai/types';
import type { MessageKey } from '../../i18n/messages';
import type { Params } from '../../i18n/i18n';
import type { WorkspaceState } from '../../workspace/workspace';
import type { ToastItem } from '../toasts/toasts.element';
import type { Mode } from './layout';

/** La vista mostrata: con la preferenza «AI» ma il controller non ancora pronto (IndexedDB lento), la divisa. */
export function shownMode(mode: Mode, hasAi: boolean): Mode {
  return mode === 'ai' && !hasAi ? 'split' : mode;
}

/** Chiave della sessione dell'editor e del `resetKey`: cambia con il file o con una revisione nuova. */
export function docKey(doc: Pick<NonNullable<WorkspaceState['doc']>, 'path' | 'revision'> | null): string {
  return `${doc?.path}#${doc?.revision}`;
}

/** Toast del workspace più l'errore AI non legato a un messaggio (sync, chiave, selezione persa), nello stesso contenitore. */
export function toastItems(toasts: WorkspaceState['toasts'], aiError: AiErrorCode | null | undefined, t: (key: MessageKey, params?: Params) => string): ToastItem[] {
  return [
    ...toasts.map((toast) => ({ key: `ws-${toast.id}`, kind: toast.kind, text: t(`toast.${toast.code}` as MessageKey, toast.params) })),
    ...(aiError ? [{ key: 'ai-error', kind: 'error' as const, text: t(`ai.error.${aiError}` as MessageKey) }] : []),
  ];
}

/** Chiusura di un toast: l'errore AI si toglie dal controller, gli altri dallo workspace. */
export function toastTarget(key: string): { kind: 'ai' } | { kind: 'workspace'; id: number } {
  return key === 'ai-error' ? { kind: 'ai' } : { kind: 'workspace', id: Number(key.slice('ws-'.length)) };
}

/**
 * `beforeunload`: chiedere conferma (e intanto mettere al sicuro con `blur`) se il testo è solo in memoria.
 * Il reload protetto dell'aggiornamento PWA passa senza domanda quando tutto è già durevole: annullarlo
 * lascerebbe l'app in sola lettura; mentre il documento si mette ancora al sicuro l'avviso resta.
 */
export function unloadNeedsConfirm(state: Pick<WorkspaceState, 'doc' | 'drafts' | 'updateReady'>, aiPending: boolean): boolean {
  if (state.updateReady && !aiPending) return false;
  return (!!state.doc && state.doc.saveState !== 'saved') || state.drafts.length > 0 || aiPending;
}

/**
 * Riapertura dell'ultimo file della cartella, una volta a cartella pronta: il file se c'è ancora, altrimenti
 * (`draft`) solo se ha una bozza nel buffer di emergenza, unica strada per recuperarla.
 */
export function reopenPlan(last: string | null, files: readonly string[]): { kind: 'none' } | { kind: 'open'; path: string } | { kind: 'draft'; path: string } {
  if (!last) return { kind: 'none' };
  return files.includes(last) ? { kind: 'open', path: last } : { kind: 'draft', path: last };
}

/** Perché Cronologia non può aprirsi: nessun documento (regola «mai disabled»; vale in ogni modalità). */
export function historyBlocker(doc: WorkspaceState['doc'] | null): MessageKey | null {
  return doc ? null : 'toolbar.history.noDocument';
}

/** Perché la cartella non si può cambiare ora: un'altra è in apertura. */
export function folderBlocker(switchingFolder: boolean): MessageKey | null {
  return switchingFolder ? 'folder.opening' : null;
}
