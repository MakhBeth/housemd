import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import type { UpdateFlow } from '../../pwa/updateFlow';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdNotice } from '../notice/notice.element';
import './update-notice.css';

/** "Nuova versione" con "Aggiorna" (disabilitato mentre si mette al sicuro il documento). Era UpdateNotice.tsx. */
export class HmdUpdateNotice extends HmdElement {
  #flow: UpdateFlow | null = null;
  #i18n: I18nStore | null = null;
  #notice: HmdNotice | null = null;

  get flow(): UpdateFlow | null { return this.#flow; }
  set flow(value: UpdateFlow | null) {
    value ??= null;
    if (value === this.#flow) return;
    this.#flow = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    const flow = this.#flow;
    const i18n = this.#i18n;
    if (!flow || !i18n) return;
    const render = () => this.#render(flow, i18n);
    this.watch(flow, render, signal);
    this.watch(i18n, render, signal);
  }

  #render(flow: UpdateFlow, i18n: I18nStore): void {
    const state = flow.getState();
    if (!state.available) {
      this.#notice?.remove();
      this.#notice = null;
      return;
    }
    this.#notice ??= this.appendChild(
      el('hmd-notice', {
        on: {
          'hmd-notice-action': () => void this.#flow?.apply(),
          'hmd-notice-dismiss': () => this.#flow?.dismiss(),
        },
      }),
    );
    Object.assign(this.#notice, {
      message: i18n.t('toast.newVersion'),
      actionLabel: i18n.t('update.apply'),
      busy: state.busy,
      dismissLabel: i18n.t('update.dismiss'),
      dismissible: !state.busy,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-update-notice': HmdUpdateNotice;
  }
}
