/** Cosa serve a un ciclo di render: prerequisiti, una passata, e (facoltativo) dove recuperare il focus. */
export interface RenderLoopOptions {
  /** Prerequisiti di una passata (parti create, store, elemento collegato): ricontrollati prima di ognuna. */
  ready(): boolean;
  /** Una passata di render: aggiorna il DOM dallo stato. */
  render(): void;
  /** Contenitore da sorvegliare: se aveva il focus prima del render e non ce l'ha più dopo, si chiama `refocus`. */
  focusScope?(): Element | null;
  /** Porta il focus su un bersaglio stabile (riga col tab stop, campo, pulsante fisso). */
  refocus?(): void;
}

/**
 * Un render alla volta (schema delle fasi 6a–6b). Ogni cambio di stato di un elemento passa da `update()`:
 * se un render è già in corso (un listener sincrono, il `focusout` che Chromium manda quando si toglie il
 * nodo con il focus, un `focus()`), la richiesta segna una passata in più alla fine, mai annidata. I
 * prerequisiti si ricontrollano prima di ogni passata. Il focus si guarda prima della prima passata e si
 * recupera dopo l'ultima, contro il DOM finito, solo con l'elemento ancora collegato.
 */
export class RenderLoop {
  readonly #host: Element;
  readonly #options: RenderLoopOptions;
  #rendering = false;
  #again = false;

  constructor(host: Element, options: RenderLoopOptions) {
    this.#host = host;
    this.#options = options;
  }

  /** Vero mentre gira una passata (anche tra una passata e la successiva). */
  get rendering(): boolean {
    return this.#rendering;
  }

  update(): void {
    const options = this.#options;
    if (!options.ready()) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    const doc = this.#host.ownerDocument;
    const scope = options.focusScope?.() ?? null;
    const hadFocus = scope !== null && scope.contains(doc.activeElement);
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        options.render();
      } while (this.#again && options.ready());
    } finally {
      this.#rendering = false;
    }
    if (hadFocus && this.#host.isConnected && !scope.contains(doc.activeElement)) options.refocus?.();
  }
}
