import type { Locator } from '@playwright/test';

import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const discard = (app: App) => app.page.getByRole('button', { name: app.t('ai.discard'), exact: true });
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const blockButtons = (app: App, action: 'accept' | 'reject'): Locator =>
  app.page.locator(`.cm-merge-revert button[data-action=${action}]`);
/** Testo della proposta: l'ultimo editor della MergeView. */
const proposal = (app: App) => mergeView(app).locator('.cm-content').last();
/**
 * Testo di un editor CodeMirror riga per riga: textContent non mette gli a capo tra le .cm-line.
 * Una riga vuota contiene solo un <br>, che innerText rende come "\n".
 */
const lines = (content: Locator) =>
  content.locator('.cm-line').allInnerTexts().then((all) => all.map((t) => t.replace(/\n$/, '')).join('\n'));

/** Testo del documento: salvato con Ctrl+S e letto dal disco (niente accesso allo stato interno). */
async function docText(app: App, path = 'a.md'): Promise<string | null> {
  await app.page.keyboard.press('ControlOrMeta+s');
  await app.page.waitForTimeout(100);
  return app.disk(path);
}

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible(); // il controller AI è pronto
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

/** Invia una richiesta con Invio e aspetta la proposta. */
async function request(app: App): Promise<void> {
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
}

test.describe('whole document', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': '# Original\n\nParagraph.' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('Accept all applies the proposal; with no differences the review bar goes away', async ({ app }) => {
    await request(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(acceptAll(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('# Changed\n\nNew paragraph.');
  });

  test('undo works across views and a "before AI" version is in the history', async ({ app, page }) => {
    await request(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await app.mode('mode.editor').click();
    await app.editor().click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => lines(app.editor())).toBe('# Original\n\nParagraph.');
    await page.getByRole('button', { name: app.t('toolbar.history') }).click();
    await expect(
      page.getByRole('region', { name: app.t('toolbar.history') }).getByRole('button', { name: new RegExp(app.t('history.reason.before-ai')) }),
    ).toHaveCount(1);
  });

  test('hostile model output loads nothing remote', async ({ app, ai, page }) => {
    const remote: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes(':59999')) remote.push(r.url());
    });
    ai.reply =
      '---\nimage: http://127.0.0.1:59999/frontmatter\n---\n![x](http://127.0.0.1:59999/image)\n\n' +
      '<img src="http://127.0.0.1:59999/raw" srcset="http://127.0.0.1:59999/srcset 2x"><iframe src="http://127.0.0.1:59999/frame"></iframe>';
    ai.comment =
      'Nota ![x](http://127.0.0.1:59999/image) <img src="http://127.0.0.1:59999/raw"><iframe src="http://127.0.0.1:59999/frame"></iframe>';
    await request(app);
    await page.waitForTimeout(500);
    expect(remote).toEqual([]);
    const log = page.getByRole('log');
    await expect(log.locator('img, iframe')).toHaveCount(0);
    // L'immagine è resa come etichetta con l'host, da caricare solo con un clic esplicito.
    await expect(log.getByText('127.0.0.1:59999').first()).toBeVisible();
  });
});

test.describe('blocks', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
    await app.openFile('a.md');
    await enterAi(app);
    await request(app);
    await expect(blockButtons(app, 'reject')).toHaveCount(2);
  });

  test('both sides of the diff use the same font and line height', async ({ app }) => {
    const styles = await mergeView(app).locator('.cm-scroller').evaluateAll((els) =>
      els.map((el) => `${getComputedStyle(el).fontFamily}|${getComputedStyle(el).lineHeight}`),
    );
    expect(new Set(styles).size).toBe(1);
  });

  test('rejecting a block leaves the document alone and puts the original back in the proposal', async ({ app }) => {
    await blockButtons(app, 'reject').first().click();
    await expect.poll(() => lines(proposal(app))).toBe('A\n\nB\n\nC2');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
    // Rifiutato anche l'ultimo blocco: proposta scartata e barra chiusa.
    await blockButtons(app, 'reject').first().click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(discard(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
  });

  test('Ctrl+Z undoes a block accept, a block reject and Accept all', async ({ app, page }) => {
    await blockButtons(app, 'accept').first().click();
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');

    await expect(blockButtons(app, 'reject')).toHaveCount(2);
    await blockButtons(app, 'reject').first().click();
    await expect.poll(() => lines(proposal(app))).toBe('A\n\nB\n\nC2');
    await page.keyboard.press('ControlOrMeta+z');
    // Annulla il rifiuto senza toccare il testo arrivato dal modello.
    await expect.poll(() => lines(proposal(app))).toBe('A2\n\nB\n\nC2');

    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
    await expect(mergeView(app)).toBeVisible();
  });
});

test.describe('selection', () => {
  const ORIGINAL = 'prefisso BAD\none\ntwo\nthree\nfour\nfive\nBAD suffisso';
  const FROM = 9;
  const TO = ORIGINAL.length - 9;
  const REPLY = ORIGINAL.slice(FROM, TO).replaceAll('BAD', 'GOOD');
  const TARGET = `prefisso ${REPLY} suffisso`;

  test.beforeEach(async ({ app, ai }) => {
    ai.reply = REPLY;
    await app.openFolder({ 'a.md': ORIGINAL, 'b.md': 'uno\ndue\ntre\nquattro' });
  });

  test('the chip reflects a selection made in Editor mode', async ({ app }) => {
    await app.openFile('b.md');
    await app.mode('mode.editor').click();
    await app.selectRange(0, 11); // "uno\ndue\ntre"
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toBeVisible();
    await app.mode('mode.editor').click();
    await app.selectRange(4, 11); // "due\ntre"
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
  });

  test('Accept all on an intra-line selection keeps the text outside it', async ({ app }) => {
    await app.openFile('a.md');
    await app.mode('mode.editor').click();
    await app.selectRange(FROM, TO);
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 7 }), { exact: true })).toBeVisible();
    await request(app);
    await acceptAll(app).click();
    await expect.poll(() => docText(app)).toBe(TARGET);
  });

  test('accepting the blocks one by one keeps the selection boundaries', async ({ app }) => {
    await app.openFile('a.md');
    await app.mode('mode.editor').click();
    await app.selectRange(FROM, TO);
    await enterAi(app);
    await request(app);
    await expect(blockButtons(app, 'accept')).toHaveCount(2);
    await blockButtons(app, 'accept').first().click();
    await blockButtons(app, 'accept').first().click();
    await expect.poll(() => docText(app)).toBe(TARGET);
  });

  test('"Use the whole document" drops the selection chip', async ({ app }) => {
    await app.openFile('b.md');
    await app.mode('mode.editor').click();
    await app.selectRange(0, 11);
    await enterAi(app);
    await app.page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toHaveCount(0);
  });
});

// React 19 vuole `popoverTarget`: il chip del profilo deve continuare ad aprire il suo popover.
test('the profile chip opens its popover with the profile choice', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
  const current = page.getByRole('radio', { checked: true });
  await expect(current).toBeHidden();
  await chip.click();
  await expect(current).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(current).toBeHidden();
});

// Anche il pulsante degli avvisi della revisione apre il suo popover con popovertarget (popoverTarget in React 19).
test('the warnings button of the review opens its popover', async ({ app, ai, page }) => {
  ai.reply = 'See [[Other]]';
  await app.openFolder({ 'a.md': 'See [[Target]]' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  const composer = page.getByRole('textbox', { name: app.t('ai.request') });
  await composer.fill('fix');
  await composer.press('Enter');
  const warnings = page.getByRole('button', { name: app.t('ai.warningsCount', { count: 1 }) });
  const item = page.getByRole('button', { name: app.t('ai.warning.wikilinks') });
  await expect(warnings).toBeVisible();
  await expect(item).toBeHidden();
  await warnings.click();
  await expect(item).toBeVisible();
});
