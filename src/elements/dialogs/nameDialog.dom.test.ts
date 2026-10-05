import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showNameDialog, type NameOptions } from './nameDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const open = (options: Partial<NameOptions> = {}) =>
  showNameDialog({ title: 'New file', kind: 'file', initial: '', confirmLabel: 'Create', validate: () => null, t, ...options });
const dialog = () => document.querySelector('dialog')!;
const input = () => dialog().querySelector('input')!;
const submit = () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!;
const cancel = () => dialog().querySelector<HTMLButtonElement>('button[type="button"]')!;
const type = (value: string) => {
  input().value = value;
  input().dispatchEvent(new Event('input', { bubbles: true }));
};

test('a form with the title, the focused input and Cancel / confirm', async () => {
  // Si tiene la promise e la si attende dopo close(): la rimozione avviene dopo l'evento close.
  const result = open({ initial: 'a.md' });
  const d = dialog();
  const form = d.querySelector('form')!;
  assert.equal(form.parentElement, d);
  const title = form.querySelector('h2')!;
  assert.equal(title.textContent, 'New file');
  assert.equal(d.getAttribute('aria-labelledby'), title.id);
  assert.equal(input().value, 'a.md');
  assert.equal(document.activeElement, input());
  assert.equal(input().spellcheck, false);
  assert.equal(input().autocomplete, 'off');
  assert.equal(input().getAttribute('aria-invalid'), 'false');
  assert.equal(input().hasAttribute('aria-describedby'), false);
  assert.deepEqual([cancel().textContent, submit().textContent], [EN_MESSAGES['dialog.cancel'], 'Create']);
  d.close();
  await result;
});

test('a file selects the name without the extension; a folder or a dot file selects everything', async () => {
  for (const [kind, initial, end] of [['file', 'note.md', 4], ['file', 'README', 6], ['file', '.env', 4], ['directory', 'docs.v2', 7]] as const) {
    const result = open({ kind, initial });
    assert.deepEqual([input().selectionStart, input().selectionEnd], [0, end], `${kind} ${initial}`);
    dialog().close();
    await result;
  }
});

test('an invalid name shows the error, marks the input and keeps the dialog open; typing clears it', async () => {
  const result = open(); // si attende dopo close() (rimozione asincrona)
  const field = input();
  type('  ');
  submit().click();
  const error = dialog().querySelector('p')!;
  assert.equal(error.textContent, EN_MESSAGES['name.error.empty']);
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(field.getAttribute('aria-describedby'), error.id);
  assert.ok(dialog().open);
  // L'errore sta tra l'input e i pulsanti, come in NameDialog.tsx.
  assert.equal(field.nextElementSibling, error);

  type('ok');
  assert.equal(dialog().querySelector('p'), null);
  assert.equal(field.getAttribute('aria-invalid'), 'false');
  assert.equal(field.hasAttribute('aria-describedby'), false);
  assert.equal(input(), field, 'stesso nodo: il focus non si perde');
  dialog().close();
  await result;
});

test('two errors in a row leave a single message', async () => {
  const result = open(); // si attende dopo close() (rimozione asincrona)
  type('a/b');
  submit().click();
  type('.x');
  submit().click();
  const errors = dialog().querySelectorAll('p');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].textContent, EN_MESSAGES['name.error.dot']);
  dialog().close();
  await result;
});

test('validate receives the normalized name; its message is shown as is', async () => {
  const seen: string[] = [];
  const result = open({ validate: (name) => (seen.push(name), 'Taken!') }); // si attende dopo close()
  type(' note ');
  submit().click();
  assert.deepEqual(seen, ['note.md']);
  assert.equal(dialog().querySelector('p')!.textContent, 'Taken!');
  dialog().close();
  await result;
});

test('a valid name resolves with the normalized name and removes the dialog', async () => {
  const result = open({ kind: 'directory' });
  type(' drafts ');
  submit().click();
  assert.equal(await result, 'drafts');
  assert.equal(document.querySelector('dialog'), null);
});

test('an abort between the submit and the close event discards the name', async () => {
  const controller = new AbortController();
  const result = open({ signal: controller.signal });
  type('late');
  submit().click();
  controller.abort();
  assert.equal(await result, null);
  assert.equal(document.querySelector('dialog'), null);
});

test('Cancel, a light dismiss and an abort resolve null', async () => {
  let result = open();
  cancel().click();
  assert.equal(await result, null);

  result = open();
  dialog().close();
  assert.equal(await result, null);

  const controller = new AbortController();
  result = open({ signal: controller.signal });
  controller.abort();
  assert.equal(await result, null);
  assert.equal(document.querySelector('dialog'), null);
});
