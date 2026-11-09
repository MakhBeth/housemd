import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import type { UpdateFlow } from '../../pwa/updateFlow';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdBanner, BannerItem } from '../banner/banner.element';
import './update-notice.css';

/**
 * Banner dell'app: «Nuova versione» con «Aggiorna» e «Più tardi» (mai disabled: mentre si mette al sicuro il
 * documento il messaggio dice «in corso», senza «Più tardi») e l'avviso del database bloccato da un'altra scheda.
 * Righe nel flusso in cima all'app, non un avviso flottante.
 */
export class HmdUpdateNotice extends HmdElement {
  #flow: UpdateFlow | null = null;
  #i18n: I18nStore | null = null;
  #banner: HmdBanner | null = null;
  #dbBlocked = false;

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

  /** Il database è bloccato da un'altra scheda; `hmd-banner-close` con chiave `reloadOtherTabs` lo chiude. */
  get dbBlocked(): boolean { return this.#dbBlocked; }
  set dbBlocked(value: boolean) {
    this.#dbBlocked = !!value;
    if (this.#flow && this.#i18n) this.#render(this.#flow, this.#i18n);
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
    const t = i18n.t;
    const banner = (this.#banner ??= this.appendChild(
      el('hmd-banner', {
        on: {
          'hmd-banner-action': (event) => {
            if (event.detail.key === 'newVersion') void this.#flow?.apply();
          },
          'hmd-banner-close': (event) => {
            if (event.detail.key === 'newVersion') this.#flow?.dismiss();
          },
        },
      }),
    ));
    const items: BannerItem[] = [];
    if (state.available) {
      items.push({
        key: 'newVersion',
        kind: 'status',
        text: t(state.busy ? 'update.applying' : 'toast.newVersion'),
        actionLabel: t('update.apply'),
        busy: state.busy,
        closeLabel: state.busy ? undefined : t('update.dismiss'),
      });
    }
    if (this.#dbBlocked) items.push({ key: 'reloadOtherTabs', kind: 'status', text: t('toast.reloadOtherTabs'), closeLabel: t('toast.close') });
    // Se il pulsante che chiude sparisce col focus, il focus va al primo controllo del contenuto dell'app.
    banner.focusFallback = () => this.parentElement?.querySelector<HTMLElement>(':scope > :not(hmd-update-notice) button') ?? null;
    banner.items = items;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-update-notice': HmdUpdateNotice;
  }
}
