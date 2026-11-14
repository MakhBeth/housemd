import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insertReference, reconcile, referenceText, referencesIn, removeReference, triggerAt } from './contextRefs';

test('@ a inizio testo o dopo spazio/a capo apre; in una email no; con spazio chiude', () => {
  assert.deepEqual(triggerAt('@ide', 4), { from: 0, to: 4, query: 'ide' });
  assert.deepEqual(triggerAt('vedi @no', 8), { from: 5, to: 8, query: 'no' });
  assert.deepEqual(triggerAt('a\n@x', 4), { from: 2, to: 4, query: 'x' });
  assert.equal(triggerAt('mario@example.com', 17), null);
  assert.equal(triggerAt('@ ciao', 6), null);
});

test('la query arriva al cursore, anche con virgolette e spazi', () => {
  assert.equal(triggerAt('@idee resto', 3)?.query, 'id');
  assert.equal(triggerAt('@"a b', 5)?.query, 'a b');
  assert.equal(triggerAt('@"a b" x', 8), null);
});

test('testo del riferimento per file, cartella, radice e percorsi con spazi', () => {
  assert.equal(referenceText('note/idee.md', 'file'), '@note/idee.md');
  assert.equal(referenceText('progetti', 'folder'), '@progetti/');
  assert.equal(referenceText('', 'root'), '@/');
  assert.equal(referenceText('a b.md', 'file'), '@"a b.md"');
});

test('inserimento al posto della query con spazio e cursore dopo lo spazio', () => {
  const t = triggerAt('leggi @ide per favore', 10)!;
  assert.deepEqual(insertReference('leggi @ide per favore', t, '@note/idee.md'), { text: 'leggi @note/idee.md per favore', cursor: 'leggi @note/idee.md '.length });
});

test('referencesIn legge percorsi con e senza virgolette, cartelle e radice', () => {
  assert.deepEqual(referencesIn('@a/b.md e @"c d.md" e @prog/ e @/ mario@x.it'), ['a/b.md', 'c d.md', 'prog', '']);
});

test('reconcile toglie gli allegati senza occorrenze e non ne aggiunge', () => {
  const att = [{ path: 'note/idee.md', kind: 'file' as const }];
  assert.deepEqual(reconcile('@note/ide.md', att), []);
  assert.deepEqual(reconcile('@note/idee.md e @note/idee.md', att), att);
  assert.deepEqual(reconcile('@altro.md', []), []);
  assert.deepEqual(reconcile('x @note/idee.md', att), att);
});

test('removeReference toglie tutte le occorrenze e lo spazio doppio', () => {
  assert.deepEqual(removeReference('uno @a.md due @a.md tre', 'a.md'), { text: 'uno due tre', cursor: 4 });
  assert.equal(removeReference('@a.md ciao', 'a.md').text, 'ciao');
  assert.equal(removeReference('ciao @a.md', 'a.md').text, 'ciao');
  assert.equal(removeReference('@a.md @b.md', 'a.md').text, '@b.md');
});
