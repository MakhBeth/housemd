import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const send = (app: App) => app.page.getByRole('button', { name: app.t('ai.send'), exact: true });
const stop = (app: App) => app.page.getByRole('button', { name: app.t('ai.stop'), exact: true });
const previous = (app: App) => app.page.getByRole('button', { name: app.t('ai.previous') });
const next = (app: App) => app.page.getByRole('button', { name: app.t('ai.next') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const discard = (app: App) => app.page.getByRole('button', { name: app.t('ai.discard'), exact: true });
// .cm-mergeView e .cm-content: eccezioni ammesse dalla spec (§8.4).
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const documentSide = (app: App) => mergeView(app).locator('.cm-content').first();
/** L'editor semplice della revisione (senza diff): l'unico .cm-content nella pagina. */
const plainEditor = (app: App) => app.page.locator('.cm-content');
/** La proposta è arrivata: il diff è visibile. Non «Accetta tutto attivo»: con i pulsanti mai disattivati (6c) passerebbe subito. */
const proposalShown = (app: App) => expect(mergeView(app)).toBeVisible();

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

test.describe('review bar', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('while generating nothing is disabled: Previous, Next and Accept all say why in the note (again at every click) and keep the focus; the seconds are not live, a hidden region says the start; the note goes with the proposal', async ({ app, ai, page }) => {
    await page.clock.install();
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    const counter = page.getByText(app.t('ai.generating', { seconds: 0 }).replace(/0 s$/, ''), { exact: false });
    await expect(counter).toBeVisible();
    await expect(counter).not.toHaveAttribute('aria-live');
    // La regione nascosta entra vuota e il testo arriva dopo `ANNOUNCE_DELAY_MS`: con l'orologio finto si fa avanzare.
    await page.clock.runFor(200);
    await expect(page.getByText(app.t('ai.generatingStarted'), { exact: true })).toHaveAttribute('aria-live', 'polite');
    const note = page.getByRole('status').filter({ hasText: app.t('ai.review.generating') });
    for (const button of [previous(app), next(app), acceptAll(app)]) {
      await expect(button).toBeEnabled();
      await button.click();
      // Dal secondo clic la stessa nota si svuota e torna dopo `ANNOUNCE_DELAY_MS` (ri-annuncio, LAB-11).
      await page.clock.runFor(200);
      await expect(note).toBeVisible();
      await expect(button).toBeFocused();
    }
    expect(ai.requests).toBe(1);
    // Tre pause di 200 ms già passate: 1,5 s in più portano il contatore a 2 s.
    await page.clock.runFor(1500);
    await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
    ai.release();
    await proposalShown(app);
    await expect(counter).toHaveCount(0);
    await expect(note).toHaveCount(0);
    for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) await expect(button).toBeEnabled();
  });

  test('Discard while generating stops the request and discards the proposal (Discard = Stop + discard)', async ({ app, ai, page }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await discard(app).click();
    await expect(send(app)).toBeVisible();
    await expect(discard(app)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: app.t('ai.review.generating') })).toHaveCount(0);
    ai.release();
    await expect(mergeView(app)).toHaveCount(0);
    expect(ai.requests).toBe(1);
  });

  test('the proposal arrives with the focus on Accept all (keyboard): the focus stays on the button, it does not jump into the diff', async ({ app, ai, page }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(acceptAll(app)).toBeVisible();
    // Tab fino ad Accetta tutto, come un utente da tastiera durante la generazione.
    for (let i = 0; i < 40 && !(await acceptAll(app).evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(acceptAll(app)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: app.t('ai.review.generating') })).toBeVisible();
    await expect(acceptAll(app)).toBeFocused();
    ai.release();
    await proposalShown(app);
    // Rilievo di A11y su LAB-11: nessun cambio di focus senza un'azione (nel diff un secondo Invio scriverebbe nel documento).
    await expect(acceptAll(app)).toBeFocused();
    await expect(documentSide(app)).toHaveText('ABC');
  });

  test('a truncated proposal: Accept all says to accept the changes one at a time and keeps the focus, the block buttons work; the note goes with the proposal', async ({ app, ai, page }) => {
    ai.finishReason = 'length';
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    // Il testo c'è due volte: lo stato visibile e la regione nascosta che annuncia l'esito (P1): il primo è quello visibile.
    await expect(page.getByText(app.t('ai.status.truncated')).first()).toBeVisible();
    const note = page.getByRole('status').filter({ hasText: app.t('ai.review.truncated') });
    await expect(acceptAll(app)).toBeEnabled();
    await acceptAll(app).click();
    await expect(note).toBeVisible();
    await expect(acceptAll(app)).toBeFocused();
    expect(await page.locator('.cm-mergeView').count()).toBe(1);
    await expect(page.locator('.cm-merge-revert button[data-action=accept]').first()).toBeEnabled();
    await discard(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(note).toHaveCount(0);
  });

  test('Accept all with the focus on the button: the proposal is applied and the focus is in the editor; Ctrl+Z brings the diff back with the focus in it', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await acceptAll(app).focus();
    await page.keyboard.press('Enter');
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await proposalShown(app);
    await expect(documentSide(app)).toBeFocused();
  });

  test('Discard after a complete Accept all and Ctrl+Z: the proposal goes, the hint comes back and the focus is in the editor', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await proposalShown(app);
    await discard(app).focus();
    await page.keyboard.press('Enter');
    await expect(mergeView(app)).toHaveCount(0);
    await expect(page.getByText(app.t('ai.emptyProposal'))).toBeVisible();
    await expect(plainEditor(app)).toBeFocused();
  });

  test('Discard straight away keeps the document and leaves the focus in the editor', async ({ app }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await discard(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toBeFocused();
    await expect(plainEditor(app)).toHaveText('ABC');
  });

  test('Accept all after editing the document asks for confirmation: cancelled keeps the diff and the focus on the button, confirmed applies', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await documentSide(app).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('!');
    await acceptAll(app).click();
    const dialog = page.getByRole('dialog', { name: app.t('ai.acceptAll') });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(app.t('ai.changedWarning'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(dialog).toHaveCount(0);
    await proposalShown(app);
    await expect(acceptAll(app)).toBeFocused();
    await acceptAll(app).click();
    await dialog.getByRole('button', { name: app.t('ai.acceptAll') }).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toHaveText('A2BC2');
  });

  test('Previous and Next move the cursor between the changes of the document side', async ({ app }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    // La riga attiva di CodeMirror (basicSetup) segue il cursore anche senza il focus nell'editor: .cm-line è un'eccezione ammessa (§8.4).
    const lines = documentSide(app).locator('.cm-line');
    await next(app).click();
    await expect(lines.nth(4)).toHaveClass(/cm-activeLine/);
    await previous(app).click();
    await expect(lines.nth(0)).toHaveClass(/cm-activeLine/);
  });

  test('the bar follows the interface language', async ({ app, page }) => {
    const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await page.getByLabel(app.t('settings.language')).selectOption('it');
    await page.getByRole('button', { name: it('settings.close') }).click();
    await expect(page.getByRole('button', { name: it('ai.previous') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.next') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.discard'), exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.acceptAll'), exact: true })).toBeVisible();
  });
});

test.describe('composer without a document', () => {
  test('with no document open, Send says where to go, keeps the draft and the focus; the draft is still there after opening a document from the editor (LAB-10)', async ({ app, ai, page }) => {
    await app.openFolder({ 'a.md': 'A' });
    await enterAi(app);
    await composer(app).fill('fix');
    await send(app).click();
    const note = page.getByRole('status').filter({ hasText: app.t('ai.composer.noDocument') });
    await expect(note).toBeVisible();
    await expect(composer(app)).toHaveValue('fix');
    await expect(send(app)).toBeFocused();
    expect(ai.requests).toBe(0);
    // Aprire un documento passa dalla modalità editor: la sidebar AI si ricrea, la nota riparte da zero, la bozza resta.
    await app.mode('mode.editor').click();
    await app.openFile('a.md');
    await app.mode('mode.ai').click();
    await expect(note).toHaveCount(0);
    await expect(composer(app)).toHaveValue('fix');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
  });

  test('Enter in the composer during a generation says so and keeps the draft; the note goes when the generation ends', async ({ app, ai, page }) => {
    ai.hold();
    await app.openFolder({ 'a.md': 'A' });
    await app.openFile('a.md');
    await enterAi(app);
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await expect(page.getByRole('group', { name: app.t('ai.suggestions') })).toHaveCount(0);
    const note = page.getByRole('status').filter({ hasText: app.t('ai.composer.generating') });
    await composer(app).fill('again');
    await composer(app).press('Enter');
    await expect(note).toBeVisible();
    await expect(composer(app)).toHaveValue('again');
    await expect(composer(app)).toBeFocused();
    expect(ai.requests).toBe(1);
    ai.release();
    await proposalShown(app);
    await expect(note).toHaveCount(0);
  });
});
