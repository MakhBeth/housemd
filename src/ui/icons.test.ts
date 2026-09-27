import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./icons.ts', import.meta.url)), 'utf8');
const svgNames = [...source.matchAll(/from 'pixelarticons\/svg\/([a-z0-9-]+)\.svg\?url'/g)].map((m) => m[1]);
const svgPath = (name: string) => fileURLToPath(new URL(`../../node_modules/pixelarticons/svg/${name}.svg`, import.meta.url));

test('every SVG referenced by icons.ts exists in node_modules/pixelarticons/svg', () => {
  assert.ok(svgNames.length >= 18, `trovate solo ${svgNames.length} icone`);
  for (const name of svgNames) assert.ok(existsSync(svgPath(name)), `manca pixelarticons/svg/${name}.svg`);
});

test('icons.ts imports each SVG only once', () => {
  assert.equal(new Set(svgNames).size, svgNames.length);
});
