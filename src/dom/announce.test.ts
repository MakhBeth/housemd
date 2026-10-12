import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { ANNOUNCE_DELAY_MS, announce } from './announce';

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('without again it is setText: written only when it changes', () => {
  const node = document.createElement('p');
  announce(node, 'a');
  announce(node, 'a');
  assert.equal(node.textContent, 'a');
});

test('again: the same text is cleared now and written back after a real pause, as a new mutation', async () => {
  const node = document.createElement('p');
  node.textContent = 'busy';
  announce(node, 'busy', true);
  assert.equal(node.textContent, '');
  // Un render nel frattempo con lo stesso testo non lo anticipa.
  announce(node, 'busy');
  assert.equal(node.textContent, '');
  // Un fotogramma non basta (lo screen reader vedrebbe le due mutazioni insieme): il testo è ancora vuoto.
  await later(20);
  assert.equal(node.textContent, '');
  await later(ANNOUNCE_DELAY_MS);
  assert.equal(node.textContent, 'busy');
});

test('again: another text (or empty) before the frame wins and cancels the wait', async () => {
  const node = document.createElement('p');
  announce(node, 'busy', true);
  announce(node, '');
  await later(ANNOUNCE_DELAY_MS + 20);
  assert.equal(node.textContent, '');
  announce(node, 'busy', true);
  announce(node, 'other');
  assert.equal(node.textContent, 'other');
  await later(ANNOUNCE_DELAY_MS + 20);
  assert.equal(node.textContent, 'other');
});
