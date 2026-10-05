import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { match } from 'ts-pattern';

import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedReason } from './fs/access';
import { fsaOps } from './fs/fsaOps';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from './fs/handleStore';
import { createWorkspaceFS } from './fs/workspaceFS';
import { switchFolder, switchGuard } from './app/switchFolder';
import { afterSwitch, type Screen as AppScreen } from './elements/app/screens';
import { useI18nStore, useT } from './i18n/I18nProvider';
import { onDbBlocked } from './lib/db';
import { readValidPref } from './lib/prefs';
import type { UpdateFlow } from './pwa/updateFlow';
import { setUpdateWorkspace } from './pwa/updateHost';
import { StartScreen } from './ui/StartScreen';
import { WorkspaceView } from './ui/WorkspaceView';
import { indexedDbHistoryStore } from './history/historyStore';
import { indexedDbBufferStore } from './workspace/buffers';
import { parseAutosave } from './workspace/autosave';
import { Workspace } from './workspace/workspace';

type Screen = AppScreen<StoredWorkspace, Workspace>;

const buffers = indexedDbBufferStore();
const history = indexedDbHistoryStore();

async function openWorkspace(stored: StoredWorkspace): Promise<Workspace> {
  const workspace = new Workspace({
    fs: createWorkspaceFS(fsaOps(stored.handle)),
    workspaceId: stored.workspaceId,
    name: stored.handle.name,
    buffers,
    history,
    autosave: readValidPref('autosave', parseAutosave),
  });
  await workspace.load();
  return workspace;
}

export default function App({ updates }: { updates: UpdateFlow }) {
  const t = useT();
  const i18nStore = useI18nStore();
  const [dbBlocked, setDbBlocked] = useState(false);
  useEffect(() => onDbBlocked(() => setDbBlocked(true)), []);

  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  // Incrementato a ogni apertura riuscita: entra nella key di WorkspaceView così che riaprire la
  // STESSA cartella (stesso workspaceId) forzi comunque lo smontaggio/rimontaggio del componente,
  // invece di lasciarne leaked lo stato interno (es. `reopened`).
  const [openCount, setOpenCount] = useState(0);
  // Un cambio cartella (o ripresa dell'accesso) alla volta: ognuno cattura lo workspace aperto
  // all'inizio, e uno sovrapposto sostituirebbe senza metterlo al sicuro quello aperto dall'altro.
  const guard = useRef(switchGuard());
  const [switching, setSwitching] = useState(false);
  const exclusive = useCallback(async (task: () => Promise<void>) => {
    if (guard.current.active) return;
    setSwitching(true);
    try {
      await guard.current.run(task);
    } finally {
      setSwitching(false);
    }
  }, []);

  // Il flusso di aggiornamento mette al sicuro il documento del Workspace aperto prima del reload.
  useEffect(() => {
    setUpdateWorkspace(screen.kind === 'open' ? screen.workspace : null);
  }, [screen]);

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

  const choose = useCallback(() => exclusive(async () => {
    const current = screen.kind === 'open' ? screen.workspace : null;
    const result = await switchFolder({
      pick: pickFolder,
      current,
      open: async (handle: FileSystemDirectoryHandle) => {
        // Se è una cartella già aperta in passato (non solo l'ultima: anche A → B → A), si mantiene
        // lo stesso workspaceId: altrimenti buffer di emergenza e "ultimo file aperto" salvati per
        // quella cartella resterebbero orfani, agganciati a un id ormai abbandonato.
        const workspaceId = (await findKnownWorkspaceId(handle).catch(() => null)) ?? crypto.randomUUID();
        const stored: StoredWorkspace = { handle, workspaceId };
        return { stored, workspace: await openWorkspace(stored) };
      },
      // Diventa la cartella corrente salvata solo a cambio riuscito. Se il salvataggio fallisce la
      // cartella resta comunque aperta: al prossimo avvio si riaprirà la precedente.
      persist: ({ stored }) => {
        void saveWorkspace(stored.handle, undefined, stored.workspaceId).catch(() => undefined);
      },
      // La cartella vecchia non si è potuta lasciare (modifiche arrivate durante l'apertura e non
      // messe al sicuro): si resta lì e quella nuova, già caricata, si butta.
      discard: ({ workspace }) => workspace.dispose(),
    });
    match(afterSwitch(result, current !== null))
      .with({ kind: 'show' }, ({ screen: next }) => {
        if (next.kind === 'open') setOpenCount((c) => c + 1);
        setScreen(next);
      })
      .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
      .with({ kind: 'stay' }, () => {})
      .exhaustive();
  }), [screen, exclusive]);

  const resume = useCallback(() => exclusive(async () => {
    if (screen.kind !== 'resume') return;
    if (!(await requestAccess(screen.stored.handle))) return;
    const workspace = await openWorkspace(screen.stored);
    setOpenCount((c) => c + 1);
    setScreen({ kind: 'open', stored: screen.stored, workspace });
  }), [screen, exclusive]);

  const content: ReactNode = match(screen)
    .with({ kind: 'boot' }, () => null)
    .with({ kind: 'unsupported' }, () => <StartScreen mode="unsupported" reason={unsupportedReason(navigator.userAgent)} />)
    .with({ kind: 'start' }, (s) => <StartScreen mode="start" error={s.error} onPick={choose} busy={switching} />)
    .with({ kind: 'resume' }, (s) => (
      <StartScreen mode="resume" folderName={s.stored.handle.name} onResume={resume} onPick={choose} busy={switching} />
    ))
    .with({ kind: 'open' }, (s) => (
      <WorkspaceView
        key={`${s.stored.workspaceId}:${openCount}`}
        workspace={s.workspace}
        workspaceId={s.stored.workspaceId}
        handle={s.stored.handle}
        onChangeFolder={choose}
        switchingFolder={switching}
      />
    ))
    .exhaustive();

  return (
    <>
      {content}
      <hmd-update-notice flow={updates} i18n={i18nStore} />
      {dbBlocked && (
        <hmd-notice
          placement="top"
          message={t('toast.reloadOtherTabs')}
          dismissLabel={t('toast.close')}
          dismissible
          onhmd-notice-dismiss={() => setDbBlocked(false)}
        />
      )}
    </>
  );
}
