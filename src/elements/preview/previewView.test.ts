import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG } from '../../config/config';
import { splitFrontmatter } from '../../preview/frontmatter';
import { cardImagePath, cardView, docUpdate, isExternalHref, linkAction } from './previewView';

test('links: wiki, native (#, schemes, //), relative markdown, everything else blocked', () => {
  assert.deepEqual(linkAction('#wiki=idea', 'note.md'), { kind: 'wiki', target: 'idea' });
  assert.deepEqual(linkAction('#wiki=brand%20new', 'note.md'), { kind: 'wiki', target: 'brand new' });
  assert.deepEqual(linkAction('#top', 'note.md'), { kind: 'native' });
  for (const href of ['https://example.com', 'mailto:a@b.c', '//cdn.test/x']) assert.deepEqual(linkAction(href, 'note.md'), { kind: 'native' });
  assert.deepEqual(linkAction('sub/other.md', 'note.md'), { kind: 'open', path: 'sub/other.md' });
  assert.deepEqual(linkAction('../up.md?x=1#h', 'dir/note.md'), { kind: 'open', path: 'up.md' });
  assert.deepEqual(linkAction('citt%C3%A0.md', 'note.md'), { kind: 'open', path: 'città.md' });
  assert.deepEqual(linkAction('/root/a.md', 'dir/note.md'), { kind: 'open', path: 'root/a.md' });
  // Una sequenza % non valida resta com'è (come il try/catch di Preview.tsx).
  assert.deepEqual(linkAction('%E0%A4%A.md', 'note.md'), { kind: 'open', path: '%E0%A4%A.md' });
  assert.deepEqual(linkAction('image.png', 'note.md'), { kind: 'block' });
  assert.deepEqual(linkAction('', 'note.md'), { kind: 'block' });
});

test('external hrefs: a scheme or a protocol-relative host', () => {
  assert.deepEqual(['https://x', 'mailto:a', '//h/x', 'x.md', '#a', '/abs.md'].map(isExternalHref), [true, true, true, false, false, false]);
});

test('document update: right away on the first render or a new path, debounced on a text change', () => {
  assert.equal(docUpdate(null, 'a.md', false), 'now');
  assert.equal(docUpdate({ path: 'a.md' }, 'b.md', true), 'now');
  assert.equal(docUpdate({ path: 'a.md' }, 'a.md', true), 'debounce');
  assert.equal(docUpdate({ path: 'a.md' }, 'a.md', false), 'keep');
});

test('card view: none, error, or the card data (an empty frontmatter is an empty card)', () => {
  const fm = (yaml: string) => splitFrontmatter(`---\n${yaml}\n---\nbody`).frontmatter;
  assert.deepEqual(cardView(null), { kind: 'none' });
  const broken = cardView(fm('title: ['));
  assert.equal(broken.kind, 'error');
  assert.ok(broken.kind === 'error' && broken.detail.length > 0);
  assert.deepEqual(cardView(fm('')), { kind: 'card', card: { title: null, date: null, description: null, image: null, tags: [], extra: [] } });
  const card = cardView(fm('title: T\nauthor: Ada'));
  assert.ok(card.kind === 'card' && card.card.title === 'T');
  assert.deepEqual(card.kind === 'card' && card.card.extra, [['author', 'Ada']]);
});

test('card image path: resolved like the body images, null for remote or missing', () => {
  const split = (yaml: string) => splitFrontmatter(`---\n${yaml}\n---\nbody`);
  assert.equal(cardImagePath(split('image: pic.png'), 'dir/note.md', DEFAULT_CONFIG), 'dir/pic.png');
  assert.equal(cardImagePath(split('image: https://example.com/a.png'), 'note.md', DEFAULT_CONFIG), null);
  assert.equal(cardImagePath(split('title: T'), 'note.md', DEFAULT_CONFIG), null);
  assert.equal(cardImagePath(splitFrontmatter('no frontmatter'), 'note.md', DEFAULT_CONFIG), null);
});
