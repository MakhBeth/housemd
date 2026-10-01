import { expect, test } from './support/app.ts';

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
