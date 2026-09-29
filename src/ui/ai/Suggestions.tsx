import { useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import styles from './Composer.module.css';

/** Preset visibili come suggerimenti: solo con la chat vuota, tornano con Nuova chat. */
export function Suggestions({ controller, onSend }: { controller: AiController; onSend: (presetId: string) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  if (state.chat.messages.length > 0 || state.running) return null;
  const presets = state.presets.filter((p) => !p.hidden).sort((a, b) => a.order - b.order);
  if (presets.length === 0) return null;
  return (
    <div className={styles.suggestions} role="group" aria-label={t('ai.suggestions')}>
      {presets.map((p) => (
        <button key={p.id} type="button" className={styles.suggestion} onClick={() => onSend(p.id)}>
          {p.name || t(`ai.preset.${p.builtInId}` as MessageKey)}
        </button>
      ))}
    </div>
  );
}
