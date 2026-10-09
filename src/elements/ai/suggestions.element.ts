import { presetLabel } from '../../ai/presetName';
import type { PromptPreset } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { suggestionPresets, type AiChipController } from './aiChips';
import './suggestions.css';

/** Preset come suggerimenti sotto il composer (era Suggestions.tsx): solo con la chat vuota. */
export class HmdAiSuggestions extends HmdElement {
  #controller: AiChipController | null = null;
  #i18n: I18nStore | null = null;
  #group: HTMLDivElement | null = null;

  get controller(): AiChipController | null { return this.#controller; }
  set controller(value: AiChipController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
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
    this.#group ??= el('div', { class: 'suggestions', role: 'group' });
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#render(controller, i18n), signal);
    this.watch(i18n, () => this.#render(controller, i18n), signal);
  }

  #render(controller: AiChipController, i18n: I18nStore): void {
    const group = this.#group!;
    const presets = suggestionPresets(controller.getState());
    if (presets.length === 0) {
      group.remove();
      return;
    }
    toggleAttr(group, 'aria-label', true, i18n.t('ai.suggestions'));
    reconcileList(
      group,
      presets,
      (p: PromptPreset) => p.id,
      (p) => el('button', { type: 'button', class: 'suggestion', on: { click: () => emit(this, 'hmd-ai-suggestion', { presetId: p.id }) } }),
      (node, p) => setText(node, presetLabel(p, i18n.t)),
    );
    if (!group.isConnected) this.append(group);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-suggestions': HmdAiSuggestions;
  }
}
