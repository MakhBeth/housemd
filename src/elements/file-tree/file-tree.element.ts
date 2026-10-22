import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { RenderLoop } from '../../dom/renderLoop';
import { isImage } from '../../lib/paths';
import type { I18nStore } from '../../state/i18nStore';
import { ICONS } from '../../ui/icons';
import type { TreeNode } from '../../ui/tree';
import { tabStop, treeKey, visibleItems, type VisibleItem } from '../../ui/treeNav';
import { emit } from '../events';
import type { TreeAction } from '../workspace/dialogFor';
import { revealPath, toggleExpanded, type Expanded } from './treeState';
import { MENU_LABELS, menuActions, nodeKey, nodesByPath } from './treeView';
import './file-tree.css';

/** Nome dell'ancora del menu: il pulsante ⋯ che l'ha aperto (anchor-name scritto a mano, come in FileTree.tsx). */
const ANCHOR = '--housemd-tree-menu';

/** Nodi fissi dell'elemento: elenco radice, nota «nessun file», menu ⋯. */
interface Parts {
  nav: HTMLElement;
  root: HTMLUListElement;
  none: HTMLParagraphElement;
  menu: HTMLDivElement;
}

/** Nodi di una riga, legati al suo <li>; `node` è l'ultimo ricevuto (i listener lo leggono al momento). */
interface Row {
  node: TreeNode;
  /** La riga col tab stop: <summary> di una cartella o pulsante di un file (assente per gli asset). */
  focusable: HTMLElement | null;
  trigger: HTMLButtonElement | null;
  name: HTMLSpanElement;
  /** Cartella: <details>, icona aperta/chiusa, elenco dei figli o nota «cartella vuota». */
  details?: HTMLDetailsElement;
  /**
   * Ultimo `open` scritto sul <details>: si riscrive solo quando cambia lo stato, come la prop di React. Il
   * clic sul <summary> apre subito ma il toggle arriva dopo: un render nel mezzo non la richiude.
   */
  open?: boolean;
  folderIcon?: HTMLSpanElement;
  list?: HTMLUListElement;
  empty?: HTMLParagraphElement;
  /** File: riga esterna (data-active) e pallino della bozza. */
  box?: HTMLDivElement;
  draft?: HTMLSpanElement;
}

/**
 * Albero dei file della sidebar (era FileTree.tsx). Cartelle con <details> nativo, un solo tab stop
 * (treeNav.ts), menu ⋯ in un popover ancorato al pulsante che l'ha aperto. Tutti i nodi sono nel DOM,
 * anche dentro le cartelle chiuse, come con React. I setter disegnano subito (niente CodeMirror né
 * effetti da ordinare); un render chiesto mentre ne gira un altro si ripete alla fine.
 */
export class HmdFileTree extends HmdElement {
  #nodes: readonly TreeNode[] = [];
  #openPath: string | null = null;
  #drafts: ReadonlySet<string> = new Set();
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, Row>();
  /** Percorso → riga col tab stop e pulsante ⋯, ricostruite a ogni render. */
  #focusables = new Map<string, HTMLElement>();
  #triggers = new Map<string, HTMLButtonElement>();
  #byPath = new Map<string, TreeNode>();
  #items: VisibleItem[] = [];
  #expanded: Expanded = new Set();
  #focused: string | null = null;
  #menuNode: TreeNode | null = null;
  #anchor: HTMLElement | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    focusScope: () => this.#parts?.nav ?? null,
    // La riga con il focus è sparita (file eliminato o rinominato): il focus va sulla riga col tab stop
    // (il suo focusin ricalcola i tab stop).
    refocus: () => void this.focusTabStop(),
  });

  /**
   * Focus sulla riga col tab stop (il file aperto, o la prima riga): l'ingresso nell'albero da fuori. Falso con
   * l'albero vuoto (nessuna riga da raggiungere): chi chiama sceglie un altro bersaglio.
   */
  focusTabStop(): boolean {
    const stop = tabStop(this.#items, this.#focused, this.#openPath);
    const row = stop === null ? undefined : this.#focusables.get(stop);
    row?.focus();
    return !!row;
  }

  get nodes(): readonly TreeNode[] { return this.#nodes; }
  set nodes(value: readonly TreeNode[]) {
    value ??= [];
    if (value === this.#nodes) return;
    this.#nodes = value;
    this.#update();
  }
  get openPath(): string | null { return this.#openPath; }
  set openPath(value: string | null) {
    value ??= null;
    if (value === this.#openPath) return;
    this.#openPath = value;
    // Come l'effetto [openPath] di FileTree.tsx: solo quando il file aperto cambia, così una cartella
    // chiusa a mano dopo resta chiusa.
    if (value) this.#expanded = revealPath(this.#expanded, value);
    this.#update();
  }
  get drafts(): ReadonlySet<string> { return this.#drafts; }
  set drafts(value: ReadonlySet<string>) {
    value ??= new Set();
    if (value === this.#drafts) return;
    this.#drafts = value;
    this.#update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const root = el('ul', { class: 'list' });
      const none = el('p', { class: 'emptyDir' });
      const menu = el('div', { class: 'menu', popover: 'auto', on: { toggle: (event) => this.#onMenuToggle(event as ToggleEvent) } });
      const nav = el('nav', { class: 'tree', on: { keydown: (event) => this.#onKeyDown(event), focusin: (event) => this.#onFocusIn(event) } }, menu);
      this.append(nav);
      this.#parts = { nav, root, none, menu };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#update(), signal);
  }

  /** Un render alla volta (RenderLoop): la riga col tab stop può esistere solo nell'albero finale. */
  #update(): void {
    this.#loop.update();
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { nav, root, none, menu } = parts;
    const t = i18n.t;
    toggleAttr(nav, 'aria-label', true, t('tree.label'));
    this.#focusables.clear();
    this.#triggers.clear();
    this.#byPath = nodesByPath(this.#nodes);
    if (this.#nodes.length > 0) {
      none.remove();
      if (root.parentNode !== nav) nav.prepend(root);
      this.#renderList(root, this.#nodes, i18n);
    } else {
      root.remove();
      setText(none, t('tree.noFiles'));
      if (none.parentNode !== nav) nav.prepend(none);
    }
    this.#renderMenu(menu, i18n);
    this.#items = visibleItems(this.#nodes as TreeNode[], this.#expanded);
    this.#applyTabStops();
  }

  #renderList(list: HTMLUListElement, nodes: readonly TreeNode[], i18n: I18nStore): void {
    reconcileList(list, nodes, nodeKey, (node) => this.#createRow(node), (li, node) => this.#updateRow(li, node, i18n));
  }

  #createRow(node: TreeNode): HTMLLIElement {
    const name = el('span', { class: 'name' });
    if (node.kind === 'asset') {
      const li = el('li', null, el('div', { class: 'row asset' }, icon(isImage(node.name) ? 'image' : 'asset', { size: 16 }), name));
      this.#rows.set(li, { node, focusable: null, trigger: null, name });
      return li;
    }
    const row: Row = { node, focusable: null, trigger: null, name };
    const trigger = el(
      'button',
      {
        dataset: { menuTrigger: '' },
        tabindex: '-1',
        class: 'menuButton tooltip',
        on: {
          click: (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.#openMenu(row.node, trigger);
          },
        },
      },
      icon('more', { size: 16 }),
    );
    row.trigger = trigger;
    if (node.kind === 'directory') {
      const folderIcon = icon('folderClosed', { size: 16 });
      const summary = el('summary', { class: 'row', 'aria-keyshortcuts': 'Shift+F10' }, folderIcon, icon('folder', { size: 16 }), name, trigger);
      const details = el('details', { on: { toggle: () => this.#toggle(row.node.path, details.open) } }, summary);
      Object.assign(row, { focusable: summary, details, folderIcon, list: el('ul', { class: 'list' }), empty: el('p', { class: 'emptyDir' }) });
      const li = el('li', null, details);
      this.#rows.set(li, row);
      return li;
    }
    const button = el(
      'button',
      { class: 'file', 'aria-keyshortcuts': 'Shift+F10', on: { click: () => emit(this, 'hmd-open', { path: row.node.path }) } },
      icon('file', { size: 16 }),
      name,
    );
    const box = el('div', { class: 'row' }, button, trigger);
    row.focusable = button;
    row.box = box;
    row.draft = el('span', { class: 'draft tooltip', role: 'img' }, icon('draft', { size: 10 }));
    const li = el('li', null, box);
    this.#rows.set(li, row);
    return li;
  }

  #updateRow(li: HTMLLIElement, node: TreeNode, i18n: I18nStore): void {
    const row = this.#rows.get(li)!;
    const t = i18n.t;
    row.node = node;
    setText(row.name, node.name);
    if (row.trigger) {
      const label = t('tree.actions', { name: node.name });
      toggleAttr(row.trigger, 'aria-label', true, label);
      toggleAttr(row.trigger, 'data-tooltip', true, label);
      this.#triggers.set(node.path, row.trigger);
    }
    if (row.focusable) {
      row.focusable.dataset.treeItem = node.path;
      this.#focusables.set(node.path, row.focusable);
    }
    if (row.details && row.folderIcon && row.list && row.empty) {
      const open = this.#expanded.has(node.path);
      if (row.open !== open) {
        row.open = open;
        row.details.open = open;
      }
      row.folderIcon.style.setProperty('mask-image', `url("${ICONS[open ? 'folderOpen' : 'folderClosed']}")`);
      if (node.children.length > 0) {
        row.empty.remove();
        if (row.list.parentNode !== row.details) row.details.append(row.list);
        this.#renderList(row.list, node.children, i18n);
      } else {
        row.list.remove();
        setText(row.empty, t('tree.emptyFolder'));
        if (row.empty.parentNode !== row.details) row.details.append(row.empty);
      }
    }
    if (row.box && row.draft && row.focusable) {
      const active = node.path === this.#openPath;
      row.box.dataset.active = String(active);
      toggleAttr(row.focusable, 'aria-current', active, 'page');
      if (this.#drafts.has(node.path)) {
        toggleAttr(row.draft, 'aria-label', true, t('tree.draft'));
        toggleAttr(row.draft, 'data-tooltip', true, t('tree.draft'));
        if (row.draft.parentNode !== row.focusable) row.focusable.append(row.draft);
      } else {
        row.draft.remove();
      }
    }
  }

  #renderMenu(menu: HTMLDivElement, i18n: I18nStore): void {
    // Per chiave: i pulsanti restano (e con loro il focus) se il menu aperto si ridisegna.
    reconcileList(
      menu,
      menuActions(this.#menuNode?.kind ?? null),
      (action) => action,
      (action) => el('button', { class: action === 'delete' ? 'danger' : undefined, on: { click: () => this.#act(action) } }),
      (button, action) => setText(button, i18n.t(MENU_LABELS[action])),
    );
  }

  /** Un solo tab stop: la riga col focus se visibile, altrimenti il file aperto, altrimenti la prima. */
  #applyTabStops(): void {
    const stop = tabStop(this.#items, this.#focused, this.#openPath);
    // L'attributo sempre scritto (anche 0 su un pulsante, che lo è già): come tabIndex={…} di React.
    for (const [path, row] of this.#focusables) toggleAttr(row, 'tabindex', true, path === stop ? '0' : '-1');
  }

  #onFocusIn(event: FocusEvent): void {
    // Come onFocus di React sulla riga: vale anche per il ⋯ dentro il <summary> di una cartella.
    const row = (event.target as Element).closest<HTMLElement>('[data-tree-item]');
    if (!row || !this.contains(row)) return;
    this.#focused = row.dataset.treeItem!;
    // Durante un render il tab stop si ricalcola alla fine: qui niente.
    if (!this.#loop.rendering) this.#applyTabStops();
  }

  #toggle(path: string, open: boolean): void {
    const next = toggleExpanded(this.#expanded, path, open);
    if (next === this.#expanded) return;
    this.#expanded = next;
    this.#update();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const current = (event.target as HTMLElement).dataset?.treeItem;
    if (current === undefined) return; // focus nel menu o altrove: tasti normali
    const move = treeKey(this.#items, current, event);
    if (!move) return;
    event.preventDefault();
    if ('focus' in move) this.#focusables.get(move.focus)?.focus();
    else if ('expand' in move) this.#toggle(move.expand, true);
    else if ('collapse' in move) this.#toggle(move.collapse, false);
    else {
      const node = this.#byPath.get(move.menu);
      const trigger = this.#triggers.get(move.menu);
      if (node && trigger) this.#openMenu(node, trigger);
    }
  }

  #openMenu(node: TreeNode, trigger: HTMLElement): void {
    const parts = this.#parts;
    if (!parts || !this.#i18n) return;
    this.#anchor?.style.removeProperty('anchor-name');
    // Il pulsante resta anche l'ancora del suo tooltip (.tooltip in global.css).
    trigger.style.setProperty('anchor-name', `${ANCHOR}, --tooltip-anchor`);
    this.#anchor = trigger;
    this.#menuNode = node;
    // Come ogni altro cambio di stato: un render alla volta (#update disegna anche il menu). Un render
    // chiesto da un listener mentre questo è in corso si ripete alla fine, mai annidato.
    this.#update();
    // Un listener del render può aver staccato l'albero o aperto un altro menu (che si è già mostrato).
    if (!this.isConnected || this.#menuNode !== node) return;
    if (!parts.menu.matches(':popover-open')) parts.menu.showPopover();
    requestAnimationFrame(() => {
      if (this.isConnected) parts.menu.querySelector('button')?.focus();
    });
  }

  /** Chiuso il menu (Esc, clic fuori) col focus perso, il focus torna sulla riga da cui era partito. */
  #onMenuToggle(event: ToggleEvent): void {
    const menuNode = this.#menuNode;
    if (event.newState !== 'closed' || !menuNode || !this.#parts) return;
    const lost = document.activeElement === document.body || this.#parts.menu.contains(document.activeElement);
    if (lost) this.#focusables.get(menuNode.path)?.focus();
  }

  #act(action: TreeAction): void {
    const node = this.#menuNode;
    this.#parts?.menu.hidePopover();
    emit(this, 'hmd-tree-action', { action, node });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-file-tree': HmdFileTree;
  }
}
