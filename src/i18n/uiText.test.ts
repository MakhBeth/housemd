import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

interface SourceFile {
  /** Percorso relativo a src/, con separatore '/'. */
  path: string;
  source: string;
}

/** DOM costruito a mano fuori da elements/ e dom/ (CodeMirror): conta come interfaccia. */
const UI_TS = new Set(['editor/formatToolbar.ts']);

/** File di interfaccia: i .tsx di oggi e, con i Web Components, i .ts sotto elements/ e dom/. */
function isUiFile(path: string): boolean {
  if (/\.test\.tsx?$/.test(path)) return false;
  if (path.endsWith('.tsx') || UI_TS.has(path)) return true;
  return /^(?:elements|dom)\/.+\.ts$/.test(path);
}

const files: SourceFile[] = walk(SRC)
  .map((full) => ({ full, path: relative(SRC, full).split(sep).join('/') }))
  .filter(({ path }) => isUiFile(path))
  .map(({ full, path }) => ({ path, source: readFileSync(full, 'utf8') }));

/** Testi scritti a mano nei componenti di v1: nessuno deve sopravvivere al passaggio a t(). */
const LEGACY = [
  'Salvato', 'Modifiche…', 'Salvataggio…', 'Errore di salvataggio', 'Eliminato su disco', 'Nessun file aperto',
  'Modalità di visualizzazione', 'Anteprima', 'Split', 'Nuovo file', 'Nuova cartella', "Apri un'altra cartella",
  'Apri cartella', 'Bozze senza file', 'Recupera la bozza', 'Larghezza della barra laterale', 'Nascondi barra laterale',
  'Mostra barra laterale', 'Scegli un file', 'Rinomina', 'Elimina', 'Crea', 'Annulla', 'Chiudi', 'Esiste già',
  'La cartella e tutto', 'Il file verrà eliminato', 'Accesso alla cartella perso', 'Il browser non permette',
  'Accesso non concesso', 'Riprendi accesso', 'Il file è cambiato su disco', 'Ricarica dal disco', 'Sovrascrivi',
  'Azioni per', 'Cartella vuota', 'Nessun file markdown', 'File della cartella', 'Cerca', 'Risultati della ricerca',
  'Nessun risultato', 'Scrivi markdown nel browser', 'Impossibile aprire la cartella', 'Frontmatter non valido',
  'Immagine non trovata',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Testi di LEGACY presenti come stringa ('…', "…", `…`), come figlio JSX (>…) o da soli su una riga. */
function legacyTextsIn(source: string): string[] {
  return LEGACY.filter((text) =>
    new RegExp(`(['"\`>]\\s*${escape(text)})|(^\\s*${escape(text)}\\s*$)`, 'm').test(source),
  );
}

const LABEL = '(?:aria-label|title|placeholder|alt|data-tooltip)';
const QUOTED = '(?<q>[\'"`])(?<v>(?:(?!\\k<q>).)*)\\k<q>';

/** Tutte le forme con cui un'etichetta accessibile o un testo può finire nel DOM con un valore letterale. */
const LITERAL_PATTERNS: RegExp[] = [
  // JSX: title="…", data-tooltip="…"
  new RegExp(`\\b${LABEL}="(?<v>[^"]*)"`, 'g'),
  // el.setAttribute('aria-label', '…')
  new RegExp(`setAttribute\\(\\s*['"]${LABEL}['"]\\s*,\\s*${QUOTED}`, 'g'),
  // el('button', { 'aria-label': '…', 'data-tooltip': '…', title: '…' })
  new RegExp(`(?:['"]${LABEL}['"]|\\b(?:title|placeholder|alt))\\s*:\\s*${QUOTED}`, 'g'),
  // node.title = '…', node.textContent = '…', node.dataset.tooltip = '…'
  new RegExp(`\\.(?:title|placeholder|alt|ariaLabel|textContent|dataset\\.tooltip)\\s*=\\s*${QUOTED}`, 'g'),
];

/** Valori letterali con almeno una lettera (le interpolazioni `${…}` non contano). */
function literalLabelsIn(source: string): string[] {
  const found: string[] = [];
  for (const pattern of LITERAL_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const value = (match.groups?.v ?? '').replace(/\$\{[^}]*\}/g, '');
      if (/\p{L}/u.test(value)) found.push(match[0]);
    }
  }
  return found;
}

/** Ogni occorrenza come "<percorso>: <testo trovato>", così un errore dice subito dove guardare. */
function findLegacyTexts(list: SourceFile[]): string[] {
  return list.flatMap(({ path, source }) => legacyTextsIn(source).map((text) => `${path}: ${text}`));
}

function findLiteralLabels(list: SourceFile[]): string[] {
  return list.flatMap(({ path, source }) => literalLabelsIn(source).map((hit) => `${path}: ${hit}`));
}

test('the UI file list is not empty (the checks below would pass vacuously)', () => {
  assert.ok(files.length > 0, 'nessun file di interfaccia trovato sotto src/');
});

test('no UI file contains the hand-written UI texts of v1', () => {
  assert.deepEqual(findLegacyTexts(files), []);
});

test('no UI file has a literal label or text with words in it', () => {
  assert.deepEqual(findLiteralLabels(files), []);
});

test("the file filter covers today's .tsx and tomorrow's custom elements", () => {
  assert.equal(isUiFile('ui/FileTree.tsx'), true);
  assert.equal(isUiFile('editor/formatToolbar.ts'), true);
  assert.equal(isUiFile('elements/file-tree/file-tree.element.ts'), true);
  assert.equal(isUiFile('dom/icon.ts'), true);
  assert.equal(isUiFile('elements/app/screens.test.ts'), false);
  assert.equal(isUiFile('ui/tree.ts'), false);
});

test('an offending file is reported by path (sensitivity check on synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Probe.tsx', source: "const probe = { title: 'Prova' };" },
    { path: 'elements/probe/probe.element.ts', source: "el('button', {}, 'Annulla')" },
    { path: 'ui/Clean.tsx', source: "<button aria-label={t('toast.close')} data-tooltip={t('toast.close')} />" },
  ];
  assert.deepEqual(findLiteralLabels(probes), ["ui/Probe.tsx: title: 'Prova'"]);
  assert.deepEqual(findLegacyTexts(probes), ['elements/probe/probe.element.ts: Annulla']);
});

test('the checks fire on every supported form (guard against silent regex rot)', () => {
  assert.deepEqual(legacyTextsIn("el('button', {}, 'Annulla')"), ['Annulla']);
  const positives = [
    '<button title="Chiudi">',
    '<button data-tooltip="Chiudi">',
    "el.setAttribute('aria-label', 'Chiudi')",
    'el.setAttribute("data-tooltip", `Nuovo file`)',
    "el('button', { 'aria-label': 'Chiudi' })",
    "el('button', { 'data-tooltip': 'Chiudi' })",
    "el('input', { placeholder: 'Cerca' })",
    "input.placeholder = 'Cerca'",
    "p.textContent = 'Nessun risultato'",
    "button.dataset.tooltip = 'Grassetto'",
    "img.alt = 'Logo'",
  ];
  for (const source of positives) assert.equal(literalLabelsIn(source).length, 1, source);
});

test('the checks ignore translated and non-textual values', () => {
  const negatives = [
    "<button title={t('toast.close')}>",
    "el.setAttribute('aria-label', t('toast.close'))",
    "button.dataset.tooltip = label",
    "p.textContent = ''",
    'node.title = `${path}`',
    'interface Props { title: string }',
    "el('div', { 'aria-label': '' })",
    "setAttribute('aria-valuenow', '280')",
  ];
  for (const source of negatives) assert.deepEqual(literalLabelsIn(source), [], source);
});
