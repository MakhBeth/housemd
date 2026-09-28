/**
 * Salvataggio automatico configurabile, come in VS Code (puro).
 * - afterDelay: salva dopo una pausa, al blur della finestra e al cambio file (default);
 * - onFocusChange: niente salvataggi a tempo; salva solo al cambio file e al blur della finestra;
 * - off: mai su disco da solo, solo Ctrl+S e "Salva tutto".
 * Quando la politica non consente di scrivere su disco, il Workspace mette il testo nel buffer di
 * emergenza (checkpoint), così un crash perde al massimo gli ultimi ~5 s di digitazione.
 */

export type AutosaveMode = 'afterDelay' | 'onFocusChange' | 'off';
export const AUTOSAVE_MODES: readonly AutosaveMode[] = ['afterDelay', 'onFocusChange', 'off'];

export interface AutosaveSettings {
  mode: AutosaveMode;
  delayMs: number;
}

/** Ogni momento in cui il Workspace scriverebbe su disco senza un comando esplicito dell'utente. */
export type AutosaveTrigger =
  | 'timer'
  | 'blur'
  | 'switch'
  | 'resume'
  | 'restoredDraft'
  | 'afterRename'
  | 'afterWrite'
  | 'afterExternal';

export const AUTOSAVE_TRIGGERS: readonly AutosaveTrigger[] = [
  'timer',
  'blur',
  'switch',
  'resume',
  'restoredDraft',
  'afterRename',
  'afterWrite',
  'afterExternal',
];

export const MIN_DELAY_MS = 500;
export const MAX_DELAY_MS = 10_000;
export const DEFAULT_AUTOSAVE: AutosaveSettings = { mode: 'afterDelay', delayMs: 1000 };

/** Checkpoint del buffer di emergenza nelle modalità senza salvataggio a tempo. */
export const CHECKPOINT_DEBOUNCE_MS = 1000;
export const CHECKPOINT_MAX_WAIT_MS = 5000;

const FOCUS_TRIGGERS: ReadonlySet<AutosaveTrigger> = new Set<AutosaveTrigger>(['blur', 'switch']);

export function autosaveAllows(mode: AutosaveMode, trigger: AutosaveTrigger): boolean {
  switch (mode) {
    case 'afterDelay':
      return true;
    case 'onFocusChange':
      return FOCUS_TRIGGERS.has(trigger);
    case 'off':
      return false;
  }
}

export function clampDelay(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_AUTOSAVE.delayMs;
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, Math.round(ms)));
}

/** Preferenza salvata → impostazioni valide (valori sconosciuti → default, ritardo nel range). */
export function parseAutosave(raw: unknown): AutosaveSettings {
  const value = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const mode = AUTOSAVE_MODES.includes(value.mode as AutosaveMode) ? (value.mode as AutosaveMode) : DEFAULT_AUTOSAVE.mode;
  const delayMs = typeof value.delayMs === 'number' ? clampDelay(value.delayMs) : DEFAULT_AUTOSAVE.delayMs;
  return { mode, delayMs };
}
