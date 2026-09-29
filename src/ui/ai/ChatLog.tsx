// src/ui/ai/ChatLog.tsx
import { useEffect, useRef } from 'react';

import { safeRender } from '../../ai/safeRender';
import type { ChatMessage } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { setSafeHTML } from '../../preview/sanitize';
import styles from './AiSidebar.module.css';

/** Markdown della risposta: rendering sicuro (niente HTML grezzo, immagini remote come etichetta, mai caricate). */
function Markdown({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (ref.current) void setSafeHTML(ref.current, safeRender(text));
    });
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return <div ref={ref} />;
}

interface Props {
  messages: ChatMessage[];
  onOpen: (path: string) => void;
  onRetry: (id: string, removeRejected?: boolean) => void;
}

export function ChatLog({ messages, onOpen, onRetry }: Props) {
  const t = useT();
  return (
    <div className={styles.log} role="log">
      {messages.map((m, i) => (
        <article key={m.id} className={styles.message} tabIndex={0}>
          {m.docPath && m.docPath !== messages[i - 1]?.docPath && (
            <button type="button" className={styles.file} onClick={() => onOpen(m.docPath!)}>
              {m.docPath}
            </button>
          )}
          {m.role === 'user' ? (
            <p className={styles.user}>{m.text}</p>
          ) : (
            <div className={styles.assistant}>
              <Markdown text={m.text || (m.status === 'done' ? t('ai.proposalReady') : t('ai.working'))} />
            </div>
          )}
          {m.summary && (
            <p className={styles.notice}>
              {m.summary.parts} · {m.summary.originalWords} → {m.summary.proposalWords} {t('ai.words')}
            </p>
          )}
          {m.error && <p className={styles.notice}>{t(`ai.error.${m.error}` as MessageKey)}</p>}
          {m.warnings?.map((w, j) => (
            <p key={j} className={styles.notice}>
              {t(`ai.warning.${w.code}` as MessageKey)}
            </p>
          ))}
          {m.status === 'error' && (
            <button type="button" className={styles.file} onClick={() => onRetry(m.id)}>
              {t('ai.retry')}
            </button>
          )}
          {m.error === 'paramRejected' && (
            <button type="button" className={styles.file} onClick={() => onRetry(m.id, true)}>
              {t('ai.reset')} · {t('ai.retry')}
            </button>
          )}
          {m.role === 'assistant' && (
            <small className={styles.meta}>
              {[m.profileName, m.model, m.usage?.inputTokens !== undefined ? `${m.usage.inputTokens} → ${m.usage.outputTokens ?? 0}` : '']
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
        </article>
      ))}
    </div>
  );
}
