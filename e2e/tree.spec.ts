import { expect, test, type App } from './support/app.ts';

test.describe('dialogs and menu', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
  });

  test('new file from the sidebar: created on disk and opened', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('file.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('file.new') });
    await dialog.getByRole('textbox').fill('città');
    await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
    await expect(dialog).toHaveCount(0);
    await app.expectOpen('città.md');
    await expect.poll(() => app.exists('città.md')).toBe(true);
  });

  test('name errors keep the dialog open, Esc closes it', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('file.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('file.new') });
    const input = dialog.getByRole('textbox');
    const create = dialog.getByRole('button', { name: app.t('dialog.create') });

    await create.click();
    await expect(dialog.getByText(app.t('name.error.empty'))).toBeVisible();

    await input.fill('note');
    await create.click();
    await expect(dialog.getByText(app.t('name.error.taken'))).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('.secret');
    await create.click();
    await expect(dialog.getByText(app.t('name.error.dot'))).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('new folder appears in the tree (empty folders are shown)', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('folder.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('folder.new') });
    await dialog.getByRole('textbox').fill('drafts');
    await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
    await expect(app.tree().getByText('drafts', { exact: true })).toBeVisible();
    await expect.poll(() => app.exists('drafts')).toBe(true);
  });

  test('renaming the open file keeps it open, the name is preselected without .md', async ({ app, page }) => {
    await app.openFile('note.md');
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await page.getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) });
    // "note" è selezionato: scrivere lo sostituisce, ".md" resta.
    await page.keyboard.type('renamed');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await app.expectOpen('renamed.md');
    await expect.poll(() => app.disk('renamed.md')).toBe('# Note');
    await expect.poll(() => app.exists('note.md')).toBe(false);
  });

  test('a right click does not open the tree menu (the ⋯ button does)', async ({ app, page }) => {
    await app.treeFile('note.md').click({ button: 'right' });
    await expect(page.getByRole('button', { name: app.t('tree.delete'), exact: true })).toBeHidden();
  });

  test('delete from the menu asks first; cancel keeps the file', async ({ app, page }) => {
    const openMenu = async () => {
      await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
      await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
      return page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) });
    };

    let dialog = await openMenu();
    await expect(dialog.getByText(app.t('dialog.delete.file'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(dialog).toHaveCount(0);
    expect(await app.exists('note.md')).toBe(true);

    dialog = await openMenu();
    await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
    await expect(app.treeFile('note.md')).toHaveCount(0);
    await expect.poll(() => app.exists('note.md')).toBe(false);
  });

  test('closing a dialog opened from the ⋯ menu brings the focus back to the ⋯ button', async ({ app, page }) => {
    const trigger = page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) });
    await trigger.click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const rename = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) });
    await expect(rename.getByRole('textbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(rename).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
    const remove = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) });
    // La scelta sicura ha il focus: Invio non elimina.
    await expect(remove.getByRole('button', { name: app.t('dialog.cancel') })).toBeFocused();
    await remove.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(remove).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the rename dialog selects the name without the extension', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const input = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) }).getByRole('textbox');
    await expect(input).toHaveValue('note.md');
    expect(await input.evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 4]);
  });

  test('deleting a folder warns that its content goes too', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
    await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'docs' }) });
    await expect(dialog.getByText(app.t('dialog.delete.folder'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
    await expect.poll(() => app.exists('docs')).toBe(false);
  });

  test('folders expand and collapse', async ({ app }) => {
    const folder = app.tree().getByText('docs', { exact: true });
    await expect(app.treeFile('guide.md')).toBeHidden();
    await folder.click();
    await expect(app.treeFile('guide.md')).toBeVisible();
    await folder.click();
    await expect(app.treeFile('guide.md')).toBeHidden();
  });

  test('renaming a folder moves its files', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'docs' }) });
    // Per le cartelle è selezionato tutto il nome: scrivere lo sostituisce.
    await page.keyboard.type('manuals');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(app.tree().getByText('manuals', { exact: true })).toBeVisible();
    await expect.poll(() => app.disk('manuals/guide.md')).toBe('# Guide');
    await expect.poll(() => app.exists('docs')).toBe(false);
  });

  test('the file menu has History, which opens the history panel for that file', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.history'), exact: true }).click();
    await app.expectOpen('note.md');
    await expect(page.getByRole('heading', { name: app.t('history.title', { path: 'note.md' }) })).toBeVisible();
  });
});

test.describe('keyboard', () => {
  const FILES = { 'a.md': 'A', 'docs/b.md': 'B', 'z.md': 'Z' };

  /** La riga dell'albero di una cartella è il <summary> del suo <details>. */
  const folderRow = (app: App, name: string) => app.tree().locator('summary').filter({ hasText: name });

  test.beforeEach(async ({ app }) => {
    await app.openFolder(FILES);
    await app.openFile('a.md');
  });

  test('one tab stop: the open file; the ⋯ buttons are not tab stops', async ({ app }) => {
    await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
    await expect(app.treeFile('a.md')).toHaveAttribute('tabindex', '0');
    await expect(app.tree().getByRole('button', { name: app.t('tree.actions', { name: 'a.md' }) })).toHaveAttribute('tabindex', '-1');
  });

  test('arrows, Home/End and left/right on folders move the focus', async ({ app, page }) => {
    await app.treeFile('a.md').focus();
    await page.keyboard.press('Home');
    await expect(folderRow(app, 'docs')).toBeFocused();
    await page.keyboard.press('ArrowRight'); // apre la cartella
    await page.keyboard.press('ArrowRight'); // entra nel primo figlio
    await expect(app.treeFile('b.md')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(app.treeFile('a.md')).toBeFocused();
    await page.keyboard.press('End');
    await expect(app.treeFile('z.md')).toBeFocused();

    await app.treeFile('b.md').focus();
    await page.keyboard.press('ArrowLeft'); // torna alla cartella
    await expect(folderRow(app, 'docs')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // la chiude
    await expect(app.treeFile('b.md')).toBeHidden();
  });

  test('Shift+F10 opens the menu with the focus inside, Esc brings it back to the row', async ({ app, page }) => {
    await app.treeFile('z.md').focus();
    await page.keyboard.press('Shift+F10');
    // Per un file la prima voce è "Cronologia".
    await expect(app.tree().getByRole('button', { name: app.t('tree.history'), exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(app.treeFile('z.md')).toBeFocused();
  });

  test('Enter on the ⋯ button opens the menu from the keyboard, for a folder too', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).focus();
    await page.keyboard.press('Enter');
    // Per una cartella la prima voce è "Nuovo file": dentro l'albero c'è solo come voce di menu.
    await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeHidden();
  });
});
