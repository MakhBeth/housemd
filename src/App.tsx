import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedReason } from './fs/access';
import { fsaOps } from './fs/fsaOps';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from './fs/handleStore';
import { createWorkspaceFS } from './fs/workspaceFS';
import { switchFolder } from './app/switchFolder';
import { useT } from './i18n/I18nProvider';
import { onDbBlocked } from './lib/db';
import { readValidPref } from './lib/prefs';
import { Notice } from './ui/Notice';
import { StartScreen } from './ui/StartScreen';
import { WorkspaceView } from './ui/WorkspaceView';
import { indexedDbBufferStore } from './workspace/buffers';
import { parseAutosave } from './workspace/autosave';
import { Workspace } from './workspace/workspace';

type Screen =
  | { kind: 'boot' }
  | { kind: 'unsupported' }
  | { kind: 'start'; error?: string }
  | { kind: 'resume'; stored: StoredWorkspace }
  | { kind: 'open'; stored: StoredWorkspace; workspace: Workspace };

const buffers = indexedDbBufferStore();

async function openWorkspace(stored: StoredWorkspace): Promise<Workspace> {
  const workspace = new Workspace({
    fs: createWorkspaceFS(fsaOps(stored.handle)),
    workspaceId: stored.workspaceId,
    name: stored.handle.name,
    buffers,
    autosave: readValidPref('autosave', parseAutosave),
  });
  await workspace.load();
  return workspace;
}

export default function App() {
  const t = useT();
  const [dbBlocked, setDbBlocked] = useState(false);
  useEffect(() => onDbBlocked(() => setDbBlocked(true)), []);

  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  // Incrementato a ogni apertura riuscita: entra nella key di WorkspaceView così che riaprire la
  // STESSA cartella (stesso workspaceId) forzi comunque lo smontaggio/rimontaggio del componente,
  // invece di lasciarne leaked lo stato interno (es. `reopened`).
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!isSupported()) {
      setScreen({ kind: 'unsupported' });
      return;
    }
    let alive = true;
    void (async () => {
      const stored = await loadWorkspace().catch(() => null);
      if (!alive) return;
      if (!stored) {
        setScreen({ kind: 'start' });
        return;
      }
      if (!(await hasAccess(stored.handle))) {
        if (alive) setScreen({ kind: 'resume', stored });
        return;
      }
      const workspace = await openWorkspace(stored);
      if (alive) {
        setOpenCount((c) => c + 1);
        setScreen({ kind: 'open', stored, workspace });
      } else workspace.dispose();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const choose = useCallback(async () => {
    const current = screen.kind === 'open' ? screen.workspace : null;
    const result = await switchFolder({
      pick: pickFolder,
      current,
      open: async (handle: FileSystemDirectoryHandle) => {
        // Se è una cartella già aperta in passato (non solo l'ultima: anche A → B → A), si mantiene
        // lo stesso workspaceId: altrimenti buffer di emergenza e "ultimo file aperto" salvati per
        // quella cartella resterebbero orfani, agganciati a un id ormai abbandonato.
        const workspaceId = (await findKnownWorkspaceId(handle).catch(() => null)) ?? undefined;
        const stored = await saveWorkspace(handle, undefined, workspaceId);
        return { stored, workspace: await openWorkspace(stored) };
      },
      // La cartella vecchia non si è potuta lasciare (modifiche arrivate durante l'apertura e non
      // messe al sicuro): si resta lì e quella nuova, già caricata, si butta.
      discard: ({ workspace }) => workspace.dispose(),
    });
    switch (result.kind) {
      case 'opened':
        setOpenCount((c) => c + 1);
        setScreen({ kind: 'open', ...result.value });
        break;
      case 'error':
        // Con una cartella aperta si resta lì e l'errore compare come toast; dall'avvio, come prima.
        if (current) current.reportFolderError(result.detail);
        else setScreen({ kind: 'start', error: result.detail });
        break;
      case 'cancelled':
      case 'blocked':
        break;
    }
  }, [screen]);

  const resume = useCallback(async () => {
    if (screen.kind !== 'resume') return;
    if (!(await requestAccess(screen.stored.handle))) return;
    const workspace = await openWorkspace(screen.stored);
    setOpenCount((c) => c + 1);
    setScreen({ kind: 'open', stored: screen.stored, workspace });
  }, [screen]);

  let content: ReactNode = null;
  switch (screen.kind) {
    case 'boot':
      break;
    case 'unsupported':
      content = <StartScreen mode="unsupported" reason={unsupportedReason(navigator.userAgent)} />;
      break;
    case 'start':
      content = <StartScreen mode="start" error={screen.error} onPick={choose} />;
      break;
    case 'resume':
      content = <StartScreen mode="resume" folderName={screen.stored.handle.name} onResume={resume} onPick={choose} />;
      break;
    case 'open':
      content = (
        <WorkspaceView
          key={`${screen.stored.workspaceId}:${openCount}`}
          workspace={screen.workspace}
          workspaceId={screen.stored.workspaceId}
          handle={screen.stored.handle}
          onChangeFolder={choose}
        />
      );
      break;
  }

  return (
    <>
      {content}
      {dbBlocked && (
        <Notice
          placement="top"
          message={t('toast.reloadOtherTabs')}
          dismissLabel={t('toast.close')}
          onDismiss={() => setDbBlocked(false)}
        />
      )}
    </>
  );
}
