import { match } from 'ts-pattern';

import { switchFolder, switchGuard } from '../../app/switchFolder';
import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { StoredWorkspace } from '../../fs/handleStore';
import type { UpdateFlow } from '../../pwa/updateFlow';
import type { I18nStore } from '../../state/i18nStore';
import type { RouteStore } from '../../state/routeStore';
import type { ThemeStore } from '../../state/themeStore';
import type { Workspace } from '../../workspace/workspace';
import type { HmdNotice } from '../notice/notice.element';
import type { HmdStartScreen } from '../start-screen/start-screen.element';
import type { HmdUpdateNotice } from '../update-notice/update-notice.element';
import type { HmdWorkspace } from '../workspace/workspace.element';
import { browserAppDeps, type AppDeps } from './appDeps';
import { afterSwitch, type Screen as AppScreen } from './screens';
import './app.css';

type Screen = AppScreen<StoredWorkspace, Workspace>;

/**
 * Radice dell'app (era App.tsx): schermata iniziale (browser non supportato, prima apertura, ripresa
 * dell'accesso) o area di lavoro della cartella aperta, l'avviso di nuova versione e l'avviso del database
 * bloccato da un'altra scheda. Un cambio cartella (o una ripresa) alla volta; ogni apertura riuscita crea un
 * `hmd-workspace` nuovo (anche per la stessa cartella), così il suo stato non sopravvive. Gli store unici
 * (lingua, tema, rotta, aggiornamenti) arrivano da `main.ts` e scendono ai figli.
 */
export class HmdApp extends HmdElement {
  #updates: UpdateFlow | null = null;
  #i18n: I18nStore | null = null;
  #theme: ThemeStore | null = null;
  #route: RouteStore | null = null;
  #deps: AppDeps = browserAppDeps;

  #screen: Screen = { kind: 'boot' };
  #guard = switchGuard();
  #switching = false;
  #dbBlocked = false;
  #booted = false;
  #boot: AbortController | null = null;
  #start: HmdStartScreen | null = null;
  #workspace: HmdWorkspace | null = null;
  #updateNotice: HmdUpdateNotice | null = null;
  #notice: HmdNotice | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#updates && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#i18n!),
  });

  get updates(): UpdateFlow | null { return this.#updates; }
  set updates(value: UpdateFlow | null) { this.#updates = value ?? null; this.#loop.update(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) { this.#theme = value ?? null; this.#loop.update(); }
  get route(): RouteStore | null { return this.#route; }
  set route(value: RouteStore | null) { this.#route = value ?? null; this.#loop.update(); }
  /** Solo per i test: il browser finto. */
  set deps(value: AppDeps) { this.#deps = value; }
  /** Schermata corrente (per i test). */
  get screen(): Screen['kind'] { return this.#screen.kind; }

  protected connect(signal: AbortSignal): void {
    const deps = this.#deps;
    signal.addEventListener('abort', deps.onDbBlocked(() => this.#set({ dbBlocked: true })), { once: true });
    if (!this.#booted) {
      this.#booted = true;
      this.#startBoot(deps);
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#boot?.abort();
  }

  /** Avvio: la cartella salvata, riaperta se c'è ancora il permesso. Uno workspace aperto dopo il distacco si butta. */
  #startBoot(deps: AppDeps): void {
    if (!deps.isSupported()) return this.#show({ kind: 'unsupported' });
    const boot = (this.#boot = new AbortController());
    void (async () => {
      const stored = await deps.loadWorkspace().catch(() => null);
      if (boot.signal.aborted) return;
      if (!stored) return this.#show({ kind: 'start' });
      if (!(await deps.hasAccess(stored.handle))) {
        if (!boot.signal.aborted) this.#show({ kind: 'resume', stored });
        return;
      }
      const workspace = await deps.openWorkspace(stored);
      if (boot.signal.aborted) return workspace.dispose();
      this.#show({ kind: 'open', stored, workspace });
    })();
  }

  #set(patch: { dbBlocked?: boolean; switching?: boolean }): void {
    if (patch.dbBlocked !== undefined) this.#dbBlocked = patch.dbBlocked;
    if (patch.switching !== undefined) this.#switching = patch.switching;
    this.#loop.update();
  }

  /** Una schermata nuova; un'apertura riuscita vuole un hmd-workspace nuovo. Lo stato si salva prima del render. */
  #show(screen: Screen): void {
    if (screen.kind === 'open') this.#workspace = null;
    this.#screen = screen;
    this.#deps.setUpdateWorkspace(screen.kind === 'open' ? screen.workspace : null);
    this.#loop.update();
  }

  // Un cambio cartella (o ripresa dell'accesso) alla volta: ognuno cattura lo workspace aperto all'inizio.
  async #exclusive(task: () => Promise<void>): Promise<void> {
    if (this.#guard.active) return;
    this.#set({ switching: true });
    try {
      await this.#guard.run(task);
    } finally {
      this.#set({ switching: false });
    }
  }

  #choose(): void {
    const deps = this.#deps;
    void this.#exclusive(async () => {
      const screen = this.#screen;
      const current = screen.kind === 'open' ? screen.workspace : null;
      const result = await switchFolder({
        pick: () => deps.pickFolder(),
        current,
        open: async (handle: FileSystemDirectoryHandle) => {
          // Una cartella già aperta in passato tiene il suo workspaceId (bozze e ultimo file restano suoi).
          const workspaceId = (await deps.knownWorkspaceId(handle).catch(() => null)) ?? crypto.randomUUID();
          const stored: StoredWorkspace = { handle, workspaceId };
          return { stored, workspace: await deps.openWorkspace(stored) };
        },
        // Diventa la cartella salvata solo a cambio riuscito; se il salvataggio fallisce resta aperta lo stesso.
        persist: ({ stored }) => void deps.saveWorkspace(stored).catch(() => undefined),
        // La cartella vecchia non si è potuta lasciare: quella nuova, già caricata, si butta.
        discard: ({ workspace }) => workspace.dispose(),
      });
      match(afterSwitch(result, current !== null))
        .with({ kind: 'show' }, ({ screen: next }) => this.#show(next))
        .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
        .with({ kind: 'stay' }, () => {})
        .exhaustive();
    });
  }

  #resume(): void {
    const deps = this.#deps;
    void this.#exclusive(async () => {
      const screen = this.#screen;
      if (screen.kind !== 'resume') return;
      if (!(await deps.requestAccess(screen.stored.handle))) return;
      const workspace = await deps.openWorkspace(screen.stored);
      this.#show({ kind: 'open', stored: screen.stored, workspace });
    });
  }

  #render(i18n: I18nStore): void {
    const t = i18n.t;
    const screen = this.#screen;
    // La schermata iniziale resta lo stesso elemento tra le sue modalità (come il tag in App.tsx).
    const start = screen.kind === 'unsupported' || screen.kind === 'start' || screen.kind === 'resume';
    if (!start) this.#start = null;
    if (screen.kind !== 'open') this.#workspace = null;
    const content = match(screen)
      .with({ kind: 'boot' }, () => null)
      .with({ kind: 'unsupported' }, () => {
        const s = this.#startScreen(i18n);
        // Le proprietà che il ramo non passa tornano al default (React 19 le azzerava sullo stesso elemento).
        Object.assign(s, { mode: 'unsupported', reason: this.#deps.unsupportedReason(), error: undefined, folderName: '', busy: false });
        return s;
      })
      .with({ kind: 'start' }, ({ error }) => {
        const s = this.#startScreen(i18n);
        Object.assign(s, { mode: 'start', reason: undefined, error, folderName: '', busy: this.#switching });
        return s;
      })
      .with({ kind: 'resume' }, ({ stored }) => {
        const s = this.#startScreen(i18n);
        Object.assign(s, { mode: 'resume', reason: undefined, error: undefined, folderName: stored.handle.name, busy: this.#switching });
        return s;
      })
      .with({ kind: 'open' }, ({ stored, workspace }) => {
        const w = (this.#workspace ??= el('hmd-workspace', { on: { 'hmd-workspace-change-folder': () => this.#choose() } }));
        // Proprietà prima dell'inserimento (lo workspace legge le preferenze e apre la sessione AI collegandosi).
        if (w.workspace !== workspace) {
          w.workspaceId = stored.workspaceId;
          w.handle = stored.handle;
          w.i18n = i18n;
          w.theme = this.#theme;
          w.route = this.#route;
          w.workspace = workspace;
        }
        w.switchingFolder = this.#switching;
        return w;
      })
      .exhaustive();
    const update = (this.#updateNotice ??= el('hmd-update-notice'));
    if (update.flow !== this.#updates) update.flow = this.#updates;
    if (update.i18n !== i18n) update.i18n = i18n;
    if (this.#dbBlocked) {
      const notice = (this.#notice ??= el('hmd-notice', { on: { 'hmd-notice-dismiss': () => this.#set({ dbBlocked: false }) } }));
      notice.placement = 'top';
      notice.message = t('toast.reloadOtherTabs');
      notice.dismissLabel = t('toast.close');
      notice.dismissible = true;
    } else {
      this.#notice = null;
    }
    const wanted: Element[] = [...(content ? [content] : []), update, ...(this.#notice ? [this.#notice] : [])];
    for (const child of [...this.children]) if (!wanted.includes(child)) child.remove();
    let cursor: Element | null = this.firstElementChild;
    for (const node of wanted) {
      if (node === cursor) cursor = cursor.nextElementSibling;
      else this.insertBefore(node, cursor);
    }
  }

  #startScreen(i18n: I18nStore): HmdStartScreen {
    const s = (this.#start ??= el('hmd-start-screen', { on: { 'hmd-start-pick': () => this.#choose(), 'hmd-start-resume': () => this.#resume() } }));
    if (s.i18n !== i18n) s.i18n = i18n;
    return s;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-app': HmdApp;
  }
}
