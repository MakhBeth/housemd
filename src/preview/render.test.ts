import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown, sourceLineOf, wikiTargetOfHref, type RenderContext } from './render';

const ctx: RenderContext = { currentPath: 'notes/a.md', files: ['notes/a.md', 'notes/idea.md'], lineOffset: 0 };

test('block elements carry their source line, shifted by the frontmatter offset', () => {
  const html = renderMarkdown('# Titolo\n\nparagrafo\n\n- uno\n- due', { ...ctx, lineOffset: 5 });
  assert.match(html, /<h1 class="hmd-l-5">Titolo<\/h1>/);
  assert.match(html, /<p class="hmd-l-7">paragrafo<\/p>/);
  assert.match(html, /<li class="hmd-l-9">/);
});

test('wikilinks render as links, missing ones marked', () => {
  const html = renderMarkdown('vedi [[idea|la mia idea]] e [[nuova]]', ctx);
  assert.match(html, /<a class="wikilink" href="#wiki=idea">la mia idea<\/a>/);
  assert.match(html, /<a class="wikilink missing" href="#wiki=nuova">nuova<\/a>/);
});

test('wikilink labels are escaped and targets encoded', () => {
  const html = renderMarkdown('[[caffè al bar|<b>x</b>]]', ctx);
  assert.match(html, /href="#wiki=caff%C3%A8%20al%20bar"/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('wikilinks inside code are left alone', () => {
  const html = renderMarkdown('`[[idea]]`', ctx);
  assert.match(html, /<code>\[\[idea\]\]<\/code>/);
});

test('sourceLineOf and wikiTargetOfHref decode the markers', () => {
  assert.equal(sourceLineOf({ className: 'foo hmd-l-12' }), 12);
  assert.equal(sourceLineOf({ className: 'foo' }), null);
  assert.equal(wikiTargetOfHref('#wiki=caff%C3%A8'), 'caffè');
  assert.equal(wikiTargetOfHref('https://e.com'), null);
});
