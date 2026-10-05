import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showConfirmDialog, showDiscardChangesDialog } from './confirmDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const open = () => showConfirmDialog({ title: 'Delete a.md?', message: 'Gone for good.', confirmLabel: 'Delete', t });
const dialog = () => document.querySelector('dialog')!;
const buttons = () => [...dialog().querySelectorAll('button')];

test('title, message and the two buttons, Cancel first and focused', async () => {
  const result = open();
  const d = dialog();
  const title = d.querySelector('h2')!;
  assert.equal(title.textContent, 'Delete a.md?');
  assert.equal(d.getAttribute('aria-labelledby'), title.id);
  assert.equal(d.getAttribute('closedby'), 'any');
  assert.equal(d.querySelector('p')!.textContent, 'Gone for good.');
  assert.deepEqual(buttons().map((b) => b.textContent), [EN_MESSAGES['dialog.cancel'], 'Delete']);
  assert.equal(document.activeElement, buttons()[0]);
  assert.ok(buttons().every((b) => b.type === 'button'));
  d.close();
  // Si attende la rimozione (dopo l'evento close): altrimenti il dialog resta nel DOM del test successivo.
  await result;
});

test('Cancel closes through commandfor and resolves false', async () => {
  const result = open();
  const cancel = buttons()[0];
  assert.equal(cancel.getAttribute('command'), 'close');
  assert.equal(cancel.getAttribute('commandfor'), dialog().id);
  cancel.click();
  assert.equal(await result, false);
  assert.equal(document.querySelector('dialog'), null);
});

test('the confirm button resolves true', async () => {
  const result = open();
  buttons()[1].click();
  assert.equal(await result, true);
});

test('Esc or a click outside (a close without value) resolves false', async () => {
  const result = open();
  dialog().close();
  assert.equal(await result, false);
});

test('two dialogs open one after the other get different ids', async () => {
  const first = open();
  const firstId = dialog().id;
  buttons()[1].click();
  await first;
  const second = open();
  assert.notEqual(dialog().id, firstId);
  buttons()[0].click();
  await second;
});

test('an abort between the confirm click and the close event resolves false', async () => {
  const controller = new AbortController();
  const result = showConfirmDialog({ title: 'T', message: 'M', confirmLabel: 'OK', t, signal: controller.signal });
  buttons()[1].click();
  controller.abort();
  assert.equal(await result, false);
});

test('an abort resolves false and removes the dialog', async () => {
  const controller = new AbortController();
  const result = showConfirmDialog({ title: 'T', message: 'M', confirmLabel: 'OK', t, signal: controller.signal });
  controller.abort();
  assert.equal(await result, false);
  assert.equal(document.querySelector('dialog'), null);
});

test('the discard-changes confirmation uses the unsaved-changes texts', async () => {
  const result = showDiscardChangesDialog({ t });
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['ai.unsavedTitle']);
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['ai.unsavedMessage']);
  assert.equal(buttons()[1].textContent, EN_MESSAGES['ai.discardChanges']);
  buttons()[1].click();
  assert.equal(await result, true);
});
