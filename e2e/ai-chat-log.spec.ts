import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const log = (app: App) => app.page.getByRole('log');
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });

async function send(app: App, text = 'fix'): Promise<void> {
  await composer(app).fill(text);
  await composer(app).press('Enter');
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# Alpha\n\nText.', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
});

test('the reply is markdown, the request stays plain text', async ({ app, ai }) => {
  ai.comment = 'Some **bold** words';
  await send(app, 'keep <b>this</b> literal');
  await expect(acceptAll(app)).toBeEnabled();
  await expect(log(app).getByText('keep <b>this</b> literal', { exact: true })).toBeVisible();
  const bold = log(app).getByText('bold', { exact: true });
  await expect(bold).toBeVisible();
  expect(await bold.evaluate((node) => node.localName)).toBe('strong');
});

test.describe('provider errors', () => {
  // Solo la diagnostica di Chromium per la risposta d'errore simulata (400 o 500): ogni altro errore o avviso
  // in console continua a far fallire la suite in sviluppo.
  test.use({ expectedConsole: [/^Failed to load resource: the server responded with a status of (400|500) \(/] });

  test('a failed request shows the error with Retry; Retry sends it again', async ({ app, ai }) => {
    ai.status = 500;
    await send(app);
    await expect(log(app).getByText(app.t('ai.error.server'), { exact: true })).toBeVisible();
    const retry = log(app).getByRole('button', { name: app.t('ai.retry'), exact: true });
    await expect(retry).toBeVisible();
    ai.status = 200;
    await retry.click();
    await expect(acceptAll(app)).toBeEnabled();
    expect(ai.requests).toBe(2);
    // Il messaggio fallito tiene il suo errore, ma Riprova si usa una volta sola.
    await expect(log(app).getByText(app.t('ai.error.server'), { exact: true })).toBeVisible();
    await expect(retry).toHaveCount(0);
    await expect(log(app).getByText(app.t('ai.working'), { exact: true })).toHaveCount(0);
  });

  test('a rejected parameter offers Reset · Retry next to Retry', async ({ app, ai }) => {
    ai.status = 400;
    ai.errorBody = 'temperature unsupported';
    await send(app);
    await expect(log(app).getByText(app.t('ai.error.paramRejected'), { exact: true })).toBeVisible();
    await expect(log(app).getByRole('button', { name: app.t('ai.retry'), exact: true })).toBeVisible();
    await expect(log(app).getByRole('button', { name: `${app.t('ai.reset')} · ${app.t('ai.retry')}`, exact: true })).toBeVisible();
  });
});

test('the document button of a message opens that document', async ({ app }) => {
  await send(app);
  await expect(acceptAll(app)).toBeEnabled();
  // In modalità AI il pannello prende il posto dell'albero: per aprire b.md si esce e si rientra.
  await app.mode('mode.split').click();
  await app.openFile('b.md');
  await app.mode('mode.ai').click();
  // Una volta sola: richiesta e risposta sullo stesso documento condividono il pulsante.
  const file = log(app).getByRole('button', { name: 'a.md', exact: true });
  await expect(file).toHaveCount(1);
  await file.click();
  // L'albero non c'è in modalità AI: si verifica il file aperto tornando alla vista divisa.
  await app.mode('mode.split').click();
  await app.expectOpen('a.md');
});

test('reply metadata show on hover and on focus', async ({ app, page }) => {
  await send(app);
  await expect(acceptAll(app)).toBeEnabled();
  const reply = log(app).getByRole('article').last();
  // Il profilo predefinito si chiama come il suo tipo: «ollama · <modello>».
  const meta = reply.getByText(/^ollama/);
  await expect(meta).toBeHidden();
  await reply.hover();
  await expect(meta).toBeVisible();
  await page.mouse.move(1279, 799);
  await expect(meta).toBeHidden();
  await reply.focus();
  await expect(meta).toBeVisible();
});
