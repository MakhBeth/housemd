import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { writePref } from '../lib/prefs';
import { createI18nStore, type I18nStore } from '../state/i18nStore';
import { translate, type Locale, type Messages, type Params } from './i18n';
import { loadMessages, type MessageKey } from './messages';

export interface I18nValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey, params?: Params): string;
  /** Lo store stesso, da passare ai custom element come proprietà. */
  store: I18nStore;
}

const I18nContext = createContext<I18nValue | null>(null);

interface Props {
  initialLocale: Locale;
  initialMessages: Messages;
  children: ReactNode;
}

export function I18nProvider({ initialLocale, initialMessages, children }: Props) {
  const [store] = useState(() =>
    createI18nStore({
      locale: initialLocale,
      messages: initialMessages,
      load: loadMessages,
      persist: (locale) => writePref('locale', locale),
    }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getState);

  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale: state.locale,
      setLocale: (locale) => void store.setLocale(locale),
      t: (key, params) => translate(state.messages, key, params),
      store,
    }),
    [state, store],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n fuori da I18nProvider');
  return value;
}

export function useT(): I18nValue['t'] {
  return useI18n().t;
}

/** Lo store della lingua, per i custom element (che non leggono il Context di React). */
export function useI18nStore(): I18nStore {
  return useI18n().store;
}
