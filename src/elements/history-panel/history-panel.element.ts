import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { Snapshot } from '../../history/historyStore';
import { formatRelative } from '../../i18n/i18n';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { MARK, diffView, versionItemKey, versionItems, type DiffView, type VersionItem } from './historyView';
import './history-panel.css';

/** Ciò che il pannello chiede al Workspace: le versioni di un file e il contatore dei salvataggi. */
export interface HistorySource {
  subscribe(listener: () => void): () => void;
  getState(): { indexRevision: number };
  listHistory(path: string): Promise<Snapshot[]>;
}

interface Parts {
  panel: HTMLDivElement;
  title: HTMLHeadingElement;
  close: HTMLButtonElement;
  empty: HTMLParagraphElement;
  list: HTMLUListElement;
  diff: HTMLElement;
  note: HTMLParagraphElement;
  lines: HTMLPreElement;
  restore: HTMLButtonElement;
}

/** Nodi di una riga dell'elenco; `item` è l'ultimo ricevuto (il clic lo legge al momento). */
interface VersionRow {
  item: VersionItem;
  button?: HTMLButtonElement;
  when?: HTMLSpanElement;
  reason?: HTMLSpanElement;
}

/**
 * Cronologia del file aperto (era HistoryPanel.tsx): elenco delle versioni, diff dal testo attuale alla
 * versione scelta, «Ripristina» (che il workspace applica come transazione dell'editor, annullabile).
 * L'elenco si ricarica a ogni salvataggio (indexRevision) e al cambio di file; una risposta superata da
 * una richiesta più nuova, o arrivata dopo il distacco, si scarta.
 */
export class HmdHistoryPanel extends HmdElement {
  #workspace: HistorySource | null = null;
  #path = '';
  #currentText = '';
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, VersionRow>();
  #versionButtons = new Map<number, HTMLButtonElement>();
  #versions: Snapshot[] | null = null;
  #selected: number | null = null;
  /** Versione del diff mostrato, per «Ripristina». */
  #shown: number | null = null;
  /** Ultimo elenco chiesto (file e salvataggi): una notifica del workspace che non lo cambia non ricarica. */
  #loaded: { path: string; revision: number } | null = null;
  #request = 0;
  /**
   * Ultimo diff calcolato e per cosa (come useMemo di React): elenco, scelta e testo uguali → stesso diff e
   * stesse righe nel DOM, così una notifica qualsiasi non toglie una selezione fatta nel diff.
   */
  #diff: { versions: Snapshot[] | null; selected: number | null; currentText: string; view: DiffView } | null = null;
  #rendering = false;
  #again = false;

  get workspace(): HistorySource | null { return this.#workspace; }
  set workspace(value: HistorySource | null) {
    value ??= null;
    if (value === this.#workspace) return;
    this.#workspace = value;
    this.#loaded = null;
    // Una risposta del workspace di prima non vale più, anche se ora non parte nessuna richiesta (null).
    this.#request++;
    this.reconnect();
  }
  get path(): string { return this.#path; }
  set path(value: string) {
    value ??= '';
    if (value === this.#path) return;
    this.#path = value;
    // Cambio di file: l'elenco del file di prima non resta visibile mentre arriva quello nuovo.
    this.#versions = null;
    this.#selected = null;
    // Una risposta per il file di prima non vale più, anche se una nuova non può partire (niente workspace).
    this.#request++;
    this.#reload();
    this.#update();
  }
  get currentText(): string { return this.#currentText; }
  set currentText(value: string) {
    value ??= '';
    if (value === this.#currentText) return;
    this.#currentText = value;
    this.#update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const title = el('h2', { class: 'title' });
      const close = el('button', { class: 'close tooltip', on: { click: () => emit(this, 'hmd-history-close', null) } }, icon('close'));
      const restore = el('button', {
        class: 'restore',
        on: { click: () => this.#shown !== null && emit(this, 'hmd-history-restore', { id: this.#shown }) },
      });
      const note = el('p', { class: 'note' });
      const parts: Parts = {
        panel: el('div', { class: 'panel' }),
        title,
        close,
        empty: el('p', { class: 'note' }),
        list: el('ul', { class: 'list' }),
        diff: el('section', { class: 'diff' }),
        note,
        lines: el('pre', { class: 'lines' }),
        restore,
      };
      parts.panel.append(el('header', { class: 'header' }, title, close), parts.list, parts.diff);
      this.append(parts.panel);
      this.#parts = parts;
    }
    const { workspace, i18n } = { workspace: this.#workspace, i18n: this.#i18n };
    if (i18n) this.watch(i18n, () => this.#update(), signal);
    // Ogni notifica ridisegna (le date relative si ricalcolano, come a ogni render di React); ricarica
    // solo se è cambiato il contatore dei salvataggi.
    if (workspace) this.watch(workspace, () => (this.#reload(), this.#update()), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco: una risposta in arrivo non tocca più nulla; ricollegato, l'elenco si richiede.
    this.#request++;
    this.#loaded = null;
  }

  #reload(): void {
    const workspace = this.#workspace;
    if (!workspace || !this.isConnected) return;
    const path = this.#path;
    const revision = workspace.getState().indexRevision;
    if (this.#loaded?.path === path && this.#loaded.revision === revision) return;
    this.#loaded = { path, revision };
    const request = ++this.#request;
    void workspace.listHistory(path).then((list) => {
      if (request !== this.#request) return;
      this.#versions = list;
      this.#update();
    });
  }

  #update(): void {
    if (!this.#parts || !this.#i18n || !this.isConnected) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        this.#render(this.#parts, this.#i18n);
      } while (this.#again);
    } finally {
      this.#rendering = false;
    }
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { panel, title, close, empty, list, diff, note, lines, restore } = parts;
    const t = i18n.t;
    const hadFocus = panel.contains(document.activeElement);
    setText(title, t('history.title', { path: this.#path }));
    toggleAttr(close, 'aria-label', true, t('history.close'));
    toggleAttr(close, 'data-tooltip', true, t('history.close'));

    const versions = this.#versions;
    if (versions !== null && versions.length === 0) {
      setText(empty, t('history.empty'));
      if (empty.parentNode !== panel) list.before(empty);
    } else {
      empty.remove();
    }
    list.setAttribute('aria-busy', String(versions === null));
    const now = new Date();
    const locale = i18n.getState().locale;
    this.#versionButtons.clear();
    reconcileList(list, versionItems(versions), versionItemKey, (item) => this.#createRow(item), (li, item) => {
      const row = this.#rows.get(li)!;
      row.item = item;
      if (item.kind === 'loading') {
        setText(li, t('history.loading'));
        return;
      }
      const { id, savedAt, reason } = item.version;
      row.button!.setAttribute('aria-pressed', String(id === this.#selected));
      setText(row.when!, formatRelative(locale, new Date(savedAt), now));
      setText(row.reason!, t(`history.reason.${reason}`));
      this.#versionButtons.set(id, row.button!);
    });

    const memo = this.#diff;
    const fresh = !memo || memo.versions !== versions || memo.selected !== this.#selected || memo.currentText !== this.#currentText;
    const view = fresh ? diffView(versions, this.#selected, this.#currentText) : memo.view;
    if (fresh) {
      this.#diff = { versions, selected: this.#selected, currentText: this.#currentText, view };
      if (view.kind === 'diff') lines.replaceChildren(...view.rows.map((row) => el('span', { class: 'line', dataset: { kind: row.kind } }, MARK[row.kind], row.text, '\n')));
    }
    this.#shown = view.kind === 'diff' ? view.version.id : null;
    setText(note, t(view.kind === 'pick' ? 'history.pick' : view.kind === 'identical' ? 'history.identical' : 'history.legend'));
    if (view.kind === 'diff') setText(restore, t('history.restore'));
    const children = view.kind === 'diff' ? [note, lines, restore] : [note];
    // Solo se cambia la forma: riappendere «Ripristina» gli toglierebbe il focus.
    if (diff.children.length !== children.length || children.some((child, i) => diff.children[i] !== child)) diff.replaceChildren(...children);

    // Il nodo con il focus è sparito («Ripristina» dopo un ripristino, che rende il testo identico):
    // il focus va sulla versione scelta, o sul pulsante di chiusura.
    if (hadFocus && !panel.contains(document.activeElement)) (this.#versionButtons.get(this.#selected ?? NaN) ?? close).focus();
  }

  #createRow(item: VersionItem): HTMLLIElement {
    if (item.kind === 'loading') {
      const li = el('li', { class: 'note' });
      this.#rows.set(li, { item });
      return li;
    }
    const row: VersionRow = { item, when: el('span'), reason: el('span', { class: 'reason' }) };
    row.button = el(
      'button',
      {
        class: 'version',
        on: {
          click: () => {
            if (row.item.kind !== 'version') return;
            this.#selected = row.item.version.id;
            this.#update();
          },
        },
      },
      row.when,
      row.reason,
    );
    const li = el('li', null, row.button);
    this.#rows.set(li, row);
    return li;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-history-panel': HmdHistoryPanel;
  }
}
