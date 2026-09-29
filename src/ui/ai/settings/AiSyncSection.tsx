import { useEffect, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../../ai/aiController';
import { AiSync } from '../../../ai/aiSync';
import { hasAccess, pickFolder, requestAccess } from '../../../fs/access';
import { fsaOps } from '../../../fs/fsaOps';
import { useT } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { ConfirmDialog } from '../../ConfirmDialog';
import styles from './Settings.module.css';

export function useAiSync(controller: AiController | null) {
  const [sync, setSync] = useState<AiSync | null>(null);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [permission, setPermission] = useState(false);

  useEffect(() => {
    if (!controller) return;
    let alive = true;
    void controller.store
      .getMeta<FileSystemDirectoryHandle>('folderHandle')
      .then(async (h) => {
        if (alive && h) {
          setHandle(h);
          setPermission(await hasAccess(h));
        }
      })
      .catch((e) => controller.report(e));
    return () => {
      alive = false;
    };
  }, [controller]);

  useEffect(() => {
    if (!controller || !handle || !permission) {
      setSync(null);
      return;
    }
    const service = new AiSync({ store: controller.store, fs: fsaOps(handle) });
    setSync(service);
    controller.onSettingsChanged = () => service.localChanged();
    const unsub = service.subscribe(() => {
      if (service.getState().error === 'syncPermission') setPermission(false);
      if (service.getState().status !== 'syncing') void controller.reload().catch((e) => controller.report(e));
    });
    service.start();
    return () => {
      controller.onSettingsChanged = undefined;
      unsub();
      service.dispose();
    };
  }, [controller, handle, permission]);

  return {
    sync,
    handle,
    permission,
    async choose() {
      const h = await pickFolder();
      if (h && controller) {
        await controller.store.setMeta('folderHandle', h);
        setHandle(h);
        setPermission(true);
      }
    },
    async reactivate() {
      if (handle) setPermission(await requestAccess(handle));
    },
    async disable() {
      await controller?.store.setMeta('folderHandle', null);
      setHandle(null);
    },
  };
}

export type SyncBinding = ReturnType<typeof useAiSync>;

function SyncDetails({ sync, controller }: { sync: AiSync; controller: AiController }) {
  const t = useT();
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const [backups, setBackups] = useState<string[]>([]);
  const [restore, setRestore] = useState<{ path: string; profiles: number; presets: number } | null>(null);

  useEffect(() => {
    void sync
      .listBackups()
      .then(setBackups)
      .catch((e) => controller.report(e));
  }, [state.lastSync, sync]);

  return (
    <>
      <p className={styles.help}>
        {t(`ai.syncStatus.${state.status}` as MessageKey)} {state.lastSync ? new Date(state.lastSync).toLocaleString() : ''}
      </p>
      {state.error && <p className={styles.help}>{t(`ai.error.${state.error}` as MessageKey)}</p>}
      {state.conflicts.length > 0 && (
        <p className={styles.help}>
          {t('ai.syncConflict')}: {state.conflicts.join(', ')}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" disabled={state.status === 'syncing'} onClick={() => void sync.syncNow()}>
          {t('ai.syncNow')}
        </button>
      </div>
      <details>
        <summary>{t('ai.backups')}</summary>
        {backups.map((path) => (
          <p key={path} className={styles.help}>
            {path}
            <button
              type="button"
              onClick={() =>
                void sync
                  .backupCounts(path)
                  .then((counts) => setRestore({ path, ...counts }))
                  .catch((e) => controller.report(e))
              }
            >
              {t('ai.restoreBackup')}
            </button>
          </p>
        ))}
      </details>
      {restore && (
        <ConfirmDialog
          title={t('ai.restoreTitle')}
          message={t('ai.syncCounts', { profiles: restore.profiles, presets: restore.presets }) + '\n' + t('ai.syncRestoreWarning')}
          confirmLabel={t('ai.restoreBackup')}
          onConfirm={() => {
            const path = restore.path;
            setRestore(null);
            void sync
              .restore(path)
              .then(() => controller.reload())
              .catch((e) => controller.report(e));
          }}
          onCancel={() => setRestore(null)}
        />
      )}
    </>
  );
}

export function AiSyncSection({ binding, controller }: { binding: SyncBinding; controller: AiController }) {
  const t = useT();
  return (
    <div className={styles.detail}>
      <p className={styles.help}>{t('ai.syncNotice')}</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => void binding.choose().catch((e) => controller.report(e))}>
          {t('ai.syncChoose')}
        </button>
        {binding.handle && (
          <>
            <span>{binding.handle.name}</span>
            <button type="button" onClick={() => void binding.disable().catch((e) => controller.report(e))}>
              {t('ai.syncDisable')}
            </button>
            {!binding.permission && (
              <button type="button" onClick={() => void binding.reactivate().catch((e) => controller.report(e))}>
                {t('ai.syncReactivate')}
              </button>
            )}
          </>
        )}
      </div>
      {binding.sync && <SyncDetails sync={binding.sync} controller={controller} />}
    </div>
  );
}
