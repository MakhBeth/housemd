import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

import { DEFAULT_FLAGS, FLAGS_KEY, harnessScript, seedFolder } from './support/fsHarness.ts';
import { CURRENT_PORT, PHASE3_PORT } from './startup.config.ts';

/**
 * Due misure per giro, prese nella pagina con `performance.now()` (millisecondi dall'inizio della navigazione):
 * - `start`: profilo nuovo (cache vuota), prima apertura → il pulsante «Open folder» compare nel DOM;
 * - `reopen`: stessa scheda dopo aver aperto una cartella di 60 file e un documento, ricarica → albero
 *   e testo del documento nel DOM (ripresa all'avvio, cache HTTP calda).
 * I giri alternano le due build per non favorirne una con il carico della macchina. Il DOM delle due build è
 * lo stesso (stessi tag, stessi nomi accessibili): gli osservatori valgono per entrambe.
 */
const ROUNDS = Number(process.env.STARTUP_ROUNDS ?? 21);
const BUILDS = [
  { name: 'phase3', url: `http://localhost:${PHASE3_PORT}` },
  { name: 'current', url: `http://localhost:${CURRENT_PORT}` },
] as const;
const FILES = Object.fromEntries(
  Array.from({ length: 60 }, (_, i) => [`dir${i % 6}/note-${i}.md`, `# Note ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(40)}\n`]),
);

function marks(): void {
  const w = window as unknown as Record<string, number | undefined>;
  const check = () => {
    if (w.__hmdStart === undefined && [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Open folder'))) {
      w.__hmdStart = performance.now();
    }
    if (w.__hmdReopen === undefined && document.querySelector('nav[aria-label="Folder files"]') && document.querySelector('.cm-content')?.textContent?.includes('Note 7')) {
      w.__hmdReopen = performance.now();
    }
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

test('startup: current build against phase 3', async ({}, testInfo) => {
  const results: Record<string, { start: number[]; reopen: number[] }> = { phase3: { start: [], reopen: [] }, current: { start: [], reopen: [] } };
  for (let round = 0; round < ROUNDS; round++) {
    for (const build of round % 2 ? [...BUILDS].reverse() : BUILDS) {
      const dir = await mkdtemp(join(tmpdir(), 'hmd-startup-'));
      const context = await chromium.launchPersistentContext(dir, { ...testInfo.project.use, baseURL: build.url, deviceScaleFactor: 1 });
      try {
        const page = context.pages()[0] ?? (await context.newPage());
        await page.addInitScript(harnessScript, { defaults: DEFAULT_FLAGS, key: FLAGS_KEY });
        await page.addInitScript(() => localStorage.setItem('housemd:locale', JSON.stringify('en')));
        await page.addInitScript(marks);
        await page.goto('/');
        await page.waitForFunction(() => (window as unknown as { __hmdStart?: number }).__hmdStart !== undefined, null, { timeout: 15_000 });
        results[build.name].start.push(await page.evaluate(() => (window as unknown as { __hmdStart: number }).__hmdStart));
        await seedFolder(page, DEFAULT_FLAGS.folder, FILES);
        await page.getByRole('button', { name: 'Open folder' }).click();
        await page.getByRole('navigation', { name: 'Folder files' }).getByText('dir1', { exact: true }).click();
        await page.getByRole('button', { name: 'note-7.md', exact: true }).click();
        await expect(page.locator('.cm-content')).toContainText('Note 7');
        await page.reload();
        await page.waitForFunction(() => (window as unknown as { __hmdReopen?: number }).__hmdReopen !== undefined, null, { timeout: 15_000 });
        results[build.name].reopen.push(await page.evaluate(() => (window as unknown as { __hmdReopen: number }).__hmdReopen));
      } finally {
        await context.close();
        await rm(dir, { recursive: true, force: true });
      }
    }
  }
  const summary = Object.fromEntries(
    Object.entries(results).map(([name, r]) => [name, { startMedian: Math.round(median(r.start)), reopenMedian: Math.round(median(r.reopen)), ...r }]),
  );
  console.log(JSON.stringify(summary, null, 1));
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/startup.json', JSON.stringify(summary, null, 1));
});
