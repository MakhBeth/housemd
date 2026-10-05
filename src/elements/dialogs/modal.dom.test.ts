import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { el } from '../../dom/el';
import { openModal } from './modal';

installDialogStub();

test('opens a modal dialog in the body, labelled and light-dismissable, with the children inside', () => {
  const title = el('h2', { id: 'm-title' }, 'Title');
  const { dialog } = openModal({ labelledBy: 'm-title', closedby: 'any' }, title);
  assert.equal(dialog.parentElement, document.body);
  assert.ok(dialog.open);
  assert.equal(dialog.className, 'hmd-dialog');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'm-title');
  assert.equal(dialog.getAttribute('closedby'), 'any');
  assert.equal(dialog.firstElementChild, title);
  dialog.close();
});

test('the variant is an extra class next to hmd-dialog; the id is the one given', () => {
  const { dialog } = openModal({ id: 'm-1', variant: 'access', labelledBy: 'x', closedby: 'none' });
  assert.equal(dialog.className, 'hmd-dialog access');
  assert.equal(dialog.id, 'm-1');
  dialog.close();
});

test('closing resolves with the return value and removes the dialog only after the close event', async () => {
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any' });
  dialog.close('confirm');
  assert.ok(dialog.isConnected, 'si rimuove dopo close: così il browser ripristina il focus');
  assert.equal(await closed, 'confirm');
  assert.equal(dialog.isConnected, false);
});

test('an abort closes the dialog, resolves with an empty value and leaves no listener on the signal', async () => {
  const controller = new AbortController();
  let added = 0;
  let removed = 0;
  const { signal } = controller;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = ((...args: Parameters<typeof add>) => (added++, add(...args))) as typeof add;
  signal.removeEventListener = ((...args: Parameters<typeof remove>) => (removed++, remove(...args))) as typeof remove;

  const first = openModal({ labelledBy: 'x', closedby: 'any', signal });
  first.dialog.close('confirm');
  assert.equal(await first.closed, 'confirm');
  assert.equal(removed, added, 'chiuso normalmente: il listener sul signal è tolto');

  const second = openModal({ labelledBy: 'x', closedby: 'any', signal });
  controller.abort();
  assert.equal(second.dialog.open, false);
  assert.equal(await second.closed, '');
  assert.equal(second.dialog.isConnected, false);
});

test('an abort after close() but before the close event wins: empty value', async () => {
  const controller = new AbortController();
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any', signal: controller.signal });
  dialog.close('confirm');
  controller.abort();
  assert.equal(await closed, '');
});

test('an already aborted signal opens nothing', async () => {
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any', signal: AbortSignal.abort() });
  assert.equal(dialog.isConnected, false);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(await closed, '');
});

test('reopen keeps the dialog open after an unwanted close, but not after an abort', async () => {
  const controller = new AbortController();
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'none', signal: controller.signal, reopen: () => true });
  dialog.close();
  await new Promise((resolve) => setTimeout(resolve));
  assert.ok(dialog.open, 'riaperto');
  assert.ok(dialog.isConnected);
  controller.abort();
  assert.equal(await closed, '');
  assert.equal(dialog.isConnected, false);
});
