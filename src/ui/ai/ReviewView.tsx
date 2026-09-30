// src/ui/ai/ReviewView.tsx
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { isBusy, reviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { Editor, type EditorProps } from '../../editor/Editor';
import { useT } from '../../i18n/I18nProvider';
import { ConfirmDialog } from '../ConfirmDialog';
import { DiffPane, type DiffHandle } from './DiffPane';
import { ReviewBar } from './ReviewBar';
import styles from './ReviewView.module.css';

interface Props {
  controller: AiController;
  editor: EditorProps & { path: string };
}

export function ReviewView({ controller, editor }: Props) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const diff = useRef<DiffHandle>(null);
  const [confirm, setConfirm] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const p = state.proposals.get(editor.path);

  useEffect(() => {
    const running = state.running;
    if (!running) return setElapsed(0);
    const tick = () => setElapsed(Math.floor((Date.now() - running.startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.running]);

  const warnings: CheckWarning[] = [...state.chat.messages].reverse().find((m) => m.role === 'assistant' && m.docPath === editor.path)?.warnings ?? [];
  const text = p ? (controller.proposalText(p) ?? p.text) : editor.text;
  const applied = !!p && p.status !== 'streaming' && text === editor.text;
  const status = reviewStatus({ path: editor.path, proposal: p, running: state.running, elapsedSeconds: elapsed, applied });
  const streaming = !p || status.kind === 'generating' || status.kind === 'scopeLost';
  const range = p?.scope ? { from: p.scope.from, to: p.scope.from + p.text.length } : undefined;

  const accept = () => {
    if (!p || !controller.beforeAccept(p, true)) return;
    const next = controller.proposalText(p);
    if (next !== null) diff.current?.replace(next);
    setConfirm(false);
  };
  const edit = (next: string) => {
    if (!p) return;
    if (!p.scope) return controller.edited(p.path, next);
    const suffix = editor.text.length - p.scope.to;
    controller.edited(p.path, next.slice(p.scope.from, suffix ? next.length - suffix : undefined));
  };

  if (!p) {
    return (
      <section className={styles.review}>
        {status.kind === 'generating' ? (
          <ReviewBar
            status={status}
            warnings={[]}
            onPrevious={() => {}}
            onNext={() => {}}
            onWarning={() => {}}
            canAccept={false}
            canDiscard={false}
            onAcceptAll={() => {}}
            onDiscard={() => {}}
            onContinue={() => {}}
          />
        ) : (
          <p className={styles.hint}>{t('ai.emptyProposal')}</p>
        )}
        <div className={styles.editor}>
          <Editor {...editor} />
        </div>
      </section>
    );
  }

  // Nessuna differenza rimasta (accettato tutto, a blocchi o in una volta): torna l'editor normale.
  // La proposta resta: se Ctrl+Z riporta il documento com'era, il diff ricompare.
  if (applied && status.kind === 'applied') {
    return (
      <section className={styles.review}>
        <div className={styles.editor}>
          <Editor {...editor} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.review}>
      <ReviewBar
        status={status}
        warnings={warnings}
        onPrevious={() => diff.current?.previous()}
        onNext={() => diff.current?.next()}
        onWarning={(w) => diff.current?.scrollToLine((w as { line?: number }).line ?? 0)}
        canAccept={controller.canAccept(p, true)}
        canDiscard={!isBusy(status)}
        onAcceptAll={() => (editor.text !== p.baseText && !p.scope ? setConfirm(true) : accept())}
        onDiscard={() => controller.discard(p.path)}
        onContinue={() => void controller.continue(p.path)}
      />
      {state.streamingPreview && (
        <details className={styles.stream}>
          <summary>{t('ai.streamingPreview')}</summary>
          <pre>{state.streamingPreview}</pre>
        </details>
      )}
      <DiffPane
        ref={diff}
        editor={editor}
        range={range}
        proposal={text}
        canAccept={controller.canAccept(p)}
        streaming={streaming}
        beforeAccept={() => controller.beforeAccept(p)}
        onEdit={edit}
        acceptLabel={t('ai.acceptBlock')}
        rejectLabel={t('ai.rejectBlock')}
        onAllRejected={() => controller.discard(p.path)}
      />
      {confirm && (
        <ConfirmDialog title={t('ai.acceptAll')} message={t('ai.changedWarning')} confirmLabel={t('ai.acceptAll')} onConfirm={accept} onCancel={() => setConfirm(false)} />
      )}
    </section>
  );
}
