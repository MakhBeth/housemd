import type { AcceptBlocker } from '../../ai/aiController';
import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';
import type { I18nStore } from '../../state/i18nStore';

/** Azioni della barra di revisione, mandate con `hmd-ai-review-action`. */
export type ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue';

/** Chiavi delle note della barra: una per ragione del controller (`ai.review.<ragione>`). */
export type ReviewBlocker = `ai.review.${AcceptBlocker}`;

/**
 * Perché l'azione non è possibile adesso (chiave della nota), o null. Le frecce si fermano solo durante la
 * generazione; Scarta non si ferma mai (durante la generazione il controller ferma e scarta: `discard()`);
 * Accetta tutto ha la ragione del controller (`acceptBlocker(p, true)`, già nell'ordine della barra);
 * Continua si ferma durante un aggiornamento, che il controller altrimenti ignorerebbe in silenzio.
 */
export function actionBlocker(action: ReviewAction, status: ReviewStatus, acceptBlocker: AcceptBlocker | null): ReviewBlocker | null {
  if (action === 'acceptAll') return acceptBlocker ? `ai.review.${acceptBlocker}` : null;
  if (action === 'continue') return acceptBlocker === 'updating' ? 'ai.review.updating' : null;
  if (action === 'discard') return null;
  return isBusy(status) ? 'ai.review.generating' : null;
}

/** Testo e attributi dello span di stato (StatusText di ReviewBar.tsx), o null quando non c'è niente da dire. */
export interface StatusLine {
  text: string;
  /**
   * Durante la generazione, il testo della regione live a parte (`span.spoken`, nascosto alla vista): fisso
   * all'avvio e nuovo solo quando cambia il progresso `n/m`. Il contatore dei secondi, visibile, non è più una
   * regione live (LAB-42 P1, WCAG 2.2.2). Null negli altri stati.
   */
  spoken: string | null;
  /** `role="alert"` solo per la selezione persa. */
  alert: boolean;
  /** Il pulsante «Continua» accanto, solo per una proposta a parti interrotta. */
  withContinue: boolean;
}

export function statusLine(status: ReviewStatus, t: I18nStore['t']): StatusLine | null {
  switch (status.kind) {
    case 'none':
      return null;
    case 'generating':
      return {
        text: `${t('ai.generating', { seconds: status.seconds })}${status.total ? ` ${status.done}/${status.total}` : ''}`,
        spoken: status.total ? t('ai.generatingProgress', { done: status.done ?? 0, total: status.total }) : t('ai.generatingStarted'),
        alert: false,
        withContinue: false,
      };
    case 'partial':
      return { text: t('ai.status.partial'), spoken: null, alert: false, withContinue: true };
    case 'truncated':
      return { text: t('ai.status.truncated'), spoken: null, alert: false, withContinue: false };
    case 'scopeLost':
      return { text: t('ai.error.scopeLost'), spoken: null, alert: true, withContinue: false };
    case 'applied':
      return { text: t('ai.applied'), spoken: null, alert: false, withContinue: false };
  }
}

/**
 * Quello che la regione nascosta dice quando la generazione finisce (LAB-42 P1, A11y): proposta pronta, parziale o
 * troncata. Null se non c'è una proposta (generazione fermata o fallita: lo dicono il registro e i toast) o se
 * l'esito ha già la sua regione (`scopeLost` è un `role="alert"`).
 */
export function generationOutcome(status: ReviewStatus, hasProposal: boolean, t: I18nStore['t']): string | null {
  if (!hasProposal) return null;
  switch (status.kind) {
    case 'none':
      return t('ai.proposalReady');
    case 'partial':
      return t('ai.status.partial');
    case 'truncated':
      return t('ai.status.truncated');
    default:
      return null;
  }
}
