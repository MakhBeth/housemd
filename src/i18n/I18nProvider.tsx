import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { writePref } from '../lib/prefs';
import { translate, type Locale, type Messages, type Params } from './i18n';
import { loadMessages, type MessageKey } from './messages';

export interface I18nValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey, params?: Params): string;
}

const I18nContext = createContext<I18nValue | null>(null);

interface Props {
  initialLocale: Locale;
  initialMessages: Messages;
  children: ReactNode;
}

export function I18nProvider({ initialLocale, initialMessages, children }: Props) {
  const [state, setState] = useState({ locale: initialLocale, messages: initialMessages });
  // Cambi di lingua rapidi: vince l'ultimo richiesto, non l'ultimo caricato.
  const request = useRef(0);

  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  const setLocale = useCallback((locale: Locale) => {
    const id = ++request.current;
    void loadMessages(locale).then(({ locale: loaded, messages }) => {
      if (id !== request.current) return;
      // Se il chunk richiesto è fallito, `loaded` è 'en': non si salva la scelta fallita.
      writePref('locale', loaded);
      setState({ locale: loaded, messages });
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale: state.locale, setLocale, t: (key, params) => translate(state.messages, key, params) }),
    [state, setLocale],
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
