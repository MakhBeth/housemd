import { expect, test } from './support/app.ts';

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': 'Primo paragrafo.\n\nSecondo paragrafo.\n\nTerzo paragrafo.' });
  await app.openFile('a.md');
});

test('the focus button toggles aria-pressed, greys the other paragraphs and is remembered after a reload', async ({ app, page }) => {
  const focus = page.getByRole('button', { name: app.t('toolbar.focus') });
  await expect(focus).toHaveAttribute('aria-pressed', 'false');
  await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  await expect(focus).toBeEnabled();

  const content = page.getByRole('textbox', { name: app.t('editor.content') });
  await content.click();
  await page.keyboard.press('Control+Home');
  const color = (text: string) => content.getByText(text).evaluate((node) => getComputedStyle(node).color);
  const lit = await color('Primo paragrafo.');
  const muted = await color('Secondo paragrafo.');
  expect(muted).not.toBe(lit);
  // Il cursore si sposta: il grigio lo segue.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await color('Secondo paragrafo.')).toBe(lit);
  expect(await color('Primo paragrafo.')).toBe(muted);

  await page.reload();
  await expect(page.getByRole('button', { name: app.t('toolbar.focus') })).toHaveAttribute('aria-pressed', 'true');
});

test('Ctrl+Shift+F and the settings checkbox drive the same preference', async ({ app, page }) => {
  const focus = page.getByRole('button', { name: app.t('toolbar.focus') });
  await page.getByRole('textbox', { name: app.t('editor.content') }).click();
  await page.keyboard.press('Control+Shift+F');
  await expect(focus).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  const settings = page.getByRole('region', { name: app.t('settings.title') });
  const box = settings.getByRole('checkbox', { name: app.t('settings.focus') });
  await expect(box).toBeChecked();
  await expect(settings.getByRole('radio', { name: app.t('settings.focus.paragraph') })).toBeChecked();
  await settings.getByRole('radio', { name: app.t('settings.focus.sentence') }).check();
  await box.uncheck();
  await settings.getByRole('button', { name: app.t('settings.close') }).click();
  await expect(focus).toHaveAttribute('aria-pressed', 'false');
});

test('turning it on in the preview view explains where it shows, and the button stays enabled', async ({ app, page }) => {
  await page.getByRole('button', { name: app.t('mode.preview') }).click();
  const focus = page.getByRole('button', { name: app.t('toolbar.focus') });
  await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: app.t('toolbar.focus.elsewhere') })).toBeVisible();
  await page.getByRole('button', { name: app.t('mode.split') }).click();
  await expect(page.getByText(app.t('toolbar.focus.elsewhere'))).toHaveCount(0);
});

test('the hidden status region does not make the page scroll', async ({ page }) => {
  const extra = await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight);
  expect(extra).toBe(0);
  await page.mouse.move(640, 20);
  await page.mouse.wheel(0, 200);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
