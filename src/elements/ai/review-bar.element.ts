import type { AcceptBlocker } from '../../ai/aiController';
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { actionBlocker, statusLine, type ReviewAction, type ReviewBlocker } from './reviewBarView';
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
}

/**
 * Barra della revisione AI (era ReviewBar.tsx): frecce tra le modifiche, stato (contatore della
 * generazione, parziale con «Continua», troncata, selezione persa, applicata), avvisi in un popover,
 * Scarta e Accetta tutto. Le azioni salgono come `hmd-ai-review-action`, un avviso scelto come
 * `hmd-ai-review-warning`. Nessun pulsante si disattiva mai (regola di Davide, spec §2 vincolo 4): quando
 * l'azione non è possibile (generazione in corso; per Accetta tutto la ragione del controller,
 * `acceptBlocker`) il pulsante resta attivo e, attivato, la nota sotto la riga dice perché; il focus resta
 * sul pulsante. La nota ricorda la sua causa e si svuota quando quella non vale più, quando un'azione
 * della barra riesce, quando cambia la proposta (`proposalId`) o quando la barra sparisce.
 */
export class HmdAiReviewBar extends HmdElement {
  #status: ReviewStatus = { kind: 'none' };
  #warnings: CheckWarning[] = [];
  #acceptBlocker: AcceptBlocker | null = 'generating';
  #i18n: I18nStore | null = null;
  #proposalId = '';
  /** Nota mostrata: l'azione che l'ha prodotta e la sua chiave, per sapere quando la causa sparisce. */
  #note: { action: ReviewAction; key: ReviewBlocker } | null = null;

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
    this.#status = value ?? { kind: 'none' };
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
    // La barra sparita (proposta scartata o applicata) non ricorda la nota.
    this.#note = null;
  }

  /** Un pulsante attivato: se l'azione non è possibile la nota dice perché, altrimenti l'azione sale e la nota se ne va. */
  #onAction(action: ReviewAction): void {
    const key = actionBlocker(action, this.#status, this.#acceptBlocker);
    this.#note = key ? { action, key } : null;
    this.#loop.update();
    if (!key) emit(this, 'hmd-ai-review-action', { action });
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
      toggleAttr(parts.status, 'aria-live', line.live, 'polite');
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
    // Avvisi: pulsante e popover solo se ce ne sono; i pulsanti del popover si riusano per posizione (come React senza chiavi).
    const warnings = this.#warnings;
    if (warnings.length > 0) {
      const label = t('ai.warningsCount', { count: warnings.length });
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
    // La nota resta finché vale la causa che l'ha prodotta (per quella azione); la stessa nota due volte di fila non si ri-annuncia: accettato.
    if (this.#note && actionBlocker(this.#note.action, this.#status, this.#acceptBlocker) !== this.#note.key) this.#note = null;
    setText(parts.note, this.#note ? t(this.#note.key) : '');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-review-bar': HmdAiReviewBar;
  }
}
