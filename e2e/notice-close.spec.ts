import { expect, test } from './support/app.ts';

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
});

test('a save error can be closed with the × button and with Esc; the focus goes back to the editor, the draft stays', async ({ app, page }) => {
  await app.setFlags({ failWrites: true });
  await app.typeAtEnd('mine');
  await page.keyboard.press('Control+s');
  const close = page.getByRole('button', { name: /^Chiudi avviso|^Close notice/ });
  await expect(close).toBeVisible();
  await close.click();
  await expect(close).toHaveCount(0);
  await expect(app.editor()).toBeFocused();
  await expect(app.editor()).toContainText('mine');

  await page.keyboard.press('Control+s');
  await expect(close).toBeVisible();
  await close.focus();
  await page.keyboard.press('Escape');
  await expect(close).toHaveCount(0);
  await expect(app.editor()).toBeFocused();
  await expect(app.editor()).toContainText('mine');
});

test('new file: a visible confirmation in the sidebar, announced once, focus on the new editor', async ({ app, page }) => {
  await page.getByRole('button', { name: app.t('file.new') }).first().click();
  const dialog = page.getByRole('dialog', { name: app.t('file.new') });
  await dialog.getByRole('textbox').fill('nuovo');
  await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
  const message = app.t('notice.fileCreated', { name: 'nuovo.md' });
  await expect(page.getByText(message)).toHaveCount(1);
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: message })).toHaveCount(0);
  await expect(app.editor()).toBeFocused();
});
