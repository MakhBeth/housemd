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
  return { kind: 'opened', value };
}
