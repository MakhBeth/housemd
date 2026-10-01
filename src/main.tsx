import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles/global.css';
import App from './App';
import { detectLocale, parseLocale } from './i18n/i18n';
import { I18nProvider } from './i18n/I18nProvider';
import { loadMessages } from './i18n/messages';
import { readValidPref } from './lib/prefs';
import { registerSW } from 'virtual:pwa-register';
import { registerUpdates } from './pwa/registerUpdates';
import { updateHost } from './pwa/updateHost';
import { installFocusSource } from './ui/focusSource';

const updates = registerUpdates(registerSW, updateHost);
installFocusSource(document);

const requestedLocale = readValidPref('locale', parseLocale) ?? detectLocale(navigator.languages);

void loadMessages(requestedLocale).then(({ locale, messages }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider initialLocale={locale} initialMessages={messages}>
        <App updates={updates} />
      </I18nProvider>
    </StrictMode>,
  );
});
