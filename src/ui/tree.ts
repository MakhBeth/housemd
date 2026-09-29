import type { Entry } from '../fs/types';
import { basename, dirname, splitPath } from '../lib/paths';

export interface TreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory' | 'asset';
  children: TreeNode[];
}

/** `locale`: lingua dell'interfaccia, per ordinare i nomi con le sue regole (undefined = quella del browser). */
export function buildTree(entries: Entry[], locale?: string): TreeNode[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const root: TreeNode = { name: '', path: '', kind: 'directory', children: [] };
  const dirs = new Map<string, TreeNode>([['', root]]);
  const ensureDir = (path: string): TreeNode => {
    const found = dirs.get(path);
    if (found) return found;
    const node: TreeNode = { name: basename(path), path, kind: 'directory', children: [] };
    ensureDir(dirname(path)).children.push(node);
    dirs.set(path, node);
    return node;
  };
  for (const entry of entries) {
    if (entry.kind === 'directory') ensureDir(entry.path);
    else ensureDir(dirname(entry.path)).children.push({ name: basename(entry.path), path: entry.path, kind: entry.kind, children: [] });
  }
  const sort = (nodes: TreeNode[]) => {
    // Cartelle prima; file e asset mescolati in ordine di nome.
    const isDir = (n: TreeNode) => (n.kind === 'directory' ? 0 : 1);
    nodes.sort((a, b) => isDir(a) - isDir(b) || collator.compare(a.name, b.name));
    for (const node of nodes) sort(node.children);
  };
  sort(root.children);
  return root.children;
}

export function ancestorsOf(path: string): string[] {
  const parts = splitPath(dirname(path));
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
