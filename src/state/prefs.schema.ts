import * as z from 'zod/mini';

import { WIDTH_LIMITS, type Mode } from '../elements/workspace/layout';

/**
 * Preferenze in localStorage che prima si leggevano senza controllo (`JSON.parse(raw) as T`). Un
 * valore di un'altra versione o modificato a mano ricade sul default invece di rompere la griglia.
 * Tema, lingua, autosalvataggio e larghezza del testo hanno già i loro parse* e restano lì.
 */
export const PREFS = {
  mode: { schema: z.enum(['editor', 'split', 'preview', 'ai'] as const satisfies readonly Mode[]), fallback: 'split' as Mode },
  sidebarOpen: { schema: z.boolean(), fallback: true },
  sidebarWidth: { schema: z.number(), fallback: WIDTH_LIMITS.sidebar.initial },
  aiSidebarWidth: { schema: z.number(), fallback: WIDTH_LIMITS.ai.initial },
  aiProfile: { schema: z.string(), fallback: '' },
} as const;

export type PrefKey = keyof typeof PREFS;
export type PrefValue<K extends PrefKey> = z.output<(typeof PREFS)[K]['schema']>;

/** Ultimo file aperto per cartella (`lastFile:<workspaceId>`). */
export const LAST_FILE = z.nullable(z.string());
