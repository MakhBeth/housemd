import { expect, test } from './support/app.ts';
import { seedFolder } from './support/fsHarness.ts';

test('opening a folder lists markdown files and visible folders only', async ({ app, page }) => {
  await app.openFolder({
    'note.md': '# Note',
    'sub/other.md': 'other',
    '.hidden/secret.md': 'secret',
  });
  await expect(app.treeFile('note.md')).toBeVisible();
  await expect(app.tree().getByText('sub', { exact: true })).toBeVisible();
  await expect(app.tree().getByText('.hidden', { exact: true })).toHaveCount(0);
  await expect(page.getByText(app.t('toolbar.noFile'), { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('HouseMD');
});

test.describe('browser without File System Access', () => {
  test.use({
    flags: { picker: false },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  });

  test('explains why and offers no open button', async ({ app, page }) => {
    await app.start();
    await expect(page.getByText(app.t('unsupported.firefox'))).toBeVisible();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toHaveCount(0);
  });
});

test('after a reload the folder and the last open file come back', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha', 'b.md': 'beta' });
  await app.openFile('b.md');
  await page.reload();
  await app.expectOpen('b.md');
  await expect(app.editor()).toHaveText('beta');
});

test('without permission the start screen offers to resume access', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  await app.setFlags({ query: 'prompt', request: 'granted' });
  await page.reload();
  const resume = page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) });
  await expect(resume).toBeVisible();
  await expect(page.getByRole('button', { name: app.t('start.openOther') })).toBeVisible();
  await resume.click();
  await expect(app.treeFile('a.md')).toBeVisible();
});

test('a denied resume leaves the start screen in place', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  await app.setFlags({ query: 'prompt', request: 'denied' });
  await page.reload();
  const resume = page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) });
  await resume.click();
  await expect(resume).toBeVisible();
  await expect(app.tree()).toHaveCount(0);
});

test('switching folders A → B → A brings back the last file of A', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' }, 'alpha');
  await app.openFile('a.md');
  await seedFolder(page, 'beta', { 'b.md': 'beta' });
  await app.setFlags({ folder: 'beta' });
  // Il pulsante della cartella nella sidebar non ha aria-label: il nome è il nome della cartella, più
  // il testo del tooltip quando il mouse ci è sopra (::after visibile). Per questo si cerca il prefisso.
  await page.getByRole('button', { name: /^alpha\b/ }).click();
  await expect(app.treeFile('b.md')).toBeVisible();
  await expect(app.treeFile('a.md')).toHaveCount(0);
  await app.setFlags({ folder: 'alpha' });
  await page.getByRole('button', { name: /^beta\b/ }).click();
  await app.expectOpen('a.md');
});

test('an invalid .housemd.json shows a toast and the app still opens', async ({ app }) => {
  await app.openFolder({ 'a.md': 'alpha', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(app.toast(prefix)).toBeVisible();
  await expect(app.treeFile('a.md')).toBeVisible();
});
