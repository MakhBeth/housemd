import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

import base from './playwright.config.ts';
import type { AppOptions } from './support/app.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5174;

/**
 * Le stesse spec contro `vite` in sviluppo: React in modalità dev, con StrictMode che monta due volte
 * gli effetti e con i suoi avvisi in console, che qui fanno fallire il test (spec WC R18). Restano fuori
 * gli snapshot (il riferimento è la build) e il test che trattiene `assets/index-*.js`, che in sviluppo
 * non esiste.
 */
export default defineConfig<AppOptions>({
  ...base,
  outputDir: '../test-results/dev',
  testIgnore: ['**/visual.spec.ts'],
  grepInvert: /applies dark before the app starts/,
  use: { ...base.use, baseURL: `http://localhost:${PORT}`, failOnConsole: true },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
