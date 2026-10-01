import test from 'node:test';
import assert from 'node:assert/strict';

import { invertBraille, LOGO, LOGO_INVERTED, LOGO_LINES, WORDMARK, WORDMARK_LINES } from './logo';

test('the logo is the braille house (33 lines of 65 characters)', () => {
  assert.equal(LOGO_LINES.length, 33);
  LOGO_LINES.forEach((line, index) => assert.equal([...line].length, 65, `riga ${index + 1}`));
  assert.equal(LOGO, LOGO_LINES.join('\n'));
});

test('the "HouseMD" wordmark has 3 lines of the same width', () => {
  assert.equal(WORDMARK_LINES.length, 3);
  WORDMARK_LINES.forEach((line, index) => assert.equal([...line].length, 38, `riga ${index + 1}`));
  assert.ok(WORDMARK_LINES[2].endsWith(' MD'));
  assert.equal(WORDMARK, WORDMARK_LINES.join('\n'));
});

test('invertBraille swaps raised and blank dots, leaving other characters alone', () => {
  assert.equal(invertBraille('⣿⠀⡇⢸'), '⠀⣿⢸⡇');
  assert.equal(invertBraille('a\n⠁ MD'), 'a\n⣾ MD');
  assert.equal(invertBraille(invertBraille(LOGO)), LOGO);
});

test('the inverted logo has the same shape as the logo', () => {
  const lines = LOGO_INVERTED.split('\n');
  assert.equal(lines.length, 33);
  lines.forEach((line, index) => assert.equal([...line].length, 65, `riga ${index + 1}`));
  assert.ok(lines[0].startsWith('⠀⠀⠀'));
});
