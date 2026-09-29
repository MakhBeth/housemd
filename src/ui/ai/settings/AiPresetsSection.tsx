// src/ui/ai/settings/AiPresetsSection.tsx
import { useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../../ai/aiController';
import { builtInPresets, restorePreset } from '../../../ai/presets';
import { defaultProfile } from '../../../ai/profiles';
import type { PromptPreset } from '../../../ai/types';
import { useT } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Parameters } from '../Parameters';
import { ItemList, useDraft } from './ItemList';
import styles from './Settings.module.css';

export function AiPresetsSection({ controller, onDirty }: { controller: AiController; onDirty?: (dirty: boolean) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { draft, setDraft, markSaved, select, pending, confirmSwitch, cancelSwitch } = useDraft<PromptPreset>(onDirty);
  const [deleting, setDeleting] = useState(false);
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));
  const name = (p: PromptPreset) => p.name || t(`ai.preset.${p.builtInId}` as MessageKey);
  const sorted = [...state.presets].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.split}>
      <ItemList
        items={sorted}
        selectedId={draft?.id ?? null}
        label={name}
        onSelect={(p) => select({ ...p })}
        onCreate={() =>
          select({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: state.presets.length })
        }
      />
      {draft && (
        <div className={styles.detail}>
          <label>
            <span>{t('ai.name')}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.instructions')}</span>
            <textarea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.targetLanguage')}</span>
            <input value={draft.variables?.targetLanguage ?? ''} onChange={(e) => setDraft({ ...draft, variables: { targetLanguage: e.target.value } })} />
          </label>
          <label>
            <span>{t('ai.strategy')}</span>
            <select value={draft.strategy} onChange={(e) => setDraft({ ...draft, strategy: e.target.value as PromptPreset['strategy'] })}>
              {(['whole', 'chunked'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`ai.strategy.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.frontmatter')}</span>
            <select value={draft.frontmatter} onChange={(e) => setDraft({ ...draft, frontmatter: e.target.value as PromptPreset['frontmatter'] })}>
              {(['keep', 'include'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`ai.frontmatter.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.order')}</span>
            <input type="number" min="0" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label>
            <input type="checkbox" checked={draft.hidden} onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })} />
            {t('ai.hidden')}
          </label>
          <Parameters profile={defaultProfile()} value={draft.params ?? {}} onChange={(params) => setDraft({ ...draft, params })} />
          <div className={styles.actions}>
            <button type="button" onClick={() => setDraft({ ...draft, id: crypto.randomUUID(), builtInId: undefined })}>
              {t('ai.duplicate')}
            </button>
            {draft.builtInId ? (
              <button type="button" onClick={() => setDraft(restorePreset(draft))}>
                {t('ai.restoreOriginal')}
              </button>
            ) : (
              <button type="button" onClick={() => setDeleting(true)}>
                {t('ai.delete')}
              </button>
            )}
            <button type="button" onClick={() => run(controller.savePreset(draft).then(() => markSaved(draft)))}>
              {t('ai.save')}
            </button>
          </div>
        </div>
      )}
      {deleting && draft && (
        <ConfirmDialog
          title={t('ai.deleteTitle', { name: name(draft) })}
          message={t('ai.deleteMessage')}
          confirmLabel={t('ai.delete')}
          onConfirm={() => {
            setDeleting(false);
            run(controller.deletePreset(draft.id).then(() => markSaved(null)));
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
