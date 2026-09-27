import test from 'node:test';
import assert from 'node:assert/strict';

import { unsupportedMessage } from './access';

test('unsupportedMessage explains the limitation per browser', () => {
  assert.match(unsupportedMessage('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'), /iOS/);
  assert.match(unsupportedMessage('Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17 Safari/605.1.15'), /Safari/);
  assert.match(unsupportedMessage('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), /Firefox/);
  assert.match(unsupportedMessage('Qualcosa'), /Chrome o Edge/);
});
