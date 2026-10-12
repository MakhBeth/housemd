import { AiController, type AiWorkspace } from '../../ai/aiController';
import { createIdbAiStores } from '../../ai/idbStores';
import { createMemoryAiStores, type AiStores } from '../../ai/stores';
import { readPref } from '../../lib/prefs';
import { registerUpdateParticipant } from '../../pwa/updateHost';
import type { Workspace } from '../../workspace/workspace';

/** Quello che la sessione AI usa dello workspace. */
export type AiSessionWorkspace = Pick<Workspace, 'getState' | 'snapshotBeforeAi' | 'openFile'>;

/** Archivi e registrazione: iniettati, così la sessione si prova senza IndexedDB. */
export interface AiSessionDeps {
  idbStores(): Promise<AiStores>;
  memoryStores(): AiStores;
  /** Profilo scelto l'ultima volta (preferenza `aiProfile`). */
  savedProfile(): string | undefined;
  /** Registra il controller nel flusso di aggiornamento della PWA; restituisce come toglierlo. */
  register(controller: AiController): () => void;
}

/** Il documento aperto visto dal controller AI (era il `binding` di useAiController). */
export function aiWorkspace(workspace: AiSessionWorkspace): AiWorkspace {
  return {
    getDoc: () => {
      const s = workspace.getState();
      return s.doc ? { path: s.doc.path, textLf: s.doc.text, conflict: s.doc.conflict, updating: s.updating } : null;
    },
    snapshotBeforeAi: () => workspace.snapshotBeforeAi(),
    openFile: (path) => workspace.openFile(path),
  };
}

/**
 * Una sessione AI per cartella (era `useAiController`): il controller su IndexedDB, o in memoria se
 * IndexedDB non c'è (con l'errore `server`). Se `signal` si interrompe prima che sia pronto il
 * controller si butta e la Promise dà null; pronto, si registra nel flusso di aggiornamento. Chi lo
 * riceve lo chiude con `close` (toglie la registrazione e lo elimina).
 */
export async function openAiSession(workspace: AiSessionWorkspace, deps: AiSessionDeps, signal: AbortSignal): Promise<{ controller: AiController; close(): void } | null> {
  const binding = aiWorkspace(workspace);
  let controller: AiController | null = null;
  // Dopo ogni attesa si ricontrolla l'interruzione: una sessione non più voluta non va avanti.
  try {
    const stores = await deps.idbStores();
    if (signal.aborted) return null;
    controller = new AiController(stores, binding);
    await controller.initialize(deps.savedProfile());
  } catch {
    controller?.dispose();
    if (signal.aborted) return null;
    controller = new AiController(deps.memoryStores(), binding);
    await controller.initialize();
    controller.report({ code: 'server' });
  }
  if (signal.aborted) {
    controller.dispose();
    return null;
  }
  const unregister = deps.register(controller);
  const ready = controller;
  return {
    controller: ready,
    close() {
      unregister();
      ready.dispose();
    },
  };
}

/** La sessione AI del browser: IndexedDB, profilo salvato, flusso di aggiornamento della PWA. */
export const browserAiSessionDeps: AiSessionDeps = {
  idbStores: () => createIdbAiStores(),
  memoryStores: () => createMemoryAiStores(),
  savedProfile: () => readPref('aiProfile'),
  register: (controller) => registerUpdateParticipant(controller),
};
