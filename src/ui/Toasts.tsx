import { useEffect, useRef } from 'react';

import type { Toast } from '../workspace/workspace';
import { Icon } from './Icon';
import styles from './Toasts.module.css';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const INFO_TIMEOUT_MS = 6000;
/** `popover` come attributo: resta visibile finché non lo chiudiamo noi (popover="manual"). */
const manualPopover = { popover: 'manual' } as Record<string, string>;

export function Toasts({ toasts, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const open = el.matches(':popover-open');
    if (toasts.length > 0 && !open) el.showPopover();
    if (toasts.length === 0 && open) el.hidePopover();
  }, [toasts.length]);

  useEffect(() => {
    const timers = toasts
      .filter((t) => t.kind === 'info')
      .map((t) => setTimeout(() => onDismiss(t.id), INFO_TIMEOUT_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div ref={ref} {...manualPopover} className={styles.toasts}>
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <p>{toast.message}</p>
          <button aria-label="Chiudi" onClick={() => onDismiss(toast.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
