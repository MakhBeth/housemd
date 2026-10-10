import type { MessageKey } from '../../i18n/messages';
import type { TreeNode } from '../../ui/tree';
import type { TreeAction } from '../workspace/dialogFor';

/** Voci del menu ⋯ per il tipo di nodo, nell'ordine di FileTree.tsx; senza nodo (mai aperto) solo le comuni. */
export function menuActions(kind: TreeNode['kind'] | null): TreeAction[] {
  const common: TreeAction[] = ['rename', 'delete'];
  if (kind === 'directory') return ['new-file', 'new-folder', ...common];
  if (kind === 'file') return ['history', ...common];
  return common;
}

/** Etichetta di ogni voce del menu. */
export const MENU_LABELS: Record<TreeAction, MessageKey> = {
  'new-file': 'file.new',
  'new-folder': 'folder.new',
  history: 'tree.history',
  rename: 'tree.rename',
  delete: 'tree.delete',
};

/** Chiave di una riga: un percorso che cambia tipo (file ↔ cartella) è una riga nuova, come un componente diverso in React. */
export const nodeKey = (node: TreeNode): string => `${node.kind}:${node.path}`;

/** Ogni nodo dell'albero per percorso, a tutte le profondità. */
export function nodesByPath(nodes: readonly TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      map.set(node.path, node);
      walk(node.children);
    }
  };
  walk(nodes);
  return map;
}
