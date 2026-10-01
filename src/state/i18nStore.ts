import { translate, type Locale, type Messages, type Params } from '../i18n/i18n';
import type { LoadedMessages } from '../i18n/messages';

export interface I18nState {
  locale: Locale;
  messages: Messages;
}

/**
 * Lingua dell'interfaccia. Cambi rapidi: vince l'ultima richiesta, non l'ultima caricata. Si salva
 * la lingua effettivamente caricata (`en` se il chunk richiesto è fallito). `<html lang>` lo
 * aggiorna chi si iscrive, non lo store.
 */
export function createI18nStore(deps: {
  locale: Locale;
  messages: Messages;
  load(locale: Locale): Promise<LoadedMessages>;
  persist(locale: Locale): void;
}) {
  let state: I18nState = { locale: deps.locale, messages: deps.messages };
  let request = 0;
  const listeners = new Set<() => void>();

  return {
    getState: (): I18nState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    t: (key: string, params?: Params): string => translate(state.messages, key, params),
    async setLocale(locale: Locale): Promise<void> {
      const id = ++request;
      const { locale: loaded, messages } = await deps.load(locale);
      if (id !== request) return;
      deps.persist(loaded);
      state = { locale: loaded, messages };
      for (const listener of listeners) listener();
    },
  };
}

export type I18nStore = ReturnType<typeof createI18nStore>;
