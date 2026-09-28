/** Preferenza del tema (puro). La stessa logica, in piccolo, sta nello script inline di index.html. */

export type ThemePref = 'auto' | 'light' | 'dark';
export type ColorScheme = 'light dark' | 'light' | 'dark';

export const THEME_PREFS: readonly ThemePref[] = ['auto', 'light', 'dark'];
export const THEME_STORAGE_KEY = 'housemd:theme';
/** Colore di sfondo (`--c-bg`) di ciascun tema, per `<meta name="theme-color">`. */
export const THEME_BACKGROUND = { light: '#fbfaf7', dark: '#16161a' } as const;

export function nextTheme(current: ThemePref): ThemePref {
  return THEME_PREFS[(THEME_PREFS.indexOf(current) + 1) % THEME_PREFS.length];
}

export function resolveColorScheme(pref: ThemePref): ColorScheme {
  return pref === 'auto' ? 'light dark' : pref;
}

export function effectiveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'auto') return systemDark ? 'dark' : 'light';
  return pref;
}

export function parseTheme(raw: unknown): ThemePref {
  return THEME_PREFS.includes(raw as ThemePref) ? (raw as ThemePref) : 'auto';
}
