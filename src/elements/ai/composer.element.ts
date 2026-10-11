import { composerAction } from '../../ai/composerKeys';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { ICONS } from '../../ui/icons';
import type { HmdAiEffortChip } from './effort-chip.element';
import type { HmdAiModelChip } from './model-chip.element';
import { outgoing, selectionChipText, sendButton, type ComposerController } from './composerView';
import './composer.css';

interface Parts {
  box: HTMLDivElement;
  /** Chip della selezione: testo e ✕. */
  chip: HTMLSpanElement;
  chipText: Text;
  ignore: HTMLButtonElement;
  input: HTMLTextAreaElement;
  modelChip: HmdAiModelChip;
  effortChip: HmdAiEffortChip;
  /** Un solo pulsante, Invia o Stop, come il nodo che React riusava: il focus non salta. */
  send: HTMLButtonElement;
  sendIcon: HTMLSpanElement;
}

/**
 * Composer della chat AI (era Composer.tsx): chip della selezione, casella della richiesta, riga con il
 * chip del modello, il chip dell'effort e Invia/Stop. La casella è dell'elemento: si crea una volta e
 * l'elemento la svuota solo dopo l'invio di un testo scritto (nessun eco da fuori la riscrive). Invio
 * invia, Shift+Invio va a capo, Esc ferma (composerKeys.ts). `sendPreset()` per i suggerimenti.
 */
export class HmdAiComposer extends HmdElement {
  #controller: ComposerController | null = null;
  #text = '';
  #selection: TextRange | null = null;
  #getSelection: () => SelectionScope | undefined = () => undefined;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Selezione ignorata con ✕: il chip ricompare con una selezione diversa. */
  #ignored: TextRange | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
    focusScope: () => this.#parts?.box ?? null,
    // Il nodo con il focus è sparito (la ✕ del chip della selezione): il focus va nella casella (decisione 3).
    refocus: () => this.#parts?.input.focus(),
  });

  get controller(): ComposerController | null { return this.#controller; }
  set controller(value: ComposerController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#passDown();
    this.reconnect();
  }
  /** Testo del documento aperto, per contare la selezione. */
  get text(): string { return this.#text; }
  set text(value: string) {
    value ??= '';
    if (value === this.#text) return;
    this.#text = value;
    this.#loop.update();
  }
  get selection(): TextRange | null { return this.#selection; }
  set selection(value: TextRange | null) {
    value ??= null;
    if (value === this.#selection) return;
    this.#selection = value;
    this.#loop.update();
  }
  /** Scope della selezione calcolato al momento dell'invio dalla sessione dell'editor (come prima). */
  get getSelection(): () => SelectionScope | undefined { return this.#getSelection; }
  set getSelection(value: () => SelectionScope | undefined) {
    this.#getSelection = value ?? (() => undefined);
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.#passDown();
    this.reconnect();
  }

  /** Invia il preset (suggerimenti sotto il composer), come `sendPreset` del ref di Composer.tsx. */
  sendPreset(presetId: string): void {
    this.#send(presetId);
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const chipText = document.createTextNode('');
      const ignore = el('button', { type: 'button', class: 'selectionClose tooltip', on: { click: () => this.#ignore() } }, icon('close', { size: 12 }));
      const sendIcon = icon('send', { size: 16 });
      const parts: Parts = {
        box: el('div', { class: 'composer' }),
        chip: el('span', { class: 'selection' }, chipText, ignore),
        chipText,
        ignore,
        input: el('textarea', { class: 'input', on: { input: () => this.#loop.update(), keydown: (event) => this.#onKeyDown(event) } }),
        modelChip: el('hmd-ai-model-chip'),
        effortChip: el('hmd-ai-effort-chip'),
        send: el('button', { type: 'button', class: 'send tooltip', on: { click: () => this.#onButton() } }, sendIcon),
        sendIcon,
      };
      this.#parts = parts;
      // Le proprietà dei chip prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.box.append(parts.input, el('div', { class: 'row' }, parts.modelChip, parts.effortChip, parts.send));
      this.append(parts.box);
    }
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  /** Controller e lingua passano ai due chip (che si riallacciano da soli quando cambiano). */
  #passDown(): void {
    const parts = this.#parts;
    if (!parts) return;
    parts.modelChip.controller = this.#controller;
    parts.modelChip.i18n = this.#i18n;
    parts.effortChip.controller = this.#controller;
    parts.effortChip.i18n = this.#i18n;
  }

  #ignore(): void {
    this.#ignored = this.#selection;
    this.#loop.update();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const controller = this.#controller;
    if (!controller) return;
    const { key, shiftKey, ctrlKey, metaKey, altKey, isComposing } = event;
    const action = composerAction({ key, shiftKey, ctrlKey, metaKey, altKey, isComposing }, !!controller.getState().running);
    if (action === 'send') {
      event.preventDefault();
      this.#send();
    } else if (action === 'stop') {
      event.preventDefault();
      controller.stop();
    }
  }

  #onButton(): void {
    const controller = this.#controller;
    if (!controller) return;
    if (controller.getState().running) controller.stop();
    else this.#send();
  }

  #send(presetId?: string): void {
    const controller = this.#controller;
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!controller || !parts || !i18n) return;
    const state = controller.getState();
    if (state.running) return;
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    const message = outgoing(parts.input.value, preset, i18n.t);
    if (!message || !controller.profile()) return;
    const scoped = selectionChipText(i18n.t, this.#text, this.#selection, this.#ignored) !== null;
    const scope = scoped ? this.#getSelection() : undefined;
    if (scoped && !scope) {
      controller.report({ code: 'scopeLost' });
      return;
    }
    void controller.send(message, preset, scope).catch((error: unknown) => controller.report(error));
    if (preset) return;
    // L'unica scrittura della casella: dopo l'invio di un testo scritto si svuota (spec AI UI §4.2).
    parts.input.value = '';
    this.#loop.update();
  }

  #render(parts: Parts, controller: ComposerController, i18n: I18nStore): void {
    const t = i18n.t;
    const chipText = selectionChipText(t, this.#text, this.#selection, this.#ignored);
    if (chipText !== null) {
      setText(parts.chipText, chipText);
      toggleAttr(parts.ignore, 'aria-label', true, t('ai.selectionIgnore'));
      toggleAttr(parts.ignore, 'data-tooltip', true, t('ai.selectionIgnore'));
      if (parts.chip.parentNode !== parts.box) parts.box.prepend(parts.chip);
    } else {
      parts.chip.remove();
    }
    toggleAttr(parts.input, 'aria-label', true, t('ai.request'));
    toggleAttr(parts.input, 'placeholder', true, t('ai.request'));
    const button = sendButton(!!controller.getState().running, parts.input.value, !!controller.profile());
    toggleAttr(parts.send, 'aria-label', true, t(button.label));
    toggleAttr(parts.send, 'data-tooltip', true, t(button.label));
    if (parts.send.disabled !== button.disabled) parts.send.disabled = button.disabled;
    parts.sendIcon.style.setProperty('mask-image', `url("${ICONS[button.icon]}")`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-composer': HmdAiComposer;
  }
}
