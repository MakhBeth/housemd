import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const config = readFileSync(root('vite.config.ts'), 'utf8');

test('the PWA asks before updating and never registers or reloads by itself', () => {
  assert.match(config, /registerType: 'prompt'/);
  assert.match(config, /injectRegister: false/);
  assert.doesNotMatch(config, /autoUpdate/);
});

test('the manifest has an id, a separate maskable icon and precaches fonts, icons and locale chunks', () => {
  assert.match(config, /id: '\/'/);
  assert.match(config, /src: 'pwa-maskable-512x512\.png', sizes: '512x512', type: 'image\/png', purpose: 'maskable'/);
  assert.match(config, /globPatterns: \['\*\*\/\*\.\{js,css,html,svg,png,woff2\}'\]/);
  assert.ok(existsSync(root('public/pwa-maskable-512x512.png')), 'icona maskable generata');
});
