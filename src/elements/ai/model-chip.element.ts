import { effectiveProfile } from '../../ai/profiles';
import type { GenParams, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import { writePref } from '../../lib/prefs';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdAiParameters } from './parameters.element';
import type { HmdAiModelSelect } from './model-select.element';
import {
  chipLabel,
  groupRowKey,
  groupRows,
  hasOverrides,
  popoverParts,
  privacyNote,
  profileGroups,
  profileName,
  type GroupRow,
  type ModelChipController,
  type PopoverPart,
  type ProfileGroup,
} from './modelChipView';
import './model-chip.css';

interface Parts {
  /** Senza profilo: il chip «Gestisci profili» al posto di tutto il resto. */
  manage: HTMLButtonElement;
  anchor: HTMLSpanElement;
  chip: HTMLButtonElement;
  label: Text;
  popover: HTMLDivElement;
  note: HTMLParagraphElement;
  groups: { local: HTMLFieldSetElement; cloud: HTMLFieldSetElement };
  params: HmdAiParameters;
  actions: HTMLDivElement;
  save: HTMLButtonElement;
  saveAs: HTMLButtonElement;
  reset: HTMLButtonElement;
  manageLink: HTMLButtonElement;
}

/** Riga di un profilo; `profile` è l'ultimo ricevuto, `checked` l'ultimo valore mostrato dal radio. */
interface ProfileRow {
  profile: ModelProfile;
  radio: HTMLInputElement;
  name: Text;
  checked: boolean | null;
}

/**
 * Chip del modello nel composer (era ModelChip.tsx): «profilo · modello», con la nota privacy come tooltip,
 * e un popover `auto` con i profili (locali e cloud), il selettore del modello (montato solo a popover
 * aperto: l'elenco dei modelli si chiede solo allora), i parametri e le azioni. Senza profilo, solo il chip
 * «Gestisci profili». Manda `hmd-ai-manage`; il resto lo chiede al controller.
 */
export class HmdAiModelChip extends HmdElement {
  #controller: ModelChipController | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #id = '';
  #open = false;
  #rows = new WeakMap<Element, ProfileRow>();
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
    focusScope: () => this,
    // Il nodo con il focus è sparito (un profilo tolto a popover aperto, il chip diventato «Gestisci»): sul chip.
    refocus: () => {
      const parts = this.#parts;
      if (parts) (parts.anchor.isConnected ? parts.chip : parts.manage).focus();
    },
  });

  get controller(): ModelChipController | null { return this.#controller; }
  set controller(value: ModelChipController | null) {
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
    this.#parts ??= this.#build();
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Staccato, il popover si chiude senza evento toggle: ricollegato, il selettore del modello non torna
    // (e non chiede l'elenco) finché il popover non si riapre.
    this.#open = false;
  }

  #build(): Parts {
    const id = (this.#id = uid('hmd-ai-model'));
    const label = document.createTextNode('');
    const chip = el('button', { type: 'button', class: 'chip tooltip', 'aria-describedby': `${id}-privacy`, popovertarget: id }, label, icon('chevronDown', { size: 12 }));
    const popover = el('div', { id, popover: 'auto', class: 'popover', on: { toggle: () => this.#onToggle() } });
    const button = (onClick: () => void, className?: string) => el('button', { type: 'button', class: className, on: { click: onClick } });
    const parts: Parts = {
      manage: button(() => emit(this, 'hmd-ai-manage', null), 'chip'),
      anchor: el('span', { class: 'chipAnchor' }, chip, popover),
      chip,
      label,
      popover,
      note: el('p', { id: `${id}-privacy`, class: 'popoverNote' }),
      groups: { local: el('fieldset', { class: 'popoverSection' }), cloud: el('fieldset', { class: 'popoverSection' }) },
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (event) => this.#override(event.detail.params) } }),
      actions: el('div', { class: 'popoverActions' }),
      save: button(() => this.#run((controller) => controller.saveOverrides())),
      saveAs: button(() => this.#run((controller) => controller.saveOverrides(true))),
      reset: button(() => this.#controller?.override({})),
      manageLink: button(() => {
        this.#parts?.popover.hidePopover();
        emit(this, 'hmd-ai-manage', null);
      }, 'link'),
    };
    parts.actions.append(parts.save, parts.saveAs, parts.reset, parts.manageLink);
    return parts;
  }

  #override(params: GenParams | Pick<ModelProfile, 'model' | 'contextTokens'>): void {
    const controller = this.#controller;
    if (controller) controller.override({ ...controller.getState().chat.overrides, ...params });
  }

  #run(job: (controller: ModelChipController) => Promise<unknown>): void {
    const controller = this.#controller;
    if (controller) void job(controller).catch((error: unknown) => controller.report(error));
  }

  /**
   * L'elenco dei modelli si carica solo a popover aperto: il selettore si monta all'apertura, si toglie alla
   * chiusura. Vale lo stato vero del popover, non `newState`: l'evento è un task asincrono e può arrivare
   * quando lo stato è già un altro (staccato e ricollegato nel frattempo, il popover è chiuso senza evento).
   */
  #onToggle(): void {
    const open = this.#parts?.popover.matches(':popover-open') ?? false;
    if (open === this.#open) return;
    this.#open = open;
    this.#loop.update();
  }

  #render(parts: Parts, controller: ModelChipController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const profile = controller.profile();
    if (!profile) {
      setText(parts.manage, t('ai.manage'));
      parts.anchor.remove();
      if (parts.manage.parentNode !== this) this.append(parts.manage);
      // Il popover tolto si chiude senza evento toggle: il selettore del modello non resta montato.
      this.#open = false;
      return;
    }
    parts.manage.remove();
    const overrides = state.chat.overrides;
    const effective = effectiveProfile(profile, overrides);
    const label = chipLabel(t, profile, overrides);
    const note = privacyNote(t, profile);
    setText(parts.label, hasOverrides(overrides) ? `${label} •` : label);
    toggleAttr(parts.chip, 'data-tooltip', true, note);
    toggleAttr(parts.chip, 'aria-label', true, `${t('ai.profile')}: ${label}`);
    setText(parts.note, note);
    const groups = profileGroups(state.profiles);
    reconcileList(
      parts.popover,
      popoverParts(groups, this.#open),
      (part: PopoverPart) => part,
      (part) => this.#createPart(parts, part),
      (node, part) => {
        if (part === 'group:local' || part === 'group:cloud') {
          const group = groups.find((g) => g.local === (part === 'group:local'))!;
          this.#renderGroup(node as HTMLFieldSetElement, group, profile.id, t);
        } else if (part === 'model') {
          const select = node as HmdAiModelSelect;
          select.controller = controller;
          select.profile = effective;
          select.i18n = i18n;
        } else if (part === 'params') {
          const params = node as HmdAiParameters;
          params.profile = effective;
          params.value = { ...profile.params, ...overrides };
          params.hideEffort = true;
          params.i18n = i18n;
        } else if (part === 'actions') {
          setText(parts.save, t('ai.saveProfile'));
          setText(parts.saveAs, t('ai.saveAs'));
          setText(parts.reset, t('ai.reset'));
          setText(parts.manageLink, t('ai.manage'));
        }
      },
    );
    // L'ancora si ricollega solo con il popover già riconciliato: un selettore rimasto dentro dalla volta
    // prima (popover aperto quando i profili sono spariti) è già fuori e non chiede l'elenco.
    if (parts.anchor.parentNode !== this) this.append(parts.anchor);
  }

  #createPart(parts: Parts, part: PopoverPart): Element {
    switch (part) {
      case 'note':
        return parts.note;
      case 'group:local':
        return parts.groups.local;
      case 'group:cloud':
        return parts.groups.cloud;
      case 'params':
        return parts.params;
      case 'actions':
        return parts.actions;
      case 'model':
        // Un selettore nuovo a ogni apertura, come il componente che React montava: riparte senza «Altro…».
        return el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (event) => this.#override(event.detail.selection) } });
    }
  }

  #renderGroup(fieldset: HTMLFieldSetElement, group: ProfileGroup, selectedId: string, t: I18nStore['t']): void {
    reconcileList(
      fieldset,
      groupRows(group),
      groupRowKey,
      (row: GroupRow) => (row.kind === 'legend' ? el('legend') : this.#createRow(row.profile)),
      (node, row) => {
        if (row.kind === 'legend') {
          setText(node, t(group.local ? 'ai.local' : 'ai.cloud'));
          return;
        }
        const entry = this.#rows.get(node)!;
        entry.profile = row.profile;
        setText(entry.name, profileName(row.profile));
        // Si scrive solo quando cambia il valore da mostrare: il clic dell'utente conta come già mostrato.
        const checked = row.profile.id === selectedId;
        if (checked !== entry.checked) {
          entry.radio.checked = checked;
          entry.checked = checked;
        }
      },
    );
  }

  #createRow(profile: ModelProfile): HTMLLabelElement {
    const entry: ProfileRow = { profile, radio: null!, name: document.createTextNode(''), checked: null };
    entry.radio = el('input', {
      type: 'radio',
      name: `${this.#id}-profile`,
      on: {
        change: () => {
          entry.checked = true;
          this.#controller?.selectProfile(entry.profile.id);
          writePref('aiProfile', entry.profile.id);
        },
      },
    });
    const label = el('label', null, entry.radio, entry.name);
    this.#rows.set(label, entry);
    return label;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-model-chip': HmdAiModelChip;
  }
}
