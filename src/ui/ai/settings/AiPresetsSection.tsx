// src/ui/ai/settings/AiPresetsSection.tsx
import { useSyncExternalStore } from 'react';

import { showConfirmDialog, showDiscardChangesDialog } from '../../../elements/dialogs/confirmDialog';
import type { AiController } from '../../../ai/aiController';
import { presetLabel } from '../../../ai/presetName';
import { builtInPresets, restorePreset } from '../../../ai/presets';
import { defaultProfile } from '../../../ai/profiles';
import type { PromptPreset } from '../../../ai/types';
import { useI18nStore, useT } from '../../../i18n/I18nProvider';
import { useUnmountSignal } from '../../useUnmountSignal';
import { ItemList, useDraft } from './ItemList';
import styles from './Settings.module.css';

export function AiPresetsSection({ controller, onDirty }: { controller: AiController; onDirty?: (dirty: boolean) => void }) {
  const t = useT();
  const i18nStore = useI18nStore();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { draft, dirty, setDraft, markSaved, select, confirmSwitch, cancelSwitch } = useDraft<PromptPreset>(onDirty);
  const dialogSignal = useUnmountSignal();
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));
  const name = (p: PromptPreset) => presetLabel(p, t);
  const sorted = [...state.presets].sort((a, b) => a.order - b.order);
  const choose = (preset: PromptPreset) => {
    select(preset);
    if (dirty) void showDiscardChangesDialog({ t, signal: dialogSignal() }).then((discard) => (discard ? confirmSwitch() : cancelSwitch()));
  };
  const remove = (preset: PromptPreset) =>
    void showConfirmDialog({ title: t('ai.deleteTitle', { name: name(preset) }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal: dialogSignal() }).then((ok) => {
      if (ok) run(controller.deletePreset(preset.id).then(() => markSaved(null)));
    });

  return (
    <div className={styles.split}>
      <ItemList
        items={sorted}
        selectedId={draft?.id ?? null}
        label={name}
        onSelect={(p) => choose({ ...p })}
        onCreate={() =>
          choose({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: state.presets.length })
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
          <hmd-ai-parameters profile={defaultProfile()} value={draft.params ?? {}} i18n={i18nStore} onhmd-params-change={(event) => setDraft({ ...draft, params: event.detail.params })} />
          <div className={styles.actions}>
            <button type="button" onClick={() => setDraft({ ...draft, id: crypto.randomUUID(), builtInId: undefined, name: name(draft) })}>
              {t('ai.duplicate')}
            </button>
            {draft.builtInId ? (
              <button type="button" onClick={() => setDraft(restorePreset(draft))}>
                {t('ai.restoreOriginal')}
              </button>
            ) : (
              <button type="button" onClick={() => remove(draft)}>
                {t('ai.delete')}
              </button>
            )}
            <button type="button" onClick={() => run(controller.savePreset(draft).then(() => markSaved(draft)))}>
              {t('ai.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
