import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { validateName } from '../../ui/names';
import { openModal, type Translate } from './modal';

export interface NameOptions {
  title: string;
  kind: 'file' | 'directory';
  initial: string;
  confirmLabel: string;
  /** Controllo aggiuntivo sul nome già normalizzato (es. già esistente): messaggio tradotto oppure null. */
  validate: (name: string) => string | null;
  t: Translate;
  signal?: AbortSignal;
}

/** Nome di un file o di una cartella (era NameDialog.tsx): il nome valido, o null se si annulla. */
export async function showNameDialog({ title, kind, initial, confirmLabel, validate, t, signal }: NameOptions): Promise<string | null> {
  const id = uid('name-dialog');
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  let result: string | null = null;

  const input = el('input', { class: 'input', value: initial, autofocus: true, autocomplete: 'off', 'aria-invalid': false });
  // Assegnata a parte: el() non scrive un booleano su una proprietà che il DOM (jsdom) non espone.
  input.spellcheck = false;
  const error = el('p', { id: errorId, class: 'error' });
  const showError = (message: string | null) => {
    input.setAttribute('aria-invalid', String(message !== null));
    if (message === null) {
      input.removeAttribute('aria-describedby');
      error.remove();
      return;
    }
    error.textContent = message;
    input.setAttribute('aria-describedby', errorId);
    if (!error.isConnected) input.after(error);
  };
  input.addEventListener('input', () => showError(null));

  const form = el(
    'form',
    null,
    el('h2', { id: titleId, class: 'title' }, title),
    input,
    el(
      'div',
      { class: 'actions' },
      el('button', { type: 'button', class: 'secondary', command: 'close', commandfor: id }, t('dialog.cancel')),
      el('button', { type: 'submit', class: 'primary' }, confirmLabel),
    ),
  );
  const { dialog, closed } = openModal({ id, labelledBy: titleId, closedby: 'any', signal }, form);
  if (!dialog.isConnected) return null; // signal già interrotto

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = validateName(input.value, kind);
    if ('error' in checked) return showError(t(`name.error.${checked.error}`));
    const problem = validate(checked.name);
    if (problem) return showError(problem);
    result = checked.name;
    dialog.close('ok');
  });

  // Di un file si seleziona il nome senza estensione, così scrivere lo sostituisce lasciando ".md".
  const dot = initial.lastIndexOf('.');
  input.setSelectionRange(0, kind === 'file' && dot > 0 ? dot : initial.length);

  // Un abort arrivato tra il submit e l'evento close risolve '' (vedi openModal): nome scartato.
  return (await closed) === 'ok' ? result : null;
}
