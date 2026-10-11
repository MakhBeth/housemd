import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';

export interface ItemListOptions<T> {
  selectedId: string | null;
  label(item: T): string;
  createLabel: string;
  onSelect(item: T): void;
  onCreate(): void;
}

type Row<T> = { kind: 'item'; item: T } | { kind: 'create' };

/** Le opzioni dell'ultimo render di ogni elenco e la voce di ogni pulsante: i clic leggono sempre quelle. */
const lists = new WeakMap<Element, ItemListOptions<never>>();
const rows = new WeakMap<Element, unknown>();

/**
 * Elenco di profili o preset con «+ Crea» in fondo (era il componente React): un pulsante per voce, la voce aperta
 * con `aria-current`. I pulsanti si riusano per id, così il focus resta su quello premuto.
 */
export function renderItemList<T extends { id: string }>(list: HTMLDivElement, items: readonly T[], options: ItemListOptions<T>): void {
  lists.set(list, options as ItemListOptions<never>);
  const select = (node: Element) => (lists.get(list) as ItemListOptions<T> | undefined)?.onSelect(rows.get(node) as T);
  const all: Row<T>[] = [...items.map((item) => ({ kind: 'item' as const, item })), { kind: 'create' }];
  reconcileList(
    list,
    all,
    (row) => (row.kind === 'item' ? `item:${row.item.id}` : 'create'),
    (row) =>
      row.kind === 'item'
        ? el('button', { type: 'button', class: 'item', on: { click: (event) => select(event.currentTarget as Element) } })
        : el('button', { type: 'button', class: 'create', on: { click: () => lists.get(list)?.onCreate() } }),
    (node, row) => {
      if (row.kind === 'create') return setText(node, `+ ${options.createLabel}`);
      rows.set(node, row.item);
      setText(node, options.label(row.item));
      toggleAttr(node, 'aria-current', row.item.id === options.selectedId, 'true');
    },
  );
}
