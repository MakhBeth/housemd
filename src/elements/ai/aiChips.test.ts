import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import type { PromptPreset } from '../../ai/types';
import { effortChipState, parameterFields, suggestionPresets, withParam } from './aiChips';

const preset = (id: string, order: number, hidden = false) => ({ id, order, hidden }) as PromptPreset;
const chat = (messages: number) => ({ id: 'c', messages: Array.from({ length: messages }), overrides: {} }) as never;

test('suggestions: visible presets by order, none with messages or a request running', () => {
  const presets = [preset('b', 2), preset('a', 1), preset('h', 0, true)];
  assert.deepEqual(suggestionPresets({ chat: chat(0), running: null, presets }).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(suggestionPresets({ chat: chat(1), running: null, presets }), []);
  assert.deepEqual(suggestionPresets({ chat: chat(0), running: { messageId: 'm', path: 'a.md', startedAt: 0 }, presets }), []);
});

test('effort chip: hidden without profile or support; the override wins over the profile value', () => {
  const ollama = defaultProfile('ollama', 'o');
  const cloud = { ...defaultProfile('anthropic', 'c'), params: { effort: 'low' as const } };
  assert.deepEqual(effortChipState(undefined, {}), { visible: false });
  assert.deepEqual(effortChipState(ollama, {}), { visible: false });
  assert.deepEqual(effortChipState({ ...ollama, kind: 'openai-compatible', params: { effort: 'high' } }, {}), { visible: true, value: 'high' });
  assert.deepEqual(effortChipState(cloud, {}), { visible: true, value: 'low' });
  assert.deepEqual(effortChipState(cloud, { effort: 'max' }), { visible: true, value: 'max' });
  assert.deepEqual(effortChipState({ ...cloud, params: {} }, {}), { visible: true, value: '' });
});

test('parameter fields follow the capabilities; effort last and only when not hidden', () => {
  const ollama = defaultProfile('ollama', 'o');
  assert.deepEqual(parameterFields(ollama, false), [
    { key: 'temperature', kind: 'number', min: 0, max: 2, step: 0.1 },
    { key: 'topP', kind: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'maxOutputTokens', kind: 'number', min: 1, step: 1 },
    { key: 'chunkChars', kind: 'number', min: 1, step: 1 },
  ]);
  const cloud = defaultProfile('anthropic', 'c');
  assert.deepEqual(parameterFields(cloud, false).at(-1), { key: 'effort', kind: 'effort' });
  assert.equal(parameterFields(cloud, true).some((f) => f.key === 'effort'), false);
  const cli = defaultProfile('claude-code', 'x');
  assert.deepEqual(parameterFields(cli, false).map((f) => f.key), ['chunkChars']);
});

test('withParam: empty string removes the key, numbers are parsed, effort is kept as is', () => {
  assert.deepEqual(withParam({ temperature: 1 }, 'temperature', '0.5'), { temperature: 0.5 });
  assert.deepEqual(withParam({ temperature: 1, topP: 1 }, 'temperature', ''), { temperature: undefined, topP: 1 });
  assert.deepEqual(withParam({}, 'effort', 'high'), { effort: 'high' });
  assert.deepEqual(withParam({ effort: 'high' }, 'effort', ''), { effort: undefined });
});
