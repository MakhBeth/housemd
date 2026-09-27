import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { Editor, type EditorHandle } from '../editor/Editor';
import { requestAccess } from '../fs/access';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { dirname, joinPath } from '../lib/paths';
import { readPref, writePref } from '../lib/prefs';
import { Preview, type PreviewHandle } from '../preview/Preview';
import { useTheme } from '../theme/useTheme';
import type { SaveState, Workspace } from '../workspace/workspace';
import { ConfirmDialog } from './ConfirmDialog';
import { ConflictBar } from './ConflictBar';
import { FileTree, type TreeAction } from './FileTree';
import { HistoryPanel } from './HistoryPanel';
import { Icon } from './Icon';
import { NameDialog } from './NameDialog';
import { renameTaken } from './names';
import { SearchPanel } from './SearchPanel';
import { SettingsDialog } from './SettingsDialog';
import { shortcutFor } from './shortcuts';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Toasts } from './Toasts';
import { buildTree, type TreeNode } from './tree';
import { useWorkspaceState } from './useWorkspace';
import styles from './WorkspaceView.module.css';

type Mode = 'editor' | 'split' | 'preview';

const MODES: Array<{ id: Mode; label: MessageKey }> = [
  { id: 'editor', label: 'mode.editor' },
  { id: 'split', label: 'mode.split' },
  { id: 'preview', label: 'mode.preview' },
];

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
}

const NO_TERMS: string[] = [];

export function WorkspaceView({ workspace, workspaceId, handle, onChangeFolder }: Props) {
  const t = useT();
  const state = useWorkspaceState(workspace);
  const doc = state.doc;
  const [mode, setMode] = useState<Mode>(() => readPref<Mode>('mode', 'split'));
  const [sidebarOpen, setSidebarOpen] = useState(() => readPref('sidebarOpen', true));
  const [sidebarWidth, setSidebarWidth] = useState(() => clampWidth(readPref('sidebarWidth', 280)));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [highlight, setHighlight] = useState<string[]>(NO_TERMS);
  const [theme, setTheme] = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasDoc = doc !== null;
  useEffect(() => {
    if (!hasDoc) setHistoryOpen(false);
  }, [hasDoc]);
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reopened = useRef(false);
  const [orphans, setOrphans] = useState<string[]>([]);

  const tree = useMemo(() => buildTree(state.entries), [state.entries]);
  const files = useMemo(() => state.entries.filter((e) => e.kind === 'file').map((e) => e.path), [state.entries]);
  const getDocs = useCallback(() => workspace.search.titles(), [workspace]);
  const readBlob = useCallback((path: string) => workspace.readBlob(path), [workspace]);
  const dismissToast = useCallback((id: number) => workspace.dismissToast(id), [workspace]);

  const drafts = useMemo(() => new Set(state.drafts), [state.drafts]);

  const setSidebar = useCallback((open: boolean) => {
    setSidebarOpen(open);
    writePref('sidebarOpen', open);
  }, []);

  const changeMode = useCallback((next: Mode) => {
    setMode(next);
    writePref('mode', next);
  }, []);

  const openFile = useCallback(
    (path: string, terms: string[] = NO_TERMS) => {
      setHighlight(terms);
      void workspace.openFile(path);
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
      openFile(last);
      return;
    }
    // Il file non c'è più su disco, ma se ha una bozza nel buffer di emergenza lo si riapre lo
    // stesso: è l'unica strada per recuperarla, visto che non compare nell'albero dei file. Niente
    // cleanup che annulli la promessa (reopened.current impedirebbe di riprovare): basta non
    // scavalcare un file che l'utente ha già aperto nel frattempo.
    void workspace.hasDraft(last).then((has) => {
      if (has && !workspace.getState().doc) openFile(last);
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
      const { doc: current, drafts: pending } = workspace.getState();
      if ((current && current.saveState !== 'saved') || pending.length > 0) {
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
  }, [workspace]);

  // Scorciatoie globali: vedi src/ui/shortcuts.ts.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      event.preventDefault();
      switch (shortcut) {
        case 'save':
          void workspace.saveNow();
          break;
        case 'saveAll':
          void workspace.saveAll();
          break;
        case 'search':
          setSidebar(true);
          requestAnimationFrame(() => searchRef.current?.focus());
          break;
        case 'toggleSidebar':
          setSidebar(!sidebarOpen);
          break;
        case 'cycleMode':
          changeMode(MODES[(MODES.findIndex((m) => m.id === mode) + 1) % MODES.length].id);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [workspace, mode, changeMode, setSidebar, sidebarOpen]);

  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let width = sidebarWidth;
    const move = (e: globalThis.PointerEvent) => {
      width = clampWidth(e.clientX);
      setSidebarWidth(width);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      target.removeEventListener('lostpointercapture', up);
      writePref('sidebarWidth', width);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('lostpointercapture', up);
  };

  const onResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = clampWidth(sidebarWidth + (event.key === 'ArrowLeft' ? -16 : 16));
    setSidebarWidth(next);
    writePref('sidebarWidth', next);
  };

  const onTreeAction = (action: TreeAction, node: TreeNode | null) => {
    if (action === 'history') {
      if (node) {
        openFile(node.path);
        setHistoryOpen(true);
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
    <div
      className={styles.layout}
      style={{ gridTemplateColumns: sidebarOpen ? `${sidebarWidth}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}
    >
      {sidebarOpen && (
        <>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <button className={styles.iconButton} onClick={() => setSidebar(false)} aria-label={t('sidebar.hide')} title={t('sidebar.hide')}>
                <Icon name="sidebarClose" />
              </button>
              <button className={styles.folder} onClick={onChangeFolder} title={t('sidebar.changeFolder')}>
                {state.name}
              </button>
              <button className={styles.iconButton} onClick={() => onTreeAction('new-file', null)} aria-label={t('file.new')} title={t('file.new')}>
                <Icon name="newFile" />
              </button>
              <button className={styles.iconButton} onClick={() => onTreeAction('new-folder', null)} aria-label={t('folder.new')} title={t('folder.new')}>
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
                    className={styles.orphan}
                    aria-current={doc?.path === path ? 'true' : undefined}
                    title={t('orphans.recover', { path })}
                    onClick={() => openFile(path)}
                  >
                    {path}
                  </button>
                ))}
              </section>
            )}
            <FileTree nodes={tree} openPath={doc?.path ?? null} drafts={drafts} onOpen={(path) => openFile(path)} onAction={onTreeAction} />
          </aside>
          <div
            className={styles.resizer}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('sidebar.resize')}
            aria-valuenow={sidebarWidth}
            aria-valuemin={MIN_SIDEBAR}
            aria-valuemax={MAX_SIDEBAR}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onKeyDown={onResizeKey}
          />
        </>
      )}

      <main className={styles.main}>
        <header className={styles.toolbar}>
          <button className={styles.iconButton} onClick={() => setSidebar(!sidebarOpen)} aria-pressed={sidebarOpen} aria-label={sidebarLabel} title={sidebarLabel}>
            <Icon name={sidebarOpen ? 'sidebarClose' : 'sidebarOpen'} />
          </button>
          <span className={styles.path}>{doc?.path ?? t('toolbar.noFile')}</span>
          <div className={styles.modes} role="group" aria-label={t('toolbar.modes')}>
            {MODES.map((m) => (
              <button key={m.id} className={styles.mode} aria-pressed={mode === m.id} onClick={() => changeMode(m.id)}>
                {t(m.label)}
              </button>
            ))}
          </div>
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
            className={styles.iconButton}
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-pressed={historyOpen}
            disabled={!doc}
            aria-label={t('toolbar.history')}
            title={t('toolbar.history')}
          >
            <Icon name="history" />
          </button>
          <button className={styles.iconButton} onClick={() => void workspace.saveAll()} aria-label={t('toolbar.saveAll')} title={t('toolbar.saveAll')}>
            <Icon name="save" />
          </button>
          <ThemeSwitcher theme={theme} onChange={setTheme} className={styles.iconButton} />
          <button className={styles.iconButton} onClick={() => setSettingsOpen(true)} aria-label={t('toolbar.settings')} title={t('toolbar.settings')}>
            <Icon name="settings" />
          </button>
        </header>

        {doc?.conflict && (
          <ConflictBar
            onReload={() => void workspace.resolveConflict('reload')}
            onOverwrite={() => void workspace.resolveConflict('overwrite')}
          />
        )}

        {doc ? (
          <div className={styles.panes} data-mode={historyOpen && mode === 'editor' ? 'split' : mode}>
            {mode !== 'preview' && (
              <section className={styles.pane} aria-label={t('pane.editor')}>
                <Editor
                  ref={editorRef}
                  text={doc.text}
                  resetKey={`${doc.path}#${doc.revision}`}
                  restore={doc.restore}
                  getDocs={getDocs}
                  onChange={(text) => workspace.edit(text)}
                  onImage={(file) => workspace.saveImage(file, file.name)}
                  onTopLine={(line) => {
                    if (mode === 'split') previewRef.current?.scrollToLine(line);
                  }}
                />
              </section>
            )}
            {historyOpen ? (
              <section className={styles.pane} aria-label={t('toolbar.history')}>
                <HistoryPanel key={doc.path} workspace={workspace} path={doc.path} currentText={doc.text} onClose={() => setHistoryOpen(false)} />
              </section>
            ) : (
              mode !== 'editor' && (
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
                      if (mode === 'split') editorRef.current?.scrollToLine(line);
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
          kind={dialog.node.kind}
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
        <SettingsDialog
          theme={theme}
          onTheme={setTheme}
          autosave={state.autosave}
          onAutosave={(next) => {
            writePref('autosave', next);
            workspace.setAutosave(next);
          }}
          onSaveAll={() => void workspace.saveAll()}
          onClose={() => setSettingsOpen(false)}
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

      <Toasts toasts={state.toasts} onDismiss={dismissToast} />
    </div>
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
