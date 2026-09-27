import type { SettleResult } from '../workspace/workspace';

/** Ciò che il flusso chiede all'app (in App: il Workspace aperto e window.location). */
export interface UpdateHost {
  /** Documento in sola lettura e messo al sicuro (Workspace.beginUpdate). */
  prepare(): Promise<SettleResult>;
  /** L'aggiornamento non procede: si torna a modificare (Workspace.endUpdate). */
  cancel(): void;
  reload(): void;
  /** Timer annullabile (in App: window.setTimeout); restituisce la funzione che lo annulla. */
  setTimer(callback: () => void, ms: number): () => void;
}

/** Dopo SKIP_WAITING, attesa massima dell'evento `controlling` prima di restituire il documento. */
export const UPDATE_TIMEOUT_MS = 10_000;

/**
 * Dopo host.reload(), attesa oltre la quale la pagina è evidentemente ancora viva (il reload è stato
 * annullato, es. dal dialogo "Esci dal sito?"): si restituisce il documento.
 */
export const RELOAD_TIMEOUT_MS = 3_000;

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
  /** Annulla l'attesa di `controlling` dopo un apply riuscito (null se non si sta aspettando). */
  let cancelTimeout: (() => void) | null = null;

  const stopTimeout = () => {
    cancelTimeout?.();
    cancelTimeout = null;
  };

  /** prepare() che non rifiuta mai: un errore inatteso vale come documento non al sicuro. */
  const secure = async (): Promise<SettleResult> => {
    try {
      return await host.prepare();
    } catch {
      return 'failed';
    }
  };

  const guardedReload = async () => {
    if (reloading) return;
    reloading = true;
    stopTimeout();
    set({ busy: true });
    if ((await secure()) === 'durable') {
      try {
        host.reload();
        // Se la pagina è ancora viva dopo RELOAD_TIMEOUT_MS il reload non è avvenuto: senza questa
        // guardia il documento resterebbe in sola lettura con "Aggiorna" disabilitato.
        cancelTimeout = host.setTimer(() => {
          cancelTimeout = null;
          reloading = false;
          host.cancel();
          set({ busy: false, available: true });
        }, RELOAD_TIMEOUT_MS);
        return;
      } catch {
        // reload non riuscito: si restituisce il documento come sotto.
      }
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
      if ((await secure()) === 'failed') {
        host.cancel();
        set({ busy: false });
        return;
      }
      try {
        await updateSW();
        // Si resta "busy" (sola lettura) finché needReload non ricarica la pagina; se `controlling`
        // non arriva (worker sparito, SKIP_WAITING perso) si restituisce il documento, toast compreso.
        if (!activated && !reloading) {
          cancelTimeout = host.setTimer(() => {
            cancelTimeout = null;
            if (activated || reloading) return;
            host.cancel();
            set({ busy: false });
          }, UPDATE_TIMEOUT_MS);
        }
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
