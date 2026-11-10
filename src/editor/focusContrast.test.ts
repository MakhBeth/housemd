import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Il testo fuori fuoco sta a ≥ 4.5:1 (minimo AA) e < 4.7:1 sullo sfondo dell'editor (`--c-surface`), in ogni tema. */
const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');

function token(name: string): [string, string] {
  const m = css.match(new RegExp(`${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, 'i'));
  assert.ok(m, `${name} not found`);
  return [m[1], m[2]];
}

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const dim = token('--c-focus-dim');
const surface = token('--c-surface');

for (const [i, theme] of ['light', 'dark'].entries()) {
  test(`dimmed focus text in the ${theme} theme is between 4.5:1 and 4.7:1`, () => {
    const ratio = contrast(dim[i], surface[i]);
    assert.ok(ratio >= 4.5 && ratio < 4.7, `${theme}: ${ratio.toFixed(3)}`);
  });
}
