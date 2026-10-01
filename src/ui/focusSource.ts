/**
 * Da dove arriva il focus: puntatore o tastiera. I campi di testo e i contenteditable (CodeMirror)
 * soddisfano `:focus-visible` anche al clic, per specifica; il focus ring "oreo" deve comparire solo
 * con la navigazione da tastiera. global.css lo nasconde su quei campi quando
 * `<html data-focus-source="pointer">`. Scrivere in un campo non cambia la sorgente: conta solo il
 * momento in cui il focus arriva.
 */
export type FocusSource = 'pointer' | 'keyboard';

/** Stato puro: un focus subito dopo una pressione del puntatore viene dal puntatore. */
export function focusSourceTracker() {
  let pointer = false;
  return {
    pointerDown(): void {
      pointer = true;
    },
    keyDown(): void {
      pointer = false;
    },
    focusIn(): FocusSource {
      return pointer ? 'pointer' : 'keyboard';
    },
  };
}

/** Collega il tracker al documento; restituisce la funzione che toglie i listener. */
export function installFocusSource(doc: Document): () => void {
  const tracker = focusSourceTracker();
  // AbortController della finestra del documento: jsdom (nei test) rifiuta un AbortSignal di Node.
  const abort = new (doc.defaultView?.AbortController ?? AbortController)();
  const options = { capture: true, signal: abort.signal };
  doc.addEventListener('pointerdown', () => tracker.pointerDown(), options);
  doc.addEventListener('keydown', () => tracker.keyDown(), options);
  doc.addEventListener(
    'focusin',
    () => {
      doc.documentElement.dataset.focusSource = tracker.focusIn();
    },
    options,
  );
  return () => abort.abort();
}
