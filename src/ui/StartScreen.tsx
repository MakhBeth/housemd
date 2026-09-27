import styles from './StartScreen.module.css';

interface Props {
  mode: 'unsupported' | 'start' | 'resume';
  message?: string;
  folderName?: string;
  onPick?: () => void;
  onResume?: () => void;
}

export function StartScreen({ mode, message, folderName, onPick, onResume }: Props) {
  return (
    <main className={styles.start}>
      <div className={styles.panel}>
        <h1 className={styles.logo}>
          House<span>MD</span>
        </h1>
        <p className={styles.tagline}>
          Scrivi markdown nel browser, direttamente sui tuoi file. Niente server: la cartella resta sul tuo computer.
        </p>
        {message && <p className={styles.message}>{message}</p>}
        {mode === 'start' && (
          <button className={styles.primary} onClick={onPick}>
            Apri cartella
          </button>
        )}
        {mode === 'resume' && (
          <>
            <button className={styles.primary} onClick={onResume}>
              Riprendi accesso a “{folderName}”
            </button>
            <button className={styles.secondary} onClick={onPick}>
              Apri un'altra cartella
            </button>
          </>
        )}
      </div>
    </main>
  );
}
