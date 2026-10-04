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

// Con le animazioni attive il cambio passa dalla view transition (src/theme/pixelTransition.ts), dove
// React deve aggiornare il pulsante in modo sincrono (flushSync): il resto della suite usa reducedMotion.
test.describe('with animations on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the theme cycle runs through the view transition and updates the button each time', async ({ app, page }) => {
    // Conta le chiamate a startViewTransition (senza, il test passerebbe anche con il ripiego sincrono) e,
    // appena la callback è tornata (senza attendere microtask), registra l'etichetta del pulsante del tema: deve già essere quella nuova,
    // cioè React ha aggiornato il DOM in modo sincrono dentro la transizione (flushSync).
    const labels = [app.t('theme.light'), app.t('theme.dark'), app.t('theme.auto')];
    await page.addInitScript((themeLabels) => {
      const w = window as unknown as { __viewTransitions: number; __labelsInTransition: (string | null | undefined)[] };
      w.__viewTransitions = 0;
      w.__labelsInTransition = [];
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = ((callback?: ViewTransitionUpdateCallback) => {
        w.__viewTransitions++;
        const wrapped: ViewTransitionUpdateCallback | undefined = callback && (() => {
          const result = callback();
          w.__labelsInTransition.push(
            [...document.querySelectorAll('button')]
              .map((b) => b.getAttribute('aria-label'))
              .find((l) => l !== null && themeLabels.includes(l)),
          );
          return result;
        });
        return original(wrapped);
      }) as typeof document.startViewTransition;
    }, labels);
    await app.openFolder({ 'note.md': '# Note' });
    const html = page.locator('html');
    await page.getByRole('button', { name: app.t('theme.auto') }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: app.t('theme.light') }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: app.t('theme.dark') }).click();
    await expect(html).toHaveAttribute('data-theme', 'auto');
    await expect(page.getByRole('button', { name: app.t('theme.auto') })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __viewTransitions: number }).__viewTransitions))
      .toBe(3);
    expect(
      await page.evaluate(() => (window as unknown as { __labelsInTransition: unknown[] }).__labelsInTransition),
    ).toEqual(labels);
  });
});
