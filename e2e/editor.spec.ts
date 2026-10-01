import { expect, test, type App } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';

test('typing autosaves to disk after a pause', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await app.typeAtEnd('\nhello');
  await expect(app.saveState('save.dirty')).toBeVisible();
  await expect.poll(() => app.disk('note.md')).toBe('# Note\n\nhello');
  await expect(app.saveState('save.saved')).toBeVisible();
});

test('Ctrl+S saves right away, with the autosave timer frozen', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  // Da qui nessun timer dell'app scatta se non lo facciamo avanzare noi.
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('x');
  await page.clock.runFor(100); // molto meno dei 1000 ms dell'autosalvataggio
  expect(await app.disk('note.md')).toBe('# Note\n');
  await page.keyboard.press('ControlOrMeta+s');
  // L'orologio è fermo: il salvataggio può venire solo da Ctrl+S.
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nx');
});

test('[[ suggests the folder files and completes the wikilink', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note\n', 'idea.md': '# Idea' });
  await app.openFile('note.md');
  await app.typeAtEnd('[[ide');
  const option = page.getByRole('option', { name: /^idea/ });
  await expect(option).toBeVisible();
  // Clic e non Invio: @codemirror/autocomplete ignora Invio per i primi 75 ms (interactionDelay).
  await option.click();
  await expect(app.editor()).toContainText('[[idea]]');
});

/** Incolla o trascina nell'editor un'immagine, con gli stessi eventi che userebbe il browser. */
async function sendImage(app: App, kind: 'paste' | 'drop', name: string): Promise<void> {
  await app.editor().evaluate(
    (el, { kind, name, base64 }) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], name, { type: 'image/png' }));
      const box = el.getBoundingClientRect();
      el.dispatchEvent(
        kind === 'paste'
          ? new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
          : new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10 }),
      );
    },
    { kind, name, base64: PIXEL_PNG_BASE64 },
  );
}

test('pasting an image saves it under assets/ and links it', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await app.editor().click();
  await sendImage(app, 'paste', 'diagram.png');
  await expect(app.editor()).toContainText('(assets/diagram.png)');
  await expect.poll(() => app.exists('assets/diagram.png')).toBe(true);
});

test('dropping an image saves it under assets/ and links it', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await sendImage(app, 'drop', 'photo.png');
  await expect(app.editor()).toContainText('(assets/photo.png)');
  await expect.poll(() => app.exists('assets/photo.png')).toBe(true);
});

test('view modes: buttons, Ctrl+\\ cycles the document views, remembered after reload', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await app.openFile('note.md');

  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.editorPane()).toBeVisible();
  await expect(app.previewPane()).toBeVisible();

  await app.mode('mode.preview').click();
  await expect(app.editorPane()).toHaveCount(0);
  await expect(app.previewPane()).toBeVisible();

  // Ordine del ciclo: editor → split → preview → editor. La modalità AI non fa parte del ciclo.
  await page.keyboard.press('ControlOrMeta+Backslash');
  await expect(app.mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.previewPane()).toHaveCount(0);

  await page.reload();
  await app.expectOpen('note.md');
  await expect(app.mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
});

test('sidebar: arrow keys resize it, hiding it is remembered', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const separator = page.getByRole('separator', { name: app.t('sidebar.resize') });
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '296');

  // "Nascondi" esiste due volte (testata della sidebar e barra degli strumenti): quello della barra
  // è un interruttore con aria-pressed.
  await page.getByRole('button', { name: app.t('sidebar.hide'), pressed: true }).click();
  await expect(app.tree()).toHaveCount(0);

  await page.reload();
  const show = page.getByRole('button', { name: app.t('sidebar.show') });
  await expect(show).toBeVisible();
  await expect(app.tree()).toHaveCount(0);
  await show.click();
  await expect(separator).toHaveAttribute('aria-valuenow', '296');
});

test('Ctrl+B outside the editor toggles the sidebar', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('separator', { name: app.t('sidebar.resize') }).focus();
  await page.keyboard.press('ControlOrMeta+b');
  await expect(app.tree()).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+b');
  await expect(app.tree()).toBeVisible();
});
