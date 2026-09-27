import test from 'node:test';
import assert from 'node:assert/strict';

import { validateName } from './names';

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
