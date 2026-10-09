import type { UnsupportedReason } from '../../fs/access';
import type { Params } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';

export type StartMode = 'unsupported' | 'start' | 'resume';

export interface StartView {
  message: { key: MessageKey; params?: Params } | null;
  /** Pulsanti nell'ordine in cui compaiono: `pick` primario, `resume` primario, `pick-other` secondario. */
  buttons: readonly ('pick' | 'resume' | 'pick-other')[];
}

/** Cosa mostra la schermata iniziale per modalità (era il calcolo inline di StartScreen.tsx). */
export function startView({ mode, reason, error }: { mode: StartMode; reason?: UnsupportedReason; error?: string }): StartView {
  if (mode === 'unsupported') return { message: { key: `unsupported.${reason ?? 'other'}` as MessageKey }, buttons: [] };
  const message = error !== undefined ? { key: 'start.openError' as const, params: { detail: error } } : null;
  return { message, buttons: mode === 'start' ? ['pick'] : ['resume', 'pick-other'] };
}
