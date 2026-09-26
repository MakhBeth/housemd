import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, parseConfig } from './config';

test('missing config uses defaults without warning', () => {
  assert.deepEqual(parseConfig(null), { config: DEFAULT_CONFIG, warning: null });
  assert.deepEqual(DEFAULT_CONFIG, { images: { saveTo: 'assets', linkPrefix: null } });
});

test('valid config is normalized', () => {
  const { config, warning } = parseConfig('{"images":{"saveTo":"/static/images/","linkPrefix":"/images/"}}');
  assert.equal(warning, null);
  assert.deepEqual(config, { images: { saveTo: 'static/images', linkPrefix: '/images' } });
});

test('broken JSON falls back to defaults with a warning', () => {
  const { config, warning } = parseConfig('{ images: ');
  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.match(warning ?? '', /\.housemd\.json/);
});

test('wrong field types fall back per field with a warning', () => {
  const { config, warning } = parseConfig('{"images":{"saveTo":42,"linkPrefix":"/img"}}');
  assert.deepEqual(config, { images: { saveTo: 'assets', linkPrefix: '/img' } });
  assert.match(warning ?? '', /saveTo/);
});
