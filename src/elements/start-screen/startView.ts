import type { UnsupportedReason } from '../../fs/access';
import type { Params } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';

export type StartMode = 'unsupported' | 'start' | 'resume';

export interface StartView {
  message: { key: MessageKey; params?: Params } | null;
  /**
   * Pulsanti nell'ordine in cui compaiono: `pick` primario, `resume` primario, `pick-other` secondario, `pick-file`
   * («Apri un file») secondario, oppure primario dove le cartelle non si aprono.
   */
  buttons: readonly ('pick' | 'resume' | 'pick-other' | 'pick-file')[];
}

/** Cosa mostra la schermata iniziale per modalità (era il calcolo inline di StartScreen.tsx). */
export function startView({ mode, reason, error }: { mode: StartMode; reason?: UnsupportedReason; error?: string }): StartView {
  const failed = error !== undefined ? { key: 'start.openError' as const, params: { detail: error } } : null;
  // Senza cartelle resta il file singolo: il motivo, poi (dopo un'apertura fallita) l'errore al suo posto.
  if (mode === 'unsupported') return { message: failed ?? { key: `unsupported.${reason ?? 'other'}` as MessageKey }, buttons: ['pick-file'] };
  return { message: failed, buttons: mode === 'start' ? ['pick', 'pick-file'] : ['resume', 'pick-other', 'pick-file'] };
}
