import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showAccessLostDialog } from './accessLostDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const dialog = () => document.querySelector('dialog')!;
const resume = () => dialog().querySelector('button')!;
const tick = () => new Promise((resolve) => setTimeout(resolve));
const errorText = () => [...dialog().querySelectorAll('p')].map((p) => p.textContent).filter((text) => text === EN_MESSAGES['access.denied']);

function open(answers: (boolean | Error)[]) {
  const calls: number[] = [];
  const controller = new AbortController();
  const done = showAccessLostDialog({
    folderName: 'notes',
    t,
    signal: controller.signal,
    onResume: async () => {
      calls.push(calls.length);
      const answer = answers.shift() ?? false;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { done, calls, controller };
}

test('a blocking dialog with the folder name and the resume button', async () => {
  const { done, controller } = open([]);
  const d = dialog();
  assert.equal(d.className, 'hmd-dialog access');
  assert.equal(d.getAttribute('closedby'), 'none');
  assert.equal(d.querySelector('h2')!.textContent, EN_MESSAGES['access.title']);
  assert.equal(d.getAttribute('aria-labelledby'), d.querySelector('h2')!.id);
  assert.equal(d.querySelector('p')!.textContent, t('access.body', { folder: 'notes' }));
  assert.equal(resume().textContent, EN_MESSAGES['access.resume']);
  controller.abort();
  // Si attende la rimozione (dopo l'evento close): altrimenti il dialog resta nel DOM del test successivo.
  await done;
});

test('Esc is ignored (cancel prevented) and an unwanted close reopens it', async () => {
  const { done, controller } = open([]);
  const cancel = new Event('cancel', { cancelable: true });
  dialog().dispatchEvent(cancel);
  assert.ok(cancel.defaultPrevented);
  const d = dialog();
  d.close();
  await tick();
  assert.ok(d.open);
  assert.ok(d.isConnected);
  controller.abort();
  await done;
});

test('denied twice: a single error message; granted: closed, removed, resolved', async () => {
  const { done, calls } = open([false, false, true]);
  resume().click();
  await tick();
  assert.deepEqual(errorText(), [EN_MESSAGES['access.denied']]);
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  resume().click();
  await done;
  assert.equal(calls.length, 3);
  assert.equal(document.querySelector('dialog'), null);
});

test('the error goes away while a new attempt is running', async () => {
  let release!: (granted: boolean) => void;
  const answers: Promise<boolean>[] = [Promise.resolve(false), new Promise((resolve) => (release = resolve))];
  const controller = new AbortController();
  const done = showAccessLostDialog({ folderName: 'notes', t, signal: controller.signal, onResume: () => answers.shift()! });
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  resume().click();
  assert.equal(errorText().length, 0);
  release(false);
  await tick();
  assert.equal(errorText().length, 1);
  controller.abort();
  await done;
});

test('an exception from onResume shows the error instead of breaking', async () => {
  const { done, controller } = open([new Error('boom')]);
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  assert.ok(dialog().open);
  controller.abort();
  await done;
});

test('an abort closes and removes it, and resolves', async () => {
  const { done, controller } = open([]);
  controller.abort();
  await done;
  assert.equal(document.querySelector('dialog'), null);
});
