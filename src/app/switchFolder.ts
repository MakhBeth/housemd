import { errorDetail } from '../workspace/toasts';

/** Lo workspace aperto, visto dal cambio cartella. */
export interface ClosableWorkspace {
  closeFile(): Promise<boolean>;
  dispose(): void;
}

export type FolderSwitch<T> =
  | { kind: 'cancelled' }
  | { kind: 'blocked' }
  | { kind: 'opened'; value: T }
  | { kind: 'error'; detail: string };

/**
 * Cambio cartella: sceglie (pick), mette al sicuro e chiude il documento aperto, apre la nuova
 * cartella e solo allora elimina lo workspace vecchio. Qualunque errore lascia lo workspace vecchio
 * al suo posto (chi chiama mostra l'errore lì): mai un documento abbandonato non al sicuro.
 */
export async function switchFolder<H, T>(deps: {
  pick(): Promise<H | null>;
  current: ClosableWorkspace | null;
  open(handle: H): Promise<T>;
  /** Elimina la cartella appena aperta se alla fine non si può lasciare quella vecchia. */
  discard?(value: T): void;
  /**
   * Salva la cartella nuova come "corrente" (riaperta all'avvio): solo a cambio riuscito, così un
   * cambio bloccato o fallito non fa riaprire al prossimo avvio una cartella mai davvero aperta.
   */
  persist?(value: T): void;
}): Promise<FolderSwitch<T>> {
  let handle: H | null;
  try {
    handle = await deps.pick();
  } catch (err) {
    return { kind: 'error', detail: errorDetail(err) };
  }
  if (handle === null) return { kind: 'cancelled' };
  try {
    // Documento non messo al sicuro: toast draftNotPersisted già mostrato dal Workspace.
    if (deps.current && !(await deps.current.closeFile())) return { kind: 'blocked' };
  } catch (err) {
    return { kind: 'error', detail: errorDetail(err) };
  }
  let value: T;
  try {
    value = await deps.open(handle);
  } catch (err) {
    return { kind: 'error', detail: errorDetail(err) };
  }
  // Durante l'apertura (anche lunga: si leggono tutti i file) lo workspace vecchio è rimasto usabile:
  // l'utente può aver aperto un file e scritto. Si rimette al sicuro quello che c'è ADESSO; se non si
  // può, si rinuncia al cambio. Tra la fine di closeFile() e dispose() non c'è nessun await.
  try {
    if (deps.current && !(await deps.current.closeFile())) {
      deps.discard?.(value);
      return { kind: 'blocked' };
    }
  } catch (err) {
    deps.discard?.(value);
    return { kind: 'error', detail: errorDetail(err) };
  }
  deps.current?.dispose();
  deps.persist?.(value);
  return { kind: 'opened', value };
}

/**
 * Un cambio cartella alla volta: ognuno cattura lo workspace aperto all'inizio, quindi due cambi
 * sovrapposti (A→B e A→C) farebbero sparire C senza metterlo al sicuro. Mentre uno è in corso,
 * `run()` ignora le nuove richieste (risultato null) senza avviarle.
 */
export function switchGuard(): { readonly active: boolean; run<T>(task: () => Promise<T>): Promise<T | null> } {
  let active = false;
  return {
    get active() {
      return active;
    },
    async run(task) {
      if (active) return null;
      active = true;
      try {
        return await task();
      } finally {
        active = false;
      }
    },
  };
}
