import { match } from 'ts-pattern';

import { dirname } from '../../lib/paths';
import type { TreeNode } from '../../ui/tree';

/** Voci del menu dell'albero (e pulsanti della testata della sidebar). */
export type TreeAction = 'new-file' | 'new-folder' | 'rename' | 'delete' | 'history';

/** Dialog aperto dal workspace. */
export type DialogState =
  | { kind: 'new-file' | 'new-folder'; dir: string }
  | { kind: 'rename' | 'delete'; node: TreeNode }
  | null;

export type TreeCommand =
  | { kind: 'dialog'; dialog: NonNullable<DialogState> }
  | { kind: 'history'; path: string }
  | { kind: 'none' };

/** Cosa fare per un'azione dell'albero. `node` è null per i pulsanti della testata (radice). */
export function dialogFor(action: TreeAction, node: TreeNode | null): TreeCommand {
  return match(action)
    .returnType<TreeCommand>()
    .with('history', () => (node ? { kind: 'history', path: node.path } : { kind: 'none' }))
    .with('new-file', 'new-folder', (kind) => ({
      kind: 'dialog',
      dialog: { kind, dir: node ? (node.kind === 'directory' ? node.path : dirname(node.path)) : '' },
    }))
    .with('rename', 'delete', (kind) => (node ? { kind: 'dialog', dialog: { kind, node } } : { kind: 'none' }))
    .exhaustive();
}
