/** Tasti del composer AI (puro): Invio invia, Shift+Invio va a capo, Esc ferma la generazione. */
export interface ComposerKey {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Composizione IME in corso: l'Invio conferma i caratteri, non il messaggio. */
  isComposing: boolean;
}

/**
 * `next`/`prev` muovono la voce attiva dell'elenco, `pick` la sceglie, `close` chiude l'elenco (Esc: l'evento si consuma),
 * `dismiss` lo chiude e lascia proseguire il Tab.
 */
export type ComposerAction = 'send' | 'newline' | 'stop' | 'none' | 'next' | 'prev' | 'pick' | 'close' | 'dismiss';

export function composerAction(event: ComposerKey, running: boolean, listOpen = false, hasActive = false): ComposerAction {
  if (event.isComposing) return 'none';
  if (listOpen) {
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (event.key === 'Escape') return 'close';
    if (event.key === 'ArrowDown' && plain && !event.shiftKey) return 'next';
    if (event.key === 'ArrowUp' && plain && !event.shiftKey) return 'prev';
    if (event.key === 'Tab' && plain) return event.shiftKey || !hasActive ? 'dismiss' : 'pick';
    if (event.key === 'Enter' && plain && !event.shiftKey) return hasActive ? 'pick' : 'none';
  }
  if (event.key === 'Escape') return running ? 'stop' : 'none';
  if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) return 'none';
  return event.shiftKey ? 'newline' : 'send';
}
