// src/ui/ai/ModelChip.tsx
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { effectiveProfile, isLocalProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import { writePref } from '../../lib/prefs';
import { Icon } from '../Icon';
import { ModelSelect } from './ModelSelect';
import { Parameters } from './Parameters';
import styles from './Composer.module.css';

interface Props {
  controller: AiController;
  /** Apre #settings/ai-profiles. */
  onManage: () => void;
}

const autoPopover = { popover: 'auto' } as Record<string, string>;

function privacyNote(t: ReturnType<typeof useT>, profile: ModelProfile): string {
  if (profile.kind === 'claude-code') return t('ai.claudePrivacy');
  if (isLocalProfile(profile)) return t('ai.localPrivacy');
  let host = '';
  try {
    host = new URL(profile.baseUrl).host;
  } catch {
    // URL non valido: la nota resta senza host.
  }
  return t('ai.cloudPrivacy', { host });
}

export function ModelChip({ controller, onManage }: Props) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const profile = controller.profile();
  const overrides = state.chat.overrides;
  const effective = profile ? effectiveProfile(profile, overrides) : null;

  // L'elenco dei modelli si carica solo a popover aperto (niente richieste di rete a ogni render).
  useEffect(() => {
    const el = popover.current;
    if (!el) return;
    const toggle = () => setOpened(el.matches(':popover-open'));
    el.addEventListener('toggle', toggle);
    return () => el.removeEventListener('toggle', toggle);
  }, [profile?.id]);

  if (!profile || !effective) {
    return (
      <button type="button" className={styles.chip} onClick={onManage}>
        {t('ai.manage')}
      </button>
    );
  }

  const label = `${profile.name} · ${effective.model || t('ai.cliDefault')}`;
  const changed = Object.keys(overrides).length > 0;
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));

  return (
    <span className={styles.chipAnchor}>
      <button
        type="button"
        className={`${styles.chip} tooltip`}
        data-tooltip={privacyNote(t, profile)}
        aria-label={`${t('ai.profile')}: ${label}`}
        {...{ popovertarget: id }}
      >
        {label}
        {changed && ' •'}
        <Icon name="chevronDown" size={12} />
      </button>
      <div ref={popover} id={id} {...autoPopover} className={styles.popover}>
        {[true, false].map((local) => {
          const group = state.profiles.filter((p) => isLocalProfile(p) === local);
          if (group.length === 0) return null;
          return (
            <fieldset key={String(local)} className={styles.popoverSection}>
              <legend>{t(local ? 'ai.local' : 'ai.cloud')}</legend>
              {group.map((p) => (
                <label key={p.id}>
                  <input
                    type="radio"
                    name={`${id}-profile`}
                    checked={p.id === profile.id}
                    onChange={() => {
                      controller.selectProfile(p.id);
                      writePref('aiProfile', p.id);
                    }}
                  />
                  {p.name}
                  {p.kind === 'anthropic' && !p.secretId && ' ⚠'}
                </label>
              ))}
            </fieldset>
          );
        })}
        {opened && <ModelSelect controller={controller} profile={effective} onChange={(selection) => controller.override({ ...overrides, ...selection })} />}
        <Parameters
          profile={effective}
          value={{ ...profile.params, ...overrides }}
          onChange={(params) => controller.override({ ...overrides, ...params })}
          hideEffort
        />
        <div className={styles.popoverActions}>
          <button type="button" onClick={() => run(controller.saveOverrides())}>
            {t('ai.saveProfile')}
          </button>
          <button type="button" onClick={() => run(controller.saveOverrides(true))}>
            {t('ai.saveAs')}
          </button>
          <button type="button" onClick={() => controller.override({})}>
            {t('ai.reset')}
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              popover.current?.hidePopover();
              onManage();
            }}
          >
            {t('ai.manage')}
          </button>
        </div>
      </div>
    </span>
  );
}
