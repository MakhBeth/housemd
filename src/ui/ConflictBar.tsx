import styles from './WorkspaceView.module.css';

interface Props {
  onReload: () => void;
  onOverwrite: () => void;
}

export function ConflictBar({ onReload, onOverwrite }: Props) {
  return (
    <div className={styles.conflict} role="alert">
      <span>Il file è cambiato su disco mentre avevi modifiche non salvate.</span>
      <button onClick={onReload}>Ricarica dal disco</button>
      <button onClick={onOverwrite}>Sovrascrivi con le mie modifiche</button>
    </div>
  );
}
