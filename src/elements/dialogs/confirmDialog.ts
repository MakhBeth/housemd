import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { openModal, type Translate } from './modal';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Etichetta del pulsante che conferma (azione distruttiva: stile `danger`). */
  confirmLabel: string;
  t: Translate;
  signal?: AbortSignal;
}

/** Conferma di un'azione (era ConfirmDialog.tsx): `true` solo con il pulsante di conferma. */
export async function showConfirmDialog({ title, message, confirmLabel, t, signal }: ConfirmOptions): Promise<boolean> {
  const id = uid('confirm-dialog');
  const titleId = `${id}-title`;
  const confirm = el('button', { type: 'button', class: 'danger' }, confirmLabel);
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
