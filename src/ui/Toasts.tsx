import { useEffect, useRef } from 'react';

import { useT } from '../i18n/I18nProvider';
import type { Toast } from '../workspace/toasts';
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
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const open = el.matches(':popover-open');
    if (toasts.length > 0 && !open) el.showPopover();
    if (toasts.length === 0 && open) el.hidePopover();
  }, [toasts.length]);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.kind === 'info')
      .map((toast) => setTimeout(() => onDismiss(toast.id), INFO_TIMEOUT_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div ref={ref} {...manualPopover} className={styles.toasts}>
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <p>{t(`toast.${toast.code}`, toast.params)}</p>
          <button aria-label={t('toast.close')} title={t('toast.close')} onClick={() => onDismiss(toast.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
