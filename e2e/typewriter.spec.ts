import { expect, test } from './support/app.ts';

const lines = Array.from({ length: 120 }, (_, i) => `Riga numero ${i + 1}`).join('\n');

test.beforeEach(async ({ app, page }) => {
  await app.openFolder({ 'a.md': lines });
  await app.openFile('a.md');
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  const settings = page.getByRole('region', { name: app.t('settings.title') });
  await settings.getByRole('checkbox', { name: app.t('settings.typewriter') }).check();
  await settings.getByRole('button', { name: app.t('settings.close') }).click();
});

/** Distanza verticale (px) tra il cursore e il centro del riquadro dell'editor, e altezza di una riga. */
async function offsetFromCenter(page: import('@playwright/test').Page, name: string) {
  return page.getByRole('textbox', { name }).evaluate((content) => {
    const scroller = content.closest('.cm-scroller')!.getBoundingClientRect();
    const range = getSelection()!.getRangeAt(0).cloneRange();
    const caret = range.getBoundingClientRect();
    return { delta: caret.top + caret.height / 2 - (scroller.top + scroller.height / 2), line: caret.height };
  });
}

test('typing and arrow keys keep the cursor line in the middle, a mouse click does not move the view, and it is remembered', async ({ app, page }) => {
  const name = app.t('editor.content');
  const content = page.getByRole('textbox', { name });
  await content.click();
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  let { delta, line } = await offsetFromCenter(page, name);
  expect(Math.abs(delta)).toBeLessThanOrEqual(line / 2 + 1);
  // Digitando e andando a capo la riga resta al centro.
  await page.keyboard.type(' testo\nnuova riga');
  ({ delta, line } = await offsetFromCenter(page, name));
  expect(Math.abs(delta)).toBeLessThanOrEqual(line / 2 + 1);
  // Il clic su un'altra riga non scorre la vista.
  const top = await content.evaluate((c) => c.closest('.cm-scroller')!.scrollTop);
  await page.getByText('Riga numero 50', { exact: false }).first().click();
  expect(await content.evaluate((c) => c.closest('.cm-scroller')!.scrollTop)).toBe(top);
  // Al tasto successivo si ricentra.
  await page.keyboard.press('ArrowDown');
  ({ delta, line } = await offsetFromCenter(page, name));
  expect(Math.abs(delta)).toBeLessThanOrEqual(line / 2 + 1);

  await page.reload();
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(page.getByRole('checkbox', { name: app.t('settings.typewriter') })).toBeChecked();
});
