import { expect, test, type App } from './support/app.ts';

/** Rete della fase 7 (Task 1): il guscio del workspace che le altre spec non toccano. */

const separator = (app: App) => app.page.getByRole('separator', { name: app.t('sidebar.resize') });

test('dragging the separator resizes the sidebar and is remembered; the AI panel has its own width', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  const box = (await separator(app).boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(350, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '350');
  await app.mode('mode.ai').click();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '380');
  await page.reload();
  await expect(app.mode('mode.ai')).toHaveAttribute('aria-pressed', 'true');
  await app.mode('mode.split').click();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '350');
});

test('with no file open: the hint and New file, which creates the file and opens it', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await expect(page.getByText(app.t('empty.hint'))).toBeVisible();
  await expect(page.getByRole('button', { name: app.t('toolbar.history') })).toBeDisabled();
  await page.getByRole('main').getByRole('button', { name: app.t('file.new'), exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('new');
  await dialog.getByRole('textbox').press('Enter');
  await expect.poll(() => app.exists('new.md')).toBe(true);
  await app.expectOpen('new.md');
});

test('Ctrl+Shift+E enters AI mode and leaves it for the last document view', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  await app.mode('mode.preview').click();
  await expect(app.mode('mode.ai')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+E');
  await expect(app.mode('mode.ai')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: app.t('ai.request') })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+E');
  await expect(app.mode('mode.preview')).toHaveAttribute('aria-pressed', 'true');
});

test('Ctrl+K in AI mode goes back to the last view, opens the file tree and focuses the search', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  await app.mode('mode.ai').click();
  await expect(app.tree()).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: app.t('search.label') })).toBeFocused();
});

test('Escape in AI mode, with the focus outside the composer, stops the generation', async ({ app, ai, page }) => {
  ai.hold();
  await app.openFolder({ 'a.md': 'A' });
  await app.openFile('a.md');
  await app.mode('mode.ai').click();
  const composer = page.getByRole('textbox', { name: app.t('ai.request') });
  await composer.fill('fix');
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
  await app.mode('mode.ai').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: app.t('ai.send'), exact: true })).toBeVisible();
});

test('Hide sidebar from inside the sidebar: today the focus falls on the body (A1, the Task 3 of phase 8 moves it to Show sidebar)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  // «Nascondi» esiste due volte: questo è quello nella testata della sidebar (l'altro è l'interruttore della barra).
  await page.getByRole('complementary').getByRole('button', { name: app.t('sidebar.hide') }).click();
  await expect(app.tree()).toHaveCount(0);
  await expect(page.locator('body')).toBeFocused();
});
