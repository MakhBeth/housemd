import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installPopoverStub } from '../../testing/popoverStub';
import type { HmdEvents } from '../events';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

/** Il focus è su `node`. Mai `assert.equal` tra nodi di jsdom: il messaggio del RED (util.inspect dell'albero) non finisce più. */
const focusOn = (node: Element | null | undefined, what: string) => assert.ok(!!node && document.activeElement === node, `focus on ${what}, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);

const GENERATING: ReviewStatus = { kind: 'generating', seconds: 3, done: 1, total: 3 };

function mount(initial: ReviewStatus = { kind: 'none' }, warnings: CheckWarning[] = [], canAccept = true, canDiscard = true) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.previous': 'PRIMA', 'ai.discard': 'SCARTA', 'ai.acceptAll': 'TUTTO', 'ai.warning.wikilinks': 'WIKI' } }),
      persist() {},
    }),
  );
  const el = document.createElement('hmd-ai-review-bar');
  el.status = initial;
  el.warnings = warnings;
  el.canAccept = canAccept;
  el.canDiscard = canDiscard;
  el.i18n = i18n;
  document.body.append(el);
  const events: [keyof HmdEvents, unknown][] = [];
  for (const type of ['hmd-ai-review-action', 'hmd-ai-review-warning'] as const) el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  const bar = () => el.firstElementChild as HTMLDivElement;
  const buttons = () => [...bar().querySelectorAll<HTMLButtonElement>(':scope > button')];
  const byLabel = (label: string) => buttons().find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label)!;
  const status = () => bar().querySelector<HTMLSpanElement>('.status');
  const popover = () => bar().querySelector<HTMLDivElement>('[popover]');
  return { el, i18n, listeners, events, bar, buttons, byLabel, status, popover };
}

test('the same DOM as ReviewBar.tsx without status or warnings', () => {
  const { el, bar, buttons, status, popover, byLabel } = mount();
  assert.deepEqual([...el.children].map((c) => `${c.localName}.${c.className}`), ['div.bar']);
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
  }
  assert.ok(byLabel(EN_MESSAGES['ai.discard']));
  assert.ok(byLabel(EN_MESSAGES['ai.acceptAll']));
});

test('while generating: the counter with progress in a polite live region, the arrows disabled; canDiscard and canAccept drive the other two (today)', () => {
  const { el, status, byLabel, buttons, events } = mount(GENERATING, [], false, false);
  assert.equal(status()!.textContent, `${EN_MESSAGES['ai.generating'].replace('{seconds}', '3')} 1/3`);
  assert.equal(status()!.getAttribute('aria-live'), 'polite');
  assert.equal(status()!.hasAttribute('role'), false);
  assert.equal(status()!.previousElementSibling, buttons()[1]);
  assert.equal(status()!.nextElementSibling!.className, 'spacer');
  for (const button of buttons()) assert.equal(button.disabled, true);
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.deepEqual(events, []);
  el.status = { kind: 'none' };
  assert.equal(buttons()[0].disabled, false);
  assert.equal(byLabel(EN_MESSAGES['ai.discard']).disabled, true);
  el.canDiscard = true;
  el.canAccept = true;
  for (const button of buttons()) assert.equal(button.disabled, false);
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
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount'].replace('{count}', '2'));
  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['ai.warningsCount'].replace('{count}', '2'));
  assert.equal(button.textContent, ' 2');
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

test('the four actions reach the host as one event each', () => {
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

test('a language change rewrites labels, tooltips and warnings; detached, no listener stays', async () => {
  const { el, i18n, listeners, buttons, byLabel, popover } = mount(GENERATING, [{ code: 'wikilinks' }]);
  await i18n.setLocale('it');
  assert.equal(buttons()[0].getAttribute('aria-label'), 'PRIMA');
  assert.equal(buttons()[0].getAttribute('data-tooltip'), 'PRIMA');
  assert.equal(byLabel('SCARTA').textContent, 'SCARTA');
  assert.equal(byLabel('TUTTO').className, 'secondary accept');
  assert.equal(popover()!.firstElementChild!.textContent, 'WIKI');
  assert.equal(listeners(), 1);
  el.remove();
  assert.equal(listeners(), 0);
});
