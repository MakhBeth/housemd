import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Entry } from '../fs/types';
import { contextCandidates, filesUnder, rankCandidates } from './contextIndex';

const v = { lastModified: 1, size: 1 };
const f = (path: string): Entry => ({ kind: 'file', path, version: v });
const d = (path: string): Entry => ({ kind: 'directory', path });
const entries: Entry[] = [
  d('note'), d('note/idee'), d('note-vecchie'), d('vuota'), d('archivio'),
  f('a.md'), f('note/idee.md'), f('note/idee/x.md'), f('note-vecchie/y.md'), f('archivio/idee-vecchie.md'),
  { kind: 'asset', path: 'img.png' },
];
const all = contextCandidates(entries);
const paths = (q: string) => rankCandidates(all, q).items.map((c) => c.path);

test('la radice è sempre prima, con tutti i file; gli asset restano fuori', () => {
  assert.deepEqual(all[0], { path: '', kind: 'root', name: '', mdCount: 5 });
  assert.ok(!all.some((c) => c.path === 'img.png'));
});

test('mdCount è ricorsivo; la cartella vuota vale 0', () => {
  const by = (p: string) => all.find((c) => c.path === p)?.mdCount;
  assert.equal(by('note'), 2);
  assert.equal(by('note-vecchie'), 1);
  assert.equal(by('vuota'), 0);
});

test('ranking: un caso per gradino', () => {
  assert.equal(paths('idee.md')[0], 'note/idee.md');
  assert.deepEqual(paths('idee'), ['note/idee', 'note/idee.md', 'archivio/idee-vecchie.md', 'note/idee/x.md']);
  assert.deepEqual(paths('vecchie').slice(0, 2), ['note-vecchie', 'note-vecchie/y.md']);
  assert.deepEqual(paths('ote/id'), ['note/idee', 'note/idee.md', 'note/idee/x.md']);
  assert.deepEqual(paths('nx'), ['note/idee/x.md']);
});

test('query vuota: ordine dei percorsi con la radice per prima', () => {
  const r = rankCandidates(all, '');
  assert.equal(r.items[0]?.kind, 'root');
  assert.equal(r.total, all.length);
});

test('case-insensitive, NFC e "/" iniziale ignorato', () => {
  assert.equal(paths('IDEE.MD')[0], 'note/idee.md');
  assert.equal(paths('/idee.md')[0], 'note/idee.md');
  const e = contextCandidates([f('café.md')]);
  assert.equal(rankCandidates(e, 'café').items.length, 1);
});

test('limit rispettato e total completo', () => {
  const r = rankCandidates(all, 'e', 2);
  assert.equal(r.items.length, 2);
  assert.ok(r.total > 2);
});

test('filesUnder non confonde note/ con note-vecchie/', () => {
  assert.deepEqual(filesUnder(entries, 'note'), ['note/idee.md', 'note/idee/x.md']);
  assert.equal(filesUnder(entries, '').length, 5);
  assert.deepEqual(filesUnder(entries, 'vuota'), []);
});
