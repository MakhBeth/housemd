import test from 'node:test';
import assert from 'node:assert/strict';

import { markdown } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState } from '@codemirror/state';

import { dimSpans, focusSpans, unitAt, type FocusUnit } from './focusRange';

const make = (doc: string, selection?: EditorSelection) => EditorState.create({ doc, extensions: [markdown(), EditorState.allowMultipleSelections.of(true)], selection });

/** Testo dell'unità con il cursore alla posizione del segnaposto `|` (tolto dal documento). */
function unit(source: string, kind: FocusUnit = 'paragraph', locale = 'it'): string | null {
  const pos = source.indexOf(source.includes('§') ? '§' : '|');
  const doc = source.slice(0, pos) + source.slice(pos + 1);
  const span = unitAt(make(doc), pos, kind, locale);
  return span && doc.slice(span.from, span.to);
}

test('a paragraph is the run of non-empty lines around the cursor', () => {
  assert.equal(unit('uno\n\ndue |righe\nancora\n\ntre'), 'due righe\nancora');
});

test('an empty line lights nothing', () => {
  assert.equal(unit('uno\n|\ndue'), null);
  assert.equal(unit('|'), null);
  assert.equal(unit('uno\n\n|'), null);
});

test('cursor at the very start and the very end of the document', () => {
  assert.equal(unit('|uno due\n\naltro'), 'uno due');
  assert.equal(unit('uno\n\naltro due|'), 'altro due');
});

test('a heading is a single line', () => {
  assert.equal(unit('# Tito|lo\ntesto'), '# Titolo');
  assert.equal(unit('Titolo|\n======\n\ntesto'), 'Titolo\n======');
});

test('a list item is the innermost item without its sub-items', () => {
  const doc = '- uno\n  continua\n  - sotto| voce\n  - altra\n- due';
  assert.equal(unit(doc), '  - sotto voce');
  assert.equal(unit('- uno|\n  continua\n  - sotto\n- due'), '- uno\n  continua');
  assert.equal(unit('1. primo\n2. secon|do'), '2. secondo');
  assert.equal(unit('- [ ] fa|re\n- [x] fatto'), '- [ ] fare');
});

test('a quote lights its paragraph with the > markers', () => {
  assert.equal(unit('> uno\n> du|e\n>\n> tre'), '> uno\n> due');
  assert.equal(unit('> uno\n>|\n> tre'), null);
});

test('fenced code, including its fences and empty lines, is a whole block', () => {
  const doc = 'prima\n\n```js\nlet a;\n\nl|et b;\n```\n\ndopo';
  assert.equal(unit(doc), '```js\nlet a;\n\nlet b;\n```');
  assert.equal(unit('    codice\n    in|dentato\n\ntesto'), '    codice\n    indentato');
});

test('frontmatter is a whole block', () => {
  assert.equal(unit('---\ntitle: x\n\ntags: [a|]\n---\n\ntesto'), '---\ntitle: x\n\ntags: [a]\n---');
  // Senza chiusura non è un frontmatter.
  assert.equal(unit('---\ntitle: |x\n\ntesto'), 'title: x');
});

test('a table, a horizontal rule and an HTML block are whole', () => {
  assert.equal(unit('| a | b |\n|---|---|\n| 1 | §2 |\n\nx'), '| a | b |\n|---|---|\n| 1 | 2 |');
  assert.equal(unit('uno\n\n--|-\n\ndue'), '---');
  assert.equal(unit('<div>\nciao |mondo\n</div>\n\nx'), '<div>\nciao mondo\n</div>');
});

test('sentences: the cursor right after the full stop keeps the sentence just ended', () => {
  const doc = 'Prima frase. Seconda frase. Terza.';
  assert.equal(unit('Prima frase.| Seconda frase. Terza.', 'sentence'), 'Prima frase. ');
  assert.equal(unit('Prima frase. |Seconda frase. Terza.', 'sentence'), 'Seconda frase. ');
  assert.equal(unit('|Prima frase. Seconda frase. Terza.', 'sentence'), 'Prima frase. ');
  assert.equal(unit(doc + '|', 'sentence'), 'Terza.');
});

test('sentences: abbreviations and numbers do not split', () => {
  assert.equal(unit('Vedi p. 12 e ecc. e poi |altro. Fine.', 'sentence'), 'Vedi p. 12 e ecc. e poi altro. ');
  assert.equal(unit('Costa 3.50 euro, cioè |poco. Poi no.', 'sentence', 'it'), 'Costa 3.50 euro, cioè poco. ');
  assert.equal(unit('Vedi e.g. questo e |quello. Poi no.', 'sentence', 'en'), 'Vedi e.g. questo e quello. ');
});

test('sentences: the line marker belongs to the first sentence, and a sentence may cross a line break', () => {
  assert.equal(unit('- Una frase. Seco|nda frase. Terza.', 'sentence'), 'Seconda frase. ');
  assert.equal(unit('- U|na frase. Seconda.', 'sentence'), '- Una frase. ');
  assert.equal(unit('uno due\ntre qua|ttro. Cinque.', 'sentence'), 'uno due\ntre quattro. ');
  assert.equal(unit('> Una. Dop|po\n> continua. Ultima.', 'sentence'), 'Doppo\n> continua. ');
});

test('sentences: headings split, code and frontmatter stay whole', () => {
  assert.equal(unit('## Uno. D|ue', 'sentence'), 'Due');
  assert.equal(unit('## U|no. Due', 'sentence'), '## Uno. ');
  assert.equal(unit('```\nUno. D|ue.\n```', 'sentence'), '```\nUno. Due.\n```');
  assert.equal(unit('---\na: Uno. D|ue\n---', 'sentence'), '---\na: Uno. Due\n---');
});

test('a selection lights the union of every unit it touches, from first to last', () => {
  const doc = 'uno\n\ndue\n\ntre\n\nquattro';
  const state = make(doc, EditorSelection.single(1, doc.indexOf('tre') + 1));
  assert.deepEqual(focusSpans(state, 'paragraph', 'it'), [{ from: 0, to: doc.indexOf('tre') + 3 }]);
});

test('a selection ending at the start of the next line does not touch it', () => {
  const doc = 'uno\ndue\n\ntre';
  const state = make(doc, EditorSelection.single(0, 4));
  assert.deepEqual(focusSpans(state, 'paragraph', 'it'), [{ from: 0, to: 7 }]);
});

test('several cursors light one unit each; an empty line adds nothing', () => {
  const doc = 'uno\n\ndue\n\ntre\n\nquattro\n';
  const state = make(doc, EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(doc.indexOf('tre')), EditorSelection.cursor(doc.length)]));
  assert.deepEqual(focusSpans(state, 'paragraph', 'it'), [
    { from: 0, to: 3 },
    { from: doc.indexOf('tre'), to: doc.indexOf('tre') + 3 },
  ]);
});

test('the empty document lights nothing', () => {
  assert.deepEqual(focusSpans(make(''), 'paragraph', 'it'), []);
  assert.deepEqual(focusSpans(make(''), 'sentence', 'it'), []);
});

test('the dimmed spans are what the lit ones leave out of the visible ranges', () => {
  assert.deepEqual(dimSpans([{ from: 10, to: 20 }], [{ from: 0, to: 30 }]), [{ from: 0, to: 10 }, { from: 20, to: 30 }]);
  assert.deepEqual(dimSpans([{ from: 10, to: 20 }], [{ from: 12, to: 18 }]), []);
  assert.deepEqual(dimSpans([{ from: 10, to: 20 }], [{ from: 0, to: 5 }, { from: 15, to: 40 }]), [{ from: 0, to: 5 }, { from: 20, to: 40 }]);
  assert.deepEqual(dimSpans([], [{ from: 0, to: 8 }]), [{ from: 0, to: 8 }]);
  assert.deepEqual(dimSpans([{ from: 0, to: 8 }], [{ from: 0, to: 8 }]), []);
});
