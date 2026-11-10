import { expect, test } from './support/app.ts';

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': 'Primo paragrafo.\n\nSecondo paragrafo.\n\nTerzo paragrafo.', 'long.md': Array.from({ length: 120 }, (_, i) => `Riga numero ${i + 1}`).join('\n') });
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

test('focus mode always centers the cursor line, even with the typewriter setting off', async ({ app, page }) => {
  await app.openFile('long.md');
  const name = app.t('editor.content');
  const content = page.getByRole('textbox', { name });
  const offset = () =>
    content.evaluate((c) => {
      const scroller = c.closest('.cm-scroller')!.getBoundingClientRect();
      const caret = getSelection()!.getRangeAt(0).cloneRange().getBoundingClientRect();
      return { delta: caret.top + caret.height / 2 - (scroller.top + scroller.height / 2), line: caret.height };
    });
  await expect(page.getByRole('button', { name: app.t('toolbar.focus') })).toHaveAttribute('aria-pressed', 'false');
  await content.click();
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
  let { delta, line } = await offset();
  expect(Math.abs(delta)).toBeGreaterThan(line);

  await page.getByRole('button', { name: app.t('toolbar.focus') }).click();
  await content.click();
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
  ({ delta, line } = await offset());
  expect(Math.abs(delta)).toBeLessThanOrEqual(line / 2 + 1);
});

test('in focus mode the active line has no tint under the dimmed text', async ({ app, page }) => {
  await page.getByRole('button', { name: app.t('toolbar.focus') }).click();
  const content = page.getByRole('textbox', { name: app.t('editor.content') });
  await content.click();
  const bg = await content.evaluate((c) => {
    const line = c.querySelector('.cm-activeLine');
    return line ? getComputedStyle(line).backgroundColor : 'rgba(0, 0, 0, 0)';
  });
  expect(bg).toBe('rgba(0, 0, 0, 0)');
});
