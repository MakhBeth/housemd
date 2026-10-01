import test from 'node:test';
import assert from 'node:assert/strict';

import { ollamaModels, openaiModels, textDelta, tokens } from './shapes';

test('token counts: numbers pass, anything else is undefined', () => {
  assert.equal(tokens(12), 12);
  assert.equal(tokens('12'), undefined);
  assert.equal(tokens(null), undefined);
  assert.equal(tokens(undefined), undefined);
});

test('Ollama model list: entries without a string name are skipped', () => {
  assert.deepEqual(ollamaModels({ models: [{ name: 'qwen' }, { name: 3 }, null, { model: 'x' }] }), [{ value: 'qwen', label: 'qwen' }]);
});

test('model lists keep today\'s outcomes: missing list = empty; wrong list type or null body = null', () => {
  assert.deepEqual(ollamaModels({}), []);
  assert.deepEqual(ollamaModels(5), []);
  assert.equal(ollamaModels(null), null);
  assert.equal(ollamaModels({ models: 'nope' }), null);
  assert.deepEqual(openaiModels({}), []);
  assert.equal(openaiModels(null), null);
  assert.equal(openaiModels({ data: {} }), null);
});

test('OpenAI-style model list: ids, loaded marker, context size; embeddings and bad entries skipped', () => {
  assert.deepEqual(
    openaiModels({
      data: [
        { id: 'chat', max_context_length: 32000, state: 'loaded' },
        { id: 'emb', type: 'embeddings' },
        { id: 7 },
        { id: 'plain', max_context_length: 'big' },
      ],
    }),
    [
      { value: 'chat', label: 'chat ●', contextTokens: 32000 },
      { value: 'plain', label: 'plain', contextTokens: undefined },
    ],
  );
});

test('Anthropic text delta: missing is empty, a string passes, anything else is a bad stream', () => {
  assert.equal(textDelta(undefined), '');
  assert.equal(textDelta('ciao'), 'ciao');
  assert.throws(() => textDelta(42), { code: 'badStream' });
});
