import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { LOGO, LOGO_INVERTED, WORDMARK } from '../../ui/logo';

const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

function mount(props: Partial<HTMLElementTagNameMap['hmd-start-screen']> = {}) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'start.openFolder': 'APRI' } }), persist() {} });
  const el = document.createElement('hmd-start-screen');
  Object.assign(el, { mode: 'start', ...props });
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n, buttons: () => [...el.querySelectorAll('button')] };
}

test('the same tree as StartScreen.tsx: main, panel, hidden title, three logos, tagline', () => {
  const { el } = mount();
  const main = el.querySelector('main')!;
  assert.equal(main.className, 'start');
  const panel = main.firstElementChild!;
  assert.equal(panel.className, 'panel');
  const [h1, dark, light, word, tagline] = panel.children;
  assert.equal(h1.localName, 'h1');
  assert.equal(h1.className, 'visually-hidden');
  assert.equal(h1.textContent, EN_MESSAGES['app.name']);
  assert.deepEqual([dark, light, word].map((p) => [p.localName, p.className, p.getAttribute('aria-hidden'), p.textContent]), [
    ['pre', 'logo logo-dark', 'true', LOGO],
    ['pre', 'logo logo-light', 'true', LOGO_INVERTED],
    ['pre', 'logo wordmark', 'true', WORDMARK],
  ]);
  assert.equal(tagline.textContent, EN_MESSAGES['start.tagline']);
  el.remove();
});

test('start: one primary button that sends hmd-start-pick; no message without an error', () => {
  const { el, buttons } = mount();
  let picks = 0;
  el.addEventListener('hmd-start-pick', () => picks++);
  assert.deepEqual(buttons().map((b) => [b.className, b.textContent]), [['primary', EN_MESSAGES['start.openFolder']]]);
  assert.equal(el.querySelector('.message'), null);
  buttons()[0].click();
  assert.equal(picks, 1);
  el.remove();
});

test('start with an error: the message sits between the tagline and the button', () => {
  const { el } = mount({ error: 'boom' });
  const message = el.querySelector('.message')!;
  assert.equal(message.textContent, t('start.openError', { detail: 'boom' }));
  assert.equal(message.previousElementSibling!.className, 'tagline');
  assert.equal(message.nextElementSibling!.localName, 'button');
  el.error = undefined;
  assert.equal(el.querySelector('.message'), null);
  el.remove();
});

test('resume: resume (primary) then open another (secondary), each with its event', () => {
  const { el, buttons } = mount({ mode: 'resume', folderName: 'notes' });
  const events: string[] = [];
  el.addEventListener('hmd-start-resume', () => events.push('resume'));
  el.addEventListener('hmd-start-pick', () => events.push('pick'));
  assert.deepEqual(buttons().map((b) => [b.className, b.textContent]), [
    ['primary', t('start.resume', { folder: 'notes' })],
    ['secondary', EN_MESSAGES['start.openOther']],
  ]);
  buttons()[0].click();
  buttons()[1].click();
  assert.deepEqual(events, ['resume', 'pick']);
  el.remove();
});

test('unsupported: the reason and no buttons', () => {
  const { el, buttons } = mount({ mode: 'unsupported', reason: 'firefox' });
  assert.equal(el.querySelector('.message')!.textContent, EN_MESSAGES['unsupported.firefox']);
  assert.deepEqual(buttons(), []);
  el.remove();
});

test('busy disables the buttons without recreating them', () => {
  const { el, buttons } = mount({ mode: 'resume', folderName: 'notes' });
  const before = buttons();
  el.busy = true;
  assert.deepEqual(buttons(), before);
  assert.ok(before.every((b) => b.disabled));
  el.busy = false;
  assert.ok(before.every((b) => !b.disabled));
  el.remove();
});

test('a language change relabels in place; detached, it no longer does', async () => {
  const { el, i18n, buttons } = mount();
  const button = buttons()[0];
  await i18n.setLocale('it');
  assert.equal(buttons()[0], button);
  assert.equal(button.textContent, 'APRI');
  const other = mount();
  other.el.remove();
  await other.i18n.setLocale('it');
  assert.equal(other.buttons()[0].textContent, EN_MESSAGES['start.openFolder']);
  el.remove();
});
