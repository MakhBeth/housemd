import { useCallback, useEffect, useState } from 'react';

import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedReason } from './fs/access';
import { fsaOps } from './fs/fsaOps';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from './fs/handleStore';
import { createWorkspaceFS } from './fs/workspaceFS';
import { StartScreen } from './ui/StartScreen';
import { WorkspaceView } from './ui/WorkspaceView';
import { indexedDbBufferStore } from './workspace/buffers';
import { errorDetail } from './workspace/toasts';
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
  });
  await workspace.load();
  return workspace;
}

export default function App() {
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
    try {
      const handle = await pickFolder();
      if (!handle) return;
      if (screen.kind === 'open') {
        // closeFile() esegue settle(): eventuali modifiche non salvate (conflitto, autosalvataggio
        // sospeso…) finiscono comunque nel buffer di emergenza prima di chiudere lo workspace.
        await screen.workspace.closeFile();
        screen.workspace.dispose();
      }
      // Se è una cartella già aperta in passato (non solo l'ultima: anche A → B → A), si mantiene
      // lo stesso workspaceId: altrimenti buffer di emergenza e "ultimo file aperto" salvati per
      // quella cartella resterebbero orfani, agganciati a un id ormai abbandonato.
      const workspaceId = (await findKnownWorkspaceId(handle).catch(() => null)) ?? undefined;
      const stored = await saveWorkspace(handle, undefined, workspaceId);
      const workspace = await openWorkspace(stored);
      setOpenCount((c) => c + 1);
      setScreen({ kind: 'open', stored, workspace });
    } catch (err) {
      setScreen({ kind: 'start', error: errorDetail(err) });
    }
  }, [screen]);

  const resume = useCallback(async () => {
    if (screen.kind !== 'resume') return;
    if (!(await requestAccess(screen.stored.handle))) return;
    const workspace = await openWorkspace(screen.stored);
    setOpenCount((c) => c + 1);
    setScreen({ kind: 'open', stored: screen.stored, workspace });
  }, [screen]);

  switch (screen.kind) {
    case 'boot':
      return null;
    case 'unsupported':
      return <StartScreen mode="unsupported" reason={unsupportedReason(navigator.userAgent)} />;
    case 'start':
      return <StartScreen mode="start" error={screen.error} onPick={choose} />;
    case 'resume':
      return <StartScreen mode="resume" folderName={screen.stored.handle.name} onResume={resume} onPick={choose} />;
    case 'open':
      return (
        <WorkspaceView
          key={`${screen.stored.workspaceId}:${openCount}`}
          workspace={screen.workspace}
          workspaceId={screen.stored.workspaceId}
          handle={screen.stored.handle}
          onChangeFolder={choose}
        />
      );
  }
}
