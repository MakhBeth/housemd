import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

import { renderMarkdown } from './render';
import { sanitizeWith, setSafeHTML, type Purifier } from './sanitize';

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

test('[final fix2 6a] with a Sanitizer global, setHTML gets a sanitizer instance with style/form removed', async () => {
  const removed: string[] = [];
  class FakeSanitizer {
    removeElement(name: string) {
      removed.push(name);
    }
  }
  const g = globalThis as { Sanitizer?: unknown };
  const previous = g.Sanitizer;
  g.Sanitizer = FakeSanitizer;
  try {
    let received: { sanitizer?: unknown } | undefined;
    const el = {
      setHTML(_html: string, options?: { sanitizer?: unknown }) {
        received = options;
      },
    } as unknown as Element;
    await setSafeHTML(el, '<p>x</p>');
    assert.ok(received?.sanitizer instanceof FakeSanitizer, 'passa un istanza di Sanitizer, non un dizionario');
    assert.deepEqual(removed, ['style', 'form']);
  } finally {
    g.Sanitizer = previous;
  }
});

test('[final fix2 6b] without a Sanitizer global, setHTML is called with the default config (no options)', async () => {
  const g = globalThis as { Sanitizer?: unknown };
  const previous = g.Sanitizer;
  delete g.Sanitizer;
  try {
    let receivedArgs: unknown[] = [];
    const el = {
      setHTML(...args: unknown[]) {
        receivedArgs = args;
      },
    } as unknown as Element;
    await setSafeHTML(el, '<p>x</p>');
    assert.deepEqual(receivedArgs, ['<p>x</p>'], 'nessun secondo argomento: resta l’allowlist predefinita e sicura');
  } finally {
    if (previous !== undefined) g.Sanitizer = previous;
  }
});
