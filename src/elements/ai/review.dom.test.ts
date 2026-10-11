import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import type { ChatMessage, Proposal } from '../../ai/types';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import type { ReviewDoc } from './reviewView';

installPopoverStub();
installDialogStub();

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Il focus è su `node`. Mai `assert.equal` tra nodi di jsdom: il messaggio del RED (util.inspect dell'albero) non finisce più. */
const focusOn = (node: Element | null | undefined, what: string) => assert.ok(!!node && document.activeElement === node, `focus on ${what}, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);
const ORIGINAL = 'A\n\nB\n\nC';
const proposal = (extra: Partial<Proposal> = {}): Proposal => ({ path: 'a.md', baseText: ORIGINAL, text: 'A2\n\nB\n\nC2', origin: 'ai', status: 'complete', snapshotTaken: false, createdAt: 1, ...extra });

function mount(initial: Partial<AiState> = {}, docExtra: Partial<ReviewDoc> = {}) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.emptyProposal': 'SCRIVI', 'ai.discard': 'SCARTA' } }),
      persist() {},
    }),
  );
  const ai = fakeAi(initial);
  const changes: unknown[] = [];
  const selections: unknown[] = [];
  const doc: ReviewDoc = {
    path: 'a.md',
    text: ORIGINAL,
    resetKey: 'a.md#1',
    session: createDocSession('a.md#1', ORIGINAL),
    restore: null,
    readOnly: false,
    getDocs: () => [],
    saveImage: async () => null,
    docChanged: (c, texts) => changes.push([c, texts]),
    selectionChanged: (range) => selections.push(range),
    ...docExtra,
  };
  const el = document.createElement('hmd-ai-review');
  el.controller = ai;
  el.doc = doc;
  el.i18n = i18n;
  document.body.append(el);
  const section = () => el.firstElementChild as HTMLElement;
  const children = () => [...section().children].map((c) => `${c.localName}${c.className ? '.' + c.className : ''}`);
  const bar = () => el.querySelector('hmd-ai-review-bar')!;
  const editor = () => el.querySelector('hmd-editor')!;
  const diff = () => el.querySelector('hmd-ai-diff-pane')!;
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('hmd-ai-review-bar button')].find((b) => b.textContent === label)!;
  const docSide = () => el.querySelector<HTMLElement>('.cm-mergeView .cm-content')!;
  return { el, ai, i18n, listeners, doc, changes, selections, section, children, bar, editor, diff, button, docSide };
}

test('without a proposal: the same DOM as ReviewView.tsx, hint and plain editor with the document; no bar', () => {
  const { el, children, editor, section } = mount();
  assert.equal(section().className, 'review');
  assert.deepEqual(children(), ['p.hint', 'div.editor']);
  assert.equal(section().querySelector('.hint')!.textContent, EN_MESSAGES['ai.emptyProposal']);
  assert.equal(editor().parentElement!.className, 'editor');
  assert.equal(editor().text, ORIGINAL);
  assert.equal(editor().resetKey, 'a.md#1');
  assert.equal(editor().i18n, el.i18n);
  assert.equal(el.querySelector('.cm-content')!.textContent, ORIGINAL.replaceAll('\n', ''));
});

test('generating on this document without a proposal: the bar with the counter replaces the hint, everything off', () => {
  const { children, bar, ai } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() - 3000 } });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'div.editor']);
  assert.equal(bar().status.kind, 'generating');
  assert.equal((bar().status as { seconds: number }).seconds, 3);
  assert.equal(bar().acceptBlocker, 'generating');
  assert.equal(bar().proposalId, '');
  assert.equal(bar().querySelector('.status')!.textContent, EN_MESSAGES['ai.generating'].replace('{seconds}', '3'));
  ai.set({ running: null });
  assert.deepEqual(children(), ['p.hint', 'div.editor']);
});

test('with a proposal: the bar and the diff with the proposal, the warnings of the last reply, the flags from the controller', async () => {
  const messages: ChatMessage[] = [{ id: '1', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings: [{ code: 'wikilinks' }] }];
  const { children, bar, diff, ai } = mount({ proposals: new Map([['a.md', proposal()]]), chat: { id: 'c', messages, overrides: {} } });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'hmd-ai-diff-pane']);
  assert.deepEqual(bar().warnings, [{ code: 'wikilinks' }]);
  assert.equal(bar().acceptBlocker, null);
  assert.equal(diff().proposal, 'A2\n\nB\n\nC2');
  assert.equal(diff().streaming, false);
  assert.equal(diff().canAccept, true);
  await tick();
  assert.ok(diff().querySelector('.cm-mergeView'));
  // Il controller non accetta: i due flag seguono.
  ai.blocker = 'conflict';
  ai.set({});
  assert.equal(bar().acceptBlocker, 'conflict');
  assert.equal(diff().canAccept, false);
  // Anteprima della risposta in arrivo tra la barra e il diff.
  ai.set({ streamingPreview: 'in arrivo' });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'details.stream', 'hmd-ai-diff-pane']);
  assert.equal(document.querySelector('.stream pre')!.textContent, 'in arrivo');
  assert.equal(document.querySelector('.stream summary')!.textContent, EN_MESSAGES['ai.streamingPreview']);
  ai.set({ streamingPreview: null });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'hmd-ai-diff-pane']);
});

test('the proposal applied: plain editor without the bar; the bar arrows, Discard and Continue reach the diff and the controller', async () => {
  const { children, ai, button, diff } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  const calls: string[] = [];
  const pane = diff();
  pane.previous = () => void calls.push('previous');
  pane.next = () => void calls.push('next');
  [...pane.parentElement!.querySelectorAll<HTMLButtonElement>('hmd-ai-review-bar .iconButton')].forEach((b) => b.click());
  assert.deepEqual(calls, ['previous', 'next']);
  button(EN_MESSAGES['ai.discard']).click();
  assert.deepEqual(ai.calls, [['discard', 'a.md']]);
  ai.set({ proposals: new Map([['a.md', proposal({ status: 'partial' })]]) });
  button(EN_MESSAGES['ai.continue']).click();
  assert.deepEqual(ai.calls.at(-1), ['continue', 'a.md']);
  ai.set({ proposals: new Map([['a.md', proposal({ text: ORIGINAL })]]) });
  assert.deepEqual(children(), ['div.editor']);
});

test('Accept all: beforeAccept(p, true) then the whole text into the document as one transaction (hmd-doc-change)', async () => {
  const { ai, button, changes, docSide } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  button(EN_MESSAGES['ai.acceptAll']).click();
  assert.deepEqual(ai.calls, [['beforeAccept', 'a.md', true]]);
  assert.equal(docSide().textContent, 'A2BC2');
  assert.equal(changes.length, 1);
  assert.equal((changes[0] as [unknown, { after: string }])[1].after, 'A2\n\nB\n\nC2');
});

test('Accept all after the document changed: the confirmation dialog; confirmed it accepts, detached it closes', async () => {
  const { el, ai, button, docSide } = mount({ proposals: new Map([['a.md', proposal({ baseText: 'altro' })]]) });
  await tick();
  button(EN_MESSAGES['ai.acceptAll']).click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.open);
  assert.ok(dialog.textContent?.includes(EN_MESSAGES['ai.changedWarning']));
  assert.deepEqual(ai.calls, []);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.acceptAll'])!.click();
  await tick();
  assert.deepEqual(ai.calls, [['beforeAccept', 'a.md', true]]);
  assert.equal(docSide().textContent, 'A2BC2');
  // Staccato con il dialog aperto: il dialog se ne va.
  ai.set({ proposals: new Map([['a.md', proposal({ baseText: 'altro', text: 'X' })]]) });
  button(EN_MESSAGES['ai.acceptAll']).click();
  assert.ok(document.querySelector('dialog')!.open);
  el.remove();
  await tick();
  assert.equal(document.querySelector('dialog'), null);
});

test('a proposal edited in the diff reaches the controller; with a selection only the part inside it', async () => {
  const scope = { from: 0, to: 1, originalText: 'A', status: 'valid' as const };
  const { ai, diff } = mount({ proposals: new Map([['a.md', proposal({ text: 'Z', scope })]]) }, { text: 'A\n\nB\n\nC' });
  ai.proposalTextValue = 'Z\n\nB\n\nC';
  ai.set({});
  await tick();
  assert.equal(diff().proposal, 'Z\n\nB\n\nC');
  diff().dispatchEvent(new CustomEvent('hmd-ai-proposal-edit', { detail: { text: 'ZZ\n\nB\n\nC' }, bubbles: true }));
  assert.deepEqual(ai.calls, [['edited', 'a.md', 'ZZ']]);
});

test('Discard with the focus on the button: the focus goes into the plain editor, not the body (the fix of 6c)', async () => {
  const { ai, button, editor } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  const discard = button(EN_MESSAGES['ai.discard']);
  discard.focus();
  focusOn(discard, 'Discard');
  discard.click();
  ai.set({ proposals: new Map() });
  focusOn(editor().querySelector('.cm-content'), 'the plain editor');
});

test('a view change with the focus already on the body focuses the new editor (the effect of ReviewView.tsx); elsewhere it stays', async () => {
  const { ai, diff } = mount();
  focusOn(document.body, 'the body');
  ai.set({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  focusOn(diff().querySelector('.cm-content'), 'the document side of the diff');
  const outside = document.body.appendChild(document.createElement('button'));
  outside.focus();
  ai.set({ proposals: new Map() });
  focusOn(outside, 'the outside button');
});

test('typing in the plain editor reaches docChanged and selectionChanged; a language change rewrites the hint; detached nothing stays', async () => {
  const { el, i18n, listeners, changes, selections, section } = mount();
  await tick();
  assert.equal(selections.length, 1);
  await i18n.setLocale('it');
  assert.equal(section().querySelector('.hint')!.textContent, 'SCRIVI');
  assert.equal(listeners(), 1);
  assert.equal(changes.length, 0);
  el.remove();
  assert.equal(listeners(), 0);
});

test('the seconds counter stops at detach and follows a new run', async () => {
  const { el, ai, bar } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() } });
  assert.equal((bar().status as { seconds: number }).seconds, 0);
  el.remove();
  ai.set({ running: { messageId: 'n', path: 'a.md', startedAt: Date.now() - 5000 } });
  document.body.append(el);
  assert.equal((bar().status as { seconds: number }).seconds, 5);
});

test('generation finishes with the focus in the retained bar (Accept all): the focus stays on Accept all, it does not jump into the diff', async () => {
  const { ai, button, diff } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() } });
  const accept = button(EN_MESSAGES['ai.acceptAll']);
  accept.focus();
  focusOn(accept, 'Accept all');
  ai.set({ running: null, proposals: new Map([['a.md', proposal()]]) });
  await tick();
  // Rilievo di A11y su LAB-11 (WCAG 2.4.3, 3.2.2): nessun cambio di focus senza un'azione; nel diff un secondo Invio scriverebbe nel documento.
  assert.ok(diff().querySelector('.cm-mergeView'));
  assert.equal(button(EN_MESSAGES['ai.acceptAll']), accept, 'the same Accept all button');
  focusOn(accept, 'Accept all');
});

test('two truncated proposals: the note of a.md does not follow the view to b.md, the bar stays the same element', async () => {
  const truncated = (path: string, createdAt: number) => proposal({ path, baseText: 'A', text: 'A2', status: 'truncated', createdAt });
  const { el, bar, button, doc } = mount({ proposals: new Map([['a.md', truncated('a.md', 1)], ['b.md', truncated('b.md', 2)]]) }, { text: 'A', session: createDocSession('a.md#1', 'A') });
  await tick();
  const first = bar();
  const note = () => first.querySelector<HTMLParagraphElement>(':scope > [role="status"]')!;
  button(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  assert.equal(first.proposalId, 'a.md#1');
  el.doc = { ...doc, path: 'b.md', resetKey: 'b.md#1', session: createDocSession('b.md#1', 'A') };
  assert.ok(bar() === first, 'the same bar element');
  assert.equal(first.proposalId, 'b.md#2');
  assert.equal(note().textContent, '');
});
