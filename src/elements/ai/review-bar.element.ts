import type { AcceptBlocker } from '../../ai/aiController';
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { announce } from '../../dom/announce';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import { pluralKey } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { ControlAction } from './diffLogic';
import { actionBlocker, generationOutcome, statusLine, type NoteAction, type ReviewAction, type ReviewBlocker } from './reviewBarView';
import './review-bar.css';

interface Parts {
  bar: HTMLDivElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  status: HTMLSpanElement;
  continue: HTMLButtonElement;
  spacer: HTMLSpanElement;
  /** Pulsante degli avvisi con il conteggio, e il popover con un pulsante per avviso. */
  warnings: HTMLButtonElement;
  count: Text;
  popover: HTMLDivElement;
  discard: HTMLButtonElement;
  acceptAll: HTMLButtonElement;
  /** Nota sotto la riga dei pulsanti (`role="status"`): perché il pulsante attivato non ha fatto nulla. Vuota di norma. */
  note: HTMLParagraphElement;
  /** Regione live della generazione, nascosta alla vista: dopo la nota, solo durante la generazione. */
  spoken: HTMLSpanElement;
}

/**
 * Barra della revisione AI (era ReviewBar.tsx): frecce tra le modifiche, stato (contatore della
 * generazione, parziale con «Continua», troncata, selezione persa, applicata), avvisi in un popover,
 * Scarta e Accetta tutto. Le azioni salgono come `hmd-ai-review-action`, un avviso scelto come
 * `hmd-ai-review-warning`. Nessun pulsante si disattiva mai (regola di Davide, spec §2 vincolo 4): quando
 * l'azione non è possibile (generazione in corso; per Accetta tutto la ragione del controller,
 * `acceptBlocker`) il pulsante resta attivo e, attivato, la nota sotto la riga dice perché; il focus resta
 * sul pulsante. La nota ricorda la sua causa e si svuota quando quella non vale più, quando un'azione
 * della barra riesce, quando cambia la proposta (`proposalId`) o quando la barra sparisce. La stessa nota dice
 * perché un pulsante di un blocco del diff non ha fatto nulla (`blocked`, dalla revisione).
 */
export class HmdAiReviewBar extends HmdElement {
  #status: ReviewStatus = { kind: 'none' };
  #warnings: CheckWarning[] = [];
  #acceptBlocker: AcceptBlocker | null = 'generating';
  #i18n: I18nStore | null = null;
  #proposalId = '';
  /** Stato con cui è finita l'ultima generazione: la regione nascosta ne dice l'esito fino alla prossima azione. */
  #outcome: ReviewStatus | null = null;
  /** Blocchi del diff (dalla revisione) e quelli detti con l'esito: il numero si dice una volta, le modifiche dopo non lo riscrivono. */
  #blocks = 0;
  #told: { outcome: ReviewStatus; blocks: number } | null = null;
  /** Nota mostrata: l'azione che l'ha prodotta e la sua chiave, per sapere quando la causa sparisce. */
  #note: { action: NoteAction; key: ReviewBlocker } | null = null;
  /** Il prossimo render riscrive la nota anche se il testo è lo stesso (un altro clic bloccato). */
  #announceAgain = false;

  #parts: Parts | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    focusScope: () => this.#parts?.bar ?? null,
    // Il nodo con il focus è sparito (Continua dopo il clic, il pulsante degli avvisi senza più avvisi): il focus va su Accetta tutto.
    refocus: () => this.#parts?.acceptAll.focus(),
  });

  get status(): ReviewStatus { return this.#status; }
  set status(value: ReviewStatus) {
    const next = value ?? { kind: 'none' };
    // Fine della generazione: la regione nascosta dirà l'esito finché non arriva un'azione (P1, A11y).
    if (this.#status.kind === 'generating' && next.kind !== 'generating') this.#outcome = next;
    if (next.kind === 'generating') this.#outcome = null;
    this.#status = next;
    this.#loop.update();
  }
  /** Quanti blocchi ha il diff della proposta: l'esito «pronta» della regione nascosta li conta. */
  get blocks(): number { return this.#blocks; }
  set blocks(value: number) {
    this.#blocks = value > 0 ? value : 0;
    this.#loop.update();
  }
  get warnings(): CheckWarning[] { return this.#warnings; }
  set warnings(value: CheckWarning[]) {
    this.#warnings = value ?? [];
    this.#loop.update();
  }
  /** Identità della proposta mostrata (percorso + createdAt): quando cambia la nota della proposta di prima si svuota, senza ricreare l'elemento (il focus resta). */
  get proposalId(): string { return this.#proposalId; }
  set proposalId(value: string) {
    value ??= '';
    if (value === this.#proposalId) return;
    this.#proposalId = value;
    this.#note = null;
    // L'esito era della proposta di prima (la prima proposta arrivata durante la generazione non ha esito).
    if (this.#status.kind !== 'generating') this.#outcome = null;
    this.#loop.update();
  }
  /** Perché Accetta tutto non può (dal controller, `acceptBlocker(p, true)`), o null. */
  get acceptBlocker(): AcceptBlocker | null { return this.#acceptBlocker; }
  set acceptBlocker(value: AcceptBlocker | null) {
    this.#acceptBlocker = value ?? null;
    this.#loop.update();
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
      const id = uid('hmd-ai-review');
      const action = (name: ReviewAction, className: string, ...children: Node[]) =>
        el('button', { type: 'button', class: className, on: { click: () => this.#onAction(name) } }, ...children);
      const count = document.createTextNode('');
      const parts: Parts = {
        bar: el('div', { class: 'bar' }),
        previous: action('previous', 'iconButton tooltip', icon('chevronUp')),
        next: action('next', 'iconButton tooltip', icon('chevronDown')),
        status: el('span', { class: 'status' }),
        continue: action('continue', 'secondary'),
        spacer: el('span', { class: 'spacer' }),
        warnings: el('button', { type: 'button', class: 'secondary tooltip', popovertarget: id }, icon('warning', { size: 14 }), count),
        count,
        popover: el('div', { id, popover: 'auto', class: 'warnings' }),
        discard: action('discard', 'secondary'),
        acceptAll: action('acceptAll', 'secondary accept'),
        note: el('p', { class: 'note', role: 'status' }),
        spoken: el('span', { class: 'spoken', 'aria-live': 'polite' }),
      };
      this.#parts = parts;
      parts.bar.append(parts.previous, parts.next, parts.spacer, parts.discard, parts.acceptAll);
      this.append(parts.bar, parts.note);
    }
    const i18n = this.#i18n;
    if (!i18n) return;
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // La barra sparita (proposta scartata o applicata) non ricorda la nota né l'esito.
    this.#note = null;
    this.#outcome = null;
  }

  /**
   * «← accetta» o «→ rifiuta» di un blocco del diff attivato quando non può (`hmd-ai-block-blocked`): la ragione va
   * nella nota, come per i pulsanti della barra, e se ne va quando il blocco di quell'azione non vale più.
   */
  blocked(action: ControlAction, reason: AcceptBlocker): void {
    this.#showNote(action === 'accept' ? 'acceptBlock' : 'rejectBlock', `ai.review.${reason}`);
  }

  /** Un pulsante attivato: se l'azione non è possibile la nota dice perché, altrimenti l'azione sale e la nota se ne va. */
  #onAction(action: ReviewAction): void {
    const key = actionBlocker(action, this.#status, this.#acceptBlocker);
    this.#showNote(action, key);
    if (!key) emit(this, 'hmd-ai-review-action', { action });
  }

  #showNote(action: NoteAction, key: ReviewBlocker | null): void {
    // La stessa nota di nuovo (Successivo, Scarta, Accetta tutto o un blocco durante la generazione): si ri-annuncia.
    this.#announceAgain = key !== null && this.#note?.key === key;
    this.#note = key ? { action, key } : null;
    // L'esito della generazione si è detto: alla prossima azione la regione si svuota.
    this.#outcome = null;
    this.#loop.update();
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const t = i18n.t;
    const { bar } = parts;
    toggleAttr(parts.previous, 'aria-label', true, t('ai.previous'));
    toggleAttr(parts.previous, 'data-tooltip', true, t('ai.previous'));
    toggleAttr(parts.next, 'aria-label', true, t('ai.next'));
    toggleAttr(parts.next, 'data-tooltip', true, t('ai.next'));
    // Lo stato: uno span riusato come fa React (stessa posizione, stesso tipo), con gli attributi del momento.
    const line = statusLine(this.#status, t);
    if (line) {
      setText(parts.status, line.text);
      toggleAttr(parts.status, 'role', line.alert, 'alert');
      if (parts.status.parentNode !== bar) bar.insertBefore(parts.status, parts.spacer);
      if (line.withContinue) {
        setText(parts.continue, t('ai.continue'));
        if (parts.continue.parentNode !== bar) bar.insertBefore(parts.continue, parts.spacer);
      } else {
        parts.continue.remove();
      }
    } else {
      parts.status.remove();
      parts.continue.remove();
    }
    // La regione della generazione: entrata nel DOM vuota, il testo arriva dopo `ANNOUNCE_DELAY_MS` (così si annuncia);
    // a generazione finita dice l'esito, fino alla prossima azione.
    if (this.#told?.outcome !== this.#outcome) this.#told = this.#outcome ? { outcome: this.#outcome, blocks: this.#blocks } : null;
    const spoken = line?.spoken ?? (this.#told ? generationOutcome(this.#told.outcome, this.#proposalId !== '', this.#told.blocks, i18n.getState().locale, t) : null);
    if (spoken) {
      const entering = parts.spoken.parentNode !== this;
      if (entering) this.append(parts.spoken);
      announce(parts.spoken, spoken, entering);
    } else {
      announce(parts.spoken, '');
      parts.spoken.remove();
    }
    // Avvisi: pulsante e popover solo se ce ne sono; i pulsanti del popover si riusano per posizione (come React senza chiavi).
    const warnings = this.#warnings;
    if (warnings.length > 0) {
      const label = t(pluralKey(i18n.getState().locale, 'ai.warningsCount', warnings.length), { count: warnings.length });
      toggleAttr(parts.warnings, 'aria-label', true, label);
      toggleAttr(parts.warnings, 'data-tooltip', true, label);
      setText(parts.count, ` ${warnings.length}`);
      while (parts.popover.children.length > warnings.length) parts.popover.lastElementChild!.remove();
      warnings.forEach((warning, index) => {
        let button = parts.popover.children[index] as HTMLButtonElement | undefined;
        if (!button) {
          button = el('button', { type: 'button', on: { click: () => emit(this, 'hmd-ai-review-warning', { warning: this.#warnings[index] }) } });
          parts.popover.append(button);
        }
        setText(button, t(`ai.warning.${warning.code}` as MessageKey));
      });
      if (parts.warnings.parentNode !== bar) bar.insertBefore(parts.warnings, parts.discard);
      if (parts.popover.parentNode !== bar) bar.insertBefore(parts.popover, parts.discard);
    } else {
      parts.warnings.remove();
      parts.popover.remove();
    }
    setText(parts.discard, t('ai.discard'));
    setText(parts.acceptAll, t('ai.acceptAll'));
    // La nota resta finché vale la causa che l'ha prodotta (per quella azione); la stessa nota a un altro clic si ri-annuncia.
    if (this.#note && actionBlocker(this.#note.action, this.#status, this.#acceptBlocker) !== this.#note.key) this.#note = null;
    announce(parts.note, this.#note ? t(this.#note.key) : '', this.#announceAgain);
    this.#announceAgain = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-review-bar': HmdAiReviewBar;
  }
}
