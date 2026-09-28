import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, type HouseConfig } from './config';
import { imageFileName, imageLink, resolveImageSrc, uniquePath } from './images';

const blog: HouseConfig = { images: { saveTo: 'static/images', linkPrefix: '/images' } };

test('resolveImageSrc maps linkPrefix to saveTo', () => {
  assert.equal(resolveImageSrc('/images/papa-castoro.jpg', 'posts/a.md', blog), 'static/images/papa-castoro.jpg');
});

test('resolveImageSrc resolves root-absolute and relative paths', () => {
  assert.equal(resolveImageSrc('/static/x.png', 'posts/a.md', DEFAULT_CONFIG), 'static/x.png');
  assert.equal(resolveImageSrc('../assets/x.png', 'posts/a.md', DEFAULT_CONFIG), 'assets/x.png');
  assert.equal(resolveImageSrc('x.png?v=2#frag', 'posts/a.md', DEFAULT_CONFIG), 'posts/x.png');
});

test('resolveImageSrc leaves external URLs alone', () => {
  for (const src of ['https://e.com/a.png', 'http://e.com/a.png', '//cdn.e.com/a.png', 'data:image/png;base64,AA', 'blob:x']) {
    assert.equal(resolveImageSrc(src, 'a.md', DEFAULT_CONFIG), null, src);
  }
});

test('resolveImageSrc decodes %20 and angle-bracket paths', () => {
  assert.equal(resolveImageSrc('foto%20mare.jpg', 'Note varie/Caffè.md', DEFAULT_CONFIG), 'Note varie/foto mare.jpg');
  assert.equal(resolveImageSrc('<foto mare.jpg>', 'a.md', DEFAULT_CONFIG), 'foto mare.jpg');
});

test('imageLink uses linkPrefix or a path relative to the file', () => {
  assert.equal(imageLink('static/images/x.png', 'posts/a.md', blog), '/images/x.png');
  assert.equal(imageLink('assets/x.png', 'posts/a.md', DEFAULT_CONFIG), '../assets/x.png');
  assert.equal(imageLink('assets/x.png', 'a.md', DEFAULT_CONFIG), 'assets/x.png');
});

test('imageLink encodes spaces', () => {
  assert.equal(imageLink('assets/foto mare.jpg', 'a.md', DEFAULT_CONFIG), 'assets/foto%20mare.jpg');
});

test('imageFileName slugifies original names and names pasted images by date', () => {
  const now = new Date(2026, 8, 27, 14, 32, 5);
  assert.equal(imageFileName('Foto Mare è Bella.JPG', 'image/jpeg', now), 'foto-mare-e-bella.jpg');
  assert.equal(imageFileName('image.png', 'image/png', now), 'incollata-2026-09-27-143205.png');
  assert.equal(imageFileName(null, 'image/webp', now), 'incollata-2026-09-27-143205.webp');
  assert.equal(imageFileName('', 'image/svg+xml', now), 'incollata-2026-09-27-143205.svg');
});

test('uniquePath adds numeric suffixes before the extension', async () => {
  const taken = new Set(['assets/x.png', 'assets/x-1.png']);
  const exists = async (p: string) => taken.has(p);
  assert.equal(await uniquePath('assets', 'x.png', exists), 'assets/x-2.png');
  assert.equal(await uniquePath('assets', 'y.png', exists), 'assets/y.png');
});
