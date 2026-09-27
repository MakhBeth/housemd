import test from 'node:test';
import assert from 'node:assert/strict';

import { imageFiles, imageMarkdown, insertImageLinks } from './images';

test('imageFiles keeps only images', () => {
  const files = [{ type: 'image/png', name: 'a' }, { type: 'text/plain', name: 'b' }, { type: 'image/jpeg', name: 'c' }];
  assert.deepEqual(imageFiles(files).map((f) => f.name), ['a', 'c']);
  assert.deepEqual(imageFiles(null), []);
});

test('imageMarkdown wraps links with parentheses or spaces in angle brackets', () => {
  assert.equal(imageMarkdown('/images/a.jpg'), '![](/images/a.jpg)');
  assert.equal(imageMarkdown('a (1).png', 'foto'), '![foto](<a (1).png>)');
});

function fakeTarget(key: string) {
  const state = { key, text: '' };
  return {
    state,
    target: {
      key: () => state.key,
      length: () => state.text.length,
      insert(at: number, text: string) {
        state.text = state.text.slice(0, at) + text + state.text.slice(at);
      },
    },
  };
}

test('insertImageLinks inserts one link per saved image at the position', async () => {
  const { state, target } = fakeTarget('a.md#1');
  state.text = 'xy';
  await insertImageLinks([{ n: 'p' }, { n: 'q' }], 1, async (f) => `${f.n}.png`, target);
  assert.equal(state.text, 'x![](p.png)\n![](q.png)\ny');
});

test('[codex F6] an image saved after the editor switched document is not inserted into the new one', async () => {
  const { state, target } = fakeTarget('a.md#1');
  await insertImageLinks([{ n: 'p' }], 0, async (f) => {
    state.key = 'b.md#2'; // durante il salvataggio l'utente apre un altro file
    state.text = 'testo di B';
    return `${f.n}.png`;
  }, target);
  assert.equal(state.text, 'testo di B');
});
