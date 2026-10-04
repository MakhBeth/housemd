import { HmdElement } from '../../dom/element';
import { el, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import type { I18nStore } from '../../state/i18nStore';
import type { ThemeStore } from '../../state/themeStore';
import { nextTheme, type ThemePref } from '../../theme/theme';
import type { IconName } from '../../ui/icons';
import './theme-switcher.css';

const THEME_ICON: Record<ThemePref, IconName> = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };

/**
 * Cicla auto → chiaro → scuro (era ThemeSwitcher.tsx). Si iscrive direttamente allo store del tema: la
 * notifica arriva dentro la view transition e il pulsante deve essere già aggiornato quando la pagina viene
 * fotografata. Il pulsante resta lo stesso nodo, quindi il focus non si perde.
 */
export class HmdThemeSwitcher extends HmdElement {
  #store: ThemeStore | null = null;
  #i18n: I18nStore | null = null;
  #button: HTMLButtonElement | null = null;
  #shown: ThemePref | null = null;

  get store(): ThemeStore | null {
    return this.#store;
  }
  set store(value: ThemeStore | null) {
    if (value === this.#store) return;
    this.#store = value;
    this.reconnect();
  }

  get i18n(): I18nStore | null {
    return this.#i18n;
  }
  set i18n(value: I18nStore | null) {
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#button ??= this.appendChild(
      el('button', { class: 'button tooltip', on: { click: () => this.#store?.setTheme(nextTheme(this.#store.getState())) } }),
    );
    const store = this.#store;
    const i18n = this.#i18n;
    if (!store || !i18n) return;
    const render = () => this.#render(store, i18n);
    this.watch(store, render, signal);
    this.watch(i18n, render, signal);
  }

  #render(store: ThemeStore, i18n: I18nStore): void {
    const button = this.#button!;
    const theme = store.getState();
    const label = i18n.t(`theme.${theme}`);
    toggleAttr(button, 'aria-label', true, label);
    toggleAttr(button, 'data-tooltip', true, label);
    if (theme !== this.#shown) {
      this.#shown = theme;
      button.replaceChildren(icon(THEME_ICON[theme]));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-theme-switcher': HmdThemeSwitcher;
  }
}
