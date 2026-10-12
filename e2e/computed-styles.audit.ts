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
  /** Larghezza della finestra (default 1280): per i layout stretti (`@media (width < 700px)`). */
  width?: number;
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
      await expect(page.locator('.cm-mergeView')).toBeVisible(); // la proposta è arrivata (non «Accetta tutto attivo»: dalla 6c passerebbe subito)
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
      await expect(page.locator('.cm-mergeView')).toBeVisible(); // la proposta è arrivata (non «Accetta tutto attivo»: dalla 6c passerebbe subito)
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
    name: 'ai-review-generating',
    async setup(app, page, ai) {
      // Generazione senza ancora una proposta: la barra con il contatore al posto del suggerimento, tutti i pulsanti attivi (dalla 6c).
      await page.clock.install({ time: NOW });
      ai.hold();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
      // Il contatore parte dal Date.now() della richiesta, non da NOW: si avanza di 2,1 s da lì e si ferma l'orologio sul valore raggiunto.
      await page.clock.runFor(2100);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
      await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
    },
  },
  {
    name: 'ai-review-truncated',
    async setup(app, page, ai) {
      // Proposta troncata dal limite del modello: stato «Troncata», Accetta tutto attivo (dalla 6c: la nota al clic).
      ai.reply = 'A2\n\nB\n\nC2';
      ai.finishReason = 'length';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByText(app.t('ai.status.truncated'))).toBeVisible();
    },
  },
  {
    name: 'ai-review-warnings',
    async setup(app, page, ai) {
      // Il popover degli avvisi aperto sotto il suo pulsante.
      ai.reply = 'See [[Other]]';
      await app.openFolder({ 'a.md': 'See [[Target]]' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await page.getByRole('button', { name: app.t('ai.warningsCount', { count: 1 }) }).click();
      await expect(page.getByRole('button', { name: app.t('ai.warning.wikilinks') })).toBeVisible();
    },
  },
  {
    name: 'ai-review-applied',
    async setup(app, page, ai) {
      // Dopo «Accetta tutto»: editor semplice senza barra né suggerimento, con il focus nel testo.
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.locator('.cm-mergeView')).toBeVisible();
      await page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true }).click();
      await expect(page.locator('.cm-mergeView')).toHaveCount(0);
      await expect(page.locator('.cm-content')).toBeFocused();
    },
  },
  {
    name: 'ai-review-note',
    async setup(app, page, ai) {
      // Generazione tenuta, clic su Accetta tutto: il pulsante resta attivo e la nota sotto la riga dice perché (spec §2 vincolo 4).
      await page.clock.install({ time: NOW });
      ai.hold();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
      await page.clock.runFor(2100);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
      await page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.review.generating') })).toBeVisible();
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
      await expect(page.locator('.cm-mergeView')).toBeVisible(); // la proposta è arrivata (non «Accetta tutto attivo»: dalla 6c passerebbe subito)
      // Il riepilogo di un preset: «parti · parole → parole words».
      await expect(page.getByRole('log').getByText(new RegExp(`${app.t('ai.words')}$`))).toBeVisible();
    },
  },
  {
    name: 'ai-composer-selection',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'uno\ndue\ntre' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.editor').click();
      await app.selectRange(0, 7);
      await app.mode('mode.ai').click();
      await expect(page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'ai-composer-typed',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Testo scritto e casella con il focus (bordo del composer con :focus-within).
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix this');
      await expect(page.getByRole('button', { name: app.t('ai.send'), exact: true })).toBeEnabled();
      await expect(composer).toBeFocused();
    },
  },
  {
    name: 'ai-composer-running',
    async setup(app, page, ai) {
      // Il contatore dei secondi della generazione cambia la larghezza del testo: orologio finto fin
      // dall'inizio e fermo a un valore noto, o il testo dipende da quanto dura l'esecuzione.
      await page.clock.install({ time: NOW });
      ai.hold();
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
      // Il contatore parte dal Date.now() della richiesta, non da NOW: si avanza di 2,1 s da lì e si ferma l'orologio sul valore raggiunto.
      await page.clock.runFor(2100);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
    },
  },
  {
    name: 'ai-composer-note',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Invia a casella vuota: il pulsante resta attivo e la nota sotto il composer dice perché (decisione 4).
      await page.getByRole('button', { name: app.t('ai.send'), exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.composer.needText') })).toBeVisible();
    },
  },
  {
    name: 'ai-composer-note-no-document',
    async setup(app, page) {
      // Modalità AI senza un documento aperto: Invia resta attivo e la nota dice di aprire un documento.
      await app.openFolder({ 'a.md': 'Alpha' });
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('textbox', { name: app.t('ai.request') }).fill('fix');
      await page.getByRole('button', { name: app.t('ai.send'), exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.composer.noDocument') })).toBeVisible();
    },
  },
  {
    name: 'ai-sidebar-note',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Nuova chat con la chat vuota: il pulsante resta attivo e la nota sotto la testata lo dice (decisione 4).
      await page.getByRole('button', { name: app.t('ai.newChat') }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.newChat.alreadyEmpty') })).toBeVisible();
    },
  },
  {
    name: 'model-chip-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Un override (pallino nel chip), poi il puntatore sul chip: sfondo e tooltip con la nota privacy.
      const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
      await chip.click();
      await page.getByRole('spinbutton', { name: app.t('ai.param.temperature') }).fill('1');
      await page.keyboard.press('Escape');
      await expect(chip).toContainText('•');
      await chip.hover();
      await expect.poll(() => chip.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'model-popover-groups',
    async setup(app, page) {
      await page.route('https://api.anthropic.com/**', (route) => route.abort());
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.createProfile('anthropic', 'Cloud');
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByRole('group', { name: app.t('ai.cloud') }).getByRole('radio', { name: 'Cloud ⚠' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: app.t('ai.model') }).getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
    },
  },
  {
    name: 'model-popover-custom',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      const models = page.getByRole('combobox', { name: app.t('ai.model') });
      await expect(models.getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
      await models.selectOption('__custom');
      await expect(page.getByRole('textbox', { name: app.t('ai.model'), exact: true })).toBeVisible();
    },
  },
  {
    name: 'model-popover-unreachable',
    async setup(app, page, ai) {
      ai.modelsDown = true;
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByText(app.t('ai.error.unreachable'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'ai-sync-reactivate',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      // Cartella di sync scelta, poi un avvio senza permesso: la sidebar AI propone di riattivarla.
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
      await app.setFlags({ folder: 'sync' });
      await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
      await expect(settings.getByRole('button', { name: app.t('ai.syncDisable') })).toBeVisible();
      await settings.getByRole('button', { name: app.t('settings.close') }).click();
      await app.setFlags({ query: 'prompt', request: 'granted' });
      await page.reload();
      await page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) }).click();
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByRole('button', { name: `⚠ ${app.t('ai.syncReactivate')}` })).toBeVisible();
    },
  },
  // Rete della fase 7 (Task 1): stati delle impostazioni e del guscio del workspace che nessuno fotografa.
  {
    name: 'workspace-empty',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await expect(page.getByText(app.t('empty.hint'))).toBeVisible();
    },
  },
  {
    name: 'sidebar-hidden',
    async setup(app, page) {
      await workspace(app);
      await page.getByRole('button', { name: app.t('sidebar.hide'), pressed: true }).click();
      await expect(app.tree()).toHaveCount(0);
    },
  },
  {
    name: 'resizer-focus-keyboard',
    async setup(app, page) {
      await workspace(app);
      // Come focus-button-keyboard: l'ultima interazione è la tastiera, così il separatore ha l'anello.
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.keyboard.press('Escape');
      const separator = page.getByRole('separator', { name: app.t('sidebar.resize') });
      await separator.focus();
      await page.keyboard.press('ArrowRight');
      await expect(separator).toHaveAttribute('aria-valuenow', '296');
    },
  },
  {
    name: 'orphans',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await app.openFile('note.md');
      await app.setFlags({ denyWrites: true, request: 'denied' });
      await app.typeAtEnd('orphan text');
      await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();
      await app.setFlags({ denyWrites: false, request: 'granted' });
      await app.removeExternal('note.md');
      await page.reload();
      await expect(page.getByRole('region', { name: app.t('orphans.title') }).getByRole('button', { name: 'note.md', exact: true })).toBeVisible();
      // I toast del ripristino scadono: si chiudono, così le due build non dipendono dal tempo.
      for (const close of await page.getByRole('button', { name: app.t('toast.close') }).all()) await close.click();
    },
  },
  {
    name: 'settings-autosave-off',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('radio', { name: app.t('settings.autosave.off') }).check();
      await expect(settings.getByRole('spinbutton', { name: app.t('settings.delay') })).toHaveCount(0);
    },
  },
  {
    name: 'settings-preset',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiPresets') }).click();
      await settings.locator('#settings-ai-presets').getByRole('button').first().click();
      await expect(settings.getByRole('button', { name: app.t('ai.restoreOriginal') })).toBeVisible();
    },
  },
  {
    name: 'settings-cloud-profile',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
      await settings.getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
      await expect(settings.getByRole('button', { name: app.t('ai.saveSecret') })).toBeDisabled();
    },
  },
  {
    name: 'settings-connected',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: 'ollama', exact: true }).click();
      await settings.getByRole('button', { name: app.t('ai.connection') }).click();
      await expect(settings.getByRole('status').filter({ hasText: app.t('ai.connected') })).toBeVisible();
    },
  },
  {
    name: 'settings-sync-folder',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
      await app.setFlags({ folder: 'sync' });
      await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
      await expect(settings.getByRole('button', { name: app.t('ai.syncNow') })).toBeEnabled();
      // La riga di stato porta l'ora dell'ultima sincronizzazione: si aspetta che sia scritta.
      await expect(settings.getByText(app.t('ai.backups'))).toBeVisible();
      await settings.getByText(app.t('ai.backups')).click();
    },
  },
  {
    name: 'settings-narrow',
    width: 600,
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
    name: 'tree-rows',
    async setup(app, page) {
      // Bozza (autosalvataggio spento e cambio file), immagine, cartella vuota aperta, file annidato aperto.
      await page.addInitScript(() => localStorage.setItem('housemd:autosave', JSON.stringify({ mode: 'off', delayMs: 1000 })));
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide', 'pic.png': { base64: PIXEL_PNG_BASE64 } });
      await app.openFile('a.md');
      await app.typeAtEnd(' edited');
      await app.tree().locator('summary').filter({ hasText: 'docs' }).click();
      await app.openFile('guide.md');
      await expect(app.treeFileWithDraft('a.md')).toBeVisible();
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.getByRole('dialog', { name: app.t('folder.new') }).getByRole('textbox').fill('empty');
      await page.keyboard.press('Enter');
      await app.tree().locator('summary').filter({ hasText: 'empty' }).click();
      await expect(app.tree().getByText(app.t('tree.emptyFolder'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'tree-row-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide' });
      await app.openFile('a.md');
      // Al passaggio sulla riga compare il pulsante ⋯ (opacità 1) e la riga si colora.
      await app.treeFile('b.md').hover();
      const more = page.getByRole('button', { name: app.t('tree.actions', { name: 'b.md' }) });
      await expect.poll(() => more.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    },
  },
  {
    name: 'tree-focus-keyboard',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide' });
      await app.openFile('a.md');
      // Come focus-ring.spec.ts: l'ultima interazione è la tastiera; poi Tab fino alla riga del file aperto.
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab'); // ricerca
      await page.keyboard.press('Tab'); // albero: il file aperto
      await expect(app.treeFile('a.md')).toBeFocused();
      await page.keyboard.press('ArrowUp'); // la cartella: il ⋯ dentro il <summary> compare con :focus-within
      await expect(app.tree().locator('summary').filter({ hasText: 'docs' })).toBeFocused();
    },
  },
  {
    name: 'search-results',
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'sub/gamma.md': '# Gamma\n\nAnother fox story.' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('fox');
      const results = page.getByRole('list', { name: app.t('search.results') });
      await expect(results.getByRole('button')).toHaveCount(2);
      await expect(results.locator('mark').first()).toBeVisible();
    },
  },
  {
    name: 'search-result-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'sub/gamma.md': '# Gamma\n\nAnother fox story.' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('fox');
      const first = page.getByRole('list', { name: app.t('search.results') }).getByRole('button').first();
      await first.hover();
      await expect.poll(() => first.evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    },
  },
  {
    name: 'search-none',
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('zzzzqqq');
      await expect(page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'history-empty',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      await expect(page.getByRole('region', { name: app.t('toolbar.history') }).getByText(app.t('history.empty'))).toBeVisible();
    },
  },
  {
    name: 'history-identical',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await app.editor().click();
      await page.keyboard.press('ControlOrMeta+a');
      // Come lo stato `history`: il livello della selezione di CodeMirror si disegna nel fotogramma dopo.
      await page.waitForTimeout(100);
      await page.keyboard.type('v1');
      await page.waitForTimeout(100);
      await page.keyboard.press('ControlOrMeta+s');
      await expect.poll(() => app.disk('note.md')).toBe('v1');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      const panel = page.getByRole('region', { name: app.t('toolbar.history') });
      await panel.getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).first().click();
      await expect(panel.getByText(app.t('history.identical'))).toBeVisible();
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

// Rete della fase 8 (Task 1): stati già noti ripresi in forced-colors, in schema chiaro e scuro (icone, voce
// corrente, modalità, bozza orfana corrente, separatore). Oggi registrano il difetto (sfondi portati a Canvas);
// il Task 10 li cambia di proposito.
const orphanCurrent: State = {
  name: 'orphans-current',
  async setup(app, page, ai) {
    await STATES.find((s) => s.name === 'orphans')!.setup(app, page, ai);
    // Dopo il ricaricamento la bozza orfana è riaperta (ultimo file con bozza): la sua voce è quella corrente.
    const orphan = page.getByRole('region', { name: app.t('orphans.title') }).getByRole('button', { name: 'note.md', exact: true });
    await expect(orphan).toHaveAttribute('aria-current', 'true');
  },
};
for (const [name, from] of [
  ['forced-colors-workspace', STATES.find((s) => s.name === 'workspace-light')!],
  ['forced-colors-settings', STATES.find((s) => s.name === 'settings-profile')!],
  ['forced-colors-review', STATES.find((s) => s.name === 'ai-review')!],
  ['forced-colors-orphans', orphanCurrent],
] as const) {
  for (const scheme of ['light', 'dark'] as const) STATES.push({ ...from, name: `${name}-${scheme}`, scheme, forcedColors: true });
}

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
      await page.setViewportSize({ width: state.width ?? 1280, height: 799 });
      await page.setViewportSize({ width: state.width ?? 1280, height: 800 });
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
