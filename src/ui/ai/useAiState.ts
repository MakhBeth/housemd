import { useSyncExternalStore } from 'react';

import type { AiController, AiState } from '../../ai/aiController';

const noSubscribe = () => () => {};
const noState = () => null;

/** Stato del controller AI, o null finché il controller non è pronto (o non esiste). */
export function useAiState(ai: AiController | null): AiState | null {
  return useSyncExternalStore(ai ? ai.subscribe : noSubscribe, ai ? ai.getState : noState);
}
