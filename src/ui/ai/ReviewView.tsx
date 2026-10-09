// src/ui/ai/ReviewView.tsx
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { isBusy, reviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { showConfirmDialog } from '../../elements/dialogs/confirmDialog';
import type { HmdEditor } from '../../elements/editor/editor.element';
import type { HmdEvents } from '../../elements/events';
import { useI18nStore, useT } from '../../i18n/I18nProvider';
import { useUnmountSignal } from '../useUnmountSignal';
import { DiffPane, type DiffHandle } from './DiffPane';
import { ReviewBar } from './ReviewBar';
import styles from './ReviewView.module.css';
import type { ReviewDoc } from './reviewDoc';

interface Props {
  controller: AiController;
  editor: ReviewDoc;
}

export function ReviewView({ controller, editor }: Props) {
  const t = useT();
  const i18nStore = useI18nStore();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const diff = useRef<DiffHandle>(null);
  const plain = useRef<HmdEditor>(null);
  const section = useRef<HTMLElement>(null);
  const shownView = useRef<'plain' | 'diff' | null>(null);
  const dialogSignal = useUnmountSignal();
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
  const view: 'plain' | 'diff' = !p || (applied && status.kind === 'applied') ? 'plain' : 'diff';

  // Passando tra diff ed editor normale (accettato tutto, Ctrl+Z che fa ricomparire il diff…) il focus
  // segue l'editor nuovo, se prima era nella revisione: così il Ctrl+Z successivo arriva ancora a CodeMirror.
  // useEffect (non layout): gli effetti dei figli, che creano gli editor, sono già stati eseguiti.
  useEffect(() => {
    const previous = shownView.current;
    shownView.current = view;
    if (previous === null || previous === view) return;
    const active = document.activeElement;
    if (active !== document.body && !section.current?.contains(active)) return;
    if (view === 'plain') plain.current?.focus();
    else diff.current?.focus();
  }, [view]);

  // Le stesse proprietà per l'editor semplice e per il lato documento del diff.
  const docProps = {
    text: editor.text,
    resetKey: editor.resetKey,
    session: editor.session,
    restore: editor.restore,
    readOnly: editor.readOnly,
    getDocs: editor.getDocs,
    saveImage: editor.saveImage,
    i18n: i18nStore,
    'onhmd-doc-change': (event: HmdEvents['hmd-doc-change']) => editor.docChanged(event.detail.changes, event.detail),
    'onhmd-selection': (event: HmdEvents['hmd-selection']) => editor.selectionChanged(event.detail.range),
  };

  const accept = () => {
    if (!p || !controller.beforeAccept(p, true)) return;
    const next = controller.proposalText(p);
    if (next !== null) diff.current?.replace(next);
  };
  // La conferma risponde dopo qualche render: si accetta con la proposta dell'ultimo, come faceva onConfirm.
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const edit = (next: string) => {
    if (!p) return;
    if (!p.scope) return controller.edited(p.path, next);
    const suffix = editor.text.length - p.scope.to;
    controller.edited(p.path, next.slice(p.scope.from, suffix ? next.length - suffix : undefined));
  };

  if (!p) {
    return (
      <section ref={section} className={styles.review}>
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
          <hmd-editor ref={plain} {...docProps} />
        </div>
      </section>
    );
  }

  // Nessuna differenza rimasta (accettato tutto, a blocchi o in una volta): torna l'editor normale.
  // La proposta resta: se Ctrl+Z riporta il documento com'era, il diff ricompare.
  if (applied && status.kind === 'applied') {
    return (
      <section ref={section} className={styles.review}>
        <div className={styles.editor}>
          <hmd-editor ref={plain} {...docProps} />
        </div>
      </section>
    );
  }

  return (
    <section ref={section} className={styles.review}>
      <ReviewBar
        status={status}
        warnings={warnings}
        onPrevious={() => diff.current?.previous()}
        onNext={() => diff.current?.next()}
        onWarning={(w) => diff.current?.scrollToLine((w as { line?: number }).line ?? 0)}
        canAccept={controller.canAccept(p, true)}
        canDiscard={!isBusy(status)}
        onAcceptAll={() => {
          if (editor.text === p.baseText || p.scope) return accept();
          void showConfirmDialog({ title: t('ai.acceptAll'), message: t('ai.changedWarning'), confirmLabel: t('ai.acceptAll'), t, signal: dialogSignal() }).then(
            (ok) => ok && acceptRef.current(),
          );
        }}
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
    </section>
  );
}
