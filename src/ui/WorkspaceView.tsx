import { useAiController } from './ai/useAiController';
import { useAiState } from './ai/useAiState';
import { createDocSession } from '../editor/docSession';
import { sameRange, type TextRange } from '../ai/selectionChip';
import { AiSidebar } from './ai/AiSidebar';
import { ReviewView } from './ai/ReviewView';
import { useAiSync } from './ai/settings/AiSyncSection';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { Editor, type EditorHandle } from '../editor/Editor';
import { requestAccess } from '../fs/access';
import { useI18n, useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { dirname, joinPath } from '../lib/paths';
import { readPref, readValidPref, writePref } from '../lib/prefs';
import { parseTextWidth, textWidthVars } from '../lib/textWidth';
import { APP_TITLE, pageTitle } from '../lib/pageTitle';
import type { SettingsSection } from '../lib/route';
import { Preview, type PreviewHandle } from '../preview/Preview';
import { useTheme } from '../theme/useTheme';
import type { SaveState, Workspace } from '../workspace/workspace';
import { ConfirmDialog } from './ConfirmDialog';
import { ConflictBar } from './ConflictBar';
import { FileTree, type TreeAction } from './FileTree';
import { HistoryPanel } from './HistoryPanel';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { NameDialog } from './NameDialog';
import { renameTaken } from './names';
import { SearchPanel } from './SearchPanel';
import { SettingsView } from './SettingsView';
import { useRoute } from './useRoute';
import { shortcutFor } from './shortcuts';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Toasts, type ToastItem } from './Toasts';
import { buildTree, type TreeNode } from './tree';
import { useWorkspaceState } from './useWorkspace';
import styles from './WorkspaceView.module.css';

type Mode = 'editor' | 'split' | 'preview' | 'ai';
type PaneMode = Exclude<Mode, 'ai'>;

const MODES: Array<{ id: Mode; label: MessageKey; icon: IconName }> = [
  { id: 'editor', label: 'mode.editor', icon: 'modeEditor' },
  { id: 'split', label: 'mode.split', icon: 'modeSplit' },
  { id: 'preview', label: 'mode.preview', icon: 'modePreview' },
  { id: 'ai', label: 'mode.ai', icon: 'modeAi' },
];
/** Ctrl+\ scorre solo le viste del documento, non la revisione AI. */
const PANE_MODES = MODES.filter((m) => m.id !== 'ai');

const SAVE_LABEL: Record<SaveState, MessageKey> = {
  saved: 'save.saved',
  dirty: 'save.dirty',
  saving: 'save.saving',
  error: 'save.error',
};

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 480;
const clampWidth = (w: number) => Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, Math.round(w)));

type DialogState =
  | { kind: 'new-file' | 'new-folder'; dir: string }
  | { kind: 'rename' | 'delete'; node: TreeNode }
  | null;

interface Props {
  workspace: Workspace;
  workspaceId: string;
  handle: FileSystemDirectoryHandle;
  onChangeFolder: () => void;
  /** Cambio cartella in corso: il pulsante della cartella resta disattivato finché non finisce. */
  switchingFolder?: boolean;
}

const NO_TERMS: string[] = [];

export function WorkspaceView({ workspace, workspaceId, handle, onChangeFolder, switchingFolder = false }: Props) {
  const { t, locale } = useI18n();
  const state = useWorkspaceState(workspace);
  const doc = state.doc;
  const ai = useAiController(workspace);
  const aiState = useAiState(ai);
  const [aiWidth, setAiWidth] = useState(() => Math.min(640, Math.max(300, readPref('aiSidebarWidth', 380))));
  const session = useMemo(() => createDocSession(`${doc?.path}#${doc?.revision}`, doc?.text || ''), [doc?.path, doc?.revision]);
  const [aiSelection, setAiSelection] = useState<TextRange | null>(null);
  // onSelection scatta a ogni movimento del cursore: si aggiorna lo stato solo se il tratto cambia.
  const onSelection = useCallback((range: TextRange | null) => setAiSelection((prev) => (sameRange(prev, range) ? prev : range)), []);
  useEffect(() => setAiSelection(null), [doc?.path, doc?.revision]);
  const syncBinding = useAiSync(ai);
  useEffect(() => { if (doc) ai?.documentChanged(doc.path, { iterChangedRanges: () => {}, mapPos: (n: number) => n } as never, true); }, [doc?.path, doc?.revision]);
  const [mode, setMode] = useState<Mode>(() => readPref<Mode>('mode', 'split'));
  // Preferenza 'ai' con il controller non ancora pronto (IndexedDB lento): intanto la vista divisa.
  const shownMode: Mode = mode === 'ai' && !ai ? 'split' : mode;
  const lastPane = useRef<PaneMode>(mode === 'ai' ? 'split' : mode);
  const [sidebarOpen, setSidebarOpen] = useState(() => readPref('sidebarOpen', true));
  const [sidebarWidth, setSidebarWidth] = useState(() => clampWidth(readPref('sidebarWidth', 280)));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [highlight, setHighlight] = useState<string[]>(NO_TERMS);
  const [theme, setTheme] = useTheme();
  const [textWidth, setTextWidth] = useState(() => readValidPref('textWidth', parseTextWidth));
  useEffect(() => {
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(textWidthVars(textWidth))) root.setProperty(name, value);
  }, [textWidth]);
  const settingsDirty = useRef(false);
  const [closeRequest, setCloseRequest] = useState(0);
  const { route, navigate } = useRoute({ canLeave: () => !settingsDirty.current, onBlocked: () => setCloseRequest((n) => n + 1) });
  const onSettingsDirty = useCallback((dirty: boolean) => {
    settingsDirty.current = dirty;
  }, []);
  const settingsOpen = route.view === 'settings';
  // Titolo della scheda; smontando (ritorno alla schermata iniziale) torna il nome dell'app.
  useEffect(() => {
    document.title = pageTitle({ settings: settingsOpen, filePath: doc?.path }, t('settings.title'));
  }, [settingsOpen, doc?.path, t]);
  useEffect(() => () => { document.title = APP_TITLE; }, []);
  // Elemento col focus prima di aprire le impostazioni: alla chiusura il focus torna lì.
  const focusBeforeSettings = useRef<HTMLElement | null>(null);
  const openSettings = useCallback(
    (section: SettingsSection = 'general') => {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) focusBeforeSettings.current = document.activeElement;
      navigate({ view: 'settings', section });
    },
    [navigate],
  );
  useEffect(() => {
    if (settingsOpen) return;
    const previous = focusBeforeSettings.current;
    focusBeforeSettings.current = null;
    if (previous?.isConnected) previous.focus();
  }, [settingsOpen]);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Ripristino chiesto in modalità anteprima: parte appena l'editor è montato. */
  const [queuedRestore, setQueuedRestore] = useState<{ id: number; path: string } | null>(null);
  const hasDoc = doc !== null;
  useEffect(() => {
    if (!hasDoc) setHistoryOpen(false);
  }, [hasDoc]);
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reopened = useRef(false);
  const [orphans, setOrphans] = useState<string[]>([]);

  const tree = useMemo(() => buildTree(state.entries, locale), [state.entries, locale]);
  const files = useMemo(() => state.entries.filter((e) => e.kind === 'file').map((e) => e.path), [state.entries]);
  const getDocs = useCallback(() => workspace.search.titles(), [workspace]);
  const readBlob = useCallback((path: string) => workspace.readBlob(path), [workspace]);
  const toastItems = useMemo<ToastItem[]>(
    () => [
      ...state.toasts.map((toast) => ({ key: `ws-${toast.id}`, kind: toast.kind, text: t(`toast.${toast.code}`, toast.params) })),
      // Errori AI non legati a un messaggio (sync, chiave, selezione persa): stesso contenitore dei toast.
      ...(aiState?.error ? [{ key: 'ai-error', kind: 'error' as const, text: t(`ai.error.${aiState.error}` as MessageKey) }] : []),
    ],
    [state.toasts, aiState?.error, t],
  );
  const dismissToast = useCallback(
    (key: string) => {
      if (key === 'ai-error') ai?.clearError();
      else workspace.dismissToast(Number(key.slice('ws-'.length)));
    },
    [workspace, ai],
  );

  const drafts = useMemo(() => new Set(state.drafts), [state.drafts]);

  const setSidebar = useCallback((open: boolean) => {
    setSidebarOpen(open);
    writePref('sidebarOpen', open);
  }, []);

  const changeMode = useCallback(
    (next: Mode) => {
      if (next !== 'ai') lastPane.current = next;
      // La chat sta nella sidebar: entrando in AI la si apre.
      else setSidebar(true);
      setMode(next);
      writePref('mode', next);
    },
    [setSidebar],
  );

  // Il ripristino deve passare dall'editor come transazione (annullabile con Ctrl+Z): in sola
  // anteprima l'editor non c'è, quindi si passa alla vista affiancata e si ripristina solo dopo.
  const restoreVersion = useCallback(
    (id: number) => {
      const path = workspace.getState().doc?.path;
      if (!path) return;
      if (shownMode !== 'preview') {
        void workspace.restoreVersion(id);
        return;
      }
      setQueuedRestore({ id, path });
      changeMode('split');
    },
    [workspace, shownMode, changeMode],
  );

  useEffect(() => {
    if (!queuedRestore || shownMode === 'preview' || !editorRef.current) return;
    setQueuedRestore(null);
    // Nel frattempo si è passati a un altro file: quella versione non riguarda più il documento.
    if (doc?.path === queuedRestore.path) void workspace.restoreVersion(queuedRestore.id);
  }, [queuedRestore, shownMode, doc?.path, workspace]);

  const openFile = useCallback(
    (path: string, terms: string[] = NO_TERMS) => {
      setHighlight(terms);
      return workspace.openFile(path);
    },
    [workspace],
  );

  // Bozze nel buffer di emergenza di file spariti dal disco: senza questa lista non avrebbero
  // modo di essere ritrovate, visto che non compaiono nell'albero dei file.
  useEffect(() => {
    if (state.status !== 'ready') return;
    let alive = true;
    void workspace.orphanDrafts().then((paths) => {
      if (alive) setOrphans(paths);
    });
    return () => {
      alive = false;
    };
  }, [workspace, state.status, state.indexRevision, state.entries, state.drafts]);

  // Riapre l'ultimo file della cartella.
  useEffect(() => {
    if (reopened.current || state.status !== 'ready') return;
    reopened.current = true;
    const last = readPref<string | null>(`lastFile:${workspaceId}`, null);
    if (!last) return;
    if (files.includes(last)) {
      void openFile(last);
      return;
    }
    // Il file non c'è più su disco, ma se ha una bozza nel buffer di emergenza lo si riapre lo
    // stesso: è l'unica strada per recuperarla, visto che non compare nell'albero dei file. Niente
    // cleanup che annulli la promessa (reopened.current impedirebbe di riprovare): basta non
    // scavalcare un file che l'utente ha già aperto nel frattempo.
    void workspace.hasDraft(last).then((has) => {
      if (has && !workspace.getState().doc) void openFile(last);
    });
  }, [state.status, files, openFile, workspace, workspaceId]);

  useEffect(() => {
    if (doc) writePref(`lastFile:${workspaceId}`, doc.path);
  }, [doc?.path, workspaceId]);

  // Finestra in primo piano → controlla le modifiche esterne; in secondo piano → salva o mette nel
  // buffer secondo la modalità di autosave (Workspace.blur).
  useEffect(() => {
    const onFocus = () => void workspace.checkExternal();
    const onBlur = () => void workspace.blur();
    const onVisibility = () => (document.visibilityState === 'visible' ? onFocus() : onBlur());
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Reload protetto dell'aggiornamento PWA: solo quando beginUpdate ha già reso tutto durevole
      // niente "Esci dal sito?" (annullarlo lascerebbe l'app bloccata in sola lettura). Mentre il
      // documento si sta ancora mettendo al sicuro l'avviso resta: il testo è solo in memoria.
      if (workspace.getState().updateReady && !ai?.hasPendingWork()) return;
      const { doc: current, drafts: pending } = workspace.getState();
      if ((current && current.saveState !== 'saved') || pending.length > 0 || ai?.hasPendingWork()) {
        void workspace.blur();
        event.preventDefault();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [workspace, ai]);

  // Scorciatoie globali: vedi src/ui/shortcuts.ts.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && shownMode === 'ai' && !settingsOpen) ai?.stop();
      // Già gestito dall'editor (Ctrl+B è il grassetto lì, la barra laterale altrove).
      if (event.defaultPrevented) return;
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      // Con le impostazioni aperte restano solo i salvataggi (altrimenti Ctrl+S apre "Salva pagina").
      if (settingsOpen && shortcut !== 'save' && shortcut !== 'saveAll') return;
      event.preventDefault();
      switch (shortcut) {
        case 'save':
          void workspace.saveNow();
          break;
        case 'saveAll':
          void workspace.saveAll();
          break;
        case 'search':
          if (shownMode === 'ai') changeMode(lastPane.current);
          setSidebar(true);
          requestAnimationFrame(() => searchRef.current?.focus());
          break;
        case 'toggleAi':
          if (ai) changeMode(shownMode === 'ai' ? lastPane.current : 'ai');
          break;
        case 'toggleSidebar':
          setSidebar(!sidebarOpen);
          break;
        case 'cycleMode':
          changeMode(PANE_MODES[(PANE_MODES.findIndex((m) => m.id === shownMode) + 1) % PANE_MODES.length].id);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [workspace, shownMode, changeMode, setSidebar, sidebarOpen, ai, settingsOpen]);

  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let width = shownMode === 'ai' ? aiWidth : sidebarWidth;
    const move = (e: globalThis.PointerEvent) => {
      width = shownMode === 'ai' ? Math.min(640, Math.max(300, e.clientX)) : clampWidth(e.clientX);
      if (shownMode === 'ai') setAiWidth(width); else setSidebarWidth(width);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      target.removeEventListener('lostpointercapture', up);
      writePref(shownMode === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', width);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('lostpointercapture', up);
  };

  const onResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = shownMode === 'ai' ? Math.min(640, Math.max(300, aiWidth + (event.key === 'ArrowLeft' ? -16 : 16))) : clampWidth(sidebarWidth + (event.key === 'ArrowLeft' ? -16 : 16));
    if (shownMode === 'ai') setAiWidth(next); else setSidebarWidth(next);
    writePref(shownMode === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', next);
  };

  const onTreeAction = (action: TreeAction, node: TreeNode | null) => {
    if (action === 'history') {
      if (node) {
        // La cronologia si apre solo se il file richiesto è davvero quello aperto: l'apertura può
        // fallire o essere scavalcata da un'altra, e il pannello mostrerebbe il documento sbagliato.
        void openFile(node.path).then(() => {
          if (workspace.getState().doc?.path === node.path) setHistoryOpen(true);
        });
      }
      return;
    }
    if (action === 'new-file' || action === 'new-folder') {
      const dir = node ? (node.kind === 'directory' ? node.path : dirname(node.path)) : '';
      setDialog({ kind: action, dir });
    } else if (node) {
      setDialog({ kind: action, node });
    }
  };

  const exists = (path: string) => state.entries.some((e) => e.path.toLowerCase() === path.toLowerCase());
  const taken = t('name.error.taken');
  const sidebarLabel = sidebarOpen ? t('sidebar.hide') : t('sidebar.show');

  return (
    <>
    <div
      {...{ inert: settingsOpen ? '' : undefined }}
      className={styles.layout}
      style={{ gridTemplateColumns: sidebarOpen ? `${shownMode === 'ai' ? aiWidth : sidebarWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}
    >
      {sidebarOpen && (
        <>
          <aside className={styles.sidebar}>
            {shownMode === 'ai' && ai ? <AiSidebar
              controller={ai}
              text={doc?.text ?? ''}
              selection={aiSelection}
              getSelection={() => {
                const selected = session.selection?.main;
                return selected && !selected.empty
                  ? { from: selected.from, to: selected.to, originalText: session.textLf.slice(selected.from, selected.to), status: 'valid' }
                  : undefined;
              }}
              onSettings={openSettings}
              syncNeedsPermission={!!syncBinding.handle && !syncBinding.permission}
            /> : <>
            <div className={styles.sidebarHeader}>
              <button className={`${styles.iconButton} tooltip`} onClick={() => setSidebar(false)} aria-label={t('sidebar.hide')} data-tooltip={t('sidebar.hide')}>
                <Icon name="sidebarClose" />
              </button>
              <button className={`${styles.folder} tooltip`} onClick={onChangeFolder} disabled={switchingFolder} data-tooltip={t('sidebar.changeFolder')}>
                {state.name}
              </button>
              <button className={`${styles.iconButton} tooltip`} onClick={() => onTreeAction('new-file', null)} aria-label={t('file.new')} data-tooltip={t('file.new')}>
                <Icon name="newFile" />
              </button>
              <button className={`${styles.iconButton} tooltip`} onClick={() => onTreeAction('new-folder', null)} aria-label={t('folder.new')} data-tooltip={t('folder.new')}>
                <Icon name="newFolder" />
              </button>
            </div>
            <SearchPanel ref={searchRef} index={workspace.search} indexRevision={state.indexRevision} onOpen={openFile} />
            {orphans.length > 0 && (
              <section className={styles.orphans} aria-label={t('orphans.title')}>
                <h2 className={styles.orphansTitle}>{t('orphans.title')}</h2>
                {orphans.map((path) => (
                  <button
                    key={path}
                    className={`${styles.orphan} tooltip`}
                    aria-current={doc?.path === path ? 'true' : undefined}
                    data-tooltip={t('orphans.recover', { path })}
                    onClick={() => openFile(path)}
                  >
                    {path}
                  </button>
                ))}
              </section>
            )}
            <FileTree nodes={tree} openPath={doc?.path ?? null} drafts={drafts} onOpen={(path) => openFile(path)} onAction={onTreeAction} />
            </>}
          </aside>
          <div
            className={styles.resizer}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('sidebar.resize')}
            aria-valuenow={shownMode === 'ai' ? aiWidth : sidebarWidth}
            aria-valuemin={shownMode === 'ai' ? 300 : MIN_SIDEBAR}
            aria-valuemax={shownMode === 'ai' ? 640 : MAX_SIDEBAR}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onKeyDown={onResizeKey}
          />
        </>
      )}

      <main className={styles.main}>
        <header className={styles.toolbar}>
          <div className={styles.lead}>
            <button className={`${styles.iconButton} tooltip`} onClick={() => setSidebar(!sidebarOpen)} aria-pressed={sidebarOpen} aria-label={sidebarLabel} data-tooltip={sidebarLabel}>
              <Icon name={sidebarOpen ? 'sidebarClose' : 'sidebarOpen'} />
            </button>
            <span className={styles.path}>{doc?.path ?? t('toolbar.noFile')}</span>
          </div>
          <div className={styles.modes} role="group" aria-label={t('toolbar.modes')}>
            {(ai ? MODES : PANE_MODES).map((m) => (
              <button
                key={m.id}
                className={`${styles.mode} tooltip`}
                aria-pressed={shownMode === m.id}
                aria-label={t(m.label)}
                data-tooltip={t(m.label)}
                onClick={() => changeMode(m.id)}
              >
                <Icon name={m.icon} />
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <span
              className={styles.saveState}
              data-state={doc?.saveState ?? 'none'}
              aria-live={doc?.saveState === 'error' ? 'assertive' : 'polite'}
              role={doc?.saveState === 'error' ? 'alert' : undefined}
            >
              {doc?.saveState === 'dirty' && !doc.deletedOnDisk && <Icon name="draft" size={10} />}
              {doc ? (doc.deletedOnDisk ? t('save.deleted') : t(SAVE_LABEL[doc.saveState])) : ''}
            </span>
            <button
              className={`${styles.iconButton} tooltip`}
              onClick={() => { if (shownMode === 'ai') changeMode(lastPane.current); setHistoryOpen(shownMode === 'ai' ? true : !historyOpen); }}
              aria-pressed={shownMode !== 'ai' && historyOpen}
              disabled={!doc}
              aria-label={t('toolbar.history')}
              data-tooltip={t('toolbar.history')}
            >
              <Icon name="history" />
            </button>
            <button className={`${styles.iconButton} tooltip`} onClick={() => void workspace.saveAll()} aria-label={t('toolbar.saveAll')} data-tooltip={t('toolbar.saveAll')}>
              <Icon name="save" />
            </button>
            <ThemeSwitcher theme={theme} onChange={setTheme} className={`${styles.iconButton} tooltip`} />
            <button className={`${styles.iconButton} tooltip`} onClick={() => openSettings()} aria-label={t('toolbar.settings')} data-tooltip={t('toolbar.settings')}>
              <Icon name="settings" />
            </button>
          </div>
        </header>

        {doc?.conflict && (
          <ConflictBar
            onReload={() => void workspace.resolveConflict('reload')}
            onOverwrite={() => void workspace.resolveConflict('overwrite')}
          />
        )}

        {doc && shownMode === 'ai' && ai ? <ReviewView controller={ai} editor={{ path: doc.path, text: doc.text, resetKey: `${doc.path}#${doc.revision}`, session, restore: doc.restore, readOnly: state.updating, getDocs, onChange: text => workspace.edit(text), onTransactions: (changes, texts) => ai.documentChanged(doc.path, changes, false, texts), onImage: file => workspace.saveImage(file, file.name), onTopLine: () => {}, onSelection }} /> : doc ? (
          <div className={styles.panes} data-mode={historyOpen && shownMode === 'editor' ? 'split' : shownMode}>
            {shownMode !== 'preview' && (
              <section className={styles.pane} aria-label={t('pane.editor')}>
                <Editor
                  ref={editorRef}
                  session={session}
                  onTransactions={(changes, texts) => ai?.documentChanged(doc.path, changes, false, texts)}
                  text={doc.text}
                  resetKey={`${doc.path}#${doc.revision}`}
                  restore={doc.restore}
                  readOnly={state.updating}
                  getDocs={getDocs}
                  onChange={(text) => workspace.edit(text)}
                  onImage={(file) => workspace.saveImage(file, file.name)}
                  onTopLine={(line) => {
                    if (shownMode === 'split') previewRef.current?.scrollToLine(line);
                  }}
                  onSelection={onSelection}
                />
              </section>
            )}
            {historyOpen ? (
              <section className={styles.pane} aria-label={t('toolbar.history')}>
                <HistoryPanel
                  key={doc.path}
                  workspace={workspace}
                  path={doc.path}
                  currentText={doc.text}
                  onRestore={restoreVersion}
                  onClose={() => setHistoryOpen(false)}
                />
              </section>
            ) : (
              shownMode !== 'editor' && (
                <section className={styles.pane} aria-label={t('pane.preview')}>
                  <Preview
                    ref={previewRef}
                    text={doc.text}
                    path={doc.path}
                    files={files}
                    config={state.config}
                    readBlob={readBlob}
                    highlight={highlight}
                    onTopLine={(line) => {
                      if (shownMode === 'split') editorRef.current?.scrollToLine(line);
                    }}
                    onOpenWiki={(target) => {
                      setHighlight(NO_TERMS);
                      void workspace.followWikiLink(target);
                    }}
                    onOpenPath={(path) => openFile(path)}
                  />
                </section>
              )
            )}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>{t('empty.hint')}</p>
            <button className={styles.primary} onClick={() => onTreeAction('new-file', null)}>
              {t('file.new')}
            </button>
          </div>
        )}
      </main>
    </div>

      {dialog && (dialog.kind === 'new-file' || dialog.kind === 'new-folder') && (
        <NameDialog
          title={dialog.kind === 'new-file' ? t('file.new') : t('folder.new')}
          kind={dialog.kind === 'new-file' ? 'file' : 'directory'}
          initial=""
          confirmLabel={t('dialog.create')}
          validate={(name) => (exists(joinPath(dialog.dir, name)) ? taken : null)}
          onSubmit={(name) => {
            const path = joinPath(dialog.dir, name);
            setDialog(null);
            void (dialog.kind === 'new-file' ? workspace.createFile(path) : workspace.createFolder(path));
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          title={t('dialog.rename.title', { name: dialog.node.name })}
          kind={dialog.node.kind === 'directory' ? 'directory' : 'file'}
          initial={dialog.node.name}
          confirmLabel={t('dialog.rename.confirm')}
          validate={(name) => {
            const to = joinPath(dirname(dialog.node.path), name);
            const paths = state.entries.map((e) => e.path);
            return renameTaken(dialog.node.path, to, paths) ? taken : null;
          }}
          onSubmit={(name) => {
            const to = joinPath(dirname(dialog.node.path), name);
            setDialog(null);
            void workspace.rename(dialog.node.path, to);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={t('dialog.delete.title', { name: dialog.node.name })}
          message={dialog.node.kind === 'directory' ? t('dialog.delete.folder') : t('dialog.delete.file')}
          confirmLabel={t('dialog.delete.confirm')}
          onConfirm={() => {
            const path = dialog.node.path;
            setDialog(null);
            void workspace.remove(path);
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {settingsOpen && (
        <SettingsView
          section={route.section}
          onSection={(section) => navigate({ view: 'settings', section })}
          onClose={() => navigate({ view: 'workspace' })}
          onDirtyChange={onSettingsDirty}
          closeRequest={closeRequest}
          ai={ai}
          syncBinding={syncBinding}
          theme={theme}
          onTheme={setTheme}
          autosave={state.autosave}
          onAutosave={(next) => {
            writePref('autosave', next);
            workspace.setAutosave(next);
          }}
          textWidth={textWidth}
          onTextWidth={(next) => {
            writePref('textWidth', next);
            setTextWidth(next);
          }}
          onSaveAll={() => void workspace.saveAll()}
        />
      )}

      {state.status === 'access-lost' && (
        <AccessLostDialog
          folderName={state.name}
          onResume={async () => {
            const granted = await requestAccess(handle);
            if (granted) await workspace.resume();
            return granted;
          }}
        />
      )}

      <Toasts items={toastItems} onDismiss={dismissToast} />
    </>
  );
}

/** Nessun modo per l'utente di chiudere il dialog: niente Esc, niente clic sul backdrop. */
const noDismiss = { closedby: 'none' } as Record<string, string>;

/** Dialog bloccante: l'accesso va ripreso con un clic (Chrome richiede un gesto dell'utente). */
function AccessLostDialog({ folderName, onResume }: { folderName: string; onResume: () => Promise<boolean> }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      mounted.current = false;
      dialog.close();
    };
  }, []);

  const resume = async () => {
    setDenied(false);
    try {
      const granted = await onResume();
      if (!granted) setDenied(true);
    } catch {
      setDenied(true);
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.accessDialog}
      {...noDismiss}
      onCancel={(e) => e.preventDefault()}
      onClose={() => {
        // closedby="none" dovrebbe già impedire ogni chiusura non voluta; questo è solo un
        // ripiego, mentre il componente resta montato, contro un'eventuale chiusura sfuggita.
        // Come in NameDialog/ConfirmDialog, si ignora l'evento "fantasma" di StrictMode: se il
        // dialog risulta già riaperto, chiamare di nuovo showModal() lancerebbe InvalidStateError.
        if (mounted.current && !ref.current?.open) ref.current?.showModal();
      }}
      aria-labelledby="access-title"
    >
      <h2 id="access-title">{t('access.title')}</h2>
      <p>{t('access.body', { folder: folderName })}</p>
      {denied && <p className={styles.accessError}>{t('access.denied')}</p>}
      <button className={styles.primary} onClick={resume}>
        {t('access.resume')}
      </button>
    </dialog>
  );
}
