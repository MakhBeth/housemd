import test from 'node:test';
import assert from 'node:assert/strict';

import { imageFiles, imageMarkdown } from './images';

test('imageFiles keeps only images', () => {
  const files = [{ type: 'image/png', name: 'a' }, { type: 'text/plain', name: 'b' }, { type: 'image/jpeg', name: 'c' }];
  assert.deepEqual(imageFiles(files).map((f) => f.name), ['a', 'c']);
  assert.deepEqual(imageFiles(null), []);
});

test('imageMarkdown wraps links with parentheses or spaces in angle brackets', () => {
  assert.equal(imageMarkdown('/images/a.jpg'), '![](/images/a.jpg)');
  assert.equal(imageMarkdown('a (1).png', 'foto'), '![foto](<a (1).png>)');
});
