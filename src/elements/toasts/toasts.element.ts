import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import type { Toast } from '../../workspace/toasts';
import { emit } from '../events';
import './toasts.css';

/** Un toast già tradotto: il Workspace e il controller AI hanno codici diversi, qui arriva solo testo. */
export interface ToastItem {
  key: string;
  kind: Toast['kind'];
  text: string;
}

const INFO_TIMEOUT_MS = 6000;

/**
 * Toast in basso a destra (era Toasts.tsx): popover `manual` aperto finché ci sono toast. I toast
 * informativi si chiudono dopo 6 s; come l'effetto React di prima, ogni nuovo array `items` riavvia i timer.
 */
export class HmdToasts extends HmdElement {
  #items: readonly ToastItem[] = [];
  #i18n: I18nStore | null = null;
  #box: HTMLDivElement | null = null;
  #open = false;
  #timers: ReturnType<typeof setTimeout>[] = [];

  get items(): readonly ToastItem[] { return this.#items; }
  set items(value: readonly ToastItem[]) {
    this.#items = value ?? [];
    this.#render();
    if (this.isConnected) this.#restartTimers();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'toasts', popover: 'manual' }));
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
    else this.#render();
    this.#restartTimers();
    // Il signal si interrompe al distacco e al reconnect: i timer ripartono in entrambi i casi.
    signal.addEventListener('abort', () => this.#clearTimers(), { once: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo il distacco chiude il popover (al reconnect resta aperto): si dimentica lo stato, senza hidePopover().
    this.#open = false;
  }

  #render(): void {
    const box = this.#box;
    if (!box) return;
    const close = this.#i18n?.t('toast.close');
    reconcileList(
      box,
      this.#items,
      (item) => item.key,
      (item) =>
        el('div', { class: 'toast' }, el('p'), el('button', { class: 'tooltip', on: { click: () => emit(this, 'hmd-toast-dismiss', { key: item.key }) } }, icon('close', { size: 16 }))),
      (node, item) => {
        node.dataset.kind = item.kind;
        toggleAttr(node, 'role', true, item.kind === 'error' ? 'alert' : 'status');
        setText(node.querySelector('p')!, item.text);
        const button = node.querySelector('button')!;
        toggleAttr(button, 'aria-label', close !== undefined, close);
        toggleAttr(button, 'data-tooltip', close !== undefined, close);
      },
    );
    if (!this.isConnected) return;
    if (this.#items.length > 0 && !this.#open) {
      box.showPopover();
      this.#open = true;
    } else if (this.#items.length === 0 && this.#open) {
      box.hidePopover();
      this.#open = false;
    }
  }

  #restartTimers(): void {
    this.#clearTimers();
    this.#timers = this.#items
      .filter((item) => item.kind === 'info')
      .map((item) => setTimeout(() => emit(this, 'hmd-toast-dismiss', { key: item.key }), INFO_TIMEOUT_MS));
  }

  #clearTimers(): void {
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-toasts': HmdToasts;
  }
}
