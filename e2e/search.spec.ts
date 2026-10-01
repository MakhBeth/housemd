import { expect, test } from './support/app.ts';

const FILES = {
  'alpha.md': '# Alpha\n\nThe quick brown fox jumps.',
  'beta.md': '# Beta\n\nNothing to see here.',
  'sub/gamma.md': '# Gamma\n\nAnother fox story.',
};

test.beforeEach(async ({ app }) => {
  await app.openFolder(FILES);
});

test('Ctrl+K focuses the search box and results show matches', async ({ app, page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await expect(box).toBeFocused();
  await box.fill('fox');
  const results = page.getByRole('list', { name: app.t('search.results') });
  await expect(results.getByRole('button')).toHaveCount(2);
  await expect(results.locator('mark').first()).toBeVisible();

  await results.getByRole('button', { name: /Gamma/ }).click();
  await app.expectOpen('gamma.md');
  // I termini cercati sono evidenziati nell'anteprima con la CSS Custom Highlight API.
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get('housemd-search')?.size ?? 0))
    .toBeGreaterThan(0);
});

test('Enter opens the first result without waiting', async ({ app, page }) => {
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('Nothing');
  await box.press('Enter');
  await app.expectOpen('beta.md');
});

test('no results, then Esc clears the query', async ({ app, page }) => {
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('zzzzqqq');
  await expect(page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  await box.press('Escape');
  await expect(box).toHaveValue('');
  await expect(page.getByRole('list', { name: app.t('search.results') })).toHaveCount(0);
});
