import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { openModal, type Translate } from './modal';

export interface AccessLostOptions {
  folderName: string;
  /** Chiede di nuovo il permesso (con il gesto dell'utente) e riprende il workspace: true se concesso. */
  onResume: () => Promise<boolean>;
  t: Translate;
  signal?: AbortSignal;
}

/**
 * Dialog bloccante dell'accesso perso (era AccessLostDialog in WorkspaceView.tsx): niente Esc, niente
 * clic fuori; si chiude solo con l'accesso concesso (o con l'abort di chi l'ha aperto).
 */
export async function showAccessLostDialog({ folderName, onResume, t, signal }: AccessLostOptions): Promise<void> {
  const titleId = uid('access-title');
  let granted = false;
  const denied = el('p', { class: 'access-error' }, t('access.denied'));
  const resume = el('button', { class: 'resume' }, t('access.resume'));
  const { dialog, closed } = openModal(
    // closedby="none" dovrebbe già impedire ogni chiusura non voluta: reopen è il ripiego.
    { variant: 'access', labelledBy: titleId, closedby: 'none', signal, reopen: () => !granted },
    el('h2', { id: titleId }, t('access.title')),
    el('p', null, t('access.body', { folder: folderName })),
    resume,
  );
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  resume.addEventListener('click', async () => {
    denied.remove();
    try {
      granted = await onResume();
    } catch {
      granted = false;
    }
    if (granted) dialog.close();
    else if (dialog.isConnected) resume.before(denied);
  });
  await closed;
}
