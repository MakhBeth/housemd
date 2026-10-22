import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { StyleModule } from 'style-mod';

import type { AcceptBlocker } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import { el } from '../../dom/el';
import { docAppearance, editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import { applyDocRestore } from '../../editor/useDocBinding';
import { HmdDocElement } from '../editor/docElement';
import { lineNumberFor } from '../editor/editorLogic';
import { emit } from '../events';
import { insideRange, rejectChange, type ControlAction } from './diffLogic';
import './diff-pane.css';

const LABEL: Record<ControlAction, 'ai.acceptBlock' | 'ai.rejectBlock'> = { accept: 'ai.acceptBlock', reject: 'ai.rejectBlock' };

/**
 * Le tre proprietà dei pulsanti per blocco che `@codemirror/merge` dichiara nel suo `StyleModule`, fuori da ogni
 * layer (`.cm-merge-revert button`: `position: absolute`, `background: none`, `cursor: pointer`). Uno stile fuori
 * dai layer vince su ogni regola normale di un layer (`diff-pane.css`): qui stanno nella stessa origine, con una
 * specificità più alta (0,2,1 contro 0,1,1), e vincono senza forzare la priorità (analisi del layer `vendor`, piano 6c).
 * Il resto dell'aspetto dei pulsanti resta nel foglio. I pulsanti non si disattivano mai (regola «mai disabled»): un
 * pulsante bloccato ha lo stesso aspetto, cursore `pointer` della libreria compreso.
 */
const revertButtonStyles = EditorView.styleModule.of(
  new StyleModule({
    '.cm-merge-revert > .revert > button': { position: 'static' },
    '.cm-merge-revert > .revert > button:hover': { background: 'var(--c-accent-soft)' },
  }),
);

/**
 * Diff della revisione AI (era DiffPane.tsx): MergeView con il documento a sinistra (a, dalla sessione:
 * stesse estensioni e stessi eventi di hmd-editor) e la proposta a destra (b). Regola: mai `setState`
 * sull'editor posseduto da MergeView; i ripristini passano da una transazione su `a`. Un documento nuovo
 * (`resetKey`) ricrea la MergeView e, se il focus era dentro, lo ridà alla vista nuova.
 * Per blocco: ← accetta (lo applica la libreria, `revertControls: 'b-to-a'`; il focus va su `a` perché
 * Ctrl+Z lo annulli), → rifiuta (l'originale torna in `b`, focus su `b`; l'ultimo rifiutato chiude). I due pulsanti
 * non si disattivano mai: attivati quando non possono (`acceptBlocker`, `rejectBlocker`) mandano
 * `hmd-ai-block-blocked` con la ragione, che la barra della revisione scrive nella sua nota, e il focus resta sul
 * pulsante. La MergeView toglie i controlli di un blocco che sparisce: se avevano il focus, va sullo stesso pulsante
 * del blocco più vicino che resta.
 */
export class HmdAiDiffPane extends HmdDocElement {
  /** Il lato sinistro del diff è il documento attuale (il destro, la proposta, ha il suo nome). */
  protected override readonly contentLabelKey = 'ai.diff.current';
  #proposal = '';
  #range: TextRange | null = null;
  #acceptBlocker: AcceptBlocker | null = 'generating';
  #rejectBlocker: AcceptBlocker | null = 'generating';
  #streaming = true;
  #beforeAccept: () => boolean = () => false;

  #box: HTMLDivElement | null = null;
  #merge: MergeView | null = null;
  #rightEditable = new Compartment();
  /** Il pulsante di un blocco che ha avuto il focus per ultimo (null quando il focus va altrove nel diff). */
  #focusedControl: HTMLButtonElement | null = null;
  /** La proposta arriva da fuori: la sua transazione su `b` non è una modifica dell'utente. */
  #remote = false;
  /**
   * Testi mandati con `hmd-ai-proposal-edit` e non ancora tornati come `proposal`, dal più vecchio. Il
   * ritorno di uno di questi (anche in ritardo, dopo altre battute) è una conferma, non una proposta nuova:
   * il lato destro non si tocca.
   */
  #echoes: string[] = [];
  /** Ciò che la MergeView mostra già (gli effetti di DiffPane.tsx scattavano al cambio di questi valori). */
  #applied = { resetKey: '', restore: 0, readOnly: false, proposal: '', streaming: true };
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
  /** Perché «← accetta» non può adesso (`acceptBlocker(p, false)` del controller), o null. Letta all'attivazione. */
  get acceptBlocker(): AcceptBlocker | null { return this.#acceptBlocker; }
  set acceptBlocker(value: AcceptBlocker | null) { this.#acceptBlocker = value ?? null; }
  /** Perché «→ rifiuta» non può adesso (`rejectBlocker` di diffLogic), o null. Letta all'attivazione. */
  get rejectBlocker(): AcceptBlocker | null { return this.#rejectBlocker; }
  set rejectBlocker(value: AcceptBlocker | null) { this.#rejectBlocker = value ?? null; }
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
    if (!this.#box) {
      this.#box = this.appendChild(el('div', { class: 'diff' }));
      this.#box.addEventListener('focusin', (event) => {
        const target = event.target as HTMLElement;
        this.#focusedControl = target.matches('.cm-merge-revert > .revert > button') ? (target as HTMLButtonElement) : null;
      });
      // Un'uscita voluta (il pulsante è ancora nel DOM) non si recupera; se il nodo è stato rimosso, sì.
      this.#box.addEventListener('focusout', (event) => {
        if (event.target === this.#focusedControl && this.#focusedControl?.isConnected) this.#focusedControl = null;
      });
      // La MergeView ridisegna i controlli nel suo fotogramma di misura: dopo, il focus perso su un pulsante si recupera.
      new MutationObserver(() => this.#keepControlFocus()).observe(this.#box, { childList: true, subtree: true });
    }
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
          EditorView.contentAttributes.of(() => ({ 'aria-label': this.translator()('ai.diff.proposal') })),
          revertButtonStyles,
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
      resetKey: this.resetKey, readOnly: this.readOnly, proposal: this.#proposal, streaming: this.#streaming,
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
    const generation = this.docGeneration;
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
      // Un listener ha cambiato documento o vista: proposta, pulsanti e ripristino nuovi tocca al flush dopo.
      if (this.docGeneration !== generation || this.#merge !== merge) return;
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
    if (applied.readOnly !== this.readOnly || applied.streaming !== this.#streaming) {
      Object.assign(applied, { readOnly: this.readOnly, streaming: this.#streaming });
      merge.a.dispatch({ effects: editable.reconfigure(readOnlyExtensions(this.readOnly)) });
      merge.b.dispatch({ effects: this.#rightEditable.reconfigure(readOnlyExtensions(this.#streaming)) });
    }
    applied.restore = applyDocRestore(merge.a, applied.restore, this.restore);
  }

  /** Due pulsanti per blocco, creati dalla MergeView quando disegna il blocco (renderRevertControl). */
  #controls(): HTMLElement {
    const accept = this.#button('←', 'accept');
    const reject = this.#button('→', 'reject');
    const box = el('div', { class: 'revert' }, accept, reject);
    accept.addEventListener('mousedown', (event) => {
      const reason = this.#acceptBlocker;
      if (reason) return this.#blocked(event, 'accept', reason);
      if (!this.#beforeAccept()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // La libreria applica il blocco subito dopo, sul documento: il focus va lì perché Ctrl+Z lo annulli.
      queueMicrotask(() => this.#merge?.a.focus());
    });
    accept.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        accept.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }
    });
    const onReject = (event: Event) => {
      const reason = this.#rejectBlocker;
      if (reason) return this.#blocked(event, 'reject', reason);
      event.preventDefault();
      event.stopPropagation();
      this.#reject(Number(box.dataset.chunk));
    };
    reject.addEventListener('mousedown', onReject);
    reject.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onReject(event);
      }
    });
    return box;
  }

  /**
   * Un pulsante attivato quando non può: la MergeView (che ascolta il `mousedown` sul contenitore) non lo vede, la
   * ragione sale per la nota della barra. Il clic lascia il focus sul pulsante, come i pulsanti della barra.
   */
  #blocked(event: Event, action: ControlAction, reason: AcceptBlocker): void {
    event.stopPropagation();
    emit(this, 'hmd-ai-block-blocked', { action, reason });
  }

  #button(glyph: string, action: ControlAction): HTMLButtonElement {
    const label = this.translator()(LABEL[action]);
    return el('button', { type: 'button', class: 'tooltip', dataset: { tooltip: label, action }, 'aria-label': label }, glyph);
  }

  /** Etichette dei pulsanti già disegnati (la MergeView li ricrea solo quando cambiano i blocchi). */
  #refreshControls(): void {
    const t = this.translator();
    // I nomi dei due contenuti nella lingua di adesso (contentAttributes li rilegge solo al prossimo aggiornamento).
    this.#merge?.a.contentDOM.setAttribute('aria-label', this.docHost.contentLabel());
    this.#merge?.b.contentDOM.setAttribute('aria-label', t('ai.diff.proposal'));
    for (const button of this.#box?.querySelectorAll<HTMLButtonElement>('.cm-merge-revert button') ?? []) {
      const label = t(LABEL[button.dataset.action as ControlAction]);
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
    }
  }

  /**
   * Il pulsante di un blocco con il focus è sparito (la MergeView toglie i controlli di un blocco che non c'è più,
   * o li ridisegna) e il focus è finito sul body: va sullo stesso pulsante dello stesso blocco o del blocco più
   * vicino prima, altrimenti del primo; senza blocchi, nel documento. Un focus già altrove non si tocca.
   */
  #keepControlFocus(): void {
    const last = this.#focusedControl;
    if (!last || last.isConnected) return;
    this.#focusedControl = null;
    const doc = this.ownerDocument;
    if (!this.isConnected || (doc.activeElement && doc.activeElement !== doc.body)) return;
    const chunk = (button: HTMLElement) => Number(button.parentElement?.dataset.chunk);
    const same = [...(this.#box?.querySelectorAll<HTMLButtonElement>(`.cm-merge-revert > .revert > button[data-action="${last.dataset.action}"]`) ?? [])];
    const target = same.filter((button) => chunk(button) <= chunk(last)).at(-1) ?? same[0];
    if (target) target.focus({ preventScroll: true });
    else this.focus();
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
