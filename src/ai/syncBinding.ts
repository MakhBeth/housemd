import { hasAccess, pickFolder, requestAccess } from '../fs/access';
import { fsaOps } from '../fs/fsaOps';
import type { AiController } from './aiController';
import { AiSync, type AiSyncState } from './aiSync';
import type { AiStores } from './stores';

/** Il servizio di sync di una cartella (AiSync), visto da chi lo collega al controller. */
export interface SyncService {
  getState(): AiSyncState;
  subscribe(listener: () => void): () => void;
  start(): void;
  localChanged(): void;
  dispose(): void;
}

/** Quello che la sync usa del controller AI. */
export interface SyncHost {
  readonly store: Pick<AiStores, 'getMeta' | 'setMeta'>;
  onSettingsChanged?: () => void;
  report(error: unknown): void;
  reload(): Promise<void>;
}

/** Permessi e servizio: iniettati, così lo store si prova senza File System Access API. */
export interface SyncBindingDeps {
  hasAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  requestAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  pickFolder(): Promise<FileSystemDirectoryHandle | null>;
  createSync(handle: FileSystemDirectoryHandle): SyncService;
}

export interface SyncBindingState {
  /** Il servizio attivo: solo con una cartella e il permesso. */
  sync: SyncService | null;
  handle: FileSystemDirectoryHandle | null;
  permission: boolean;
}

/**
 * Cartella di sync della configurazione AI (era l'hook della sezione React): la cartella salvata nei
 * meta del controller, il permesso, e il servizio di sync che esiste solo con entrambi. Il servizio si
 * ricrea quando cambiano cartella o permesso; un errore `syncPermission` toglie il permesso; a ogni fine
 * di sincronizzazione il controller ricarica profili e preset. Una sola istanza per controller, creata
 * da `hmd-workspace` e passata alla sidebar AI (riattivazione) e alle impostazioni.
 */
export class SyncBinding {
  #host: SyncHost;
  #deps: SyncBindingDeps;
  #state: SyncBindingState = { sync: null, handle: null, permission: false };
  #listeners = new Set<() => void>();
  #unsubscribe: (() => void) | null = null;
  #disposed = false;

  constructor(host: SyncHost, deps: SyncBindingDeps) {
    this.#host = host;
    this.#deps = deps;
    void host.store
      .getMeta<FileSystemDirectoryHandle>('folderHandle')
      .then(async (handle) => {
        if (this.#disposed || !handle) return;
        this.#set({ handle });
        const permission = await deps.hasAccess(handle);
        // Una cartella scelta o tolta nel frattempo vince sulla lettura dell'avvio.
        if (!this.#disposed && this.#state.handle === handle) this.#set({ permission });
      })
      .catch((error) => host.report(error));
  }

  getState = (): SyncBindingState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => void this.#listeners.delete(listener);
  };

  /** La cartella non ha più il permesso: la sidebar AI offre di riattivarlo. */
  get needsPermission(): boolean {
    return !!this.#state.handle && !this.#state.permission;
  }

  async choose(): Promise<void> {
    const handle = await this.#deps.pickFolder();
    if (!handle || this.#disposed) return;
    await this.#host.store.setMeta('folderHandle', handle);
    this.#set({ handle, permission: true });
  }

  async reactivate(): Promise<void> {
    const handle = this.#state.handle;
    if (!handle) return;
    const permission = await this.#deps.requestAccess(handle);
    if (!this.#disposed && this.#state.handle === handle) this.#set({ permission });
  }

  async disable(): Promise<void> {
    await this.#host.store.setMeta('folderHandle', null);
    if (!this.#disposed) this.#set({ handle: null });
  }

  dispose(): void {
    this.#disposed = true;
    this.#stop();
    this.#listeners.clear();
  }

  /** Lo stato si salva prima di notificare; il servizio segue cartella e permesso. */
  #set(patch: Partial<Omit<SyncBindingState, 'sync'>>): void {
    const before = this.#state;
    const next = { ...before, ...patch };
    if (next.handle === before.handle && next.permission === before.permission) return;
    this.#stop();
    this.#state = { ...next, sync: null };
    if (next.handle && next.permission) this.#start(next.handle);
    for (const listener of [...this.#listeners]) listener();
  }

  #start(handle: FileSystemDirectoryHandle): void {
    const host = this.#host;
    const service = this.#deps.createSync(handle);
    this.#state = { ...this.#state, sync: service };
    host.onSettingsChanged = () => service.localChanged();
    const off = service.subscribe(() => {
      if (service.getState().error === 'syncPermission') this.#set({ permission: false });
      if (service.getState().status !== 'syncing') void host.reload().catch((error) => host.report(error));
    });
    this.#unsubscribe = () => {
      host.onSettingsChanged = undefined;
      off();
      service.dispose();
    };
    service.start();
  }

  #stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }
}

/** La sync di un controller vero: permessi e cartella dalla File System Access API, servizio AiSync. */
export function browserSyncBinding(controller: AiController): SyncBinding {
  return new SyncBinding(controller, {
    hasAccess,
    requestAccess,
    pickFolder,
    createSync: (handle) => new AiSync({ store: controller.store, fs: fsaOps(handle) }),
  });
}
