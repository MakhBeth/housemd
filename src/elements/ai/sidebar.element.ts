import type { AiController, AiWorkspace } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdAiChatLog } from './chat-log.element';
import type { HmdAiComposer } from './composer.element';
import type { ComposerController } from './composerView';
import type { HmdAiSuggestions } from './suggestions.element';
import './sidebar.css';

/** Quello che la sidebar usa del controller: quello del composer, più nuova chat, riprova e apertura di un file. */
export type SidebarController = ComposerController & Pick<AiController, 'newChat' | 'retry'> & { readonly workspace: Pick<AiWorkspace, 'openFile'> };

interface Parts {
  root: HTMLDivElement;
  title: HTMLHeadingElement;
  newChat: HTMLButtonElement;
  log: HmdAiChatLog;
  bottom: HTMLDivElement;
  /** «⚠ Riattiva il permesso di sync», solo quando la cartella di sync non ha il permesso. */
  sync: HTMLButtonElement;
  composer: HmdAiComposer;
  suggestions: HmdAiSuggestions;
}

/**
 * Sidebar della modalità AI (era AiSidebar.tsx): testata con «Nuova chat», registro della chat, composer
 * e suggerimenti (che inviano il preset con `sendPreset` del composer). Aprire un file e riprovare un
 * messaggio passano dal controller come prima; verso fuori manda solo `hmd-ai-sync-reactivate` (e lascia
 * salire `hmd-ai-manage` dal chip del modello).
 */
export class HmdAiSidebar extends HmdElement {
  #controller: SidebarController | null = null;
  #text = '';
  #selection: TextRange | null = null;
  #getSelection: () => SelectionScope | undefined = () => undefined;
  #syncNeedsPermission = false;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  // Nessun recupero del focus qui: il registro e il composer hanno il loro (come con React).
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
  });

  get controller(): SidebarController | null { return this.#controller; }
  set controller(value: SidebarController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#passDown();
    this.reconnect();
  }
  get text(): string { return this.#text; }
  set text(value: string) {
    this.#text = value ?? '';
    this.#passDown();
  }
  get selection(): TextRange | null { return this.#selection; }
  set selection(value: TextRange | null) {
    this.#selection = value ?? null;
    this.#passDown();
  }
  get getSelection(): () => SelectionScope | undefined { return this.#getSelection; }
  set getSelection(value: () => SelectionScope | undefined) {
    this.#getSelection = value ?? (() => undefined);
    this.#passDown();
  }
  get syncNeedsPermission(): boolean { return this.#syncNeedsPermission; }
  set syncNeedsPermission(value: boolean) {
    value = !!value;
    if (value === this.#syncNeedsPermission) return;
    this.#syncNeedsPermission = value;
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.#passDown();
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const parts: Parts = {
        root: el('div', { class: 'sidebar' }),
        title: el('h2', { class: 'title' }),
        newChat: el('button', { type: 'button', class: 'iconButton tooltip', on: { click: () => this.#controller?.newChat() } }, icon('newFile')),
        log: el('hmd-ai-chat-log', {
          on: {
            'hmd-ai-open-file': (event) => void this.#controller?.workspace.openFile(event.detail.path),
            'hmd-ai-retry': (event) => void this.#controller?.retry(event.detail.id, event.detail.removeRejected),
          },
        }),
        bottom: el('div', { class: 'bottom' }),
        sync: el('button', { type: 'button', class: 'file', on: { click: () => emit(this, 'hmd-ai-sync-reactivate', null) } }),
        composer: el('hmd-ai-composer'),
        suggestions: el('hmd-ai-suggestions', { on: { 'hmd-ai-suggestion': (event) => this.#parts?.composer.sendPreset(event.detail.presetId) } }),
      };
      this.#parts = parts;
      // Le proprietà dei figli prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.bottom.append(parts.composer, parts.suggestions);
      parts.root.append(el('div', { class: 'header' }, parts.title, parts.newChat), parts.log, parts.bottom);
      this.append(parts.root);
    }
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  /** Ingressi che passano ai figli così come arrivano (i figli ignorano i valori uguali). */
  #passDown(): void {
    const parts = this.#parts;
    if (!parts) return;
    parts.log.i18n = this.#i18n;
    parts.composer.controller = this.#controller;
    parts.composer.text = this.#text;
    parts.composer.selection = this.#selection;
    parts.composer.getSelection = this.#getSelection;
    parts.composer.i18n = this.#i18n;
    parts.suggestions.controller = this.#controller;
    parts.suggestions.i18n = this.#i18n;
  }

  #render(parts: Parts, controller: SidebarController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    setText(parts.title, t('ai.title'));
    toggleAttr(parts.newChat, 'aria-label', true, t('ai.newChat'));
    toggleAttr(parts.newChat, 'data-tooltip', true, t('ai.newChat'));
    const empty = state.chat.messages.length === 0 && !state.running;
    if (parts.newChat.disabled !== empty) parts.newChat.disabled = empty;
    parts.log.messages = state.chat.messages;
    if (this.#syncNeedsPermission) {
      setText(parts.sync, `⚠ ${t('ai.syncReactivate')}`);
      if (parts.sync.parentNode !== parts.bottom) parts.bottom.prepend(parts.sync);
    } else {
      parts.sync.remove();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-sidebar': HmdAiSidebar;
  }
}
