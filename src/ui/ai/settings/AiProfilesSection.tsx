// src/ui/ai/settings/AiProfilesSection.tsx
import { useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../../ai/aiController';
import { changeProvider } from '../../../ai/models';
import { DEFAULT_URLS, defaultProfile, PROVIDER_KINDS, validateProfile } from '../../../ai/profiles';
import type { ModelProfile, ProviderKind } from '../../../ai/types';
import { useT } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { ConfirmDialog } from '../../ConfirmDialog';
import { ModelSelect } from '../ModelSelect';
import { Parameters } from '../Parameters';
import { ItemList, useDraft } from './ItemList';
import styles from './Settings.module.css';

export function AiProfilesSection({ controller, onDirty }: { controller: AiController; onDirty?: (dirty: boolean) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { draft, setDraft, markSaved, select, pending, confirmSwitch, cancelSwitch } = useDraft<ModelProfile>(onDirty);
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));
  const pick = (profile: ModelProfile | null) => {
    select(profile && { ...profile, params: { ...profile.params } });
    setKey('');
    setConnected(false);
  };

  const testConnection = (profile: ModelProfile) => {
    setConnected(false);
    run(
      controller.provider(profile).then(async (p) => {
        const signal = new AbortController().signal;
        if (p.testConnection) await p.testConnection(signal);
        else if ((await p.listModels(signal)) === null) throw { code: 'unreachable' };
        setConnected(true);
      }),
    );
  };

  return (
    <div className={styles.split}>
      <ItemList
        items={state.profiles}
        selectedId={draft?.id ?? null}
        label={(p) => p.name}
        onSelect={pick}
        onCreate={() => pick(defaultProfile('ollama', crypto.randomUUID()))}
      />
      {draft && (
        <div className={styles.detail}>
          <label>
            <span>{t('ai.name')}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.provider')}</span>
            <select
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as ProviderKind;
                setDraft({ ...changeProvider(draft, kind), baseUrl: DEFAULT_URLS[kind] });
                setKey('');
              }}
            >
              {PROVIDER_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.url')}</span>
            <input type="url" disabled={draft.kind === 'anthropic'} value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
          </label>
          <p className={styles.help}>{t(`ai.help.${draft.kind}` as MessageKey)}</p>
          <ModelSelect controller={controller} profile={draft} onChange={(selection) => setDraft({ ...draft, ...selection })} />
          <Parameters profile={draft} value={draft.params} onChange={(params) => setDraft({ ...draft, params })} />
          <label>
            <span>{t('ai.contextTokens')}</span>
            <input
              type="number"
              min="1"
              value={draft.contextTokens ?? ''}
              onChange={(e) => setDraft({ ...draft, contextTokens: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          {['ollama', 'lmstudio', 'openai-compatible'].includes(draft.kind) && (
            <label>
              <input
                type="checkbox"
                checked={!!draft.params.effort}
                onChange={(e) => setDraft({ ...draft, params: { ...draft.params, effort: e.target.checked ? 'medium' : undefined } })}
              />
              {t('ai.enableEffort')}
            </label>
          )}
          {['anthropic', 'openai-compatible'].includes(draft.kind) && (
            <>
              <label>
                <span>{t('ai.secret')}</span>
                <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
              </label>
              <label>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('ai.remember')}
              </label>
              <p className={styles.help}>{t('ai.secretNotice')}</p>
              <button
                type="button"
                disabled={!key}
                onClick={() =>
                  run(
                    controller.setSecret(validateProfile(draft), key, remember).then(() => {
                      setKey('');
                      markSaved(controller.getState().profiles.find((p) => p.id === draft.id) ?? draft);
                    }),
                  )
                }
              >
                {t('ai.saveSecret')}
              </button>
            </>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={() => testConnection(draft)}>
              {t('ai.connection')}
            </button>
            <button type="button" onClick={() => setDraft({ ...draft, id: crypto.randomUUID(), secretId: null })}>
              {t('ai.duplicate')}
            </button>
            <button type="button" onClick={() => setDeleting(true)}>
              {t('ai.delete')}
            </button>
            <button
              type="button"
              onClick={() => {
                const valid = validateProfile(draft);
                run(controller.saveProfile(valid).then(() => markSaved(valid)));
              }}
            >
              {t('ai.save')}
            </button>
          </div>
          {connected && <p role="status">{t('ai.connected')}</p>}
        </div>
      )}
      {deleting && draft && (
        <ConfirmDialog
          title={t('ai.deleteTitle', { name: draft.name })}
          message={t('ai.deleteMessage')}
          confirmLabel={t('ai.delete')}
          onConfirm={() => {
            setDeleting(false);
            run(controller.deleteProfile(draft.id).then(() => markSaved(null)));
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
      {pending && (
        <ConfirmDialog title={t('ai.unsavedTitle')} message={t('ai.unsavedMessage')} confirmLabel={t('ai.discardChanges')} onConfirm={confirmSwitch} onCancel={cancelSwitch} />
      )}
    </div>
  );
}
