import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { readValidPref, writePref } from '../lib/prefs';
import { applyTheme } from './applyTheme';
import { pixelTransition } from './pixelTransition';
import { parseTheme, type ThemePref } from './theme';

export function useTheme(): [ThemePref, (next: ThemePref) => void] {
  const [theme, setThemeState] = useState<ThemePref>(() => readValidPref('theme', parseTheme));

  // In "auto" il colore della barra del titolo segue il sistema anche mentre l'app è aperta.
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(theme);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePref) => {
    writePref('theme', next);
    void pixelTransition(() => {
      // Dentro la view transition il DOM deve essere già aggiornato (icona dello switcher compresa).
      flushSync(() => setThemeState(next));
      applyTheme(next);
    });
  }, []);

  return [theme, setTheme];
}
