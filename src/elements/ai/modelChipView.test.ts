import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { chipLabel, groupRowKey, groupRows, hasOverrides, popoverParts, privacyNote, profileGroups, profileName } from './modelChipView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const ollama = defaultProfile('ollama', 'o');
const cloud: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud' };
const cli = defaultProfile('claude-code', 'cli');

test('privacy note: the CLI, a local server, a cloud host (none if the address is broken)', () => {
  assert.equal(privacyNote(t, cli), EN_MESSAGES['ai.claudePrivacy']);
  assert.equal(privacyNote(t, ollama), EN_MESSAGES['ai.localPrivacy']);
  assert.equal(privacyNote(t, cloud), t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  const generic: ModelProfile = { ...defaultProfile('openai-compatible', 'g'), baseUrl: 'https://llm.example.org/v1' };
  assert.equal(privacyNote(t, generic), t('ai.cloudPrivacy', { host: 'llm.example.org' }));
  assert.equal(privacyNote(t, { ...generic, baseUrl: 'not a url' }), t('ai.cloudPrivacy', { host: '' }));
});

test('chip label: profile · model of the chat (override first), CLI default without a model', () => {
  assert.equal(chipLabel(t, ollama, {}), `ollama · ${ollama.model}`);
  assert.equal(chipLabel(t, ollama, { model: 'llama3.2' }), 'ollama · llama3.2');
  assert.equal(chipLabel(t, { ...cli, model: '' }, {}), `claude-code · ${EN_MESSAGES['ai.cliDefault']}`);
  assert.equal(hasOverrides({}), false);
  assert.equal(hasOverrides({ temperature: 1 }), true);
});

test('groups: local first, then cloud, empty groups left out; a cloud profile without key is marked', () => {
  assert.deepEqual(profileGroups([cloud, ollama]).map((g) => [g.local, g.profiles.map((p) => p.id)]), [[true, ['o']], [false, ['c']]]);
  assert.deepEqual(profileGroups([cloud]).map((g) => g.local), [false]);
  assert.equal(profileName(cloud), 'Cloud ⚠');
  assert.equal(profileName({ ...cloud, secretId: 's' }), 'Cloud');
  assert.equal(profileName(ollama), 'ollama');
});

test('group rows: the legend, then one row per profile, keyed by id', () => {
  const rows = groupRows({ local: true, profiles: [ollama] });
  assert.deepEqual(rows.map(groupRowKey), ['legend', 'profile:o']);
});

test('popover parts in the order of ModelChip.tsx; the model select only while open', () => {
  const groups = profileGroups([cloud, ollama]);
  assert.deepEqual(popoverParts(groups, false), ['note', 'group:local', 'group:cloud', 'params', 'actions']);
  assert.deepEqual(popoverParts(groups, true), ['note', 'group:local', 'group:cloud', 'model', 'params', 'actions']);
});
