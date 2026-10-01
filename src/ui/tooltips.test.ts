import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Tutti i .tsx e .ts (non di test) sotto src/. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

const files = sources(fileURLToPath(new URL('..', import.meta.url)));

test('controls use the drawn tooltip (.tooltip + data-tooltip), never the native title', () => {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // JSX: un title su un elemento HTML (minuscolo); le props `title` dei dialog sono componenti (Maiuscolo).
    for (const match of source.matchAll(/<([a-z][a-z0-9]*)\b[^<>]*?\btitle=/g)) found.push(`${file}: <${match[1]} title=`);
    // DOM costruito a mano (CodeMirror): `.title =` su un pulsante. Restano native le immagini dell'anteprima (niente ::after su <img>); document.title è la scheda.
    for (const match of source.matchAll(/\b(\w+)\.title\s*=(?!=)/g)) if (match[1] !== 'img' && match[1] !== 'document') found.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(found, []);
});


/** Forme dei Web Components: title come prop di el() o come attributo. Restano vietate sui controlli. */
const EL_TITLE = /\bel\(\s*['"][a-z][\w-]*['"]\s*,\s*\{[^}]*\btitle\s*:/g;
const SET_TITLE = /\bsetAttribute\(\s*['"]title['"]/g;

test('custom elements do not set the native title either', () => {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of [EL_TITLE, SET_TITLE]) for (const match of source.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(found, []);
});

test('the title patterns fire on synthetic sources and ignore look-alikes', () => {
  const hits = (source: string) => [EL_TITLE, SET_TITLE].flatMap((p) => [...source.matchAll(p)]).length;
  assert.equal(hits("el('button', { class: 'x', title: label })"), 1);
  assert.equal(hits("button.setAttribute('title', label)"), 1);
  assert.equal(hits("el('button', { 'data-tooltip': label, 'aria-label': label })"), 0);
  assert.equal(hits('const card = { title: frontmatter.title }'), 0);
  assert.equal(hits("dialog.setAttribute('aria-labelledby', id)"), 0);
});
