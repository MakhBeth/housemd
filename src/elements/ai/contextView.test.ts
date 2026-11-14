import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Entry } from '../../fs/types';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { candidatesOf, chipText, moveActive, suggestions, type ContextSource } from './contextView';

const t = (k: string, p?: Record<string, string | number>) => translate(EN_MESSAGES, k, p);
const v = { lastModified: 1, size: 1 };
const entries: Entry[] = [{ kind: 'directory', path: 'note' }, { kind: 'file', path: 'note/idee.md', version: v }, { kind: 'directory', path: 'vuota' }];
const src = (patch: Partial<ContextSource> = {}): ContextSource => ({ entries, loading: false, read: async () => [], ...patch });

test('suggestions: chiuso senza trigger, loading, vuoto, risultati', () => {
  const all = candidatesOf(src());
  assert.equal(suggestions(src(), all, null).kind, 'closed');
  assert.equal(suggestions(src({ loading: true }), all, '').kind, 'loading');
  assert.deepEqual(suggestions(src(), all, 'zzz'), { kind: 'empty', message: 'ai.context.noResults', query: 'zzz' });
  const none = candidatesOf(src({ entries: [] }));
  assert.deepEqual(suggestions(src({ entries: [] }), none, ''), { kind: 'empty', message: 'ai.context.noMarkdown', query: '' });
  const r = suggestions(src(), all, 'idee');
  assert.ok(r.kind === 'items' && r.items[0]!.path === 'note/idee.md');
});

test('chip: file = percorso; cartella = percorso e conteggio; conteggio ignoto = «counting» solo mentre carica', () => {
  const all = candidatesOf(src());
  assert.equal(chipText({ path: 'note/idee.md', kind: 'file' }, all, false, t, 'en'), 'note/idee.md');
  assert.equal(chipText({ path: 'note', kind: 'folder' }, all, false, t, 'en'), 'note/ · 1 file');
  assert.equal(chipText({ path: 'vuota', kind: 'folder' }, all, false, t, 'en'), 'vuota/ · 0 files');
  assert.equal(chipText({ path: 'x', kind: 'folder' }, all, true, t, 'en'), `x/ · ${EN_MESSAGES['ai.context.counting']}`);
  assert.equal(chipText({ path: '', kind: 'root' }, all, false, t, 'en'), '/ · 1 file');
});

test('moveActive è ciclico', () => {
  assert.equal(moveActive(0, -1, 3), 2);
  assert.equal(moveActive(2, 1, 3), 0);
  assert.equal(moveActive(0, 1, 0), 0);
});
