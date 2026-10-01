import { expect, test, type App } from './support/app.ts';

const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function openSettings(app: App): Promise<void> {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(settings(app)).toBeVisible();
}

/** Crea un profilo senza salvarlo: la sezione resta con modifiche aperte. */
async function dirtyProfile(app: App): Promise<void> {
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await expect(app.page).toHaveURL(/#settings\/ai-profiles$/);
  // "+ Create" e "Name" ci sono in ogni sezione AI, e le sezioni non hanno un nome accessibile: quella
  // dei profili è la prima, nello stesso ordine dei link di navigazione.
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByLabel(app.t('ai.name'), { exact: true }).first().fill('Bozza');
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
});

test('opening moves the focus to the title; closing brings it back', async ({ app, page }) => {
  // Il clic lascia il focus sul pulsante: è lì che deve tornare alla chiusura.
  await openSettings(app);
  await expect(settings(app).getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle(`HMD - ${app.t('settings.title')}`);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await expect(settings(app)).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('toolbar.settings') })).toBeFocused();
  await expect(page).toHaveTitle('HMD - a.md');
});

test('sections are addressed by the hash', async ({ app, page }) => {
  // Ricaricando con l'hash la cartella torna da sola (permesso già concesso) e si apre la sezione.
  await page.goto('/#settings/ai-presets');
  await expect(settings(app)).toBeVisible();
  // aria-current dei link segue lo scorrimento, non la rotta: si controlla che la sezione sia in vista.
  await expect(settings(app).getByRole('heading', { name: app.t('settings.aiPresets'), level: 2 })).toBeInViewport();
});

test('Back with unsaved changes asks first; Cancel keeps everything', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  await page.goBack();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#settings/);
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(settings(app)).toBeVisible();
  await expect(page).toHaveURL(/#settings/);
});

test('Close with unsaved changes asks first; Discard closes', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await dialog.getByRole('button', { name: app.t('ai.discardChanges') }).click();
  await expect(settings(app)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('text width: editor limited in characters, preview without limit, both remembered', async ({ app, page }) => {
  await openSettings(app);
  const editorWidth = settings(app).getByLabel(app.t('settings.textWidth.editor'));
  const previewWidth = settings(app).getByLabel(app.t('settings.textWidth.preview'));
  await expect(previewWidth).toHaveValue('72');
  await editorWidth.fill('40');
  await editorWidth.blur();
  await previewWidth.fill('');
  await previewWidth.blur();
  const root = page.locator('html');
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--editor-text-width'))).toBe('40ch');
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--preview-text-width'))).toBe('100%');

  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();

  // Senza limite l'anteprima occupa tutto il pannello (era un controllo di run-ai-smoke.mjs).
  await app.mode('mode.preview').click();
  const heading = app.previewPane().getByRole('heading', { name: 'A' });
  await expect
    .poll(async () => {
      const pane = await app.previewPane().evaluate((el) => el.clientWidth);
      const box = await heading.boundingBox();
      // Tolleranza per il padding del contenitore (64px in Preview.module.css).
      return box !== null && pane - box.width <= 80;
    })
    .toBe(true);

  await page.reload();
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--editor-text-width'))).toBe('40ch');
});

test('with the default limit the preview is narrower than the pane', async ({ app }) => {
  // Contro-prova del test precedente: con 72 caratteri il titolo non arriva ai bordi.
  await app.mode('mode.preview').click();
  const heading = app.previewPane().getByRole('heading', { name: 'A' });
  // L'anteprima si disegna dopo un debounce: prima si aspetta il titolo, poi si misura.
  await expect(heading).toBeVisible();
  const pane = await app.previewPane().evaluate((el) => el.clientWidth);
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(pane - box!.width).toBeGreaterThan(80);
});

test('Ctrl+S works with the settings open (no "Save page" dialog)', async ({ app, page }) => {
  await app.typeAtEnd('\nmore');
  await openSettings(app);
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('a.md')).toBe('# A\nmore');
});
