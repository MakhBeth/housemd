import type { ChatMessage } from '../../ai/types';
import type { Params } from '../../i18n/i18n';

type Translate = (key: string, params?: Params) => string;

/** Un messaggio della chat come lo mostra hmd-ai-chat-log, nell'ordine dei figli di ChatLog.tsx. */
export interface ChatEntry {
  id: string;
  /** Pulsante del documento: solo quando il documento cambia rispetto al messaggio prima. */
  file: string | null;
  role: 'user' | 'assistant';
  /** Utente: testo semplice. Assistente: markdown da rendere con safeRender (mai HTML grezzo). */
  text: string;
  /** Riepilogo del preset, errore, avvisi dei controlli, in quest'ordine. */
  notices: string[];
  /** Etichetta di «Riprova» (richiesta fallita), null se il pulsante non c'è. */
  retry: string | null;
  /** Etichetta di «Reimposta · Riprova» (parametro rifiutato), null se il pulsante non c'è. */
  reset: string | null;
  /** Profilo · modello · token, solo per le risposte (anche vuoto); null per l'utente. */
  meta: string | null;
}

export function chatEntries(messages: readonly ChatMessage[], t: Translate): ChatEntry[] {
  return messages.map((m, i) => ({
    id: m.id,
    file: m.docPath && m.docPath !== messages[i - 1]?.docPath ? m.docPath : null,
    role: m.role,
    text: m.role === 'user' ? m.text : m.text || t(m.status === 'done' ? 'ai.proposalReady' : 'ai.working'),
    notices: [
      ...(m.summary ? [`${m.summary.parts} · ${m.summary.originalWords} → ${m.summary.proposalWords} ${t('ai.words')}`] : []),
      ...(m.error ? [t(`ai.error.${m.error}`)] : []),
      ...(m.warnings ?? []).map((w) => t(`ai.warning.${w.code}`)),
    ],
    retry: m.status === 'error' ? t('ai.retry') : null,
    reset: m.error === 'paramRejected' ? `${t('ai.reset')} · ${t('ai.retry')}` : null,
    meta:
      m.role === 'assistant'
        ? [m.profileName, m.model, m.usage?.inputTokens !== undefined ? `${m.usage.inputTokens} → ${m.usage.outputTokens ?? 0}` : ''].filter(Boolean).join(' · ')
        : null,
  }));
}
