import test from 'node:test';
import assert from 'node:assert/strict';

import type { AcceptBlocker, AiState } from '../../ai/aiController';
import type { ChatMessage, Proposal } from '../../ai/types';
import { acceptNeedsConfirm, editedProposal, elapsedSeconds, reviewModel } from './reviewView';

const proposal = (extra: Partial<Proposal> = {}): Proposal => ({ path: 'a.md', baseText: 'A', text: 'B', origin: 'ai', status: 'complete', snapshotTaken: false, createdAt: 1, ...extra });
const state = (extra: Partial<AiState> = {}): AiState =>
  ({ chat: { id: 'c', messages: [], overrides: {} }, proposals: new Map(), running: null, profiles: [], presets: [], profileId: '', error: null, streamingPreview: null, ...extra }) as AiState;
const controller = (blocker: AcceptBlocker | null = null, text: string | null | undefined = undefined) => ({
  proposalText: (p: Proposal) => (text === undefined ? p.text : text),
  acceptBlocker: () => blocker,
});
const doc = { path: 'a.md', text: 'A' };

test('no proposal: plain editor, no bar; while generating on this document the bar is there with the counter', () => {
  const idle = reviewModel(state(), doc, 0, controller());
  assert.equal(idle.view, 'plain');
  assert.equal(idle.bar, false);
  assert.equal(idle.hint, true);
  assert.equal(idle.text, 'A');
  assert.equal(idle.streaming, true);
  const busy = reviewModel(state({ running: { messageId: 'm', path: 'a.md', startedAt: 0 } }), doc, 4, controller());
  assert.deepEqual(busy.status, { kind: 'generating', seconds: 4 });
  assert.equal(busy.bar, true);
  assert.equal(busy.hint, false);
  assert.equal(busy.view, 'plain');
  assert.equal(busy.acceptBlocker, 'generating');
  const other = reviewModel(state({ running: { messageId: 'm', path: 'b.md', startedAt: 0 } }), doc, 4, controller());
  assert.equal(other.bar, false);
});

test('a proposal that differs from the document: diff with the bar, the text applied, the warnings of the last reply on this document', () => {
  const warnings = [{ code: 'wikilinks' }];
  const messages: ChatMessage[] = [
    { id: '1', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings: [{ code: 'code' }] },
    { id: '2', role: 'assistant', text: '', docPath: 'b.md', status: 'done', warnings: [{ code: 'urls' }] },
    { id: '3', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings },
  ];
  const m = reviewModel(state({ proposals: new Map([['a.md', proposal()]]), chat: { id: 'c', messages, overrides: {} } }), doc, 0, controller());
  assert.equal(m.view, 'diff');
  assert.equal(m.bar, true);
  assert.equal(m.applied, false);
  assert.equal(m.streaming, false);
  assert.deepEqual(m.status, { kind: 'none' });
  assert.equal(m.text, 'B');
  assert.deepEqual(m.warnings, warnings);
  assert.equal(m.range, null);
  assert.equal(m.acceptBlocker, null);
});

test('the proposal applied (same text as the document): plain editor without the bar; still the diff if the status says more', () => {
  const applied = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'A' })]]) }), doc, 0, controller());
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.status, { kind: 'applied' });
  assert.equal(applied.view, 'plain');
  assert.equal(applied.bar, false);
  assert.equal(applied.hint, false);
  const partial = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'A', status: 'partial' })]]) }), doc, 0, controller());
  assert.equal(partial.applied, true);
  assert.deepEqual(partial.status, { kind: 'partial' });
  assert.equal(partial.view, 'diff');
});

test('a proposal on a selection: the range in the proposal, the text applied by the controller, read-only when the selection is lost', () => {
  const scope = { from: 2, to: 5, originalText: 'BAD', status: 'valid' as const };
  const p = proposal({ text: 'GOOD', scope });
  const m = reviewModel(state({ proposals: new Map([['a.md', p]]) }), { path: 'a.md', text: 'x BAD y' }, 0, controller(null, 'x GOOD y'));
  assert.deepEqual(m.range, { from: 2, to: 6 });
  assert.equal(m.text, 'x GOOD y');
  assert.equal(m.streaming, false);
  const lost = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'GOOD', scope: { ...scope, status: 'lost' } })]]) }), { path: 'a.md', text: 'x BAD y' }, 0, controller('scopeLost', null));
  assert.deepEqual(lost.status, { kind: 'scopeLost' });
  assert.equal(lost.streaming, true);
  assert.equal(lost.text, 'GOOD');
  assert.equal(lost.acceptBlocker, 'scopeLost');
});

test('elapsed seconds from the start of the run, zero without a run', () => {
  assert.equal(elapsedSeconds(null, 5000), 0);
  assert.equal(elapsedSeconds({ messageId: 'm', path: 'a.md', startedAt: 1000 }, 4999), 3);
});

test('the hand-edited proposal: whole text, or only the part inside the selection', () => {
  assert.equal(editedProposal(proposal(), 'A', 'edited'), 'edited');
  const scoped = proposal({ scope: { from: 2, to: 5, originalText: 'BAD', status: 'valid' } });
  assert.equal(editedProposal(scoped, 'x BAD y', 'x GOOD y'), 'GOOD');
  const atEnd = proposal({ scope: { from: 2, to: 5, originalText: 'BAD', status: 'valid' } });
  assert.equal(editedProposal(atEnd, 'x BAD', 'x GOOD'), 'GOOD');
});

test('Accept all asks for confirmation only when the document changed after a whole-document proposal', () => {
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A' }), 'A'), false);
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A' }), 'A!'), true);
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A', scope: { from: 0, to: 1, originalText: 'A', status: 'valid' } }), 'A!'), false);
});
