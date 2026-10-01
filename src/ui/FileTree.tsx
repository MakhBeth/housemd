import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { useT } from '../i18n/I18nProvider';
import { isImage } from '../lib/paths';
import { Icon } from './Icon';
import { revealPath, toggleExpanded, type Expanded } from '../elements/file-tree/treeState';
import type { TreeAction } from '../elements/workspace/dialogFor';
import type { TreeNode } from './tree';
import { tabStop, treeKey, visibleItems } from './treeNav';
import styles from './FileTree.module.css';

export type { TreeAction };

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
  const [expanded, setExpanded] = useState<Expanded>(() => new Set());
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  // Un solo tab stop nell'albero (roving tabindex): le frecce spostano il focus tra le righe.
  const [focused, setFocused] = useState<string | null>(null);
  const items = useMemo(() => visibleItems(nodes, expanded), [nodes, expanded]);
  const stop = tabStop(items, focused, openPath);
  const rows = useRef(new Map<string, HTMLElement>());
  const byPath = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const walk = (list: TreeNode[]) => list.forEach((n) => { map.set(n.path, n); walk(n.children); });
    walk(nodes);
    return map;
  }, [nodes]);
  const rowProps = (path: string) => ({
    'data-tree-item': path,
    'aria-keyshortcuts': 'Shift+F10',
    tabIndex: stop === path ? 0 : -1,
    onFocus: () => setFocused(path),
    ref: (el: HTMLElement | null) => { if (el) rows.current.set(path, el); else rows.current.delete(path); },
  });

  useEffect(() => {
    if (!openPath) return;
    setExpanded((prev) => revealPath(prev, openPath));
  }, [openPath]);

  const toggle = (path: string, open: boolean) => setExpanded((prev) => toggleExpanded(prev, path, open));

  const openMenu = (node: TreeNode, trigger: HTMLElement) => {
    anchorRef.current?.style.removeProperty('anchor-name');
    // Il pulsante resta anche l'ancora del suo tooltip (.tooltip in global.css).
    trigger.style.setProperty('anchor-name', `${ANCHOR}, --tooltip-anchor`);
    anchorRef.current = trigger;
    setMenuNode(node);
    const menu = menuRef.current!;
    if (!menu.matches(':popover-open')) menu.showPopover();
    requestAnimationFrame(() => menu.querySelector('button')?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current = (event.target as HTMLElement).dataset.treeItem;
    if (current === undefined) return; // focus nel menu o altrove: tasti normali
    const move = treeKey(items, current, event);
    if (!move) return;
    event.preventDefault();
    if ('focus' in move) rows.current.get(move.focus)?.focus();
    else if ('expand' in move) toggle(move.expand, true);
    else if ('collapse' in move) toggle(move.collapse, false);
    else {
      const node = byPath.get(move.menu);
      const trigger = rows.current.get(move.menu)?.closest('li')?.querySelector<HTMLElement>('[data-menu-trigger]');
      if (node && trigger) openMenu(node, trigger);
    }
  };

  // Chiuso il menu (Esc, clic fuori) col focus perso, torna sulla riga da cui era partito.
  useEffect(() => {
    const menu = menuRef.current!;
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== 'closed' || !menuNode) return;
      const lost = document.activeElement === document.body || menu.contains(document.activeElement);
      if (lost) rows.current.get(menuNode.path)?.focus();
    };
    menu.addEventListener('toggle', onToggle);
    return () => menu.removeEventListener('toggle', onToggle);
  }, [menuNode]);

  const act = (action: TreeAction) => {
    menuRef.current?.hidePopover();
    onAction(action, menuNode);
  };

  const menuButton = (node: TreeNode) => (
    <button
      data-menu-trigger
      tabIndex={-1}
      className={`${styles.menuButton} tooltip`}
      aria-label={t('tree.actions', { name: node.name })}
      data-tooltip={t('tree.actions', { name: node.name })}
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
              <summary className={styles.row} {...rowProps(node.path)}>
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
            <div className={styles.row} data-active={node.path === openPath}>
              <button
                className={styles.file}
                {...rowProps(node.path)}
                aria-current={node.path === openPath ? 'page' : undefined}
                onClick={() => onOpen(node.path)}
              >
                <Icon name="file" size={16} />
                <span className={styles.name}>{node.name}</span>
                {drafts.has(node.path) && (
                  <span className={`${styles.draft} tooltip`} role="img" aria-label={t('tree.draft')} data-tooltip={t('tree.draft')}>
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
    <nav className={styles.tree} aria-label={t('tree.label')} onKeyDown={onKeyDown}>
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
