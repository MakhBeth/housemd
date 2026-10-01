# HouseMD

Editor markdown nel browser per cartelle locali (File System Access API), stile HackMD. Nessun server.

## Browser Support

**Policy:** solo Chromium desktop recente (Chrome, Edge). Le feature supportate da Chromium stabile
(Popover, Anchor Positioning, `<dialog closedby>`, CSS Custom Highlight API, `light-dark()`,
File System Access API) si usano **senza polyfill e senza fallback**. Unica eccezione:
`Element.setHTML()` (Sanitizer API) va sempre usato con fallback a DOMPurify caricato dinamicamente.

## Regole

- Mai `innerHTML` / `dangerouslySetInnerHTML` con HTML non sanitizzato (vedi `src/preview/sanitize.ts`).
- Mai `alert()` / `confirm()` / `prompt()`: usare `<dialog>` con `showModal()` e `closedby="any"`.
- Solo `src/fs/fsaOps.ts` e `src/fs/access.ts` toccano la File System Access API.
- La logica va in moduli puri testati con `npm test` (`tsx --test`); i componenti React restano sottili.
- Nessun testo UI scritto a mano nei componenti: tutto passa da `t()` (`src/i18n`). Una chiave nuova va in
  **tutti** i `src/i18n/locales/*.json` (lo controlla `locales.test.ts`); `en.json` è il riferimento.
- Commenti e messaggi di commit in italiano, identificatori in inglese.
- Le operazioni del `Workspace` che toccano file passano dalla coda `runExclusive`; dentro la coda si
  chiamano solo le versioni interne `do…` (chiamare quelle pubbliche è un deadlock).
- Nessun `await` della cronologia nei percorsi che cambiano il documento (snapshot fire-and-forget).
- I test end-to-end (`e2e/*.spec.ts`, `npm run test:e2e`) trovano gli elementi solo per ruolo e nome accessibile, con i testi da `en.json`: mai classi CSS dell'app. Gli snapshot visivi si rigenerano solo con approvazione.

## AI

- Solo `src/ai/providers/*` fanno richieste di rete verso i modelli.
- Le chiavi API stanno solo nello store `aiSecrets` o in memoria: mai in localStorage, config, sync, log o toast. Sono legate a provider e origine.
- Il file di sync si scrive solo dopo un backup verificato (§8.4 della spec AI).
- Risposte e proposte sono non fidate: nessun HTML grezzo né nuove risorse remote caricate senza clic esplicito.
