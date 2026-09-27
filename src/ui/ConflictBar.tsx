import { useT } from '../i18n/I18nProvider';
import { Icon } from './Icon';
import styles from './WorkspaceView.module.css';

interface Props {
  onReload: () => void;
  onOverwrite: () => void;
}

export function ConflictBar({ onReload, onOverwrite }: Props) {
  const t = useT();
  return (
    <div className={styles.conflict} role="alert">
      <Icon name="warning" />
      <span>{t('conflict.message')}</span>
      <button onClick={onReload}>{t('conflict.reload')}</button>
      <button onClick={onOverwrite}>{t('conflict.overwrite')}</button>
    </div>
  );
}
