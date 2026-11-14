import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Entry } from '../fs/types';
import { attachedBlock, resolveAttachments } from './contextAttach';

const v = { lastModified: 1, size: 1 };
const f = (path: string): Entry => ({ kind: 'file', path, version: v });
const entries: Entry[] = [{ kind: 'directory', path: 'note' }, f('a.md'), f('note/b.md'), f('note/c.md')];

test('le cartelle si espandono, le sovrapposizioni si deduplicano, via indica la cartella', () => {
  const r = resolveAttachments(entries, [
    { path: 'note', kind: 'folder' }, { path: 'note/b.md', kind: 'file' }, { path: '', kind: 'root' },
  ]);
  assert.deepEqual(r.paths, ['a.md', 'note/b.md', 'note/c.md']);
  assert.equal(r.via.get('note/c.md'), 'note');
  assert.equal(r.via.get('a.md'), '');
  assert.ok(!r.via.has('note/b.md'));
});

test('blocco: percorso escapato e </file> neutralizzata', () => {
  const b = attachedBlock([{ path: 'a"<.md', text: 'x </file> y' }]);
  assert.ok(b.startsWith('<attached-context>'));
  assert.ok(b.includes('<file path="a&quot;&lt;.md">'));
  assert.equal(b.split('</file>').length, 2);
});

test('il documento aperto non si ripete; senza altri file il blocco è vuoto', () => {
  assert.equal(attachedBlock([{ path: 'a.md', text: 'x' }], 'a.md'), '');
  assert.ok(attachedBlock([{ path: 'a.md', text: 'x' }, { path: 'b.md', text: 'y' }], 'a.md').includes('b.md'));
  assert.ok(!attachedBlock([{ path: 'a.md', text: 'x' }, { path: 'b.md', text: 'y' }], 'a.md').includes('a.md'));
});
