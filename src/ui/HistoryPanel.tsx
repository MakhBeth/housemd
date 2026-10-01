import { useEffect, useMemo, useState } from 'react';

import { diffRows, isIdentical } from '../history/diffRows';
import type { Snapshot } from '../history/historyStore';
import { formatRelative } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nProvider';
import type { Workspace } from '../workspace/workspace';
import { Icon } from './Icon';
import { useWorkspaceState } from './useWorkspace';
import styles from './HistoryPanel.module.css';

interface Props {
  workspace: Workspace;
  path: string;
  currentText: string;
  /** "Ripristina": deve arrivare all'editor come transazione (vedi WorkspaceView). */
  onRestore: (id: number) => void;
  onClose: () => void;
}

const MARK = { added: '+ ', removed: '− ', same: '  ' } as const;

export function HistoryPanel({ workspace, path, currentText, onRestore, onClose }: Props) {
  const { t, locale } = useI18n();
  // indexRevision aumenta a ogni salvataggio: la lista si aggiorna con lo snapshot appena scritto.
  const { indexRevision } = useWorkspaceState(workspace);
  const [versions, setVersions] = useState<Snapshot[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // Cambio di file: la lista del file precedente non deve restare visibile mentre arriva quella
  // nuova (torna allo stato di caricamento finché listHistory non risponde per il nuovo path).
  useEffect(() => {
    setVersions(null);
    setSelected(null);
  }, [path]);

  useEffect(() => {
    let alive = true;
    void workspace.listHistory(path).then((list) => {
      if (alive) setVersions(list);
    });
    return () => {
      alive = false;
    };
  }, [workspace, path, indexRevision]);

  const version = versions?.find((v) => v.id === selected) ?? null;
  const rows = useMemo(() => (version ? diffRows(currentText, version.text) : []), [version, currentText]);
  const now = new Date();

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('history.title', { path })}</h2>
        <button className={`${styles.close} tooltip`} onClick={onClose} aria-label={t('history.close')} data-tooltip={t('history.close')}>
          <Icon name="close" />
        </button>
      </header>
      {versions !== null && versions.length === 0 && <p className={styles.note}>{t('history.empty')}</p>}
      <ul className={styles.list} aria-busy={versions === null}>
        {versions === null ? (
          <li className={styles.note}>{t('history.loading')}</li>
        ) : (
          versions.map((v) => (
            <li key={v.id}>
              <button className={styles.version} aria-pressed={v.id === selected} onClick={() => setSelected(v.id)}>
                <span>{formatRelative(locale, new Date(v.savedAt), now)}</span>
                <span className={styles.reason}>{t(`history.reason.${v.reason}`)}</span>
              </button>
            </li>
          ))
        )}
      </ul>
      <section className={styles.diff}>
        {!version ? (
          <p className={styles.note}>{t('history.pick')}</p>
        ) : isIdentical(rows) ? (
          <p className={styles.note}>{t('history.identical')}</p>
        ) : (
          <>
            <p className={styles.note}>{t('history.legend')}</p>
            <pre className={styles.lines}>
              {rows.map((row, index) => (
                <span key={index} className={styles.line} data-kind={row.kind}>
                  {MARK[row.kind]}
                  {row.text}
                  {'\n'}
                </span>
              ))}
            </pre>
            <button className={styles.restore} onClick={() => onRestore(version.id)}>
              {t('history.restore')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
