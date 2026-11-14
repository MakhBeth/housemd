import { el } from '../../dom/el';
import { pluralKey, type Locale } from '../../i18n/i18n';
import { uid } from '../../dom/uid';
import { openModal, type Translate } from './modal';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Etichetta del pulsante che conferma. */
  confirmLabel: string;
  /** Stile del pulsante di conferma: `danger` (default, azione distruttiva) o `primary`. */
  tone?: 'danger' | 'primary';
  t: Translate;
  signal?: AbortSignal;
}

/** Conferma di un'azione (era ConfirmDialog.tsx): `true` solo con il pulsante di conferma. */
export async function showConfirmDialog({ title, message, confirmLabel, tone = 'danger', t, signal }: ConfirmOptions): Promise<boolean> {
  const id = uid('confirm-dialog');
  const titleId = `${id}-title`;
  const confirm = el('button', { type: 'button', class: tone }, confirmLabel);
  const { dialog, closed } = openModal(
    { id, labelledBy: titleId, closedby: 'any', signal },
    el('h2', { id: titleId, class: 'title' }, title),
    el('p', { class: 'message' }, message),
    el(
      'div',
      { class: 'actions' },
      // La scelta sicura ha il focus: Invio non conferma per sbaglio.
      el('button', { type: 'button', class: 'secondary', autofocus: true, command: 'close', commandfor: id }, t('dialog.cancel')),
      confirm,
    ),
  );
  confirm.addEventListener('click', () => dialog.close('confirm'));
  return (await closed) === 'confirm';
}

/** «Scartare le modifiche?»: impostazioni (Chiudi/Indietro), cambio di profilo o di preset. */
export function showDiscardChangesDialog({ t, signal }: { t: Translate; signal?: AbortSignal }): Promise<boolean> {
  return showConfirmDialog({ title: t('ai.unsavedTitle'), message: t('ai.unsavedMessage'), confirmLabel: t('ai.discardChanges'), t, signal });
}

/** «Inviare i file a …?»: i file allegati escono dal computer verso un provider remoto. */
export function showSendContextDialog({ provider, folders, count, size, locale, t, signal }: { provider: string; locale: Locale; folders: string[]; count: number; size: string; t: Translate; signal?: AbortSignal }): Promise<boolean> {
  const summary = t(pluralKey(locale, 'ai.context.confirmSummary', count), { count, folders: folders.join(', ') });
  return showConfirmDialog({ title: t('ai.context.confirmTitle', { provider }), message: `${summary} (${size}) ${t('ai.context.confirmDetail')}`, confirmLabel: t('ai.context.confirmSend'), tone: 'primary', t, signal });
}
