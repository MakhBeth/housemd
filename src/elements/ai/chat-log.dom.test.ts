import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { ChatMessage } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { waitFor } from '../../testing/waitFor';

// jsdom non ha requestAnimationFrame: coda a mano, svuotata dal test.
const frames = new Map<number, FrameRequestCallback>();
let lastFrame = 0;
Object.assign(globalThis, {
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    frames.set(++lastFrame, callback);
    return lastFrame;
  },
  cancelAnimationFrame: (id: number) => void frames.delete(id),
});
const flushFrames = () => {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback(0);
  }
};

const msg = (patch: Partial<ChatMessage>): ChatMessage => ({ id: 'm', role: 'assistant', text: '', docPath: null, status: 'done', ...patch });

function mount(messages: ChatMessage[]) {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.retry': 'RIPROVA', 'ai.working': 'IN CORSO' } }),
    persist() {},
  });
  const el = document.createElement('hmd-ai-chat-log');
  el.messages = messages;
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n, log: () => el.querySelector<HTMLDivElement>('[role="log"]')!, articles: () => [...el.querySelectorAll('article')] };
}

test('the tree of ChatLog.tsx: a log of focusable articles, user text as text, meta under replies', async () => {
  const { el, log, articles } = mount([
    msg({ id: 'u', role: 'user', text: '<b>keep</b>', docPath: 'a.md' }),
    msg({ id: 'a', text: 'Some **bold**', docPath: 'a.md', profileName: 'ollama', model: 'qwen' }),
  ]);
  assert.equal(log().className, 'log');
  const [user, reply] = articles();
  assert.deepEqual([user.className, user.tabIndex], ['message', 0]);
  assert.deepEqual([...user.children].map((c) => [c.localName, c.className, c.textContent]), [
    ['button', 'file', 'a.md'], ['p', 'user', '<b>keep</b>'],
  ]);
  assert.equal(user.querySelector('b'), null);
  assert.deepEqual([...reply.children].map((c) => [c.localName, c.className]), [['div', 'assistant'], ['small', 'meta']]);
  assert.equal(reply.querySelector('.meta')!.textContent, 'ollama · qwen');
  flushFrames();
  await waitFor(() => reply.querySelector('strong') !== null);
  assert.equal(reply.querySelector('.assistant > div strong')!.textContent, 'bold');
  el.remove();
});

test('model output never becomes live HTML or a remote image', async () => {
  const { el, articles } = mount([
    msg({ id: 'a', text: '![x](http://evil.test/i.png) <img src="http://evil.test/raw" onerror="alert(1)"><iframe src="http://evil.test/f"></iframe>' }),
  ]);
  flushFrames();
  const body = articles()[0].querySelector('.assistant > div')!;
  await waitFor(() => body.childElementCount > 0);
  assert.equal(body.querySelector('img, iframe'), null);
  assert.match(body.textContent!, /evil\.test/);
  el.remove();
});

test('the document button opens it; Retry and Reset · Retry send hmd-ai-retry', () => {
  const { el, articles } = mount([msg({ id: 'a', docPath: 'a.md', status: 'error', error: 'paramRejected' })]);
  const sent: unknown[] = [];
  el.addEventListener('hmd-ai-open-file', (event) => sent.push(['open', event.detail.path]));
  el.addEventListener('hmd-ai-retry', (event) => sent.push(['retry', event.detail]));
  const buttons = [...articles()[0].querySelectorAll('button')];
  assert.deepEqual(buttons.map((b) => [b.type, b.className, b.textContent]), [
    ['button', 'file', 'a.md'],
    ['button', 'file', EN_MESSAGES['ai.retry']],
    ['button', 'file', `${EN_MESSAGES['ai.reset']} · ${EN_MESSAGES['ai.retry']}`],
  ]);
  for (const b of buttons) b.click();
  assert.deepEqual(sent, [['open', 'a.md'], ['retry', { id: 'a', removeRejected: false }], ['retry', { id: 'a', removeRejected: true }]]);
  el.remove();
});

test('updates reuse articles and buttons; streaming renders only the latest text', async () => {
  const failed = msg({ id: 'a', status: 'error', error: 'server' });
  const { el, articles } = mount([failed]);
  // Anche la risposta fallita (testo vuoto → «Working…») ha il suo fotogramma: lo si rende subito.
  flushFrames();
  const article = articles()[0];
  const retry = article.querySelector('button')!;
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'one' })];
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'two' })];
  assert.equal(articles()[0], article);
  assert.equal(article.querySelector('button'), retry);
  assert.equal(frames.size, 1);
  flushFrames();
  await waitFor(() => articles()[1].textContent!.includes('two'));
  assert.ok(!articles()[1].textContent!.includes('one'));
  el.remove();
});

test('a language change relabels in place; detached, pending frames are cancelled', async () => {
  const failed = msg({ id: 'a', status: 'error', error: 'server' });
  const { el, i18n, articles } = mount([failed, msg({ id: 'b', status: 'streaming' })]);
  const retry = articles()[0].querySelector('button')!;
  flushFrames();
  await i18n.setLocale('it');
  assert.equal(articles()[0].querySelector('button'), retry);
  assert.equal(retry.textContent, 'RIPROVA');
  flushFrames();
  await waitFor(() => articles()[1].textContent!.includes('IN CORSO'));
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'later' })];
  assert.equal(frames.size, 1);
  el.remove();
  assert.equal(frames.size, 0);
  // Staccato non ascolta più la lingua.
  await i18n.setLocale('en');
  assert.equal(retry.textContent, 'RIPROVA');
});
