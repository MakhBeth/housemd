import { useT } from '../i18n/I18nProvider';
import { nextTheme, type ThemePref } from '../theme/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';

const THEME_ICON: Record<ThemePref, IconName> = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };

interface Props {
  theme: ThemePref;
  onChange: (next: ThemePref) => void;
  className?: string;
}

/** Cicla auto → chiaro → scuro; icona e tooltip dicono lo stato corrente. Il focus resta sul pulsante. */
export function ThemeSwitcher({ theme, onChange, className }: Props) {
  const t = useT();
  const label = t(`theme.${theme}`);
  return (
    <button className={className} onClick={() => onChange(nextTheme(theme))} aria-label={label} title={label}>
      <Icon name={THEME_ICON[theme]} />
    </button>
  );
}
