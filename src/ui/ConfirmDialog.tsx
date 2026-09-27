import { useEffect, useRef } from 'react';

import styles from './Dialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const lightDismiss = { closedby: 'any' } as Record<string, string>;

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={ref} className={styles.dialog} {...lightDismiss} onClose={onCancel} aria-labelledby="confirm-dialog-title">
      <h2 id="confirm-dialog-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} autoFocus onClick={() => ref.current?.close()}>
          Annulla
        </button>
        <button type="button" className={styles.danger} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
