import { expect, test } from './support/app.ts';

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
});

test('the tab title follows the open file', async ({ page }) => {
  await expect(page).toHaveTitle('HMD - a.md');
});

test('a selection shows the formatting toolbar; it goes away on blur', async ({ app, page }) => {
  const toolbar = page.getByRole('toolbar', { name: app.t('format.toolbar') });
  await expect(toolbar).toHaveCount(0);
  await app.selectRange(4, 7); // "due"
  await expect(toolbar).toBeVisible();
  await page.getByRole('searchbox', { name: app.t('search.label') }).focus();
  await expect(toolbar).toHaveCount(0);
});

test('Ctrl+B in the editor is bold, not the sidebar', async ({ app }) => {
  await app.selectRange(4, 7);
  await app.page.keyboard.press('ControlOrMeta+b');
  await expect(app.editor()).toHaveText('uno **due** tre');
  await expect(app.tree()).toBeVisible();
});

test('toolbar buttons format and keep the focus in the editor', async ({ app, page }) => {
  await app.selectRange(4, 7);
  const toolbar = page.getByRole('toolbar', { name: app.t('format.toolbar') });
  await toolbar.getByRole('button', { name: app.t('format.bold') }).click();
  await toolbar.getByRole('button', { name: app.t('format.italic') }).click();
  await expect(app.editor()).toHaveText('uno ***due*** tre');
  await expect(app.editor()).toBeFocused();
});

test('shortcuts: strikethrough, code, link', async ({ app, page }) => {
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+Shift+x');
  await expect(app.editor()).toHaveText('uno ~~due~~ tre');
  await page.keyboard.press('ControlOrMeta+Shift+x');
  await expect(app.editor()).toHaveText('uno due tre');
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+e');
  await expect(app.editor()).toHaveText('uno `due` tre');
  await page.keyboard.press('ControlOrMeta+e');
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+Shift+k');
  await expect(app.editor()).toContainText('[due](');
});

test('controls use the drawn tooltip, not the native title', async ({ app, page }) => {
  await app.selectRange(4, 7);
  const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
  await bold.hover();
  await expect
    .poll(() =>
      bold.evaluate((b) => {
        const after = getComputedStyle(b, '::after');
        return { title: (b as HTMLElement).title, content: after.content, visibility: after.visibility };
      }),
    )
    .toEqual({ title: '', content: JSON.stringify(app.t('format.bold')), visibility: 'visible' });

  // Anche al focus da tastiera, sui pulsanti della barra degli strumenti.
  const settings = page.getByRole('button', { name: app.t('toolbar.settings') });
  await settings.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect
    .poll(() => settings.evaluate((b) => getComputedStyle(b, '::after').visibility))
    .toBe('visible');
});
