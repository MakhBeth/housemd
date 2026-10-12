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

/**
 * Elementi (spec WC §10 R21): la rete passa solo dal controller AI (`controller.provider(...)`), mai da un
 * modulo di src/ai/providers importato direttamente; le chiavi non passano mai di lì (né lettura né scrittura).
 */
const ELEMENT_AI = /\bfrom\s+['"][^'"]*\/ai\/providers(?:\/[^'"]*)?['"]|\bimport\(\s*['"][^'"]*\/ai\/providers|\b(?:getSecret|setSecret|saveSecret|deleteSecret)\s*\(|['"]aiSecrets['"]|\.secret\s*\(/;
const ELEMENT_AI_ALLOWED = (path: string) => !path.startsWith('elements/');

/** Custom element: un solo punto di registrazione (spec WC §8.3), così l'ordine di definizione è uno. */
const DEFINE = /\bcustomElements\.define\s*\(/;
const DEFINE_ALLOWED = new Set(['elements/define.ts']);

/** Dialog nativi: solo le funzioni di elements/dialogs/ li creano e li aprono (spec WC §5.4). */
const DIALOG = /\.showModal\s*\(|<dialog\b|createElement\(\s*['"]dialog['"]|\bel\(\s*['"]dialog['"]/;
const DIALOG_ALLOWED = (path: string) => path.startsWith('elements/dialogs/');

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

/**
 * La sola eccezione: il campo della chiave nella sezione dei profili la passa al controller con
 * `controller.setSecret(…)` (scritta, mai letta, mai in attributi o `dataset`). Tutto il resto vale anche lì.
 */
const SECRET_WRITE_ALLOWED = new Set(['elements/settings/profiles.element.ts']);
const withoutAllowedSecretWrite = (list: SourceFile[]) =>
  list.map((file) => (SECRET_WRITE_ALLOWED.has(file.path) ? { ...file, source: file.source.replace(/\bcontroller\.setSecret\s*\(/g, '') } : file));

test('elements reach the AI providers only through the controller and never touch the keys', () => {
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite(sources)), []);
});

/** Fase 7 (spec WC §8.3, §11): React non c'è più, né come import né come file `.tsx`. */
const REACT = /\bfrom\s+['"](?:react|react-dom)(?:\/[^'"]*)?['"]|\bimport\(\s*['"](?:react|react-dom)(?:\/[^'"]*)?['"]/;

test('no React anywhere in src/: no import of react or react-dom, no .tsx file (tests included)', () => {
  const all = walk(SRC).map((full) => ({ path: relative(SRC, full).split(sep).join('/'), full }));
  assert.deepEqual(all.filter(({ path }) => path.endsWith('.tsx')).map(({ path }) => path), []);
  // Questo file contiene i casi sintetici del controllo: si salta.
  const ts = all.filter(({ path }) => path.endsWith('.ts') && path !== 'architecture.test.ts').map(({ path, full }) => ({ path, source: readFileSync(full, 'utf8') }));
  assert.deepEqual(offenders(REACT, () => false, ts), []);
});

test('customElements.define appears only in elements/define.ts', () => {
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED)), []);
});

test('native dialogs are created and opened only in elements/dialogs/', () => {
  assert.deepEqual(offenders(DIALOG, DIALOG_ALLOWED), []);
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
  for (const bad of ["import { createProvider } from '../../ai/providers';", "import { x } from '../../ai/providers/anthropic';", "await import('../../ai/providers/index')", 'controller.secret(profile)', 'store.getSecret(id)', "tx.objectStore('aiSecrets')"]) {
    assert.ok(ELEMENT_AI.test(bad), bad);
  }
  for (const ok of ["import type { AiController } from '../../ai/aiController';", 'controller.provider(profile)', '// la rete passa da src/ai/providers', 'profile.secretId']) {
    assert.ok(!ELEMENT_AI.test(ok), ok);
  }
  for (const bad of ["import { useState } from 'react';", "import { createRoot } from 'react-dom/client';", "await import('react')"]) {
    assert.ok(REACT.test(bad), bad);
  }
  for (const ok of ["import { reactive } from './reactive';", '// niente React qui', "import { x } from 'preact'"]) {
    assert.ok(!REACT.test(ok), ok);
  }
  assert.ok(DEFINE.test("customElements.define('hmd-file-tree', HmdFileTree)"));
  assert.ok(!DEFINE.test("customElements.get('hmd-file-tree')"));
  for (const bad of ['dialog.showModal()', '<dialog ref={ref}>', "document.createElement('dialog')", "el('dialog', { class: 'x' })"]) {
    assert.ok(DIALOG.test(bad), bad);
  }
  for (const ok of ["document.querySelector('dialog[open]')", 'showConfirmDialog({ t })', "getByRole('dialog')"]) {
    assert.ok(!DIALOG.test(ok), ok);
  }
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
    { path: 'ui/Probe.tsx', source: 'ref.current?.showModal();' },
    { path: 'elements/dialogs/modal.ts', source: 'dialog.showModal();' },
    { path: 'elements/ai/probe.element.ts', source: "import { createProvider } from '../../ai/providers';" },
  ];
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED), probes), ['ui/Icon.tsx']);
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED), probes), ['workspace/probe.ts']);
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED, probes), ['ai/aiController.ts']);
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED), probes), ['dom/element.ts']);
  assert.deepEqual(offenders(DIALOG, DIALOG_ALLOWED, probes), ['ui/Probe.tsx']);
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, probes), ['elements/ai/probe.element.ts']);

  // L'eccezione della chiave vale solo per setSecret nella sezione dei profili.
  const secrets: SourceFile[] = [
    { path: 'elements/settings/profiles.element.ts', source: 'controller.setSecret(validateProfile(draft), key, remember)' },
    { path: 'elements/settings/presets.element.ts', source: 'controller.setSecret(draft, key, remember)' },
    { path: 'elements/settings/sync.element.ts', source: 'await controller.secret(profile)' },
  ];
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite(secrets)), ['elements/settings/presets.element.ts', 'elements/settings/sync.element.ts']);
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite([{ path: 'elements/settings/profiles.element.ts', source: 'controller.secret(p); controller.setSecret(p, k, r)' }])), ['elements/settings/profiles.element.ts']);
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
      // Più radici separate da virgola (sezioni con un foglio comune), ognuna ammessa nella cartella.
      const m = /^@scope\s*\(\s*([^)\s,]+(?:\s*,\s*[^)\s,]+)*)\s*\)(?:\s+to\s*\(\s*(hmd-[a-z-]+(?:\s*,\s*hmd-[a-z-]+)*)\s*\))?$/.exec(scope.prelude);
      if (!m || scope.body === null) problems.push(`non è un @scope: ${scope.prelude}`);
      else for (const root of m[1].split(/\s*,\s*/)) if (!rootAllowed(folder, root)) problems.push(`radice non ammessa in ${folder}/: ${root}`);
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
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-profiles, hmd-settings-presets) {} }'), []);
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-sync, hmd-preview) {} }'), ['radice non ammessa in settings/: hmd-preview']);
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
