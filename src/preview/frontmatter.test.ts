import test from 'node:test';
import assert from 'node:assert/strict';

import { documentTitle, splitFrontmatter, toCard } from './frontmatter';

const post = `---
title: Perché ho aperto questo blog
date: 2026-09-11
description: La paura
image: /images/papa-castoro.jpg
tags: life, work
---

Beh, prima di tutto…`;

test('splits frontmatter and reports the first body line', () => {
  const doc = splitFrontmatter(post);
  assert.equal(doc.frontmatter?.error, null);
  assert.equal(doc.frontmatter?.data?.title, 'Perché ho aperto questo blog');
  assert.equal(doc.frontmatter?.data?.date, '2026-09-11');
  assert.equal(doc.bodyLine, 7);
  assert.equal(doc.body, '\nBeh, prima di tutto…');
});

test('handles CRLF and BOM', () => {
  const doc = splitFrontmatter('﻿---\r\ntitle: A\r\n---\r\ncorpo\r\n');
  assert.equal(doc.frontmatter?.data?.title, 'A');
  assert.equal(doc.bodyLine, 3);
  assert.equal(doc.body, 'corpo\n');
});

test('text without frontmatter is all body', () => {
  const doc = splitFrontmatter('# Titolo\n\ntesto');
  assert.equal(doc.frontmatter, null);
  assert.equal(doc.bodyLine, 0);
  assert.equal(doc.body, '# Titolo\n\ntesto');
});

test('unclosed frontmatter is treated as body', () => {
  const text = '---\ntitle: A\n\n# Titolo\n\ntanto testo';
  const doc = splitFrontmatter(text);
  assert.equal(doc.frontmatter, null);
  assert.equal(doc.body, text);
});

test('invalid YAML keeps the body and reports an error', () => {
  const doc = splitFrontmatter('---\ntitle: [non chiuso\n---\ncorpo');
  assert.equal(doc.frontmatter?.data, null);
  assert.ok(doc.frontmatter?.error);
  assert.equal(doc.body, 'corpo');
});

test('non-object YAML is an error', () => {
  const doc = splitFrontmatter('---\n- a\n- b\n---\ncorpo');
  assert.equal(doc.frontmatter?.data, null);
  assert.match(doc.frontmatter?.error ?? '', /oggetto/);
});

test('empty frontmatter is an empty object', () => {
  const doc = splitFrontmatter('---\n---\ncorpo');
  assert.deepEqual(doc.frontmatter?.data, {});
});

test('toCard extracts known fields, splits comma tags and lists the rest', () => {
  const card = toCard({ title: 'T', date: '2026-09-11', tags: 'life, work', draft: true, meta: { a: 1 } });
  assert.deepEqual(card, {
    title: 'T',
    date: '2026-09-11',
    description: null,
    image: null,
    tags: ['life', 'work'],
    extra: [['draft', 'true'], ['meta', '{"a":1}']],
  });
  assert.deepEqual(toCard({ tags: ['a', 2] }).tags, ['a', '2']);
});

test('documentTitle prefers frontmatter, then first heading, then file name', () => {
  assert.equal(documentTitle('posts/x.md', post), 'Perché ho aperto questo blog');
  assert.equal(documentTitle('n/x.md', 'intro\n\n# Il titolo #\n\n## Sotto'), 'Il titolo');
  assert.equal(documentTitle('n/Caffè al bar.md', 'solo testo'), 'Caffè al bar');
});

test('[codex F7] cyclic YAML values do not crash toCard', () => {
  const { frontmatter } = splitFrontmatter('---\ntitle: T\nmeta: &self {ref: *self}\n---\ncorpo');
  assert.equal(frontmatter?.error, null);
  const card = toCard(frontmatter!.data!);
  assert.equal(card.title, 'T');
  assert.deepEqual(card.extra, [['meta', '[valore non rappresentabile]']]);
});
