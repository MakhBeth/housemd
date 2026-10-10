import type { Locator } from '@playwright/test';

import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

/**
 * Testo di un editor CodeMirror riga per riga (textContent non mette gli a capo tra le .cm-line; una riga
 * vuota contiene solo un <br>, che innerText rende come "\n").
 */
const lines = (content: Locator) =>
  content.locator('.cm-line').allInnerTexts().then((all) => all.map((t) => t.replace(/\n$/, '')).join('\n'));

/**
 * L'editor della modalità AI: non sta nella regione «Editor» della vista divisa. `.cm-content` è
 * un'eccezione ammessa dalla spec (§8.4); il composer è un <textarea>, non un .cm-content.
 */
const aiEditor = (app: App) => app.page.locator('.cm-content');

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible(); // il controller AI è pronto
  await app.mode('mode.ai').click();
  await expect(app.page.getByRole('textbox', { name: app.t('ai.request') })).toBeVisible();
}

test('opening another file starts from an empty undo history', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# Alpha', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await app.typeAtEnd(' edited');
  await app.openFile('b.md');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('# Beta');
  await app.openFile('a.md');
  await expect(app.editor()).toHaveText('# Alpha edited');
});

test('a file reloaded from disk replaces the text and the undo history', async ({ app, page }) => {
  await app.openFolder({ 'note.md': 'start' });
  await app.openFile('note.md');
  await app.typeAtEnd(' mine');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('start mine');
  await app.writeExternal('note.md', 'from outside');
  await app.windowFocus();
  await expect(app.editor()).toHaveText('from outside');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('from outside');
});

test('the AI mode editor continues the undo history of the split editor', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'one' });
  await app.openFile('a.md');
  await app.typeAtEnd(' two');
  await enterAi(app);
  await expect.poll(() => lines(aiEditor(app))).toBe('one two');
  await aiEditor(app).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => lines(aiEditor(app))).toBe('one');
});

test('a selection made in the AI mode editor shows the chip', async ({ app, page }) => {
  await app.openFolder({ 'b.md': 'uno\ndue\ntre\nquattro' });
  await app.openFile('b.md');
  await enterAi(app);
  await aiEditor(app).click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let i = 0; i < 11; i++) await page.keyboard.press('Shift+ArrowRight'); // "uno\ndue\ntre"
  await expect(page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toBeVisible();
});

test('the formatting toolbar follows the interface language', async ({ app, page }) => {
  const it = (key: string) => translate(messagesFor('it'), key);
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  await page.getByRole('region', { name: it('pane.editor') }).getByRole('textbox').click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
  const toolbar = page.getByRole('toolbar', { name: it('format.toolbar') });
  await expect(toolbar.getByRole('button', { name: it('format.bold') })).toBeVisible();
});
