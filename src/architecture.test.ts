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
});

test('offending files are reported by path and allowed files are not (synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Icon.tsx', source: '// probe: document.write(x)' },
    { path: 'preview/sanitize.ts', source: 'el.innerHTML = sanitizeWith(purify, html);' },
    { path: 'workspace/probe.ts', source: 'await handle.createWritable();' },
    { path: 'fs/fsaOps.ts', source: 'await handle.createWritable();' },
    { path: 'ai/aiController.ts', source: "await fetch('https://example.com')" },
    { path: 'ai/providers/anthropic.ts', source: "await fetch('https://api.anthropic.com')" },
  ];
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED), probes), ['ui/Icon.tsx']);
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED), probes), ['workspace/probe.ts']);
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED, probes), ['ai/aiController.ts']);
});
