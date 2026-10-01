/**
 * Navigazione da tastiera dell'albero dei file (puro): un solo tab stop (roving tabindex), le frecce
 * spostano il focus tra le righe visibili, come nel pattern APG Tabs/Tree.
 */
import type { TreeNode } from './tree';

export interface VisibleItem {
  path: string;
  kind: 'file' | 'directory';
  /** Cartella che contiene la riga ('' alla radice). */
  parent: string;
  expanded: boolean;
}

/** Righe raggiungibili col focus, in ordine: cartelle e file markdown dentro cartelle aperte (gli asset no). */
export function visibleItems(nodes: TreeNode[], expanded: ReadonlySet<string>, parent = ''): VisibleItem[] {
  return nodes.flatMap((node): VisibleItem[] => {
    if (node.kind === 'asset') return [];
    if (node.kind === 'file') return [{ path: node.path, kind: 'file', parent, expanded: false }];
    const open = expanded.has(node.path);
    return [{ path: node.path, kind: 'directory', parent, expanded: open }, ...(open ? visibleItems(node.children, expanded, node.path) : [])];
  });
}

/** La riga col tab stop: quella col focus se ancora visibile, altrimenti il file aperto, altrimenti la prima. */
export function tabStop(items: VisibleItem[], focused: string | null, openPath: string | null): string | null {
  const has = (path: string | null) => path !== null && items.some((i) => i.path === path);
  if (has(focused)) return focused;
  if (has(openPath)) return openPath;
  return items[0]?.path ?? null;
}

export type TreeMove = { focus: string } | { expand: string } | { collapse: string } | { menu: string };

export interface TreeKey { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }

export function treeKey(items: VisibleItem[], current: string, event: TreeKey): TreeMove | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const index = items.findIndex((i) => i.path === current);
  if (index < 0) return null;
  const item = items[index];
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) return { menu: current };
  if (event.shiftKey) return null;
  const at = (i: number) => ({ focus: items[i].path });
  switch (event.key) {
    case 'ArrowDown':
      return index < items.length - 1 ? at(index + 1) : null;
    case 'ArrowUp':
      return index > 0 ? at(index - 1) : null;
    case 'Home':
      return at(0);
    case 'End':
      return at(items.length - 1);
    case 'ArrowRight':
      if (item.kind !== 'directory') return null;
      if (!item.expanded) return { expand: item.path };
      // Già aperta: si entra nel primo figlio, se c'è.
      return items[index + 1]?.parent === item.path ? at(index + 1) : null;
    case 'ArrowLeft':
      if (item.kind === 'directory' && item.expanded) return { collapse: item.path };
      return item.parent ? { focus: item.parent } : null;
    default:
      return null;
  }
}
