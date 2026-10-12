/**
 * Pausa tra lo svuotamento di una regione live e la riscrittura del testo. Un solo fotogramma non basta: in
 * Chrome il callback di `requestAnimationFrame` gira prima del calcolo dell'albero di accessibilità dello stesso
 * aggiornamento, e le due mutazioni arrivano insieme (A11y, review del piano 14). 150 ms come il LiveAnnouncer di
 * Angular CDK (react-aria ne usa 100). Chi vede lo schermo vede la nota sparire per un attimo.
 */
export const ANNOUNCE_DELAY_MS = 150;

/** Testo in attesa della riscrittura, per nodo. */
const pending = new WeakMap<Node, { text: string; timer: ReturnType<typeof setTimeout> }>();

/**
 * Testo di una regione live (`role="status"`, `aria-live`). Senza `again` è `setText`: scrive solo se cambia. Con
 * `again` il testo deve arrivare allo screen reader come una mutazione nuova anche se è uguale a quello di prima
 * (la stessa nota a un altro clic, WCAG 4.1.3) o se la regione è appena entrata nel DOM: la regione si svuota
 * subito e il testo torna dopo `ANNOUNCE_DELAY_MS`. Fino ad allora un render che chiede lo stesso testo non lo
 * anticipa; uno che ne chiede un altro (o il vuoto) vince e annulla l'attesa.
 */
export function announce(node: HTMLElement, text: string, again = false): void {
  const waiting = pending.get(node);
  if (waiting && waiting.text === text && !again) return;
  if (waiting) clearTimeout(waiting.timer);
  pending.delete(node);
  if (!again || text === '') {
    if (node.textContent !== text) node.textContent = text;
    return;
  }
  node.textContent = '';
  const timer = setTimeout(() => {
    pending.delete(node);
    node.textContent = text;
  }, ANNOUNCE_DELAY_MS);
  pending.set(node, { text, timer });
}
