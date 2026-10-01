import { translate } from '../src/i18n/i18n.ts';
import { expect, test } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

test('theme button cycles auto → light → dark; index.html applies dark before the app starts', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'auto');

  await page.getByRole('button', { name: app.t('theme.auto') }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: app.t('theme.light') }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161a');

  // Si trattiene il modulo dell'app durante il ricaricamento: quello che si vede finché è fermo lo
  // ha fatto solo lo script inline di index.html.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/assets/index-*.js', async (route) => {
    await held;
    await route.continue();
  });
  await page.reload({ waitUntil: 'commit' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await html.evaluate((el) => (el as HTMLElement).style.colorScheme)).toBe('dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161a');
  // L'app non è ancora partita: il punto di montaggio è vuoto.
  await expect(page.locator('#root')).toBeEmpty();

  release();
  await page.unroute('**/assets/index-*.js');
  await expect(page.getByRole('button', { name: app.t('theme.dark') })).toBeVisible();
});

test('switching language in the settings updates the UI right away and is remembered', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const it = (key: string) => translate(messagesFor('it'), key);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('heading', { name: it('settings.title'), level: 1 })).toBeVisible();
  await page.getByRole('button', { name: it('settings.close') }).click();
  await expect(page.getByRole('button', { name: it('toolbar.settings') })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: it('toolbar.settings') })).toBeVisible();
});

test.describe('Italian', () => {
  test.use({ appLocale: 'it' });

  test('a saved language preference is used, <html lang> follows', async ({ app, page }) => {
    await app.start();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  });
});

test.describe('unknown saved language', () => {
  test.use({ appLocale: 'it', locale: 'it-IT' });

  test('falls back to the browser language', async ({ app, page }) => {
    await page.addInitScript(() => localStorage.setItem('housemd:locale', JSON.stringify('xx')));
    await app.start();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
  });
});
