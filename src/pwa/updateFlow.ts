import type { SettleResult } from '../workspace/workspace';

/** Ciò che il flusso chiede all'app (in App: il Workspace aperto e window.location). */
export interface UpdateHost {
  /** Documento in sola lettura e messo al sicuro (Workspace.beginUpdate). */
  prepare(): Promise<SettleResult>;
  /** L'aggiornamento non procede: si torna a modificare (Workspace.endUpdate). */
  cancel(): void;
  reload(): void;
}

export interface UpdateState {
  /** C'è una nuova versione in attesa: toast persistente con "Aggiorna". */
  available: boolean;
  /** Aggiornamento in corso: documento in sola lettura, pulsante disabilitato. */
  busy: boolean;
}

export interface UpdateFlow {
  getState(): UpdateState;
  subscribe(listener: () => void): () => void;
  /** Il plugin ha trovato un service worker nuovo in attesa. */
  needRefresh(): void;
  dismiss(): void;
  /** Clic su "Aggiorna": al sicuro → SKIP_WAITING; altrimenti si resta sulla versione vecchia. */
  apply(): Promise<void>;
  /** Il nuovo service worker controlla la pagina (in OGNI scheda): reload solo se al sicuro. Dopo, "Aggiorna" ritenta solo il reload protetto. */
  needReload(): Promise<void>;
}

export function createUpdateFlow(host: UpdateHost, updateSW: () => Promise<void>): UpdateFlow {
  let state: UpdateState = { available: false, busy: false };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  let reloading = false;
  /**
   * Il nuovo service worker controlla già questa pagina (needReload è arrivato almeno una volta).
   * Da qui in poi "Aggiorna" non deve più chiamare updateSW: non c'è un worker in attesa e nessun
   * altro evento arriverà. Resta solo da ricaricare, sempre dopo aver messo al sicuro il documento.
   */
  let activated = false;

  const guardedReload = async () => {
    if (reloading) return;
    reloading = true;
    set({ busy: true });
    if ((await host.prepare()) === 'durable') {
      host.reload();
      return;
    }
    reloading = false;
    host.cancel();
    set({ busy: false, available: true });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    needRefresh() {
      set({ available: true });
    },
    dismiss() {
      if (!state.busy) set({ available: false });
    },
    async apply() {
      if (state.busy) return;
      if (activated) {
        await guardedReload();
        return;
      }
      set({ busy: true });
      if ((await host.prepare()) === 'failed') {
        host.cancel();
        set({ busy: false });
        return;
      }
      try {
        await updateSW();
        // Si resta "busy" (sola lettura) finché needReload non ricarica la pagina.
      } catch {
        host.cancel();
        set({ busy: false });
      }
    },
    async needReload() {
      activated = true;
      await guardedReload();
    },
  };
}
