// src/ui/ai/EffortChip.tsx
import { useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { capabilities } from '../../ai/capabilities';
import { effectiveProfile } from '../../ai/profiles';
import type { GenParams } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Chip dell'effort: solo se il profilo lo supporta (Anthropic, o compatibile OpenAI con effort attivo). */
export function EffortChip({ controller }: { controller: AiController }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const profile = controller.profile();
  if (!profile) return null;
  const effective = effectiveProfile(profile, state.chat.overrides);
  if (!capabilities(effective.kind, effective.model, { effort: !!profile.params.effort }).effort) return null;
  const value = state.chat.overrides.effort ?? profile.params.effort ?? '';
  return (
    <select
      className={styles.chip}
      aria-label={t('ai.param.effort')}
      value={value}
      onChange={(e) => controller.override({ ...state.chat.overrides, effort: (e.target.value as GenParams['effort']) || undefined })}
    >
      <option value="">{t('ai.default')}</option>
      {EFFORTS.map((v) => (
        <option key={v}>{v}</option>
      ))}
    </select>
  );
}
