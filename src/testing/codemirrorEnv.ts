/**
 * Quello che manca a jsdom perché una EditorView (o una MergeView) di CodeMirror giri nei test: un
 * requestAnimationFrame (CodeMirror misura in un fotogramma), il costruttore `Window` globale (lo
 * confronta `isScrolledToBottom`) e i rettangoli dei Range (jsdom non fa layout: tutto a zero).
 * Va importato subito DOPO `domEnv`. Le misure vere (altezze, scroll) le verifica Playwright.
 */
import { dom } from './domEnv';

const win = dom.window as unknown as Window & typeof globalThis;
const raf = (callback: FrameRequestCallback): number => setTimeout(() => callback(performance.now()), 0) as unknown as number;
const caf = (id: number): void => clearTimeout(id);
win.requestAnimationFrame = raf;
win.cancelAnimationFrame = caf;
Object.assign(globalThis, { Window: win.Window, requestAnimationFrame: raf, cancelAnimationFrame: caf });

const emptyRect = (): DOMRect => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
win.Range.prototype.getBoundingClientRect = emptyRect;
win.Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
