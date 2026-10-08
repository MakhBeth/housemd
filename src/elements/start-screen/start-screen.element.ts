import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import type { UnsupportedReason } from '../../fs/access';
import type { I18nStore } from '../../state/i18nStore';
import { LOGO, LOGO_INVERTED, WORDMARK } from '../../ui/logo';
import { emit } from '../events';
import { startView, type StartMode } from './startView';
import './start-screen.css';

/** Schermata iniziale (era StartScreen.tsx): browser non supportato, prima apertura, ripresa dell'accesso. */
export class HmdStartScreen extends HmdElement {
  #mode: StartMode = 'start';
  #reason: UnsupportedReason | undefined;
  #error: string | undefined;
  #folderName = '';
  #busy = false;
  #i18n: I18nStore | null = null;
  #parts: { panel: HTMLDivElement; title: HTMLHeadingElement; tagline: HTMLParagraphElement; message: HTMLParagraphElement; pick: HTMLButtonElement; resume: HTMLButtonElement; other: HTMLButtonElement } | null = null;

  get mode(): StartMode { return this.#mode; }
  set mode(value: StartMode) { this.#mode = value ?? 'start'; this.#render(); }
  get reason(): UnsupportedReason | undefined { return this.#reason; }
  set reason(value: UnsupportedReason | undefined) { this.#reason = value ?? undefined; this.#render(); }
  get error(): string | undefined { return this.#error; }
  set error(value: string | undefined) { this.#error = value ?? undefined; this.#render(); }
  get folderName(): string { return this.#folderName; }
  set folderName(value: string) { this.#folderName = value ?? ''; this.#render(); }
  get busy(): boolean { return this.#busy; }
  set busy(value: boolean) { this.#busy = !!value; this.#render(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const title = el('h1', { class: 'visually-hidden' });
      const tagline = el('p', { class: 'tagline' });
      const panel = el(
        'div',
        { class: 'panel' },
        title,
        el('pre', { class: 'logo logo-dark', 'aria-hidden': 'true' }, LOGO),
        el('pre', { class: 'logo logo-light', 'aria-hidden': 'true' }, LOGO_INVERTED),
        el('pre', { class: 'logo wordmark', 'aria-hidden': 'true' }, WORDMARK),
        tagline,
      );
      this.append(el('main', { class: 'start' }, panel));
      this.#parts = {
        panel,
        title,
        tagline,
        message: el('p', { class: 'message' }),
        pick: el('button', { class: 'primary', on: { click: () => emit(this, 'hmd-start-pick', null) } }),
        resume: el('button', { class: 'primary', on: { click: () => emit(this, 'hmd-start-resume', null) } }),
        other: el('button', { class: 'secondary', on: { click: () => emit(this, 'hmd-start-pick', null) } }),
      };
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
    this.#render();
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n) return;
    const view = startView({ mode: this.#mode, reason: this.#reason, error: this.#error });
    setText(parts.title, i18n.t('app.name'));
    setText(parts.tagline, i18n.t('start.tagline'));
    setText(parts.pick, i18n.t('start.openFolder'));
    setText(parts.resume, i18n.t('start.resume', { folder: this.#folderName }));
    setText(parts.other, i18n.t('start.openOther'));
    if (view.message) setText(parts.message, i18n.t(view.message.key, view.message.params));
    // Messaggio e pulsanti si montano e si smontano come in React: nodi assenti, non nascosti.
    const wanted: HTMLElement[] = [
      ...(view.message ? [parts.message] : []),
      ...view.buttons.map((b) => (b === 'pick' ? parts.pick : b === 'resume' ? parts.resume : parts.other)),
    ];
    for (const node of [parts.message, parts.pick, parts.resume, parts.other]) if (!wanted.includes(node)) node.remove();
    let anchor: Element = parts.tagline;
    for (const node of wanted) {
      if (anchor.nextElementSibling !== node) anchor.after(node);
      anchor = node;
    }
    for (const button of [parts.pick, parts.resume, parts.other]) button.disabled = this.#busy;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-start-screen': HmdStartScreen;
  }
}
