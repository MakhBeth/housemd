# HouseMD Web Components — Piano 12: fase 6c, barra e vista della revisione AI (pulsanti mai disattivati, ragioni dal controller)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element i due componenti React della revisione AI: `hmd-ai-review-bar` (era `ui/ai/ReviewBar.tsx`) e `hmd-ai-review` (era `ui/ai/ReviewView.tsx`, con `ReviewView.module.css` e `reviewDoc.ts`), con aspetto e comportamento invariati, tranne tre cambi voluti: (1) i quattro pulsanti della barra (Precedente, Successivo, Scarta, Accetta tutto) non si disattivano più e, attivati quando l'azione non è possibile, dicono perché in una nota `role="status"` sotto la riga dei pulsanti (decisione 3, regola di Davide, spec §2 vincolo 4, proposta di Designer su LAB-14 accettata dal PM); (2) un invio che il controller scarterebbe in silenzio (nessun documento aperto, aggiornamento in corso, generazione in corso anche da Invio) lo dice nella nota del composer e conserva la bozza (decisione 2: `sendBlocker()` sincrono del controller, più `acceptBlocker(p)` da cui deriva `canAccept`); (3) il focus, quando il nodo che lo ha sparisce passando tra diff ed editor semplice (Scarta, Accetta tutto, Continua), va sempre su un bersaglio stabile (decisione 4). Chiude la fase 6 (spec §7): dopo questo piano in `src/ui/` restano solo `WorkspaceView`, `SettingsView` e le sezioni AI delle impostazioni (fase 7).

**Architecture:** Stesso schema di 4c–6b: classe `Hmd<Nome>` su `HmdElement`, DOM interno identico a quello di React (stesse classi, stessi attributi, stesso ordine dei figli: l'audit confronta gli stili per percorso nel DOM saltando gli host con `display: contents`), foglio `@layer components { @scope (hmd-ai-…) to (…) { … } }` con i valori del modulo e il **limite inferiore** sui figli `hmd-*` (`hmd-editor` ha anch'esso una classe `.editor`), ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`, ogni render da un `RenderLoop` (`src/dom/renderLoop.ts`). La catena passa da React agli elementi dal fondo: prima la barra (`ReviewView.tsx` la monta, con eventi `hmd-ai-review-action` e `hmd-ai-review-warning`), poi la vista (`WorkspaceView.tsx` monta `hmd-ai-review`, che crea barra, `hmd-editor` e `hmd-ai-diff-pane` e passa loro le proprietà prima dell'inserimento); nessun componente React finisce mai dentro un elemento. La logica nuova sta in moduli puri accanto agli elementi (`reviewBarView.ts`: ragioni e riga di stato; `reviewView.ts`: il modello della vista, il testo ritoccato, la conferma) e nel controller (`ai/aiController.ts`: `sendBlocker()`, `acceptBlocker()`); quella esistente resta dov'è (`ai/reviewStatus.ts`, `ai/scope.ts`). L'host della barra, dalla seconda parte del Task 3, ha un box (`display: block` con il bordo inferiore) perché la nota sta sotto la riga dei pulsanti e dentro il bordo; l'host della vista resta `display: contents`.

**Tech Stack:** TypeScript 7, React 19.3 (solo in `WorkspaceView` e nelle impostazioni), Custom Elements, CSS `@scope`/`@layer`, Popover API (`popover="auto"`, `popovertarget`), Anchor Positioning (`position-area` del popover degli avvisi), CodeMirror 6 + `@codemirror/merge`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, in particolare il 4 «pulsanti mai disattivati»; §5.1–5.4; §7 «Fase 6» con le note «6a fatta» e «6b fatta»; §8.2–8.4; §9 punti 11 e 16; §10 R1, R2, R3, R10, R11, R13, R21; §11; §13); handover `docs/superpowers/notes/2026-10-11-handover-fase-6c.md` («Da fare nella 6c», «Regola UX di Davide», «Lezioni da mettere nei piani», «Trappole dell'ambiente»); proposta di Designer su LAB-14 (variante A della nota, pulsanti con lo stesso aspetto in ogni stato, chiavi e testi, priorità e svuotamento, sentinella e2e da sostituire, stati di audit); spec AI `docs/superpowers/specs/2026-09-27-ai-tool-design.md` (proposte non fidate) e `docs/superpowers/specs/2026-09-29-ai-ui-cleanup-design.md` (§4: revisione).

## Global Constraints

- **Branch** `lab/LAB-4-fase-6c` creato da `epic/LAB-3-web-components` (il branch dell'epica LAB-3, oggi lo stesso commit di `main`: `0ba9ccb`, fasi 0–6b fatte), un solo branch per tutta la fase: ogni sub-issue di esecuzione committa lì. PR in bozza verso `epic/LAB-3-web-components` aperta da questo piano (`gh pr create --draft --base epic/LAB-3-web-components`, PR #9), portata a pronta dal task finale (`gh pr ready`). Commit piccoli in italiano, prefisso convenzionale (`test:`, `feat:`, `refactor:`, `docs:`), **nessuna riga di attribuzione**. Mai push su `main` né sul branch dell'epica, nessun merge: la PR della fase la mergia il PM dopo review (Reviewer, A11y) e gate verdi; verso `main` c'è solo la PR dell'epica, che mergia Davide.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da `main` **prima di qualsiasi modifica all'app**, conteggi delle suite e gzip del bundle principale annotati. `dist-baseline/` si ricostruisce **due volte sole**, dopo i due cambi voluti e dopo aver provato con `--grep-invert` che tutto il resto è identico: Step 8 del Task 2 (lo stato nuovo `ai-composer-note-no-document` non è raggiungibile sulla build vecchia, e una caduta nel progetto `baseline` dell'audit salta tutto il progetto `current`: misurato) e Step 13 del Task 3, seconda parte (il `p.note` sposta gli indici degli stati `ai-review*`).
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (atteso nessuna rigenerazione: la nota vuota non occupa pixel, misurato nel prototipo; una rigenerazione solo con approvazione di Davide, con `--update-snapshots=all -g "nome"` ed elenco motivato nel commento finale e nella PR); `npm run test:e2e:dev` verde (console senza errori né avvisi, `expectedConsole` solo per diagnostiche esatte); `npm run test:e2e:audit` verde contro `dist-baseline/`. Eccezioni volute: decisione 3 (nota della barra: un `p` in più sposta gli indici degli stati `ai-review*` con la barra → baseline ricostruita nella seconda parte del Task 3), decisione 4 (focus su un bersaglio stabile: non cambia l'aspetto), decisione 2 (note del composer: nessun pixel in più con la nota vuota; lo stato di audit nuovo `ai-composer-note-no-document` entra con la baseline ricostruita nel Task 2).
- **Un task per elemento, sempre TDD**: test jsdom che fallisce (**il RED si vede e si annota nel commento finale prima di scrivere l'elemento**: nel dispatch all'implementer va chiesto esplicitamente «test prima, poi il codice», non «scrivere tutto e ripristinare HEAD per vedere il rosso») → logica pura + elemento + foglio → registrazione in `define.ts` (ordine alfabetico), eventi in `events.ts`, tipi in `jsx.d.ts` → i chiamanti montano il tag → `.tsx`, `.module.css` e `reviewDoc.ts` cancellati con `git rm`, poi `grep -r` (uscita 1 = nessuna occorrenza, il risultato giusto; 2 = comando fallito, da ripetere).
- **`events.ts`: ogni voce nuova (JSDoc + chiave) va subito sopra il JSDoc della voce successiva, mai tra un JSDoc e la sua chiave.** Qui due voci, `hmd-ai-review-action` e `hmd-ai-review-warning`, sopra il JSDoc di `hmd-ai-suggestion` (dopo `hmd-ai-retry`: ordine alfabetico).
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri testati senza DOM), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal` (i listener sui nodi creati dall'elemento muoiono con i nodi: `on` di `el()`).
- Cartella: `src/elements/ai/` (radici `hmd-ai-*`, già ammesse da `architecture.test.ts`; il limite inferiore `to (hmd-…)` è ammesso dalla regola). Nessuna eccezione nuova.
- **Schema di render (`RenderLoop`)**: ogni render passa da `this.#loop.update()`: setter, `watch`, gestori (`click`, notifiche del controller, tick del contatore), risposte asincrone (la conferma del dialog). Nessun `#render()` fuori dal loop. **`HmdElement.watch()` esegue subito la funzione**: niente render ridondanti in fondo a `connect()`; **nessun evento si emette dentro `connect`**. I prerequisiti si ricontrollano a ogni passata; `hadFocus` prima della prima, recupero del focus dopo l'ultima, contro il DOM finito.
- **Una nota si svuota solo a un render: ogni causa, quando sparisce, deve provocarne uno** (rilievo di Reviewer sul piano, bloccante). Le note del composer e della barra si ricalcolano nel render dalla causa (`sendBlocker()`, `acceptBlocker()`); un render arriva solo da una notifica del controller, da un ingresso o da un evento. `AiController.prepare()` e `cancel()` cambiavano `updating` **senza notificare**: la nota «aggiornamento in corso» restava dopo la fine dell'aggiornamento anche ripassando testo e selezione invariati. Il Task 2 fa notificare `prepare()`, `cancel()` e `documentChanged(…, reset = true)` (un documento aperto: la nota «apri un documento») con `this.set({})`, che cambia anche l'identità dello stato per `useSyncExternalStore` (`ReviewView.tsx` e `ReviewBar.tsx` restano React fino al Task 4: la nota della barra «aggiornamento in corso» della seconda parte del Task 3 si svuota per la stessa via). Le altre cause notificano già: generazione (`running` nello stato), profilo (`reload()` → `set`), testo (evento `input`). Il test che lo prova usa il **controller vero**, non `fakeAi` con un `ai.set({})` a mano.
- **Lo stato si salva prima di emettere**: la barra registra la nota (o la toglie) e fa il render **prima** di mandare `hmd-ai-review-action`; la vista non emette nulla verso fuori (gli eventi di editor e diff risalgono da soli).
- **Nessun callback DOM rientra in un render in modo sincrono**: la vista toglie e inserisce i figli della sezione (barra, diff, editor semplice, suggerimento, anteprima) senza mai spostarne uno già al suo posto; il `focusout` sincrono di Chromium quando sparisce il nodo con il focus (Scarta, Continua, il pulsante degli avvisi) arriva dentro il render e chiede solo una passata in più (`RenderLoop`). Il popover degli avvisi si apre e chiude solo con `popovertarget`: nessun `toggle` ascoltato.
- **Lavoro asincrono tardivo scartato**: il contatore dei secondi (`setInterval` di 1 s) vive con il run in corso e si ferma al distacco (`disconnectedCallback`); la conferma di «Accetta tutto» (`showConfirmDialog`) ha un `signal` che si interrompe al distacco e, risolta, accetta **la proposta di quel momento** (come `acceptRef` di ReviewView.tsx), non quella del clic.
- **Campi con il focus mai riscritti né ricreati; focus su un bersaglio stabile se il nodo sparisce** (decisione 4): la vista crea `hmd-editor` e `hmd-ai-diff-pane` una volta sola e li inserisce o toglie (come React, che li smontava); passando tra diff ed editor semplice il focus segue l'editor nuovo se prima era nella sezione **o sul `body`** (le due regole dell'effetto `[view]` di ReviewView.tsx); nella barra, se sparisce il nodo con il focus (Continua dopo il clic, il pulsante degli avvisi quando non restano avvisi) il focus va su Accetta tutto.
- **Proprietà dei figli `hmd-*` assegnate prima dell'inserimento e solo se cambiano**: la vista assegna a barra, editor e diff le proprietà nel render, confrontandole una a una, e solo dopo inserisce i nodi mancanti. `doc` è un oggetto nuovo a ogni render di React: il setter non confronta l'oggetto, il render confronta i campi.
- **React 19 e i custom element**: ogni prop funzione `on*` diventa un listener → uscite come eventi `hmd-*`; ingressi senza prefisso `on` (`doc`, `controller`, `i18n`; dentro `doc` le callback `docChanged` e `selectionChanged` non cominciano per `on`). React assegna tutte le proprietà prima di inserire l'elemento; StrictMode non stacca i custom element. `hmd-ai-review` non manda eventi a `WorkspaceView`; `hmd-doc-change` e `hmd-selection` di editor e diff risalgono attraverso di lui, e lui li ascolta sui figli che ha creato.
- **jsdom 30**: mancano Popover (stub `src/testing/popoverStub.ts`), `showModal` (stub `src/testing/dialogStub.ts`), Anchor Positioning, `requestAnimationFrame` (CodeMirror e MergeView girano con `src/testing/codemirrorEnv.ts`). Il popover vero, la posizione (`position-area`), il focus ring e il ritorno del focus al pulsante alla chiusura del popover li verificano Playwright e la checklist.
- **I pulsanti non si disattivano mai** (spec §2 vincolo 4): né `disabled` né `aria-disabled` su Precedente, Successivo, Scarta, Accetta tutto (e Continua, che già non lo era). Attivati quando l'azione non è possibile scrivono il perché nella nota `p.note[role=status]` sotto la riga (vuota di norma), il focus resta sul pulsante; la nota ricorda la causa e si svuota quando quella non vale più, quando un'azione della barra riesce, o quando la barra sparisce. Mai un toast, mai un tooltip. I pulsanti **dentro il diff** (← accetta, → rifiuta, creati dalla MergeView) restano `disabled` come oggi: fuori da questo piano (fase 8, con la regola estesa a tutta l'app).
- Testi solo da `t()`; **nove chiavi nuove** in tutti i `src/i18n/locales/*.json` (`en.json` riferimento, `locales.test.ts` controlla chiavi, stringhe vuote e segnaposto; nessun test pretende che ogni chiave sia già usata): `ai.composer.noDocument|updating|generating` e `ai.review.generating|updating|conflict|scopeLost|truncated|notAcceptable`, tutte nel Task 2 (Step 3) per toccare i locali una volta sola; le sei della barra le usa la seconda parte del Task 3. Testi en/it della proposta di Designer; «Ricarica dal disco», «sovrascrivi», «Ferma» riprendono le parole dei pulsanti esistenti (`conflict.reload`, `conflict.overwrite`, `ai.stop`) in ogni lingua. Tooltip mai con `title`.
- **Regole AI** (CLAUDE.md §AI, spec R21): gli elementi non importano `ai/providers` né toccano le chiavi (test statico della 6b); proposte e risposte non fidate passano solo da `hmd-ai-chat-log` e dal diff (CodeMirror: testo, mai HTML).
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app (eccezioni ammesse dalla spec §8.4: `.cm-mergeView`, `.cm-content`, `.cm-line`, `.cm-merge-revert`); `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; nessuna richiesta di rete vera (finto Ollama di `e2e/support/aiHarness.ts`); `page.clock.install({ time: NOW })` **prima** di aprire la cartella dove conta il contatore dei secondi; un e2e sospetto di instabilità si prova con `--repeat-each=3`.
- **La sentinella «proposta arrivata» non è mai «Accetta tutto attivo»**: `expect(acceptAll).toBeEnabled()` con i pulsanti mai disattivati passa subito, prima della proposta. Il Task 1 la sostituisce ovunque (14 punti, elenco nello Step 2) con il diff visibile (`expect(page.locator('.cm-mergeView')).toBeVisible()`, eccezione ammessa), sull'app React di oggi.
- **Nei test jsdom mai `assert.equal` tra due nodi**: quando l'asserzione fallisce, il messaggio di `node:assert` passa da `util.inspect` dell'albero di jsdom e non finisce più (il processo sembra appeso: misurato nel prototipo, 150 s senza output). Il focus si afferma con `focusOn(node, 'cosa')` (`assert.ok(document.activeElement === node, …)`), le posizioni con nomi e classi; i test con CodeMirror girano con `--test-timeout=20000`.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail`. I test del Task 1 che affermano i pulsanti spenti durante la generazione e con la proposta troncata, la casella svuotata senza documento e il silenzio di Invio durante una generazione li riscrivono nella forma nuova la seconda parte del Task 3 e il Task 2.
- Dialog solo con le funzioni di `src/elements/dialogs/` (qui `showConfirmDialog` per «Accetta tutto» a documento cambiato); File System Access API solo in `src/fs/`; `workspace/` non cambia; `ai/` cambia solo per i due metodi nuovi del controller.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo sono ricorsivi, si lanciano dopo il `git rm` e distinguono l'uscita 1 dalla 2. Il controller rilancia almeno i file e2e nuovi o toccati di ogni task.
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. **RAM di ape** (regola di Davide dell'11/10): tutto il servizio Multica (daemon, agenti attivi, build, Vite, Chromium) ha un tetto di 8 GB e rallenta già sopra i 6, con fino a 2 task insieme: **un solo browser e due worker** (`E2E_WORKERS=2`, il default della config; regola aggiornata da Davide l'11/10: con 1 worker solo se una suite cade per memoria, e allora lo si scrive nel commento finale), **una suite alla volta**, sempre dentro il lock condiviso, con la variabile **prima** di `flock`: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e` (lo stesso per `test:e2e:dev` e `test:e2e:audit`, anche nel prototipo); mentre si sviluppa solo i file di test toccati (`… npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts`), le suite complete solo ai gate (fine task e commit finale); a fine suite `pgrep -af "vite|chrom|playwright"` e chiudere solo i PID propri (mai `pkill` per nome). Una caduta isolata si ripete da sola prima di chiamarla carico. Instabilità estranee note: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog» (ripetere da solo e annotarlo); i 2 snapshot dello start screen di `visual.spec.ts` cadono su ape per il font pixel (estraneo, misurato prima di toccare l'app: non si rigenerano).
- Commenti e commit in italiano, identificatori in inglese.


## Misure prese scrivendo il piano (11/10, su `0ba9ccb`)

Baseline su `0ba9ccb` (= `epic/LAB-3-web-components`): `npm test` = **934** test verdi; `npm run test:e2e` = **176** (174 verdi + i 2 snapshot dello start screen che cadono su ape per il font pixel: estraneo, misurato prima di toccare l'app); `npm run test:e2e:dev` = **161**; audit = **52** stati (104 test, `baseline` + `current`); bundle principale gzip = **439 717 B** (`dist/assets/index-Degrg3UY.js`; l'handover diceva 439 695).

**Prototipo.** Il codice di tutti i task è stato provato su una copia del repository fuori dal worktree (`git worktree add --detach ../housemd-proto-6c origin/epic/LAB-3-web-components` sotto `/home/agent/work`, `npm ci`, `dist-baseline/` costruita da `0ba9ccb` prima di toccare l'app, niente commit; prototipo rimosso alla fine), in due run (il primo è caduto due volte per un riavvio del daemon di ape: i log delle suite dei Task 1–3 vengono da lì, il Task 4 e le suite complete finali da questo). `npm run lint` pulito a ogni task; `npm test` 934 → **974** (+8 Task 2: 3 controller, 1 vista del composer, 4 composer; +1 + 7 e +3 + 3 Task 3; +7 + 11 Task 4; nel primo run la divisione tra le due parti della barra era diversa: 953 dopo la prima parte); `npm run test:e2e` 176 → **186** (+10 di `ai-review-bar.spec.ts` nel Task 1; i 2 dello start screen cadono sempre e solo loro), **snapshot invariati** (lo snapshot «AI review» passa senza rigenerare anche con la nota della barra: la nota vuota è a 0 px); `npm run test:e2e:dev` 161 → **171**; audit 104 → 112 (Task 1: `ai-review-generating`, `ai-review-truncated`, `ai-review-warnings`, `ai-review-applied`) → 114 (Task 2: `ai-composer-note-no-document`) → **116** (Task 3, seconda parte: `ai-review-note`), verde dopo ogni task: la prima parte della barra contro la baseline del Task 1 (112, nessuna differenza), le due seconde parti contro le baseline ricostruite, il Task 4 contro la baseline del Task 3 (116: l'host della vista è `display: contents`); bundle gzip 439 717 → **441 030 B** (+1 313: React resta, due componenti diventano elementi). Tempi con un solo worker (la regola del momento; ora sono due): `test:e2e` 4,7 min, `test:e2e:dev` 6,7 min, `test:e2e:audit` 5,8 min, `npm test` 39 s. Sull'app finale una sola caduta estranea: `ai-sync-reactivate` dell'audit con «Target page, context or browser has been closed» al `page.reload()` del suo setup (trappola già nota dell'handover), ripetuta da sola 2/2 verde. Misurato anche:

- **Il difetto del focus di «Scarta» non si riproduce in Chromium sull'app React** (11 scenari in produzione e in sviluppo: Scarta, Accetta tutto, Ctrl+Z, conferma annullata, Continua; il focus finisce sempre nell'editor), mentre **si riproduce in jsdom** con il focus sul pulsante che sparisce: `ReviewView.tsx` tale e quale (la vista senza `refocus`) lascia il focus sul `body`. Il test «Discard with the focus on the button: the focus goes into the plain editor, not the body (the fix of 6c)» cade con `focus on the plain editor, not on body.` senza la riga `refocus` e passa con (RED misurato in questo run, 1 su 11); gli e2e del Task 1 affermano il comportamento di oggi di Chromium e restano verdi.
- **`assert.equal` tra due nodi di jsdom appende il processo**: il primo RED del test del focus è durato 150 s senza output, perché il messaggio di `node:assert` passa da `util.inspect` dell'albero. Tutte le asserzioni sul focus usano `focusOn` (valore derivato), e i test con CodeMirror girano con `--test-timeout=20000`.
- **`fakeAi` senza `proposals` nello stato di default** faceva cadere `reviewModel` (`state.proposals.get`): aggiunti `proposals: new Map()` e `streamingPreview: null` (Task 2, dove `fakeAi` cambia comunque).
- **La proposta applicata mostrava il suggerimento**: il primo render della vista metteva `p.hint` ogni volta che la barra non c'era; React non lo mostra con una proposta applicata. `reviewModel` ha il campo `hint` (`!proposal && !bar`) e il test «the proposal applied…» lo afferma (RED: `['p.hint', 'div.editor']` al posto di `['div.editor']`).
- **Uno stato di audit non raggiungibile sulla build vecchia blocca tutto il progetto `current`** («1 failed, 58 did not run»): per le due note nuove si prova il resto con `--grep-invert` e poi si ricostruisce la baseline (Step 8 del Task 2, Step 13 del Task 3). Il filtro va dato a `npx playwright test -c e2e/audit.config.ts …` direttamente: passato attraverso `npm run … -- -g` ha eseguito 60 test invece dei 4 attesi.
- **`ai-composer-running`** (stato della 6b) differiva dalla baseline per la larghezza dello span del contatore: il contatore parte dal `Date.now()` della richiesta, non da `NOW`, e `pauseAt(NOW + 2000)` dava «1 s» o «2 s» secondo l'avvio. Corretto nel Task 1 con `runFor(2100)` + `pauseAt(Date.now() + 50)`, usato anche dagli stati `ai-review-generating` e `ai-review-note`.
- **«Suggerimento cliccato durante una generazione» non è raggiungibile** (`suggestionPresets` nasconde i suggerimenti con `running`): la ragione `running` vale per Invio da tastiera, che oggi tace; il test del Task 1 afferma anche l'assenza dei suggerimenti.
- **Senza documento aperto non si apre un documento restando in modalità AI** (il pannello AI prende il posto dell'albero): si passa dall'editor, `WorkspaceView` smonta la sidebar e la bozza si perde come oggi; il test e2e afferma solo che la nota non c'è più (la prima versione, che pretendeva la bozza dopo il rimontaggio, cadeva: non è una regressione).
- **Precedente/Successivo** si verificano con `.cm-activeLine` del lato documento (segue il cursore anche senza il focus nell'editor; con il focus sul pulsante la selezione del DOM non si aggiorna).
- **`finish_reason: 'length'` nel finto Ollama** produce davvero una proposta «troncata» (Accetta tutto spento oggi, nota `ai.review.truncated` dopo); interrompere lo stream a metà con `route.fulfill` non si può.

**Correzioni dopo la review di Reviewer (11/10, su LAB-9), provate nel prototipo ricostruito dalla patch (`0ba9ccb` + Task 1–4) con il RED prima della correzione**: (1) **bloccante, Task 2**: `prepare()`/`cancel()` non notificavano, quindi la nota «aggiornamento in corso» restava dopo la fine dell'aggiornamento (il test con `fakeAi` lo mascherava con `ai.set({})`) → `prepare()`, `cancel()` e `documentChanged(…, reset = true)` chiamano `this.set({})`; test nuovi «prepare(), cancel() e un documento aperto … notificano gli iscritti» (RED `0 !== 1`) e, con il controller vero montato nel composer, «with the real controller: the updating note goes when cancel() ends the update…» (RED `'An update is in progress: try again in a moment' !== ''`); (2) **Task 4**: `#update()` riportava il focus al cambio di vista solo dal `body`; con il focus su Accetta tutto durante la generazione, arrivata la proposta il focus restava sul pulsante (React lo sposta nel diff) → la regola intera dell'effetto `[view]` (`body` o dentro la sezione); test nuovo «generation finishes with the focus in the retained bar…» (RED `focus on the document side of the diff, not on button.secondary accept`). Dopo: `npm test` **977** (974 + 3), lint pulito, e2e dei cinque file AI (`ai-review-bar`, `ai-review`, `ai-diff`, `ai-composer`, `ai-chat-log`) con due worker: produzione 41 verdi + «a sync folder without permission…» caduta con «page.reload: Target page… closed» (la trappola nota, prima di arrivare all'AI), ripetuta da sola 2/3 con due worker e **3/3 con un worker**; sviluppo 42/42 (StrictMode, console pulita). Le suite complete e l'audit non rilanciati per queste correzioni: le notifiche in più non cambiano il DOM né gli stili (nessuna baseline da rifare), e il Task 2 e il Task 4 le rilanciano ai loro gate.

**Esecuzione (11/10).** Misure sul branch finale: `npm test` = **980** (934 → 980; il piano diceva 977, i 3 in più vengono da LAB-11 e LAB-12); `npm run test:e2e` = **186** (185 verdi + i 2 snapshot dello start screen che cadono su ape per il font pixel, già noti); `npm run test:e2e:dev` = **172** (il piano diceva 171); audit = **116** test (era 104); bundle principale gzip 439 717 (prototipo, Task 1) → **441 143** B. Deviazioni dal piano: gate dei test ridotti per task per decisione di Davide (11/10), suite complete e audit solo qui; 2 worker invece di 1; l'audit è stato fatto in due passi perché i Task 3 e 4 non l'hanno lanciato: prima il confronto con la build di `3f0d006` senza lo stato `ai-review-note` (le sole differenze sono i percorsi del DOM della barra, che ha un host `hmd-ai-review-bar` e una nota `p` in più: nessuna differenza di proprietà sugli altri nodi), poi `dist-baseline/` ricostruita sul commit finale e audit completo verde. Correzioni arrivate dalle review: la nota della barra si svuota quando cambia la proposta (`5735e5d`, proprietà `proposalId`); la conferma di Accetta tutto non accetta se la vista si è staccata prima della risposta (`2cc5ec9`); in `f3d8d42` il focus resta sul pulsante quando arriva la proposta. Rilievi non bloccanti di A11y rimandati alla fase 8: vedi l'handover della fase 7.

### Inventario

**`src/ui/ai/ReviewBar.tsx`** (102 righe; CSS: `.bar`, `.status`, `.spacer`, `.iconButton` (+`:hover:not(:disabled)`), `.secondary`, `.accept`, `:disabled`, `.warnings` (+`button`) di `ReviewView.module.css`)
- Props: `status: ReviewStatus`, `warnings: CheckWarning[]`, `onPrevious()`, `onNext()`, `onWarning(warning)`, `canAccept: boolean`, `canDiscard: boolean`, `onAcceptAll()`, `onDiscard()`, `onContinue()`. Hook: `useT`, `useId` (id del popover degli avvisi). Nessun ref, nessun effetto. `busy = isBusy(status)` (= `generating`).
- DOM: `div.bar` > `button.iconButton.tooltip[type=button][aria-label][data-tooltip][disabled=busy]` (icona `chevronUp`) + lo stesso con `chevronDown` + `StatusText` + `span.spacer` + [con avvisi: `button.secondary.tooltip[aria-label="N warnings"][data-tooltip][popovertarget=id]` (icona `warning` 14 + testo ` N`) + `div#id[popover=auto].warnings` > un `button[type=button]` per avviso (`t('ai.warning.<code>')`, `onWarning(w)`)] + `button.secondary[disabled=!canDiscard]` «Scarta» + `button.secondary.accept[disabled=!canAccept]` «Accetta tutto». `StatusText`: `none` → niente; `generating` → `span.status[aria-live=polite]` «Generating… N s» (+ ` done/total` con progresso); `partial` → `span.status` «Partial — …» + `button.secondary` «Continua»; `truncated` → `span.status`; `scopeLost` → `span.status[role=alert]`; `applied` → `span.status` «Proposal applied» (**mai renderizzato**: la vista torna all'editor semplice prima; la chiave `ai.applied` resta e l'elemento la gestisce come React).
- Chiamante: solo `ReviewView.tsx`, due volte: senza proposta durante la generazione (tutte le callback vuote, `canAccept=false`, `canDiscard=false`) e con il diff (`canAccept = controller.canAccept(p, true)`, `canDiscard = !isBusy(status)`, le callback sul `diff` ref e sul controller).
- Logica pura: `ai/reviewStatus.ts` (`reviewStatus`, `isBusy`; `reviewStatus.test.ts`). Test: e2e `ai-review.spec.ts` (Accetta tutto, Scarta via rifiuto dell'ultimo blocco, popover degli avvisi), `ai-diff.spec.ts`, `ai-chat-log.spec.ts`, `ai-composer.spec.ts`, `visual.spec.ts` «AI review», audit `ai-review`, `ai-review-hover`, `ai-review-conflict`. **Scoperti**: i pulsanti spenti durante la generazione e il contatore in live region, la proposta troncata (Accetta tutto spento), «Continua» con una proposta a parti, l'alert della selezione persa, Scarta dalla barra (il test esistente scarta rifiutando l'ultimo blocco), Precedente/Successivo, la lingua; audit della generazione in corso, degli avvisi aperti, della proposta troncata, dell'editor dopo Accetta tutto.

**`src/ui/ai/ReviewView.tsx`** (169 righe; CSS: `.review`, `.hint`, `.stream pre`, `.editor`; `src/ui/ai/reviewDoc.ts`, 20 righe: l'interfaccia `ReviewDoc`)
- Props: `controller: AiController`, `editor: ReviewDoc` (`path`, `text`, `resetKey`, `session`, `restore`, `readOnly`, `getDocs()`, `saveImage()`, `docChanged(changes, texts)`, `selectionChanged(range)`: oggetto nuovo a ogni render di `WorkspaceView`). Hook: `useT`, `useI18nStore`, `useSyncExternalStore(controller)`, `useRef` (`diff: HmdAiDiffPane`, `plain: HmdEditor`, `section`, `shownView`, `acceptRef`), `useUnmountSignal` (dialog), `useState(elapsed)`, due effetti: `[state.running]` → `setInterval` di 1 s per i secondi (0 senza run); `[view]` → quando la vista cambia e il focus era sul `body` o dentro la sezione, `plain.focus()` o `diff.focus()`.
- Calcoli nel corpo: `p = proposals.get(path)`; `warnings` dell'ultimo messaggio assistant su questo documento; `text = proposalText(p) ?? p.text` (o il documento); `applied = p && p.status !== 'streaming' && text === editor.text`; `status = reviewStatus(…)`; `streaming = !p || generating || scopeLost`; `range` dalla selezione; `view = !p || (applied && status === 'applied') ? 'plain' : 'diff'`; `accept()` (= `beforeAccept(p, true)` → `diff.replace(proposalText(p))`), `edit(next)` (con selezione, solo il tratto: `next.slice(from, len − suffix)`).
- DOM, tre rami: **senza proposta** `section.review` > [`ReviewBar` se generating | `p.hint` «Write a request or pick a suggestion.»] + `div.editor` > `hmd-editor`; **proposta applicata** (`applied && status === 'applied'`) `section.review` > `div.editor` > `hmd-editor`; **diff** `section.review` > `ReviewBar` + [`details.stream` > `summary` + `pre` con `state.streamingPreview`] + `hmd-ai-diff-pane` (`range`, `proposal=text`, `canAccept=controller.canAccept(p)`, `streaming`, `beforeAccept=() => controller.beforeAccept(p)`, `onhmd-ai-proposal-edit` → `edit`, `onhmd-ai-all-rejected` → `discard`). Le stesse `docProps` per editor e diff (`onhmd-doc-change` → `editor.docChanged`, `onhmd-selection` → `editor.selectionChanged`). «Accetta tutto»: se `editor.text === p.baseText || p.scope` accetta subito, altrimenti `showConfirmDialog` («The document changed after this proposal…») e poi `acceptRef.current()` (la proposta dell'ultimo render).
- Chiamante: `WorkspaceView.tsx` (`doc && shownMode === 'ai' && ai`), al posto di `div.panes`. Test: e2e come sopra (`ai-review`, `ai-diff` «Ctrl+Z that brings the diff back leaves the focus in the document», `ai-chat-log`), audit `ai-review*`, `ai-review-empty`. **Scoperti**: il focus dopo Accetta tutto e dopo Scarta (nell'editor, misurato: vedi «Misure»), la conferma a documento cambiato (annulla e conferma), Precedente/Successivo, l'anteprima della risposta in arrivo (`streamingPreview`: raggiungibile solo con una proposta ritoccata a mano e una seconda richiesta; coperto in jsdom), il contatore che si ferma al distacco.

**`src/ui/ai/ReviewView.module.css`** (101 righe): `.review`, `.bar`, `.status`, `.spacer`, `.iconButton` (+`:hover:not(:disabled)`), `.secondary`, `.accept`, `.iconButton:disabled, .secondary:disabled`, `.warnings` (+`button`), `.hint`, `.stream pre`, `.editor`. Si divide in due fogli: `review-bar.css` (barra, stato, pulsanti, avvisi) e `review.css` (sezione, suggerimento, anteprima, contenitore dell'editor). Nessun'altra classe condivisa con altri moduli.

**Chiamate al controller** (da ReviewView.tsx): `subscribe`/`getState`, `proposalText`, `canAccept(p)` e `canAccept(p, true)`, `beforeAccept(p)` e `beforeAccept(p, true)`, `edited`, `discard`, `continue`. L'interfaccia minima della vista è `ReviewController = Pick<AiController, 'subscribe' | 'getState' | 'proposalText' | 'acceptBlocker' | 'canAccept' | 'beforeAccept' | 'edited' | 'discard' | 'continue'>`.

**Catena di contenimento.** Oggi `WorkspaceView` → `ReviewView` → (`ReviewBar`, `hmd-editor` | `hmd-ai-diff-pane`). Con gli elementi: `WorkspaceView` → `hmd-ai-review` → (`hmd-ai-review-bar`, `hmd-editor`, `hmd-ai-diff-pane`): la vista crea i tre figli una volta e li inserisce o toglie secondo il ramo; verso `WorkspaceView` non sale nessun evento nuovo (`hmd-doc-change` e `hmd-selection` di editor e diff li ascolta la vista sui figli e li gira a `doc.docChanged`/`doc.selectionChanged`, come faceva ReviewView con le prop). Controller (`ReviewController`), `doc` e `i18n` scendono come proprietà.

### Divisione

La 6c è il sottoalbero chiuso della revisione: due componenti, un modulo CSS condiviso, un chiamante esterno (`WorkspaceView`). **Dal fondo**: prima la barra (Task 3), montata da `ReviewView.tsx` al posto di `ReviewBar`, poi la vista (Task 4), montata da `WorkspaceView.tsx`. Così la barra ha un genitore React finché non arriva la vista, e la vista non ospita mai un componente React. Il cambio «mai disabled» tocca la barra: il Task 3 si divide in **prima parte identica a React** (`disabled` come oggi, audit verde contro la baseline del Task 1) e **seconda parte con il cambio** (nota, niente `disabled`, baseline ricostruita). Le ragioni dal controller (Task 2) stanno **prima** della barra perché `acceptBlocker()` serve alla seconda parte della barra e `sendBlocker()` al composer: un task sul controller e sul composer, senza toccare la revisione.

Passi intermedi (l'app funziona dopo ognuno):

- **dopo il Task 2** (ragioni dal controller): `AiController` espone `sendBlocker()` e `acceptBlocker(p, all)` (`canAccept` ne deriva); `hmd-ai-composer` legge `sendBlocker()` prima di svuotare la casella e scrive tre note nuove; `ReviewView.tsx` e `ReviewBar.tsx` invariati.
- **dopo la prima parte del Task 3** (`hmd-ai-review-bar` identico): `ReviewView.tsx` monta `<hmd-ai-review-bar status warnings canAccept canDiscard i18n onhmd-ai-review-action onhmd-ai-review-warning />` nei due punti; `ReviewBar.tsx` cancellato; audit verde contro la baseline del Task 1.
- **dopo la seconda parte del Task 3** (mai `disabled`): la barra riceve `acceptBlocker` al posto di `canAccept`/`canDiscard`, ha la nota, l'host con il bordo; `ReviewView.tsx` passa `controller.acceptBlocker(p, true)`; `dist-baseline/` ricostruita; e2e del Task 1 riscritte nella forma nuova.
- **dopo il Task 4** (`hmd-ai-review`): `WorkspaceView.tsx` monta `<hmd-ai-review controller doc i18n />`; `ReviewView.tsx`, `ReviewView.module.css`, `reviewDoc.ts` cancellati; il focus di Scarta/Accetta tutto/Continua su un bersaglio stabile (decisione 4); `jsx.d.ts` perde `hmd-ai-diff-pane` e `hmd-ai-review-bar` (React non li monta più) e guadagna `hmd-ai-review`.

Ordine della 6c: rete (Task 1) → ragioni dal controller (Task 2) → barra, prima e seconda parte (Task 3) → vista (Task 4) → documenti e chiusura (Task 5). Le sub-issue LAB-9 (Task 1), LAB-10 (Task 2), LAB-11 (Task 3), LAB-12 (Task 4), LAB-13 (Task 5) corrispondono una a una.

### Decisioni (confermate dal PM su LAB-8 salvo nota; tra parentesi la raccomandazione)

1. **Ordine e divisione come sopra** (sì): ragioni dal controller prima della barra (la seconda parte della barra usa `acceptBlocker`), barra prima della vista, un elemento per task, il cambio d'aspetto isolato nella seconda parte del Task 3.
2. **Ragioni dal controller con due metodi sincroni** (sì, raccomandazione del PM confermata dal design): `sendBlocker(): 'running' | 'noDocument' | 'updating' | null` (la guardia di `send()`, letta dal composer **prima** di svuotare la casella; `send()` tiene la guardia e resta silenzioso) e `acceptBlocker(p, all): 'generating' | 'updating' | 'notAcceptable' | 'conflict' | 'scopeLost' | 'truncated' | null` (`canAccept(p, all) = acceptBlocker(p, all) === null`, nell'ordine della barra). Codici, non chiavi i18n: il controller non conosce le chiavi (come `AiErrorCode` → `ai.error.<code>`); le mappe `ai.review.<codice>` e `CONTROLLER_NOTES` stanno nei moduli di vista. Il profilo mancante resta al composer (`needProfile`), che lo sa già. **Alternativa scartata**: `send()` che restituisce la ragione in una Promise si risolve a fine generazione (dopo `await this.execute(…)`), troppo tardi per non svuotare la casella; e un `send()` che restituisce subito una ragione e poi continua in sottofondo cambia il contratto dei chiamanti (`.catch(report)`) per niente. **Trovato nel prototipo**: «suggerimento cliccato durante una generazione» (handover, punto 2) non è raggiungibile dall'interfaccia (`suggestionPresets` nasconde i suggerimenti con `running` o con messaggi in chat); la ragione `running` vale per **Invio da tastiera** durante la generazione (`composerAction` restituisce `send` anche con `running`), che oggi tace. Il test del Task 1 afferma anche l'assenza dei suggerimenti.
3. **Barra: pulsanti mai disattivati, una nota per la barra** (sì, variante A di Designer): `p.note[role=status]` figlia di `hmd-ai-review-bar`, sorella di `.bar`, sotto la riga dei pulsanti e **dentro** il bordo inferiore (spostato da `.bar` all'host, che diventa `display: block`); stile delle note 6b (`margin: 0; color: var(--c-muted); font-size: 12px; padding-inline: 12px`, `padding-block: 0 8px` solo se non vuota); vuota = 0 px. Aspetto dei pulsanti identico in ogni stato (via le regole `:disabled` e il `:not(:disabled)` dell'hover). Chiavi `ai.review.*`, priorità generazione → aggiornamento → conflitto → selezione persa → troncata → riserva (`notAcceptable`, per i rami del controller che la vista non raggiunge: documento diverso o nessun documento). Scarta durante la generazione: nota, non Ferma+scarta (comportamento di oggi; Ferma+scarta in fase 8). Lo span di stato resta com'è (contatore in live region → rilievo per A11y in fase 8). **Continua** non ha nota (oggi non si disattiva; il controller lo ignora in silenzio durante un aggiornamento: raro, da rivedere in fase 8 con la regola estesa). **La nota non usa il font pixel della barra**: sta fuori da `.bar`, come le note 6b (font dell'app); la proposta di Designer non lo fissa, si raccomanda così per coerenza con le altre note.
4. **Focus su un bersaglio stabile quando il nodo che lo ha sparisce** (sì): la vista recupera il focus con `RenderLoop` (`focusScope` = la sezione, `refocus` = l'editor della vista mostrata) **più** la regola intera dell'effetto `[view]` di ReviewView.tsx: a ogni cambio di vista (diff ↔ editor semplice) con il focus sul `body` **o dentro la sezione** il focus va nell'editor nuovo, anche se il nodo con il focus sopravvive (rilievo di Reviewer: generazione senza proposta, focus su Accetta tutto, arriva la proposta: React sposta il focus nel diff, la prima stesura della vista lo lasciava sul pulsante; il comportamento di oggi si conserva, un cambio andrebbe deciso con Designer e A11y fuori da questa fase); la barra recupera su Accetta tutto (Continua che sparisce dopo il clic, il pulsante degli avvisi senza avvisi). **Il difetto «focus perso da Scarta dopo Accetta tutto completo» non si riproduce** (vedi «Misure»: 11 scenari in produzione e in sviluppo, focus sempre nell'editor): il Task 1 afferma il comportamento di oggi (focus nell'editor dopo Scarta, dopo Accetta tutto, dopo Ctrl+Z), e l'elemento lo mantiene per costruzione; il test jsdom del Task 4 «Discard with the focus on the button…» fallisce senza `refocus` (RED per costruzione). Resta a Davide una verifica a mano in Chrome (sub-issue LAB-38, già aperta): se il difetto si vede solo con la scheda nascosta o con lo screen reader, lo stesso recupero lo copre. **Riprodotto in jsdom** (Task 4): con il focus sul pulsante Scarta che sparisce, la vista senza `refocus` lascia il focus sul `body` (test «Discard with the focus on the button…», RED misurato nel prototipo con la riga tolta).
5. **Ingressi e uscite** (sì): `hmd-ai-review-bar` riceve `status`, `warnings`, `canAccept`, `canDiscard` (prima parte) → `status`, `warnings`, `acceptBlocker` (seconda parte), `i18n`; manda `hmd-ai-review-action { action: 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue' }` (**un** evento con il discriminante, come `hmd-tree-action`, invece di cinque) e `hmd-ai-review-warning { warning }`. `hmd-ai-review` riceve `controller` (`ReviewController`), `doc` (`ReviewDoc`, spostata da `ui/ai/reviewDoc.ts` a `elements/ai/reviewView.ts`), `i18n`; non manda eventi. `beforeAccept` del diff è una funzione stabile che legge la proposta del momento (come la closure di React, che la rileggeva a ogni render).
6. **Il contatore dei secondi e la conferma vivono con l'elemento** (sì): `setInterval` fermato in `disconnectedCallback` (non al `reconnect()`, che lo ricreerebbe comunque dal `watch`); `showConfirmDialog` con un `AbortController` dei dialog interrotto al distacco (non il `signal` di `connect`, che si interrompe anche a un cambio di store).
7. **Sentinella e2e** (sì, Task 1): i 14 `expect(acceptAll).toBeEnabled()` usati come «proposta arrivata» (elenco nello Step 2 del Task 1) diventano `proposalShown(app)` = diff visibile; `ai-composer.spec.ts` e `ai-chat-log.spec.ts` perdono la costante `acceptAll` se resta senza usi.
8. **Il finto Ollama impara `finishReason`** (sì, Task 1): `finish_reason: 'length'` produce una proposta **troncata** (stato «Truncated», Accetta tutto spento oggi) senza dover interrompere uno stream (che `route.fulfill` non sa fare a metà): serve all'e2e e allo stato di audit `ai-review-truncated` del Task 1 e alla nota `ai.review.truncated` della seconda parte del Task 3.
9. **`jsx.d.ts` dice solo quello che React monta** (sì): il Task 3 aggiunge `hmd-ai-review-bar`, il Task 4 lo toglie insieme a `hmd-ai-diff-pane` e aggiunge `hmd-ai-review`. Restano `hmd-ai-model-select`, `hmd-ai-parameters`, `hmd-ai-sidebar`, `hmd-editor`, `hmd-preview` e gli altri che `WorkspaceView` e le impostazioni montano. Il file sparisce nella fase 7.
10. **Layer `vendor` per CodeMirror: no, in fase 8 si tolgono i tre `!important` con uno `StyleModule`** (analisi sotto, nessun intervento qui).

### Analisi del layer `vendor` per gli stili di CodeMirror (per la fase 8, nessun intervento in 6c)

- **Da dove vengono gli stili che i tre `!important` di `diff-pane.css` combattono.** `@codemirror/merge` registra `externalTheme = EditorView.styleModule.of(new StyleModule({ '.cm-merge-revert button': { position: 'absolute', background: 'none', cursor: 'pointer', … } }))`: selettori **non prefissati** (non `.ͼN …` come i temi), perché i controlli stanno fuori dagli editor. `EditorView.mountStyles()` monta tutti i moduli (`this.styleModules.concat(baseTheme).reverse()`) con `StyleModule.mount(document, …)` (style-mod 4): con un `Document` che ha `head`, un unico `<style>` inserito come **primo figlio di `<head>`**, riscritto (`textContent`) a ogni cambio di moduli; `adoptedStyleSheets` solo per una ShadowRoot. Nessuna opzione per un `@layer`.
- **Perché serve `!important`.** Una dichiarazione normale fuori dai layer vince su ogni dichiarazione normale dentro un layer, qualunque sia la specificità; una dichiarazione `!important` dentro un layer vince su quelle normali fuori dai layer. Quindi `position: static`, `background` dell'hover e `cursor: default` del disabled sono `!important` (le altre proprietà, non dichiarate da CodeMirror, non ne hanno bisogno).
- **Un layer `vendor` è fattibile?** Solo se il CSS di CodeMirror sta dentro `@layer vendor`. Tre strade: (a) riscrivere il `<style>` montato da style-mod (`@layer vendor { … }` intorno al testo): fragile, CodeMirror lo riscrive a ogni `mountStyles()` (riconfigurazioni, nuovi editor) e non c'è un gancio; (b) `root.adoptedStyleSheets`: style-mod lo usa solo per una ShadowRoot (scartato dalla spec §4); (c) dichiarare `@layer reset, base, vendor, components, overrides;` in `global.css` senza metterci niente: inutile, le regole di CodeMirror resterebbero fuori dai layer. **Impatto se si facesse comunque**: `LAYERS` in `src/styles/buildCss.test.ts`, la dichiarazione in `global.css` e in `src/styles/fixtures/scope/probe.css` (`layerOrder` legge l'ordine di prima comparsa); `architecture.test.ts` non cambia (controlla solo i fogli di `src/elements/`). Verdetto: **non fattibile senza riscrivere il tag di CodeMirror; non raccomandato**.
- **Strada raccomandata per la fase 8**: le tre regole dei pulsanti del merge diventano uno `StyleModule` dell'app registrato come fa `@codemirror/merge` (`EditorView.styleModule.of(new StyleModule({ '.cm-merge-revert > .revert > button': {…}, '…:hover:not(:disabled)': {…}, '…:disabled': {…} }))`, in `src/editor/docExtensions.ts` accanto a `docAppearance()`, passato nelle estensioni di `a` dalla MergeView): stessa origine (fuori dai layer, stesso `<style>`), specificità maggiore (`(0,2,1)` contro `(0,1,1)`), quindi vince **senza** `!important`; le proprietà di solo aspetto (`padding`, `border-radius`, `color`) possono restare nel foglio `@scope`. Costo: tre regole che passano da CSS a JS (precedente: `docAppearance()`), audit prima/dopo invariato. Da rivedere nello stesso giro il quarto `!important` del progetto, `backgroundColor … !important` di `.cm-activeLine` in `docAppearance()` (lì due temi `.ͼN` a pari specificità: basta l'ordine, `Prec`). Se Davide preferisce tenere il CSS nel foglio: restano i tre `!important`, documentati nel commento che già c'è.

## Review Focus

1. **Nessun pulsante della barra si disattiva mai e la nota dice il perché giusto**: generazione (tutti e quattro), aggiornamento, conflitto, selezione persa, troncata, riserva (Accetta tutto); il focus resta sul pulsante; la nota se ne va quando la causa sparisce, quando un'azione riesce, quando la barra sparisce; la stessa nota due volte non si ri-annuncia (accettato). Test jsdom della seconda parte del Task 3 («while generating nothing is disabled…», «the note goes when its cause goes…», «Accept all says the reason of the controller…», «detached and attached again the note is forgotten») + `ai-review-bar.spec.ts` («while generating nothing is disabled…», «a truncated proposal: Accept all says…») + `reviewBarView.test.ts` + audit `ai-review-note`.
2. **Ragioni dal controller, bozza conservata**: senza documento, durante un aggiornamento, durante una generazione (Invio) l'invio non parte, la casella non si svuota, la nota lo dice e si svuota quando la causa sparisce **senza altre azioni dell'utente** (`cancel()` e un documento aperto notificano: test con il controller vero); l'ordine generazione → documento → aggiornamento → profilo → testo; `send()` resta la stessa guardia; `acceptBlocker` nell'ordine della barra e `canAccept` identico a prima. Test del Task 2: `aiController.test.ts` («sendBlocker: …», «acceptBlocker: una ragione per volta…», «acceptBlocker: la selezione persa…»), `composerView.test.ts`, `composer.dom.test.ts` («without a document Send says so…», «during an update…», «a suggestion (or Enter) during a generation…», «the order of the reasons…»), `ai-review-bar.spec.ts` («with no document open, Send says so…», «Enter in the composer during a generation says so…»), audit `ai-composer-note-no-document`.
3. **Il focus tra diff ed editor semplice e dentro la barra**: Accetta tutto, Scarta, Ctrl+Z, Continua, la chiusura del popover degli avvisi, la conferma annullata; la proposta che arriva con il focus su un pulsante della barra (focus nel diff, come React); mai sul `body`, anche in sviluppo con StrictMode. Test jsdom del Task 4 («Discard with the focus on the button…», «a view change with the focus already on the body…», «generation finishes with the focus in the retained bar…») e della barra («the focused Continue removed…») + `ai-review-bar.spec.ts` (i tre test del focus) + `ai-diff.spec.ts` («Ctrl+Z that brings the diff back…»).
4. **La vista non ricrea mai editor e diff e passa le proprietà prima dell'inserimento**: `resetKey`, `session`, `restore`, `readOnly` arrivano all'editor nuovo prima che entri nel DOM; nessun nodo già al suo posto viene spostato; l'anteprima della risposta in arrivo entra e esce tra barra e diff; il contatore si ferma al distacco; il dialog si chiude al distacco e accetta la proposta del momento. Test jsdom del Task 4 («without a proposal: the same DOM…», «with a proposal: the bar and the diff…», «Accept all after the document changed: the confirmation dialog…», «the seconds counter stops at detach…») + `ai-review.spec.ts` esistente.
5. **Aspetto identico negli stati che oggi nessuno fotografa**: generazione senza proposta (barra con il contatore), proposta troncata, popover degli avvisi aperto, editor dopo Accetta tutto; poi le due note. Stati di audit del Task 1 (`ai-review-generating`, `ai-review-truncated`, `ai-review-warnings`, `ai-review-applied`), verdi contro `dist-baseline/` nella prima parte del Task 3 e nel Task 4, più `ai-review-note` e `ai-composer-note-no-document` dopo le baseline ricostruite.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/ai-review-bar.spec.ts`, `e2e/support/aiHarness.ts` (`finishReason`), `e2e/computed-styles.audit.ts` (4 stati nuovi), `e2e/ai-review.spec.ts`, `ai-diff.spec.ts`, `ai-composer.spec.ts`, `ai-chat-log.spec.ts`, `visual.spec.ts` (sentinella) | Rete di sicurezza (Task 1): comportamento di oggi della barra e della vista, proposta troncata, sentinella «proposta arrivata». |
| `src/ai/aiController.ts` (+ `aiController.test.ts`) | `SendBlocker`, `AcceptBlocker`, `sendBlocker()`, `acceptBlocker()`, `canAccept` derivata (Task 2). |
| `src/elements/ai/composerView.ts` (+ test), `composer.element.ts` (+ `.dom.test.ts`), `src/testing/fakeAi.ts`, `src/i18n/locales/*.json` | Ragioni dal controller nel composer, tre chiavi nuove, controller finto con `sendBlocker`/`acceptBlocker`/`beforeAccept`/`proposalText`/`edited`/`discard`/`continue` (Task 2). |
| `src/elements/ai/reviewBarView.ts` (+ test) | `ReviewAction`, `ReviewBlocker`, `actionBlocker`, `statusLine` (Task 3). |
| `src/elements/ai/review-bar.element.ts`, `review-bar.css` (+ `.dom.test.ts`) | `hmd-ai-review-bar` (Task 3: prima parte identica, seconda parte con la nota). |
| `src/elements/ai/reviewView.ts` (+ test) | `ReviewDoc`, `ReviewController`, `reviewModel`, `elapsedSeconds`, `editedProposal`, `acceptNeedsConfirm` (Task 4). |
| `src/elements/ai/review.element.ts`, `review.css` (+ `.dom.test.ts`) | `hmd-ai-review` (Task 4). |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi (`hmd-ai-review-action`, `hmd-ai-review-warning`), tipi JSX. |
| `src/ui/ai/ReviewView.tsx` (Task 3: monta la barra), `src/ui/WorkspaceView.tsx` (Task 4: monta la vista) | Chiamanti. |
| `src/ui/ai/ReviewBar.tsx` (Task 3), `ReviewView.tsx`, `ReviewView.module.css`, `reviewDoc.ts` (Task 4) | Cancellati. |
| `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `docs/superpowers/notes/2026-10-xx-handover-fase-7.md` | Stato, §7 «6c fatta», §2 vincolo 4, §13; handover della fase 7 (Task 5). |

---

### Task 1: Rete di sicurezza e baseline sulla revisione React di oggi (LAB-9)

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**, compresi i difetti noti nella forma attuale (pulsanti `disabled`, casella svuotata senza documento, Invio muto durante la generazione), che i task dopo rovesciano.

**Files:**
- Create: `e2e/ai-review-bar.spec.ts`
- Modify: `e2e/support/aiHarness.ts` (`finishReason`), `e2e/computed-styles.audit.ts` (4 stati nuovi, sentinella), `e2e/ai-review.spec.ts`, `e2e/ai-diff.spec.ts`, `e2e/ai-composer.spec.ts`, `e2e/ai-chat-log.spec.ts`, `e2e/visual.spec.ts` (sentinella)

**Interfaces:**
- Produces: `FakeModel.finishReason: 'stop' | 'length'`; `proposalShown(app)` in ogni spec che aspetta la proposta; i test «while generating, Previous, Next, Discard and Accept all are disabled…», «a truncated proposal: Accept all is disabled…», «with no document open, Send empties the box…», «Enter in the composer during a generation sends nothing and says nothing (today)…» (riscritti dalla seconda parte del Task 3 e dal Task 2); gli stati di audit `ai-review-generating`, `ai-review-truncated`, `ai-review-warnings`, `ai-review-applied`.

- [ ] **Step 1: Baseline e build di riferimento da `main`**

```bash
cd <worktree del branch lab/LAB-4-fase-6c>
git status --short && git log --oneline -1       # pulito, sul branch lab/LAB-4-fase-6c (da epic/LAB-3-web-components = 0ba9ccb) dopo il commit del piano
npm test                                          # annotare (11/10: 934)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (11/10 nel prototipo: 439 717; handover: 439 695)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: main prima della 6c
```

`dist-baseline/` resta fino alla seconda parte del Task 3: **non ricostruirla prima**.

- [ ] **Step 2: La sentinella «proposta arrivata» non è più «Accetta tutto attivo»**

Oggi 14 punti aspettano la proposta con `toBeEnabled()` su Accetta tutto; con i pulsanti mai disattivati (seconda parte del Task 3) passerebbero subito, prima della proposta, e i clic seguenti arriverebbero durante la generazione. Elenco (`git grep -n "toBeEnabled()" -- e2e` su `main`, tolte le righe su Invia e Nuova chat, che restano):

```text
e2e/ai-composer.spec.ts:29:    await expect(send(app)).toBeEnabled();
e2e/ai-composer.spec.ts:38:    await expect(send(app)).toBeEnabled();
e2e/ai-composer.spec.ts:47:    await expect(send(app)).toBeEnabled();
e2e/ai-composer.spec.ts:86:    await expect(send(app)).toBeEnabled();
e2e/ai-composer.spec.ts:174:    await expect(newChat(app)).toBeEnabled();
e2e/computed-styles.audit.ts:352:      await expect(page.getByRole('button', { name: app.t('ai.send'), exact: true })).toBeEnabled();
```

In `e2e/ai-review.spec.ts`, `ai-diff.spec.ts`, `ai-composer.spec.ts`, `ai-chat-log.spec.ts`: ogni `await expect(acceptAll(app)).toBeEnabled();` diventa `await proposalShown(app);`, con, accanto alle costanti del file (dopo `mergeView` dove c'è, altrimenti dopo `acceptAll`):

```ts
/** La proposta è arrivata: il diff è visibile. Non «Accetta tutto attivo»: con i pulsanti mai disattivati (6c) passerebbe subito. */
const proposalShown = (app: App) => expect(mergeView(app)).toBeVisible();   // o app.page.locator('.cm-mergeView') dove mergeView non c'è
```

In `ai-composer.spec.ts` e `ai-chat-log.spec.ts` la costante `acceptAll` resta senza usi: si toglie. In `e2e/visual.spec.ts` («AI review») e in `e2e/computed-styles.audit.ts` (`ai-review`, `ai-review-conflict`, `ai-chat-summary`) la riga in linea diventa `await expect(page.locator('.cm-mergeView')).toBeVisible(); // la proposta è arrivata (non «Accetta tutto attivo»: dalla 6c passerebbe subito)`. Il `.cm-mergeView` è un'eccezione ammessa (spec §8.4). Dopo: `git grep -n "toBeEnabled()" -- e2e` mostra solo Invia, Nuova chat e la riga del Task 1 che afferma i pulsanti della barra di oggi.

- [ ] **Step 3: Il finto Ollama sa chiudere con `length`**

In `e2e/support/aiHarness.ts`, prima di `models = […]`:

```ts
  /** Motivo di fine della risposta: `length` = uscita troncata dal limite del modello (proposta «troncata»). */
  finishReason: 'stop' | 'length' = 'stop';
```

e nell'evento SSE `finish_reason: 'stop'` → `finish_reason: this.finishReason`. (`stopReason('length')` dei provider → `truncated: true` del runner → proposta `truncated`: stato «Truncated — accept individual changes only», Accetta tutto spento oggi. Interrompere uno stream a metà non si può con `route.fulfill`: con `hold()` + Stop non arriva nessun testo e la proposta non c'è.)

- [ ] **Step 4: E2e della barra e della vista scoperte oggi**

`e2e/ai-review-bar.spec.ts` (il test «Previous and Next…» legge `.cm-activeLine` di CodeMirror, che segue il cursore anche senza il focus nell'editor: con il focus sul pulsante la selezione del DOM non si aggiorna):

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const send = (app: App) => app.page.getByRole('button', { name: app.t('ai.send'), exact: true });
const stop = (app: App) => app.page.getByRole('button', { name: app.t('ai.stop'), exact: true });
const previous = (app: App) => app.page.getByRole('button', { name: app.t('ai.previous') });
const next = (app: App) => app.page.getByRole('button', { name: app.t('ai.next') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const discard = (app: App) => app.page.getByRole('button', { name: app.t('ai.discard'), exact: true });
// .cm-mergeView e .cm-content: eccezioni ammesse dalla spec (§8.4).
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const documentSide = (app: App) => mergeView(app).locator('.cm-content').first();
/** L'editor semplice della revisione (senza diff): l'unico .cm-content nella pagina. */
const plainEditor = (app: App) => app.page.locator('.cm-content');
/** La proposta è arrivata: il diff è visibile. Non «Accetta tutto attivo»: con i pulsanti mai disattivati (6c) passerebbe subito. */
const proposalShown = (app: App) => expect(mergeView(app)).toBeVisible();

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

test.describe('review bar', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('while generating, Previous, Next, Discard and Accept all are disabled and the counter is a polite live region; with the proposal they are enabled', async ({ app, ai, page }) => {
    await page.clock.install();
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    const counter = page.getByText(app.t('ai.generating', { seconds: 0 }).replace(/0 s$/, ''), { exact: false });
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAttribute('aria-live', 'polite');
    await expect(previous(app)).toBeDisabled();
    await expect(next(app)).toBeDisabled();
    await expect(discard(app)).toBeDisabled();
    await expect(acceptAll(app)).toBeDisabled();
    await page.clock.runFor(2100);
    await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
    ai.release();
    await proposalShown(app);
    await expect(counter).toHaveCount(0);
    for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) await expect(button).toBeEnabled();
  });

  test('a truncated proposal: Accept all is disabled, Discard and the block buttons work (today)', async ({ app, ai, page }) => {
    ai.finishReason = 'length';
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await expect(page.getByText(app.t('ai.status.truncated'))).toBeVisible();
    await expect(acceptAll(app)).toBeDisabled();
    await expect(discard(app)).toBeEnabled();
    await expect(page.locator('.cm-merge-revert button[data-action=accept]').first()).toBeEnabled();
    await discard(app).click();
    await expect(mergeView(app)).toHaveCount(0);
  });

  test('Accept all with the focus on the button: the proposal is applied and the focus is in the editor; Ctrl+Z brings the diff back with the focus in it', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await acceptAll(app).focus();
    await page.keyboard.press('Enter');
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await proposalShown(app);
    await expect(documentSide(app)).toBeFocused();
  });

  test('Discard after a complete Accept all and Ctrl+Z: the proposal goes, the hint comes back and the focus is in the editor', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await proposalShown(app);
    await discard(app).focus();
    await page.keyboard.press('Enter');
    await expect(mergeView(app)).toHaveCount(0);
    await expect(page.getByText(app.t('ai.emptyProposal'))).toBeVisible();
    await expect(plainEditor(app)).toBeFocused();
  });

  test('Discard straight away keeps the document and leaves the focus in the editor', async ({ app }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await discard(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toBeFocused();
    await expect(plainEditor(app)).toHaveText('ABC');
  });

  test('Accept all after editing the document asks for confirmation: cancelled keeps the diff and the focus on the button, confirmed applies', async ({ app, page }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await documentSide(app).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('!');
    await acceptAll(app).click();
    const dialog = page.getByRole('dialog', { name: app.t('ai.acceptAll') });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(app.t('ai.changedWarning'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(dialog).toHaveCount(0);
    await proposalShown(app);
    await expect(acceptAll(app)).toBeFocused();
    await acceptAll(app).click();
    await dialog.getByRole('button', { name: app.t('ai.acceptAll') }).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(plainEditor(app)).toHaveText('A2BC2');
  });

  test('Previous and Next move the cursor between the changes of the document side', async ({ app }) => {
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    // La riga attiva di CodeMirror (basicSetup) segue il cursore anche senza il focus nell'editor: .cm-line è un'eccezione ammessa (§8.4).
    const lines = documentSide(app).locator('.cm-line');
    await next(app).click();
    await expect(lines.nth(4)).toHaveClass(/cm-activeLine/);
    await previous(app).click();
    await expect(lines.nth(0)).toHaveClass(/cm-activeLine/);
  });

  test('the bar follows the interface language', async ({ app, page }) => {
    const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await page.getByLabel(app.t('settings.language')).selectOption('it');
    await page.getByRole('button', { name: it('settings.close') }).click();
    await expect(page.getByRole('button', { name: it('ai.previous') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.next') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.discard'), exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.acceptAll'), exact: true })).toBeVisible();
  });
});

test.describe('composer without a document', () => {
  test('with no document open, Send empties the box and nothing is sent (today: no note, the draft is lost)', async ({ app, ai }) => {
    await app.openFolder({ 'a.md': 'A' });
    await enterAi(app);
    await composer(app).fill('fix');
    await send(app).click();
    await expect(composer(app)).toHaveValue('');
    await expect(app.page.getByRole('status').filter({ hasText: app.t('ai.composer.needText') })).toHaveCount(0);
    expect(ai.requests).toBe(0);
  });

  test('Enter in the composer during a generation sends nothing and says nothing (today); the suggestions are not there', async ({ app, ai, page }) => {
    ai.hold();
    await app.openFolder({ 'a.md': 'A' });
    await app.openFile('a.md');
    await enterAi(app);
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await expect(page.getByRole('group', { name: app.t('ai.suggestions') })).toHaveCount(0);
    const spoken = () => page.getByRole('status').evaluateAll((nodes) => nodes.map((n) => n.textContent?.trim() ?? ''));
    const before = await spoken();
    await composer(app).fill('again');
    await composer(app).press('Enter');
    await page.waitForTimeout(200);
    expect(await spoken()).toEqual(before);
    await expect(composer(app)).toHaveValue('again');
    expect(ai.requests).toBe(1);
    ai.release();
  });
});
```

- [ ] **Step 5: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, dopo lo stato `ai-review-conflict` (il contatore parte dal `Date.now()` della richiesta, non da `NOW`: `runFor(2100)` da lì e poi l'orologio fermo appena oltre il valore raggiunto; `pauseAt(NOW + 2100)` dava «1 s» o «0 s» secondo quanto ci mette l'avvio, e `pauseAt(Date.now())` «Cannot fast-forward to the past», misurati):

```ts
  {
    name: 'ai-review-generating',
    async setup(app, page, ai) {
      // Generazione senza ancora una proposta: la barra con il contatore al posto del suggerimento, tutti i pulsanti spenti.
      await page.clock.install({ time: NOW });
      ai.hold();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
      // Il contatore parte dal Date.now() della richiesta, non da NOW: si avanza di 2,1 s da lì e si ferma l'orologio sul valore raggiunto.
      await page.clock.runFor(2100);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
      await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
    },
  },
  {
    name: 'ai-review-truncated',
    async setup(app, page, ai) {
      // Proposta troncata dal limite del modello: stato «Troncata», Accetta tutto spento, Scarta acceso.
      ai.reply = 'A2\n\nB\n\nC2';
      ai.finishReason = 'length';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByText(app.t('ai.status.truncated'))).toBeVisible();
    },
  },
  {
    name: 'ai-review-warnings',
    async setup(app, page, ai) {
      // Il popover degli avvisi aperto sotto il suo pulsante.
      ai.reply = 'See [[Other]]';
      await app.openFolder({ 'a.md': 'See [[Target]]' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await page.getByRole('button', { name: app.t('ai.warningsCount', { count: 1 }) }).click();
      await expect(page.getByRole('button', { name: app.t('ai.warning.wikilinks') })).toBeVisible();
    },
  },
  {
    name: 'ai-review-applied',
    async setup(app, page, ai) {
      // Dopo «Accetta tutto»: editor semplice senza barra né suggerimento, con il focus nel testo.
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.locator('.cm-mergeView')).toBeVisible();
      await page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true }).click();
      await expect(page.locator('.cm-mergeView')).toHaveCount(0);
      await expect(page.locator('.cm-content')).toBeFocused();
    },
  },
```

- [ ] **Step 6: Suite verdi sull'app di oggi**

```bash
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts --repeat-each=3   # 30/30
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e        # annotare: 176 + 10 = 186 (2 snapshot dello start screen cadono su ape per il font pixel: estraneo, vedi «Misure»)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev    # annotare: 161 + 10 = 171
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit  # annotare: 104 + 8 = 112 (due test per stato)
pgrep -af "vite|chrom|playwright"   # niente di proprio appeso
```

Expected: tutto verde tranne i 2 snapshot dello start screen (estranei). Nel prototipo con due worker «a sync folder without permission…» è caduta una volta sotto carico e 3/3 da sola: con un solo worker non è più ammesso chiamarla carico.

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete sulla barra e sulla vista della revisione AI (pulsanti spenti, troncata, focus, stati di audit) e sentinella della proposta prima della 6c"
```

---
### Task 2: Ragioni dal controller, note nel composer, bozza conservata (LAB-10)

`AiController` dice **perché** un invio o un'accettazione non può partire, con due metodi **sincroni** (decisione 2): `sendBlocker()` è la guardia di `send()` letta prima; `acceptBlocker(p, all)` è `canAccept` scomposto nelle sue cause, nell'ordine della barra. `prepare()`, `cancel()` e `documentChanged(…, reset = true)` notificano gli iscritti, così la nota si svuota al render quando la causa sparisce. Il composer legge `sendBlocker()` prima di svuotare la casella: senza documento, durante un aggiornamento o durante una generazione (Invio da tastiera, perché i suggerimenti non ci sono con `running`) la nota sotto il composer dice perché e la bozza resta. Tutte le **nove chiavi** nuove entrano qui, in tutti i locali, per non toccare i locali due volte (le sei `ai.review.*` le usa la seconda parte del Task 3). `ReviewView.tsx` e `ReviewBar.tsx` non cambiano.

**Files:**
- Modify: `src/ai/aiController.ts`, `src/ai/aiController.test.ts`, `src/elements/ai/composerView.ts`, `composerView.test.ts`, `composer.element.ts`, `composer.dom.test.ts`, `src/testing/fakeAi.ts`, `src/i18n/locales/*.json` (nove chiavi), `e2e/ai-review-bar.spec.ts` (i due test del composer nella forma nuova), `e2e/computed-styles.audit.ts` (stato `ai-composer-note-no-document`)

**Interfaces:**
- Produces: `prepare()`, `cancel()`, `documentChanged(…, reset = true)` che notificano (`this.set({})`); `type SendBlocker = 'running' | 'noDocument' | 'updating'`, `type AcceptBlocker = 'generating' | 'updating' | 'notAcceptable' | 'conflict' | 'scopeLost' | 'truncated'`, `AiController.sendBlocker(): SendBlocker | null`, `AiController.acceptBlocker(p, all = false): AcceptBlocker | null`, `canAccept(p, all) = acceptBlocker(p, all) === null`; `ComposerController` con `sendBlocker`; `composerView.ts`: `SendBlocker` (chiavi) esteso a `'ai.composer.generating' | 'ai.composer.noDocument' | 'ai.composer.updating'`, `CONTROLLER_NOTES`, `sendBlocker(request, hasProfile, preset, controller = null)`; `fakeAi` con `sendBlocker`/`sendBlockerValue`, `blocker`/`acceptBlocker`/`canAccept`/`beforeAccept`, `proposalText`/`proposalTextValue`, `edited`, `discard`, `continue`, e `proposals: new Map()` e `streamingPreview: null` nello stato di default (servono al Task 4).

- [ ] **Step 1: Test che falliscono**

In fondo a `src/ai/aiController.test.ts` (gli import di `SelectionScope` e `ChangeSet` ci sono già nel file; `untilAbort` e `stateWhen` sono gli aiuti del file):

```ts
test('sendBlocker: generazione in corso, nessun documento, aggiornamento (app o documento); altrimenti null, e send() scarta negli stessi casi', async () => {
  const f = await fixture(async function* (_req, signal) { yield { type: 'thinking' }; await untilAbort(signal); });
  assert.equal(f.controller.sendBlocker(), null);
  const running = f.controller.send('Prima'); await stateWhen(f.controller, s => !!s.running);
  assert.equal(f.controller.sendBlocker(), 'running');
  f.controller.stop(); await running;
  assert.equal(f.controller.sendBlocker(), null); const sent = f.controller.getState().chat.messages.length;
  f.world.doc.updating = true; assert.equal(f.controller.sendBlocker(), 'updating'); f.world.doc.updating = false;
  assert.equal(await f.controller.prepare(), 'durable'); assert.equal(f.controller.sendBlocker(), 'updating');
  await f.controller.send('Scartata'); assert.equal(f.controller.getState().chat.messages.length, sent);
  f.controller.cancel(); assert.equal(f.controller.sendBlocker(), null);
  const doc = f.world.doc; (f.world as { doc: typeof doc | null }).doc = null;
  assert.equal(f.controller.sendBlocker(), 'noDocument');
  await f.controller.send('Scartata'); assert.equal(f.controller.getState().chat.messages.length, sent);
  f.world.doc = doc;
});
test('acceptBlocker: una ragione per volta nell\'ordine della barra, e canAccept ne deriva', async () => {
  const f = await fixture(async function* (_req, signal) { yield { type: 'text', text: '<housemd-proposal>Frammento' }; await untilAbort(signal); });
  const running = f.controller.send('Prima'); await stateWhen(f.controller, s => !!s.proposals.size);
  const streaming = f.controller.getState().proposals.get('a.md')!;
  assert.equal(f.controller.acceptBlocker(streaming), 'generating');
  f.controller.stop(); await running;
  const p = f.controller.getState().proposals.get('a.md')!; assert.equal(p.status, 'truncated');
  assert.equal(f.controller.acceptBlocker(p), null); assert.equal(f.controller.canAccept(p), true);
  assert.equal(f.controller.acceptBlocker(p, true), 'truncated'); assert.equal(f.controller.canAccept(p, true), false);
  f.world.doc.conflict = { theirs: 'x' }; assert.equal(f.controller.acceptBlocker(p, true), 'conflict');
  f.world.doc.updating = true; assert.equal(f.controller.acceptBlocker(p, true), 'updating'); f.world.doc.updating = false;
  f.world.doc.conflict = null;
  f.world.doc = { ...f.world.doc, path: 'b.md' }; assert.equal(f.controller.acceptBlocker(p), 'notAcceptable'); assert.equal(f.controller.canAccept(p), false);
  f.world.doc = { ...f.world.doc, path: 'a.md' };
  const doc = f.world.doc; (f.world as { doc: typeof doc | null }).doc = null;
  assert.equal(f.controller.acceptBlocker(p), 'notAcceptable'); f.world.doc = doc;
});
test('acceptBlocker: la selezione persa viene prima della proposta troncata', async () => {
  const scope: SelectionScope = { from: 0, to: 10, originalText: 'Originale ', status: 'valid' };
  const f = await fixture(async function* (_req, signal) { yield { type: 'text', text: '<housemd-proposal>Nuova ' }; await untilAbort(signal); });
  const running = f.controller.send('Prima', undefined, scope); await stateWhen(f.controller, s => !!s.proposals.size);
  f.controller.stop(); await running;
  const p = f.controller.getState().proposals.get('a.md')!; assert.equal(p.status, 'truncated');
  assert.equal(f.controller.acceptBlocker(p, true), 'truncated');
  f.controller.documentChanged('a.md', ChangeSet.of({ from: 0, to: 9, insert: 'Cambiata' }, 'Originale A'.length), false, { before: 'Originale A', after: 'Cambiata A' });
  const lost = f.controller.getState().proposals.get('a.md')!; assert.equal(lost.scope?.status, 'lost');
  assert.equal(f.controller.acceptBlocker(lost, true), 'scopeLost'); assert.equal(f.controller.acceptBlocker(lost), 'scopeLost');
});
test('prepare(), cancel() e un documento aperto (documentChanged con reset) notificano gli iscritti: la nota del composer si svuota al render', async () => {
  const f = await fixture();
  let notified = 0; const off = f.controller.subscribe(() => { notified++; });
  assert.equal(await f.controller.prepare(), 'durable'); assert.equal(notified, 1);
  f.controller.cancel(); assert.equal(notified, 2); assert.equal(f.controller.sendBlocker(), null);
  f.controller.documentChanged('a.md', ChangeSet.empty('Originale A'.length), true); assert.equal(notified, 3);
  off();
});
```

In `src/elements/ai/composerView.test.ts`: l'import diventa `import { CONTROLLER_NOTES, outgoing, selectionChipText, sendBlocker, sendButton } from './composerView';` e in fondo:

```ts
test('a reason of the controller comes before profile and text: generation, no document, update', () => {
  assert.equal(sendBlocker('', false, false, 'running'), 'ai.composer.generating');
  assert.equal(sendBlocker('fix', true, false, 'noDocument'), 'ai.composer.noDocument');
  assert.equal(sendBlocker('fix', true, true, 'updating'), 'ai.composer.updating');
  assert.equal(sendBlocker('fix', true, false, null), null);
  assert.deepEqual(CONTROLLER_NOTES, { running: 'ai.composer.generating', noDocument: 'ai.composer.noDocument', updating: 'ai.composer.updating' });
});
```

In fondo a `src/elements/ai/composer.dom.test.ts` (`mount`, `type`, `key`, `note`, `running`, `defaultProfile` sono gli aiuti già nel file):

```ts
test('without a document Send says so, keeps the draft and the focus; a document opened clears the note', () => {
  const { ai, send, type, note, input } = mount();
  ai.sendBlockerValue = 'noDocument';
  type('draft');
  send().focus();
  send().click();
  assert.deepEqual(ai.calls, []);
  assert.equal(input().value, 'draft');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  assert.equal(document.activeElement, send());
  ai.sendBlockerValue = null;
  ai.set({});
  assert.equal(note().textContent, '');
});

test('during an update Send says so; typing clears the note as for the other notes, and so does the end of the update', () => {
  const { ai, send, type, note } = mount();
  ai.sendBlockerValue = 'updating';
  type('draft');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  type('draft more');
  assert.equal(note().textContent, '');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  ai.sendBlockerValue = null;
  ai.set({});
  assert.equal(note().textContent, '');
});

test('a suggestion (or Enter) during a generation says so, the draft stays, the note goes when the generation ends', () => {
  const { el, ai, key, note, type, input, running } = mount();
  running(true);
  type('draft');
  el.sendPreset('p1');
  assert.deepEqual(ai.calls, []);
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
  assert.equal(input().value, 'draft');
  key('Enter');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
  running(false);
  assert.equal(note().textContent, '');
});

test('the order of the reasons: the controller first (generation, document, update), then the profile, then the text', () => {
  const { ai, send, key, note, running } = mount(false);
  // Durante la generazione il pulsante è Stop: la ragione si vede con Invio.
  running(true);
  key('Enter');
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.generating']);
  running(false);
  ai.sendBlockerValue = 'noDocument';
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  ai.sendBlockerValue = null;
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needProfile']);
  ai.set({ profiles: [defaultProfile('ollama', 'o')], profileId: 'o' });
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.needText']);
});

/** Il controller vero (store in memoria, provider finto mai chiamato) al posto di `fakeAi`: le notifiche arrivano solo da lui. */
async function realController() {
  const world = { doc: { path: 'a.md', textLf: 'uno\ndue\ntre', conflict: null as unknown, updating: false } as { path: string; textLf: string; conflict: unknown; updating: boolean } | null };
  const controller = new AiController(createMemoryAiStores({ writerId: 'test', now: () => 100 }), { getDoc: () => world.doc, snapshotBeforeAi() {}, openFile() {} }, () => ({
    async listModels() { return []; },
    async *stream() { throw new Error('mai chiamato'); },
  }));
  await controller.initialize();
  return { controller, world };
}

test('with the real controller: the updating note goes when cancel() ends the update, the no-document note when a document opens; no other user action', async () => {
  const { controller, world } = await realController();
  const { el, send, type, note, input } = mount();
  el.controller = controller;
  assert.equal(await controller.prepare(), 'durable');
  type('draft');
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.updating']);
  assert.equal(input().value, 'draft');
  controller.cancel();
  assert.equal(controller.sendBlocker(), null);
  assert.equal(note().textContent, '');
  world.doc = null;
  send().click();
  assert.equal(note().textContent, EN_MESSAGES['ai.composer.noDocument']);
  world.doc = { path: 'b.md', textLf: 'B', conflict: null, updating: false };
  // Come WorkspaceView quando apre un documento: documentChanged con reset.
  controller.documentChanged('b.md', ChangeSet.empty(1), true);
  assert.equal(note().textContent, '');
  assert.equal(input().value, 'draft');
});
```

(In cima al file: `import { ChangeSet } from '@codemirror/state';`, `import { AiController } from '../../ai/aiController';`, `import { createMemoryAiStores } from '../../ai/stores';`. Nei quattro test con `fakeAi` qui sopra, `ai.set({})` sta per la notifica che il controller vero manda da `prepare()`/`cancel()`/`documentChanged(reset)`: senza quella notifica la nota non si svuota, ed è questo test con il controller vero a provarlo.)

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/ai/aiController.test.ts src/elements/ai/composerView.test.ts src/elements/ai/composer.dom.test.ts` → i tre test del controller cadono (`sendBlocker is not a function`, `acceptBlocker is not a function`), il quarto cade con `0 !== 1` (nessuna notifica da `prepare()`), quello di `composerView` cade (`CONTROLLER_NOTES` undefined, quattro argomenti), i quattro del composer con `fakeAi` cadono (nessuna nota, `ai.sendBlockerValue` ignorato: la casella si svuota) e quello con il controller vero cade (`sendBlocker is not a function`). Annotare il RED nel commento finale. **Dopo lo Step 5, con il controller senza le notifiche** (Step 4 fatto a metà, solo `sendBlocker`/`acceptBlocker`): il quarto test del controller cade con `0 !== 1` e quello con il controller vero con `'An update is in progress: try again in a moment' !== ''` (misurato nel prototipo): è il RED del rilievo di Reviewer, da vedere e annotare prima di aggiungere le notifiche.

- [ ] **Step 3: Nove chiavi in tutti i locali**

In `src/i18n/locales/en.json`, dopo `"ai.composer.needProfile"`:

```json
  "ai.composer.noDocument": "Open a document before sending",
  "ai.composer.updating": "An update is in progress: try again in a moment",
  "ai.composer.generating": "Generation in progress: wait for it to finish, or press Stop",
```

e dopo `"ai.changedWarning"`:

```json
  "ai.review.generating": "Generation in progress: wait for it to finish, or stop it from the chat",
  "ai.review.updating": "An update is in progress: try again in a moment",
  "ai.review.conflict": "Resolve the file conflict first: reload from disk or overwrite",
  "ai.review.scopeLost": "Nothing can be accepted: the selection was lost. Discard the proposal, or select the text again and retry",
  "ai.review.truncated": "Accept all is not available for a truncated proposal: accept the changes one at a time from the diff",
  "ai.review.notAcceptable": "Nothing can be accepted right now",
```

Negli stessi punti degli altri otto locali (`locales.test.ts` controlla chiavi, stringhe vuote e segnaposto; «Ricarica dal disco», «sovrascrivi», «Ferma» riprendono le parole di `conflict.reload`, `conflict.overwrite`, `ai.stop` di ogni lingua):

```json
it:
  "ai.composer.noDocument": "Apri un documento prima di inviare",
  "ai.composer.updating": "Aggiornamento in corso: riprova tra un momento",
  "ai.composer.generating": "Generazione in corso: aspetta che finisca, oppure premi Ferma",
  "ai.review.generating": "Generazione in corso: aspetta che finisca, oppure fermala dalla chat",
  "ai.review.updating": "Aggiornamento in corso: riprova tra un momento",
  "ai.review.conflict": "Risolvi prima il conflitto del file: ricarica dal disco o sovrascrivi",
  "ai.review.scopeLost": "Non c’è niente da accettare: la selezione è andata persa. Scarta la proposta, oppure seleziona di nuovo il testo e riprova",
  "ai.review.truncated": "Accetta tutto non è disponibile per una proposta troncata: accetta le modifiche una alla volta dal diff",
  "ai.review.notAcceptable": "Non c’è niente da accettare in questo momento",
de:
  "ai.composer.noDocument": "Öffne ein Dokument, bevor du sendest",
  "ai.composer.updating": "Eine Aktualisierung läuft: versuche es gleich noch einmal",
  "ai.composer.generating": "Generierung läuft: warte, bis sie fertig ist, oder drücke Stoppen",
  "ai.review.generating": "Generierung läuft: warte, bis sie fertig ist, oder stoppe sie im Chat",
  "ai.review.updating": "Eine Aktualisierung läuft: versuche es gleich noch einmal",
  "ai.review.conflict": "Löse zuerst den Dateikonflikt: vom Datenträger neu laden oder überschreiben",
  "ai.review.scopeLost": "Es kann nichts übernommen werden: die Auswahl ist verloren gegangen. Verwirf den Vorschlag, oder wähle den Text erneut aus und versuche es noch einmal",
  "ai.review.truncated": "„Alles übernehmen“ ist bei einem abgeschnittenen Vorschlag nicht verfügbar: übernimm die Änderungen einzeln im Diff",
  "ai.review.notAcceptable": "Im Moment kann nichts übernommen werden",
es:
  "ai.composer.noDocument": "Abre un documento antes de enviar",
  "ai.composer.updating": "Hay una actualización en curso: inténtalo de nuevo en un momento",
  "ai.composer.generating": "Generación en curso: espera a que termine, o pulsa Detener",
  "ai.review.generating": "Generación en curso: espera a que termine, o deténla desde el chat",
  "ai.review.updating": "Hay una actualización en curso: inténtalo de nuevo en un momento",
  "ai.review.conflict": "Resuelve primero el conflicto del archivo: recarga desde el disco o sobrescribe",
  "ai.review.scopeLost": "No hay nada que aceptar: la selección se perdió. Descarta la propuesta, o selecciona el texto de nuevo y reinténtalo",
  "ai.review.truncated": "«Aceptar todo» no está disponible para una propuesta truncada: acepta los cambios de uno en uno desde el diff",
  "ai.review.notAcceptable": "No hay nada que aceptar en este momento",
fr:
  "ai.composer.noDocument": "Ouvrez un document avant d’envoyer",
  "ai.composer.updating": "Une mise à jour est en cours : réessayez dans un instant",
  "ai.composer.generating": "Génération en cours : attendez qu’elle se termine, ou appuyez sur Arrêter",
  "ai.review.generating": "Génération en cours : attendez qu’elle se termine, ou arrêtez-la depuis la discussion",
  "ai.review.updating": "Une mise à jour est en cours : réessayez dans un instant",
  "ai.review.conflict": "Résolvez d’abord le conflit du fichier : rechargez depuis le disque ou écrasez",
  "ai.review.scopeLost": "Rien ne peut être accepté : la sélection a été perdue. Abandonnez la proposition, ou sélectionnez à nouveau le texte et réessayez",
  "ai.review.truncated": "« Tout accepter » n’est pas disponible pour une proposition tronquée : acceptez les modifications une par une depuis le diff",
  "ai.review.notAcceptable": "Rien ne peut être accepté pour le moment",
ja:
  "ai.composer.noDocument": "送信する前にドキュメントを開いてください",
  "ai.composer.updating": "更新中です。しばらくしてからもう一度お試しください",
  "ai.composer.generating": "生成中です。終わるのを待つか、停止を押してください",
  "ai.review.generating": "生成中です。終わるのを待つか、チャットから停止してください",
  "ai.review.updating": "更新中です。しばらくしてからもう一度お試しください",
  "ai.review.conflict": "先にファイルの競合を解決してください。ディスクから再読み込みするか、上書きします",
  "ai.review.scopeLost": "採用できるものがありません。選択範囲が失われました。提案を破棄するか、テキストをもう一度選択してやり直してください",
  "ai.review.truncated": "途中で切れた提案では「すべて採用」は使えません。差分から変更を一つずつ採用してください",
  "ai.review.notAcceptable": "今は採用できるものがありません",
nl:
  "ai.composer.noDocument": "Open een document voordat je verzendt",
  "ai.composer.updating": "Er is een update bezig: probeer het zo opnieuw",
  "ai.composer.generating": "Generatie bezig: wacht tot die klaar is, of druk op Stoppen",
  "ai.review.generating": "Generatie bezig: wacht tot die klaar is, of stop die vanuit de chat",
  "ai.review.updating": "Er is een update bezig: probeer het zo opnieuw",
  "ai.review.conflict": "Los eerst het bestandsconflict op: opnieuw laden van schijf of overschrijven",
  "ai.review.scopeLost": "Er valt niets te accepteren: de selectie is verloren gegaan. Verwerp het voorstel, of selecteer de tekst opnieuw en probeer het nog eens",
  "ai.review.truncated": "„Alles accepteren” is niet beschikbaar voor een afgekapt voorstel: accepteer de wijzigingen een voor een vanuit de diff",
  "ai.review.notAcceptable": "Er valt op dit moment niets te accepteren",
pl:
  "ai.composer.noDocument": "Otwórz dokument przed wysłaniem",
  "ai.composer.updating": "Trwa aktualizacja: spróbuj ponownie za chwilę",
  "ai.composer.generating": "Trwa generowanie: poczekaj, aż się skończy, albo naciśnij Zatrzymaj",
  "ai.review.generating": "Trwa generowanie: poczekaj, aż się skończy, albo zatrzymaj je z czatu",
  "ai.review.updating": "Trwa aktualizacja: spróbuj ponownie za chwilę",
  "ai.review.conflict": "Najpierw rozwiąż konflikt pliku: wczytaj ponownie z dysku albo nadpisz",
  "ai.review.scopeLost": "Nie ma nic do zaakceptowania: zaznaczenie zostało utracone. Odrzuć propozycję albo zaznacz tekst ponownie i spróbuj jeszcze raz",
  "ai.review.truncated": "„Zaakceptuj wszystko” nie jest dostępne dla uciętej propozycji: akceptuj zmiany pojedynczo z widoku różnic",
  "ai.review.notAcceptable": "W tej chwili nie ma nic do zaakceptowania",
pt:
  "ai.composer.noDocument": "Abra um documento antes de enviar",
  "ai.composer.updating": "Há uma atualização em curso: tente novamente daqui a pouco",
  "ai.composer.generating": "Geração em curso: espere que termine, ou prima Parar",
  "ai.review.generating": "Geração em curso: espere que termine, ou pare-a a partir da conversa",
  "ai.review.updating": "Há uma atualização em curso: tente novamente daqui a pouco",
  "ai.review.conflict": "Resolva primeiro o conflito do ficheiro: recarregue do disco ou substitua",
  "ai.review.scopeLost": "Não há nada a aceitar: a seleção perdeu-se. Descarte a proposta, ou selecione o texto de novo e tente outra vez",
  "ai.review.truncated": "«Aceitar tudo» não está disponível para uma proposta truncada: aceite as alterações uma a uma a partir do diff",
  "ai.review.notAcceptable": "Não há nada a aceitar neste momento",
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/i18n/locales.test.ts` → PASS.

- [ ] **Step 4: Il controller**

In `src/ai/aiController.ts`, dopo `export interface AiWorkspace …`:

```ts
/** Perché un invio non può partire (sendBlocker): generazione in corso, nessun documento aperto, aggiornamento dell'app o del documento. */
export type SendBlocker='running'|'noDocument'|'updating';
/** Perché una proposta non si può accettare (acceptBlocker), nell'ordine in cui la barra li mostra. */
export type AcceptBlocker='generating'|'updating'|'notAcceptable'|'conflict'|'scopeLost'|'truncated';
```

La riga `canAccept(p:Proposal,all=false){…}` diventa:

```ts
  /** Perché la proposta non si può accettare adesso (o null), nell'ordine della barra: generazione, aggiornamento, altro documento, conflitto, selezione persa, troncata (solo «tutto»). */
  acceptBlocker(p:Proposal,all=false):AcceptBlocker|null{
    if(this.state.running?.path===p.path||p.status==='streaming')return 'generating';
    const doc=this.workspace.getDoc();
    if(this.updating||doc?.updating)return 'updating';
    if(!doc||doc.path!==p.path)return 'notAcceptable';
    if(doc.conflict)return 'conflict';
    if(p.scope&&applyScope(doc.textLf,p.scope,p.text)===null)return 'scopeLost';
    if(all&&p.status==='truncated')return 'truncated';
    return null;
  }
  canAccept(p:Proposal,all=false){return this.acceptBlocker(p,all)===null;}
```

(le stesse condizioni di prima, una per riga: `canAccept` resta identica per ogni combinazione, lo prova «acceptBlocker: una ragione per volta…»). Prima di `async send(…)`:

```ts
  /** Perché un invio non può partire adesso (o null): la guardia di send(), da leggere prima di svuotare la casella. Il profilo lo controlla il composer. */
  sendBlocker():SendBlocker|null{
    if(this.state.running)return 'running';
    const doc=this.workspace.getDoc();
    if(!doc)return 'noDocument';
    if(this.updating||doc.updating)return 'updating';
    return null;
  }
```

`send()` **non cambia**: la guardia `if(!doc||!profile||this.state.running||this.updating||doc.updating)return;` resta (un chiamante che non legge `sendBlocker()` continua a non rompere niente).

Le righe `prepare=…` e `cancel=…` diventano:

```ts
  /** Inizio e fine di un aggiornamento: `set({})` notifica gli iscritti (le note «aggiornamento in corso» del composer e della barra si svuotano al render; per React cambia l'identità dello stato). */
  prepare=async():Promise<'failed'|'durable'>=>{if(this.hasPendingWork()){this.set({error:'aiPendingUpdate'});return 'failed';}this.updating=true;this.set({});return 'durable';};
  cancel=()=>{this.updating=false;this.set({});};
```

e in `documentChanged`, dopo la riga `if(p&&next!==null&&!reset){…}else if(reset)this.appliedPaths.delete(path);`:

```ts
    // Un documento aperto o sostituito (reset, da WorkspaceView): chi guarda il documento aperto (la nota «apri un documento» del composer) deve rendere.
    if(reset)this.set({});
```

(`set({})` copia lo stato: nessun campo cambia, ma l'identità sì, così anche `useSyncExternalStore` in `ReviewView.tsx`/`WorkspaceView` rende. `doc.updating` del workspace cambia solo dentro lo stesso flusso di aggiornamento (`pwa/updateHost.ts`: `endUpdate()` del workspace e poi `cancel()` dei partecipanti), quindi al render provocato da `cancel()` è già falso. Per il profilo mancante `reload()` chiama già `set`; per la generazione `running` è nello stato; per il testo basta l'evento `input`.)

- [ ] **Step 5: Vista, elemento, controller finto**

`src/elements/ai/composerView.ts`: l'import diventa `import type { AiController, SendBlocker as ControllerBlocker } from '../../ai/aiController';`; `ComposerController` diventa `ModelChipController & Pick<AiController, 'send' | 'stop' | 'sendBlocker'>`; il blocco da `export type SendBlocker` a `sendBlocker()` diventa:

```ts
export type SendBlocker = 'ai.composer.generating' | 'ai.composer.noDocument' | 'ai.composer.updating' | 'ai.composer.needProfile' | 'ai.composer.needText';

/** Chiave della nota per una ragione del controller (`sendBlocker()`): generazione, nessun documento, aggiornamento. */
export const CONTROLLER_NOTES: Record<ControllerBlocker, SendBlocker> = {
  running: 'ai.composer.generating',
  noDocument: 'ai.composer.noDocument',
  updating: 'ai.composer.updating',
};

/**
 * Perché il messaggio non può partire, o null, nell'ordine: prima il controller (generazione in corso,
 * nessun documento, aggiornamento: la guardia di `send()`, che altrimenti scarterebbe in silenzio), poi il
 * profilo (senza non si invia comunque, preset compresi), poi il testo (solo per un messaggio scritto).
 */
export function sendBlocker(request: string, hasProfile: boolean, preset: boolean, controller: ControllerBlocker | null = null): SendBlocker | null {
  if (controller) return CONTROLLER_NOTES[controller];
  if (!hasProfile) return 'ai.composer.needProfile';
  return preset || request.trim() ? null : 'ai.composer.needText';
}
```

`src/elements/ai/composer.element.ts`: l'import da `./composerView` aggiunge `CONTROLLER_NOTES`; nel JSDoc della classe la frase «Invia non si disattiva mai: senza testo o senza profilo … quando parte una generazione.» diventa «Invia non si disattiva mai: quando il messaggio non può partire (generazione in corso, nessun documento aperto, aggiornamento in corso: `controller.sendBlocker()`; senza profilo; senza testo) la nota sotto il composer dice perché e la bozza resta. La nota si svuota quando la sua causa sparisce (la generazione finisce, un documento si apre, l'aggiornamento finisce; per profilo e testo: scrivendo, cambiando profilo, con un invio riuscito o quando parte una generazione).»; in `#send(presetId)` **via** `if (state.running) return;` e la riga del blocco diventa:

```ts
    // Prima la guardia di send() (che altrimenti scarterebbe in silenzio e la bozza andrebbe persa), poi profilo e testo.
    const blocker = sendBlocker(parts.input.value, !!controller.profile(), !!preset, controller.sendBlocker());
```

e nel render il blocco «Un cambio di profilo o una generazione partita … toglie la nota» diventa:

```ts
    // La nota se ne va quando la sua causa sparisce: per le ragioni del controller quando la ragione cambia;
    // per profilo e testo con un cambio di profilo o una generazione partita da qualunque parte (anche «Riprova»
    // nel registro). La stessa nota due volte di fila non si ri-annuncia (stesso testo nella regione): accettato.
    if (this.#note) {
      const reason = controller.sendBlocker();
      const fromController = (Object.values(CONTROLLER_NOTES) as SendBlocker[]).includes(this.#note.key);
      const stale = fromController ? (reason ? CONTROLLER_NOTES[reason] : null) !== this.#note.key : this.#note.profileId !== controller.profile()?.id || !!reason;
      if (stale) this.#note = null;
    }
```

(`SendBlocker` è già importato come tipo). `src/testing/fakeAi.ts`: gli import diventano `import type { AcceptBlocker, AiState, SendBlocker } from '../ai/aiController';` e `… ModelProfile, ProfileOverrides, Proposal } from '../ai/types';`; lo stato di default diventa `{ chat: { id: 'c', messages: [], overrides: {} }, proposals: new Map(), running: null, presets: [], profiles: [], profileId: '', streamingPreview: null, ...initial }`; dopo `send: …`:

```ts
    /** Ragione per cui un invio non parte: `running` dallo stato, le altre da `blocker`. */
    sendBlocker: (): SendBlocker | null => (state.running ? 'running' : controller.sendBlockerValue),
    sendBlockerValue: null as SendBlocker | null,
    /** Ragione per cui la proposta non si accetta (`blocker`), da cui `canAccept`. */
    blocker: null as AcceptBlocker | null,
    acceptBlocker: (p: Proposal, all = false) => (state.running?.path === p.path || p.status === 'streaming' ? 'generating' : controller.blocker ?? (all && p.status === 'truncated' ? 'truncated' : null)),
    canAccept: (p: Proposal, all = false) => controller.acceptBlocker(p, all) === null,
    beforeAccept: (p: Proposal, all = false) => (calls.push(['beforeAccept', p.path, all]), controller.canAccept(p, all)),
    /** Testo della proposta applicato al documento: la proposta stessa, salvo `proposalTextValue`. */
    proposalTextValue: undefined as string | null | undefined,
    proposalText: (p: Proposal) => (controller.proposalTextValue === undefined ? p.text : controller.proposalTextValue),
    edited: (path: string, text: string) => void calls.push(['edited', path, text]),
    discard: (path: string) => void calls.push(['discard', path]),
    continue: async (path: string) => void calls.push(['continue', path]),
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/ai/aiController.test.ts src/elements/ai/composerView.test.ts src/elements/ai/composer.dom.test.ts` → tutto PASS; `npm run lint` pulito.

- [ ] **Step 6: E2e nella forma nuova**

In `e2e/ai-review-bar.spec.ts` il blocco `test.describe('composer without a document', …)` del Task 1 diventa:

```ts
test.describe('composer without a document', () => {
  test('with no document open, Send says so, keeps the draft and the focus', async ({ app, ai, page }) => {
    await app.openFolder({ 'a.md': 'A' });
    await enterAi(app);
    await composer(app).fill('fix');
    await send(app).click();
    const note = page.getByRole('status').filter({ hasText: app.t('ai.composer.noDocument') });
    await expect(note).toBeVisible();
    await expect(composer(app)).toHaveValue('fix');
    await expect(send(app)).toBeFocused();
    expect(ai.requests).toBe(0);
    // Aprire un documento passa dalla modalità editor: la sidebar AI si smonta e si rimonta (bozza e nota ripartono da zero, come oggi).
    await app.mode('mode.editor').click();
    await app.openFile('a.md');
    await app.mode('mode.ai').click();
    await expect(note).toHaveCount(0);
  });

  test('Enter in the composer during a generation says so and keeps the draft; the note goes when the generation ends', async ({ app, ai, page }) => {
    ai.hold();
    await app.openFolder({ 'a.md': 'A' });
    await app.openFile('a.md');
    await enterAi(app);
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await expect(page.getByRole('group', { name: app.t('ai.suggestions') })).toHaveCount(0);
    const note = page.getByRole('status').filter({ hasText: app.t('ai.composer.generating') });
    await composer(app).fill('again');
    await composer(app).press('Enter');
    await expect(note).toBeVisible();
    await expect(composer(app)).toHaveValue('again');
    expect(ai.requests).toBe(1);
    ai.release();
    await proposalShown(app);
    await expect(note).toHaveCount(0);
  });
});
```

(Trovato nel prototipo: con nessun documento aperto non si può «aprire un documento» restando in modalità AI, perché il pannello AI prende il posto dell'albero; si passa dall'editor, e `WorkspaceView` smonta la sidebar: la bozza si perde come oggi. Il test afferma solo che la nota non c'è più. Nel prototipo la prima versione del test pretendeva la bozza conservata dopo il rimontaggio ed è caduta: non è una regressione, la sidebar è nuova.) Lo stesso file deve passare anche nella **prima parte del Task 3**: non tocca la barra.

Run: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts e2e/ai-composer.spec.ts` → verde (10 + 11).

- [ ] **Step 7: Stato di audit con la nota**

In `e2e/computed-styles.audit.ts`, subito dopo lo stato `ai-composer-note`:

```ts
  {
    name: 'ai-composer-note-no-document',
    async setup(app, page) {
      // Modalità AI senza un documento aperto: Invia resta attivo e la nota dice di aprire un documento.
      await app.openFolder({ 'a.md': 'Alpha' });
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('textbox', { name: app.t('ai.request') }).fill('fix');
      await page.getByRole('button', { name: app.t('ai.send'), exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.composer.noDocument') })).toBeVisible();
    },
  },
```

- [ ] **Step 8: Verifica completa e `dist-baseline/` ricostruita**

Sulla build vecchia (`dist-baseline/` del Task 1) lo stato nuovo **non è raggiungibile** (Invia svuota la casella senza nota: il `setup` del progetto `baseline` cade, e con una caduta in `baseline` Playwright non esegue nessun test del progetto `current`: misurato nel prototipo, «1 failed, 58 did not run»). Quindi prima si prova che **tutto il resto è identico** escludendo lo stato nuovo, poi si ricostruisce la baseline da questa build (nessun pixel in più: la nota vuota è a 0 px) e si rilancia tutto:

```bash
npm test                    # 934 + 10 = 944 (4 controller, 1 vista, 4 composer con fakeAi + 1 con il controller vero)
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e        # 186, snapshot invariati (i 2 dello start screen cadono su ape per il font pixel: estraneo)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev    # 171
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts --grep-invert "ai-composer-note-no-document"   # 112, nessuna differenza (il filtro direttamente a playwright, non via npm run)
npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit  # 112 + 2 = 114
pgrep -af "vite|chrom|playwright"   # niente di proprio appeso
```

- [ ] **Step 9: Commit**

```bash
git add src/ai/ src/elements/ai/composerView.ts src/elements/ai/composerView.test.ts src/elements/ai/composer.element.ts src/elements/ai/composer.dom.test.ts src/testing/fakeAi.ts src/i18n/locales/ e2e/ai-review-bar.spec.ts e2e/computed-styles.audit.ts
git commit -m "feat: ragioni dal controller (sendBlocker, acceptBlocker), note del composer senza documento, in aggiornamento e in generazione, bozza conservata, notifiche da prepare/cancel e dal documento aperto, nove chiavi nei locali"
```

---

### Task 3: `hmd-ai-review-bar` (LAB-11)

**Prima parte: identica a React.** La barra come custom element con lo stesso DOM, gli stessi `disabled` (`busy` sulle frecce, `!canDiscard`, `!canAccept`) e lo stesso foglio di oggi (bordo su `.bar`, regole `:disabled`); `ReviewView.tsx` la monta nei due punti. Audit verde contro `dist-baseline/` del Task 2. **Seconda parte (decisione 3)**: i pulsanti non si disattivano mai, la nota `p.note[role=status]` sotto la riga dice perché, l'host prende il bordo; `ReviewView.tsx` passa `acceptBlocker` al posto di `canAccept`/`canDiscard`; e2e del Task 1 nella forma nuova; baseline ricostruita (il `p` in più sposta gli indici dei 5 stati `ai-review*`).

**Files:**
- Create: `src/elements/ai/reviewBarView.ts`, `reviewBarView.test.ts`, `review-bar.element.ts`, `review-bar.css`, `review-bar.dom.test.ts`
- Modify: `src/elements/define.ts`, `events.ts`, `jsx.d.ts`, `src/ui/ai/ReviewView.tsx` (prima parte; seconda parte di nuovo), `e2e/ai-review-bar.spec.ts` e `e2e/computed-styles.audit.ts` (seconda parte)
- Delete: `src/ui/ai/ReviewBar.tsx` (prima parte)

**Interfaces:**
- Produces: `ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue'`, `statusLine(status, t): StatusLine | null`; `HmdAiReviewBar` con `status`, `warnings`, `i18n`, e `canAccept`, `canDiscard` (prima parte) → `acceptBlocker: AcceptBlocker | null` (seconda parte, con `ReviewBlocker`, `actionBlocker(action, status, acceptBlocker)`); eventi `hmd-ai-review-action { action }`, `hmd-ai-review-warning { warning }`.

- [ ] **Step 1: Test che falliscono (prima parte)**

`src/elements/ai/reviewBarView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { ReviewStatus } from '../../ai/reviewStatus';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { statusLine } from './reviewBarView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const none: ReviewStatus = { kind: 'none' };

test('the status line: nothing, the counter with progress and a live region, partial with Continue, the alert of the lost selection', () => {
  assert.equal(statusLine(none, t), null);
  assert.deepEqual(statusLine({ kind: 'generating', seconds: 3 }, t), { text: t('ai.generating', { seconds: 3 }), live: true, alert: false, withContinue: false });
  assert.equal(statusLine({ kind: 'generating', seconds: 3, done: 1, total: 3 }, t)!.text, `${t('ai.generating', { seconds: 3 })} 1/3`);
  assert.deepEqual(statusLine({ kind: 'partial' }, t), { text: t('ai.status.partial'), live: false, alert: false, withContinue: true });
  assert.deepEqual(statusLine({ kind: 'truncated' }, t), { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'scopeLost' }, t), { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false });
  assert.deepEqual(statusLine({ kind: 'applied' }, t), { text: t('ai.applied'), live: false, alert: false, withContinue: false });
});
```

`src/elements/ai/review-bar.dom.test.ts` (prima parte: `mount(status, warnings, canAccept = true, canDiscard = true)`; **mai `assert.equal` tra due nodi di jsdom**: quando fallisce, `util.inspect` dell'albero non finisce più e il processo sembra appeso, misurato; si confronta un valore derivato con `focusOn`):

```ts
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
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/reviewBarView.test.ts src/elements/ai/review-bar.dom.test.ts` → cadono (`Cannot find module './reviewBarView'`; l'elemento non è definito: `el.firstElementChild` nullo). Annotare.

- [ ] **Step 3: Logica pura, elemento e foglio (prima parte)**

`src/elements/ai/reviewBarView.ts`:

```ts
import type { ReviewStatus } from '../../ai/reviewStatus';
import type { I18nStore } from '../../state/i18nStore';

/** Azioni della barra di revisione, mandate con `hmd-ai-review-action`. */
export type ReviewAction = 'previous' | 'next' | 'acceptAll' | 'discard' | 'continue';

/** Testo e attributi dello span di stato (StatusText di ReviewBar.tsx), o null quando non c'è niente da dire. */
export interface StatusLine {
  text: string;
  /** `aria-live="polite"` solo durante la generazione (il contatore dei secondi). */
  live: boolean;
  /** `role="alert"` solo per la selezione persa. */
  alert: boolean;
  /** Il pulsante «Continua» accanto, solo per una proposta a parti interrotta. */
  withContinue: boolean;
}

export function statusLine(status: ReviewStatus, t: I18nStore['t']): StatusLine | null {
  switch (status.kind) {
    case 'none':
      return null;
    case 'generating':
      return { text: `${t('ai.generating', { seconds: status.seconds })}${status.total ? ` ${status.done}/${status.total}` : ''}`, live: true, alert: false, withContinue: false };
    case 'partial':
      return { text: t('ai.status.partial'), live: false, alert: false, withContinue: true };
    case 'truncated':
      return { text: t('ai.status.truncated'), live: false, alert: false, withContinue: false };
    case 'scopeLost':
      return { text: t('ai.error.scopeLost'), live: false, alert: true, withContinue: false };
    case 'applied':
      return { text: t('ai.applied'), live: false, alert: false, withContinue: false };
  }
}
```

`src/elements/ai/review-bar.element.ts` (prima parte):

```ts
import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { statusLine, type ReviewAction } from './reviewBarView';
import './review-bar.css';

interface Parts {
  bar: HTMLDivElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  status: HTMLSpanElement;
  continue: HTMLButtonElement;
  spacer: HTMLSpanElement;
  /** Pulsante degli avvisi con il conteggio, e il popover con un pulsante per avviso. */
  warnings: HTMLButtonElement;
  count: Text;
  popover: HTMLDivElement;
  discard: HTMLButtonElement;
  acceptAll: HTMLButtonElement;
}

/**
 * Barra della revisione AI (era ReviewBar.tsx): frecce tra le modifiche, stato (contatore della
 * generazione, parziale con «Continua», troncata, selezione persa, applicata), avvisi in un popover,
 * Scarta e Accetta tutto. Le azioni salgono come `hmd-ai-review-action`, un avviso scelto come
 * `hmd-ai-review-warning`. Le frecce si disattivano durante la generazione, Scarta e Accetta tutto
 * secondo `canDiscard` e `canAccept` (come React).
 */
export class HmdAiReviewBar extends HmdElement {
  #status: ReviewStatus = { kind: 'none' };
  #warnings: CheckWarning[] = [];
  #canAccept = false;
  #canDiscard = false;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    focusScope: () => this.#parts?.bar ?? null,
    // Il nodo con il focus è sparito (Continua dopo il clic, il pulsante degli avvisi senza più avvisi): il focus va su Accetta tutto.
    refocus: () => this.#parts?.acceptAll.focus(),
  });

  get status(): ReviewStatus { return this.#status; }
  set status(value: ReviewStatus) {
    this.#status = value ?? { kind: 'none' };
    this.#loop.update();
  }
  get warnings(): CheckWarning[] { return this.#warnings; }
  set warnings(value: CheckWarning[]) {
    this.#warnings = value ?? [];
    this.#loop.update();
  }
  get canAccept(): boolean { return this.#canAccept; }
  set canAccept(value: boolean) {
    this.#canAccept = !!value;
    this.#loop.update();
  }
  get canDiscard(): boolean { return this.#canDiscard; }
  set canDiscard(value: boolean) {
    this.#canDiscard = !!value;
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const id = uid('hmd-ai-review');
      const action = (name: ReviewAction, className: string, ...children: Node[]) =>
        el('button', { type: 'button', class: className, on: { click: () => emit(this, 'hmd-ai-review-action', { action: name }) } }, ...children);
      const count = document.createTextNode('');
      const parts: Parts = {
        bar: el('div', { class: 'bar' }),
        previous: action('previous', 'iconButton tooltip', icon('chevronUp')),
        next: action('next', 'iconButton tooltip', icon('chevronDown')),
        status: el('span', { class: 'status' }),
        continue: action('continue', 'secondary'),
        spacer: el('span', { class: 'spacer' }),
        warnings: el('button', { type: 'button', class: 'secondary tooltip', popovertarget: id }, icon('warning', { size: 14 }), count),
        count,
        popover: el('div', { id, popover: 'auto', class: 'warnings' }),
        discard: action('discard', 'secondary'),
        acceptAll: action('acceptAll', 'secondary accept'),
      };
      this.#parts = parts;
      parts.bar.append(parts.previous, parts.next, parts.spacer, parts.discard, parts.acceptAll);
      this.append(parts.bar);
    }
    const i18n = this.#i18n;
    if (!i18n) return;
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const t = i18n.t;
    const { bar } = parts;
    const busy = isBusy(this.#status);
    toggleAttr(parts.previous, 'aria-label', true, t('ai.previous'));
    toggleAttr(parts.previous, 'data-tooltip', true, t('ai.previous'));
    toggleAttr(parts.next, 'aria-label', true, t('ai.next'));
    toggleAttr(parts.next, 'data-tooltip', true, t('ai.next'));
    parts.previous.disabled = busy;
    parts.next.disabled = busy;
    // Lo stato: uno span riusato come fa React (stessa posizione, stesso tipo), con gli attributi del momento.
    const line = statusLine(this.#status, t);
    if (line) {
      setText(parts.status, line.text);
      toggleAttr(parts.status, 'aria-live', line.live, 'polite');
      toggleAttr(parts.status, 'role', line.alert, 'alert');
      if (parts.status.parentNode !== bar) bar.insertBefore(parts.status, parts.spacer);
      if (line.withContinue) {
        setText(parts.continue, t('ai.continue'));
        if (parts.continue.parentNode !== bar) bar.insertBefore(parts.continue, parts.spacer);
      } else {
        parts.continue.remove();
      }
    } else {
      parts.status.remove();
      parts.continue.remove();
    }
    // Avvisi: pulsante e popover solo se ce ne sono; i pulsanti del popover si riusano per posizione (come React senza chiavi).
    const warnings = this.#warnings;
    if (warnings.length > 0) {
      const label = t('ai.warningsCount', { count: warnings.length });
      toggleAttr(parts.warnings, 'aria-label', true, label);
      toggleAttr(parts.warnings, 'data-tooltip', true, label);
      setText(parts.count, ` ${warnings.length}`);
      while (parts.popover.children.length > warnings.length) parts.popover.lastElementChild!.remove();
      warnings.forEach((warning, index) => {
        let button = parts.popover.children[index] as HTMLButtonElement | undefined;
        if (!button) {
          button = el('button', { type: 'button', on: { click: () => emit(this, 'hmd-ai-review-warning', { warning: this.#warnings[index] }) } });
          parts.popover.append(button);
        }
        setText(button, t(`ai.warning.${warning.code}` as MessageKey));
      });
      if (parts.warnings.parentNode !== bar) bar.insertBefore(parts.warnings, parts.discard);
      if (parts.popover.parentNode !== bar) bar.insertBefore(parts.popover, parts.discard);
    } else {
      parts.warnings.remove();
      parts.popover.remove();
    }
    setText(parts.discard, t('ai.discard'));
    parts.discard.disabled = !this.#canDiscard;
    setText(parts.acceptAll, t('ai.acceptAll'));
    parts.acceptAll.disabled = !this.#canAccept;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-review-bar': HmdAiReviewBar;
  }
}
```

`src/elements/ai/review-bar.css` (prima parte: i valori di `ReviewView.module.css`, l'host `display: contents`):

```css
@layer components {
  @scope (hmd-ai-review-bar) {
    :scope {
      display: contents;
    }

    /* Valori copiati da ReviewView.module.css (.bar, .status, .spacer, .iconButton, .secondary, .accept, :disabled, .warnings). */
    .bar {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 42px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--c-border);
      font-family: var(--font-pixel);
    }

    .status {
      color: var(--c-muted);
      font-size: 13px;
    }

    .spacer {
      flex: 1;
    }

    .iconButton {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 6px;
      background: none;
      cursor: pointer;
    }

    .iconButton:hover:not(:disabled) {
      background: var(--c-accent-soft);
    }

    .secondary {
      padding: 4px 10px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: none;
      color: var(--c-text);
      cursor: pointer;
    }

    .accept {
      color: var(--c-accent);
      font-weight: 600;
    }

    .iconButton:disabled,
    .secondary:disabled {
      opacity: 0.45;
      cursor: default;
    }

    .warnings {
      position-area: block-end span-inline-start;
      margin: 6px 0 0;
      padding: 8px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: var(--c-surface);
      color: var(--c-text);
    }

    .warnings button {
      display: block;
      width: 100%;
      padding: 4px;
      border: none;
      background: none;
      text-align: start;
      cursor: pointer;
    }
  }
}
```

(Nel prototipo questa prima parte è stata provata nel primo run del piano: 31 e2e e 31 dev dei file AI verdi, audit 112 verde contro la baseline del Task 1. Il prototipo finale conserva solo la seconda parte: il testo qui sopra è quella versione senza nota e con `disabled`, e la seconda parte sotto è la differenza esatta.)

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: `import { HmdAiReviewBar } from './ai/review-bar.element';` dopo quello di `HmdAiParameters`, e nella lista dopo `['hmd-ai-parameters', HmdAiParameters],`: `['hmd-ai-review-bar', HmdAiReviewBar],`.

`src/elements/events.ts`: `import type { GenParams, ModelProfile } from '../ai/types';` diventa `import type { CheckWarning, GenParams, ModelProfile } from '../ai/types';`, poi `import type { ReviewAction } from './ai/reviewBarView';` (dopo gli import di `../ai/`), e **subito sopra** la riga `/** Suggerimento scelto sotto il composer: invia il preset. */` (il JSDoc di `'hmd-ai-suggestion'`, dopo la chiave `'hmd-ai-retry'`):

```ts
  /** Barra della revisione AI: un pulsante attivato (frecce, Accetta tutto, Scarta, Continua). */
  'hmd-ai-review-action': CustomEvent<{ action: ReviewAction }>;
  /** Barra della revisione AI: un avviso scelto nel popover (portare in vista la riga). */
  'hmd-ai-review-warning': CustomEvent<{ warning: CheckWarning }>;
```

`src/elements/jsx.d.ts`: `import type { ReviewStatus } from '../ai/reviewStatus';` e `import type { CheckWarning } from '../ai/types';` tra gli import di `../ai/` (ordine alfabetico), e dopo `'hmd-ai-parameters'`:

```ts
      'hmd-ai-review-bar': HmdProps<{ status: ReviewStatus; warnings: CheckWarning[]; canAccept: boolean; canDiscard: boolean; i18n: I18nStore }, 'hmd-ai-review-action' | 'hmd-ai-review-warning'>;
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/reviewBarView.test.ts src/elements/ai/review-bar.dom.test.ts src/architecture.test.ts` → PASS.

- [ ] **Step 5: `ReviewView.tsx` monta il tag**

In `src/ui/ai/ReviewView.tsx`: via `import { ReviewBar } from './ReviewBar';`; aggiungere `import type { CheckWarning } from '../../ai/types';` c'è già; il `<ReviewBar … />` del ramo senza proposta diventa:

```tsx
          <hmd-ai-review-bar status={status} warnings={[]} canAccept={false} canDiscard={false} i18n={i18nStore} />
```

e quello del ramo con il diff:

```tsx
      <hmd-ai-review-bar
        status={status}
        warnings={warnings}
        canAccept={controller.canAccept(p, true)}
        canDiscard={!isBusy(status)}
        i18n={i18nStore}
        onhmd-ai-review-action={(event) => {
          switch (event.detail.action) {
            case 'previous':
              return diff.current?.previous();
            case 'next':
              return diff.current?.next();
            case 'discard':
              return controller.discard(p.path);
            case 'continue':
              return void controller.continue(p.path);
            case 'acceptAll':
              if (editor.text === p.baseText || p.scope) return accept();
              void showConfirmDialog({ title: t('ai.acceptAll'), message: t('ai.changedWarning'), confirmLabel: t('ai.acceptAll'), t, signal: dialogSignal() }).then(
                (ok) => ok && acceptRef.current(),
              );
          }
        }}
        onhmd-ai-review-warning={(event) => diff.current?.scrollToLine((event.detail.warning as { line?: number }).line ?? 0)}
      />
```

(`i18nStore` e `showConfirmDialog` sono già nel file; nel ramo senza proposta non servono gli eventi: React 19 passa le proprietà prima di inserire l'elemento, quindi `status` arriva prima del render.)

- [ ] **Step 6: Via `ReviewBar.tsx`, controlli**

```bash
git rm src/ui/ai/ReviewBar.tsx
grep -rnE "from '\./ReviewBar'|<ReviewBar[ />]|styles\.(bar|status|spacer|iconButton|secondary|accept|warnings)\b" src; echo "exit $?"   # atteso: exit 1
grep -rn "<hmd-ai-review-bar" src | wc -l    # 2: i due rami di ReviewView.tsx
```

Le classi `.bar`, `.status`, `.spacer`, `.iconButton`, `.secondary`, `.accept`, `:disabled`, `.warnings` si tolgono da `ReviewView.module.css` (restano `.review`, `.hint`, `.stream pre`, `.editor`).

- [ ] **Step 7: Verifica completa (prima parte)**

```bash
npm test                    # 944 + 1 + 7 = 952
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts e2e/ai-review.spec.ts e2e/ai-diff.spec.ts --repeat-each=3
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e        # 186, snapshot invariati
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev    # 171
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit  # 114, nessuna differenza (ai-review, -hover, -conflict, -generating, -truncated, -warnings, -applied)
```

- [ ] **Step 8: Commit**

```bash
git add src/elements/ src/ui/ai/ReviewView.tsx src/ui/ai/ReviewView.module.css
git commit -m "feat: hmd-ai-review-bar al posto di ReviewBar (stesso DOM e stessi disabled, eventi hmd-ai-review-action e hmd-ai-review-warning)"
```

#### Seconda parte del Task 3: i pulsanti della barra non si disattivano mai (decisione 3)

Cambio **voluto** di comportamento e di aspetto, dopo che la prima parte ha provato l'elemento identico a React. Precedente, Successivo, Scarta e Accetta tutto restano attivi; attivati quando l'azione non è possibile, la nota `p.note[role=status]` sotto la riga dei pulsanti dice perché: durante la generazione per tutti e quattro (`ai.review.generating`); per Accetta tutto la ragione del controller (`acceptBlocker(p, true)` → `ai.review.<ragione>`: aggiornamento, conflitto, selezione persa, troncata, riserva). Continua non ha nota. La nota ricorda l'azione e la chiave e si svuota quando quella causa non vale più per quell'azione, quando un'azione riesce (sale l'evento), o quando la barra sparisce (distacco). Il focus resta sul pulsante. L'host diventa `display: block` con il `border-bottom` (tolto da `.bar`): con la nota vuota i pixel sono quelli di oggi (snapshot «AI review» invariati, misurato nel prototipo). Via le regole `:disabled` e il `:not(:disabled)` dell'hover: aspetto identico in ogni stato.

**Files:**
- Modify: `src/elements/ai/reviewBarView.ts` (+ test), `review-bar.element.ts`, `review-bar.css`, `review-bar.dom.test.ts`, `src/elements/jsx.d.ts`, `src/ui/ai/ReviewView.tsx`, `e2e/ai-review-bar.spec.ts`, `e2e/computed-styles.audit.ts`

**Interfaces:**
- Produces: `type ReviewBlocker = \`ai.review.${AcceptBlocker}\``, `actionBlocker(action, status, acceptBlocker): ReviewBlocker | null`; `HmdAiReviewBar.acceptBlocker: AcceptBlocker | null` (al posto di `canAccept`/`canDiscard`); `p.note[role=status]` figlia dell'host dopo `div.bar`.

- [ ] **Step 9: Test che falliscono**

In `src/elements/ai/reviewBarView.test.ts`: l'import diventa `import { actionBlocker, statusLine } from './reviewBarView';`, `const generating: ReviewStatus = { kind: 'generating', seconds: 3 };` accanto a `none`, e prima del test dello stato:

```ts
test('while generating every action but Continue says so; otherwise the arrows and Discard are free', () => {
  for (const action of ['previous', 'next', 'discard', 'acceptAll'] as const) assert.equal(actionBlocker(action, generating, 'generating'), 'ai.review.generating', action);
  assert.equal(actionBlocker('continue', generating, 'generating'), null);
  for (const action of ['previous', 'next', 'discard', 'continue'] as const) assert.equal(actionBlocker(action, none, 'truncated'), null, action);
});

test('Accept all carries the reason of the controller, one key per reason', () => {
  assert.equal(actionBlocker('acceptAll', none, null), null);
  assert.equal(actionBlocker('acceptAll', { kind: 'truncated' }, 'truncated'), 'ai.review.truncated');
  assert.equal(actionBlocker('acceptAll', { kind: 'scopeLost' }, 'scopeLost'), 'ai.review.scopeLost');
  assert.equal(actionBlocker('acceptAll', none, 'conflict'), 'ai.review.conflict');
  assert.equal(actionBlocker('acceptAll', none, 'updating'), 'ai.review.updating');
  assert.equal(actionBlocker('acceptAll', none, 'notAcceptable'), 'ai.review.notAcceptable');
});

test('every note key exists in en.json', () => {
  for (const reason of ['generating', 'updating', 'conflict', 'scopeLost', 'truncated', 'notAcceptable']) assert.ok(`ai.review.${reason}` in EN_MESSAGES, reason);
});
```

`src/elements/ai/review-bar.dom.test.ts`: `import type { AcceptBlocker } from '../../ai/aiController';` tra gli import; nel `load` dello store `'ai.review.generating': 'ASPETTA'` in più; `mount(initial, warnings, acceptBlocker: AcceptBlocker | null = null)` con `el.acceptBlocker = acceptBlocker;` al posto delle due righe `canAccept`/`canDiscard`, e `note` tra gli aiuti restituiti: `const note = () => el.querySelector<HTMLParagraphElement>(':scope > [role="status"]')!;`. I test «the same DOM…» e «while generating…» diventano, e dopo di loro entrano tre test nuovi:

```ts
test('the same DOM as ReviewBar.tsx without status or warnings, then the empty status note: nothing is ever disabled', () => {
  const { el, bar, buttons, status, popover, byLabel, note } = mount();
  assert.deepEqual([...el.children].map((c) => `${c.localName}.${c.className}`), ['div.bar', 'p.note']);
  assert.equal(note().textContent, '');
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
    assert.equal(button.hasAttribute('aria-disabled'), false);
  }
  assert.ok(byLabel(EN_MESSAGES['ai.discard']));
  assert.ok(byLabel(EN_MESSAGES['ai.acceptAll']));
});

test('while generating: the counter with progress in a polite live region; every button active, activated it writes the note and keeps the focus', () => {
  const { status, byLabel, buttons, note, events } = mount(GENERATING, [], 'generating');
  assert.equal(status()!.textContent, `${EN_MESSAGES['ai.generating'].replace('{seconds}', '3')} 1/3`);
  assert.equal(status()!.getAttribute('aria-live'), 'polite');
  assert.equal(status()!.hasAttribute('role'), false);
  assert.equal(status()!.previousElementSibling, buttons()[1]);
  assert.equal(status()!.nextElementSibling!.className, 'spacer');
  for (const button of [buttons()[0], buttons()[1], byLabel(EN_MESSAGES['ai.discard']), byLabel(EN_MESSAGES['ai.acceptAll'])]) {
    assert.equal(button.disabled, false);
    button.focus();
    button.click();
    assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
    focusOn(button, button.getAttribute('aria-label') ?? button.textContent ?? '');
  }
  assert.deepEqual(events, []);
});

test('the note goes when its cause goes: the generation ends, Accept all is possible again, or an action succeeds', () => {
  const { el, byLabel, note, events } = mount(GENERATING, [], 'generating');
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
  el.status = { kind: 'truncated' };
  el.acceptBlocker = 'truncated';
  assert.equal(note().textContent, '');
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  // Un'altra azione riesce: la nota se ne va e l'azione sale.
  byLabel(EN_MESSAGES['ai.discard']).click();
  assert.equal(note().textContent, '');
  assert.deepEqual(events, [['hmd-ai-review-action', { action: 'discard' }]]);
  byLabel(EN_MESSAGES['ai.acceptAll']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.truncated']);
  el.acceptBlocker = null;
  assert.equal(note().textContent, '');
});

test('Accept all says the reason of the controller, one text per reason, in the order of the bar', () => {
  const { el, byLabel, note } = mount({ kind: 'none' }, [], 'updating');
  const accept = () => byLabel(EN_MESSAGES['ai.acceptAll']).click();
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.updating']);
  el.acceptBlocker = 'conflict';
  assert.equal(note().textContent, '');
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.conflict']);
  el.status = { kind: 'scopeLost' };
  el.acceptBlocker = 'scopeLost';
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.scopeLost']);
  el.status = { kind: 'none' };
  el.acceptBlocker = 'notAcceptable';
  accept();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.notAcceptable']);
});

test('detached and attached again the note is forgotten', () => {
  const { el, byLabel, note } = mount(GENERATING, [], 'generating');
  byLabel(EN_MESSAGES['ai.discard']).click();
  assert.equal(note().textContent, EN_MESSAGES['ai.review.generating']);
  el.remove();
  document.body.append(el);
  assert.equal(note().textContent, '');
});
```

«the four actions reach the host as one event each» diventa «…when they are possible» (stesso corpo); il test della lingua prende `'generating'` come terzo argomento di `mount`, clicca Scarta prima di `setLocale('it')` e afferma `note().textContent === 'ASPETTA'` (titolo: «a language change rewrites labels, tooltips, warnings and the note; detached, no listener stays»).

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/reviewBarView.test.ts src/elements/ai/review-bar.dom.test.ts` → i tre test della vista cadono (`actionBlocker` non esiste), i cinque della barra cadono (`el.acceptBlocker` ignorato, `p.note` assente, pulsanti `disabled`). Annotare.

- [ ] **Step 10: Vista, elemento e foglio**

`src/elements/ai/reviewBarView.ts`: gli import diventano `import type { AcceptBlocker } from '../../ai/aiController';` e `import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';`; dopo `ReviewAction`:

```ts
/** Chiavi delle note della barra: una per ragione del controller (`ai.review.<ragione>`). */
export type ReviewBlocker = `ai.review.${AcceptBlocker}`;

/**
 * Perché l'azione non è possibile adesso (chiave della nota), o null. Le frecce e Scarta si fermano solo
 * durante la generazione (come i `disabled` di ReviewBar.tsx); Accetta tutto ha la ragione del controller
 * (`acceptBlocker(p, true)`, già nell'ordine della barra); Continua non si ferma mai qui (il controller
 * ignora in silenzio un Continua durante un aggiornamento: resta com'è, da rivedere in fase 8).
 */
export function actionBlocker(action: ReviewAction, status: ReviewStatus, acceptBlocker: AcceptBlocker | null): ReviewBlocker | null {
  if (action === 'acceptAll') return acceptBlocker ? `ai.review.${acceptBlocker}` : null;
  if (action === 'continue') return null;
  return isBusy(status) ? 'ai.review.generating' : null;
}
```

`src/elements/ai/review-bar.element.ts`, le differenze dalla prima parte:

1. import: `import type { AcceptBlocker } from '../../ai/aiController';` e `import type { ReviewStatus } from '../../ai/reviewStatus';` (via `isBusy`); `import { actionBlocker, statusLine, type ReviewAction, type ReviewBlocker } from './reviewBarView';`.
2. In `Parts`, dopo `acceptAll`: `/** Nota sotto la riga dei pulsanti (\`role="status"\`): perché il pulsante attivato non ha fatto nulla. Vuota di norma. */ note: HTMLParagraphElement;`.
3. JSDoc della classe, l'ultima frase diventa: «Nessun pulsante si disattiva mai (regola di Davide, spec §2 vincolo 4): quando l'azione non è possibile (generazione in corso; per Accetta tutto la ragione del controller, `acceptBlocker`) il pulsante resta attivo e, attivato, la nota sotto la riga dice perché; il focus resta sul pulsante. La nota ricorda la sua causa e si svuota quando quella non vale più, quando un'azione della barra riesce, o quando la barra sparisce.»
4. I campi `#canAccept`/`#canDiscard` e i loro accessor diventano:

```ts
  #acceptBlocker: AcceptBlocker | null = 'generating';
  …
  /** Nota mostrata: l'azione che l'ha prodotta e la sua chiave, per sapere quando la causa sparisce. */
  #note: { action: ReviewAction; key: ReviewBlocker } | null = null;
  …
  /** Perché Accetta tutto non può (dal controller, `acceptBlocker(p, true)`), o null. */
  get acceptBlocker(): AcceptBlocker | null { return this.#acceptBlocker; }
  set acceptBlocker(value: AcceptBlocker | null) {
    this.#acceptBlocker = value ?? null;
    this.#loop.update();
  }
```

5. In `connect`: `action` chiama `this.#onAction(name)` invece di emettere; `note: el('p', { class: 'note', role: 'status' }),` in `Parts`; `this.append(parts.bar, parts.note);`.
6. Dopo `connect`:

```ts
  disconnectedCallback(): void {
    super.disconnectedCallback();
    // La barra sparita (proposta scartata o applicata) non ricorda la nota.
    this.#note = null;
  }

  /** Un pulsante attivato: se l'azione non è possibile la nota dice perché, altrimenti l'azione sale e la nota se ne va. */
  #onAction(action: ReviewAction): void {
    const key = actionBlocker(action, this.#status, this.#acceptBlocker);
    this.#note = key ? { action, key } : null;
    this.#loop.update();
    if (!key) emit(this, 'hmd-ai-review-action', { action });
  }
```

(lo stato si salva e si rende **prima** di emettere). 7. Nel render: via `const busy = …`, le due righe `parts.previous.disabled`/`parts.next.disabled` e le due `parts.discard.disabled`/`parts.acceptAll.disabled`; in fondo:

```ts
    // La nota resta finché vale la causa che l'ha prodotta (per quella azione); la stessa nota due volte di fila non si ri-annuncia: accettato.
    if (this.#note && actionBlocker(this.#note.action, this.#status, this.#acceptBlocker) !== this.#note.key) this.#note = null;
    setText(parts.note, this.#note ? t(this.#note.key) : '');
```

`src/elements/ai/review-bar.css`: `:scope { display: contents; }` diventa (con il commento «L'host ha un box: il bordo inferiore sta qui, sotto la riga dei pulsanti e la nota (variante A del design 6c).») `:scope { display: block; border-bottom: 1px solid var(--c-border); }`; via `border-bottom` da `.bar`; `.iconButton:hover:not(:disabled)` → `.iconButton:hover`; via la regola `.iconButton:disabled, .secondary:disabled`; in fondo allo scope:

```css
    /* Nota sotto la riga dei pulsanti (come le note della 6b): vuota non occupa spazio, i pixel restano quelli di prima. */
    .note {
      margin: 0;
      padding-inline: 12px;
      color: var(--c-muted);
      font-size: 12px;
    }

    .note:not(:empty) {
      padding-block: 0 8px;
    }
```

`src/elements/jsx.d.ts`: `canAccept: boolean; canDiscard: boolean` → `acceptBlocker: AcceptBlocker | null` (import `AcceptBlocker` da `../ai/aiController`). `src/ui/ai/ReviewView.tsx`: nel ramo senza proposta `canAccept={false} canDiscard={false}` → `acceptBlocker="generating"`; nel ramo con il diff `canAccept={controller.canAccept(p, true)} canDiscard={!isBusy(status)}` → `acceptBlocker={controller.acceptBlocker(p, true)}` (via l'import di `isBusy` se resta senza usi).

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/reviewBarView.test.ts src/elements/ai/review-bar.dom.test.ts src/architecture.test.ts` → PASS; `npm run lint` pulito.

- [ ] **Step 11: E2e nella forma nuova**

In `e2e/ai-review-bar.spec.ts` i primi due test del `describe('review bar')` diventano:

```ts
  test('while generating nothing is disabled: Previous, Next, Discard and Accept all say why in the note and keep the focus; the counter is a polite live region; the note goes with the proposal', async ({ app, ai, page }) => {
    await page.clock.install();
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    const counter = page.getByText(app.t('ai.generating', { seconds: 0 }).replace(/0 s$/, ''), { exact: false });
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAttribute('aria-live', 'polite');
    const note = page.getByRole('status').filter({ hasText: app.t('ai.review.generating') });
    for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) {
      await expect(button).toBeEnabled();
      await button.click();
      await expect(note).toBeVisible();
      await expect(button).toBeFocused();
    }
    expect(ai.requests).toBe(1);
    await page.clock.runFor(2100);
    await expect(page.getByText(app.t('ai.generating', { seconds: 2 }))).toBeVisible();
    ai.release();
    await proposalShown(app);
    await expect(counter).toHaveCount(0);
    await expect(note).toHaveCount(0);
    for (const button of [previous(app), next(app), discard(app), acceptAll(app)]) await expect(button).toBeEnabled();
  });

  test('a truncated proposal: Accept all says to accept the changes one at a time and keeps the focus, the block buttons work; the note goes with the proposal', async ({ app, ai, page }) => {
    ai.finishReason = 'length';
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await proposalShown(app);
    await expect(page.getByText(app.t('ai.status.truncated'))).toBeVisible();
    const note = page.getByRole('status').filter({ hasText: app.t('ai.review.truncated') });
    await expect(acceptAll(app)).toBeEnabled();
    await acceptAll(app).click();
    await expect(note).toBeVisible();
    await expect(acceptAll(app)).toBeFocused();
    expect(await page.locator('.cm-mergeView').count()).toBe(1);
    await expect(page.locator('.cm-merge-revert button[data-action=accept]').first()).toBeEnabled();
    await discard(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(note).toHaveCount(0);
  });
```

Dopo: `git grep -n "toBeDisabled()" -- e2e/ai-review-bar.spec.ts` → nessuna riga. Run: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts --repeat-each=3` → 30/30.

- [ ] **Step 12: Stato di audit con la nota**

In `e2e/computed-styles.audit.ts`, dopo `ai-review-applied`:

```ts
  {
    name: 'ai-review-note',
    async setup(app, page, ai) {
      // Generazione tenuta, clic su Accetta tutto: il pulsante resta attivo e la nota sotto la riga dice perché (spec §2 vincolo 4).
      await page.clock.install({ time: NOW });
      ai.hold();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
      await page.clock.runFor(2100);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
      await page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: app.t('ai.review.generating') })).toBeVisible();
    },
  },
```

e nei commenti degli stati `ai-review-generating` e `ai-review-truncated` «tutti i pulsanti spenti» / «Accetta tutto spento, Scarta acceso» → «tutti i pulsanti attivi (dalla 6c)» / «Accetta tutto attivo (dalla 6c: la nota al clic)».

- [ ] **Step 13: Verifica, snapshot invariati e `dist-baseline/` ricostruita**

```bash
npm test                    # 952 + 3 + 3 = 958
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e        # 186: lo snapshot «AI review» (light e dark) passa SENZA rigenerare (nota vuota a 0 px, misurato nel prototipo)
git status --short e2e/__screenshots__   # vuoto
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev    # 171
```

Il `p.note` in più sposta gli indici del DOM dei 5 stati `ai-review*` con la barra (`ai-review`, `ai-review-hover`, `ai-review-conflict`, `ai-review-generating`, `ai-review-truncated`, `ai-review-warnings`: tutti quelli in cui la barra c'è) e lo stato nuovo non è raggiungibile sulla build vecchia: si prova il resto con `--grep-invert`, poi si ricostruisce la baseline (cambio d'aspetto voluto, regola di `CLAUDE.md`):

```bash
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts --grep-invert "ai-review"   # tutto il resto identico (il filtro direttamente a playwright)
npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit  # 114 + 2 = 116
pgrep -af "vite|chrom|playwright"
```

- [ ] **Step 14: Commit**

```bash
git add src/elements/ src/ui/ai/ReviewView.tsx e2e/ai-review-bar.spec.ts e2e/computed-styles.audit.ts
git commit -m "feat: i pulsanti della barra di revisione non si disattivano mai, la nota sotto la riga dice perché (generazione, aggiornamento, conflitto, selezione persa, troncata)"
```

---

### Task 4: `hmd-ai-review` (LAB-12)

La vista della revisione come custom element: crea una volta barra, `hmd-editor` e `hmd-ai-diff-pane`, passa loro le proprietà prima dell'inserimento e li inserisce o toglie secondo il ramo (senza proposta: suggerimento o barra della generazione + editor semplice; proposta applicata: solo l'editor semplice; altrimenti barra, anteprima della risposta in arrivo e diff). Il focus segue l'editor della vista mostrata quando il nodo che lo aveva sparisce (decisione 4: `RenderLoop` con `refocus`) e quando era sul `body` (la regola dell'effetto di ReviewView.tsx). `WorkspaceView.tsx` monta `<hmd-ai-review controller doc i18n />`; `ReviewView.tsx`, `ReviewView.module.css` e `reviewDoc.ts` spariscono.

**Files:**
- Create: `src/elements/ai/reviewView.ts`, `reviewView.test.ts`, `review.element.ts`, `review.css`, `review.dom.test.ts`
- Modify: `src/elements/define.ts`, `jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/ai/ReviewView.tsx`, `ReviewView.module.css`, `reviewDoc.ts`

**Interfaces:**
- Produces: `ReviewDoc` (spostata da `ui/ai/reviewDoc.ts`), `ReviewController = Pick<AiController, 'subscribe' | 'getState' | 'proposalText' | 'acceptBlocker' | 'canAccept' | 'beforeAccept' | 'edited' | 'discard' | 'continue'>`, `ReviewModel`, `reviewModel(state, doc, elapsedSeconds, controller)`, `elapsedSeconds(running, now)`, `editedProposal(proposal, docText, next)`, `acceptNeedsConfirm(proposal, docText)`; `HmdAiReview` con `controller`, `doc`, `i18n`, nessun evento proprio.

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/reviewView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { AcceptBlocker, AiState } from '../../ai/aiController';
import type { ChatMessage, Proposal } from '../../ai/types';
import { acceptNeedsConfirm, editedProposal, elapsedSeconds, reviewModel } from './reviewView';

const proposal = (extra: Partial<Proposal> = {}): Proposal => ({ path: 'a.md', baseText: 'A', text: 'B', origin: 'ai', status: 'complete', snapshotTaken: false, createdAt: 1, ...extra });
const state = (extra: Partial<AiState> = {}): AiState =>
  ({ chat: { id: 'c', messages: [], overrides: {} }, proposals: new Map(), running: null, profiles: [], presets: [], profileId: '', error: null, streamingPreview: null, ...extra }) as AiState;
const controller = (blocker: AcceptBlocker | null = null, text: string | null | undefined = undefined) => ({
  proposalText: (p: Proposal) => (text === undefined ? p.text : text),
  acceptBlocker: () => blocker,
});
const doc = { path: 'a.md', text: 'A' };

test('no proposal: plain editor, no bar; while generating on this document the bar is there with the counter', () => {
  const idle = reviewModel(state(), doc, 0, controller());
  assert.equal(idle.view, 'plain');
  assert.equal(idle.bar, false);
  assert.equal(idle.hint, true);
  assert.equal(idle.text, 'A');
  assert.equal(idle.streaming, true);
  const busy = reviewModel(state({ running: { messageId: 'm', path: 'a.md', startedAt: 0 } }), doc, 4, controller());
  assert.deepEqual(busy.status, { kind: 'generating', seconds: 4 });
  assert.equal(busy.bar, true);
  assert.equal(busy.hint, false);
  assert.equal(busy.view, 'plain');
  assert.equal(busy.acceptBlocker, 'generating');
  const other = reviewModel(state({ running: { messageId: 'm', path: 'b.md', startedAt: 0 } }), doc, 4, controller());
  assert.equal(other.bar, false);
});

test('a proposal that differs from the document: diff with the bar, the text applied, the warnings of the last reply on this document', () => {
  const warnings = [{ code: 'wikilinks' }];
  const messages: ChatMessage[] = [
    { id: '1', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings: [{ code: 'code' }] },
    { id: '2', role: 'assistant', text: '', docPath: 'b.md', status: 'done', warnings: [{ code: 'urls' }] },
    { id: '3', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings },
  ];
  const m = reviewModel(state({ proposals: new Map([['a.md', proposal()]]), chat: { id: 'c', messages, overrides: {} } }), doc, 0, controller());
  assert.equal(m.view, 'diff');
  assert.equal(m.bar, true);
  assert.equal(m.applied, false);
  assert.equal(m.streaming, false);
  assert.deepEqual(m.status, { kind: 'none' });
  assert.equal(m.text, 'B');
  assert.deepEqual(m.warnings, warnings);
  assert.equal(m.range, null);
  assert.equal(m.acceptBlocker, null);
});

test('the proposal applied (same text as the document): plain editor without the bar; still the diff if the status says more', () => {
  const applied = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'A' })]]) }), doc, 0, controller());
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.status, { kind: 'applied' });
  assert.equal(applied.view, 'plain');
  assert.equal(applied.bar, false);
  assert.equal(applied.hint, false);
  const partial = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'A', status: 'partial' })]]) }), doc, 0, controller());
  assert.equal(partial.applied, true);
  assert.deepEqual(partial.status, { kind: 'partial' });
  assert.equal(partial.view, 'diff');
});

test('a proposal on a selection: the range in the proposal, the text applied by the controller, read-only when the selection is lost', () => {
  const scope = { from: 2, to: 5, originalText: 'BAD', status: 'valid' as const };
  const p = proposal({ text: 'GOOD', scope });
  const m = reviewModel(state({ proposals: new Map([['a.md', p]]) }), { path: 'a.md', text: 'x BAD y' }, 0, controller(null, 'x GOOD y'));
  assert.deepEqual(m.range, { from: 2, to: 6 });
  assert.equal(m.text, 'x GOOD y');
  assert.equal(m.streaming, false);
  const lost = reviewModel(state({ proposals: new Map([['a.md', proposal({ text: 'GOOD', scope: { ...scope, status: 'lost' } })]]) }), { path: 'a.md', text: 'x BAD y' }, 0, controller('scopeLost', null));
  assert.deepEqual(lost.status, { kind: 'scopeLost' });
  assert.equal(lost.streaming, true);
  assert.equal(lost.text, 'GOOD');
  assert.equal(lost.acceptBlocker, 'scopeLost');
});

test('elapsed seconds from the start of the run, zero without a run', () => {
  assert.equal(elapsedSeconds(null, 5000), 0);
  assert.equal(elapsedSeconds({ messageId: 'm', path: 'a.md', startedAt: 1000 }, 4999), 3);
});

test('the hand-edited proposal: whole text, or only the part inside the selection', () => {
  assert.equal(editedProposal(proposal(), 'A', 'edited'), 'edited');
  const scoped = proposal({ scope: { from: 2, to: 5, originalText: 'BAD', status: 'valid' } });
  assert.equal(editedProposal(scoped, 'x BAD y', 'x GOOD y'), 'GOOD');
  const atEnd = proposal({ scope: { from: 2, to: 5, originalText: 'BAD', status: 'valid' } });
  assert.equal(editedProposal(atEnd, 'x BAD', 'x GOOD'), 'GOOD');
});

test('Accept all asks for confirmation only when the document changed after a whole-document proposal', () => {
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A' }), 'A'), false);
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A' }), 'A!'), true);
  assert.equal(acceptNeedsConfirm(proposal({ baseText: 'A', scope: { from: 0, to: 1, originalText: 'A', status: 'valid' } }), 'A!'), false);
});
```

`src/elements/ai/review.dom.test.ts` (CodeMirror e MergeView girano con `codemirrorEnv`; un `await tick()` dopo il montaggio lascia al diff il suo primo disegno; **`focusOn` al posto di `assert.equal` tra nodi**, come nella barra):

```ts
import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import type { ChatMessage, Proposal } from '../../ai/types';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import type { ReviewDoc } from './reviewView';

installPopoverStub();
installDialogStub();

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Il focus è su `node`. Mai `assert.equal` tra nodi di jsdom: il messaggio del RED (util.inspect dell'albero) non finisce più. */
const focusOn = (node: Element | null | undefined, what: string) => assert.ok(!!node && document.activeElement === node, `focus on ${what}, not on ${document.activeElement?.localName}.${document.activeElement?.className}`);
const ORIGINAL = 'A\n\nB\n\nC';
const proposal = (extra: Partial<Proposal> = {}): Proposal => ({ path: 'a.md', baseText: ORIGINAL, text: 'A2\n\nB\n\nC2', origin: 'ai', status: 'complete', snapshotTaken: false, createdAt: 1, ...extra });

function mount(initial: Partial<AiState> = {}, docExtra: Partial<ReviewDoc> = {}) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.emptyProposal': 'SCRIVI', 'ai.discard': 'SCARTA' } }),
      persist() {},
    }),
  );
  const ai = fakeAi(initial);
  const changes: unknown[] = [];
  const selections: unknown[] = [];
  const doc: ReviewDoc = {
    path: 'a.md',
    text: ORIGINAL,
    resetKey: 'a.md#1',
    session: createDocSession('a.md#1', ORIGINAL),
    restore: null,
    readOnly: false,
    getDocs: () => [],
    saveImage: async () => null,
    docChanged: (c, texts) => changes.push([c, texts]),
    selectionChanged: (range) => selections.push(range),
    ...docExtra,
  };
  const el = document.createElement('hmd-ai-review');
  el.controller = ai;
  el.doc = doc;
  el.i18n = i18n;
  document.body.append(el);
  const section = () => el.firstElementChild as HTMLElement;
  const children = () => [...section().children].map((c) => `${c.localName}${c.className ? '.' + c.className : ''}`);
  const bar = () => el.querySelector('hmd-ai-review-bar')!;
  const editor = () => el.querySelector('hmd-editor')!;
  const diff = () => el.querySelector('hmd-ai-diff-pane')!;
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('hmd-ai-review-bar button')].find((b) => b.textContent === label)!;
  const docSide = () => el.querySelector<HTMLElement>('.cm-mergeView .cm-content')!;
  return { el, ai, i18n, listeners, doc, changes, selections, section, children, bar, editor, diff, button, docSide };
}

test('without a proposal: the same DOM as ReviewView.tsx, hint and plain editor with the document; no bar', () => {
  const { el, children, editor, section } = mount();
  assert.equal(section().className, 'review');
  assert.deepEqual(children(), ['p.hint', 'div.editor']);
  assert.equal(section().querySelector('.hint')!.textContent, EN_MESSAGES['ai.emptyProposal']);
  assert.equal(editor().parentElement!.className, 'editor');
  assert.equal(editor().text, ORIGINAL);
  assert.equal(editor().resetKey, 'a.md#1');
  assert.equal(editor().i18n, el.i18n);
  assert.equal(el.querySelector('.cm-content')!.textContent, ORIGINAL.replaceAll('\n', ''));
});

test('generating on this document without a proposal: the bar with the counter replaces the hint, everything off', () => {
  const { children, bar, ai } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() - 3000 } });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'div.editor']);
  assert.equal(bar().status.kind, 'generating');
  assert.equal((bar().status as { seconds: number }).seconds, 3);
  assert.equal(bar().acceptBlocker, 'generating');
  assert.equal(bar().querySelector('.status')!.textContent, EN_MESSAGES['ai.generating'].replace('{seconds}', '3'));
  ai.set({ running: null });
  assert.deepEqual(children(), ['p.hint', 'div.editor']);
});

test('with a proposal: the bar and the diff with the proposal, the warnings of the last reply, the flags from the controller', async () => {
  const messages: ChatMessage[] = [{ id: '1', role: 'assistant', text: '', docPath: 'a.md', status: 'done', warnings: [{ code: 'wikilinks' }] }];
  const { children, bar, diff, ai } = mount({ proposals: new Map([['a.md', proposal()]]), chat: { id: 'c', messages, overrides: {} } });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'hmd-ai-diff-pane']);
  assert.deepEqual(bar().warnings, [{ code: 'wikilinks' }]);
  assert.equal(bar().acceptBlocker, null);
  assert.equal(diff().proposal, 'A2\n\nB\n\nC2');
  assert.equal(diff().streaming, false);
  assert.equal(diff().canAccept, true);
  await tick();
  assert.ok(diff().querySelector('.cm-mergeView'));
  // Il controller non accetta: i due flag seguono.
  ai.blocker = 'conflict';
  ai.set({});
  assert.equal(bar().acceptBlocker, 'conflict');
  assert.equal(diff().canAccept, false);
  // Anteprima della risposta in arrivo tra la barra e il diff.
  ai.set({ streamingPreview: 'in arrivo' });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'details.stream', 'hmd-ai-diff-pane']);
  assert.equal(document.querySelector('.stream pre')!.textContent, 'in arrivo');
  assert.equal(document.querySelector('.stream summary')!.textContent, EN_MESSAGES['ai.streamingPreview']);
  ai.set({ streamingPreview: null });
  assert.deepEqual(children(), ['hmd-ai-review-bar', 'hmd-ai-diff-pane']);
});

test('the proposal applied: plain editor without the bar; the bar arrows, Discard and Continue reach the diff and the controller', async () => {
  const { children, ai, button, diff } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  const calls: string[] = [];
  const pane = diff();
  pane.previous = () => void calls.push('previous');
  pane.next = () => void calls.push('next');
  [...pane.parentElement!.querySelectorAll<HTMLButtonElement>('hmd-ai-review-bar .iconButton')].forEach((b) => b.click());
  assert.deepEqual(calls, ['previous', 'next']);
  button(EN_MESSAGES['ai.discard']).click();
  assert.deepEqual(ai.calls, [['discard', 'a.md']]);
  ai.set({ proposals: new Map([['a.md', proposal({ status: 'partial' })]]) });
  button(EN_MESSAGES['ai.continue']).click();
  assert.deepEqual(ai.calls.at(-1), ['continue', 'a.md']);
  ai.set({ proposals: new Map([['a.md', proposal({ text: ORIGINAL })]]) });
  assert.deepEqual(children(), ['div.editor']);
});

test('Accept all: beforeAccept(p, true) then the whole text into the document as one transaction (hmd-doc-change)', async () => {
  const { ai, button, changes, docSide } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  button(EN_MESSAGES['ai.acceptAll']).click();
  assert.deepEqual(ai.calls, [['beforeAccept', 'a.md', true]]);
  assert.equal(docSide().textContent, 'A2BC2');
  assert.equal(changes.length, 1);
  assert.equal((changes[0] as [unknown, { after: string }])[1].after, 'A2\n\nB\n\nC2');
});

test('Accept all after the document changed: the confirmation dialog; confirmed it accepts, detached it closes', async () => {
  const { el, ai, button, docSide } = mount({ proposals: new Map([['a.md', proposal({ baseText: 'altro' })]]) });
  await tick();
  button(EN_MESSAGES['ai.acceptAll']).click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.open);
  assert.ok(dialog.textContent?.includes(EN_MESSAGES['ai.changedWarning']));
  assert.deepEqual(ai.calls, []);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.acceptAll'])!.click();
  await tick();
  assert.deepEqual(ai.calls, [['beforeAccept', 'a.md', true]]);
  assert.equal(docSide().textContent, 'A2BC2');
  // Staccato con il dialog aperto: il dialog se ne va.
  ai.set({ proposals: new Map([['a.md', proposal({ baseText: 'altro', text: 'X' })]]) });
  button(EN_MESSAGES['ai.acceptAll']).click();
  assert.ok(document.querySelector('dialog')!.open);
  el.remove();
  await tick();
  assert.equal(document.querySelector('dialog'), null);
});

test('a proposal edited in the diff reaches the controller; with a selection only the part inside it', async () => {
  const scope = { from: 0, to: 1, originalText: 'A', status: 'valid' as const };
  const { ai, diff } = mount({ proposals: new Map([['a.md', proposal({ text: 'Z', scope })]]) }, { text: 'A\n\nB\n\nC' });
  ai.proposalTextValue = 'Z\n\nB\n\nC';
  ai.set({});
  await tick();
  assert.equal(diff().proposal, 'Z\n\nB\n\nC');
  diff().dispatchEvent(new CustomEvent('hmd-ai-proposal-edit', { detail: { text: 'ZZ\n\nB\n\nC' }, bubbles: true }));
  assert.deepEqual(ai.calls, [['edited', 'a.md', 'ZZ']]);
});

test('Discard with the focus on the button: the focus goes into the plain editor, not the body (the fix of 6c)', async () => {
  const { ai, button, editor } = mount({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  const discard = button(EN_MESSAGES['ai.discard']);
  discard.focus();
  focusOn(discard, 'Discard');
  discard.click();
  ai.set({ proposals: new Map() });
  focusOn(editor().querySelector('.cm-content'), 'the plain editor');
});

test('a view change with the focus already on the body focuses the new editor (the effect of ReviewView.tsx); elsewhere it stays', async () => {
  const { ai, diff } = mount();
  focusOn(document.body, 'the body');
  ai.set({ proposals: new Map([['a.md', proposal()]]) });
  await tick();
  focusOn(diff().querySelector('.cm-content'), 'the document side of the diff');
  const outside = document.body.appendChild(document.createElement('button'));
  outside.focus();
  ai.set({ proposals: new Map() });
  focusOn(outside, 'the outside button');
});

test('typing in the plain editor reaches docChanged and selectionChanged; a language change rewrites the hint; detached nothing stays', async () => {
  const { el, i18n, listeners, changes, selections, section } = mount();
  await tick();
  assert.equal(selections.length, 1);
  await i18n.setLocale('it');
  assert.equal(section().querySelector('.hint')!.textContent, 'SCRIVI');
  assert.equal(listeners(), 1);
  assert.equal(changes.length, 0);
  el.remove();
  assert.equal(listeners(), 0);
});

test('the seconds counter stops at detach and follows a new run', async () => {
  const { el, ai, bar } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() } });
  assert.equal((bar().status as { seconds: number }).seconds, 0);
  el.remove();
  ai.set({ running: { messageId: 'n', path: 'a.md', startedAt: Date.now() - 5000 } });
  document.body.append(el);
  assert.equal((bar().status as { seconds: number }).seconds, 5);
});

test('generation finishes with the focus in the retained bar (Accept all): the focus follows the new diff, as the [view] effect of ReviewView.tsx', async () => {
  const { ai, button, diff } = mount({ running: { messageId: 'm', path: 'a.md', startedAt: Date.now() } });
  const accept = button(EN_MESSAGES['ai.acceptAll']);
  accept.focus();
  focusOn(accept, 'Accept all');
  ai.set({ running: null, proposals: new Map([['a.md', proposal()]]) });
  await tick();
  focusOn(diff().querySelector('.cm-content'), 'the document side of the diff');
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test --test-timeout=20000 src/elements/ai/reviewView.test.ts src/elements/ai/review.dom.test.ts` → cadono (`Cannot find module './reviewView'`; `hmd-ai-review` non definito). Annotare. (`--test-timeout` sempre: un test della vista che resta appeso su un nodo di CodeMirror si vede subito.)

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/ai/reviewView.ts`:

```ts
import type { ChangeDesc } from '@codemirror/state';

import type { AcceptBlocker, AiController, AiState } from '../../ai/aiController';
import { reviewStatus, type ReviewStatus } from '../../ai/reviewStatus';
import type { TextRange } from '../../ai/selectionChip';
import type { CheckWarning, Proposal } from '../../ai/types';
import type { DocSession } from '../../editor/docSession';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';

/** Il documento aperto come lo riceve la revisione AI (era `ui/ai/reviewDoc.ts`), per l'editor semplice e per il lato documento del diff. */
export interface ReviewDoc {
  path: string;
  text: string;
  resetKey: string;
  session: DocSession;
  restore: RestoreCommand | null;
  readOnly: boolean;
  getDocs(): DocTitle[];
  saveImage(file: File): Promise<string | null>;
  docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void;
  selectionChanged(range: TextRange | null): void;
}

/** Quello che la vista della revisione usa del controller. */
export type ReviewController = Pick<AiController, 'subscribe' | 'getState' | 'proposalText' | 'acceptBlocker' | 'canAccept' | 'beforeAccept' | 'edited' | 'discard' | 'continue'>;

/** Cosa mostra la vista, calcolato come nel corpo di ReviewView.tsx. */
export interface ReviewModel {
  proposal: Proposal | undefined;
  warnings: CheckWarning[];
  /** Testo della proposta applicato al documento (o il documento stesso senza proposta). */
  text: string;
  applied: boolean;
  status: ReviewStatus;
  /** Proposta in sola lettura nel diff: nessuna proposta, generazione in corso o selezione persa. */
  streaming: boolean;
  range: TextRange | null;
  view: 'plain' | 'diff';
  /** La barra c'è: nel diff sempre, nell'editor semplice solo durante la generazione senza proposta. */
  bar: boolean;
  /** Il suggerimento «Scrivi una richiesta…» sopra l'editor semplice: senza proposta e senza barra (una proposta applicata non lo mostra). */
  hint: boolean;
  acceptBlocker: AcceptBlocker | null;
}

export function reviewModel(
  state: AiState,
  doc: Pick<ReviewDoc, 'path' | 'text'>,
  elapsedSeconds: number,
  controller: Pick<ReviewController, 'proposalText' | 'acceptBlocker'>,
): ReviewModel {
  const proposal = state.proposals.get(doc.path);
  const warnings = [...state.chat.messages].reverse().find((m) => m.role === 'assistant' && m.docPath === doc.path)?.warnings ?? [];
  const text = proposal ? (controller.proposalText(proposal) ?? proposal.text) : doc.text;
  const applied = !!proposal && proposal.status !== 'streaming' && text === doc.text;
  const status = reviewStatus({ path: doc.path, proposal, running: state.running, elapsedSeconds, applied });
  const streaming = !proposal || status.kind === 'generating' || status.kind === 'scopeLost';
  const range = proposal?.scope ? { from: proposal.scope.from, to: proposal.scope.from + proposal.text.length } : null;
  const view: 'plain' | 'diff' = !proposal || (applied && status.kind === 'applied') ? 'plain' : 'diff';
  const bar = view === 'diff' || (!proposal && status.kind === 'generating');
  const hint = !proposal && !bar;
  const acceptBlocker = proposal ? controller.acceptBlocker(proposal, true) : 'generating';
  return { proposal, warnings, text, applied, status, streaming, range, view, bar, hint, acceptBlocker };
}

/** Secondi dall'inizio della generazione (il contatore della barra). */
export function elapsedSeconds(running: AiState['running'], now: number): number {
  return running ? Math.floor((now - running.startedAt) / 1000) : 0;
}

/** La proposta modificata a mano: con una selezione, solo il tratto dentro il documento (come `edit` di ReviewView.tsx). */
export function editedProposal(proposal: Proposal, docText: string, next: string): string {
  if (!proposal.scope) return next;
  const suffix = docText.length - proposal.scope.to;
  return next.slice(proposal.scope.from, suffix ? next.length - suffix : undefined);
}

/** «Accetta tutto» chiede conferma solo se il documento è cambiato dopo la proposta e la proposta è sull'intero documento. */
export function acceptNeedsConfirm(proposal: Proposal, docText: string): boolean {
  return docText !== proposal.baseText && !proposal.scope;
}
```

`src/elements/ai/review.element.ts`:

```ts
import type { AiState } from '../../ai/aiController';
import type { Proposal } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import type { HmdEditor } from '../editor/editor.element';
import type { HmdAiDiffPane } from './diff-pane.element';
import type { HmdAiReviewBar } from './review-bar.element';
import type { ReviewAction } from './reviewBarView';
import { acceptNeedsConfirm, editedProposal, elapsedSeconds, reviewModel, type ReviewController, type ReviewDoc } from './reviewView';
import './review.css';

interface Parts {
  section: HTMLElement;
  hint: HTMLParagraphElement;
  editorBox: HTMLDivElement;
  editor: HmdEditor;
  bar: HmdAiReviewBar;
  stream: HTMLDetailsElement;
  streamSummary: HTMLElement;
  streamPre: HTMLPreElement;
  diff: HmdAiDiffPane;
}

/**
 * Revisione della proposta AI (era ReviewView.tsx): editor semplice senza proposta (con la barra durante
 * la generazione) o quando la proposta è già applicata; altrimenti la barra, l'anteprima della risposta in
 * arrivo (proposta ritoccata a mano) e il diff. Crea i figli `hmd-*` e passa loro le proprietà prima
 * dell'inserimento. Passando tra diff ed editor semplice il focus segue l'editor nuovo, se prima era nella
 * revisione o sul body (come l'effetto di ReviewView.tsx): così il Ctrl+Z successivo arriva ancora a
 * CodeMirror, e «Scarta» con il focus sul pulsante lascia il focus nell'editor, non sul body.
 */
export class HmdAiReview extends HmdElement {
  #controller: ReviewController | null = null;
  #doc: ReviewDoc | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #elapsed = 0;
  /** Contatore dei secondi legato al run in corso (l'effetto `[state.running]` di ReviewView.tsx). */
  #timer: { running: NonNullable<AiState['running']>; id: ReturnType<typeof setInterval> } | null = null;
  #shownView: 'plain' | 'diff' | null = null;
  /** I dialog aperti da qui si chiudono al distacco. */
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#doc && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#doc!, this.#i18n!),
    focusScope: () => this.#parts?.section ?? null,
    // Il nodo con il focus è sparito (Scarta o Accetta tutto dalla barra, la barra che se ne va): il focus va nell'editor della vista mostrata.
    refocus: () => this.#focusEditor(),
  });

  get controller(): ReviewController | null { return this.#controller; }
  set controller(value: ReviewController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  /** Il documento aperto: un oggetto nuovo a ogni render di React, i campi si confrontano nel render. */
  get doc(): ReviewDoc | null { return this.#doc; }
  set doc(value: ReviewDoc | null) {
    this.#doc = value ?? null;
    this.#update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const streamSummary = el('summary');
      const streamPre = el('pre');
      const docEvents = {
        'hmd-doc-change': (event: HTMLElementEventMap['hmd-doc-change']) => this.#doc?.docChanged(event.detail.changes, event.detail),
        'hmd-selection': (event: HTMLElementEventMap['hmd-selection']) => this.#doc?.selectionChanged(event.detail.range),
      };
      const parts: Parts = {
        section: el('section', { class: 'review' }),
        hint: el('p', { class: 'hint' }),
        editorBox: el('div', { class: 'editor' }),
        editor: el('hmd-editor', { on: docEvents }),
        bar: el('hmd-ai-review-bar', {
          on: {
            'hmd-ai-review-action': (event) => this.#onAction(event.detail.action),
            'hmd-ai-review-warning': (event) => this.#parts?.diff.scrollToLine((event.detail.warning as { line?: number }).line ?? 0),
          },
        }),
        stream: el('details', { class: 'stream' }, streamSummary, streamPre),
        streamSummary,
        streamPre,
        diff: el('hmd-ai-diff-pane', {
          on: {
            ...docEvents,
            'hmd-ai-proposal-edit': (event) => this.#edit(event.detail.text),
            'hmd-ai-all-rejected': () => this.#discard(),
          },
        }),
      };
      // Letta al mousedown di «accetta» di un blocco, sulla proposta di quel momento (come la closure di ReviewView.tsx).
      parts.diff.beforeAccept = () => {
        const p = this.#current();
        return !!p && !!this.#controller?.beforeAccept(p);
      };
      parts.editorBox.append(parts.editor);
      this.#parts = parts;
      this.append(parts.section);
    }
    this.#dialogs ??= new AbortController();
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#onState(controller), signal);
    this.watch(i18n, () => this.#update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTimer();
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Il contatore dei secondi segue il run in corso: parte, si ferma e riparte con lui. */
  #onState(controller: ReviewController): void {
    const running = controller.getState().running;
    if (running !== (this.#timer?.running ?? null)) {
      this.#stopTimer();
      if (running) {
        const tick = () => {
          this.#elapsed = elapsedSeconds(running, Date.now());
          this.#update();
        };
        this.#elapsed = elapsedSeconds(running, Date.now());
        this.#timer = { running, id: setInterval(tick, 1000) };
      } else {
        this.#elapsed = 0;
      }
    }
    this.#update();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer.id);
    this.#timer = null;
  }

  /**
   * Un render, più la regola dell'effetto `[view]` di ReviewView.tsx: quando la vista cambia (diff ↔ editor
   * semplice) e il focus era sul body o dentro la revisione (anche su un pulsante della barra che resta, per
   * esempio Accetta tutto quando arriva la proposta), il focus va nell'editor della vista nuova. Il recupero
   * del `RenderLoop` copre a parte il nodo con il focus che sparisce senza cambio di vista.
   */
  #update(): void {
    const doc = this.ownerDocument;
    const active = doc.activeElement;
    const inReview = active === doc.body || !!this.#parts?.section.contains(active);
    const before = this.#shownView;
    this.#loop.update();
    if (inReview && before !== null && before !== this.#shownView && this.isConnected) this.#focusEditor();
  }

  #focusEditor(): void {
    const parts = this.#parts;
    if (!parts) return;
    if (this.#shownView === 'plain') parts.editor.focus();
    else parts.diff.focus();
  }

  #current(): Proposal | undefined {
    const doc = this.#doc;
    return doc ? this.#controller?.getState().proposals.get(doc.path) : undefined;
  }

  #onAction(action: ReviewAction): void {
    const parts = this.#parts;
    const controller = this.#controller;
    const doc = this.#doc;
    if (!parts || !controller || !doc) return;
    switch (action) {
      case 'previous':
        return parts.diff.previous();
      case 'next':
        return parts.diff.next();
      case 'continue':
        return void controller.continue(doc.path);
      case 'discard':
        return this.#discard();
      case 'acceptAll':
        return this.#acceptAll();
    }
  }

  #discard(): void {
    const p = this.#current();
    if (p) this.#controller?.discard(p.path);
  }

  /** «Accetta tutto»: con il documento cambiato dopo una proposta intera chiede conferma; la conferma accetta la proposta del momento in cui risponde. */
  #acceptAll(): void {
    const p = this.#current();
    const doc = this.#doc;
    const t = this.#i18n?.t;
    if (!p || !doc || !t) return;
    if (!acceptNeedsConfirm(p, doc.text)) return this.#accept();
    void showConfirmDialog({ title: t('ai.acceptAll'), message: t('ai.changedWarning'), confirmLabel: t('ai.acceptAll'), t, signal: this.#dialogs?.signal }).then(
      (ok) => ok && this.#accept(),
    );
  }

  #accept(): void {
    const p = this.#current();
    const controller = this.#controller;
    if (!p || !controller || !controller.beforeAccept(p, true)) return;
    const next = controller.proposalText(p);
    if (next !== null) this.#parts?.diff.replace(next);
  }

  /** Proposta ritoccata nel diff: con una selezione, al controller arriva solo il tratto. */
  #edit(text: string): void {
    const p = this.#current();
    const doc = this.#doc;
    if (p && doc) this.#controller?.edited(p.path, editedProposal(p, doc.text, text));
  }

  #render(parts: Parts, controller: ReviewController, doc: ReviewDoc, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const m = reviewModel(state, doc, this.#elapsed, controller);
    // Le stesse proprietà per l'editor semplice e per il lato documento del diff, prima dell'inserimento e solo se cambiano.
    for (const target of [parts.editor, parts.diff]) {
      if (target.text !== doc.text) target.text = doc.text;
      if (target.resetKey !== doc.resetKey) target.resetKey = doc.resetKey;
      if (target.session !== doc.session) target.session = doc.session;
      if (target.restore !== doc.restore) target.restore = doc.restore;
      if (target.readOnly !== doc.readOnly) target.readOnly = doc.readOnly;
      if (target.getDocs !== doc.getDocs) target.getDocs = doc.getDocs;
      if (target.saveImage !== doc.saveImage) target.saveImage = doc.saveImage;
      if (target.i18n !== i18n) target.i18n = i18n;
    }
    const { bar, diff } = parts;
    if (bar.i18n !== i18n) bar.i18n = i18n;
    bar.status = m.status;
    if (bar.warnings !== m.warnings) bar.warnings = m.warnings;
    bar.acceptBlocker = m.acceptBlocker;
    if (diff.proposal !== m.text) diff.proposal = m.text;
    if (diff.range?.from !== m.range?.from || diff.range?.to !== m.range?.to) diff.range = m.range;
    const canAcceptBlock = m.proposal ? controller.canAccept(m.proposal) : false;
    if (diff.canAccept !== canAcceptBlock) diff.canAccept = canAcceptBlock;
    if (diff.streaming !== m.streaming) diff.streaming = m.streaming;
    setText(parts.hint, t('ai.emptyProposal'));
    setText(parts.streamSummary, t('ai.streamingPreview'));
    setText(parts.streamPre, state.streamingPreview ?? '');
    // I figli della sezione nell'ordine di ReviewView.tsx: si tolgono quelli di troppo, si inseriscono i mancanti, nessuno si sposta.
    const wanted: Element[] = m.view === 'plain' ? [...(m.bar ? [bar] : m.hint ? [parts.hint] : []), parts.editorBox] : [bar, ...(state.streamingPreview ? [parts.stream] : []), diff];
    for (const node of [parts.hint, parts.editorBox, bar, parts.stream, diff]) if (!wanted.includes(node) && node.parentNode === parts.section) node.remove();
    let cursor: Element | null = parts.section.firstElementChild;
    for (const node of wanted) {
      if (node === cursor) cursor = cursor.nextElementSibling;
      else parts.section.insertBefore(node, cursor);
    }
    this.#shownView = m.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-review': HmdAiReview;
  }
}
```

(`bar.status` e `bar.acceptBlocker` si assegnano a ogni render senza confronto: `status` è un oggetto nuovo di `reviewStatus()`, e il setter della barra passa dal suo `RenderLoop` che non fa nulla di visibile se niente cambia. La barra, l'editor e il diff ricevono tutto **prima** di entrare nella sezione: `insertBefore` viene dopo.)

`src/elements/ai/review.css` (il limite inferiore lascia barra, editor e diff ai loro fogli: `hmd-editor` ha anch'esso una classe `.editor`):

```css
@layer components {
  /* Il limite inferiore lascia la barra, l'editor e il diff ai loro fogli (hmd-editor ha anch'esso una classe .editor). */
  @scope (hmd-ai-review) to (hmd-ai-review-bar, hmd-editor, hmd-ai-diff-pane) {
    :scope {
      display: contents;
    }

    /* Valori copiati da ReviewView.module.css (.review, .hint, .stream pre, .editor). */
    .review {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .hint {
      margin: 0;
      padding: 12px;
      border-bottom: 1px solid var(--c-border);
      color: var(--c-muted);
      font-size: 13px;
    }

    .stream pre {
      max-height: 15vh;
      overflow: auto;
      white-space: pre-wrap;
    }

    .editor {
      flex: 1;
      min-height: 0;
    }
  }
}
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test --test-timeout=20000 src/elements/ai/reviewView.test.ts src/elements/ai/review.dom.test.ts` → dopo lo Step 4 tutto PASS (12 test della vista).

**Prova del fix del focus (decisione 4), da annotare nel commento finale**: togliere la riga `refocus: () => this.#focusEditor(),` e rilanciare `review.dom.test.ts` → «Discard with the focus on the button…» cade con `focus on the plain editor, not on body.` (misurato nel prototipo: 1 su 11), gli altri passano; rimettere la riga. **Prova della regola `[view]`**: in `#update()` sostituire `inReview` con il solo `active === doc.body` → «generation finishes with the focus in the retained bar…» cade con `focus on the document side of the diff, not on button.secondary accept` (misurato nel prototipo); ripristinare → 12/12. Senza `refocus` la vista è ReviewView.tsx tale e quale: il difetto «focus sul body dopo Scarta» esiste quando il focus era sul pulsante che sparisce, e l'elemento lo copre per costruzione.

- [ ] **Step 4: Registrazione, tipi, `WorkspaceView.tsx` monta il tag**

`src/elements/define.ts`: `import { HmdAiReview } from './ai/review.element';` prima di quello di `HmdAiReviewBar`, e `['hmd-ai-review', HmdAiReview],` prima di `['hmd-ai-review-bar', HmdAiReviewBar],`.

`src/elements/jsx.d.ts`: via `import type { HmdAiDiffPane } from './ai/diff-pane.element';`, `import type { ReviewStatus }`, `import type { CheckWarning }`, `import type { AcceptBlocker }`, e le voci `'hmd-ai-diff-pane'` e `'hmd-ai-review-bar'` (React non li monta più); `import type { ReviewController, ReviewDoc } from './ai/reviewView';` dopo quello di `ModelSelectController`, e dopo `'hmd-ai-parameters'`:

```ts
      'hmd-ai-review': HmdProps<{ controller: ReviewController; doc: ReviewDoc; i18n: I18nStore }>;
```

(`HmdDocProps` resta: lo usa `hmd-editor`, montato da `WorkspaceView`; se `TextRange` resta senza usi nel file, via anche quello.)

`src/ui/WorkspaceView.tsx`: via `import { ReviewView } from './ai/ReviewView';`; il blocco `<ReviewView controller={ai} editor={{ … }} />` diventa `<hmd-ai-review controller={ai} i18n={i18nStore} doc={{ … }} />` con lo **stesso** oggetto letterale (`path`, `text`, `resetKey`, `session`, `restore`, `readOnly`, `getDocs`, `saveImage`, `docChanged`, `selectionChanged`): le due callback non cominciano per `on`, quindi React 19 le assegna come proprietà dentro `doc`. `i18nStore` è già nel file.

- [ ] **Step 5: Via `ReviewView.tsx`, `ReviewView.module.css`, `reviewDoc.ts`, controlli**

```bash
git rm src/ui/ai/ReviewView.tsx src/ui/ai/ReviewView.module.css src/ui/ai/reviewDoc.ts
grep -rnE "from '\./ai/ReviewView'|<ReviewView[ />]|ReviewView\.module|from '\./reviewDoc'|ui/ai/reviewDoc" src; echo "exit $?"   # atteso: exit 1 (i commenti «come ReviewView» nei test di editor e diff restano: parlano del comportamento)
grep -rn "<hmd-ai-review " src | wc -l        # 1: WorkspaceView.tsx
grep -rn "hmd-ai-diff-pane\|hmd-ai-review-bar" src/ui; echo "exit $?"   # atteso: exit 1 (React non li monta più)
ls src/ui/ai/                                  # restano useAiController.ts, useAiState.ts, settings/
```

- [ ] **Step 6: Verifica completa**

```bash
npm test                    # 958 + 7 + 12 = 977
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts e2e/ai-review.spec.ts e2e/ai-diff.spec.ts --repeat-each=3
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e        # 186, snapshot invariati
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev    # 171 (StrictMode: il focus dopo Accetta tutto, Scarta e Ctrl+Z)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit  # 116, nessuna differenza (l'host della vista è display: contents: stessi percorsi)
pgrep -af "vite|chrom|playwright"
```

- [ ] **Step 7: Commit**

```bash
git add src/elements/ src/ui/WorkspaceView.tsx
git commit -m "feat: hmd-ai-review al posto di ReviewView (figli creati una volta e inseriti secondo il ramo, focus nell'editor quando il nodo con il focus sparisce)"
```

---

### Task 5: Documenti, misure, chiusura (LAB-13)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, questo piano (sezione «Esecuzione»)
- Create: `docs/superpowers/notes/2026-10-xx-handover-fase-7.md`

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1 (prototipo: 439 717 → 441 030)
npm test                                    # annotare: 977
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: «fase 6b …; fasi 6c–8 ancora piano» → «fase 6c sul branch `epic/LAB-3-web-components`, in `main` al merge dell'epica; fasi 7–8 ancora piano» (adattare alla frase che c'è).
2. §7 «Fase 6», in fondo, dopo il punto «6b **fatta**…»: «- 6c **fatta**: `hmd-ai-review-bar` (eventi `hmd-ai-review-action { action }` e `hmd-ai-review-warning { warning }`; stato in `ai/reviewBarView.ts`: `statusLine`, `actionBlocker`), `hmd-ai-review` (crea barra, `hmd-editor` e `hmd-ai-diff-pane` una volta e li inserisce secondo il ramo; `ai/reviewView.ts`: `ReviewDoc`, `ReviewController`, `reviewModel`, `editedProposal`, `acceptNeedsConfirm`; contatore dei secondi e dialog di conferma legati all'elemento). `AiController` espone `sendBlocker()` e `acceptBlocker(p, all)` (`canAccept` ne deriva): il composer legge la ragione prima di svuotare la casella (chiavi `ai.composer.noDocument`, `ai.composer.updating`, `ai.composer.generating`), la bozza resta. Cambiato di proposito (decisione 3, regola di Davide, §2 vincolo 4): Precedente, Successivo, Scarta e Accetta tutto non si disattivano mai; una nota `role="status"` sotto la riga dei pulsanti dice perché (`ai.review.generating|updating|conflict|scopeLost|truncated|notAcceptable`), il focus resta sul pulsante; `dist-baseline/` ricostruita due volte (stato del composer senza documento; nota della barra), snapshot invariati. Cambiato di proposito (decisione 4): quando il nodo con il focus sparisce passando tra diff ed editor semplice il focus va nell'editor mostrato, non sul `body`. Audit esteso a generazione in corso, proposta troncata, popover degli avvisi, editor dopo Accetta tutto, le due note. In `src/ui/` restano `WorkspaceView`, `SettingsView` e le sezioni AI delle impostazioni (fase 7). Bundle principale gzip: <valore del Task 1> → <valore dello Step 1> B.»
3. §2 vincolo 4: «Applicata nella 6b a Invia e Nuova chat; da estendere alla 6c (barra della revisione) e alla fase 8» → «Applicata nella 6b a Invia e Nuova chat e nella 6c alla barra della revisione (con le ragioni del controller nel composer); da estendere alla fase 8 (passata di accessibilità: pulsanti dei blocchi nel diff, impostazioni, dialog)».
4. §13: aggiungere `docs/superpowers/plans/2026-10-11-housemd-wc-12-fase-6c-revisione.md` (fase 6c) dopo il piano 11.
5. In fondo alla sezione «Analisi del layer `vendor`» di questo piano non cambia niente; nel handover della fase 7 (Step 3) va il rimando.

- [ ] **Step 3: Nota di handover della fase**

`docs/superpowers/notes/2026-10-xx-handover-fase-7.md` (data del giorno), sul modello di `2026-10-11-handover-fase-6c.md`: stato (branch dell'epica e commit, suite, bundle, `dist-baseline/` = build dell'ultimo cambio voluto); cosa resta (fase 7: `SettingsView` e sezioni AI, `WorkspaceView`, `App`, via `jsx.d.ts`; fase 8: regola «mai disabled» estesa (pulsanti dei blocchi nel diff, impostazioni, dialog), Scarta = Ferma + scarta e doppio clic su Invia, il contatore dei secondi in live region da rivedere con A11y, «Continua» durante un aggiornamento, i tre `!important` di `diff-pane.css` → `StyleModule` come nell'analisi del layer `vendor` di questo piano, e il quarto in `docAppearance()`); regola UX; lezioni nuove di questa fase (**mai `assert.equal` tra nodi di jsdom**: il messaggio del RED non finisce più, usare `focusOn`/valori derivati; `--test-timeout` sui test con CodeMirror; `fakeAi` con `proposals` e `streamingPreview` nello stato di default; uno stato di audit irraggiungibile sulla build vecchia blocca tutto il progetto `current`: `--grep-invert` prima di ricostruire la baseline; con nessun documento aperto non si apre un documento restando in modalità AI); trappole dell'ambiente (RAM di ape: un solo worker, una suite alla volta, `flock`; i due snapshot dello start screen che cadono su ape per il font pixel).

- [ ] **Step 4: Verifica finale, in sequenza**

```bash
npm test
npm run lint
npm run build
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit
pgrep -af "vite|chrom|playwright"
git status --short
```

- [ ] **Step 5: Commit, PR pronta**

```bash
git add docs/
git commit -m "docs: spec e handover allineati alla fase 6c (barra e vista della revisione, ragioni dal controller)"
git push origin lab/LAB-4-fase-6c
gh pr ready <n>      # la PR in bozza aperta dal piano verso epic/LAB-3-web-components; nel corpo: riepilogo, come provare, elenco delle baseline ricostruite e degli snapshot (nessuno) rigenerati
```

Il merge in `epic/LAB-3-web-components` lo fa il PM dopo la review di Reviewer e A11y e i gate verdi; verso `main` c'è solo la PR dell'epica (Davide).

- [ ] **Step 6: Checklist manuale** (sub-issue «[Davide] …» già aperta per il focus di Scarta: LAB-38; le altre verifiche vanno nella stessa o in una sub-issue nuova se mancano). Chrome su Linux, server di sviluppo del worktree con `npx vite --port 5197 --strictPort --host 127.0.0.1` (StrictMode), cartella di prova in OPFS con `window.showDirectoryPicker` sostituito via script, Ollama finto sostituendo `window.fetch` per `localhost:11434` (chat in SSE con una risposta lenta e una con `finish_reason: 'length'`); alla fine pulire OPFS, IndexedDB e `localStorage`. Prima di chiamare regressione un comportamento sospetto, confrontarlo con `epic/LAB-3-web-components` (React) su un'altra porta.
  1. Barra: durante la generazione i quattro pulsanti hanno lo stesso aspetto di sempre; un clic su ognuno scrive sotto la riga «Generation in progress: wait for it to finish, or stop it from the chat» e il focus resta sul pulsante; la nota sparisce quando arriva la proposta; Accetta tutto con una proposta troncata scrive la nota della troncata e i pulsanti dei blocchi funzionano; con un conflitto del file la nota rimanda al banner; con la selezione persa l'alert dello span e la nota di Accetta tutto non si pestano; la nota va a capo a barra stretta senza spostare i pulsanti; tema chiaro, scuro, `forced-colors`.
  2. Focus: Accetta tutto da tastiera → focus nell'editor, Ctrl+Z riporta il diff con il focus dentro; Scarta con il focus sul pulsante → focus nell'editor (**il difetto di questa fase**: in jsdom riprodotto solo con il focus sul pulsante che sparisce; se Davide lo vede anche altrove, annotare come); Continua che sparisce dopo il clic → focus su Accetta tutto; chiusura del popover degli avvisi → focus sul suo pulsante; conferma annullata → focus su Accetta tutto.
  3. Composer: senza documento aperto Invia scrive «Open a document before sending» e la bozza resta; Invio durante una generazione scrive «Generation in progress…» e la bozza resta, la nota sparisce a fine generazione; le note sono annunciate dallo screen reader (`role="status"`: Orca o NVDA, Davide); durante un aggiornamento della PWA (`prepare()`) Invia e Accetta tutto dicono «An update is in progress…».
  4. Lingua a caldo: barra, note e suggerimento nella lingua nuova; anteprima della risposta in arrivo con una proposta ritoccata a mano e una seconda richiesta.
