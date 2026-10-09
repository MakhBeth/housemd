import { rm } from 'node:fs/promises';

import { chromium, test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { translate, type Params } from '../../src/i18n/i18n.ts';
import { FakeModel } from './aiHarness.ts';
import {
  DEFAULT_FLAGS, FLAGS_KEY, harnessScript, pathExists, readText, removePath, seedFolder,
  type HarnessFlags, type Seed,
} from './fsHarness.ts';
import { messagesFor, type E2ELocale } from './i18n.ts';

type SaveKey = 'save.saved' | 'save.dirty' | 'save.saving' | 'save.error' | 'save.deleted';
type ModeKey = 'mode.editor' | 'mode.split' | 'mode.preview' | 'mode.ai';

/** Tutto ciò che le spec sanno dell'app: ruoli, nomi accessibili e disco. Niente classi CSS. */
export class App {
  folder: string = DEFAULT_FLAGS.folder;

  constructor(
    readonly page: Page,
    readonly locale: E2ELocale,
  ) {}

  t(key: string, params?: Params): string {
    return translate(messagesFor(this.locale), key, params);
  }

  async start(): Promise<void> {
    await this.page.goto('/');
  }

  /** Apre l'app, prepara la cartella nell'OPFS, la sceglie dal "selettore" e aspetta l'albero. */
  async openFolder(files: Seed, folder: string = DEFAULT_FLAGS.folder): Promise<void> {
    await this.start();
    await seedFolder(this.page, folder, files);
    await this.setFlags({ folder });
    await this.page.getByRole('button', { name: this.t('start.openFolder') }).click();
    await expect(this.tree()).toBeVisible();
  }

  async setFlags(flags: Partial<HarnessFlags>): Promise<void> {
    if (flags.folder) this.folder = flags.folder;
    await this.page.evaluate(
      ({ key, flags }) => {
        const current = JSON.parse(localStorage.getItem(key) ?? '{}') as object;
        localStorage.setItem(key, JSON.stringify({ ...current, ...flags }));
      },
      { key: FLAGS_KEY, flags },
    );
  }

  tree(): Locator {
    return this.page.getByRole('navigation', { name: this.t('tree.label') });
  }

  treeFile(name: string): Locator {
    return this.tree().getByRole('button', { name, exact: true });
  }

  /** Un file con bozza ha nel nome anche l'indicatore `tree.draft` (role="img" dentro il pulsante). */
  treeFileWithDraft(name: string): Locator {
    return this.tree().getByRole('button', { name: `${name} ${this.t('tree.draft')}`, exact: true });
  }

  async openFile(name: string): Promise<void> {
    await this.treeFile(name).click();
    await this.expectOpen(name);
  }

  /**
   * Crea e salva un profilo AI dalle impostazioni, poi le chiude. Il profilo non viene selezionato:
   * si sceglie dal chip del modello. Un profilo Anthropic senza chiave basta per i chip (niente rete).
   */
  async createProfile(kind: 'anthropic' | 'ollama', name: string): Promise<void> {
    const settings = this.page.getByRole('region', { name: this.t('settings.title') });
    await this.page.getByRole('button', { name: this.t('toolbar.settings') }).click();
    await settings.getByRole('link', { name: this.t('settings.aiProfiles') }).click();
    // La sezione dei profili è la prima sezione AI: «+ Create» e i campi sono i primi.
    await settings.getByRole('button', { name: `+ ${this.t('ai.create')}` }).first().click();
    await settings.getByLabel(this.t('ai.name'), { exact: true }).first().fill(name);
    await settings.getByRole('combobox', { name: this.t('ai.provider'), exact: true }).first().selectOption(kind);
    await settings.getByRole('button', { name: this.t('ai.save'), exact: true }).first().click();
    await expect(settings.getByRole('button', { name, exact: true })).toBeVisible();
    await settings.getByRole('button', { name: this.t('settings.close') }).click();
    await expect(settings).toHaveCount(0);
  }

  /** Il file aperto è quello con aria-current="page" nell'albero. */
  async expectOpen(name: string): Promise<void> {
    await expect(this.treeFile(name)).toHaveAttribute('aria-current', 'page');
  }

  modes(): Locator {
    return this.page.getByRole('group', { name: this.t('toolbar.modes') });
  }

  /** Pulsante di una modalità. "AI" compare solo quando il controller AI è pronto. */
  mode(key: ModeKey): Locator {
    return this.modes().getByRole('button', { name: this.t(key), exact: true });
  }

  editorPane(): Locator {
    return this.page.getByRole('region', { name: this.t('pane.editor') });
  }

  /** Il contenuto editabile di CodeMirror (role="textbox"). */
  editor(): Locator {
    return this.editorPane().getByRole('textbox');
  }

  previewPane(): Locator {
    return this.page.getByRole('region', { name: this.t('pane.preview') });
  }

  async typeAtEnd(text: string): Promise<void> {
    await this.editor().click();
    await this.page.keyboard.press('ControlOrMeta+End');
    await this.page.keyboard.type(text);
  }

  /**
   * Seleziona nell'editor i caratteri [from, to) del documento, solo con la tastiera (niente API di
   * CodeMirror: in produzione non sono raggiungibili). Il documento non deve avere righe a capo morbido.
   */
  async selectRange(from: number, to: number): Promise<void> {
    await this.editor().click();
    await this.page.keyboard.press('ControlOrMeta+Home');
    for (let i = 0; i < from; i++) await this.page.keyboard.press('ArrowRight');
    for (let i = from; i < to; i++) await this.page.keyboard.press('Shift+ArrowRight');
  }

  saveState(key: SaveKey): Locator {
    return this.page.getByText(this.t(key), { exact: true });
  }

  toast(text: string): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  disk(path: string): Promise<string | null> {
    return readText(this.page, this.folder, path);
  }

  exists(path: string): Promise<boolean> {
    return pathExists(this.page, this.folder, path);
  }

  writeExternal(path: string, text: string): Promise<void> {
    return seedFolder(this.page, this.folder, { [path]: text });
  }

  removeExternal(path: string): Promise<void> {
    return removePath(this.page, this.folder, path);
  }

  /** La finestra torna in primo piano: l'app controlla le modifiche esterne. */
  async windowFocus(): Promise<void> {
    await this.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  }
}

/** Opzioni impostabili dalla configurazione (`use`). */
export interface AppOptions {
  /** Ogni errore o avviso in console fa fallire il test: per la suite in sviluppo, dove React avvisa lì. */
  failOnConsole: boolean;
}

export const test = base.extend<{ flags: Partial<HarnessFlags>; appLocale: E2ELocale; ai: FakeModel; app: App } & AppOptions>({
  /**
   * Contesto persistente con il profilo su disco, uno nuovo per test. Nei contesti normali (in memoria)
   * Chromium rifiuta le scritture OPFS con QuotaExceededError quando la RAM libera scende, anche con
   * la quota quasi vuota: su disco il problema sparisce. Le opzioni di `use` vanno passate a mano.
   */
  context: async (
    { baseURL, viewport, locale, timezoneId, reducedMotion, forcedColors, serviceWorkers, colorScheme, userAgent, headless, launchOptions },
    use,
    testInfo,
  ) => {
    const dir = testInfo.outputPath('profile');
    const context: BrowserContext = await chromium.launchPersistentContext(dir, {
      ...launchOptions,
      headless,
      baseURL,
      viewport,
      locale,
      timezoneId,
      reducedMotion,
      forcedColors,
      serviceWorkers,
      colorScheme,
      userAgent,
      deviceScaleFactor: 1,
    });
    for (const page of context.pages()) await page.close();
    await use(context);
    // Con il profilo persistente Playwright chiude un browser intero; a volte la pipe verso il processo è
    // già chiusa e Node risponde EIO. Il test è già finito: si ignora solo quell'errore.
    await context.close().catch((error: unknown) => {
      if (!String(error).includes('EIO')) throw error;
    });
    await rm(dir, { recursive: true, force: true });
  },
  flags: [{}, { option: true }],
  appLocale: ['en', { option: true }],
  failOnConsole: [false, { option: true }],
  // Sempre installato: senza, l'app proverebbe a contattare un Ollama vero sulla macchina che esegue i test.
  ai: async ({ page }, use) => {
    const model = new FakeModel();
    await model.install(page);
    await use(model);
  },
  app: async ({ page, flags, appLocale, ai, failOnConsole }, use) => {
    void ai;
    await page.addInitScript(harnessScript, { defaults: { ...DEFAULT_FLAGS, ...flags }, key: FLAGS_KEY });
    await page.addInitScript((locale) => {
      if (localStorage.getItem('housemd:locale') === null) localStorage.setItem('housemd:locale', JSON.stringify(locale));
    }, appLocale);
    // Con modifiche non salvate l'app chiede conferma prima di uscire: nei test si accetta sempre.
    page.on('dialog', (dialog) => void (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
    // Come il vecchio collaudo CDP: qualsiasi eccezione non gestita nella pagina fa fallire il test.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
    await use(new App(page, appLocale));
    expect(errors, 'eccezioni non gestite nella pagina').toEqual([]);
    if (failOnConsole) expect(consoleProblems, 'errori o avvisi in console').toEqual([]);
  },
});

export { expect };
