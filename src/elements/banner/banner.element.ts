import { HmdElement } from '../../dom/element';
import { announce } from '../../dom/announce';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { emit } from '../events';
import './banner.css';

/** Una riga già tradotta: chi la produce (workspace, app) ha i codici e i testi, qui arriva solo testo. */
export interface BannerItem {
  key: string;
  /** `status` (polite, nel contenitore sempre montato) o `alert` (riga assertiva accanto ad esso). */
  kind: 'status' | 'alert';
  text: string;
  /** Riga visibile ma non parlante: un altro canale (l'indicatore di salvataggio) annuncia già lo stesso evento. */
  quiet?: boolean;
  /** Pulsante di azione accanto al messaggio (es. «Aggiorna»). */
  actionLabel?: string;
  /** Azione in corso: un secondo clic rilegge il messaggio (WCAG 4.1.3), non avvia altro. */
  busy?: boolean;
  /** Controllo che ha avviato l'operazione (nota locale): rimanda al messaggio con `aria-describedby` finché la riga esiste. */
  describes?: HTMLElement;
  /** Etichetta di «Chiudi»; senza, il messaggio non si chiude a mano. */
  closeLabel?: string;
}

let seq = 0;

/**
 * Banner nel flusso (documento, workspace, app): righe nel layout, mai popover né overlay. Il contenitore
 * `role="status"` è montato vuoto alla prima connessione e non esce più dal DOM; le righe informative ne
 * diventano figlie, le righe `alert` stanno in uno spazio fratello (mai dentro la regione polite) e i pulsanti
 * in un terzo, fuori dal testo live. Ogni pulsante rimanda al proprio testo con `aria-describedby`.
 * Nessun focus automatico; un messaggio chiuso restituisce il focus al banner solo se lo aveva il suo pulsante.
 */
export class HmdBanner extends HmdElement {
  #items: readonly BannerItem[] = [];
  #live: HTMLDivElement | null = null;
  #alerts: HTMLDivElement | null = null;
  #quiet: HTMLDivElement | null = null;
  #actions: HTMLDivElement | null = null;
  #ids = new Map<string, string>();
  /** Chiave → controllo descritto dal messaggio, con l'ID aggiunto ai riferimenti già presenti. */
  #described = new Map<string, { control: HTMLElement; id: string }>();
  /** Dove va il focus se il pulsante che lo ha sparisce chiudendo il messaggio (mai sul body). */
  focusFallback: (() => HTMLElement | null) | null = null;

  get items(): readonly BannerItem[] { return this.#items; }
  set items(value: readonly BannerItem[]) {
    this.#items = value ?? [];
    this.#render();
  }

  protected connect(): void {
    if (!this.#live) {
      this.#live = el('div', { class: 'live', role: 'status' });
      this.#alerts = el('div', { class: 'alerts' });
      this.#quiet = el('div', { class: 'quiet' });
      this.#actions = el('div', { class: 'actions' });
      this.append(this.#live, this.#alerts, this.#quiet, this.#actions);
    }
    this.#render();
  }

  #idOf(key: string): string {
    let id = this.#ids.get(key);
    if (!id) this.#ids.set(key, (id = `hmd-banner-${++seq}`));
    return id;
  }

  #render(): void {
    if (!this.#live) return;
    const items = this.#items;
    const status = items.filter((item) => item.kind === 'status' && !item.quiet);
    const alerts = items.filter((item) => item.kind === 'alert' && !item.quiet);
    const quiet = items.filter((item) => item.quiet);
    const message = (item: BannerItem) => (node: HTMLParagraphElement) => {
      node.id = this.#idOf(item.key);
      setText(node, item.text);
    };
    reconcileList(this.#live, status, (item) => item.key, () => el('p', { class: 'message' }), (node, item) => message(item)(node));
    reconcileList(this.#quiet!, quiet, (item) => item.key, () => el('p', { class: 'message' }), (node, item) => message(item)(node));
    reconcileList(this.#alerts!, alerts, (item) => item.key, () => el('p', { class: 'message', role: 'alert' }), (node, item) => message(item)(node));
    const actionable = items.filter((item) => item.actionLabel !== undefined || item.closeLabel !== undefined);
    reconcileList(
      this.#actions!,
      actionable,
      (item) => item.key,
      (item) =>
        el(
          'div',
          { class: 'row' },
          el('button', { class: 'action', on: { click: () => this.#act(item.key) } }),
          el('button', { class: 'close', on: { click: () => this.#close(item.key) } }),
          el('span', { class: 'context', 'aria-hidden': 'true' }),
        ),
      (node, item) => {
        const [action, close] = node.querySelectorAll('button');
        for (const button of [action, close]) toggleAttr(button, 'aria-describedby', true, this.#idOf(item.key));
        action.hidden = item.actionLabel === undefined;
        close.hidden = item.closeLabel === undefined;
        setText(action, item.actionLabel ?? '');
        setText(close, item.closeLabel ?? '');
        toggleAttr(action, 'data-busy', !!item.busy);
        // Con più messaggi il pulsante dice a vista a quale appartiene (il nome accessibile non cambia: aria-describedby).
        const context = node.querySelector('.context')!;
        setText(context, actionable.length > 1 ? (item.text.length > 48 ? `${item.text.slice(0, 48)}…` : item.text) : '');
      },
    );
    for (const [key, entry] of [...this.#described]) {
      const item = items.find((candidate) => candidate.key === key);
      if (item?.describes === entry.control) continue;
      unreference(entry.control, entry.id);
      this.#described.delete(key);
    }
    for (const item of items) {
      if (!item.describes || this.#described.has(item.key)) continue;
      const id = this.#idOf(item.key);
      reference(item.describes, id);
      this.#described.set(item.key, { control: item.describes, id });
    }
    for (const key of [...this.#ids.keys()]) if (!items.some((item) => item.key === key)) this.#ids.delete(key);
  }

  #close(key: string): void {
    const active = document.activeElement;
    if (active && this.contains(active)) this.focusFallback?.()?.focus();
    emit(this, 'hmd-banner-close', { key });
  }

  #act(key: string): void {
    const item = this.#items.find((candidate) => candidate.key === key);
    if (item?.busy) {
      const node = document.getElementById(this.#idOf(key));
      if (node) announce(node, item.text, true);
    }
    emit(this, 'hmd-banner-action', { key });
  }
}

function reference(control: HTMLElement, id: string): void {
  const ids = (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  if (!ids.includes(id)) control.setAttribute('aria-describedby', [...ids, id].join(' '));
}

function unreference(control: HTMLElement, id: string): void {
  const ids = (control.getAttribute('aria-describedby') ?? '').split(' ').filter((value) => value && value !== id);
  if (ids.length > 0) control.setAttribute('aria-describedby', ids.join(' '));
  else control.removeAttribute('aria-describedby');
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-banner': HmdBanner;
  }
}
