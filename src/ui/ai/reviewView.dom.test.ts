import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import '../../elements/define';
import type { AiController, AiState } from '../../ai/aiController';
import type { Proposal } from '../../ai/types';
import { createDocSession } from '../../editor/docSession';
import { I18nProvider } from '../../i18n/I18nProvider';
import { EN_MESSAGES } from '../../i18n/messages';
import { installPopoverStub } from '../../testing/popoverStub';
import type { ReviewDoc } from './reviewDoc';
import { ReviewView } from './ReviewView';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const proposal = (path: string, createdAt: number): Proposal => ({ path, baseText: 'A', text: 'A2', origin: 'ai', status: 'truncated', snapshotTaken: false, createdAt });

/** Controller minimo: due proposte troncate, Accetta tutto sempre bloccato da «troncata». */
function fakeController() {
  const state = { chat: { id: 'c', messages: [], overrides: {} }, proposals: new Map([['a.md', proposal('a.md', 1)], ['b.md', proposal('b.md', 2)]]), running: null, streamingPreview: null } as unknown as AiState;
  return {
    subscribe: () => () => {},
    getState: () => state,
    proposalText: (p: Proposal) => p.text,
    acceptBlocker: () => 'truncated',
    canAccept: () => false,
    beforeAccept: () => false,
    discard() {},
    edited() {},
  } as unknown as AiController;
}

const doc = (path: string): ReviewDoc => ({
  path,
  text: 'A',
  resetKey: `${path}#1`,
  session: createDocSession(`${path}#1`, 'A'),
  restore: null,
  readOnly: false,
  getDocs: () => [],
  saveImage: async () => null,
  docChanged() {},
  selectionChanged() {},
});

test('two truncated proposals: the note of a.md does not follow the view to b.md', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const controller = fakeController();
  const render = (path: string) =>
    flushSync(() => root.render(createElement(I18nProvider, { initialLocale: 'en', initialMessages: EN_MESSAGES, children: createElement(ReviewView, { controller, editor: doc(path) }) })));
  render('a.md');
  const bar = host.querySelector('hmd-ai-review-bar')!;
  const note = () => bar.querySelector<HTMLParagraphElement>(':scope > [role="status"]')!;
  [...bar.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.acceptAll'])!.click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  render('b.md');
  assert.equal(host.querySelector('hmd-ai-review-bar'), bar, 'React reuses the same element');
  assert.equal(note().textContent, '');
  flushSync(() => root.unmount());
});
