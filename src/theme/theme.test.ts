import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { effectiveTheme, nextTheme, parseTheme, resolveColorScheme, THEME_BACKGROUND, THEME_STORAGE_KEY } from './theme';

test('nextTheme cycles auto → light → dark → auto', () => {
  assert.equal(nextTheme('auto'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'auto');
});

test('resolveColorScheme maps the preference to color-scheme', () => {
  assert.equal(resolveColorScheme('auto'), 'light dark');
  assert.equal(resolveColorScheme('light'), 'light');
  assert.equal(resolveColorScheme('dark'), 'dark');
});

test('effectiveTheme follows the system only in auto', () => {
  assert.equal(effectiveTheme('auto', true), 'dark');
  assert.equal(effectiveTheme('auto', false), 'light');
  assert.equal(effectiveTheme('light', true), 'light');
  assert.equal(effectiveTheme('dark', false), 'dark');
});

test('parseTheme falls back to auto for unknown or corrupted values', () => {
  assert.equal(parseTheme('dark'), 'dark');
  assert.equal(parseTheme('sepia'), 'auto');
  assert.equal(parseTheme(42), 'auto');
  assert.equal(parseTheme(undefined), 'auto');
});

test('the anti-flash script in index.html uses the same key and colors as theme.ts', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
  assert.ok(html.includes(`'${THEME_STORAGE_KEY}'`), 'chiave della preferenza');
  assert.ok(html.includes(`'${THEME_BACKGROUND.light}'`) && html.includes(`'${THEME_BACKGROUND.dark}'`), 'colori di sfondo');
  assert.match(html, /<meta name="theme-color"/);
});
