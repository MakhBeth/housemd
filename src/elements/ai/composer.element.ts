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
import { outgoing, selectionChipText, sendBlocker, sendButton, type ComposerController, type SendBlocker } from './composerView';
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
  /** Nota sotto il composer (`role="status"`): perché Invia non ha inviato. Vuota di norma. */
  note: HTMLParagraphElement;
}

/**
 * Composer della chat AI (era Composer.tsx): chip della selezione, casella della richiesta, riga con il
 * chip del modello, il chip dell'effort e Invia/Stop. La casella è dell'elemento: si crea una volta e
 * l'elemento la svuota solo dopo l'invio di un testo scritto (nessun eco da fuori la riscrive). Invio
 * invia, Shift+Invio va a capo, Esc ferma (composerKeys.ts). `sendPreset()` per i suggerimenti. Invia
 * non si disattiva mai: senza testo o senza profilo (anche per un suggerimento) la nota sotto il composer
 * dice perché, e si svuota scrivendo, cambiando profilo, con un invio riuscito o quando parte una generazione.
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
  /** Nota mostrata e il profilo di quel momento: un cambio di profilo la toglie. */
  #note: { key: SendBlocker; profileId: string | undefined } | null = null;
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
        input: el('textarea', { class: 'input', on: { input: () => this.#onInput(), keydown: (event) => this.#onKeyDown(event) } }),
        modelChip: el('hmd-ai-model-chip'),
        effortChip: el('hmd-ai-effort-chip'),
        send: el('button', { type: 'button', class: 'send tooltip', on: { click: () => this.#onButton() } }, sendIcon),
        sendIcon,
        note: el('p', { class: 'note', role: 'status' }),
      };
      this.#parts = parts;
      // Le proprietà dei chip prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.box.append(parts.input, el('div', { class: 'row' }, parts.modelChip, parts.effortChip, parts.send));
      this.append(parts.box, parts.note);
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

  #onInput(): void {
    this.#note = null;
    this.#loop.update();
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

  /**
   * Invio chiesto dall'utente (Invia, Invio, un suggerimento): se il messaggio risolto (testo scritto o
   * preset) non può partire, la nota dice perché; la casella e il focus restano come sono.
   */
  #send(presetId?: string): void {
    const controller = this.#controller;
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!controller || !parts || !i18n) return;
    const state = controller.getState();
    if (state.running) return;
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    const blocker = sendBlocker(parts.input.value, !!controller.profile(), !!preset);
    if (blocker) {
      this.#note = { key: blocker, profileId: controller.profile()?.id };
      this.#loop.update();
      return;
    }
    const message = outgoing(parts.input.value, preset, i18n.t);
    if (!message) return;
    const scoped = selectionChipText(i18n.t, this.#text, this.#selection, this.#ignored) !== null;
    const scope = scoped ? this.#getSelection() : undefined;
    if (scoped && !scope) {
      // Una nota di prima (es. needText) non deve restare su questo percorso.
      this.#note = null;
      this.#loop.update();
      controller.report({ code: 'scopeLost' });
      return;
    }
    void controller.send(message, preset, scope).catch((error: unknown) => controller.report(error));
    this.#note = null;
    if (preset) {
      this.#loop.update();
      return;
    }
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
    const button = sendButton(!!controller.getState().running);
    toggleAttr(parts.send, 'aria-label', true, t(button.label));
    toggleAttr(parts.send, 'data-tooltip', true, t(button.label));
    parts.sendIcon.style.setProperty('mask-image', `url("${ICONS[button.icon]}")`);
    // Un cambio di profilo o una generazione partita da qualunque parte (anche «Riprova» nel registro)
    // toglie la nota; la stessa nota due volte di fila non si ri-annuncia (stesso testo nella regione): accettato.
    if (this.#note && (this.#note.profileId !== controller.profile()?.id || controller.getState().running)) this.#note = null;
    setText(parts.note, this.#note ? t(this.#note.key) : '');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-composer': HmdAiComposer;
  }
}
