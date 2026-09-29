import test from 'node:test';
import assert from 'node:assert/strict';

import type { Entry } from '../fs/types';
import { ancestorsOf, buildTree } from './tree';

const v = { lastModified: 1, size: 1 };

test('buildTree nests entries, folders first, natural order', () => {
  const entries: Entry[] = [
    { kind: 'file', path: 'z.md', version: v },
    { kind: 'directory', path: 'notes' },
    { kind: 'file', path: 'notes/nota 10.md', version: v },
    { kind: 'file', path: 'notes/nota 2.md', version: v },
    { kind: 'directory', path: 'notes/sub' },
    { kind: 'file', path: 'notes/sub/a.md', version: v },
    { kind: 'file', path: 'Alfa.md', version: v },
  ];
  const tree = buildTree(entries);
  assert.deepEqual(tree.map((n) => n.name), ['notes', 'Alfa.md', 'z.md']);
  assert.deepEqual(tree[0].children.map((n) => n.name), ['sub', 'nota 2.md', 'nota 10.md']);
  assert.equal(tree[0].children[0].children[0].path, 'notes/sub/a.md');
});

test('buildTree keeps assets as their own kind, sorted among the files', () => {
  const tree = buildTree([
    { kind: 'file', path: 'b.md', version: v },
    { kind: 'asset', path: 'a.png' },
    { kind: 'asset', path: 'c.json' },
  ]);
  assert.deepEqual(tree.map((n) => `${n.kind}:${n.name}`), ['asset:a.png', 'file:b.md', 'asset:c.json']);
});

test('buildTree creates missing parent folders', () => {
  const tree = buildTree([{ kind: 'file', path: 'a/b/c.md', version: v }]);
  assert.equal(tree[0].path, 'a');
  assert.equal(tree[0].children[0].path, 'a/b');
});

test('ancestorsOf lists the folders containing a path', () => {
  assert.deepEqual(ancestorsOf('a/b/c.md'), ['a', 'a/b']);
  assert.deepEqual(ancestorsOf('c.md'), []);
});

test('buildTree sorts names with the collation of the given UI locale', () => {
  const entries: Entry[] = [
    { kind: 'file', path: 'zeta.md', version: v },
    { kind: 'file', path: 'ärmel.md', version: v },
  ];
  assert.deepEqual(buildTree(entries, 'de').map((n) => n.name), ['ärmel.md', 'zeta.md']);
  assert.deepEqual(buildTree(entries, 'sv').map((n) => n.name), ['zeta.md', 'ärmel.md'], 'in svedese ä viene dopo z');
});
