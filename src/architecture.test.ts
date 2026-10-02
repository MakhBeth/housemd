import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Regole di CLAUDE.md verificate sul sorgente: ciò che la review a occhio può lasciarsi sfuggire. */

const SRC = fileURLToPath(new URL('.', import.meta.url));

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

const sources: SourceFile[] = walk(SRC)
  .map((full) => ({ full, path: relative(SRC, full).split(sep).join('/') }))
  .filter(({ path }) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith('.d.ts') && !path.includes('/testing/'))
  .map(({ full, path }) => ({ path, source: readFileSync(full, 'utf8') }));

/** HTML da stringa nel DOM: solo sanitize.ts può farlo, e solo con HTML già sanitizzato. */
const UNSAFE_DOM = /\.(?:innerHTML|outerHTML)\s*=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/;
const UNSAFE_DOM_ALLOWED = new Set(['preview/sanitize.ts']);

/** File System Access API: solo fsaOps.ts e access.ts. */
const FSA = /\b(?:showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|queryPermission|requestPermission|createWritable|getDirectoryHandle|getFileHandle)\b/;
const FSA_ALLOWED = new Set(['fs/fsaOps.ts', 'fs/access.ts']);

/** Rete: solo i provider AI parlano con l'esterno (regola AI di CLAUDE.md). */
const NETWORK = /\bfetch\b|\bXMLHttpRequest\b|\bEventSource\b|\bWebSocket\b|\bsendBeacon\b|['"]@anthropic-ai\/sdk['"]/;
const NETWORK_ALLOWED = (path: string) => path.startsWith('ai/providers/');

/** Custom element: un solo punto di registrazione (spec WC §8.3), così l'ordine di definizione è uno. */
const DEFINE = /\bcustomElements\.define\s*\(/;
const DEFINE_ALLOWED = new Set(['elements/define.ts']);

/** Percorsi dei file che usano `pattern` senza esserne autorizzati. */
function offenders(pattern: RegExp, allowed: (path: string) => boolean, list: SourceFile[] = sources): string[] {
  return list.filter(({ path, source }) => !allowed(path) && pattern.test(source)).map(({ path }) => path);
}

const inSet = (set: ReadonlySet<string>) => (path: string) => set.has(path);

test('the source list is not empty', () => {
  assert.ok(sources.length > 50, `solo ${sources.length} file sorgente trovati`);
});

test('HTML strings reach the DOM only through preview/sanitize.ts', () => {
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED)), []);
});

test('only fs/fsaOps.ts and fs/access.ts touch the File System Access API', () => {
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED)), []);
});

test('only src/ai/providers/ makes network requests', () => {
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED), []);
});

test('customElements.define appears only in elements/define.ts', () => {
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED)), []);
});

test('the patterns fire on what they must and ignore what they must', () => {
  for (const bad of ['el.innerHTML = html', 'el.outerHTML = x', "el.insertAdjacentHTML('beforeend', x)", 'document.write(x)']) {
    assert.ok(UNSAFE_DOM.test(bad), bad);
  }
  for (const ok of ['if (el.innerHTML === "")', 'const s = el.outerHTML', "el.textContent = 'x'"]) {
    assert.ok(!UNSAFE_DOM.test(ok), ok);
  }
  for (const bad of ['await handle.createWritable()', 'window.showDirectoryPicker()', 'h.requestPermission(m)']) {
    assert.ok(FSA.test(bad), bad);
  }
  for (const ok of ['handle: FileSystemDirectoryHandle', 'ops.removeEntry(path, true)', 'handle.isSameEntry(other)']) {
    assert.ok(!FSA.test(ok), ok);
  }
  for (const bad of ["await fetch('/x')", 'const f = deps.fetch ?? fetch', 'new WebSocket(url)', "import('@anthropic-ai/sdk')"]) {
    assert.ok(NETWORK.test(bad), bad);
  }
  for (const ok of ['prefetch()', 'fetchedAt: number', "import type { X } from './sdk'"]) {
    assert.ok(!NETWORK.test(ok), ok);
  }
  assert.ok(DEFINE.test("customElements.define('hmd-file-tree', HmdFileTree)"));
  assert.ok(!DEFINE.test("customElements.get('hmd-file-tree')"));
});

test('offending files are reported by path and allowed files are not (synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Icon.tsx', source: '// probe: document.write(x)' },
    { path: 'preview/sanitize.ts', source: 'el.innerHTML = sanitizeWith(purify, html);' },
    { path: 'workspace/probe.ts', source: 'await handle.createWritable();' },
    { path: 'fs/fsaOps.ts', source: 'await handle.createWritable();' },
    { path: 'ai/aiController.ts', source: "await fetch('https://example.com')" },
    { path: 'ai/providers/anthropic.ts', source: "await fetch('https://api.anthropic.com')" },
    { path: 'dom/element.ts', source: "customElements.define('hmd-x', X);" },
    { path: 'elements/define.ts', source: "customElements.define('hmd-x', X);" },
  ];
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED), probes), ['ui/Icon.tsx']);
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED), probes), ['workspace/probe.ts']);
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED, probes), ['ai/aiController.ts']);
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED), probes), ['dom/element.ts']);
});

interface Block {
  prelude: string;
  /** Contenuto tra graffe; `null` per un'istruzione chiusa da `;` (o non chiusa). */
  body: string | null;
}

/** Blocchi di primo livello di un foglio, commenti tolti. Le graffe dentro le stringhe non sono gestite. */
function topLevelBlocks(css: string): Block[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        blocks.push({ prelude: text.slice(start, open).trim(), body: text.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (c === ';' && depth === 0) {
      blocks.push({ prelude: text.slice(start, i).trim(), body: null });
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) blocks.push({ prelude: rest, body: null });
  return blocks;
}

/**
 * Radici `@scope` ammesse per cartella di src/elements/ (spec WC §4.2). Regola generale: `hmd-<cartella>`.
 * Un'eccezione nuova si aggiunge qui con il motivo, mai con uno skip.
 */
const SCOPE_ROOTS: Record<string, (root: string) => boolean> = {
  preview: (root) => root === 'hmd-preview' || root === 'hmd-frontmatter-card',
  ai: (root) => /^hmd-ai-[a-z-]+$/.test(root),
  settings: (root) => /^hmd-settings(?:-[a-z-]+)?$/.test(root),
  // I dialog nativi stanno in document.body, fuori da qualsiasi elemento hmd-*.
  dialogs: (root) => root === 'dialog.hmd-dialog',
};

const rootAllowed = (folder: string, root: string) => (SCOPE_ROOTS[folder] ?? ((r: string) => r === `hmd-${folder}`))(root);

/** Problemi di un CSS di src/elements/<folder>/: ammesso solo `@layer components { @scope (radice) [to (hmd-…, …)] { … } }`. */
function scopeProblems(folder: string, css: string): string[] {
  const problems: string[] = [];
  for (const layer of topLevelBlocks(css)) {
    if (layer.prelude !== '@layer components' || layer.body === null) {
      problems.push(`fuori da @layer components: ${layer.prelude}`);
      continue;
    }
    for (const scope of topLevelBlocks(layer.body)) {
      // Limite inferiore (§4.1): solo elementi figli hmd-*, così lo scope si ferma ai componenti contenuti.
      const m = /^@scope\s*\(\s*([^)\s]+)\s*\)(?:\s+to\s*\(\s*(hmd-[a-z-]+(?:\s*,\s*hmd-[a-z-]+)*)\s*\))?$/.exec(scope.prelude);
      if (!m || scope.body === null) problems.push(`non è un @scope: ${scope.prelude}`);
      else if (!rootAllowed(folder, m[1])) problems.push(`radice non ammessa in ${folder}/: ${m[1]}`);
    }
  }
  return problems;
}

const elementSheets = walk(join(SRC, 'elements'))
  .filter((full) => full.endsWith('.css'))
  .map((full) => ({ path: relative(SRC, full).split(sep).join('/'), css: readFileSync(full, 'utf8') }));

test('every CSS file under src/elements/ is @layer components with @scope blocks on its own roots', () => {
  for (const { path, css } of elementSheets) assert.deepEqual(scopeProblems(path.split('/')[1], css), [], path);
});

test('the @scope check accepts the allowed shapes and rejects the others (synthetic sheets)', () => {
  assert.deepEqual(scopeProblems('file-tree', '@layer components { @scope (hmd-file-tree) to (hmd-x, hmd-y) { .row { color: red } } }'), []);
  assert.deepEqual(scopeProblems('ai', '/* c */ @layer components { @scope (hmd-ai-composer) { :scope { display: block } } @scope (hmd-ai-chat-log) {} }'), []);
  assert.deepEqual(scopeProblems('preview', '@layer components { @scope (hmd-frontmatter-card) {} }'), []);
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-profiles) {} }'), []);
  assert.deepEqual(scopeProblems('dialogs', '@layer components { @scope (dialog.hmd-dialog) { :scope {} } }'), []);
  assert.deepEqual(scopeProblems('file-tree', '.row { color: red }'), ['fuori da @layer components: .row']);
  assert.deepEqual(scopeProblems('file-tree', '@layer base { @scope (hmd-file-tree) {} }'), ['fuori da @layer components: @layer base']);
  assert.deepEqual(scopeProblems('file-tree', '@layer components { .row { color: red } }'), ['non è un @scope: .row']);
  assert.deepEqual(scopeProblems('file-tree', '@layer components { @scope (hmd-search-panel) { .x {} } }'), ['radice non ammessa in file-tree/: hmd-search-panel']);
  assert.deepEqual(scopeProblems('ai', '@layer components { @scope (hmd-preview) {} }'), ['radice non ammessa in ai/: hmd-preview']);
  // Il limite inferiore ferma lo scope ai componenti figli: un selettore qualsiasi lo svuoterebbe o lo allargherebbe.
  assert.deepEqual(scopeProblems('workspace', '@layer components { @scope (hmd-workspace) to (body) {} }'), ['non è un @scope: @scope (hmd-workspace) to (body)']);
  assert.deepEqual(scopeProblems('workspace', '@layer components { @scope (hmd-workspace) to (hmd-editor, .row) {} }'), ['non è un @scope: @scope (hmd-workspace) to (hmd-editor, .row)']);
});
