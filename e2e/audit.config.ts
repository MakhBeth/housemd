import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

import base from './playwright.config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PORT = 4174;

const current = base.webServer;
if (!current || Array.isArray(current)) throw new Error('playwright.config.ts: webServer atteso come oggetto singolo');

/**
 * Audit degli stili calcolati (e2e/computed-styles.audit.ts). Prima di cambiare la cascata:
 *   npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
 * poi, dopo il cambio: npm run test:e2e:audit. `current` parte solo dopo `baseline`.
 */
export default defineConfig({
  ...base,
  testMatch: '**/*.audit.ts',
  outputDir: '../test-results/audit',
  reporter: 'list',
  projects: [
    { name: 'baseline', use: { baseURL: `http://localhost:${BASELINE_PORT}` } },
    { name: 'current', dependencies: ['baseline'] },
  ],
  webServer: [
    current,
    {
      command: `npx vite preview --outDir dist-baseline --port ${BASELINE_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${BASELINE_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
