/** Scorciatoie da tastiera globali (puro): evento → azione. */

export type Shortcut = 'save' | 'saveAll' | 'search' | 'toggleAi' | 'toggleSidebar' | 'cycleMode';

export interface KeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
}

export function shortcutFor(event: KeyInput): Shortcut | null {
  if (!(event.ctrlKey || event.metaKey)) return null;
  // Con Alt il carattere dipende dal layout (su macOS Alt+S dà "ß"): conta il tasto fisico.
  if (event.altKey) return event.code === 'KeyS' ? 'saveAll' : null;
  if (event.shiftKey && event.key.toLowerCase() === 'e') return 'toggleAi';
  switch (event.key.toLowerCase()) {
    case 's':
      return 'save';
    case 'k':
      return 'search';
    case 'b':
      return 'toggleSidebar';
    case '\\':
      return 'cycleMode';
    default:
      return null;
  }
}
