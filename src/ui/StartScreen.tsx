import type { UnsupportedReason } from '../fs/access';
import { useT } from '../i18n/I18nProvider';
import { LOGO } from './logo';
import styles from './StartScreen.module.css';

interface Props {
  mode: 'unsupported' | 'start' | 'resume';
  reason?: UnsupportedReason;
  /** Dettaglio tecnico dell'ultimo errore di apertura (resta in lingua originale). */
  error?: string;
  folderName?: string;
  onPick?: () => void;
  onResume?: () => void;
}

export function StartScreen({ mode, reason, error, folderName, onPick, onResume }: Props) {
  const t = useT();
  const message =
    mode === 'unsupported'
      ? t(`unsupported.${reason ?? 'other'}`)
      : error !== undefined
        ? t('start.openError', { detail: error })
        : null;
  return (
    <main className={styles.start}>
      <div className={styles.panel}>
        <h1 className={styles.visuallyHidden}>{t('app.name')}</h1>
        <pre className={styles.logo} aria-hidden="true">
          {LOGO}
        </pre>
        <p className={styles.tagline}>{t('start.tagline')}</p>
        {message && <p className={styles.message}>{message}</p>}
        {mode === 'start' && (
          <button className={styles.primary} onClick={onPick}>
            {t('start.openFolder')}
          </button>
        )}
        {mode === 'resume' && (
          <>
            <button className={styles.primary} onClick={onResume}>
              {t('start.resume', { folder: folderName ?? '' })}
            </button>
            <button className={styles.secondary} onClick={onPick}>
              {t('start.openOther')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
