import { useRef, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { SettingsSection } from '../../lib/route';
import { Icon } from '../Icon';
import { ChatLog } from './ChatLog';
import { Composer, type ComposerHandle } from './Composer';
import { Suggestions } from './Suggestions';
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
      <ChatLog
        messages={state.chat.messages}
        onOpen={(path) => void controller.workspace.openFile(path)}
        onRetry={(id, remove) => void controller.retry(id, remove)}
      />
      <div className={styles.bottom}>
        {syncNeedsPermission && (
          <button type="button" className={styles.file} onClick={() => onSettings('ai-sync')}>
            ⚠ {t('ai.syncReactivate')}
          </button>
        )}
        <Composer ref={composer} controller={controller} text={text} selection={selection} getSelection={getSelection} onManage={() => onSettings('ai-profiles')} />
        <Suggestions controller={controller} onSend={(id) => composer.current?.sendPreset(id)} />
      </div>
    </div>
  );
}
