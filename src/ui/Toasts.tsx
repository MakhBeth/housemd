import { useEffect, useRef } from 'react';

import { useT } from '../i18n/I18nProvider';
import type { Toast } from '../workspace/toasts';
import { Icon } from './Icon';
import styles from './Toasts.module.css';

/** Un toast già tradotto: il Workspace e il controller AI hanno codici diversi, qui arriva solo testo. */
export interface ToastItem {
  key: string;
  kind: Toast['kind'];
  text: string;
}

interface Props {
  items: ToastItem[];
  onDismiss: (key: string) => void;
}

const INFO_TIMEOUT_MS = 6000;
/** `popover` come attributo: resta visibile finché non lo chiudiamo noi (popover="manual"). */
const manualPopover = { popover: 'manual' } as Record<string, string>;

export function Toasts({ items, onDismiss }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const open = el.matches(':popover-open');
    if (items.length > 0 && !open) el.showPopover();
    if (items.length === 0 && open) el.hidePopover();
  }, [items.length]);

  useEffect(() => {
    const timers = items
      .filter((item) => item.kind === 'info')
      .map((item) => setTimeout(() => onDismiss(item.key), INFO_TIMEOUT_MS));
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  return (
    <div ref={ref} {...manualPopover} className={styles.toasts}>
      {items.map((item) => (
        <div key={item.key} className={styles.toast} data-kind={item.kind} role={item.kind === 'error' ? 'alert' : 'status'}>
          <p>{item.text}</p>
          <button className="tooltip" aria-label={t('toast.close')} data-tooltip={t('toast.close')} onClick={() => onDismiss(item.key)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
