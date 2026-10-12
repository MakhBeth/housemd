# HouseMD Web Components — Piano 14: fase 8, rifinitura e passata di accessibilità

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere la migrazione a Web Components (spec §7 «Fase 8»): correggere i rilievi aperti di ciclo di vita, focus e annunci (review finale della 7b, LAB-42 P1–P12, handover 6c, 7 e 8), applicare a tutta l'app la regola di Davide «i pulsanti non diventano mai `disabled`», rendere distinguibili in `forced-colors` gli stati segnati solo dal colore, togliere i tre `!important` dei pulsanti del merge, misurare bundle e tempo di avvio contro la fase 3 e preparare la richiesta di merge dell'epica in `main` (la checklist §9 per Davide nella nota di chiusura; PR verso `main` e sub-issue «[Davide]» le apre il PM dopo il merge dell'8b). Due sotto-fasi (decisione 1): **8a** senza cambi d'aspetto voluti (comportamento, focus, annunci, nomi accessibili, refactoring), **8b** con i cambi d'aspetto passati prima da Designer (note «mai disabled», contorni in `forced-colors`, regioni live sempre presenti) e la chiusura della migrazione. Fuori: la rimozione dei toast (lavoro a sé dopo la migrazione); dei toast si corregge solo il riavvio dei timer, perché la correzione è piccola e misurata (decisione 9).

**Architecture:** Nessun elemento nuovo. Le correzioni stanno negli elementi esistenti e, dove c'è una regola, in un modulo puro o in un helper del DOM testato da solo: `switchFolder` impara a fermarsi a metà (`signal`), `hmd-app` ha una vita nel documento (un `AbortController` che si interrompe al distacco, non a `reconnect()`) e riparte dall'avvio se viene riattaccato mentre la schermata è ancora `boot`; il recupero del focus usa il `focusScope`/`refocus` di `RenderLoop` già esistente (workspace, app, profili, preset), con bersagli stabili nuovi esposti come metodi (`hmd-file-tree.focusTabStop()`, `hmd-workspace.focusStart()`); il ri-annuncio della stessa nota passa da un helper nuovo, `src/dom/announce.ts` (svuota la regione e riscrive il testo dopo una pausa vera, `ANNOUNCE_DELAY_MS` = 150 ms); le forme singolare e plurale da `pluralKey()` in `src/i18n/i18n.ts` (`Intl.PluralRules`, chiavi `<base>.one`/`<base>.other`); la sezione corrente dell'indice delle impostazioni da una funzione pura nuova in `settingsView.ts`. La regola «mai disabled» riusa lo schema della 6b e della 6c (nota `role="status"` accanto al pulsante, ragione calcolata da una funzione pura o dal controller, focus che resta sul pulsante). I contorni in `forced-colors` stanno in `@media (forced-colors: active)` dentro i fogli degli elementi (e in `global.css` per le icone), sempre nel layer `components` con `@scope`. I tre `!important` di `diff-pane.css` diventano un `StyleModule` di CodeMirror registrato dalla vista del diff (analisi del layer `vendor` nel piano 6c, decisione 10 di quel piano).

**Tech Stack:** TypeScript 7, Custom Elements, CSS `@scope`/`@layer`, `@media (forced-colors: active)`, `Intl.PluralRules`, CodeMirror 6 (`StyleModule` di `style-mod`, `EditorView.contentAttributes`), `tsx --test` con jsdom 30, Playwright 1.63 (`forcedColors: 'active'`).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincolo 4 «pulsanti mai disattivati»; §5.1–5.4; §7 «Fase 8»; §8.4; §9 tutta, checklist manuale compresa; §10 R1–R3, R11, R16; §11; §13); handover `docs/superpowers/notes/2026-10-12-handover-fase-8.md` (la fonte: «Per la fase 8», «Regola UX di Davide», «Lezioni nuove della fase 7», «Trappole dell'ambiente»), `2026-10-11-handover-fase-7.md` («Per la fase 8», «Lezioni nuove della 6c») e `2026-10-11-handover-fase-6c.md` («Lezioni da mettere nei piani»); LAB-42 (P1–P12), LAB-6, la review finale della 7b su LAB-48 (R1, R2, A1–A5); piani `2026-10-12-housemd-wc-13-fase-7-impostazioni-workspace-app.md` (il modello di questo) e `2026-10-11-housemd-wc-12-fase-6c-revisione.md` («Analisi del layer `vendor`»).

## Global Constraints

- **Branch** `lab/LAB-6-fase-8` creato da `epic/LAB-3-web-components` (merge della 7b `0cb7652`): ogni sub-issue di esecuzione dell'8a committa lì. PR in bozza #12 verso `epic/LAB-3-web-components`, aperta da questo piano (`gh pr create --draft --base epic/LAB-3-web-components`), portata a pronta dal task di chiusura dell'8a (`gh pr ready`). Con la divisione (decisione 1) la PR #12 è quella dell'8a; l'8b ha un branch `lab/LAB-6-fase-8b` creato da `epic/LAB-3-web-components` **dopo** il merge dell'8a, e una PR in bozza sua. Commit piccoli in italiano, all'imperativo, prefisso convenzionale (`test:`, `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), niente emoji, **nessuna riga di attribuzione**. Il daemon di Multica installa un hook `prepare-commit-msg` che aggiunge `Co-authored-by: multica-agent`: si committa con `git -c core.hooksPath=/dev/null commit …` e prima di ogni push si controlla `git log --format=%B -n <N>`. Mai push su `main` né sul branch dell'epica, nessun merge: la PR la mergia il PM dopo la review (Reviewer, A11y) e i gate verdi. Verso `main` mergia solo Davide.
- **Task 1 prima di tutto**: la rete di sicurezza è scritta e verde **sull'app di oggi** (i difetti noti affermati come sono oggi, oppure rossi con il RED annotato), `dist-baseline/` costruita dal branch **prima di qualsiasi modifica all'app** (`git rev-parse HEAD > dist-baseline/BASELINE_SHA`, atteso `0cb7652` più i soli commit di test e documenti), conteggi delle suite, gzip del bundle e tempo di avvio annotati.
- **`dist-baseline/`: un solo rito, in 8a e in 8b.** Il Task 1 la costruisce da `0cb7652` (più i soli commit di test e documenti). Un task che cambia di proposito lo stile calcolato di qualche stato la rinnova **una volta**, sempre così: (1) prima del cambio l'audit **con `-g` sugli stati toccati** è verde contro la baseline corrente; (2) dopo il cambio lo stesso `-g` cade **solo** negli stati elencati dal task e **solo** sulle proprietà elencate (le righe di `styleDifferences` si incollano nel commento finale); (3) si ricostruisce la baseline dal commit del task (`npm run build && rm -rf dist-baseline && cp -r dist dist-baseline && git rev-parse HEAD > dist-baseline/BASELINE_SHA`) e lo stesso `-g` torna verde. Mai l'audit completo dentro un task: le suite complete girano solo nei Task 7 e 11. Con `-g` il progetto `baseline` gira comunque tutto, perché in Playwright 1.63 `current` dipende da `baseline` (e una sua instabilità nota ferma `current`: si ripete). Nell'8a rinnovano la baseline il **Task 2** (2 stati), il **Task 4** (10 stati) e il **Task 5** (2 stati): 14 stati in tutto, elencati in «Cambi d'aspetto»; i Task 3 e 6 la lasciano com'è. Nell'8b la rinnovano i Task 8, 9 e 10. Ogni audit si lancia dopo `cat dist-baseline/BASELINE_SHA`. Attraversando il confine 8a/8b la baseline si copia dal checkout della chiusura dell'8a (strada (a), `BASELINE_SHA` = il commit del Task 5, l'ultimo che l'ha rinnovata) o si ricostruisce in un worktree separato da quello SHA (strada (b)); mai da una build di un commit sconosciuto.
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

Misure sul prototipo finale (8a + le regole `forced-colors` dell'8b, senza le note «mai disabled»), nel lock, 2 worker, nessuna caduta per memoria, nessun processo appeso:

| | Partenza (`0cb7652`) | Prototipo finale |
|---|---|---|
| `npx tsc --noEmit`, `npm run lint` | puliti | puliti |
| `npm test` | 1045 (52 s) | **1075** (+30 test nuovi; 6 test esistenti rinominati o riscritti, che non cambiano il conteggio; dettaglio per task negli Step «gate») |
| `npm run test:e2e` | 202 (200 + 2 noti), 3,0 min | **208** (206 + i 2 noti dello start screen), 2,7 min; snapshot invariati. Con le correzioni della review il Task 2 aggiunge 2 e2e (cartella vuota, decisione 18): attesi 210, verdi nei file toccati |
| `npm run test:e2e:dev` | 187, 5,4 min | **193**, 5,0 min, console pulita (attesi 195 con i 2 del Task 2) |
| `npm run test:e2e:audit` | 136, 4,2 min | 136 (125 verdi + 11 stati che cambiano **di proposito**, elencati qui sotto), 4,3 min; dopo le correzioni della review rimisurato solo con `-g`: gli stati dell'8a che cambiano diventano 14 |
| bundle principale gzip | 379 234 B | **380 493 B** (+1 259 B: testi nuovi in nove lingue, `announce`, `pluralKey`, regole) |
| avvio, `start` / `reopen` (21 giri, mediana) | 139 / 220 ms (fase 3: 206 / 228) | **138 / 215 ms** (fase 3 nello stesso giro: 204 / 239) |

Gli 8 stati `forced-colors-*` del Task 1 (4 schermate in chiaro e in scuro) non sono nel conteggio della tabella: provati a parte sulla build di oggi (Task 1, «Esecuzione»). I conteggi della tabella sono del primo giro; le correzioni della review (A–I del PM) portano `npm test` a 1075 (misurato) e cambiano gli stati di audit come sotto (misurato con `-g`). Differenze dell'audit contro la build di `0cb7652`, **tutte previste** e nessun'altra:

- Task 2 (A2): `workspace-empty`, `toast`: `…>nav:2>ul:0>li:0>div:0>button:1 { opacity: 0 → 1 }` (aperta la cartella, il focus è sulla prima riga dell'albero e la riga con il focus mostra il suo «⋯»);
- Task 4: `ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-chat-summary`, `ai-review-generating`, `ai-review-note`, `ai-composer-running`: `…>hmd-ai-review-bar:0>span:2: nuovo` (P1: la regione nascosta, in generazione o con l'esito «Proposal ready»); `ai-review-truncated`, `ai-review-warnings`: la stessa riga più il tooltip `content: "1 warnings" → "1 warning"`, `width: 80px → 73px` (P4); `ai-composer-note-no-document`: la nota più lunga va su più righe (12 righe di altezze e origini nella sidebar AI, LAB-10);
- Task 5: `settings-preset`, `settings-sync-folder`: la voce corrente dell'indice (`background-color` su `a:3`/`a:4` invece di `a:2`);
- nessuna differenza dai tre `!important` diventati `StyleModule` (misurato al primo giro, prima dell'esito di P1: stati `ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-review-applied` verdi; `ai-review-applied` resta verde anche dopo);
- solo 8b: `focus-search-keyboard-forced-colors` e gli 8 `forced-colors-*` (le icone prendono `CanvasText`, le voci correnti `Highlight`).

Misurato anche:

- **R1 e R2 nel dettaglio.** Con `hmd-app` staccato mentre `openWorkspace` è sospeso, oggi lo workspace aperto dopo il distacco viene pubblicato (`setUpdateWorkspace`), la schermata diventa `open` e, nella scelta, la cartella viene salvata come corrente; con il Task 2 il risultato tardivo si butta (`dispose`), niente si salva né si pubblica, la schermata resta quella di prima. Staccata e riattaccata durante `loadWorkspace`, oggi l'app resta su `boot` per sempre; con il Task 2 l'avvio riparte e il vecchio resta senza effetto (`loads === 2`). `switchFolder` impara a fermarsi dopo ognuno dei suoi quattro `await` (test su tutti e quattro i punti).
- **Esc nelle impostazioni (P5)**, nel browser: oggi, con un preset modificato, Esc non apre nessuna conferma e le impostazioni restano aperte (il dialog si apre e si richiude nello stesso tasto); con `event.preventDefault()` prima di `#close()` il dialog resta aperto con il focus su «Annulla». jsdom non lo vede (nessuna richiesta di chiusura), serve l'e2e.
- **L'indice delle impostazioni**, nel browser (1280×800, quattro sezioni): saltando a «AI · Sync» il contenitore arriva in fondo (`scrollTop` 819 = `scrollHeight` 1619 − 800) con Sync a 325 px dall'alto, fuori dalla fascia del 40 % (320 px); Profili (−56 px, alto 117) e Preset (102 px) sono nella fascia e la regola di oggi («la più in alto tra quelle che si intersecano») sceglie Profili. Anche saltando a Preset l'indice dice Profili. Con la regola nuova (decisione 6) i tre salti segnano Sync, Preset, Profili, e la rotella dopo un salto torna a seguire lo scorrimento.
- **A4 non si riproduce in Chromium senza screen reader**: cambiando lingua dalla select con `selectOption` o con Freccia giù (la lingua cambia davvero) il focus resta sulla select, lo stesso `hmd-settings` resta collegato. L'unico `focus()` sul titolo è in `connect` alla prima connessione. La causa va cercata con lo screen reader (decisione 12).
- **Le icone in `forced-colors`**: oggi `background-color` dell'icona diventa Canvas (misurato: `rgb(255, 255, 255)` su sfondo bianco, la barra degli strumenti è vuota); con il solo `forced-color-adjust: none` l'icona prende il colore d'autore (`rgb(31, 29, 26)`), invisibile con un tema scuro ad alto contrasto; con `CanvasText` (proposta di LAB-42) è nera su bianco e bianca su nero, e con `HighlightText` sui pulsanti premuti resta leggibile sullo sfondo `Highlight`. Provato con `forcedColors: 'active'` in schema chiaro e scuro.
- **Scarta durante la generazione, prima che arrivi una proposta**: `hmd-ai-review` chiamava `discard` solo con una proposta già presente, quindi Scarta non avrebbe fermato niente anche togliendo la nota. Il Task 4 usa il percorso del documento (`controller.discard(path)` ferma la richiesta in corso su quel percorso). Trovato dall'e2e del prototipo.
- **L'orologio finto di Playwright ferma la pausa di `announce`**: con `page.clock.install()` la nota ri-annunciata (svuotata e riscritta dopo `ANNOUNCE_DELAY_MS`, Task 4) resta vuota finché il test non fa avanzare l'orologio (`page.clock.runFor(200)`, e il resto del tempo del test si conta da lì: misurato, «Generating… 2 s» arriva con `runFor(1500)` dopo tre pause). Vale per ogni e2e che clicca due volte lo stesso pulsante bloccato con l'orologio installato.
- **Il quarto `!important`** non sta su `.cm-activeLine` (come diceva il piano 6c) ma su `.cm-selectionBackground` in `docExtensions.ts`, e combatte il tema base di `@codemirror/view` (`&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`, specificità più alta): `Prec` da solo non basta (decisione 8).
- **`style-mod`** è già nel bundle (dipendenza di `@codemirror/view`, `4.1.4`): dichiararlo in `package.json` con la stessa versione esatta non cambia il bundle e non scarica nulla.

### Inventario

Ogni punto del perimetro: dove sta, la causa, il test che lo copre, se cambia l'aspetto (**no** = audit e snapshot invariati; **nodo** = un nodo nuovo invisibile, una riga «nuovo» nell'audit; **sì** = cambio visibile, passa da Designer), il task.

**Ciclo di vita e focus (review della 7b, A11y)**

| Id | Dove | Causa | Test | Aspetto | Task |
|---|---|---|---|---|---|
| R1 | `src/elements/app/app.element.ts:147` (`#choose`), `:160` (`#resume`); `src/app/switchFolder.ts` | dopo gli `await` nessuno controlla se l'app è ancora collegata: lo workspace tardivo arriva a `#show` (schermata `open`, `setUpdateWorkspace`) e, nella scelta, `switchFolder` chiama `persist` | `app.dom.test.ts` «detached while a picked folder opens…», «…the resumed folder opens…», «…being recognised (knownWorkspaceId)…»; `switchFolder.test.ts` «a switch whose caller goes away stops at the next await…» | no | 2 |
| R2 | `app.element.ts:73` e `:80` | `#booted = true` resta dopo il distacco che interrompe l'avvio: riattaccata, l'app non riparte e resta su `boot` | `app.dom.test.ts` «detached and reattached while booting…» | no | 2 |
| A2 | `app.element.ts:171` | il pulsante della schermata iniziale, con il focus, sparisce con la schermata; nessuno sposta il focus | `app.dom.test.ts` «the focus follows the folder…», «an empty folder…» («Nuovo file»), «the saved folder reopened by the boot…» (il focus non si sposta, decisione 18); e2e `startup.spec.ts` (tre casi) | il «⋯» della riga con il focus (audit, 2 stati) | 2 |
| A1 | `src/elements/workspace/workspace.element.ts:532` (slot `aside`), `:669` («Nascondi» nella sidebar), `#changeMode('ai')` | il `RenderLoop` del workspace non ha `focusScope`/`refocus`: «Nascondi», Ctrl+B nell'albero o nella ricerca, la modalità AI che sostituisce l'albero tolgono il nodo con il focus | `workspace.dom.test.ts` «the focus never falls on the body when the sidebar goes…», «leaving AI mode with the focus in the chat…»; e2e `workspace-shell.spec.ts` (nuovi casi) | no | 3 |
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
| Indice | `settings.element.ts:395-410`, `settingsView.ts:32` (`topSection`), `settings.css:63` (40vh) | la regola sceglie la sezione più in alto tra quelle nella fascia del 40 %: le ultime sezioni, corte, non diventano mai correnti | `settingsView.test.ts` «the current section: the last one whose top is in the upper 40 %…»; e2e `settings-sections.spec.ts` (rovesciato: Sync) | **voce segnata** (audit `settings-preset`, `settings-sync-folder`: la voce corrente è quella giusta) | 5 |
| P7 | `settings.css:57`, `sections.css:41` | voce corrente segnata solo da `--c-accent-soft`, che in `forced-colors` diventa Canvas | stato di audit `forced-colors-settings` (Task 1) | **sì** (solo `forced-colors`) | 10 |
| P8 | `profiles.element.ts:247`, `:312` | il `p[role=status]` «Connesso» entra nel DOM già scritto | `profiles.dom.test.ts` «Connection: … entering empty and written a frame later» | no (entra vuoto e il testo arriva dopo `ANNOUNCE_DELAY_MS`, con `announce`: decisione 4) | 5 |

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
| P2 | `src/styles/global.css:98` | l'icona è una maschera colorata da `background-color: currentColor`, che `forced-colors` porta a Canvas | audit `focus-search-keyboard-forced-colors` e `forced-colors-review` (Task 1) | **sì** (solo `forced-colors`) | 10 |
| A3 | `workspace.css:139`, `:231`, `:71` | modalità attiva, bozza orfana corrente e separatore (5 px) distinti solo dallo sfondo | stato di audit `forced-colors-workspace` (Task 1) | **sì** (solo `forced-colors`) | 10 |

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
| 1 | Regione live nascosta della generazione (`span.spoken`, `clip-path`), che a generazione finita dice l'esito fino alla prossima azione | nessuna parte: nodo nuovo invisibile | no | 8a, 4 |
| 1b | Una nota ri-annunciata sparisce per circa 150 ms (`ANNOUNCE_DELAY_MS`) e la barra perde per un attimo gli 8 px di `.note:not(:empty)` | barra della revisione, composer, Nuova chat, «Connesso» | no (A11y: conferma a chi vede che il clic è arrivato; il PM lo dice a Designer) | 8a, 4 e 5 |
| 1c | Il «⋯» della prima riga dell'albero visibile dopo l'apertura della cartella (la riga ha il focus) | albero, appena aperta una cartella | no (è il comportamento della riga con il focus) | 8a, 2 |
| 2 | Tooltip degli avvisi al singolare («1 warning») | tooltip al passaggio, nome accessibile | no | 8a, 4 |
| 3 | Testo della nota «nessun documento» in modalità AI, più lungo (LAB-10) | nota sotto il composer | no (testo: lo rivede il Reviewer; A11y conferma che dice dove andare) | 8a, 4 |
| 4 | Anello del focus sul titolo `h2` dopo un salto dall'indice da tastiera | impostazioni, solo da tastiera | no (è l'anello di sempre, `:focus-visible`) | 8a, 5 |
| 5 | **Note «mai disabled»** accanto a Salva chiave, Sincronizza ora, Cronologia (barra degli strumenti), cartella (testata della sidebar), pulsanti della schermata iniziale, Aggiorna; il pulsante attivo dove oggi è spento (`opacity`, `cursor: progress`, aspetto `disabled` del browser) | impostazioni, barra, sidebar, schermata iniziale, avviso di nuova versione | **sì**: dove sta la nota (la barra degli strumenti e la testata della sidebar oggi non hanno un posto per una nota), che cosa sostituisce il segnale «in corso» del cursore `progress` e dell'opacità, i testi | 8b, 9 |
| 6 | **Campo dell'indirizzo per Anthropic** non più `disabled` | dettaglio del profilo | **sì**: aspetto di un campo di sola lettura (decisione 10) | 8b, 9 |
| 7 | **Pulsanti dei blocchi del diff** attivi durante la generazione e il conflitto, ragione nella nota della barra | diff della revisione | **sì**: oggi `opacity: .35`; con la regola il pulsante ha l'aspetto normale e la nota dice perché | 8b, 8 |
| 8 | **`forced-colors`**: icone in `CanvasText`; modalità attiva, voce corrente dell'indice, voce aperta di profili e preset, bozza orfana corrente in `Highlight`/`HighlightText`; separatore in `CanvasText` (`Highlight` al passaggio e al focus) | solo con il contrasto elevato di Windows o `forced-colors` emulato | **sì**: la proposta del prototipo (schermate prima e dopo nel commento di LAB-54) va confermata o cambiata | 8b, 10 |

**Designer prima dell'8b.** Il PM crea una sub-issue di design (stage precedente all'8b, può girare in parallelo con l'8a) con i punti 5–8: per ognuno posizione e stile della nota o del contorno, testi (chiavi i18n nuove in `en.json`, le altre lingue le scrive Builder), stati coinvolti. Il materiale: le righe «mai disabled» dell'inventario, le schermate `forced-colors` del prototipo, le regole CSS provate (Task 10). I Task 8–10 partono solo con la proposta accettata dal PM; se la proposta cambia le regole del Task 10 o la forma delle note, il task segue la proposta e il piano resta valido per tutto il resto.

**`dist-baseline/` e snapshot.**

- **8a.** Il Task 1 costruisce `dist-baseline/` da `0cb7652` più i soli commit di test (nessun commit dell'app), con `BASELINE_SHA`. Cambiano di proposito **14 stati in tre task**, tutti misurati nel prototipo con `-g`: il **Task 2** 2 (`workspace-empty`, `toast`: il «⋯» della riga che ora ha il focus); il **Task 4** 10 (`ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-chat-summary`, `ai-review-generating`, `ai-review-note`, `ai-composer-running`: la regione nascosta `span:2`; `ai-review-truncated`, `ai-review-warnings`: la stessa più il tooltip al singolare; `ai-composer-note-no-document`: il testo della nota); il **Task 5** 2 (`settings-preset`, `settings-sync-folder`: la voce corrente dell'indice diventa Preset e Sync, è la correzione dell'indice e non uno stile). Ognuno dei tre segue il rito dei vincoli globali (solo `-g`, mai l'audit completo). I Task 3 e 6 lasciano l'audit verde contro la baseline del momento (misurato). Nessuno snapshot cambia nell'8a (misurato: `visual.spec.ts` verde salvo i 2 noti).
- **8b.** Ogni task che cambia l'aspetto segue il rito dei vincoli globali: audit verde prima, differenze solo negli stati e nelle proprietà elencati dal task, baseline ricostruita dal commit del task. Stati attesi: Task 8 `ai-review-conflict`, `ai-review-generating`, `ai-review-note` (pulsanti dei blocchi); Task 9 `settings-cloud-profile`, `settings-sync-folder`, `settings-connected`, `workspace-empty`, più gli stati che Designer tocca; Task 10 `focus-search-keyboard-forced-colors` e gli 8 stati `forced-colors-*` del Task 1. **Snapshot**: da rigenerare solo se il task li tocca davvero (`--update-snapshots=all -g "<nome>"`, con il motivo nel commento): i candidati sono `settings` (Task 9, se Designer mette una nota visibile senza interazione) e `ai-review` (Task 8, se cambia l'aspetto dei pulsanti dei blocchi a riposo). Nessuno snapshot è in `forced-colors`.

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
| 11 | 8b | Builder | Documenti, misure, chiusura: suite complete, avvio contro la fase 3, spec §7/§11/§13, `CLAUDE.md`, `README.md`, nota di chiusura della migrazione con la checklist §9 per Davide, PR dell'8b pronta | suite complete |

**Stage.** Tutti i task scrivono sullo stesso branch e quasi tutti toccano gli e2e: si eseguono **uno alla volta, uno per stage**, nell'ordine della tabella (così c'è sempre un solo task con e2e per stage, e nessun conflitto di git). In parallelo all'8a gira solo la sub-issue di Designer (nessun codice, nessun browser). Prima del Task 7 e del Task 11, review (Reviewer e A11y) del diff della sotto-fase; le correzioni della review sono il primo commit del task di chiusura, come nella 7b.

**Task 4 e Task 8 a Planner.** Il 4 mette insieme tempi sottili (una nota svuotata e riscritta dopo `ANNOUNCE_DELAY_MS`, che l'orologio finto di Playwright ferma), la sessione di CodeMirror (un aggiornamento vuoto per il nome del contenuto passa dalla sessione e rompe un test: misurato), il percorso di Scarta senza proposta (trovato solo dall'e2e), la bozza del composer che sopravvive alla sidebar ricreata (provata nel prototipo: test jsdom «AI mode: the draft of the composer survives…» e l'e2e LAB-10 di `ai-review-bar.spec.ts`, verdi), l'esito della generazione che duplica un testo visibile; ed è il task dell'8a che cambia più stati di audit (10). L'8 tocca i controlli che `@codemirror/merge` ricrea a ogni cambio dei blocchi, con il focus da tenere su un pulsante che può essere ricreato. Gli altri sono a Builder con il codice provato nel piano.

**Richiesta di merge a Davide.** Il Task 11 si ferma alla PR dell'8b pronta, con la checklist §9 scritta nella nota di chiusura della migrazione. Dopo il merge dell'8b nell'epica, la PR `epic/LAB-3-web-components` → `main` e la sub-issue «[Davide] Checklist §9 in Chrome ed Edge e merge della migrazione in main» le apre il PM (wakeup già pronta su LAB-6). Mergia solo Davide.

### Decisioni (tra parentesi la raccomandazione; il PM decide e procede)

1. **Due sotto-fasi, 8a e 8b** (sì). Varianti: **A** una PR sola (scartata: le note «mai disabled» aspettano Designer, e tutto il resto resterebbe fermo con loro); **B** (raccomandata) 8a = tutto quello che non cambia l'aspetto (Task 1–7, PR #12), 8b = i cambi d'aspetto dopo Designer e la chiusura della migrazione (Task 8–11, branch `lab/LAB-6-fase-8b` da `epic/LAB-3-web-components` dopo il merge dell'8a, PR in bozza nuova «LAB-6: fase 8b, regola «mai disabled» e contrasto elevato»); **C** una PR per area (app, workspace, impostazioni, AI) (scartata: quattro giri di suite complete e di review per rifiniture di poche decine di righe). Con A il Task 7 si salta.
2. **Designer prima dei Task 8–10** (sì): la nota «mai disabled» nella barra degli strumenti e nella testata della sidebar non ha un posto oggi, e il segnale «in corso» della schermata iniziale e dell'avviso (`cursor: progress`, opacità) sparisce con `disabled`; i colori di sistema in `forced-colors` sono una scelta visiva. **Scartato**: Builder che decide da solo con lo schema del composer (la nota sotto la casella non ha un equivalente nella barra).
3. **R1 e R2: `signal` in `switchFolder` e una vita di `hmd-app` nel documento** (sì, provata). `#alive` è un `AbortController` sostituito a ogni collegamento e interrotto al distacco (non a `reconnect()`, che succede cambiando lo store della lingua); avvio, scelta e ripresa catturano il suo `signal` e lo ricontrollano dopo ogni `await`; `switchFolder` lo riceve e si ferma prima di ogni effetto (apertura, `dispose` del vecchio, `persist`), eliminando la cartella appena aperta. L'avvio riparte a ogni collegamento finché la schermata è `boot`. **Scartate**: un contatore solo in `hmd-app` (il `persist` sta dentro `switchFolder`, dopo l'ultimo `await`: il controllo arriverebbe tardi); `isConnected` dopo ogni `await` (staccata e riattaccata tra due `await`, l'operazione vecchia passerebbe).
4. **Una regione live che entra nel DOM si annuncia con `announce`: vuota all'ingresso, il testo dopo `ANNOUNCE_DELAY_MS`** (sì; P1, P8, rivista dopo la review di A11y): nessun nodo sempre presente nel flusso. Per P8 la regione «Connesso» entra vuota e il testo arriva dopo la pausa. **Scartate**: il testo al fotogramma dopo (prima versione del piano: in Chrome il callback di `requestAnimationFrame` gira prima del calcolo dell'albero di accessibilità dello stesso aggiornamento, quindi l'albero vedrebbe la regione entrare già scritta, cioè il difetto di P8); la regione `p` sempre nel DOM (il `p` vuoto aggiunge 10 px di `gap` nel dettaglio, `.detail` è una colonna flex: un cambio d'aspetto); la variante di riserva di A11y, una regione permanente **nascosta** (`position: absolute`, fuori dal `gap`) accanto al «Connesso» visibile (funziona, ma duplica il testo per chi legge in modalità navigazione e serve solo se la pausa non convincesse: con la pausa non serve).
5. **P1: una regione nascosta a parte, il contatore visibile non è più live; a generazione finita la regione dice l'esito** (sì, provata, completata dopo la review di A11y). Annuncia «Generating a proposal» all'avvio e «{done} of {total} parts ready» quando cambia il progresso; i secondi restano visibili e muti. Quando la generazione finisce resta e dice l'esito (`generationOutcome`: «Proposal ready for review.», parziale, troncata; niente senza una proposta, niente per la selezione persa che ha già il suo `role="alert"`), fino alla prossima azione della barra, a un'altra proposta o al distacco. Per chi legge in modalità navigazione il testo dello stato parziale o troncato compare due volte (visibile e regione) finché non arriva un'azione: accettato. **Scartate**: dividere il testo visibile in parti `aria-hidden` (nove traduzioni da ristrutturare, il contatore cambia DOM in tutti gli stati); togliere solo `aria-live` e contare sul registro della chat («Working…»: il progresso e l'esito non si sentirebbero); togliere la regione a fine generazione (prima versione: dopo le parti, silenzio).
6. **L'indice delle impostazioni: regola nuova con «salto fissato»** (sì, provata nel browser). `currentSection()` in `settingsView.ts`: in fondo allo scorrimento l'ultima sezione, altrimenti l'ultima il cui inizio sta nel 40 % alto; un salto dall'indice o dalla rotta fissa la sezione chiesta finché chi usa la pagina non scorre altrove (si confronta lo `scrollTop` del salto). Un ascoltatore `scroll` al posto dell'`IntersectionObserver` (jsdom lo ha, il test lo vede). **Scartate**: più spazio in fondo al contenuto perché l'ultima sezione arrivi in cima (cambia il layout, una pagina vuota in fondo); un altro `rootMargin` (le sezioni corte in fondo non entrano in nessuna fascia).
7. **LAB-11: la stessa nota a un altro clic si svuota e torna dopo una pausa vera** (sì, provata, rivista dopo la review di A11y), con l'helper `announce(node, text, again)` e la costante unica `ANNOUNCE_DELAY_MS` = 150 ms (`setTimeout`, come il `LiveAnnouncer` di Angular CDK; react-aria usa 100 ms); `again` solo quando la nota nuova è uguale a quella mostrata (o la regione è appena entrata). Vale per la barra della revisione, il composer e Nuova chat. Effetto visibile: la nota sparisce per circa 150 ms (il PM lo dice a Designer). **Scartate**: un solo fotogramma (`requestAnimationFrame`: le due mutazioni arrivano allo stesso aggiornamento dell'albero di accessibilità, quindi niente annuncio); un carattere invisibile alternato in fondo alla nota (lo screen reader lo può leggere, e il testo nel DOM non è più quello di `t()`); ricreare il nodo della regione (meno affidabile di un cambio di testo in una regione esistente).
8. **I tre `!important` diventano `StyleModule`; il quarto resta** (sì, provata: audit invariato). Il `StyleModule` sta nella stessa origine fuori dai layer degli stili di `@codemirror/merge`, con specificità più alta; `style-mod` si dichiara in `package.json` (`4.1.4`, esatta, già nel bundle). Il quarto (`.cm-selectionBackground` in `docExtensions.ts`) combatte un selettore del tema base di `@codemirror/view` con specificità più alta: toglierlo vorrebbe dire copiare quel selettore interno; resta con il suo commento, corretto (non è `.cm-activeLine`). **Scartati**: `EditorView.theme` (aggiunge un prefisso di classe dell'editor, e i pulsanti stanno fuori dagli editor); un layer `vendor` (analisi del piano 6c: CodeMirror non scrive nei layer).
9. **Timer dei toast per chiave** (sì, provata): ogni toast informativo ha 6 s dalla sua comparsa; un array nuovo avvia solo i timer dei toast nuovi e ferma quelli spariti. Quindici righe e due test. **Scartato**: lasciarlo alla rimozione dei toast (lavoro lungo e non ancora pianificato, intanto i toast restano a schermo finché si scrive).
10. **L'indirizzo per Anthropic: `readOnly` con la descrizione** (sì, da confermare con Designer): il campo resta raggiungibile e leggibile, lo screen reader dice «sola lettura», `aria-describedby` verso l'aiuto del provider. **Scartate**: nasconderlo per Anthropic (l'indirizzo fisso non si vedrebbe più); lasciarlo modificabile e ignorarlo (ingannevole).
11. **`anchor-scope` sul chip: no** (sì): oggi c'è un solo chip (unico creatore: il composer, uno per pagina); `anchor-scope` cambierebbe lo stile calcolato di tutti gli stati AI dell'audit per un caso che non esiste. Se un giorno ci sono due chip, il test «two chips get different popover ids» va esteso e `anchor-scope: --ai-model-chip` aggiunto. **Scartato**: aggiungerlo adesso.
12. **A4 resta aperto, con un test che afferma il comportamento misurato** (sì): non si riproduce in Chromium (il focus resta sulla select); il Task 1 aggiunge l'e2e «the focus stays on the language select», e la prova con lo screen reader va nella sub-issue di Davide e nella review di A11y dell'8a. Se A11y la riproduce, la correzione entra nell'8b. **Scartato**: spostare il focus da qualche parte «per sicurezza» (WCAG 3.2.2 chiede proprio che resti).
13. **LAB-10: testo che dice dove andare e bozza conservata** (variante B, sì). **A** solo il testo (scartata: seguendo il consiglio si passa all'editor e la bozza scritta si perde); **B** (raccomandata) testo nuovo con i nomi che lo screen reader legge («No document open: switch to Editor, open one from “Folder files”, then come back to send»: `mode.editor` e `tree.label`), più la bozza del composer conservata da `hmd-workspace` quando la sidebar AI si ricrea (proprietà `draft` del composer, in entrata e in uscita con un evento `hmd-ai-draft`); **C** un elenco dei file dentro la modalità AI (scartata: interfaccia nuova, Designer, fuori perimetro).
14. **Icone in `forced-colors`: `CanvasText`, `HighlightText` sui pulsanti premuti** (sì, misurata). **Scartato** `forced-color-adjust: none` da solo (misurato: l'icona prende il colore d'autore, invisibile con un tema scuro).
15. **Voce premuta o corrente in `forced-colors`: sfondo `Highlight`, testo `HighlightText`** (sì, da confermare con Designer): il modo di sistema per una selezione, nessuno spostamento del layout. **Scartati**: `outline` interno (si scontra con l'anello del focus, che usa `outline` e sta in un layer più debole: un pulsante premuto e con il focus perderebbe l'anello); un bordo (sposta il layout di 2 px solo in `forced-colors`).
16. **Doppio clic su Invia: si ignora solo il clic con `detail` uguale a quello dell'invio più uno** (sì, provata, rivista dopo la review di A11y). Il composer ricorda il `detail` del clic che ha inviato (nessuno se l'invio viene da Invio o da un suggerimento); su Stop scarta solo il clic successivo della stessa sequenza. Una serie rapida su Stop (`detail` 3, 4…: chi ha un tremore clicca così), un clic singolo e la tastiera (`detail` 0) fermano. Il nodo resta uno (decisione della 6b). **Scartate**: ignorare ogni `detail ≥ 2` (prima versione: una serie di clic rapidi non fermerebbe mai); una finestra di 500 ms dopo l'invio (arbitraria, timer nei test); due nodi Invia e Stop (il focus salterebbe).
17. **Sincronizza ora durante una sync: la nota «sync già in corso» e nessuna sync accodata** (sì, da confermare con Designer per il testo). Oggi il pulsante è spento; attivo, un clic accoderebbe un'altra sync (`AiSync.syncNow` mette `pending`), che non è quello che chi clicca si aspetta.
18. **Nella riapertura automatica all'avvio il focus non si sposta** (decisione del PM, dalla review di A11y contro quella del Reviewer). Lì non sparisce nessun nodo con il focus: al caricamento il focus sul `body` è normale, e spostarlo disorienta chi comincia a leggere dall'inizio della pagina. Il focus va nello workspace solo quando sparisce il pulsante che lo aveva (scelta della cartella e «Riprendi», che passano da `#exclusive`: Task 2). Test: «the saved folder reopened by the boot: the focus is not moved…» in `app.dom.test.ts` ed e2e «… (decision 18)» in `startup.spec.ts`. **Scartata**: il focus all'albero o al documento anche nel boot automatico.

## Review Focus

1. **Nessun risultato tardivo con effetti** (8a, Task 2): ogni `await` di avvio, scelta e ripresa in `hmd-app` è seguito dal controllo del `signal` della vita dell'app; `switchFolder` non apre, non elimina il vecchio e non salva dopo un'interruzione; l'avvio riparte riattaccando, una sola volta. Test: i cinque punti di sospensione (quattro in «a switch whose caller goes away…» di `switchFolder.test.ts`, `knownWorkspaceId` in `app.dom.test.ts`) e i test del distacco e dell'avvio di `app.dom.test.ts`; nel boot automatico il focus non si sposta (decisione 18).
2. **Il focus non cade mai sul `body`** (Task 2, 3, 5): bersagli stabili per la sidebar che sparisce (anche uscendo dalla modalità AI con il focus nella chat: `focusStart()`), la schermata iniziale che sparisce (anche con una cartella vuota: «Nuovo file»), l'elenco dopo Elimina, il titolo dopo un salto dall'indice; il focus resta sulla select della lingua e sul pulsante attivato quando l'azione non è possibile. Test: `workspace.dom.test.ts`, `app.dom.test.ts`, `profiles`/`presets.dom.test.ts`, `settings.dom.test.ts`, e2e `workspace-shell.spec.ts`, `startup.spec.ts`, `settings.spec.ts`, `theme-i18n.spec.ts`.
3. **Annunci** (Task 4, 5): il contatore non parla ogni secondo, la regione nascosta parla all'avvio e a ogni parte; la stessa nota a un altro clic si ri-annuncia; «Connesso» e la regione della generazione entrano vuote e si riempiono dopo `ANNOUNCE_DELAY_MS`; a generazione finita la regione dice l'esito; stato ed errore della sync sono regioni. `announce` non anticipa né perde un testo (test dei tre casi). Gli e2e con l'orologio finto fanno avanzare l'orologio dopo un clic ripetuto.
4. **Scarta, Continua, doppio clic** (Task 4): Scarta durante la generazione ferma e scarta anche senza una proposta già arrivata; Continua durante un aggiornamento dice perché; il secondo clic di un doppio clic non ferma, una serie rapida sì. Test: `reviewBarView.test.ts`, `review.dom.test.ts`, `composer.dom.test.ts`, e2e `ai-review-bar.spec.ts`, `ai-composer.spec.ts`.
5. **Aspetto** (8a): in ogni task audit con `-g` verde contro la baseline del momento, salvo i 14 stati dei Task 2 (2), 4 (10) e 5 (2), con le differenze elencate e nessun'altra, e la baseline rinnovata in quei tre task; `StyleModule` al posto dei tre `!important` senza differenze; nessuno snapshot rigenerato. (8b): ogni rinnovo della baseline giustificato riga per riga, snapshot rigenerati solo se elencati.
6. **Regola «mai disabled» completa** (8b): `grep -rn "disabled" src --include=*.ts` mostra solo test che affermano `disabled === false` e nessun `aria-disabled`; ogni pulsante bloccato dice perché in una nota `role="status"` accanto, il focus resta, la nota si svuota quando la causa sparisce. Test per ogni pulsante (Task 8, 9).
7. **`forced-colors`** (8b, Task 10): icone, voce corrente, modalità premuta, bozza orfana corrente, separatore distinguibili in schema chiaro e scuro (`forcedColors: 'active'`): gli 8 stati di audit `forced-colors-*` del Task 1 (workspace, impostazioni, revisione, bozza orfana corrente, ognuno in chiaro e in scuro) rinnovati con il motivo.
8. **Testi** (Task 4, 5, 9): ogni chiave nuova in tutte e nove le lingue, `pluralKey` con `Intl.PluralRules`, traduzioni plausibili (il Reviewer le legge).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/startup.config.ts`, `e2e/startup.measure.ts`, `.gitignore` (`dist-phase3`) | Misura ripetibile del tempo di avvio contro la fase 3 (Task 1, rilanciata nel Task 11). |
| `e2e/computed-styles.audit.ts` (8 stati `forced-colors-*`: workspace, impostazioni, revisione e bozza orfana corrente, in chiaro e in scuro), e2e toccati nei Task 1–5 | Rete di sicurezza e test dei comportamenti nuovi. |
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

- [ ] **Step 4: otto stati di audit in `forced-colors`.** Quattro schermate già note (workspace, impostazioni con un profilo aperto, revisione, bozza orfana corrente), ognuna in schema chiaro e scuro. In `e2e/computed-styles.audit.ts`, subito dopo la chiusura dell'array `STATES`:

```ts
// Rete della fase 8 (Task 1): stati già noti ripresi in forced-colors, in schema chiaro e scuro (icone, voce
// corrente, modalità, bozza orfana corrente, separatore). Oggi registrano il difetto (sfondi portati a Canvas);
// il Task 10 li cambia di proposito.
const orphanCurrent: State = {
  name: 'orphans-current',
  async setup(app, page, ai) {
    await STATES.find((s) => s.name === 'orphans')!.setup(app, page, ai);
    // Dopo il ricaricamento la bozza orfana è riaperta (ultimo file con bozza): la sua voce è quella corrente.
    const orphan = page.getByRole('region', { name: app.t('orphans.title') }).getByRole('button', { name: 'note.md', exact: true });
    await expect(orphan).toHaveAttribute('aria-current', 'true');
  },
};
for (const [name, from] of [
  ['forced-colors-workspace', STATES.find((s) => s.name === 'workspace-light')!],
  ['forced-colors-settings', STATES.find((s) => s.name === 'settings-profile')!],
  ['forced-colors-review', STATES.find((s) => s.name === 'ai-review')!],
  ['forced-colors-orphans', orphanCurrent],
] as const) {
  for (const scheme of ['light', 'dark'] as const) STATES.push({ ...from, name: `${name}-${scheme}`, scheme, forcedColors: true });
}
```

Lo stato `orphans` lascia la bozza orfana riaperta dopo il ricaricamento, quindi la sua voce è già quella corrente: un clic in più la toglie dall'elenco (misurato, prima versione), per questo si aspetta solo `aria-current`. Lo stato ricarica la pagina: in caso di «Target page… closed» si ripete da solo.

- [ ] **Step 5: e2e dei difetti di oggi.** In fondo a `e2e/workspace-shell.spec.ts`:

```ts
test('Hide sidebar from inside the sidebar: today the focus falls on the body (A1, the Task 3 of phase 8 moves it to Show sidebar)', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  // «Nascondi» esiste due volte: questo è quello nella testata della sidebar (l'altro è l'interruttore della barra).
  await page.getByRole('complementary').getByRole('button', { name: app.t('sidebar.hide') }).click();
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

In fondo a `e2e/settings.spec.ts` (il `beforeEach` del file apre già la cartella):

```ts
test('Escape with unsaved changes: today nothing happens, no confirmation and the settings stay open (P5, the Task 5 of phase 8 fixes it)', async ({ app, page }) => {
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
  // L'etichetta adesso è in un'altra lingua: il focus si guarda sul nodo, non per nome.
  await expect.poll(() => page.evaluate(() => document.activeElement?.localName)).toBe('select');
});
```

In `e2e/ai-composer.spec.ts`, nel `describe('composer')`, subito prima di «the Stop button stops the generation»:

```ts
  test('a double click on Send: today the second click of the pair stops the request just sent (the Task 4 of phase 8 keeps it going)', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await send(app).click();
    // Il secondo clic di un doppio clic umano arriva quando il pulsante è già Stop, con detail 2.
    await stop(app).dispatchEvent('click', { detail: 2 });
    await expect(send(app)).toBeVisible();
    expect(ai.requests).toBe(1);
    ai.release();
  });
```

Misurato: `send(app).dblclick()` di Playwright è troppo veloce (il secondo clic arriva prima che il pulsante diventi Stop e non riproduce il difetto); con un clic e poi un clic `detail: 2` su Stop il difetto si vede in modo deterministico.

- [ ] **Step 6: lint.** `npx tsc --noEmit -p e2e` e `npm run lint` puliti.

- [ ] **Step 7: i file toccati, in build e in sviluppo, e gli stati nuovi dell'audit** (uno alla volta, nel lock):

```bash
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/workspace-shell.spec.ts e2e/startup.spec.ts e2e/settings.spec.ts e2e/theme-i18n.spec.ts e2e/ai-composer.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/workspace-shell.spec.ts e2e/startup.spec.ts e2e/settings.spec.ts e2e/theme-i18n.spec.ts e2e/ai-composer.spec.ts
cat dist-baseline/BASELINE_SHA
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "forced-colors"
```

Attesi tutti verdi sull'app di oggi (i nove stati con `forced-colors` nel nome: gli otto nuovi e `focus-search-keyboard-forced-colors`; il progetto `baseline` gira comunque tutto: **85** test). Un rosso qui vuol dire che il test non descrive l'app di oggi: si corregge il test, non l'app. A fine suite `pgrep -af "vite|chrom|playwright"`.

- [ ] **Step 8: commit** (piccoli, uno per gruppo: `test: misura ripetibile dell'avvio contro la fase 3`, `test: stati di audit in forced-colors`, `test: difetti di focus, Esc e doppio clic affermati come sono oggi`), `git -c core.hooksPath=/dev/null commit`, `git log --format=%B -n 3` senza `Co-authored-by`, push. Commento finale: `BASELINE_SHA`, conteggi (`npm test` 1045 invariato; e2e toccati, dev, audit con `-g`), misura dell'avvio, gzip.

**Esecuzione (prototipo, 12/10).** I test dello Step 5 e gli stati dello Step 4 girati sulla build di `0cb7652`, nel lock: i cinque file in build **44** verdi (36 s), in sviluppo **43** verdi (1,3 min, console pulita), audit con `-g "forced-colors"` **75** verdi con i tre stati della prima versione (2,2 min); con gli otto della versione corretta (bozza orfana corrente, schema scuro: review del piano) **85** verdi (76 del progetto `baseline` più i 9 `forced-colors` del `current`; 2,9 min). Tre correzioni ai test durante la prova, già nel codice qui sopra: il test P5 apriva la cartella due volte (il `beforeEach` la apre già: «Target page… closed»), il test A4 cercava la select con l'etichetta inglese dopo aver cambiato lingua, il test del doppio clic usava `dblclick()`.

### Task 2: `hmd-app` — risultati tardivi, avvio che riparte, focus dopo l'apertura (Builder)

**Files:**
- Modify: `src/app/switchFolder.ts` (+ `switchFolder.test.ts`), `src/elements/app/app.element.ts` (+ `app.dom.test.ts`), `src/elements/file-tree/file-tree.element.ts`, `src/elements/workspace/workspace.element.ts` (solo `focusStart()`), `e2e/startup.spec.ts`

R1, R2 (review della 7b) e A2, con le decisioni 3 e 18. Il codice qui sotto è quello del prototipo, con i test verdi in jsdom e gli e2e verdi nel browser.

**Cinque punti di sospensione.** Avvio, scelta e ripresa ricontrollano il `signal` della vita dell'app dopo ogni `await`: i quattro di `switchFolder` (scelta, prima messa al sicuro, apertura, seconda messa al sicuro) e, nella callback `open` di `hmd-app`, quello di `knownWorkspaceId`, prima di `openWorkspace` (altrimenti una cartella si costruisce e carica tutti i file per essere buttata alla fine).

**A2, misurato nel browser.** Il recupero con `focusScope`/`refocus` del `RenderLoop` (la prima versione del prototipo, verde in jsdom) nel browser non scatta: durante il cambio la schermata iniziale è `busy` e mette i suoi pulsanti `disabled`, e Chrome toglie subito il focus a un pulsante che diventa `disabled`; quando la schermata sparisce il focus è già sul `body`. Per questo `hmd-app` guarda il focus **all'inizio** dell'operazione (in `#exclusive`, prima di `busy`) e lo porta nello workspace quando l'apertura riesce. Il test jsdom simula Chrome con un `blur()` esplicito, con il commento. Bersagli di `focusStart()`: la riga col tab stop dell'albero; con l'albero vuoto (cartella senza file: `tabStop()` è `null`) «Nuovo file» nella testata della sidebar; con la sidebar nascosta «Mostra sidebar». **Nel boot automatico il focus non si sposta** (decisione 18): lì non sparisce nessun nodo con il focus. (Una scelta annullata lascia comunque il focus sul `body`, per lo stesso `disabled`: lo corregge la regola «mai disabled» sulla schermata iniziale, Task 9.)

- [ ] **Step 1: test che falliscono** (RED da annotare). Le tre riproduzioni dell'allegato di LAB-54 diventano test di `app.dom.test.ts` (stesso `deps()` e `mount()` del file), più il quinto punto di sospensione, il focus (A2, anche con una cartella vuota), il boot che non sposta il focus e il `signal` di `switchFolder`:

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
index c751db3..49c5c5e 100644
--- a/src/elements/app/app.dom.test.ts
+++ b/src/elements/app/app.dom.test.ts
@@ -144,3 +144,104 @@ test('detached while the folder is opening: the folder opened afterwards is disp
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
+    // Chrome toglie il focus a un pulsante che diventa `disabled` (la schermata iniziale è `busy` durante il
+    // cambio); jsdom no: lo si fa a mano.
+    button.blur();
+    await waitFor(() => el.screen === 'open');
+    const row = el.querySelector('hmd-file-tree [tabindex="0"]');
+    assert.ok(row !== null && document.activeElement === row, `${mode}: the tree row with the tab stop, not ${document.activeElement?.localName}`);
+    el.remove();
+  }
+});
+
+test('detached while the picked folder is being recognised (knownWorkspaceId): it is not even opened', async () => {
+  let release: () => void = () => {};
+  const gate = new Promise<void>((resolve) => (release = resolve));
+  let asked = false;
+  const { deps: d, opened, log } = deps({ knownWorkspaceId: async () => ((asked = true), await gate, null) });
+  const el = mount(d);
+  await waitFor(() => el.screen === 'start');
+  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-pick', { bubbles: true }));
+  await waitFor(() => asked);
+  el.remove();
+  release();
+  await new Promise((resolve) => setTimeout(resolve, 30));
+  assert.equal(opened.length, 0, 'openWorkspace mai chiamato');
+  assert.deepEqual(log.filter((line) => line !== 'update none'), []);
+});
+
+test('an empty folder picked from the start screen: the focus goes to New file in the sidebar header', async () => {
+  const { deps: d } = deps();
+  d.openWorkspace = async (stored) => {
+    const workspace = new Workspace({ fs: createWorkspaceFS(memoryOps()), workspaceId: stored.workspaceId, name: stored.handle.name, buffers: memoryBufferStore() });
+    await workspace.load();
+    return workspace;
+  };
+  const el = mount(d);
+  await waitFor(() => el.screen === 'start');
+  const button = [...el.querySelectorAll<HTMLButtonElement>('hmd-start-screen button')].find((b) => b.textContent === EN_MESSAGES['start.openFolder'])!;
+  button.focus();
+  button.click();
+  button.blur();
+  await waitFor(() => el.screen === 'open');
+  const active = document.activeElement;
+  assert.ok(active?.getAttribute('aria-label') === EN_MESSAGES['file.new'] && !!active.closest('aside'), `New file in the sidebar, not ${active?.localName} ${active?.getAttribute('aria-label')}`);
+});
+
+test('the saved folder reopened by the boot: the focus is not moved (nothing that had it went away)', async () => {
+  const el = mount(deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) }).deps);
+  await waitFor(() => el.screen === 'open');
+  await new Promise((resolve) => setTimeout(resolve, 30));
+  assert.ok(document.activeElement === document.body, `body, not ${document.activeElement?.localName}`);
+});
```

RED atteso (misurato): `switchFolder.test.ts` 1 rosso («a switch whose caller goes away…»); `app.dom.test.ts` 6 rossi: i due «detached while … opens» (la cartella tardiva non viene eliminata, `log` contiene `update open` e, nella scelta, `save picked`), «detached while the picked folder is being recognised» (`openWorkspace mai chiamato`), «detached and reattached while booting» (`waitFor` scade: la schermata resta `boot`), «the focus follows the folder» (`pick: … not body`), «an empty folder…» (`New file in the sidebar, not body`). «the saved folder reopened by the boot…» è verde già oggi e deve restarlo.

- [ ] **Step 2: `switchFolder` con `signal`, `hmd-app` con la vita nel documento e il focus catturato all'inizio.**

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
index 102ff4c..cfcd938 100644
--- a/src/elements/app/app.element.ts
+++ b/src/elements/app/app.element.ts
@@ -38,8 +38,14 @@ export class HmdApp extends HmdElement {
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
+  /** Scelta o ripresa partita con il focus nella schermata iniziale. */
+  #focusOnOpen = false;
   #start: HmdStartScreen | null = null;
   #workspace: HmdWorkspace | null = null;
   #updateNotice: HmdUpdateNotice | null = null;
@@ -67,35 +73,37 @@ export class HmdApp extends HmdElement {
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
@@ -112,30 +120,41 @@ export class HmdApp extends HmdElement {
     this.#screen = screen;
     this.#deps.setUpdateWorkspace(screen.kind === 'open' ? screen.workspace : null);
     this.#loop.update();
+    // Il pulsante della schermata iniziale, che aveva il focus, non c'è più: il focus va all'albero.
+    if (screen.kind === 'open' && this.#focusOnOpen) this.#workspace?.focusStart();
+    this.#focusOnOpen = false;
   }
 
   // Un cambio cartella (o ripresa dell'accesso) alla volta: ognuno cattura lo workspace aperto all'inizio.
   async #exclusive(task: () => Promise<void>): Promise<void> {
     if (this.#guard.active) return;
+    // Il focus sta nella schermata iniziale adesso, prima che `busy` spenga i suoi pulsanti (Chrome toglie il
+    // focus a un pulsante che diventa `disabled`): a cartella aperta va nello workspace nuovo (A2).
+    this.#focusOnOpen = !!this.#start?.contains(document.activeElement);
     this.#set({ switching: true });
     try {
       await this.#guard.run(task);
     } finally {
+      this.#focusOnOpen = false;
       this.#set({ switching: false });
     }
   }
 
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
+          // Staccata nel frattempo: niente apertura (l'errore finisce in switchFolder, che lo ignora dopo il distacco).
+          if (signal.aborted) throw new DOMException('hmd-app staccato', 'AbortError');
           const stored: StoredWorkspace = { handle, workspaceId };
           return { stored, workspace: await deps.openWorkspace(stored) };
         },
@@ -144,6 +163,7 @@ export class HmdApp extends HmdElement {
         // La cartella vecchia non si è potuta lasciare: quella nuova, già caricata, si butta.
         discard: ({ workspace }) => workspace.dispose(),
       });
+      if (signal.aborted) return;
       match(afterSwitch(result, current !== null))
         .with({ kind: 'show' }, ({ screen: next }) => this.#show(next))
         .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
@@ -154,11 +174,14 @@ export class HmdApp extends HmdElement {
 
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

- [ ] **Step 3: i bersagli del focus.** In `src/elements/file-tree/file-tree.element.ts` il recupero esistente diventa un metodo pubblico, che dice se ha trovato una riga:

```diff
diff --git a/src/elements/file-tree/file-tree.element.ts b/src/elements/file-tree/file-tree.element.ts
index dee118f..b309472 100644
--- a/src/elements/file-tree/file-tree.element.ts
+++ b/src/elements/file-tree/file-tree.element.ts
@@ -76,12 +76,20 @@ export class HmdFileTree extends HmdElement {
     focusScope: () => this.#parts?.nav ?? null,
     // La riga con il focus è sparita (file eliminato o rinominato): il focus va sulla riga col tab stop
     // (il suo focusin ricalcola i tab stop).
-    refocus: () => {
-      const stop = tabStop(this.#items, this.#focused, this.#openPath);
-      if (stop !== null) this.#focusables.get(stop)?.focus();
-    },
+    refocus: () => void this.focusTabStop(),
   });
 
+  /**
+   * Focus sulla riga col tab stop (il file aperto, o la prima riga): l'ingresso nell'albero da fuori. Falso con
+   * l'albero vuoto (nessuna riga da raggiungere): chi chiama sceglie un altro bersaglio.
+   */
+  focusTabStop(): boolean {
+    const stop = tabStop(this.#items, this.#focused, this.#openPath);
+    const row = stop === null ? undefined : this.#focusables.get(stop);
+    row?.focus();
+    return !!row;
+  }
+
   get nodes(): readonly TreeNode[] { return this.#nodes; }
   set nodes(value: readonly TreeNode[]) {
     value ??= [];
```

In `src/elements/workspace/workspace.element.ts`, subito sopra `get workspace()`:

```ts
  /**
   * Il focus d'ingresso nello workspace (dopo l'apertura della cartella, o quando la sidebar cambia sotto il
   * focus): la riga col tab stop dell'albero; con l'albero vuoto «Nuovo file» nella testata della sidebar (l'azione
   * utile in una cartella vuota); con la sidebar nascosta «Mostra sidebar» nella barra.
   */
  focusStart(): void {
    if (this.#slots.tree?.focusTabStop()) return;
    const newFile = this.#slots.treeHeader?.children[2] as HTMLElement | undefined;
    (newFile ?? this.#parts?.toggle)?.focus();
  }
```

(`treeHeader` ha quattro pulsanti: Nascondi, cartella, Nuovo file, Nuova cartella.)

- [ ] **Step 4: verde.** `npx tsx --import ./src/testing/assetHooks.ts --test --test-timeout=20000 src/app/switchFolder.test.ts src/elements/app/app.dom.test.ts src/elements/file-tree/*.test.ts` (atteso: tutto verde; `app.dom.test.ts` 13 test). Le tre riproduzioni dell'allegato, lanciate così come sono dalla radice del checkout (`npx tsx --import ./src/testing/assetHooks.ts --test review-app-lifecycle.test.ts`, file **non** committato), devono passare tutte e tre; poi il file si cancella.

- [ ] **Step 5: e2e.** In `e2e/startup.spec.ts` il test A2 del Task 1 si rovescia e se ne aggiungono due (verdi nel prototipo, in build e in sviluppo; il terzo ripetuto 3 volte, perché ricarica la pagina):

```ts
test('after opening a folder from the start screen the focus goes to the tree row with the tab stop (A2)', async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await expect(app.treeFile('a.md')).toBeFocused();
});

test('an empty folder opened from the start screen: the focus goes to New file in the sidebar (A2)', async ({ app, page }) => {
  await app.start();
  await app.page.getByRole('button', { name: app.t('start.openFolder') }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: app.t('file.new') })).toBeFocused();
});

test('the saved folder reopened at startup: the focus is not moved (decision 18)', async ({ app, page }) => {
  // Come «after a reload the folder and the last open file come back»: un file aperto prima di ricaricare.
  await app.openFolder({ 'a.md': 'alpha' });
  await app.openFile('a.md');
  await page.reload();
  await app.expectOpen('a.md');
  await expect(page.locator('body')).toBeFocused();
});
```

Misurato: lo stesso test senza `openFile` prima di ricaricare cade 2 volte su 3 in sviluppo con «Target page… closed» (l'instabilità nota del ricaricamento); con il file aperto, 3 su 3 verdi in build e in sviluppo.

- [ ] **Step 6: gate e baseline.** `npm test` (atteso **1053** = 1045 + 7 `app.dom` + 1 `switchFolder`), `npm run lint`, `e2e/startup.spec.ts` in build e in sviluppo (nel lock). Audit **solo con `-g`** (le suite complete restano ai Task 7 e 11; con `-g` il progetto `baseline` gira comunque tutto, perché `current` ne dipende in Playwright): `cat dist-baseline/BASELINE_SHA`, poi `-g "workspace-empty|toast|start"`: cadono **solo** `workspace-empty` e `toast` con `…>nav:2>ul:0>li:0>div:0>button:1 { opacity: 0 → 1 }` (misurato: il focus sulla prima riga dell'albero ne mostra il «⋯»); righe nel commento, poi `dist-baseline/` ricostruita dal commit del task (rito dei vincoli globali) e lo stesso `-g` verde. Commit: `test: risultati tardivi e avvio di hmd-app (RED)`, poi `fix: hmd-app scarta i risultati tardivi e riparte dall'avvio dopo il distacco`, `fix: il focus va all'albero dopo l'apertura della cartella`.

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

RED atteso (misurato), oltre al test dello Step 3: `layout.test.ts` «arrow keys resize…» (Home → `null`); `workspace.dom.test.ts` «the focus never falls on the body…» (`Show sidebar in the toolbar, not body`) e «the separator: Home and End…»; `toasts.dom.test.ts` «info toasts close 6 s after they appear…» (a 6 s `ws-1` non è ancora chiuso: il suo timer è ripartito con l'array nuovo).

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

- [ ] **Step 3: recupero del focus nel workspace.** Nel `RenderLoop` di `workspace.element.ts`: entrando in AI (la chat sostituisce l'albero) il bersaglio è il pulsante della modalità AI; in tutti gli altri casi è `focusStart()` del Task 2 (uscendo dalla modalità AI con il focus nella chat, con Ctrl+Maiusc+E o `cycleMode`, il focus va alla riga dell'albero, non a «Nascondi sidebar»; con la sidebar nascosta va su «Mostra sidebar»):

```ts
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#workspace && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#parts!, this.#workspace!, this.#i18n!),
    // La sidebar (o il suo contenuto) è sparita con il focus dentro: «Nascondi», Ctrl+B nell'albero o nella
    // ricerca, la chat che sostituisce l'albero entrando in AI, l'albero che sostituisce la chat uscendo. Entrando
    // in AI il focus va sul pulsante della modalità; altrimenti dove entra `focusStart()` (l'albero, o «Mostra
    // sidebar» se la sidebar non c'è più).
    focusScope: () => this.#slots.aside ?? null,
    refocus: () => {
      if (this.#sidebarOpen && this.#shown === 'ai') this.#parts!.modeButtons.get('ai')!.focus();
      else this.focusStart();
    },
  });
```

`focusScope` si legge prima del render: è l'`aside` di prima, anche quando il render lo toglie. Con il focus fuori dalla sidebar (un pulsante della barra) il recupero non scatta (ultimo blocco del primo test). Test in più, in fondo a `workspace.dom.test.ts` (RED misurato: `not Hide sidebar (Ctrl+B)`):

```ts
test('leaving AI mode with the focus in the chat (Ctrl+Shift+E): the focus goes to the tree, not to Hide sidebar', async () => {
  const { el, workspace, button } = await mount({ ai: true });
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.ai']).click();
  el.querySelector<HTMLTextAreaElement>('hmd-ai-composer textarea')!.focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }));
  assert.ok(el.querySelector('hmd-file-tree'));
  const row = el.querySelector('hmd-file-tree [tabindex="0"]');
  assert.ok(row !== null && document.activeElement === row, `the tree row with the tab stop, not ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.localName}`);
});
```

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
  // «Nascondi» esiste due volte: questo è quello nella testata della sidebar (l'altro è l'interruttore della barra).
  await page.getByRole('complementary').getByRole('button', { name: app.t('sidebar.hide') }).click();
  await expect(app.tree()).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('sidebar.show'), exact: true })).toBeFocused();
});
```

- [ ] **Step 6: gate.** `npm test` (atteso **1057** = 1053 + 3 `workspace.dom` + 1 `toasts`), `npm run lint`; `e2e/workspace-shell.spec.ts` ed `e2e/editor.spec.ts` (sidebar e separatore) in build e in sviluppo; audit solo con `-g "sidebar|resizer|toast|workspace"`, invariato rispetto alla baseline del Task 2. Commit: `test: …(RED)`, `fix: il focus resta nella barra quando la sidebar sparisce`, `feat: Home ed End sul separatore`, `fix: i timer dei toast partono una volta per toast`.

### Task 4: AI — annunci, nome dell'editor, plurale, Scarta, Continua, doppio clic, bozza conservata, chip (Planner)

**Files:**
- Create: `src/dom/announce.ts`, `src/dom/announce.test.ts`
- Modify: `src/i18n/i18n.ts` (+ `i18n.test.ts`), `src/i18n/locales/*.json` (nove), `src/elements/events.ts`
- Modify: `src/elements/ai/review-bar.element.ts`, `review-bar.css`, `reviewBarView.ts`, `review.element.ts`, `composer.element.ts`, `sidebar.element.ts`, `model-chip.element.ts` (+ i loro test)
- Modify: `src/editor/docExtensions.ts` (+ `docExtensions.dom.test.ts`), `src/elements/editor/docElement.ts`, `editor.element.ts` (+ `editor.dom.test.ts`), `src/elements/ai/diff-pane.element.ts` (solo il nome del lato destro e la riga in `#refreshControls`), `src/elements/workspace/workspace.element.ts` (solo la bozza) (+ `workspace.dom.test.ts`)
- Modify (e2e): `ai-review-bar.spec.ts`, `ai-review.spec.ts:222`, `ai-composer.spec.ts`, `computed-styles.audit.ts` (`:265`, `:280`, `:419`)

P1 (con l'esito della generazione), P3, P4, LAB-11, Scarta = Ferma + scarta, Continua durante un aggiornamento, doppio clic, LAB-10 (variante B, decisione 13), chip senza cast. Tutto provato nel prototipo: test jsdom, e2e toccati in build e in sviluppo, audit con `-g`. **Planner** perché: la nota ri-annunciata si svuota e torna dopo `ANNOUNCE_DELAY_MS` (150 ms: con l'orologio finto di Playwright la pausa non passa da sola, `page.clock.runFor(200)`); il nome del contenuto di CodeMirror **non** si aggiorna con un `dispatch({})` vuoto (passa dalla sessione e rompe «a listener that swaps the document while typing»: misurato), ma scrivendo l'attributo e lasciando `contentAttributes` a riallinearlo al prossimo aggiornamento; Scarta senza proposta già arrivata non fermava niente (trovato dall'e2e); l'esito della generazione ripete nella regione nascosta il testo dello stato visibile (due nodi con lo stesso testo: un `getByText` dell'e2e e dell'audit va preso `.first()`); è il task dell'8a che cambia più stati di audit.

- [ ] **Step 1: helper `announce` e `pluralKey`, test prima.** `src/dom/announce.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { ANNOUNCE_DELAY_MS, announce } from './announce';

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('without again it is setText: written only when it changes', () => {
  const node = document.createElement('p');
  announce(node, 'a');
  announce(node, 'a');
  assert.equal(node.textContent, 'a');
});

test('again: the same text is cleared now and written back after a real pause, as a new mutation', async () => {
  const node = document.createElement('p');
  node.textContent = 'busy';
  announce(node, 'busy', true);
  assert.equal(node.textContent, '');
  // Un render nel frattempo con lo stesso testo non lo anticipa.
  announce(node, 'busy');
  assert.equal(node.textContent, '');
  // Un fotogramma non basta (lo screen reader vedrebbe le due mutazioni insieme): il testo è ancora vuoto.
  await later(20);
  assert.equal(node.textContent, '');
  await later(ANNOUNCE_DELAY_MS);
  assert.equal(node.textContent, 'busy');
});

test('again: another text (or empty) before the frame wins and cancels the wait', async () => {
  const node = document.createElement('p');
  announce(node, 'busy', true);
  announce(node, '');
  await later(ANNOUNCE_DELAY_MS + 20);
  assert.equal(node.textContent, '');
  announce(node, 'busy', true);
  announce(node, 'other');
  assert.equal(node.textContent, 'other');
  await later(ANNOUNCE_DELAY_MS + 20);
  assert.equal(node.textContent, 'other');
});
```

`src/dom/announce.ts` (decisione 7: una pausa vera, non un fotogramma):

```ts
/**
 * Pausa tra lo svuotamento di una regione live e la riscrittura del testo. Un solo fotogramma non basta: in
 * Chrome il callback di `requestAnimationFrame` gira prima del calcolo dell'albero di accessibilità dello stesso
 * aggiornamento, e le due mutazioni arrivano insieme (A11y, review del piano 14). 150 ms come il LiveAnnouncer di
 * Angular CDK (react-aria ne usa 100). Chi vede lo schermo vede la nota sparire per un attimo.
 */
export const ANNOUNCE_DELAY_MS = 150;

/** Testo in attesa della riscrittura, per nodo. */
const pending = new WeakMap<Node, { text: string; timer: ReturnType<typeof setTimeout> }>();

/**
 * Testo di una regione live (`role="status"`, `aria-live`). Senza `again` è `setText`: scrive solo se cambia. Con
 * `again` il testo deve arrivare allo screen reader come una mutazione nuova anche se è uguale a quello di prima
 * (la stessa nota a un altro clic, WCAG 4.1.3) o se la regione è appena entrata nel DOM: la regione si svuota
 * subito e il testo torna dopo `ANNOUNCE_DELAY_MS`. Fino ad allora un render che chiede lo stesso testo non lo
 * anticipa; uno che ne chiede un altro (o il vuoto) vince e annulla l'attesa.
 */
export function announce(node: HTMLElement, text: string, again = false): void {
  const waiting = pending.get(node);
  if (waiting && waiting.text === text && !again) return;
  if (waiting) clearTimeout(waiting.timer);
  pending.delete(node);
  if (!again || text === '') {
    if (node.textContent !== text) node.textContent = text;
    return;
  }
  node.textContent = '';
  const timer = setTimeout(() => {
    pending.delete(node);
    node.textContent = text;
  }, ANNOUNCE_DELAY_MS);
  pending.set(node, { text, timer });
}
```

`pluralKey` in `src/i18n/i18n.ts` e il suo test (RED: non compila finché la funzione non c'è):

```diff
diff --git a/src/i18n/i18n.test.ts b/src/i18n/i18n.test.ts
index 71841bc..9f8fae9 100644
--- a/src/i18n/i18n.test.ts
+++ b/src/i18n/i18n.test.ts
@@ -1,7 +1,7 @@
 import test from 'node:test';
 import assert from 'node:assert/strict';
 
-import { detectLocale, formatDate, formatRelative, parseLocale, placeholders, translate } from './i18n';
+import { detectLocale, formatDate, formatRelative, parseLocale, placeholders, pluralKey, translate } from './i18n';
 import { EN_MESSAGES, loadMessages, loadWithFallback } from './messages';
 
 test('detectLocale matches on the language prefix, case-insensitively', () => {
@@ -58,3 +58,13 @@ test('loadMessages falls back to English (locale included) if the chunk fails to
   const failing = () => Promise.reject(new Error('chunk non raggiungibile'));
   assert.deepEqual(await loadWithFallback('de', failing), { locale: 'en', messages: EN_MESSAGES });
 });
+
+test('pluralKey: the singular form only where the language has one, the plural everywhere else', () => {
+  assert.equal(pluralKey('en', 'ai.warningsCount', 1), 'ai.warningsCount.one');
+  assert.equal(pluralKey('en', 'ai.warningsCount', 2), 'ai.warningsCount.other');
+  assert.equal(pluralKey('en', 'ai.warningsCount', 0), 'ai.warningsCount.other');
+  assert.equal(pluralKey('it', 'ai.warningsCount', 1), 'ai.warningsCount.one');
+  assert.equal(pluralKey('fr', 'ai.warningsCount', 0), 'ai.warningsCount.one', 'in francese 0 è singolare');
+  assert.equal(pluralKey('ja', 'ai.warningsCount', 1), 'ai.warningsCount.other', 'il giapponese non ha il singolare');
+  assert.equal(pluralKey('pl', 'ai.warningsCount', 5), 'ai.warningsCount.other', 'few/many ricadono su other');
+});
diff --git a/src/i18n/i18n.ts b/src/i18n/i18n.ts
index ea25d8c..1a4a95f 100644
--- a/src/i18n/i18n.ts
+++ b/src/i18n/i18n.ts
@@ -43,6 +43,15 @@ export function translate(messages: Messages, key: string, params?: Params): str
   return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
 }
 
+/**
+ * Chiave della forma singolare o plurale (`<base>.one` / `<base>.other`) per `count`, con le regole della lingua
+ * (`Intl.PluralRules`): le categorie oltre `one` (few, many, …) usano la forma `other`, che ogni lingua scrive
+ * in modo da valere per tutti i numeri.
+ */
+export function pluralKey<B extends string>(locale: Locale, base: B, count: number): `${B}.one` | `${B}.other` {
+  return new Intl.PluralRules(locale).select(count) === 'one' ? `${base}.one` : `${base}.other`;
+}
+
 export function placeholders(template: string): string[] {
   return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
 }
```

- [ ] **Step 2: chiavi.** Nuove: `ai.warningsCount.one` e `ai.warningsCount.other` (al posto di `ai.warningsCount`), `ai.generatingStarted`, `ai.generatingProgress` («{done} of {total} parts ready»: niente «part 0 of 3»), `editor.content`, `ai.diff.current`, `ai.diff.proposal`; cambiata: `ai.composer.noDocument` (LAB-10), con i nomi che lo screen reader legge davvero, cioè il pulsante della modalità (`mode.editor`) e il nome dell'albero (`tree.label`, «Folder files», «File della cartella»), scritti uguali nella stessa lingua. Tutte e nove le lingue (testi del prototipo; il Reviewer li legge; se `mode.editor` o `tree.label` cambiano, la nota va riallineata):

```diff
diff --git a/src/i18n/locales/de.json b/src/i18n/locales/de.json
index a8d7d5f..93a5579 100644
--- a/src/i18n/locales/de.json
+++ b/src/i18n/locales/de.json
@@ -71,6 +71,7 @@
   "search.none": "Keine Ergebnisse",
   "pane.editor": "Editor",
   "pane.preview": "Vorschau",
+  "editor.content": "Dokumenttext",
   "preview.frontmatterInvalid": "Ungültiger Frontmatter: {detail}",
   "preview.imageMissing": "Bild nicht gefunden: {path}",
   "settings.title": "Einstellungen",
@@ -143,13 +144,15 @@
   "ai.request": "Frage zu diesem Dokument… (Umschalt+Enter für neue Zeile)",
   "ai.working": "Wird bearbeitet…",
   "ai.proposalReady": "Vorschlag zur Prüfung bereit.",
+  "ai.diff.current": "Aktuelles Dokument",
+  "ai.diff.proposal": "KI-Vorschlag",
   "ai.retry": "Erneut versuchen",
   "ai.newChat": "Neuer Chat",
   "ai.stop": "Stoppen",
   "ai.send": "Senden",
   "ai.composer.needText": "Schreibe eine Nachricht, bevor du sendest",
   "ai.composer.needProfile": "Wähle ein Profil, bevor du sendest",
-  "ai.composer.noDocument": "Öffne ein Dokument, bevor du sendest",
+  "ai.composer.noDocument": "Kein Dokument geöffnet: wechsle zu Editor, öffne eines in „Dateien im Ordner“ und komm zum Senden zurück",
   "ai.composer.updating": "Eine Aktualisierung läuft: versuche es gleich noch einmal",
   "ai.composer.generating": "Generierung läuft: warte, bis sie fertig ist, oder drücke Stoppen",
   "ai.newChat.alreadyEmpty": "Der Chat ist bereits leer",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Ganzes Dokument verwenden",
   "ai.suggestions": "Vorschläge",
   "ai.generating": "Wird erzeugt… {seconds} s",
-  "ai.warningsCount": "{count} Hinweise",
+  "ai.generatingStarted": "Vorschlag wird erzeugt",
+  "ai.generatingProgress": "{done} von {total} Teilen fertig",
+  "ai.warningsCount.one": "{count} Hinweis",
+  "ai.warningsCount.other": "{count} Hinweise",
   "settings.sections": "Einstellungsbereiche",
   "settings.general": "Allgemein",
   "settings.aiProfiles": "KI · Profile",
diff --git a/src/i18n/locales/en.json b/src/i18n/locales/en.json
index d4532e9..94e2cab 100644
--- a/src/i18n/locales/en.json
+++ b/src/i18n/locales/en.json
@@ -71,6 +71,7 @@
   "search.none": "No results",
   "pane.editor": "Editor",
   "pane.preview": "Preview",
+  "editor.content": "Document text",
   "preview.frontmatterInvalid": "Invalid frontmatter: {detail}",
   "preview.imageMissing": "Image not found: {path}",
   "settings.title": "Settings",
@@ -143,13 +144,15 @@
   "ai.request": "Ask about this document… (Shift+Enter for a new line)",
   "ai.working": "Working…",
   "ai.proposalReady": "Proposal ready for review.",
+  "ai.diff.current": "Current document",
+  "ai.diff.proposal": "AI proposal",
   "ai.retry": "Retry",
   "ai.newChat": "New chat",
   "ai.stop": "Stop",
   "ai.send": "Send",
   "ai.composer.needText": "Write a message before sending",
   "ai.composer.needProfile": "Choose a profile before sending",
-  "ai.composer.noDocument": "Open a document before sending",
+  "ai.composer.noDocument": "No document open: switch to Editor, open one from “Folder files”, then come back to send",
   "ai.composer.updating": "An update is in progress: try again in a moment",
   "ai.composer.generating": "Generation in progress: wait for it to finish, or press Stop",
   "ai.newChat.alreadyEmpty": "The chat is already empty",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Use the whole document",
   "ai.suggestions": "Suggestions",
   "ai.generating": "Generating… {seconds} s",
-  "ai.warningsCount": "{count} warnings",
+  "ai.generatingStarted": "Generating a proposal",
+  "ai.generatingProgress": "{done} of {total} parts ready",
+  "ai.warningsCount.one": "{count} warning",
+  "ai.warningsCount.other": "{count} warnings",
   "settings.sections": "Settings sections",
   "settings.general": "General",
   "settings.aiProfiles": "AI · Profiles",
diff --git a/src/i18n/locales/es.json b/src/i18n/locales/es.json
index d8806af..8c71350 100644
--- a/src/i18n/locales/es.json
+++ b/src/i18n/locales/es.json
@@ -71,6 +71,7 @@
   "search.none": "Sin resultados",
   "pane.editor": "Editor",
   "pane.preview": "Vista previa",
+  "editor.content": "Texto del documento",
   "preview.frontmatterInvalid": "Frontmatter no válido: {detail}",
   "preview.imageMissing": "Imagen no encontrada: {path}",
   "settings.title": "Ajustes",
@@ -143,13 +144,15 @@
   "ai.request": "Pregunta sobre este documento… (Mayús+Intro para nueva línea)",
   "ai.working": "Trabajando…",
   "ai.proposalReady": "Propuesta lista para revisar.",
+  "ai.diff.current": "Documento actual",
+  "ai.diff.proposal": "Propuesta de la IA",
   "ai.retry": "Reintentar",
   "ai.newChat": "Nueva conversación",
   "ai.stop": "Detener",
   "ai.send": "Enviar",
   "ai.composer.needText": "Escribe un mensaje antes de enviar",
   "ai.composer.needProfile": "Elige un perfil antes de enviar",
-  "ai.composer.noDocument": "Abre un documento antes de enviar",
+  "ai.composer.noDocument": "No hay ningún documento abierto: pasa a Editor, abre uno desde «Archivos de la carpeta» y vuelve para enviar",
   "ai.composer.updating": "Hay una actualización en curso: inténtalo de nuevo en un momento",
   "ai.composer.generating": "Generación en curso: espera a que termine, o pulsa Detener",
   "ai.newChat.alreadyEmpty": "La conversación ya está vacía",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Usar todo el documento",
   "ai.suggestions": "Sugerencias",
   "ai.generating": "Generando… {seconds} s",
-  "ai.warningsCount": "{count} avisos",
+  "ai.generatingStarted": "Generando una propuesta",
+  "ai.generatingProgress": "{done} de {total} partes listas",
+  "ai.warningsCount.one": "{count} aviso",
+  "ai.warningsCount.other": "{count} avisos",
   "settings.sections": "Secciones de ajustes",
   "settings.general": "General",
   "settings.aiProfiles": "IA · Perfiles",
diff --git a/src/i18n/locales/fr.json b/src/i18n/locales/fr.json
index 2093257..dc38875 100644
--- a/src/i18n/locales/fr.json
+++ b/src/i18n/locales/fr.json
@@ -71,6 +71,7 @@
   "search.none": "Aucun résultat",
   "pane.editor": "Éditeur",
   "pane.preview": "Aperçu",
+  "editor.content": "Texte du document",
   "preview.frontmatterInvalid": "Frontmatter non valide : {detail}",
   "preview.imageMissing": "Image introuvable : {path}",
   "settings.title": "Paramètres",
@@ -143,13 +144,15 @@
   "ai.request": "Posez une question sur ce document… (Maj+Entrée pour aller à la ligne)",
   "ai.working": "Traitement en cours…",
   "ai.proposalReady": "Proposition prête à être examinée.",
+  "ai.diff.current": "Document actuel",
+  "ai.diff.proposal": "Proposition de l'IA",
   "ai.retry": "Réessayer",
   "ai.newChat": "Nouvelle conversation",
   "ai.stop": "Arrêter",
   "ai.send": "Envoyer",
   "ai.composer.needText": "Écrivez un message avant d’envoyer",
   "ai.composer.needProfile": "Choisissez un profil avant d’envoyer",
-  "ai.composer.noDocument": "Ouvrez un document avant d’envoyer",
+  "ai.composer.noDocument": "Aucun document ouvert : passez à Éditeur, ouvrez-en un depuis « Fichiers du dossier », puis revenez envoyer",
   "ai.composer.updating": "Une mise à jour est en cours : réessayez dans un instant",
   "ai.composer.generating": "Génération en cours : attendez qu’elle se termine, ou appuyez sur Arrêter",
   "ai.newChat.alreadyEmpty": "La conversation est déjà vide",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Utiliser tout le document",
   "ai.suggestions": "Suggestions",
   "ai.generating": "Génération… {seconds} s",
-  "ai.warningsCount": "{count} avertissements",
+  "ai.generatingStarted": "Génération d'une proposition",
+  "ai.generatingProgress": "{done} parties prêtes sur {total}",
+  "ai.warningsCount.one": "{count} avertissement",
+  "ai.warningsCount.other": "{count} avertissements",
   "settings.sections": "Sections des réglages",
   "settings.general": "Général",
   "settings.aiProfiles": "IA · Profils",
diff --git a/src/i18n/locales/it.json b/src/i18n/locales/it.json
index 1128649..4eeb926 100644
--- a/src/i18n/locales/it.json
+++ b/src/i18n/locales/it.json
@@ -71,6 +71,7 @@
   "search.none": "Nessun risultato",
   "pane.editor": "Editor",
   "pane.preview": "Anteprima",
+  "editor.content": "Testo del documento",
   "preview.frontmatterInvalid": "Frontmatter non valido: {detail}",
   "preview.imageMissing": "Immagine non trovata: {path}",
   "settings.title": "Impostazioni",
@@ -143,13 +144,15 @@
   "ai.request": "Chiedi qualcosa su questo documento… (Shift+Invio per andare a capo)",
   "ai.working": "Al lavoro…",
   "ai.proposalReady": "Proposta pronta per la revisione.",
+  "ai.diff.current": "Documento attuale",
+  "ai.diff.proposal": "Proposta dell'AI",
   "ai.retry": "Riprova",
   "ai.newChat": "Nuova chat",
   "ai.stop": "Ferma",
   "ai.send": "Invia",
   "ai.composer.needText": "Scrivi un messaggio prima di inviare",
   "ai.composer.needProfile": "Scegli un profilo prima di inviare",
-  "ai.composer.noDocument": "Apri un documento prima di inviare",
+  "ai.composer.noDocument": "Nessun documento aperto: passa a Editor, aprine uno da «File della cartella» e torna qui a inviare",
   "ai.composer.updating": "Aggiornamento in corso: riprova tra un momento",
   "ai.composer.generating": "Generazione in corso: aspetta che finisca, oppure premi Ferma",
   "ai.newChat.alreadyEmpty": "La chat è già vuota",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Usa tutto il documento",
   "ai.suggestions": "Suggerimenti",
   "ai.generating": "Generazione… {seconds} s",
-  "ai.warningsCount": "{count} avvisi",
+  "ai.generatingStarted": "Generazione della proposta in corso",
+  "ai.generatingProgress": "{done} di {total} parti pronte",
+  "ai.warningsCount.one": "{count} avviso",
+  "ai.warningsCount.other": "{count} avvisi",
   "settings.sections": "Sezioni delle impostazioni",
   "settings.general": "Generale",
   "settings.aiProfiles": "AI · Profili",
diff --git a/src/i18n/locales/ja.json b/src/i18n/locales/ja.json
index 854f03c..c4385d4 100644
--- a/src/i18n/locales/ja.json
+++ b/src/i18n/locales/ja.json
@@ -71,6 +71,7 @@
   "search.none": "結果はありません",
   "pane.editor": "エディター",
   "pane.preview": "プレビュー",
+  "editor.content": "ドキュメントの本文",
   "preview.frontmatterInvalid": "フロントマターが無効です：{detail}",
   "preview.imageMissing": "画像が見つかりません：{path}",
   "settings.title": "設定",
@@ -143,13 +144,15 @@
   "ai.request": "この文書について質問…（Shift+Enter で改行）",
   "ai.working": "処理中…",
   "ai.proposalReady": "提案を確認できます。",
+  "ai.diff.current": "現在のドキュメント",
+  "ai.diff.proposal": "AI の提案",
   "ai.retry": "再試行",
   "ai.newChat": "新しいチャット",
   "ai.stop": "停止",
   "ai.send": "送信",
   "ai.composer.needText": "送信する前にメッセージを入力してください",
   "ai.composer.needProfile": "送信する前にプロファイルを選択してください",
-  "ai.composer.noDocument": "送信する前にドキュメントを開いてください",
+  "ai.composer.noDocument": "ドキュメントが開かれていません。エディターに切り替え、「フォルダー内のファイル」から開いてから、戻って送信してください",
   "ai.composer.updating": "更新中です。しばらくしてからもう一度お試しください",
   "ai.composer.generating": "生成中です。終わるのを待つか、停止を押してください",
   "ai.newChat.alreadyEmpty": "チャットはすでに空です",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "文書全体を使う",
   "ai.suggestions": "候補",
   "ai.generating": "生成中… {seconds} 秒",
-  "ai.warningsCount": "警告 {count} 件",
+  "ai.generatingStarted": "提案を生成中",
+  "ai.generatingProgress": "{total} 件中 {done} 件の部分が完成",
+  "ai.warningsCount.one": "警告 {count} 件",
+  "ai.warningsCount.other": "警告 {count} 件",
   "settings.sections": "設定の項目",
   "settings.general": "一般",
   "settings.aiProfiles": "AI · プロファイル",
diff --git a/src/i18n/locales/nl.json b/src/i18n/locales/nl.json
index 02503a3..57268f1 100644
--- a/src/i18n/locales/nl.json
+++ b/src/i18n/locales/nl.json
@@ -71,6 +71,7 @@
   "search.none": "Geen resultaten",
   "pane.editor": "Editor",
   "pane.preview": "Voorbeeld",
+  "editor.content": "Documenttekst",
   "preview.frontmatterInvalid": "Ongeldige frontmatter: {detail}",
   "preview.imageMissing": "Afbeelding niet gevonden: {path}",
   "settings.title": "Instellingen",
@@ -143,13 +144,15 @@
   "ai.request": "Vraag iets over dit document… (Shift+Enter voor een nieuwe regel)",
   "ai.working": "Bezig…",
   "ai.proposalReady": "Voorstel klaar om te beoordelen.",
+  "ai.diff.current": "Huidig document",
+  "ai.diff.proposal": "AI-voorstel",
   "ai.retry": "Opnieuw proberen",
   "ai.newChat": "Nieuwe chat",
   "ai.stop": "Stoppen",
   "ai.send": "Verzenden",
   "ai.composer.needText": "Schrijf een bericht voordat je verzendt",
   "ai.composer.needProfile": "Kies een profiel voordat je verzendt",
-  "ai.composer.noDocument": "Open een document voordat je verzendt",
+  "ai.composer.noDocument": "Geen document geopend: ga naar Editor, open er een uit ‘Bestanden in de map’ en kom terug om te verzenden",
   "ai.composer.updating": "Er is een update bezig: probeer het zo opnieuw",
   "ai.composer.generating": "Generatie bezig: wacht tot die klaar is, of druk op Stoppen",
   "ai.newChat.alreadyEmpty": "De chat is al leeg",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Hele document gebruiken",
   "ai.suggestions": "Suggesties",
   "ai.generating": "Bezig… {seconds} s",
-  "ai.warningsCount": "{count} waarschuwingen",
+  "ai.generatingStarted": "Voorstel wordt gemaakt",
+  "ai.generatingProgress": "{done} van {total} delen klaar",
+  "ai.warningsCount.one": "{count} waarschuwing",
+  "ai.warningsCount.other": "{count} waarschuwingen",
   "settings.sections": "Onderdelen van instellingen",
   "settings.general": "Algemeen",
   "settings.aiProfiles": "AI · Profielen",
diff --git a/src/i18n/locales/pl.json b/src/i18n/locales/pl.json
index e31c3e5..a0a8135 100644
--- a/src/i18n/locales/pl.json
+++ b/src/i18n/locales/pl.json
@@ -71,6 +71,7 @@
   "search.none": "Brak wyników",
   "pane.editor": "Edytor",
   "pane.preview": "Podgląd",
+  "editor.content": "Tekst dokumentu",
   "preview.frontmatterInvalid": "Nieprawidłowy frontmatter: {detail}",
   "preview.imageMissing": "Nie znaleziono obrazu: {path}",
   "settings.title": "Ustawienia",
@@ -143,13 +144,15 @@
   "ai.request": "Zapytaj o ten dokument… (Shift+Enter – nowy wiersz)",
   "ai.working": "Przetwarzanie…",
   "ai.proposalReady": "Propozycja jest gotowa do sprawdzenia.",
+  "ai.diff.current": "Bieżący dokument",
+  "ai.diff.proposal": "Propozycja AI",
   "ai.retry": "Spróbuj ponownie",
   "ai.newChat": "Nowy czat",
   "ai.stop": "Zatrzymaj",
   "ai.send": "Wyślij",
   "ai.composer.needText": "Napisz wiadomość przed wysłaniem",
   "ai.composer.needProfile": "Wybierz profil przed wysłaniem",
-  "ai.composer.noDocument": "Otwórz dokument przed wysłaniem",
+  "ai.composer.noDocument": "Brak otwartego dokumentu: przejdź do trybu Edytor, otwórz dokument z „Pliki w folderze” i wróć, aby wysłać",
   "ai.composer.updating": "Trwa aktualizacja: spróbuj ponownie za chwilę",
   "ai.composer.generating": "Trwa generowanie: poczekaj, aż się skończy, albo naciśnij Zatrzymaj",
   "ai.newChat.alreadyEmpty": "Czat jest już pusty",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Użyj całego dokumentu",
   "ai.suggestions": "Sugestie",
   "ai.generating": "Generowanie… {seconds} s",
-  "ai.warningsCount": "Ostrzeżenia: {count}",
+  "ai.generatingStarted": "Generowanie propozycji",
+  "ai.generatingProgress": "Gotowe części: {done} z {total}",
+  "ai.warningsCount.one": "Ostrzeżenia: {count}",
+  "ai.warningsCount.other": "Ostrzeżenia: {count}",
   "settings.sections": "Sekcje ustawień",
   "settings.general": "Ogólne",
   "settings.aiProfiles": "AI · Profile",
diff --git a/src/i18n/locales/pt.json b/src/i18n/locales/pt.json
index 37e3f4f..70da755 100644
--- a/src/i18n/locales/pt.json
+++ b/src/i18n/locales/pt.json
@@ -71,6 +71,7 @@
   "search.none": "Sem resultados",
   "pane.editor": "Editor",
   "pane.preview": "Pré-visualização",
+  "editor.content": "Texto do documento",
   "preview.frontmatterInvalid": "Frontmatter inválido: {detail}",
   "preview.imageMissing": "Imagem não encontrada: {path}",
   "settings.title": "Definições",
@@ -143,13 +144,15 @@
   "ai.request": "Pergunte sobre este documento… (Shift+Enter para nova linha)",
   "ai.working": "A processar…",
   "ai.proposalReady": "Proposta pronta para revisão.",
+  "ai.diff.current": "Documento atual",
+  "ai.diff.proposal": "Proposta da IA",
   "ai.retry": "Tentar novamente",
   "ai.newChat": "Nova conversa",
   "ai.stop": "Parar",
   "ai.send": "Enviar",
   "ai.composer.needText": "Escreva uma mensagem antes de enviar",
   "ai.composer.needProfile": "Escolha um perfil antes de enviar",
-  "ai.composer.noDocument": "Abra um documento antes de enviar",
+  "ai.composer.noDocument": "Nenhum documento aberto: mude para Editor, abra um em «Ficheiros da pasta» e volte para enviar",
   "ai.composer.updating": "Há uma atualização em curso: tente novamente daqui a pouco",
   "ai.composer.generating": "Geração em curso: espere que termine, ou prima Parar",
   "ai.newChat.alreadyEmpty": "A conversa já está vazia",
@@ -274,7 +277,10 @@
   "ai.selectionIgnore": "Usar o documento inteiro",
   "ai.suggestions": "Sugestões",
   "ai.generating": "Gerando… {seconds} s",
-  "ai.warningsCount": "{count} avisos",
+  "ai.generatingStarted": "Gerando uma proposta",
+  "ai.generatingProgress": "{done} de {total} partes prontas",
+  "ai.warningsCount.one": "{count} aviso",
+  "ai.warningsCount.other": "{count} avisos",
   "settings.sections": "Seções das configurações",
   "settings.general": "Geral",
   "settings.aiProfiles": "IA · Perfis",
```

- [ ] **Step 3: test degli elementi, prima del codice.**

```diff
diff --git a/src/editor/docExtensions.dom.test.ts b/src/editor/docExtensions.dom.test.ts
index 79944a5..9349131 100644
--- a/src/editor/docExtensions.dom.test.ts
+++ b/src/editor/docExtensions.dom.test.ts
@@ -33,6 +33,7 @@ function fakeHost(patch: { key?: string; readOnly?: boolean; session?: DocSessio
     readOnly: () => state.readOnly,
     session: () => patch.session ?? null,
     t: () => (key) => translate(EN_MESSAGES, key),
+    contentLabel: () => EN_MESSAGES['editor.content'],
     getDocs: () => [],
     saveImage: patch.saveImage ?? (async () => null),
     docChanged: (changes, texts) => void calls.push(['change', changes, texts]),
diff --git a/src/elements/ai/composer.dom.test.ts b/src/elements/ai/composer.dom.test.ts
index 3bc1b9e..d311f65 100644
--- a/src/elements/ai/composer.dom.test.ts
+++ b/src/elements/ai/composer.dom.test.ts
@@ -16,6 +16,7 @@ import { createI18nStore } from '../../state/i18nStore';
 import { countListeners } from '../../testing/countListeners';
 import { fakeAi } from '../../testing/fakeAi';
 import { installPopoverStub } from '../../testing/popoverStub';
+import { waitFor } from '../../testing/waitFor';
 
 installPopoverStub();
 
@@ -324,7 +325,7 @@ test('during an update Send says so; typing clears the note as for the other not
   assert.equal(note().textContent, '');
 });
 
-test('a suggestion (or Enter) during a generation says so, the draft stays, the note goes when the generation ends', () => {
+test('a suggestion (or Enter) during a generation says so, the draft stays, the note goes when the generation ends', async () => {
   const { el, ai, key, note, type, input, running } = mount();
   running(true);
   type('draft');
@@ -333,7 +334,9 @@ test('a suggestion (or Enter) during a generation says so, the draft stays, the
   assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
   assert.equal(input().value, 'draft');
   key('Enter');
-  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
+  // La stessa nota di nuovo: svuotata subito e riscritta dopo `ANNOUNCE_DELAY_MS`, così lo screen reader la rilegge.
+  assert.equal(note().textContent, '');
+  await waitFor(() => note().textContent === EN_MESSAGES['ai.composer.generating']);
   running(false);
   assert.equal(note().textContent, '');
 });
@@ -388,3 +391,45 @@ test('with the real controller: the updating note goes when cancel() ends the up
   assert.equal(note().textContent, '');
   assert.equal(input().value, 'draft');
 });
+
+test('a double click on Send sends once and does not stop: only the click right after the sending one (detail + 1) is ignored on Stop', () => {
+  const { ai, send, type, running, key } = mount();
+  const click = (detail: number) => send().dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
+  const calls = () => ai.calls.map((c) => c[0]);
+  type('fix');
+  click(1);
+  running(true);
+  click(2);
+  assert.deepEqual(calls(), ['send'], 'la seconda metà del doppio clic');
+  // Una serie rapida su Stop (detail 3) ferma: chi ha un tremore clicca così.
+  click(3);
+  assert.deepEqual(calls(), ['send', 'stop']);
+  // Invio dalla tastiera, poi un clic singolo su Stop: ferma.
+  running(false);
+  type('again');
+  key('Enter');
+  running(true);
+  click(1);
+  assert.deepEqual(calls(), ['send', 'stop', 'send', 'stop']);
+});
+
+test('the draft: given before connecting it fills the box; typing and sending tell it out with hmd-ai-draft', () => {
+  const ai = fakeAi({ presets: [PRESET] }, defaultProfile('ollama', 'o'));
+  const el = document.createElement('hmd-ai-composer');
+  el.draft = 'half written';
+  el.controller = ai;
+  el.text = TEXT;
+  el.i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
+  const drafts: string[] = [];
+  el.addEventListener('hmd-ai-draft', (event) => drafts.push(event.detail.text));
+  document.body.append(el);
+  const input = el.querySelector('textarea')!;
+  assert.equal(input.value, 'half written');
+  input.value = 'half written, done';
+  input.dispatchEvent(new Event('input', { bubbles: true }));
+  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
+  assert.deepEqual(drafts, ['half written, done', '']);
+  // Dopo la costruzione la bozza non riscrive più la casella.
+  el.draft = 'other';
+  assert.equal(input.value, '');
+});
diff --git a/src/elements/ai/review-bar.dom.test.ts b/src/elements/ai/review-bar.dom.test.ts
index e581bfd..e469d6c 100644
--- a/src/elements/ai/review-bar.dom.test.ts
+++ b/src/elements/ai/review-bar.dom.test.ts
@@ -11,6 +11,7 @@ import { EN_MESSAGES } from '../../i18n/messages';
 import { createI18nStore } from '../../state/i18nStore';
 import { countListeners } from '../../testing/countListeners';
 import { installPopoverStub } from '../../testing/popoverStub';
+import { waitFor } from '../../testing/waitFor';
 import type { HmdEvents } from '../events';
 
 installPopoverStub();
@@ -69,21 +70,26 @@ test('the same DOM as ReviewBar.tsx without status or warnings, then the empty s
   assert.ok(byLabel(EN_MESSAGES['ai.acceptAll']));
 });
 
-test('while generating: the counter with progress in a polite live region; every button active, activated it writes the note and keeps the focus', () => {
+test('while generating: the counter with progress, not live; every button active, activated it writes the note and keeps the focus', async () => {
   const { status, byLabel, buttons, note, events } = mount(GENERATING, [], 'generating');
   assert.equal(status()!.textContent, `${EN_MESSAGES['ai.generating'].replace('{seconds}', '3')} 1/3`);
-  assert.equal(status()!.getAttribute('aria-live'), 'polite');
+  assert.equal(status()!.hasAttribute('aria-live'), false, 'i secondi non parlano (LAB-42 P1)');
   assert.equal(status()!.hasAttribute('role'), false);
   assert.equal(status()!.previousElementSibling, buttons()[1]);
   assert.equal(status()!.nextElementSibling!.className, 'spacer');
-  for (const button of [buttons()[0], buttons()[1], byLabel(EN_MESSAGES['ai.discard']), byLabel(EN_MESSAGES['ai.acceptAll'])]) {
+  for (const button of [buttons()[0], buttons()[1], byLabel(EN_MESSAGES['ai.acceptAll'])]) {
     assert.equal(button.disabled, false);
     button.focus();
     button.click();
-    assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
+    // Dal secondo clic la stessa nota si svuota e torna dopo `ANNOUNCE_DELAY_MS`: lo screen reader la rilegge.
+    await waitFor(() => note().textContent === EN_MESSAGES['ai.review.generating']);
     focusOn(button, button.getAttribute('aria-label') ?? button.textContent ?? '');
   }
   assert.deepEqual(events, []);
+  // Scarta durante la generazione non ha nota: sale, e lo workspace ferma e scarta (controller.discard).
+  byLabel(EN_MESSAGES['ai.discard']).click();
+  assert.deepEqual(events, [['hmd-ai-review-action', { action: 'discard' }]]);
+  assert.equal(note().textContent, '');
 });
 
 test('the note goes when its cause goes: the generation ends, Accept all is possible again, or an action succeeds', () => {
@@ -126,7 +132,7 @@ test('Accept all says the reason of the controller, one text per reason, in the
 
 test('detached and attached again the note is forgotten', () => {
   const { el, byLabel, note } = mount(GENERATING, [], 'generating');
-  byLabel(EN_MESSAGES['ai.discard']).click();
+  byLabel(EN_MESSAGES['ai.acceptAll']).click();
   assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
   el.remove();
   document.body.append(el);
@@ -161,9 +167,12 @@ test('warnings: a button with the count and a popover with one button per warnin
   const { el, bar, popover, events } = mount({ kind: 'none' }, warnings);
   const button = bar().querySelector<HTMLButtonElement>('button[popovertarget]')!;
   assert.equal(button.className, 'secondary tooltip');
-  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount'].replace('{count}', '2'));
-  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['ai.warningsCount'].replace('{count}', '2'));
+  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount.other'].replace('{count}', '2'));
+  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['ai.warningsCount.other'].replace('{count}', '2'));
   assert.equal(button.textContent, ' 2');
+  el.warnings = [{ code: 'code' }];
+  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['ai.warningsCount.one'].replace('{count}', '1'), 'one warning: singular');
+  el.warnings = warnings;
   assert.ok(button.querySelector('span.icon'));
   assert.equal(button.previousElementSibling!.className, 'spacer');
   assert.equal(popover()!.id, button.getAttribute('popovertarget'));
@@ -222,7 +231,7 @@ test('the proposal changes while the same block holds: the note is forgotten and
 
 test('a language change rewrites labels, tooltips, warnings and the note; detached, no listener stays', async () => {
   const { el, i18n, listeners, buttons, byLabel, popover, note } = mount(GENERATING, [{ code: 'wikilinks' }], 'generating');
-  byLabel(EN_MESSAGES['ai.discard']).click();
+  buttons()[1].click();
   await i18n.setLocale('it');
   assert.equal(note().textContent, 'ASPETTA');
   assert.equal(buttons()[0].getAttribute('aria-label'), 'PRIMA');
@@ -234,3 +243,42 @@ test('a language change rewrites labels, tooltips, warnings and the note; detach
   el.remove();
   assert.equal(listeners(), 0);
 });
+
+test('while generating a hidden polite region says the start and each new part, never the seconds', async () => {
+  const { el } = mount(GENERATING, [], 'generating');
+  const spoken = () => el.querySelector<HTMLElement>(':scope > .spoken');
+  assert.equal(spoken()!.getAttribute('aria-live'), 'polite');
+  assert.equal(spoken()!.textContent, '', 'entrata vuota: il testo arriva dopo la pausa');
+  const part = (done: number) => EN_MESSAGES['ai.generatingProgress'].replace('{done}', String(done)).replace('{total}', '3');
+  await waitFor(() => spoken()!.textContent === part(1));
+  const changes: string[] = [];
+  new MutationObserver(() => changes.push(spoken()!.textContent!)).observe(spoken()!, { childList: true, characterData: true, subtree: true });
+  el.status = { ...GENERATING, seconds: 4 };
+  el.status = { ...GENERATING, seconds: 5 };
+  el.status = { ...GENERATING, seconds: 6, done: 2 };
+  await new Promise((resolve) => setTimeout(resolve, 5));
+  assert.deepEqual(changes, [part(2)]);
+});
+
+test('when the generation ends the hidden region says the outcome (ready, partial, truncated) until the next action; no proposal, nothing', async () => {
+  const outcomes: [ReviewStatus, string | null][] = [
+    [{ kind: 'none' }, EN_MESSAGES['ai.proposalReady']],
+    [{ kind: 'partial' }, EN_MESSAGES['ai.status.partial']],
+    [{ kind: 'truncated' }, EN_MESSAGES['ai.status.truncated']],
+  ];
+  for (const [end, text] of outcomes) {
+    const { el, buttons } = mount(GENERATING, [], 'generating');
+    const spoken = () => el.querySelector<HTMLElement>(':scope > .spoken');
+    el.proposalId = 'a.md#1';
+    el.status = end;
+    el.acceptBlocker = null;
+    assert.equal(spoken()?.textContent, text, end.kind);
+    buttons()[1].click();
+    assert.equal(spoken(), null, `${end.kind}: the next action empties it`);
+    el.remove();
+  }
+  // Generazione fermata prima di una proposta: nessun esito da dire.
+  const { el } = mount(GENERATING, [], 'generating');
+  el.status = { kind: 'none' };
+  assert.equal(el.querySelector(':scope > .spoken'), null);
+});
diff --git a/src/elements/ai/review.dom.test.ts b/src/elements/ai/review.dom.test.ts
index f703314..b4aad0f 100644
--- a/src/elements/ai/review.dom.test.ts
+++ b/src/elements/ai/review.dom.test.ts
@@ -206,7 +206,7 @@ test('typing in the plain editor reaches docChanged and selectionChanged; a lang
   assert.equal(selections.length, 1);
   await i18n.setLocale('it');
   assert.equal(section().querySelector('.hint')!.textContent, 'SCRIVI');
-  assert.equal(listeners(), 1);
+  assert.equal(listeners(), 2, 'la revisione e il nome del contenuto di hmd-editor');
   assert.equal(changes.length, 0);
   el.remove();
   assert.equal(listeners(), 0);
@@ -278,3 +278,10 @@ test('a confirmation resolved while the view goes away accepts nothing: detached
   await tick();
   assert.deepEqual(ai.calls, [['beforeAccept', 'a.md', true]]);
 });
+
+test('Discard while generating, before any proposal: the request on this document is stopped (Discard = Stop + discard)', async () => {
+  const { ai, button } = mount({ running: { path: 'a.md' } } as Partial<AiState>);
+  await tick();
+  button(EN_MESSAGES['ai.discard']).click();
+  assert.deepEqual(ai.calls, [['discard', 'a.md']]);
+});
diff --git a/src/elements/ai/reviewBarView.test.ts b/src/elements/ai/reviewBarView.test.ts
index 8d28ed7..9622b08 100644
--- a/src/elements/ai/reviewBarView.test.ts
+++ b/src/elements/ai/reviewBarView.test.ts
@@ -4,18 +4,26 @@ import assert from 'node:assert/strict';
 import type { ReviewStatus } from '../../ai/reviewStatus';
 import { translate, type Params } from '../../i18n/i18n';
 import { EN_MESSAGES } from '../../i18n/messages';
-import { actionBlocker, statusLine } from './reviewBarView';
+import { actionBlocker, generationOutcome, statusLine } from './reviewBarView';
 
 const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
 const none: ReviewStatus = { kind: 'none' };
 const generating: ReviewStatus = { kind: 'generating', seconds: 3 };
 
-test('while generating every action but Continue says so; otherwise the arrows and Discard are free', () => {
-  for (const action of ['previous', 'next', 'discard', 'acceptAll'] as const) assert.equal(actionBlocker(action, generating, 'generating'), 'ai.review.generating', action);
+test('while generating the arrows and Accept all say so; Discard stops and discards; otherwise the arrows and Discard are free', () => {
+  for (const action of ['previous', 'next', 'acceptAll'] as const) assert.equal(actionBlocker(action, generating, 'generating'), 'ai.review.generating', action);
+  assert.equal(actionBlocker('discard', generating, 'generating'), null, 'Scarta = Ferma + scarta');
   assert.equal(actionBlocker('continue', generating, 'generating'), null);
   for (const action of ['previous', 'next', 'discard', 'continue'] as const) assert.equal(actionBlocker(action, none, 'truncated'), null, action);
 });
 
+test('Continue during an update says so (it would be ignored in silence); otherwise it goes', () => {
+  const partial: ReviewStatus = { kind: 'partial' };
+  assert.equal(actionBlocker('continue', partial, 'updating'), 'ai.review.updating');
+  assert.equal(actionBlocker('continue', partial, 'notAcceptable'), null);
+  assert.equal(actionBlocker('continue', partial, null), null);
+});
+
 test('Accept all carries the reason of the controller, one key per reason', () => {
   assert.equal(actionBlocker('acceptAll', none, null), null);
   assert.equal(actionBlocker('acceptAll', { kind: 'truncated' }, 'truncated'), 'ai.review.truncated');
@@ -31,10 +39,21 @@ test('every note key exists in en.json', () => {
 
 test('the status line: nothing, the counter with progress and a live region, partial with Continue, the alert of the lost selection', () => {
   assert.equal(statusLine(none, t), null);
-  assert.deepEqual(statusLine({ kind: 'generating', seconds: 3 }, t), { text: t('ai.generating', { seconds: 3 }), live: true, alert: false, withContinue: false });
+  assert.deepEqual(statusLine({ kind: 'generating', seconds: 3 }, t), { text: t('ai.generating', { seconds: 3 }), spoken: t('ai.generatingStarted'), alert: false, withContinue: false });
   assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.text, `${t('ai.generating', { seconds: 3 })} 1/3`);
-  assert.deepEqual(statusLine({ kind: 'partial' }, t), { text: t('ai.status.partial'), live: false, alert: false, withContinue: true });
-  assert.deepEqual(statusLine({ kind: 'truncated' }, t), { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false });
-  assert.deepEqual(statusLine({ kind: 'scopeLost' }, t), { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false });
-  assert.deepEqual(statusLine({ kind: 'applied' }, t), { text: t('ai.applied'), live: false, alert: false, withContinue: false });
+  // Quello che si annuncia non contiene i secondi: cambia solo con il progresso.
+  assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.spoken, t('ai.generatingProgress', { done: 1, total: 3 }));
+  assert.equal(statusLine({ kind: 'generating', seconds: 9, done: 1, total: 3 }, t)!.spoken, statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.spoken);
+  assert.deepEqual(statusLine({ kind: 'partial' }, t), { text: t('ai.status.partial'), spoken: null, alert: false, withContinue: true });
+  assert.deepEqual(statusLine({ kind: 'truncated' }, t), { text: t('ai.status.truncated'), spoken: null, alert: false, withContinue: false });
+  assert.deepEqual(statusLine({ kind: 'scopeLost' }, t), { text: t('ai.error.scopeLost'), spoken: null, alert: true, withContinue: false });
+  assert.deepEqual(statusLine({ kind: 'applied' }, t), { text: t('ai.applied'), spoken: null, alert: false, withContinue: false });
+});
+
+test('the outcome of a generation: ready, partial, truncated; nothing without a proposal or for a lost selection (it has its alert)', () => {
+  assert.equal(generationOutcome({ kind: 'none' }, true, t), t('ai.proposalReady'));
+  assert.equal(generationOutcome({ kind: 'partial' }, true, t), t('ai.status.partial'));
+  assert.equal(generationOutcome({ kind: 'truncated' }, true, t), t('ai.status.truncated'));
+  assert.equal(generationOutcome({ kind: 'none' }, false, t), null);
+  assert.equal(generationOutcome({ kind: 'scopeLost' }, true, t), null);
 });
diff --git a/src/elements/editor/editor.dom.test.ts b/src/elements/editor/editor.dom.test.ts
index 69fa75c..7c185a1 100644
--- a/src/elements/editor/editor.dom.test.ts
+++ b/src/elements/editor/editor.dom.test.ts
@@ -36,7 +36,7 @@ function slowSave() {
   return { saveImage, saved, pending };
 }
 
-function mount(text: string, key = 'a.md#1') {
+function mount(text: string, key = 'a.md#1', store = i18n) {
   const session = createDocSession(key, text);
   const el = document.createElement('hmd-editor');
   el.text = text;
@@ -44,7 +44,7 @@ function mount(text: string, key = 'a.md#1') {
   el.session = session;
   el.restore = null;
   el.readOnly = false;
-  el.i18n = i18n;
+  el.i18n = store;
   const events: Recorded[] = [];
   for (const type of ['hmd-doc-change', 'hmd-selection', 'hmd-top-line'] as const) {
     el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
@@ -255,3 +255,13 @@ test('a listener that assigns another document while a new one is announced: the
   assert.deepEqual(events.map(([type]) => type), ['hmd-selection', 'hmd-selection', 'hmd-doc-change', 'hmd-selection']);
   el.remove();
 });
+
+test('the content is a textbox named after the document text; a language change renames it', async () => {
+  const store = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'editor.content': 'TESTO' } }), persist() {} });
+  const { el } = mount('# A', 'a.md#1', store);
+  const content = el.querySelector('.cm-content')!;
+  assert.equal(content.getAttribute('role'), 'textbox');
+  assert.equal(content.getAttribute('aria-label'), EN_MESSAGES['editor.content']);
+  await store.setLocale('it');
+  assert.equal(content.getAttribute('aria-label'), 'TESTO');
+});
```

e in fondo a `workspace.dom.test.ts`:

```ts
test('AI mode: the draft of the composer survives going to the editor and back (LAB-10)', async () => {
  const { el, workspace, button } = await mount({ ai: true });
  await workspace.openFile('a.md');
  button(EN_MESSAGES['mode.ai']).click();
  const box = () => el.querySelector<HTMLTextAreaElement>('hmd-ai-composer textarea')!;
  box().value = 'fix the title';
  box().dispatchEvent(new Event('input', { bubbles: true }));
  button(EN_MESSAGES['mode.editor']).click();
  assert.equal(el.querySelector('hmd-ai-composer'), null);
  button(EN_MESSAGES['mode.ai']).click();
  assert.equal(box().value, 'fix the title');
});
```

RED atteso: `reviewBarView.test.ts` 3 rossi (Scarta durante la generazione, Continua durante un aggiornamento, l'esito); `review-bar.dom.test.ts` (la regione nascosta non c'è; il contatore ha ancora `aria-live`; la nota ripetuta non si svuota; nessun esito); `review.dom.test.ts` «Discard while generating, before any proposal» (`ai.calls` vuoto); `composer.dom.test.ts` doppio clic (`['send', 'stop']`), bozza (la casella nasce vuota), nota ripetuta; `editor.dom.test.ts` (nessun `aria-label`); `workspace.dom.test.ts` bozza (casella vuota al ritorno).

- [ ] **Step 4: barra della revisione** — regione nascosta della generazione con l'esito finale (P1, decisione 5), plurale (P4), nota ri-annunciata (LAB-11), Scarta e Continua:

```diff
diff --git a/src/elements/ai/review-bar.css b/src/elements/ai/review-bar.css
index 06da740..9cc95a1 100644
--- a/src/elements/ai/review-bar.css
+++ b/src/elements/ai/review-bar.css
@@ -85,5 +85,15 @@
     .note:not(:empty) {
       padding-block: 0 8px;
     }
+
+    /* Regione live della generazione: letta dallo screen reader, nascosta alla vista (il contatore visibile resta). */
+    .spoken {
+      position: absolute;
+      width: 1px;
+      height: 1px;
+      overflow: hidden;
+      clip-path: inset(50%);
+      white-space: nowrap;
+    }
   }
 }
diff --git a/src/elements/ai/review-bar.element.ts b/src/elements/ai/review-bar.element.ts
index b46548b..b46c130 100644
--- a/src/elements/ai/review-bar.element.ts
+++ b/src/elements/ai/review-bar.element.ts
@@ -2,14 +2,16 @@ import type { AcceptBlocker } from '../../ai/aiController';
 import type { ReviewStatus } from '../../ai/reviewStatus';
 import type { CheckWarning } from '../../ai/types';
 import { HmdElement } from '../../dom/element';
+import { announce } from '../../dom/announce';
 import { el, setText, toggleAttr } from '../../dom/el';
 import { icon } from '../../dom/icon';
 import { RenderLoop } from '../../dom/renderLoop';
 import { uid } from '../../dom/uid';
+import { pluralKey } from '../../i18n/i18n';
 import type { MessageKey } from '../../i18n/messages';
 import type { I18nStore } from '../../state/i18nStore';
 import { emit } from '../events';
-import { actionBlocker, statusLine, type ReviewAction, type ReviewBlocker } from './reviewBarView';
+import { actionBlocker, generationOutcome, statusLine, type ReviewAction, type ReviewBlocker } from './reviewBarView';
 import './review-bar.css';
 
 interface Parts {
@@ -27,6 +29,8 @@ interface Parts {
   acceptAll: HTMLButtonElement;
   /** Nota sotto la riga dei pulsanti (`role="status"`): perché il pulsante attivato non ha fatto nulla. Vuota di norma. */
   note: HTMLParagraphElement;
+  /** Regione live della generazione, nascosta alla vista: dopo la nota, solo durante la generazione. */
+  spoken: HTMLSpanElement;
 }
 
 /**
@@ -45,8 +49,12 @@ export class HmdAiReviewBar extends HmdElement {
   #acceptBlocker: AcceptBlocker | null = 'generating';
   #i18n: I18nStore | null = null;
   #proposalId = '';
+  /** Stato con cui è finita l'ultima generazione: la regione nascosta ne dice l'esito fino alla prossima azione. */
+  #outcome: ReviewStatus | null = null;
   /** Nota mostrata: l'azione che l'ha prodotta e la sua chiave, per sapere quando la causa sparisce. */
   #note: { action: ReviewAction; key: ReviewBlocker } | null = null;
+  /** Il prossimo render riscrive la nota anche se il testo è lo stesso (un altro clic bloccato). */
+  #announceAgain = false;
 
   #parts: Parts | null = null;
   #loop = new RenderLoop(this, {
@@ -59,7 +67,11 @@ export class HmdAiReviewBar extends HmdElement {
 
   get status(): ReviewStatus { return this.#status; }
   set status(value: ReviewStatus) {
-    this.#status = value ?? { kind: 'none' };
+    const next = value ?? { kind: 'none' };
+    // Fine della generazione: la regione nascosta dirà l'esito finché non arriva un'azione (P1, A11y).
+    if (this.#status.kind === 'generating' && next.kind !== 'generating') this.#outcome = next;
+    if (next.kind === 'generating') this.#outcome = null;
+    this.#status = next;
     this.#loop.update();
   }
   get warnings(): CheckWarning[] { return this.#warnings; }
@@ -74,6 +86,8 @@ export class HmdAiReviewBar extends HmdElement {
     if (value === this.#proposalId) return;
     this.#proposalId = value;
     this.#note = null;
+    // L'esito era della proposta di prima (la prima proposta arrivata durante la generazione non ha esito).
+    if (this.#status.kind !== 'generating') this.#outcome = null;
     this.#loop.update();
   }
   /** Perché Accetta tutto non può (dal controller, `acceptBlocker(p, true)`), o null. */
@@ -109,6 +123,7 @@ export class HmdAiReviewBar extends HmdElement {
         discard: action('discard', 'secondary'),
         acceptAll: action('acceptAll', 'secondary accept'),
         note: el('p', { class: 'note', role: 'status' }),
+        spoken: el('span', { class: 'spoken', 'aria-live': 'polite' }),
       };
       this.#parts = parts;
       parts.bar.append(parts.previous, parts.next, parts.spacer, parts.discard, parts.acceptAll);
@@ -121,14 +136,19 @@ export class HmdAiReviewBar extends HmdElement {
 
   disconnectedCallback(): void {
     super.disconnectedCallback();
-    // La barra sparita (proposta scartata o applicata) non ricorda la nota.
+    // La barra sparita (proposta scartata o applicata) non ricorda la nota né l'esito.
     this.#note = null;
+    this.#outcome = null;
   }
 
   /** Un pulsante attivato: se l'azione non è possibile la nota dice perché, altrimenti l'azione sale e la nota se ne va. */
   #onAction(action: ReviewAction): void {
     const key = actionBlocker(action, this.#status, this.#acceptBlocker);
+    // La stessa nota di nuovo (Successivo, Scarta, Accetta tutto durante la generazione): si ri-annuncia.
+    this.#announceAgain = key !== null && this.#note?.key === key;
     this.#note = key ? { action, key } : null;
+    // L'esito della generazione si è detto: alla prossima azione la regione si svuota.
+    this.#outcome = null;
     this.#loop.update();
     if (!key) emit(this, 'hmd-ai-review-action', { action });
   }
@@ -144,7 +164,6 @@ export class HmdAiReviewBar extends HmdElement {
     const line = statusLine(this.#status, t);
     if (line) {
       setText(parts.status, line.text);
-      toggleAttr(parts.status, 'aria-live', line.live, 'polite');
       toggleAttr(parts.status, 'role', line.alert, 'alert');
       if (parts.status.parentNode !== bar) bar.insertBefore(parts.status, parts.spacer);
       if (line.withContinue) {
@@ -157,10 +176,21 @@ export class HmdAiReviewBar extends HmdElement {
       parts.status.remove();
       parts.continue.remove();
     }
+    // La regione della generazione: entrata nel DOM vuota, il testo arriva dopo `ANNOUNCE_DELAY_MS` (così si annuncia);
+    // a generazione finita dice l'esito, fino alla prossima azione.
+    const spoken = line?.spoken ?? (this.#outcome ? generationOutcome(this.#outcome, this.#proposalId !== '', t) : null);
+    if (spoken) {
+      const entering = parts.spoken.parentNode !== this;
+      if (entering) this.append(parts.spoken);
+      announce(parts.spoken, spoken, entering);
+    } else {
+      announce(parts.spoken, '');
+      parts.spoken.remove();
+    }
     // Avvisi: pulsante e popover solo se ce ne sono; i pulsanti del popover si riusano per posizione (come React senza chiavi).
     const warnings = this.#warnings;
     if (warnings.length > 0) {
-      const label = t('ai.warningsCount', { count: warnings.length });
+      const label = t(pluralKey(i18n.getState().locale, 'ai.warningsCount', warnings.length), { count: warnings.length });
       toggleAttr(parts.warnings, 'aria-label', true, label);
       toggleAttr(parts.warnings, 'data-tooltip', true, label);
       setText(parts.count, ` ${warnings.length}`);
@@ -181,9 +211,10 @@ export class HmdAiReviewBar extends HmdElement {
     }
     setText(parts.discard, t('ai.discard'));
     setText(parts.acceptAll, t('ai.acceptAll'));
-    // La nota resta finché vale la causa che l'ha prodotta (per quella azione); la stessa nota due volte di fila non si ri-annuncia: accettato.
+    // La nota resta finché vale la causa che l'ha prodotta (per quella azione); la stessa nota a un altro clic si ri-annuncia.
     if (this.#note && actionBlocker(this.#note.action, this.#status, this.#acceptBlocker) !== this.#note.key) this.#note = null;
-    setText(parts.note, this.#note ? t(this.#note.key) : '');
+    announce(parts.note, this.#note ? t(this.#note.key) : '', this.#announceAgain);
+    this.#announceAgain = false;
   }
 }
 
diff --git a/src/elements/ai/review.element.ts b/src/elements/ai/review.element.ts
index eb75b44..880d708 100644
--- a/src/elements/ai/review.element.ts
+++ b/src/elements/ai/review.element.ts
@@ -201,8 +201,10 @@ export class HmdAiReview extends HmdElement {
   }
 
   #discard(): void {
-    const p = this.#current();
-    if (p) this.#controller?.discard(p.path);
+    // Durante la generazione la proposta può non esserci ancora: `discard` del documento ferma la richiesta
+    // in corso su quel percorso e toglie l'eventuale proposta (Scarta = Ferma + scarta).
+    const path = this.#current()?.path ?? this.#doc?.path;
+    if (path) this.#controller?.discard(path);
   }
 
   /**
diff --git a/src/elements/ai/reviewBarView.ts b/src/elements/ai/reviewBarView.ts
index 2eeac56..b1e4d56 100644
--- a/src/elements/ai/reviewBarView.ts
+++ b/src/elements/ai/reviewBarView.ts
@@ -9,22 +9,27 @@ export type ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'cont
 export type ReviewBlocker = `ai.review.${AcceptBlocker}`;
 
 /**
- * Perché l'azione non è possibile adesso (chiave della nota), o null. Le frecce e Scarta si fermano solo
- * durante la generazione (come i `disabled` di ReviewBar.tsx); Accetta tutto ha la ragione del controller
- * (`acceptBlocker(p, true)`, già nell'ordine della barra); Continua non si ferma mai qui (il controller
- * ignora in silenzio un Continua durante un aggiornamento: resta com'è, da rivedere in fase 8).
+ * Perché l'azione non è possibile adesso (chiave della nota), o null. Le frecce si fermano solo durante la
+ * generazione; Scarta non si ferma mai (durante la generazione il controller ferma e scarta: `discard()`);
+ * Accetta tutto ha la ragione del controller (`acceptBlocker(p, true)`, già nell'ordine della barra);
+ * Continua si ferma durante un aggiornamento, che il controller altrimenti ignorerebbe in silenzio.
  */
 export function actionBlocker(action: ReviewAction, status: ReviewStatus, acceptBlocker: AcceptBlocker | null): ReviewBlocker | null {
   if (action === 'acceptAll') return acceptBlocker ? `ai.review.${acceptBlocker}` : null;
-  if (action === 'continue') return null;
+  if (action === 'continue') return acceptBlocker === 'updating' ? 'ai.review.updating' : null;
+  if (action === 'discard') return null;
   return isBusy(status) ? 'ai.review.generating' : null;
 }
 
 /** Testo e attributi dello span di stato (StatusText di ReviewBar.tsx), o null quando non c'è niente da dire. */
 export interface StatusLine {
   text: string;
-  /** `aria-live="polite"` solo durante la generazione (il contatore dei secondi). */
-  live: boolean;
+  /**
+   * Durante la generazione, il testo della regione live a parte (`span.spoken`, nascosto alla vista): fisso
+   * all'avvio e nuovo solo quando cambia il progresso `n/m`. Il contatore dei secondi, visibile, non è più una
+   * regione live (LAB-42 P1, WCAG 2.2.2). Null negli altri stati.
+   */
+  spoken: string | null;
   /** `role="alert"` solo per la selezione persa. */
   alert: boolean;
   /** Il pulsante «Continua» accanto, solo per una proposta a parti interrotta. */
@@ -36,14 +41,38 @@ export function statusLine(status: ReviewStatus, t: I18nStore['t']): StatusLine
     case 'none':
       return null;
     case 'generating':
-      return { text: `${t('ai.generating', { seconds: status.seconds })}${status.total ? ` ${status.done}/${status.total}` : ''}`, live: true, alert: false, withContinue: false };
+      return {
+        text: `${t('ai.generating', { seconds: status.seconds })}${status.total ? ` ${status.done}/${status.total}` : ''}`,
+        spoken: status.total ? t('ai.generatingProgress', { done: status.done ?? 0, total: status.total }) : t('ai.generatingStarted'),
+        alert: false,
+        withContinue: false,
+      };
     case 'partial':
-      return { text: t('ai.status.partial'), live: false, alert: false, withContinue: true };
+      return { text: t('ai.status.partial'), spoken: null, alert: false, withContinue: true };
     case 'truncated':
-      return { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false };
+      return { text: t('ai.status.truncated'), spoken: null, alert: false, withContinue: false };
     case 'scopeLost':
-      return { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false };
+      return { text: t('ai.error.scopeLost'), spoken: null, alert: true, withContinue: false };
     case 'applied':
-      return { text: t('ai.applied'), live: false, alert: false, withContinue: false };
+      return { text: t('ai.applied'), spoken: null, alert: false, withContinue: false };
+  }
+}
+
+/**
+ * Quello che la regione nascosta dice quando la generazione finisce (LAB-42 P1, A11y): proposta pronta, parziale o
+ * troncata. Null se non c'è una proposta (generazione fermata o fallita: lo dicono il registro e i toast) o se
+ * l'esito ha già la sua regione (`scopeLost` è un `role="alert"`).
+ */
+export function generationOutcome(status: ReviewStatus, hasProposal: boolean, t: I18nStore['t']): string | null {
+  if (!hasProposal) return null;
+  switch (status.kind) {
+    case 'none':
+      return t('ai.proposalReady');
+    case 'partial':
+      return t('ai.status.partial');
+    case 'truncated':
+      return t('ai.status.truncated');
+    default:
+      return null;
   }
 }
```

- [ ] **Step 5: composer e sidebar** — doppio clic (decisione 16), nota ri-annunciata, bozza; evento nuovo in `events.ts` (sopra il JSDoc di `hmd-ai-manage`):

```diff
diff --git a/src/elements/ai/composer.element.ts b/src/elements/ai/composer.element.ts
index 2a32346..86762da 100644
--- a/src/elements/ai/composer.element.ts
+++ b/src/elements/ai/composer.element.ts
@@ -1,12 +1,14 @@
 import { composerAction } from '../../ai/composerKeys';
 import type { TextRange } from '../../ai/selectionChip';
 import type { SelectionScope } from '../../ai/types';
+import { announce } from '../../dom/announce';
 import { HmdElement } from '../../dom/element';
 import { el, setText, toggleAttr } from '../../dom/el';
 import { icon } from '../../dom/icon';
 import { RenderLoop } from '../../dom/renderLoop';
 import type { I18nStore } from '../../state/i18nStore';
 import { ICONS } from '../../ui/icons';
+import { emit } from '../events';
 import type { HmdAiEffortChip } from './effort-chip.element';
 import type { HmdAiModelChip } from './model-chip.element';
 import { CONTROLLER_NOTES, outgoing, selectionChipText, sendBlocker, sendButton, type ComposerController, type SendBlocker } from './composerView';
@@ -42,6 +44,9 @@ interface Parts {
 export class HmdAiComposer extends HmdElement {
   #controller: ComposerController | null = null;
   #text = '';
+  #draft = '';
+  /** `detail` del clic che ha inviato (null se l'invio non è venuto da un clic del mouse). */
+  #sendDetail: number | null = null;
   #selection: TextRange | null = null;
   #getSelection: () => SelectionScope | undefined = () => undefined;
   #i18n: I18nStore | null = null;
@@ -51,6 +56,8 @@ export class HmdAiComposer extends HmdElement {
   #ignored: TextRange | null = null;
   /** Nota mostrata e il profilo di quel momento: un cambio di profilo la toglie. */
   #note: { key: SendBlocker; profileId: string | undefined } | null = null;
+  /** Il prossimo render riscrive la nota anche se il testo è lo stesso (un altro invio bloccato). */
+  #announceAgain = false;
   #loop = new RenderLoop(this, {
     ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
     render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
@@ -67,6 +74,12 @@ export class HmdAiComposer extends HmdElement {
     this.#passDown();
     this.reconnect();
   }
+  /**
+   * Bozza con cui la casella nasce (la sidebar AI si ricrea a ogni ritorno nella modalità AI: LAB-10). Letta solo
+   * alla costruzione: la casella non si riscrive mai dopo. Ogni cambio della casella esce con `hmd-ai-draft`.
+   */
+  get draft(): string { return this.#draft; }
+  set draft(value: string) { this.#draft = value ?? ''; }
   /** Testo del documento aperto, per contare la selezione. */
   get text(): string { return this.#text; }
   set text(value: string) {
@@ -114,10 +127,11 @@ export class HmdAiComposer extends HmdElement {
         input: el('textarea', { class: 'input', on: { input: () => this.#onInput(), keydown: (event) => this.#onKeyDown(event) } }),
         modelChip: el('hmd-ai-model-chip'),
         effortChip: el('hmd-ai-effort-chip'),
-        send: el('button', { type: 'button', class: 'send tooltip', on: { click: () => this.#onButton() } }, sendIcon),
+        send: el('button', { type: 'button', class: 'send tooltip', on: { click: (event) => this.#onButton(event) } }, sendIcon),
         sendIcon,
         note: el('p', { class: 'note', role: 'status' }),
       };
+      parts.input.value = this.#draft;
       this.#parts = parts;
       // Le proprietà dei chip prima dell'inserimento, come fa React con i tag hmd-*.
       this.#passDown();
@@ -141,6 +155,7 @@ export class HmdAiComposer extends HmdElement {
   }
 
   #onInput(): void {
+    emit(this, 'hmd-ai-draft', { text: this.#parts!.input.value });
     this.#note = null;
     this.#loop.update();
   }
@@ -164,11 +179,20 @@ export class HmdAiComposer extends HmdElement {
     }
   }
 
-  #onButton(): void {
+  #onButton(event: MouseEvent): void {
     const controller = this.#controller;
     if (!controller) return;
-    if (controller.getState().running) controller.stop();
-    else this.#send();
+    if (controller.getState().running) {
+      // Il clic subito dopo quello che ha inviato, nella stessa sequenza (detail dell'invio + 1), è la seconda metà
+      // di un doppio clic: non ferma la richiesta appena partita. Ogni altro clic ferma, anche una serie rapida
+      // (detail 3, 4…: chi ha un tremore clicca così) e la tastiera (detail 0).
+      const second = this.#sendDetail !== null && event.detail === this.#sendDetail + 1;
+      this.#sendDetail = null;
+      if (!second) controller.stop();
+      return;
+    }
+    this.#send();
+    this.#sendDetail = event.detail > 0 ? event.detail : null;
   }
 
   /**
@@ -176,6 +200,8 @@ export class HmdAiComposer extends HmdElement {
    * preset) non può partire, la nota dice perché; la casella e il focus restano come sono.
    */
   #send(presetId?: string): void {
+    // Un invio che non viene da un clic (Invio, suggerimento) non ha un secondo clic da ignorare.
+    this.#sendDetail = null;
     const controller = this.#controller;
     const parts = this.#parts;
     const i18n = this.#i18n;
@@ -185,6 +211,7 @@ export class HmdAiComposer extends HmdElement {
     // Prima la guardia di send() (che altrimenti scarterebbe in silenzio e la bozza andrebbe persa), poi profilo e testo.
     const blocker = sendBlocker(parts.input.value, !!controller.profile(), !!preset, controller.sendBlocker());
     if (blocker) {
+      this.#announceAgain = this.#note?.key === blocker;
       this.#note = { key: blocker, profileId: controller.profile()?.id };
       this.#loop.update();
       return;
@@ -208,6 +235,7 @@ export class HmdAiComposer extends HmdElement {
     }
     // L'unica scrittura della casella: dopo l'invio di un testo scritto si svuota (spec AI UI §4.2).
     parts.input.value = '';
+    emit(this, 'hmd-ai-draft', { text: '' });
     this.#loop.update();
   }
 
@@ -230,14 +258,15 @@ export class HmdAiComposer extends HmdElement {
     parts.sendIcon.style.setProperty('mask-image', `url("${ICONS[button.icon]}")`);
     // La nota se ne va quando la sua causa sparisce: per le ragioni del controller quando la ragione cambia;
     // per profilo e testo con un cambio di profilo o una generazione partita da qualunque parte (anche «Riprova»
-    // nel registro). La stessa nota due volte di fila non si ri-annuncia (stesso testo nella regione): accettato.
+    // nel registro). La stessa nota a un altro Invio si ri-annuncia (svuotata e riscritta dopo `ANNOUNCE_DELAY_MS`).
     if (this.#note) {
       const reason = controller.sendBlocker();
       const fromController = (Object.values(CONTROLLER_NOTES) as SendBlocker[]).includes(this.#note.key);
       const stale = fromController ? (reason ? CONTROLLER_NOTES[reason] : null) !== this.#note.key : this.#note.profileId !== controller.profile()?.id || !!reason;
       if (stale) this.#note = null;
     }
-    setText(parts.note, this.#note ? t(this.#note.key) : '');
+    announce(parts.note, this.#note ? t(this.#note.key) : '', this.#announceAgain);
+    this.#announceAgain = false;
   }
 }
 
diff --git a/src/elements/ai/sidebar.element.ts b/src/elements/ai/sidebar.element.ts
index 7f3026e..0b10cb2 100644
--- a/src/elements/ai/sidebar.element.ts
+++ b/src/elements/ai/sidebar.element.ts
@@ -2,6 +2,7 @@ import type { AiController, AiWorkspace } from '../../ai/aiController';
 import type { TextRange } from '../../ai/selectionChip';
 import type { SelectionScope } from '../../ai/types';
 import { HmdElement } from '../../dom/element';
+import { announce } from '../../dom/announce';
 import { el, setText, toggleAttr } from '../../dom/el';
 import { icon } from '../../dom/icon';
 import { RenderLoop } from '../../dom/renderLoop';
@@ -40,6 +41,7 @@ interface Parts {
 export class HmdAiSidebar extends HmdElement {
   #controller: SidebarController | null = null;
   #text = '';
+  #draft = '';
   #selection: TextRange | null = null;
   #getSelection: () => SelectionScope | undefined = () => undefined;
   #syncNeedsPermission = false;
@@ -48,6 +50,8 @@ export class HmdAiSidebar extends HmdElement {
   #parts: Parts | null = null;
   /** La nota «la chat è già vuota» è visibile. */
   #note = false;
+  /** Il prossimo render riscrive la nota anche se è già lì (un altro clic su Nuova chat). */
+  #announceAgain = false;
   // Nessun recupero del focus qui: il registro e il composer hanno il loro (come con React).
   #loop = new RenderLoop(this, {
     ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
@@ -67,6 +71,12 @@ export class HmdAiSidebar extends HmdElement {
     this.#text = value ?? '';
     this.#passDown();
   }
+  /** Bozza del composer conservata dal workspace (il composer la legge solo nascendo). */
+  get draft(): string { return this.#draft; }
+  set draft(value: string) {
+    this.#draft = value ?? '';
+    this.#passDown();
+  }
   get selection(): TextRange | null { return this.#selection; }
   set selection(value: TextRange | null) {
     this.#selection = value ?? null;
@@ -132,6 +142,7 @@ export class HmdAiSidebar extends HmdElement {
     // I messaggi arrivano al registro prima dell'inserimento, così lo disegna nella stessa passata (il confronto resta nel render).
     const messages = this.#controller?.getState().chat.messages;
     if (messages && parts.log.messages !== messages) parts.log.messages = messages;
+    parts.composer.draft = this.#draft;
     parts.composer.controller = this.#controller;
     parts.composer.text = this.#text;
     parts.composer.selection = this.#selection;
@@ -146,7 +157,9 @@ export class HmdAiSidebar extends HmdElement {
     if (!controller) return;
     const state = controller.getState();
     // Mai disattivato (decisione 4): con la chat vuota e niente in corso, la nota dice perché non succede nulla.
-    this.#note = state.chat.messages.length === 0 && !state.running;
+    const empty = state.chat.messages.length === 0 && !state.running;
+    this.#announceAgain = empty && this.#note;
+    this.#note = empty;
     if (!this.#note) controller.newChat();
     this.#loop.update();
   }
@@ -159,7 +172,8 @@ export class HmdAiSidebar extends HmdElement {
     toggleAttr(parts.newChat, 'data-tooltip', true, t('ai.newChat'));
     // Qualcosa nella chat (o in corso) toglie la nota.
     if (state.chat.messages.length > 0 || state.running) this.#note = false;
-    setText(parts.note, this.#note ? t('ai.newChat.alreadyEmpty') : '');
+    announce(parts.note, this.#note ? t('ai.newChat.alreadyEmpty') : '', this.#announceAgain);
+    this.#announceAgain = false;
     // Il setter del registro non confronta: assegnare a ogni passata riconcilierebbe tutto il registro a ogni notifica.
     if (parts.log.messages !== state.chat.messages) parts.log.messages = state.chat.messages;
     if (this.#syncNeedsPermission) {
diff --git a/src/elements/events.ts b/src/elements/events.ts
index 3ed4409..57333cb 100644
--- a/src/elements/events.ts
+++ b/src/elements/events.ts
@@ -16,6 +16,8 @@ import type { TreeAction } from './workspace/dialogFor';
 export interface HmdEvents {
   /** Diff della revisione AI: rifiutato l'ultimo blocco rimasto (equivale a scartare la proposta). */
   'hmd-ai-all-rejected': CustomEvent<null>;
+  /** Composer AI: il testo scritto nella casella è cambiato (anche svuotata dopo l'invio), per conservarlo fuori. */
+  'hmd-ai-draft': CustomEvent<{ text: string }>;
   /** Chip del modello: aprire le impostazioni dei profili («Gestisci profili…», o il chip senza profili). */
   'hmd-ai-manage': CustomEvent<null>;
   /** Selettore del modello: modello scelto dall'elenco o scritto in «Altro…», con il suo contesto se noto. */
```

In `workspace.element.ts`: il campo `#aiDraft = ''` (con il JSDoc «Bozza del composer AI, conservata quando la sidebar AI si ricrea.») sotto `#sidebarOpen`; nella creazione di `hmd-ai-sidebar` l'ascoltatore `'hmd-ai-draft': (event) => void (this.#aiDraft = event.detail.text)` (commento: «La bozza del composer sopravvive alla sidebar AI ricreata (LAB-10: si va all'editor ad aprire un file).»), e `assign(aiSidebar, 'draft', this.#aiDraft);` prima di `assign(aiSidebar, 'controller', ai);`.

- [ ] **Step 6: nome del contenuto di CodeMirror (P3).**

```diff
diff --git a/src/editor/docExtensions.ts b/src/editor/docExtensions.ts
index c38d9af..94931e2 100644
--- a/src/editor/docExtensions.ts
+++ b/src/editor/docExtensions.ts
@@ -25,6 +25,8 @@ export interface DocHost {
   /** Sessione in cui salvare testo, selezione e cronologia a ogni aggiornamento (null = nessuna). */
   session(): DocSession | null;
   t(): Translate;
+  /** Nome accessibile del contenuto (`aria-label` di `.cm-content`), letto a ogni aggiornamento della vista. */
+  contentLabel(): string;
   getDocs(): DocTitle[];
   /** Salva un'immagine incollata o trascinata; restituisce il link relativo, null se non salvata. */
   saveImage(file: File): Promise<string | null>;
@@ -113,6 +115,8 @@ export function docExtensions(host: DocHost) {
       editable.of(readOnlyExtensions(host.readOnly())),
       autocompletion({ override: [wikiCompletionSource(() => host.getDocs())] }),
       formatToolbar(() => host.t()),
+      // Il contenuto è un textbox: senza nome lo screen reader dice solo «modifica testo» (LAB-42 P3, WCAG 4.1.2).
+      EditorView.contentAttributes.of(() => ({ 'aria-label': host.contentLabel() })),
       EditorView.updateListener.of((update) => {
         // La sessione si salva prima di emettere: un listener sincrono può cambiare documento (anche staccare
         // e ricollegare l'elemento), e da lì host.session() sarebbe la sessione del documento nuovo.
diff --git a/src/elements/editor/docElement.ts b/src/elements/editor/docElement.ts
index bcccbd8..eefb5da 100644
--- a/src/elements/editor/docElement.ts
+++ b/src/elements/editor/docElement.ts
@@ -5,6 +5,7 @@ import { docExtensions, type DocHost } from '../../editor/docExtensions';
 import { docStateConfig, saveDocSession, type DocSession } from '../../editor/docSession';
 import type { Translate } from '../../editor/formatToolbar';
 import type { RestoreCommand } from '../../editor/restoreCommand';
+import type { MessageKey } from '../../i18n/messages';
 import type { DocTitle } from '../../search/searchIndex';
 import type { I18nStore } from '../../state/i18nStore';
 import { emit } from '../events';
@@ -44,6 +45,7 @@ export abstract class HmdDocElement extends HmdElement {
     readOnly: () => this.#readOnly,
     session: () => this.#shownSession,
     t: () => this.translator(),
+    contentLabel: () => this.translator()(this.contentLabelKey),
     getDocs: () => this.#getDocs(),
     saveImage: (file) => this.#saveImage?.(file) ?? Promise.resolve(null),
     docChanged: (changes, texts) => emit(this, 'hmd-doc-change', { changes, before: texts.before, after: texts.after }),
@@ -89,6 +91,9 @@ export abstract class HmdDocElement extends HmdElement {
     this.i18nChanged();
   }
 
+  /** Chiave del nome accessibile del contenuto: il documento nell'editor, il documento attuale nel diff. */
+  protected readonly contentLabelKey: MessageKey = 'editor.content';
+
   /** Traduzione attuale (la barra di formattazione la legge quando compare). Non `translate`: è di HTMLElement. */
   protected translator(): Translate {
     return this.#i18n?.t ?? KEY_ONLY;
diff --git a/src/elements/editor/editor.element.ts b/src/elements/editor/editor.element.ts
index 8acf203..c41d9c0 100644
--- a/src/elements/editor/editor.element.ts
+++ b/src/elements/editor/editor.element.ts
@@ -52,6 +52,9 @@ export class HmdEditor extends HmdDocElement {
       this.docInputChanged();
     }
     this.#view.scrollDOM.addEventListener('scroll', () => this.#onScroll(), { passive: true, signal });
+    // Una lingua nuova: il nome del contenuto subito (contentAttributes lo rilegge solo al prossimo aggiornamento,
+    // e un aggiornamento vuoto qui passerebbe dalla sessione).
+    if (this.i18n) this.watch(this.i18n, () => this.#view?.contentDOM.setAttribute('aria-label', this.docHost.contentLabel()), signal);
   }
 
   disconnectedCallback(): void {
```

In `diff-pane.element.ts`: `protected override readonly contentLabelKey = 'ai.diff.current';` come primo campo della classe (con il JSDoc «Il lato sinistro del diff è il documento attuale (il destro, la proposta, ha il suo nome).»); nelle estensioni del lato `b`, dopo `docAppearance()`, `EditorView.contentAttributes.of(() => ({ 'aria-label': this.translator()('ai.diff.proposal') })),`; in testa a `#refreshControls()`, dopo `const t = this.translator();`:

```ts
    // I nomi dei due contenuti nella lingua di adesso (contentAttributes li rilegge solo al prossimo aggiornamento).
    this.#merge?.a.contentDOM.setAttribute('aria-label', this.docHost.contentLabel());
    this.#merge?.b.contentDOM.setAttribute('aria-label', t('ai.diff.proposal'));
```

In `review.dom.test.ts` il conteggio degli ascoltatori della lingua passa da 1 a 2 (`'la revisione e il nome del contenuto di hmd-editor'`).

- [ ] **Step 7: chip senza cast.**

```diff
diff --git a/src/elements/ai/model-chip.element.ts b/src/elements/ai/model-chip.element.ts
index b2d4648..65ddc84 100644
--- a/src/elements/ai/model-chip.element.ts
+++ b/src/elements/ai/model-chip.element.ts
@@ -66,6 +66,8 @@ export class HmdAiModelChip extends HmdElement {
   #id = '';
   #open = false;
   #rows = new WeakMap<Element, ProfileRow>();
+  /** Il selettore del modello dell'apertura corrente (uno nuovo a ogni apertura del popover). */
+  #modelSelect: HmdAiModelSelect | null = null;
   #loop = new RenderLoop(this, {
     ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
     render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
@@ -184,17 +186,20 @@ export class HmdAiModelChip extends HmdElement {
       popoverParts(groups, this.#open),
       (part: PopoverPart) => part,
       (part) => this.#createPart(parts, part),
-      (node, part) => {
+      // I nodi fissi si prendono da `parts` (tipati); il selettore del modello, l'unico nodo creato qui, dal
+      // suo campo: niente cast sul nodo generico di reconcileList.
+      (_node, part) => {
         if (part === 'group:local' || part === 'group:cloud') {
-          const group = groups.find((g) => g.local === (part === 'group:local'))!;
-          this.#renderGroup(node as HTMLFieldSetElement, group, profile.id, t);
-        } else if (part === 'model') {
-          const select = node as HmdAiModelSelect;
+          const local = part === 'group:local';
+          const group = groups.find((g) => g.local === local)!;
+          this.#renderGroup(local ? parts.groups.local : parts.groups.cloud, group, profile.id, t);
+        } else if (part === 'model' && this.#modelSelect) {
+          const select = this.#modelSelect;
           select.controller = controller;
           select.profile = effective;
           select.i18n = i18n;
         } else if (part === 'params') {
-          const params = node as HmdAiParameters;
+          const params = parts.params;
           params.profile = effective;
           params.value = { ...profile.params, ...overrides };
           params.hideEffort = true;
@@ -226,7 +231,7 @@ export class HmdAiModelChip extends HmdElement {
         return parts.actions;
       case 'model':
         // Un selettore nuovo a ogni apertura, come il componente che React montava: riparte senza «Altro…».
-        return el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (event) => this.#override(event.detail.selection) } });
+        return (this.#modelSelect = el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (event) => this.#override(event.detail.selection) } }));
     }
   }
 
```

Controllo: `grep -n " as " src/elements/ai/model-chip.element.ts` → uscita 1 (nessuna occorrenza).

- [ ] **Step 8: e2e.** In `ai-review-bar.spec.ts` il test «while generating nothing is disabled…» si divide in due (il contatore non è più live e la regione nascosta dice l'avvio; Scarta ferma e scarta); il testo «truncated» compare due volte (stato visibile e regione nascosta dell'esito) e si prende `.first()`; il test LAB-10 vede la bozza al ritorno:

```diff
diff --git a/e2e/ai-review-bar.spec.ts b/e2e/ai-review-bar.spec.ts
index 96d9e44..2ffcdb8 100644
--- a/e2e/ai-review-bar.spec.ts
+++ b/e2e/ai-review-bar.spec.ts
@@ -31,23 +31,29 @@ test.describe('review bar', () => {
     await enterAi(app);
   });
 
-  test('while generating nothing is disabled: Previous, Next, Discard and Accept all say why in the note and keep the focus; the counter is a polite live region; the note goes with the proposal', async ({ app, ai, page }) => {
+  test('while generating nothing is disabled: Previous, Next and Accept all say why in the note (again at every click) and keep the focus; the seconds are not live, a hidden region says the start; the note goes with the proposal', async ({ app, ai, page }) => {
     await page.clock.install();
     ai.hold();
     await composer(app).fill('fix');
     await composer(app).press('Enter');
     const counter = page.getByText(app.t('ai.generating', { seconds: 0 }).replace(/0 s$/, ''), { exact: false });
     await expect(counter).toBeVisible();
-    await expect(counter).toHaveAttribute('aria-live', 'polite');
+    await expect(counter).not.toHaveAttribute('aria-live');
+    // La regione nascosta entra vuota e il testo arriva dopo `ANNOUNCE_DELAY_MS`: con l'orologio finto si fa avanzare.
+    await page.clock.runFor(200);
+    await expect(page.getByText(app.t('ai.generatingStarted'), { exact: true })).toHaveAttribute('aria-live', 'polite');
     const note = page.getByRole('status').filter({ hasText: app.t('ai.review.generating') });
-    for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) {
+    for (const button of [previous(app), next(app), acceptAll(app)]) {
       await expect(button).toBeEnabled();
       await button.click();
+      // Dal secondo clic la stessa nota si svuota e torna dopo `ANNOUNCE_DELAY_MS` (ri-annuncio, LAB-11).
+      await page.clock.runFor(200);
       await expect(note).toBeVisible();
       await expect(button).toBeFocused();
     }
     expect(ai.requests).toBe(1);
-    await page.clock.runFor(2100);
+    // Tre pause di 200 ms già passate: 1,5 s in più portano il contatore a 2 s.
+    await page.clock.runFor(1500);
     await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
     ai.release();
     await proposalShown(app);
@@ -56,6 +62,20 @@ test.describe('review bar', () => {
     for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) await expect(button).toBeEnabled();
   });
 
+  test('Discard while generating stops the request and discards the proposal (Discard = Stop + discard)', async ({ app, ai, page }) => {
+    ai.hold();
+    await composer(app).fill('fix');
+    await composer(app).press('Enter');
+    await expect(stop(app)).toBeVisible();
+    await discard(app).click();
+    await expect(send(app)).toBeVisible();
+    await expect(discard(app)).toHaveCount(0);
+    await expect(page.getByRole('status').filter({ hasText: app.t('ai.review.generating') })).toHaveCount(0);
+    ai.release();
+    await expect(mergeView(app)).toHaveCount(0);
+    expect(ai.requests).toBe(1);
+  });
+
   test('the proposal arrives with the focus on Accept all (keyboard): the focus stays on the button, it does not jump into the diff', async ({ app, ai, page }) => {
     ai.hold();
     await composer(app).fill('fix');
@@ -79,7 +99,8 @@ test.describe('review bar', () => {
     await composer(app).fill('fix');
     await composer(app).press('Enter');
     await proposalShown(app);
-    await expect(page.getByText(app.t('ai.status.truncated'))).toBeVisible();
+    // Il testo c'è due volte: lo stato visibile e la regione nascosta che annuncia l'esito (P1): il primo è quello visibile.
+    await expect(page.getByText(app.t('ai.status.truncated')).first()).toBeVisible();
     const note = page.getByRole('status').filter({ hasText: app.t('ai.review.truncated') });
     await expect(acceptAll(app)).toBeEnabled();
     await acceptAll(app).click();
@@ -179,7 +200,7 @@ test.describe('review bar', () => {
 });
 
 test.describe('composer without a document', () => {
-  test('with no document open, Send says so, keeps the draft and the focus', async ({ app, ai, page }) => {
+  test('with no document open, Send says where to go, keeps the draft and the focus; the draft is still there after opening a document from the editor (LAB-10)', async ({ app, ai, page }) => {
     await app.openFolder({ 'a.md': 'A' });
     await enterAi(app);
     await composer(app).fill('fix');
@@ -189,11 +210,14 @@ test.describe('composer without a document', () => {
     await expect(composer(app)).toHaveValue('fix');
     await expect(send(app)).toBeFocused();
     expect(ai.requests).toBe(0);
-    // Aprire un documento passa dalla modalità editor: la sidebar AI si smonta e si rimonta (bozza e nota ripartono da zero, come oggi).
+    // Aprire un documento passa dalla modalità editor: la sidebar AI si ricrea, la nota riparte da zero, la bozza resta.
     await app.mode('mode.editor').click();
     await app.openFile('a.md');
     await app.mode('mode.ai').click();
     await expect(note).toHaveCount(0);
+    await expect(composer(app)).toHaveValue('fix');
+    await send(app).click();
+    await expect.poll(() => ai.requests).toBe(1);
   });
 
   test('Enter in the composer during a generation says so and keeps the draft; the note goes when the generation ends', async ({ app, ai, page }) => {
```

`ai-review.spec.ts:222` e `computed-styles.audit.ts:280`: `app.t('ai.warningsCount', { count: 1 })` → `app.t('ai.warningsCount.one', { count: 1 })` (nell'audit il nome «1 warning» trova anche il «1 warnings» della baseline: il nome si confronta per sottostringa). `computed-styles.audit.ts:265`: `page.getByText(app.t('ai.status.truncated')).first()`. Lo stato `ai-composer-note-no-document` (`computed-styles.audit.ts:419`) aspettava la nota **per testo**: con il testo nuovo il progetto `baseline` (build vecchia, testo vecchio) cade e il `current` non parte (misurato). Diventa indipendente dal testo:

```ts
      // La nota per testo non basta: l'audit prepara lo stato anche sulla baseline, che può avere il testo di prima
      // (LAB-10 lo cambia). Basta una nota non vuota.
      await expect(page.getByRole('status').filter({ hasText: /\S/ }).first()).toBeVisible();
```

In `ai-composer.spec.ts` il test del doppio clic del Task 1 si rovescia (verde nel prototipo):

```ts
  test('a double click on Send sends once and keeps the request going; a further click in the same series stops it', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await send(app).click();
    await stop(app).dispatchEvent('click', { detail: 2 });
    await expect(stop(app)).toBeVisible();
    await stop(app).dispatchEvent('click', { detail: 3 });
    await expect(send(app)).toBeVisible();
    expect(ai.requests).toBe(1);
    ai.release();
  });
```

- [ ] **Step 9: gate e baseline.** `npm test` (atteso **1070** = 1057 + 3 `announce` + 1 `i18n` + 2 `reviewBarView` + 2 `review-bar` + 1 `review` + 2 `composer` + 1 `editor` + 1 `workspace`), `npm run lint`; in build e in sviluppo `ai-review-bar.spec.ts`, `ai-review.spec.ts`, `ai-composer.spec.ts`, `ai-diff.spec.ts`, `editor.spec.ts`, `editor-session.spec.ts` (misurato sui primi tre più `startup.spec.ts`: 46 in build, 46 in sviluppo). Audit **solo con `-g "ai-"`** (il progetto `baseline` gira comunque tutto): cadono **solo** questi 10 stati, misurato —
  - `ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-chat-summary`, `ai-review-generating`, `ai-review-note`, `ai-composer-running`: `…>hmd-ai-review-bar:0>span:2: nuovo` (la regione nascosta: generazione in corso, o l'esito «Proposal ready» fino alla prossima azione);
  - `ai-review-truncated`, `ai-review-warnings`: la stessa riga più il tooltip degli avvisi (`content: "1 warnings" → "1 warning"`, `width`/`inline-size`/`*-origin` del `::after`);
  - `ai-composer-note-no-document`: la nota più lunga va su più righe (12 righe di altezze e origini nella sidebar AI).

  `ai-review-applied` resta verde (Accetta tutto è un'azione: l'esito si svuota). Righe incollate nel commento, poi `dist-baseline/` ricostruita dal commit del task e lo stesso `-g` verde. Commit piccoli, uno per punto.

### Task 5: Impostazioni — Esc, focus, annunci, nomi delle sezioni, indice (Builder)

> Si esegue **dopo** il Task 4 (usa `src/dom/announce.ts`, creato lì).

**Files:**
- Modify: `src/elements/settings/settings.element.ts` (+ `settings.dom.test.ts`), `settingsView.ts` (+ `settingsView.test.ts`), `profiles.element.ts` (+ `profiles.dom.test.ts`), `presets.element.ts` (+ `presets.dom.test.ts`), `sync.element.ts` (+ `sync.dom.test.ts`)
- Modify (e2e): `settings.spec.ts`, `settings-sections.spec.ts`, `support/app.ts` (`createProfile`), `ai-model.spec.ts:176`, `ai-chips.spec.ts:57`

P5, P6, P8, P9, P10, P11, P12, le sezioni con un nome e la regola dell'indice (decisione 6). Codice del prototipo, test verdi; P5, P11 e l'indice provati anche nel browser.

- [ ] **Step 1: test che falliscono.**

```diff
diff --git a/src/elements/settings/presets.dom.test.ts b/src/elements/settings/presets.dom.test.ts
index 6ec0a07..29d127d 100644
--- a/src/elements/settings/presets.dom.test.ts
+++ b/src/elements/settings/presets.dom.test.ts
@@ -101,16 +101,20 @@ test('switching with unsaved changes asks first: Cancel keeps the draft, Discard
   assert.ok(button(EN_MESSAGES['ai.restoreOriginal']));
 });
 
-test('Delete asks first and removes the preset; the detail goes away', async () => {
+test('Delete asks first and removes the preset; the detail goes away and the focus goes to the first item', async () => {
   const { el, items, button, deleted } = mount();
   items()[1].click();
-  button(EN_MESSAGES['ai.delete']).click();
+  const remove = button(EN_MESSAGES['ai.delete']);
+  remove.click();
   const dialog = document.querySelector('dialog')!;
   assert.ok(dialog.textContent!.includes(EN_MESSAGES['ai.deleteMessage']));
   [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.delete'])!.click();
+  // Chiuso il dialog, il browser ridà il focus a chi l'aveva aperto (lo stub di jsdom no).
+  remove.focus();
   await waitFor(() => deleted.length === 1);
   assert.deepEqual(deleted, ['mine']);
   await waitFor(() => el.querySelector('.detail') === null);
+  assert.ok(document.activeElement === items()[0], `the first item, not ${document.activeElement?.localName}`);
 });
 
 test('detached: the confirmation closes, the store and language listeners are gone', async () => {
diff --git a/src/elements/settings/profiles.dom.test.ts b/src/elements/settings/profiles.dom.test.ts
index fb322be..eefc51c 100644
--- a/src/elements/settings/profiles.dom.test.ts
+++ b/src/elements/settings/profiles.dom.test.ts
@@ -93,12 +93,19 @@ test('changing provider sets its default url and forgets the typed key', () => {
   assert.equal(field(EN_MESSAGES['ai.secret'])!.value, '');
 });
 
-test('Connection: «Connected» as a status only after a good answer; an unreachable server is reported', async () => {
+test('Connection: «Connected» as a status only after a good answer, entering empty and written a frame later; an unreachable server is reported', async () => {
   const { el, ai, button, down } = mount();
   button('ollama')!.click();
+  // Il testo della regione a ogni mutazione: entra vuota e il testo arriva dopo, come una mutazione che lo
+  // screen reader legge (LAB-42 P8).
+  const seen: string[] = [];
+  new MutationObserver(() => {
+    const status = el.querySelector('[role="status"]');
+    if (status && seen.at(-1) !== status.textContent) seen.push(status.textContent!);
+  }).observe(el, { subtree: true, childList: true, characterData: true });
   button(EN_MESSAGES['ai.connection'])!.click();
-  await waitFor(() => el.querySelector('[role="status"]') !== null);
-  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['ai.connected']);
+  await waitFor(() => el.querySelector('[role="status"]')?.textContent === EN_MESSAGES['ai.connected']);
+  assert.deepEqual(seen, ['', EN_MESSAGES['ai.connected']]);
   down();
   button(EN_MESSAGES['ai.connection'])!.click();
   assert.equal(el.querySelector('[role="status"]'), null);
@@ -115,3 +122,16 @@ test('Save validates the profile and makes the draft clean', async () => {
   await waitFor(() => saved.length === 1 && !el.dirty);
   assert.equal(saved[0].name, 'Local');
 });
+
+test('Delete asks first; once the profile is gone the focus goes to the first item, not the body', async () => {
+  const { el, button } = mount();
+  const items = () => [...el.querySelectorAll<HTMLButtonElement>('.list > button')];
+  items()[1].click();
+  const remove = button(EN_MESSAGES['ai.delete'])!;
+  remove.click();
+  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.delete'])!.click();
+  // Chiuso il dialog, il browser ridà il focus a chi l'aveva aperto (lo stub di jsdom no).
+  remove.focus();
+  await waitFor(() => el.querySelector('.detail') === null);
+  assert.ok(document.activeElement === items()[0], `the first item, not ${document.activeElement?.localName}`);
+});
diff --git a/src/elements/settings/settings.dom.test.ts b/src/elements/settings/settings.dom.test.ts
index 5a6e29f..4dd5e1e 100644
--- a/src/elements/settings/settings.dom.test.ts
+++ b/src/elements/settings/settings.dom.test.ts
@@ -156,3 +156,38 @@ test('detached: no keydown listener left (Esc does nothing), the dialog closes,
   assert.deepEqual(events, []);
   assert.equal(listeners(), 0);
 });
+
+test('Esc that opens the confirmation is consumed: the same key press does not close the new dialog', () => {
+  const { el } = mount({ ai: true });
+  const presets = el.querySelector('hmd-settings-presets')!;
+  presets.querySelector<HTMLButtonElement>('.list button')!.click();
+  const name = presets.querySelector<HTMLInputElement>('.detail input')!;
+  name.value = 'Changed';
+  name.dispatchEvent(new Event('input', { bubbles: true }));
+  const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
+  window.dispatchEvent(esc);
+  assert.equal(esc.defaultPrevented, true, 'Chrome would use the same Esc to close the dialog just opened');
+  assert.equal(document.querySelectorAll('dialog[open]').length, 1);
+  // Senza modifiche Esc chiude e basta: anche lì il tasto è consumato.
+});
+
+test('every section is a region named by its h2; the width hint describes both width fields', () => {
+  const { el, field } = mount({ ai: true });
+  for (const section of el.querySelectorAll<HTMLElement>('.content > section')) {
+    const h2 = section.querySelector('h2')!;
+    assert.ok(h2.id, `${section.id}: the h2 has an id`);
+    assert.equal(section.getAttribute('aria-labelledby'), h2.id, section.id);
+  }
+  const hint = el.querySelector<HTMLElement>('.hint')!;
+  for (const key of ['settings.textWidth.editor', 'settings.textWidth.preview'] as const) assert.equal(field(EN_MESSAGES[key]).getAttribute('aria-describedby'), hint.id, key);
+});
+
+test('a link activated from the keyboard scrolls to its section and moves the focus to the section title', () => {
+  const { el } = mount({ ai: true });
+  const link = el.querySelectorAll<HTMLAnchorElement>('nav a')[3];
+  link.focus();
+  link.click();
+  const h2 = el.querySelector('#settings-ai-sync h2')!;
+  assert.equal(h2.getAttribute('tabindex'), '-1');
+  assert.ok(document.activeElement === h2, `the Sync title, not ${document.activeElement?.localName}`);
+});
diff --git a/src/elements/settings/settingsView.test.ts b/src/elements/settings/settingsView.test.ts
index 1fada72..f077249 100644
--- a/src/elements/settings/settingsView.test.ts
+++ b/src/elements/settings/settingsView.test.ts
@@ -1,7 +1,7 @@
 import test from 'node:test';
 import assert from 'node:assert/strict';
 
-import { commitDelay, commitWidths, sectionId, sectionOf, settingsSections, topSection, widthText } from './settingsView';
+import { commitDelay, commitWidths, currentSection, sectionId, sectionOf, settingsSections, widthText } from './settingsView';
 
 test('without the AI controller only the general section is shown, with it all four in order', () => {
   assert.deepEqual(settingsSections(false), ['general']);
@@ -15,15 +15,21 @@ test('section ids go both ways; an unknown or hidden section is null', () => {
   assert.equal(sectionOf('settings-nope', settingsSections(true)), null);
 });
 
-test('the index follows the topmost intersecting section; none intersecting leaves it alone', () => {
-  const sections = settingsSections(true);
-  const entries = [
-    { id: 'settings-ai-presets', top: 300, intersecting: true },
-    { id: 'settings-general', top: -900, intersecting: false },
-    { id: 'settings-ai-profiles', top: 20, intersecting: true },
+test('the current section: the last one whose top is in the upper 40 %, the last one at the end of the scroll', () => {
+  // Misure prese nel browser (1280×800) con tutte e quattro le sezioni: in fondo, Sync non arriva in cima.
+  const tops = (general: number, profiles: number, presets: number, sync: number) => [
+    { section: 'general' as const, top: general },
+    { section: 'ai-profiles' as const, top: profiles },
+    { section: 'ai-presets' as const, top: presets },
+    { section: 'ai-sync' as const, top: sync },
   ];
-  assert.equal(topSection(entries, sections), 'ai-profiles');
-  assert.equal(topSection([{ id: 'settings-general', top: 0, intersecting: false }], sections), null);
+  const view = (scrollTop: number) => ({ scrollTop, clientHeight: 800, scrollHeight: 1619 });
+  assert.equal(currentSection(tops(24, 747, 905, 1128), view(0)), 'general');
+  assert.equal(currentSection(tops(-723, 16, 174, 397), view(747)), 'ai-presets', 'presets entra nella fascia alta');
+  assert.equal(currentSection(tops(-795, -56, 102, 325), view(819)), 'ai-sync', 'in fondo: l\'ultima');
+  assert.equal(currentSection(tops(-795, -56, 102, 325), view(818.5)), 'ai-sync', 'mezzo pixel di arrotondamento');
+  assert.equal(currentSection(tops(-300, 400, 560, 780), view(300)), 'general', 'nessun titolo nella fascia: quella sopra');
+  assert.equal(currentSection([], view(0)), null);
 });
 
 test('text widths: an empty field is no limit, values are clamped, unchanged widths give no update', () => {
diff --git a/src/elements/settings/sync.dom.test.ts b/src/elements/settings/sync.dom.test.ts
index 08feb54..66c5889 100644
--- a/src/elements/settings/sync.dom.test.ts
+++ b/src/elements/settings/sync.dom.test.ts
@@ -178,3 +178,21 @@ test('B can restore while the cancelled count of A is still pending; the late an
   assert.equal(document.querySelectorAll('dialog').length, 1);
   assert.deepEqual(services[0].calls, []);
 });
+
+test('the sync status is a polite live region and its error an alert; each Restore is described by its own backup path', async () => {
+  const { el, services } = await mount({ name: 'sync' } as FileSystemDirectoryHandle);
+  const s = services[0];
+  const [status] = [...el.firstElementChild!.children].filter((c) => c.localName === 'p').slice(1);
+  assert.equal(status.getAttribute('role'), 'status');
+  s.set({ status: 'error', error: 'server' } as never);
+  const error = [...el.querySelectorAll('p')].find((p) => p.textContent === EN_MESSAGES['ai.error.server']);
+  assert.equal(error?.getAttribute('role'), 'alert');
+  s.answer(0);
+  await waitFor(() => el.querySelectorAll('details > p').length === 2);
+  for (const p of el.querySelectorAll('details > p')) {
+    const path = p.firstElementChild!;
+    const restore = p.querySelector('button')!;
+    assert.equal(restore.getAttribute('aria-describedby'), path.id, path.textContent!);
+    assert.ok(path.id, 'the path has an id');
+  }
+});
```

jsdom non restituisce il focus all'apertore quando un `<dialog>` si chiude (lo fa Chrome): i due test di Elimina lo fanno a mano (`remove.focus()`), con il commento. Il test di «Connesso» registra il testo della regione a ogni mutazione (un `waitFor` può arrivare dopo la pausa di `announce` e non vedere la regione vuota). RED atteso (misurato): `settings.dom.test.ts` 3 rossi (Esc non consumato, sezioni senza `aria-labelledby`, focus che resta sul link); `settingsView.test.ts` non compila finché `currentSection` non esiste; `profiles`/`presets.dom.test.ts` «… the focus goes to the first item» (`not body`) e «Connection…» (`[ 'Connection successful' ]` invece di `[ '', 'Connection successful' ]`); `sync.dom.test.ts` 1 rosso (nessun `role`).

- [ ] **Step 2: `currentSection` al posto di `topSection`** in `settingsView.ts` (`sectionOf` resta: lo usa il suo test):

```diff
diff --git a/src/elements/settings/settingsView.ts b/src/elements/settings/settingsView.ts
index 2345bd0..c22d394 100644
--- a/src/elements/settings/settingsView.ts
+++ b/src/elements/settings/settingsView.ts
@@ -26,12 +26,18 @@ export function sectionOf(id: string, sections: readonly SettingsSection[]): Set
 }
 
 /**
- * Sezione da segnare nell'indice: la più in alto tra quelle che si intersecano (come il callback
- * dell'IntersectionObserver di SettingsView.tsx). Null = nessuna, l'indice resta com'è.
+ * Sezione da segnare nell'indice mentre si scorre: in fondo allo scorrimento l'ultima (le ultime sezioni sono
+ * corte e non arrivano mai in cima), altrimenti l'ultima il cui inizio sta nel 40 % alto del contenitore, o la
+ * prima. `top` è misurato dal bordo alto del contenitore che scorre. Null senza sezioni.
  */
-export function topSection(entries: readonly { id: string; top: number; intersecting: boolean }[], sections: readonly SettingsSection[]): SettingsSection | null {
-  const top = entries.filter((e) => e.intersecting).sort((a, b) => a.top - b.top)[0];
-  return top ? sectionOf(top.id, sections) : null;
+export function currentSection(
+  tops: readonly { section: SettingsSection; top: number }[],
+  view: { scrollTop: number; clientHeight: number; scrollHeight: number },
+): SettingsSection | null {
+  if (tops.length === 0) return null;
+  if (view.scrollTop + view.clientHeight >= view.scrollHeight - 1) return tops[tops.length - 1].section;
+  const band = view.clientHeight * 0.4;
+  return tops.filter((t) => t.top <= band).at(-1)?.section ?? tops[0].section;
 }
 
 /** Testo del campo di una larghezza: vuoto = nessun limite. */
```

- [ ] **Step 3: `hmd-settings`** — Esc consumato, sezioni con nome, titoli con `tabindex="-1"`, nota delle larghezze collegata, focus sul titolo dopo un salto, indice che segue lo scorrimento con il salto fissato (via l'`IntersectionObserver`):

```diff
diff --git a/src/elements/settings/settings.element.ts b/src/elements/settings/settings.element.ts
index 00cc3fb..51c1502 100644
--- a/src/elements/settings/settings.element.ts
+++ b/src/elements/settings/settings.element.ts
@@ -15,7 +15,7 @@ import { emit } from '../events';
 import { showChildren } from './fields';
 import type { HmdSettingsPresets, PresetsController } from './presets.element';
 import type { HmdSettingsProfiles, ProfilesController } from './profiles.element';
-import { SECTION_LABELS, commitDelay, commitWidths, sectionId, settingsSections, topSection, widthText } from './settingsView';
+import { SECTION_LABELS, commitDelay, commitWidths, currentSection, sectionId, settingsSections, widthText } from './settingsView';
 import type { HmdSettingsSync, SyncController } from './sync.element';
 import './settings.css';
 
@@ -75,9 +75,12 @@ export class HmdSettings extends HmdElement {
   #dirty = new Set<SettingsSection>();
   #visible: SettingsSection = 'general';
   #confirming = false;
-  #observer: IntersectionObserver | null = null;
-  /** Sezioni osservate (cambiano solo con il controller AI). */
-  #observed: SettingsSection[] = [];
+  /**
+   * La sezione appena raggiunta dall'indice o dalla rotta, con lo scorrimento che le ha dato: resta la corrente
+   * finché chi usa la pagina non scorre altrove (le ultime sezioni non arrivano in cima, la regola dello
+   * scorrimento non le sceglierebbe mai da sola).
+   */
+  #pinned: { section: SettingsSection; scrollTop: number } | null = null;
   /** Sezione e controller dell'ultimo scorrimento: si scorre solo quando cambiano (l'effetto `[section, ai]`). */
   #scrolled: { section: SettingsSection; ai: SettingsController | null } | null = null;
   #dialogs: AbortController | null = null;
@@ -152,10 +155,14 @@ export class HmdSettings extends HmdElement {
     this.#dialogs ??= new AbortController();
     const parts = this.#parts!;
     parts.content.addEventListener('hmd-settings-dirty', (event) => this.#onDirty(event), { signal });
+    parts.content.addEventListener('scroll', () => this.#onScroll(), { passive: true, signal });
     window.addEventListener(
       'keydown',
       (event) => {
-        if (event.key === 'Escape' && !document.querySelector('dialog[open]')) this.#close();
+        if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
+        // Consumato: altrimenti Chrome usa lo stesso Esc per chiudere il dialog di conferma appena aperto.
+        event.preventDefault();
+        this.#close();
       },
       { signal },
     );
@@ -169,9 +176,7 @@ export class HmdSettings extends HmdElement {
 
   disconnectedCallback(): void {
     super.disconnectedCallback();
-    this.#observer?.disconnect();
-    this.#observer = null;
-    this.#observed = [];
+    this.#pinned = null;
     this.#scrolled = null;
     this.#dialogs?.abort();
     this.#dialogs = null;
@@ -220,7 +225,31 @@ export class HmdSettings extends HmdElement {
   }
 
   #scrollTo(section: SettingsSection): void {
-    this.#parts?.content.querySelector(`#${sectionId(section)}`)?.scrollIntoView({ block: 'start' });
+    const content = this.#parts?.content;
+    if (!content) return;
+    content.querySelector(`#${sectionId(section)}`)?.scrollIntoView({ block: 'start' });
+    // La sezione chiesta è la corrente anche se non arriva in cima; il suo evento scroll non la cambia.
+    this.#pinned = { section, scrollTop: content.scrollTop };
+    if (this.#visible !== section) {
+      this.#visible = section;
+      this.#loop.update();
+    }
+  }
+
+  /** L'indice segue lo scorrimento (`currentSection`), salvo l'evento scroll del salto appena fatto. */
+  #onScroll(): void {
+    const content = this.#parts!.content;
+    if (this.#pinned && Math.abs(content.scrollTop - this.#pinned.scrollTop) < 1) return;
+    this.#pinned = null;
+    const box = content.getBoundingClientRect().top;
+    const tops = settingsSections(!!this.#ai).flatMap((section) => {
+      const node = content.querySelector(`#${sectionId(section)}`);
+      return node ? [{ section, top: node.getBoundingClientRect().top - box }] : [];
+    });
+    const current = currentSection(tops, content);
+    if (!current || current === this.#visible) return;
+    this.#visible = current;
+    this.#loop.update();
   }
 
   #build(): Parts {
@@ -255,6 +284,7 @@ export class HmdSettings extends HmdElement {
             min: String(MIN_TEXT_WIDTH),
             max: String(MAX_TEXT_WIDTH),
             step: '1',
+            'aria-describedby': 'settings-width-hint',
             on: { input: (e) => (this.#widthTexts = { ...this.#widthTexts, [pane]: value(e) }), blur: () => this.#commitWidths(), keydown: onEnter(() => this.#commitWidths()) },
           }),
         },
@@ -262,8 +292,10 @@ export class HmdSettings extends HmdElement {
     ) as Parts['widths'];
     delay.value = this.#delayText;
     for (const pane of TEXT_WIDTH_PANES) widths[pane].input.value = this.#widthTexts[pane];
-    const sectionBox = (id: SettingsSection, ...children: Node[]) => el('section', { id: sectionId(id), class: 'section' }, ...children);
-    const titles = [el('h2'), el('h2'), el('h2')];
+    // Ogni sezione è una regione con il nome del suo titolo; il titolo prende il focus dopo un salto dall'indice.
+    const title = (id: SettingsSection) => el('h2', { id: `${sectionId(id)}-title`, tabIndex: -1 });
+    const sectionBox = (id: SettingsSection, ...children: Node[]) => el('section', { id: sectionId(id), class: 'section', 'aria-labelledby': `${sectionId(id)}-title` }, ...children);
+    const titles = [title('ai-profiles'), title('ai-presets'), title('ai-sync')];
     const parts: Parts = {
       view: el('div', { class: 'view', role: 'region' }),
       nav: el('nav', { class: 'nav' }),
@@ -271,8 +303,8 @@ export class HmdSettings extends HmdElement {
       title: el('h1', { tabIndex: -1 }),
       links: new Map(),
       content: el('div', { class: 'content' }),
-      general: el('section', { id: sectionId('general'), class: 'section' }),
-      generalTitle: el('h2'),
+      general: el('section', { id: sectionId('general'), class: 'section', 'aria-labelledby': `${sectionId('general')}-title` }),
+      generalTitle: title('general'),
       languageCaption: el('span'),
       language: el(
         'select',
@@ -289,7 +321,7 @@ export class HmdSettings extends HmdElement {
       delay,
       widthLegend: el('legend'),
       widths,
-      widthHint: el('p', { class: 'hint' }),
+      widthHint: el('p', { class: 'hint', id: 'settings-width-hint' }),
       saveAll: el('button', { type: 'button', class: 'secondary', on: { click: () => emit(this, 'hmd-settings-save-all', null) } }),
       ai: { profiles: el('section'), presets: el('section'), sync: el('section'), titles },
       profiles: el('hmd-settings-profiles'),
@@ -327,6 +359,8 @@ export class HmdSettings extends HmdElement {
           emit(this, 'hmd-settings-section', { section });
           // Se la sezione è già quella della rotta non cambia nulla: si scorre direttamente.
           this.#scrollTo(section);
+          // Il focus segue il salto (WCAG 2.4.3): sul titolo della sezione, senza un secondo scorrimento.
+          this.#parts?.content.querySelector<HTMLElement>(`#${sectionId(section)}-title`)?.focus({ preventScroll: true });
         },
       },
     });
@@ -383,7 +417,6 @@ export class HmdSettings extends HmdElement {
       if (parts.sync.i18n !== i18n) parts.sync.i18n = i18n;
     }
     showChildren(parts.content, [parts.general, ...(ai ? [parts.ai.profiles, parts.ai.presets, parts.ai.sync] : [])], [parts.ai.profiles, parts.ai.presets, parts.ai.sync]);
-    this.#observe(parts, sections);
     // Entrando (o cambiando sezione dalla rotta) si scorre alla sezione; anche quando compaiono le sezioni AI.
     if (this.#scrolled?.section !== this.#section || this.#scrolled.ai !== ai) {
       this.#scrolled = { section: this.#section, ai };
@@ -391,23 +424,6 @@ export class HmdSettings extends HmdElement {
     }
   }
 
-  /** La voce dell'indice segue la sezione visibile mentre si scorre (un observer per insieme di sezioni). */
-  #observe(parts: Parts, sections: SettingsSection[]): void {
-    if (this.#observer && this.#observed.join() === sections.join()) return;
-    this.#observer?.disconnect();
-    this.#observed = sections;
-    if (typeof IntersectionObserver === 'undefined') return;
-    this.#observer = new IntersectionObserver(
-      (entries) => {
-        const top = topSection(entries.map((e) => ({ id: e.target.id, top: e.boundingClientRect.top, intersecting: e.isIntersecting })), this.#observed);
-        if (!top || top === this.#visible) return;
-        this.#visible = top;
-        this.#loop.update();
-      },
-      { root: parts.content, rootMargin: '0px 0px -60% 0px' },
-    );
-    parts.content.querySelectorAll('section[id^="settings-"]').forEach((section) => this.#observer!.observe(section));
-  }
 }
 
 declare global {
```

- [ ] **Step 4: profili, preset, sync** (P6, P8 con `announce`, P9, P10):

```diff
diff --git a/src/elements/settings/presets.element.ts b/src/elements/settings/presets.element.ts
index 12654c6..564786f 100644
--- a/src/elements/settings/presets.element.ts
+++ b/src/elements/settings/presets.element.ts
@@ -56,6 +56,9 @@ export class HmdSettingsPresets extends HmdElement {
   #loop = new RenderLoop(this, {
     ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
     render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
+    // Il nodo con il focus è sparito (Elimina, con il dettaglio): il focus va sulla prima voce dell'elenco.
+    focusScope: () => this,
+    refocus: () => (this.#list?.firstElementChild as HTMLElement | null)?.focus(),
   });
 
   get controller(): PresetsController | null { return this.#controller; }
diff --git a/src/elements/settings/profiles.element.ts b/src/elements/settings/profiles.element.ts
index 6c6e794..20cbac6 100644
--- a/src/elements/settings/profiles.element.ts
+++ b/src/elements/settings/profiles.element.ts
@@ -2,6 +2,7 @@ import type { AiController } from '../../ai/aiController';
 import { changeProvider } from '../../ai/models';
 import { DEFAULT_URLS, defaultProfile, PROVIDER_KINDS, validateProfile } from '../../ai/profiles';
 import type { ModelProfile, ProviderKind } from '../../ai/types';
+import { announce } from '../../dom/announce';
 import { HmdElement } from '../../dom/element';
 import { el, setText } from '../../dom/el';
 import { RenderLoop } from '../../dom/renderLoop';
@@ -74,6 +75,9 @@ export class HmdSettingsProfiles extends HmdElement {
   #loop = new RenderLoop(this, {
     ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
     render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
+    // Il nodo con il focus è sparito (Elimina, con il dettaglio): il focus va sulla prima voce dell'elenco.
+    focusScope: () => this,
+    refocus: () => (this.#list?.firstElementChild as HTMLElement | null)?.focus(),
   });
 
   get controller(): ProfilesController | null { return this.#controller; }
@@ -282,7 +286,10 @@ export class HmdSettingsProfiles extends HmdElement {
     setText(d.duplicate, t('ai.duplicate'));
     setText(d.remove, t('ai.delete'));
     setText(d.save, t('ai.save'));
-    setText(d.connected, t('ai.connected'));
+    // «Connesso» entra nel DOM vuoto e si scrive dopo `ANNOUNCE_DELAY_MS`: una regione inserita già piena spesso
+    // non si annuncia (LAB-42 P8). Il testo cambia solo con la lingua (setText, senza riannunciare).
+    const entering = this.#connected && d.connected.parentNode !== d.root;
+    announce(d.connected, this.#connected ? t('ai.connected') : '', entering);
     syncValue(d.name, draft.name);
     syncValue(d.provider, draft.kind);
     syncValue(d.url, draft.baseUrl);
diff --git a/src/elements/settings/sync.element.ts b/src/elements/settings/sync.element.ts
index 68072dd..af76add 100644
--- a/src/elements/settings/sync.element.ts
+++ b/src/elements/settings/sync.element.ts
@@ -3,6 +3,7 @@ import type { SyncBinding, SyncService } from '../../ai/syncBinding';
 import { HmdElement } from '../../dom/element';
 import { el, setText } from '../../dom/el';
 import { RenderLoop } from '../../dom/renderLoop';
+import { uid } from '../../dom/uid';
 import type { MessageKey } from '../../i18n/messages';
 import type { I18nStore } from '../../state/i18nStore';
 import { showConfirmDialog } from '../dialogs/confirmDialog';
@@ -91,8 +92,9 @@ export class HmdSettingsSync extends HmdElement {
         folder: el('span'),
         disable: el('button', { type: 'button', on: { click: () => void this.#binding?.disable().catch(report) } }),
         reactivate: el('button', { type: 'button', on: { click: () => void this.#binding?.reactivate().catch(report) } }),
-        status: el('p', { class: 'help' }),
-        error: el('p', { class: 'help' }),
+        // Lo stato cambia dopo ogni sync (LAB-42 P9): regione live; l'errore entra già scritto, come avviso.
+        status: el('p', { class: 'help', role: 'status' }),
+        error: el('p', { class: 'help', role: 'alert' }),
         conflicts: el('p', { class: 'help' }),
         syncActions: el('div', { class: 'actions' }),
         syncNow: el('button', { type: 'button', on: { click: () => void (this.#sync?.service as SyncDetailsService | undefined)?.syncNow() } }),
@@ -208,13 +210,19 @@ export class HmdSettingsSync extends HmdElement {
   #renderBackups(parts: Parts, t: I18nStore['t']): void {
     const nodes = new Map<string, HTMLParagraphElement>();
     for (const path of this.#backups) {
-      const node = this.#backupNodes.get(path) ?? el('p', { class: 'help' }, path, el('button', { type: 'button', on: { click: () => this.#restore(path) } }));
+      // Il percorso descrive il suo «Ripristina»: i pulsanti hanno lo stesso nome (LAB-42 P10, WCAG 2.4.6).
+      const node = this.#backupNodes.get(path) ?? this.#backupNode(path);
       setText(node.lastElementChild!, t('ai.restoreBackup'));
       nodes.set(path, node);
     }
     showChildren(parts.backups, [parts.backupsSummary, ...nodes.values()], [...this.#backupNodes.values()]);
     this.#backupNodes = nodes;
   }
+
+  #backupNode(path: string): HTMLParagraphElement {
+    const id = uid('hmd-settings-backup');
+    return el('p', { class: 'help' }, el('span', { id }, path), el('button', { type: 'button', 'aria-describedby': id, on: { click: () => this.#restore(path) } }));
+  }
 }
 
 declare global {
```

- [ ] **Step 5: e2e** (verdi nel prototipo). (a) In `settings.spec.ts` il test P5 del Task 1 si rovescia:

```ts
test('Escape with unsaved changes opens the confirmation once, with the focus on Cancel; Cancel keeps the settings and the draft (P5)', async ({ app, page }) => {
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  const settings = page.getByRole('region', { name: app.t('settings.title') });
  await settings.getByRole('link', { name: app.t('settings.aiPresets') }).click();
  const presets = settings.getByRole('region', { name: app.t('settings.aiPresets') });
  await presets.getByRole('button').first().click();
  await presets.getByRole('textbox').first().fill('Changed');
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: app.t('dialog.cancel') })).toBeFocused();
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(settings).toBeVisible();
  await expect(presets.getByRole('textbox').first()).toHaveValue('Changed');
});
```

(b) In `settings-sections.spec.ts` «the index follows the scroll» il limite di oggi si rovescia, e `#settings-ai-presets` (riga 109) diventa la regione con il nome:

```diff
diff --git a/e2e/settings-sections.spec.ts b/e2e/settings-sections.spec.ts
index 663351c..0001138 100644
--- a/e2e/settings-sections.spec.ts
+++ b/e2e/settings-sections.spec.ts
@@ -60,10 +60,15 @@ test('the index follows the scroll: the section brought into view is the current
   await openSettings(app);
   const index = settings(app).getByRole('navigation', { name: app.t('settings.sections') });
   await expect(index.getByRole('link', { name: app.t('settings.general') })).toHaveAttribute('aria-current', 'true');
-  // Profili, non Sync: le ultime sezioni non arrivano in cima (padding di 40vh) e l'indice resta su Profili (limite di oggi, fase 8).
   await index.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
   await expect(index.getByRole('link', { name: app.t('settings.aiProfiles') })).toHaveAttribute('aria-current', 'true');
   await expect(index.getByRole('link', { name: app.t('settings.general') })).not.toHaveAttribute('aria-current', 'true');
+  // Le ultime sezioni, corte, non arrivano in cima: il salto le rende correnti lo stesso, e il focus va sul titolo.
+  for (const key of ['settings.aiSync', 'settings.aiPresets'] as const) {
+    await index.getByRole('link', { name: app.t(key) }).click();
+    await expect(index.getByRole('link', { name: app.t(key) })).toHaveAttribute('aria-current', 'true');
+    await expect(settings(app).getByRole('heading', { name: app.t(key), level: 2 })).toBeFocused();
+  }
 });
 
 test('a cloud profile asks for the key: the address is fixed, Save key is off until something is typed', async ({ app }) => {
@@ -106,7 +111,7 @@ test('a built-in preset offers Restore original instead of Delete, and restoring
   await settings(app).getByRole('link', { name: app.t('settings.aiPresets') }).click();
   // La seconda sezione AI è quella dei preset: il primo pulsante dell'elenco è un preset predefinito.
   // Eccezione accettata al «solo ruolo e nome»: le sezioni non hanno ancora un nome accessibile (da risolvere in fase 8, vedi handover).
-  const presets = settings(app).locator('#settings-ai-presets');
+  const presets = settings(app).getByRole('region', { name: app.t('settings.aiPresets') });
   await presets.getByRole('button').first().click();
   const instructions = presets.getByRole('textbox', { name: app.t('ai.instructions') });
   const original = await instructions.inputValue();
```

(c) Le sezioni per nome al posto della posizione: in `settings.spec.ts:16-17, 84, 86, 103`, `settings-sections.spec.ts:72, 88`, `support/app.ts:80-83`, `ai-chips.spec.ts:57`, `ai-model.spec.ts:176` i `.first()`/`.nth(1)` su «+ Crea», nome, provider e Salva diventano `settings.getByRole('region', { name: app.t('settings.aiProfiles') })` (o `settings.aiPresets`) seguito dal ruolo, senza posizione (non provato nel prototipo: è una sostituzione meccanica, gli e2e del gate la verificano). (d) In `settings.spec.ts` «deleting a preset asks first…»: dopo la conferma, `await expect(presets.getByRole('button').first()).toBeFocused()`.

**Eccezione che resta nell'audit.** `computed-styles.audit.ts:576` (`#settings-ai-presets`) e le posizioni di `:587`, `:673-674` **non** cambiano qui: l'audit esegue la stessa preparazione anche sulla build di `dist-baseline/`, che non ha le sezioni con il nome. Si sostituiscono nel Task 8, il primo che parte da una baseline ricostruita dopo questo task.

- [ ] **Step 6: gate e baseline.** `npm test` (atteso **1075** = 1070 + 3 `settings` + 1 `profiles` + 1 `sync`), `npm run lint`; in build e in sviluppo `settings.spec.ts`, `settings-sections.spec.ts`, `ai-model.spec.ts`, `ai-chips.spec.ts`, `theme-i18n.spec.ts`. Audit **solo con `-g "settings"`** (il progetto `baseline` gira comunque tutto): cadono **solo** `settings-preset` (`nav:0>a:2 { background-color: rgb(204, 251, 241) → rgba(0, 0, 0, 0) }`, `nav:0>a:3 { … → rgb(204, 251, 241) }`: la voce corrente è Preset, non Profili) e `settings-sync-folder` (lo stesso con `a:4`, Sync), misurato; righe incollate nel commento, poi baseline ricostruita dal commit del task e lo stesso `-g` verde (mai l'audit completo: Task 7). Commit piccoli: `test: …(RED)`, `fix: Esc nelle impostazioni apre la conferma e non la richiude`, `fix: il focus resta nella sezione dopo Elimina e dopo un salto dall'indice`, `feat: sezioni delle impostazioni con un nome accessibile`, `fix: l'indice delle impostazioni arriva alle ultime sezioni`, `fix: stato della sync e «Connesso» annunciati`, `test: e2e per nome di sezione al posto di id e posizione`.

### Task 6: I tre `!important` del diff come `StyleModule` (Builder)

**Files:**
- Modify: `src/elements/ai/diff-pane.element.ts`, `src/elements/ai/diff-pane.css`, `package.json`, `package-lock.json`, `src/editor/docExtensions.ts` (solo il commento del quarto)

Decisione 8, provata: audit degli stati `ai-review*` identico alla baseline. Nessun test unitario nuovo (l'aspetto lo prova l'audit, che è la rete giusta per un cambio alla cascata: `CLAUDE.md`).

- [ ] **Step 1: prima del cambio**, audit con `-g "ai-review"` verde contro la baseline del Task 5 (`cat dist-baseline/BASELINE_SHA`).
- [ ] **Step 2: dipendenza dichiarata.** `npm install --save-exact style-mod@4.1.4` (è già nel bundle come dipendenza di `@codemirror/view`; `npm ls style-mod` deve mostrare una sola copia, `deduped`).
- [ ] **Step 3: il `StyleModule`** in `diff-pane.element.ts`, sopra la classe, e registrato nelle estensioni del lato `b`, dopo il `contentAttributes` del Task 4:

```ts
import { StyleModule } from 'style-mod';   // dopo `import { basicSetup } from 'codemirror';`

/**
 * Le tre proprietà dei pulsanti per blocco che `@codemirror/merge` dichiara nel suo `StyleModule`, fuori da ogni
 * layer (`.cm-merge-revert button`: `position: absolute`, `background: none`, `cursor: pointer`). Uno stile fuori
 * dai layer vince su ogni regola normale di un layer (`diff-pane.css`): qui stanno nella stessa origine, con una
 * specificità più alta (0,2,1 contro 0,1,1), e vincono senza `!important` (analisi del layer `vendor`, piano 6c).
 * Il resto dell'aspetto dei pulsanti resta nel foglio.
 */
const revertButtonStyles = EditorView.styleModule.of(
  new StyleModule({
    '.cm-merge-revert > .revert > button': { position: 'static' },
    '.cm-merge-revert > .revert > button:hover:not(:disabled)': { background: 'var(--c-accent-soft)' },
    '.cm-merge-revert > .revert > button:disabled': { cursor: 'default' },
  }),
);
```

e nelle estensioni del lato `b`: `revertButtonStyles,`. Nel foglio:

```diff
diff --git a/src/elements/ai/diff-pane.css b/src/elements/ai/diff-pane.css
index 1dde4ac..b4b3743 100644
--- a/src/elements/ai/diff-pane.css
+++ b/src/elements/ai/diff-pane.css
@@ -27,26 +27,21 @@
     }
 
     /*
-     * @codemirror/merge inietta `.cm-merge-revert button { position: absolute; background: none;
-     * cursor: pointer; … }` fuori da ogni layer, e uno stile fuori dai layer vince su ogni regola
-     * normale di un layer. Le proprietà in comune si dichiarano !important: dentro un layer,
-     * !important vince sugli stili normali fuori dai layer (prima vinceva la specificità del CSS Module).
+     * `position`, `background` al passaggio e `cursor` dei pulsanti li dichiara `revertButtonStyles`
+     * (diff-pane.element.ts), nella stessa origine fuori dai layer degli stili di @codemirror/merge.
      */
     .cm-merge-revert > .revert > button {
-      position: static !important;
       padding: 2px 0;
       border-radius: 4px;
       color: var(--c-muted);
     }
 
     .cm-merge-revert > .revert > button:hover:not(:disabled) {
-      background: var(--c-accent-soft) !important;
       color: var(--c-text);
     }
 
     .cm-merge-revert > .revert > button:disabled {
       opacity: 0.35;
-      cursor: default !important;
     }
   }
 }
```

Il quarto `!important` (`.cm-selectionBackground` in `docExtensions.ts:48`) resta: il commento sopra la regola dice perché (il selettore del tema base di `@codemirror/view`, `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`, ha specificità più alta; toglierlo vorrebbe dire copiare quel selettore interno).

- [ ] **Step 4: verifiche.** `grep -n "important" src/elements/ai/diff-pane.css` → uscita 1; `grep -rn "important" src --include=*.css --include=*.ts` → solo `docExtensions.ts:48` e il suo commento; gzip del bundle (atteso uguale ±50 B a quello del Task 5); `npm test`, `npm run lint`; e2e `ai-diff.spec.ts`, `ai-review.spec.ts`, `ai-review-bar.spec.ts` in build e in sviluppo; audit solo con `-g "ai-review"` **verde, nessuna differenza** contro la baseline del Task 5 (misurato). Commit: `refactor: i pulsanti dei blocchi del diff senza !important (StyleModule)`.

Con l'8b (Task 8) le regole `:disabled` del `StyleModule` e del foglio cambiano con la regola «mai disabled»: il Task 8 le riscrive insieme.

### Task 7: Chiusura dell'8a — suite complete, spec, PR (Builder)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 «Fase 8», §13), questo piano (paragrafo «Esecuzione 8a»)

- [ ] **Step 1: correzioni della review** (Reviewer e A11y sul diff dell'8a), se ce ne sono, come primo commit.
- [ ] **Step 2: suite complete, una volta, nel lock**: `npx tsc --noEmit`, `npm run lint`, `npm test` (atteso **1075** più i test delle correzioni), `npm run test:e2e` (atteso **210** = 202 + i 5 del Task 1 + i 2 nuovi del Task 2 + Scarta del Task 4; i rovesciati non aggiungono test), `npm run test:e2e:dev` (atteso **195** = 187 + gli stessi 8), `npm run test:e2e:audit` (atteso **152** = (68 + 8 stati) × 2 progetti) contro la baseline del Task 5 (`BASELINE_SHA`). Gzip del bundle. Instabilità note ripetute da sole e annotate.
- [ ] **Step 3: spec.** §7 «Fase 8»: paragrafo «8a **fatta** (PR #12)» nello stile della 7a/7b (cosa, misure, decisioni che cambiano il contratto: `announce`, `pluralKey`, `currentSection`, `StyleModule`, `style-mod` in `package.json`); §13: questo piano nell'elenco.
- [ ] **Step 4: PR pronta.** Paragrafo «Esecuzione 8a» in questo piano (misure, deviazioni), `gh pr ready 12`, corpo aggiornato. La PR la mergia il PM nell'epica; da lì nasce il branch dell'8b.

### Task 8: «Mai disabled» per i pulsanti dei blocchi del diff (Planner)

**Prerequisiti:** 8a mergiata nell'epica; branch `lab/LAB-6-fase-8b` da `epic/LAB-3-web-components`, PR in bozza nuova; `dist-baseline/` copiata dal checkout della chiusura dell'8a (`BASELINE_SHA` = il commit del Task 5, l'ultimo dell'8a che l'ha rinnovata: il Task 7 non la tocca) o ricostruita da quello SHA in un worktree separato; proposta di Designer accettata dal PM (punto 7 di «Cambi d'aspetto»).

**Files:**
- Modify: `src/elements/ai/diff-pane.element.ts`, `diffLogic.ts` (+ test), `diff-pane.css`, `review.element.ts`, `review-bar.element.ts` (la nota della barra riceve anche le ragioni dei blocchi), i loro test, `e2e/ai-review-bar.spec.ts`, `e2e/ai-diff.spec.ts`, `e2e/computed-styles.audit.ts` (`:229`, e le eccezioni `#settings-ai-presets` del Task 5 che qui diventano regioni con il nome)

Oggi: `controlDisabled()` (`diffLogic.ts:36`) spegne «← accetta» senza `canAccept` e «→ rifiuta» durante la generazione; i controlli li crea `@codemirror/merge` (`renderRevertControl`) e li **ricrea** a ogni cambio dei blocchi, quindi la nota non può stare dentro di loro e il focus su un pulsante ricreato va riportato sul nodo nuovo dello stesso blocco. Schema (da confermare nel task, è il punto delicato): i pulsanti restano attivi; il gestore del `mousedown`/`keydown` già esistente (`diff-pane.element.ts:215-228`), invece di non fare nulla, emette un evento nuovo `hmd-ai-block-blocked` con la ragione (`acceptBlocker` del controller per «accetta», `generating` per «rifiuta»); `hmd-ai-review` lo passa alla barra, che scrive la nota con `announce` (stesse chiavi `ai.review.*`, nessun testo nuovo); il focus resta sul pulsante (se il diff ricrea i controlli nel frattempo, sul pulsante dello stesso blocco e della stessa azione: `data-action` più l'indice del blocco). Test jsdom per accetta e rifiuta bloccati, e2e da tastiera durante la generazione e durante un conflitto. Il `StyleModule` e il foglio perdono `:disabled` (`opacity .35`, `cursor: default`) e prendono l'aspetto di Designer. Audit: cambiano `ai-review-conflict`, `ai-review-generating`, `ai-review-note` (rito della baseline); snapshot `ai-review` solo se cambia l'aspetto a riposo.

### Task 9: «Mai disabled» per impostazioni, barra, sidebar, schermata iniziale e avviso (Builder)

**Prerequisiti:** Task 8; proposta di Designer accettata (punti 5 e 6 di «Cambi d'aspetto»).

**Files:**
- Modify: `src/elements/settings/profiles.element.ts`, `sync.element.ts`, `src/elements/workspace/workspace.element.ts`, `workspace.css`, `src/elements/start-screen/*`, `src/elements/notice/*`, `src/elements/update-notice/*`, i moduli puri che calcolano le ragioni (nuovi o esistenti: `settings/fields.ts`, `workspace/workspaceView.ts`, `start-screen/startScreen.ts` se c'è, altrimenti funzioni nuove testate), `src/i18n/locales/*.json`, i test, gli e2e `settings-sections.spec.ts:74-79`, `workspace-shell.spec.ts:27`, `start-screen`/`notice` in jsdom

Schema della 6b (nota `p.note[role="status"]` vuota di norma, ragione da una funzione pura, `announce` per il ri-annuncio, focus che resta, nota svuotata quando la causa sparisce), un punto alla volta con il suo RED: Salva chiave senza chiave (`ai.saveSecret.needKey`: la chiave va scritta prima); l'indirizzo per Anthropic `readOnly` con `aria-describedby` verso l'aiuto del provider (decisione 10); Sincronizza ora durante una sync (nota, **nessuna sync accodata**: decisione 17); Cronologia senza documento (nota dove Designer la mette); la cartella durante un cambio (nota nella testata della sidebar); i pulsanti della schermata iniziale durante un cambio (nota «apertura in corso» al posto di `cursor: progress`/opacità, e il focus resta sul pulsante: chiude anche il caso «scelta annullata» del Task 2); «Aggiorna» durante un aggiornamento. Testi nuovi in tutte e nove le lingue. Alla fine `grep -rn "\.disabled\s*=\|'disabled'\|aria-disabled" src --include=*.ts` mostra solo test che affermano `false`. Audit: `settings-cloud-profile`, `settings-sync-folder`, `settings-connected`, `workspace-empty` più gli stati che la proposta di Designer tocca (rito della baseline); snapshot `settings` solo se una nota è visibile senza interazione.

### Task 10: `forced-colors` — icone, voce corrente, modalità, bozza orfana, separatore (Builder)

**Prerequisiti:** Task 9; proposta di Designer accettata (punto 8).

**Files:**
- Modify: `src/styles/global.css`, `src/elements/workspace/workspace.css`, `src/elements/settings/settings.css`, `sections.css`, `e2e/computed-styles.audit.ts` (nessuno stato nuovo: quelli del Task 1)

Regole provate nel prototipo (schema chiaro e scuro, `forcedColors: 'active'`), da adattare alla proposta di Designer:

```diff
diff --git a/src/elements/settings/sections.css b/src/elements/settings/sections.css
index b1ddbea..74cb960 100644
--- a/src/elements/settings/sections.css
+++ b/src/elements/settings/sections.css
@@ -96,5 +96,14 @@
         grid-template-columns: minmax(0, 1fr);
       }
     }
+
+    /* In forced-colors la voce corrente si vede solo dallo sfondo, che diventa Canvas (LAB-42 P7). */
+    @media (forced-colors: active) {
+      .item[aria-current='true'] {
+        forced-color-adjust: none;
+        background: Highlight;
+        color: HighlightText;
+      }
+    }
   }
 }
diff --git a/src/elements/settings/settings.css b/src/elements/settings/settings.css
index c029568..8b825e5 100644
--- a/src/elements/settings/settings.css
+++ b/src/elements/settings/settings.css
@@ -159,5 +159,14 @@
       gap: 8px;
       cursor: pointer;
     }
+
+    /* In forced-colors la voce corrente si vede solo dallo sfondo, che diventa Canvas (LAB-42 P7). */
+    @media (forced-colors: active) {
+      .navLink[aria-current='true'] {
+        forced-color-adjust: none;
+        background: Highlight;
+        color: HighlightText;
+      }
+    }
   }
 }
diff --git a/src/elements/workspace/workspace.css b/src/elements/workspace/workspace.css
index b8c101c..114e04f 100644
--- a/src/elements/workspace/workspace.css
+++ b/src/elements/workspace/workspace.css
@@ -232,5 +232,32 @@
     .orphan[aria-current='true'] {
       background: var(--c-accent-soft);
     }
+
+    /*
+     * In forced-colors gli sfondi diventano Canvas: la modalità attiva e la bozza corrente prendono i colori di
+     * sistema della selezione, il separatore un colore di testo (A3, WCAG 1.4.11).
+     */
+    @media (forced-colors: active) {
+      .mode[aria-pressed='true'],
+      .orphan[aria-current='true'] {
+        forced-color-adjust: none;
+        background: Highlight;
+        color: HighlightText;
+      }
+
+      .mode[aria-pressed='true'] .icon {
+        background-color: HighlightText;
+      }
+
+      .resizer {
+        forced-color-adjust: none;
+        background: CanvasText;
+      }
+
+      .resizer:hover,
+      .resizer:focus-visible {
+        background: Highlight;
+      }
+    }
   }
 }
diff --git a/src/styles/global.css b/src/styles/global.css
index 97bd567..60f48c7 100644
--- a/src/styles/global.css
+++ b/src/styles/global.css
@@ -108,6 +108,20 @@
     vertical-align: middle;
   }
 
+  /*
+   * In forced-colors il browser sostituisce `background-color` con Canvas e l'icona (una maschera colorata
+   * dallo sfondo) sparisce (LAB-42 P2). Fuori dall'adattamento prende un colore di sistema: `currentColor`
+   * non basta, perché sotto `forced-color-adjust: none` vale il colore d'autore (misurato: rgb(31, 29, 26)),
+   * illeggibile con un tema scuro. Dove lo sfondo è Highlight (voce premuta) il foglio dell'elemento usa
+   * HighlightText.
+   */
+  @media (forced-colors: active) {
+    .icon {
+      forced-color-adjust: none;
+      background-color: CanvasText;
+    }
+  }
+
   /* Cambio tema: nessuna dissolvenza incrociata; il vecchio tema sta sopra e viene "mangiato" a blocchi
      dalla maschera animata in src/theme/pixelTransition.ts. */
   ::view-transition-old(root),
```

**Note per Designer e per questo task (A11y, non bloccanti):** dentro i pulsanti il colore di sistema giusto è `ButtonText` (in alcuni temi a contrasto di Windows è diverso da `CanvasText`), nei link `LinkText`; l'anello del focus in `forced-colors` (`outline` `Highlight`, `outline-offset: 2px`, `global.css:79`) su una voce con sfondo `Highlight` resta distinguibile solo per i 2 px di scostamento: va controllato sul contrasto elevato vero; `forced-color-adjust: none` si eredita, quindi un figlio futuro con un colore d'autore lo mostrerebbe su `Highlight` (oggi `.mode`, `.orphan`, `.navLink`, `.item` hanno solo testo e icona). Misurato nel prototipo: icona della barra `rgb(0, 0, 0)` su Canvas bianco e `rgb(255, 255, 255)` su Canvas nero (oggi uguale al Canvas: invisibile), modalità premuta su `Highlight` con l'icona in `HighlightText`, separatore `CanvasText`, voce corrente dell'indice su `Highlight`. Gate: audit solo con `-g "forced-colors"`, cadono **solo** `focus-search-keyboard-forced-colors` (icona della ricerca) e gli 8 `forced-colors-*` del Task 1 (misurato: tutti e 9 cambiano con queste regole; rito della baseline); un e2e in `forced-colors` per stato non serve (l'audit confronta gli stili calcolati di ogni nodo, icone comprese). Nessuno snapshot (nessuno è in `forced-colors`). Prova a mano con il contrasto elevato vero di Windows nella sub-issue di Davide.

### Task 11: Documenti, misure, chiusura della migrazione (Builder)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 «Fase 8», §11, §13), `CLAUDE.md`, `README.md`, questo piano («Esecuzione 8b»)
- Create: `docs/superpowers/notes/2026-10-xx-chiusura-migrazione.md` (al posto dell'handover)

- [ ] **Step 1: correzioni della review dell'8b** (Reviewer e A11y), come primo commit.
- [ ] **Step 2: suite complete, una volta, nel lock**, sul commit finale: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit` (contro la baseline dell'ultimo task che l'ha rinnovata); gzip del bundle (riferimento 379 234 B; atteso entro +2 KB: testi nuovi e note); **tempo di avvio** con `e2e/startup.config.ts` (21 giri, `dist-phase3/` dal Task 1 o ricostruita da `a3ebc6f`): attesi `start` e `reopen` entro ±10 % da 139 e 220 ms.
- [ ] **Step 3: spec.** §7 «Fase 8»: «8b **fatta**» con misure (bundle e avvio contro la fase 3, nella tabella del paragrafo «Misure» di questo piano); §11: ogni criterio con lo stato (fatto o «resta: Davide»); §13: piano e PR.
- [ ] **Step 4: `CLAUDE.md` e `README.md`.** In `CLAUDE.md`, «Interfaccia»: la regola «mai disabled» (con la nota `role="status"` e `announce`), le regioni live che entrano vuote, `pluralKey` per i testi con un numero, `forced-colors` (icone in `CanvasText`, voce corrente in `Highlight`), `style-mod` per gli stili che devono stare nell'origine di CodeMirror. Nel `README.md` lo stato della migrazione (finita, in attesa del merge) e il comando della misura dell'avvio.
- [ ] **Step 5: nota di chiusura** (al posto dell'handover): stato finale (branch, PR, misure delle suite, del bundle e dell'avvio), `dist-baseline/` con la sua provenienza, cosa resta fuori (la rimozione dei toast, A4 se A11y non l'ha riprodotta, le prove a mano), le lezioni della fase 8 (dal paragrafo «Misure» e dall'esecuzione: il focus catturato prima di `busy`; un `dispatch({})` vuoto in CodeMirror passa dalla sessione; l'orologio finto ferma `requestAnimationFrame`; l'audit esegue la preparazione anche sulla baseline), le trappole dell'ambiente.

  La nota contiene la **checklist §9 per Davide**, completa: la parte automatica già verde (con i numeri delle suite), e la parte manuale da fare in Chrome ed Edge stabili — selettore di cartelle e permessi veri; popover e tooltip vicino ai bordi; transizione a pixel e `prefers-reduced-motion`; PWA (installazione, offline, avviso di nuova versione); AI con un provider vero; **screen reader, NVDA con Chrome e Narratore con Edge**: la stessa nota a un secondo clic (barra della revisione, composer, Nuova chat), «Connection successful», avvio, parti ed esito della generazione, lo stato della sync, A4 cambiando lingua dalla select; **contrasto elevato vero di Windows, almeno Acquatico e Deserto**: icone della barra, modalità premuta (anche con il focus), voce corrente dell'indice e di profili e preset, bozza orfana corrente, separatore (anche al passaggio e con il focus); le prove ancora aperte (LAB-52, i punti della 7b dell'handover).
- [ ] **Step 6: PR dell'8b pronta, e basta.** `gh pr ready` sulla PR dell'8b, corpo aggiornato. La PR `epic/LAB-3-web-components` → `main` e la sub-issue «[Davide] Checklist §9 in Chrome ed Edge e merge della migrazione in main» **non** le apre questo task: le apre il PM dopo il merge dell'8b nell'epica (wakeup già pronta su LAB-6), usando la checklist della nota di chiusura. Mergia solo Davide.
