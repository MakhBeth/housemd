import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { ChatMessage, PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { emit } from '../events';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const PRESET = { id: 'p1', name: 'Fix it', order: 0, hidden: false } as unknown as PromptPreset;
const MESSAGE: ChatMessage = { id: 'm1', role: 'user', text: 'fix', docPath: 'a.md', status: 'done' };

function mount() {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.title': 'IA', 'ai.newChat': 'NUOVA' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ presets: [PRESET] }, defaultProfile('ollama', 'o'));
  const el = document.createElement('hmd-ai-sidebar');
  el.controller = ai;
  el.text = 'uno\ndue';
  el.selection = { from: 0, to: 3 };
  el.getSelection = () => undefined;
  el.syncNeedsPermission = false;
  el.i18n = i18n;
  document.body.append(el);
  let reactivate = 0;
  el.addEventListener('hmd-ai-sync-reactivate', () => reactivate++);
  const newChat = () => el.querySelector<HTMLButtonElement>('.header button')!;
  return { el, ai, i18n, listeners, newChat, reactivations: () => reactivate };
}

test('the same DOM as AiSidebar.tsx: header, chat log, bottom with composer and suggestions', () => {
  const { el, newChat } = mount();
  const root = el.firstElementChild!;
  assert.equal(root.className, 'sidebar');
  assert.deepEqual([...root.children].map((c) => c.localName), ['div', 'hmd-ai-chat-log', 'div']);
  const header = root.firstElementChild!;
  assert.equal(header.className, 'header');
  assert.equal(header.querySelector('h2')!.className, 'title');
  assert.equal(header.querySelector('h2')!.textContent, EN_MESSAGES['ai.title']);
  assert.equal(newChat().className, 'iconButton tooltip');
  assert.equal(newChat().getAttribute('aria-label'), EN_MESSAGES['ai.newChat']);
  assert.equal(newChat().getAttribute('data-tooltip'), EN_MESSAGES['ai.newChat']);
  const bottom = root.lastElementChild!;
  assert.equal(bottom.className, 'bottom');
  assert.deepEqual([...bottom.children].map((c) => c.localName), ['hmd-ai-composer', 'hmd-ai-suggestions']);
});

test('inputs reach the children: messages to the log, text, selection and controller to the composer', () => {
  const { el, ai } = mount();
  const composer = el.querySelector('hmd-ai-composer')!;
  assert.equal(composer.controller, ai);
  assert.equal(composer.text, 'uno\ndue');
  assert.deepEqual(composer.selection, { from: 0, to: 3 });
  assert.equal(composer.getSelection, el.getSelection);
  el.text = 'tre';
  assert.equal(composer.text, 'tre');
  ai.set({ chat: { id: 'c', messages: [MESSAGE], overrides: {} } } as Partial<AiState>);
  assert.deepEqual(el.querySelector('hmd-ai-chat-log')!.messages, [MESSAGE]);
});

test('New chat: disabled with an empty chat and nothing running, otherwise it starts a new chat', () => {
  const { ai, newChat } = mount();
  assert.equal(newChat().disabled, true);
  ai.set({ running: { messageId: 'm', path: 'a.md', startedAt: 0 } } as Partial<AiState>);
  assert.equal(newChat().disabled, false);
  ai.set({ running: null, chat: { id: 'c', messages: [MESSAGE], overrides: {} } } as Partial<AiState>);
  assert.equal(newChat().disabled, false);
  newChat().click();
  assert.deepEqual(ai.calls, [['newChat']]);
});

test('the chat log opens a file and retries through the controller', () => {
  const { el, ai } = mount();
  const log = el.querySelector('hmd-ai-chat-log')!;
  log.dispatchEvent(new CustomEvent('hmd-ai-open-file', { detail: { path: 'b.md' }, bubbles: true }));
  log.dispatchEvent(new CustomEvent('hmd-ai-retry', { detail: { id: 'm1', removeRejected: true }, bubbles: true }));
  assert.deepEqual(ai.calls, [['openFile', 'b.md'], ['retry', 'm1', true]]);
});

test('a suggestion sends its preset through the composer', () => {
  const { el, ai } = mount();
  el.querySelector('hmd-ai-suggestions')!.querySelector<HTMLButtonElement>('button')!.click();
  // La selezione c'è ma la sessione non ha più lo scope: scopeLost, come con l'invio di un testo.
  assert.deepEqual(ai.reports, [{ code: 'scopeLost' }]);
  el.selection = null;
  el.querySelector('hmd-ai-suggestions')!.querySelector<HTMLButtonElement>('button')!.click();
  assert.deepEqual(ai.calls, [['send', 'Fix it', PRESET, undefined]]);
});

test('the sync button: only when the permission is missing, first in the bottom; it sends hmd-ai-sync-reactivate', () => {
  const { el, reactivations } = mount();
  assert.equal(el.querySelector('button.file'), null);
  el.syncNeedsPermission = true;
  const sync = el.querySelector<HTMLButtonElement>('button.file')!;
  assert.equal(sync.textContent, `⚠ ${EN_MESSAGES['ai.syncReactivate']}`);
  assert.equal(sync.parentElement!.firstElementChild, sync);
  sync.click();
  assert.equal(reactivations(), 1);
  el.syncNeedsPermission = false;
  assert.equal(el.querySelector('button.file'), null);
});

test('language change relabels; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, newChat } = mount();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('h2')!.textContent, 'IA');
  assert.equal(newChat().getAttribute('aria-label'), 'NUOVA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});

test('the messages reach the log only when they change, not on every notification', () => {
  const { el, ai } = mount();
  const log = el.querySelector('hmd-ai-chat-log')!;
  const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(log), 'messages')!;
  let assigned = 0;
  Object.defineProperty(log, 'messages', {
    configurable: true,
    get: () => proto.get!.call(log),
    set: (value) => { assigned++; proto.set!.call(log, value); },
  });
  ai.set({ running: { messageId: 'm', path: 'a.md', startedAt: 0 } } as Partial<AiState>);
  ai.set({ running: null } as Partial<AiState>);
  assert.equal(assigned, 0);
  ai.set({ chat: { id: 'c', messages: [MESSAGE], overrides: {} } } as Partial<AiState>);
  assert.equal(assigned, 1);
});

test('swapping controller and i18n while connected moves the children and releases the old subscriptions', () => {
  const { el, ai, listeners } = mount();
  const ai2 = fakeAi({ presets: [PRESET] }, defaultProfile('ollama', 'o'));
  const { store: i18n2, listeners: listeners2 } = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} }),
  );
  el.controller = ai2;
  el.i18n = i18n2;
  for (const child of [el.querySelector('hmd-ai-chat-log'), el.querySelector('hmd-ai-composer'), el.querySelector('hmd-ai-suggestions')] as Array<Element & { controller?: unknown; i18n: unknown }>) {
    assert.equal(child.i18n, i18n2);
    if ('controller' in child) assert.equal(child.controller, ai2);
  }
  assert.equal(ai.listeners(), 0);
  assert.equal(listeners(), 0);
  assert.ok(ai2.listeners() > 0);
  assert.ok(listeners2() > 0);
});

test('hmd-ai-manage from the composer bubbles to the host exactly once', () => {
  const { el } = mount();
  let manage = 0;
  el.addEventListener('hmd-ai-manage', () => manage++);
  emit(el.querySelector('hmd-ai-composer')!, 'hmd-ai-manage', null);
  assert.equal(manage, 1);
});
