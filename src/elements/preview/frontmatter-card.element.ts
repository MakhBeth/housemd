import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { Frontmatter } from '../../preview/frontmatter';
import type { I18nStore } from '../../state/i18nStore';
import { formatCardDate } from './cardDate';
import { cardView, type ResolveImage } from './previewView';
import './frontmatter-card.css';

type CardPart = 'image' | 'title' | 'meta' | 'description' | 'extra';
type MetaItem = { key: string; tag: string | null };

/**
 * Scheda del frontmatter in cima all'anteprima (era FrontmatterCard.tsx). Nodi creati una volta e
 * riusati: l'anteprima passa un frontmatter nuovo a ogni debounce, e l'<img> non deve lampeggiare.
 * Render in un microtask: frontmatter e risolutore arrivano uno dopo l'altro.
 */
export class HmdFrontmatterCard extends HmdElement {
  #frontmatter: Frontmatter | null = null;
  #resolveImage: ResolveImage | null = null;
  #i18n: I18nStore | null = null;
  #signal: AbortSignal | null = null;
  #scheduled = false;
  /** Immagine chiesta (sorgente + risolutore), URL arrivato, token che scarta le risposte superate. */
  #image: { src: string | null; resolve: ResolveImage | null } | null = null;
  #imageUrl: string | null = null;
  #imageToken = 0;
  #parts: {
    error: HTMLDivElement;
    header: HTMLElement;
    image: HTMLImageElement;
    title: HTMLParagraphElement;
    meta: HTMLParagraphElement;
    time: HTMLTimeElement;
    description: HTMLParagraphElement;
    extra: HTMLDListElement;
  } | null = null;

  get frontmatter(): Frontmatter | null { return this.#frontmatter; }
  set frontmatter(value: Frontmatter | null) { this.#frontmatter = value ?? null; this.#schedule(); }
  get resolveImage(): ResolveImage | null { return this.#resolveImage; }
  set resolveImage(value: ResolveImage | null) { this.#resolveImage = value ?? null; this.#schedule(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#parts ??= {
      error: el('div', { class: 'card-error', role: 'note' }),
      header: el('header', { class: 'card' }),
      image: el('img', { class: 'card-image', alt: '' }),
      title: el('p', { class: 'card-title' }),
      meta: el('p', { class: 'card-meta' }),
      time: el('time'),
      description: el('p', { class: 'card-description' }),
      extra: el('dl', { class: 'card-extra' }),
    };
    this.#signal = signal;
    if (this.#i18n) this.watch(this.#i18n, () => this.#schedule(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Come lo smontaggio di FrontmatterCard.tsx: la risposta in volo non conta più, al rientro si richiede.
    this.#imageToken++;
    this.#image = null;
    this.#imageUrl = null;
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#render();
    });
  }

  #loadImage(src: string | null): void {
    const resolve = this.#resolveImage;
    if (this.#image && this.#image.src === src && this.#image.resolve === resolve) return;
    this.#image = { src, resolve };
    this.#imageUrl = null;
    const token = ++this.#imageToken;
    if (!src || !resolve) return;
    void resolve(src).then((url) => {
      if (token !== this.#imageToken) return;
      this.#imageUrl = url;
      this.#schedule();
    });
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n || !this.#signal || this.#signal.aborted) return;
    const view = cardView(this.#frontmatter);
    this.#loadImage(view.kind === 'card' ? view.card.image : null);
    const top = view.kind === 'error' ? ['error'] : view.kind === 'card' ? ['header'] : [];
    reconcileList(this, top, (k) => k, (k) => (k === 'error' ? parts.error : parts.header));
    if (view.kind === 'error') {
      setText(parts.error, i18n.t('preview.frontmatterInvalid', { detail: view.detail }));
      return;
    }
    if (view.kind !== 'card') return;
    const { card } = view;
    // Figli montati come in React: nodo assente, non nascosto.
    const keys: CardPart[] = [
      ...(this.#imageUrl ? (['image'] as const) : []),
      ...(card.title ? (['title'] as const) : []),
      ...(card.date || card.tags.length > 0 ? (['meta'] as const) : []),
      ...(card.description ? (['description'] as const) : []),
      ...(card.extra.length > 0 ? (['extra'] as const) : []),
    ];
    reconcileList(parts.header, keys, (k) => k, (k) => parts[k]);
    if (this.#imageUrl && parts.image.getAttribute('src') !== this.#imageUrl) parts.image.src = this.#imageUrl;
    if (card.title) setText(parts.title, card.title);
    const metaItems: MetaItem[] = [
      ...(card.date ? [{ key: 'time', tag: null }] : []),
      // Per indice: i tag possono ripetersi.
      ...card.tags.map((tag, i) => ({ key: `tag:${i}`, tag })),
    ];
    reconcileList(
      parts.meta,
      metaItems,
      (item) => item.key,
      (item): HTMLElement => (item.tag === null ? parts.time : el('span', { class: 'tag' })),
      (node, item) => {
        if (item.tag !== null) setText(node, item.tag);
      },
    );
    if (card.date) {
      toggleAttr(parts.time, 'datetime', true, card.date);
      setText(parts.time, formatCardDate(card.date, i18n.getState().locale));
    }
    if (card.description) setText(parts.description, card.description);
    reconcileList(
      parts.extra,
      card.extra,
      ([key]) => key,
      () => el('div', null, el('dt'), el('dd')),
      (row, [key, value]) => {
        setText(row.children[0], key);
        setText(row.children[1], value);
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-frontmatter-card': HmdFrontmatterCard;
  }
}
