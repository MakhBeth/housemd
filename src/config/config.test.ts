import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, parseConfig } from './config';

test('missing config uses defaults without problems', () => {
  assert.deepEqual(parseConfig(null), { config: DEFAULT_CONFIG, problems: [] });
  assert.deepEqual(DEFAULT_CONFIG, { images: { saveTo: 'assets', linkPrefix: null } });
});

test('valid config is normalized', () => {
  const { config, problems } = parseConfig('{"images":{"saveTo":"/static/images/","linkPrefix":"/images/"}}');
  assert.deepEqual(problems, []);
  assert.deepEqual(config, { images: { saveTo: 'static/images', linkPrefix: '/images' } });
});

test('broken JSON falls back to defaults with an invalidJson problem carrying the parser detail', () => {
  const { config, problems } = parseConfig('{ images: ');
  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'invalidJson');
  assert.ok(problems[0].code === 'invalidJson' && problems[0].detail.length > 0);
});

test('wrong field types fall back per field with a problem code each', () => {
  const { config, problems } = parseConfig('{"images":{"saveTo":42,"linkPrefix":"img"}}');
  assert.deepEqual(config, { images: { saveTo: 'assets', linkPrefix: null } });
  assert.deepEqual(problems, [{ code: 'invalidSaveTo' }, { code: 'invalidLinkPrefix' }]);
});
