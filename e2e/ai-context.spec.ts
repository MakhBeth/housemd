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
