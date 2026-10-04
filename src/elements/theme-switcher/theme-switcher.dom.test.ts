import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createThemeStore } from '../../state/themeStore';

function mount() {
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'theme.auto': 'AUTO' } }),
    persist() {},
  });
  const el = document.createElement('hmd-theme-switcher');
  el.store = theme;
  el.i18n = i18n;
  document.body.append(el);
  return { el, theme, i18n, button: el.querySelector('button')! };
}

test('the button shows the current theme and cycles auto → light → dark, staying the same node', () => {
  const { el, theme, button } = mount();
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.auto']);
  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['theme.auto']);
  assert.ok(button.classList.contains('tooltip'));
  button.click();
  assert.equal(theme.getState(), 'light');
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.light']);
  button.click();
  assert.equal(theme.getState(), 'dark');
  assert.equal(el.querySelector('button'), button);
  el.remove();
});

test('the label is already new when the store notifies (inside the view transition)', () => {
  const { el, theme, button } = mount();
  const seen: (string | null)[] = [];
  theme.subscribe(() => seen.push(button.getAttribute('aria-label')));
  theme.setTheme('dark');
  assert.deepEqual(seen, [EN_MESSAGES['theme.dark']]);
  el.remove();
});

test('a language change relabels the button', async () => {
  const { el, i18n, button } = mount();
  await i18n.setLocale('it');
  assert.equal(button.getAttribute('aria-label'), 'AUTO');
  el.remove();
});

test('detached, it no longer follows the store', () => {
  const { el, theme, button } = mount();
  el.remove();
  theme.setTheme('dark');
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.auto']);
});
