/**
 * Messaggi del Workspace: un codice chiuso più eventuali parametri. L'interfaccia li traduce con
 * `t('toast.' + code, params)`; i dettagli tecnici (errore del browser o del parser) viaggiano come
 * `detail` e restano in lingua originale.
 */
export const TOAST_CODES = [
  'saveFailed',
  'configInvalidJson',
  'configInvalidSaveTo',
  'configInvalidLinkPrefix',
  'restoredDraft',
  'restoredDraftDeleted',
  'deletedOutside',
  'unreadableFiles',
  'alreadyExists',
  'notFound',
  'operationFailed',
  'saveAllSkipped',
  'saveAllDone',
  'draftNotPersisted',
  'bufferFailed',
  'historyFailed',
  'restoreCancelled',
  'newVersion',
  'reloadOtherTabs',
  'openFolderFailed',
] as const;

export type ToastCode = (typeof TOAST_CODES)[number];
export type ToastParams = Readonly<Record<string, string | number>>;

export interface Toast {
  id: number;
  kind: 'error' | 'info';
  code: ToastCode;
  params?: ToastParams;
}

export function sameToast(a: Omit<Toast, 'id'>, b: Omit<Toast, 'id'>): boolean {
  return a.kind === b.kind && a.code === b.code && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
