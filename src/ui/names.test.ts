import test from 'node:test';
import assert from 'node:assert/strict';

import { renameTaken, validateName } from './names';

test('file names get .md appended, folders are kept as they are', () => {
  assert.deepEqual(validateName(' nuova nota ', 'file'), { name: 'nuova nota.md' });
  assert.deepEqual(validateName('Nota.MD', 'file'), { name: 'Nota.MD' });
  assert.deepEqual(validateName('progetti', 'directory'), { name: 'progetti' });
});

test('invalid names are rejected with a message', () => {
  assert.ok('error' in validateName('   ', 'file'));
  assert.ok('error' in validateName('a/b', 'file'));
  assert.ok('error' in validateName('a\\b', 'directory'));
  assert.ok('error' in validateName('.nascosto', 'file'));
  assert.ok('error' in validateName('..', 'directory'));
});

test('[codex F4] renameTaken: a case-only rename is refused only if an entry with exactly that path exists', () => {
  // Case-sensitive: due file distinti a.md e A.md.
  assert.equal(renameTaken('n/a.md', 'n/A.md', ['n/a.md', 'n/A.md']), true);
  // Solo a.md: la rinomina che cambia solo le maiuscole è permessa.
  assert.equal(renameTaken('n/a.md', 'n/A.md', ['n/a.md']), false);
  // Nome invariato: nessun conflitto.
  assert.equal(renameTaken('n/a.md', 'n/a.md', ['n/a.md']), false);
  // Rinomina normale: confronto case-insensitive come prima.
  assert.equal(renameTaken('n/a.md', 'n/b.md', ['n/a.md', 'n/B.md']), true);
  assert.equal(renameTaken('n/a.md', 'n/c.md', ['n/a.md', 'n/B.md']), false);
});

test('validateName returns error codes that the UI translates', () => {
  assert.deepEqual(validateName('   ', 'file'), { error: 'empty' });
  assert.deepEqual(validateName('a/b', 'file'), { error: 'slash' });
  assert.deepEqual(validateName('a\\b', 'directory'), { error: 'slash' });
  assert.deepEqual(validateName('.nascosto', 'file'), { error: 'dot' });
});
