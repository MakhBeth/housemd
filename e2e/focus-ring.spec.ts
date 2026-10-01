import type { Locator } from '@playwright/test';

import { expect, test } from './support/app.ts';

/** Il focus ring "oreo" è un box-shadow a tre fasce (global.css). */
const ring = (el: Locator) => el.evaluate((node) => getComputedStyle(node).boxShadow !== 'none');

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
});

test('clicking a text field or the editor shows no focus ring', async ({ app, page }) => {
  const search = page.getByRole('searchbox', { name: app.t('search.label') });
  await search.click();
  await expect(search).toBeFocused();
  expect(await ring(search)).toBe(false);

  await app.editor().click();
  await expect(app.editor()).toBeFocused();
  expect(await ring(app.editor())).toBe(false);
});

test('reaching a text field from the keyboard shows the ring, also with Ctrl+K', async ({ app, page }) => {
  const search = page.getByRole('searchbox', { name: app.t('search.label') });
  await page.getByRole('button', { name: app.t('folder.new') }).first().click();
  await page.keyboard.press('Escape'); // chiude il dialog
  await page.keyboard.press('ControlOrMeta+k');
  await expect(search).toBeFocused();
  expect(await ring(search)).toBe(true);
});

test('typing after a click does not bring the ring back', async ({ app, page }) => {
  await app.editor().click();
  await page.keyboard.type('x');
  expect(await ring(app.editor())).toBe(false);
});

test('clicking a button shows no ring, Tab does', async ({ app, page }) => {
  const settings = page.getByRole('button', { name: app.t('toolbar.settings') });
  await app.mode('mode.split').click();
  expect(await ring(app.mode('mode.split'))).toBe(false);
  await settings.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(settings).toBeFocused();
  expect(await ring(settings)).toBe(true);
});
