import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { focusSourceTracker, installFocusSource } from './focusSource';

test('a focus right after a pointer press comes from the pointer', () => {
  const tracker = focusSourceTracker();
  tracker.pointerDown();
  assert.equal(tracker.focusIn(), 'pointer');
});

test('a focus with no pointer press before it comes from the keyboard (Tab, shortcuts)', () => {
  const tracker = focusSourceTracker();
  assert.equal(tracker.focusIn(), 'keyboard');
  tracker.pointerDown();
  tracker.keyDown();
  assert.equal(tracker.focusIn(), 'keyboard');
});

test('installFocusSource writes the source of each focus on <html>, typing does not change it', () => {
  const { window } = new JSDOM('<!doctype html><input id="a"><input id="b">');
  const { document } = window;
  const dispose = installFocusSource(document);
  const [a, b] = [document.getElementById('a')!, document.getElementById('b')!];

  a.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  a.focus();
  assert.equal(document.documentElement.dataset.focusSource, 'pointer');

  // Scrivere nel campo non è navigazione: il focus resta "da puntatore".
  a.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  assert.equal(document.documentElement.dataset.focusSource, 'pointer');

  // Tab sposta il focus: ora viene dalla tastiera.
  a.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  b.focus();
  assert.equal(document.documentElement.dataset.focusSource, 'keyboard');

  dispose();
  b.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  a.focus();
  assert.equal(document.documentElement.dataset.focusSource, 'keyboard', 'dopo dispose nessun listener resta attivo');
});
