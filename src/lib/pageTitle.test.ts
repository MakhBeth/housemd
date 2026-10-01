import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_TITLE, pageTitle } from './pageTitle';

test('an open file gives "HMD - name" (without folders)', () => {
  assert.equal(pageTitle({ settings: false, filePath: 'note/idee.md' }, 'Settings'), 'HMD - idee.md');
});

test('settings win over the open file', () => {
  assert.equal(pageTitle({ settings: true, filePath: 'a.md' }, 'Impostazioni'), 'HMD - Impostazioni');
});

test('with nothing open the title stays the app name', () => {
  assert.equal(pageTitle({ settings: false, filePath: null }, 'Settings'), APP_TITLE);
  assert.equal(pageTitle({ settings: false, filePath: undefined }, 'Settings'), APP_TITLE);
  assert.equal(APP_TITLE, 'HouseMD', 'come <title> in index.html');
});
