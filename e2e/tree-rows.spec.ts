import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
import { messagesFor } from './support/i18n.ts';

/** La riga di una cartella è il <summary> del suo <details> (come in tree.spec.ts). */
const folderRow = (app: App, name: string) => app.tree().locator('summary').filter({ hasText: name });
const actions = (app: App, name: string) => app.page.getByRole('button', { name: app.t('tree.actions', { name }) });

test('a file left with unsaved changes (autosave off) shows the draft mark', async ({ app, page }) => {
  await page.addInitScript(() => localStorage.setItem('housemd:autosave', JSON.stringify({ mode: 'off', delayMs: 1000 })));
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B' });
  await app.openFile('a.md');
  await app.typeAtEnd(' edited');
  await app.openFile('b.md');
  await expect(app.treeFileWithDraft('a.md')).toBeVisible();
  await expect(app.tree().getByRole('img', { name: app.t('tree.draft') })).toHaveCount(1);
});

test('an empty folder says so; a folder without files says there are none', async ({ app, page }) => {
  await app.openFolder({});
  await expect(app.tree().getByText(app.t('tree.noFiles'), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: app.t('folder.new') }).first().click();
  const dialog = page.getByRole('dialog', { name: app.t('folder.new') });
  await dialog.getByRole('textbox').fill('empty');
  await page.keyboard.press('Enter');
  await expect(app.tree().getByText(app.t('tree.noFiles'), { exact: true })).toHaveCount(0);
  await folderRow(app, 'empty').click();
  await expect(app.tree().getByText(app.t('tree.emptyFolder'), { exact: true })).toBeVisible();
});

test('images are listed but cannot be opened and have no menu', async ({ app }) => {
  await app.openFolder({ 'a.md': 'A', 'pic.png': { base64: PIXEL_PNG_BASE64 } });
  await expect(app.tree().getByText('pic.png', { exact: true })).toBeVisible();
  await expect(app.treeFile('pic.png')).toHaveCount(0);
  await expect(actions(app, 'pic.png')).toHaveCount(0);
  await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
});

test('opening a nested file reveals its folder; collapsed again, it stays collapsed while editing', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('Guide');
  await box.press('Enter');
  await app.expectOpen('guide.md');
  await expect(app.treeFile('guide.md')).toBeVisible();
  await folderRow(app, 'docs').click();
  await expect(app.treeFile('guide.md')).toBeHidden();
  await app.typeAtEnd(' more');
  await expect(app.saveState('save.saved')).toBeVisible();
  await expect(app.treeFile('guide.md')).toBeHidden();
});

test('the tab stop follows the last focused row, and comes back to it with Shift+Tab', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' });
  await app.openFile('a.md');
  await app.treeFile('a.md').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(app.treeFile('c.md')).toBeFocused();
  await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
  await expect(app.treeFile('c.md')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Tab'); // esce dall'albero (il separatore della sidebar)
  await expect(app.treeFile('c.md')).not.toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(app.treeFile('c.md')).toBeFocused();
});

test('the ⋯ button of a folder opens the menu without opening the folder', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  await actions(app, 'docs').click();
  await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeVisible();
  await expect(app.treeFile('guide.md')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeHidden();
  await expect(app.treeFile('guide.md')).toBeHidden();
});

test('the tree follows the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const tree = page.getByRole('navigation', { name: it('tree.label') });
  await expect(tree).toBeVisible();
  await tree.getByRole('button', { name: it('tree.actions', { name: 'docs' }) }).click();
  // Per una cartella la prima voce è «Nuovo file».
  await expect(tree.getByRole('button', { name: it('file.new'), exact: true })).toBeFocused();
  await expect(tree.getByRole('button', { name: it('tree.rename'), exact: true })).toBeVisible();
});

test('deleting the file whose row has the focus: where the focus goes', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B' });
  await app.openFile('a.md');
  await app.treeFile('b.md').focus();
  await page.keyboard.press('Shift+F10');
  await app.tree().getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'b.md' }) });
  await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
  await expect(app.treeFile('b.md')).toHaveCount(0);
  // Difetto di oggi (React): la riga sparisce con il focus e il focus cade sul body. Il Task 2 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('renaming the open file from its row: where the focus goes', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' });
  await app.openFile('b.md');
  await app.treeFile('b.md').focus();
  await page.keyboard.press('Shift+F10');
  await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
  await page.keyboard.type('renamed');
  await page.keyboard.press('Enter');
  await app.expectOpen('renamed.md');
  // Difetto di oggi (React): la riga di prima sparisce con il focus e il focus cade sul body. Il Task 2 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});
