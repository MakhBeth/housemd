import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedReason, type UnsupportedReason } from '../../fs/access';
import { fsaOps } from '../../fs/fsaOps';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from '../../fs/handleStore';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { indexedDbHistoryStore } from '../../history/historyStore';
import { onDbBlocked } from '../../lib/db';
import { readValidPref } from '../../lib/prefs';
import { setUpdateWorkspace } from '../../pwa/updateHost';
import { parseAutosave } from '../../workspace/autosave';
import { indexedDbBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';

/** Quello che l'app usa del browser (cartelle, permessi, IndexedDB): iniettato, così l'elemento si prova in jsdom. */
export interface AppDeps {
  isSupported(): boolean;
  unsupportedReason(): UnsupportedReason;
  loadWorkspace(): Promise<StoredWorkspace | null>;
  hasAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  requestAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  pickFolder(): Promise<FileSystemDirectoryHandle | null>;
  /** Id di una cartella già aperta in passato (anche A → B → A), o null. */
  knownWorkspaceId(handle: FileSystemDirectoryHandle): Promise<string | null>;
  saveWorkspace(stored: StoredWorkspace): Promise<unknown>;
  openWorkspace(stored: StoredWorkspace): Promise<Workspace>;
  onDbBlocked(listener: () => void): () => void;
  /** Il flusso di aggiornamento mette al sicuro il documento dello workspace aperto prima del reload. */
  setUpdateWorkspace(workspace: Workspace | null): void;
}

const buffers = indexedDbBufferStore();
const history = indexedDbHistoryStore();

/** L'app nel browser (era il modulo di App.tsx). */
export const browserAppDeps: AppDeps = {
  isSupported,
  unsupportedReason: () => unsupportedReason(navigator.userAgent),
  loadWorkspace: () => loadWorkspace(),
  hasAccess,
  requestAccess,
  pickFolder,
  knownWorkspaceId: (handle) => findKnownWorkspaceId(handle),
  saveWorkspace: (stored) => saveWorkspace(stored.handle, undefined, stored.workspaceId),
  async openWorkspace(stored) {
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
  },
  onDbBlocked,
  setUpdateWorkspace,
};
