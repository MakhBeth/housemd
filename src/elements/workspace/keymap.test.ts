import test from 'node:test';
import assert from 'node:assert/strict';

import { allowedInSettings } from './keymap';

test('with the settings open only the save shortcuts work (Ctrl+S must not open "Save page")', () => {
  assert.equal(allowedInSettings('save'), true);
  assert.equal(allowedInSettings('saveAll'), true);
  for (const s of ['search', 'toggleAi', 'toggleSidebar', 'cycleMode'] as const) assert.equal(allowedInSettings(s), false, s);
});
