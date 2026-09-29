// src/ui/ai/ReviewBar.tsx
import { useId } from 'react';

import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { Icon } from '../Icon';
import styles from './ReviewView.module.css';

interface Props {
  status: ReviewStatus;
  warnings: CheckWarning[];
  onPrevious: () => void;
  onNext: () => void;
  onWarning: (warning: CheckWarning) => void;
  canAccept: boolean;
  canDiscard: boolean;
  onAcceptAll: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}

const autoPopover = { popover: 'auto' } as Record<string, string>;

function StatusText({ status, onContinue }: { status: ReviewStatus; onContinue: () => void }) {
  const t = useT();
  switch (status.kind) {
    case 'none':
      return null;
    case 'generating':
      return (
        <span className={styles.status} aria-live="polite">
          {t('ai.generating', { seconds: status.seconds })}
          {status.total ? ` ${status.done}/${status.total}` : ''}
        </span>
      );
    case 'partial':
      return (
        <>
          <span className={styles.status}>{t('ai.status.partial')}</span>
          <button type="button" className={styles.secondary} onClick={onContinue}>
            {t('ai.continue')}
          </button>
        </>
      );
    case 'truncated':
      return <span className={styles.status}>{t('ai.status.truncated')}</span>;
    case 'scopeLost':
      return (
        <span className={styles.status} role="alert">
          {t('ai.error.scopeLost')}
        </span>
      );
    case 'applied':
      return <span className={styles.status}>{t('ai.applied')}</span>;
  }
}

export function ReviewBar(props: Props) {
  const t = useT();
  const id = useId();
  const busy = isBusy(props.status);
  return (
    <div className={styles.bar}>
      <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('ai.previous')} data-tooltip={t('ai.previous')} disabled={busy} onClick={props.onPrevious}>
        <Icon name="chevronUp" />
      </button>
      <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('ai.next')} data-tooltip={t('ai.next')} disabled={busy} onClick={props.onNext}>
        <Icon name="chevronDown" />
      </button>
      <StatusText status={props.status} onContinue={props.onContinue} />
      <span className={styles.spacer} />
      {props.warnings.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.secondary} tooltip`}
            aria-label={t('ai.warningsCount', { count: props.warnings.length })}
            data-tooltip={t('ai.warningsCount', { count: props.warnings.length })}
            {...{ popovertarget: id }}
          >
            <Icon name="warning" size={14} /> {props.warnings.length}
          </button>
          <div id={id} {...autoPopover} className={styles.warnings}>
            {props.warnings.map((w, i) => (
              <button key={i} type="button" onClick={() => props.onWarning(w)}>
                {t(`ai.warning.${w.code}` as MessageKey)}
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className={styles.secondary} disabled={!props.canDiscard} onClick={props.onDiscard}>
        {t('ai.discard')}
      </button>
      <button type="button" className={`${styles.secondary} ${styles.accept}`} disabled={!props.canAccept} onClick={props.onAcceptAll}>
        {t('ai.acceptAll')}
      </button>
    </div>
  );
}
