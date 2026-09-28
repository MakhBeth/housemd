import test from 'node:test';
import assert from 'node:assert/strict';

import { initialRestoreSeq, pendingRestore } from './restoreCommand';

test('a restore arriving while the editor is mounted is applied once', () => {
  let applied = initialRestoreSeq(null); // editor montato prima del ripristino
  const restore = { seq: 1, textLf: 'versione vecchia' };
  assert.equal(pendingRestore(applied, restore), restore);
  applied = restore.seq;
  assert.equal(pendingRestore(applied, restore), null, 'altri render con la stessa prop: niente');
});

test('restore → edit → preview → editor: the remounted editor does not re-apply the restore', () => {
  const restore = { seq: 1, textLf: 'versione vecchia' };
  // L'utente ha scritto dopo il ripristino, è passato ad Anteprima ed è tornato all'Editor: il nuovo
  // editor si monta con props.text aggiornato e con lo stesso comando ancora nelle props.
  const applied = initialRestoreSeq(restore);
  assert.equal(pendingRestore(applied, restore), null);
  // Un ripristino successivo, invece, si applica.
  const next = { seq: 2, textLf: 'altra versione' };
  assert.equal(pendingRestore(applied, next), next);
});
