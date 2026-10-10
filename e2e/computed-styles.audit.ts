import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

import type { FakeModel } from './support/aiHarness.ts';
import { expect, test, type App } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
import { NOTE, NOW } from './support/notes.ts';
import { dumpComputedStyles, styleDifferences, type StyleDump } from './support/styleAudit.ts';

/**
 * Audit degli stili calcolati (spec WC fase 2): ogni stato gira prima sulla build di riferimento
 * (progetto `baseline`, dist-baseline/) e poi sulla build corrente (progetto `current`), che deve dare
 * gli stessi valori per ogni proprietà di ogni elemento. Copre ciò che gli snapshot non fotografano:
 * focus da tastiera, forced-colors, tooltip al passaggio. Uso: e2e/audit.config.ts.
 */

const OUT = fileURLToPath(new URL('../test-results/style-audit/', import.meta.url));

interface State {
  name: string;
  scheme?: 'light' | 'dark';
  forcedColors?: boolean;
  /** Il mouse resta dove l'ha lasciato lo stato (tooltip al passaggio). */
  keepMouse?: boolean;
  setup(app: App, page: Page, ai: FakeModel): Promise<void>;
}

async function workspace(app: App): Promise<void> {
  await app.openFolder({ 'note.md': NOTE, 'docs/guide.md': '# Guide' });
  await app.openFile('note.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
}

async function searchFromKeyboard(app: App, page: Page): Promise<void> {
  await workspace(app);
  // Come focus-ring.spec.ts: dopo il dialog l'ultima interazione è la tastiera.
  await page.getByRole('button', { name: app.t('folder.new') }).first().click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('searchbox', { name: app.t('search.label') })).toBeFocused();
}

const STATES: State[] = [
  { name: 'start-light', setup: (app) => app.start() },
  { name: 'start-dark', scheme: 'dark', setup: (app) => app.start() },
  {
    name: 'start-theme-light',
    scheme: 'dark',
    async setup(app, page) {
      // Tema chiaro esplicito con il sistema scuro: deve vedersi il logo in negativo.
      await page.addInitScript(() => localStorage.setItem('housemd:theme', JSON.stringify('light')));
      await app.start();
      await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
    },
  },
  {
    name: 'start-resume',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'alpha' });
      await app.setFlags({ query: 'prompt', request: 'granted' });
      await page.reload();
      await expect(page.getByRole('button', { name: app.t('start.openOther') })).toBeVisible();
    },
  },
  { name: 'workspace-light', setup: workspace },
  { name: 'workspace-dark', scheme: 'dark', setup: workspace },
  {
    name: 'preview-card',
    async setup(app) {
      await app.openFolder({
        'note.md': [
          '---', 'title: Card', 'date: 2026-01-15', 'tags: [alpha, beta]', 'description: A short description',
          'image: assets/pixel.png', 'author: Ada', '---', '# Heading', '', '![pixel](assets/pixel.png)', '',
          '![missing](missing.png)', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', '---', '', '[outside](https://example.com)',
        ].join('\n'),
        'assets/pixel.png': { base64: PIXEL_PNG_BASE64 },
      });
      await app.openFile('note.md');
      const preview = app.previewPane();
      await expect(preview.getByRole('heading', { name: 'Heading' })).toBeVisible();
      await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute('title', app.t('preview.imageMissing', { path: 'missing.png' }));
      await expect(preview.locator('img[src^="blob:"]')).toHaveCount(2);
    },
  },
  {
    name: 'preview-frontmatter-invalid',
    async setup(app) {
      await app.openFolder({ 'bad.md': '---\ntitle: [\n---\nbody' });
      await app.openFile('bad.md');
      const prefix = app.t('preview.frontmatterInvalid', { detail: '' }).trim();
      await expect(app.previewPane().getByText(prefix)).toBeVisible();
    },
  },
  {
    name: 'settings',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await expect(page.getByRole('region', { name: app.t('settings.title') })).toBeVisible();
    },
  },
  {
    name: 'settings-profile',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: 'ollama', exact: true }).click();
      await expect(settings.getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
    },
  },
  {
    name: 'model-popover',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
    },
  },
  {
    name: 'ai-suggestions',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByRole('group', { name: app.t('ai.suggestions') })).toBeVisible();
    },
  },
  {
    name: 'effort-chip',
    async setup(app, page) {
      await page.route('https://api.anthropic.com/**', (route) => route.abort());
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.createProfile('anthropic', 'Cloud');
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await page.getByRole('radio', { name: 'Cloud' }).check();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('combobox', { name: app.t('ai.param.effort') })).toBeVisible();
    },
  },
  {
    name: 'ai-review',
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
    },
  },
  {
    name: 'editor-mode',
    async setup(app) {
      await app.openFolder({ 'note.md': NOTE });
      await app.openFile('note.md');
      await app.mode('mode.editor').click();
      await expect(app.previewPane()).toHaveCount(0);
      await expect(app.editor()).toBeVisible();
    },
  },
  {
    name: 'ai-review-empty',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A\n\nB' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByText(app.t('ai.emptyProposal'))).toBeVisible();
    },
  },
  {
    name: 'ai-review-hover',
    keepMouse: true,
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      // Pulsante «rifiuta» del primo blocco (eccezione .cm-merge-revert della spec §8.4): sfondo e tooltip al passaggio.
      const reject = page.locator('.cm-merge-revert button[data-action=reject]').first();
      await reject.hover();
      await expect.poll(() => reject.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'ai-review-conflict',
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await page.clock.install();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      // Modifica locale non salvata nel documento (lato sinistro del diff) e modifica esterna: conflitto,
      // e i pulsanti «accetta» dei blocchi si disattivano (stile :disabled).
      await page.clock.pauseAt(new Date(Date.now() + 10_000));
      await page.locator('.cm-mergeView .cm-content').first().click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type('!');
      await page.clock.runFor(100);
      await app.writeExternal('a.md', 'theirs');
      await app.windowFocus();
      await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
      await expect(page.locator('.cm-merge-revert button[data-action=accept]').first()).toBeDisabled();
    },
  },
  {
    name: 'ai-chat-error',
    async setup(app, page, ai) {
      ai.status = 500;
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      const log = page.getByRole('log');
      await expect(log.getByRole('button', { name: app.t('ai.retry'), exact: true })).toBeVisible();
      // Metadati della risposta visibili con il focus sul messaggio (:focus-within).
      await log.getByRole('article').last().focus();
    },
  },
  {
    name: 'ai-chat-summary',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('group', { name: app.t('ai.suggestions') }).getByRole('button').first().click();
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      // Il riepilogo di un preset: «parti · parole → parole words».
      await expect(page.getByRole('log').getByText(new RegExp(`${app.t('ai.words')}$`))).toBeVisible();
    },
  },
  {
    name: 'tree-menu',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
      await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
      await expect(page.getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeVisible();
    },
  },
  {
    name: 'name-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('file.new') }).first().click();
      await page.getByRole('dialog', { name: app.t('file.new') }).getByRole('textbox').fill('draft');
    },
  },
  {
    name: 'name-dialog-error',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('file.new') }).first().click();
      const dialog = page.getByRole('dialog', { name: app.t('file.new') });
      await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
      await expect(dialog.getByText(app.t('name.error.empty'))).toBeVisible();
    },
  },
  {
    name: 'confirm-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
      await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
      await expect(page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) })).toBeVisible();
    },
  },
  {
    name: 'unsaved-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
      await settings.getByLabel(app.t('ai.name'), { exact: true }).first().fill('Bozza');
      await settings.getByRole('button', { name: app.t('settings.close') }).click();
      await expect(page.getByRole('dialog', { name: app.t('ai.unsavedTitle') })).toBeVisible();
    },
  },
  {
    name: 'access-lost-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await app.openFile('note.md');
      await app.setFlags({ denyWrites: true, request: 'denied' });
      await app.typeAtEnd('x');
      const dialog = page.getByRole('dialog', { name: app.t('access.title') });
      await dialog.getByRole('button', { name: app.t('access.resume') }).click();
      await expect(dialog.getByText(app.t('access.denied'))).toBeVisible();
    },
  },
  {
    name: 'toast',
    async setup(app) {
      await app.openFolder({ 'note.md': '# Note', '.housemd.json': '{ images: ' });
      const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
      await expect(app.toast(prefix)).toBeVisible();
    },
  },
  {
    name: 'conflict',
    async setup(app, page) {
      await page.clock.install();
      await app.openFolder({ 'note.md': '# Note\n' });
      await app.openFile('note.md');
      await page.clock.pauseAt(new Date(Date.now() + 10_000));
      await app.typeAtEnd('mine');
      await page.clock.runFor(100);
      await app.writeExternal('note.md', 'theirs, longer text');
      await app.windowFocus();
      await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
    },
  },
  {
    name: 'history',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await app.editor().click();
      await page.keyboard.press('ControlOrMeta+a');
      // CodeMirror disegna il livello della selezione nel fotogramma successivo: se si digita subito il
      // livello resta mai disegnato (display diverso) o disegnato e poi svuotato, a seconda della corsa.
      await page.waitForTimeout(100);
      await page.keyboard.type('v1');
      await page.waitForTimeout(100);
      await page.keyboard.press('ControlOrMeta+s');
      await expect.poll(() => app.disk('note.md')).toBe('v1');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      const panel = page.getByRole('region', { name: app.t('toolbar.history') });
      await panel.getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).first().click();
      await page.clock.pauseAt(NOW.getTime() + 60_000);
    },
  },
  {
    name: 'tooltip-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'uno due tre' });
      await app.openFile('a.md');
      await app.selectRange(4, 7);
      const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
      await bold.hover();
      await expect.poll(() => bold.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'focus-button-keyboard',
    async setup(app, page) {
      await workspace(app);
      const button = page.getByRole('button', { name: app.t('folder.new') }).first();
      await button.click();
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
    },
  },
  { name: 'focus-search-keyboard', setup: searchFromKeyboard },
  {
    name: 'focus-search-pointer',
    async setup(app, page) {
      await workspace(app);
      const search = page.getByRole('searchbox', { name: app.t('search.label') });
      await search.click();
      await expect(search).toBeFocused();
    },
  },
  { name: 'focus-search-keyboard-forced-colors', forcedColors: true, setup: searchFromKeyboard },
];

for (const state of STATES) {
  test.describe(state.name, () => {
    test.use({ colorScheme: state.scheme ?? 'light', forcedColors: state.forcedColors ? 'active' : 'none' });

    test('computed styles match the baseline build', async ({ app, page, ai }, testInfo) => {
      await state.setup(app, page, ai);
      // Come visual.spec.ts: niente tooltip sotto il puntatore, transizioni di 0,15 s finite, font pronti.
      if (!state.keepMouse) await page.mouse.move(1279, 799);
      await page.waitForTimeout(300);
      // Transizioni davvero concluse: niente opacità a metà (le animazioni infinite non contano).
      await expect
        .poll(() => page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSTransition).length))
        .toBe(0);
      // I font dei tooltip nascosti si caricano a layout fatto: li si carica tutti, o la larghezza del
      // testo dipende da quanto è veloce il caricamento.
      await page.evaluate(async () => {
        await Promise.all([...document.fonts].map((face) => face.load()));
        await document.fonts.ready;
      });
      // Il cursore di CodeMirror lampeggia con un'animazione infinita (opacità guidata dal tempo): la si
      // ferma all'inizio, così il valore letto è lo stesso su entrambe le build.
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          if (animation instanceof CSSAnimation) {
            animation.pause();
            animation.currentTime = 0;
          }
        }
      });
      // Il gutter di CodeMirror prende l'altezza da una misura che a volte resta di 1 px più bassa: un
      // ridimensionamento della finestra (e ritorno) la rifà sempre.
      await page.setViewportSize({ width: 1280, height: 799 });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(100);
      // CodeMirror misura le altezze in modo asincrono (a volte di 1 px): si legge finché due letture
      // consecutive coincidono, fino a un massimo di dieci tentativi. Se non si stabilizza lo stato
      // fallisce: un audit che confronta una lettura instabile non prova nulla.
      let dump = await page.evaluate(dumpComputedStyles);
      let settled = false;
      let lastDifferences = 0;
      for (let attempt = 0; attempt < 10 && !settled; attempt++) {
        await page.waitForTimeout(100);
        const next = await page.evaluate(dumpComputedStyles);
        lastDifferences = styleDifferences(dump, next).length;
        settled = lastDifferences === 0;
        dump = next;
      }
      expect(settled, `stato "${state.name}" non stabile dopo 10 letture: ${lastDifferences} differenze tra le ultime due`).toBe(true);

      const file = join(OUT, `${state.name}.json`);
      if (testInfo.project.name === 'baseline') {
        await mkdir(OUT, { recursive: true });
        await writeFile(file, JSON.stringify(dump));
        return;
      }
      const before = JSON.parse(await readFile(file, 'utf8')) as StyleDump;
      const diff = styleDifferences(before, dump);
      expect(diff.slice(0, 40), `${diff.length} differenze rispetto a dist-baseline/`).toEqual([]);
    });
  });
}
