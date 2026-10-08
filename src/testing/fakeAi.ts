import type { AiState } from '../ai/aiController';
import type { ModelProfile, ProfileOverrides } from '../ai/types';
import type { AiChipController } from '../elements/ai/aiChips';

/** Controller AI finto per i test degli elementi: stato in memoria, notifiche sincrone, override registrati. */
export function fakeAi(initial: Partial<AiState> = {}, profile?: ModelProfile) {
  let state = { chat: { id: 'c', messages: [], overrides: {} }, running: null, presets: [], profiles: [], profileId: '', ...initial } as unknown as AiState;
  const listeners = new Set<() => void>();
  const overrides: ProfileOverrides[] = [];
  const set = (patch: Partial<AiState>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn();
  };
  const controller = {
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    getState: () => state,
    profile: () => profile,
    override: (next: ProfileOverrides) => {
      overrides.push(next);
      set({ chat: { ...state.chat, overrides: next } });
    },
    set,
    overrides,
    listeners: () => listeners.size,
  } as unknown as AiChipController & { set: typeof set; overrides: ProfileOverrides[]; listeners: () => number };
  return controller;
}
