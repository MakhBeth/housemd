# HouseMD

Editor markdown nel browser per cartelle locali (File System Access API), stile HackMD. Nessun server.

## Browser Support

**Policy:** solo Chromium desktop recente (Chrome, Edge). Le feature supportate da Chromium stabile
(Popover, Anchor Positioning, `<dialog closedby>`, CSS Custom Highlight API, `light-dark()`,
File System Access API) si usano **senza polyfill e senza fallback**. Unica eccezione:
`Element.setHTML()` (Sanitizer API) va sempre usato con fallback a DOMPurify caricato dinamicamente.

## Regole

- Mai `innerHTML` con HTML non sanitizzato (vedi `src/preview/sanitize.ts`).
- Mai `alert()` / `confirm()` / `prompt()`: i dialog sono le funzioni di `src/elements/dialogs/`
  (`showConfirmDialog`, `showNameDialog`, `showAccessLostDialog`), che usano `<dialog>` con `showModal()` e `closedby`.
- Solo `src/fs/fsaOps.ts` e `src/fs/access.ts` toccano la File System Access API.
- La logica va in moduli puri testati con `npm test` (`tsx --import ./src/testing/assetHooks.ts --test`: hook di Node per gli import `?url` delle icone e `.css`, serve Node ≥ 22.15 per `module.registerHooks`); gli elementi restano sottili.
- Nessun testo UI scritto a mano negli elementi: tutto passa da `t()` (`src/i18n`). Una chiave nuova va in
  **tutti** i `src/i18n/locales/*.json` (lo controlla `locales.test.ts`); `en.json` è il riferimento.
- Commenti e messaggi di commit in italiano, identificatori in inglese.
- Le operazioni del `Workspace` che toccano file passano dalla coda `runExclusive`; dentro la coda si
  chiamano solo le versioni interne `do…` (chiamare quelle pubbliche è un deadlock).
- Nessun `await` della cronologia nei percorsi che cambiano il documento (snapshot fire-and-forget).
- I test end-to-end (`e2e/*.spec.ts`, `npm run test:e2e`) trovano gli elementi solo per ruolo e nome accessibile, con i testi da `en.json`: mai classi CSS dell'app. Gli snapshot visivi si rigenerano solo con approvazione. La suite in sviluppo (`npm run test:e2e:dev`) non ammette errori o avvisi in console.
- Un cambio alla cascata (layer, `@scope`, fogli spostati) non deve cambiare l'aspetto: prima del cambio
  `npm run build && rm -rf dist-baseline && cp -r dist dist-baseline`, dopo `npm run test:e2e:audit`.

## Interfaccia

- Niente framework: l'interfaccia sono custom element `hmd-*` (`src/elements/`, classe base `src/dom/element.ts`),
  registrati solo in `src/elements/define.ts` e creati da `main.ts` (`<hmd-app>`). Gli store unici (lingua, tema,
  rotta, aggiornamenti) scendono come proprietà.
- **Elementi sottili**: un elemento crea il suo DOM, lo aggiorna da uno stato (ogni render passa da `RenderLoop`),
  trasforma gli eventi DOM in chiamate a moduli puri o store. Calcoli, validazioni e macchine a stati stanno in
  moduli `.ts` testati senza DOM. Ingressi come proprietà JS, uscite come eventi `hmd-*` (`src/elements/events.ts`).
- **Light DOM + `@scope`**: niente Shadow DOM. Ogni foglio di `src/elements/` è `@layer components { @scope (hmd-…)
  to (hmd-figli…) { … } }` (lo controlla `architecture.test.ts`).
- **Niente DOM da stringhe**: il DOM si crea con `el()` (`src/dom/el.ts`), i testi entrano come nodi di testo;
  `innerHTML` solo in `src/preview/sanitize.ts`.
- Regole di render: `watch()` rende subito; nessun callback DOM rientra in un render; il lavoro asincrono tardivo
  si scarta; i campi con il focus non si riscrivono; le proprietà dei figli si assegnano prima dell'inserimento e
  solo se cambiano; una chiave di memo per ogni vista derivata.
- Nei test jsdom mai `assert.equal` tra due nodi (il messaggio non finisce più): `assert.ok(a === b, 'cosa')`.
- **Mai `disabled` né `aria-disabled`** sui pulsanti. Se l'azione non è possibile il pulsante resta attivo e,
  attivato, scrive perché in una nota `role="status"` accanto (mai in un toast né in un tooltip); il focus resta sul
  pulsante. La nota entra vuota e si scrive con `announce` (`src/dom/announce.ts`: svuota, poi riscrive dopo
  `ANNOUNCE_DELAY_MS`, così un secondo clic la rilegge); una regione live che deve ri-annunciarsi non si scrive mai a mano.
- Un testo con un numero ha due forme, `<chiave>.one` e `<chiave>.other`, scelte da `pluralKey` (`src/i18n/i18n.ts`,
  `Intl.PluralRules`), in tutte e nove le lingue.
- **`forced-colors`**: gli sfondi diventano Canvas, quindi uno stato segnato solo dal colore sparisce. Le icone (maschere
  colorate dallo sfondo) prendono `CanvasText` (`ButtonText` nei pulsanti, `LinkText` nei link, `HighlightText` su uno
  sfondo `Highlight`); la voce corrente, la modalità premuta e la bozza orfana corrente usano `forced-color-adjust: none`
  con `Highlight`/`HighlightText`. Fuori dall'adattamento l'anello «oreo» (`box-shadow`) tornerebbe visibile: sulla voce
  con il focus si mette `box-shadow: none` dentro `@media (forced-colors: active)`.
- **`style-mod`** (`StyleModule`) per gli stili che devono stare nell'origine di CodeMirror (pulsanti dei blocchi del
  diff): niente `!important` per vincere sul tema base della libreria.

## AI

- Solo `src/ai/providers/*` fanno richieste di rete verso i modelli.
- Le chiavi API stanno solo nello store `aiSecrets` o in memoria: mai in localStorage, config, sync, log o toast. Sono legate a provider e origine.
- Il file di sync si scrive solo dopo un backup verificato (§8.4 della spec AI).
- Risposte e proposte sono non fidate: nessun HTML grezzo né nuove risorse remote caricate senza clic esplicito.
