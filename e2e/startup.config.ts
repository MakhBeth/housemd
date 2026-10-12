import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * Tempo di avvio della build di oggi contro la build della fase 3 (React 19, `a3ebc6f`), spec §7 «Fase 8».
 * Prima: la build della fase 3 in `dist-phase3/` (worktree detached su a3ebc6f, `npm ci && npm run build`,
 * poi `cp -r dist <qui>/dist-phase3`). Poi, dentro il lock dei browser:
 *   E2E_WORKERS=1 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/startup.config.ts
 * Il risultato (mediane e singoli giri) va in `test-results/startup.json` e nell'output.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
export const CURRENT_PORT = 4180;
export const PHASE3_PORT = 4181;

export default defineConfig({
  testDir: '.',
  testMatch: 'startup.measure.ts',
  outputDir: '../test-results/startup',
  workers: 1,
  reporter: [['list']],
  timeout: 15 * 60_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${CURRENT_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${CURRENT_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npx vite preview --outDir dist-phase3 --port ${PHASE3_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${PHASE3_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
