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

export type ComposerAction = 'send' | 'newline' | 'stop' | 'none';

export function composerAction(event: ComposerKey, running: boolean): ComposerAction {
  if (event.isComposing) return 'none';
  if (event.key === 'Escape') return running ? 'stop' : 'none';
  if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) return 'none';
  return event.shiftKey ? 'newline' : 'send';
}
