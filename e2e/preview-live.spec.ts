import { translate } from '../src/i18n/i18n.ts';
import { expect, test } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
import { messagesFor } from './support/i18n.ts';

const PIXEL = { base64: PIXEL_PNG_BASE64 };

test('typing reaches the preview after the pause, switching file right away', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'a.md': '# Alpha', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Alpha' })).toBeVisible();
  // Da qui nessun timer dell'app scatta se non lo facciamo avanzare noi.
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('\n\n## Later');
  await page.clock.runFor(100); // meno dei 150 ms del debounce
  await expect(app.previewPane().getByRole('heading', { name: 'Later' })).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(app.previewPane().getByRole('heading', { name: 'Later' })).toBeVisible();
  // Il cambio di file non aspetta il debounce (l'orologio resta fermo).
  await app.openFile('b.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Beta' })).toBeVisible();
});

test('the frontmatter card shows its image, the description and the other fields', async ({ app }) => {
  await app.openFolder({
    'card.md': ['---', 'title: Card', 'description: A short description', 'image: assets/pixel.png', 'author: Ada', '---', 'Body text'].join('\n'),
    'assets/pixel.png': PIXEL,
  });
  await app.openFile('card.md');
  const preview = app.previewPane();
  await expect(preview.getByText('A short description', { exact: true })).toBeVisible();
  await expect(preview.getByRole('term')).toHaveText(['author']);
  await expect(preview.getByRole('definition')).toHaveText(['Ada']);
  // L'immagine della scheda ha alt="" (decorativa, nessun ruolo): la si trova dall'URL blob della cartella.
  await expect(preview.locator('img[src^="blob:"]')).toHaveCount(1);
});

test('a language change renders the preview again: card date and missing image title', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await app.openFolder({ 'note.md': '---\ndate: 2026-01-15\n---\n![missing](missing.png)' });
  await app.openFile('note.md');
  await expect(app.previewPane().getByText('January 15, 2026', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const preview = page.getByRole('region', { name: it('pane.preview') });
  await expect(preview.getByText('15 gennaio 2026', { exact: true })).toBeVisible();
  await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute('title', it('preview.imageMissing', { path: 'missing.png' }));
});

test('leaving the preview and coming back loads the images again', async ({ app }) => {
  await app.openFolder({ 'a.md': '# A\n\n![pixel](assets/pixel.png)', 'assets/pixel.png': PIXEL });
  await app.openFile('a.md');
  const pixel = app.previewPane().getByRole('img', { name: 'pixel' });
  await expect(pixel).toHaveAttribute('src', /^blob:/);
  await app.mode('mode.editor').click();
  await expect(app.previewPane()).toHaveCount(0);
  await app.mode('mode.split').click();
  await expect(pixel).toHaveAttribute('src', /^blob:/);
  // URL ancora valido: la cache revocata all'uscita non lascia un'immagine rotta.
  await expect.poll(() => pixel.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBeGreaterThan(0);
});

test("HTML in a note cannot take the preview's own classes", async ({ app }) => {
  await app.openFolder({ 'a.md': '# Title\n\n<div class="scroller">inner scroller</div>\n\n<div class="prose">inner prose</div>' });
  await app.openFile('a.md');
  const preview = app.previewPane();
  await expect(preview.getByText('inner prose', { exact: true })).toBeVisible();
  const overflow = await preview.getByText('inner scroller', { exact: true }).evaluate((node) => getComputedStyle(node).overflowY);
  const maxWidth = await preview.getByText('inner prose', { exact: true }).evaluate((node) => getComputedStyle(node).maxWidth);
  expect([overflow, maxWidth]).toEqual(['visible', 'none']);
});
