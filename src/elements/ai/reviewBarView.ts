import type { AcceptBlocker } from '../../ai/aiController';
import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';
import type { I18nStore } from '../../state/i18nStore';

/** Azioni della barra di revisione, mandate con `hmd-ai-review-action`. */
export type ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue';

/** Chiavi delle note della barra: una per ragione del controller (`ai.review.<ragione>`). */
export type ReviewBlocker = `ai.review.${AcceptBlocker}`;

/**
 * Perché l'azione non è possibile adesso (chiave della nota), o null. Le frecce e Scarta si fermano solo
 * durante la generazione (come i `disabled` di ReviewBar.tsx); Accetta tutto ha la ragione del controller
 * (`acceptBlocker(p, true)`, già nell'ordine della barra); Continua non si ferma mai qui (il controller
 * ignora in silenzio un Continua durante un aggiornamento: resta com'è, da rivedere in fase 8).
 */
export function actionBlocker(action: ReviewAction, status: ReviewStatus, acceptBlocker: AcceptBlocker | null): ReviewBlocker | null {
  if (action === 'acceptAll') return acceptBlocker ? `ai.review.${acceptBlocker}` : null;
  if (action === 'continue') return null;
  return isBusy(status) ? 'ai.review.generating' : null;
}

/** Testo e attributi dello span di stato (StatusText di ReviewBar.tsx), o null quando non c'è niente da dire. */
export interface StatusLine {
  text: string;
  /** `aria-live="polite"` solo durante la generazione (il contatore dei secondi). */
  live: boolean;
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
      return { text: `${t('ai.generating', { seconds: status.seconds })}${status.total ? ` ${status.done}/${status.total}` : ''}`, live: true, alert: false, withContinue: false };
    case 'partial':
      return { text: t('ai.status.partial'), live: false, alert: false, withContinue: true };
    case 'truncated':
      return { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false };
    case 'scopeLost':
      return { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false };
    case 'applied':
      return { text: t('ai.applied'), live: false, alert: false, withContinue: false };
  }
}
