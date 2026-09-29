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

test('with a Sanitizer global, setHTML gets a sanitizer built from the default config plus class, img, details', async () => {
  const calls: string[] = [];
  class FakeSanitizer {
    removeElement(name: string) {
      calls.push(`remove ${name}`);
    }
    allowAttribute(name: string) {
      calls.push(`attr ${name}`);
    }
    allowElement(el: string | { name: string; attributes?: string[] }) {
      calls.push(typeof el === 'string' ? `el ${el}` : `el ${el.name}[${(el.attributes ?? []).join(',')}]`);
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
    // Il default di Chrome toglie class (marcatori di riga per lo scroll, wikilink) e <img>.
    assert.deepEqual(calls, [
      'remove style',
      'remove form',
      'attr class',
      'attr data-ai-image',
      'attr data-local-src',
      'el button[type,data-ai-image]',
      'el img[src,alt,title,width,height,data-local-src]',
      'el details',
      'el summary',
    ]);
  } finally {
    g.Sanitizer = previous;
  }
});

test('without a Sanitizer global, setHTML is not used (its default would drop classes and images): DOMPurify is', async () => {
  const g = globalThis as { Sanitizer?: unknown };
  const previous = g.Sanitizer;
  delete g.Sanitizer;
  try {
    let setHTMLCalled = false;
    const el = {
      innerHTML: '',
      setHTML() {
        setHTMLCalled = true;
      },
    } as unknown as Element;
    // In Node DOMPurify non ha una window (niente sanitize): qui conta solo che il percorso non sia
    // setHTML() nudo. Il comportamento di DOMPurify è coperto da `sanitizeWith` con jsdom qui sopra.
    await setSafeHTML(el, '<p class="hmd-l-0">x</p>').catch(() => undefined);
    assert.equal(setHTMLCalled, false);
  } finally {
    if (previous !== undefined) g.Sanitizer = previous;
  }
});
