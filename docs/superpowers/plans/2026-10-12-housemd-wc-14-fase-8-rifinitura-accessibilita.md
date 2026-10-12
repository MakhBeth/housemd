# HouseMD Web Components — Piano 14: fase 8, rifinitura e passata di accessibilità

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stato:** in scrittura (LAB-54). Le sezioni arrivano una alla volta; il piano è pronto quando questa riga sparisce.

**Goal:** Chiudere la migrazione a Web Components (spec §7 «Fase 8»): correggere i rilievi aperti di ciclo di vita, focus e annunci (review finale della 7b, LAB-42 P1–P12, handover 6c, 7 e 8), applicare a tutta l'app la regola di Davide «i pulsanti non diventano mai `disabled`», rendere distinguibili in `forced-colors` gli stati segnati solo dal colore, togliere i tre `!important` dei pulsanti del merge, misurare bundle e tempo di avvio contro la fase 3 e preparare la richiesta di merge dell'epica in `main` a Davide (checklist §9 in Chrome ed Edge). Due sotto-fasi (decisione 1): **8a** senza cambi d'aspetto voluti (comportamento, focus, annunci, nomi accessibili, refactoring), **8b** con i cambi d'aspetto passati prima da Designer (note «mai disabled», contorni in `forced-colors`, regioni live sempre presenti) e la chiusura della migrazione. Fuori: la rimozione dei toast (lavoro a sé dopo la migrazione); dei toast si corregge solo il riavvio dei timer, perché la correzione è piccola e misurata (decisione 9).

**Architecture:** Nessun elemento nuovo. Le correzioni stanno negli elementi esistenti e, dove c'è una regola, in un modulo puro o in un helper del DOM testato da solo: `switchFolder` impara a fermarsi a metà (`signal`), `hmd-app` ha una vita nel documento (un `AbortController` che si interrompe al distacco, non a `reconnect()`) e riparte dall'avvio se viene riattaccato mentre la schermata è ancora `boot`; il recupero del focus usa il `focusScope`/`refocus` di `RenderLoop` già esistente (workspace, app, profili, preset), con bersagli stabili nuovi esposti come metodi (`hmd-file-tree.focusTabStop()`, `hmd-workspace.focusStart()`); il ri-annuncio della stessa nota passa da un helper nuovo, `src/dom/announce.ts` (svuota e riscrive al fotogramma dopo); le forme singolare e plurale da `pluralKey()` in `src/i18n/i18n.ts` (`Intl.PluralRules`, chiavi `<base>.one`/`<base>.other`); la sezione corrente dell'indice delle impostazioni da una funzione pura nuova in `settingsView.ts`. La regola «mai disabled» riusa lo schema della 6b e della 6c (nota `role="status"` accanto al pulsante, ragione calcolata da una funzione pura o dal controller, focus che resta sul pulsante). I contorni in `forced-colors` stanno in `@media (forced-colors: active)` dentro i fogli degli elementi (e in `global.css` per le icone), sempre nel layer `components` con `@scope`. I tre `!important` di `diff-pane.css` diventano un `StyleModule` di CodeMirror registrato dalla vista del diff (analisi del layer `vendor` nel piano 6c, decisione 10 di quel piano).

**Tech Stack:** TypeScript 7, Custom Elements, CSS `@scope`/`@layer`, `@media (forced-colors: active)`, `Intl.PluralRules`, CodeMirror 6 (`StyleModule` di `style-mod`, `EditorView.contentAttributes`), `tsx --test` con jsdom 30, Playwright 1.63 (`forcedColors: 'active'`).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincolo 4 «pulsanti mai disattivati»; §5.1–5.4; §7 «Fase 8»; §8.4; §9 tutta, checklist manuale compresa; §10 R1–R3, R11, R16; §11; §13); handover `docs/superpowers/notes/2026-10-12-handover-fase-8.md` (la fonte: «Per la fase 8», «Regola UX di Davide», «Lezioni nuove della fase 7», «Trappole dell'ambiente»), `2026-10-11-handover-fase-7.md` («Per la fase 8», «Lezioni nuove della 6c») e `2026-10-11-handover-fase-6c.md` («Lezioni da mettere nei piani»); LAB-42 (P1–P12), LAB-6, la review finale della 7b su LAB-48 (R1, R2, A1–A5); piani `2026-10-12-housemd-wc-13-fase-7-impostazioni-workspace-app.md` (il modello di questo) e `2026-10-11-housemd-wc-12-fase-6c-revisione.md` («Analisi del layer `vendor`»).

## Global Constraints

- **Branch** `lab/LAB-6-fase-8` creato da `epic/LAB-3-web-components` (merge della 7b `0cb7652`): ogni sub-issue di esecuzione dell'8a committa lì. PR in bozza #12 verso `epic/LAB-3-web-components`, aperta da questo piano (`gh pr create --draft --base epic/LAB-3-web-components`), portata a pronta dal task di chiusura dell'8a (`gh pr ready`). Con la divisione (decisione 1) la PR #12 è quella dell'8a; l'8b ha un branch `lab/LAB-6-fase-8b` creato da `epic/LAB-3-web-components` **dopo** il merge dell'8a, e una PR in bozza sua. Commit piccoli in italiano, all'imperativo, prefisso convenzionale (`test:`, `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), niente emoji, **nessuna riga di attribuzione**. Il daemon di Multica installa un hook `prepare-commit-msg` che aggiunge `Co-authored-by: multica-agent`: si committa con `git -c core.hooksPath=/dev/null commit …` e prima di ogni push si controlla `git log --format=%B -n <N>`. Mai push su `main` né sul branch dell'epica, nessun merge: la PR la mergia il PM dopo la review (Reviewer, A11y) e i gate verdi. Verso `main` mergia solo Davide.
- **Task 1 prima di tutto**: la rete di sicurezza è scritta e verde **sull'app di oggi** (i difetti noti affermati come sono oggi, oppure rossi con il RED annotato), `dist-baseline/` costruita dal branch **prima di qualsiasi modifica all'app** (`git rev-parse HEAD > dist-baseline/BASELINE_SHA`, atteso `0cb7652` più i soli commit di test e documenti), conteggi delle suite, gzip del bundle e tempo di avvio annotati.
- **`dist-baseline/` nell'8a non si ricostruisce mai.** L'8a non cambia l'aspetto di proposito: l'audit resta verde contro la build di `0cb7652` dal primo all'ultimo task, salvo gli stati elencati nel task che li tocca (sezione «Cambi d'aspetto»: solo nuovi nodi invisibili o testi, con le differenze attese scritte riga per riga). **Nell'8b** `dist-baseline/` si rinnova **una volta per task che cambia l'aspetto**, sempre con lo stesso rito: (1) prima del cambio l'audit è verde contro la baseline corrente; (2) dopo il cambio l'audit cade **solo** negli stati elencati dal task e **solo** sulle proprietà elencate (le righe di `styleDifferences` si incollano nel commento finale); (3) si ricostruisce la baseline dal commit del task (`npm run build && rm -rf dist-baseline && cp -r dist dist-baseline && git rev-parse HEAD > dist-baseline/BASELINE_SHA`) e l'audit torna verde. Ogni audit si lancia dopo `cat dist-baseline/BASELINE_SHA`. Attraversando il confine 8a/8b la baseline si copia dal checkout della chiusura dell'8a (strada (a)) o si ricostruisce in un worktree separato dallo SHA di quella chiusura (strada (b)); mai da una build di un commit sconosciuto.
- **Snapshot visivi**: nell'8a nessuno cambia (misurato nel prototipo). Nell'8b si rigenerano solo quelli elencati nel task, con il motivo, `--update-snapshots=all -g "<nome>"`, e solo dopo l'approvazione di Designer (sezione «Cambi d'aspetto»).
- **Prima i test, poi il codice**: il RED si vede e si annota nel commento finale prima di scrivere il codice (nel dispatch va chiesto «test prima, poi il codice», non «scrivere tutto e ripristinare HEAD»). Un difetto noto si afferma com'è oggi nel Task 1 e si rovescia nel task che lo corregge; **mai `test.fail`**.
- Regole degli elementi (spec §2, §5): elementi sottili, logica nei moduli puri testati senza DOM, DOM solo con `el()`, light DOM + `@scope`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal`.
- **Schema di render (`RenderLoop`)**: ogni render passa da `this.#loop.update()`; `HmdElement.watch()` rende subito (niente render ridondanti in fondo a `connect()`); nessun evento emesso dentro `connect`; lo stato si salva **prima** di emettere; nessun callback DOM rientra in un render in modo sincrono.
- **Lavoro asincrono tardivo scartato, ricontrollato dopo ogni `await`**: avvio, scelta e ripresa della cartella in `hmd-app` (R1, R2) e `switchFolder` con `signal`. Un blocco «una alla volta» ha un token o un contatore di richiesta.
- **Campi con il focus mai riscritti né ricreati; se il nodo con il focus sparisce, il focus va su un bersaglio stabile** (`focusScope`/`refocus` di `RenderLoop`). Bersagli di questo piano: «Mostra sidebar» o il pulsante della modalità AI (A1), la riga col tab stop dell'albero (A2), la prima voce dell'elenco di profili e preset (P6), il titolo della sezione (P11).
- **Una chiave di memo per ogni vista derivata**; **`:scope` contro la prossimità di `@scope`** (una regola dentro `@scope (hmd-a)` che deve vincere sui fogli dei figli prende `:scope` davanti, mai `!important`); **`doc` nuovo a ogni render per `hmd-ai-review`** (decisione 9 della fase 7, invariata).
- **Regola UX di Davide (11/10)**: i pulsanti **non diventano mai `disabled`** né `aria-disabled`. Attivati quando l'azione non è possibile, dicono perché in una nota `role="status"` accanto (vuota di norma, svuotata quando la causa sparisce), mai in un toast né in un tooltip, e il focus resta sul pulsante. Nell'8a nessun pulsante cambia (le note nuove sono un cambio d'aspetto e passano da Designer: 8b).
- **Testi solo da `t()`.** Ogni chiave nuova va in **tutti** i `src/i18n/locales/*.json` (nove lingue; lo controlla `locales.test.ts`), `en.json` è il riferimento; le traduzioni le scrive chi implementa e le controlla il Reviewer. Tooltip mai con `title`.
- **Nei test jsdom mai `assert.equal` tra due nodi**: `assert.ok(document.activeElement === node, 'cosa')`. I test che montano CodeMirror (`hmd-workspace`, `hmd-app`, editor, diff) girano con `--test-timeout=20000`. jsdom non restituisce il focus all'apertore quando un `<dialog>` si chiude (lo stub `dialogStub.ts`): i test che lo assumono lo fanno a mano, con un commento.
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app. L'eccezione `#settings-ai-presets` (fase 7) **sparisce** in questa fase: le sezioni hanno un nome (`getByRole('region', { name })`). Resta l'eccezione dichiarata per `.cm-content` (§8.4) finché P3 non dà un nome al contenuto dell'editor: dopo, i test nuovi usano `getByRole('textbox', { name })`. `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; nessuna rete vera; un e2e sospetto di instabilità si prova con `--repeat-each=3`. Per `forced-colors` gli e2e e gli stati di audit usano `test.use({ forcedColors: 'active' })` (già passato dal fixture `context` di `e2e/support/app.ts`).
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo distinguono l'uscita 1 (nessuna occorrenza) dalla 2 (comando fallito). Prima di una suite: `npx tsc --noEmit` (`npm run build` comincia con `tsc`, e codice che non compila blocca il server della suite).
- **Gate per task** (decisione di Davide, 11/10): `npm test`, `npm run lint` e **solo i file e2e toccati o nuovi**, in build e in sviluppo, più gli stati di audit toccati (con `-g`). Le suite complete (`test:e2e`, `test:e2e:dev`, `test:e2e:audit`) girano **una volta sola** per sotto-fase, nel task di chiusura. **RAM di ape** (tetto di 10 GB per tutto Multica, rallenta sopra i 7): browser sempre dentro il lock, con le variabili **prima** di `flock`: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts <file>` (lo stesso con `e2e/dev.config.ts` e `e2e/audit.config.ts`); una suite alla volta; se cade per memoria, la si ripete con 1 worker e lo si scrive; a fine suite `pgrep -af "vite|chrom|playwright"` e si chiudono solo i propri PID, mai `pkill` per nome. Instabilità estranee note: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog»; `ai-composer.spec.ts` «a sync folder without permission…» e gli stati di audit che fanno `page.reload()` (`start-resume`, `ai-sync-reactivate`, `orphans`) con «Target page… closed»; i 2 snapshot dello start screen cadono su ape per il font pixel. Ripetere da soli e annotare. Con `-g` l'audit fa girare comunque tutto il progetto `baseline` (Playwright 1.63).
- **`node_modules` in un worktree nuovo**: `npm ci` o una copia vera (`cp -a`), mai un link simbolico (Vite risponde 403 ai file fuori dalla radice e `test:e2e:dev` cade quasi tutto).
- Commenti e commit in italiano, identificatori in inglese.

## Misure prese scrivendo il piano (12/10, su `0cb7652`)

Baseline su `0cb7652` (= `epic/LAB-3-web-components`, merge della 7b), nel prototipo pulito (`git worktree add --detach /home/agent/work/housemd-proto-8 origin/epic/LAB-3-web-components`, `npm ci`): `npm test` = **1045** (52 s); `npm run lint` pulito; `npm run test:e2e` = **202** (200 verdi + i 2 snapshot dello start screen, già noti; 3,0 min con 2 worker); `npm run test:e2e:dev` = **187** (5,4 min); `npm run test:e2e:audit` = **136** test, 68 stati (4,2 min, contro una `dist-baseline/` costruita da `0cb7652`); bundle principale gzip = **379 234 B** (`dist/assets/index-D1j-v0H1.js`, 1 137 086 B non compresso). Nessun processo appeso a fine suite.

**Tempo di avvio, fase 3 contro oggi** (metodo ripetibile, Task 1: `e2e/startup.config.ts` + `e2e/startup.measure.ts`). Build della fase 3 dal merge `a3ebc6f` (React 19, gzip 432 419 B, ricostruita in un worktree detached con `npm ci && npm run build`) e build di `0cb7652`, servite da due `vite preview`; 21 giri alternati (l'ordine si inverte a ogni giro, così il carico della macchina non favorisce una build), ognuno con un profilo Chromium nuovo (cache vuota), 1280×800, lingua inglese, harness OPFS degli e2e. Due misure prese nella pagina con `performance.now()` (millisecondi dall'inizio della navigazione) da un `MutationObserver` iniettato prima degli script dell'app: **`start`** = prima apertura, il pulsante «Open folder» compare nel DOM; **`reopen`** = dopo aver aperto una cartella di 60 file in 6 sottocartelle e un documento, ricarica: albero e testo del documento nel DOM (ripresa all'avvio, cache HTTP calda). Mediane (p25–p75):

| Build | `start` | `reopen` |
|---|---|---|
| fase 3 (`a3ebc6f`, React 19) | **206 ms** (198–227) | **228 ms** (224–250) |
| oggi (`0cb7652`, senza React) | **139 ms** (128–162) | **220 ms** (206–259) |

La schermata iniziale arriva 67 ms prima (−33 %); la riapertura di una cartella è uguale entro il rumore (−8 ms, gli intervalli si sovrappongono): lì domina la lettura dei file dall'OPFS, non il framework. Misurato anche con 3 giri e con 1 giro: stesso ordine di grandezza. Il metodo si ripete nel task di chiusura dell'8b sul commit finale (attesa: `start` e `reopen` entro ±10 % da questi numeri).

**Prototipo.** Il codice dei task dell'8a e le regole `forced-colors` dell'8b sono stati provati su una seconda copia (`/home/agent/work/housemd-proto-8-code`, stesso commit, `npm ci`, niente commit; una terza copia `housemd-proto-8-f3` per la build della fase 3; tutte rimosse alla fine). Le note «mai disabled» dell'8b **non** sono nel prototipo: il loro aspetto lo decide Designer (decisione 2) e lo schema è quello già provato nella 6b e nella 6c. Riproduzioni della review della 7b (allegato di LAB-54, `review-app-lifecycle.test.ts`): **3 rossi** su `0cb7652` (`late pick result`, `late resume result`, `boot restarts after detach and reconnect`), **3 verdi** dopo il Task 2, riscritti come test di `app.dom.test.ts`.

Misure sul prototipo finale (8a + le regole `forced-colors` dell'8b): `npx tsc --noEmit` e `npm run lint` puliti; `npm test` 1045 → **1066** (+4 `app.dom`, +1 `switchFolder`, +2 `workspace.dom`, +1 `toasts.dom`, +1 `profiles.dom`, +3 `settings.dom`, +1 `sync.dom`, +1 `i18n`, +3 `announce`, +1 `reviewBarView`, +1 `review-bar.dom`, +1 `review.dom`, +1 `composer.dom`, +1 `editor.dom`; gli altri test toccati sono estesi, non nuovi); risultati delle suite complete nel paragrafo «Suite del prototipo» qui sotto. Differenze dell'audit contro la build di `0cb7652`, **tutte previste** e nessun'altra:

- `ai-review-generating`, `ai-review-note`, `ai-composer-running`: `…>hmd-ai-review-bar:0>span:2: nuovo` (la regione live nascosta della generazione, P1);
- `ai-review-truncated`, `ai-review-warnings`: il tooltip del pulsante degli avvisi, `content: "1 warnings" → "1 warning"` e `width: 80px → 73px` (P4);
- nessuna differenza dai tre `!important` diventati `StyleModule` (stati `ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-review-applied` verdi): il cambio è invisibile, come doveva;
- solo 8b: `focus-search-keyboard-forced-colors` (le icone in `forced-colors` prendono `CanvasText`).

Misurato anche:

- **R1 e R2 nel dettaglio.** Con `hmd-app` staccato mentre `openWorkspace` è sospeso, oggi lo workspace aperto dopo il distacco viene pubblicato (`setUpdateWorkspace`), la schermata diventa `open` e, nella scelta, la cartella viene salvata come corrente; con il Task 2 il risultato tardivo si butta (`dispose`), niente si salva né si pubblica, la schermata resta quella di prima. Staccata e riattaccata durante `loadWorkspace`, oggi l'app resta su `boot` per sempre; con il Task 2 l'avvio riparte e il vecchio resta senza effetto (`loads === 2`). `switchFolder` impara a fermarsi dopo ognuno dei suoi quattro `await` (test su tutti e quattro i punti).
- **Esc nelle impostazioni (P5)**, nel browser: oggi, con un preset modificato, Esc non apre nessuna conferma e le impostazioni restano aperte (il dialog si apre e si richiude nello stesso tasto); con `event.preventDefault()` prima di `#close()` il dialog resta aperto con il focus su «Annulla». jsdom non lo vede (nessuna richiesta di chiusura), serve l'e2e.
- **L'indice delle impostazioni**, nel browser (1280×800, quattro sezioni): saltando a «AI · Sync» il contenitore arriva in fondo (`scrollTop` 819 = `scrollHeight` 1619 − 800) con Sync a 325 px dall'alto, fuori dalla fascia del 40 % (320 px); Profili (−56 px, alto 117) e Preset (102 px) sono nella fascia e la regola di oggi («la più in alto tra quelle che si intersecano») sceglie Profili. Anche saltando a Preset l'indice dice Profili. Con la regola nuova (decisione 6) i tre salti segnano Sync, Preset, Profili, e la rotella dopo un salto torna a seguire lo scorrimento.
- **A4 non si riproduce in Chromium senza screen reader**: cambiando lingua dalla select con `selectOption` o con Freccia giù (la lingua cambia davvero) il focus resta sulla select, lo stesso `hmd-settings` resta collegato. L'unico `focus()` sul titolo è in `connect` alla prima connessione. La causa va cercata con lo screen reader (decisione 12).
- **Le icone in `forced-colors`**: oggi `background-color` dell'icona diventa Canvas (misurato: `rgb(255, 255, 255)` su sfondo bianco, la barra degli strumenti è vuota); con il solo `forced-color-adjust: none` l'icona prende il colore d'autore (`rgb(31, 29, 26)`), invisibile con un tema scuro ad alto contrasto; con `CanvasText` (proposta di LAB-42) è nera su bianco e bianca su nero, e con `HighlightText` sui pulsanti premuti resta leggibile sullo sfondo `Highlight`. Provato con `forcedColors: 'active'` in schema chiaro e scuro.
- **Scarta durante la generazione, prima che arrivi una proposta**: `hmd-ai-review` chiamava `discard` solo con una proposta già presente, quindi Scarta non avrebbe fermato niente anche togliendo la nota. Il Task 5 usa il percorso del documento (`controller.discard(path)` ferma la richiesta in corso su quel percorso). Trovato dall'e2e del prototipo.
- **L'orologio finto di Playwright ferma `requestAnimationFrame`**: con `page.clock.install()` la nota ri-annunciata (svuotata e riscritta al fotogramma dopo, Task 5) resta vuota finché il test non fa avanzare l'orologio (`page.clock.runFor(50)`). Vale per ogni e2e che clicca due volte lo stesso pulsante bloccato con l'orologio installato.
- **Il quarto `!important`** non sta su `.cm-activeLine` (come diceva il piano 6c) ma su `.cm-selectionBackground` in `docExtensions.ts`, e combatte il tema base di `@codemirror/view` (`&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`, specificità più alta): `Prec` da solo non basta (decisione 8).
- **`style-mod`** è già nel bundle (dipendenza di `@codemirror/view`, `4.1.4`): dichiararlo in `package.json` con la stessa versione esatta non cambia il bundle e non scarica nulla.

### Inventario

Ogni punto del perimetro: dove sta, la causa, il test che lo copre, se cambia l'aspetto (**no** = audit e snapshot invariati; **nodo** = un nodo nuovo invisibile, una riga «nuovo» nell'audit; **sì** = cambio visibile, passa da Designer), il task.

**Ciclo di vita e focus (review della 7b, A11y)**

| Id | Dove | Causa | Test | Aspetto | Task |
|---|---|---|---|---|---|
| R1 | `src/elements/app/app.element.ts:147` (`#choose`), `:160` (`#resume`); `src/app/switchFolder.ts` | dopo gli `await` nessuno controlla se l'app è ancora collegata: lo workspace tardivo arriva a `#show` (schermata `open`, `setUpdateWorkspace`) e, nella scelta, `switchFolder` chiama `persist` | `app.dom.test.ts` «detached while a picked folder opens…», «…the resumed folder opens…»; `switchFolder.test.ts` «a switch whose caller goes away stops at the next await…» | no | 2 |
| R2 | `app.element.ts:73` e `:80` | `#booted = true` resta dopo il distacco che interrompe l'avvio: riattaccata, l'app non riparte e resta su `boot` | `app.dom.test.ts` «detached and reattached while booting…» | no | 2 |
| A2 | `app.element.ts:171` | il pulsante della schermata iniziale, con il focus, sparisce con la schermata; nessuno sposta il focus | `app.dom.test.ts` «the focus follows the folder…»; e2e `startup.spec.ts` (nuovo caso) | no | 2 |
| A1 | `src/elements/workspace/workspace.element.ts:532` (slot `aside`), `:669` («Nascondi» nella sidebar), `#changeMode('ai')` | il `RenderLoop` del workspace non ha `focusScope`/`refocus`: «Nascondi», Ctrl+B nell'albero o nella ricerca, la modalità AI che sostituisce l'albero tolgono il nodo con il focus | `workspace.dom.test.ts` «the focus never falls on the body when the sidebar goes…»; e2e `workspace-shell.spec.ts` (nuovi casi) | no | 3 |
| A5 | `src/elements/workspace/layout.ts:40` (`resizeByKey`) | solo frecce; l'APG del window splitter vuole anche Home ed End | `layout.test.ts` (esteso), `workspace.dom.test.ts` «the separator: Home and End…» | no | 3 |
| T | `src/elements/toasts/toasts.element.ts:31`, `:88` (`#restartTimers`) | un array `items` nuovo (toast, errore AI, lingua) riavvia i timer di tutti i toast informativi | `toasts.dom.test.ts` «info toasts close 6 s after they appear…» (riscritto), «a toast that goes and comes back…» | no | 3 |
| A4 | `src/elements/settings/settings.element.ts` (select della lingua) | **non riprodotta** in Chromium senza screen reader (misure); l'unico `focus()` sul titolo è alla prima connessione | e2e `theme-i18n.spec.ts` (nuovo: il focus resta sulla select) | no | 1 (+ checklist, decisione 12) |

**Impostazioni (LAB-42 P5–P12, handover)**

| Id | Dove | Causa | Test | Aspetto | Task |
|---|---|---|---|---|---|
| P5 | `settings.element.ts:155-161` | l'Esc che apre `showDiscardChangesDialog` non è consumato: Chrome lo usa per chiudere subito il `<dialog closedby="any">` appena aperto | `settings.dom.test.ts` «Esc that opens the confirmation is consumed…»; e2e `settings.spec.ts` (nuovo, da tastiera) | no | 5 |
| P6 | `profiles.element.ts:149`, `presets.element.ts:126` | «Elimina» sparisce con il dettaglio; i due `RenderLoop` non hanno `focusScope` | `profiles.dom.test.ts` «Delete asks first; once the profile is gone the focus goes to the first item…», `presets.dom.test.ts` (esteso); e2e `settings.spec.ts` (esteso) | no | 5 |
| P9 | `sync.element.ts:94-96` | stato ed errore della sync sono `p.help` senza ruolo | `sync.dom.test.ts` «the sync status is a polite live region and its error an alert…» | no | 5 |
| P10 | `sync.element.ts:211` | i «Ripristina questo backup» hanno lo stesso nome e niente che li distingua | idem (`aria-describedby` verso il percorso) | no (il percorso passa da testo a `span`: nessuno stato di audit ha backup) | 5 |
| P11 | `settings.element.ts:320-333` | il link dell'indice scorre ma il focus resta sul link | `settings.dom.test.ts` «a link activated from the keyboard scrolls … moves the focus to the section title» | no (anello del focus sul titolo, solo da tastiera) | 5 |
| P12 | `settings.element.ts:292` | la nota delle larghezze non è collegata ai campi | `settings.dom.test.ts` «every section is a region … the width hint describes both width fields» | no | 5 |
| Sezioni | `settings.element.ts:265`, `:274` | `<section>` senza `aria-labelledby`: gli e2e le raggiungono con `#settings-ai-presets` o per posizione | idem; e2e: via `#settings-ai-presets` (`settings-sections.spec.ts:109`, audit `:576`) e i localizzatori per posizione elencati nel Task 4 | no | 5 |
| Indice | `settings.element.ts:395-410`, `settingsView.ts:32` (`topSection`), `settings.css:63` (40vh) | la regola sceglie la sezione più in alto tra quelle nella fascia del 40 %: le ultime sezioni, corte, non diventano mai correnti | `settingsView.test.ts` «the current section: the last one whose top is in the upper 40 %…»; e2e `settings-sections.spec.ts` (rovesciato: Sync) | no (cambia quale voce è segnata, non lo stile) | 5 |
| P7 | `settings.css:57`, `sections.css:41` | voce corrente segnata solo da `--c-accent-soft`, che in `forced-colors` diventa Canvas | stato di audit nuovo `forced-colors-settings`; e2e `forced-colors.spec.ts` | **sì** (solo `forced-colors`) | 10 |
| P8 | `profiles.element.ts:247`, `:312` | il `p[role=status]` «Connesso» entra nel DOM già scritto | `profiles.dom.test.ts` «Connection: … the status enters empty and is written a frame later» | no (entra vuoto e il testo arriva al fotogramma dopo, con `announce`: decisione 4) | 5 |

**AI (LAB-42 P1–P4, handover 6c e 7, LAB-6)**

| Id | Dove | Causa | Test | Aspetto | Task |
|---|---|---|---|---|---|
| P1 | `review-bar.element.ts:145-147`, `reviewBarView.ts:38` | il contatore «Generating… N s» è una regione `aria-live` che cambia ogni secondo (il composer non ha contatori: la sua nota è `ai.composer.generating`, fissa) | `reviewBarView.test.ts` (esteso), `review-bar.dom.test.ts` «while generating a hidden polite region says the start and each new part…»; e2e `ai-review-bar.spec.ts` (rovesciato) | **nodo** (`span.spoken`, nascosto) | 4 |
| P3 | `editor.element.ts:47`, `diff-pane.element.ts:127` | `.cm-content` (ruolo `textbox`) senza nome; nessun `contentAttributes` | `editor.dom.test.ts` «the content is a textbox named after the document text…»; `review.dom.test.ts` (conteggio degli ascoltatori) | no | 4 |
| P4 | `review-bar.element.ts:163`; `src/i18n/i18n.ts` | `ai.warningsCount` ha solo il plurale; `t()` non conosce le forme | `i18n.test.ts` «pluralKey…», `review-bar.dom.test.ts` (esteso) | **testo** (tooltip «1 warning», audit di 2 stati) | 4 |
| LAB-11 | `review-bar.element.ts:184`, `composer.element.ts:234`, `sidebar.element.ts:162` | `setText` non scrive un testo uguale: la stessa nota a un altro clic non cambia la regione e non si ri-annuncia | `announce.test.ts`; `review-bar.dom.test.ts`, `composer.dom.test.ts` (estesi: la nota si svuota e torna) | no | 4 |
| Scarta | `reviewBarView.ts:17` (`actionBlocker`), `review.element.ts:203` | durante la generazione Scarta scrive solo la nota; e senza una proposta già arrivata non chiamerebbe comunque `discard` | `reviewBarView.test.ts`, `review-bar.dom.test.ts`, `review.dom.test.ts` «Discard while generating, before any proposal…»; e2e `ai-review-bar.spec.ts` (nuovo) | no | 4 |
| Continua | `reviewBarView.ts:19`, `aiController.ts:118` | durante un aggiornamento il controller ignora Continua in silenzio | `reviewBarView.test.ts` «Continue during an update says so…» | no (la nota esiste già) | 4 |
| Doppio clic | `composer.element.ts:167-172` | `send()` mette `running` prima del primo `await`: il secondo clic del doppio clic trova Stop e ferma la richiesta | `composer.dom.test.ts` «a double click on Send sends once and does not stop…»; e2e `ai-composer.spec.ts` (nuovo) | no | 4 |
| LAB-10 | `en.json:155` (`ai.composer.noDocument`), `workspace.element.ts:640-662` | in modalità AI l'albero non c'è e la nota non dice dove aprire il documento; passare all'editor smonta la sidebar e la bozza si perde | e2e `ai-review-bar.spec.ts:182` (rovesciato: la bozza resta); `composer.dom.test.ts` | **testo** (nota più lunga: stato `ai-composer-note-no-document`) | 4 |
| Chip | `model-chip.element.ts:182-209` | i rami di `reconcileList` fanno `as` sul nodo generico | i test di `model-chip.dom.test.ts` invariati; `grep " as " ` vuoto nel file | no | 4 |
| `anchor-scope` | `model-chip.css:37-44` | oggi esiste un solo chip (unico creatore: il composer) | — | — | nessuno (decisione 11) |
| `!important` | `diff-pane.css:35-50` (tre), `docExtensions.ts:48` (quarto) | `@codemirror/merge` dichiara i pulsanti per blocco in un `StyleModule` fuori dai layer | audit `ai-review*` invariato (misurato) | no | 6 |
| P2 | `src/styles/global.css:98` | l'icona è una maschera colorata da `background-color: currentColor`, che `forced-colors` porta a Canvas | audit `focus-search-keyboard-forced-colors` + stati nuovi; e2e `forced-colors.spec.ts` | **sì** (solo `forced-colors`) | 10 |
| A3 | `workspace.css:139`, `:231`, `:71` | modalità attiva, bozza orfana corrente e separatore (5 px) distinti solo dallo sfondo | stato di audit nuovo `forced-colors-workspace`; e2e `forced-colors.spec.ts` | **sì** (solo `forced-colors`) | 10 |

**Regola «mai disabled» (Davide, 11/10)** — oggi nove punti, misurati (nessun `aria-disabled`, nessun `disabled` nei dialog):

| Pulsante o campo | Dove | Condizione | Test di oggi | Task |
|---|---|---|---|---|
| Salva chiave | `profiles.element.ts:293` | campo chiave vuoto | `profiles.dom.test.ts:67`, e2e `settings-sections.spec.ts:77`, audit `:589` | 9 |
| Indirizzo del server (campo) | `profiles.element.ts:290` | provider `anthropic` | `profiles.dom.test.ts:63`, e2e `settings-sections.spec.ts:74` | 9 |
| Sincronizza ora | `sync.element.ts:199` | sync in corso (oggi un clic accoderebbe un'altra sync: `AiSync.syncNow` mette `pending`) | `sync.dom.test.ts:97`, audit `:613` | 9 |
| Cronologia | `workspace.element.ts:581` | nessun documento | `workspace.dom.test.ts:114`, e2e `workspace-shell.spec.ts:27` | 9 |
| Cartella (cambio) | `workspace.element.ts:681` | cambio di cartella in corso | nessuno | 9 |
| Apri cartella, Riprendi, Apri un'altra | `start-screen.element.ts:86` | cambio in corso (`busy`) | `start-screen.dom.test.ts:91` | 9 |
| Aggiorna (avviso di nuova versione) | `notice.element.ts:65` | aggiornamento in corso | `notice.dom.test.ts:49` | 9 |
| ← accetta / → rifiuta dei blocchi del diff | `diff-pane.element.ts:251`, `:262`; `diffLogic.ts:36` | accetta: `!canAccept`; rifiuta: generazione | `diffLogic.test.ts:34`, `diff-pane.dom.test.ts:138`, `:180`, audit `:229` | 8 |

Fogli con `:disabled` che cambiano con la regola: `start-screen.css:102` (`opacity .6; cursor: progress`), `workspace.css:48` e `:53` (cartella), `notice.css:44`, `diff-pane.css:42` e `:47` (`opacity .35`), `suggestions.css:25` (già morto). Salva chiave, Sincronizza ora e l'indirizzo hanno oggi l'aspetto `disabled` del browser (nessuno stile d'autore).

### Cambi d'aspetto

La fase 8 cambia l'aspetto di proposito, ma solo nell'8b. Ogni cambio visibile, con chi lo decide:

| # | Cambio | Dove si vede | Designer prima di Builder? | Sotto-fase, task |
|---|---|---|---|---|
| 1 | Regione live nascosta della generazione (`span.spoken`, `clip-path`) | nessuna parte: nodo nuovo invisibile | no | 8a, 4 |
| 2 | Tooltip degli avvisi al singolare («1 warning») | tooltip al passaggio, nome accessibile | no | 8a, 4 |
| 3 | Testo della nota «nessun documento» in modalità AI, più lungo (LAB-10) | nota sotto il composer | no (testo: lo rivede il Reviewer; A11y conferma che dice dove andare) | 8a, 4 |
| 4 | Anello del focus sul titolo `h2` dopo un salto dall'indice da tastiera | impostazioni, solo da tastiera | no (è l'anello di sempre, `:focus-visible`) | 8a, 5 |
| 5 | **Note «mai disabled»** accanto a Salva chiave, Sincronizza ora, Cronologia (barra degli strumenti), cartella (testata della sidebar), pulsanti della schermata iniziale, Aggiorna; il pulsante attivo dove oggi è spento (`opacity`, `cursor: progress`, aspetto `disabled` del browser) | impostazioni, barra, sidebar, schermata iniziale, avviso di nuova versione | **sì**: dove sta la nota (la barra degli strumenti e la testata della sidebar oggi non hanno un posto per una nota), che cosa sostituisce il segnale «in corso» del cursore `progress` e dell'opacità, i testi | 8b, 9 |
| 6 | **Campo dell'indirizzo per Anthropic** non più `disabled` | dettaglio del profilo | **sì**: aspetto di un campo di sola lettura (decisione 10) | 8b, 9 |
| 7 | **Pulsanti dei blocchi del diff** attivi durante la generazione e il conflitto, ragione nella nota della barra | diff della revisione | **sì**: oggi `opacity: .35`; con la regola il pulsante ha l'aspetto normale e la nota dice perché | 8b, 8 |
| 8 | **`forced-colors`**: icone in `CanvasText`; modalità attiva, voce corrente dell'indice, voce aperta di profili e preset, bozza orfana corrente in `Highlight`/`HighlightText`; separatore in `CanvasText` (`Highlight` al passaggio e al focus) | solo con il contrasto elevato di Windows o `forced-colors` emulato | **sì**: la proposta del prototipo (schermate prima e dopo nel commento di LAB-54) va confermata o cambiata | 8b, 10 |

**Designer prima dell'8b.** Il PM crea una sub-issue di design (stage precedente all'8b, può girare in parallelo con l'8a) con i punti 5–8: per ognuno posizione e stile della nota o del contorno, testi (chiavi i18n nuove in `en.json`, le altre lingue le scrive Builder), stati coinvolti. Il materiale: le righe «mai disabled» dell'inventario, le schermate `forced-colors` del prototipo, le regole CSS provate (Task 10). I Task 8–10 partono solo con la proposta accettata dal PM; se la proposta cambia le regole del Task 10 o la forma delle note, il task segue la proposta e il piano resta valido per tutto il resto.

**`dist-baseline/` e snapshot.**

- **8a.** Il Task 1 costruisce `dist-baseline/` da `0cb7652` più i soli commit di test (nessun commit dell'app), con `BASELINE_SHA`. I Task 2, 3, 5 e 6 lasciano l'audit verde contro quella baseline (misurato). Il **Task 4** cambia di proposito 6 stati: `ai-review-generating`, `ai-review-note`, `ai-composer-running` (riga `span:2: nuovo`), `ai-review-truncated`, `ai-review-warnings` (tooltip al singolare), `ai-composer-note-no-document` (testo della nota). Nel Task 4: audit con `-g` di quegli stati, differenze identiche a quelle elencate (incollate nel commento), poi `dist-baseline/` ricostruita dal commit del Task 4 e audit completo verde. Nessuno snapshot cambia nell'8a (misurato: `visual.spec.ts` verde salvo i 2 noti).
- **8b.** Ogni task che cambia l'aspetto segue il rito dei vincoli globali: audit verde prima, differenze solo negli stati e nelle proprietà elencati dal task, baseline ricostruita dal commit del task. Stati attesi: Task 8 `ai-review-conflict`, `ai-review-generating`, `ai-review-note` (pulsanti dei blocchi); Task 9 `settings-cloud-profile`, `settings-sync-folder`, `settings-connected`, `workspace-empty`, più gli stati che Designer tocca; Task 10 `focus-search-keyboard-forced-colors` e i tre stati `forced-colors-*` del Task 1. **Snapshot**: da rigenerare solo se il task li tocca davvero (`--update-snapshots=all -g "<nome>"`, con il motivo nel commento): i candidati sono `settings` (Task 9, se Designer mette una nota visibile senza interazione) e `ai-review` (Task 8, se cambia l'aspetto dei pulsanti dei blocchi a riposo). Nessuno snapshot è in `forced-colors`.

### Divisione

La fase è un insieme di rifiniture indipendenti, non una catena: l'app funziona dopo ogni task. Prototipo: circa 800 righe aggiunte e 160 tolte per l'8a (metà test), 60 per le regole `forced-colors`; le note «mai disabled» dell'8b sono altre 300–500 righe stimate dallo schema della 6b. Per questo e per Designer, due sotto-fasi (decisione 1).

| Task | Sotto-fase | Chi | Contenuto | e2e |
|---|---|---|---|---|
| 1 | 8a | Builder | Rete di sicurezza: difetti di oggi affermati, stati di audit `forced-colors-*`, misura dell'avvio ripetibile, `dist-baseline/` | sì |
| 2 | 8a | Builder | `hmd-app`: risultati tardivi scartati (R1), avvio che riparte (R2), focus dopo l'apertura (A2); `switchFolder` con `signal` | sì (`startup.spec.ts`) |
| 3 | 8a | Builder | `hmd-workspace`: focus quando la sidebar sparisce (A1), Home/End sul separatore (A5); timer dei toast per chiave | sì (`workspace-shell.spec.ts`) |
| 4 | 8a | **Planner** | AI: contatore (P1), nome dell'editor (P3), plurale (P4), ri-annuncio della nota (LAB-11, helper `announce`), Scarta = Ferma + scarta, Continua durante un aggiornamento, doppio clic su Invia, LAB-10 (testo e bozza conservata), chip senza cast; rinnovo della baseline | sì |
| 5 | 8a | Builder | Impostazioni: Esc (P5), focus dopo Elimina (P6), «Connesso» annunciato (P8), stato della sync (P9), Ripristina distinti (P10), focus sul titolo (P11), nota delle larghezze (P12), sezioni con un nome, indice che arriva a Sync | sì |
| 6 | 8a | Builder | I tre `!important` del diff come `StyleModule` | solo audit |
| 7 | 8a | Builder | Chiusura dell'8a: suite complete una volta, spec §7, PR pronta | suite complete |
| 8 | 8b | **Planner** | «Mai disabled» per i pulsanti dei blocchi del diff (controlli ricreati da CodeMirror, nota nella barra) | sì |
| 9 | 8b | Builder | «Mai disabled» per Salva chiave, indirizzo, Sincronizza ora, Cronologia, cartella, schermata iniziale, Aggiorna | sì |
| 10 | 8b | Builder | `forced-colors`: icone (P2), voce corrente (P7), modalità, bozza orfana e separatore (A3) | sì |
| 11 | 8b | Builder | Documenti, misure, chiusura: suite complete, avvio contro la fase 3, spec §7/§11/§13, `CLAUDE.md`, `README.md`, nota di chiusura della migrazione, PR epica → `main` e sub-issue «[Davide]» | suite complete |

**Stage.** Tutti i task scrivono sullo stesso branch e quasi tutti toccano gli e2e: si eseguono **uno alla volta, uno per stage**, nell'ordine della tabella (così c'è sempre un solo task con e2e per stage, e nessun conflitto di git). In parallelo all'8a gira solo la sub-issue di Designer (nessun codice, nessun browser). Prima del Task 7 e del Task 11, review (Reviewer e A11y) del diff della sotto-fase; le correzioni della review sono il primo commit del task di chiusura, come nella 7b.

**Task 4 e Task 8 a Planner.** Il 4 mette insieme tempi sottili (una nota svuotata e riscritta al fotogramma dopo, che l'orologio finto di Playwright ferma), la sessione di CodeMirror (un aggiornamento vuoto per il nome del contenuto passa dalla sessione e rompe un test: misurato), il percorso di Scarta senza proposta (trovato solo dall'e2e) e la bozza del composer che deve sopravvivere alla sidebar ricreata (non provata nel prototipo); è anche l'unico task dell'8a che rinnova la baseline. L'8 tocca i controlli che `@codemirror/merge` ricrea a ogni cambio dei blocchi, con il focus da tenere su un pulsante che può essere ricreato. Gli altri sono a Builder con il codice provato nel piano.

**Richiesta di merge a Davide.** Nel Task 11, dopo il merge dell'8b nell'epica: PR `epic/LAB-3-web-components` → `main` (`gh pr create --base main --head epic/LAB-3-web-components`, titolo «LAB-3: migrazione a Web Components», corpo con il riepilogo delle fasi 4–8 e le misure), e una sub-issue «[Davide] Checklist §9 in Chrome ed Edge e merge della migrazione in main» assegnata a davidemak con la checklist §9 completa (automatica già verde, manuale da fare: selettore e permessi veri, popover vicino ai bordi, transizione a pixel e `prefers-reduced-motion`, screen reader, `forced-colors` vero di Windows, Edge, PWA, AI con un provider vero), le prove a mano ancora aperte (LAB-52, i punti 7b dell'handover, A4 con lo screen reader), il link alla PR. Mergia solo Davide.

### Decisioni (tra parentesi la raccomandazione; il PM decide e procede)

1. **Due sotto-fasi, 8a e 8b** (sì). Varianti: **A** una PR sola (scartata: le note «mai disabled» aspettano Designer, e tutto il resto resterebbe fermo con loro); **B** (raccomandata) 8a = tutto quello che non cambia l'aspetto (Task 1–7, PR #12), 8b = i cambi d'aspetto dopo Designer e la chiusura della migrazione (Task 8–11, branch `lab/LAB-6-fase-8b` da `epic/LAB-3-web-components` dopo il merge dell'8a, PR in bozza nuova «LAB-6: fase 8b, regola «mai disabled» e contrasto elevato»); **C** una PR per area (app, workspace, impostazioni, AI) (scartata: quattro giri di suite complete e di review per rifiniture di poche decine di righe). Con A il Task 7 si salta.
2. **Designer prima dei Task 8–10** (sì): la nota «mai disabled» nella barra degli strumenti e nella testata della sidebar non ha un posto oggi, e il segnale «in corso» della schermata iniziale e dell'avviso (`cursor: progress`, opacità) sparisce con `disabled`; i colori di sistema in `forced-colors` sono una scelta visiva. **Scartato**: Builder che decide da solo con lo schema del composer (la nota sotto la casella non ha un equivalente nella barra).
3. **R1 e R2: `signal` in `switchFolder` e una vita di `hmd-app` nel documento** (sì, provata). `#alive` è un `AbortController` sostituito a ogni collegamento e interrotto al distacco (non a `reconnect()`, che succede cambiando lo store della lingua); avvio, scelta e ripresa catturano il suo `signal` e lo ricontrollano dopo ogni `await`; `switchFolder` lo riceve e si ferma prima di ogni effetto (apertura, `dispose` del vecchio, `persist`), eliminando la cartella appena aperta. L'avvio riparte a ogni collegamento finché la schermata è `boot`. **Scartate**: un contatore solo in `hmd-app` (il `persist` sta dentro `switchFolder`, dopo l'ultimo `await`: il controllo arriverebbe tardi); `isConnected` dopo ogni `await` (staccata e riattaccata tra due `await`, l'operazione vecchia passerebbe).
4. **Una regione live che entra nel DOM si annuncia con `announce`: vuota all'ingresso, il testo al fotogramma dopo** (sì; P1, P8): nessun cambio d'aspetto (un fotogramma), nessun nodo sempre presente. **Scartata** per P8 la regione sempre nel DOM proposta da A11y: il `p` vuoto aggiunge 10 px di `gap` nel dettaglio (`.detail` è una colonna flex), quindi un cambio d'aspetto e un giro di Designer per una riga.
5. **P1: una regione nascosta a parte, il contatore visibile non è più live** (sì, provata). Annuncia «Generating a proposal» all'avvio e «…, part n of m» quando cambia il progresso; i secondi restano visibili. **Scartate**: dividere il testo visibile in parti `aria-hidden` (nove traduzioni da ristrutturare, il contatore cambia DOM in tutti gli stati); togliere solo `aria-live` e contare sul registro della chat («Working…»: il progresso `n/m` non si sentirebbe).
6. **L'indice delle impostazioni: regola nuova con «salto fissato»** (sì, provata nel browser). `currentSection()` in `settingsView.ts`: in fondo allo scorrimento l'ultima sezione, altrimenti l'ultima il cui inizio sta nel 40 % alto; un salto dall'indice o dalla rotta fissa la sezione chiesta finché chi usa la pagina non scorre altrove (si confronta lo `scrollTop` del salto). Un ascoltatore `scroll` al posto dell'`IntersectionObserver` (jsdom lo ha, il test lo vede). **Scartate**: più spazio in fondo al contenuto perché l'ultima sezione arrivi in cima (cambia il layout, una pagina vuota in fondo); un altro `rootMargin` (le sezioni corte in fondo non entrano in nessuna fascia).
7. **LAB-11: la stessa nota a un altro clic si svuota e torna al fotogramma dopo** (sì, provata), con l'helper `announce(node, text, again)`; `again` solo quando la nota nuova è uguale a quella mostrata (o la regione è appena entrata). Vale per la barra della revisione, il composer e Nuova chat. **Scartate**: un carattere invisibile alternato in fondo alla nota (lo screen reader lo può leggere, e il testo nel DOM non è più quello di `t()`); ricreare il nodo della regione (meno affidabile di un cambio di testo in una regione esistente).
8. **I tre `!important` diventano `StyleModule`; il quarto resta** (sì, provata: audit invariato). Il `StyleModule` sta nella stessa origine fuori dai layer degli stili di `@codemirror/merge`, con specificità più alta; `style-mod` si dichiara in `package.json` (`4.1.4`, esatta, già nel bundle). Il quarto (`.cm-selectionBackground` in `docExtensions.ts`) combatte un selettore del tema base di `@codemirror/view` con specificità più alta: toglierlo vorrebbe dire copiare quel selettore interno; resta con il suo commento, corretto (non è `.cm-activeLine`). **Scartati**: `EditorView.theme` (aggiunge un prefisso di classe dell'editor, e i pulsanti stanno fuori dagli editor); un layer `vendor` (analisi del piano 6c: CodeMirror non scrive nei layer).
9. **Timer dei toast per chiave** (sì, provata): ogni toast informativo ha 6 s dalla sua comparsa; un array nuovo avvia solo i timer dei toast nuovi e ferma quelli spariti. Quindici righe e due test. **Scartato**: lasciarlo alla rimozione dei toast (lavoro lungo e non ancora pianificato, intanto i toast restano a schermo finché si scrive).
10. **L'indirizzo per Anthropic: `readOnly` con la descrizione** (sì, da confermare con Designer): il campo resta raggiungibile e leggibile, lo screen reader dice «sola lettura», `aria-describedby` verso l'aiuto del provider. **Scartate**: nasconderlo per Anthropic (l'indirizzo fisso non si vedrebbe più); lasciarlo modificabile e ignorarlo (ingannevole).
11. **`anchor-scope` sul chip: no** (sì): oggi c'è un solo chip (unico creatore: il composer, uno per pagina); `anchor-scope` cambierebbe lo stile calcolato di tutti gli stati AI dell'audit per un caso che non esiste. Se un giorno ci sono due chip, il test «two chips get different popover ids» va esteso e `anchor-scope: --ai-model-chip` aggiunto. **Scartato**: aggiungerlo adesso.
12. **A4 resta aperto, con un test che afferma il comportamento misurato** (sì): non si riproduce in Chromium (il focus resta sulla select); il Task 1 aggiunge l'e2e «the focus stays on the language select», e la prova con lo screen reader va nella sub-issue di Davide e nella review di A11y dell'8a. Se A11y la riproduce, la correzione entra nell'8b. **Scartato**: spostare il focus da qualche parte «per sicurezza» (WCAG 3.2.2 chiede proprio che resti).
13. **LAB-10: testo che dice dove andare e bozza conservata** (variante B, sì). **A** solo il testo (scartata: seguendo il consiglio si passa all'editor e la bozza scritta si perde); **B** (raccomandata) testo nuovo («No document open: switch to Editor and open one from the file tree, then send»), più la bozza del composer conservata da `hmd-workspace` quando la sidebar AI si ricrea (proprietà `draft` del composer, in entrata e in uscita con un evento `hmd-ai-draft`); **C** un elenco dei file dentro la modalità AI (scartata: interfaccia nuova, Designer, fuori perimetro).
14. **Icone in `forced-colors`: `CanvasText`, `HighlightText` sui pulsanti premuti** (sì, misurata). **Scartato** `forced-color-adjust: none` da solo (misurato: l'icona prende il colore d'autore, invisibile con un tema scuro).
15. **Voce premuta o corrente in `forced-colors`: sfondo `Highlight`, testo `HighlightText`** (sì, da confermare con Designer): il modo di sistema per una selezione, nessuno spostamento del layout. **Scartati**: `outline` interno (si scontra con l'anello del focus, che usa `outline` e sta in un layer più debole: un pulsante premuto e con il focus perderebbe l'anello); un bordo (sposta il layout di 2 px solo in `forced-colors`).
16. **Doppio clic su Invia: il secondo clic del doppio clic (`detail ≥ 2`) non ferma** (sì, provata). Un clic singolo o la tastiera (`detail` 0) fermano come prima; il nodo resta uno (decisione della 6b). **Scartate**: una finestra di 500 ms dopo l'invio (arbitraria, timer nei test); due nodi Invia e Stop (il focus salterebbe).
17. **Sincronizza ora durante una sync: la nota «sync già in corso» e nessuna sync accodata** (sì, da confermare con Designer per il testo). Oggi il pulsante è spento; attivo, un clic accoderebbe un'altra sync (`AiSync.syncNow` mette `pending`), che non è quello che chi clicca si aspetta.

## Review Focus

1. **Nessun risultato tardivo con effetti** (8a, Task 2): ogni `await` di avvio, scelta e ripresa in `hmd-app` è seguito dal controllo del `signal` della vita dell'app; `switchFolder` non apre, non elimina il vecchio e non salva dopo un'interruzione; l'avvio riparte riattaccando, una sola volta. Test: i quattro nuovi di `app.dom.test.ts`, «a switch whose caller goes away…» di `switchFolder.test.ts`.
2. **Il focus non cade mai sul `body`** (Task 2, 3, 5): bersagli stabili per la sidebar che sparisce, la schermata iniziale che sparisce, l'elenco dopo Elimina, il titolo dopo un salto dall'indice; il focus resta sulla select della lingua e sul pulsante attivato quando l'azione non è possibile. Test: `workspace.dom.test.ts`, `app.dom.test.ts`, `profiles`/`presets.dom.test.ts`, `settings.dom.test.ts`, e2e `workspace-shell.spec.ts`, `startup.spec.ts`, `settings.spec.ts`, `theme-i18n.spec.ts`.
3. **Annunci** (Task 4, 5): il contatore non parla ogni secondo, la regione nascosta parla all'avvio e a ogni parte; la stessa nota a un altro clic si ri-annuncia; «Connesso» e la regione della generazione entrano vuote e si riempiono al fotogramma dopo; stato ed errore della sync sono regioni. `announce` non anticipa né perde un testo (test dei tre casi). Gli e2e con l'orologio finto fanno avanzare l'orologio dopo un clic ripetuto.
4. **Scarta, Continua, doppio clic** (Task 4): Scarta durante la generazione ferma e scarta anche senza una proposta già arrivata; Continua durante un aggiornamento dice perché; il secondo clic di un doppio clic non ferma. Test: `reviewBarView.test.ts`, `review.dom.test.ts`, `composer.dom.test.ts`, e2e `ai-review-bar.spec.ts`, `ai-composer.spec.ts`.
5. **Aspetto** (8a): audit verde contro `dist-baseline/` di `0cb7652` in ogni task salvo i 6 stati del Task 4, con le differenze elencate e nessun'altra; `StyleModule` al posto dei tre `!important` senza differenze; nessuno snapshot rigenerato. (8b): ogni rinnovo della baseline giustificato riga per riga, snapshot rigenerati solo se elencati.
6. **Regola «mai disabled» completa** (8b): `grep -rn "disabled" src --include=*.ts` mostra solo test che affermano `disabled === false` e nessun `aria-disabled`; ogni pulsante bloccato dice perché in una nota `role="status"` accanto, il focus resta, la nota si svuota quando la causa sparisce. Test per ogni pulsante (Task 8, 9).
7. **`forced-colors`** (8b, Task 10): icone, voce corrente, modalità premuta, bozza orfana, separatore distinguibili in schema chiaro e scuro (`forcedColors: 'active'`), stati di audit `forced-colors-*` rinnovati con il motivo.
8. **Testi** (Task 4, 5, 9): ogni chiave nuova in tutte e nove le lingue, `pluralKey` con `Intl.PluralRules`, traduzioni plausibili (il Reviewer le legge).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/startup.config.ts`, `e2e/startup.measure.ts`, `.gitignore` (`dist-phase3`) | Misura ripetibile del tempo di avvio contro la fase 3 (Task 1, rilanciata nel Task 11). |
| `e2e/computed-styles.audit.ts` (stati `forced-colors-workspace`, `forced-colors-settings`, `forced-colors-review`), `e2e/forced-colors.spec.ts`, e2e toccati nei Task 1–5 | Rete di sicurezza e test dei comportamenti nuovi. |
| `src/app/switchFolder.ts` (+ test), `src/elements/app/app.element.ts` (+ `.dom.test.ts`) | Vita dell'app, avvio, scelta e ripresa (Task 2). |
| `src/elements/file-tree/file-tree.element.ts` (`focusTabStop()`), `src/elements/workspace/workspace.element.ts` (`focusStart()`, `focusScope`/`refocus`), `layout.ts` (+ test), `src/elements/toasts/toasts.element.ts` (+ test) | Focus e separatore del workspace, timer dei toast (Task 2, 3). |
| `src/dom/announce.ts` (+ test) | Testo di una regione live che si ri-annuncia (Task 4). |
| `src/i18n/i18n.ts` (`pluralKey`, + test), `src/i18n/locales/*.json` | Forme singolare e plurale, chiavi nuove (Task 4, 5, 9). |
| `src/elements/ai/review-bar.element.ts`, `review-bar.css`, `reviewBarView.ts`, `review.element.ts`, `composer.element.ts`, `sidebar.element.ts`, `model-chip.element.ts` (+ test) | Annunci, Scarta, Continua, doppio clic, chip (Task 4); pulsanti dei blocchi (Task 8). |
| `src/editor/docExtensions.ts`, `src/elements/editor/docElement.ts`, `editor.element.ts`, `src/elements/ai/diff-pane.element.ts` (+ test) | Nome del contenuto di CodeMirror (Task 4); `StyleModule` dei pulsanti dei blocchi (Task 6). |
| `src/elements/ai/diff-pane.css`, `package.json`, `package-lock.json` (`style-mod`) | Via i tre `!important` (Task 6). |
| `src/elements/settings/settings.element.ts`, `settingsView.ts`, `profiles.element.ts`, `presets.element.ts`, `sync.element.ts` (+ test) | Impostazioni (Task 5); «mai disabled» di Salva chiave, indirizzo e Sincronizza ora (Task 9). |
| `src/elements/start-screen/*`, `src/elements/notice/*`, `src/elements/workspace/*` | «Mai disabled» di schermata iniziale, avviso, Cronologia e cartella (Task 9). |
| `src/styles/global.css`, `workspace.css`, `settings.css`, `sections.css` | `forced-colors` (Task 10). |
| `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `CLAUDE.md`, `README.md`, `docs/superpowers/notes/2026-10-xx-chiusura-migrazione.md` (al posto dell'handover) | Documenti (Task 7 e 11). |

---

### Task 1: Rete di sicurezza, baseline e misura dell'avvio (Builder)

**Files:**
- Create: `e2e/startup.config.ts`, `e2e/startup.measure.ts`
- Modify: `.gitignore`, `e2e/computed-styles.audit.ts`, `e2e/workspace-shell.spec.ts`, `e2e/startup.spec.ts`, `e2e/settings.spec.ts`, `e2e/theme-i18n.spec.ts`, `e2e/ai-composer.spec.ts`

Nessuna riga dell'app cambia. I test nuovi affermano **il comportamento di oggi**, difetti compresi (mai `test.fail`): i task che correggono li rovesciano. Già affermati da test esistenti, e quindi non ripetuti qui: il contatore «Generating… N s» come regione `aria-live` (`ai-review-bar.spec.ts:34`, Task 4), Scarta durante la generazione che scrive solo la nota (stesso test, Task 4), l'indice che resta su «Profili» (`settings-sections.spec.ts:59`, Task 5), Cronologia `disabled` senza documento (`workspace-shell.spec.ts:27`, Task 9), Salva chiave `disabled` (`settings-sections.spec.ts:77`, Task 9). R1 e R2 non si vedono in e2e (nessun percorso dell'interfaccia stacca `hmd-app`): i loro RED sono i test jsdom del Task 2.

- [ ] **Step 1: worktree, dipendenze e baseline dell'audit, prima di tutto.** Sul branch `lab/LAB-6-fase-8` (`git log --oneline -1` = l'ultimo commit di questo piano, sopra `0cb7652`):

```bash
npm ci                                    # mai un link simbolico a node_modules di un altro checkout
git log --oneline 0cb7652..HEAD -- src    # atteso: vuoto (solo documenti dopo il merge della 7b)
npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
git rev-parse HEAD > dist-baseline/BASELINE_SHA && cat dist-baseline/BASELINE_SHA
gzip -c dist/assets/index-*.js | wc -c    # atteso: 379234
```

- [ ] **Step 2: conteggi di partenza.** `npm test` (atteso **1045**), `npm run lint` pulito. Le suite complete **non** si lanciano qui (le misure di partenza sono nel paragrafo «Misure»: 202, 187, 136): solo i file toccati, allo Step 7.

- [ ] **Step 3: misura dell'avvio.** Build della fase 3 in un worktree separato, copiata nel checkout (fuori da git):

```bash
git worktree add --detach ../housemd-phase3 a3ebc6f
(cd ../housemd-phase3 && npm ci && npm run build)
cp -r ../housemd-phase3/dist dist-phase3
gzip -c dist-phase3/assets/index-*.js | wc -c    # atteso: 432419
```

Aggiungere `dist-phase3` a `.gitignore`, subito sotto `dist-baseline`. Creare `e2e/startup.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * Tempo di avvio della build di oggi contro la build della fase 3 (React 19, `a3ebc6f`), spec §7 «Fase 8».
 * Prima: la build della fase 3 in `dist-phase3/` (worktree detached su a3ebc6f, `npm ci && npm run build`,
 * poi `cp -r dist <qui>/dist-phase3`). Poi, dentro il lock dei browser:
 *   E2E_WORKERS=1 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/startup.config.ts
 * Il risultato (mediane e singoli giri) va in `test-results/startup.json` e nell'output.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
export const CURRENT_PORT = 4180;
export const PHASE3_PORT = 4181;

export default defineConfig({
  testDir: '.',
  testMatch: 'startup.measure.ts',
  outputDir: '../test-results/startup',
  workers: 1,
  reporter: [['list']],
  timeout: 15 * 60_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${CURRENT_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${CURRENT_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npx vite preview --outDir dist-phase3 --port ${PHASE3_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${PHASE3_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
```

e `e2e/startup.measure.ts` (unica eccezione dichiarata alla regola «solo ruoli e nomi»: è una misura, non un test, e deve funzionare identica sulla build React della fase 3, dove il contenuto dell'editor non ha nome; i selettori sono `nav[aria-label="Folder files"]` e `.cm-content`):

```ts
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

import { DEFAULT_FLAGS, FLAGS_KEY, harnessScript, seedFolder } from './support/fsHarness.ts';
import { CURRENT_PORT, PHASE3_PORT } from './startup.config.ts';

/**
 * Due misure per giro, prese nella pagina con `performance.now()` (millisecondi dall'inizio della navigazione):
 * - `start`: profilo nuovo (cache vuota), prima apertura → il pulsante «Open folder» compare nel DOM;
 * - `reopen`: stessa scheda dopo aver aperto una cartella di 60 file e un documento, ricarica → albero
 *   e testo del documento nel DOM (ripresa all'avvio, cache HTTP calda).
 * I giri alternano le due build per non favorirne una con il carico della macchina. Il DOM delle due build è
 * lo stesso (stessi tag, stessi nomi accessibili): gli osservatori valgono per entrambe.
 */
const ROUNDS = Number(process.env.STARTUP_ROUNDS ?? 21);
const BUILDS = [
  { name: 'phase3', url: `http://localhost:${PHASE3_PORT}` },
  { name: 'current', url: `http://localhost:${CURRENT_PORT}` },
] as const;
const FILES = Object.fromEntries(
  Array.from({ length: 60 }, (_, i) => [`dir${i % 6}/note-${i}.md`, `# Note ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(40)}\n`]),
);

function marks(): void {
  const w = window as unknown as Record<string, number | undefined>;
  const check = () => {
    if (w.__hmdStart === undefined && [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Open folder'))) {
      w.__hmdStart = performance.now();
    }
    if (w.__hmdReopen === undefined && document.querySelector('nav[aria-label="Folder files"]') && document.querySelector('.cm-content')?.textContent?.includes('Note 7')) {
      w.__hmdReopen = performance.now();
    }
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

test('startup: current build against phase 3', async ({}, testInfo) => {
  const results: Record<string, { start: number[]; reopen: number[] }> = { phase3: { start: [], reopen: [] }, current: { start: [], reopen: [] } };
  for (let round = 0; round < ROUNDS; round++) {
    for (const build of round % 2 ? [...BUILDS].reverse() : BUILDS) {
      const dir = await mkdtemp(join(tmpdir(), 'hmd-startup-'));
      const context = await chromium.launchPersistentContext(dir, { ...testInfo.project.use, baseURL: build.url, deviceScaleFactor: 1 });
      try {
        const page = context.pages()[0] ?? (await context.newPage());
        await page.addInitScript(harnessScript, { defaults: DEFAULT_FLAGS, key: FLAGS_KEY });
        await page.addInitScript(() => localStorage.setItem('housemd:locale', JSON.stringify('en')));
        await page.addInitScript(marks);
        await page.goto('/');
        await page.waitForFunction(() => (window as unknown as { __hmdStart?: number }).__hmdStart !== undefined, null, { timeout: 15_000 });
        results[build.name].start.push(await page.evaluate(() => (window as unknown as { __hmdStart: number }).__hmdStart));
        await seedFolder(page, DEFAULT_FLAGS.folder, FILES);
        await page.getByRole('button', { name: 'Open folder' }).click();
        await page.getByRole('navigation', { name: 'Folder files' }).getByText('dir1', { exact: true }).click();
        await page.getByRole('button', { name: 'note-7.md', exact: true }).click();
        await expect(page.locator('.cm-content')).toContainText('Note 7');
        await page.reload();
        await page.waitForFunction(() => (window as unknown as { __hmdReopen?: number }).__hmdReopen !== undefined, null, { timeout: 15_000 });
        results[build.name].reopen.push(await page.evaluate(() => (window as unknown as { __hmdReopen: number }).__hmdReopen));
      } finally {
        await context.close();
        await rm(dir, { recursive: true, force: true });
      }
    }
  }
  const summary = Object.fromEntries(
    Object.entries(results).map(([name, r]) => [name, { startMedian: Math.round(median(r.start)), reopenMedian: Math.round(median(r.reopen)), ...r }]),
  );
  console.log(JSON.stringify(summary, null, 1));
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/startup.json', JSON.stringify(summary, null, 1));
});
```

Lanciare **dentro il lock, da solo**: `E2E_WORKERS=1 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/startup.config.ts` (circa 1 minuto e mezzo con 21 giri). Atteso (misurato scrivendo il piano): `phase3` `start` ≈ 206 ms, `reopen` ≈ 228 ms; `current` `start` ≈ 139 ms, `reopen` ≈ 220 ms. Incollare nel commento finale le due mediane per build e gli intervalli p25–p75 (da `test-results/startup.json`). A fine misura `pgrep -af "vite|chrom|playwright"`: le due `vite preview` le chiude Playwright; chiudere solo i propri PID rimasti. Il worktree `../housemd-phase3` si rimuove (`git worktree remove ../housemd-phase3`); `dist-phase3/` resta nel checkout per il Task 11.

- [ ] **Step 4: tre stati di audit in `forced-colors`.** In `e2e/computed-styles.audit.ts`, subito dopo la chiusura dell'array `STATES`:

```ts
// Rete della fase 8 (Task 1): tre stati già noti, ripresi in forced-colors (icone, voce corrente, modalità,
// separatore). Oggi registrano il difetto (sfondi portati a Canvas); il Task 10 li cambia di proposito.
for (const [name, from] of [
  ['forced-colors-workspace', 'workspace-light'],
  ['forced-colors-settings', 'settings-profile'],
  ['forced-colors-review', 'ai-review'],
] as const) {
  STATES.push({ ...STATES.find((s) => s.name === from)!, name, scheme: 'light', forcedColors: true });
}
```

- [ ] **Step 5: e2e dei difetti di oggi.** In fondo a `e2e/workspace-shell.spec.ts`:

```ts
test('Hide sidebar from inside the sidebar: today the focus falls on the body (A1, the Task 3 of phase 8 moves it to Show sidebar)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await page.getByRole('button', { name: app.t('sidebar.hide'), exact: true }).click();
  await expect(app.tree()).toHaveCount(0);
  await expect(page.locator('body')).toBeFocused();
});
```

In fondo a `e2e/startup.spec.ts`:

```ts
test('after opening a folder from the start screen: today the focus is on the body (A2, the Task 2 of phase 8 moves it to the tree)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await expect(page.locator('body')).toBeFocused();
});
```

In fondo a `e2e/settings.spec.ts`:

```ts
test('Escape with unsaved changes: today nothing happens, no confirmation and the settings stay open (P5, the Task 5 of phase 8 fixes it)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  const settings = page.getByRole('region', { name: app.t('settings.title') });
  await settings.getByRole('link', { name: app.t('settings.aiPresets') }).click();
  // Eccezione della fase 7 (sezioni senza nome): la sezione dei preset per id, fino al Task 5.
  const presets = page.locator('#settings-ai-presets');
  await presets.getByRole('button').first().click();
  await presets.getByRole('textbox').first().fill('Changed');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(settings).toBeVisible();
});
```

In fondo a `e2e/theme-i18n.spec.ts` (resta verde per sempre: decisione 12):

```ts
test('changing the language from the keyboard keeps the focus on the select (A4: not reproduced without a screen reader)', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  const select = page.getByLabel(app.t('settings.language'));
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('html')).not.toHaveAttribute('lang', 'en');
  await expect(select).toBeFocused();
});
```

In `e2e/ai-composer.spec.ts`, nel `describe('composer')`, subito prima di «the Stop button stops the generation»:

```ts
  test('a double click on Send: today the second click stops the request just sent (the Task 4 of phase 8 keeps it going)', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await send(app).dblclick();
    await expect(send(app)).toBeVisible();
    expect(ai.requests).toBe(1);
    ai.release();
  });
```

- [ ] **Step 6: lint.** `npx tsc --noEmit -p e2e` e `npm run lint` puliti.

- [ ] **Step 7: i file toccati, in build e in sviluppo, e gli stati nuovi dell'audit** (uno alla volta, nel lock):

```bash
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/workspace-shell.spec.ts e2e/startup.spec.ts e2e/settings.spec.ts e2e/theme-i18n.spec.ts e2e/ai-composer.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/workspace-shell.spec.ts e2e/startup.spec.ts e2e/settings.spec.ts e2e/theme-i18n.spec.ts e2e/ai-composer.spec.ts
cat dist-baseline/BASELINE_SHA
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "forced-colors"
```

Attesi tutti verdi sull'app di oggi (i quattro stati con `forced-colors` nel nome: i tre nuovi e `focus-search-keyboard-forced-colors`; il progetto `baseline` gira comunque tutto). Un rosso qui vuol dire che il test non descrive l'app di oggi: si corregge il test, non l'app. A fine suite `pgrep -af "vite|chrom|playwright"`.

- [ ] **Step 8: commit** (piccoli, uno per gruppo: `test: misura ripetibile dell'avvio contro la fase 3`, `test: stati di audit in forced-colors`, `test: difetti di focus, Esc e doppio clic affermati come sono oggi`), `git -c core.hooksPath=/dev/null commit`, `git log --format=%B -n 3` senza `Co-authored-by`, push. Commento finale: `BASELINE_SHA`, conteggi (`npm test` 1045 invariato; e2e toccati, dev, audit con `-g`), misura dell'avvio, gzip.

**Esecuzione (prototipo, 12/10).** I test dello Step 5 e gli stati dello Step 4 girati sulla build di `0cb7652`: risultati nel paragrafo «Suite del prototipo».

### Task 2: `hmd-app` — risultati tardivi, avvio che riparte, focus dopo l'apertura (Builder)

**Files:**
- Modify: `src/app/switchFolder.ts` (+ `switchFolder.test.ts`), `src/elements/app/app.element.ts` (+ `app.dom.test.ts`), `src/elements/file-tree/file-tree.element.ts`, `src/elements/workspace/workspace.element.ts` (solo `focusStart()`), `e2e/startup.spec.ts`

R1, R2 (review della 7b) e A2. Il codice qui sotto è quello del prototipo, con i test verdi (decisione 3).

- [ ] **Step 1: test che falliscono** (RED da annotare). Le tre riproduzioni dell'allegato di LAB-54 diventano test di `app.dom.test.ts` (stesso `deps()` e `mount()` del file), più il focus (A2) e il `signal` di `switchFolder`:

```diff
diff --git a/src/app/switchFolder.test.ts b/src/app/switchFolder.test.ts
index 0bb0558..11e6908 100644
--- a/src/app/switchFolder.test.ts
+++ b/src/app/switchFolder.test.ts
@@ -234,3 +234,27 @@ test('switchGuard is released when the switch throws', async () => {
   );
   assert.equal(guard.active, false);
 });
+
+test('a switch whose caller goes away stops at the next await: nothing opens, nothing is disposed or saved', async () => {
+  // Interrotto durante ognuno dei quattro await: scelta, prima messa al sicuro, apertura, seconda messa al sicuro.
+  for (const at of ['pick', 'close1', 'open', 'close2'] as const) {
+    const abort = new AbortController();
+    const calls: string[] = [];
+    let closes = 0;
+    const result = await switchFolder({
+      signal: abort.signal,
+      pick: async () => (at === 'pick' && abort.abort(), 'handle'),
+      current: {
+        closeFile: async () => (++closes === (at === 'close1' ? 1 : 2) && at.startsWith('close') && abort.abort(), calls.push('closeFile'), true),
+        dispose: () => void calls.push('dispose'),
+      },
+      open: async () => (calls.push('open'), at === 'open' && abort.abort(), 'nuova'),
+      discard: (value) => void calls.push(`discard ${value}`),
+      persist: (value) => void calls.push(`persist ${value}`),
+    });
+    assert.deepEqual(result, { kind: 'cancelled' }, at);
+    assert.ok(!calls.includes('dispose') && !calls.some((c) => c.startsWith('persist')), `${at}: ${calls.join(', ')}`);
+    assert.equal(calls.includes('discard nuova'), at === 'open' || at === 'close2', `${at}: ${calls.join(', ')}`);
+    assert.equal(calls.includes('open'), at !== 'pick' && at !== 'close1', `${at}: ${calls.join(', ')}`);
+  }
+});
diff --git a/src/elements/app/app.dom.test.ts b/src/elements/app/app.dom.test.ts
index c751db3..e2c05ee 100644
--- a/src/elements/app/app.dom.test.ts
+++ b/src/elements/app/app.dom.test.ts
@@ -144,3 +144,60 @@ test('detached while the folder is opening: the folder opened afterwards is disp
   await waitFor(() => disposed.length === 1);
   assert.equal(el.screen, 'boot');
 });
+
+for (const mode of ['pick', 'resume'] as const) {
+  test(`detached while ${mode === 'pick' ? 'a picked folder' : 'the resumed folder'} opens: the late folder is disposed, nothing is shown, saved or published`, async () => {
+    let release: () => void = () => {};
+    const gate = new Promise<void>((resolve) => (release = resolve));
+    const disposed: string[] = [];
+    const { deps: d, log } = deps(
+      mode === 'resume' ? { loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false } : {},
+    );
+    const open = d.openWorkspace;
+    let opening = false;
+    d.openWorkspace = async (stored) => {
+      opening = true;
+      await gate;
+      const w = await open(stored);
+      const dispose = w.dispose.bind(w);
+      w.dispose = () => (disposed.push('w'), dispose());
+      return w;
+    };
+    const el = mount(d);
+    await waitFor(() => el.screen === (mode === 'resume' ? 'resume' : 'start'));
+    el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent(`hmd-start-${mode}`, { bubbles: true }));
+    await waitFor(() => opening);
+    el.remove();
+    release();
+    await waitFor(() => disposed.length === 1);
+    assert.equal(el.screen, mode === 'resume' ? 'resume' : 'start');
+    assert.deepEqual(log.filter((line) => line !== 'update none'), [], 'né setUpdateWorkspace con la cartella, né saveWorkspace');
+  });
+}
+
+test('detached and reattached while booting: the boot starts again, the old one stays void', async () => {
+  let release: () => void = () => {};
+  const gate = new Promise<void>((resolve) => (release = resolve));
+  let loads = 0;
+  const el = mount(deps({ loadWorkspace: async () => (++loads, await gate, null) }).deps);
+  el.remove();
+  document.body.append(el);
+  release();
+  await waitFor(() => el.screen === 'start');
+  assert.equal(loads, 2, 'un secondo avvio alla riconnessione');
+});
+
+test('the focus follows the folder: from the start screen button to the tree, after picking and after resuming', async () => {
+  for (const mode of ['pick', 'resume'] as const) {
+    const el = mount(deps(mode === 'resume' ? { loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false } : {}).deps);
+    await waitFor(() => el.screen === (mode === 'resume' ? 'resume' : 'start'));
+    const label = mode === 'resume' ? EN_MESSAGES['start.resume'].replace('{folder}', 'notes') : EN_MESSAGES['start.openFolder'];
+    const button = [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === label)!;
+    button.focus();
+    button.click();
+    await waitFor(() => el.screen === 'open');
+    const row = el.querySelector('hmd-file-tree [tabindex="0"]');
+    assert.ok(row !== null && document.activeElement === row, `${mode}: the tree row with the tab stop, not ${document.activeElement?.localName}`);
+    el.remove();
+  }
+});
```

RED atteso (misurato): `switchFolder.test.ts` 1 rosso («a switch whose caller goes away…»); `app.dom.test.ts` 4 rossi: i due «detached while … opens» (la cartella tardiva non viene eliminata, `log` contiene `update open` e, nella scelta, `save picked`), «detached and reattached while booting» (`waitFor` scade: la schermata resta `boot`), «the focus follows the folder» (`pick: … not body`).

- [ ] **Step 2: `switchFolder` con `signal`, `hmd-app` con la vita nel documento.**

```diff
diff --git a/src/app/switchFolder.ts b/src/app/switchFolder.ts
index c48a2b6..4aa487d 100644
--- a/src/app/switchFolder.ts
+++ b/src/app/switchFolder.ts
@@ -28,26 +28,38 @@ export async function switchFolder<H, T>(deps: {
    * cambio bloccato o fallito non fa riaprire al prossimo avvio una cartella mai davvero aperta.
    */
   persist?(value: T): void;
+  /**
+   * Il chiamante non c'è più (per esempio `hmd-app` staccato): ricontrollato dopo ogni `await`. Un cambio
+   * interrotto finisce come annullato, senza effetti: la cartella appena aperta si elimina, quella vecchia
+   * resta com'è e niente si salva.
+   */
+  signal?: AbortSignal;
 }): Promise<FolderSwitch<T>> {
+  const aborted = () => deps.signal?.aborted === true;
   let handle: H | null;
   try {
     handle = await deps.pick();
   } catch (err) {
     return { kind: 'error', detail: errorDetail(err) };
   }
-  if (handle === null) return { kind: 'cancelled' };
+  if (handle === null || aborted()) return { kind: 'cancelled' };
   try {
     // Documento non messo al sicuro: toast draftNotPersisted già mostrato dal Workspace.
     if (deps.current && !(await deps.current.closeFile())) return { kind: 'blocked' };
   } catch (err) {
     return { kind: 'error', detail: errorDetail(err) };
   }
+  if (aborted()) return { kind: 'cancelled' };
   let value: T;
   try {
     value = await deps.open(handle);
   } catch (err) {
     return { kind: 'error', detail: errorDetail(err) };
   }
+  if (aborted()) {
+    deps.discard?.(value);
+    return { kind: 'cancelled' };
+  }
   // Durante l'apertura (anche lunga: si leggono tutti i file) lo workspace vecchio è rimasto usabile:
   // l'utente può aver aperto un file e scritto. Si rimette al sicuro quello che c'è ADESSO; se non si
   // può, si rinuncia al cambio. Tra la fine di closeFile() e dispose() non c'è nessun await.
@@ -60,6 +72,10 @@ export async function switchFolder<H, T>(deps: {
     deps.discard?.(value);
     return { kind: 'error', detail: errorDetail(err) };
   }
+  if (aborted()) {
+    deps.discard?.(value);
+    return { kind: 'cancelled' };
+  }
   deps.current?.dispose();
   deps.persist?.(value);
   return { kind: 'opened', value };
diff --git a/src/elements/app/app.element.ts b/src/elements/app/app.element.ts
index 102ff4c..d0552b5 100644
--- a/src/elements/app/app.element.ts
+++ b/src/elements/app/app.element.ts
@@ -38,8 +38,12 @@ export class HmdApp extends HmdElement {
   #guard = switchGuard();
   #switching = false;
   #dbBlocked = false;
-  #booted = false;
-  #boot: AbortController | null = null;
+  /**
+   * Vita dell'app nel documento: si interrompe al distacco (non a `reconnect()`). Avvio, scelta e ripresa
+   * della cartella catturano il suo `signal` all'inizio e lo ricontrollano dopo ogni `await`: un risultato
+   * arrivato dopo il distacco si butta senza effetti (né schermata, né `setUpdateWorkspace`, né salvataggio).
+   */
+  #alive = new AbortController();
   #start: HmdStartScreen | null = null;
   #workspace: HmdWorkspace | null = null;
   #updateNotice: HmdUpdateNotice | null = null;
@@ -47,6 +51,9 @@ export class HmdApp extends HmdElement {
   #loop = new RenderLoop(this, {
     ready: () => !!this.#updates && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
     render: () => this.#render(this.#i18n!),
+    // Scelta o ripresa riuscita: il pulsante della schermata iniziale sparisce con il focus dentro.
+    focusScope: () => this.#start,
+    refocus: () => this.#workspace?.focusStart(),
   });
 
   get updates(): UpdateFlow | null { return this.#updates; }
@@ -67,35 +74,37 @@ export class HmdApp extends HmdElement {
   /** Schermata corrente (per i test). */
   get screen(): Screen['kind'] { return this.#screen.kind; }
 
+  connectedCallback(): void {
+    if (this.#alive.signal.aborted) this.#alive = new AbortController();
+    super.connectedCallback();
+    // L'avvio riparte a ogni collegamento finché la schermata è ancora `boot` (un avvio interrotto dal
+    // distacco resta interrotto: il suo risultato tardivo si butta).
+    if (this.#screen.kind === 'boot') this.#startBoot(this.#deps, this.#alive.signal);
+  }
+
   protected connect(signal: AbortSignal): void {
     const deps = this.#deps;
     signal.addEventListener('abort', deps.onDbBlocked(() => this.#set({ dbBlocked: true })), { once: true });
-    if (!this.#booted) {
-      this.#booted = true;
-      this.#startBoot(deps);
-    }
     if (this.#i18n) this.watch(this.#i18n, () => this.#loop.update(), signal);
   }
 
   disconnectedCallback(): void {
     super.disconnectedCallback();
-    this.#boot?.abort();
+    this.#alive.abort();
   }
 
   /** Avvio: la cartella salvata, riaperta se c'è ancora il permesso. Uno workspace aperto dopo il distacco si butta. */
-  #startBoot(deps: AppDeps): void {
+  #startBoot(deps: AppDeps, signal: AbortSignal): void {
     if (!deps.isSupported()) return this.#show({ kind: 'unsupported' });
-    const boot = (this.#boot = new AbortController());
     void (async () => {
       const stored = await deps.loadWorkspace().catch(() => null);
-      if (boot.signal.aborted) return;
+      if (signal.aborted) return;
       if (!stored) return this.#show({ kind: 'start' });
-      if (!(await deps.hasAccess(stored.handle))) {
-        if (!boot.signal.aborted) this.#show({ kind: 'resume', stored });
-        return;
-      }
+      const access = await deps.hasAccess(stored.handle);
+      if (signal.aborted) return;
+      if (!access) return this.#show({ kind: 'resume', stored });
       const workspace = await deps.openWorkspace(stored);
-      if (boot.signal.aborted) return workspace.dispose();
+      if (signal.aborted) return workspace.dispose();
       this.#show({ kind: 'open', stored, workspace });
     })();
   }
@@ -127,12 +136,14 @@ export class HmdApp extends HmdElement {
 
   #choose(): void {
     const deps = this.#deps;
+    const signal = this.#alive.signal;
     void this.#exclusive(async () => {
       const screen = this.#screen;
       const current = screen.kind === 'open' ? screen.workspace : null;
       const result = await switchFolder({
         pick: () => deps.pickFolder(),
         current,
+        signal,
         open: async (handle: FileSystemDirectoryHandle) => {
           // Una cartella già aperta in passato tiene il suo workspaceId (bozze e ultimo file restano suoi).
           const workspaceId = (await deps.knownWorkspaceId(handle).catch(() => null)) ?? crypto.randomUUID();
@@ -144,6 +155,7 @@ export class HmdApp extends HmdElement {
         // La cartella vecchia non si è potuta lasciare: quella nuova, già caricata, si butta.
         discard: ({ workspace }) => workspace.dispose(),
       });
+      if (signal.aborted) return;
       match(afterSwitch(result, current !== null))
         .with({ kind: 'show' }, ({ screen: next }) => this.#show(next))
         .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
@@ -154,11 +166,14 @@ export class HmdApp extends HmdElement {
 
   #resume(): void {
     const deps = this.#deps;
+    const signal = this.#alive.signal;
     void this.#exclusive(async () => {
       const screen = this.#screen;
       if (screen.kind !== 'resume') return;
-      if (!(await deps.requestAccess(screen.stored.handle))) return;
+      const granted = await deps.requestAccess(screen.stored.handle);
+      if (signal.aborted || !granted) return;
       const workspace = await deps.openWorkspace(screen.stored);
+      if (signal.aborted) return workspace.dispose();
       this.#show({ kind: 'open', stored: screen.stored, workspace });
     });
   }
```

- [ ] **Step 3: i due bersagli del focus.** In `src/elements/file-tree/file-tree.element.ts` il recupero esistente diventa un metodo pubblico:

```diff
diff --git a/src/elements/file-tree/file-tree.element.ts b/src/elements/file-tree/file-tree.element.ts
index dee118f..6b7fb39 100644
--- a/src/elements/file-tree/file-tree.element.ts
+++ b/src/elements/file-tree/file-tree.element.ts
@@ -76,12 +76,15 @@ export class HmdFileTree extends HmdElement {
     focusScope: () => this.#parts?.nav ?? null,
     // La riga con il focus è sparita (file eliminato o rinominato): il focus va sulla riga col tab stop
     // (il suo focusin ricalcola i tab stop).
-    refocus: () => {
-      const stop = tabStop(this.#items, this.#focused, this.#openPath);
-      if (stop !== null) this.#focusables.get(stop)?.focus();
-    },
+    refocus: () => this.focusTabStop(),
   });
 
+  /** Focus sulla riga col tab stop (il file aperto, o la prima riga): l'ingresso nell'albero da fuori. */
+  focusTabStop(): void {
+    const stop = tabStop(this.#items, this.#focused, this.#openPath);
+    if (stop !== null) this.#focusables.get(stop)?.focus();
+  }
+
   get nodes(): readonly TreeNode[] { return this.#nodes; }
   set nodes(value: readonly TreeNode[]) {
     value ??= [];
```

In `src/elements/workspace/workspace.element.ts`, subito sopra `get workspace()`:

```ts
  /**
   * Il primo focus dopo l'apertura della cartella (il pulsante della schermata iniziale è sparito): la riga col
   * tab stop dell'albero; con la sidebar nascosta, «Mostra sidebar» nella barra.
   */
  focusStart(): void {
    const tree = this.#slots.tree;
    if (tree) tree.focusTabStop();
    else this.#parts?.toggle.focus();
  }
```

- [ ] **Step 4: verde.** `npx tsx --import ./src/testing/assetHooks.ts --test --test-timeout=20000 src/app/switchFolder.test.ts src/elements/app/app.dom.test.ts src/elements/file-tree/*.test.ts` (atteso: tutto verde; `app.dom.test.ts` 10 test). Le tre riproduzioni dell'allegato, lanciate così come sono dalla radice del checkout (`npx tsx --import ./src/testing/assetHooks.ts --test review-app-lifecycle.test.ts`, file **non** committato), devono passare tutte e tre; poi il file si cancella.

- [ ] **Step 5: e2e rovesciato.** In `e2e/startup.spec.ts` il test del Task 1 diventa:

```ts
test('after opening a folder from the start screen the focus goes to the tree row with the tab stop (A2)', async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await expect(app.treeFile('a.md')).toBeFocused();
});
```

- [ ] **Step 6: gate.** `npm test` (atteso **1050** = 1045 + 4 + 1), `npm run lint`, `e2e/startup.spec.ts` in build e in sviluppo (nel lock), audit con `-g "start"` (stati della schermata iniziale invariati). Commit: `test: risultati tardivi e avvio di hmd-app (RED)`, poi `fix: hmd-app scarta i risultati tardivi e riparte dall'avvio dopo il distacco`, `fix: il focus va all'albero dopo l'apertura della cartella`.

### Task 3: `hmd-workspace` — focus quando la sidebar sparisce, Home/End, timer dei toast (Builder)

**Files:**
- Modify: `src/elements/workspace/workspace.element.ts` (+ `workspace.dom.test.ts`), `src/elements/workspace/layout.ts` (+ `layout.test.ts`), `src/elements/toasts/toasts.element.ts` (+ `toasts.dom.test.ts`), `e2e/workspace-shell.spec.ts`

A1, A5 e i timer dei toast (decisione 9). Codice del prototipo, test verdi.

- [ ] **Step 1: test che falliscono.** Nota: Ctrl+Maiusc+**E** è la modalità AI (`shortcutFor`), non A.

```diff
diff --git a/src/elements/toasts/toasts.dom.test.ts b/src/elements/toasts/toasts.dom.test.ts
index db9d28a..557eaf8 100644
--- a/src/elements/toasts/toasts.dom.test.ts
+++ b/src/elements/toasts/toasts.dom.test.ts
@@ -56,17 +56,39 @@ test('nodes are reused by key; the close button sends hmd-toast-dismiss', () =>
   el.remove();
 });
 
-test('info toasts close after 6 s, errors stay; a new items array restarts the info timers', () => {
+test('info toasts close 6 s after they appear, errors stay; a new items array keeps the running timers', () => {
   mock.timers.enable({ apis: ['setTimeout'] });
   try {
     const { el, dismissed } = mount();
     el.items = [info, error];
     mock.timers.tick(5000);
-    el.items = [info, error, { key: 'ws-2', kind: 'info', text: 'altro' }];
+    // Un array nuovo (un altro toast, un errore AI, la lingua) non riavvia il timer di ws-1.
+    el.items = [{ ...info }, error, { key: 'ws-2', kind: 'info', text: 'altro' }];
+    mock.timers.tick(1000);
+    assert.deepEqual(dismissed, ['ws-1']);
+    el.items = [error, { key: 'ws-2', kind: 'info', text: 'altro' }];
+    mock.timers.tick(4000);
+    assert.deepEqual(dismissed, ['ws-1']);
+    mock.timers.tick(1000);
+    assert.deepEqual(dismissed, ['ws-1', 'ws-2']);
+    el.remove();
+  } finally {
+    mock.timers.reset();
+  }
+});
+
+test('a toast that goes and comes back with the same key starts a new timer', () => {
+  mock.timers.enable({ apis: ['setTimeout'] });
+  try {
+    const { el, dismissed } = mount();
+    el.items = [info];
+    mock.timers.tick(5000);
+    el.items = [];
+    el.items = [info];
     mock.timers.tick(5000);
     assert.deepEqual(dismissed, []);
     mock.timers.tick(1000);
-    assert.deepEqual(dismissed.sort(), ['ws-1', 'ws-2']);
+    assert.deepEqual(dismissed, ['ws-1']);
     el.remove();
   } finally {
     mock.timers.reset();
diff --git a/src/elements/workspace/layout.test.ts b/src/elements/workspace/layout.test.ts
index dade98f..01ce01c 100644
--- a/src/elements/workspace/layout.test.ts
+++ b/src/elements/workspace/layout.test.ts
@@ -34,6 +34,11 @@ test('arrow keys resize by 16px within the limits; other keys do nothing', () =>
   assert.equal(resizeByKey('sidebar', 475, 'ArrowRight'), 480);
   assert.equal(resizeByKey('ai', 305, 'ArrowLeft'), 300);
   assert.equal(resizeByKey('sidebar', 280, 'Enter'), null);
+  // Home e End (APG, window splitter): al minimo e al massimo del pannello.
+  assert.equal(resizeByKey('sidebar', 280, 'Home'), 180);
+  assert.equal(resizeByKey('sidebar', 280, 'End'), 480);
+  assert.equal(resizeByKey('ai', 380, 'Home'), 300);
+  assert.equal(resizeByKey('ai', 380, 'End'), 640);
 });
 
 test('grid columns: side panel, 5px resizer and the main area; only the main area when closed', () => {
diff --git a/src/elements/workspace/workspace.dom.test.ts b/src/elements/workspace/workspace.dom.test.ts
index 863d67a..6b004d8 100644
--- a/src/elements/workspace/workspace.dom.test.ts
+++ b/src/elements/workspace/workspace.dom.test.ts
@@ -248,3 +248,41 @@ test('detached: no store or window listener is left', async () => {
   window.dispatchEvent(unload);
   assert.equal(unload.defaultPrevented, false);
 });
+
+test('the focus never falls on the body when the sidebar goes: Hide sidebar and Ctrl+B to the toolbar toggle, AI mode to its button', async () => {
+  const { el, workspace, button } = await mount({ ai: true });
+  await workspace.openFile('a.md');
+  const focusOn = (node: Element | null, what: string) => assert.ok(node !== null && document.activeElement === node, `${what}, not ${document.activeElement?.localName}`);
+  // «Hide sidebar» dentro la sidebar: il pulsante sparisce con lei.
+  const hide = el.querySelector<HTMLButtonElement>(`aside button[aria-label="${EN_MESSAGES['sidebar.hide']}"]`)!;
+  hide.focus();
+  hide.click();
+  assert.equal(el.querySelector('aside'), null);
+  focusOn(button(EN_MESSAGES['sidebar.show']), 'Show sidebar in the toolbar');
+  // Ctrl+B con il focus nella ricerca.
+  toggleSidebar();
+  el.querySelector<HTMLInputElement>('hmd-search-panel input')!.focus();
+  toggleSidebar();
+  focusOn(button(EN_MESSAGES['sidebar.show']), 'Show sidebar after Ctrl+B');
+  // Modalità AI con il focus nell'albero: l'albero lascia il posto alla chat.
+  toggleSidebar();
+  el.querySelector<HTMLElement>('hmd-file-tree [tabindex="0"]')!.focus();
+  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }));
+  assert.ok(el.querySelector('hmd-ai-sidebar'));
+  focusOn(button(EN_MESSAGES['mode.ai']), 'the AI mode button');
+  // Con il focus fuori dalla sidebar non si sposta niente.
+  button(EN_MESSAGES['mode.split']).focus();
+  button(EN_MESSAGES['mode.split']).click();
+  toggleSidebar();
+  focusOn(button(EN_MESSAGES['mode.split']), 'the button that had it');
+});
+
+test('the separator: Home and End take the panel to its minimum and maximum', async () => {
+  const { el } = await mount();
+  const separator = el.querySelector<HTMLElement>('[role="separator"]')!;
+  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
+  assert.equal(separator.getAttribute('aria-valuenow'), '180');
+  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
+  assert.equal(separator.getAttribute('aria-valuenow'), '480');
+  assert.equal(storage.get('housemd:sidebarWidth'), '480');
+});
```

RED atteso (misurato): `layout.test.ts` «arrow keys resize…» (Home → `null`); `workspace.dom.test.ts` «the focus never falls on the body…» (`Show sidebar in the toolbar, not body`) e «the separator: Home and End…»; `toasts.dom.test.ts` «info toasts close 6 s after they appear…» (a 6 s `ws-1` non è ancora chiuso: il suo timer è ripartito con l'array nuovo).

- [ ] **Step 2: Home ed End** in `layout.ts`:

```diff
diff --git a/src/elements/workspace/layout.ts b/src/elements/workspace/layout.ts
index f781fa0..32455fe 100644
--- a/src/elements/workspace/layout.ts
+++ b/src/elements/workspace/layout.ts
@@ -36,10 +36,12 @@ export function clampWidth(panel: SidePanel, width: number): number {
   return Math.min(max, Math.max(min, panel === 'sidebar' ? Math.round(width) : width));
 }
 
-/** Nuova larghezza dopo una freccia sinistra/destra, oppure null per gli altri tasti. */
+/** Nuova larghezza dopo una freccia sinistra/destra, Home (minimo) o End (massimo); null per gli altri tasti. */
 export function resizeByKey(panel: SidePanel, width: number, key: string): number | null {
   if (key === 'ArrowLeft') return clampWidth(panel, width - RESIZE_STEP);
   if (key === 'ArrowRight') return clampWidth(panel, width + RESIZE_STEP);
+  if (key === 'Home') return WIDTH_LIMITS[panel].min;
+  if (key === 'End') return WIDTH_LIMITS[panel].max;
   return null;
 }
 
```

- [ ] **Step 3: recupero del focus nel workspace.** Nel `RenderLoop` di `workspace.element.ts` (il bersaglio è un pulsante fisso della barra: «Mostra sidebar» se la sidebar non c'è più, il pulsante della modalità AI se la chat ha sostituito l'albero):

```ts
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#workspace && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#parts!, this.#workspace!, this.#i18n!),
    // La sidebar (o il suo contenuto) è sparita con il focus dentro: «Nascondi», Ctrl+B nell'albero o nella
    // ricerca, modalità AI che sostituisce l'albero con la chat. Il focus va su un pulsante fisso della barra.
    focusScope: () => this.#slots.aside ?? null,
    refocus: () => {
      const parts = this.#parts!;
      (this.#sidebarOpen && this.#shown === 'ai' ? parts.modeButtons.get('ai')! : parts.toggle).focus();
    },
  });
```

`focusScope` si legge prima del render: è l'`aside` di prima, anche quando il render lo toglie. Con il focus fuori dalla sidebar (un pulsante della barra) il recupero non scatta (ultimo blocco del test).

- [ ] **Step 4: timer dei toast per chiave.**

```diff
diff --git a/src/elements/toasts/toasts.element.ts b/src/elements/toasts/toasts.element.ts
index 642d3c2..6b2ec47 100644
--- a/src/elements/toasts/toasts.element.ts
+++ b/src/elements/toasts/toasts.element.ts
@@ -18,20 +18,22 @@ const INFO_TIMEOUT_MS = 6000;
 
 /**
  * Toast in basso a destra (era Toasts.tsx): popover `manual` aperto finché ci sono toast. I toast
- * informativi si chiudono dopo 6 s; come l'effetto React di prima, ogni nuovo array `items` riavvia i timer.
+ * informativi si chiudono 6 s dopo la loro comparsa: un array `items` nuovo (un altro toast, un errore AI, la
+ * lingua) avvia solo i timer dei toast nuovi e ferma quelli dei toast spariti, per chiave.
  */
 export class HmdToasts extends HmdElement {
   #items: readonly ToastItem[] = [];
   #i18n: I18nStore | null = null;
   #box: HTMLDivElement | null = null;
   #open = false;
-  #timers: ReturnType<typeof setTimeout>[] = [];
+  /** Chiave del toast informativo → il suo timer. */
+  #timers = new Map<string, ReturnType<typeof setTimeout>>();
 
   get items(): readonly ToastItem[] { return this.#items; }
   set items(value: readonly ToastItem[]) {
     this.#items = value ?? [];
     this.#render();
-    if (this.isConnected) this.#restartTimers();
+    if (this.isConnected) this.#syncTimers();
   }
   get i18n(): I18nStore | null { return this.#i18n; }
   set i18n(value: I18nStore | null) {
@@ -45,7 +47,7 @@ export class HmdToasts extends HmdElement {
     this.#box ??= this.appendChild(el('div', { class: 'toasts', popover: 'manual' }));
     if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
     else this.#render();
-    this.#restartTimers();
+    this.#syncTimers();
     // Il signal si interrompe al distacco e al reconnect: i timer ripartono in entrambi i casi.
     signal.addEventListener('abort', () => this.#clearTimers(), { once: true });
   }
@@ -85,16 +87,22 @@ export class HmdToasts extends HmdElement {
     }
   }
 
-  #restartTimers(): void {
-    this.#clearTimers();
-    this.#timers = this.#items
-      .filter((item) => item.kind === 'info')
-      .map((item) => setTimeout(() => emit(this, 'hmd-toast-dismiss', { key: item.key }), INFO_TIMEOUT_MS));
+  /** Un timer per ogni toast informativo presente: i nuovi partono, quelli già avviati continuano, gli altri si fermano. */
+  #syncTimers(): void {
+    const keys = new Set(this.#items.filter((item) => item.kind === 'info').map((item) => item.key));
+    for (const [key, timer] of this.#timers) {
+      if (keys.has(key)) continue;
+      clearTimeout(timer);
+      this.#timers.delete(key);
+    }
+    for (const key of keys) {
+      if (!this.#timers.has(key)) this.#timers.set(key, setTimeout(() => emit(this, 'hmd-toast-dismiss', { key }), INFO_TIMEOUT_MS));
+    }
   }
 
   #clearTimers(): void {
     this.#timers.forEach(clearTimeout);
-    this.#timers = [];
+    this.#timers.clear();
   }
 }
 
```

e in `workspace.element.ts` il commento sopra l'array dei toast:

```diff
-    // Un array nuovo solo quando cambiano toast, errore AI o lingua (lo useMemo di React): i toast riavviano i timer a ogni array.
+    // Un array nuovo solo quando cambiano toast, errore AI o lingua (lo useMemo di React); i timer sono per chiave in hmd-toasts.
```

- [ ] **Step 5: e2e rovesciato.** In `e2e/workspace-shell.spec.ts` il test A1 del Task 1 diventa:

```ts
test('Hide sidebar from inside the sidebar: the focus goes to Show sidebar in the toolbar (A1)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await page.getByRole('button', { name: app.t('sidebar.hide'), exact: true }).click();
  await expect(app.tree()).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('sidebar.show'), exact: true })).toBeFocused();
});
```

- [ ] **Step 6: gate.** `npm test` (atteso **1053** = 1050 + 2 workspace + 1 toasts), `npm run lint`; `e2e/workspace-shell.spec.ts` ed `e2e/editor.spec.ts` (sidebar e separatore) in build e in sviluppo; audit con `-g "sidebar|resizer|toast|workspace"` invariato. Commit: `test: …(RED)`, `fix: il focus resta nella barra quando la sidebar sparisce`, `feat: Home ed End sul separatore`, `fix: i timer dei toast partono una volta per toast`.
