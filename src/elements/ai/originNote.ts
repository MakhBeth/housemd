import type { AiState } from '../../ai/aiController';
import { el, setText } from '../../dom/el';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { aiErrorKind } from '../workspace/workspaceView';

/** Quello che serve a un elemento per segnalare un errore AI con la propria origine e mostrarlo accanto all'azione. */
export interface OriginController {
  getState(): AiState;
  report(error: unknown, origin?: { trigger: string; anchor?: { isConnected: boolean } }): void;
  clearError(anchor?: object): void;
  orphanError(anchor: object): void;
}

let seq = 0;

/**
 * Nota locale di un errore AI: la riga sotto il controllo che ha avviato l'azione (`alert`; `status` per gli esiti
 * preventivi), con il controllo che la richiama via `aria-describedby` finché esiste. Compare solo se l'errore
 * condiviso dichiara questo elemento come origine; un nuovo esito crea un nodo nuovo, così si riannuncia.
 * Chi la usa chiama `begin()` all'inizio di ogni azione (toglie l'esito precedente) e `release()` quando la nota
 * non è più visibile: l'errore passa al banner workspace come ripiego.
 */
export class OriginNote {
  readonly #id = `hmd-origin-note-${++seq}`;
  #node: HTMLElement | null = null;
  #key = '';
  #described: HTMLElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly controller: () => OriginController | null,
    /** Il contesto della nota è visibile adesso (es. popover aperto)? Se no, l'errore va subito al banner workspace. */
    private readonly visible: () => boolean = () => true,
  ) {}

  /** `.catch(note.report('trigger'))`: l'errore porta azione e elemento d'origine. */
  report = (trigger: string) => (error: unknown) =>
    // Verificato all'arrivo dell'esito: una risposta tardiva a contesto chiuso non resta senza destinazione.
    this.controller()?.report(error, this.visible() ? { trigger, anchor: this.host } : { trigger });

  /** Un nuovo tentativo toglie l'esito precedente, anche dall'errore condiviso. */
  begin(): void {
    this.controller()?.clearError(this.host);
  }

  release(): void {
    this.controller()?.orphanError(this.host);
  }

  update(state: AiState, t: I18nStore['t'], after: Element | null, describes?: HTMLElement | null): void {
    const code = state.error && state.errorOrigin?.anchor === this.host ? state.error : null;
    if (!code || !after) {
      this.#node?.remove();
      this.#node = null;
      this.#key = '';
      this.#describe(null);
      return;
    }
    const key = `${code}|${state.errorOrigin?.trigger}`;
    if (!this.#node || this.#key !== key) {
      this.#node?.remove();
      this.#node = el('small', { id: this.#id, class: 'originNote', role: aiErrorKind(code) });
      this.#key = key;
    }
    setText(this.#node, t(`ai.error.${code}` as MessageKey));
    if (this.#node.previousElementSibling !== after) after.after(this.#node);
    this.#describe(describes ?? null);
  }

  #describe(control: HTMLElement | null): void {
    if (this.#described && this.#described !== control) this.#unreference(this.#described);
    this.#described = control;
    if (!control) return;
    const ids = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(this.#id)) control.setAttribute('aria-describedby', [...ids, this.#id].join(' '));
  }

  #unreference(control: HTMLElement): void {
    const ids = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== this.#id);
    if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
    else control.removeAttribute('aria-describedby');
  }
}
