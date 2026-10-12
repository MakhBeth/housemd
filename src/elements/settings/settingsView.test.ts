import test from 'node:test';
import assert from 'node:assert/strict';

import { commitDelay, commitWidths, currentSection, sectionId, sectionOf, settingsSections, widthText } from './settingsView';

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

test('the current section: the last one whose top is in the upper 40 %, the last one at the end of the scroll', () => {
  // Misure prese nel browser (1280×800) con tutte e quattro le sezioni: in fondo, Sync non arriva in cima.
  const tops = (general: number, profiles: number, presets: number, sync: number) => [
    { section: 'general' as const, top: general },
    { section: 'ai-profiles' as const, top: profiles },
    { section: 'ai-presets' as const, top: presets },
    { section: 'ai-sync' as const, top: sync },
  ];
  const view = (scrollTop: number) => ({ scrollTop, clientHeight: 800, scrollHeight: 1619 });
  assert.equal(currentSection(tops(24, 747, 905, 1128), view(0)), 'general');
  assert.equal(currentSection(tops(-723, 16, 174, 397), view(747)), 'ai-presets', 'presets entra nella fascia alta');
  assert.equal(currentSection(tops(-795, -56, 102, 325), view(819)), 'ai-sync', 'in fondo: l\'ultima');
  assert.equal(currentSection(tops(-795, -56, 102, 325), view(818.5)), 'ai-sync', 'mezzo pixel di arrotondamento');
  assert.equal(currentSection(tops(-300, 400, 560, 780), view(300)), 'general', 'nessun titolo nella fascia: quella sopra');
  assert.equal(currentSection([], view(0)), null);
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
