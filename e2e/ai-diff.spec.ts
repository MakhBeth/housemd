import type { Locator } from '@playwright/test';

import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
// .cm-mergeView, .cm-content e i pulsanti .cm-merge-revert: eccezioni ammesse dalla spec (§8.4).
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const blockButtons = (app: App, action: 'accept' | 'reject'): Locator =>
  app.page.locator(`.cm-merge-revert button[data-action=${action}]`);
/** Il documento (primo editor della MergeView) e la proposta (l'ultimo). */
const documentSide = (app: App) => mergeView(app).locator('.cm-content').first();
const proposal = (app: App) => mergeView(app).locator('.cm-content').last();
const lines = (content: Locator) =>
  content.locator('.cm-line').allInnerTexts().then((all) => all.map((t) => t.replace(/\n$/, '')).join('\n'));

/** Testo del documento: salvato con Ctrl+S e letto dal disco (niente accesso allo stato interno). */
async function docText(app: App, path = 'a.md'): Promise<string | null> {
  await app.page.keyboard.press('ControlOrMeta+s');
  await app.page.waitForTimeout(100);
  return app.disk(path);
}

async function review(app: App, original: string): Promise<void> {
  await app.openFolder({ 'a.md': original });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
}

test.describe('blocks', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await review(app, 'A\n\nB\n\nC');
    await expect(blockButtons(app, 'reject')).toHaveCount(2);
  });

  test('a proposal edited by hand: typed quickly, nothing lost, Accept all applies it', async ({ app, page }) => {
    await proposal(app).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' and more words');
    await expect.poll(() => lines(proposal(app))).toBe('A2\n\nB\n\nC2 and more words');
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC2 and more words');
  });

  test('block buttons from the keyboard: Enter accepts, Space rejects, the last reject closes the review', async ({ app, page }) => {
    await blockButtons(app, 'accept').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
    await expect(blockButtons(app, 'reject')).toHaveCount(1);
    await blockButtons(app, 'reject').first().focus();
    await page.keyboard.press('Space');
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
  });

  test('Ctrl+Z that brings the diff back leaves the focus in the document: the next shortcut reaches it', async ({ app, page, failOnConsole }) => {
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(mergeView(app)).toBeVisible();
    if (failOnConsole) {
      // Difetto noto, solo in sviluppo (`failOnConsole` è vero solo in e2e/dev.config.ts; misurato il 09/10):
      // StrictMode distrugge e ricrea la MergeView di DiffPane.tsx e il focus cade sul body. Lo si afferma
      // esplicitamente; il clic serve solo a proseguire. Il Task 5 della fase 5b toglie questo ramo.
      await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
      await documentSide(app).click();
    } else {
      await expect(documentSide(app)).toBeFocused();
    }
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC2');
  });
});

test('a proposal on a selection: edits outside the selection are dropped', async ({ app, ai, page }) => {
  const ORIGINAL = 'prefisso BAD\none\nBAD suffisso';
  ai.reply = 'GOOD\none\nGOOD';
  await app.openFolder({ 'a.md': ORIGINAL });
  await app.openFile('a.md');
  await app.mode('mode.editor').click();
  await app.selectRange(9, ORIGINAL.length - 9);
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
  const before = await lines(proposal(app));
  expect(before).toBe('prefisso GOOD\none\nGOOD suffisso');
  await proposal(app).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.type('X');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('Y');
  await expect.poll(() => lines(proposal(app))).toBe(before);
});
