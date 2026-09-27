import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LOGO, LOGO_LINES } from './logo';

const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8');
const block = /```text\n([\s\S]*?)\n```/.exec(readme)![1].split('\n');

test('the logo is the braille house of the README, line by line (33 lines of 65 characters)', () => {
  assert.equal(block.length, 33);
  assert.equal(LOGO_LINES.length, 33);
  LOGO_LINES.forEach((line, index) => {
    assert.equal([...line].length, 65, `riga ${index + 1}`);
    assert.equal(line, block[index], `riga ${index + 1}`);
  });
  assert.equal(LOGO, block.join('\n'));
});
