import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Solo Chromium recente (CLAUDE.md). Con il target predefinito il minificatore CSS trasforma
    // light-dark() in un polyfill basato su prefers-color-scheme, che ignora la proprietà
    // color-scheme usata dallo switcher del tema (src/theme/applyTheme.ts). Chrome 123 = light-dark().
    cssTarget: 'chrome123',
  },
  plugins: [
    react(),
    VitePWA({
      // Aggiornamento solo su richiesta, con il flusso protetto di src/pwa (registerUpdates):
      // niente registrazione automatica e niente reload automatico del plugin.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'HouseMD',
        short_name: 'HouseMD',
        description: 'Editor markdown nel browser per le tue cartelle locali',
        lang: 'it',
        // Come background_color e il colore scuro di <meta theme-color> a runtime (src/theme/theme.ts).
        theme_color: '#16161a',
        background_color: '#16161a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // JS (compresi i chunk delle lingue), CSS, HTML, SVG (icone pixel), PNG, woff2 (font).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
