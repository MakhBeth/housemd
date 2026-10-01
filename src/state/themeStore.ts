import type { ThemePref } from '../theme/theme';

/**
 * Tema dell'interfaccia. Lo stato cambia e gli iscritti vengono avvisati **dentro** la transizione:
 * così la view transition fotografa il DOM già aggiornato (icona dello switcher compresa). In `auto`
 * il cambio di colore del sistema riapplica il tema; quel listener esiste solo con almeno un iscritto.
 */
export function createThemeStore(deps: {
  initial: ThemePref;
  persist(theme: ThemePref): void;
  transition(apply: () => void): void;
  apply(theme: ThemePref): void;
  watchSystem(onChange: () => void): () => void;
}) {
  let theme = deps.initial;
  const listeners = new Set<() => void>();
  let stopWatching: (() => void) | null = null;

  return {
    getState: (): ThemePref => theme,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) stopWatching = deps.watchSystem(() => deps.apply(theme));
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stopWatching?.();
        stopWatching = null;
      };
    },
    setTheme(next: ThemePref): void {
      deps.persist(next);
      deps.transition(() => {
        theme = next;
        for (const listener of listeners) listener();
        deps.apply(next);
      });
    },
  };
}

export type ThemeStore = ReturnType<typeof createThemeStore>;
