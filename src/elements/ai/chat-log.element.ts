import { safeRender } from '../../ai/safeRender';
import type { ChatMessage } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { setSafeHTML } from '../../preview/sanitize';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { chatEntries, type ChatEntry } from './chatLogView';
import './chat-log.css';

/**
 * Messaggi della chat AI (era ChatLog.tsx). Le risposte del modello sono non fidate: passano solo da
 * safeRender (niente HTML grezzo, immagini remote come etichetta) e setSafeHTML, un fotogramma dopo il
 * cambio di testo come faceva il componente Markdown.
 */
export class HmdAiChatLog extends HmdElement {
  #messages: readonly ChatMessage[] = [];
  #i18n: I18nStore | null = null;
  #log: HTMLDivElement | null = null;
  /** Render del markdown in attesa del fotogramma, per contenitore. */
  #frames = new Map<HTMLDivElement, number>();
  /** Testo già chiesto per ogni contenitore (reso o in attesa): lo stesso testo non si rende due volte. */
  #shown = new WeakMap<HTMLDivElement, string>();

  get messages(): readonly ChatMessage[] { return this.#messages; }
  set messages(value: readonly ChatMessage[]) {
    this.#messages = value ?? [];
    this.#render();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#log ??= this.appendChild(el('div', { class: 'log', role: 'log' }));
    // Come la pulizia di Markdown: nessun fotogramma in volo dopo il distacco; al rientro il testo si richiede.
    signal.addEventListener(
      'abort',
      () => {
        for (const [body, frame] of this.#frames) {
          cancelAnimationFrame(frame);
          this.#shown.delete(body);
        }
        this.#frames.clear();
      },
      { once: true },
    );
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #render(): void {
    const log = this.#log;
    const i18n = this.#i18n;
    if (!log || !i18n || !this.isConnected) return;
    reconcileList(
      log,
      chatEntries(this.#messages, i18n.t),
      (entry) => entry.id,
      () => el('article', { class: 'message', tabIndex: 0 }),
      (article, entry) => this.#fill(article, entry),
    );
  }

  /** Figli di un messaggio nell'ordine di ChatLog.tsx; nodi riusati per chiave (il focus resta sui pulsanti). */
  #fill(article: HTMLElement, entry: ChatEntry): void {
    const keys = [
      ...(entry.file ? ['file'] : []),
      entry.role,
      ...entry.notices.map((_, i) => `notice:${i}`),
      ...(entry.retry ? ['retry'] : []),
      ...(entry.reset ? ['reset'] : []),
      ...(entry.meta !== null ? ['meta'] : []),
    ];
    const hadFocus = article.contains(document.activeElement);
    reconcileList(article, keys, (key) => key, (key) => this.#create(key, entry), (node, key) => this.#update(node, key, entry));
    // Riprova usato sparisce: se aveva il focus, lo prende il messaggio (che è già nel giro del Tab) e non il body.
    if (hadFocus && !article.contains(document.activeElement)) article.focus({ preventScroll: true });
  }

  #create(key: string, entry: ChatEntry): HTMLElement {
    const button = (onClick: () => void) => el('button', { type: 'button', class: 'file', on: { click: onClick } });
    if (key === 'file') {
      // Il documento di un messaggio non cambia: l'id è la chiave dell'article.
      const path = entry.file!;
      return button(() => emit(this, 'hmd-ai-open-file', { path }));
    }
    if (key === 'retry') return button(() => emit(this, 'hmd-ai-retry', { id: entry.id, removeRejected: false }));
    if (key === 'reset') return button(() => emit(this, 'hmd-ai-retry', { id: entry.id, removeRejected: true }));
    if (key === 'user') return el('p', { class: 'user' });
    if (key === 'assistant') return el('div', { class: 'assistant' }, el('div'));
    if (key === 'meta') return el('small', { class: 'meta' });
    return el('p', { class: 'notice' });
  }

  #update(node: HTMLElement, key: string, entry: ChatEntry): void {
    if (key === 'file') setText(node, entry.file!);
    else if (key === 'retry') setText(node, entry.retry!);
    else if (key === 'reset') setText(node, entry.reset!);
    else if (key === 'user') setText(node, entry.text);
    else if (key === 'assistant') this.#markdown(node.firstElementChild as HTMLDivElement, entry.text);
    else if (key === 'meta') setText(node, entry.meta!);
    else setText(node, entry.notices[Number(key.slice('notice:'.length))]);
  }

  /** Markdown della risposta al prossimo fotogramma; un testo nuovo annulla quello in attesa. */
  #markdown(body: HTMLDivElement, text: string): void {
    if (this.#shown.get(body) === text) return;
    this.#shown.set(body, text);
    const pending = this.#frames.get(body);
    if (pending !== undefined) cancelAnimationFrame(pending);
    this.#frames.set(
      body,
      requestAnimationFrame(() => {
        this.#frames.delete(body);
        void setSafeHTML(body, safeRender(text));
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-chat-log': HmdAiChatLog;
  }
}
