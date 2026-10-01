/**
 * Bozza del dettaglio di un elemento (profilo, preset): `dirty` finché differisce dall'ultimo
 * salvataggio; passare a un altro elemento con modifiche aperte resta in sospeso (`pending`) finché
 * l'utente non conferma o annulla. Puro: le funzioni restituiscono uno stato nuovo.
 */
export interface DraftState<T> {
  draft: T | null;
  /** JSON dell'ultimo stato salvato (o aperto), per il confronto. */
  saved: string | null;
  pending: T | null;
}

export const emptyDraft = <T>(): DraftState<T> => ({ draft: null, saved: null, pending: null });

export const isDirty = <T>(state: DraftState<T>): boolean => state.draft !== null && JSON.stringify(state.draft) !== state.saved;

/** Apre un elemento (o nessuno) come riferimento pulito. */
export const openDraft = <T>(state: DraftState<T>, item: T | null): DraftState<T> => ({
  ...state,
  draft: item,
  saved: item === null ? null : JSON.stringify(item),
});

export const editDraft = <T>(state: DraftState<T>, item: T): DraftState<T> => ({ ...state, draft: item });

export const selectDraft = <T>(state: DraftState<T>, item: T | null): DraftState<T> =>
  isDirty(state) ? { ...state, pending: item } : openDraft(state, item);

export const confirmSwitch = <T>(state: DraftState<T>): DraftState<T> => ({ ...openDraft(state, state.pending), pending: null });

export const cancelSwitch = <T>(state: DraftState<T>): DraftState<T> => ({ ...state, pending: null });
