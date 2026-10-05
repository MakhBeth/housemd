/**
 * Globali del DOM per i test che montano elementi (spec WC §8.2). Va importato come PRIMO import, prima
 * di qualsiasi modulo che estende HTMLElement al caricamento. Tutto viene dalla stessa `window` di jsdom:
 * jsdom rifiuta in addEventListener un AbortSignal di Node, e `instanceof` tra realm diversi fallisce.
 * `node:test` esegue ogni file in un processo a sé: i globali non passano da un file all'altro.
 *
 * Limiti di jsdom 30 (verificati nella fase 2): mancano moveBefore, showModal/closedBy, Popover,
 * commandfor, CSS.highlights e Anchor Positioning. Chi li usa li controlla prima di chiamarli o riceve
 * uno stub nel suo test (`popoverStub.ts`, `dialogStub.ts`); il comportamento vero lo verificano Playwright e la checklist manuale.
 */
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });

const GLOBALS = [
  'document', 'Node', 'Element', 'HTMLElement', 'Text', 'DocumentFragment', 'customElements', 'MutationObserver',
  'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'AbortController', 'AbortSignal',
] as const;

const source = dom.window as unknown as Record<string, unknown>;
Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window });
for (const name of GLOBALS) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: source[name] });
}
