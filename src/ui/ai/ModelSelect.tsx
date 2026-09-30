// src/ui/ai/ModelSelect.tsx
import { useEffect, useState } from 'react';

import type { AiController } from '../../ai/aiController';
import { modelOptions } from '../../ai/models';
import { modelSelection } from '../../ai/profiles';
import type { ModelOption, ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

interface Props {
  controller: AiController;
  profile: ModelProfile;
  onChange: (selection: Pick<ModelProfile, 'model' | 'contextTokens'>) => void;
}

export function ModelSelect({ controller, profile, onChange }: Props) {
  const t = useT();
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setModels(null);
    void controller
      .provider(profile)
      .then((p) => p.listModels(abort.signal))
      .then((list) => {
        if (abort.signal.aborted) return;
        setModels(list);
        if (!list) setError(true);
      })
      .catch((e) => {
        if (abort.signal.aborted) return;
        setError(true);
        controller.report(e);
      });
    return () => abort.abort();
  }, [profile.kind, profile.baseUrl, profile.secretId, revision, controller]);

  const select = (value: string) => onChange(modelSelection(profile, value, models?.find((m) => m.value === value)));

  return (
    <div className={styles.popoverSection}>
      <label>
        <span>{t('ai.model')}</span>
        <select
          value={custom ? '__custom' : profile.model}
          onChange={(e) => {
            if (e.target.value === '__custom') return setCustom(true);
            setCustom(false);
            select(e.target.value);
          }}
        >
          <option value="">{profile.kind === 'claude-code' ? t('ai.cliDefault') : t('ai.chooseModel')}</option>
          {modelOptions(profile.kind, profile.model, models)
            .filter((m) => m.value)
            .map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          <option value="__custom">{t('ai.other')}</option>
        </select>
      </label>
      {custom && <input aria-label={t('ai.model')} value={profile.model} onChange={(e) => select(e.target.value)} />}
      <button type="button" className={styles.link} onClick={() => setRevision((r) => r + 1)}>
        {t('ai.refresh')}
      </button>
      {error && <small>{t('ai.error.unreachable')}</small>}
    </div>
  );
}
