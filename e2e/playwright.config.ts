import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  fullyParallel: true,
  // Le quote di storage dei contesti (OPFS, IndexedDB) dipendono dalla memoria libera: con troppi
  // worker in parallelo le scritture OPFS falliscono con QuotaExceededError.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  expect: {
    // Ogni test avvia un browser con profilo su disco: con la macchina carica 5 s non bastano sempre.
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'Europe/Rome',
    reducedMotion: 'reduce',
    // La PWA si verifica a mano: un service worker nei test aggiungerebbe cache tra un'esecuzione e l'altra.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    // Mai riusare un server già attivo: proverebbe un dist/ vecchio o un'altra cartella. Se la porta
    // è occupata la suite deve fallire, non passare sul codice sbagliato.
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium' }],
});
