import type { ReviewStatus } from '../../ai/reviewStatus';
import type { I18nStore } from '../../state/i18nStore';

/** Azioni della barra di revisione, mandate con `hmd-ai-review-action`. */
export type ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue';

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
