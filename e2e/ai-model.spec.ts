import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const chip = (app: App) => app.page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
/** Il nome accessibile della select comprende anche l'opzione scelta: si cerca per sottostringa. */
const models = (app: App) => app.page.getByRole('combobox', { name: app.t('ai.model') });
const customModel = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.model'), exact: true });
const refresh = (app: App) => app.page.getByRole('button', { name: app.t('ai.refresh') });
const temperature = (app: App) => app.page.getByRole('spinbutton', { name: app.t('ai.param.temperature') });
const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function enterAi(app: App): Promise<void> {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(chip(app)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Nessuna richiesta verso provider cloud: un profilo Anthropic senza chiave non deve uscire in rete.
  await page.route('https://api.anthropic.com/**', (route) => route.abort());
});

test('the model list is asked only with the popover open, again with Refresh and at every opening', async ({ app, ai, page }) => {
  ai.models = ['qwen3.6:35b-mlx', 'llama3:8b'];
  await enterAi(app);
  expect(ai.modelLists).toBe(0);
  await chip(app).click();
  await expect(models(app).getByRole('option', { name: 'llama3:8b' })).toHaveCount(1);
  expect(ai.modelLists).toBe(1);
  await refresh(app).click();
  await expect.poll(() => ai.modelLists).toBe(2);
  await page.keyboard.press('Escape');
  // Chiuso il popover, il selettore del modello non c'è più (come con React: smontato).
  await expect(models(app)).toHaveCount(0);
  await chip(app).click();
  await expect.poll(() => ai.modelLists).toBe(3);
  await expect(models(app)).toBeVisible();
});

test('a model chosen from the list changes the chip and marks the override; Reset brings the profile model back', async ({ app, ai, page }) => {
  ai.models = ['qwen3.6:35b-mlx', 'llama3:8b'];
  await enterAi(app);
  await chip(app).click();
  await expect(models(app).getByRole('option', { name: 'llama3:8b' })).toHaveCount(1);
  await models(app).selectOption('llama3:8b');
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · llama3:8b`);
  await expect(chip(app)).toContainText('•');
  await page.getByRole('button', { name: app.t('ai.reset'), exact: true }).click();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · qwen3.6:35b-mlx`);
  await expect(chip(app)).not.toContainText('•');
  await expect(models(app)).toHaveValue('qwen3.6:35b-mlx');
});

test('Other… gives a text field: every character typed reaches the chip and the field keeps the focus', async ({ app }) => {
  await enterAi(app);
  await chip(app).click();
  await models(app).selectOption('__custom');
  await expect(customModel(app)).toHaveValue('qwen3.6:35b-mlx');
  await customModel(app).fill('');
  await customModel(app).pressSequentially('my-model:1b');
  await expect(customModel(app)).toHaveValue('my-model:1b');
  await expect(customModel(app)).toBeFocused();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · my-model:1b`);
  await expect(models(app)).toHaveValue('__custom');
});

test('the popover opened again starts from the list, without the text field', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await models(app).selectOption('__custom');
  await expect(customModel(app)).toBeVisible();
  await page.keyboard.press('Escape');
  await chip(app).click();
  await expect(models(app)).toBeVisible();
  await expect(customModel(app)).toHaveCount(0);
});

test.describe('model server down', () => {
  // Solo la diagnostica di Chromium per la connessione rifiutata del finto Ollama.
  test.use({ expectedConsole: [/^Failed to load resource: net::ERR_CONNECTION_REFUSED/] });

  test('an unreachable server is said under the list; Refresh asks again', async ({ app, ai }) => {
    ai.modelsDown = true;
    await enterAi(app);
    await chip(app).click();
    const unreachable = app.page.getByText(app.t('ai.error.unreachable'), { exact: true });
    await expect(unreachable).toBeVisible();
    ai.modelsDown = false;
    await refresh(app).click();
    await expect(unreachable).toHaveCount(0);
    await expect(models(app).getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
  });
});

test('profiles grouped Local and Cloud, a cloud profile without key marked; the privacy note and the choice follow the profile, also after a reload', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.createProfile('anthropic', 'Cloud');
  await app.mode('mode.ai').click();
  await expect(chip(app)).toHaveAccessibleDescription(app.t('ai.localPrivacy'));
  await chip(app).click();
  const local = page.getByRole('group', { name: app.t('ai.local') });
  const cloud = page.getByRole('group', { name: app.t('ai.cloud') });
  await expect(local.getByRole('radio', { name: 'ollama', exact: true })).toBeChecked();
  await cloud.getByRole('radio', { name: 'Cloud ⚠', exact: true }).check();
  await expect(chip(app)).toHaveAccessibleName(new RegExp(`^${app.t('ai.profile')}: Cloud · `));
  await expect(chip(app)).toHaveAccessibleDescription(app.t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  await page.reload();
  await expect(chip(app)).toHaveAccessibleName(new RegExp(`^${app.t('ai.profile')}: Cloud · `));
});

test('a temperature changed in the popover marks the override; Save as new profile adds a profile with it, Save profile keeps it', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await temperature(app).fill('0.9');
  await expect(chip(app)).toContainText('•');
  await page.getByRole('button', { name: app.t('ai.saveAs'), exact: true }).click();
  const local = page.getByRole('group', { name: app.t('ai.local') });
  await expect(local.getByRole('radio')).toHaveCount(2);
  await expect(chip(app)).not.toContainText('•');
  await expect(temperature(app)).toHaveValue('0.9');
  // Il profilo di prima ha ancora la temperatura predefinita.
  await local.getByRole('radio', { checked: false }).check();
  await expect(temperature(app)).toHaveValue('0.3');
  await temperature(app).fill('0.5');
  await page.getByRole('button', { name: app.t('ai.saveProfile'), exact: true }).click();
  await expect(chip(app)).not.toContainText('•');
  await page.keyboard.press('Escape');
  await chip(app).click();
  await expect(temperature(app)).toHaveValue('0.5');
});

test('Manage profiles… opens the profile settings; closing them brings the focus back to the chip', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await page.getByRole('button', { name: app.t('ai.manage') }).click();
  await expect(page).toHaveURL(/#settings\/ai-profiles$/);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await expect(chip(app)).toBeFocused();
});

test('the chip and its popover follow the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await enterAi(app);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const itChip = page.getByRole('button', { name: new RegExp(`^${it('ai.profile')}: `) });
  await expect(itChip).toHaveAccessibleDescription(it('ai.localPrivacy'));
  await itChip.click();
  await expect(page.getByRole('group', { name: it('ai.local') })).toBeVisible();
  await expect(page.getByRole('combobox', { name: it('ai.model') })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.refresh') })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.saveProfile'), exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.manage') })).toBeVisible();
});

test('in the profile settings the model list loads, and a model typed in Other… is saved with the profile', async ({ app }) => {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  const select = settings(app).getByRole('combobox', { name: app.t('ai.model') });
  await expect(select.getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
  await select.selectOption('__custom');
  const field = settings(app).getByRole('textbox', { name: app.t('ai.model'), exact: true });
  await field.fill('typed:1b');
  await expect(field).toHaveValue('typed:1b');
  await expect(field).toBeFocused();
  await settings(app).getByRole('button', { name: app.t('ai.save'), exact: true }).first().click();
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await app.mode('mode.ai').click();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · typed:1b`);
});
