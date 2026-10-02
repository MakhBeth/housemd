/** Nodi di ogni lista per chiave, dall'ultima chiamata. */
const lists = new WeakMap<Element, Map<string, Element>>();

/**
 * Allinea i figli di `parent` a `items` (spec WC §5.2, al posto delle liste con `key` di React). Per ogni
 * chiave riusa il nodo della volta prima, così focus, selezione e stato restano; `create` gira solo per le
 * chiavi nuove, `update` su ogni nodo. Sposta solo i nodi fuori posto: con `moveBefore`, che conserva il
 * focus, quando c'è; `insertBefore` lo perde. `parent` deve contenere solo i nodi della lista.
 */
export function reconcileList<T, N extends Element>(
  parent: Element,
  items: readonly T[],
  key: (item: T) => string,
  create: (item: T) => N,
  update: (node: N, item: T) => void = () => {},
): void {
  const before = (lists.get(parent) ?? new Map()) as Map<string, N>;
  const after = new Map<string, N>();
  for (const item of items) {
    const k = key(item);
    if (after.has(k)) throw new Error(`reconcileList: chiave doppia "${k}"`);
    const node = before.get(k) ?? create(item);
    update(node, item);
    after.set(k, node);
  }
  for (const [k, node] of before) if (!after.has(k)) node.remove();

  let cursor = parent.firstChild;
  for (const node of after.values()) {
    if (node === cursor) {
      cursor = node.nextSibling;
      continue;
    }
    place(parent, node, cursor);
  }
  lists.set(parent, after);
}

function place(parent: Element, node: Element, ref: ChildNode | null): void {
  if (typeof parent.moveBefore === 'function' && parent.isConnected && node.parentNode === parent) parent.moveBefore(node, ref);
  else parent.insertBefore(node, ref);
}
