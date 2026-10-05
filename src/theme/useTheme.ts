import { useCallback, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

import { readValidPref, writePref } from '../lib/prefs';
import { createThemeStore, type ThemeStore } from '../state/themeStore';
import { applyTheme } from './applyTheme';
import { pixelTransition } from './pixelTransition';
import { parseTheme, type ThemePref } from './theme';

let store: ThemeStore | null = null;

/**
 * Un solo store per pagina, creato al primo uso (legge la preferenza salvata). Esportato per i custom
 * element, che lo ricevono come proprietà.
 */
export function getThemeStore(): ThemeStore {
  store ??= createThemeStore({
    initial: readValidPref('theme', parseTheme),
    persist: (theme) => writePref('theme', theme),
    transition: (apply) => void pixelTransition(apply),
    apply: applyTheme,
    watchSystem: (onChange) => {
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
  });
  return store;
}

export function useTheme(): [ThemePref, (next: ThemePref) => void] {
  const s = getThemeStore();
  // L'avviso arriva dentro la view transition: flushSync fa sì che React aggiorni il DOM prima che
  // la transizione lo fotografi (come faceva prima flushSync attorno a setState).
  const subscribe = useCallback((onChange: () => void) => s.subscribe(() => flushSync(onChange)), [s]);
  const theme = useSyncExternalStore(subscribe, s.getState);
  return [theme, s.setTheme];
}
