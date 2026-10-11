import type { SyncBinding } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../../i18n/i18n';
import { formatRoute, type SettingsSection } from '../../lib/route';
import { MAX_TEXT_WIDTH, MIN_TEXT_WIDTH, TEXT_WIDTH_PANES, type TextWidth, type TextWidthPane } from '../../lib/textWidth';
import type { I18nStore } from '../../state/i18nStore';
import type { ThemeStore } from '../../state/themeStore';
import { THEME_PREFS } from '../../theme/theme';
import { AUTOSAVE_MODES, DEFAULT_AUTOSAVE, MAX_DELAY_MS, MIN_DELAY_MS, type AutosaveSettings } from '../../workspace/autosave';
import { showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { showChildren } from './fields';
import type { HmdSettingsPresets, PresetsController } from './presets.element';
import type { HmdSettingsProfiles, ProfilesController } from './profiles.element';
import { SECTION_LABELS, commitDelay, commitWidths, sectionId, settingsSections, topSection, widthText } from './settingsView';
import type { HmdSettingsSync, SyncController } from './sync.element';
import './settings.css';

/** Quello che le impostazioni usano del controller AI: quello delle tre sezioni. */
export type SettingsController = ProfilesController & PresetsController & SyncController;

interface Parts {
  view: HTMLDivElement;
  nav: HTMLElement;
  close: HTMLButtonElement;
  title: HTMLHeadingElement;
  links: Map<SettingsSection, HTMLAnchorElement>;
  content: HTMLDivElement;
  general: HTMLElement;
  generalTitle: HTMLHeadingElement;
  languageCaption: HTMLSpanElement;
  language: HTMLSelectElement;
  themeLegend: HTMLLegendElement;
  themes: Map<string, { input: HTMLInputElement; text: Text }>;
  autosaveGroup: HTMLFieldSetElement;
  autosaveLegend: HTMLLegendElement;
  autosaves: Map<string, { input: HTMLInputElement; text: Text }>;
  delayLabel: HTMLLabelElement;
  delayCaption: HTMLSpanElement;
  delay: HTMLInputElement;
  widthLegend: HTMLLegendElement;
  widths: Record<TextWidthPane, { caption: HTMLSpanElement; input: HTMLInputElement }>;
  widthHint: HTMLParagraphElement;
  saveAll: HTMLButtonElement;
  ai: { profiles: HTMLElement; presets: HTMLElement; sync: HTMLElement; titles: HTMLHeadingElement[] };
  profiles: HmdSettingsProfiles;
  presets: HmdSettingsPresets;
  sync: HmdSettingsSync;
}

/**
 * Impostazioni a pagina, sopra l'area di lavoro (era SettingsView.tsx): indice delle sezioni, generale
 * (lingua, tema, autosalvataggio, larghezze del testo, Salva tutto) e, con il controller AI pronto, profili,
 * preset e sync. La sezione arriva dalla rotta (`section`) e si porta in vista; la voce dell'indice segue
 * lo scorrimento. Chiudere (✕, Esc, `requestClose()` quando Indietro è bloccato) conferma prima i campi e,
 * con bozze aperte, chiede se scartarle. Lingua e tema vanno direttamente ai loro store; il resto esce come
 * eventi `hmd-settings-*` verso `hmd-workspace`.
 */
export class HmdSettings extends HmdElement {
  #section: SettingsSection = 'general';
  #ai: SettingsController | null = null;
  #syncBinding: SyncBinding | null = null;
  #theme: ThemeStore | null = null;
  #autosave: AutosaveSettings = DEFAULT_AUTOSAVE;
  #textWidth: TextWidth = { editor: null, preview: null };
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Testi dei campi numerici: si confermano al blur, a Invio e alla chiusura (come lo stato di SettingsView.tsx). */
  #delayText = '';
  #widthTexts: Record<TextWidthPane, string> = { editor: '', preview: '' };
  #dirty = new Set<SettingsSection>();
  #visible: SettingsSection = 'general';
  #confirming = false;
  #observer: IntersectionObserver | null = null;
  /** Sezioni osservate (cambiano solo con il controller AI). */
  #observed: SettingsSection[] = [];
  /** Sezione e controller dell'ultimo scorrimento: si scorre solo quando cambiano (l'effetto `[section, ai]`). */
  #scrolled: { section: SettingsSection; ai: SettingsController | null } | null = null;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#theme && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#theme!, this.#i18n!),
  });

  get section(): SettingsSection { return this.#section; }
  set section(value: SettingsSection) {
    this.#section = value ?? 'general';
    this.#loop.update();
  }
  get ai(): SettingsController | null { return this.#ai; }
  set ai(value: SettingsController | null) {
    value ??= null;
    if (value === this.#ai) return;
    this.#ai = value;
    // Senza controller le sezioni AI spariscono con le loro bozze.
    if (!value) this.#dirty.clear();
    this.#loop.update();
  }
  get syncBinding(): SyncBinding | null { return this.#syncBinding; }
  set syncBinding(value: SyncBinding | null) {
    value ??= null;
    if (value === this.#syncBinding) return;
    this.#syncBinding = value;
    this.#loop.update();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) {
    value ??= null;
    if (value === this.#theme) return;
    this.#theme = value;
    this.reconnect();
  }
  get autosave(): AutosaveSettings { return this.#autosave; }
  set autosave(value: AutosaveSettings) {
    this.#autosave = value ?? DEFAULT_AUTOSAVE;
    this.#loop.update();
  }
  get textWidth(): TextWidth { return this.#textWidth; }
  set textWidth(value: TextWidth) {
    this.#textWidth = value ?? { editor: null, preview: null };
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  /** Qualche sezione ha bozze non salvate: la guardia della rotta blocca Indietro. */
  get dirty(): boolean { return this.#dirty.size > 0; }

  /** Indietro del browser bloccato dalla guardia: si chiude passando dalla conferma. */
  requestClose(): void {
    this.#close();
  }

  protected connect(signal: AbortSignal): void {
    const first = !this.#parts;
    if (first) {
      // I testi dei campi partono dai valori di adesso (come gli useState iniziali di SettingsView.tsx).
      this.#delayText = String(this.#autosave.delayMs);
      this.#widthTexts = { editor: widthText(this.#textWidth, 'editor'), preview: widthText(this.#textWidth, 'preview') };
      this.#visible = this.#section;
      this.#parts = this.#build();
      this.append(this.#parts.view);
    }
    this.#dialogs ??= new AbortController();
    const parts = this.#parts!;
    parts.content.addEventListener('hmd-settings-dirty', (event) => this.#onDirty(event), { signal });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && !document.querySelector('dialog[open]')) this.#close();
      },
      { signal },
    );
    const { theme, i18n } = { theme: this.#theme, i18n: this.#i18n };
    if (!theme || !i18n) return;
    this.watch(theme, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
    // Aprendo, il focus va sul titolo: il resto dell'app è inerte e il focus precedente andrebbe perso.
    if (first) parts.title.focus({ preventScroll: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed = [];
    this.#scrolled = null;
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  #onDirty(event: HTMLElementEventMap['hmd-settings-dirty']): void {
    const target = event.target as Element;
    const parts = this.#parts!;
    const section: SettingsSection | null = target === parts.profiles ? 'ai-profiles' : target === parts.presets ? 'ai-presets' : null;
    if (!section) return;
    if (event.detail.dirty) this.#dirty.add(section);
    else this.#dirty.delete(section);
  }

  #commitDelay(): void {
    const { text, next } = commitDelay(this.#delayText, this.#autosave);
    this.#delayText = text;
    if (this.#parts) this.#parts.delay.value = text;
    if (next) emit(this, 'hmd-settings-autosave', { autosave: next });
  }

  // Entrambi i campi insieme: chiudendo con un campo ancora a fuoco (Esc) la modifica non va persa.
  #commitWidths(): void {
    const { texts, next } = commitWidths(this.#widthTexts, this.#textWidth);
    this.#widthTexts = texts;
    if (this.#parts) for (const pane of TEXT_WIDTH_PANES) this.#parts.widths[pane].input.value = texts[pane];
    if (next) emit(this, 'hmd-settings-text-width', { textWidth: next });
  }

  #close(): void {
    this.#commitDelay();
    this.#commitWidths();
    if (this.#dirty.size === 0) return emit(this, 'hmd-settings-close', null);
    // Una conferma alla volta: «Indietro» con la conferma già aperta richiama la chiusura.
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (this.#confirming || !t || !signal) return;
    this.#confirming = true;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      this.#confirming = false;
      if (!discard || signal.aborted) return;
      // Prima di uscire: altrimenti la guardia della rotta bloccherebbe di nuovo la cronologia.
      this.#dirty.clear();
      emit(this, 'hmd-settings-close', null);
    });
  }

  #scrollTo(section: SettingsSection): void {
    this.#parts?.content.querySelector(`#${sectionId(section)}`)?.scrollIntoView({ block: 'start' });
  }

  #build(): Parts {
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const onEnter = (commit: () => void) => (event: KeyboardEvent) => {
      if (event.key === 'Enter') commit();
    };
    const radio = (name: string, v: string, onChange: () => void) => {
      const input = el('input', { type: 'radio', name, value: v, on: { change: onChange } });
      return { input, text: document.createTextNode('') };
    };
    const themes = new Map(THEME_PREFS.map((v) => [v, radio('theme', v, () => this.#theme?.setTheme(v))]));
    const autosaves = new Map(AUTOSAVE_MODES.map((mode) => [mode, radio('autosave', mode, () => emit(this, 'hmd-settings-autosave', { autosave: { ...this.#autosave, mode } }))]));
    const option = (r: { input: HTMLInputElement; text: Text }) => el('label', { class: 'option' }, r.input, r.text);
    const delayCaption = el('span');
    const delay = el('input', {
      class: 'input',
      type: 'number',
      min: String(MIN_DELAY_MS),
      max: String(MAX_DELAY_MS),
      step: '100',
      on: { input: (e) => (this.#delayText = value(e)), blur: () => this.#commitDelay(), keydown: onEnter(() => this.#commitDelay()) },
    });
    const widths = Object.fromEntries(
      TEXT_WIDTH_PANES.map((pane) => [
        pane,
        {
          caption: el('span'),
          input: el('input', {
            class: 'input',
            type: 'number',
            min: String(MIN_TEXT_WIDTH),
            max: String(MAX_TEXT_WIDTH),
            step: '1',
            on: { input: (e) => (this.#widthTexts = { ...this.#widthTexts, [pane]: value(e) }), blur: () => this.#commitWidths(), keydown: onEnter(() => this.#commitWidths()) },
          }),
        },
      ]),
    ) as Parts['widths'];
    delay.value = this.#delayText;
    for (const pane of TEXT_WIDTH_PANES) widths[pane].input.value = this.#widthTexts[pane];
    const sectionBox = (id: SettingsSection, ...children: Node[]) => el('section', { id: sectionId(id), class: 'section' }, ...children);
    const titles = [el('h2'), el('h2'), el('h2')];
    const parts: Parts = {
      view: el('div', { class: 'view', role: 'region' }),
      nav: el('nav', { class: 'nav' }),
      close: el('button', { type: 'button', class: 'iconButton tooltip', on: { click: () => this.#close() } }, icon('close')),
      title: el('h1', { tabIndex: -1 }),
      links: new Map(),
      content: el('div', { class: 'content' }),
      general: el('section', { id: sectionId('general'), class: 'section' }),
      generalTitle: el('h2'),
      languageCaption: el('span'),
      language: el(
        'select',
        { class: 'input', on: { change: (e) => void this.#i18n?.setLocale(value(e) as Locale) } },
        SUPPORTED_LOCALES.map((l) => el('option', { value: l, lang: l }, LOCALE_NAMES[l])),
      ),
      themeLegend: el('legend'),
      themes,
      autosaveGroup: el('fieldset', { class: 'group' }),
      autosaveLegend: el('legend'),
      autosaves,
      delayLabel: el('label', { class: 'field' }, delayCaption, delay),
      delayCaption,
      delay,
      widthLegend: el('legend'),
      widths,
      widthHint: el('p', { class: 'hint' }),
      saveAll: el('button', { type: 'button', class: 'secondary', on: { click: () => emit(this, 'hmd-settings-save-all', null) } }),
      ai: { profiles: el('section'), presets: el('section'), sync: el('section'), titles },
      profiles: el('hmd-settings-profiles'),
      presets: el('hmd-settings-presets'),
      sync: el('hmd-settings-sync'),
    };
    parts.ai = {
      profiles: sectionBox('ai-profiles', titles[0], parts.profiles),
      presets: sectionBox('ai-presets', titles[1], parts.presets),
      sync: sectionBox('ai-sync', titles[2], parts.sync),
      titles,
    };
    parts.autosaveGroup.append(parts.autosaveLegend, ...[...autosaves.values()].map(option));
    parts.general.append(
      parts.generalTitle,
      el('label', { class: 'field' }, parts.languageCaption, parts.language),
      el('fieldset', { class: 'group' }, parts.themeLegend, ...[...themes.values()].map(option)),
      parts.autosaveGroup,
      el('fieldset', { class: 'group' }, parts.widthLegend, ...TEXT_WIDTH_PANES.map((pane) => el('label', { class: 'field' }, widths[pane].caption, widths[pane].input)), parts.widthHint),
      parts.saveAll,
    );
    parts.content.append(parts.general);
    parts.nav.append(el('div', { class: 'navHeader' }, parts.close, parts.title));
    parts.view.append(parts.nav, parts.content);
    return parts;
  }

  #link(section: SettingsSection): HTMLAnchorElement {
    return el('a', {
      class: 'navLink',
      href: formatRoute({ view: 'settings', section }),
      on: {
        click: (event) => {
          event.preventDefault();
          emit(this, 'hmd-settings-section', { section });
          // Se la sezione è già quella della rotta non cambia nulla: si scorre direttamente.
          this.#scrollTo(section);
        },
      },
    });
  }

  #render(parts: Parts, theme: ThemeStore, i18n: I18nStore): void {
    const t = i18n.t;
    const ai = this.#ai;
    const sections = settingsSections(!!ai);
    toggleAttr(parts.view, 'aria-label', true, t('settings.title'));
    toggleAttr(parts.nav, 'aria-label', true, t('settings.sections'));
    toggleAttr(parts.close, 'aria-label', true, t('settings.close'));
    toggleAttr(parts.close, 'data-tooltip', true, t('settings.close'));
    setText(parts.title, t('settings.title'));
    // Indice: un link per sezione mostrata, dopo la testata.
    for (const section of sections) if (!parts.links.has(section)) parts.links.set(section, this.#link(section));
    for (const [section, link] of parts.links) {
      setText(link, t(SECTION_LABELS[section]));
      toggleAttr(link, 'aria-current', this.#visible === section, 'true');
    }
    showChildren(parts.nav, [parts.nav.firstElementChild!, ...sections.map((s) => parts.links.get(s)!)], [...parts.links.values()]);
    // Generale.
    setText(parts.generalTitle, t('settings.general'));
    setText(parts.languageCaption, t('settings.language'));
    if (parts.language.value !== i18n.getState().locale) parts.language.value = i18n.getState().locale;
    setText(parts.themeLegend, t('settings.theme'));
    for (const [v, r] of parts.themes) {
      setText(r.text, t(`theme.option.${v as (typeof THEME_PREFS)[number]}`));
      r.input.checked = theme.getState() === v;
    }
    setText(parts.autosaveLegend, t('settings.autosave'));
    for (const [mode, r] of parts.autosaves) {
      setText(r.text, t(`settings.autosave.${mode as (typeof AUTOSAVE_MODES)[number]}`));
      r.input.checked = this.#autosave.mode === mode;
    }
    setText(parts.delayCaption, t('settings.delay'));
    showChildren(parts.autosaveGroup, [...parts.autosaveGroup.children].filter((c) => c !== parts.delayLabel).concat(this.#autosave.mode === 'afterDelay' ? [parts.delayLabel] : []), [parts.delayLabel]);
    setText(parts.widthLegend, t('settings.textWidth'));
    for (const pane of TEXT_WIDTH_PANES) {
      setText(parts.widths[pane].caption, t(`settings.textWidth.${pane}`));
      toggleAttr(parts.widths[pane].input, 'placeholder', true, t('settings.textWidth.none'));
    }
    setText(parts.widthHint, t('settings.textWidth.hint', { min: MIN_TEXT_WIDTH, max: MAX_TEXT_WIDTH }));
    setText(parts.saveAll, t('settings.saveAll'));
    // Sezioni AI: proprietà prima dell'inserimento, solo se cambiano.
    parts.ai.titles.forEach((h2, i) => setText(h2, t(SECTION_LABELS[(['ai-profiles', 'ai-presets', 'ai-sync'] as const)[i]])));
    if (ai) {
      for (const child of [parts.profiles, parts.presets]) {
        if (child.controller !== ai) child.controller = ai;
        if (child.i18n !== i18n) child.i18n = i18n;
      }
      if (parts.sync.controller !== ai) parts.sync.controller = ai;
      if (parts.sync.binding !== this.#syncBinding) parts.sync.binding = this.#syncBinding;
      if (parts.sync.i18n !== i18n) parts.sync.i18n = i18n;
    }
    showChildren(parts.content, [parts.general, ...(ai ? [parts.ai.profiles, parts.ai.presets, parts.ai.sync] : [])], [parts.ai.profiles, parts.ai.presets, parts.ai.sync]);
    this.#observe(parts, sections);
    // Entrando (o cambiando sezione dalla rotta) si scorre alla sezione; anche quando compaiono le sezioni AI.
    if (this.#scrolled?.section !== this.#section || this.#scrolled.ai !== ai) {
      this.#scrolled = { section: this.#section, ai };
      this.#scrollTo(this.#section);
    }
  }

  /** La voce dell'indice segue la sezione visibile mentre si scorre (un observer per insieme di sezioni). */
  #observe(parts: Parts, sections: SettingsSection[]): void {
    if (this.#observer && this.#observed.join() === sections.join()) return;
    this.#observer?.disconnect();
    this.#observed = sections;
    if (typeof IntersectionObserver === 'undefined') return;
    this.#observer = new IntersectionObserver(
      (entries) => {
        const top = topSection(entries.map((e) => ({ id: e.target.id, top: e.boundingClientRect.top, intersecting: e.isIntersecting })), this.#observed);
        if (!top || top === this.#visible) return;
        this.#visible = top;
        this.#loop.update();
      },
      { root: parts.content, rootMargin: '0px 0px -60% 0px' },
    );
    parts.content.querySelectorAll('section[id^="settings-"]').forEach((section) => this.#observer!.observe(section));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings': HmdSettings;
  }
}
