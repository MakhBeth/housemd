import { expect, test, type App } from './support/app.ts';

const NOTE = [
  '---',
  'title: Visual reference',
  'tags: [alpha, beta]',
  'date: 2026-01-15',
  '---',
  '# Heading',
  '',
  'Some *emphasis*, **strong**, `code` and a [[wikilink]].',
  '',
  '- one',
  '- two',
  '',
  '> a quote',
  '',
  '```ts',
  'const answer = 42;',
  '```',
].join('\n');

/** Data fissa: i tempi relativi della cronologia non cambiano tra un'esecuzione e l'altra. */
const NOW = new Date('2026-10-01T10:00:00+02:00');

async function shot(app: App, name: string, { keepMouse = false } = {}): Promise<void> {
  // Il mouse resta dove è stato l'ultimo clic: un tooltip sotto il puntatore renderebbe lo scatto casuale.
  if (!keepMouse) {
    await app.page.mouse.move(1279, 799);
    // I tooltip spariscono con una transizione di 0,15 s (global.css), che reducedMotion non ferma.
    await app.page.waitForTimeout(300);
  }
  await app.page.evaluate(() => document.fonts.ready);
  await expect(app.page).toHaveScreenshot(name);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('start screen', async ({ app }) => {
      await app.start();
      await shot(app, `start-${scheme}.png`);
    });

    test('workspace in split mode', async ({ app }) => {
      await app.openFolder({ 'note.md': NOTE, 'docs/guide.md': '# Guide' });
      await app.openFile('note.md');
      await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
      await shot(app, `workspace-${scheme}.png`);
    });

    test('settings', async ({ app, page }) => {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await expect(page.getByRole('region', { name: app.t('settings.title') })).toBeVisible();
      await shot(app, `settings-${scheme}.png`);
    });

    test('AI review', async ({ app, ai, page }) => {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      await shot(app, `ai-review-${scheme}.png`);
    });
  });
}

test('name dialog', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('button', { name: app.t('file.new') }).first().click();
  await page.getByRole('dialog', { name: app.t('file.new') }).getByRole('textbox').fill('draft');
  await shot(app, 'name-dialog.png');
});

test('tree actions menu', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
  await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
  await expect(page.getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeVisible();
  await shot(app, 'tree-menu.png');
});

test('toast', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(app.toast(prefix)).toBeVisible();
  await app.page.evaluate(() => document.fonts.ready);
  // I toast informativi spariscono dopo 6 s: lo snapshot va preso subito.
  await expect(app.page).toHaveScreenshot('toast.png', { timeout: 3000 });
});

test('conflict bar', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('mine');
  await page.clock.runFor(100);
  await app.writeExternal('note.md', 'theirs, longer text');
  await app.windowFocus();
  await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
  await shot(app, 'conflict.png');
});

test('formatting toolbar with tooltip', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
  await app.selectRange(4, 7);
  const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
  await bold.hover();
  await expect.poll(() => bold.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
  await shot(app, 'format-toolbar.png', { keepMouse: true });
});

test('history panel', async ({ app, page }) => {
  await page.clock.install({ time: NOW });
  await app.openFolder({ 'note.md': 'v0' });
  await app.openFile('note.md');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v1');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('v1');
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  const panel = page.getByRole('region', { name: app.t('toolbar.history') });
  await panel.getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).first().click();
  await page.clock.pauseAt(NOW.getTime() + 60_000);
  await shot(app, 'history.png');
});
