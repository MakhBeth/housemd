import { expect, test } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';

const NOTE = ['# Print heading', '', 'Body text with [[idea]].', '', '![pixel](assets/pixel.png)', '', '```', 'code block', '```', ''].join('\n');

test.beforeEach(async ({ app, page }) => {
  // La finestra di stampa non si può guidare: si conta la chiamata e il foglio resta per i controlli.
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints++;
    };
  });
  await app.openFolder({ 'note.md': NOTE, 'idea.md': '# Idea', 'assets/pixel.png': { base64: PIXEL_PNG_BASE64 } });
});

test('without a document the button says why and does not print', async ({ app, page }) => {
  const button = page.getByRole('button', { name: app.t('toolbar.export') });
  await button.click();
  await expect(page.getByRole('status').filter({ hasText: app.t('toolbar.export.noDocument') })).toBeVisible();
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(0);
});

test('the print sheet shows only the document, in the light theme, in print media', async ({ app, page }) => {
  await app.openFile('note.md');
  await page.getByRole('button', { name: app.t('mode.editor') }).click();
  await page.getByRole('button', { name: app.t('toolbar.export') }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const heading = page.getByRole('heading', { name: 'Print heading' });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('img', { name: 'pixel' })).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('link', { name: 'idea' })).toBeVisible();
  await expect(page.getByRole('button', { name: app.t('toolbar.export') })).toBeHidden();
  await expect(page.getByRole('navigation', { name: app.t('tree.label') })).toBeHidden();
  expect(await heading.evaluate((node) => getComputedStyle(node).color)).toBe('rgb(31, 29, 26)');
  expect(await page.locator('pre').evaluate((node) => getComputedStyle(node).breakInside)).toBe('avoid');
});
