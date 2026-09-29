import { forwardRef, useImperativeHandle, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { composerAction } from '../../ai/composerKeys';
import { sameRange, selectionLabel, type TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { Icon } from '../Icon';
import { EffortChip } from './EffortChip';
import { ModelChip } from './ModelChip';
import styles from './Composer.module.css';

export interface ComposerHandle {
  sendPreset(presetId: string): void;
}

interface Props {
  controller: AiController;
  /** Testo del documento corrente, per l'etichetta della selezione. */
  text: string;
  selection: TextRange | null;
  /** Scope calcolato al momento dell'invio dalla sessione dell'editor (invariato rispetto a prima). */
  getSelection: () => SelectionScope | undefined;
  onManage: () => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ controller, text, selection, getSelection, onManage }, ref) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [request, setRequest] = useState('');
  const [ignored, setIgnored] = useState<TextRange | null>(null);
  const label = selectionLabel(text, selection);
  const scoped = label !== null && !sameRange(ignored, selection);
  const running = !!state.running;

  const send = (presetId?: string) => {
    if (running) return;
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    const message = preset ? preset.name || t(`ai.preset.${preset.builtInId}` as MessageKey) : request.trim();
    if (!message || !controller.profile()) return;
    const scope = scoped ? getSelection() : undefined;
    if (scoped && !scope) return controller.report({ code: 'scopeLost' });
    void controller.send(message, preset, scope).catch((e) => controller.report(e));
    if (!preset) setRequest('');
  };

  // Senza deps di proposito: deve vedere sempre l'ultimo `send`.
  useImperativeHandle(ref, () => ({ sendPreset: (id) => send(id) }));

  return (
    <div className={styles.composer}>
      {scoped && label && (
        <span className={styles.selection}>
          {label.lines > 1 ? t('ai.selectionLines', { count: label.lines }) : t('ai.selectionChars', { count: label.chars })}
          <button
            type="button"
            className={`${styles.selectionClose} tooltip`}
            aria-label={t('ai.selectionIgnore')}
            data-tooltip={t('ai.selectionIgnore')}
            onClick={() => setIgnored(selection)}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      )}
      <textarea
        className={styles.input}
        aria-label={t('ai.request')}
        placeholder={t('ai.request')}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        onKeyDown={(e) => {
          const action = composerAction(
            { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.nativeEvent.isComposing },
            running,
          );
          if (action === 'send') {
            e.preventDefault();
            send();
          } else if (action === 'stop') {
            e.preventDefault();
            controller.stop();
          }
        }}
      />
      <div className={styles.row}>
        <ModelChip controller={controller} onManage={onManage} />
        <EffortChip controller={controller} />
        {running ? (
          <button type="button" className={`${styles.send} tooltip`} aria-label={t('ai.stop')} data-tooltip={t('ai.stop')} onClick={() => controller.stop()}>
            <Icon name="stop" size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.send} tooltip`}
            aria-label={t('ai.send')}
            data-tooltip={t('ai.send')}
            disabled={!request.trim() || !controller.profile()}
            onClick={() => send()}
          >
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
    </div>
  );
});
