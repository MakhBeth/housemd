// src/ui/ai/Parameters.tsx
import { capabilities } from '../../ai/capabilities';
import type { GenParams, ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

const NUMERIC = ['temperature', 'topP', 'maxOutputTokens', 'chunkChars'] as const;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

interface Props {
  profile: ModelProfile;
  value: GenParams;
  onChange: (params: GenParams) => void;
  /** Nel popover del modello l'effort ha il suo chip: qui non va ripetuto. */
  hideEffort?: boolean;
}

export function Parameters({ profile, value, onChange, hideEffort = false }: Props) {
  const t = useT();
  const caps = capabilities(profile.kind, profile.model, { effort: !!profile.params.effort });
  return (
    <div className={styles.popoverSection}>
      {NUMERIC.filter((k) => caps[k]).map((k) => {
        const unit = k === 'temperature' || k === 'topP';
        return (
          <label key={k}>
            <span>{t(`ai.param.${k}`)}</span>
            <input
              type="number"
              min={unit ? 0 : 1}
              max={k === 'temperature' ? 2 : k === 'topP' ? 1 : undefined}
              step={unit ? 0.1 : 1}
              value={value[k] ?? ''}
              onChange={(e) => onChange({ ...value, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </label>
        );
      })}
      {caps.effort && !hideEffort && (
        <label>
          <span>{t('ai.param.effort')}</span>
          <select value={value.effort ?? ''} onChange={(e) => onChange({ ...value, effort: (e.target.value as GenParams['effort']) || undefined })}>
            <option value="">{t('ai.default')}</option>
            {EFFORTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
