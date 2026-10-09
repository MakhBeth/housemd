import { expect, test, type App } from './support/app.ts';

const suggestions = (app: App) => app.page.getByRole('group', { name: app.t('ai.suggestions') });
const effort = (app: App) => app.page.getByRole('combobox', { name: app.t('ai.param.effort') });
const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

test.beforeEach(async ({ app, page }) => {
  // Nessuna richiesta verso provider cloud: un profilo Anthropic senza chiave non deve uscire in rete.
  await page.route('https://api.anthropic.com/**', (route) => route.abort());
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
});

test('suggestions show the visible presets with an empty chat, go away after a request and come back with New chat', async ({ app, page, ai }) => {
  await app.mode('mode.ai').click();
  await expect(suggestions(app)).toBeVisible();
  const first = suggestions(app).getByRole('button').first();
  await expect(first).toHaveText(app.t('ai.preset.sbobina'));
  await first.click();
  await expect.poll(() => ai.requests).toBe(1);
  await expect(suggestions(app)).toHaveCount(0);
  await page.getByRole('button', { name: app.t('ai.newChat') }).click();
  await expect(suggestions(app)).toBeVisible();
});

test('the effort chip appears only for a profile that supports it and overrides the effort', async ({ app, page }) => {
  await app.createProfile('anthropic', 'Cloud');
  await app.mode('mode.ai').click();
  // Il profilo predefinito (Ollama) non ha effort.
  await expect(effort(app)).toHaveCount(0);
  const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
  await chip.click();
  await page.getByRole('radio', { name: 'Cloud' }).check();
  // Nel popover del modello l'effort non si ripete (ha il suo chip).
  await expect(page.getByRole('combobox', { name: app.t('ai.param.effort') })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(effort(app)).toHaveValue('');
  await expect(effort(app).getByRole('option')).toHaveText([app.t('ai.default'), 'low', 'medium', 'high', 'xhigh', 'max']);
  await effort(app).selectOption('high');
  await expect(effort(app)).toHaveValue('high');
  // Un override aggiunge il pallino al testo del chip del modello (il nome accessibile è l'aria-label).
  await expect(chip).toContainText('•');
});

test('profile parameters: the fields follow the provider and a saved temperature comes back', async ({ app }) => {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  for (const key of ['ai.param.temperature', 'ai.param.topP', 'ai.param.maxOutputTokens', 'ai.param.chunkChars']) {
    await expect(settings(app).getByRole('spinbutton', { name: app.t(key) })).toBeVisible();
  }
  await expect(settings(app).getByRole('combobox', { name: app.t('ai.param.effort') })).toHaveCount(0);
  const temperature = settings(app).getByRole('spinbutton', { name: app.t('ai.param.temperature') });
  await temperature.fill('0.7');
  await expect(temperature).toHaveValue('0.7');
  await settings(app).getByRole('button', { name: app.t('ai.save'), exact: true }).first().click();
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  await expect(settings(app).getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toHaveValue('0.7');
});

test('typing a partial number keeps the text in the field', async ({ app }) => {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  const topP = settings(app).getByRole('spinbutton', { name: app.t('ai.param.topP') });
  await topP.fill('');
  await topP.pressSequentially('0.');
  await topP.pressSequentially('5');
  await expect(topP).toHaveValue('0.5');
  await expect(topP).toBeFocused();
});

test('choosing Default in the focused effort select removes the field without crashing the app', async ({ app }) => {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  await settings(app).getByRole('checkbox', { name: app.t('ai.enableEffort') }).check();
  const select = settings(app).getByRole('combobox', { name: app.t('ai.param.effort') });
  await expect(select).toBeVisible();
  await select.focus();
  // Default toglie l'effort dal profilo: il campo sparisce mentre ha il focus.
  await select.selectOption({ label: app.t('ai.default') });
  await expect(select).toHaveCount(0);
  await expect(settings(app)).toBeVisible();
  await expect(settings(app).getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
});
