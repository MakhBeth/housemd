import test from 'node:test';
import assert from 'node:assert/strict';

import { newNotePath, parseWikiInner, resolveWikiLink } from './wikilinks';

const files = [
  'README.md',
  'notes/idea.md',
  'notes/progetti/idea.md',
  'archivio/idea.md',
  'Note varie/Caffè al bar.md',
  'posts/why-i-started-this-blog.md',
];

test('parseWikiInner reads target and optional label', () => {
  assert.deepEqual(parseWikiInner('idea'), { target: 'idea', label: 'idea' });
  assert.deepEqual(parseWikiInner(' idea | la mia idea '), { target: 'idea', label: 'la mia idea' });
  assert.equal(parseWikiInner('  '), null);
  assert.equal(parseWikiInner('|solo etichetta'), null);
});

test('resolves by file name anywhere, preferring the closest folder', () => {
  assert.equal(resolveWikiLink('idea', 'notes/progetti/x.md', files), 'notes/progetti/idea.md');
  assert.equal(resolveWikiLink('idea', 'notes/x.md', files), 'notes/idea.md');
  assert.equal(resolveWikiLink('idea', 'archivio/x.md', files), 'archivio/idea.md');
});

test('ties go to the shortest path, then alphabetical order', () => {
  assert.equal(resolveWikiLink('idea', 'altro/x.md', files), 'notes/idea.md');
});

test('resolves folder-qualified targets and explicit .md', () => {
  assert.equal(resolveWikiLink('progetti/idea', 'README.md', files), 'notes/progetti/idea.md');
  assert.equal(resolveWikiLink('notes/idea.md', 'README.md', files), 'notes/idea.md');
});

test('resolves names with accents and spaces case-insensitively', () => {
  assert.equal(resolveWikiLink('caffè al bar', 'README.md', files), 'Note varie/Caffè al bar.md');
  // NFD (macOS) contro NFC
  assert.equal(resolveWikiLink('Caffè al bar', 'README.md', files), 'Note varie/Caffè al bar.md');
});

test('ignores the #heading part and returns null when missing', () => {
  assert.equal(resolveWikiLink('idea#sezione', 'notes/x.md', files), 'notes/idea.md');
  assert.equal(resolveWikiLink('inesistente', 'notes/x.md', files), null);
  assert.equal(resolveWikiLink('dea', 'notes/x.md', files), null);
});

test('newNotePath creates the note next to the current file', () => {
  assert.equal(newNotePath('nuova idea', 'notes/x.md'), 'notes/nuova idea.md');
  assert.equal(newNotePath('sub/nuova.md', 'notes/x.md'), 'notes/sub/nuova.md');
  assert.equal(newNotePath('nuova#titolo', 'x.md'), 'nuova.md');
});
