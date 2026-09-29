import test from 'node:test';
import assert from 'node:assert/strict';

import {
  basename, detectEol, dirname, isImage, isMarkdown, joinPath, movedPath, normalizePath,
  relativePath, resolveRelative, splitPath, stripMd, withEol,
} from './paths';

test('splitPath ignores empty segments and dots', () => {
  assert.deepEqual(splitPath('/a//b/./c/'), ['a', 'b', 'c']);
  assert.deepEqual(splitPath(''), []);
});

test('normalizePath resolves .. and strips leading slashes', () => {
  assert.equal(normalizePath('/posts/../static/images/a.jpg'), 'static/images/a.jpg');
  assert.equal(normalizePath('a/b/../../..'), '');
  assert.equal(normalizePath('./a/./b/'), 'a/b');
});

test('joinPath joins and normalizes', () => {
  assert.equal(joinPath('posts', 'img', '../a.md'), 'posts/a.md');
  assert.equal(joinPath('', 'a.md'), 'a.md');
});

test('dirname and basename', () => {
  assert.equal(dirname('posts/a.md'), 'posts');
  assert.equal(dirname('a.md'), '');
  assert.equal(basename('posts/sub/a.md'), 'a.md');
});

test('stripMd and isMarkdown are case-insensitive', () => {
  assert.equal(stripMd('Note/Caffè.MD'), 'Note/Caffè');
  assert.equal(stripMd('a.markdown'), 'a.markdown');
  assert.equal(isMarkdown('x/Y.Md'), true);
  assert.equal(isMarkdown('x/y.txt'), false);
});

test('resolveRelative resolves against the file directory', () => {
  assert.equal(resolveRelative('posts/a.md', '../static/i.png'), 'static/i.png');
  assert.equal(resolveRelative('a.md', 'b.md'), 'b.md');
});

test('relativePath builds ../ paths', () => {
  assert.equal(relativePath('posts', 'assets/x.png'), '../assets/x.png');
  assert.equal(relativePath('', 'assets/x.png'), 'assets/x.png');
  assert.equal(relativePath('notes/a', 'notes/b/x.png'), '../b/x.png');
  assert.equal(relativePath('notes', 'notes/x.png'), 'x.png');
});

test('detectEol and withEol preserve CRLF', () => {
  assert.equal(detectEol('a\r\nb\r\n'), '\r\n');
  assert.equal(detectEol('a\nb'), '\n');
  assert.equal(detectEol('senza a capo'), '\n');
  assert.equal(withEol('a\nb\n', '\r\n'), 'a\r\nb\r\n');
  assert.equal(withEol('a\nb', '\n'), 'a\nb');
});

test('movedPath follows a rename of the file or of a folder, only on exact prefixes', () => {
  assert.equal(movedPath('a.md', 'a.md', 'b.md'), 'b.md');
  assert.equal(movedPath('old/sub/a.md', 'old', 'new'), 'new/sub/a.md');
  assert.equal(movedPath('older/a.md', 'old', 'new'), null);
  assert.equal(movedPath('x.md', 'old', 'new'), null);
});

test('isImage recognizes image extensions, case-insensitive', () => {
  assert.equal(isImage('static/x.JPG'), true);
  assert.equal(isImage('logo.svg'), true);
  assert.equal(isImage('data.json'), false);
  assert.equal(isImage('png'), false);
});
