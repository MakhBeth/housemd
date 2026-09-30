// src/ui/ai/settings/ItemList.tsx
import { useEffect, useState } from 'react';

import { useT } from '../../../i18n/I18nProvider';
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

/**
 * Bozza del dettaglio: `dirty` finché differisce dall'ultimo salvataggio; passare a un altro elemento
 * con modifiche aperte chiede conferma (`pending` finché l'utente non decide).
 */
export function useDraft<T>(onDirty?: (dirty: boolean) => void) {
  const [draft, setDraftState] = useState<T | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== saved;

  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  const open = (item: T | null) => {
    setDraftState(item);
    setSaved(item === null ? null : JSON.stringify(item));
  };
  return {
    draft,
    dirty,
    setDraft: (item: T) => setDraftState(item),
    /** Dopo un salvataggio riuscito: la bozza corrente diventa il riferimento. */
    markSaved: (item: T | null) => open(item),
    select: (item: T | null) => (dirty ? setPending(item) : open(item)),
    pending: pending !== null,
    confirmSwitch: () => {
      open(pending);
      setPending(null);
    },
    cancelSwitch: () => setPending(null),
  };
}
