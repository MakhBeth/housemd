import { expect, test } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';

const PIXEL = { base64: PIXEL_PNG_BASE64 };

const NOTE = [
  '---',
  'title: Test note',
  'tags: [alpha, beta]',
  'date: 2026-01-15',
  '---',
  '# Heading',
  '',
  'Go to [[idea]], to [[brand new]], to [other](sub/other.md), to [accent](citt%C3%A0.md) or [outside](https://example.com).',
  '',
  '![missing](missing.png)',
  '',
  '![pixel](assets/pixel.png)',
  '',
  '<img src="x.png" onerror="window.__pwned = 1">',
  '',
  '<a href="javascript:window.__pwned = 2">bad link</a>',
  '',
  '<script>window.__pwned = 3</script>',
  '',
].join('\n');

const FILES = {
  'note.md': NOTE,
  'idea.md': '# Idea',
  'sub/other.md': '# Other',
  'città.md': '# Città',
  'assets/pixel.png': PIXEL,
  'bad.md': '---\ntitle: [\n---\nbody',
};

test.beforeEach(async ({ app }) => {
  await app.openFolder(FILES);
  await app.openFile('note.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
});

test('renders markdown and the frontmatter card', async ({ app }) => {
  const preview = app.previewPane();
  await expect(preview.getByText('Test note', { exact: true })).toBeVisible();
  await expect(preview.getByText('alpha', { exact: true })).toBeVisible();
  await expect(preview.getByText('beta', { exact: true })).toBeVisible();
  await expect(preview.getByText('January 15, 2026', { exact: true })).toBeVisible();
});

test('local images load from the folder, missing ones say so', async ({ app }) => {
  const preview = app.previewPane();
  await expect(preview.getByRole('img', { name: 'pixel' })).toHaveAttribute('src', /^blob:/);
  // Le immagini dell'anteprima tengono il title nativo (niente ::after su <img>): eccezione voluta.
  await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute(
    'title',
    app.t('preview.imageMissing', { path: 'missing.png' }),
  );
});

test('hostile HTML in a note is neutralized', async ({ app, page }) => {
  const preview = app.previewPane();
  await expect(preview.locator('script')).toHaveCount(0);
  await expect(preview.getByText('bad link')).not.toHaveAttribute('href', /javascript:/);
  // Lascia al browser il tempo di caricare (e far fallire) le immagini.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('external links open in a new tab without opener', async ({ app }) => {
  const link = app.previewPane().getByRole('link', { name: 'outside', exact: true });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('wikilinks and relative links open files, a missing wikilink creates the note', async ({ app }) => {
  const preview = app.previewPane();
  await preview.getByRole('link', { name: 'idea', exact: true }).click();
  await app.expectOpen('idea.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'other', exact: true }).click();
  await app.expectOpen('other.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'accent', exact: true }).click();
  await app.expectOpen('città.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'brand new', exact: true }).click();
  await app.expectOpen('brand new.md');
  await expect.poll(() => app.disk('brand new.md')).toBe('');
});

test('the preview follows the editor', async ({ app }) => {
  await app.typeAtEnd('\n## Added later');
  await expect(app.previewPane().getByRole('heading', { name: 'Added later' })).toBeVisible();
});

test('invalid frontmatter is reported in the preview', async ({ app }) => {
  await app.openFile('bad.md');
  const prefix = app.t('preview.frontmatterInvalid', { detail: '' }).trim();
  await expect(app.previewPane().getByText(prefix)).toBeVisible();
});
