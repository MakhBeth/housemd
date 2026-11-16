import { canPickFileHandle, hasAccess, isSupported, onLaunchFile, pathIn, pickFileHandle, pickFolder, requestAccess, sameEntry, unsupportedReason, type UnsupportedReason } from '../../fs/access';
import { addRecent, loadRecents, type Recent } from '../../fs/recents';
import { pickFileInput } from '../../fs/fileInput';
import { fsaFile, fsaOps } from '../../fs/fsaOps';
import { isMemoryFile, listPending, memoryFile, mirrorPending, recoverPending, registerSession, singleFileOps, type PendingCopy, type SingleFile } from '../../fs/singleFile';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from '../../fs/handleStore';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { indexedDbHistoryStore } from '../../history/historyStore';
import { onDbBlocked } from '../../lib/db';
import { readValidPref, writeLastFile } from '../../lib/prefs';
import { setUpdateWorkspace } from '../../pwa/updateHost';
import { parseAutosave } from '../../workspace/autosave';
import { indexedDbBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';

/** Quello che l'app usa del browser (cartelle, permessi, IndexedDB): iniettato, così l'elemento si prova in jsdom. */
export interface AppDeps {
  isSupported(): boolean;
  unsupportedReason(): UnsupportedReason;
  loadWorkspace(): Promise<StoredWorkspace | null>;
  hasAccess(handle: FileSystemHandle): Promise<boolean>;
  requestAccess(handle: FileSystemHandle): Promise<boolean>;
  /** `near`: il selettore parte dalla cartella di questo file («Apri la cartella di questo file»). */
  pickFolder(near?: FileSystemFileHandle): Promise<FileSystemDirectoryHandle | null>;
  /** Percorso del file dentro la cartella, o null se non ci sta. */
  pathIn(dir: FileSystemDirectoryHandle, file: FileSystemFileHandle): Promise<string | null>;
  rememberLastFile(workspaceId: string, path: string): void;
  listRecents(): Promise<Recent[]>;
  addRecent(entry: Recent): Promise<Recent[]>;
  /** Il file vero di un recente (permesso già concesso). */
  fileFromHandle(handle: FileSystemFileHandle): SingleFile;
  /** Id di una cartella già aperta in passato (anche A → B → A), o null. */
  knownWorkspaceId(handle: FileSystemDirectoryHandle): Promise<string | null>;
  saveWorkspace(stored: StoredWorkspace): Promise<unknown>;
  openWorkspace(stored: StoredWorkspace): Promise<Workspace>;
  /** «Apri un file»: il file vero dove c'è la File System Access API, altrimenti una copia da scaricare. */
  pickFile(): Promise<SingleFile | null>;
  openFileWorkspace(file: SingleFile, workspaceId: string): Promise<Workspace>;
  /** Copie in memoria non scaricate di sessioni precedenti (crash, chiusura, cambio file). */
  listRecoverable(): Promise<PendingCopy[]>;
  recoverFile(copy: PendingCopy): Promise<SingleFile | null>;
  /** «Apri con… HouseMD» dal sistema (PWA installata). */
  onLaunchFile(listener: (file: SingleFile) => void): void;
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
  pathIn,
  rememberLastFile: writeLastFile,
  listRecents: () => loadRecents(),
  addRecent: (entry) => addRecent(entry, sameEntry),
  fileFromHandle: (handle) => fsaFile(handle, () => requestAccess(handle)),
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
  async pickFile() {
    if (canPickFileHandle()) {
      const handle = await pickFileHandle();
      return handle && fsaFile(handle, () => requestAccess(handle));
    }
    const file = await pickFileInput();
    return file && memoryFile({ name: file.name, blob: file, lastModified: file.lastModified });
  },
  async openFileWorkspace(file, workspaceId) {
    // La copia in memoria si tiene anche nel buffer di emergenza finché non si scarica (vive quanto il file).
    // Ogni file singolo segna la sua sessione: le bozze non salvate (autosave spento, crash) si ritrovano.
    await registerSession(file, buffers, workspaceId).catch(() => undefined);
    if (isMemoryFile(file)) mirrorPending(file, buffers, workspaceId);
    const workspace = new Workspace({
      fs: createWorkspaceFS(singleFileOps(file)),
      workspaceId,
      name: file.name,
      buffers,
      history,
      autosave: readValidPref('autosave', parseAutosave),
    });
    await workspace.load();
    return workspace;
  },
  listRecoverable: () => listPending(buffers),
  recoverFile: (copy) => recoverPending(buffers, copy),
  onLaunchFile(listener) {
    onLaunchFile((handle) => listener(fsaFile(handle, () => requestAccess(handle))));
  },
  onDbBlocked,
  setUpdateWorkspace,
};
