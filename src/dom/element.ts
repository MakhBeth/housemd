/** Uno store esterno (Workspace, AiController, UpdateFlow, i18nStore, themeStore, routeStore). */
export interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/**
 * Classe base degli elementi `hmd-*` (spec WC §5.1). Il ciclo di vita sta in un AbortController: ogni
 * listener e iscrizione registrati con il `signal` di `connect` spariscono al distacco, senza pulizia a
 * mano. Un elemento spostato nel DOM si stacca e si riattacca: riceve un `signal` nuovo.
 * Contratto: `connect` gira a ogni connessione (anche dopo uno spostamento), quindi le sottoclassi
 * costruiscono il DOM solo la prima volta (es. con un campo di guardia) e registrano listener e
 * iscrizioni solo con il `signal` ricevuto. Chi sovrascrive `connectedCallback`/`disconnectedCallback`
 * deve chiamare `super`.
 * Il `signal` si interrompe al distacco e anche a `reconnect()` (cambio di store con l'elemento collegato):
 * la pulizia che vale solo al distacco (es. dimenticare che un popover è aperto) va in
 * `disconnectedCallback`, dopo `super`. `connect` può girare più volte e costruisce il DOM una volta sola.
 * I setter accettano `undefined`/`null` e li riportano al valore di default (React 19 passa `undefined`
 * quando una prop sparisce); il render aggiorna solo i nodi esistenti.
 */
export abstract class HmdElement extends HTMLElement {
  #abort: AbortController | null = null;

  connectedCallback(): void {
    if (this.#abort) return;
    this.#abort = new AbortController();
    this.connect(this.#abort.signal);
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#abort = null;
  }

  /** Rifà le iscrizioni (per esempio dopo un cambio di store passato come proprietà): come staccare e riattaccare. */
  protected reconnect(): void {
    if (!this.#abort) return;
    this.#abort.abort();
    this.#abort = new AbortController();
    this.connect(this.#abort.signal);
  }

  /** Crea il DOM (la prima volta) e registra listener e iscrizioni legati a `signal`. */
  protected abstract connect(signal: AbortSignal): void;

  /** Iscrizione a uno store legata al ciclo di vita: `fn` gira subito e a ogni notifica. */
  protected watch(store: Subscribable, fn: () => void, signal: AbortSignal): void {
    // Un signal già interrotto non emette più 'abort': l'iscrizione resterebbe per sempre.
    if (signal.aborted) return;
    const off = store.subscribe(fn);
    signal.addEventListener('abort', off, { once: true });
    fn();
  }
}
