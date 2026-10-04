/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { I18nStore } from '../state/i18nStore';
import type { ThemeStore } from '../state/themeStore';
import type { HmdEvents } from './events';

/** Proprietà dell'elemento (tutte facoltative per JSX) più gli eventi che manda, come prop `on<nome>`. */
export type HmdProps<P, E extends keyof HmdEvents = never> = Partial<P> & {
  [K in E as `on${K}`]?: (event: HmdEvents[K]) => void;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hmd-theme-switcher': HmdProps<{ store: ThemeStore; i18n: I18nStore }>;
    }
  }
}
