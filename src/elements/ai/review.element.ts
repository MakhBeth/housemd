import type { AiState } from '../../ai/aiController';
import type { Proposal } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import type { HmdEditor } from '../editor/editor.element';
import type { HmdAiDiffPane } from './diff-pane.element';
import type { HmdAiReviewBar } from './review-bar.element';
import type { ReviewAction } from './reviewBarView';
import { acceptNeedsConfirm, editedProposal, elapsedSeconds, reviewModel, type ReviewController, type ReviewDoc } from './reviewView';
import './review.css';

interface Parts {
  section: HTMLElement;
  hint: HTMLParagraphElement;
  editorBox: HTMLDivElement;
  editor: HmdEditor;
  bar: HmdAiReviewBar;
  stream: HTMLDetailsElement;
  streamSummary: HTMLElement;
  streamPre: HTMLPreElement;
  diff: HmdAiDiffPane;
}

/**
 * Revisione della proposta AI (era ReviewView.tsx): editor semplice senza proposta (con la barra durante
 * la generazione) o quando la proposta è già applicata; altrimenti la barra, l'anteprima della risposta in
 * arrivo (proposta ritoccata a mano) e il diff. Crea i figli `hmd-*` e passa loro le proprietà prima
 * dell'inserimento. Passando tra diff ed editor semplice il focus segue l'editor nuovo, se prima era nella
 * revisione o sul body (come l'effetto di ReviewView.tsx): così il Ctrl+Z successivo arriva ancora a
 * CodeMirror, e «Scarta» con il focus sul pulsante lascia il focus nell'editor, non sul body. Un focus su
 * un pulsante della barra che resta non si sposta (rilievo di A11y su LAB-11).
 */
export class HmdAiReview extends HmdElement {
  #controller: ReviewController | null = null;
  #doc: ReviewDoc | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #elapsed = 0;
  /** Contatore dei secondi legato al run in corso (l'effetto `[state.running]` di ReviewView.tsx). */
  #timer: { running: NonNullable<AiState['running']>; id: ReturnType<typeof setInterval> } | null = null;
  #shownView: 'plain' | 'diff' | null = null;
  /** I dialog aperti da qui si chiudono al distacco. */
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#doc && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#doc!, this.#i18n!),
    focusScope: () => this.#parts?.section ?? null,
    // Il nodo con il focus è sparito (Scarta o Accetta tutto dalla barra, la barra che se ne va): il focus va nell'editor della vista mostrata.
    refocus: () => this.#focusEditor(),
  });

  get controller(): ReviewController | null { return this.#controller; }
  set controller(value: ReviewController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  /** Il documento aperto: un oggetto nuovo a ogni render di React, i campi si confrontano nel render. */
  get doc(): ReviewDoc | null { return this.#doc; }
  set doc(value: ReviewDoc | null) {
    this.#doc = value ?? null;
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
      const streamSummary = el('summary');
      const streamPre = el('pre');
      const docEvents = {
        'hmd-doc-change': (event: HTMLElementEventMap['hmd-doc-change']) => this.#doc?.docChanged(event.detail.changes, event.detail),
        'hmd-selection': (event: HTMLElementEventMap['hmd-selection']) => this.#doc?.selectionChanged(event.detail.range),
      };
      const parts: Parts = {
        section: el('section', { class: 'review' }),
        hint: el('p', { class: 'hint' }),
        editorBox: el('div', { class: 'editor' }),
        editor: el('hmd-editor', { on: docEvents }),
        bar: el('hmd-ai-review-bar', {
          on: {
            'hmd-ai-review-action': (event) => this.#onAction(event.detail.action),
            'hmd-ai-review-warning': (event) => this.#parts?.diff.scrollToLine((event.detail.warning as { line?: number }).line ?? 0),
          },
        }),
        stream: el('details', { class: 'stream' }, streamSummary, streamPre),
        streamSummary,
        streamPre,
        diff: el('hmd-ai-diff-pane', {
          on: {
            ...docEvents,
            'hmd-ai-proposal-edit': (event) => this.#edit(event.detail.text),
            'hmd-ai-all-rejected': () => this.#discard(),
          },
        }),
      };
      // Letta al mousedown di «accetta» di un blocco, sulla proposta di quel momento (come la closure di ReviewView.tsx).
      parts.diff.beforeAccept = () => {
        const p = this.#current();
        return !!p && !!this.#controller?.beforeAccept(p);
      };
      parts.editorBox.append(parts.editor);
      this.#parts = parts;
      this.append(parts.section);
    }
    this.#dialogs ??= new AbortController();
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#onState(controller), signal);
    this.watch(i18n, () => this.#update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTimer();
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Il contatore dei secondi segue il run in corso: parte, si ferma e riparte con lui. */
  #onState(controller: ReviewController): void {
    const running = controller.getState().running;
    if (running !== (this.#timer?.running ?? null)) {
      this.#stopTimer();
      if (running) {
        const tick = () => {
          this.#elapsed = elapsedSeconds(running, Date.now());
          this.#update();
        };
        this.#elapsed = elapsedSeconds(running, Date.now());
        this.#timer = { running, id: setInterval(tick, 1000) };
      } else {
        this.#elapsed = 0;
      }
    }
    this.#update();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer.id);
    this.#timer = null;
  }

  /**
   * Un render, più la regola dell'effetto `[view]` di ReviewView.tsx: quando la vista cambia (diff ↔ editor
   * semplice) e il focus era sul body o dentro la revisione, il focus va nell'editor della vista nuova.
   * Eccezione (rilievo di A11y su LAB-11, WCAG 2.4.3 e 3.2.2): il focus dentro la barra, che resta montata
   * (Accetta tutto attivato durante la generazione, poi arriva la proposta), resta dov'è: nessun cambio di
   * focus senza un'azione, e nel diff un secondo Invio scriverebbe nel documento. Se il pulsante sparisce
   * con la barra, il recupero del `RenderLoop` porta il focus nell'editor.
   */
  #update(): void {
    const doc = this.ownerDocument;
    const active = doc.activeElement;
    const parts = this.#parts;
    const inReview = active === doc.body || (!!parts?.section.contains(active) && !parts.bar.contains(active));
    const before = this.#shownView;
    this.#loop.update();
    if (inReview && before !== null && before !== this.#shownView && this.isConnected) this.#focusEditor();
  }

  #focusEditor(): void {
    const parts = this.#parts;
    if (!parts) return;
    if (this.#shownView === 'plain') parts.editor.focus();
    else parts.diff.focus();
  }

  #current(): Proposal | undefined {
    const doc = this.#doc;
    return doc ? this.#controller?.getState().proposals.get(doc.path) : undefined;
  }

  #onAction(action: ReviewAction): void {
    const parts = this.#parts;
    const controller = this.#controller;
    const doc = this.#doc;
    if (!parts || !controller || !doc) return;
    switch (action) {
      case 'previous':
        return parts.diff.previous();
      case 'next':
        return parts.diff.next();
      case 'continue':
        return void controller.continue(doc.path);
      case 'discard':
        return this.#discard();
      case 'acceptAll':
        return this.#acceptAll();
    }
  }

  #discard(): void {
    const p = this.#current();
    if (p) this.#controller?.discard(p.path);
  }

  /**
   * «Accetta tutto»: con il documento cambiato dopo una proposta intera chiede conferma; la conferma accetta
   * la proposta del momento in cui risponde. La risposta arriva dopo che la Promise si è risolta: se nel
   * frattempo la vista si è staccata (anche se poi è tornata, con un AbortController nuovo) non si accetta.
   */
  #acceptAll(): void {
    const p = this.#current();
    const doc = this.#doc;
    const t = this.#i18n?.t;
    if (!p || !doc || !t) return;
    if (!acceptNeedsConfirm(p, doc.text)) return this.#accept();
    const signal = this.#dialogs?.signal;
    if (!signal) return;
    void showConfirmDialog({ title: t('ai.acceptAll'), message: t('ai.changedWarning'), confirmLabel: t('ai.acceptAll'), t, signal }).then((ok) => {
      if (ok && !signal.aborted && this.isConnected) this.#accept();
    });
  }

  #accept(): void {
    const p = this.#current();
    const controller = this.#controller;
    if (!p || !controller || !controller.beforeAccept(p, true)) return;
    const next = controller.proposalText(p);
    if (next !== null) this.#parts?.diff.replace(next);
  }

  /** Proposta ritoccata nel diff: con una selezione, al controller arriva solo il tratto. */
  #edit(text: string): void {
    const p = this.#current();
    const doc = this.#doc;
    if (p && doc) this.#controller?.edited(p.path, editedProposal(p, doc.text, text));
  }

  #render(parts: Parts, controller: ReviewController, doc: ReviewDoc, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const m = reviewModel(state, doc, this.#elapsed, controller);
    // Le stesse proprietà per l'editor semplice e per il lato documento del diff, prima dell'inserimento e solo se cambiano.
    for (const target of [parts.editor, parts.diff]) {
      if (target.text !== doc.text) target.text = doc.text;
      if (target.resetKey !== doc.resetKey) target.resetKey = doc.resetKey;
      if (target.session !== doc.session) target.session = doc.session;
      if (target.restore !== doc.restore) target.restore = doc.restore;
      if (target.readOnly !== doc.readOnly) target.readOnly = doc.readOnly;
      if (target.getDocs !== doc.getDocs) target.getDocs = doc.getDocs;
      if (target.saveImage !== doc.saveImage) target.saveImage = doc.saveImage;
      if (target.i18n !== i18n) target.i18n = i18n;
    }
    const { bar, diff } = parts;
    if (bar.i18n !== i18n) bar.i18n = i18n;
    bar.status = m.status;
    if (bar.warnings !== m.warnings) bar.warnings = m.warnings;
    bar.acceptBlocker = m.acceptBlocker;
    // Identità della proposta (come ReviewView.tsx dopo LAB-11): quando cambia, la nota della barra si svuota senza ricreare la barra.
    const proposalId = m.proposal ? `${m.proposal.path}#${m.proposal.createdAt}` : '';
    if (bar.proposalId !== proposalId) bar.proposalId = proposalId;
    if (diff.proposal !== m.text) diff.proposal = m.text;
    if (diff.range?.from !== m.range?.from || diff.range?.to !== m.range?.to) diff.range = m.range;
    const canAcceptBlock = m.proposal ? controller.canAccept(m.proposal) : false;
    if (diff.canAccept !== canAcceptBlock) diff.canAccept = canAcceptBlock;
    if (diff.streaming !== m.streaming) diff.streaming = m.streaming;
    setText(parts.hint, t('ai.emptyProposal'));
    setText(parts.streamSummary, t('ai.streamingPreview'));
    setText(parts.streamPre, state.streamingPreview ?? '');
    // I figli della sezione nell'ordine di ReviewView.tsx: si tolgono quelli di troppo, si inseriscono i mancanti, nessuno si sposta.
    const wanted: Element[] = m.view === 'plain' ? [...(m.bar ? [bar] : m.hint ? [parts.hint] : []), parts.editorBox] : [bar, ...(state.streamingPreview ? [parts.stream] : []), diff];
    for (const node of [parts.hint, parts.editorBox, bar, parts.stream, diff]) if (!wanted.includes(node) && node.parentNode === parts.section) node.remove();
    let cursor: Element | null = parts.section.firstElementChild;
    for (const node of wanted) {
      if (node === cursor) cursor = cursor.nextElementSibling;
      else parts.section.insertBefore(node, cursor);
    }
    this.#shownView = m.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-review': HmdAiReview;
  }
}
