import { expect, test, type App } from './support/app.ts';

/** Rete della fase 7 (Task 1): comportamenti delle impostazioni che le altre spec non toccano. */

const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function openSettings(app: App): Promise<void> {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(settings(app)).toBeVisible();
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
});

test('autosave: the delay shows only after a pause, Enter clamps and saves it, everything is remembered after a reload', async ({ app, page }) => {
  await openSettings(app);
  const delay = settings(app).getByRole('spinbutton', { name: app.t('settings.delay') });
  await expect(delay).toHaveValue('1000');
  await delay.fill('50');
  await delay.press('Enter');
  await expect(delay).toHaveValue('500');
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.off') }).check();
  await expect(delay).toHaveCount(0);
  await page.reload();
  await expect(settings(app)).toBeVisible();
  await expect(settings(app).getByRole('radio', { name: app.t('settings.autosave.off') })).toBeChecked();
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.afterDelay') }).check();
  await expect(delay).toHaveValue('500');
});

test('Escape closes the settings and the focus goes back to the settings button', async ({ app, page }) => {
  await openSettings(app);
  await page.keyboard.press('Escape');
  await expect(settings(app)).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('toolbar.settings') })).toBeFocused();
});

test('the theme radios change the theme of the page', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('radio', { name: app.t('theme.option.dark') }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(settings(app).getByRole('radio', { name: app.t('theme.option.dark') })).toBeChecked();
});

test('Save all in the settings saves the open file (autosave off)', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.off') }).check();
  await page.keyboard.press('Escape');
  await app.typeAtEnd('\nmore');
  await page.waitForTimeout(1500);
  expect(await app.disk('a.md')).toBe('# A');
  await openSettings(app);
  await settings(app).getByRole('button', { name: app.t('settings.saveAll') }).click();
  await expect.poll(() => app.disk('a.md')).toBe('# A\nmore');
});

test('the index follows the scroll: the section brought into view is the current link', async ({ app }) => {
  await openSettings(app);
  const index = settings(app).getByRole('navigation', { name: app.t('settings.sections') });
  await expect(index.getByRole('link', { name: app.t('settings.general') })).toHaveAttribute('aria-current', 'true');
  // Profili, non Sync: le ultime sezioni non arrivano in cima (padding di 40vh) e l'indice resta su Profili (limite di oggi, fase 8).
  await index.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await expect(index.getByRole('link', { name: app.t('settings.aiProfiles') })).toHaveAttribute('aria-current', 'true');
  await expect(index.getByRole('link', { name: app.t('settings.general') })).not.toHaveAttribute('aria-current', 'true');
});

test('a cloud profile asks for the key: the address is fixed, Save key is off until something is typed', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toBeDisabled();
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toHaveValue('https://api.anthropic.com');
  const save = settings(app).getByRole('button', { name: app.t('ai.saveSecret') });
  await expect(save).toBeDisabled();
  await settings(app).getByLabel(app.t('ai.secret')).fill('sk-test');
  await expect(save).toBeEnabled();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('ollama');
  await expect(settings(app).getByLabel(app.t('ai.secret'))).toHaveCount(0);
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toHaveValue('http://localhost:11434');
});

test('the key typed in the password field stays in the field, never in the serialized DOM', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
  await settings(app).getByLabel(app.t('ai.secret')).fill('sk-test');
  await expect(settings(app).getByLabel(app.t('ai.secret'))).toHaveValue('sk-test');
  // Con React l'attributo `value` dei campi controllati seguiva la chiave; l'elemento scrive solo la proprietà (spec R21).
  expect(await page.evaluate(() => document.body.outerHTML.includes('sk-test'))).toBe(false);
});

test('Connection on the local profile says Connected (fake Ollama)', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  await settings(app).getByRole('button', { name: app.t('ai.connection') }).click();
  await expect(settings(app).getByRole('status').filter({ hasText: app.t('ai.connected') })).toBeVisible();
});

test('a built-in preset offers Restore original instead of Delete, and restoring brings its instructions back', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiPresets') }).click();
  // La seconda sezione AI è quella dei preset: il primo pulsante dell'elenco è un preset predefinito.
  // Eccezione accettata al «solo ruolo e nome»: le sezioni non hanno ancora un nome accessibile (da risolvere in fase 8, vedi handover).
  const presets = settings(app).locator('#settings-ai-presets');
  await presets.getByRole('button').first().click();
  const instructions = presets.getByRole('textbox', { name: app.t('ai.instructions') });
  const original = await instructions.inputValue();
  await expect(presets.getByRole('button', { name: app.t('ai.delete'), exact: true })).toHaveCount(0);
  await instructions.fill('changed');
  await presets.getByRole('button', { name: app.t('ai.restoreOriginal') }).click();
  await expect(instructions).toHaveValue(original);
});

test('a sync folder: its name, the status line, Sync now and the backups; Disable takes it away', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiSync') }).click();
  await app.setFlags({ folder: 'sync' });
  await settings(app).getByRole('button', { name: app.t('ai.syncChoose') }).click();
  await expect(settings(app).getByText('sync', { exact: true })).toBeVisible();
  await expect(settings(app).getByRole('button', { name: app.t('ai.syncNow') })).toBeEnabled();
  await expect(settings(app).getByText(app.t('ai.backups'))).toBeVisible();
  await settings(app).getByRole('button', { name: app.t('ai.syncDisable') }).click();
  await expect(settings(app).getByRole('button', { name: app.t('ai.syncNow') })).toHaveCount(0);
  await expect(settings(app).getByText('sync', { exact: true })).toHaveCount(0);
});
