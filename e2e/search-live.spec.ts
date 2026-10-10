import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const FILES = {
  'alpha.md': '# Alpha\n\nThe quick brown fox jumps.',
  'beta.md': '# Beta\n\nNothing to see here.',
};

const box = (app: App) => app.page.getByRole('searchbox', { name: app.t('search.label') });
const results = (app: App) => app.page.getByRole('list', { name: app.t('search.results') });

test('results wait for the 120 ms pause after the last key', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder(FILES);
  // Tempo fermo: solo runFor lo fa avanzare (con install da solo il tempo scorre anche da sé).
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await box(app).fill('fox');
  await page.clock.runFor(100);
  await expect(results(app).getByRole('button')).toHaveCount(0);
  await page.clock.runFor(30);
  await expect(results(app).getByRole('button')).toHaveCount(1);
});

test('typing quickly keeps every character and the focus in the box', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).click();
  await page.keyboard.type('quick brown');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.keyboard.type(' fox');
  await expect(box(app)).toHaveValue('quick brown fox');
  await expect(box(app)).toBeFocused();
  await expect(results(app).getByRole('button')).toHaveCount(1);
});

test('a file that starts matching while the query is in the box shows up; the box keeps the focus', async ({ app }) => {
  await app.openFolder(FILES);
  await box(app).fill('unicorn');
  await expect(app.page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  await app.writeExternal('fresh.md', '# Fresh\n\nunicorn');
  await app.windowFocus();
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await expect(box(app)).toBeFocused();
  await expect(box(app)).toHaveValue('unicorn');
});

test('a result reached with Tab opens with Enter, with the terms highlighted', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(results(app).getByRole('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await app.expectOpen('alpha.md');
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('housemd-search')?.size ?? 0)).toBeGreaterThan(0);
});

test('Enter with no result opens nothing', async ({ app }) => {
  await app.openFolder(FILES);
  await box(app).fill('zzzzqqq');
  await box(app).press('Enter');
  await expect(app.editorPane()).toHaveCount(0);
  await expect(box(app)).toBeFocused();
});

test('the search box follows the interface language', async ({ app, page }) => {
  const it = (key: string) => translate(messagesFor('it'), key);
  await app.openFolder(FILES);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const search = page.getByRole('searchbox', { name: it('search.label') });
  await expect(search).toHaveAttribute('placeholder', it('search.placeholder'));
  await search.fill('zzzzqqq');
  await expect(page.getByText(it('search.none'), { exact: true })).toBeVisible();
  await search.fill('fox');
  await expect(page.getByRole('list', { name: it('search.results') }).getByRole('button')).toHaveCount(1);
});

test('the sidebar hidden and shown again starts with an empty search', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: app.t('sidebar.hide') }).first().click();
  await expect(box(app)).toHaveCount(0);
  await page.getByRole('button', { name: app.t('sidebar.show') }).click();
  await expect(box(app)).toHaveValue('');
  await expect(results(app)).toHaveCount(0);
});

test('a result that disappears while it has the focus: the focus goes back to the box', async ({ app }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await results(app).getByRole('button').focus();
  await app.removeExternal('alpha.md');
  await app.windowFocus();
  await expect(app.page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  // Decisione 3: il focus torna nella casella, non sul body.
  await expect(box(app)).toBeFocused();
});

test('a focused result that moves up (the index changed) keeps the focus', async ({ app }) => {
  await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'gamma.md': '# Gamma\n\nAnother fox story.' });
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(2);
  // Il secondo risultato (quale dei due lo decide l'indice) diventa il primo dopo una modifica esterna.
  const second = results(app).getByRole('button').last();
  const path = (await second.textContent())!.includes('gamma.md') ? 'gamma.md' : 'alpha.md';
  const moved = results(app).getByRole('button', { name: new RegExp(path.replace('.', '\\.')) });
  await moved.focus();
  await app.writeExternal(path, '# Fox fox fox\n\nfox fox fox fox');
  await app.windowFocus();
  await expect(results(app).getByRole('button').first()).toHaveAccessibleName(new RegExp(path.replace('.', '\\.')));
  // Riordinato da reconcileList con moveBefore (con React spostando l'altra riga): il focus resta.
  await expect(moved).toBeFocused();
});
