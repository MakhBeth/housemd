import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { emit } from '../events';
import './notice.css';

type Placement = 'top' | 'bottom';

/**
 * Avviso persistente in basso (o in alto) a sinistra, fuori dal flusso: popover `manual`, non sparisce da
 * solo (era Notice.tsx). I pulsanti si creano una volta e si inseriscono o tolgono: chi ha il focus resta.
 */
export class HmdNotice extends HmdElement {
  #message = '';
  #actionLabel = '';
  #busy = false;
  #dismissLabel = '';
  #dismissible = false;
  #placement: Placement = 'bottom';
  #parts: { box: HTMLDivElement; text: HTMLParagraphElement; action: HTMLButtonElement; dismiss: HTMLButtonElement } | null = null;
  #open = false;

  get message(): string { return this.#message; }
  set message(value: string) { this.#message = value; this.#render(); }
  get actionLabel(): string { return this.#actionLabel; }
  set actionLabel(value: string) { this.#actionLabel = value; this.#render(); }
  get busy(): boolean { return this.#busy; }
  set busy(value: boolean) { this.#busy = value; this.#render(); }
  get dismissLabel(): string { return this.#dismissLabel; }
  set dismissLabel(value: string) { this.#dismissLabel = value; this.#render(); }
  get dismissible(): boolean { return this.#dismissible; }
  set dismissible(value: boolean) { this.#dismissible = value; this.#render(); }
  get placement(): Placement { return this.#placement; }
  set placement(value: Placement) { this.#placement = value; this.#render(); }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const text = el('p');
      const action = el('button', { class: 'action', on: { click: () => emit(this, 'hmd-notice-action', null) } });
      const dismiss = el('button', { class: 'dismiss tooltip', on: { click: () => emit(this, 'hmd-notice-dismiss', null) } }, icon('close', { size: 16 }));
      const box = el('div', { class: 'notice', popover: 'manual', role: 'status' }, text);
      this.append(box);
      this.#parts = { box, text, action, dismiss };
    }
    this.#render();
    // Un popover staccato dal documento si chiude da solo: niente hidePopover() su un nodo staccato.
    if (!this.#open) {
      this.#parts.box.showPopover();
      this.#open = true;
    }
    signal.addEventListener('abort', () => (this.#open = false), { once: true });
  }

  #render(): void {
    if (!this.#parts) return;
    const { box, text, action, dismiss } = this.#parts;
    box.dataset.placement = this.#placement;
    setText(text, this.#message);
    setText(action, this.#actionLabel);
    action.disabled = this.#busy;
    toggleAttr(dismiss, 'aria-label', true, this.#dismissLabel);
    toggleAttr(dismiss, 'data-tooltip', true, this.#dismissLabel);
    place(box, action, this.#actionLabel !== '', text);
    place(box, dismiss, this.#dismissible, this.#actionLabel !== '' ? action : text);
  }
}

/** Mette `node` subito dopo `after` dentro `parent`, o lo toglie; non tocca un nodo già al suo posto. */
function place(parent: Element, node: Element, present: boolean, after: Element): void {
  if (!present) {
    node.remove();
    return;
  }
  if (node.parentElement !== parent || node.previousElementSibling !== after) after.after(node);
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-notice': HmdNotice;
  }
}
