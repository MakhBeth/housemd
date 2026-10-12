import type { AiController } from '../../ai/aiController';
import { changeProvider } from '../../ai/models';
import { DEFAULT_URLS, defaultProfile, PROVIDER_KINDS, validateProfile } from '../../ai/profiles';
import type { ModelProfile, ProviderKind } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { MessageKey } from '../../i18n/messages';
import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../state/draftState';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdAiModelSelect } from '../ai/model-select.element';
import type { HmdAiParameters } from '../ai/parameters.element';
import { showConfirmDialog, showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { checkbox, field, showChildren, syncChecked, syncValue } from './fields';
import { renderItemList } from './itemList';
import './sections.css';

/** Quello che la sezione dei profili usa del controller (il selettore del modello compreso). */
export type ProfilesController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'provider' | 'saveProfile' | 'deleteProfile' | 'setSecret'>;

/** Provider con l'effort come opzione del profilo, e provider con una chiave. */
const EFFORT_KINDS: readonly ProviderKind[] = ['ollama', 'lmstudio', 'openai-compatible'];
const SECRET_KINDS: readonly ProviderKind[] = ['anthropic', 'openai-compatible'];

interface Detail {
  root: HTMLDivElement;
  captions: Record<'name' | 'provider' | 'url' | 'contextTokens' | 'secret', HTMLSpanElement>;
  /** Campi sempre presenti, nell'ordine della vecchia sezione React. */
  fixed: HTMLLabelElement[];
  name: HTMLInputElement;
  provider: HTMLSelectElement;
  url: HTMLInputElement;
  help: HTMLParagraphElement;
  model: HmdAiModelSelect;
  params: HmdAiParameters;
  contextTokensLabel: HTMLLabelElement;
  contextTokens: HTMLInputElement;
  effortLabel: HTMLLabelElement;
  effort: HTMLInputElement;
  effortText: Text;
  secretLabel: HTMLLabelElement;
  /** La chiave scritta: solo nel campo e qui finché non si salva, mai in attributi o nella bozza. */
  secret: HTMLInputElement;
  rememberLabel: HTMLLabelElement;
  remember: HTMLInputElement;
  rememberText: Text;
  secretNotice: HTMLParagraphElement;
  saveSecret: HTMLButtonElement;
  actions: HTMLDivElement;
  connection: HTMLButtonElement;
  duplicate: HTMLButtonElement;
  remove: HTMLButtonElement;
  save: HTMLButtonElement;
  connected: HTMLParagraphElement;
}

/**
 * Sezione dei profili nelle impostazioni (era la sezione React): elenco con «+ Crea» e dettaglio della
 * bozza con provider, indirizzo, modello (`hmd-ai-model-select`), parametri (`hmd-ai-parameters`), contesto,
 * effort, chiave e azioni. La chiave scritta resta nel campo password e va al controller solo con «Salva
 * chiave»: l'unica eccezione alla regola «gli elementi non toccano le chiavi» (architecture.test.ts).
 * Verso fuori manda solo `hmd-settings-dirty`; i dialog aperti da qui si chiudono al distacco.
 */
export class HmdSettingsProfiles extends HmdElement {
  #controller: ProfilesController | null = null;
  #i18n: I18nStore | null = null;

  #list: HTMLDivElement | null = null;
  #detail: Detail | null = null;
  #draft: DraftState<ModelProfile> = emptyDraft();
  #connected = false;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
  });

  get controller(): ProfilesController | null { return this.#controller; }
  set controller(value: ProfilesController | null) {
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

  #setDraft(next: DraftState<ModelProfile>): void {
    const was = isDirty(this.#draft);
    this.#draft = next;
    this.#loop.update();
    if (isDirty(next) !== was) emit(this, 'hmd-settings-dirty', { dirty: isDirty(next) });
  }

  #edit(patch: Partial<ModelProfile>): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, { ...draft, ...patch }));
  }

  #run(job: Promise<unknown>): void {
    void job.catch((error) => this.#controller?.report(error));
  }

  /** Apre un profilo (o un profilo nuovo): la chiave scritta e «Connesso» si dimenticano subito. */
  #pick(profile: ModelProfile | null): void {
    const t = this.#i18n?.t;
    const dirty = isDirty(this.#draft);
    this.#forgetKey();
    this.#connected = false;
    this.#setDraft(selectDraft(this.#draft, profile && { ...profile, params: { ...profile.params } }));
    const signal = this.#dialogs?.signal;
    if (!dirty || !t || !signal) return;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      if (!signal.aborted) this.#setDraft(discard ? confirmSwitch(this.#draft) : cancelSwitch(this.#draft));
    });
  }

  #forgetKey(): void {
    if (this.#detail) this.#detail.secret.value = '';
  }

  #remove(profile: ModelProfile): void {
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (!t || !signal) return;
    void showConfirmDialog({ title: t('ai.deleteTitle', { name: profile.name }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal }).then((ok) => {
      if (ok && this.#controller) this.#run(this.#controller.deleteProfile(profile.id).then(() => this.#setDraft(openDraft(this.#draft, null))));
    });
  }

  #testConnection(profile: ModelProfile): void {
    const controller = this.#controller;
    if (!controller) return;
    this.#connected = false;
    this.#loop.update();
    this.#run(
      controller.provider(profile).then(async (p) => {
        const signal = new AbortController().signal;
        if (p.testConnection) await p.testConnection(signal);
        else if ((await p.listModels(signal)) === null) throw { code: 'unreachable' };
        this.#connected = true;
        this.#loop.update();
      }),
    );
  }

  #storeKey(): void {
    const draft = this.#draft.draft;
    const controller = this.#controller;
    const detail = this.#detail;
    if (!draft || !controller || !detail) return;
    this.#run(
      controller.setSecret(validateProfile(draft), detail.secret.value, detail.remember.checked).then(() => {
        this.#forgetKey();
        this.#setDraft(openDraft(this.#draft, controller.getState().profiles.find((p) => p.id === draft.id) ?? draft));
      }),
    );
  }

  #save(): void {
    const draft = this.#draft.draft;
    if (!draft || !this.#controller) return;
    const valid = validateProfile(draft);
    this.#run(this.#controller.saveProfile(valid).then(() => this.#setDraft(openDraft(this.#draft, valid))));
  }

  #createDetail(): Detail {
    const caption = () => el('span');
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const draft = () => this.#draft.draft!;
    const captions = { name: caption(), provider: caption(), url: caption(), contextTokens: caption(), secret: caption() };
    const effortText = document.createTextNode('');
    const rememberText = document.createTextNode('');
    const contextTokens = el('input', { type: 'number', min: '1', on: { input: (e) => this.#edit({ contextTokens: value(e) ? Number(value(e)) : null }) } });
    const effort = el('input', {
      type: 'checkbox',
      on: { change: (e) => this.#edit({ params: { ...draft().params, effort: (e.currentTarget as HTMLInputElement).checked ? 'medium' : undefined } }) },
    });
    const secret = el('input', { type: 'password', autocomplete: 'off', on: { input: () => this.#loop.update() } });
    const remember = el('input', { type: 'checkbox' });
    const d: Detail = {
      root: el('div', { class: 'detail' }),
      captions,
      fixed: [],
      name: el('input', { on: { input: (e) => this.#edit({ name: value(e) }) } }),
      provider: el(
        'select',
        {
          on: {
            change: (e) => {
              const kind = value(e) as ProviderKind;
              this.#forgetKey();
              this.#setDraft(editDraft(this.#draft, { ...changeProvider(draft(), kind), baseUrl: DEFAULT_URLS[kind] }));
            },
          },
        },
        PROVIDER_KINDS.map((k) => el('option', null, k)),
      ),
      url: el('input', { type: 'url', on: { input: (e) => this.#edit({ baseUrl: value(e) }) } }),
      help: el('p', { class: 'help' }),
      model: el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (e) => this.#edit({ ...e.detail.selection }) } }),
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (e) => this.#edit({ params: e.detail.params }) } }),
      contextTokensLabel: field(captions.contextTokens, contextTokens),
      contextTokens,
      effortLabel: checkbox(effort, effortText),
      effort,
      effortText,
      secretLabel: field(captions.secret, secret),
      secret,
      rememberLabel: checkbox(remember, rememberText),
      remember,
      rememberText,
      secretNotice: el('p', { class: 'help' }),
      saveSecret: el('button', { type: 'button', on: { click: () => this.#storeKey() } }),
      actions: el('div', { class: 'actions' }),
      connection: el('button', { type: 'button', on: { click: () => this.#testConnection(draft()) } }),
      duplicate: el('button', { type: 'button', on: { click: () => this.#edit({ id: crypto.randomUUID(), secretId: null }) } }),
      remove: el('button', { type: 'button', on: { click: () => this.#remove(draft()) } }),
      save: el('button', { type: 'button', on: { click: () => this.#save() } }),
      connected: el('p', { role: 'status' }),
    };
    d.fixed = [field(captions.name, d.name), field(captions.provider, d.provider), field(captions.url, d.url)];
    d.actions.append(d.connection, d.duplicate, d.remove, d.save);
    return d;
  }

  #render(list: HTMLDivElement, controller: ProfilesController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const draft = this.#draft.draft;
    renderItemList(list, state.profiles, {
      selectedId: draft?.id ?? null,
      label: (p) => p.name,
      createLabel: t('ai.create'),
      onSelect: (p) => this.#pick(p),
      onCreate: () => this.#pick(defaultProfile('ollama', crypto.randomUUID())),
    });
    const split = list.parentElement!;
    if (!draft) {
      this.#detail?.root.remove();
      return;
    }
    const d = (this.#detail ??= this.#createDetail());
    setText(d.captions.name, t('ai.name'));
    setText(d.captions.provider, t('ai.provider'));
    setText(d.captions.url, t('ai.url'));
    setText(d.help, t(`ai.help.${draft.kind}` as MessageKey));
    setText(d.captions.contextTokens, t('ai.contextTokens'));
    setText(d.effortText, t('ai.enableEffort'));
    setText(d.captions.secret, t('ai.secret'));
    setText(d.rememberText, t('ai.remember'));
    setText(d.secretNotice, t('ai.secretNotice'));
    setText(d.saveSecret, t('ai.saveSecret'));
    setText(d.connection, t('ai.connection'));
    setText(d.duplicate, t('ai.duplicate'));
    setText(d.remove, t('ai.delete'));
    setText(d.save, t('ai.save'));
    setText(d.connected, t('ai.connected'));
    syncValue(d.name, draft.name);
    syncValue(d.provider, draft.kind);
    syncValue(d.url, draft.baseUrl);
    // Campi e pulsanti spenti come oggi: la regola «mai disabled» sulle impostazioni è della fase 8.
    d.url.disabled = draft.kind === 'anthropic';
    syncValue(d.contextTokens, draft.contextTokens === null ? '' : String(draft.contextTokens));
    syncChecked(d.effort, !!draft.params.effort);
    d.saveSecret.disabled = !d.secret.value;
    // Proprietà dei figli hmd-* prima dell'inserimento, e solo se cambiano.
    if (d.model.controller !== controller) d.model.controller = controller;
    if (d.model.i18n !== i18n) d.model.i18n = i18n;
    if (d.model.profile !== draft) d.model.profile = draft;
    if (d.params.i18n !== i18n) d.params.i18n = i18n;
    if (d.params.profile !== draft) d.params.profile = draft;
    if (d.params.value !== draft.params) d.params.value = draft.params;
    showChildren(
      d.root,
      [
        ...d.fixed,
        d.help,
        d.model,
        d.params,
        d.contextTokensLabel,
        ...(EFFORT_KINDS.includes(draft.kind) ? [d.effortLabel] : []),
        ...(SECRET_KINDS.includes(draft.kind) ? [d.secretLabel, d.rememberLabel, d.secretNotice, d.saveSecret] : []),
        d.actions,
        ...(this.#connected ? [d.connected] : []),
      ],
      [d.effortLabel, d.secretLabel, d.rememberLabel, d.secretNotice, d.saveSecret, d.connected],
    );
    if (d.root.parentNode !== split) split.append(d.root);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-profiles': HmdSettingsProfiles;
  }
}
