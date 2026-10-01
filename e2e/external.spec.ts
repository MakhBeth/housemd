import { expect, test, type App } from './support/app.ts';

// L'orologio finto si installa prima che la pagina carichi; scorre normalmente finché un test non
// lo mette in pausa (solo i test di conflitto lo fanno).
test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
});

/**
 * Modifica locale non salvata + modifica esterna, con l'autosalvataggio fermo: l'orologio della
 * pagina è in pausa, quindi il conflitto non dipende da quanto è veloce la macchina.
 */
async function localAndExternalEdit(app: App): Promise<void> {
  await app.page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('mine');
  await app.page.clock.runFor(100); // molto meno dei 1000 ms dell'autosalvataggio
  await app.writeExternal('note.md', 'theirs, longer text');
  await app.windowFocus();
}

test('an external change with no local edits is reloaded', async ({ app }) => {
  await app.writeExternal('note.md', '# Changed outside\n');
  await app.windowFocus();
  await expect(app.editor()).toHaveText('# Changed outside');
});

test('an external change during local edits raises a conflict; reload takes the disk', async ({ app, page }) => {
  await localAndExternalEdit(app);
  const bar = page.getByRole('alert').filter({ hasText: app.t('conflict.message') });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: app.t('conflict.reload') }).click();
  await expect(bar).toHaveCount(0);
  await expect(app.editor()).toHaveText('theirs, longer text');
});

test('conflict: overwrite writes the local text', async ({ app, page }) => {
  await localAndExternalEdit(app);
  const bar = page.getByRole('alert').filter({ hasText: app.t('conflict.message') });
  await bar.getByRole('button', { name: app.t('conflict.overwrite') }).click();
  await page.clock.runFor(1500); // se la sovrascrittura passa da un timer, lo si lascia scattare
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nmine');
});

test('the open file deleted outside: toast and "deleted on disk" state', async ({ app }) => {
  await app.removeExternal('note.md');
  await app.windowFocus();
  await expect(app.toast(app.t('toast.deletedOutside', { path: 'note.md' }))).toBeVisible();
  await expect(app.saveState('save.deleted')).toBeVisible();
});

test('a file created outside appears in tree and search', async ({ app, page }) => {
  await app.writeExternal('fresh.md', '# Fresh\n\nunicorn');
  await app.windowFocus();
  await expect(app.treeFile('fresh.md')).toBeVisible();
  await page.getByRole('searchbox', { name: app.t('search.label') }).fill('unicorn');
  await expect(page.getByRole('list', { name: app.t('search.results') }).getByRole('button')).toHaveCount(1);
});

test('access lost: blocking dialog, denied retry, then resume saves the text', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('x');
  const dialog = page.getByRole('dialog', { name: app.t('access.title') });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5); // clic sul backdrop, fuori dal dialog
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: app.t('access.resume') }).click();
  await expect(dialog.getByText(app.t('access.denied'))).toBeVisible();

  await app.setFlags({ denyWrites: false, request: 'granted' });
  await dialog.getByRole('button', { name: app.t('access.resume') }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nx');
});

test('draft survives a failed save and a reload', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('draft');
  await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();

  await app.setFlags({ denyWrites: false, request: 'granted' });
  await page.reload();
  await expect(app.editor()).toContainText('draft');
  await expect(app.toast(app.t('toast.restoredDraft', { path: 'note.md' }))).toBeVisible();
});

test('a draft whose file vanished is listed under "drafts without a file"', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('orphan text');
  await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();
  await app.setFlags({ denyWrites: false, request: 'granted' });
  await app.removeExternal('note.md');

  await page.reload();
  const orphans = page.getByRole('region', { name: app.t('orphans.title') });
  await expect(orphans.getByRole('button', { name: 'note.md', exact: true })).toBeVisible();
  await expect(app.toast(app.t('toast.restoredDraftDeleted', { path: 'note.md' }))).toBeVisible();
  await expect(app.editor()).toContainText('orphan text');
});
