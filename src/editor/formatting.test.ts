import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState } from '@codemirror/state';

import { formatTransaction, type FormatAction } from './formatting';

/** `«` e `»` segnano la selezione (anchor, head), `|` il cursore. */
function stateOf(marked: string): EditorState {
  const cursor = marked.indexOf('|');
  if (cursor >= 0) return EditorState.create({ doc: marked.replace('|', ''), selection: EditorSelection.cursor(cursor) });
  const from = marked.indexOf('«');
  const to = marked.indexOf('»') - 1;
  return EditorState.create({ doc: marked.replace('«', '').replace('»', ''), selection: EditorSelection.range(from, to) });
}

function show(state: EditorState): string {
  const { from, to, empty } = state.selection.main;
  const doc = state.doc.toString();
  return empty ? doc.slice(0, from) + '|' + doc.slice(from) : doc.slice(0, from) + '«' + doc.slice(from, to) + '»' + doc.slice(to);
}

function apply(marked: string, action: FormatAction): string {
  const state = stateOf(marked);
  const spec = formatTransaction(state, action);
  assert.ok(spec);
  return show(state.update(spec).state);
}

test('bold wraps the selection and keeps the text selected', () => {
  assert.equal(apply('uno «due» tre', 'bold'), 'uno **«due»** tre');
});

test('bold again removes the markers, whether they are outside or inside the selection', () => {
  assert.equal(apply('uno **«due»** tre', 'bold'), 'uno «due» tre');
  assert.equal(apply('uno «**due**» tre', 'bold'), 'uno «due» tre');
});

test('spaces at the edges stay outside the markers', () => {
  assert.equal(apply('uno« due »tre', 'bold'), 'uno« **due** »tre');
});

test('an empty selection inserts a pair with the cursor inside; again removes it', () => {
  assert.equal(apply('a |b', 'bold'), 'a **|**b');
  assert.equal(apply('a **|**b', 'bold'), 'a |b');
  assert.equal(apply('a |b', 'code'), 'a `|`b');
});

test('italic and bold share the asterisk without confusing each other', () => {
  assert.equal(apply('**«due»**', 'italic'), '***«due»***', 'il grassetto non è corsivo');
  assert.equal(apply('***«due»***', 'italic'), '**«due»**');
  assert.equal(apply('***«due»***', 'bold'), '*«due»*');
  assert.equal(apply('*«due»*', 'bold'), '***«due»***');
});

test('strike and code use their own markers', () => {
  assert.equal(apply('«x»', 'strike'), '~~«x»~~');
  assert.equal(apply('~~«x»~~', 'strike'), '«x»');
  assert.equal(apply('«x»', 'code'), '`«x»`');
});

test('a multi-line selection wraps each non-empty line, and unwraps them all', () => {
  assert.equal(apply('«uno\n\ndue»', 'bold'), '«**uno**\n\n**due**»');
  assert.equal(apply('«**uno**\n\n**due**»', 'bold'), '«uno\n\ndue»');
});

test('link: text becomes the label with the address selected, an address becomes the target', () => {
  assert.equal(apply('vedi «qui»', 'link'), 'vedi [qui](«https://»)');
  assert.equal(apply('vedi «https://example.com»', 'link'), 'vedi [|](https://example.com)');
  assert.equal(apply('vedi |', 'link'), 'vedi [|](https://)');
});

test('heading cycles # → ## → ### → none and keeps the cursor in the text', () => {
  assert.equal(apply('tit|olo', 'heading'), '# tit|olo');
  assert.equal(apply('# tit|olo', 'heading'), '## tit|olo');
  assert.equal(apply('### tit|olo', 'heading'), 'tit|olo');
  assert.equal(apply('|', 'heading'), '# |', 'su una riga vuota si comincia il titolo');
});

test('quote toggles "> " on every touched line', () => {
  assert.equal(apply('«a\nb»', 'quote'), '> «a\n> b»');
  assert.equal(apply('> «a\n> b»', 'quote'), '«a\nb»');
});

test('lists skip blank lines, replace other list markers and toggle off', () => {
  assert.equal(apply('«a\n\nb»', 'bullet'), '- «a\n\n- b»');
  assert.equal(apply('- «a\n- b»', 'bullet'), '«a\nb»');
  assert.equal(apply('«a\nb\nc»', 'ordered'), '1. «a\n2. b\n3. c»');
  assert.equal(apply('- «a\n  - b»', 'task'), '- [ ] «a\n  - [ ] b»', 'il rientro resta');
  assert.equal(apply('- [ ] «a»', 'bullet'), '- «a»', 'da attività a punto');
  assert.equal(apply('- [ ] «a»', 'task'), '«a»');
});

test('a selection ending at the start of a line does not touch that line', () => {
  assert.equal(apply('«a\n»b', 'quote'), '> «a\n»b');
});

test('nothing happens in a read-only editor', () => {
  const state = EditorState.create({ doc: 'a', extensions: EditorState.readOnly.of(true) });
  assert.equal(formatTransaction(state, 'bold'), null);
});
