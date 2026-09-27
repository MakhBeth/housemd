import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';

// Il tema si cambia con la proprietà `color-scheme` (src/theme/applyTheme.ts): funziona solo se
// light-dark() arriva nel CSS di produzione così com'è. Se il minificatore lo "abbassa" a un
// polyfill basato su prefers-color-scheme, i colori seguono solo il sistema e lo switcher non va.
test('the production CSS keeps native light-dark() so the theme switcher works', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'housemd-build-'));
  try {
    await build({ configFile: 'vite.config.ts', logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const assets = join(outDir, 'assets');
    const css = readdirSync(assets)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(assets, f), 'utf8'))
      .join('\n');
    assert.match(css, /light-dark\(/);
    assert.doesNotMatch(css, /lightningcss-(light|dark)/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
