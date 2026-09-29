import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { useT } from '../i18n/I18nProvider';
import { isImage } from '../lib/paths';
import { Icon } from './Icon';
import { ancestorsOf, type TreeNode } from './tree';
import styles from './FileTree.module.css';

export type TreeAction = 'new-file' | 'new-folder' | 'rename' | 'delete' | 'history';

interface Props {
  nodes: TreeNode[];
  openPath: string | null;
  /** File con una bozza nel buffer di emergenza: mostrano il pallino. */
  drafts: ReadonlySet<string>;
  onOpen: (path: string) => void;
  onAction: (action: TreeAction, node: TreeNode | null) => void;
}

/** Menu = gruppo di pulsanti in un popover ancorato al pulsante delle azioni (niente role="menu"). */
const autoPopover = { popover: 'auto' } as Record<string, string>;
const ANCHOR = '--housemd-tree-menu';

export function FileTree({ nodes, openPath, drafts, onOpen, onAction }: Props) {
  const t = useT();
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
      aria-label={t('tree.actions', { name: node.name })}
      title={t('tree.actions', { name: node.name })}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(node, event.currentTarget);
      }}
    >
      <Icon name="more" size={16} />
    </button>
  );

  const renderNodes = (list: TreeNode[]) => (
    <ul className={styles.list}>
      {list.map((node) => (
        <li key={node.path}>
          {node.kind === 'directory' ? (
            <details open={expanded.has(node.path)} onToggle={(e) => toggle(node.path, e.currentTarget.open)}>
              <summary className={styles.row} onContextMenu={onContextMenu(node)}>
                <Icon name={expanded.has(node.path) ? 'folderOpen' : 'folderClosed'} size={16} />
                <Icon name="folder" size={16} />
                <span className={styles.name}>{node.name}</span>
                {menuButton(node)}
              </summary>
              {node.children.length > 0 ? renderNodes(node.children) : <p className={styles.emptyDir}>{t('tree.emptyFolder')}</p>}
            </details>
          ) : node.kind === 'asset' ? (
            // Non markdown: solo visibile, niente apertura né menu.
            <div className={`${styles.row} ${styles.asset}`}>
              <Icon name={isImage(node.name) ? 'image' : 'asset'} size={16} />
              <span className={styles.name}>{node.name}</span>
            </div>
          ) : (
            <div className={styles.row} data-active={node.path === openPath} onContextMenu={onContextMenu(node)}>
              <button
                className={styles.file}
                aria-current={node.path === openPath ? 'page' : undefined}
                onClick={() => onOpen(node.path)}
              >
                <Icon name="file" size={16} />
                <span className={styles.name}>{node.name}</span>
                {drafts.has(node.path) && (
                  <span className={styles.draft} role="img" aria-label={t('tree.draft')} title={t('tree.draft')}>
                    <Icon name="draft" size={10} />
                  </span>
                )}
              </button>
              {menuButton(node)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <nav className={styles.tree} aria-label={t('tree.label')}>
      {nodes.length > 0 ? renderNodes(nodes) : <p className={styles.emptyDir}>{t('tree.noFiles')}</p>}
      <div ref={menuRef} {...autoPopover} className={styles.menu}>
        {menuNode?.kind === 'directory' && (
          <>
            <button onClick={() => act('new-file')}>{t('file.new')}</button>
            <button onClick={() => act('new-folder')}>{t('folder.new')}</button>
          </>
        )}
        {menuNode?.kind === 'file' && <button onClick={() => act('history')}>{t('tree.history')}</button>}
        <button onClick={() => act('rename')}>{t('tree.rename')}</button>
        <button className={styles.danger} onClick={() => act('delete')}>
          {t('tree.delete')}
        </button>
      </div>
    </nav>
  );
}
