import { useEffect, useRef } from 'react';

import { Icon } from './Icon';
import styles from './Notice.module.css';

interface Props {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Azione in corso: il pulsante resta disabilitato. */
  busy?: boolean;
  dismissLabel: string;
  onDismiss?: () => void;
  /** Due avvisi insieme non si sovrappongono: uno in alto, uno in basso. */
  placement?: 'top' | 'bottom';
}

const manualPopover = { popover: 'manual' } as Record<string, string>;

/** Avviso persistente a sinistra (non scompare da solo), anche fuori dal workspace. */
export function Notice({ message, actionLabel, onAction, busy, dismissLabel, onDismiss, placement = 'bottom' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    if (!el.matches(':popover-open')) el.showPopover();
    return () => {
      if (el.matches(':popover-open')) el.hidePopover();
    };
  }, []);

  return (
    <div ref={ref} {...manualPopover} className={styles.notice} data-placement={placement} role="status">
      <p>{message}</p>
      {actionLabel && (
        <button className={styles.action} onClick={onAction} disabled={busy}>
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button className={`${styles.dismiss} tooltip`} onClick={onDismiss} aria-label={dismissLabel} data-tooltip={dismissLabel}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
