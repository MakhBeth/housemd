import type { AiController } from '../../ai/aiController';
import type { SyncBinding, SyncService } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import { showChildren } from './fields';
import './sections.css';

/** Quello che la sezione della sync usa del controller. */
export type SyncController = Pick<AiController, 'report' | 'reload'>;
/** Il servizio di sync visto dalla sezione: stato, sincronizzazione e backup. */
export type SyncDetailsService = SyncService & Pick<import('../../ai/aiSync').AiSync, 'syncNow' | 'listBackups' | 'backupCounts' | 'restore'>;

interface Parts {
  root: HTMLDivElement;
  notice: HTMLParagraphElement;
  actions: HTMLDivElement;
  choose: HTMLButtonElement;
  folder: HTMLSpanElement;
  disable: HTMLButtonElement;
  reactivate: HTMLButtonElement;
  status: HTMLParagraphElement;
  error: HTMLParagraphElement;
  conflicts: HTMLParagraphElement;
  syncActions: HTMLDivElement;
  syncNow: HTMLButtonElement;
  backups: HTMLDetailsElement;
  backupsSummary: HTMLElement;
}

/**
 * Sezione della sync nelle impostazioni (era un componente React): scegliere, disattivare o riattivare la
 * cartella di sync (`SyncBinding`), e con il servizio attivo il suo stato, «Sincronizza ora» e i backup.
 * L'elenco dei backup si chiede a ogni sincronizzazione finita; una risposta superata si scarta. Un
 * ripristino alla volta, con la conferma che dice quanti profili e preset contiene.
 */
export class HmdSettingsSync extends HmdElement {
  #controller: SyncController | null = null;
  #binding: SyncBinding | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Il servizio a cui si è iscritti e la sua iscrizione. */
  #sync: { service: SyncService; off: () => void } | null = null;
  #backups: string[] = [];
  #backupNodes = new Map<string, HTMLParagraphElement>();
  /** Chiave (servizio + ultima sync) dell'ultimo elenco chiesto, e contatore delle richieste. */
  #backupsKey: unknown = null;
  #request = 0;
  /** Il ripristino in corso (conteggio e conferma): il controller è il suo token, uno alla volta. Legato al servizio: se cambia o si spegne si annulla e libera subito il posto. */
  #restoreAbort: AbortController | null = null;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#binding && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#binding!, this.#i18n!),
  });

  get controller(): SyncController | null { return this.#controller; }
  set controller(value: SyncController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#loop.update();
  }
  get binding(): SyncBinding | null { return this.#binding; }
  set binding(value: SyncBinding | null) {
    value ??= null;
    if (value === this.#binding) return;
    this.#binding = value;
    this.reconnect();
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
      const report = (error: unknown) => this.#controller?.report(error);
      const parts: Parts = {
        root: el('div', { class: 'detail' }),
        notice: el('p', { class: 'help' }),
        actions: el('div', { class: 'actions' }),
        choose: el('button', { type: 'button', on: { click: () => void this.#binding?.choose().catch(report) } }),
        folder: el('span'),
        disable: el('button', { type: 'button', on: { click: () => void this.#binding?.disable().catch(report) } }),
        reactivate: el('button', { type: 'button', on: { click: () => void this.#binding?.reactivate().catch(report) } }),
        // Lo stato cambia dopo ogni sync (LAB-42 P9): regione live; l'errore entra già scritto, come avviso.
        status: el('p', { class: 'help', role: 'status' }),
        error: el('p', { class: 'help', role: 'alert' }),
        conflicts: el('p', { class: 'help' }),
        syncActions: el('div', { class: 'actions' }),
        syncNow: el('button', { type: 'button', on: { click: () => void (this.#sync?.service as SyncDetailsService | undefined)?.syncNow() } }),
        backups: el('details'),
        backupsSummary: el('summary'),
      };
      parts.syncActions.append(parts.syncNow);
      parts.backups.append(parts.backupsSummary);
      this.#parts = parts;
      this.append(parts.root);
    }
    this.#dialogs ??= new AbortController();
    const { binding, i18n } = { binding: this.#binding, i18n: this.#i18n };
    if (!binding || !i18n) return;
    this.watch(binding, () => this.#follow(binding.getState().sync), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#follow(null);
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Iscrizione al servizio attivo (cambia con cartella e permesso): i dettagli seguono il suo stato. */
  #follow(service: SyncService | null): void {
    if (service !== (this.#sync?.service ?? null)) {
      this.#sync?.off();
      this.#restoreAbort?.abort();
      this.#restoreAbort = null;
      this.#sync = service ? { service, off: service.subscribe(() => this.#onSyncState()) } : null;
      this.#backups = [];
      this.#backupsKey = null;
    }
    this.#onSyncState();
  }

  /** A ogni sincronizzazione finita (e con un servizio nuovo) si richiede l'elenco dei backup. */
  #onSyncState(): void {
    const sync = this.#sync?.service as SyncDetailsService | undefined;
    if (sync && this.isConnected) {
      const key = `${sync.getState().lastSync}`;
      if (this.#backupsKey !== key) {
        this.#backupsKey = key;
        const request = ++this.#request;
        void sync
          .listBackups()
          .then((paths) => {
            if (request !== this.#request || this.#sync?.service !== sync) return;
            this.#backups = paths;
            this.#loop.update();
          })
          .catch((error) => this.#controller?.report(error));
      }
    }
    this.#loop.update();
  }

  #restore(path: string): void {
    const sync = this.#sync?.service as SyncDetailsService | undefined;
    const t = this.#i18n?.t;
    const dialogs = this.#dialogs?.signal;
    const controller = this.#controller;
    // Una sola conferma di ripristino alla volta, anche durante backupCounts.
    if (!sync || !t || !dialogs || !controller || this.#restoreAbort) return;
    const abort = (this.#restoreAbort = new AbortController());
    const signal = AbortSignal.any([dialogs, abort.signal]);
    void sync
      .backupCounts(path)
      .then((counts) =>
        signal.aborted ? false : showConfirmDialog({
          title: t('ai.restoreTitle'),
          message: t('ai.syncCounts', { profiles: counts.profiles, presets: counts.presets }) + '\n' + t('ai.syncRestoreWarning'),
          confirmLabel: t('ai.restoreBackup'),
          t,
          signal,
        }),
      )
      .then((ok) => (ok && !signal.aborted ? sync.restore(path).then(() => controller.reload()) : undefined))
      .catch((error) => controller.report(error))
      .finally(() => {
        if (this.#restoreAbort === abort) this.#restoreAbort = null;
      });
  }

  #render(parts: Parts, binding: SyncBinding, i18n: I18nStore): void {
    const t = i18n.t;
    const { handle, permission } = binding.getState();
    setText(parts.notice, t('ai.syncNotice'));
    setText(parts.choose, t('ai.syncChoose'));
    setText(parts.folder, handle?.name ?? '');
    setText(parts.disable, t('ai.syncDisable'));
    setText(parts.reactivate, t('ai.syncReactivate'));
    showChildren(parts.actions, [parts.choose, ...(handle ? [parts.folder, parts.disable, ...(permission ? [] : [parts.reactivate])] : [])], [parts.folder, parts.disable, parts.reactivate]);
    const sync = this.#sync?.service;
    const wanted: Element[] = [parts.notice, parts.actions];
    if (sync) {
      const state = sync.getState();
      setText(parts.status, `${t(`ai.syncStatus.${state.status}` as MessageKey)} ${state.lastSync ? new Date(state.lastSync).toLocaleString() : ''}`);
      setText(parts.error, state.error ? t(`ai.error.${state.error}` as MessageKey) : '');
      setText(parts.conflicts, `${t('ai.syncConflict')}: ${state.conflicts.join(', ')}`);
      setText(parts.syncNow, t('ai.syncNow'));
      parts.syncNow.disabled = state.status === 'syncing';
      setText(parts.backupsSummary, t('ai.backups'));
      this.#renderBackups(parts, t);
      wanted.push(parts.status, ...(state.error ? [parts.error] : []), ...(state.conflicts.length > 0 ? [parts.conflicts] : []), parts.syncActions, parts.backups);
    }
    showChildren(parts.root, wanted, [parts.status, parts.error, parts.conflicts, parts.syncActions, parts.backups]);
  }

  /** Un `p` per backup, figli diretti di `details` dopo il `summary` (come in React), riusati per percorso. */
  #renderBackups(parts: Parts, t: I18nStore['t']): void {
    const nodes = new Map<string, HTMLParagraphElement>();
    for (const path of this.#backups) {
      // Il percorso descrive il suo «Ripristina»: i pulsanti hanno lo stesso nome (LAB-42 P10, WCAG 2.4.6).
      const node = this.#backupNodes.get(path) ?? this.#backupNode(path);
      setText(node.lastElementChild!, t('ai.restoreBackup'));
      nodes.set(path, node);
    }
    showChildren(parts.backups, [parts.backupsSummary, ...nodes.values()], [...this.#backupNodes.values()]);
    this.#backupNodes = nodes;
  }

  #backupNode(path: string): HTMLParagraphElement {
    const id = uid('hmd-settings-backup');
    return el('p', { class: 'help' }, el('span', { id }, path), el('button', { type: 'button', 'aria-describedby': id, on: { click: () => this.#restore(path) } }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-sync': HmdSettingsSync;
  }
}
