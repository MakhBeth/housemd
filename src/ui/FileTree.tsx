import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { ancestorsOf, type TreeNode } from './tree';
import styles from './FileTree.module.css';

export type TreeAction = 'new-file' | 'new-folder' | 'rename' | 'delete';

interface Props {
  nodes: TreeNode[];
  openPath: string | null;
  onOpen: (path: string) => void;
  onAction: (action: TreeAction, node: TreeNode | null) => void;
}

/** Menu = gruppo di pulsanti in un popover ancorato al pulsante "⋯" (niente role="menu"). */
const autoPopover = { popover: 'auto' } as Record<string, string>;
const ANCHOR = '--housemd-tree-menu';

export function FileTree({ nodes, openPath, onOpen, onAction }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openPath) return;
    setExpanded((prev) => new Set([...prev, ...ancestorsOf(openPath)]));
  }, [openPath]);

  const toggle = (path: string, open: boolean) =>
    setExpanded((prev) => {
      if (prev.has(path) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });

  const openMenu = (node: TreeNode, trigger: HTMLElement) => {
    anchorRef.current?.style.removeProperty('anchor-name');
    trigger.style.setProperty('anchor-name', ANCHOR);
    anchorRef.current = trigger;
    setMenuNode(node);
    const menu = menuRef.current!;
    if (!menu.matches(':popover-open')) menu.showPopover();
    requestAnimationFrame(() => menu.querySelector('button')?.focus());
  };

  const onContextMenu = (node: TreeNode) => (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const trigger = event.currentTarget.querySelector<HTMLElement>('[data-menu-trigger]') ?? event.currentTarget;
    openMenu(node, trigger);
  };

  const act = (action: TreeAction) => {
    menuRef.current?.hidePopover();
    onAction(action, menuNode);
  };

  const menuButton = (node: TreeNode) => (
    <button
      data-menu-trigger
      className={styles.menuButton}
      aria-label={`Azioni per ${node.name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(node, event.currentTarget);
      }}
    >
      ⋯
    </button>
  );

  const renderNodes = (list: TreeNode[]) => (
    <ul className={styles.list}>
      {list.map((node) => (
        <li key={node.path}>
          {node.kind === 'directory' ? (
            <details open={expanded.has(node.path)} onToggle={(e) => toggle(node.path, e.currentTarget.open)}>
              <summary className={styles.row} onContextMenu={onContextMenu(node)}>
                <span className={styles.name}>{node.name}</span>
                {menuButton(node)}
              </summary>
              {node.children.length > 0 ? renderNodes(node.children) : <p className={styles.emptyDir}>Cartella vuota</p>}
            </details>
          ) : (
            <div className={styles.row} data-active={node.path === openPath} onContextMenu={onContextMenu(node)}>
              <button
                className={styles.file}
                aria-current={node.path === openPath ? 'page' : undefined}
                onClick={() => onOpen(node.path)}
              >
                {node.name}
              </button>
              {menuButton(node)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <nav className={styles.tree} aria-label="File della cartella">
      {nodes.length > 0 ? renderNodes(nodes) : <p className={styles.emptyDir}>Nessun file markdown</p>}
      <div ref={menuRef} {...autoPopover} className={styles.menu}>
        {menuNode?.kind === 'directory' && (
          <>
            <button onClick={() => act('new-file')}>Nuovo file</button>
            <button onClick={() => act('new-folder')}>Nuova cartella</button>
          </>
        )}
        <button onClick={() => act('rename')}>Rinomina</button>
        <button className={styles.danger} onClick={() => act('delete')}>
          Elimina
        </button>
      </div>
    </nav>
  );
}
