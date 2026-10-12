import { readValidPref, writePref } from '../lib/prefs';
import { createThemeStore, type ThemeStore } from '../state/themeStore';
import { applyTheme } from './applyTheme';
import { pixelTransition } from './pixelTransition';
import { parseTheme } from './theme';

/**
 * Lo store del tema della pagina (era `getThemeStore` di useTheme.ts): legge la preferenza salvata, la
 * transizione a pixel avvolge il cambio, `auto` segue il sistema. Lo crea `main.ts`, una volta. Gli
 * elementi ridisegnano dentro la notifica, che arriva dentro la view transition: niente più `flushSync`.
 */
export function browserThemeStore(): ThemeStore {
  return createThemeStore({
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
}
