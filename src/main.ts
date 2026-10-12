import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles/global.css';
import './elements/define';
import { registerSW } from 'virtual:pwa-register';
import { el } from './dom/el';
import { detectLocale, parseLocale } from './i18n/i18n';
import { loadMessages } from './i18n/messages';
import { readValidPref, writePref } from './lib/prefs';
import { registerUpdates } from './pwa/registerUpdates';
import { updateHost } from './pwa/updateHost';
import { createI18nStore } from './state/i18nStore';
import { browserRouteWindow, createRouteStore } from './state/routeStore';
import { browserThemeStore } from './theme/browserTheme';
import { installFocusSource } from './ui/focusSource';

const updates = registerUpdates(registerSW, updateHost);
installFocusSource(document);

const requestedLocale = readValidPref('locale', parseLocale) ?? detectLocale(navigator.languages);

// Gli store unici dell'app (spec WC §5.3), creati qui e passati a <hmd-app> come proprietà.
void loadMessages(requestedLocale).then(({ locale, messages }) => {
  const i18n = createI18nStore({ locale, messages, load: loadMessages, persist: (loaded) => writePref('locale', loaded) });
  // <html lang> segue la lingua caricata (era l'effetto di I18nProvider).
  const syncLang = () => {
    document.documentElement.lang = i18n.getState().locale;
  };
  syncLang();
  i18n.subscribe(syncLang);
  const app = el('hmd-app');
  app.updates = updates;
  app.i18n = i18n;
  app.theme = browserThemeStore();
  app.route = createRouteStore(browserRouteWindow());
  document.getElementById('root')!.append(app);
});
