import { el, type Child } from '../../dom/el';
import type { Params } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';
import './dialogs.css';

/** `t()` passato dal chiamante (React: `useT()`; elementi: `i18n.t`). */
export type Translate = (key: MessageKey, params?: Params) => string;

export interface ModalOptions {
  /** Id del dialog (bersaglio di `commandfor` dei pulsanti «Annulla»). */
  id?: string;
  /** Classe in più oltre a `hmd-dialog` (es. `access`). */
  variant?: string;
  /** Id del titolo dentro `children`. */
  labelledBy: string;
  /** `any`: Esc e clic fuori chiudono; `none`: solo il codice. */
  closedby: 'any' | 'none';
  /** Interrotto: il dialog si chiude e `closed` si risolve con ''. */
  signal?: AbortSignal;
  /** Dopo una chiusura non chiesta dal codice, `true` lo riapre (accesso perso). Ignorato dopo un abort. */
  reopen?: () => boolean;
}

/**
 * Dialog modale aggiunto a `document.body` (spec WC §5.4). `closed` si risolve con `returnValue`
 * all'evento `close`, **dopo** il quale il dialog si rimuove: chiudere prima di staccare fa tornare il
 * focus all'elemento che l'aveva prima di `showModal()`.
 */
export function openModal(options: ModalOptions, ...children: Child[]): { dialog: HTMLDialogElement; closed: Promise<string> } {
  const { id, variant, labelledBy, closedby, signal, reopen } = options;
  const dialog = el('dialog', { id, class: variant ? `hmd-dialog ${variant}` : 'hmd-dialog', 'aria-labelledby': labelledBy, closedby }, ...children);
  if (signal?.aborted) return { dialog, closed: Promise.resolve('') };

  let aborted = false;
  const onAbort = () => {
    aborted = true;
    dialog.close('');
  };
  const closed = new Promise<string>((resolve) => {
    const onClose = () => {
      if (!aborted && reopen?.() && dialog.isConnected) {
        dialog.showModal();
        return;
      }
      dialog.removeEventListener('close', onClose);
      signal?.removeEventListener('abort', onAbort);
      dialog.remove();
      resolve(aborted ? '' : dialog.returnValue);
    };
    dialog.addEventListener('close', onClose);
  });
  signal?.addEventListener('abort', onAbort, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, closed };
}
