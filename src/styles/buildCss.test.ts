import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type InlineConfig } from 'vite';

/** Tutto il CSS che `vite build` produce con la configurazione del progetto (più `inline`). */
async function buildCss(inline: InlineConfig = {}): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 'housemd-build-'));
  try {
    await build({ configFile: 'vite.config.ts', logLevel: 'silent', ...inline, build: { outDir, emptyOutDir: true } });
    const assets = join(outDir, 'assets');
    return readdirSync(assets)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(assets, f), 'utf8'))
      .join('\n');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

/**
 * Nomi dei layer nell'ordine della prima comparsa: è quello che decide la cascata. Il minificatore riscrive
 * la dichiarazione `@layer a, b, c;` (toglie i nomi che il file definisce più avanti), quindi la riga
 * dichiarata non si può cercare così com'è.
 */
function layerOrder(css: string): string[] {
  const order: string[] = [];
  for (const m of css.matchAll(/@layer\s+([^{;]+)[{;]/g)) {
    for (const name of m[1].split(',').map((s) => s.trim())) if (!order.includes(name)) order.push(name);
  }
  return order;
}

const LAYERS = ['reset', 'base', 'components', 'overrides'];

let appCss = '';
before(async () => {
  appCss = await buildCss();
});

// Il tema si cambia con la proprietà `color-scheme` (src/theme/applyTheme.ts): funziona solo se
// light-dark() arriva nel CSS di produzione così com'è. Se il minificatore lo "abbassa" a un
// polyfill basato su prefers-color-scheme, i colori seguono solo il sistema e lo switcher non va.
test('the production CSS keeps native light-dark() so the theme switcher works', () => {
  assert.match(appCss, /light-dark\(/);
  assert.doesNotMatch(appCss, /lightningcss-(light|dark)/);
});

test('layerOrder reads the order of first appearance, also from the minified shape', () => {
  assert.deepEqual(layerOrder('@layer reset, base, components, overrides;'), LAYERS);
  assert.deepEqual(layerOrder('@layer reset;@layer base{.a{}}@layer components{@scope(x){}}@layer overrides;'), LAYERS);
  assert.deepEqual(layerOrder('@layer base{.a{}}@layer reset{.b{}}'), ['base', 'reset']);
});

// Rischio R19 dello spec: i fogli degli elementi (fase 4) vivono di @scope dentro @layer components.
test('@scope and its lower boundary survive the build inside @layer components', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/scope/', import.meta.url));
  const css = await buildCss({ root: fixture });
  assert.match(css, /@layer\s+components\s*\{\s*@scope\s*\(\s*hmd-probe\s*\)\s*to\s*\(\s*hmd-inner\s*,\s*hmd-other\s*\)\s*\{/);
  assert.match(css, /:scope\s*\{/);
  assert.ok(css.indexOf('.row:hover') > css.indexOf('@scope'), 'le regole restano dentro @scope');
  assert.match(css, /light-dark\(/);
  assert.deepEqual(layerOrder(css), LAYERS);
});
