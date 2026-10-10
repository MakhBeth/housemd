import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { SearchResult } from '../../search/searchIndex';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { SEARCH_DEBOUNCE_MS, searchItemKey, searchItems, type SearchItem } from './searchView';
import { segments } from './segments';
import './search-panel.css';

/** Ciò che il pannello chiede all'indice (Workspace.search). */
export interface SearchSource {
  search(query: string): SearchResult[];
}

interface Parts {
  box: HTMLDivElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
}

/** Nodi di una riga dei risultati; `item` è l'ultimo ricevuto (il clic lo legge al momento). */
interface ResultRow {
  item: SearchItem;
  title?: HTMLSpanElement;
  path?: HTMLSpanElement;
  snippet?: HTMLSpanElement;
  /** Testo e termini disegnati nell'estratto: si ridisegna solo se cambiano. */
  drawn?: string;
}

/**
 * Ricerca nella sidebar (era SearchPanel.tsx). Il campo si crea una volta e non viene mai riscritto
 * dall'elemento (tranne Esc, che lo svuota): la query è sua, non arriva da fuori. Risultati dopo
 * 120 ms dall'ultima battuta, o da un nuovo indice; Invio apre subito il primo. Un timer rimasto dopo il
 * distacco non disegna nulla.
 */
export class HmdSearchPanel extends HmdElement {
  #index: SearchSource | null = null;
  #indexRevision = 0;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, ResultRow>();
  #query = '';
  #results: SearchResult[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Una ricerca chiesta (o interrotta dal distacco) mentre l'elemento era staccato: riparte al ricollegamento. */
  #pending = false;
  #rendering = false;
  #again = false;

  get index(): SearchSource | null { return this.#index; }
  set index(value: SearchSource | null) {
    value ??= null;
    if (value === this.#index) return;
    this.#index = value;
    this.#debounce();
  }
  get indexRevision(): number { return this.#indexRevision; }
  set indexRevision(value: number) {
    value ??= 0;
    if (value === this.#indexRevision) return;
    this.#indexRevision = value;
    this.#debounce();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  /** Porta il focus nella casella (Ctrl+K). */
  focusInput(): void {
    this.#parts?.input.focus();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const input = el('input', {
        type: 'search',
        class: 'input',
        on: {
          input: () => this.#setQuery(input.value),
          keydown: (event) => this.#onKeyDown(event),
        },
      });
      const box = el('div', { class: 'search', role: 'search' }, icon('search', { size: 16, className: 'searchIcon' }), input);
      this.append(box);
      this.#parts = { box, input, list: el('ul', { class: 'results' }) };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#update(), signal);
    // Ricollegato dopo un distacco con una ricerca in sospeso: riparte la pausa. A reconnect (cambio di
    // lingua) #pending è falso e non riparte nulla.
    if (this.#pending) {
      this.#pending = false;
      this.#debounce();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco (non a reconnect, che arriva con un cambio di lingua): un timer tardivo non disegna,
    // ma la ricerca che aspettava riparte se lo stesso elemento torna nel documento.
    if (this.#timer !== undefined) this.#pending = true;
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #setQuery(query: string): void {
    this.#query = query;
    this.#update();
    this.#debounce();
  }

  /** Come l'effetto [query, index, indexRevision] di React: la ricerca riparte dopo la pausa. */
  #debounce(): void {
    if (!this.isConnected) {
      this.#pending = true;
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (!this.isConnected || !this.#index) return;
      this.#results = this.#index.search(this.#query);
      this.#update();
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Un render alla volta, come albero e cronologia: uno chiesto da dentro (un listener) si ripete alla fine. */
  #update(): void {
    if (!this.#parts || !this.#i18n || !this.isConnected) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    const { input, list } = this.#parts;
    // Il focus si guarda prima della prima passata e si recupera dopo l'ultima (come nell'albero): anche
    // quando l'ultima toglie l'elenco intero (query svuotata).
    const hadFocus = list.contains(document.activeElement);
    this.#rendering = true;
    try {
      // Un listener sincrono può aver tolto lo store o staccato l'elemento: nessuna passata senza.
      do {
        this.#again = false;
        this.#render(this.#parts, this.#i18n);
      } while (this.#again && this.#parts && this.#i18n && this.isConnected);
    } finally {
      this.#rendering = false;
    }
    // Il risultato con il focus è sparito (file eliminato o non più trovato): il focus torna nella casella.
    if (hadFocus && this.isConnected && !list.contains(document.activeElement)) input.focus();
  }

  #onKeyDown(event: KeyboardEvent): void {
    // Invio non aspetta la pausa: cerca subito sulla query corrente.
    if (event.key === 'Enter') {
      const first = this.#index?.search(this.#query)[0];
      if (first) emit(this, 'hmd-search-open', { path: first.path, terms: first.terms });
    }
    if (event.key === 'Escape') {
      this.#parts!.input.value = '';
      this.#setQuery('');
    }
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { box, input, list } = parts;
    const t = i18n.t;
    toggleAttr(input, 'placeholder', true, t('search.placeholder'));
    toggleAttr(input, 'aria-label', true, t('search.label'));
    const items = searchItems(this.#query, this.#results);
    if (!items) {
      list.remove();
      return;
    }
    toggleAttr(list, 'aria-label', true, t('search.results'));
    reconcileList(list, items, searchItemKey, (item) => this.#createRow(item), (li, item) => this.#updateRow(li, item, i18n));
    if (list.parentNode !== box) box.append(list);
  }

  #createRow(item: SearchItem): HTMLLIElement {
    if (item.kind === 'none') {
      const li = el('li', { class: 'none' });
      this.#rows.set(li, { item });
      return li;
    }
    const row: ResultRow = { item, title: el('span', { class: 'title' }), path: el('span', { class: 'path' }), snippet: el('span', { class: 'snippet' }) };
    const open = () => {
      if (row.item.kind === 'result') emit(this, 'hmd-search-open', { path: row.item.result.path, terms: row.item.result.terms });
    };
    const li = el('li', null, el('button', { class: 'result', on: { click: open } }, row.title, row.path, row.snippet));
    this.#rows.set(li, row);
    return li;
  }

  #updateRow(li: HTMLLIElement, item: SearchItem, i18n: I18nStore): void {
    const row = this.#rows.get(li)!;
    row.item = item;
    if (item.kind === 'none') {
      setText(li, i18n.t('search.none'));
      return;
    }
    const { title, path, snippet, terms } = item.result;
    setText(row.title!, title);
    setText(row.path!, path);
    const drawn = JSON.stringify([snippet, terms]);
    if (row.drawn === drawn) return;
    row.drawn = drawn;
    row.snippet!.replaceChildren(...segments(snippet, terms).map((part) => (part.mark ? el('mark', null, part.text) : part.text)));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-search-panel': HmdSearchPanel;
  }
}
