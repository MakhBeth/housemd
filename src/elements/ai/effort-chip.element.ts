import { EFFORT_LEVELS } from '../../ai/capabilities';
import type { GenParams } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import type { I18nStore } from '../../state/i18nStore';
import { effortChipState, type AiChipController } from './aiChips';
import './effort-chip.css';

/** Chip dell'effort nel composer (era EffortChip.tsx): solo se il profilo lo supporta. */
export class HmdAiEffortChip extends HmdElement {
  #controller: AiChipController | null = null;
  #i18n: I18nStore | null = null;
  #select: HTMLSelectElement | null = null;

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
    this.#select ??= el(
      'select',
      {
        class: 'chip',
        on: {
          change: () => {
            const controller = this.#controller;
            if (!controller) return;
            const overrides = controller.getState().chat.overrides;
            controller.override({ ...overrides, effort: (this.#select!.value as GenParams['effort']) || undefined });
          },
        },
      },
      el('option', { value: '' }),
      EFFORT_LEVELS.map((level) => el('option', null, level)),
    );
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#render(controller, i18n), signal);
    this.watch(i18n, () => this.#render(controller, i18n), signal);
  }

  #render(controller: AiChipController, i18n: I18nStore): void {
    const select = this.#select!;
    const state = effortChipState(controller.profile(), controller.getState().chat.overrides);
    if (!state.visible) {
      select.remove();
      return;
    }
    toggleAttr(select, 'aria-label', true, i18n.t('ai.param.effort'));
    setText(select.options[0], i18n.t('ai.default'));
    if (!select.isConnected) this.append(select);
    if (select.value !== state.value) select.value = state.value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-effort-chip': HmdAiEffortChip;
  }
}
