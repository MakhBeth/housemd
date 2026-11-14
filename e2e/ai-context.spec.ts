import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const send = (app: App) => app.page.getByRole('button', { name: app.t('ai.send'), exact: true });

test.describe('contesto allegato', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': 'uno\ndue\ntre', 'note/idee.md': 'le mie idee' });
    await app.openFile('a.md');
    await app.mode('mode.ai').click();
    await expect(composer(app)).toBeVisible();
  });

  test('a normal send carries the open document and no attached context', async ({ ai, app }) => {
    await composer(app).fill('riassumi');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
    const body = JSON.stringify(ai.bodies[0]);
    expect(body).toContain('<document path=\\"a.md\\">');
    expect(body).not.toContain('<attached-context>');
  });
});

const options = (app: App) => app.page.getByRole('option');
const chips = (app: App) => app.page.getByRole('list', { name: app.t('ai.context.attachments') });
const profileChip = (app: App) => app.page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });

async function pickProfile(app: App, name: string): Promise<void> {
  await profileChip(app).click();
  await app.page.getByRole('radio', { name: new RegExp(`^${name}`) }).check();
  await app.page.keyboard.press('Escape');
}

test.describe('suggerimenti @', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': 'uno\ndue\ntre', 'b.md': 'su disco', 'note/idee.md': 'le mie idee', 'note/altro.md': 'altro', 'note/sotto/deep.md': 'profondo' });
    await app.openFile('a.md');
    await app.mode('mode.ai').click();
    await expect(composer(app)).toBeVisible();
  });

  test('@ide lists the matching options, ArrowDown moves the active one, Enter inserts the reference and does not send', async ({ ai, app }) => {
    await composer(app).click();
    await composer(app).pressSequentially('@note');
    await expect(options(app).first()).toContainText('note');
    const first = await composer(app).getAttribute('aria-activedescendant');
    await composer(app).press('ArrowDown');
    await expect(composer(app)).not.toHaveAttribute('aria-activedescendant', first!);
    await composer(app).press('ArrowUp');
    await composer(app).press('Enter');
    await expect(composer(app)).toHaveValue('@note/ ');
    await expect(options(app)).toHaveCount(0);
    expect(ai.requests).toBe(0);
  });

  test('Escape closes the list without stopping a held generation; an email address does not open it', async ({ ai, app }) => {
    ai.hold();
    await composer(app).fill('prima');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
    await composer(app).click();
    await composer(app).pressSequentially('@note');
    await expect(options(app).first()).toBeVisible();
    await composer(app).press('Escape');
    await expect(options(app)).toHaveCount(0);
    await expect(app.page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
    await composer(app).fill('mario@example.com');
    await expect(options(app)).toHaveCount(0);
    ai.release();
  });

  test('a file and a folder become two chips; the remove button drops the reference and focuses the box; the chips survive leaving and re-entering AI mode', async ({ app }) => {
    await composer(app).click();
    await composer(app).pressSequentially('@idee');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('@note/');
    await expect(options(app).first()).toBeVisible();
    await options(app).filter({ hasText: 'note/' }).first().click();
    await expect(chips(app).getByRole('listitem')).toHaveCount(2);
    await app.mode('mode.editor').click();
    await app.mode('mode.ai').click();
    await expect(chips(app).getByRole('listitem')).toHaveCount(2);
    await chips(app).getByRole('button', { name: app.t('ai.context.remove', { path: 'note/idee.md' }) }).click();
    await expect(chips(app).getByRole('listitem')).toHaveCount(1);
    await expect(composer(app)).not.toHaveValue(/idee\.md/);
    await expect(composer(app)).toBeFocused();
  });

  test('a tagged file goes into the request as <file path>; an unsaved draft of the open document is not duplicated', async ({ ai, app }) => {
    await composer(app).click();
    await composer(app).pressSequentially('@idee');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('riassumi');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
    const body = JSON.stringify(ai.bodies[0]);
    expect(body).toContain('<file path=\\"note/idee.md\\">\\nle mie idee\\n</file>');
    expect(body).toContain('</document>');
    await expect(chips(app).getByRole('listitem')).toHaveCount(0);
    await expect(composer(app)).toHaveValue('');
  });

  test('an unsaved draft of another file goes into the request instead of the disk text', async ({ ai, app }) => {
    await app.mode('mode.editor').click();
    await app.openFile('b.md');
    await app.typeAtEnd(' BOZZA');
    await app.openFile('a.md');
    await app.mode('mode.ai').click();
    await composer(app).click();
    await composer(app).pressSequentially('@b.md');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('leggi');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
    const body = JSON.stringify(ai.bodies[0]);
    expect(body).toContain('su disco BOZZA');
  });

  test('a folder verso Ollama locale: nessun dialog, tutti i .md sotto la cartella una volta sola', async ({ ai, app }) => {
    await composer(app).click();
    await composer(app).pressSequentially('@note');
    await options(app).filter({ hasText: 'note/' }).first().click();
    await composer(app).pressSequentially('leggi');
    await send(app).click();
    await expect.poll(() => ai.requests).toBe(1);
    const body = JSON.stringify(ai.bodies[0]);
    for (const p of ['note/idee.md', 'note/altro.md', 'note/sotto/deep.md']) expect(body.split(`<file path=\\"${p}\\">`)).toHaveLength(2);
  });

  test('a folder to a remote provider asks first: Cancel sends nothing, Confirm sends', async ({ ai, app, page }) => {
    await ai.remote(page);
    await app.createProfile('openai-compatible', 'Remote', { url: 'https://models.example.test' });
    await pickProfile(app, 'Remote');
    await composer(app).click();
    await composer(app).pressSequentially('@note');
    await options(app).filter({ hasText: 'note/' }).first().click();
    await composer(app).pressSequentially('leggi');
    await send(app).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Send files to Remote?');
    await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
    expect(ai.requests).toBe(0);
    await expect(chips(app).getByRole('listitem')).toHaveCount(1);
    await send(app).click();
    await dialog.getByRole('button', { name: app.t('ai.context.confirmSend') }).click();
    await expect.poll(() => ai.requests).toBe(1);
  });

  test('over the context window: a note with the totals, nothing is sent, text and chips stay', async ({ ai, app }) => {
    await app.createProfile('ollama', 'Small', { contextTokens: 50 });
    await pickProfile(app, 'Small');
    await composer(app).click();
    await composer(app).pressSequentially('@idee');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('ciao');
    await send(app).click();
    await expect(app.page.getByRole('status').filter({ hasText: 'note/idee.md' })).toBeVisible();
    expect(ai.requests).toBe(0);
    await expect(chips(app).getByRole('listitem')).toHaveCount(1);
    await expect(composer(app)).toHaveValue('@note/idee.md ciao');
  });
});
