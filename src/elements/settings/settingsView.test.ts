import test from 'node:test';
import assert from 'node:assert/strict';

import { commitDelay, commitWidths, sectionId, sectionOf, settingsSections, topSection, widthText } from './settingsView';

test('without the AI controller only the general section is shown, with it all four in order', () => {
  assert.deepEqual(settingsSections(false), ['general']);
  assert.deepEqual(settingsSections(true), ['general', 'ai-profiles', 'ai-presets', 'ai-sync']);
});

test('section ids go both ways; an unknown or hidden section is null', () => {
  assert.equal(sectionId('ai-sync'), 'settings-ai-sync');
  assert.equal(sectionOf('settings-ai-sync', settingsSections(true)), 'ai-sync');
  assert.equal(sectionOf('settings-ai-sync', settingsSections(false)), null);
  assert.equal(sectionOf('settings-nope', settingsSections(true)), null);
});

test('the index follows the topmost intersecting section; none intersecting leaves it alone', () => {
  const sections = settingsSections(true);
  const entries = [
    { id: 'settings-ai-presets', top: 300, intersecting: true },
    { id: 'settings-general', top: -900, intersecting: false },
    { id: 'settings-ai-profiles', top: 20, intersecting: true },
  ];
  assert.equal(topSection(entries, sections), 'ai-profiles');
  assert.equal(topSection([{ id: 'settings-general', top: 0, intersecting: false }], sections), null);
});

test('text widths: an empty field is no limit, values are clamped, unchanged widths give no update', () => {
  assert.equal(widthText({ editor: null, preview: 72 }, 'editor'), '');
  assert.equal(widthText({ editor: null, preview: 72 }, 'preview'), '72');
  assert.deepEqual(commitWidths({ editor: '10', preview: '' }, { editor: null, preview: 72 }), {
    texts: { editor: '30', preview: '' },
    next: { editor: 30, preview: null },
  });
  assert.deepEqual(commitWidths({ editor: '', preview: '72' }, { editor: null, preview: 72 }), { texts: { editor: '', preview: '72' }, next: null });
});

test('the autosave delay is clamped; the same delay gives no update', () => {
  const autosave = { mode: 'afterDelay' as const, delayMs: 1000 };
  assert.deepEqual(commitDelay('50', autosave), { text: '500', next: { mode: 'afterDelay', delayMs: 500 } });
  assert.deepEqual(commitDelay('1000', autosave), { text: '1000', next: null });
  // Non numerico → il default (1000): uguale a quello di adesso, nessun aggiornamento. Vuoto = 0 → il minimo.
  assert.deepEqual(commitDelay('abc', autosave), { text: '1000', next: null });
  assert.deepEqual(commitDelay('', autosave), { text: '500', next: { mode: 'afterDelay', delayMs: 500 } });
});
