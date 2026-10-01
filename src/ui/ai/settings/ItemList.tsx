// src/ui/ai/settings/ItemList.tsx
import { useEffect, useState } from 'react';

import { useT } from '../../../i18n/I18nProvider';
import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../../state/draftState';
import styles from './Settings.module.css';

interface Props<T extends { id: string }> {
  items: T[];
  selectedId: string | null;
  label: (item: T) => string;
  onSelect: (item: T) => void;
  onCreate: () => void;
}

export function ItemList<T extends { id: string }>({ items, selectedId, label, onSelect, onCreate }: Props<T>) {
  const t = useT();
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <button key={item.id} type="button" className={styles.item} aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => onSelect(item)}>
          {label(item)}
        </button>
      ))}
      <button type="button" className={styles.create} onClick={onCreate}>
        + {t('ai.create')}
      </button>
    </div>
  );
}

/** Adattatore React di `state/draftState.ts`: stessa API di prima per le sezioni profili e preset. */
export function useDraft<T>(onDirty?: (dirty: boolean) => void) {
  const [state, setState] = useState<DraftState<T>>(emptyDraft);
  const dirty = isDirty(state);

  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  return {
    draft: state.draft,
    dirty,
    setDraft: (item: T) => setState((s) => editDraft(s, item)),
    /** Dopo un salvataggio riuscito: la bozza corrente diventa il riferimento. */
    markSaved: (item: T | null) => setState((s) => openDraft(s, item)),
    select: (item: T | null) => setState((s) => selectDraft(s, item)),
    pending: state.pending !== null,
    confirmSwitch: () => setState(confirmSwitch),
    cancelSwitch: () => setState(cancelSwitch),
  };
}
