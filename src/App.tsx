import { useCallback, useEffect, useState } from 'react';

import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedMessage } from './fs/access';
import { fsaOps } from './fs/fsaOps';
import { loadWorkspace, saveWorkspace, type StoredWorkspace } from './fs/handleStore';
import { createWorkspaceFS } from './fs/workspaceFS';
import { StartScreen } from './ui/StartScreen';
import { WorkspaceView } from './ui/WorkspaceView';
import { indexedDbBufferStore } from './workspace/buffers';
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
      if (alive) setScreen({ kind: 'open', stored, workspace });
      else workspace.dispose();
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
        await screen.workspace.flush();
        screen.workspace.dispose();
      }
      const stored = await saveWorkspace(handle);
      setScreen({ kind: 'open', stored, workspace: await openWorkspace(stored) });
    } catch (err) {
      setScreen({ kind: 'start', error: `Impossibile aprire la cartella: ${(err as Error).message}` });
    }
  }, [screen]);

  const resume = useCallback(async () => {
    if (screen.kind !== 'resume') return;
    if (!(await requestAccess(screen.stored.handle))) return;
    setScreen({ kind: 'open', stored: screen.stored, workspace: await openWorkspace(screen.stored) });
  }, [screen]);

  switch (screen.kind) {
    case 'boot':
      return null;
    case 'unsupported':
      return <StartScreen mode="unsupported" message={unsupportedMessage(navigator.userAgent)} />;
    case 'start':
      return <StartScreen mode="start" message={screen.error} onPick={choose} />;
    case 'resume':
      return <StartScreen mode="resume" folderName={screen.stored.handle.name} onResume={resume} onPick={choose} />;
    case 'open':
      return (
        <WorkspaceView
          key={screen.stored.workspaceId}
          workspace={screen.workspace}
          workspaceId={screen.stored.workspaceId}
          handle={screen.stored.handle}
          onChangeFolder={choose}
        />
      );
  }
}
