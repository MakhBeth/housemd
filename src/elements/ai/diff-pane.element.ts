import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';

import type { TextRange } from '../../ai/selectionChip';
import { el } from '../../dom/el';
import { docAppearance, editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import { applyDocRestore } from '../../editor/useDocBinding';
import { HmdDocElement } from '../editor/docElement';
import { lineNumberFor } from '../editor/editorLogic';
import { emit } from '../events';
import { controlDisabled, insideRange, rejectChange, type ControlAction } from './diffLogic';
import './diff-pane.css';

const LABEL: Record<ControlAction, 'ai.acceptBlock' | 'ai.rejectBlock'> = { accept: 'ai.acceptBlock', reject: 'ai.rejectBlock' };

/**
 * Diff della revisione AI (era DiffPane.tsx): MergeView con il documento a sinistra (a, dalla sessione:
 * stesse estensioni e stessi eventi di hmd-editor) e la proposta a destra (b). Regola: mai `setState`
 * sull'editor posseduto da MergeView; i ripristini passano da una transazione su `a`. Un documento nuovo
 * (`resetKey`) ricrea la MergeView e, se il focus era dentro, lo ridà alla vista nuova.
 * Per blocco: ← accetta (lo applica la libreria, `revertControls: 'b-to-a'`; il focus va su `a` perché
 * Ctrl+Z lo annulli), → rifiuta (l'originale torna in `b`, focus su `b`; l'ultimo rifiutato chiude).
 */
export class HmdAiDiffPane extends HmdDocElement {
  #proposal = '';
  #range: TextRange | null = null;
  #canAccept = false;
  #streaming = true;
  #beforeAccept: () => boolean = () => false;

  #box: HTMLDivElement | null = null;
  #merge: MergeView | null = null;
  #rightEditable = new Compartment();
  /** La proposta arriva da fuori: la sua transazione su `b` non è una modifica dell'utente. */
  #remote = false;
  /**
   * Testi mandati con `hmd-ai-proposal-edit` e non ancora tornati come `proposal`, dal più vecchio. Il
   * ritorno di uno di questi (anche in ritardo, dopo altre battute) è una conferma, non una proposta nuova:
   * il lato destro non si tocca.
   */
  #echoes: string[] = [];
  /** Ciò che la MergeView mostra già (gli effetti di DiffPane.tsx scattavano al cambio di questi valori). */
  #applied = { resetKey: '', restore: 0, readOnly: false, proposal: '', canAccept: false, streaming: true };
  #announce = false;
  #scheduled = false;

  /** Testo della proposta (già applicato al documento se la richiesta era su una selezione). */
  get proposal(): string { return this.#proposal; }
  set proposal(value: string) {
    this.#proposal = value ?? '';
    this.docInputChanged();
  }
  /** Tratto della selezione nella proposta: le modifiche a mano fuori da qui si scartano. */
  get range(): TextRange | null { return this.#range; }
  set range(value: TextRange | null) { this.#range = value ?? null; }
  get canAccept(): boolean { return this.#canAccept; }
  set canAccept(value: boolean) {
    this.#canAccept = value ?? false;
    this.docInputChanged();
  }
  /** Generazione in corso (o selezione persa): proposta in sola lettura, niente rifiuti. */
  get streaming(): boolean { return this.#streaming; }
  set streaming(value: boolean) {
    this.#streaming = value ?? true;
    this.docInputChanged();
  }
  /** Chiamata al `mousedown` di «accetta»: false ferma l'accettazione (fotografia «prima dell'AI» compresa). */
  get beforeAccept(): () => boolean { return this.#beforeAccept; }
  set beforeAccept(value: () => boolean) { this.#beforeAccept = value ?? (() => false); }

  next(): void {
    if (this.#merge) goToNextChunk(this.#merge.a);
  }

  previous(): void {
    if (this.#merge) goToPreviousChunk(this.#merge.a);
  }

  /** Porta in vista la riga sorgente `line` (0-based) del documento (avvisi della revisione). */
  scrollToLine(line: number): void {
    const a = this.#merge?.a;
    if (a) a.dispatch({ effects: EditorView.scrollIntoView(a.state.doc.line(lineNumberFor(line, a.state.doc.lines)).from) });
  }

  /** «Accetta tutto»: il testo intero con una transazione sul documento (annullabile con Ctrl+Z). */
  replace(text: string): void {
    const a = this.#merge?.a;
    if (a) a.dispatch({ changes: { from: 0, to: a.state.doc.length, insert: text }, userEvent: 'input.ai' });
  }

  focus(): void {
    this.#merge?.a.focus();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'diff' }));
    if (!this.#merge) {
      this.#create();
      this.#applied.restore = initialRestoreSeq(this.restore);
    }
    // Cambio di lingua: etichette dei pulsanti dei blocchi già disegnati.
    if (this.i18n) this.watch(this.i18n, () => this.#refreshControls(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#destroy();
  }

  protected i18nChanged(): void {
    this.reconnect();
  }

  protected docInputChanged(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  #create(): void {
    this.#merge = new MergeView({
      parent: this.#box!,
      a: this.docConfig(),
      b: {
        doc: this.#proposal,
        extensions: [
          basicSetup,
          EditorState.transactionFilter.of((tr) => (this.#remote || !tr.docChanged || insideRange(tr.changes, this.#range) ? tr : [])),
          docAppearance(),
          this.#rightEditable.of(readOnlyExtensions(this.#streaming)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || this.#remote) return;
            const text = update.state.doc.toString();
            this.#echoes.push(text);
            emit(this, 'hmd-ai-proposal-edit', { text });
          }),
        ],
      },
      revertControls: 'b-to-a',
      renderRevertControl: () => this.#controls(),
    });
    this.#echoes = [];
    Object.assign(this.#applied, {
      resetKey: this.resetKey, readOnly: this.readOnly, proposal: this.#proposal, canAccept: this.#canAccept, streaming: this.#streaming,
    });
    // Lo stato creato dalla sessione non passa dall'updateListener: la selezione si annuncia nel microtask.
    this.#announce = true;
    this.docInputChanged();
  }

  #destroy(): void {
    const merge = this.#merge;
    if (!merge) return;
    this.saveSession(merge.a.state);
    merge.destroy();
    this.#merge = null;
  }

  /** Gli effetti di DiffPane.tsx nel loro ordine: documento nuovo, proposta, sola lettura e pulsanti, ripristino. */
  #flush(): void {
    let merge = this.#merge;
    if (!merge) return;
    if (this.#applied.resetKey !== this.resetKey) {
      const hadFocus = merge.a.hasFocus || merge.b.hasFocus;
      this.#destroy();
      this.#create();
      merge = this.#merge!;
      if (hadFocus) merge.a.focus();
    }
    if (this.#announce) {
      this.#announce = false;
      emit(this, 'hmd-selection', { range: mainSelectionRange(merge.a.state) });
    }
    if (this.#applied.proposal !== this.#proposal) {
      this.#applied.proposal = this.#proposal;
      const echo = this.#echoes.indexOf(this.#proposal);
      if (echo >= 0) {
        // Conferma di una modifica fatta qui: si dimenticano lei e quelle prima, il lato destro è già più avanti.
        this.#echoes.splice(0, echo + 1);
      } else if (merge.b.state.doc.toString() !== this.#proposal) {
        // Proposta nuova da fuori (modello, documento cambiato sotto una selezione): sostituisce il lato destro.
        this.#echoes = [];
        this.#remote = true;
        try {
          merge.b.dispatch({ changes: { from: 0, to: merge.b.state.doc.length, insert: this.#proposal }, annotations: Transaction.addToHistory.of(false) });
        } finally {
          this.#remote = false;
        }
      }
    }
    const applied = this.#applied;
    if (applied.readOnly !== this.readOnly || applied.streaming !== this.#streaming || applied.canAccept !== this.#canAccept) {
      Object.assign(applied, { readOnly: this.readOnly, streaming: this.#streaming, canAccept: this.#canAccept });
      merge.a.dispatch({ effects: editable.reconfigure(readOnlyExtensions(this.readOnly)) });
      merge.b.dispatch({ effects: this.#rightEditable.reconfigure(readOnlyExtensions(this.#streaming)) });
      this.#refreshControls();
    }
    applied.restore = applyDocRestore(merge.a, applied.restore, this.restore);
  }

  /** Due pulsanti per blocco, creati dalla MergeView quando disegna il blocco (renderRevertControl). */
  #controls(): HTMLElement {
    const accept = this.#button('←', 'accept');
    const reject = this.#button('→', 'reject');
    const box = el('div', { class: 'revert' }, accept, reject);
    accept.addEventListener('mousedown', (event) => {
      if (!this.#canAccept || !this.#beforeAccept()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // La libreria applica il blocco subito dopo, sul documento: il focus va lì perché Ctrl+Z lo annulli.
      queueMicrotask(() => this.#merge?.a.focus());
    });
    accept.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && this.#canAccept) {
        event.preventDefault();
        accept.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }
    });
    const onReject = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#reject(Number(box.dataset.chunk));
    };
    reject.addEventListener('mousedown', onReject);
    reject.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') onReject(event);
    });
    return box;
  }

  #button(glyph: string, action: ControlAction): HTMLButtonElement {
    const label = this.translator()(LABEL[action]);
    return el(
      'button',
      {
        type: 'button',
        class: 'tooltip',
        dataset: { tooltip: label, action },
        'aria-label': label,
        disabled: controlDisabled(action, { canAccept: this.#canAccept, streaming: this.#streaming }),
      },
      glyph,
    );
  }

  /** Stato ed etichette dei pulsanti già disegnati (la MergeView li ricrea solo quando cambiano i blocchi). */
  #refreshControls(): void {
    const t = this.translator();
    for (const button of this.#box?.querySelectorAll<HTMLButtonElement>('.cm-merge-revert button') ?? []) {
      const action = button.dataset.action as ControlAction;
      button.disabled = controlDisabled(action, { canAccept: this.#canAccept, streaming: this.#streaming });
      const label = t(LABEL[action]);
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
    }
  }

  /** Rifiuto di un blocco: il testo originale torna nella proposta (verso opposto a quello della libreria). */
  #reject(index: number): void {
    const merge = this.#merge;
    const chunk = merge?.chunks[index];
    if (!merge || !chunk || this.#streaming) return;
    merge.b.dispatch({ changes: rejectChange(merge.a.state, merge.b.state, chunk), userEvent: 'revert' });
    // Focus sulla proposta: Ctrl+Z annulla il rifiuto (è nella cronologia di b).
    if (merge.chunks.length === 0) emit(this, 'hmd-ai-all-rejected', null);
    else merge.b.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-diff-pane': HmdAiDiffPane;
  }
}
