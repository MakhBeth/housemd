import { pluralKey, type Locale } from '../i18n/i18n';

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
  /** `error` → riga `alert`, `info` → riga `status`. */
  kind: 'error' | 'info';
  code: ToastCode;
  params?: ToastParams;
  /** Documento di origine (solo i messaggi del canale documento): un altro documento attivo non se li prende. */
  path?: string;
}

/** Dove compare un messaggio: sopra il documento, sotto la toolbar del workspace, in cima all'app. */
export type NoticeChannel = 'document' | 'workspace' | 'app';

export const NOTICE_CHANNEL: Readonly<Record<ToastCode, NoticeChannel>> = {
  saveFailed: 'document',
  configInvalidJson: 'workspace',
  configInvalidSaveTo: 'workspace',
  configInvalidLinkPrefix: 'workspace',
  restoredDraft: 'document',
  restoredDraftDeleted: 'document',
  deletedOutside: 'document',
  unreadableFiles: 'workspace',
  alreadyExists: 'workspace',
  notFound: 'workspace',
  operationFailed: 'workspace',
  saveAllSkipped: 'workspace',
  saveAllDone: 'workspace',
  draftNotPersisted: 'document',
  bufferFailed: 'document',
  historyFailed: 'workspace',
  restoreCancelled: 'workspace',
  newVersion: 'app',
  reloadOtherTabs: 'app',
  openFolderFailed: 'workspace',
};

/** Rischio dati: restano finché il flusso esistente non li risolve, senza «Chiudi». */
const DATA_RISK: ReadonlySet<ToastCode> = new Set(['saveFailed', 'bufferFailed', 'draftNotPersisted', 'deletedOutside']);

export function isClosable(code: ToastCode): boolean {
  return !DATA_RISK.has(code);
}

/** Chiave del catalogo: i messaggi con un conteggio hanno le forme `.one` e `.other`. */
export function noticeKey(code: ToastCode, params: ToastParams | undefined, locale: Locale): string {
  if (code === 'unreadableFiles' || code === 'saveAllSkipped') return pluralKey(locale, `toast.${code}`, Number(params?.count ?? 0));
  return `toast.${code}`;
}

export function sameToast(a: Omit<Toast, 'id'>, b: Omit<Toast, 'id'>): boolean {
  return a.kind === b.kind && a.code === b.code && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
