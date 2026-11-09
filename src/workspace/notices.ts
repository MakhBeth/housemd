import { pluralKey, type Locale } from '../i18n/i18n';

/**
 * Messaggi del Workspace: un codice chiuso più eventuali parametri. L'interfaccia li traduce con
 * `t('notice.' + code, params)`; i dettagli tecnici (errore del browser o del parser) viaggiano come
 * `detail` e restano in lingua originale.
 */
export const NOTICE_CODES = [
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

export type NoticeCode = (typeof NOTICE_CODES)[number];
export type NoticeParams = Readonly<Record<string, string | number>>;

/** Azione da cui nasce un messaggio, per metterlo dove l'utente l'ha avviata (pannello cronologia, impostazioni, documento). */
export type NoticeAction = 'restore' | 'history' | 'saveAll' | 'saveAllSettings' | 'image';

export interface Notice {
  id: number;
  /** `error` → riga `alert`, `info` → riga `status`. */
  kind: 'error' | 'info';
  code: NoticeCode;
  params?: NoticeParams;
  /** Documento di origine (solo i messaggi del canale documento): un altro documento attivo non se li prende. */
  path?: string;
  /** Azione di origine e documento su cui è partita (catturato prima di ogni `await`), se serve alla destinazione. */
  origin?: { action: NoticeAction; path?: string };
}

/** Dove compare un messaggio: sopra il documento, sotto la toolbar del workspace, in cima all'app. */
export type NoticeChannel = 'document' | 'workspace' | 'app';

export const NOTICE_CHANNEL: Readonly<Record<NoticeCode, NoticeChannel>> = {
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
const DATA_RISK: ReadonlySet<NoticeCode> = new Set(['saveFailed', 'bufferFailed', 'draftNotPersisted', 'deletedOutside']);

export function isClosable(code: NoticeCode): boolean {
  return !DATA_RISK.has(code);
}

/** Chiave del catalogo: i messaggi con un conteggio hanno le forme `.one` e `.other`. */
export function noticeKey(code: NoticeCode, params: NoticeParams | undefined, locale: Locale): string {
  if (code === 'unreadableFiles' || code === 'saveAllSkipped') return pluralKey(locale, `notice.${code}`, Number(params?.count ?? 0));
  return `notice.${code}`;
}

export function sameNotice(a: Omit<Notice, 'id'>, b: Omit<Notice, 'id'>): boolean {
  return a.kind === b.kind && a.code === b.code && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
