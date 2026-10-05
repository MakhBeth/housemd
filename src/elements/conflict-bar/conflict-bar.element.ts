import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { icon } from '../../dom/icon';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import './conflict-bar.css';

/** Barra del conflitto con il disco (era ConflictBar.tsx): annunciata come alert quando compare. */
export class HmdConflictBar extends HmdElement {
  #i18n: I18nStore | null = null;
  #parts: { message: HTMLSpanElement; reload: HTMLButtonElement; overwrite: HTMLButtonElement } | null = null;

  get i18n(): I18nStore | null {
    return this.#i18n;
  }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const message = el('span');
      const reload = el('button', { on: { click: () => emit(this, 'hmd-conflict', { choice: 'reload' }) } });
      const overwrite = el('button', { on: { click: () => emit(this, 'hmd-conflict', { choice: 'overwrite' }) } });
      this.append(el('div', { class: 'bar', role: 'alert' }, icon('warning'), message, reload, overwrite));
      this.#parts = { message, reload, overwrite };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#render(i18n), signal);
  }

  #render(i18n: I18nStore): void {
    const { message, reload, overwrite } = this.#parts!;
    setText(message, i18n.t('conflict.message'));
    setText(reload, i18n.t('conflict.reload'));
    setText(overwrite, i18n.t('conflict.overwrite'));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-conflict-bar': HmdConflictBar;
  }
}
