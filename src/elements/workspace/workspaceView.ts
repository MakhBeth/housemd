import type { AiErrorCode } from '../../ai/types';
import type { AiErrorOrigin } from '../../ai/aiController';
import type { MessageKey } from '../../i18n/messages';
import type { Locale, Params } from '../../i18n/i18n';
import { isClosable, NOTICE_CHANNEL, noticeKey, type ToastCode } from '../../workspace/toasts';
import type { WorkspaceState } from '../../workspace/workspace';
import type { BannerItem } from '../banner/banner.element';
import type { Mode } from './layout';

/** La vista mostrata: con la preferenza «AI» ma il controller non ancora pronto (IndexedDB lento), la divisa. */
export function shownMode(mode: Mode, hasAi: boolean): Mode {
  return mode === 'ai' && !hasAi ? 'split' : mode;
}

/** Chiave della sessione dell'editor e del `resetKey`: cambia con il file o con una revisione nuova. */
export function docKey(doc: Pick<NonNullable<WorkspaceState['doc']>, 'path' | 'revision'> | null): string {
  return `${doc?.path}#${doc?.revision}`;
}

/** Esiti AI «preventivi» o volontari: il comando non è partito o è stato annullato dall'utente (`status`); gli altri sono errori effettivi (`alert`). */
const AI_STATUS: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['aborted', 'scopeLost', 'aiPendingUpdate', 'syncLocked']);

export function aiErrorKind(code: AiErrorCode): BannerItem['kind'] {
  return AI_STATUS.has(code) ? 'status' : 'alert';
}

/** Chiave del banner per l'errore AI: un altro codice sostituisce la riga, lo stesso non la ricrea. */
export const AI_ERROR_PREFIX = 'ai-error-';

/**
 * Errore AI non legato a un messaggio (sync, chiave, selezione persa, inizializzazione): riga del banner workspace,
 * chiudibile. `AiState.errorOrigin` dice da quale azione nasce e quale elemento ne mostra la nota: finché è nel documento
 * il banner tace. Gli errori senza nota locale (sync in background, inizializzazione) vanno qui; i messaggi in chat
 * restano nel registro della chat.
 */
export function aiErrorItems(
  aiError: AiErrorCode | null | undefined,
  origin: AiErrorOrigin | null | undefined,
  t: (key: MessageKey, params?: Params) => string,
): BannerItem[] {
  // Con l'origine visibile l'errore sta nella sua nota locale: il banner è solo il ripiego per l'origine nascosta.
  return aiError && !origin?.anchor?.isConnected
    ? [{ key: `${AI_ERROR_PREFIX}${aiError}`, kind: aiErrorKind(aiError), text: t(`ai.error.${aiError}` as MessageKey), closeLabel: t('toast.close') }]
    : [];
}

/** Dove sta un messaggio: i banner di documento e workspace, le note locali accanto all'azione, la riga nel dialog attivo. */
export interface NoticeRoutes {
  document: BannerItem[];
  workspace: BannerItem[];
  /** Salva tutto: esiti del lotto. */
  saveAll: BannerItem[];
  /** Albero e Apri cartella (solo con la sidebar aperta). */
  sidebar: BannerItem[];
  /** Cronologia e Ripristina. */
  history: BannerItem[];
  /** Dentro il pannello cronologia aperto: esiti di lettura e ripristino del suo documento. */
  historyPanel: BannerItem[];
  /** Nelle impostazioni aperte: esito di Salva tutto partito da lì. */
  settings: BannerItem[];
  /** Eventi a rischio dati con un dialog modale aperto: riga `alert` dentro il dialog. */
  dialog: BannerItem[];
  /** ID già annunciati nel dialog: le loro righe restano visibili ma mute. */
  announcedInDialog: number[];
  /** ID degli eventi differiti (non a rischio dati, arrivati con un dialog aperto): un solo riepilogo polite alla chiusura. */
  deferred: number[];
}

export interface NoticeContext {
  sidebarOpen: boolean;
  dialogOpen: boolean;
  /** ID già annunciati nel dialog o riepilogati: righe mute. */
  silenced: ReadonlySet<number>;
  /** ID già presenti all'apertura del dialog: già annunciati, né riga nel dialog né riepilogo. */
  known?: ReadonlySet<number>;
  /** Documento di cui il pannello cronologia è aperto (null = chiuso). */
  historyPath?: string | null;
  settingsOpen?: boolean;
}

const DIALOG_ALERT: ReadonlySet<ToastCode> = new Set<ToastCode>(['saveFailed', 'bufferFailed', 'draftNotPersisted', 'deletedOutside', 'restoredDraftDeleted']);

/**
 * Destinazione di ogni messaggio del registro del workspace. Il canale documento mostra solo gli esiti del
 * documento attivo; se il documento non è più quello, l'esito passa al banner del workspace con il percorso
 * (mai attribuito al nuovo documento). Le note locali stanno accanto all'azione: Salva tutto (esiti del lotto e
 * copia d'emergenza del lotto), albero e Apri cartella (solo con la sidebar aperta, altrimenti il banner del
 * workspace), Cronologia e Ripristina. Con un dialog modale aperto gli eventi a rischio dati sono una riga
 * `alert` nel dialog, l'unico canale live dell'evento: il banner conserva la riga ma muta; gli altri eventi
 * si differiscono in un solo riepilogo alla chiusura. I messaggi senza «Chiudi» sono quelli a rischio dati.
 */
export function noticeRoutes(
  toasts: WorkspaceState['toasts'],
  docPath: string | null,
  t: (key: MessageKey, params?: Params) => string,
  locale: Locale,
  /** L'indicatore di salvataggio annuncia già `save.error`/`save.deleted`: le due righe corrispondenti restano visibili ma mute. */
  indicatorSpeaks: boolean,
  context: NoticeContext,
): NoticeRoutes {
  const out: NoticeRoutes = { document: [], workspace: [], saveAll: [], sidebar: [], history: [], historyPanel: [], settings: [], dialog: [], announcedInDialog: [], deferred: [] };
  for (const toast of toasts) {
    const channel = NOTICE_CHANNEL[toast.code];
    if (channel === 'app') continue;
    const text = t(noticeKey(toast.code, toast.params, locale) as MessageKey, toast.params);
    const origin = toast.origin;
    // Un'immagine fallita appartiene al documento in cui la si inseriva, non al messaggio di workspace che la descrive.
    const documentBound = channel === 'document' || origin?.action === 'image';
    const here = documentBound && toast.path === docPath;
    let slot: 'document' | 'workspace' | 'saveAll' | 'sidebar' | 'history' | 'historyPanel' | 'settings' = here ? 'document' : 'workspace';
    if (toast.code === 'saveAllSkipped' || toast.code === 'saveAllDone' || (toast.code === 'bufferFailed' && toast.path === undefined)) slot = 'saveAll';
    else if (context.sidebarOpen && (toast.code === 'openFolderFailed' || toast.code === 'alreadyExists' || toast.code === 'notFound')) slot = 'sidebar';
    else if (toast.code === 'historyFailed' || toast.code === 'restoreCancelled') slot = 'history';
    // L'azione di origine decide dove l'esito si legge: nel pannello cronologia aperto sul suo documento, accanto al Salva tutto delle impostazioni.
    if ((origin?.action === 'history' || origin?.action === 'restore') && origin.path === context.historyPath) slot = 'historyPanel';
    else if (origin?.action === 'saveAllSettings' && context.settingsOpen) slot = 'settings';
    const shown = slot === 'workspace' && documentBound && toast.path ? `${toast.path}: ${text}` : text;
    const known = context.known?.has(toast.id) ?? false;
    const toDialog = context.dialogOpen && !known && DIALOG_ALERT.has(toast.code);
    const deferred = context.dialogOpen && !known && !toDialog && !context.silenced.has(toast.id);
    if (toDialog) {
      out.dialog.push({ key: `ws-${toast.id}`, kind: 'alert', text: shown });
      out.announcedInDialog.push(toast.id);
    }
    if (deferred) out.deferred.push(toast.id);
    out[slot].push({
      key: `ws-${toast.id}`,
      kind: toast.kind === 'error' ? 'alert' : 'status',
      text: shown,
      closeLabel: isClosable(toast.code) ? t('toast.close') : undefined,
      quiet:
        toDialog ||
        deferred ||
        context.silenced.has(toast.id) ||
        (here && indicatorSpeaks && (toast.code === 'saveFailed' || toast.code === 'deletedOutside')),
    });
  }
  return out;
}

/** Chiusura di un messaggio: l'errore AI si toglie dal controller, gli altri dallo workspace. */
export function toastTarget(key: string): { kind: 'ai' } | { kind: 'workspace'; id: number } {
  return key.startsWith(AI_ERROR_PREFIX) ? { kind: 'ai' } : { kind: 'workspace', id: Number(key.slice('ws-'.length)) };
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
