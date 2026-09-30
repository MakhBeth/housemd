import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRoute, parseRoute, SETTINGS_SECTIONS } from './route';

test('empty or unknown hashes open the workspace', () => {
  for (const hash of ['', '#', '#foo', '#settingsx', '#/settings', '#SETTINGS']) {
    assert.deepEqual(parseRoute(hash), { view: 'workspace' }, hash);
  }
});

test('#settings and unknown sections open the general settings', () => {
  assert.deepEqual(parseRoute('#settings'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/xyz'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/ai-profiles/extra'), { view: 'settings', section: 'general' });
});

test('every known section round-trips', () => {
  for (const section of SETTINGS_SECTIONS) {
    const route = { view: 'settings', section } as const;
    assert.deepEqual(parseRoute(formatRoute(route)), route);
  }
});

test('formatRoute writes the shortest hash', () => {
  assert.equal(formatRoute({ view: 'workspace' }), '');
  assert.equal(formatRoute({ view: 'settings', section: 'general' }), '#settings');
  assert.equal(formatRoute({ view: 'settings', section: 'ai-sync' }), '#settings/ai-sync');
});
