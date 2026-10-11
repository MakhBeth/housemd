import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { translate } from '../../i18n/i18n';
import { CUSTOM, modelListKey, modelSelectOptions, selectValue } from './modelSelectView';

const t = (key: string) => translate(EN_MESSAGES, key);

test('options: the empty one, the known models with the current one, Other… last', () => {
  const values = modelSelectOptions({ kind: 'ollama', model: 'mine:1b' }, null, t).map((o) => o.value);
  assert.deepEqual(values, ['', 'qwen3.6:35b-mlx', 'qwen3:8b', 'llama3.2', 'mine:1b', CUSTOM]);
  const labels = modelSelectOptions({ kind: 'ollama', model: '' }, null, t);
  assert.equal(labels[0].label, EN_MESSAGES['ai.chooseModel']);
  assert.equal(labels.at(-1)!.label, EN_MESSAGES['ai.other']);
});

test('the server list replaces the known models; the CLI has its own empty label and no empty duplicate', () => {
  assert.deepEqual(
    modelSelectOptions({ kind: 'ollama', model: 'b' }, [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], t).map((o) => o.value),
    ['', 'a', 'b', CUSTOM],
  );
  const cli = modelSelectOptions({ kind: 'claude-code', model: '' }, null, t);
  assert.equal(cli[0].label, EN_MESSAGES['ai.cliDefault']);
  assert.equal(cli.filter((o) => o.value === '').length, 1);
});

test('a value listed twice (or equal to Other…) is kept once', () => {
  const values = modelSelectOptions({ kind: 'ollama', model: 'a' }, [{ value: 'a', label: 'A' }, { value: 'a', label: 'A2' }, { value: CUSTOM, label: 'x' }], t).map((o) => o.value);
  assert.deepEqual(values, ['', 'a', CUSTOM]);
});

test('the select shows Other… with the free field open, the model otherwise', () => {
  assert.equal(selectValue(true, 'a'), CUSTOM);
  assert.equal(selectValue(false, 'a'), 'a');
});

test('the list key follows provider kind, address, saved key and Refresh, not the model or the name', () => {
  const base = defaultProfile('ollama', 'p');
  const key = modelListKey(base, 0);
  assert.equal(modelListKey({ ...base, model: 'other', name: 'renamed' } as typeof base, 0), key);
  assert.notEqual(modelListKey({ ...base, baseUrl: 'http://localhost:1234' }, 0), key);
  assert.notEqual(modelListKey({ ...base, kind: 'lmstudio' }, 0), key);
  assert.notEqual(modelListKey({ ...base, secretId: 's' }, 0), key);
  assert.notEqual(modelListKey(base, 1), key);
});
