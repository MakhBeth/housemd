import { effectiveTheme, resolveColorScheme, THEME_BACKGROUND, type ThemePref } from './theme';

export function systemPrefersDark(): boolean {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applica il tema: `data-theme`, `color-scheme` (i token light-dark() fanno il resto) e theme-color. */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.dataset.theme = pref;
  root.style.colorScheme = resolveColorScheme(pref);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_BACKGROUND[effectiveTheme(pref, systemPrefersDark())]);
}
