import { match } from 'ts-pattern';

import type { Shortcut } from '../../ui/shortcuts';

/** Scorciatoie attive con le impostazioni aperte: una scorciatoia nuova obbliga a decidere qui. */
export function allowedInSettings(shortcut: Shortcut): boolean {
  return match(shortcut)
    .with('save', 'saveAll', () => true)
    .with('search', 'toggleAi', 'toggleSidebar', 'cycleMode', () => false)
    .exhaustive();
}
