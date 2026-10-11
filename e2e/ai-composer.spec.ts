import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const send = (app: App) => app.page.getByRole('button', { name: app.t('ai.send'), exact: true });
const stop = (app: App) => app.page.getByRole('button', { name: app.t('ai.stop'), exact: true });
const newChat = (app: App) => app.page.getByRole('button', { name: app.t('ai.newChat') });
const log = (app: App) => app.page.getByRole('log');
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const chip = (app: App) => app.page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
const focusOnBody = (app: App) => app.page.evaluate(() => document.activeElement === document.body);

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

test.describe('composer', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': 'uno\ndue\ntre', 'b.md': 'B' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('Send waits for some text; Shift+Enter and Ctrl+Enter do not send; Enter sends and empties the box', async ({ app, ai }) => {
    await expect(send(app)).toBeDisabled();
    await composer(app).fill('   ');
    await expect(send(app)).toBeDisabled();
    await composer(app).fill('first');
    await expect(send(app)).toBeEnabled();
    await composer(app).press('Control+Enter');
    await composer(app).press('Shift+Enter');
    await composer(app).pressSequentially('second');
    await expect(composer(app)).toHaveValue('first\nsecond');
    expect(ai.requests).toBe(0);
    await composer(app).press('Enter');
    await expect.poll(() => ai.requests).toBe(1);
    await expect(composer(app)).toHaveValue('');
    await expect(send(app)).toBeDisabled();
  });

  test('while the reply is generated the button is Stop and Enter does not send again; Escape in the box stops it', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await expect(send(app)).toHaveCount(0);
    await expect(composer(app)).toBeFocused();
    await composer(app).pressSequentially('more');
    await composer(app).press('Enter');
    await expect(composer(app)).toHaveValue('more');
    expect(ai.requests).toBe(1);
    await composer(app).press('Escape');
    await expect(send(app)).toBeEnabled();
    await expect(stop(app)).toHaveCount(0);
    ai.release();
  });

  test('the Stop button stops the generation', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await send(app).click();
    await stop(app).click();
    await expect(send(app)).toBeVisible();
    await expect(stop(app)).toHaveCount(0);
    ai.release();
  });

  test('typing while the reply arrives keeps every character and the focus', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('next question');
    ai.release();
    await composer(app).pressSequentially(' and more');
    await expect(acceptAll(app)).toBeEnabled();
    await expect(composer(app)).toHaveValue('next question and more');
    await expect(composer(app)).toBeFocused();
  });

  test('what is typed stays while the model popover changes the parameters', async ({ app, page }) => {
    await composer(app).fill('keep me');
    await chip(app).click();
    await page.getByRole('spinbutton', { name: app.t('ai.param.temperature') }).fill('1');
    await page.keyboard.press('Escape');
    await expect(composer(app)).toHaveValue('keep me');
    await composer(app).press('End');
    await composer(app).pressSequentially(' too');
    await expect(composer(app)).toHaveValue('keep me too');
  });

  test('the selection chip counts the characters of a one-line selection; ✕ hides it, a different selection brings it back', async ({ app, page }) => {
    await app.mode('mode.editor').click();
    await app.selectRange(0, 3); // "uno"
    await enterAi(app);
    const chars = page.getByText(app.t('ai.selectionChars', { count: 3 }), { exact: true });
    await expect(chars).toBeVisible();
    await page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    await expect(chars).toHaveCount(0);
    await app.mode('mode.editor').click();
    await app.selectRange(4, 11); // "due\ntre"
    await enterAi(app);
    await expect(page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
  });

  test('ignoring the selection with ✕: where the focus goes', async ({ app, page }) => {
    await app.mode('mode.editor').click();
    await app.selectRange(0, 3);
    await enterAi(app);
    await page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    // Difetto di oggi (React): il ✕ sparisce con il focus e il focus cade sul body. Il Task 5 lo rovescia (decisione 3).
    await expect.poll(() => focusOnBody(app)).toBe(true);
  });

  test('the composer and the sidebar follow the interface language', async ({ app, page }) => {
    const it = (key: string) => translate(messagesFor('it'), key);
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await page.getByLabel(app.t('settings.language')).selectOption('it');
    await page.getByRole('button', { name: it('settings.close') }).click();
    const box = page.getByRole('textbox', { name: it('ai.request') });
    await expect(box).toHaveAttribute('placeholder', it('ai.request'));
    await expect(page.getByRole('heading', { name: it('ai.title') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.newChat') })).toBeDisabled();
    await expect(page.getByRole('button', { name: it('ai.send'), exact: true })).toBeDisabled();
    await box.fill('ciao');
    await expect(page.getByRole('button', { name: it('ai.send'), exact: true })).toBeEnabled();
  });
});

test.describe('sidebar', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': '# Alpha' });
    await app.openFile('a.md');
  });

  test('New chat waits for a message, empties the chat and is disabled again', async ({ app }) => {
    await enterAi(app);
    await expect(app.page.getByRole('heading', { name: app.t('ai.title') })).toBeVisible();
    await expect(newChat(app)).toBeDisabled();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(acceptAll(app)).toBeEnabled();
    await expect(newChat(app)).toBeEnabled();
    await newChat(app).click();
    await expect(log(app).getByRole('article')).toHaveCount(0);
    await expect(newChat(app)).toBeDisabled();
    // Comportamento di oggi, conservato (decisione 4): il pulsante si disattiva con il focus e Chromium lo porta sul body.
    await expect.poll(() => focusOnBody(app)).toBe(true);
  });

  test('a sync folder without permission: the sidebar offers to reactivate it, the button opens the sync settings', async ({ app, page }) => {
    const settings = page.getByRole('region', { name: app.t('settings.title') });
    await expect(app.mode('mode.ai')).toBeVisible();
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
    await app.setFlags({ folder: 'sync' });
    await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
    await expect(settings.getByRole('button', { name: app.t('ai.syncDisable') })).toBeVisible();
    await settings.getByRole('button', { name: app.t('settings.close') }).click();
    // Al prossimo avvio il browser chiede di nuovo il permesso, anche per la cartella di sync.
    await app.setFlags({ query: 'prompt', request: 'granted' });
    await page.reload();
    await page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) }).click();
    await enterAi(app);
    const reactivate = page.getByRole('button', { name: `⚠ ${app.t('ai.syncReactivate')}` });
    await expect(reactivate).toBeVisible();
    await reactivate.click();
    await expect(page).toHaveURL(/#settings\/ai-sync$/);
    await expect(settings.getByRole('button', { name: app.t('ai.syncReactivate') })).toBeVisible();
  });
});
