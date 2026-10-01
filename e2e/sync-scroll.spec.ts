import type { Locator } from '@playwright/test';

import { expect, test } from './support/app.ts';

const LONG = Array.from(
  { length: 80 },
  (_, i) => `## Section ${i + 1}\n\n${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6)}\n`,
).join('\n');

/** Primo elemento scorrevole dentro il pannello (per l'editor è .cm-scroller di CodeMirror). */
async function scrollPane(pane: Locator, fraction: number): Promise<void> {
  await pane.evaluate((root, fraction) => {
    const scroller = [root, ...root.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY),
    ) as HTMLElement;
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * fraction;
  }, fraction);
}

/** Numero della prima "Section N" visibile in cima al pannello (titolo h2 o riga "## Section N"). */
async function sectionAtTop(pane: Locator): Promise<number | null> {
  return pane.evaluate((root) => {
    const scroller = [root, ...root.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY),
    );
    if (!scroller) return null;
    const top = scroller.getBoundingClientRect().top;
    for (const el of scroller.querySelectorAll('h2, .cm-line')) {
      const match = /^(?:## )?Section (\d+)$/.exec(el.textContent?.trim() ?? '');
      if (match && el.getBoundingClientRect().bottom > top + 1) return Number(match[1]);
    }
    return null;
  });
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'long.md': LONG });
  await app.openFile('long.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Section 80' })).toBeAttached();
});

test('scrolling the editor brings the preview to the same section', async ({ app }) => {
  await scrollPane(app.editorPane(), 0.5);
  await expect.poll(() => sectionAtTop(app.editorPane())).toBeGreaterThan(20);
  await expect
    .poll(async () => {
      const [editor, preview] = [await sectionAtTop(app.editorPane()), await sectionAtTop(app.previewPane())];
      return editor !== null && preview !== null && Math.abs(editor - preview) <= 1;
    })
    .toBe(true);
});

test('scrolling the preview brings the editor to the same section', async ({ app, page }) => {
  await scrollPane(app.previewPane(), 0.3);
  await expect.poll(() => sectionAtTop(app.previewPane())).toBeGreaterThan(10);
  await expect
    .poll(async () => {
      const [editor, preview] = [await sectionAtTop(app.editorPane()), await sectionAtTop(app.previewPane())];
      return editor !== null && preview !== null && Math.abs(editor - preview) <= 1;
    })
    .toBe(true);
  // Nessun rimbalzo: dopo la finestra di soppressione (150 ms) la posizione resta ferma.
  const settled = await sectionAtTop(app.previewPane());
  await page.waitForTimeout(400);
  expect(await sectionAtTop(app.previewPane())).toBe(settled);
});
