import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { uid } from '../../dom/uid';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { nextIndex, recentLabel, type RecentItem } from './openView';
import './open-menu.css';

/**
 * Menu «Apri», sempre visibile nella barra: Apri cartella…, Apri file… e i recenti. Un pulsante che apre un
 * popover ancorato a lui; frecce, Home ed End tra le voci, Esc (del popover) chiude e il focus torna al pulsante.
 * Verso fuori manda solo `hmd-open-choose` (cosa aprire); permessi e cambio li fa `hmd-app`.
 */
export class HmdOpenMenu extends HmdElement {
  #i18n: I18nStore | null = null;
  #recents: readonly RecentItem[] = [];
  #parts: { trigger: HTMLButtonElement; menu: HTMLDivElement; folder: HTMLButtonElement; file: HTMLButtonElement; title: HTMLParagraphElement; list: HTMLUListElement } | null = null;

  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  get recents(): readonly RecentItem[] { return this.#recents; }
  set recents(value: readonly RecentItem[]) {
    this.#recents = value ?? [];
    this.#render();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const id = uid('open-menu');
      const anchor = `--${id}`;
      const trigger = el('button', { class: 'trigger', 'aria-expanded': 'false', 'aria-controls': id, on: { click: () => this.#toggle() } }, icon('folder'), el('span', { class: 'label' }));
      trigger.style.setProperty('anchor-name', anchor);
      const titleId = `${id}-recent`;
      const title = el('p', { class: 'recentTitle', id: titleId });
      const list = el('ul', { class: 'recent', 'aria-labelledby': titleId });
      const folder = el('button', { class: 'item', on: { click: () => this.#choose({ action: 'folder' }) } });
      const file = el('button', { class: 'item', on: { click: () => this.#choose({ action: 'file' }) } });
      const menu = el('div', { id, class: 'menu', popover: 'auto', on: { toggle: (event) => this.#onToggle(event as ToggleEvent), keydown: (event) => this.#onKey(event), focusout: (event) => this.#onFocusOut(event as FocusEvent) } }, folder, file);
      menu.style.setProperty('position-anchor', anchor);
      this.append(trigger, menu);
      this.#parts = { trigger, menu, folder, file, title, list };
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  /** Il menu si chiude prima di mandare l'evento: il dialog o il selettore che seguono non lo trovano aperto. */
  #choose(detail: { action: 'folder' | 'file' } | { action: 'recent'; key: string }): void {
    this.#parts?.menu.hidePopover();
    this.#parts?.trigger.focus();
    emit(this, 'hmd-open-choose', detail);
  }

  #toggle(): void {
    const parts = this.#parts;
    if (!parts) return;
    if (parts.menu.matches(':popover-open')) {
      parts.menu.hidePopover();
      return;
    }
    parts.menu.showPopover();
    toggleAttr(parts.trigger, 'aria-expanded', true, 'true');
    parts.folder.focus();
  }

  #items(): HTMLButtonElement[] {
    return [...(this.#parts?.menu.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  }

  #onKey(event: KeyboardEvent): void {
    const items = this.#items();
    const next = nextIndex(items.indexOf(document.activeElement as HTMLButtonElement), items.length, event.key);
    if (next === null) return;
    event.preventDefault();
    items[next]!.focus();
  }

  /** Tab (o Maiusc+Tab) fuori dal menu: si chiude, senza spostare il focus che se ne va da solo. */
  #onFocusOut(event: FocusEvent): void {
    const parts = this.#parts;
    const next = event.relatedTarget as Node | null;
    if (!parts || !next || parts.menu.contains(next)) return;
    parts.menu.hidePopover();
  }

  /** Chiuso (Esc, clic fuori) con il focus perso o rimasto nel menu: torna al pulsante. */
  #onToggle(event: ToggleEvent): void {
    const parts = this.#parts;
    if (!parts) return;
    toggleAttr(parts.trigger, 'aria-expanded', true, String(event.newState === 'open'));
    if (event.newState !== 'closed') return;
    const active = document.activeElement;
    if (active === document.body || parts.menu.contains(active)) parts.trigger.focus();
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n) return;
    const t = i18n.t;
    setText(parts.trigger.querySelector('.label')!, t('open.menu'));
    setText(parts.folder, t('open.folder'));
    setText(parts.file, t('open.file'));
    setText(parts.title, t('open.recent'));
    const show = this.#recents.length > 0;
    if (show && parts.title.parentNode !== parts.menu) parts.menu.append(parts.title, parts.list);
    if (!show) {
      parts.title.remove();
      parts.list.remove();
    }
    reconcileList(
      parts.list,
      this.#recents,
      (recent) => recent.key,
      (recent) => el('li', null, el('button', { class: 'item', on: { click: () => this.#choose({ action: 'recent', key: recent.key }) } }, icon(recent.kind === 'folder' ? 'folder' : 'file', { size: 16 }), el('span'))),
      (li, recent) => {
        const button = li.firstElementChild as HTMLButtonElement;
        setText(button.lastElementChild!, recent.name);
        toggleAttr(button, 'aria-label', true, t(recentLabel(recent.kind), { name: recent.name }));
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-open-menu': HmdOpenMenu;
  }
}
