import { modelSelection } from '../../ai/profiles';
import type { ModelOption, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { CUSTOM, modelListKey, modelSelectOptions, selectValue, type ModelSelectController, type SelectOption } from './modelSelectView';
import './model-select.css';

interface Parts {
  section: HTMLDivElement;
  label: HTMLLabelElement;
  caption: HTMLSpanElement;
  select: HTMLSelectElement;
  /** Campo libero di «Altro…». */
  input: HTMLInputElement;
  refresh: HTMLButtonElement;
  /** «Server non raggiungibile». */
  error: HTMLElement;
}

/**
 * Selettore del modello (era ModelSelect.tsx): nel popover del chip del modello, montato solo a popover
 * aperto, e nel dettaglio di un profilo nelle impostazioni. L'elenco dei modelli lo chiede il provider del
 * profilo attraverso il controller (l'elemento non fa rete né vede chiavi) al collegamento e quando cambiano
 * tipo, indirizzo o chiave salvata, o con «Aggiorna»; una risposta arrivata dopo il distacco o superata da
 * una richiesta più nuova si scarta. Select e campo libero si riscrivono solo quando cambia il valore che
 * l'elemento vuole mostrare (mai confrontando con il DOM vivo), il campo mai mentre ha il focus.
 */
export class HmdAiModelSelect extends HmdElement {
  #controller: ModelSelectController | null = null;
  #profile: ModelProfile | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #models: ModelOption[] | null = null;
  #error = false;
  #custom = false;
  #revision = 0;
  /** Richiesta dell'elenco (in corso o finita) e il suo abort; null = da fare (anche dopo il distacco). */
  #request: { key: string; abort: AbortController } | null = null;
  /** Ultimo valore mostrato dalla select e dal campo libero (scritto dall'elemento o dall'utente). */
  #shownValue: string | null = null;
  #shownModel: string | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && !!this.#profile && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!, this.#profile!),
  });

  get controller(): ModelSelectController | null { return this.#controller; }
  set controller(value: ModelSelectController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    // Un controller nuovo: l'elenco si richiede (come la dipendenza `controller` dell'effetto di React).
    this.#request?.abort.abort();
    this.#request = null;
    this.#load();
    this.#loop.update();
  }
  get profile(): ModelProfile | null { return this.#profile; }
  set profile(value: ModelProfile | null) {
    value ??= null;
    if (value === this.#profile) return;
    this.#profile = value;
    this.#load();
    this.#loop.update();
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
      const caption = el('span');
      const select = el('select', { on: { change: () => this.#onSelect() } });
      const parts: Parts = {
        section: el('div', { class: 'section' }),
        label: el('label', null, caption, select),
        caption,
        select,
        // Uscito il focus, il campo si riallinea al modello del profilo se nel frattempo è cambiato da fuori.
        input: el('input', { on: { input: () => this.#onInput(), focusout: () => this.#loop.update() } }),
        refresh: el('button', { type: 'button', class: 'link', on: { click: () => this.#refresh() } }),
        error: el('small'),
      };
      parts.section.append(parts.label, parts.refresh);
      this.append(parts.section);
      this.#parts = parts;
    }
    // Al (ri)collegamento l'elenco si chiede se manca; un cambio di lingua (reconnect) non lo richiede.
    this.#load();
    if (this.#i18n) this.watch(this.#i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco: la risposta in arrivo non tocca più nulla; ricollegato, l'elenco si richiede.
    this.#request?.abort.abort();
    this.#request = null;
  }

  /** Chiede l'elenco se la chiave (provider, indirizzo, chiave salvata, «Aggiorna») è cambiata. Non disegna. */
  #load(): void {
    const controller = this.#controller;
    const profile = this.#profile;
    if (!controller || !profile || !this.isConnected) return;
    const key = modelListKey(profile, this.#revision);
    if (this.#request?.key === key) return;
    this.#request?.abort.abort();
    const abort = new AbortController();
    this.#request = { key, abort };
    this.#models = null;
    this.#error = false;
    void controller
      .provider(profile)
      .then((provider) => provider.listModels(abort.signal))
      .then(
        (list) => {
          if (abort.signal.aborted) return;
          this.#models = list;
          this.#error = !list;
          this.#loop.update();
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          this.#error = true;
          controller.report(error);
          this.#loop.update();
        },
      );
  }

  #refresh(): void {
    this.#revision++;
    this.#load();
    this.#loop.update();
  }

  #onSelect(): void {
    const parts = this.#parts;
    const profile = this.#profile;
    if (!parts || !profile) return;
    const value = parts.select.value;
    this.#custom = value === CUSTOM;
    // La select mostra già la scelta: si riscrive solo quando cambia il modello del profilo (o «Altro…»).
    this.#shownValue = selectValue(this.#custom, profile.model);
    if (!this.#custom) emit(this, 'hmd-ai-model-change', { selection: modelSelection(profile, value, this.#models?.find((m) => m.value === value)) });
    this.#loop.update();
  }

  #onInput(): void {
    const parts = this.#parts;
    const profile = this.#profile;
    if (!parts || !profile) return;
    const value = parts.input.value;
    this.#shownModel = value;
    emit(this, 'hmd-ai-model-change', { selection: modelSelection(profile, value, this.#models?.find((m) => m.value === value)) });
  }

  #render(parts: Parts, i18n: I18nStore, profile: ModelProfile): void {
    const t = i18n.t;
    setText(parts.caption, t('ai.model'));
    reconcileList(
      parts.select,
      modelSelectOptions(profile, this.#models, t),
      (option: SelectOption) => option.value,
      (option) => el('option', { value: option.value }),
      (node, option) => setText(node, option.label),
    );
    const value = selectValue(this.#custom, profile.model);
    if (value !== this.#shownValue) {
      parts.select.value = value;
      this.#shownValue = value;
    }
    if (this.#custom) {
      toggleAttr(parts.input, 'aria-label', true, t('ai.model'));
      // Il campo segue il modello solo senza focus: chi scrive è la fonte del valore (un eco in ritardo non lo tocca).
      if (profile.model !== this.#shownModel && document.activeElement !== parts.input) {
        parts.input.value = profile.model;
        this.#shownModel = profile.model;
      }
      if (parts.input.parentNode !== parts.section) parts.label.after(parts.input);
    } else {
      parts.input.remove();
      // Riaperto, il campo riparte dal modello del profilo (come il campo nuovo di React).
      this.#shownModel = null;
    }
    setText(parts.refresh, t('ai.refresh'));
    if (this.#error) {
      setText(parts.error, t('ai.error.unreachable'));
      if (parts.error.parentNode !== parts.section) parts.section.append(parts.error);
    } else {
      parts.error.remove();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-model-select': HmdAiModelSelect;
  }
}
