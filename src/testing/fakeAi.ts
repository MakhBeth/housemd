import type { AiState } from '../ai/aiController';
import type { ChatProvider, ModelOption, ModelProfile, ProfileOverrides } from '../ai/types';
import type { AiChipController } from '../elements/ai/aiChips';

/**
 * Controller AI finto per i test degli elementi: stato in memoria, notifiche sincrone, override registrati.
 * Il profilo attivo è quello di `profileId` tra `profiles`, altrimenti `profile`. Le altre chiamate
 * (scelta e salvataggio del profilo, invio, stop, nuova chat, riprova, apertura di un file) finiscono in
 * `calls`; l'elenco dei modelli risponde `models` (null = server non raggiungibile).
 */
export function fakeAi(initial: Partial<AiState> = {}, profile?: ModelProfile) {
  let state = { chat: { id: 'c', messages: [], overrides: {} }, running: null, presets: [], profiles: [], profileId: '', ...initial } as unknown as AiState;
  const listeners = new Set<() => void>();
  const overrides: ProfileOverrides[] = [];
  const calls: unknown[][] = [];
  const reports: unknown[] = [];
  const set = (patch: Partial<AiState>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn();
  };
  const controller = {
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    getState: () => state,
    profile: () => state.profiles.find((p) => p.id === state.profileId) ?? profile,
    override: (next: ProfileOverrides) => {
      overrides.push(next);
      set({ chat: { ...state.chat, overrides: next } });
    },
    selectProfile: (id: string) => {
      calls.push(['selectProfile', id]);
      set({ profileId: id, chat: { ...state.chat, overrides: {} } });
    },
    saveOverrides: async (asNew = false) => void calls.push(['saveOverrides', asNew]),
    report: (error: unknown) => void reports.push(error),
    models: null as ModelOption[] | null,
    provider: async () => ({ listModels: async () => controller.models }) as unknown as ChatProvider,
    send: async (...args: unknown[]) => void calls.push(['send', ...args]),
    stop: () => void calls.push(['stop']),
    newChat: () => void calls.push(['newChat']),
    retry: async (...args: unknown[]) => void calls.push(['retry', ...args]),
    workspace: { openFile: (path: string) => void calls.push(['openFile', path]) },
    set,
    overrides,
    calls,
    reports,
    listeners: () => listeners.size,
  };
  return controller as unknown as AiChipController & Omit<typeof controller, keyof AiChipController>;
}
