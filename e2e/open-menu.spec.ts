import { expect, test, type App } from './support/app.ts';
import { readText, seedFolder } from './support/fsHarness.ts';

/** Il menu «Apri» della barra e una sua voce. */
async function openMenu(app: App, item: string): Promise<void> {
  await app.page.getByRole('button', { name: app.t('open.menu'), exact: true }).click();
  await app.page.getByRole('button', { name: item, exact: true }).click();
}

test('folder → Open file → single file → Open folder → folder, without reloading the page', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha', 'note.md': '# Note' });
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  await app.setFlags({ file: 'note.md' });
  await openMenu(app, app.t('open.file'));
  await expect(app.editor()).toHaveText('# Note');
  // File singolo: niente sidebar, né albero né ricerca.
  await expect(app.tree()).toHaveCount(0);
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await openMenu(app, app.t('open.folder'));
  await expect(app.treeFile('a.md')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
});

test('recents: the folder and the file opened come back in the menu and on the start screen, and reopen', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha', 'note.md': '# Note' });
  await app.setFlags({ file: 'note.md' });
  await openMenu(app, app.t('open.file'));
  await expect(app.editor()).toHaveText('# Note');
  await page.getByRole('button', { name: app.t('open.menu'), exact: true }).click();
  const recent = page.getByRole('list', { name: app.t('open.recent') });
  await expect(recent.getByRole('button')).toHaveText(['note.md', 'notes']);
  await recent.getByRole('button', { name: app.t('open.recentFolder', { name: 'notes' }) }).click();
  await expect(app.treeFile('a.md')).toBeVisible();
  // Senza permesso dopo un riavvio: la schermata iniziale offre gli stessi recenti, il permesso si chiede al clic.
  await app.setFlags({ query: 'prompt' });
  await page.reload();
  const start = page.getByRole('list', { name: app.t('open.recent') });
  await start.getByRole('button', { name: app.t('open.recentFile', { name: 'note.md' }) }).click();
  await expect(app.editor()).toHaveText('# Note');
});

test('a single file: Open this file\'s folder opens the folder with that file open', async ({ app, page }) => {
  await app.start();
  await seedFolder(page, 'notes', { 'a.md': 'alpha', 'note.md': '# Note' });
  await page.getByRole('button', { name: app.t('start.openFile') }).click();
  await expect(app.editor()).toHaveText('# Note');
  await page.getByRole('button', { name: app.t('open.fileFolder') }).click();
  await app.expectOpen('note.md');
  await expect(app.treeFile('a.md')).toBeVisible();
});

test('Open with HouseMD: a second launched file replaces the open one, which is saved first', async ({ app, page }) => {
  await app.start();
  await seedFolder(page, 'notes', { 'one.md': 'one', 'two.md': 'two' });
  await page.evaluate(() => (window as unknown as { __hmdLaunch(name: string): Promise<void> }).__hmdLaunch('one.md'));
  await expect(app.editor()).toHaveText('one');
  await app.typeAtEnd(' edited');
  await page.evaluate(() => (window as unknown as { __hmdLaunch(name: string): Promise<void> }).__hmdLaunch('two.md'));
  await expect(app.editor()).toHaveText('two');
  await expect.poll(() => readText(page, 'notes', 'one.md')).toBe('one edited');
});

test('the Open button toggles: a second real click closes the menu', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  const trigger = page.getByRole('button', { name: app.t('open.menu'), exact: true });
  const folder = page.getByRole('button', { name: app.t('open.folder'), exact: true });
  await trigger.click();
  await expect(folder).toBeVisible();
  await expect(folder).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await trigger.click();
  await expect(folder).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(folder).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(folder).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Shift+Tab from the first item back to Open closes the menu', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  const trigger = page.getByRole('button', { name: app.t('open.menu'), exact: true });
  await trigger.click();
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: app.t('open.folder'), exact: true })).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
