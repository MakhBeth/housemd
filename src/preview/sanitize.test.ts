import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

import { renderMarkdown } from './render';
import { sanitizeWith, type Purifier } from './sanitize';

const purify = createDOMPurify(new JSDOM('').window as unknown as Window & typeof globalThis) as unknown as Purifier;
const ctx = { currentPath: 'a.md', files: ['a.md', 'idea.md'], lineOffset: 0 };

test('line markers and wikilinks survive sanitization', () => {
  const clean = sanitizeWith(purify, renderMarkdown('# T\n\n[[idea]]', ctx));
  assert.match(clean, /class="hmd-l-0"/);
  assert.match(clean, /class="hmd-l-2"/);
  assert.match(clean, /href="#wiki=idea"/);
});

test('scripts, event handlers, javascript: URLs and styles are removed', () => {
  const md = [
    '<script>alert(1)</script>',
    '',
    '<img src="x.png" onerror="alert(1)">',
    '',
    '<a href="javascript:alert(1)">x</a>',
    '',
    '<style>body{display:none}</style>',
    '',
    '<iframe src="https://e.com"></iframe>',
  ].join('\n');
  const clean = sanitizeWith(purify, renderMarkdown(md, ctx));
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onerror/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /<style/i);
  assert.doesNotMatch(clean, /<iframe/i);
  assert.match(clean, /<img src="x.png">/);
});
