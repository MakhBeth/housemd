/**
 * Costruzione del DOM senza stringhe HTML (spec WC §5.2): sostituisce JSX. I testi entrano solo come nodi
 * di testo; le chiavi che porterebbero HTML o codice da stringa (`innerHTML`, `srcdoc`, `onclick`…) sono
 * un errore, perché il test statico di architecture.test.ts non le vedrebbe dentro un oggetto.
 */

/** Figli accettati: i testi diventano nodi di testo; null, undefined e false si saltano. */
export type Child = Node | string | number | null | undefined | false;

type Listeners = { [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void };

export interface Props {
  class?: string;
  /** Valori `undefined` saltati. */
  dataset?: Record<string, string | undefined>;
  /** Listener dei nodi creati qui: spariscono con il nodo, non servono signal. */
  on?: Listeners;
  innerHTML?: never;
  outerHTML?: never;
  srcdoc?: never;
  /** Proprietà scrivibile (`value`, `disabled`, `role`…), altrimenti attributo; booleani non-proprietà: vedi `setProp`. */
  [name: string]: unknown;
}

const FORBIDDEN = new Set(['innerhtml', 'outerhtml', 'srcdoc']);

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: (Child | readonly Child[])[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) {
    if (name === 'class') {
      if (typeof value === 'string' && value) node.className = value;
    } else if (name === 'dataset') {
      for (const [key, v] of Object.entries(value as Record<string, string | undefined>)) if (v !== undefined) node.dataset[key] = v;
    } else if (name === 'on') {
      for (const [type, listener] of Object.entries(value as Record<string, EventListener>)) node.addEventListener(type, listener);
    } else {
      setProp(node, name, value);
    }
  }
  node.append(...children.flat().flatMap((c) => (c === null || c === undefined || c === false ? [] : [typeof c === 'number' ? String(c) : c])));
  return node;
}

/**
 * Regola per le chiavi diverse da class/dataset/on (dopo il rifiuto di quelle vietate):
 * - `undefined`/`null`: niente;
 * - booleano e la proprietà non è booleana (o non esiste: `popover` è una stringa in Chromium): è un
 *   attributo booleano, `true` lo scrive vuoto, `false` non scrive nulla;
 * - proprietà esistente e scrivibile (anche con setter sul prototipo): assegnata;
 * - altrimenti (non esiste o è di sola lettura, come `list` e `form`): attributo `String(value)`.
 */
function setProp(node: HTMLElement, name: string, value: unknown): void {
  if (FORBIDDEN.has(name.toLowerCase()) || /^on/i.test(name)) throw new Error(`el(): "${name}" non è ammesso`);
  if (value === undefined || value === null) return;
  const record = node as unknown as Record<string, unknown>;
  if (typeof value === 'boolean' && typeof record[name] !== 'boolean') {
    if (value) node.setAttribute(name, '');
    return;
  }
  if (isWritable(node, name)) {
    record[name] = value;
    return;
  }
  node.setAttribute(name, String(value));
}

function isWritable(node: object, name: string): boolean {
  for (let o: object | null = node; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, name);
    if (d) return d.writable === true || d.set !== undefined;
  }
  return false;
}

/** Scrive il testo solo se cambia: niente mutazioni inutili. */
export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Mette (con `value`, vuoto se manca) o toglie un attributo, solo se cambia. */
export function toggleAttr(node: Element, name: string, on: boolean, value = ''): void {
  if (!on) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value);
  }
}
