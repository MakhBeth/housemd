import { expect, test, type App } from './support/app.ts';

/** Due versioni salvate di note.md: "v1" e, 6 minuti dopo, "v2" (quella aperta). */
async function twoVersions(app: App): Promise<void> {
  const { page } = app;
  await page.clock.install();
  await app.openFolder({ 'note.md': 'v0' });
  await app.openFile('note.md');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v1');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('v1');
  await page.clock.fastForward('06:00');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v2');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('v2');
}

const panel = (app: App) => app.page.getByRole('region', { name: app.t('toolbar.history') });

test('the toolbar button opens the history next to the editor', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await expect(panel(app).getByRole('heading', { name: app.t('history.title', { path: 'note.md' }) })).toBeVisible();
  await expect(panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) })).toHaveCount(2);
  await expect(panel(app).getByText(app.t('history.pick'))).toBeVisible();
});

test('picking a version shows the diff; restore is undoable with Ctrl+Z', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  const versions = panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) });
  // La più recente è in cima: la seconda è "v1".
  await versions.nth(1).click();
  await expect(versions.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(app).getByText(app.t('history.legend'))).toBeVisible();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.editor()).toHaveText('v1');
  // Nessuna voce "prima di un ripristino": il testo sostituito ("v2") è uguale all'ultima versione
  // salvata, e la policy non salva due volte lo stesso testo (shouldSnapshot in src/history/policy.ts).
  await expect(panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.before-restore')) })).toHaveCount(0);

  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('v2');
});

test('restoring from preview-only mode switches to split and stays undoable', async ({ app, page }) => {
  await twoVersions(app);
  await app.mode('mode.preview').click();
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).nth(1).click();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.editor()).toHaveText('v1');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('v2');
});

test('closing the panel brings the preview back', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await panel(app).getByRole('button', { name: app.t('history.close') }).click();
  await expect(panel(app)).toHaveCount(0);
  await expect(app.previewPane()).toBeVisible();
});
