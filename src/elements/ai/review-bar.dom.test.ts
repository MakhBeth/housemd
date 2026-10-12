import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AcceptBlocker } from '../../ai/aiController';
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';
import type { HmdEvents } from '../events';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

/** Il focus è su `node`. Mai `assert.equal` tra nodi di jsdom: il messaggio del RED (util.inspect dell'albero) non finisce più. */
const focusOn = (node: Element | null | undefined, what: string) => assert.ok(!!node && document.activeElement === node, `focus on ${what}, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);

const GENERATING: ReviewStatus = { kind: 'generating', seconds: 3, done: 1, total: 3 };

function mount(initial: ReviewStatus = { kind: 'none' }, warnings: CheckWarning[] = [], acceptBlocker: AcceptBlocker | null = null) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.previous': 'PRIMA', 'ai.discard': 'SCARTA', 'ai.acceptAll': 'TUTTO', 'ai.warning.wikilinks': 'WIKI', 'ai.review.generating': 'ASPETTA' } }),
      persist() {},
    }),
  );
  const el = document.createElement('hmd-ai-review-bar');
  el.status = initial;
  el.warnings = warnings;
  el.acceptBlocker = acceptBlocker;
  el.i18n = i18n;
  document.body.append(el);
  const events: [keyof HmdEvents, unknown][] = [];
  for (const type of ['hmd-ai-review-action', 'hmd-ai-review-warning'] as const) el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  const bar = () => el.firstElementChild as HTMLDivElement;
  const buttons = () => [...bar().querySelectorAll<HTMLButtonElement>(':scope > button')];
  const byLabel = (label: string) => buttons().find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label)!;
  const status = () => bar().querySelector<HTMLSpanElement>('.status');
  const popover = () => bar().querySelector<HTMLDivElement>('[popover]');
  const note = () => el.querySelector<HTMLParagraphElement>(':scope > [role="status"]')!;
  return { el, i18n, listeners, events, bar, buttons, byLabel, status, popover, note };
}

test('the same DOM as ReviewBar.tsx without status or warnings, then the empty status note: nothing is ever disabled', () => {
  const { el, bar, buttons, status, popover, byLabel, note } = mount();
  assert.deepEqual([...el.children].map((c) => `${c.localName}.${c.className}`), ['div.bar', 'p.note']);
  assert.equal(note().textContent, '');
  assert.deepEqual([...bar().children].map((c) => `${c.localName}.${c.className}`), ['button.iconButton tooltip', 'button.iconButton tooltip', 'span.spacer', 'button.secondary', 'button.secondary accept']);
  assert.equal(status(), null);
  assert.equal(popover(), null);
  const [previous, next] = buttons();
  assert.equal(previous.getAttribute('aria-label'), EN_MESSAGES['ai.previous']);
  assert.equal(previous.getAttribute('data-tooltip'), EN_MESSAGES['ai.previous']);
  assert.equal(next.getAttribute('aria-label'), EN_MESSAGES['ai.next']);
  assert.ok(previous.querySelector('span.icon'));
  for (const button of buttons()) {
    assert.equal(button.type, 'button');
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-disabled'), false);
  }
  assert.ok(byLabel(EN_MESSAGES['ai.discard']));
  assert.ok(byLabel(EN_MESSAGES['ai.acceptAll']));
});

test('while generating: the counter with progress, not live; every button active, activated it writes the note and keeps the focus', async () => {
  const { status, byLabel, buttons, note, events } = mount(GENERATING, [], 'generating');
  assert.equal(status()!.textContent, `${EN_MESSAGES['ai.generating'].replace('{seconds}', '3')} 1/3`);
  assert.equal(status()!.hasAttribute('aria-live'), false, 'i secondi non parlano (LAB-42 P1)');
  assert.equal(status()!.hasAttribute('role'), false);
  assert.equal(status()!.previousElementSibling, buttons()[1]);
  assert.equal(status()!.nextElementSibling!.className, 'spacer');
  for (const button of [buttons()[0], buttons()[1], byLabel(EN_MESSAGES['ai.acceptAll'])]) {
    assert.equal(button.disabled, false);
    button.focus();
    button.click();
    // Dal secondo clic la stessa nota si svuota e torna dopo `ANNOUNCE_DELAY_MS`: lo screen reader la rilegge.
    await waitFor(() => note().textContent === EN_MESSAGES['ai.review.generating']);
    focusOn(button, button.getAttribute('aria-label') ?? button.textContent ?? '');
  }
  assert.deepEqual(events, []);
  // Scarta durante la generazione non ha nota: sale, e lo workspace ferma e scarta (controller.discard).
  byLabel(EN_MESSAGES['ai.discard']).click();
  assert.deepEqual(events, [['hmd-ai-review-action', { action: 'discard' }]]);
  assert.equal(note().textContent, '');
});

test('the note goes when its cause goes: the generation ends, Accept all is possible again, or an action succeeds', () => {
  const { el, byLabel, note, events } = mount(GENERATING, [], 'generating');
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
  el.status = { kind: 'truncated' };
  el.acceptBlocker = 'truncated';
  assert.equal(note().textContent, '');
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  // Un'altra azione riesce: la nota se ne va e l'azione sale.
  byLabel(EN_MESSAGES['ai.discard']).click();
  assert.equal(note().textContent, '');
  assert.deepEqual(events, [['hmd-ai-review-action', { action: 'discard' }]]);
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  el.acceptBlocker = null;
  assert.equal(note().textContent, '');
});

test('Accept all says the reason of the controller, one text per reason, in the order of the bar', () => {
  const { el, byLabel, note } = mount({ kind: 'none' }, [], 'updating');
  const accept = () => byLabel(EN_MESSAGES['ai.acceptAll']).click();
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.updating']);
  el.acceptBlocker = 'conflict';
  assert.equal(note().textContent, '');
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.conflict']);
  el.status = { kind: 'scopeLost' };
  el.acceptBlocker = 'scopeLost';
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.scopeLost']);
  el.status = { kind: 'none' };
  el.acceptBlocker = 'notAcceptable';
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.notAcceptable']);
});

test('detached and attached again the note is forgotten', () => {
  const { el, byLabel, note } = mount(GENERATING, [], 'generating');
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
  el.remove();
  document.body.append(el);
  assert.equal(note().textContent, '');
});

test('partial: the status with Continue next to it; truncated and applied: just the text; lost selection: an alert', () => {
  const { el, status, bar, events } = mount({ kind: 'partial' });
  assert.equal(status()!.textContent, EN_MESSAGES['ai.status.partial']);
  const cont = status()!.nextElementSibling as HTMLButtonElement;
  assert.equal(cont.textContent, EN_MESSAGES['ai.continue']);
  assert.equal(cont.className, 'secondary');
  assert.equal(cont.nextElementSibling!.className, 'spacer');
  cont.click();
  assert.deepEqual(events, [['hmd-ai-review-action', { action: 'continue' }]]);
  el.status = { kind: 'truncated' };
  assert.equal(status()!.textContent, EN_MESSAGES['ai.status.truncated']);
  assert.equal(bar().querySelectorAll('button').length, 4);
  el.status = { kind: 'scopeLost' };
  assert.equal(status()!.textContent, EN_MESSAGES['ai.error.scopeLost']);
  assert.equal(status()!.getAttribute('role'), 'alert');
  assert.equal(status()!.hasAttribute('aria-live'), false);
  el.status = { kind: 'applied' };
  assert.equal(status()!.textContent, EN_MESSAGES['ai.applied']);
  assert.equal(status()!.hasAttribute('role'), false);
  el.status = { kind: 'none' };
  assert.equal(status(), null);
});

test('warnings: a button with the count and a popover with one button per warning, reused by position; chosen → event with the warning', () => {
  const warnings: CheckWarning[] = [{ code: 'wikilinks' }, { code: 'code' }];
  const { el, bar, popover, events } = mount({ kind: 'none' }, warnings);
  const button = bar().querySelector<HTMLButtonElement>('button[popovertarget]')!;
  assert.equal(button.className, 'secondary tooltip');
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount.other'].replace('{count}', '2'));
  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['ai.warningsCount.other'].replace('{count}', '2'));
  assert.equal(button.textContent, ' 2');
  el.warnings = [{ code: 'code' }];
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount.one'].replace('{count}', '1'), 'one warning: singular');
  el.warnings = warnings;
  assert.ok(button.querySelector('span.icon'));
  assert.equal(button.previousElementSibling!.className, 'spacer');
  assert.equal(popover()!.id, button.getAttribute('popovertarget'));
  assert.equal(popover()!.getAttribute('popover'), 'auto');
  assert.equal(popover()!.className, 'warnings');
  assert.equal(popover()!.nextElementSibling!.textContent, EN_MESSAGES['ai.discard']);
  const items = popover()!.querySelectorAll('button');
  assert.deepEqual([...items].map((b) => b.textContent), [EN_MESSAGES['ai.warning.wikilinks'], EN_MESSAGES['ai.warning.code']]);
  items[1].click();
  assert.deepEqual(events, [['hmd-ai-review-warning', { warning: { code: 'code' } }]]);
  el.warnings = [{ code: 'urls' }];
  assert.equal(popover()!.firstElementChild, items[0]);
  assert.equal(popover()!.children.length, 1);
  assert.equal(items[0].textContent, EN_MESSAGES['ai.warning.urls']);
  el.warnings = [];
  assert.equal(popover(), null);
  assert.equal(bar().querySelector('button[popovertarget]'), null);
});

test('the four actions reach the host as one event each when they are possible', () => {
  const { buttons, byLabel, events } = mount();
  buttons()[0].click();
  buttons()[1].click();
  byLabel(EN_MESSAGES['ai.discard']).click();
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.deepEqual(
    events.map(([, detail]) => (detail as { action: string }).action),
    ['previous', 'next', 'discard', 'acceptAll'],
  );
});

test('the focused Continue removed by a status change: the focus goes to Accept all', () => {
  const { el, status, byLabel } = mount({ kind: 'partial' });
  const cont = status()!.nextElementSibling as HTMLButtonElement;
  cont.focus();
  focusOn(cont, 'Continue');
  el.status = GENERATING;
  focusOn(byLabel(EN_MESSAGES['ai.acceptAll']), 'Accept all');
});

test('the proposal changes while the same block holds: the note is forgotten and the focus stays on the button', () => {
  const { el, byLabel, note } = mount({ kind: 'truncated' }, [], 'truncated');
  el.proposalId = 'a.md#1';
  const accept = byLabel(EN_MESSAGES['ai.acceptAll']);
  accept.focus();
  accept.click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  el.proposalId = 'a.md#1';
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  el.proposalId = 'b.md#2';
  assert.equal(note().textContent, '');
  focusOn(accept, 'Accept all');
  accept.click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
});

test('a language change rewrites labels, tooltips, warnings and the note; detached, no listener stays', async () => {
  const { el, i18n, listeners, buttons, byLabel, popover, note } = mount(GENERATING, [{ code: 'wikilinks' }], 'generating');
  buttons()[1].click();
  await i18n.setLocale('it');
  assert.equal(note().textContent, 'ASPETTA');
  assert.equal(buttons()[0].getAttribute('aria-label'), 'PRIMA');
  assert.equal(buttons()[0].getAttribute('data-tooltip'), 'PRIMA');
  assert.equal(byLabel('SCARTA').textContent, 'SCARTA');
  assert.equal(byLabel('TUTTO').className, 'secondary accept');
  assert.equal(popover()!.firstElementChild!.textContent, 'WIKI');
  assert.equal(listeners(), 1);
  el.remove();
  assert.equal(listeners(), 0);
});

test('while generating a hidden polite region says the start and each new part, never the seconds', async () => {
  const { el } = mount(GENERATING, [], 'generating');
  const spoken = () => el.querySelector<HTMLElement>(':scope > .spoken');
  assert.equal(spoken()!.getAttribute('aria-live'), 'polite');
  assert.equal(spoken()!.textContent, '', 'entrata vuota: il testo arriva dopo la pausa');
  const part = (done: number) => EN_MESSAGES['ai.generatingProgress'].replace('{done}', String(done)).replace('{total}', '3');
  await waitFor(() => spoken()!.textContent === part(1));
  const changes: string[] = [];
  new MutationObserver(() => changes.push(spoken()!.textContent!)).observe(spoken()!, { childList: true, characterData: true, subtree: true });
  el.status = { ...GENERATING, seconds: 4 };
  el.status = { ...GENERATING, seconds: 5 };
  el.status = { ...GENERATING, seconds: 6, done: 2 };
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(changes, [part(2)]);
});

test('when the generation ends the hidden region says the outcome (ready, partial, truncated) until the next action; no proposal, nothing', async () => {
  const outcomes: [ReviewStatus, string | null][] = [
    [{ kind: 'none' }, 'Proposal ready: 2 blocks to review'],
    [{ kind: 'partial' }, EN_MESSAGES['ai.status.partial']],
    [{ kind: 'truncated' }, EN_MESSAGES['ai.status.truncated']],
  ];
  for (const [end, text] of outcomes) {
    const { el, buttons } = mount(GENERATING, [], 'generating');
    const spoken = () => el.querySelector<HTMLElement>(':scope > .spoken');
    el.proposalId = 'a.md#1';
    el.blocks = 2;
    el.status = end;
    el.acceptBlocker = null;
    assert.equal(spoken()?.textContent, text, end.kind);
    el.blocks = 5;
    assert.equal(spoken()?.textContent, text, `${end.kind}: the count said once does not change under the user's edits`);
    buttons()[1].click();
    assert.equal(spoken(), null, `${end.kind}: the next action empties it`);
    el.remove();
  }
  // Generazione fermata prima di una proposta: nessun esito da dire.
  const { el } = mount(GENERATING, [], 'generating');
  el.status = { kind: 'none' };
  assert.equal(el.querySelector(':scope > .spoken'), null);
});
