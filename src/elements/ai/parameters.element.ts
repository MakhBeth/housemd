import { EFFORT_LEVELS } from '../../ai/capabilities';
import type { GenParams, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { parameterFields, withParam, type ParamField } from './aiChips';
import './parameters.css';

/** Parametri di generazione (era Parameters.tsx): nel popover del modello e nelle impostazioni. */
export class HmdAiParameters extends HmdElement {
  #profile: ModelProfile | null = null;
  #value: GenParams = {};
  #hideEffort = false;
  #i18n: I18nStore | null = null;
  #section: HTMLDivElement | null = null;

  get profile(): ModelProfile | null { return this.#profile; }
  set profile(value: ModelProfile | null) { this.#profile = value ?? null; this.#render(); }
  get value(): GenParams { return this.#value; }
  set value(value: GenParams) { this.#value = value ?? {}; this.#render(); }
  get hideEffort(): boolean { return this.#hideEffort; }
  set hideEffort(value: boolean) { this.#hideEffort = !!value; this.#render(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#section ??= this.appendChild(el('div', { class: 'section' }));
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #change(field: ParamField, raw: string): void {
    emit(this, 'hmd-params-change', { params: withParam(this.#value, field.key, raw) });
  }

  #create(field: ParamField): HTMLLabelElement {
    const control =
      field.kind === 'effort'
        ? el(
            'select',
            { on: { change: (event) => this.#change(field, (event.currentTarget as HTMLSelectElement).value) } },
            el('option', { value: '' }),
            EFFORT_LEVELS.map((level) => el('option', null, level)),
          )
        : el('input', { type: 'number', min: String(field.min), max: field.max === undefined ? undefined : String(field.max), step: String(field.step), on: { input: (event) => this.#change(field, (event.currentTarget as HTMLInputElement).value) } });
    return el('label', null, el('span'), control);
  }

  #render(): void {
    const section = this.#section;
    const i18n = this.#i18n;
    if (!section || !i18n || !this.#profile) return;
    const value = this.#value;
    reconcileList(
      section,
      parameterFields(this.#profile, this.#hideEffort),
      (field) => field.key,
      (field) => this.#create(field),
      (label, field) => {
        setText(label.querySelector('span')!, i18n.t(`ai.param.${field.key}`));
        if (field.kind === 'effort') {
          const select = label.querySelector('select')!;
          setText(select.options[0], i18n.t('ai.default'));
          const next = value.effort ?? '';
          if (select.value !== next) select.value = next;
          return;
        }
        const input = label.querySelector('input')!;
        const next = value[field.key];
        // Si riscrive solo se il numero cambia e il campo non ha il focus: chi sta scrivendo è la fonte del valore,
        // e un commit in ritardo del genitore cancellerebbe il testo parziale ("0.").
        const current = input.value === '' ? undefined : Number(input.value);
        if (current !== next && input !== this.ownerDocument.activeElement) input.value = next === undefined ? '' : String(next);
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-parameters': HmdAiParameters;
  }
}
