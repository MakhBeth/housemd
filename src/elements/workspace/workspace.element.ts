import type { ChangeDesc } from '@codemirror/state';
import { match } from 'ts-pattern';

import type { AiController } from '../../ai/aiController';
import { sameRange, type TextRange } from '../../ai/selectionChip';
import { browserSyncBinding, type SyncBinding } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { createDocSession, type DocSession } from '../../editor/docSession';
import { requestAccess } from '../../fs/access';
import { APP_TITLE, pageTitle } from '../../lib/pageTitle';
import { readLastFile, readPref, readValidPref, writeLastFile, writePref } from '../../lib/prefs';
import type { SettingsSection } from '../../lib/route';
import { parseTextWidth, textWidthVars, type TextWidth } from '../../lib/textWidth';
import type { I18nStore } from '../../state/i18nStore';
import type { RouteStore } from '../../state/routeStore';
import type { ThemeStore } from '../../state/themeStore';
import type { IconName } from '../../ui/icons';
import { shortcutFor } from '../../ui/shortcuts';
import { buildTree, type TreeNode } from '../../ui/tree';
import type { Workspace, WorkspaceState } from '../../workspace/workspace';
import type { HmdAiReview } from '../ai/review.element';
import type { HmdAiSidebar } from '../ai/sidebar.element';
import type { HmdConflictBar } from '../conflict-bar/conflict-bar.element';
import { showAccessLostDialog } from '../dialogs/accessLostDialog';
import type { HmdEditor } from '../editor/editor.element';
import { emit } from '../events';
import type { HmdFileTree } from '../file-tree/file-tree.element';
import type { HmdHistoryPanel } from '../history-panel/history-panel.element';
import type { HmdPreview } from '../preview/preview.element';
import type { HmdSearchPanel } from '../search-panel/search-panel.element';
import type { HmdSettings } from '../settings/settings.element';
import type { HmdToasts } from '../toasts/toasts.element';
import { openAiSession, browserAiSessionDeps, type AiSessionWorkspace } from './aiSession';
import { dialogFor, type TreeAction } from './dialogFor';
import { allowedInSettings } from './keymap';
import { clampWidth, gridColumns, MODES, nextPaneMode, PANE_MODES, panesMode, resizeByKey, sidePanel, WIDTH_LIMITS, type Mode, type PaneMode } from './layout';
import { saveIndicator } from './saveIndicator';
import { runTreeDialog } from './treeDialogs';
import { docKey, reopenPlan, shownMode, toastItems, toastTarget, unloadNeedsConfirm } from './workspaceView';
import './workspace.css';

/** Apre la sessione AI di una cartella (iniettabile nei test: IndexedDB in jsdom non c'è). */
export type OpenAiSession = (workspace: AiSessionWorkspace, signal: AbortSignal) => Promise<{ controller: AiController; close(): void } | null>;

const NO_TERMS: string[] = [];

interface Parts {
  layout: HTMLDivElement;
  main: HTMLElement;
  toggle: HTMLButtonElement;
  path: HTMLSpanElement;
  modes: HTMLDivElement;
  modeButtons: Map<Mode, HTMLButtonElement>;
  saveState: HTMLSpanElement;
  saveText: Text;
  history: HTMLButtonElement;
  saveAll: HTMLButtonElement;
  settings: HTMLButtonElement;
  toolbar: HTMLElement;
  toasts: HmdToasts;
}

/** Nodi che compaiono e spariscono con lo stato (come i rami condizionali di WorkspaceView.tsx): ricreati a ogni ricomparsa. */
interface Slots {
  aside: HTMLElement;
  resizer: HTMLDivElement;
  aiSidebar: HmdAiSidebar;
  treeHeader: HTMLDivElement;
  search: HmdSearchPanel;
  orphans: HTMLElement;
  tree: HmdFileTree;
  conflict: HmdConflictBar;
  review: HmdAiReview;
  panes: HTMLDivElement;
  editorPane: HTMLElement;
  historyPane: HTMLElement;
  previewPane: HTMLElement;
  empty: HTMLDivElement;
  settings: HmdSettings;
  draftIcon: HTMLSpanElement;
}

/** Togli i figli non voluti e inserisci i mancanti nell'ordine dato, senza spostare quelli già al loro posto. */
function place(parent: Element, wanted: readonly Element[]): void {
  for (const child of [...parent.children]) if (!wanted.includes(child)) child.remove();
  let cursor: Element | null = parent.firstElementChild;
  for (const node of wanted) {
    if (node === cursor) cursor = cursor.nextElementSibling;
    else parent.insertBefore(node, cursor);
  }
}

/** Assegna una proprietà solo se cambia (i setter dei figli possono riconciliare tutto). */
function assign<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  if (target[key] !== value) target[key] = value;
}

/**
 * Area di lavoro di una cartella (era WorkspaceView.tsx): griglia con il pannello a sinistra (albero, ricerca,
 * bozze orfane o, in modalità AI, la chat) e il separatore ridimensionabile, la barra degli strumenti, il
 * documento (editor, anteprima, cronologia o revisione AI), le impostazioni sopra (dalla rotta) e i toast.
 * Crea la sessione AI della cartella e la sync, riapre l'ultimo file, elenca le bozze orfane, gestisce le
 * scorciatoie globali e i listener della finestra (tutti legati al `signal`), il dialog dell'accesso perso e
 * il titolo della scheda. Verso fuori manda solo `hmd-workspace-change-folder`.
 */
export class HmdWorkspace extends HmdElement {
  #workspace: Workspace | null = null;
  #workspaceId = '';
  #handle: FileSystemDirectoryHandle | null = null;
  #switchingFolder = false;
  #i18n: I18nStore | null = null;
  #theme: ThemeStore | null = null;
  #route: RouteStore | null = null;
  #openAi: OpenAiSession = (workspace, signal) => openAiSession(workspace, browserAiSessionDeps, signal);
  #syncFor: (controller: AiController) => SyncBinding = browserSyncBinding;

  #parts: Parts | null = null;
  #slots: Partial<Slots> = {};
  #signal: AbortSignal | null = null;
  // Stato della vista (era lo stato di React), letto dalle preferenze alla prima connessione.
  #mode: Mode = 'split';
  #lastPane: PaneMode = 'split';
  #sidebarOpen = true;
  #sidebarWidth = WIDTH_LIMITS.sidebar.initial;
  #aiWidth = WIDTH_LIMITS.ai.initial;
  #textWidth: TextWidth = { editor: null, preview: null };
  #highlight: string[] = NO_TERMS;
  #historyOpen = false;
  #historyPath = '';
  #queuedRestore: { id: number; path: string } | null = null;
  #aiSelection: TextRange | null = null;
  #orphans: string[] = [];
  #orphanNodes = new Map<string, HTMLButtonElement>();
  #orphanKey: unknown[] = [];
  #orphanRequest = 0;
  #reopened = false;
  #docKey = '';
  #session: DocSession = createDocSession('undefined#undefined', '');
  #lastFile: string | null = null;
  #settingsWasOpen = false;
  #focusBeforeSettings: HTMLElement | null = null;
  #memo: { treeEntries?: WorkspaceState['entries']; filesEntries?: WorkspaceState['entries']; locale?: string; tree?: TreeNode[]; files?: string[]; drafts?: readonly string[]; draftSet?: ReadonlySet<string> } = {};
  #toastKey: unknown[] = [];
  // Sessione AI e sync: vivono con l'elemento collegato.
  #ai: AiController | null = null;
  #aiSession: { close(): void } | null = null;
  #aiAbort: AbortController | null = null;
  #sync: SyncBinding | null = null;
  #accessLost: AbortController | null = null;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#workspace && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#parts!, this.#workspace!, this.#i18n!),
  });

  /**
   * Il focus d'ingresso nello workspace (dopo l'apertura della cartella, o quando la sidebar cambia sotto il
   * focus): la riga col tab stop dell'albero; con l'albero vuoto «Nuovo file» nella testata della sidebar (l'azione
   * utile in una cartella vuota); con la sidebar nascosta «Mostra sidebar» nella barra.
   */
  focusStart(): void {
    if (this.#slots.tree?.focusTabStop()) return;
    const newFile = this.#slots.treeHeader?.children[2] as HTMLElement | undefined;
    (newFile ?? this.#parts?.toggle)?.focus();
  }

  get workspace(): Workspace | null { return this.#workspace; }
  set workspace(value: Workspace | null) {
    value ??= null;
    if (value === this.#workspace) return;
    this.#workspace = value;
    this.reconnect();
  }
  get workspaceId(): string { return this.#workspaceId; }
  set workspaceId(value: string) { this.#workspaceId = value ?? ''; }
  get handle(): FileSystemDirectoryHandle | null { return this.#handle; }
  set handle(value: FileSystemDirectoryHandle | null) { this.#handle = value ?? null; }
  get switchingFolder(): boolean { return this.#switchingFolder; }
  set switchingFolder(value: boolean) {
    value = !!value;
    if (value === this.#switchingFolder) return;
    this.#switchingFolder = value;
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) {
    value ??= null;
    if (value === this.#theme) return;
    this.#theme = value;
    this.#loop.update();
  }
  get route(): RouteStore | null { return this.#route; }
  set route(value: RouteStore | null) {
    value ??= null;
    if (value === this.#route) return;
    this.#route = value;
    this.reconnect();
  }
  /** Solo per i test: come si apre la sessione AI e come si crea la sync. */
  set openAi(value: OpenAiSession) { this.#openAi = value; }
  set syncFor(value: (controller: AiController) => SyncBinding) { this.#syncFor = value; }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      this.#mode = readPref('mode');
      this.#lastPane = this.#mode === 'ai' ? 'split' : this.#mode;
      this.#sidebarOpen = readPref('sidebarOpen');
      this.#sidebarWidth = clampWidth('sidebar', readPref('sidebarWidth'));
      this.#aiWidth = clampWidth('ai', readPref('aiSidebarWidth'));
      this.#textWidth = readValidPref('textWidth', parseTextWidth);
      this.#applyTextWidth();
      this.#parts = this.#build();
      this.append(this.#parts.layout, this.#parts.toasts);
    }
    this.#signal = signal;
    this.#dialogs ??= new AbortController();
    const { workspace, i18n, route } = { workspace: this.#workspace, i18n: this.#i18n, route: this.#route };
    if (!workspace || !i18n || !route) return;
    this.#startAi(workspace);
    route.setGuard({ canLeave: () => !this.#slots.settings?.dirty, onBlocked: () => this.#slots.settings?.requestClose() });
    this.#listen(workspace, signal);
    this.watch(workspace, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
    this.watch(route, () => this.#loop.update(), signal);
    if (this.#ai) this.watch(this.#ai, () => this.#loop.update(), signal);
    if (this.#sync) this.watch(this.#sync, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#signal = null;
    this.#route?.setGuard({ canLeave: () => true, onBlocked: () => {} });
    this.#accessLost?.abort();
    this.#accessLost = null;
    this.#dialogs?.abort();
    this.#dialogs = null;
    this.#aiAbort?.abort();
    this.#aiAbort = null;
    this.#sync?.dispose();
    this.#sync = null;
    this.#aiSession?.close();
    this.#aiSession = null;
    this.#ai = null;
    // Tornando alla schermata iniziale il titolo è quello dell'app.
    document.title = APP_TITLE;
  }

  /** Una sessione AI per cartella: pronta, si ascolta con il signal del momento e porta con sé la sync. */
  #startAi(workspace: Workspace): void {
    if (this.#aiAbort) return;
    const abort = (this.#aiAbort = new AbortController());
    void this.#openAi(workspace, abort.signal).then((session) => {
      if (!session) return;
      if (abort.signal.aborted) return session.close();
      this.#aiSession = session;
      this.#ai = session.controller;
      this.#sync = this.#syncFor(session.controller);
      const signal = this.#signal;
      if (signal) {
        this.watch(session.controller, () => this.#loop.update(), signal);
        this.watch(this.#sync, () => this.#loop.update(), signal);
      }
    });
  }

  /** Listener della finestra e del documento, legati al `signal`. */
  #listen(workspace: Workspace, signal: AbortSignal): void {
    const onFocus = () => void workspace.checkExternal();
    const onBlur = () => void workspace.blur();
    window.addEventListener('focus', onFocus, { signal });
    window.addEventListener('blur', onBlur, { signal });
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? onFocus() : onBlur()), { signal });
    window.addEventListener(
      'beforeunload',
      (event) => {
        if (!unloadNeedsConfirm(workspace.getState(), !!this.#ai?.hasPendingWork())) return;
        void workspace.blur();
        event.preventDefault();
      },
      { signal },
    );
    window.addEventListener('keydown', (event) => this.#onKey(event, workspace), { signal });
  }

  get #settingsOpen(): boolean {
    return this.#route?.getState().view === 'settings';
  }

  get #shown(): Mode {
    return shownMode(this.#mode, !!this.#ai);
  }

  /** Scorciatoie globali: vedi src/ui/shortcuts.ts. */
  #onKey(event: KeyboardEvent, workspace: Workspace): void {
    const shown = this.#shown;
    const settingsOpen = this.#settingsOpen;
    if (event.key === 'Escape' && shown === 'ai' && !settingsOpen) this.#ai?.stop();
    // Già gestito dall'editor (Ctrl+B è il grassetto lì, la barra laterale altrove).
    if (event.defaultPrevented) return;
    const shortcut = shortcutFor(event);
    if (!shortcut) return;
    // Con le impostazioni aperte restano solo i salvataggi (altrimenti Ctrl+S apre "Salva pagina").
    if (settingsOpen && !allowedInSettings(shortcut)) return;
    event.preventDefault();
    match(shortcut)
      .with('save', () => void workspace.saveNow())
      .with('saveAll', () => void workspace.saveAll())
      .with('search', () => {
        if (shown === 'ai') this.#changeMode(this.#lastPane);
        this.#setSidebar(true);
        requestAnimationFrame(() => this.#slots.search?.focusInput());
      })
      .with('toggleAi', () => {
        if (this.#ai) this.#changeMode(shown === 'ai' ? this.#lastPane : 'ai');
      })
      .with('toggleSidebar', () => this.#setSidebar(!this.#sidebarOpen))
      .with('cycleMode', () => this.#changeMode(nextPaneMode(shown)))
      .exhaustive();
  }

  #setSidebar(open: boolean): void {
    this.#sidebarOpen = open;
    writePref('sidebarOpen', open);
    this.#loop.update();
  }

  #changeMode(next: Mode): void {
    if (next !== 'ai') this.#lastPane = next;
    // La chat sta nella sidebar: entrando in AI la si apre.
    else this.#setSidebar(true);
    this.#mode = next;
    writePref('mode', next);
    this.#loop.update();
  }

  #openFile(path: string, terms: string[] = NO_TERMS): Promise<void> {
    this.#highlight = terms;
    this.#loop.update();
    return this.#workspace!.openFile(path);
  }

  #openSettings(section: SettingsSection = 'general'): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) this.#focusBeforeSettings = active;
    this.#route?.navigate({ view: 'settings', section });
  }

  // Il ripristino deve passare dall'editor come transazione (annullabile con Ctrl+Z): in sola anteprima
  // l'editor non c'è, quindi si passa alla vista affiancata e si ripristina solo dopo.
  #restoreVersion(id: number): void {
    const workspace = this.#workspace!;
    const path = workspace.getState().doc?.path;
    if (!path) return;
    if (this.#shown !== 'preview') return void workspace.restoreVersion(id);
    this.#queuedRestore = { id, path };
    this.#changeMode('split');
  }

  #onTreeAction(action: TreeAction, node: TreeNode | null): void {
    const workspace = this.#workspace!;
    const t = this.#i18n!.t;
    match(dialogFor(action, node))
      .with({ kind: 'history' }, ({ path }) => {
        // La cronologia si apre solo se il file richiesto è davvero quello aperto.
        void this.#openFile(path).then(() => {
          if (!this.isConnected || workspace.getState().doc?.path !== path) return;
          this.#historyOpen = true;
          this.#loop.update();
        });
      })
      .with({ kind: 'dialog' }, ({ dialog }) => {
        const signal = this.#dialogs?.signal;
        if (signal) void runTreeDialog(dialog, { t, signal, paths: () => workspace.getState().entries.map((e) => e.path), workspace });
      })
      .with({ kind: 'none' }, () => {})
      .exhaustive();
  }

  #onResizeStart(event: PointerEvent): void {
    const target = event.currentTarget as HTMLDivElement;
    target.setPointerCapture(event.pointerId);
    const panel = sidePanel(this.#shown);
    let width = panel === 'ai' ? this.#aiWidth : this.#sidebarWidth;
    const done = new AbortController();
    const move = (e: PointerEvent) => {
      width = clampWidth(panel, e.clientX);
      if (panel === 'ai') this.#aiWidth = width;
      else this.#sidebarWidth = width;
      this.#loop.update();
    };
    const up = () => {
      done.abort();
      writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', width);
    };
    target.addEventListener('pointermove', move, { signal: done.signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) target.addEventListener(type, up, { signal: done.signal });
  }

  #onResizeKey(event: KeyboardEvent): void {
    const panel = sidePanel(this.#shown);
    const next = resizeByKey(panel, panel === 'ai' ? this.#aiWidth : this.#sidebarWidth, event.key);
    if (next === null) return;
    event.preventDefault();
    if (panel === 'ai') this.#aiWidth = next;
    else this.#sidebarWidth = next;
    writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', next);
    this.#loop.update();
  }

  #applyTextWidth(): void {
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(textWidthVars(this.#textWidth))) root.setProperty(name, value);
  }

  #build(): Parts {
    const modeButtons = new Map(
      MODES.map((m) => [m.id, el('button', { class: 'mode tooltip', on: { click: () => this.#changeMode(m.id) } }, icon(m.icon))] as const),
    );
    const saveText = document.createTextNode('');
    const parts: Parts = {
      layout: el('div', { class: 'layout' }),
      main: el('main', { class: 'main' }),
      toggle: el('button', { class: 'iconButton tooltip', on: { click: () => this.#setSidebar(!this.#sidebarOpen) } }, icon('sidebarOpen')),
      path: el('span', { class: 'path' }),
      modes: el('div', { class: 'modes', role: 'group' }),
      modeButtons,
      saveState: el('span', { class: 'saveState' }, saveText),
      saveText,
      history: el(
        'button',
        {
          class: 'iconButton tooltip',
          on: {
            click: () => {
              const ai = this.#shown === 'ai';
              if (ai) this.#changeMode(this.#lastPane);
              this.#historyOpen = ai ? true : !this.#historyOpen;
              this.#loop.update();
            },
          },
        },
        icon('history'),
      ),
      saveAll: el('button', { class: 'iconButton tooltip', on: { click: () => void this.#workspace?.saveAll() } }, icon('save')),
      settings: el('button', { class: 'iconButton tooltip', on: { click: () => this.#openSettings() } }, icon('settings')),
      toolbar: el('header', { class: 'toolbar' }),
      toasts: el('hmd-toasts', {
        on: {
          'hmd-toast-dismiss': (event) => {
            const target = toastTarget(event.detail.key);
            if (target.kind === 'ai') this.#ai?.clearError();
            else this.#workspace?.dismissToast(target.id);
          },
        },
      }),
    };
    const themeSwitcher = el('hmd-theme-switcher');
    themeSwitcher.store = this.#theme;
    themeSwitcher.i18n = this.#i18n;
    parts.toolbar.append(
      el('div', { class: 'lead' }, parts.toggle, parts.path),
      parts.modes,
      el('div', { class: 'actions' }, parts.saveState, parts.history, parts.saveAll, themeSwitcher, parts.settings),
    );
    parts.main.append(parts.toolbar);
    return parts;
  }

  /** Un nodo condizionale: creato quando serve, dimenticato quando non serve più (alla ricomparsa è nuovo, come con React). */
  #slot<K extends keyof Slots>(name: K, show: boolean, create: () => Slots[K]): Slots[K] | null {
    if (!show) {
      delete this.#slots[name];
      return null;
    }
    return (this.#slots[name] ??= create());
  }

  #createReview(): HmdAiReview {
    return el('hmd-ai-review');
  }

  #createEditor(): HmdEditor {
    return el('hmd-editor', {
      on: {
        'hmd-doc-change': (event) => this.#docChanged(event.detail.changes, event.detail),
        'hmd-selection': (event) => this.#onSelection(event.detail.range),
        'hmd-top-line': (event) => {
          if (this.#shown === 'split') this.#slots.previewPane?.querySelector('hmd-preview')?.scrollToLine(event.detail.line);
        },
      },
    });
  }

  #onSelection(range: TextRange | null): void {
    // Scatta a ogni movimento del cursore: si aggiorna solo se il tratto cambia.
    if (sameRange(this.#aiSelection, range)) return;
    this.#aiSelection = range;
    this.#loop.update();
  }

  #render(parts: Parts, workspace: Workspace, i18n: I18nStore): void {
    const t = i18n.t;
    const state = workspace.getState();
    const doc = state.doc;
    const ai = this.#ai;
    const aiState = ai?.getState() ?? null;
    const shown = this.#shown;
    const settingsOpen = this.#settingsOpen;
    const theme = this.#theme!;

    // Effetti di React, nell'ordine: sessione e selezione per documento, chat AI avvisata, bozze, ultimo file.
    const key = docKey(doc);
    if (key !== this.#docKey) {
      this.#docKey = key;
      this.#session = createDocSession(key, doc?.text || '');
      this.#aiSelection = null;
      if (doc) ai?.documentChanged(doc.path, { iterChangedRanges: () => {}, mapPos: (n: number) => n } as never, true);
    }
    if (!doc) this.#historyOpen = false;
    if (doc && doc.path !== this.#lastFile) writeLastFile(this.#workspaceId, doc.path);
    this.#lastFile = doc?.path ?? this.#lastFile;
    this.#watchOrphans(workspace, state);
    this.#reopen(workspace, state);
    this.#watchAccess(workspace, state, i18n);
    document.title = pageTitle({ settings: settingsOpen, filePath: doc?.path }, t('settings.title'));

    // Griglia, pannello e separatore.
    const panel = sidePanel(shown);
    const width = shown === 'ai' ? this.#aiWidth : this.#sidebarWidth;
    parts.layout.inert = settingsOpen;
    const columns = gridColumns(this.#sidebarOpen, width);
    if (parts.layout.style.gridTemplateColumns !== columns) parts.layout.style.gridTemplateColumns = columns;
    const aside = this.#slot('aside', this.#sidebarOpen, () => el('aside', { class: 'sidebar' }));
    const resizer = this.#slot('resizer', this.#sidebarOpen, () =>
      el('div', {
        class: 'resizer',
        role: 'separator',
        'aria-orientation': 'vertical',
        tabIndex: 0,
        on: { pointerdown: (event) => this.#onResizeStart(event), keydown: (event) => this.#onResizeKey(event) },
      }),
    );
    if (aside) this.#renderSidebar(aside, workspace, state, i18n);
    else for (const name of ['aiSidebar', 'treeHeader', 'search', 'orphans', 'tree'] as const) delete this.#slots[name];
    if (resizer) {
      toggleAttr(resizer, 'aria-label', true, t('sidebar.resize'));
      toggleAttr(resizer, 'aria-valuenow', true, String(width));
      toggleAttr(resizer, 'aria-valuemin', true, String(WIDTH_LIMITS[panel].min));
      toggleAttr(resizer, 'aria-valuemax', true, String(WIDTH_LIMITS[panel].max));
    }
    place(parts.layout, [...(aside && resizer ? [aside, resizer] : []), parts.main]);

    // Barra degli strumenti.
    const sidebarLabel = this.#sidebarOpen ? t('sidebar.hide') : t('sidebar.show');
    toggleAttr(parts.toggle, 'aria-pressed', true, String(this.#sidebarOpen));
    toggleAttr(parts.toggle, 'aria-label', true, sidebarLabel);
    toggleAttr(parts.toggle, 'data-tooltip', true, sidebarLabel);
    const toggleIcon: IconName = this.#sidebarOpen ? 'sidebarClose' : 'sidebarOpen';
    if (parts.toggle.dataset.icon !== toggleIcon) {
      parts.toggle.replaceChildren(icon(toggleIcon));
      parts.toggle.dataset.icon = toggleIcon;
    }
    setText(parts.path, doc?.path ?? t('toolbar.noFile'));
    toggleAttr(parts.modes, 'aria-label', true, t('toolbar.modes'));
    const modes = ai ? MODES : PANE_MODES;
    for (const m of modes) {
      const button = parts.modeButtons.get(m.id)!;
      toggleAttr(button, 'aria-pressed', true, String(shown === m.id));
      toggleAttr(button, 'aria-label', true, t(m.label));
      toggleAttr(button, 'data-tooltip', true, t(m.label));
    }
    place(parts.modes, modes.map((m) => parts.modeButtons.get(m.id)!));
    const indicator = saveIndicator(doc);
    toggleAttr(parts.saveState, 'data-state', true, indicator.state);
    toggleAttr(parts.saveState, 'aria-live', true, indicator.live);
    toggleAttr(parts.saveState, 'role', !!indicator.role, indicator.role ?? '');
    const draftIcon = this.#slot('draftIcon', indicator.draftIcon, () => icon('draft', { size: 10 }));
    if (draftIcon && draftIcon.parentNode !== parts.saveState) parts.saveState.prepend(draftIcon);
    for (const child of [...parts.saveState.children]) if (child !== draftIcon) child.remove();
    setText(parts.saveText, indicator.label ? t(indicator.label) : '');
    toggleAttr(parts.history, 'aria-pressed', true, String(shown !== 'ai' && this.#historyOpen));
    parts.history.disabled = !doc;
    toggleAttr(parts.history, 'aria-label', true, t('toolbar.history'));
    toggleAttr(parts.history, 'data-tooltip', true, t('toolbar.history'));
    toggleAttr(parts.saveAll, 'aria-label', true, t('toolbar.saveAll'));
    toggleAttr(parts.saveAll, 'data-tooltip', true, t('toolbar.saveAll'));
    toggleAttr(parts.settings, 'aria-label', true, t('toolbar.settings'));
    toggleAttr(parts.settings, 'data-tooltip', true, t('toolbar.settings'));
    const themeSwitcher = parts.toolbar.querySelector('hmd-theme-switcher')!;
    assign(themeSwitcher, 'store', theme);
    assign(themeSwitcher, 'i18n', i18n);

    // Conflitto e documento.
    const conflict = this.#slot('conflict', !!doc?.conflict, () =>
      el('hmd-conflict-bar', { on: { 'hmd-conflict': (event) => void this.#workspace?.resolveConflict(event.detail.choice) } }),
    );
    if (conflict) assign(conflict, 'i18n', i18n);
    const review = this.#slot('review', !!doc && shown === 'ai' && !!ai, () => this.#createReview());
    const panes = this.#slot('panes', !!doc && !review, () => el('div', { class: 'panes' }));
    const empty = this.#slot('empty', !doc, () =>
      el('div', { class: 'empty' }, el('p'), el('button', { class: 'primary', on: { click: () => this.#onTreeAction('new-file', null) } })),
    );
    if (review && doc && ai) this.#renderReview(review, state, ai, i18n);
    if (panes && doc) this.#renderPanes(panes, workspace, state, i18n);
    else for (const name of ['editorPane', 'historyPane', 'previewPane'] as const) delete this.#slots[name];
    if (empty) {
      setText(empty.firstElementChild!, t('empty.hint'));
      setText(empty.lastElementChild!, t('file.new'));
    }
    place(parts.main, [parts.toolbar, ...(conflict ? [conflict] : []), (review ?? panes ?? empty)!]);

    // Impostazioni sopra l'area di lavoro, e i toast.
    const settings = this.#slot('settings', settingsOpen, () => this.#createSettings());
    if (settings) this.#renderSettings(settings, state, i18n);
    place(this, [parts.layout, ...(settings ? [settings] : []), parts.toasts]);
    assign(parts.toasts, 'i18n', i18n);
    // Un array nuovo solo quando cambiano toast, errore AI o lingua (lo useMemo di React): i toast riavviano i timer a ogni array.
    const toastKey = [state.toasts, aiState?.error, i18n.getState()];
    if (!toastKey.every((v, i) => v === this.#toastKey[i])) {
      this.#toastKey = toastKey;
      parts.toasts.items = toastItems(state.toasts, aiState?.error, t);
    }

    // Chiuse le impostazioni, il focus torna dove era prima di aprirle.
    if (this.#settingsWasOpen && !settingsOpen) {
      const previous = this.#focusBeforeSettings;
      this.#focusBeforeSettings = null;
      if (previous?.isConnected) previous.focus();
    }
    this.#settingsWasOpen = settingsOpen;

    // Ripristino chiesto in sola anteprima: parte appena l'editor c'è.
    const queued = this.#queuedRestore;
    if (queued && shown !== 'preview' && this.#slots.editorPane) {
      this.#queuedRestore = null;
      // Nel frattempo si è passati a un altro file: quella versione non riguarda più il documento.
      if (doc?.path === queued.path) queueMicrotask(() => void workspace.restoreVersion(queued.id));
    }
  }

  #renderSidebar(aside: HTMLElement, workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const t = i18n.t;
    const ai = this.#ai;
    const doc = state.doc;
    const aiMode = this.#shown === 'ai' && !!ai;
    const aiSidebar = this.#slot('aiSidebar', aiMode, () => {
      const sidebar = el('hmd-ai-sidebar', {
        on: { 'hmd-ai-manage': () => this.#openSettings('ai-profiles'), 'hmd-ai-sync-reactivate': () => this.#openSettings('ai-sync') },
      });
      sidebar.getSelection = () => {
        const selected = this.#session.selection?.main;
        return selected && !selected.empty ? { from: selected.from, to: selected.to, originalText: this.#session.textLf.slice(selected.from, selected.to), status: 'valid' } : undefined;
      };
      return sidebar;
    });
    if (aiSidebar && ai) {
      assign(aiSidebar, 'controller', ai);
      assign(aiSidebar, 'text', doc?.text ?? '');
      assign(aiSidebar, 'selection', this.#aiSelection);
      assign(aiSidebar, 'syncNeedsPermission', !!this.#sync?.needsPermission);
      assign(aiSidebar, 'i18n', i18n);
      place(aside, [aiSidebar]);
      for (const name of ['treeHeader', 'search', 'orphans', 'tree'] as const) delete this.#slots[name];
      return;
    }
    const header = this.#slot('treeHeader', true, () =>
      el(
        'div',
        { class: 'sidebarHeader' },
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#setSidebar(false) } }, icon('sidebarClose')),
        el('button', { class: 'folder tooltip', on: { click: () => emit(this, 'hmd-workspace-change-folder', null) } }),
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#onTreeAction('new-file', null) } }, icon('newFile')),
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#onTreeAction('new-folder', null) } }, icon('newFolder')),
      ),
    )!;
    const [hide, folder, newFile, newFolder] = [...header.children] as HTMLButtonElement[];
    for (const [button, label] of [[hide, t('sidebar.hide')], [newFile, t('file.new')], [newFolder, t('folder.new')]] as const) {
      toggleAttr(button, 'aria-label', true, label);
      toggleAttr(button, 'data-tooltip', true, label);
    }
    setText(folder, state.name);
    folder.disabled = this.#switchingFolder;
    toggleAttr(folder, 'data-tooltip', true, t('sidebar.changeFolder'));
    const search = this.#slot('search', true, () => el('hmd-search-panel', { on: { 'hmd-search-open': (event) => void this.#openFile(event.detail.path, event.detail.terms) } }))!;
    assign(search, 'index', workspace.search);
    assign(search, 'indexRevision', state.indexRevision);
    assign(search, 'i18n', i18n);
    const orphans = this.#slot('orphans', this.#orphans.length > 0, () => el('section', { class: 'orphans' }, el('h2', { class: 'orphansTitle' })));
    if (orphans) this.#renderOrphans(orphans, doc?.path ?? null, t);
    else this.#orphanNodes.clear();
    const tree = this.#slot('tree', true, () =>
      el('hmd-file-tree', {
        on: { 'hmd-open': (event) => void this.#openFile(event.detail.path), 'hmd-tree-action': (event) => this.#onTreeAction(event.detail.action, event.detail.node) },
      }),
    )!;
    // Albero, file e bozze ricalcolati solo quando cambiano le voci (o la lingua), come gli useMemo di React.
    const memo = this.#memo;
    if (memo.treeEntries !== state.entries || memo.locale !== i18n.getState().locale) {
      memo.treeEntries = state.entries;
      memo.tree = buildTree(state.entries, i18n.getState().locale);
      memo.locale = i18n.getState().locale;
    }
    if (memo.drafts !== state.drafts) {
      memo.drafts = state.drafts;
      memo.draftSet = new Set(state.drafts);
    }
    assign(tree, 'nodes', memo.tree!);
    assign(tree, 'openPath', doc?.path ?? null);
    assign(tree, 'drafts', memo.draftSet!);
    assign(tree, 'i18n', i18n);
    place(aside, [header, search, ...(orphans ? [orphans] : []), tree]);
    delete this.#slots.aiSidebar;
  }

  #renderOrphans(section: HTMLElement, openPath: string | null, t: I18nStore['t']): void {
    toggleAttr(section, 'aria-label', true, t('orphans.title'));
    setText(section.firstElementChild!, t('orphans.title'));
    const nodes = new Map<string, HTMLButtonElement>();
    for (const path of this.#orphans) {
      const button = this.#orphanNodes.get(path) ?? el('button', { class: 'orphan tooltip', on: { click: () => void this.#openFile(path) } }, path);
      toggleAttr(button, 'aria-current', openPath === path, 'true');
      toggleAttr(button, 'data-tooltip', true, t('orphans.recover', { path }));
      nodes.set(path, button);
    }
    this.#orphanNodes = nodes;
    place(section, [section.firstElementChild!, ...nodes.values()]);
  }

  #files(state: WorkspaceState): string[] {
    const memo = this.#memo;
    if (memo.filesEntries !== state.entries || !memo.files) {
      memo.filesEntries = state.entries;
      memo.files = state.entries.filter((e) => e.kind === 'file').map((e) => e.path);
    }
    return memo.files;
  }

  #getDocs = () => this.#workspace!.search.titles();
  #readBlob = (path: string) => this.#workspace!.readBlob(path);
  #saveImage = (file: File) => this.#workspace!.saveImage(file, file.name);

  #renderReview(review: HmdAiReview, state: WorkspaceState, ai: AiController, i18n: I18nStore): void {
    const doc = state.doc!;
    assign(review, 'controller', ai);
    assign(review, 'i18n', i18n);
    // Un oggetto nuovo a ogni render, come con React: la revisione rilegge allora `canAccept`, che dipende anche dallo
    // stato dello workspace (un conflitto spegne gli «accetta» dei blocchi). Confrontare i campi la lascerebbe ferma.
    review.doc = {
      path: doc.path,
      text: doc.text,
      resetKey: docKey(doc),
      session: this.#session,
      restore: doc.restore,
      readOnly: state.updating,
      getDocs: this.#getDocs,
      saveImage: this.#saveImage,
      docChanged: this.#docChanged,
      selectionChanged: this.#selectionChanged,
    };
  }

  #docChanged = (changes: ChangeDesc, texts: { before: string; after: string }) => {
    const workspace = this.#workspace!;
    const path = workspace.getState().doc?.path;
    if (path) this.#ai?.documentChanged(path, changes, false, texts);
    workspace.edit(texts.after);
  };
  #selectionChanged = (range: TextRange | null) => this.#onSelection(range);

  #renderPanes(panes: HTMLDivElement, workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const t = i18n.t;
    const doc = state.doc!;
    const shown = this.#shown;
    toggleAttr(panes, 'data-mode', true, panesMode(shown, this.#historyOpen));
    const editorPane = this.#slot('editorPane', shown !== 'preview', () => el('section', { class: 'pane' }, this.#createEditor()));
    if (editorPane) {
      toggleAttr(editorPane, 'aria-label', true, t('pane.editor'));
      const editor = editorPane.firstElementChild as HmdEditor;
      assign(editor, 'text', doc.text);
      assign(editor, 'resetKey', docKey(doc));
      assign(editor, 'session', this.#session);
      assign(editor, 'restore', doc.restore);
      assign(editor, 'readOnly', state.updating);
      assign(editor, 'getDocs', this.#getDocs);
      assign(editor, 'saveImage', this.#saveImage);
      assign(editor, 'i18n', i18n);
    }
    // La cronologia è per file (la `key` di React): un file nuovo, un pannello nuovo.
    if (this.#historyOpen && this.#historyPath !== doc.path) delete this.#slots.historyPane;
    const historyPane = this.#slot('historyPane', this.#historyOpen, () =>
      el(
        'section',
        { class: 'pane' },
        el('hmd-history-panel', {
          on: {
            'hmd-history-restore': (event) => this.#restoreVersion(event.detail.id),
            'hmd-history-close': () => {
              this.#historyOpen = false;
              this.#loop.update();
            },
          },
        }),
      ),
    );
    if (historyPane) {
      this.#historyPath = doc.path;
      toggleAttr(historyPane, 'aria-label', true, t('toolbar.history'));
      const history = historyPane.firstElementChild as HmdHistoryPanel;
      assign(history, 'workspace', workspace);
      assign(history, 'path', doc.path);
      assign(history, 'currentText', doc.text);
      assign(history, 'i18n', i18n);
    }
    const previewPane = this.#slot('previewPane', !this.#historyOpen && shown !== 'editor', () =>
      el(
        'section',
        { class: 'pane' },
        el('hmd-preview', {
          on: {
            'hmd-top-line': (event) => {
              if (this.#shown === 'split') (this.#slots.editorPane?.firstElementChild as HmdEditor | undefined)?.scrollToLine(event.detail.line);
            },
            'hmd-open-wiki': (event) => {
              this.#highlight = NO_TERMS;
              this.#loop.update();
              void workspace.followWikiLink(event.detail.target);
            },
            'hmd-open': (event) => void this.#openFile(event.detail.path),
          },
        }),
      ),
    );
    if (previewPane) {
      toggleAttr(previewPane, 'aria-label', true, t('pane.preview'));
      const preview = previewPane.firstElementChild as HmdPreview;
      assign(preview, 'text', doc.text);
      assign(preview, 'path', doc.path);
      assign(preview, 'files', this.#files(state));
      assign(preview, 'config', state.config);
      assign(preview, 'readBlob', this.#readBlob);
      assign(preview, 'highlight', this.#highlight);
      assign(preview, 'i18n', i18n);
    }
    place(panes, [...(editorPane ? [editorPane] : []), ...(historyPane ? [historyPane] : previewPane ? [previewPane] : [])]);
  }

  #createSettings(): HmdSettings {
    return el('hmd-settings', {
      on: {
        'hmd-settings-section': (event) => this.#route?.navigate({ view: 'settings', section: event.detail.section }),
        'hmd-settings-close': () => this.#route?.navigate({ view: 'workspace' }),
        'hmd-settings-autosave': (event) => {
          writePref('autosave', event.detail.autosave);
          this.#workspace?.setAutosave(event.detail.autosave);
        },
        'hmd-settings-text-width': (event) => {
          writePref('textWidth', event.detail.textWidth);
          this.#textWidth = event.detail.textWidth;
          this.#applyTextWidth();
          this.#loop.update();
        },
        'hmd-settings-save-all': () => void this.#workspace?.saveAll(),
      },
    });
  }

  #renderSettings(settings: HmdSettings, state: WorkspaceState, i18n: I18nStore): void {
    const route = this.#route!.getState();
    if (route.view === 'settings') assign(settings, 'section', route.section);
    assign(settings, 'ai', this.#ai);
    assign(settings, 'syncBinding', this.#sync);
    assign(settings, 'theme', this.#theme);
    assign(settings, 'autosave', state.autosave);
    assign(settings, 'textWidth', this.#textWidth);
    assign(settings, 'i18n', i18n);
  }

  // Bozze nel buffer di emergenza di file spariti dal disco: senza questa lista non si ritroverebbero.
  #watchOrphans(workspace: Workspace, state: WorkspaceState): void {
    const key = [state.status, state.indexRevision, state.entries, state.drafts];
    if (key.every((v, i) => v === this.#orphanKey[i])) return;
    this.#orphanKey = key;
    const request = ++this.#orphanRequest;
    if (state.status !== 'ready') return;
    void workspace.orphanDrafts().then((paths) => {
      if (request !== this.#orphanRequest || !this.isConnected) return;
      this.#orphans = paths;
      this.#loop.update();
    });
  }

  /** Riapre l'ultimo file della cartella, una volta. */
  #reopen(workspace: Workspace, state: WorkspaceState): void {
    if (this.#reopened || state.status !== 'ready') return;
    this.#reopened = true;
    const plan = reopenPlan(readLastFile(this.#workspaceId), this.#files(state));
    // Dopo il render: aprire un file notifica, e una notifica dentro il render chiede solo un'altra passata.
    if (plan.kind === 'open') queueMicrotask(() => void this.#openFile(plan.path));
    else if (plan.kind === 'draft') {
      // Non scavalca un file che l'utente ha già aperto nel frattempo.
      void workspace.hasDraft(plan.path).then((has) => {
        if (has && !workspace.getState().doc && this.isConnected) void this.#openFile(plan.path);
      });
    }
  }

  /** Accesso perso: dialog bloccante finché il permesso non torna; se lo stato cambia per altre vie (o al distacco) si chiude. */
  #watchAccess(workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const lost = state.status === 'access-lost';
    if (lost === !!this.#accessLost) return;
    if (!lost) {
      this.#accessLost?.abort();
      this.#accessLost = null;
      return;
    }
    const controller = (this.#accessLost = new AbortController());
    const handle = this.#handle;
    // Dopo il render (come l'effetto di React): il dialog modale sposta il focus.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void showAccessLostDialog({
        folderName: state.name,
        t: i18n.t,
        signal: controller.signal,
        onResume: async () => {
          const granted = !!handle && (await requestAccess(handle));
          if (granted) await workspace.resume();
          return granted;
        },
      });
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-workspace': HmdWorkspace;
  }
}
