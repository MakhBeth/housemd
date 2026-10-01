import type { UnsupportedReason } from '../fs/access';
import { useT } from '../i18n/I18nProvider';
import { LOGO, LOGO_INVERTED, WORDMARK } from './logo';
import styles from './StartScreen.module.css';

interface Props {
  mode: 'unsupported' | 'start' | 'resume';
  reason?: UnsupportedReason;
  /** Dettaglio tecnico dell'ultimo errore di apertura (resta in lingua originale). */
  error?: string;
  folderName?: string;
  onPick?: () => void;
  onResume?: () => void;
  /** Apertura di una cartella in corso: i pulsanti restano disattivati finché non finisce. */
  busy?: boolean;
}

export function StartScreen({ mode, reason, error, folderName, onPick, onResume, busy = false }: Props) {
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
        <pre className={`${styles.logo} ${styles.logoDark}`} aria-hidden="true">
          {LOGO}
        </pre>
        <pre className={`${styles.logo} ${styles.logoLight}`} aria-hidden="true">
          {LOGO_INVERTED}
        </pre>
        <pre className={`${styles.logo} ${styles.wordmark}`} aria-hidden="true">
          {WORDMARK}
        </pre>
        <p className={styles.tagline}>{t('start.tagline')}</p>
        {message && <p className={styles.message}>{message}</p>}
        {mode === 'start' && (
          <button className={styles.primary} onClick={onPick} disabled={busy}>
            {t('start.openFolder')}
          </button>
        )}
        {mode === 'resume' && (
          <>
            <button className={styles.primary} onClick={onResume} disabled={busy}>
              {t('start.resume', { folder: folderName ?? '' })}
            </button>
            <button className={styles.secondary} onClick={onPick} disabled={busy}>
              {t('start.openOther')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
