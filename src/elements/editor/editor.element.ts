import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { el } from '../../dom/el';
import { focusCompartment, focusExtensions } from '../../editor/focusMode';
import type { FocusUnit } from '../../editor/focusRange';
import { editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import { applyDocRestore } from '../../editor/useDocBinding';
import { emit } from '../events';
import { SCROLL_SUPPRESS_MS } from '../preview/previewView';
import { HmdDocElement } from './docElement';
import { lineNumberFor, scrollTopFor, topLine } from './editorLogic';
import './editor.css';

/**
 * Editor del documento (era Editor.tsx). La EditorView nasce alla connessione e muore al distacco (la
 * sessione conserva testo, selezione e cronologia); un documento nuovo arriva con `setState` sulla stessa
 * vista. Documento nuovo, ripristino e sola lettura si applicano in un microtask nell'ordine degli
 * effetti di Editor.tsx: mai dentro un aggiornamento di CodeMirror, mai durante il commit di React.
 */
export class HmdEditor extends HmdDocElement {
  #box: HTMLDivElement | null = null;
  #view: EditorView | null = null;
  /** Ciò che la vista mostra già: chiave del documento, ultimo ripristino, sola lettura. */
  #applied = { resetKey: '', restore: 0, readOnly: false };
  /** Selezione da annunciare: uno stato creato da zero non passa dall'updateListener. */
  #announce = false;
  #scheduled = false;
  #suppressUntil = 0;
  #focus = false;
  #focusUnit: FocusUnit = 'paragraph';
  #appliedFocus = '';

  /** Modalità focus (grigio fuori dall'unità del cursore) e sua unità: si riconfigurano a caldo. */
  get focusMode(): boolean { return this.#focus; }
  set focusMode(value: boolean) {
    if (!!value === this.#focus) return;
    this.#focus = !!value;
    this.#applyFocus();
  }
  get focusUnit(): FocusUnit { return this.#focusUnit; }
  set focusUnit(value: FocusUnit) {
    if (value === this.#focusUnit) return;
    this.#focusUnit = value;
    this.#applyFocus();
  }

  protected override initialFocus() {
    this.#appliedFocus = this.#focusKey();
    return focusExtensions(this.#focusConfig());
  }

  #focusConfig() {
    return { enabled: this.#focus, unit: this.#focusUnit, locale: this.i18n?.getState().locale ?? 'en' };
  }

  #focusKey(): string {
    const { enabled, unit, locale } = this.#focusConfig();
    return `${enabled}/${unit}/${locale}`;
  }

  #applyFocus(): void {
    const view = this.#view;
    if (!view || this.#appliedFocus === this.#focusKey()) return;
    this.#appliedFocus = this.#focusKey();
    // Mai dentro un aggiornamento di CodeMirror: i setter arrivano dal render, ma una vista può essere in dispatch.
    queueMicrotask(() => {
      if (this.#view === view) view.dispatch({ effects: focusCompartment.reconfigure(focusExtensions(this.#focusConfig())) });
    });
  }

  /** Porta in cima la riga sorgente `line` (0-based, frazionaria); lo scroll che ne segue non torna all'anteprima. */
  scrollToLine(line: number): void {
    const view = this.#view;
    if (!view) return;
    const box = view.lineBlockAt(view.state.doc.line(lineNumberFor(line, view.state.doc.lines)).from);
    this.#suppressUntil = performance.now() + SCROLL_SUPPRESS_MS;
    view.scrollDOM.scrollTop = scrollTopFor(line, box);
  }

  /** Focus nel testo (passaggio tra editor e diff nella revisione AI). */
  focus(): void {
    this.#view?.focus();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'editor' }));
    if (!this.#view) {
      this.#view = new EditorView({ parent: this.#box, state: EditorState.create(this.docConfig()) });
      // Il ripristino già presente è già nel testo (come al montaggio di Editor.tsx).
      this.#applied = { resetKey: this.resetKey, restore: initialRestoreSeq(this.restore), readOnly: this.readOnly };
      // La selezione della sessione si annuncia in un microtask, non qui: siamo dentro il commit di React.
      this.#announce = true;
      this.docInputChanged();
    }
    this.#view.scrollDOM.addEventListener('scroll', () => this.#onScroll(), { passive: true, signal });
    // Una lingua nuova: il nome del contenuto subito (contentAttributes lo rilegge solo al prossimo aggiornamento,
    // e un aggiornamento vuoto qui passerebbe dalla sessione).
    if (this.i18n) this.watch(this.i18n, () => this.#relabel(), signal);
  }

  /** Un altro store con l'editor collegato: le iscrizioni passano dal vecchio al nuovo e il nome si riscrive. */
  protected override i18nChanged(): void {
    this.reconnect();
    this.#relabel();
  }

  #relabel(): void {
    this.#applyFocus();
    this.#view?.contentDOM.setAttribute('aria-label', this.docHost.contentLabel());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Come lo smontaggio di Editor.tsx: la sessione conserva testo, selezione e cronologia per la vista dopo.
    const view = this.#view;
    if (!view) return;
    this.saveSession(view.state);
    view.destroy();
    this.#view = null;
  }

  protected docInputChanged(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  /** Gli effetti di Editor.tsx nel loro ordine: documento nuovo e sua selezione, ripristino, sola lettura. */
  #flush(): void {
    const view = this.#view;
    if (!view) return;
    const generation = this.docGeneration;
    if (this.#applied.resetKey !== this.resetKey) {
      view.setState(EditorState.create(this.docConfig()));
      this.#applied.resetKey = this.resetKey;
      this.#applied.readOnly = this.readOnly;
      this.#announce = true;
    }
    if (this.#announce) {
      this.#announce = false;
      emit(this, 'hmd-selection', { range: mainSelectionRange(view.state) });
      // Un listener ha cambiato documento o vista: ripristino e sola lettura nuovi tocca al flush dopo.
      if (this.docGeneration !== generation || this.#view !== view) return;
    }
    // Non passa da resetKey: la sostituzione resta nella cronologia di annullamento. Una volta sola.
    this.#applied.restore = applyDocRestore(view, this.#applied.restore, this.restore);
    if (this.#applied.readOnly !== this.readOnly) {
      this.#applied.readOnly = this.readOnly;
      view.dispatch({ effects: editable.reconfigure(readOnlyExtensions(this.readOnly)) });
    }
  }

  #onScroll(): void {
    const view = this.#view;
    if (!view || performance.now() < this.#suppressUntil) return;
    const scrollTop = view.scrollDOM.scrollTop;
    const box = view.lineBlockAtHeight(scrollTop);
    emit(this, 'hmd-top-line', { line: topLine(view.state.doc.lineAt(box.from).number, box, scrollTop) });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-editor': HmdEditor;
  }
}
