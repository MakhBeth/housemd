import { useRef, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { useI18nStore, useT } from '../../i18n/I18nProvider';
import type { SettingsSection } from '../../lib/route';
import { Icon } from '../Icon';
import { Composer, type ComposerHandle } from './Composer';
import styles from './AiSidebar.module.css';

interface Props {
  controller: AiController;
  text: string;
  selection: TextRange | null;
  getSelection: () => SelectionScope | undefined;
  onSettings: (section: SettingsSection) => void;
  syncNeedsPermission?: boolean;
}

export function AiSidebar({ controller, text, selection, getSelection, onSettings, syncNeedsPermission }: Props) {
  const t = useT();
  const i18nStore = useI18nStore();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const composer = useRef<ComposerHandle>(null);
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('ai.title')}</h2>
        <button
          type="button"
          className={`${styles.iconButton} tooltip`}
          aria-label={t('ai.newChat')}
          data-tooltip={t('ai.newChat')}
          disabled={state.chat.messages.length === 0 && !state.running}
          onClick={() => controller.newChat()}
        >
          <Icon name="newFile" />
        </button>
      </div>
      <hmd-ai-chat-log
        messages={state.chat.messages}
        i18n={i18nStore}
        onhmd-ai-open-file={(event) => void controller.workspace.openFile(event.detail.path)}
        onhmd-ai-retry={(event) => void controller.retry(event.detail.id, event.detail.removeRejected)}
      />
      <div className={styles.bottom}>
        {syncNeedsPermission && (
          <button type="button" className={styles.file} onClick={() => onSettings('ai-sync')}>
            ⚠ {t('ai.syncReactivate')}
          </button>
        )}
        <Composer ref={composer} controller={controller} text={text} selection={selection} getSelection={getSelection} onManage={() => onSettings('ai-profiles')} />
        <hmd-ai-suggestions controller={controller} i18n={i18nStore} onhmd-ai-suggestion={(event) => composer.current?.sendPreset(event.detail.presetId)} />
      </div>
    </div>
  );
}
