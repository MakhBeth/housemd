import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { ChatProvider, ModelOption, ModelProfile } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { HmdEvents } from '../events';
import { CUSTOM, type ModelSelectController } from './modelSelectView';

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Controller finto: ogni richiesta dell'elenco resta in attesa finché il test non risponde. */
function fakeController() {
  const requests: { profile: ModelProfile; signal: AbortSignal; answer(list: ModelOption[] | null): void; fail(error: unknown): void }[] = [];
  const reports: unknown[] = [];
  const controller = {
    async provider(profile: ModelProfile) {
      return {
        listModels: (signal: AbortSignal) =>
          new Promise<ModelOption[] | null>((resolve, reject) => requests.push({ profile, signal, answer: resolve, fail: reject })),
      } as unknown as ChatProvider;
    },
    report: (error: unknown) => void reports.push(error),
  } as unknown as ModelSelectController;
  return { controller, requests, reports };
}

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus; jsdom no: qui lo si
 * manda a mano dentro `remove()`, cioè nel mezzo di un render.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    // Come Chromium: solo se il nodo è nel documento e contiene il focus (un nodo già tolto non manda nulla).
    if (this.isConnected && this.contains(document.activeElement)) this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

const PROFILE: ModelProfile = { ...defaultProfile('ollama', 'p'), secretId: 'secret-id-1' };

async function mount(profile: ModelProfile = PROFILE) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.model': 'MODELLO', 'ai.refresh': 'AGGIORNA' } }),
      persist() {},
    }),
  );
  const fake = fakeController();
  const el = document.createElement('hmd-ai-model-select');
  el.controller = fake.controller;
  el.profile = profile;
  el.i18n = i18n;
  document.body.append(el);
  const changes: HmdEvents['hmd-ai-model-change']['detail'][] = [];
  el.addEventListener('hmd-ai-model-change', (event) => changes.push(event.detail));
  await tick();
  const select = () => el.querySelector('select')!;
  const field = () => el.querySelector<HTMLInputElement>('input');
  const values = () => [...select().options].map((o) => o.value);
  const choose = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event('change', { bubbles: true }));
  };
  const type = (value: string) => {
    field()!.value = value;
    field()!.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { el, i18n, listeners, ...fake, changes, select, field, values, choose, type };
}

test('the same DOM as ModelSelect.tsx: a section with the labelled select and Refresh; no free field, no error', async () => {
  const { el, select, field } = await mount();
  const section = el.querySelector('div')!;
  assert.equal(section.className, 'section');
  assert.deepEqual([...section.children].map((c) => c.localName), ['label', 'button']);
  assert.equal(section.querySelector('label > span')!.textContent, EN_MESSAGES['ai.model']);
  assert.equal(select().parentElement!.localName, 'label');
  const refresh = section.querySelector('button')!;
  assert.equal(refresh.className, 'link');
  assert.equal(refresh.type, 'button');
  assert.equal(refresh.textContent, EN_MESSAGES['ai.refresh']);
  assert.equal(field(), null);
  assert.equal(select().value, PROFILE.model);
});

test('the list is asked once at connection, through the controller, and the options follow the answer', async () => {
  const { requests, values, select } = await mount();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].profile, PROFILE);
  assert.deepEqual(values(), ['', 'qwen3.6:35b-mlx', 'qwen3:8b', 'llama3.2', CUSTOM]);
  requests[0].answer([{ value: 'qwen3.6:35b-mlx', label: 'qwen3.6:35b-mlx' }, { value: 'big:70b', label: 'big:70b', contextTokens: 8192 }]);
  await tick();
  assert.deepEqual(values(), ['', 'qwen3.6:35b-mlx', 'big:70b', CUSTOM]);
  assert.equal(select().options[0].textContent, EN_MESSAGES['ai.chooseModel']);
  assert.equal(select().options[3].textContent, EN_MESSAGES['ai.other']);
  assert.equal(select().value, 'qwen3.6:35b-mlx');
});

test('choosing a model sends hmd-ai-model-change, with the context of the listed model', async () => {
  const { requests, choose, changes } = await mount();
  requests[0].answer([{ value: 'big:70b', label: 'big:70b', contextTokens: 8192 }]);
  await tick();
  choose('big:70b');
  assert.deepEqual(changes, [{ selection: { model: 'big:70b', contextTokens: 8192 } }]);
});

test('the select is not written back while the parent has not applied the choice yet', async () => {
  const { el, choose, select, i18n } = await mount();
  choose('qwen3:8b');
  // Un render qualsiasi (la lingua) prima che arrivi il profilo nuovo: la scelta dell'utente resta.
  await i18n.setLocale('it');
  assert.equal(select().value, 'qwen3:8b');
  el.profile = { ...PROFILE, model: 'qwen3:8b' };
  assert.equal(select().value, 'qwen3:8b');
  el.profile = { ...PROFILE, model: 'llama3.2' };
  assert.equal(select().value, 'llama3.2');
});

test('Other… opens the free field with the model; every value typed is sent; a late echo does not rewrite the focused field', async () => {
  const { el, choose, field, type, changes, select } = await mount();
  choose(CUSTOM);
  assert.equal(changes.length, 0);
  assert.equal(select().value, CUSTOM);
  assert.equal(field()!.value, PROFILE.model);
  assert.equal(field()!.getAttribute('aria-label'), EN_MESSAGES['ai.model']);
  assert.equal(field()!.previousElementSibling!.localName, 'label');
  field()!.focus();
  type('m');
  type('my');
  assert.deepEqual(changes.map((c) => c.selection.model), ['m', 'my']);
  el.profile = { ...PROFILE, model: 'm' };
  assert.equal(field()!.value, 'my');
  el.profile = { ...PROFILE, model: 'my' };
  assert.equal(field()!.value, 'my');
  assert.equal(document.activeElement, field());
});

test('without the focus the free field follows the model; leaving Other… removes it, opening it again starts from the model', async () => {
  const { el, choose, field } = await mount();
  choose(CUSTOM);
  el.profile = { ...PROFILE, model: 'from-outside' };
  assert.equal(field()!.value, 'from-outside');
  choose('qwen3:8b');
  assert.equal(field(), null);
  el.profile = { ...PROFILE, model: 'qwen3:8b' };
  choose(CUSTOM);
  assert.equal(field()!.value, 'qwen3:8b');
});

test('a model changed outside while the free field has the focus shows up when the focus leaves', async () => {
  const { el, choose, field } = await mount();
  choose(CUSTOM);
  field()!.focus();
  el.profile = { ...PROFILE, model: 'from-sync' };
  assert.equal(field()!.value, PROFILE.model);
  field()!.blur();
  assert.equal(field()!.value, 'from-sync');
});

test('the focused free field removed by a choice: the synchronous focusout asks one more pass, never a nested one', async () => {
  const { el, choose, field, select } = await mount();
  choose(CUSTOM);
  const input = field()!;
  input.focus();
  focusoutOnRemove(input);
  let nested = 0;
  el.addEventListener('focusout', () => {
    // Un listener che cambia il profilo mentre il campo viene tolto: il render riparte dopo, non dentro.
    if (nested++ === 0) el.profile = { ...PROFILE, model: 'llama3.2' };
  });
  choose('qwen3:8b');
  assert.equal(field(), null);
  assert.equal(el.querySelectorAll('input').length, 0);
  assert.equal(select().value, 'llama3.2');
});

test('the list is asked again only for another provider kind, address or saved key, or with Refresh', async () => {
  const { el, requests } = await mount();
  el.profile = { ...PROFILE, model: 'qwen3:8b', name: 'renamed' };
  assert.equal(requests.length, 1);
  el.profile = { ...PROFILE, baseUrl: 'http://localhost:1234' };
  await tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  assert.equal(requests.length, 3);
  assert.equal(requests[1].signal.aborted, true);
});

test('an unreachable server (null) shows the error under Refresh; asking again hides it', async () => {
  const { el, requests } = await mount();
  requests[0].answer(null);
  await tick();
  const error = () => el.querySelector('small');
  assert.equal(error()!.textContent, EN_MESSAGES['ai.error.unreachable']);
  assert.equal(error()!.previousElementSibling!.localName, 'button');
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  assert.equal(error(), null);
});

test('a failure is reported to the controller and shown as unreachable', async () => {
  const { el, requests, reports } = await mount();
  const failure = { code: 'unauthorized' };
  requests[0].fail(failure);
  await tick();
  assert.deepEqual(reports, [failure]);
  assert.equal(el.querySelector('small')!.textContent, EN_MESSAGES['ai.error.unreachable']);
});

test('an answer superseded by a newer request is discarded', async () => {
  const { el, requests, values } = await mount();
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  requests[0].answer([{ value: 'old', label: 'old' }]);
  await tick();
  assert.ok(!values().includes('old'));
  requests[1].answer([{ value: 'new', label: 'new' }]);
  await tick();
  assert.ok(values().includes('new'));
});

test('detached, the request is aborted and its answer discarded; attached again, the list is asked again', async () => {
  const { el, requests, reports, values } = await mount();
  el.remove();
  assert.equal(requests[0].signal.aborted, true);
  requests[0].answer([{ value: 'late', label: 'late' }]);
  await tick();
  assert.deepEqual(reports, []);
  document.body.append(el);
  await tick();
  assert.equal(requests.length, 2);
  assert.ok(!values().includes('late'));
});

test('a failure after detaching is not reported and shows no error', async () => {
  const { el, requests, reports } = await mount();
  el.remove();
  requests[0].fail({ code: 'server' });
  await tick();
  assert.deepEqual(reports, []);
  assert.equal(el.querySelector('small'), null);
});

test('a failure of a superseded request is not reported and shows no error', async () => {
  const { el, requests, reports } = await mount();
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  assert.equal(requests[0].signal.aborted, true);
  requests[0].fail({ code: 'server' });
  await tick();
  assert.deepEqual(reports, []);
  assert.equal(el.querySelector('small'), null);
  assert.equal(requests[1].signal.aborted, false);
});

test('the saved key id and the address never reach the DOM', async () => {
  const { el, choose } = await mount({ ...PROFILE, baseUrl: 'http://secret-host.example:11434' });
  choose(CUSTOM);
  assert.ok(!el.outerHTML.includes('secret-id-1'));
  assert.ok(!el.outerHTML.includes('secret-host'));
});

test('language change relabels without asking the list again; detached, no listener left', async () => {
  const { el, i18n, listeners, requests } = await mount();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('label > span')!.textContent, 'MODELLO');
  assert.equal(el.querySelector('button')!.textContent, 'AGGIORNA');
  assert.equal(requests.length, 1);
  el.remove();
  assert.equal(listeners(), 0);
});
