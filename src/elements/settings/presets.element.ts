import type { AiController } from '../../ai/aiController';
import { presetLabel } from '../../ai/presetName';
import { builtInPresets, restorePreset } from '../../ai/presets';
import { defaultProfile } from '../../ai/profiles';
import type { PromptPreset } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../state/draftState';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdAiParameters } from '../ai/parameters.element';
import { showConfirmDialog, showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { checkbox, field, syncChecked, syncValue } from './fields';
import { renderItemList } from './itemList';
import './sections.css';

/** Quello che la sezione dei preset usa del controller. */
export type PresetsController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'savePreset' | 'deletePreset'>;

const STRATEGIES = ['whole', 'chunked'] as const;
const FRONTMATTER = ['keep', 'include'] as const;

interface Detail {
  root: HTMLDivElement;
  captions: Record<'name' | 'instructions' | 'targetLanguage' | 'strategy' | 'frontmatter' | 'order', HTMLSpanElement>;
  name: HTMLInputElement;
  instructions: HTMLTextAreaElement;
  targetLanguage: HTMLInputElement;
  strategy: HTMLSelectElement;
  frontmatter: HTMLSelectElement;
  order: HTMLInputElement;
  hidden: HTMLInputElement;
  hiddenText: Text;
  params: HmdAiParameters;
  duplicate: HTMLButtonElement;
  restore: HTMLButtonElement;
  remove: HTMLButtonElement;
  save: HTMLButtonElement;
}

/**
 * Sezione dei preset nelle impostazioni (era AiPresetsSection.tsx): elenco ordinato con «+ Crea», dettaglio
 * della bozza aperta. Passare a un altro preset con modifiche aperte chiede conferma; eliminare chiede
 * conferma. Verso fuori manda solo `hmd-settings-dirty` quando la bozza diventa (o smette di essere) da
 * salvare; i dialog aperti da qui si chiudono al distacco.
 */
export class HmdSettingsPresets extends HmdElement {
  #controller: PresetsController | null = null;
  #i18n: I18nStore | null = null;

  #list: HTMLDivElement | null = null;
  #detail: Detail | null = null;
  #draft: DraftState<PromptPreset> = emptyDraft();
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
  });

  get controller(): PresetsController | null { return this.#controller; }
  set controller(value: PresetsController | null) {
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
  /** La bozza aperta ha modifiche non salvate. */
  get dirty(): boolean { return isDirty(this.#draft); }

  protected connect(signal: AbortSignal): void {
    if (!this.#list) {
      this.#list = el('div', { class: 'list' });
      this.append(el('div', { class: 'split' }, this.#list));
    }
    this.#dialogs ??= new AbortController();
    // Un campo riallineato quando perde il focus (mai riscritto mentre lo ha).
    this.addEventListener('focusout', () => queueMicrotask(() => this.#loop.update()), { signal });
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Stato salvato e disegnato prima di dire fuori che la bozza è cambiata. */
  #setDraft(next: DraftState<PromptPreset>): void {
    const was = isDirty(this.#draft);
    this.#draft = next;
    this.#loop.update();
    if (isDirty(next) !== was) emit(this, 'hmd-settings-dirty', { dirty: isDirty(next) });
  }

  #edit(patch: Partial<PromptPreset>): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, { ...draft, ...patch }));
  }

  #run(job: Promise<unknown>): void {
    void job.catch((error) => this.#controller?.report(error));
  }

  #choose(preset: PromptPreset): void {
    const t = this.#i18n?.t;
    const dirty = isDirty(this.#draft);
    this.#setDraft(selectDraft(this.#draft, preset));
    const signal = this.#dialogs?.signal;
    if (!dirty || !t || !signal) return;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      if (!signal.aborted) this.#setDraft(discard ? confirmSwitch(this.#draft) : cancelSwitch(this.#draft));
    });
  }

  #remove(preset: PromptPreset): void {
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (!t || !signal) return;
    const name = presetLabel(preset, t);
    void showConfirmDialog({ title: t('ai.deleteTitle', { name }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal }).then((ok) => {
      if (ok && this.#controller) this.#run(this.#controller.deletePreset(preset.id).then(() => this.#setDraft(openDraft(this.#draft, null))));
    });
  }

  #createDetail(): Detail {
    const caption = () => el('span');
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const captions = { name: caption(), instructions: caption(), targetLanguage: caption(), strategy: caption(), frontmatter: caption(), order: caption() };
    const detail: Detail = {
      root: el('div', { class: 'detail' }),
      captions,
      name: el('input', { on: { input: (e) => this.#edit({ name: value(e) }) } }),
      instructions: el('textarea', { on: { input: (e) => this.#edit({ instructions: value(e) }) } }),
      targetLanguage: el('input', { on: { input: (e) => this.#edit({ variables: { targetLanguage: value(e) } }) } }),
      strategy: el('select', { on: { change: (e) => this.#edit({ strategy: value(e) as PromptPreset['strategy'] }) } }, STRATEGIES.map((v) => el('option', { value: v }))),
      frontmatter: el('select', { on: { change: (e) => this.#edit({ frontmatter: value(e) as PromptPreset['frontmatter'] }) } }, FRONTMATTER.map((v) => el('option', { value: v }))),
      order: el('input', { type: 'number', min: '0', on: { input: (e) => this.#edit({ order: Math.max(0, Number(value(e)) || 0) }) } }),
      hidden: el('input', { type: 'checkbox', on: { change: (e) => this.#edit({ hidden: (e.currentTarget as HTMLInputElement).checked }) } }),
      hiddenText: document.createTextNode(''),
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (e) => this.#edit({ params: e.detail.params }) } }),
      duplicate: el('button', { type: 'button', on: { click: () => this.#duplicate() } }),
      restore: el('button', { type: 'button', on: { click: () => this.#restore() } }),
      remove: el('button', { type: 'button', on: { click: () => this.#draft.draft && this.#remove(this.#draft.draft) } }),
      save: el('button', { type: 'button', on: { click: () => this.#save() } }),
    };
    detail.params.profile = defaultProfile();
    detail.root.append(
      field(captions.name, detail.name),
      field(captions.instructions, detail.instructions),
      field(captions.targetLanguage, detail.targetLanguage),
      field(captions.strategy, detail.strategy),
      field(captions.frontmatter, detail.frontmatter),
      field(captions.order, detail.order),
      checkbox(detail.hidden, detail.hiddenText),
      detail.params,
      el('div', { class: 'actions' }, detail.duplicate, detail.restore, detail.save),
    );
    return detail;
  }

  #duplicate(): void {
    const draft = this.#draft.draft;
    const t = this.#i18n?.t;
    if (draft && t) this.#edit({ id: crypto.randomUUID(), builtInId: undefined, name: presetLabel(draft, t) });
  }

  #restore(): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, restorePreset(draft)));
  }

  #save(): void {
    const draft = this.#draft.draft;
    if (draft && this.#controller) this.#run(this.#controller.savePreset(draft).then(() => this.#setDraft(openDraft(this.#draft, draft))));
  }

  #render(list: HTMLDivElement, controller: PresetsController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const draft = this.#draft.draft;
    const sorted = [...state.presets].sort((a, b) => a.order - b.order);
    renderItemList(list, sorted, {
      selectedId: draft?.id ?? null,
      label: (p) => presetLabel(p, t),
      createLabel: t('ai.create'),
      onSelect: (p) => this.#choose({ ...p }),
      onCreate: () => this.#choose({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: controller.getState().presets.length }),
    });
    const split = list.parentElement!;
    if (!draft) {
      this.#detail?.root.remove();
      return;
    }
    const d = (this.#detail ??= this.#createDetail());
    setText(d.captions.name, t('ai.name'));
    setText(d.captions.instructions, t('ai.instructions'));
    setText(d.captions.targetLanguage, t('ai.targetLanguage'));
    setText(d.captions.strategy, t('ai.strategy'));
    setText(d.captions.frontmatter, t('ai.frontmatter'));
    setText(d.captions.order, t('ai.order'));
    [...d.strategy.options].forEach((o) => setText(o, t(`ai.strategy.${o.value as (typeof STRATEGIES)[number]}`)));
    [...d.frontmatter.options].forEach((o) => setText(o, t(`ai.frontmatter.${o.value as (typeof FRONTMATTER)[number]}`)));
    setText(d.hiddenText, t('ai.hidden'));
    setText(d.duplicate, t('ai.duplicate'));
    setText(d.restore, t('ai.restoreOriginal'));
    setText(d.remove, t('ai.delete'));
    setText(d.save, t('ai.save'));
    syncValue(d.name, draft.name);
    syncValue(d.instructions, draft.instructions);
    syncValue(d.targetLanguage, draft.variables?.targetLanguage ?? '');
    syncValue(d.strategy, draft.strategy);
    syncValue(d.frontmatter, draft.frontmatter);
    syncValue(d.order, String(draft.order));
    syncChecked(d.hidden, draft.hidden);
    const params = draft.params ?? {};
    if (d.params.i18n !== i18n) d.params.i18n = i18n;
    if (d.params.value !== params) d.params.value = params;
    // Ripristina (preset predefinito) o Elimina, nello stesso posto.
    const second = draft.builtInId ? d.restore : d.remove;
    const other = draft.builtInId ? d.remove : d.restore;
    if (second.parentNode !== d.save.parentNode) d.save.before(second);
    other.remove();
    if (d.root.parentNode !== split) split.append(d.root);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-presets': HmdSettingsPresets;
  }
}
