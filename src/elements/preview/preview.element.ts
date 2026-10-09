import type { HouseConfig } from '../../config/config';
import { resolveImageSrc } from '../../config/images';
import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { splitFrontmatter } from '../../preview/frontmatter';
import { highlightTerms } from '../../preview/highlight';
import { ImageUrlCache } from '../../preview/imageCache';
import { LINE_CLASS_PREFIX, renderMarkdown, sourceLineOf } from '../../preview/render';
import { setSafeHTML } from '../../preview/sanitize';
import { lineForOffset, offsetForLine, type Anchor } from '../../preview/scrollSync';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdFrontmatterCard } from './frontmatter-card.element';
import {
  PREVIEW_DEBOUNCE_MS, SCROLL_SUPPRESS_MS, cardImagePath, docUpdate, isExternalHref, linkAction,
  type PreviewDoc, type ResolveImage,
} from './previewView';
import './preview.css';

/**
 * Anteprima del documento (era Preview.tsx). Gli effetti di React diventano metodi privati: i setter
 * segnano cosa è cambiato e `#schedule` decide in un microtask (cambio di file subito, testo con il
 * debounce, il resto subito). Il corpo si riscrive solo con setSafeHTML; un render superato non tocca
 * più nulla (flag `cancelled`, come oggi).
 */
export class HmdPreview extends HmdElement {
  #text = '';
  #path = '';
  #files: string[] = [];
  #config: HouseConfig | null = null;
  #readBlob: ((path: string) => Promise<Blob>) | null = null;
  #highlight: string[] = [];
  #i18n: I18nStore | null = null;

  #parts: { scroller: HTMLDivElement; article: HTMLElement; card: HmdFrontmatterCard; body: HTMLDivElement } | null = null;
  #signal: AbortSignal | null = null;
  #doc: PreviewDoc | null = null;
  #textChanged = false;
  #dirty = false;
  #scheduled = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #run = { cancelled: false };
  #cache: ImageUrlCache | null = null;
  #resolver: { path: string; config: HouseConfig; cache: ImageUrlCache; fn: ResolveImage } | null = null;
  #anchors: Anchor[] | null = null;
  #suppressUntil = 0;

  get text(): string { return this.#text; }
  set text(value: string) {
    value ??= '';
    if (value === this.#text) return;
    this.#text = value;
    this.#textChanged = true;
    this.#schedule();
  }
  get path(): string { return this.#path; }
  set path(value: string) {
    value ??= '';
    if (value === this.#path) return;
    this.#path = value;
    this.#schedule();
  }
  get files(): string[] { return this.#files; }
  set files(value: string[]) {
    value ??= [];
    if (value === this.#files) return;
    this.#files = value;
    this.#invalidate();
  }
  get config(): HouseConfig | null { return this.#config; }
  set config(value: HouseConfig | null) {
    value ??= null;
    if (value === this.#config) return;
    this.#config = value;
    this.#invalidate();
  }
  get readBlob(): ((path: string) => Promise<Blob>) | null { return this.#readBlob; }
  set readBlob(value: ((path: string) => Promise<Blob>) | null) {
    value ??= null;
    if (value === this.#readBlob) return;
    this.#readBlob = value;
    // Come la cache di Preview.tsx (useMemo su readBlob): una lettura nuova, una cache nuova.
    void this.#cache?.clear();
    this.#cache = null;
    this.#invalidate();
  }
  get highlight(): string[] { return this.#highlight; }
  set highlight(value: string[]) {
    value ??= [];
    if (value === this.#highlight) return;
    this.#highlight = value;
    this.#invalidate();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  /** Porta in cima la riga sorgente `line` (0-based, frazionaria); lo scroll che ne segue non torna all'editor. */
  scrollToLine(line: number): void {
    const scroller = this.#parts?.scroller;
    if (!scroller) return;
    this.#suppressUntil = performance.now() + SCROLL_SUPPRESS_MS;
    scroller.scrollTop = offsetForLine(this.#getAnchors(), line);
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const body = el('div');
      const article = el('article', { class: 'prose' }, body);
      const scroller = el('div', { class: 'scroller' }, article);
      this.append(scroller);
      this.#parts = { scroller, article, card: el('hmd-frontmatter-card'), body };
    }
    this.#signal = signal;
    const { scroller, body } = this.#parts;
    scroller.addEventListener('scroll', () => this.#onScroll(), { signal });
    scroller.addEventListener('click', (event) => this.#onClick(event), { signal });
    // Le posizioni cambiano con il ridimensionamento e il caricamento delle immagini.
    const observer = new ResizeObserver(() => {
      this.#anchors = null;
    });
    observer.observe(body);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    this.#dirty = true;
    if (this.#i18n) this.watch(this.#i18n, () => this.#invalidate(), signal);
    this.#schedule();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco (non a reconnect, che arriva con un cambio di lingua): come lo smontaggio di Preview.tsx.
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#run.cancelled = true;
    void this.#cache?.clear();
    this.#cache = null;
    this.#resolver = null;
    this.#doc = null;
  }

  #invalidate(): void {
    this.#dirty = true;
    this.#schedule();
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  #flush(): void {
    if (!this.#signal || this.#signal.aborted) return;
    const update = docUpdate(this.#doc, this.#path, this.#textChanged);
    this.#textChanged = false;
    if (update === 'now') {
      clearTimeout(this.#timer);
      this.#timer = undefined;
      this.#setDoc();
      this.#render();
      return;
    }
    if (update === 'debounce') {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        this.#setDoc();
        this.#render();
      }, PREVIEW_DEBOUNCE_MS);
    }
    if (this.#dirty) this.#render();
  }

  #setDoc(): void {
    this.#doc = { path: this.#path, split: splitFrontmatter(this.#text) };
  }

  #resolveImage(path: string, config: HouseConfig, cache: ImageUrlCache): ResolveImage {
    const current = this.#resolver;
    if (current && current.path === path && current.config === config && current.cache === cache) return current.fn;
    // Stessa identità finché non cambiano file, configurazione o cache: la scheda non ricarica l'immagine.
    const fn: ResolveImage = async (src) => {
      const local = resolveImageSrc(src, path, config);
      return local ? cache.get(local) : src;
    };
    this.#resolver = { path, config, cache, fn };
    return fn;
  }

  #render(): void {
    const parts = this.#parts;
    const doc = this.#doc;
    const i18n = this.#i18n;
    const config = this.#config;
    const readBlob = this.#readBlob;
    if (!parts || !doc || !i18n || !config || !readBlob) return;
    this.#dirty = false;
    this.#run.cancelled = true;
    const run = { cancelled: false };
    this.#run = run;
    const cache = (this.#cache ??= new ImageUrlCache(readBlob));
    const { card, body, article } = parts;
    card.i18n = i18n;
    card.resolveImage = this.#resolveImage(doc.path, config, cache);
    card.frontmatter = doc.split.frontmatter;
    // La scheda si monta e smonta come in React: prima del corpo, solo con il frontmatter.
    reconcileList(article, doc.split.frontmatter ? ['card', 'body'] : ['body'], (k) => k, (k): HTMLElement => (k === 'card' ? card : body));
    void this.#fill(run, doc, cache, config, i18n, this.#highlight);
  }

  /** Corpo del documento (era l'effetto di render di Preview.tsx): HTML sanificato, immagini, link, evidenziazione. */
  async #fill(run: { cancelled: boolean }, doc: PreviewDoc, cache: ImageUrlCache, config: HouseConfig, i18n: I18nStore, highlight: string[]): Promise<void> {
    const body = this.#parts!.body;
    const { split } = doc;
    await setSafeHTML(body, renderMarkdown(split.body, { currentPath: doc.path, files: this.#files, lineOffset: split.bodyLine }));
    if (run.cancelled) return;
    this.#anchors = null;

    const used: string[] = [];
    const cardLocal = cardImagePath(split, doc.path, config);
    if (cardLocal) used.push(cardLocal);
    for (const img of body.querySelectorAll('img')) {
      const src = img.getAttribute('data-local-src') || img.getAttribute('src');
      const local = src ? resolveImageSrc(src, doc.path, config) : null;
      if (!local) continue;
      used.push(local);
      img.removeAttribute('src');
      void cache.get(local).then((url) => {
        if (run.cancelled) return;
        if (url) {
          img.src = url;
        } else {
          img.classList.add('missing-image');
          // Title nativo voluto (niente ::after su <img>): eccezione di tooltips.test.ts, che vuole il nome `img`.
          img.title = i18n.t('preview.imageMissing', { path: local });
        }
      });
    }
    void cache.retain(used);

    for (const a of body.querySelectorAll('a[href]')) {
      if (isExternalHref(a.getAttribute('href') ?? '')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }
    highlightTerms(body, highlight);
  }

  #getAnchors(): Anchor[] {
    if (this.#anchors) return this.#anchors;
    const scroller = this.#parts!.scroller;
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const list: Anchor[] = [{ line: 0, top: 0 }];
    for (const node of scroller.querySelectorAll<HTMLElement>(`[class*="${LINE_CLASS_PREFIX}"]`)) {
      const line = sourceLineOf(node);
      if (line !== null) list.push({ line, top: node.getBoundingClientRect().top - base });
    }
    list.sort((a, b) => a.line - b.line || a.top - b.top);
    this.#anchors = list.filter((a, i) => i === 0 || a.line !== list[i - 1].line);
    return this.#anchors;
  }

  #onScroll(): void {
    if (performance.now() < this.#suppressUntil) return;
    emit(this, 'hmd-top-line', { line: lineForOffset(this.#getAnchors(), this.#parts!.scroller.scrollTop) });
  }

  #onClick(event: MouseEvent): void {
    const target = event.target as Element;
    // Come Preview.tsx: un clic su un'immagine bloccata (`data-ai-image`) non segue il link che la contiene.
    if (target.closest('[data-ai-image]')) return;
    const link = target.closest('a');
    if (!link || !this.#doc) return;
    const action = linkAction(link.getAttribute('href') ?? '', this.#doc.path);
    if (action.kind === 'native') return;
    event.preventDefault();
    if (action.kind === 'wiki') emit(this, 'hmd-open-wiki', { target: action.target });
    else if (action.kind === 'open') emit(this, 'hmd-open', { path: action.path });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-preview': HmdPreview;
  }
}
