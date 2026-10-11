import type { AcceptBlocker, AiState, SendBlocker } from '../ai/aiController';
import type { ChatProvider, ModelOption, ModelProfile, ProfileOverrides, Proposal } from '../ai/types';
import type { AiChipController } from '../elements/ai/aiChips';

/**
 * Controller AI finto per i test degli elementi: stato in memoria, notifiche sincrone, override registrati.
 * Il profilo attivo è quello di `profileId` tra `profiles`, altrimenti `profile`. Le altre chiamate
 * (scelta e salvataggio del profilo, invio, stop, nuova chat, riprova, apertura di un file) finiscono in
 * `calls`; l'elenco dei modelli risponde `models` (null = server non raggiungibile).
 */
export function fakeAi(initial: Partial<AiState> = {}, profile?: ModelProfile) {
  let state = { chat: { id: 'c', messages: [], overrides: {} }, proposals: new Map(), running: null, presets: [], profiles: [], profileId: '', streamingPreview: null, ...initial } as unknown as AiState;
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
    /** Ragione per cui un invio non parte: `running` dallo stato, le altre da `blocker`. */
    sendBlocker: (): SendBlocker | null => (state.running ? 'running' : controller.sendBlockerValue),
    sendBlockerValue: null as SendBlocker | null,
    /** Ragione per cui la proposta non si accetta (`blocker`), da cui `canAccept`. */
    blocker: null as AcceptBlocker | null,
    acceptBlocker: (p: Proposal, all = false) => (state.running?.path === p.path || p.status === 'streaming' ? 'generating' : controller.blocker ?? (all && p.status === 'truncated' ? 'truncated' : null)),
    canAccept: (p: Proposal, all = false) => controller.acceptBlocker(p, all) === null,
    beforeAccept: (p: Proposal, all = false) => (calls.push(['beforeAccept', p.path, all]), controller.canAccept(p, all)),
    /** Testo della proposta applicato al documento: la proposta stessa, salvo `proposalTextValue`. */
    proposalTextValue: undefined as string | null | undefined,
    proposalText: (p: Proposal) => (controller.proposalTextValue === undefined ? p.text : controller.proposalTextValue),
    edited: (path: string, text: string) => void calls.push(['edited', path, text]),
    discard: (path: string) => void calls.push(['discard', path]),
    continue: async (path: string) => void calls.push(['continue', path]),
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
