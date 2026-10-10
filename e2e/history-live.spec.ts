import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const panel = (app: App) => app.page.getByRole('region', { name: app.t('toolbar.history') });
const versions = (app: App) => panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) });

/** Sostituisce tutto il testo dell'editor e salva con Ctrl+S (una versione nella cronologia). */
async function saveAs(app: App, text: string): Promise<void> {
  await app.editor().click();
  await app.page.keyboard.press('ControlOrMeta+a');
  await app.page.keyboard.type(text);
  await app.page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe(text);
}

/** Due versioni salvate di note.md, «v1» e 6 minuti dopo «v2» (quella aperta), con il pannello aperto. */
async function openWithTwoVersions(app: App, files: Record<string, string> = {}): Promise<void> {
  await app.page.clock.install();
  await app.openFolder({ 'note.md': 'v0', ...files });
  await app.openFile('note.md');
  await saveAs(app, 'v1');
  await app.page.clock.fastForward('06:00');
  await saveAs(app, 'v2');
  await app.page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await expect(versions(app)).toHaveCount(2);
}

test('switching file with the panel open shows the other file, without its versions', async ({ app }) => {
  await openWithTwoVersions(app, { 'other.md': 'O' });
  await app.openFile('other.md');
  await expect(panel(app).getByRole('heading', { name: app.t('history.title', { path: 'other.md' }) })).toBeVisible();
  await expect(panel(app).getByText(app.t('history.empty'))).toBeVisible();
  await expect(versions(app)).toHaveCount(0);
});

test('a save with the panel open adds the new version at the top', async ({ app }) => {
  await openWithTwoVersions(app);
  await app.page.clock.fastForward('06:00');
  await saveAs(app, 'v3');
  await expect(versions(app)).toHaveCount(3);
  await versions(app).first().click();
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
});

test('the diff follows the text being edited', async ({ app, page }) => {
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await expect(panel(app).getByText(app.t('history.legend'))).toBeVisible();
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v1');
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
  await expect(panel(app).getByRole('button', { name: app.t('history.restore') })).toHaveCount(0);
});

test('the history panel follows the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  // «Chiudi» c'è due volte (impostazioni e cronologia): quello delle impostazioni.
  await page.getByRole('region', { name: it('settings.title') }).getByRole('button', { name: it('settings.close') }).click();
  const region = page.getByRole('region', { name: it('toolbar.history') });
  await expect(region.getByRole('heading', { name: it('history.title', { path: 'note.md' }) })).toBeVisible();
  await expect(region.getByRole('button', { name: it('history.restore') })).toBeVisible();
  await expect(region.getByRole('button', { name: new RegExp(it('history.reason.save')) })).toHaveCount(2);
  await expect(region.getByRole('button', { name: it('history.close') })).toBeVisible();
});

test('after Restore the button disappears (identical text): the focus goes to the chosen version', async ({ app }) => {
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.editor()).toHaveText('v1');
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
  // Decisione 3: il focus va sulla versione scelta, non sul body.
  await expect(versions(app).nth(1)).toBeFocused();
});
