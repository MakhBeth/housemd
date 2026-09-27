import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useT } from '../i18n/I18nProvider';
import { validateName } from './names';
import styles from './Dialog.module.css';

interface Props {
  title: string;
  kind: 'file' | 'directory';
  initial: string;
  confirmLabel: string;
  /** Controllo aggiuntivo (es. nome già esistente): messaggio d'errore oppure null. */
  validate: (name: string) => string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/** `closedby` non è ancora nei tipi di React 18: lo passiamo come attributo. */
const lightDismiss = { closedby: 'any' } as Record<string, string>;

export function NameDialog({ title, kind, initial, confirmLabel, validate, onSubmit, onCancel }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const input = dialog.querySelector('input');
    const dot = initial.lastIndexOf('.');
    input?.setSelectionRange(0, kind === 'file' && dot > 0 ? dot : initial.length);
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateName(value, kind);
    if ('error' in result) {
      setError(t(`name.error.${result.error}`));
      return;
    }
    const problem = validate(result.name);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(result.name);
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      {...lightDismiss}
      onClose={() => {
        // In React StrictMode l'effetto viene rimontato: la chiusura "fantasma" della prima
        // esecuzione arriva quando il dialog è già stato riaperto dalla seconda.
        if (!ref.current?.open) onCancel();
      }}
      aria-labelledby="name-dialog-title"
    >
      <form onSubmit={submit}>
        <h2 id="name-dialog-title" className={styles.title}>
          {title}
        </h2>
        <input
          className={styles.input}
          value={value}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? 'name-dialog-error' : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id="name-dialog-error" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => ref.current?.close()}>
            Annulla
          </button>
          <button type="submit" className={styles.primary}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
