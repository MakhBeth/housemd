# HouseMD Web Components — Piano 13: fase 7, impostazioni, workspace e app senza React

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element l'ultimo strato React e togliere React dall'app. Dal fondo: le tre sezioni AI delle impostazioni (`hmd-settings-profiles`, `hmd-settings-presets`, `hmd-settings-sync`, erano `ui/ai/settings/*`), la cornice con la sezione generale (`hmd-settings`, era `SettingsView.tsx`), l'area di lavoro (`hmd-workspace`, era `WorkspaceView.tsx`, 614 righe), la radice (`hmd-app`, era `App.tsx`) con `main.ts` al posto di `main.tsx` e `I18nProvider.tsx`; poi via `react`, `react-dom`, i tipi, `@vitejs/plugin-react`, `"jsx"` in `tsconfig.json`, `src/elements/jsx.d.ts` e gli hook (`useRoute`, `useUnmountSignal`, `useWorkspace`, `useAiController`, `useAiState`, `useTheme`). **Aspetto e comportamento invariati**: gli snapshot, l'audit degli stili contro `dist-baseline/` (mai ricostruita in questa fase) e gli e2e restano quelli di oggi. Un solo cambio voluto, invisibile: la chiave API scritta nel campo password del profilo non finisce più nell'attributo `value` (React sincronizzava l'attributo dei campi controllati: oggi la chiave sta nel DOM serializzato; spec R21 «chiavi mai negli attributi»; decisione 5). Chiude la migrazione dei componenti (spec §7 «Fase 7»): dopo questo piano in `src/` non c'è più un `.tsx` né un `*.module.css`, e `architecture.test.ts` lo verifica.

**Architecture:** Stesso schema di 4c–6c: classe `Hmd<Nome>` su `HmdElement`, DOM interno identico a quello di React (stessi tag, stesso ordine dei figli: l'audit confronta gli stili per percorso nel DOM saltando gli host con `display: contents`), foglio `@layer components { @scope (…) to (…) { … } }` con i valori dei moduli e il limite inferiore sui figli `hmd-*`, ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`, ogni render da un `RenderLoop`. La catena passa da React agli elementi dal fondo, e l'app funziona dopo ogni task: le sezioni AI dentro `SettingsView.tsx` (Task 2 e 3), `hmd-settings` dentro `WorkspaceView.tsx` (Task 4), `hmd-workspace` dentro `App.tsx` (Task 6), infine `hmd-app` creato da `main.ts`, senza React (Task 7). Nessun componente React finisce mai dentro un elemento. La logica nuova sta in moduli puri testati senza DOM: `elements/settings/settingsView.ts` (sezioni, conferma dei campi numerici, voce dell'indice), `ai/syncBinding.ts` (la cartella di sync, era l'hook `useAiSync`), `elements/workspace/aiSession.ts` (la sessione AI della cartella, era `useAiController`), `elements/workspace/workspaceView.ts` (toast, `beforeunload`, riapertura dell'ultimo file, vista mostrata), `elements/app/appDeps.ts` (il browser visto dall'app, iniettabile). Gli store unici (lingua, tema, rotta, aggiornamenti) li crea `main.ts` e scendono come proprietà (spec §5.3). I nodi che React montava e smontava con un ramo condizionale (`{cond && <x/>}`) l'elemento li crea quando servono e li **dimentica** quando non servono: alla ricomparsa sono nuovi, come con React (un `hmd-editor` nuovo tornando dalla sola anteprima, un `hmd-history-panel` nuovo per ogni file: la `key` di React).

**Tech Stack:** TypeScript 7, Custom Elements, CSS `@scope`/`@layer`, Popover API, `IntersectionObserver` (indice delle impostazioni), Pointer Events con pointer capture (separatore), `tsx --test` con jsdom 30, Playwright 1.63. React 19.3 resta fino al Task 7 (solo `App.tsx`, `WorkspaceView.tsx` fino al Task 6, `SettingsView.tsx` fino al Task 4).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, in particolare 1–4; §5.1–5.4, §5.3 store unici da `main.ts`; §7 «Fase 7» punti 1–5 e «Fase 8» per il bundle; §8.2–8.4, §8.3 «nessun import di React né `.tsx` dalla fase 7»; §9 punti 1, 7–11, 15, 16; §10 R1–R3, R7, R9, R11, R14, R21; §11; §13); handover `docs/superpowers/notes/2026-10-11-handover-fase-7.md` («Cosa resta», «Regola UX di Davide», «Lezioni nuove della 6c», «Trappole dell'ambiente») e `docs/superpowers/notes/2026-10-11-handover-fase-6c.md` («Lezioni da mettere nei piani»); piani `2026-10-11-housemd-wc-11-fase-6b-composer-e-sidebar-ai.md` e `2026-10-11-housemd-wc-12-fase-6c-revisione.md` (il modello di questo).

## Global Constraints

- **Branch** `lab/LAB-5-fase-7` creato da `epic/LAB-3-web-components` (contiene la 6c, merge `5fa9abf`): ogni sub-issue di esecuzione committa lì. PR in bozza #10 verso `epic/LAB-3-web-components`, aperta da questo piano (`gh pr create --draft --base epic/LAB-3-web-components`), portata a pronta dal task di chiusura (`gh pr ready`). Con la divisione in 7a/7b (decisione 1, raccomandata) la PR #10 diventa quella della 7a e la 7b ha un branch e una PR suoi (sotto). Commit piccoli in italiano, all'imperativo, prefisso convenzionale (`test:`, `feat:`, `refactor:`, `docs:`, `chore:`), niente emoji, **nessuna riga di attribuzione**. Il daemon di Multica installa un hook `prepare-commit-msg` che aggiunge `Co-authored-by: multica-agent`: si committa con `git -c core.hooksPath=/dev/null commit …` e prima di ogni push si controlla `git log --format=%B -n <N>` (misurato scrivendo questo piano: il primo commit l'aveva preso). Mai push su `main` né sul branch dell'epica, nessun merge: la PR la mergia il PM dopo la review (Reviewer, A11y) e i gate verdi.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` costruita dal branch **prima di qualsiasi modifica all'app**, conteggi delle suite e gzip del bundle annotati. `dist-baseline/` **non si ricostruisce mai** in questa fase: nessun cambio d'aspetto è previsto (misurato nel prototipo: audit verde contro la build React dal primo all'ultimo task). **Provenienza annotata**: il Task 1 scrive lo SHA del commit da cui è costruita (`git rev-parse HEAD` prima della build) nel commento finale e in `dist-baseline/BASELINE_SHA`. Attraversando il confine 7a/7b la baseline si **copia** dal checkout della 7a, oppure si ricostruisce in un worktree separato (`git worktree add --detach <dir> <SHA del Task 1>`); **mai** da una build della HEAD dell'epica dopo il merge della 7a, che ha già le impostazioni migrate e confronterebbe l'audit della 7b con un riferimento sbagliato. Ogni audit si lancia dopo aver controllato `cat dist-baseline/BASELINE_SHA`.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde con gli **snapshot di oggi** (nessuna rigenerazione: misurato), `npm run test:e2e:dev` verde (console senza errori né avvisi), `npm run test:e2e:audit` verde contro `dist-baseline/`. I pulsanti oggi `disabled` restano `disabled` (Salva chiave senza chiave, Sincronizza ora durante una sync, la cartella durante un cambio, la cronologia senza documento, l'indirizzo per Anthropic): la regola «mai disabled» sulle impostazioni e sui dialog è della fase 8 (handover, «Per la fase 8»). L'unico cambio voluto è la chiave fuori dal DOM serializzato (decisione 5). Un cambio d'aspetto voluto passerebbe prima da Designer e richiederebbe di rinnovare `dist-baseline/` e gli snapshot toccati, elencati con il motivo: qui non ce ne sono.
- **Un task per elemento (o per gruppo stretto), sempre TDD**: test che fallisce (**il RED si vede e si annota nel commento finale prima di scrivere il codice**: nel dispatch va chiesto «test prima, poi il codice», non «scrivere tutto e ripristinare HEAD») → logica pura + elemento + foglio → `define.ts` (ordine alfabetico), `events.ts`, `jsx.d.ts` finché esiste → i chiamanti montano il tag → i `.tsx`, i `.module.css` e gli hook sostituiti si cancellano con `git rm`, poi `grep -r` (uscita 1 = nessuna occorrenza, il risultato giusto; 2 = comando fallito, da ripetere).
- **`events.ts`: ogni voce nuova (JSDoc + chiave) va subito sopra il JSDoc della voce successiva, mai tra un JSDoc e la sua chiave.** Qui sette voci: `hmd-settings-autosave`, `hmd-settings-close`, `hmd-settings-dirty`, `hmd-settings-save-all`, `hmd-settings-section`, `hmd-settings-text-width` sopra il JSDoc di `hmd-start-pick`; `hmd-workspace-change-folder` dopo `hmd-toast-dismiss` (in fondo).
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri testati senza DOM), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento (finestra, documento, store) con il `signal` (i listener sui nodi creati dall'elemento muoiono con i nodi: `on` di `el()`).
- **Cartelle e radici `@scope`**: `src/elements/settings/` (radici `hmd-settings` e `hmd-settings-*`, già ammesse da `architecture.test.ts`), `src/elements/workspace/` (`hmd-workspace`), `src/elements/app/` (`hmd-app`). Due eccezioni nuove in `architecture.test.ts`, ognuna con il motivo e un caso sintetico: **`@scope` con più radici** separate da virgola, ognuna ammessa nella cartella (decisione 2: il foglio comune delle tre sezioni AI) e **`controller.setSecret(` nella sola sezione dei profili** (decisione 4).
- **Schema di render (`RenderLoop`)**: ogni render passa da `this.#loop.update()`: setter, `watch`, gestori, risposte asincrone (dialog, `listBackups`, `orphanDrafts`, sessione AI pronta). **`HmdElement.watch()` esegue subito la funzione**: niente render ridondanti in fondo a `connect()`; **nessun evento si emette dentro `connect`**. Lo stato si salva **prima** di emettere (`#setDraft` registra la bozza e disegna prima di `hmd-settings-dirty`; `SyncBinding` salva lo stato prima di notificare).
- **Nessun callback DOM rientra in un render in modo sincrono**: il `focusout` delle sezioni chiede un render in un microtask; aprire l'ultimo file, il ripristino in coda e il dialog dell'accesso perso partono in un microtask dopo il render (erano effetti di React, che giravano dopo il commit); i figli condizionali si tolgono e si inseriscono senza mai spostare un nodo già al suo posto.
- **Lavoro asincrono tardivo scartato**: la sessione AI aperta dopo il distacco si chiude (`openAiSession` con `signal`); l'elenco dei backup superato da uno più nuovo non lo sostituisce (contatore di richiesta); le bozze orfane chieste per uno stato vecchio si scartano (contatore); lo workspace aperto dopo il distacco di `hmd-app` si butta (`dispose`); i dialog aperti da un elemento si chiudono al suo distacco (un `AbortController` dei dialog interrotto in `disconnectedCallback`, non il `signal` di `connect`, che si interrompe anche a un `reconnect()`).
- **Campi con il focus mai riscritti né ricreati**: i campi del dettaglio di profili e preset si riallineano alla bozza solo senza il focus, e al `focusout` (decisione 6); i campi numerici della sezione generale si riscrivono solo quando si confermano (Invio, blur, chiusura), come faceva React; la casella di ricerca, l'albero e il composer non si ricreano mai mentre restano visibili.
- **Proprietà dei figli `hmd-*` assegnate prima dell'inserimento e solo se cambiano** (`assign()` in `workspace.element.ts`); **eccezione misurata**: a `hmd-ai-review` il workspace passa un `doc` nuovo a **ogni** render, come faceva React, perché la vista ricalcola `canAccept` (che dipende dal conflitto nello workspace) solo quando riceve un `doc` (decisione 9).
- **React 19 e i custom element (Task 2–6)**: ogni prop funzione `on*` diventa un listener → uscite come eventi `hmd-*`; ingressi senza prefisso `on`. `define.ts` resta importato da `main.tsx` prima del primo render.
- **jsdom 30**: mancano Popover (`src/testing/popoverStub.ts`), `showModal` (`src/testing/dialogStub.ts`), `IntersectionObserver` (l'elemento lo salta se non c'è), `ResizeObserver` (stub di una riga nel test, come `preview.dom.test.ts`), `scrollIntoView` (stub nel test che registra la sezione), `requestAnimationFrame` (`src/testing/codemirrorEnv.ts`), `localStorage` (`src/testing/memoryStorage.ts`). Pointer capture, la view transition del tema, l'indice che segue lo scorrimento e il focus vero li verificano Playwright e la checklist.
- **Nei test jsdom mai `assert.equal` tra due nodi** (il messaggio di `node:assert` non finisce più): il focus si afferma con `assert.ok(document.activeElement === node, 'cosa')`, le posizioni con nomi e classi; i test che montano CodeMirror (`hmd-workspace`, `hmd-app`) girano con `--test-timeout=20000`.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail`. Il test e2e del Task 1 sulla chiave afferma che oggi la chiave sta nel DOM serializzato; il Task 2 lo rovescia. L'indice delle impostazioni che resta su «Profili» saltando a «Sync» (le ultime sezioni non arrivano in cima) si nota e si lascia alla fase 8.
- Testi solo da `t()`: **nessuna chiave nuova** in questa fase (misurato: tutti i testi esistono già). Tooltip mai con `title`.
- **Regole AI** (CLAUDE.md §AI, spec R21): gli elementi non importano `ai/providers`; la chiave passa dal campo password a `controller.setSecret` solo con «Salva chiave», non si legge mai e non va in attributi o `dataset`; la sync si scrive solo con `AiSync` (backup verificato, invariato).
- `workspace/` non cambia; `ai/` guadagna solo `syncBinding.ts`; `fs/` non cambia; dialog solo con le funzioni di `src/elements/dialogs/`.
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app (eccezione nuova, ammessa per le sezioni senza nome accessibile: `#settings-ai-presets`, l'id della sezione dei preset, già bersaglio dello scorrimento); `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; nessuna rete vera (finto Ollama di `e2e/support/aiHarness.ts`); un e2e sospetto di instabilità si prova con `--repeat-each=3`.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo sono ricorsivi, si lanciano dopo il `git rm` e distinguono l'uscita 1 dalla 2. Il controller rilancia almeno i file e2e nuovi o toccati di ogni task.
- **Gate per task** (decisione di Davide, 11/10): `npm test`, `npm run lint` e **solo i file e2e toccati o nuovi**, in build e in sviluppo, più gli stati di audit toccati (con `-g`). Le suite complete (`test:e2e`, `test:e2e:dev`, `test:e2e:audit`) girano **una volta sola**, nel task di chiusura (con la divisione in 7a/7b: una volta per sotto-fase). **RAM di ape** (tetto di 10 GB per tutto Multica, rallenta sopra i 7): browser sempre dentro il lock, con le variabili **prima** di `flock`: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts <file>` (lo stesso con `e2e/dev.config.ts` e `e2e/audit.config.ts`); una suite alla volta; se cade per memoria, la si ripete con 1 worker e lo si scrive; a fine suite `pgrep -af "vite|chrom|playwright"` e si chiudono solo i propri PID, mai `pkill` per nome. Instabilità estranee note: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog»; `ai-composer.spec.ts` «a sync folder without permission…» e gli stati di audit che fanno `page.reload()` (`start-resume`, `ai-sync-reactivate`, `orphans`) con «Target page… closed» (misurato anche scrivendo questo piano: `start-resume` nel progetto `baseline`, verde al secondo giro); i 2 snapshot dello start screen cadono su ape per il font pixel. Ripetere da soli e annotare. Con `-g` l'audit fa girare comunque tutto il progetto `baseline` (Playwright 1.63, handover 6c).
- Commenti e commit in italiano, identificatori in inglese.

## Misure prese scrivendo il piano (12/10, su `5fa9abf`)

Baseline su `5fa9abf` (= `epic/LAB-3-web-components`), nel prototipo: `npm test` = **980** (45 s); `npm run test:e2e` = **187** (185 verdi + i 2 snapshot dello start screen, già noti; 2,8 min con 2 worker); `npm run test:e2e:dev` = **172** (5,0 min); `npm run test:e2e:audit` = **116** test, 58 stati (3,5 min); bundle principale gzip = **441 143 B** (`dist/assets/index-BP09-t2V.js`, 1 341 838 B non compresso).

**Prototipo.** Il codice di tutti i task è stato provato su una copia del repository fuori dal worktree (`git worktree add --detach /home/agent/work/housemd-proto-7 origin/epic/LAB-3-web-components`, `npm ci`, `dist-baseline/` costruita da `5fa9abf` prima di toccare l'app, niente commit; più una seconda copia React, `housemd-proto-7-base`, per provare la rete del Task 1 e il passo intermedio dei Task 2–3 sull'app di oggi; entrambe rimosse alla fine). Misure sull'app finale del prototipo (tutti i task): `npm run lint` pulito; `npm test` 980 → **1036** (+5 `settingsView`, +7 `syncBinding`, +6 presets, +6 profiles, +4 sync, +8 settings, +4 `aiSession`, +5 `workspaceView`, +9 workspace, +6 app, +1 `architecture` «niente React»; −3 `reactInterop.dom.test.ts`, −2 test StrictMode di editor e diff); `npm run test:e2e` 187 → **202** (200 verdi + i 2 dello start screen; +10 `settings-sections.spec.ts`, +5 `workspace-shell.spec.ts`), **snapshot invariati**, 2,6 min; `npm run test:e2e:dev` 172 → **187** (4,9 min, console pulita); audit 116 → **136** (+10 stati del Task 1), verde contro la build React, 4,1 min; bundle principale gzip **441 143 → 379 165 B** (−61 978 B, −14 %; non compresso 1 341 838 → 1 136 827 B). La spec (§7 «Fase 8») si aspettava circa −40 KB: React 19 e ReactDOM pesano di più, e se ne vanno anche gli adattatori. Nessun processo appeso a fine suite. Misurato anche:

- **Il passo intermedio regge**: con le tre sezioni AI come elementi dentro `SettingsView.tsx` di React (Task 2 e 3), nella copia React, `settings.spec.ts`, `settings-sections.spec.ts`, `ai-model.spec.ts`, `ai-composer.spec.ts` verdi (41) salvo il test della chiave, che si rovescia proprio lì (decisione 5); audit degli stati `settings*` e `ai-sync-reactivate` verde contro la build React. Con `hmd-workspace` dentro `App.tsx` (Task 6) la suite e2e completa è verde (185 + i 2 noti) e l'audit pure, dopo la correzione della decisione 9.
- **`.detail label` di `Settings.module.css` raggiunge i campi di `hmd-ai-parameters` e `hmd-ai-model-select`** (light DOM): oggi vince perché il modulo sta fuori dai layer. Nello stesso layer, a pari specificità, vincerebbe il foglio dello scope più vicino (prossimità di `@scope`): misurato togliendo il `:scope` davanti, l'audit `settings-profile` cade (altezza della sezione 466 → 449 px); con `:scope .detail label` (una classe in più di specificità) è identico (decisione 3).
- **Con `hmd-workspace` che passava a `hmd-ai-review` un `doc` nuovo solo quando cambiava un campo**, l'audit `ai-review-conflict` cadeva: gli «accetta» dei blocchi restavano attivi durante un conflitto, perché la vista ricalcola `canAccept` solo a un `doc` nuovo (React ne passava uno a ogni render). Corretto passando un `doc` nuovo a ogni render (decisione 9), test jsdom «with the AI session: … a new doc object».
- **React scrive la chiave API nell'attributo `value`** del campo password (sincronizza l'attributo dei campi controllati): `document.body.outerHTML` contiene la chiave scritta. Con l'elemento no (decisione 5).
- **L'indice delle impostazioni non arriva a «Sync»**: con 1280×800, saltando a «AI · Sync» la voce corrente diventa «AI · Profili», perché le ultime sezioni non salgono in cima (il `padding` inferiore di 40vh non basta) e l'`IntersectionObserver` vede ancora i profili nel 40 % alto. Comportamento di oggi, identico con l'elemento; il test del Task 1 usa «Profili»; da rivedere in fase 8.
- **Il test statico sulle chiavi** (`ELEMENT_AI` di `architecture.test.ts`, 6b) colpisce `controller.setSecret(` e anche un metodo privato `#saveSecret(` (parola intera dopo `#`): nell'elemento i metodi si chiamano `#storeKey` e `#forgetKey`.
- **Il primo audit del prototipo è caduto all'avvio del server** («Process from config.webServer was not able to start»): `npm run build` comincia con `tsc`, e codice che non compila blocca tutto. Prima di una suite: `npx tsc --noEmit`.
- **`hmd-app` con gli stati di `App.tsx`**: lo `hmd-start-screen` resta lo stesso elemento tra le sue modalità (React lo riusava: stesso tag nella stessa posizione) e le proprietà che un ramo non passa tornano al default (React 19 le azzerava).

**Esecuzione 7a (12/10).** Misure sul commit finale della 7a: `npx tsc --noEmit` e `npm run lint` puliti; `npm test` **1017** (1016 del piano + 1 test in più del Task 3); `test:e2e` **202** (200 verdi + i 2 dello start screen, chiaro e scuro; snapshot invariati; 2,8 min); `test:e2e:dev` **187** (5,8 min); audit **136** verdi contro `dist-baseline/` (`BASELINE_SHA` `7aab561`, copiata dal checkout del Task 3, mai ricostruita; 4,0 min); bundle principale gzip **444 254 B** (+3 111 rispetto ai 441 143 B della baseline: gli elementi nuovi convivono con React). Tutte e tre le suite con 2 worker, nessuna caduta per memoria, nessun processo appeso a fine suite. Nessuna deviazione dal piano.

**Esecuzione 7b, Task 6 (12/10).** Branch `lab/LAB-5-fase-7b` da `epic/LAB-3-web-components` (merge della 7a `74aeabc`), PR in bozza #11; `dist-baseline/` copiata dal checkout della chiusura 7a (strada (a), `BASELINE_SHA` `7aab561`). Partenza `npm test` **1021** (non 1016: un test in più del Task 3 e 4 delle correzioni della review della 7a). Arrivo **1041** = 1021 + i 18 del piano + 2 test in più per le lezioni della review della 7a: «aborted while the stores load…» in `aiSession.test.ts` (dopo **ogni** `await` `openAiSession` ricontrolla il `signal`: il codice del prototipo lo guardava solo alla fine, e un'interruzione durante il caricamento degli archivi inizializzava comunque il controller) e «detached: no store or window listener is left» in `workspace.dom.test.ts` (iscrizioni a lingua e rotta a zero e `beforeunload` muto dopo il distacco). Unico ritocco all'elemento rispetto al prototipo: la cronologia aperta dopo l'`await` di `openFile` ricontrolla anche `isConnected`. Lint pulito; e2e in build senza `visual.spec.ts` **188** verdi (2,7 min); in sviluppo, gli 11 file del Task 6, **91** verdi (2,8 min, console pulita); audit con `-g` **101** verdi, `ai-review-conflict` compreso (3,0 min). Tutto con 2 worker, nessuna caduta per memoria, nessun processo appeso. **Per il Task 7** il conteggio atteso diventa 1041 + 6 + 1 − 3 − 2 = **1043** (non 1036).

**Esecuzione 7b, Task 7 e 8 (12/10).** Task 7: `hmd-app`, `appDeps.ts`, `main.ts`, `browserTheme.ts`, via React; `npm test` **1043** (1041 + 6 + 1 − 3 − 2), gzip **379 226 B**. Task 8, correzione della review del Task 6 (come primo commit): `memo.entries` era condivisa dall'albero e dalla lista dei file dell'anteprima, e con la sidebar nascosta `#files()` aggiornava la chiave senza ricostruire l'albero; chiavi separate (`treeEntries`, `filesEntries`). Due test in `workspace.dom.test.ts` (file creato con la sidebar nascosta; modifica esterna rilevata con la sidebar nascosta), RED visto prima del fix (`c.md` / `d.md` non in `hmd-file-tree.nodes`). Misure sul commit finale: `npx tsc --noEmit` e `npm run lint` puliti; `npm test` **1045** (1043 + 2); `test:e2e` **202** (200 verdi + i 2 dello start screen, chiaro e scuro; snapshot invariati; 2,6 min); `test:e2e:dev` **187** (4,9 min); audit **136** verdi contro `dist-baseline/` (`BASELINE_SHA` `7aab561`, copiata dal checkout del Task 7, mai ricostruita; 3,9 min); bundle principale gzip **379 234 B**: −61 909 B rispetto ai 441 143 B di inizio fase, −53 185 B rispetto ai 432 419 B della fase 3 (React 19). Due soli commenti e2e in più del piano (`ai-review.spec.ts`, che nominava `popoverTarget` di React 19 al presente). Tutto con 2 worker nel lock, nessuna caduta per memoria, nessun processo appeso. Deviazione dall'ambiente, non dal piano: il primo giro di `test:e2e:dev` cadde con 186 rossi per «403 Forbidden» perché `node_modules` era un link simbolico verso un altro checkout (Vite non serve file fuori dalla radice); con una copia vera 187 verdi.

### Inventario

**`src/ui/ai/settings/ItemList.tsx`** (50 righe; CSS: `.list`, `.item` (+`[aria-current]`), `.create` (`composes: item`) di `Settings.module.css`)
- `ItemList<T>`: props `items`, `selectedId`, `label(item)`, `onSelect(item)`, `onCreate()`; DOM `div.list` > un `button.item[type=button][aria-current?]` per voce + `button.create` «+ Crea». `useDraft<T>(onDirty)`: adattatore di `state/draftState.ts` (`draft`, `dirty`, `setDraft`, `markSaved`, `select`, `confirmSwitch`, `cancelSwitch`); `onDirty(dirty)` a ogni cambio e `onDirty(false)` allo smontaggio.
- Chiamanti: le sezioni dei profili e dei preset. Diventa `elements/settings/itemList.ts` (`renderItemList`, pulsanti riusati per id con `reconcileList`; «+ Crea» è una riga con chiave `create`) e `#setDraft` negli elementi (stato salvato e disegnato, poi `hmd-settings-dirty` se cambia `dirty`).

**`src/ui/ai/settings/AiProfilesSection.tsx`** (162 righe)
- Props `controller: AiController`, `onDirty`. Hook: `useT`, `useI18nStore`, `useSyncExternalStore(controller)`, `useDraft`, `useState` (`key`, `remember`, `connected`), `useUnmountSignal` (dialog).
- DOM: `div.split` > `ItemList` (nomi dei profili) + [con bozza: `div.detail` > `label`(span + input nome) + `label`(span + select provider, `option` senza `value`) + `label`(span + input url, `disabled` per `anthropic`) + `p.help` (`ai.help.<kind>`) + `hmd-ai-model-select` (`controller`, `profile=draft`, `i18n`, `onhmd-ai-model-change`) + `hmd-ai-parameters` (`profile=draft`, `value=draft.params`) + `label`(contesto, `number` min 1) + [ollama, lmstudio, openai-compatible: `label`(checkbox effort + testo)] + [anthropic, openai-compatible: `label`(chiave, `password`, `autoComplete=off`) + `label`(checkbox «Ricorda» + testo) + `p.help` (avviso) + `button`«Salva chiave» `disabled={!key}`] + `div.actions` > Connessione, Duplica, Elimina, Salva + [connesso: `p[role=status]` «Connesso»]].
- Comportamenti: `pick(profile)` (bozza con `params` copiati, chiave e «Connesso» dimenticati, con modifiche aperte `showDiscardChangesDialog`); cambio provider (`changeProvider` + url di default, chiave dimenticata); Connessione (`controller.provider(p)` → `testConnection` o `listModels` ≠ null, altrimenti `{ code: 'unreachable' }` al controller); Salva chiave (`setSecret(validateProfile(draft), key, remember)` → chiave vuota, bozza = profilo salvato); Elimina (`showConfirmDialog`); Salva (`saveProfile(validateProfile(draft))`).
- Test oggi: e2e `settings.spec.ts` (profilo sporco: Indietro/Chiudi/cambio profilo), `ai-model.spec.ts` («in the profile settings the model list loads…», «Manage profiles…»), `ai-chips.spec.ts`, `app.createProfile`; audit `settings-profile`. **Scoperti**: campo chiave e Salva chiave, url fisso per Anthropic, cambio provider, Connessione, dove finisce la chiave, Duplica.

**`src/ui/ai/settings/AiPresetsSection.tsx`** (108 righe)
- Props `controller`, `onDirty`. Hook: `useT`, `useI18nStore`, `useSyncExternalStore`, `useDraft`, `useUnmountSignal`.
- DOM: `div.split` > `ItemList` (preset ordinati per `order`, etichetta `presetLabel`) + [bozza: `div.detail` > `label`×6 (nome, istruzioni `textarea`, lingua di destinazione, strategia `select` whole/chunked, frontmatter `select` keep/include, ordine `number` min 0) + `label`(checkbox «Nascosto» + testo) + `hmd-ai-parameters` (`profile=defaultProfile()`, `value=draft.params ?? {}`) + `div.actions` > Duplica, [predefinito: Ripristina l'originale | altrimenti Elimina], Salva].
- Test oggi: e2e `settings.spec.ts` («deleting a preset asks first…»), audit nessuno. **Scoperti**: preset predefinito con «Ripristina», il ripristino, Duplica, Nascosto.

**`src/ui/ai/settings/AiSyncSection.tsx`** (173 righe; contiene anche l'hook `useAiSync`)
- `useAiSync(controller)`: `folderHandle` dai meta del controller → `handle` + `hasAccess`; con cartella e permesso un `AiSync` nuovo (`controller.onSettingsChanged = () => service.localChanged()`, `syncPermission` → permesso tolto, fine di una sync → `controller.reload()`), `start()`; `choose()` (`pickFolder`, meta, permesso), `reactivate()` (`requestAccess`), `disable()` (meta a null). Chiamanti: `WorkspaceView.tsx` (lo crea; `syncNeedsPermission` per la sidebar AI) e `SettingsView.tsx` (lo passa alla sezione). Diventa `ai/syncBinding.ts` (classe `SyncBinding` con `subscribe`/`getState`, dipendenze iniettate; `browserSyncBinding(controller)`).
- `SyncDetails` (`useSyncExternalStore(sync)`, `backups` ricaricati a ogni `lastSync`, `restoring` per una sola conferma) e `AiSyncSection`: `div.detail` > `p.help` (avviso) + `div.actions` > Scegli + [cartella: `span` nome + Disattiva + [senza permesso: Riattiva]] + [servizio: `p.help` stato + ora, [errore: `p.help`], [conflitti: `p.help`], `div.actions` > Sincronizza ora (`disabled` durante la sync), `details` > `summary` «Backup» + un `p.help` (percorso + pulsante Ripristina) per backup].
- Test oggi: e2e `ai-composer.spec.ts` («a sync folder without permission…»), audit `ai-sync-reactivate`. **Scoperti**: la sezione con il servizio attivo (stato, Sincronizza ora, backup), Disattiva, il ripristino di un backup (solo jsdom: in e2e non ci sono backup da ripristinare senza preparare un file di sync).

**`src/ui/SettingsView.tsx`** (266 righe; CSS: `SettingsView.module.css` 104 righe + `Dialog.module.css` 49 righe, campi della sezione generale)
- Props: `section`, `onSection`, `onClose`, `onDirtyChange`, `closeRequest` (contatore), `ai`, `syncBinding`, `theme`, `onTheme`, `autosave`, `onAutosave`, `textWidth`, `onTextWidth`, `onSaveAll`. Hook: `useI18n` (lingua), `useState` (`delay`, `widths`, `dirty`, `visible`), `useRef` (`confirming`, `content`, `title`, `seenRequest`), `useUnmountSignal`, effetti: focus sul titolo al montaggio; `onDirtyChange` a ogni cambio; `closeRequest` → `close()`; `[section, ai]` → `scrollIntoView`; `[ai]` → `IntersectionObserver` (radice `content`, `rootMargin '0px 0px -60% 0px'`) per `visible`; `keydown` Esc sulla finestra (senza `dialog[open]`).
- DOM: `div.view[role=region][aria-label]` > `nav.nav[aria-label]` > `div.navHeader` > (`button.iconButton.tooltip` ✕ + `h1[tabindex=-1]`) + un `a.navLink[href][aria-current?]` per sezione; `div.content` > `section#settings-general.section` > `h2` + `label.field`(span + `select.input` lingue con `lang`) + `fieldset.group`(legend + 3 `label.option` radio tema) + `fieldset.group`(legend + 3 radio autosalvataggio + [afterDelay: `label.field` ritardo `number` 500–10000 passo 100]) + `fieldset.group`(legend + 2 `label.field` larghezze `number` 30–300 con `placeholder` + `p.hint`) + `button.secondary` Salva tutto; [con `ai`: `section#settings-ai-profiles|presets|sync.section` > `h2` + sezione].
- `close()`: conferma ritardo e larghezze, senza bozze `onClose()`, con bozze una sola `showDiscardChangesDialog` → `onDirtyChange(false)` e `onClose()`.
- Chiamante: `WorkspaceView.tsx` (con la rotta). Test oggi: e2e `settings.spec.ts` (11), `theme-i18n.spec.ts` (lingua dalle impostazioni), `visual.spec.ts` «settings», audit `settings`, `unsaved-dialog`. **Scoperti**: ritardo dell'autosalvataggio (Invio, limiti, preferenza), modalità «off», Esc che chiude, radio del tema, Salva tutto, l'indice che segue lo scorrimento, layout stretto (`@media (width < 700px)`).

**`src/ui/WorkspaceView.tsx`** (614 righe; CSS `WorkspaceView.module.css` 223 righe)
- Props: `workspace`, `workspaceId`, `handle`, `onChangeFolder`, `switchingFolder`. Hook: `useI18n`, `useI18nStore`, `useWorkspaceState`, `useAiController`, `useAiState`, `useAiSync`, `useTheme`, `useRoute`, `useUnmountSignal`, molti `useState` (`aiWidth`, `aiSelection`, `mode`, `sidebarOpen`, `sidebarWidth`, `highlight`, `textWidth`, `closeRequest`, `historyOpen`, `queuedRestore`, `orphans`), `useRef` (`lastPane`, `settingsDirty`, `focusBeforeSettings`, `editorRef`, `previewRef`, `searchRef`, `reopened`), `useMemo` (`session` per `path#revision`, `tree`, `files`, `drafts`, `toastItems`).
- Effetti: selezione AI azzerata e `ai.documentChanged(path, …, true)` a ogni `path#revision`; variabili CSS della larghezza del testo; titolo della scheda (e `APP_TITLE` allo smontaggio); focus restituito alla chiusura delle impostazioni; cronologia chiusa senza documento; ripristino in coda dalla sola anteprima; bozze orfane (`orphanDrafts`, scartate se superate); riapertura dell'ultimo file (una volta; senza file su disco solo se ha una bozza); `writeLastFile`; `focus`/`blur`/`visibilitychange`/`beforeunload` sulla finestra; `keydown` (Esc ferma l'AI, `shortcutFor` + `match`, con le impostazioni aperte solo i salvataggi); dialog dell'accesso perso (`showAccessLostDialog` con `AbortController`).
- DOM: `div.layout[inert?][style=grid-template-columns]` > [sidebar aperta: `aside.sidebar` > (AI: `hmd-ai-sidebar` | `div.sidebarHeader` (Nascondi, cartella `button.folder` `disabled` durante il cambio, Nuovo file, Nuova cartella) + `hmd-search-panel` + [orfane: `section.orphans[aria-label]` > `h2.orphansTitle` + `button.orphan.tooltip[aria-current?]`] + `hmd-file-tree`), `div.resizer[role=separator][aria-*][tabindex=0]`] + `main.main` > `header.toolbar` > (`div.lead` > interruttore della sidebar + `span.path`) + `div.modes[role=group]` (3 o 4 `button.mode[aria-pressed]`) + `div.actions` > `span.saveState[data-state][aria-live][role?]` (icona `draft` 10 px + testo) + Cronologia (`aria-pressed`, `disabled` senza documento) + Salva tutto + `hmd-theme-switcher` + Impostazioni; [conflitto: `hmd-conflict-bar`]; (documento e AI: `hmd-ai-review` | documento: `div.panes[data-mode]` > [non anteprima: `section.pane` > `hmd-editor`] + (cronologia: `section.pane` > `hmd-history-panel` con `key={path}` | non editor: `section.pane` > `hmd-preview`) | `div.empty` > `p` + `button.primary` Nuovo file); poi [impostazioni: `SettingsView`] e `hmd-toasts`.
- Chiamante: `App.tsx` (`key={workspaceId:openCount}`). Test oggi: quasi tutta la suite e2e (editor, preview, tree, search, history, external, settings, ai-*, visual, focus-ring, sync-scroll, theme-i18n, startup) e l'audit (`workspace-*`, `editor-mode`, `ai-*`, `tree-*`, `search-*`, `history*`, `conflict`, `toast`, `focus-*`). **Scoperti**: il separatore trascinato col puntatore (e la larghezza AI separata), lo stato senza file (Nuovo file dal centro, Cronologia spenta), Ctrl+Maiusc+E, Ctrl+K dalla modalità AI, Esc globale che ferma la generazione, `beforeunload`, gli stati di audit senza file, sidebar nascosta, separatore col focus da tastiera, bozze orfane. Non coperti in e2e e lasciati alla checklist: cartella `disabled` durante un cambio lento, `visibilitychange`.

**`src/App.tsx`** (171 righe) e **`src/main.tsx`** (35 righe), **`src/i18n/I18nProvider.tsx`** (64 righe)
- `App`: `screen` (`boot` → `unsupported` | `start` | `resume` | `open`), `openCount` (la `key` dello workspace), `switchGuard` + `switching`, `dbBlocked` (`onDbBlocked`), `setUpdateWorkspace`; avvio (`isSupported`, `loadWorkspace`, `hasAccess`, `openWorkspace`, flag `alive`); `choose` (`switchFolder` con `findKnownWorkspaceId`, `saveWorkspace`, `dispose`, `afterSwitch`); `resume` (`requestAccess`). DOM: contenuto (`hmd-start-screen` riusato tra le modalità | `WorkspaceView`) + `hmd-update-notice` + [`hmd-notice` in alto, chiudibile].
- `main.tsx`: font, `global.css`, `define`, `registerUpdates`, `installFocusSource`, lingua (`readValidPref` o `detectLocale`) → `loadMessages` → `createRoot(#root).render(<StrictMode><I18nProvider><App/>…)`. `I18nProvider`: `createI18nStore` (salva la lingua caricata), `<html lang>` dalla lingua, `useT`, `useI18nStore`.
- Test oggi: `startup.spec.ts` (avvio, non supportato, ripresa, A → B → A, `.housemd.json` non valido), `theme-i18n.spec.ts` (lingua salvata, `<html lang>`, lingua del browser), `visual.spec.ts` (tema prima del render: trattiene `assets/index-*.js` con `#root` vuoto), `screens.test.ts`, `switchFolder.test.ts`, `i18nStore.test.ts`. **Scoperti**: l'avviso del database bloccato (serve una seconda scheda con una versione vecchia: jsdom), l'avviso di nuova versione (service worker bloccati negli e2e: checklist PWA).

**Hook e file di contorno**: `useRoute.ts` (store della rotta per `WorkspaceView`, guardia aggiornata a ogni render), `useUnmountSignal.ts` (signal dei dialog), `useWorkspace.ts`, `ui/ai/useAiController.ts` (sessione AI: IndexedDB o memoria con l'errore `server`, `registerUpdateParticipant`, `aiProfile`), `ui/ai/useAiState.ts`, `theme/useTheme.ts` (`getThemeStore()` più `flushSync` dentro la view transition), `ui/Icon.tsx` (sostituito da `dom/icon.ts` dalla 4a; ultimi utenti `WorkspaceView` e `SettingsView`), `elements/jsx.d.ts` (tipi dei tag montati da React), `elements/reactInterop.dom.test.ts` (3 test: React 19 con i custom element), i test «under React StrictMode…» di `editor.dom.test.ts` e `diff-pane.dom.test.ts`. Dipendenze: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` (`vite.config.ts`), `"jsx": "react-jsx"` (`tsconfig.json`), `index.html` → `/src/main.tsx`.

**Catena di contenimento.** Oggi `main.tsx` → `I18nProvider` → `App` → (`hmd-start-screen` | `WorkspaceView` → (… elementi …, `SettingsView` → (`AiProfilesSection`, `AiPresetsSection`, `AiSyncSection`))), `hmd-update-notice`, `hmd-notice`. Alla fine: `main.ts` → `hmd-app` → (`hmd-start-screen` | `hmd-workspace` → (… elementi …, `hmd-settings` → (`hmd-settings-profiles`, `hmd-settings-presets`, `hmd-settings-sync`))), `hmd-update-notice`, `hmd-notice`. Tutti gli host nuovi sono `display: contents`: l'albero sotto `#root` per l'audit resta quello di React.

### Divisione

La fase è il resto dell'albero React: quattro sezioni (tre AI e la generale), la cornice delle impostazioni, il workspace, l'app, la rimozione. **Dal fondo**: prima le sezioni AI dentro `SettingsView.tsx` (Task 2 e 3), poi la cornice dentro `WorkspaceView.tsx` (Task 4), poi il workspace dentro `App.tsx` (Task 6), poi l'app e via React (Task 7). Così ogni elemento ha un genitore React finché non arriva il suo, e nessun elemento ospita mai un componente React. Prototipo: circa 5 000 righe aggiunte (metà test) e 2 300 tolte, il doppio della 6b. Per questo la decisione 1 raccomanda due sotto-fasi.

Passi intermedi (l'app funziona dopo ognuno, misurato nel prototipo):

- **dopo il Task 1** (rete): nessuna riga dell'app cambia; 15 e2e e 10 stati di audit nuovi, verdi sull'app di oggi; `dist-baseline/` costruita.
- **dopo il Task 2** (profili e preset): `SettingsView.tsx` monta `<hmd-settings-profiles controller i18n onhmd-settings-dirty>` e `<hmd-settings-presets …>`; `AiProfilesSection.tsx`, `AiPresetsSection.tsx`, `ItemList.tsx` cancellati; il test e2e della chiave rovesciato.
- **dopo il Task 3** (sync): `WorkspaceView.tsx` crea un `SyncBinding` per controller (al posto di `useAiSync`) e lo legge con `useSyncExternalStore` per la sidebar; `SettingsView.tsx` monta `<hmd-settings-sync controller binding i18n>`; `AiSyncSection.tsx` e `Settings.module.css` cancellati (la cartella `ui/ai/settings/` sparisce).
- **dopo il Task 4** (cornice): `WorkspaceView.tsx` monta `<hmd-settings ref section ai syncBinding theme autosave textWidth i18n onhmd-settings-*>`, la guardia della rotta legge `settingsRef.current?.dirty` e chiama `requestClose()`; `SettingsView.tsx`, `SettingsView.module.css`, `Dialog.module.css` cancellati. **Fine della 7a** (Task 5: chiusura).
- **dopo il Task 6** (workspace): `App.tsx` monta `<hmd-workspace key workspace workspaceId handle switchingFolder i18n theme route onhmd-workspace-change-folder>` con uno store della rotta suo; `WorkspaceView.tsx`, il suo modulo, `Icon.tsx` e gli hook `useRoute`, `useUnmountSignal`, `useWorkspace`, `useAiController`, `useAiState` cancellati.
- **dopo il Task 7** (app, via React): `main.ts` crea gli store e `<hmd-app>`; cancellati `App.tsx`, `main.tsx`, `I18nProvider.tsx`, `theme/useTheme.ts`, `jsx.d.ts`, `reactInterop.dom.test.ts`, i due test StrictMode; dipendenze e plugin tolti; `architecture.test.ts` afferma che React non c'è più.
- **dopo il Task 8**: documenti, misure, handover della fase 8. **Fine della 7b.**

| Task | Sotto-fase | Chi | Contenuto |
|---|---|---|---|
| 1 | 7a | Builder | Rete di sicurezza sull'app React di oggi, baseline, `dist-baseline/` |
| 2 | 7a | Builder | `hmd-settings-profiles`, `hmd-settings-presets`, `itemList.ts`, `fields.ts`, `sections.css`, eccezioni di `architecture.test.ts` |
| 3 | 7a | Builder | `SyncBinding` (`ai/syncBinding.ts`) e `hmd-settings-sync` |
| 4 | 7a | Builder | `hmd-settings` (cornice e generale), `settingsView.ts`, `settings.css` |
| 5 | 7a | Builder | Chiusura della 7a: suite complete, spec, PR pronta |
| 6 | 7b | **Planner** | `hmd-workspace`, `aiSession.ts`, `workspaceView.ts`, `workspace.css` |
| 7 | 7b | Builder | `hmd-app`, `appDeps.ts`, `main.ts`, `browserTheme.ts`, via React |
| 8 | 7b | Builder | Documenti, misure, chiusura (spec §7/§11/§13, `CLAUDE.md`, `README.md`, handover della fase 8) |

Il Task 6 va a Planner (griglia, separatore con pointer capture, scorciatoie, listener globali, sessione AI e sync, riapertura dell'ultimo file, bozze orfane, accesso perso, rotta e focus delle impostazioni, figli condizionali ricreati come React, `doc` della revisione: è il punto dove un dettaglio sbagliato rompe molti flussi e il prototipo ne ha trovato uno). Il Task 4 è il più delicato tra quelli di Builder (rotta, conferma una sola volta, focus sul titolo, Esc, `IntersectionObserver`): il codice provato è nel piano, il Reviewer lo guarda con attenzione (Review Focus 3).

### Decisioni (tra parentesi la raccomandazione; il PM decide e procede)

1. **Due sotto-fasi, 7a e 7b, con due PR** (sì). Varianti: **A** una PR sola per tutta la fase (circa 7 000 righe di diff da rivedere in una volta, un solo giro di suite; scartata: la review della 6b, metà di questa, ha già richiesto tre giri); **B** (raccomandata) 7a = impostazioni (Task 1–5) sulla PR #10 (titolo da cambiare in «LAB-5: fase 7a, impostazioni senza React»), mergiata nell'epica; 7b = workspace, app e via React (Task 6–8) su un branch nuovo `lab/LAB-5-fase-7b` creato da `epic/LAB-3-web-components` **dopo** il merge della 7a, PR in bozza nuova «LAB-5: fase 7b, workspace e app senza React»; il confine regge (misurato: con le impostazioni come elementi dentro `WorkspaceView.tsx` tutte le suite sono verdi), e ogni metà ha le sue suite complete e la sua review; **C** 7a = impostazioni e workspace, 7b = app e via React (scartata: la 7b sarebbe un terzo della 7a, e il workspace resterebbe senza una chiusura sua). Con A il Task 5 si salta (le sue misure finiscono nel Task 8).
2. **Un foglio comune per le tre sezioni AI, con `@scope` a più radici** (sì): `sections.css` con `@scope (hmd-settings-profiles, hmd-settings-presets, hmd-settings-sync)`, e `architecture.test.ts` che accetta più radici separate da virgola, ognuna ammessa nella cartella (con due casi sintetici, uno buono e uno con una radice di un'altra cartella). Il minificatore conserva la lista (misurato nel CSS di produzione del prototipo: `@scope(hmd-settings-profiles,hmd-settings-presets,hmd-settings-sync)`). **Scartate**: tre fogli con le stesse 80 righe ripetute (duplicato da tenere allineato); un solo foglio su `hmd-settings` con le sezioni senza foglio (le sezioni montate da `SettingsView.tsx` nei Task 2–3 resterebbero senza stile fino al Task 4).
3. **`:scope` davanti alle regole `.detail label`, `.detail label > span`, `.detail input|select|textarea`** (sì, misurato): oggi raggiungono anche i campi di `hmd-ai-parameters` e `hmd-ai-model-select` e vincono perché `Settings.module.css` sta fuori dai layer; nel layer a pari specificità vincerebbe il foglio del figlio (prossimità di `@scope`). Il `:scope` aggiunge una classe di specificità e tiene il risultato di oggi; nessun limite inferiore su quei due figli. **Scartato**: `!important` (il progetto ne ha già tre da togliere in fase 8).
4. **La chiave passa al controller dalla sezione dei profili: eccezione stretta nel test statico** (sì): `SECRET_WRITE_ALLOWED = elements/settings/profiles.element.ts`, dove si toglie dal sorgente solo `controller.setSecret(` prima di applicare `ELEMENT_AI`; tutto il resto (lettura delle chiavi, `aiSecrets`, `ai/providers`) resta vietato anche lì, e un caso sintetico lo prova. **Scartate**: un modulo in `ai/` che avvolge `setSecret` solo per non farsi vedere dal test (nasconde, non chiarisce); una callback passata da `hmd-workspace` (la chiave attraverserebbe un elemento in più).
5. **La chiave fuori dal DOM serializzato** (sì, cambio voluto e invisibile): l'elemento scrive solo la proprietà `value` del campo password; React scriveva anche l'attributo (misurato: `document.body.outerHTML` contiene la chiave). Spec R21 e CLAUDE.md («chiavi mai negli attributi»). Il Task 1 afferma il comportamento di oggi, il Task 2 lo rovescia. Nessun aspetto cambia.
6. **Campi del dettaglio mai riscritti con il focus, riallineati al `focusout`** (sì, lezione delle fasi 4–6b): unico effetto visibile, un numero d'ordine cancellato resta vuoto finché il campo ha il focus (React scriveva subito «0»); la bozza è identica. I campi numerici della sezione generale si riscrivono solo alla conferma, come prima.
7. **Uno store della rotta per l'app, creato da `main.ts`** (sì, spec §5.3): `hmd-workspace` imposta la guardia collegandosi e la toglie staccandosi. Con React ce n'era uno per `WorkspaceView`; la differenza (il flag «entrato dall'app» sopravvive a un cambio di cartella) non è raggiungibile: con le impostazioni aperte il workspace è inerte e non si cambia cartella. Nel Task 6, finché c'è `App.tsx`, lo store lo crea `App.tsx` con `useState`.
8. **Figli condizionali ricreati come con React** (sì): `#slot(nome, mostra, crea)` in `workspace.element.ts`; un nodo non più mostrato si dimentica. Un `hmd-editor` riusato dopo il distacco funzionerebbe, ma cambierebbe tempi e focus rispetto a oggi (sessione, cronologia di CodeMirror); la ricreazione è quello che gli e2e e l'audit hanno sempre misurato.
9. **`doc` nuovo a ogni render per `hmd-ai-review`** (sì, misurato): la vista ricalcola `canAccept` e `acceptBlocker` solo quando riceve un `doc`; lo stato che li fa cambiare (conflitto, aggiornamento in corso) sta nello workspace. Confrontare i campi rompeva l'audit `ai-review-conflict`. Le callback `docChanged`/`selectionChanged` sono stabili (campi della classe). **Scartato**: far ascoltare lo workspace alla vista (un ingresso in più, e il contratto della 6c cambierebbe).
10. **Toast: un array nuovo solo quando cambiano toast, errore AI o lingua** (sì): come lo `useMemo` di React; i toast riavviano i timer a ogni array nuovo (difetto noto della 4a, da trattare con la rimozione dei toast dopo la migrazione).
11. **Senza React spariscono i test che provano React** (sì): `reactInterop.dom.test.ts` (3) e i due «under React StrictMode…» (editor, diff): provavano la convivenza, che finisce. Il caso che proteggevano era il doppio montaggio di StrictMode, che senza React non esiste più; le proprietà assegnate prima della connessione le usano tutti i `mount()` di quei file, e «detached: the session keeps text and history, a new view picks them up» copre la vista ricreata dopo un distacco. La suite in sviluppo resta: senza StrictMode, ma con la console come cancello.
12. **Il tema senza `flushSync`** (sì): `browserThemeStore()` in `theme/browserTheme.ts` (era `getThemeStore()` di `useTheme.ts`), creato da `main.ts`; gli elementi ridisegnano dentro la notifica, che arriva dentro la view transition (misurato: `theme-i18n.spec.ts` «the theme cycle runs through the view transition…» verde).
13. **`hmd-app` con le dipendenze del browser iniettabili** (sì): `AppDeps` in `elements/app/appDeps.ts`, `browserAppDeps` di default, una proprietà `deps` per i test jsdom (avvio, ripresa, cambio cartella, database bloccato, distacco durante l'apertura). Gli store di buffer e cronologia restano unici per pagina (come in `App.tsx`).
14. **Nessuna chiave i18n nuova, nessun pulsante che cambia stato** (sì): la regola «mai disabled» sulle impostazioni e i rilievi di A11y restano alla fase 8 (handover).

## Review Focus

1. **Le impostazioni si comportano come prima**: bozze, conferma una sola volta (✕, Esc, Indietro bloccato → `requestClose()`), Scarta che pulisce `dirty` prima di uscire, focus sul titolo all'apertura e restituito alla chiusura, campi numerici confermati a Invio, blur e chiusura, sezione della rotta portata in vista, indice che segue lo scorrimento. Test: `settings.dom.test.ts` (8), `presets.dom.test.ts` (6), `profiles.dom.test.ts` (6), `sync.dom.test.ts` (4), `settings.spec.ts`, `settings-sections.spec.ts`, audit `settings*`.
2. **Le chiavi**: il campo password non scrive mai l'attributo; `setSecret` è l'unica eccezione, ed è stretta; la chiave si dimentica cambiando profilo o provider e dopo il salvataggio. Test: «a cloud profile…», «Save key hands the key to the controller once…», `architecture.test.ts`, e2e «the key typed in the password field stays in the field…».
3. **`hmd-settings` e la rotta**: `dirty` letto dalla guardia, `requestClose()` senza secondo dialog, eventi verso il workspace (`hmd-settings-section|close|autosave|text-width|save-all`) e preferenze scritte come prima. Test: «with a dirty section, closing (✕, Esc, requestClose) asks once…», `settings.spec.ts` («Back with unsaved changes…», «Back again with the confirmation already open…»).
4. **`hmd-workspace` non perde nulla di `WorkspaceView.tsx`**: figli condizionali ricreati, scorciatoie e listener della finestra legati al `signal` (nessuno dopo il distacco), sessione AI chiusa al distacco e scartata se arriva dopo, sync per controller, bozze orfane e ultimo file, accesso perso, titolo, focus restituito dalle impostazioni, `doc` nuovo alla revisione. Test: `workspace.dom.test.ts` (9), `aiSession.test.ts`, `workspaceView.test.ts`, `workspace-shell.spec.ts`, e tutta la suite e2e (il workspace la attraversa tutta), audit completo.
5. **`hmd-app` e `main.ts`**: schermate, un cambio cartella alla volta, uno workspace nuovo a ogni apertura, workspace buttato se aperto dopo il distacco, `<html lang>` dalla lingua caricata, tema applicato prima del render (`visual.spec.ts`), nessun React nel bundle (`architecture.test.ts`, `package.json`), bundle −62 KB gzip.
6. **Aspetto identico**: nessuno snapshot rigenerato, `dist-baseline/` mai ricostruita e sempre la build React del commit annotato nel Task 1 (`dist-baseline/BASELINE_SHA`), anche nella 7b (copiata dal checkout della 7a o ricostruita in un worktree detached da quello SHA, mai dalla HEAD dell'epica dopo la 7a); audit verde dal Task 1 al Task 8 con i 10 stati nuovi.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/settings-sections.spec.ts`, `e2e/workspace-shell.spec.ts`, `e2e/computed-styles.audit.ts` (10 stati, `width`) | Rete di sicurezza (Task 1). |
| `src/elements/settings/fields.ts`, `itemList.ts`, `sections.css` | Campi, elenco con «+ Crea», foglio comune delle sezioni AI (Task 2). |
| `src/elements/settings/profiles.element.ts`, `presets.element.ts` (+ `.dom.test.ts`) | `hmd-settings-profiles`, `hmd-settings-presets` (Task 2). |
| `src/ai/syncBinding.ts` (+ test), `src/elements/settings/sync.element.ts` (+ `.dom.test.ts`) | Cartella di sync e sezione (Task 3). |
| `src/elements/settings/settingsView.ts` (+ test), `settings.element.ts`, `settings.css` (+ `.dom.test.ts`) | `hmd-settings`, cornice e sezione generale (Task 4). |
| `src/elements/workspace/aiSession.ts`, `workspaceView.ts` (+ test), `workspace.element.ts`, `workspace.css` (+ `.dom.test.ts`) | `hmd-workspace` (Task 6). |
| `src/elements/app/appDeps.ts`, `app.element.ts`, `app.css` (+ `.dom.test.ts`), `src/main.ts`, `src/theme/browserTheme.ts` | `hmd-app` e avvio senza React (Task 7). |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` (fino al Task 7), `src/architecture.test.ts` | Registrazione, eventi, tipi JSX, controlli statici. |
| `src/ui/SettingsView.tsx` (Task 2–3), `src/ui/WorkspaceView.tsx` (Task 3–4), `src/App.tsx` (Task 6) | Chiamanti React intermedi. |
| Cancellati: `ui/ai/settings/*` (Task 2–3), `ui/SettingsView.tsx`, `ui/SettingsView.module.css`, `ui/Dialog.module.css` (Task 4), `ui/WorkspaceView.tsx`, `ui/WorkspaceView.module.css`, `ui/Icon.tsx`, `ui/useRoute.ts`, `ui/useUnmountSignal.ts`, `ui/useWorkspace.ts`, `ui/ai/useAiController.ts`, `ui/ai/useAiState.ts` (Task 6), `App.tsx`, `main.tsx`, `i18n/I18nProvider.tsx`, `theme/useTheme.ts`, `elements/jsx.d.ts`, `elements/reactInterop.dom.test.ts` (Task 7) | — |
| `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Via React (Task 7). |
| `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `CLAUDE.md`, `README.md`, `e2e/dev.config.ts` e i commenti e2e che parlano di React, `docs/superpowers/notes/2026-10-xx-handover-fase-8.md` | Documenti (Task 5 e 8). |

---

### Task 1: Rete di sicurezza e baseline sull'app React di oggi (Builder)

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**, compreso il comportamento da rovesciare (la chiave nel DOM serializzato, decisione 5), più dieci stati di audit per quello che nessuno fotografa. Provato nel prototipo sulla copia React (`housemd-proto-7-base`): 15/15 e2e verdi, 10 stati di audit raggiungibili e stabili.

**Files:**
- Create: `e2e/settings-sections.spec.ts`, `e2e/workspace-shell.spec.ts`
- Modify: `e2e/computed-styles.audit.ts` (campo `width` di `State`, larghezza nel ridimensionamento di stabilizzazione, 10 stati)

**Interfaces:**
- Produces: i test «the key typed in the password field: where it ends up in the DOM» (afferma `true`, rovesciato dal Task 2) e gli altri 14; gli stati di audit `workspace-empty`, `sidebar-hidden`, `resizer-focus-keyboard`, `orphans`, `settings-autosave-off`, `settings-preset`, `settings-cloud-profile`, `settings-connected`, `settings-sync-folder`, `settings-narrow`; `State.width`.

**Criteri di accettazione:** i due file nuovi verdi in build e in sviluppo sull'app di oggi; i 10 stati verdi nell'audit; `npm test` e `npm run lint` invariati (980, pulito); `dist-baseline/` costruita da questo commit dell'app (React), con lo SHA in `dist-baseline/BASELINE_SHA` e nel commento finale; conteggi e gzip annotati nel commento finale.

- [ ] **Step 1: Baseline e build di riferimento**

```bash
cd <worktree del branch lab/LAB-5-fase-7>
git status --short && git log --oneline -3      # pulito; sopra 5fa9abf solo i commit del piano
npm ci
npm test                                          # annotare (12/10 nel prototipo: 980)
npm run lint
git rev-parse HEAD                                # annotare: lo SHA da cui nasce la baseline (app React di oggi)
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (12/10: 441 143)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit per TUTTA la fase: non si ricostruisce più
git rev-parse HEAD > dist-baseline/BASELINE_SHA   # provenienza: la 7b la ritrova qui (dist-baseline/ non è versionata)
```

Lo SHA va anche nel commento finale della sub-issue («`dist-baseline/` costruita da `<SHA>`»): serve alla 7b (Task 6, Step 0) e all'handover (Task 8).

- [ ] **Step 2: E2e delle impostazioni scoperte oggi**

`e2e/settings-sections.spec.ts` (il preset predefinito si trova con l'id della sezione, `#settings-ai-presets`: le sezioni non hanno un nome accessibile e «+ Create», «Name», «Save» ci sono in tutte e tre; l'id è già il bersaglio dello scorrimento e resta identico):

```ts
import { expect, test, type App } from './support/app.ts';

/** Rete della fase 7 (Task 1): comportamenti delle impostazioni che le altre spec non toccano. */

const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function openSettings(app: App): Promise<void> {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(settings(app)).toBeVisible();
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
});

test('autosave: the delay shows only after a pause, Enter clamps and saves it, everything is remembered after a reload', async ({ app, page }) => {
  await openSettings(app);
  const delay = settings(app).getByRole('spinbutton', { name: app.t('settings.delay') });
  await expect(delay).toHaveValue('1000');
  await delay.fill('50');
  await delay.press('Enter');
  await expect(delay).toHaveValue('500');
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.off') }).check();
  await expect(delay).toHaveCount(0);
  await page.reload();
  await expect(settings(app)).toBeVisible();
  await expect(settings(app).getByRole('radio', { name: app.t('settings.autosave.off') })).toBeChecked();
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.afterDelay') }).check();
  await expect(delay).toHaveValue('500');
});

test('Escape closes the settings and the focus goes back to the settings button', async ({ app, page }) => {
  await openSettings(app);
  await page.keyboard.press('Escape');
  await expect(settings(app)).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('toolbar.settings') })).toBeFocused();
});

test('the theme radios change the theme of the page', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('radio', { name: app.t('theme.option.dark') }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(settings(app).getByRole('radio', { name: app.t('theme.option.dark') })).toBeChecked();
});

test('Save all in the settings saves the open file (autosave off)', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('radio', { name: app.t('settings.autosave.off') }).check();
  await page.keyboard.press('Escape');
  await app.typeAtEnd('\nmore');
  await page.waitForTimeout(1500);
  expect(await app.disk('a.md')).toBe('# A');
  await openSettings(app);
  await settings(app).getByRole('button', { name: app.t('settings.saveAll') }).click();
  await expect.poll(() => app.disk('a.md')).toBe('# A\nmore');
});

test('the index follows the scroll: the section brought into view is the current link', async ({ app }) => {
  await openSettings(app);
  const index = settings(app).getByRole('navigation', { name: app.t('settings.sections') });
  await expect(index.getByRole('link', { name: app.t('settings.general') })).toHaveAttribute('aria-current', 'true');
  // Profili, non Sync: le ultime sezioni non arrivano in cima (padding di 40vh) e l'indice resta su Profili (limite di oggi, fase 8).
  await index.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await expect(index.getByRole('link', { name: app.t('settings.aiProfiles') })).toHaveAttribute('aria-current', 'true');
  await expect(index.getByRole('link', { name: app.t('settings.general') })).not.toHaveAttribute('aria-current', 'true');
});

test('a cloud profile asks for the key: the address is fixed, Save key is off until something is typed', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toBeDisabled();
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toHaveValue('https://api.anthropic.com');
  const save = settings(app).getByRole('button', { name: app.t('ai.saveSecret') });
  await expect(save).toBeDisabled();
  await settings(app).getByLabel(app.t('ai.secret')).fill('sk-test');
  await expect(save).toBeEnabled();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('ollama');
  await expect(settings(app).getByLabel(app.t('ai.secret'))).toHaveCount(0);
  await expect(settings(app).getByRole('textbox', { name: app.t('ai.url') })).toHaveValue('http://localhost:11434');
});

test('the key typed in the password field: where it ends up in the DOM', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
  await settings(app).getByLabel(app.t('ai.secret')).fill('sk-test');
  // React tiene sincronizzato l'attributo `value` dei campi controllati: oggi la chiave sta anche nel DOM serializzato (il Task 2 lo rovescia).
  expect(await page.evaluate(() => document.body.outerHTML.includes('sk-test'))).toBe(true);
});

test('Connection on the local profile says Connected (fake Ollama)', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  await settings(app).getByRole('button', { name: app.t('ai.connection') }).click();
  await expect(settings(app).getByRole('status').filter({ hasText: app.t('ai.connected') })).toBeVisible();
});

test('a built-in preset offers Restore original instead of Delete, and restoring brings its instructions back', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiPresets') }).click();
  // La seconda sezione AI è quella dei preset: il primo pulsante dell'elenco è un preset predefinito.
  const presets = settings(app).locator('#settings-ai-presets');
  await presets.getByRole('button').first().click();
  const instructions = presets.getByRole('textbox', { name: app.t('ai.instructions') });
  const original = await instructions.inputValue();
  await expect(presets.getByRole('button', { name: app.t('ai.delete'), exact: true })).toHaveCount(0);
  await instructions.fill('changed');
  await presets.getByRole('button', { name: app.t('ai.restoreOriginal') }).click();
  await expect(instructions).toHaveValue(original);
});

test('a sync folder: its name, the status line, Sync now and the backups; Disable takes it away', async ({ app }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiSync') }).click();
  await app.setFlags({ folder: 'sync' });
  await settings(app).getByRole('button', { name: app.t('ai.syncChoose') }).click();
  await expect(settings(app).getByText('sync', { exact: true })).toBeVisible();
  await expect(settings(app).getByRole('button', { name: app.t('ai.syncNow') })).toBeEnabled();
  await expect(settings(app).getByText(app.t('ai.backups'))).toBeVisible();
  await settings(app).getByRole('button', { name: app.t('ai.syncDisable') }).click();
  await expect(settings(app).getByRole('button', { name: app.t('ai.syncNow') })).toHaveCount(0);
  await expect(settings(app).getByText('sync', { exact: true })).toHaveCount(0);
});
```

Note: «Save all» passa con l'autosalvataggio spento, altrimenti la scrittura arriverebbe comunque dopo la pausa. «the index follows the scroll» usa Profili e non Sync: saltando a Sync la voce corrente resta Profili (le ultime sezioni non arrivano in cima, «Misure»). Il test della chiave afferma **il comportamento di oggi** (la chiave nel DOM serializzato): il Task 2 lo rovescia.

- [ ] **Step 3: E2e del guscio del workspace scoperto oggi**

`e2e/workspace-shell.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

/** Rete della fase 7 (Task 1): il guscio del workspace che le altre spec non toccano. */

const separator = (app: App) => app.page.getByRole('separator', { name: app.t('sidebar.resize') });

test('dragging the separator resizes the sidebar and is remembered; the AI panel has its own width', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  const box = (await separator(app).boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(350, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '350');
  await app.mode('mode.ai').click();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '380');
  await page.reload();
  await expect(app.mode('mode.ai')).toHaveAttribute('aria-pressed', 'true');
  await app.mode('mode.split').click();
  await expect(separator(app)).toHaveAttribute('aria-valuenow', '350');
});

test('with no file open: the hint and New file, which creates the file and opens it', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await expect(page.getByText(app.t('empty.hint'))).toBeVisible();
  await expect(page.getByRole('button', { name: app.t('toolbar.history') })).toBeDisabled();
  await page.getByRole('main').getByRole('button', { name: app.t('file.new'), exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('new');
  await dialog.getByRole('textbox').press('Enter');
  await expect.poll(() => app.exists('new.md')).toBe(true);
  await app.expectOpen('new.md');
});

test('Ctrl+Shift+E enters AI mode and leaves it for the last document view', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  await app.mode('mode.preview').click();
  await expect(app.mode('mode.ai')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+E');
  await expect(app.mode('mode.ai')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: app.t('ai.request') })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+E');
  await expect(app.mode('mode.preview')).toHaveAttribute('aria-pressed', 'true');
});

test('Ctrl+K in AI mode goes back to the last view, opens the file tree and focuses the search', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
  await app.mode('mode.ai').click();
  await expect(app.tree()).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: app.t('search.label') })).toBeFocused();
});

test('Escape in AI mode, with the focus outside the composer, stops the generation', async ({ app, ai, page }) => {
  ai.hold();
  await app.openFolder({ 'a.md': 'A' });
  await app.openFile('a.md');
  await app.mode('mode.ai').click();
  const composer = page.getByRole('textbox', { name: app.t('ai.request') });
  await composer.fill('fix');
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
  await app.mode('mode.ai').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: app.t('ai.send'), exact: true })).toBeVisible();
});
```

- [ ] **Step 4: Gli stati di audit**

In `e2e/computed-styles.audit.ts`, nell'interfaccia `State` dopo `keepMouse`:

```ts
  /** Larghezza della finestra (default 1280): per i layout stretti (`@media (width < 700px)`). */
  width?: number;
```

nel test, le due righe del ridimensionamento di stabilizzazione usano la larghezza dello stato (altrimenti lo stato stretto tornerebbe a 1280 prima della lettura):

```ts
      await page.setViewportSize({ width: state.width ?? 1280, height: 799 });
      await page.setViewportSize({ width: state.width ?? 1280, height: 800 });
```

e prima dello stato `tree-menu` i dieci stati nuovi:

```ts
  // Rete della fase 7 (Task 1): stati delle impostazioni e del guscio del workspace che nessuno fotografa.
  {
    name: 'workspace-empty',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await expect(page.getByText(app.t('empty.hint'))).toBeVisible();
    },
  },
  {
    name: 'sidebar-hidden',
    async setup(app, page) {
      await workspace(app);
      await page.getByRole('button', { name: app.t('sidebar.hide'), pressed: true }).click();
      await expect(app.tree()).toHaveCount(0);
    },
  },
  {
    name: 'resizer-focus-keyboard',
    async setup(app, page) {
      await workspace(app);
      // Come focus-button-keyboard: l'ultima interazione è la tastiera, così il separatore ha l'anello.
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.keyboard.press('Escape');
      const separator = page.getByRole('separator', { name: app.t('sidebar.resize') });
      await separator.focus();
      await page.keyboard.press('ArrowRight');
      await expect(separator).toHaveAttribute('aria-valuenow', '296');
    },
  },
  {
    name: 'orphans',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await app.openFile('note.md');
      await app.setFlags({ denyWrites: true, request: 'denied' });
      await app.typeAtEnd('orphan text');
      await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();
      await app.setFlags({ denyWrites: false, request: 'granted' });
      await app.removeExternal('note.md');
      await page.reload();
      await expect(page.getByRole('region', { name: app.t('orphans.title') }).getByRole('button', { name: 'note.md', exact: true })).toBeVisible();
      // I toast del ripristino scadono: si chiudono, così le due build non dipendono dal tempo.
      for (const close of await page.getByRole('button', { name: app.t('toast.close') }).all()) await close.click();
    },
  },
  {
    name: 'settings-autosave-off',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('radio', { name: app.t('settings.autosave.off') }).check();
      await expect(settings.getByRole('spinbutton', { name: app.t('settings.delay') })).toHaveCount(0);
    },
  },
  {
    name: 'settings-preset',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiPresets') }).click();
      await settings.locator('#settings-ai-presets').getByRole('button').first().click();
      await expect(settings.getByRole('button', { name: app.t('ai.restoreOriginal') })).toBeVisible();
    },
  },
  {
    name: 'settings-cloud-profile',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
      await settings.getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
      await expect(settings.getByRole('button', { name: app.t('ai.saveSecret') })).toBeDisabled();
    },
  },
  {
    name: 'settings-connected',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: 'ollama', exact: true }).click();
      await settings.getByRole('button', { name: app.t('ai.connection') }).click();
      await expect(settings.getByRole('status').filter({ hasText: app.t('ai.connected') })).toBeVisible();
    },
  },
  {
    name: 'settings-sync-folder',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
      await app.setFlags({ folder: 'sync' });
      await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
      await expect(settings.getByRole('button', { name: app.t('ai.syncNow') })).toBeEnabled();
      // La riga di stato porta l'ora dell'ultima sincronizzazione: si aspetta che sia scritta.
      await expect(settings.getByText(app.t('ai.backups'))).toBeVisible();
      await settings.getByText(app.t('ai.backups')).click();
    },
  },
  {
    name: 'settings-narrow',
    width: 600,
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: 'ollama', exact: true }).click();
      await expect(settings.getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
    },
  },
```

- [ ] **Step 5: Verdi sull'app di oggi**

```bash
npx tsc --noEmit -p e2e
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/settings-sections.spec.ts e2e/workspace-shell.spec.ts
# atteso: 15 passed (prototipo: 17 s)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/settings-sections.spec.ts e2e/workspace-shell.spec.ts
# atteso: 15 passed, console pulita
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "workspace-empty|sidebar-hidden|resizer-focus|orphans|settings-"
# atteso: verdi tutti i [current] (11: i 10 nuovi più settings-profile); il progetto baseline gira tutto
pgrep -af "vite|chrom|playwright"      # nulla di proprio appeso
```

Se `orphans` o `settings-*` cadono con «Target page… closed» al `page.reload()`: è la trappola nota, ripetere da soli.

- [ ] **Step 6: Commit**

```bash
git add e2e/settings-sections.spec.ts e2e/workspace-shell.spec.ts e2e/computed-styles.audit.ts
git -c core.hooksPath=/dev/null commit -m "test: rete della fase 7 su impostazioni e guscio del workspace di oggi"
git log --format=%B -n 1        # nessun Co-authored-by
git push
```

### Task 2: `hmd-settings-profiles` e `hmd-settings-presets` (Builder)

Le due sezioni con elenco e bozza diventano elementi, montati da `SettingsView.tsx` (React) al posto di `AiProfilesSection` e `AiPresetsSection`; l'elenco (`ItemList.tsx`) e l'adattatore `useDraft` diventano `itemList.ts` e `#setDraft`. Il foglio comune delle tre sezioni AI (`sections.css`) nasce qui, con le due eccezioni di `architecture.test.ts` (decisioni 2 e 4). Il test e2e della chiave si rovescia (decisione 5). `AiSyncSection.tsx` e `Settings.module.css` restano fino al Task 3.

**Files:**
- Create: `src/elements/settings/fields.ts`, `itemList.ts`, `sections.css`, `presets.element.ts`, `profiles.element.ts`, `presets.dom.test.ts`, `profiles.dom.test.ts`
- Modify: `src/architecture.test.ts` (radici multiple, eccezione `setSecret`), `src/elements/events.ts` (`hmd-settings-dirty`), `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/SettingsView.tsx`, `e2e/settings-sections.spec.ts` (test della chiave)
- Delete: `src/ui/ai/settings/AiProfilesSection.tsx`, `AiPresetsSection.tsx`, `ItemList.tsx`

**Interfaces:**
- Consumes: `state/draftState.ts`, `ai/presets.ts`, `ai/presetName.ts`, `ai/profiles.ts`, `ai/models.ts` (`changeProvider`), `elements/dialogs/confirmDialog.ts`, `hmd-ai-model-select`, `hmd-ai-parameters`.
- Produces: `HmdSettingsProfiles` (`controller: ProfilesController`, `i18n`, getter `dirty`; evento `hmd-settings-dirty { dirty }`), `HmdSettingsPresets` (idem con `PresetsController`), `ProfilesController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'provider' | 'saveProfile' | 'deleteProfile' | 'setSecret'>`, `PresetsController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'savePreset' | 'deletePreset'>`, `renderItemList(list, items, options)`, `field`, `checkbox`, `syncValue`, `syncChecked`, `showChildren`.

**Criteri di accettazione:** RED dei due test jsdom annotato; `npm test` 980 + 12 (6 + 6) = **992**, verde; lint pulito; `settings.spec.ts`, `settings-sections.spec.ts`, `ai-model.spec.ts`, `ai-chips.spec.ts` verdi in build e in sviluppo (con il test della chiave rovesciato); audit `settings-profile`, `settings-preset`, `settings-cloud-profile`, `settings-connected`, `settings-narrow`, `settings` verdi contro `dist-baseline/`; `grep -rn "AiProfilesSection\|AiPresetsSection\|ItemList\|useDraft" src` → uscita 1.

- [ ] **Step 1: I test jsdom, prima del codice**

`src/elements/settings/presets.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { builtInPresets } from '../../ai/presets';
import type { PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
test.afterEach(() => document.body.replaceChildren());

const MINE: PromptPreset = { ...builtInPresets()[0], id: 'mine', builtInId: undefined, name: 'Mine', instructions: 'do it', order: 5 };
const BUILT_IN: PromptPreset = { ...builtInPresets()[0], order: 1 };

function mount(presets: PromptPreset[] = [MINE, BUILT_IN]) {
  const { store: i18n, listeners } = countListeners(createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} }));
  const ai = fakeAi({ presets } as Partial<AiState>);
  const saved: PromptPreset[] = [];
  const deleted: string[] = [];
  Object.assign(ai, {
    savePreset: async (p: PromptPreset) => void saved.push(p),
    deletePreset: async (id: string) => void deleted.push(id),
  });
  const el = document.createElement('hmd-settings-presets');
  el.controller = ai as never;
  el.i18n = i18n;
  document.body.append(el);
  const dirty: boolean[] = [];
  el.addEventListener('hmd-settings-dirty', (event) => dirty.push(event.detail.dirty));
  const items = () => [...el.querySelectorAll<HTMLButtonElement>('.list > button')];
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!;
  const name = () => el.querySelector<HTMLInputElement>('.detail input')!;
  return { el, ai, i18n, listeners, saved, deleted, dirty, items, button, name };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('the same DOM as AiPresetsSection.tsx: a split with the sorted list and + Create, no detail until one is opened', () => {
  const { el, items } = mount();
  const split = el.firstElementChild!;
  assert.equal(split.className, 'split');
  assert.deepEqual([...split.children].map((c) => c.className), ['list']);
  assert.deepEqual(items().map((b) => b.textContent), [EN_MESSAGES[`ai.preset.${BUILT_IN.builtInId}` as keyof typeof EN_MESSAGES] ?? BUILT_IN.name, 'Mine', `+ ${EN_MESSAGES['ai.create']}`]);
  assert.equal(items().at(-1)!.className, 'create');
});

test('opening a preset shows its detail in the order of the React form; the open item is aria-current', () => {
  const { el, items, name } = mount();
  items()[1].click();
  const detail = el.querySelector('.detail')!;
  assert.deepEqual([...detail.children].map((c) => c.localName), ['label', 'label', 'label', 'label', 'label', 'label', 'label', 'hmd-ai-parameters', 'div']);
  assert.equal(name().value, 'Mine');
  assert.equal(items()[1].getAttribute('aria-current'), 'true');
  assert.equal(items()[0].hasAttribute('aria-current'), false);
  // Un preset suo: Elimina; uno predefinito: Ripristina l'originale, nello stesso posto.
  assert.deepEqual([...detail.querySelectorAll('.actions button')].map((b) => b.textContent), [EN_MESSAGES['ai.duplicate'], EN_MESSAGES['ai.delete'], EN_MESSAGES['ai.save']]);
  items()[0].click();
  assert.deepEqual([...detail.querySelectorAll('.actions button')].map((b) => b.textContent), [EN_MESSAGES['ai.duplicate'], EN_MESSAGES['ai.restoreOriginal'], EN_MESSAGES['ai.save']]);
});

test('typing makes the draft dirty (one event), the focused field is never rewritten, Save makes it clean again', async () => {
  const { el, items, name, dirty, saved, button } = mount();
  items()[1].click();
  name().focus();
  type(name(), 'Mine 2');
  type(name(), 'Mine 23');
  assert.deepEqual(dirty, [true]);
  assert.equal(el.dirty, true);
  assert.equal(name().value, 'Mine 23');
  button(EN_MESSAGES['ai.save']).click();
  await waitFor(() => saved.length === 1);
  assert.equal(saved[0].name, 'Mine 23');
  await waitFor(() => dirty.length === 2);
  assert.deepEqual(dirty, [true, false]);
});

test('switching with unsaved changes asks first: Cancel keeps the draft, Discard opens the other preset', async () => {
  const { items, name, button } = mount();
  items()[1].click();
  type(name(), 'Draft');
  items()[0].click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.open);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['dialog.cancel'])!.click();
  await waitFor(() => document.querySelector('dialog') === null);
  assert.equal(name().value, 'Draft');
  items()[0].click();
  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.discardChanges'])!.click();
  await waitFor(() => name().value !== 'Draft');
  assert.ok(button(EN_MESSAGES['ai.restoreOriginal']));
});

test('Delete asks first and removes the preset; the detail goes away', async () => {
  const { el, items, button, deleted } = mount();
  items()[1].click();
  button(EN_MESSAGES['ai.delete']).click();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.textContent!.includes(EN_MESSAGES['ai.deleteMessage']));
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.delete'])!.click();
  await waitFor(() => deleted.length === 1);
  assert.deepEqual(deleted, ['mine']);
  await waitFor(() => el.querySelector('.detail') === null);
});

test('detached: the confirmation closes, the store and language listeners are gone', async () => {
  const { el, ai, listeners, items, name } = mount();
  items()[1].click();
  type(name(), 'Draft');
  items()[0].click();
  assert.ok(document.querySelector('dialog'));
  el.remove();
  await waitFor(() => document.querySelector('dialog') === null);
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
```

`src/elements/settings/profiles.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { ChatProvider, ModelProfile } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
installPopoverStub();
test.afterEach(() => document.body.replaceChildren());

const OLLAMA = defaultProfile('ollama', 'o');
const CLOUD: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud' };

function mount() {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const ai = fakeAi({ profiles: [OLLAMA, CLOUD] } as Partial<AiState>);
  const secrets: unknown[][] = [];
  const saved: ModelProfile[] = [];
  let connection: 'ok' | 'down' = 'ok';
  Object.assign(ai, {
    setSecret: async (...args: unknown[]) => void secrets.push(args),
    saveProfile: async (p: ModelProfile) => void saved.push(p),
    deleteProfile: async () => {},
    provider: async () => ({ listModels: async () => (connection === 'ok' ? [] : null) }) as unknown as ChatProvider,
  });
  const el = document.createElement('hmd-settings-profiles');
  el.controller = ai as never;
  el.i18n = i18n;
  document.body.append(el);
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label);
  const field = (label: string) => ([...el.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)?.querySelector('input, select') ?? null) as HTMLInputElement | null;
  return { el, ai, secrets, saved, button, field, down: () => (connection = 'down') };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('a local profile: name, provider, url, help, model, parameters, context, effort and the actions; no key field', () => {
  const { el, button, field } = mount();
  button('ollama')!.click();
  const detail = el.querySelector('.detail')!;
  assert.deepEqual([...detail.children].map((c) => c.localName), ['label', 'label', 'label', 'p', 'hmd-ai-model-select', 'hmd-ai-parameters', 'label', 'label', 'div']);
  assert.equal(field(EN_MESSAGES['ai.provider'])!.value, 'ollama');
  assert.equal(field(EN_MESSAGES['ai.secret']), null);
  assert.equal(el.querySelector('hmd-ai-model-select')!.profile?.id, 'o');
});

test('a cloud profile: the key field, Remember, the notice and Save key (off while the field is empty); the url is off for Anthropic', () => {
  const { el, button, field } = mount();
  button('Cloud')!.click();
  assert.equal(field(EN_MESSAGES['ai.url'])!.disabled, true);
  const key = field(EN_MESSAGES['ai.secret'])!;
  assert.equal(key.type, 'password');
  assert.equal(key.autocomplete, 'off');
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.disabled, true);
  type(key, 'sk-test');
  assert.equal(button(EN_MESSAGES['ai.saveSecret'])!.disabled, false);
  // La chiave non finisce mai in un attributo.
  assert.ok(!el.outerHTML.includes('sk-test'));
});

test('Save key hands the key to the controller once and empties the field', async () => {
  const { button, field, secrets } = mount();
  button('Cloud')!.click();
  type(field(EN_MESSAGES['ai.secret'])!, 'sk-test');
  button(EN_MESSAGES['ai.saveSecret'])!.click();
  await waitFor(() => secrets.length === 1);
  assert.equal(secrets[0][1], 'sk-test');
  assert.equal(secrets[0][2], false);
  await waitFor(() => field(EN_MESSAGES['ai.secret'])!.value === '');
});

test('changing provider sets its default url and forgets the typed key', () => {
  const { button, field } = mount();
  button('Cloud')!.click();
  type(field(EN_MESSAGES['ai.secret'])!, 'sk-test');
  const provider = field(EN_MESSAGES['ai.provider'])! as unknown as HTMLSelectElement;
  provider.value = 'openai-compatible';
  provider.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(field(EN_MESSAGES['ai.url'])!.value, 'https://api.openai.com');
  assert.equal(field(EN_MESSAGES['ai.secret'])!.value, '');
});

test('Connection: «Connected» as a status only after a good answer; an unreachable server is reported', async () => {
  const { el, ai, button, down } = mount();
  button('ollama')!.click();
  button(EN_MESSAGES['ai.connection'])!.click();
  await waitFor(() => el.querySelector('[role="status"]') !== null);
  assert.equal(el.querySelector('[role="status"]')!.textContent, EN_MESSAGES['ai.connected']);
  down();
  button(EN_MESSAGES['ai.connection'])!.click();
  assert.equal(el.querySelector('[role="status"]'), null);
  await waitFor(() => ai.reports.length === 1);
  assert.deepEqual(ai.reports, [{ code: 'unreachable' }]);
});

test('Save validates the profile and makes the draft clean', async () => {
  const { el, button, field, saved } = mount();
  button('ollama')!.click();
  type(field(EN_MESSAGES['ai.name'])!, 'Local');
  assert.equal(el.dirty, true);
  button(EN_MESSAGES['ai.save'])!.click();
  await waitFor(() => saved.length === 1 && !el.dirty);
  assert.equal(saved[0].name, 'Local');
});
```

```bash
npx tsx --import ./src/testing/assetHooks.ts --test --test-timeout=20000 src/elements/settings/presets.dom.test.ts src/elements/settings/profiles.dom.test.ts
```

RED atteso (annotarlo): il modulo `../define` non conosce ancora i due tag, quindi `document.createElement('hmd-settings-presets')` è un `HTMLElement` vuoto: i test cadono su `el.firstElementChild!` (null) o sui pulsanti che non ci sono; `npx tsc --noEmit` segnala `el.dirty` e `el.controller` sconosciuti.

- [ ] **Step 2: Campi ed elenco condivisi**

`src/elements/settings/fields.ts`:

```ts
import { el } from '../../dom/el';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** `label > span + campo`, come i campi del dettaglio di profili e preset. */
export function field(caption: HTMLSpanElement, control: Field): HTMLLabelElement {
  return el('label', null, caption, control);
}

/** `label > checkbox + testo`. */
export function checkbox(control: HTMLInputElement, text: Text): HTMLLabelElement {
  return el('label', null, control, text);
}

/**
 * Valore di un campo dalla bozza. Un campo con il focus non si riscrive mai (lezione delle fasi 4–6b): il
 * testo che l'utente scrive è già la bozza; si riallinea al `focusout` (per esempio un numero non valido).
 */
export function syncValue(control: Field, value: string): void {
  if (control.value !== value && control.ownerDocument.activeElement !== control) control.value = value;
}

export function syncChecked(control: HTMLInputElement, checked: boolean): void {
  if (control.checked !== checked) control.checked = checked;
}

/**
 * Figli condizionali di `parent` (come `{cond && <x/>}` di React): toglie quelli di `all` non voluti e
 * inserisce i voluti mancanti nell'ordine di `wanted`, senza mai spostare un nodo già al suo posto.
 */
export function showChildren(parent: Element, wanted: readonly Element[], all: readonly Element[]): void {
  for (const node of all) if (!wanted.includes(node) && node.parentNode === parent) node.remove();
  let cursor: Element | null = parent.firstElementChild;
  for (const node of wanted) {
    if (node === cursor) cursor = cursor.nextElementSibling;
    else parent.insertBefore(node, cursor);
  }
}
```

`src/elements/settings/itemList.ts`:

```ts
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';

export interface ItemListOptions<T> {
  selectedId: string | null;
  label(item: T): string;
  createLabel: string;
  onSelect(item: T): void;
  onCreate(): void;
}

type Row<T> = { kind: 'item'; item: T } | { kind: 'create' };

/** Le opzioni dell'ultimo render di ogni elenco e la voce di ogni pulsante: i clic leggono sempre quelle. */
const lists = new WeakMap<Element, ItemListOptions<never>>();
const rows = new WeakMap<Element, unknown>();

/**
 * Elenco di profili o preset con «+ Crea» in fondo (era ItemList.tsx): un pulsante per voce, la voce aperta
 * con `aria-current`. I pulsanti si riusano per id, così il focus resta su quello premuto.
 */
export function renderItemList<T extends { id: string }>(list: HTMLDivElement, items: readonly T[], options: ItemListOptions<T>): void {
  lists.set(list, options as ItemListOptions<never>);
  const select = (node: Element) => (lists.get(list) as ItemListOptions<T> | undefined)?.onSelect(rows.get(node) as T);
  const all: Row<T>[] = [...items.map((item) => ({ kind: 'item' as const, item })), { kind: 'create' }];
  reconcileList(
    list,
    all,
    (row) => (row.kind === 'item' ? `item:${row.item.id}` : 'create'),
    (row) =>
      row.kind === 'item'
        ? el('button', { type: 'button', class: 'item', on: { click: (event) => select(event.currentTarget as Element) } })
        : el('button', { type: 'button', class: 'create', on: { click: () => lists.get(list)?.onCreate() } }),
    (node, row) => {
      if (row.kind === 'create') return setText(node, `+ ${options.createLabel}`);
      rows.set(node, row.item);
      setText(node, options.label(row.item));
      toggleAttr(node, 'aria-current', row.item.id === options.selectedId, 'true');
    },
  );
}
```

- [ ] **Step 3: Il foglio comune e le radici multiple (decisioni 2 e 3)**

`src/elements/settings/sections.css`:

```css
@layer components {
  /*
   * Valori copiati da Settings.module.css: le tre sezioni AI condividono elenco e dettaglio. Nessun limite
   * inferiore: oggi `.detail label` e `.detail input` raggiungono anche i campi di hmd-ai-model-select e
   * hmd-ai-parameters, e lì vincevano perché il modulo stava fuori dai layer. Dentro il layer vincerebbe il
   * foglio più vicino (prossimità di @scope) a pari specificità: `:scope` davanti alza la specificità di
   * una classe e tiene il risultato di oggi (misurato con l'audit «settings-profile»).
   */
  @scope (hmd-settings-profiles, hmd-settings-presets, hmd-settings-sync) {
    :scope {
      display: contents;
    }

    .split {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
    }

    .item,
    .create {
      padding: 6px 8px;
      border: none;
      border-radius: 6px;
      background: none;
      color: var(--c-text);
      text-align: start;
      cursor: pointer;
    }

    .item[aria-current='true'] {
      background: var(--c-accent-soft);
    }

    .create {
      color: var(--c-accent);
    }

    .detail {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    :scope .detail label {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    :scope .detail label > span {
      flex: 0 0 11rem;
    }

    :scope .detail input:not([type='checkbox']):not([type='radio']),
    :scope .detail select,
    :scope .detail textarea {
      flex: 1;
      min-width: 0;
    }

    .detail textarea {
      min-height: 8rem;
    }

    .help {
      margin: 0;
      color: var(--c-muted);
      font-size: 13px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }

    .actions > :last-child {
      margin-inline-start: auto;
    }

    @media (width < 700px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
}
```

In `src/architecture.test.ts`, dentro `scopeProblems`, la riga del `const m = …` e la successiva diventano (le radici separate da virgola, ognuna controllata):

```ts
      // Più radici separate da virgola (sezioni con un foglio comune), ognuna ammessa nella cartella.
      const m = /^@scope\s*\(\s*([^)\s,]+(?:\s*,\s*[^)\s,]+)*)\s*\)(?:\s+to\s*\(\s*(hmd-[a-z-]+(?:\s*,\s*hmd-[a-z-]+)*)\s*\))?$/.exec(scope.prelude);
      if (!m || scope.body === null) problems.push(`non è un @scope: ${scope.prelude}`);
      else for (const root of m[1].split(/\s*,\s*/)) if (!rootAllowed(folder, root)) problems.push(`radice non ammessa in ${folder}/: ${root}`);
```

e nel test «the @scope check accepts the allowed shapes…», dopo la riga di `hmd-settings-profiles`:

```ts
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-profiles, hmd-settings-presets) {} }'), []);
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-sync, hmd-preview) {} }'), ['radice non ammessa in settings/: hmd-preview']);
```

(RED: con la regex di oggi la prima riga dà `non è un @scope: …`.)

- [ ] **Step 4: `hmd-settings-presets`**

`src/elements/settings/presets.element.ts`:

```ts
import type { AiController } from '../../ai/aiController';
import { presetLabel } from '../../ai/presetName';
import { builtInPresets, restorePreset } from '../../ai/presets';
import { defaultProfile } from '../../ai/profiles';
import type { PromptPreset } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../state/draftState';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdAiParameters } from '../ai/parameters.element';
import { showConfirmDialog, showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { checkbox, field, syncChecked, syncValue } from './fields';
import { renderItemList } from './itemList';
import './sections.css';

/** Quello che la sezione dei preset usa del controller. */
export type PresetsController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'savePreset' | 'deletePreset'>;

const STRATEGIES = ['whole', 'chunked'] as const;
const FRONTMATTER = ['keep', 'include'] as const;

interface Detail {
  root: HTMLDivElement;
  captions: Record<'name' | 'instructions' | 'targetLanguage' | 'strategy' | 'frontmatter' | 'order', HTMLSpanElement>;
  name: HTMLInputElement;
  instructions: HTMLTextAreaElement;
  targetLanguage: HTMLInputElement;
  strategy: HTMLSelectElement;
  frontmatter: HTMLSelectElement;
  order: HTMLInputElement;
  hidden: HTMLInputElement;
  hiddenText: Text;
  params: HmdAiParameters;
  duplicate: HTMLButtonElement;
  restore: HTMLButtonElement;
  remove: HTMLButtonElement;
  save: HTMLButtonElement;
}

/**
 * Sezione dei preset nelle impostazioni (era AiPresetsSection.tsx): elenco ordinato con «+ Crea», dettaglio
 * della bozza aperta. Passare a un altro preset con modifiche aperte chiede conferma; eliminare chiede
 * conferma. Verso fuori manda solo `hmd-settings-dirty` quando la bozza diventa (o smette di essere) da
 * salvare; i dialog aperti da qui si chiudono al distacco.
 */
export class HmdSettingsPresets extends HmdElement {
  #controller: PresetsController | null = null;
  #i18n: I18nStore | null = null;

  #list: HTMLDivElement | null = null;
  #detail: Detail | null = null;
  #draft: DraftState<PromptPreset> = emptyDraft();
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
  });

  get controller(): PresetsController | null { return this.#controller; }
  set controller(value: PresetsController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  /** La bozza aperta ha modifiche non salvate. */
  get dirty(): boolean { return isDirty(this.#draft); }

  protected connect(signal: AbortSignal): void {
    if (!this.#list) {
      this.#list = el('div', { class: 'list' });
      this.append(el('div', { class: 'split' }, this.#list));
    }
    this.#dialogs ??= new AbortController();
    // Un campo riallineato quando perde il focus (mai riscritto mentre lo ha).
    this.addEventListener('focusout', () => queueMicrotask(() => this.#loop.update()), { signal });
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Stato salvato e disegnato prima di dire fuori che la bozza è cambiata. */
  #setDraft(next: DraftState<PromptPreset>): void {
    const was = isDirty(this.#draft);
    this.#draft = next;
    this.#loop.update();
    if (isDirty(next) !== was) emit(this, 'hmd-settings-dirty', { dirty: isDirty(next) });
  }

  #edit(patch: Partial<PromptPreset>): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, { ...draft, ...patch }));
  }

  #run(job: Promise<unknown>): void {
    void job.catch((error) => this.#controller?.report(error));
  }

  #choose(preset: PromptPreset): void {
    const t = this.#i18n?.t;
    const dirty = isDirty(this.#draft);
    this.#setDraft(selectDraft(this.#draft, preset));
    const signal = this.#dialogs?.signal;
    if (!dirty || !t || !signal) return;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      if (!signal.aborted) this.#setDraft(discard ? confirmSwitch(this.#draft) : cancelSwitch(this.#draft));
    });
  }

  #remove(preset: PromptPreset): void {
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (!t || !signal) return;
    const name = presetLabel(preset, t);
    void showConfirmDialog({ title: t('ai.deleteTitle', { name }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal }).then((ok) => {
      if (ok && this.#controller) this.#run(this.#controller.deletePreset(preset.id).then(() => this.#setDraft(openDraft(this.#draft, null))));
    });
  }

  #createDetail(): Detail {
    const caption = () => el('span');
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const captions = { name: caption(), instructions: caption(), targetLanguage: caption(), strategy: caption(), frontmatter: caption(), order: caption() };
    const detail: Detail = {
      root: el('div', { class: 'detail' }),
      captions,
      name: el('input', { on: { input: (e) => this.#edit({ name: value(e) }) } }),
      instructions: el('textarea', { on: { input: (e) => this.#edit({ instructions: value(e) }) } }),
      targetLanguage: el('input', { on: { input: (e) => this.#edit({ variables: { targetLanguage: value(e) } }) } }),
      strategy: el('select', { on: { change: (e) => this.#edit({ strategy: value(e) as PromptPreset['strategy'] }) } }, STRATEGIES.map((v) => el('option', { value: v }))),
      frontmatter: el('select', { on: { change: (e) => this.#edit({ frontmatter: value(e) as PromptPreset['frontmatter'] }) } }, FRONTMATTER.map((v) => el('option', { value: v }))),
      order: el('input', { type: 'number', min: '0', on: { input: (e) => this.#edit({ order: Math.max(0, Number(value(e)) || 0) }) } }),
      hidden: el('input', { type: 'checkbox', on: { change: (e) => this.#edit({ hidden: (e.currentTarget as HTMLInputElement).checked }) } }),
      hiddenText: document.createTextNode(''),
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (e) => this.#edit({ params: e.detail.params }) } }),
      duplicate: el('button', { type: 'button', on: { click: () => this.#duplicate() } }),
      restore: el('button', { type: 'button', on: { click: () => this.#restore() } }),
      remove: el('button', { type: 'button', on: { click: () => this.#draft.draft && this.#remove(this.#draft.draft) } }),
      save: el('button', { type: 'button', on: { click: () => this.#save() } }),
    };
    detail.params.profile = defaultProfile();
    detail.root.append(
      field(captions.name, detail.name),
      field(captions.instructions, detail.instructions),
      field(captions.targetLanguage, detail.targetLanguage),
      field(captions.strategy, detail.strategy),
      field(captions.frontmatter, detail.frontmatter),
      field(captions.order, detail.order),
      checkbox(detail.hidden, detail.hiddenText),
      detail.params,
      el('div', { class: 'actions' }, detail.duplicate, detail.restore, detail.save),
    );
    return detail;
  }

  #duplicate(): void {
    const draft = this.#draft.draft;
    const t = this.#i18n?.t;
    if (draft && t) this.#edit({ id: crypto.randomUUID(), builtInId: undefined, name: presetLabel(draft, t) });
  }

  #restore(): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, restorePreset(draft)));
  }

  #save(): void {
    const draft = this.#draft.draft;
    if (draft && this.#controller) this.#run(this.#controller.savePreset(draft).then(() => this.#setDraft(openDraft(this.#draft, draft))));
  }

  #render(list: HTMLDivElement, controller: PresetsController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const draft = this.#draft.draft;
    const sorted = [...state.presets].sort((a, b) => a.order - b.order);
    renderItemList(list, sorted, {
      selectedId: draft?.id ?? null,
      label: (p) => presetLabel(p, t),
      createLabel: t('ai.create'),
      onSelect: (p) => this.#choose({ ...p }),
      onCreate: () => this.#choose({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: controller.getState().presets.length }),
    });
    const split = list.parentElement!;
    if (!draft) {
      this.#detail?.root.remove();
      return;
    }
    const d = (this.#detail ??= this.#createDetail());
    setText(d.captions.name, t('ai.name'));
    setText(d.captions.instructions, t('ai.instructions'));
    setText(d.captions.targetLanguage, t('ai.targetLanguage'));
    setText(d.captions.strategy, t('ai.strategy'));
    setText(d.captions.frontmatter, t('ai.frontmatter'));
    setText(d.captions.order, t('ai.order'));
    [...d.strategy.options].forEach((o) => setText(o, t(`ai.strategy.${o.value as (typeof STRATEGIES)[number]}`)));
    [...d.frontmatter.options].forEach((o) => setText(o, t(`ai.frontmatter.${o.value as (typeof FRONTMATTER)[number]}`)));
    setText(d.hiddenText, t('ai.hidden'));
    setText(d.duplicate, t('ai.duplicate'));
    setText(d.restore, t('ai.restoreOriginal'));
    setText(d.remove, t('ai.delete'));
    setText(d.save, t('ai.save'));
    syncValue(d.name, draft.name);
    syncValue(d.instructions, draft.instructions);
    syncValue(d.targetLanguage, draft.variables?.targetLanguage ?? '');
    syncValue(d.strategy, draft.strategy);
    syncValue(d.frontmatter, draft.frontmatter);
    syncValue(d.order, String(draft.order));
    syncChecked(d.hidden, draft.hidden);
    const params = draft.params ?? {};
    if (d.params.i18n !== i18n) d.params.i18n = i18n;
    if (d.params.value !== params) d.params.value = params;
    // Ripristina (preset predefinito) o Elimina, nello stesso posto.
    const second = draft.builtInId ? d.restore : d.remove;
    const other = draft.builtInId ? d.remove : d.restore;
    if (second.parentNode !== d.save.parentNode) d.save.before(second);
    other.remove();
    if (d.root.parentNode !== split) split.append(d.root);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-presets': HmdSettingsPresets;
  }
}
```

- [ ] **Step 5: `hmd-settings-profiles` e l'eccezione della chiave (decisione 4)**

`src/elements/settings/profiles.element.ts` (i metodi privati si chiamano `#storeKey` e `#forgetKey`: `#saveSecret(` farebbe scattare `ELEMENT_AI`, misurato):

```ts
import type { AiController } from '../../ai/aiController';
import { changeProvider } from '../../ai/models';
import { DEFAULT_URLS, defaultProfile, PROVIDER_KINDS, validateProfile } from '../../ai/profiles';
import type { ModelProfile, ProviderKind } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { MessageKey } from '../../i18n/messages';
import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../state/draftState';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdAiModelSelect } from '../ai/model-select.element';
import type { HmdAiParameters } from '../ai/parameters.element';
import { showConfirmDialog, showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { checkbox, field, showChildren, syncChecked, syncValue } from './fields';
import { renderItemList } from './itemList';
import './sections.css';

/** Quello che la sezione dei profili usa del controller (il selettore del modello compreso). */
export type ProfilesController = Pick<AiController, 'subscribe' | 'getState' | 'report' | 'provider' | 'saveProfile' | 'deleteProfile' | 'setSecret'>;

/** Provider con l'effort come opzione del profilo, e provider con una chiave. */
const EFFORT_KINDS: readonly ProviderKind[] = ['ollama', 'lmstudio', 'openai-compatible'];
const SECRET_KINDS: readonly ProviderKind[] = ['anthropic', 'openai-compatible'];

interface Detail {
  root: HTMLDivElement;
  captions: Record<'name' | 'provider' | 'url' | 'contextTokens' | 'secret', HTMLSpanElement>;
  /** Campi sempre presenti, nell'ordine di AiProfilesSection.tsx. */
  fixed: HTMLLabelElement[];
  name: HTMLInputElement;
  provider: HTMLSelectElement;
  url: HTMLInputElement;
  help: HTMLParagraphElement;
  model: HmdAiModelSelect;
  params: HmdAiParameters;
  contextTokensLabel: HTMLLabelElement;
  contextTokens: HTMLInputElement;
  effortLabel: HTMLLabelElement;
  effort: HTMLInputElement;
  effortText: Text;
  secretLabel: HTMLLabelElement;
  /** La chiave scritta: solo nel campo e qui finché non si salva, mai in attributi o nella bozza. */
  secret: HTMLInputElement;
  rememberLabel: HTMLLabelElement;
  remember: HTMLInputElement;
  rememberText: Text;
  secretNotice: HTMLParagraphElement;
  saveSecret: HTMLButtonElement;
  actions: HTMLDivElement;
  connection: HTMLButtonElement;
  duplicate: HTMLButtonElement;
  remove: HTMLButtonElement;
  save: HTMLButtonElement;
  connected: HTMLParagraphElement;
}

/**
 * Sezione dei profili nelle impostazioni (era AiProfilesSection.tsx): elenco con «+ Crea» e dettaglio della
 * bozza con provider, indirizzo, modello (`hmd-ai-model-select`), parametri (`hmd-ai-parameters`), contesto,
 * effort, chiave e azioni. La chiave scritta resta nel campo password e va al controller solo con «Salva
 * chiave»: l'unica eccezione alla regola «gli elementi non toccano le chiavi» (architecture.test.ts).
 * Verso fuori manda solo `hmd-settings-dirty`; i dialog aperti da qui si chiudono al distacco.
 */
export class HmdSettingsProfiles extends HmdElement {
  #controller: ProfilesController | null = null;
  #i18n: I18nStore | null = null;

  #list: HTMLDivElement | null = null;
  #detail: Detail | null = null;
  #draft: DraftState<ModelProfile> = emptyDraft();
  #connected = false;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#list && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#list!, this.#controller!, this.#i18n!),
  });

  get controller(): ProfilesController | null { return this.#controller; }
  set controller(value: ProfilesController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  /** La bozza aperta ha modifiche non salvate. */
  get dirty(): boolean { return isDirty(this.#draft); }

  protected connect(signal: AbortSignal): void {
    if (!this.#list) {
      this.#list = el('div', { class: 'list' });
      this.append(el('div', { class: 'split' }, this.#list));
    }
    this.#dialogs ??= new AbortController();
    this.addEventListener('focusout', () => queueMicrotask(() => this.#loop.update()), { signal });
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  #setDraft(next: DraftState<ModelProfile>): void {
    const was = isDirty(this.#draft);
    this.#draft = next;
    this.#loop.update();
    if (isDirty(next) !== was) emit(this, 'hmd-settings-dirty', { dirty: isDirty(next) });
  }

  #edit(patch: Partial<ModelProfile>): void {
    const draft = this.#draft.draft;
    if (draft) this.#setDraft(editDraft(this.#draft, { ...draft, ...patch }));
  }

  #run(job: Promise<unknown>): void {
    void job.catch((error) => this.#controller?.report(error));
  }

  /** Apre un profilo (o un profilo nuovo): la chiave scritta e «Connesso» si dimenticano subito. */
  #pick(profile: ModelProfile | null): void {
    const t = this.#i18n?.t;
    const dirty = isDirty(this.#draft);
    this.#forgetKey();
    this.#connected = false;
    this.#setDraft(selectDraft(this.#draft, profile && { ...profile, params: { ...profile.params } }));
    const signal = this.#dialogs?.signal;
    if (!dirty || !t || !signal) return;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      if (!signal.aborted) this.#setDraft(discard ? confirmSwitch(this.#draft) : cancelSwitch(this.#draft));
    });
  }

  #forgetKey(): void {
    if (this.#detail) this.#detail.secret.value = '';
  }

  #remove(profile: ModelProfile): void {
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (!t || !signal) return;
    void showConfirmDialog({ title: t('ai.deleteTitle', { name: profile.name }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal }).then((ok) => {
      if (ok && this.#controller) this.#run(this.#controller.deleteProfile(profile.id).then(() => this.#setDraft(openDraft(this.#draft, null))));
    });
  }

  #testConnection(profile: ModelProfile): void {
    const controller = this.#controller;
    if (!controller) return;
    this.#connected = false;
    this.#loop.update();
    this.#run(
      controller.provider(profile).then(async (p) => {
        const signal = new AbortController().signal;
        if (p.testConnection) await p.testConnection(signal);
        else if ((await p.listModels(signal)) === null) throw { code: 'unreachable' };
        this.#connected = true;
        this.#loop.update();
      }),
    );
  }

  #storeKey(): void {
    const draft = this.#draft.draft;
    const controller = this.#controller;
    const detail = this.#detail;
    if (!draft || !controller || !detail) return;
    this.#run(
      controller.setSecret(validateProfile(draft), detail.secret.value, detail.remember.checked).then(() => {
        this.#forgetKey();
        this.#setDraft(openDraft(this.#draft, controller.getState().profiles.find((p) => p.id === draft.id) ?? draft));
      }),
    );
  }

  #save(): void {
    const draft = this.#draft.draft;
    if (!draft || !this.#controller) return;
    const valid = validateProfile(draft);
    this.#run(this.#controller.saveProfile(valid).then(() => this.#setDraft(openDraft(this.#draft, valid))));
  }

  #createDetail(): Detail {
    const caption = () => el('span');
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const draft = () => this.#draft.draft!;
    const captions = { name: caption(), provider: caption(), url: caption(), contextTokens: caption(), secret: caption() };
    const effortText = document.createTextNode('');
    const rememberText = document.createTextNode('');
    const contextTokens = el('input', { type: 'number', min: '1', on: { input: (e) => this.#edit({ contextTokens: value(e) ? Number(value(e)) : null }) } });
    const effort = el('input', {
      type: 'checkbox',
      on: { change: (e) => this.#edit({ params: { ...draft().params, effort: (e.currentTarget as HTMLInputElement).checked ? 'medium' : undefined } }) },
    });
    const secret = el('input', { type: 'password', autocomplete: 'off', on: { input: () => this.#loop.update() } });
    const remember = el('input', { type: 'checkbox' });
    const d: Detail = {
      root: el('div', { class: 'detail' }),
      captions,
      fixed: [],
      name: el('input', { on: { input: (e) => this.#edit({ name: value(e) }) } }),
      provider: el(
        'select',
        {
          on: {
            change: (e) => {
              const kind = value(e) as ProviderKind;
              this.#forgetKey();
              this.#setDraft(editDraft(this.#draft, { ...changeProvider(draft(), kind), baseUrl: DEFAULT_URLS[kind] }));
            },
          },
        },
        PROVIDER_KINDS.map((k) => el('option', null, k)),
      ),
      url: el('input', { type: 'url', on: { input: (e) => this.#edit({ baseUrl: value(e) }) } }),
      help: el('p', { class: 'help' }),
      model: el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (e) => this.#edit({ ...e.detail.selection }) } }),
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (e) => this.#edit({ params: e.detail.params }) } }),
      contextTokensLabel: field(captions.contextTokens, contextTokens),
      contextTokens,
      effortLabel: checkbox(effort, effortText),
      effort,
      effortText,
      secretLabel: field(captions.secret, secret),
      secret,
      rememberLabel: checkbox(remember, rememberText),
      remember,
      rememberText,
      secretNotice: el('p', { class: 'help' }),
      saveSecret: el('button', { type: 'button', on: { click: () => this.#storeKey() } }),
      actions: el('div', { class: 'actions' }),
      connection: el('button', { type: 'button', on: { click: () => this.#testConnection(draft()) } }),
      duplicate: el('button', { type: 'button', on: { click: () => this.#edit({ id: crypto.randomUUID(), secretId: null }) } }),
      remove: el('button', { type: 'button', on: { click: () => this.#remove(draft()) } }),
      save: el('button', { type: 'button', on: { click: () => this.#save() } }),
      connected: el('p', { role: 'status' }),
    };
    d.fixed = [field(captions.name, d.name), field(captions.provider, d.provider), field(captions.url, d.url)];
    d.actions.append(d.connection, d.duplicate, d.remove, d.save);
    return d;
  }

  #render(list: HTMLDivElement, controller: ProfilesController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const draft = this.#draft.draft;
    renderItemList(list, state.profiles, {
      selectedId: draft?.id ?? null,
      label: (p) => p.name,
      createLabel: t('ai.create'),
      onSelect: (p) => this.#pick(p),
      onCreate: () => this.#pick(defaultProfile('ollama', crypto.randomUUID())),
    });
    const split = list.parentElement!;
    if (!draft) {
      this.#detail?.root.remove();
      return;
    }
    const d = (this.#detail ??= this.#createDetail());
    setText(d.captions.name, t('ai.name'));
    setText(d.captions.provider, t('ai.provider'));
    setText(d.captions.url, t('ai.url'));
    setText(d.help, t(`ai.help.${draft.kind}` as MessageKey));
    setText(d.captions.contextTokens, t('ai.contextTokens'));
    setText(d.effortText, t('ai.enableEffort'));
    setText(d.captions.secret, t('ai.secret'));
    setText(d.rememberText, t('ai.remember'));
    setText(d.secretNotice, t('ai.secretNotice'));
    setText(d.saveSecret, t('ai.saveSecret'));
    setText(d.connection, t('ai.connection'));
    setText(d.duplicate, t('ai.duplicate'));
    setText(d.remove, t('ai.delete'));
    setText(d.save, t('ai.save'));
    setText(d.connected, t('ai.connected'));
    syncValue(d.name, draft.name);
    syncValue(d.provider, draft.kind);
    syncValue(d.url, draft.baseUrl);
    // Campi e pulsanti spenti come oggi: la regola «mai disabled» sulle impostazioni è della fase 8.
    d.url.disabled = draft.kind === 'anthropic';
    syncValue(d.contextTokens, draft.contextTokens === null ? '' : String(draft.contextTokens));
    syncChecked(d.effort, !!draft.params.effort);
    d.saveSecret.disabled = !d.secret.value;
    // Proprietà dei figli hmd-* prima dell'inserimento, e solo se cambiano.
    if (d.model.controller !== controller) d.model.controller = controller;
    if (d.model.i18n !== i18n) d.model.i18n = i18n;
    if (d.model.profile !== draft) d.model.profile = draft;
    if (d.params.i18n !== i18n) d.params.i18n = i18n;
    if (d.params.profile !== draft) d.params.profile = draft;
    if (d.params.value !== draft.params) d.params.value = draft.params;
    showChildren(
      d.root,
      [
        ...d.fixed,
        d.help,
        d.model,
        d.params,
        d.contextTokensLabel,
        ...(EFFORT_KINDS.includes(draft.kind) ? [d.effortLabel] : []),
        ...(SECRET_KINDS.includes(draft.kind) ? [d.secretLabel, d.rememberLabel, d.secretNotice, d.saveSecret] : []),
        d.actions,
        ...(this.#connected ? [d.connected] : []),
      ],
      [d.effortLabel, d.secretLabel, d.rememberLabel, d.secretNotice, d.saveSecret, d.connected],
    );
    if (d.root.parentNode !== split) split.append(d.root);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-profiles': HmdSettingsProfiles;
  }
}
```

In `src/architecture.test.ts` il test «elements reach the AI providers only through the controller and never touch the keys» diventa:

```ts
/**
 * La sola eccezione: il campo della chiave nella sezione dei profili la passa al controller con
 * `controller.setSecret(…)` (scritta, mai letta, mai in attributi o `dataset`). Tutto il resto vale anche lì.
 */
const SECRET_WRITE_ALLOWED = new Set(['elements/settings/profiles.element.ts']);
const withoutAllowedSecretWrite = (list: SourceFile[]) =>
  list.map((file) => (SECRET_WRITE_ALLOWED.has(file.path) ? { ...file, source: file.source.replace(/\bcontroller\.setSecret\s*\(/g, '') } : file));

test('elements reach the AI providers only through the controller and never touch the keys', () => {
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite(sources)), []);
});
```

e nel test «offending files are reported by path…», dopo l'ultima `assert.deepEqual`:

```ts
  // L'eccezione della chiave vale solo per setSecret nella sezione dei profili.
  const secrets: SourceFile[] = [
    { path: 'elements/settings/profiles.element.ts', source: 'controller.setSecret(validateProfile(draft), key, remember)' },
    { path: 'elements/settings/presets.element.ts', source: 'controller.setSecret(draft, key, remember)' },
    { path: 'elements/settings/sync.element.ts', source: 'await controller.secret(profile)' },
  ];
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite(secrets)), ['elements/settings/presets.element.ts', 'elements/settings/sync.element.ts']);
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, withoutAllowedSecretWrite([{ path: 'elements/settings/profiles.element.ts', source: 'controller.secret(p); controller.setSecret(p, k, r)' }])), ['elements/settings/profiles.element.ts']);
```

- [ ] **Step 6: Evento, registrazione, tipi JSX**

`src/elements/events.ts`, subito sopra il JSDoc di `hmd-start-pick` (e gli import dei tipi in testa: qui nessuno nuovo):

```ts
  /** Sezione di profili o preset: la bozza aperta è diventata (o non è più) da salvare. */
  'hmd-settings-dirty': CustomEvent<{ dirty: boolean }>;
```

`src/elements/define.ts`: gli import `HmdSettingsPresets` e `HmdSettingsProfiles` dopo quello di `HmdSearchPanel`, e le voci `['hmd-settings-presets', HmdSettingsPresets]`, `['hmd-settings-profiles', HmdSettingsProfiles]` dopo `hmd-search-panel`.

`src/elements/jsx.d.ts`: gli import `import type { PresetsController } from './settings/presets.element';` e `import type { ProfilesController } from './settings/profiles.element';` dopo quello della ricerca, e prima di `'hmd-start-screen'`:

```ts
      'hmd-settings-presets': HmdProps<{ controller: PresetsController; i18n: I18nStore }, 'hmd-settings-dirty'>;
      'hmd-settings-profiles': HmdProps<{ controller: ProfilesController; i18n: I18nStore }, 'hmd-settings-dirty'>;
```

- [ ] **Step 7: `SettingsView.tsx` monta le due sezioni**

Via gli import di `AiPresetsSection` e `AiProfilesSection`; `const { t, locale, setLocale, store: i18nStore } = useI18n();`; nelle due sezioni:

```tsx
              <hmd-settings-profiles controller={ai} i18n={i18nStore} onhmd-settings-dirty={(event) => profilesDirty(event.detail.dirty)} />
```

```tsx
              <hmd-settings-presets controller={ai} i18n={i18nStore} onhmd-settings-dirty={(event) => presetsDirty(event.detail.dirty)} />
```

(`profilesDirty` e `presetsDirty` restano come sono: ricevono il booleano.) Poi:

```bash
git rm src/ui/ai/settings/AiProfilesSection.tsx src/ui/ai/settings/AiPresetsSection.tsx src/ui/ai/settings/ItemList.tsx
grep -rn "AiProfilesSection\|AiPresetsSection\|ItemList\|useDraft" src; echo "uscita $?"   # atteso: uscita 1
```

- [ ] **Step 8: Il test della chiave si rovescia (decisione 5)**

In `e2e/settings-sections.spec.ts` il test «the key typed in the password field: where it ends up in the DOM» diventa:

```ts
test('the key typed in the password field stays in the field, never in the serialized DOM', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
  await settings(app).getByRole('combobox', { name: app.t('ai.provider'), exact: true }).selectOption('anthropic');
  await settings(app).getByLabel(app.t('ai.secret')).fill('sk-test');
  await expect(settings(app).getByLabel(app.t('ai.secret'))).toHaveValue('sk-test');
  // Con React l'attributo `value` dei campi controllati seguiva la chiave (Task 1); l'elemento scrive solo la proprietà (spec R21).
  expect(await page.evaluate(() => document.body.outerHTML.includes('sk-test'))).toBe(false);
});
```

- [ ] **Step 9: Verifica**

```bash
npx tsc --noEmit && npm test            # 992 verdi
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/settings.spec.ts e2e/settings-sections.spec.ts e2e/ai-model.spec.ts e2e/ai-chips.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/settings.spec.ts e2e/settings-sections.spec.ts e2e/ai-model.spec.ts e2e/ai-chips.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "settings"
pgrep -af "vite|chrom|playwright"
```

Nel prototipo, sulla copia React con le tre sezioni: questi e2e verdi, audit `settings*` verde (il `:scope` delle regole `.detail` è necessario: senza, `settings-profile` cade).

- [ ] **Step 10: Commit**

Commit separati: `test:` (Step 1 e casi sintetici), `feat:` (Step 2–6), `refactor:` (Step 7), `test:` (Step 8). `git log --format=%B -n 4`: nessun `Co-authored-by`.

### Task 3: `SyncBinding` e `hmd-settings-sync` (Builder)

L'hook `useAiSync` diventa uno store puro, `SyncBinding` (`src/ai/syncBinding.ts`), con le dipendenze del browser iniettate e una fabbrica `browserSyncBinding(controller)`; la sezione della sync diventa `hmd-settings-sync`. `WorkspaceView.tsx` crea un `SyncBinding` per controller e ne legge `needsPermission` per la sidebar AI; `SettingsView.tsx` monta la sezione. Con `AiSyncSection.tsx` se ne vanno `Settings.module.css` e la cartella `src/ui/ai/settings/`.

**Files:**
- Create: `src/ai/syncBinding.ts`, `src/ai/syncBinding.test.ts`, `src/elements/settings/sync.element.ts`, `src/elements/settings/sync.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `src/ui/SettingsView.tsx`
- Delete: `src/ui/ai/settings/AiSyncSection.tsx`, `src/ui/ai/settings/Settings.module.css`

**Interfaces:**
- Consumes: `ai/aiSync.ts` (`AiSync`, `AiSyncState`), `fs/access.ts` (`hasAccess`, `requestAccess`, `pickFolder`), `fs/fsaOps.ts`, `sections.css` del Task 2, `showChildren`.
- Produces: `SyncBinding` (`getState(): { sync, handle, permission }`, `subscribe`, `needsPermission`, `choose()`, `reactivate()`, `disable()`, `dispose()`), `SyncService`, `SyncHost`, `SyncBindingDeps`, `browserSyncBinding(controller)`; `HmdSettingsSync` (`controller: SyncController`, `binding: SyncBinding | null`, `i18n`), `SyncController = Pick<AiController, 'report' | 'reload'>`.

**Criteri di accettazione:** RED annotato; `npm test` 992 + 11 = **1003**; lint pulito; `ai-composer.spec.ts` (riattivazione della sync), `settings-sections.spec.ts` («a sync folder…»), `settings.spec.ts` verdi in build e in sviluppo; audit `settings-sync-folder`, `ai-sync-reactivate`, `settings` verdi; `grep -rn "useAiSync\|AiSyncSection\|Settings.module" src` → uscita 1; `src/ui/ai/settings/` non esiste più.

- [ ] **Step 1: I test, prima del codice**

`src/ai/syncBinding.test.ts` (servizio e controller finti; nessun browser):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { AiSyncState } from './aiSync';
import { SyncBinding, type SyncBindingDeps, type SyncHost, type SyncService } from './syncBinding';

const handle = (name: string) => ({ name }) as FileSystemDirectoryHandle;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeService() {
  let state: AiSyncState = { status: 'idle', error: null, lastSync: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const log: string[] = [];
  const service: SyncService & { set(patch: Partial<AiSyncState>): void; log: string[]; listeners: () => number } = {
    getState: () => state,
    subscribe: (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    start: () => void log.push('start'),
    localChanged: () => void log.push('localChanged'),
    dispose: () => void log.push('dispose'),
    set(patch) {
      state = { ...state, ...patch };
      for (const fn of [...listeners]) fn();
    },
    log,
    listeners: () => listeners.size,
  };
  return service;
}

function setup(saved: FileSystemDirectoryHandle | null, access = true) {
  const meta = new Map<string, unknown>([['folderHandle', saved]]);
  const reports: unknown[] = [];
  let reloads = 0;
  const host: SyncHost = {
    store: {
      getMeta: async <T>(key: string) => (meta.get(key) ?? null) as T | null,
      setMeta: async (key: string, value: unknown) => void meta.set(key, value),
    } as SyncHost['store'],
    report: (error) => void reports.push(error),
    reload: async () => void reloads++,
  };
  const services: ReturnType<typeof fakeService>[] = [];
  const deps: SyncBindingDeps & { picked: FileSystemDirectoryHandle | null; granted: boolean } = {
    picked: null,
    granted: true,
    hasAccess: async () => access,
    requestAccess: async () => deps.granted,
    pickFolder: async () => deps.picked,
    createSync: () => {
      const service = fakeService();
      services.push(service);
      return service;
    },
  };
  const binding = new SyncBinding(host, deps);
  let notified = 0;
  binding.subscribe(() => notified++);
  return { binding, host, deps, meta, services, reports, reloads: () => reloads, notified: () => notified };
}

test('a saved folder with permission starts one sync service, linked to the settings changes', async () => {
  const { binding, host, services } = setup(handle('sync'));
  await flush();
  assert.equal(binding.getState().handle?.name, 'sync');
  assert.equal(binding.getState().permission, true);
  assert.equal(services.length, 1);
  assert.equal(binding.getState().sync, services[0]);
  assert.deepEqual(services[0].log, ['start']);
  host.onSettingsChanged?.();
  assert.deepEqual(services[0].log, ['start', 'localChanged']);
  assert.equal(binding.needsPermission, false);
});

test('a saved folder without permission: no service, the sidebar must offer to reactivate', async () => {
  const { binding, services, deps } = setup(handle('sync'), false);
  await flush();
  assert.equal(binding.getState().sync, null);
  assert.equal(services.length, 0);
  assert.equal(binding.needsPermission, true);
  deps.granted = true;
  await binding.reactivate();
  assert.equal(binding.needsPermission, false);
  assert.equal(services.length, 1);
});

test('no saved folder: nothing; choosing one saves it and starts the service; disabling stops it', async () => {
  const { binding, deps, meta, services, host, notified } = setup(null);
  await flush();
  assert.equal(binding.getState().handle, null);
  assert.equal(notified(), 0);
  deps.picked = null;
  await binding.choose();
  assert.equal(services.length, 0);
  deps.picked = handle('new');
  await binding.choose();
  assert.equal((meta.get('folderHandle') as FileSystemDirectoryHandle).name, 'new');
  assert.equal(services.length, 1);
  await binding.disable();
  assert.equal(meta.get('folderHandle'), null);
  assert.equal(binding.getState().sync, null);
  assert.deepEqual(services[0].log, ['start', 'dispose']);
  assert.equal(services[0].listeners(), 0);
  assert.equal(host.onSettingsChanged, undefined);
});

test('a syncPermission error drops the permission and the service; every finished sync reloads the controller', async () => {
  const { binding, services, reloads } = setup(handle('sync'));
  await flush();
  const service = services[0];
  service.set({ status: 'syncing' });
  assert.equal(reloads(), 0);
  service.set({ status: 'written' });
  assert.equal(reloads(), 1);
  service.set({ status: 'error', error: 'syncPermission' });
  assert.equal(binding.getState().permission, false);
  assert.equal(binding.getState().sync, null);
  assert.ok(service.log.includes('dispose'));
  assert.equal(binding.needsPermission, true);
});

test('state is saved before the listeners hear about it', async () => {
  const { binding, deps } = setup(null);
  await flush();
  const seen: (string | null)[] = [];
  binding.subscribe(() => seen.push(binding.getState().handle?.name ?? null));
  deps.picked = handle('x');
  await binding.choose();
  assert.deepEqual(seen, ['x']);
});

test('disposed: the service stops, late answers change nothing, listeners are dropped', async () => {
  const { binding, services, deps } = setup(handle('sync'));
  await flush();
  binding.dispose();
  assert.ok(services[0].log.includes('dispose'));
  deps.picked = handle('late');
  await binding.choose();
  assert.equal(binding.getState().handle?.name, 'sync');
  assert.equal(services.length, 1);
});

test('a failed read of the saved folder is reported to the controller', async () => {
  const reports: unknown[] = [];
  const host: SyncHost = {
    store: { getMeta: async () => Promise.reject({ code: 'server' }), setMeta: async () => {} } as unknown as SyncHost['store'],
    report: (error) => void reports.push(error),
    reload: async () => {},
  };
  new SyncBinding(host, { hasAccess: async () => true, requestAccess: async () => true, pickFolder: async () => null, createSync: () => fakeService() });
  await flush();
  assert.deepEqual(reports, [{ code: 'server' }]);
});
```

`src/elements/settings/sync.dom.test.ts` (un `SyncBinding` vero con dipendenze finte; `listBackups` resta in attesa finché il test non risponde, così si prova la risposta superata):

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiSyncState } from '../../ai/aiSync';
import { SyncBinding, type SyncService } from '../../ai/syncBinding';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installDialogStub } from '../../testing/dialogStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
test.afterEach(() => document.body.replaceChildren());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function service(backups: string[][]) {
  let state: AiSyncState = { status: 'idle', error: null, lastSync: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const pending: ((paths: string[]) => void)[] = [];
  const calls: string[] = [];
  return {
    getState: () => state,
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    start: () => {},
    localChanged: () => {},
    dispose: () => {},
    syncNow: async () => void calls.push('syncNow'),
    /** Ogni richiesta resta in attesa finché il test non la risolve con `answer`. */
    listBackups: () => new Promise<string[]>((resolve) => pending.push(resolve)),
    answer: (i: number) => pending[i](backups[i]),
    backupCounts: async () => ({ profiles: 2, presets: 3 }),
    restore: async (path: string) => void calls.push(`restore ${path}`),
    set(patch: Partial<AiSyncState>) {
      state = { ...state, ...patch };
      for (const fn of [...listeners]) fn();
    },
    calls,
    requests: () => pending.length,
  };
}

async function mount(saved: FileSystemDirectoryHandle | null, access = true) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const meta = new Map<string, unknown>([['folderHandle', saved]]);
  const services: ReturnType<typeof service>[] = [];
  const reports: unknown[] = [];
  let reloads = 0;
  const controller = {
    store: { getMeta: async (key: string) => meta.get(key) ?? null, setMeta: async (key: string, value: unknown) => void meta.set(key, value) },
    report: (error: unknown) => void reports.push(error),
    reload: async () => void reloads++,
  };
  const binding = new SyncBinding(controller as never, {
    hasAccess: async () => access,
    requestAccess: async () => true,
    pickFolder: async () => ({ name: 'picked' }) as FileSystemDirectoryHandle,
    createSync: () => {
      const s = service([['a.json', 'b.json'], ['c.json']]);
      services.push(s);
      return s as unknown as SyncService;
    },
  });
  await flush();
  const el = document.createElement('hmd-settings-sync');
  el.controller = controller as never;
  el.binding = binding;
  el.i18n = i18n;
  document.body.append(el);
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label);
  return { el, binding, services, reports, reloads: () => reloads, button };
}

test('no folder: the notice and Choose only', async () => {
  const { el } = await mount(null);
  const detail = el.firstElementChild!;
  assert.equal(detail.className, 'detail');
  assert.deepEqual([...detail.children].map((c) => c.localName), ['p', 'div']);
  assert.deepEqual([...detail.querySelectorAll('.actions > *')].map((c) => c.textContent), [EN_MESSAGES['ai.syncChoose']]);
});

test('a folder without permission: its name, Disable and Reactivate; reactivated, the details appear', async () => {
  const { el, button } = await mount({ name: 'sync' } as FileSystemDirectoryHandle, false);
  assert.deepEqual([...el.querySelectorAll('.actions > *')].map((c) => c.textContent), [EN_MESSAGES['ai.syncChoose'], 'sync', EN_MESSAGES['ai.syncDisable'], EN_MESSAGES['ai.syncReactivate']]);
  button(EN_MESSAGES['ai.syncReactivate'])!.click();
  await waitFor(() => el.querySelector('details') !== null);
  assert.equal(button(EN_MESSAGES['ai.syncReactivate']), undefined);
});

test('with the service: status, Sync now off while syncing, and the backups asked again after every sync; a stale list is dropped', async () => {
  const { el, services, button } = await mount({ name: 'sync' } as FileSystemDirectoryHandle);
  const s = services[0];
  assert.deepEqual([...el.firstElementChild!.children].map((c) => c.localName), ['p', 'div', 'p', 'div', 'details']);
  s.set({ status: 'syncing' });
  assert.equal(button(EN_MESSAGES['ai.syncNow'])!.disabled, true);
  s.set({ status: 'written', lastSync: 1000 });
  assert.equal(button(EN_MESSAGES['ai.syncNow'])!.disabled, false);
  assert.equal(s.requests(), 2);
  // La risposta più nuova arriva prima: quella vecchia, arrivata dopo, non la sostituisce.
  s.answer(1);
  await waitFor(() => el.querySelectorAll('details > p').length === 1);
  s.answer(0);
  await flush();
  assert.deepEqual([...el.querySelectorAll('details > p')].map((p) => p.firstChild!.textContent), ['c.json']);
});

test('restoring a backup: the confirmation says how many profiles and presets; confirmed, it restores and reloads', async () => {
  const { el, services, reloads } = await mount({ name: 'sync' } as FileSystemDirectoryHandle);
  services[0].answer(0);
  await waitFor(() => el.querySelectorAll('details > p').length === 2);
  el.querySelector<HTMLButtonElement>('details > p button')!.click();
  await waitFor(() => document.querySelector('dialog') !== null);
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.textContent!.includes(EN_MESSAGES['ai.syncCounts'].replace('{profiles}', '2').replace('{presets}', '3')));
  // Un secondo clic con la conferma aperta non ne apre un'altra.
  el.querySelector<HTMLButtonElement>('details > p button')!.click();
  await flush();
  assert.equal(document.querySelectorAll('dialog').length, 1);
  [...dialog.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.restoreBackup'])!.click();
  await waitFor(() => reloads() === 1);
  assert.deepEqual(services[0].calls, ['restore a.json']);
});
```

RED atteso: `Cannot find module './syncBinding'` per il primo; per il secondo lo stesso import, poi i test cadono finché il tag non è definito.

- [ ] **Step 2: `SyncBinding`**

`src/ai/syncBinding.ts` (lo stato si salva prima di notificare; il servizio si ricrea quando cambiano cartella o permesso; letture tardive dopo `dispose` o superate da una scelta più nuova si scartano):

```ts
import { hasAccess, pickFolder, requestAccess } from '../fs/access';
import { fsaOps } from '../fs/fsaOps';
import type { AiController } from './aiController';
import { AiSync, type AiSyncState } from './aiSync';
import type { AiStores } from './stores';

/** Il servizio di sync di una cartella (AiSync), visto da chi lo collega al controller. */
export interface SyncService {
  getState(): AiSyncState;
  subscribe(listener: () => void): () => void;
  start(): void;
  localChanged(): void;
  dispose(): void;
}

/** Quello che la sync usa del controller AI. */
export interface SyncHost {
  readonly store: Pick<AiStores, 'getMeta' | 'setMeta'>;
  onSettingsChanged?: () => void;
  report(error: unknown): void;
  reload(): Promise<void>;
}

/** Permessi e servizio: iniettati, così lo store si prova senza File System Access API. */
export interface SyncBindingDeps {
  hasAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  requestAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  pickFolder(): Promise<FileSystemDirectoryHandle | null>;
  createSync(handle: FileSystemDirectoryHandle): SyncService;
}

export interface SyncBindingState {
  /** Il servizio attivo: solo con una cartella e il permesso. */
  sync: SyncService | null;
  handle: FileSystemDirectoryHandle | null;
  permission: boolean;
}

/**
 * Cartella di sync della configurazione AI (era `useAiSync` di AiSyncSection.tsx): la cartella salvata nei
 * meta del controller, il permesso, e il servizio di sync che esiste solo con entrambi. Il servizio si
 * ricrea quando cambiano cartella o permesso; un errore `syncPermission` toglie il permesso; a ogni fine
 * di sincronizzazione il controller ricarica profili e preset. Una sola istanza per controller, creata
 * da `hmd-workspace` e passata alla sidebar AI (riattivazione) e alle impostazioni.
 */
export class SyncBinding {
  #host: SyncHost;
  #deps: SyncBindingDeps;
  #state: SyncBindingState = { sync: null, handle: null, permission: false };
  #listeners = new Set<() => void>();
  #unsubscribe: (() => void) | null = null;
  #disposed = false;

  constructor(host: SyncHost, deps: SyncBindingDeps) {
    this.#host = host;
    this.#deps = deps;
    void host.store
      .getMeta<FileSystemDirectoryHandle>('folderHandle')
      .then(async (handle) => {
        if (this.#disposed || !handle) return;
        this.#set({ handle });
        const permission = await deps.hasAccess(handle);
        // Una cartella scelta o tolta nel frattempo vince sulla lettura dell'avvio.
        if (!this.#disposed && this.#state.handle === handle) this.#set({ permission });
      })
      .catch((error) => host.report(error));
  }

  getState = (): SyncBindingState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => void this.#listeners.delete(listener);
  };

  /** La cartella non ha più il permesso: la sidebar AI offre di riattivarlo. */
  get needsPermission(): boolean {
    return !!this.#state.handle && !this.#state.permission;
  }

  async choose(): Promise<void> {
    const handle = await this.#deps.pickFolder();
    if (!handle || this.#disposed) return;
    await this.#host.store.setMeta('folderHandle', handle);
    this.#set({ handle, permission: true });
  }

  async reactivate(): Promise<void> {
    const handle = this.#state.handle;
    if (!handle) return;
    const permission = await this.#deps.requestAccess(handle);
    if (!this.#disposed && this.#state.handle === handle) this.#set({ permission });
  }

  async disable(): Promise<void> {
    await this.#host.store.setMeta('folderHandle', null);
    if (!this.#disposed) this.#set({ handle: null });
  }

  dispose(): void {
    this.#disposed = true;
    this.#stop();
    this.#listeners.clear();
  }

  /** Lo stato si salva prima di notificare; il servizio segue cartella e permesso. */
  #set(patch: Partial<Omit<SyncBindingState, 'sync'>>): void {
    const before = this.#state;
    const next = { ...before, ...patch };
    if (next.handle === before.handle && next.permission === before.permission) return;
    this.#stop();
    this.#state = { ...next, sync: null };
    if (next.handle && next.permission) this.#start(next.handle);
    for (const listener of [...this.#listeners]) listener();
  }

  #start(handle: FileSystemDirectoryHandle): void {
    const host = this.#host;
    const service = this.#deps.createSync(handle);
    this.#state = { ...this.#state, sync: service };
    host.onSettingsChanged = () => service.localChanged();
    const off = service.subscribe(() => {
      if (service.getState().error === 'syncPermission') this.#set({ permission: false });
      if (service.getState().status !== 'syncing') void host.reload().catch((error) => host.report(error));
    });
    this.#unsubscribe = () => {
      host.onSettingsChanged = undefined;
      off();
      service.dispose();
    };
    service.start();
  }

  #stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }
}

/** La sync di un controller vero: permessi e cartella dalla File System Access API, servizio AiSync. */
export function browserSyncBinding(controller: AiController): SyncBinding {
  return new SyncBinding(controller, {
    hasAccess,
    requestAccess,
    pickFolder,
    createSync: (handle) => new AiSync({ store: controller.store, fs: fsaOps(handle) }),
  });
}
```

- [ ] **Step 3: `hmd-settings-sync`**

`src/elements/settings/sync.element.ts` (i `p` dei backup sono figli diretti di `details`, dopo il `summary`, come in React: niente contenitore in più, l'audit confronta i percorsi):

```ts
import type { AiController } from '../../ai/aiController';
import type { SyncBinding, SyncService } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { MessageKey } from '../../i18n/messages';
import type { I18nStore } from '../../state/i18nStore';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import { showChildren } from './fields';
import './sections.css';

/** Quello che la sezione della sync usa del controller. */
export type SyncController = Pick<AiController, 'report' | 'reload'>;
/** Il servizio di sync visto dalla sezione: stato, sincronizzazione e backup. */
export type SyncDetailsService = SyncService & Pick<import('../../ai/aiSync').AiSync, 'syncNow' | 'listBackups' | 'backupCounts' | 'restore'>;

interface Parts {
  root: HTMLDivElement;
  notice: HTMLParagraphElement;
  actions: HTMLDivElement;
  choose: HTMLButtonElement;
  folder: HTMLSpanElement;
  disable: HTMLButtonElement;
  reactivate: HTMLButtonElement;
  status: HTMLParagraphElement;
  error: HTMLParagraphElement;
  conflicts: HTMLParagraphElement;
  syncActions: HTMLDivElement;
  syncNow: HTMLButtonElement;
  backups: HTMLDetailsElement;
  backupsSummary: HTMLElement;
}

/**
 * Sezione della sync nelle impostazioni (era AiSyncSection.tsx): scegliere, disattivare o riattivare la
 * cartella di sync (`SyncBinding`), e con il servizio attivo il suo stato, «Sincronizza ora» e i backup.
 * L'elenco dei backup si chiede a ogni sincronizzazione finita; una risposta superata si scarta. Un
 * ripristino alla volta, con la conferma che dice quanti profili e preset contiene.
 */
export class HmdSettingsSync extends HmdElement {
  #controller: SyncController | null = null;
  #binding: SyncBinding | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Il servizio a cui si è iscritti e la sua iscrizione. */
  #sync: { service: SyncService; off: () => void } | null = null;
  #backups: string[] = [];
  #backupNodes = new Map<string, HTMLParagraphElement>();
  /** Chiave (servizio + ultima sync) dell'ultimo elenco chiesto, e contatore delle richieste. */
  #backupsKey: unknown = null;
  #request = 0;
  #restoring = false;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#binding && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#binding!, this.#i18n!),
  });

  get controller(): SyncController | null { return this.#controller; }
  set controller(value: SyncController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#loop.update();
  }
  get binding(): SyncBinding | null { return this.#binding; }
  set binding(value: SyncBinding | null) {
    value ??= null;
    if (value === this.#binding) return;
    this.#binding = value;
    this.reconnect();
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
      const report = (error: unknown) => this.#controller?.report(error);
      const parts: Parts = {
        root: el('div', { class: 'detail' }),
        notice: el('p', { class: 'help' }),
        actions: el('div', { class: 'actions' }),
        choose: el('button', { type: 'button', on: { click: () => void this.#binding?.choose().catch(report) } }),
        folder: el('span'),
        disable: el('button', { type: 'button', on: { click: () => void this.#binding?.disable().catch(report) } }),
        reactivate: el('button', { type: 'button', on: { click: () => void this.#binding?.reactivate().catch(report) } }),
        status: el('p', { class: 'help' }),
        error: el('p', { class: 'help' }),
        conflicts: el('p', { class: 'help' }),
        syncActions: el('div', { class: 'actions' }),
        syncNow: el('button', { type: 'button', on: { click: () => void (this.#sync?.service as SyncDetailsService | undefined)?.syncNow() } }),
        backups: el('details'),
        backupsSummary: el('summary'),
      };
      parts.syncActions.append(parts.syncNow);
      parts.backups.append(parts.backupsSummary);
      this.#parts = parts;
      this.append(parts.root);
    }
    this.#dialogs ??= new AbortController();
    const { binding, i18n } = { binding: this.#binding, i18n: this.#i18n };
    if (!binding || !i18n) return;
    this.watch(binding, () => this.#follow(binding.getState().sync), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#follow(null);
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  /** Iscrizione al servizio attivo (cambia con cartella e permesso): i dettagli seguono il suo stato. */
  #follow(service: SyncService | null): void {
    if (service !== (this.#sync?.service ?? null)) {
      this.#sync?.off();
      this.#sync = service ? { service, off: service.subscribe(() => this.#onSyncState()) } : null;
      this.#backups = [];
      this.#backupsKey = null;
    }
    this.#onSyncState();
  }

  /** A ogni sincronizzazione finita (e con un servizio nuovo) si richiede l'elenco dei backup. */
  #onSyncState(): void {
    const sync = this.#sync?.service as SyncDetailsService | undefined;
    if (sync && this.isConnected) {
      const key = `${sync.getState().lastSync}`;
      if (this.#backupsKey !== key) {
        this.#backupsKey = key;
        const request = ++this.#request;
        void sync
          .listBackups()
          .then((paths) => {
            if (request !== this.#request || this.#sync?.service !== sync) return;
            this.#backups = paths;
            this.#loop.update();
          })
          .catch((error) => this.#controller?.report(error));
      }
    }
    this.#loop.update();
  }

  #restore(path: string): void {
    const sync = this.#sync?.service as SyncDetailsService | undefined;
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    const controller = this.#controller;
    // Una sola conferma di ripristino alla volta, anche durante backupCounts.
    if (!sync || !t || !signal || !controller || this.#restoring) return;
    this.#restoring = true;
    void sync
      .backupCounts(path)
      .then((counts) =>
        showConfirmDialog({
          title: t('ai.restoreTitle'),
          message: t('ai.syncCounts', { profiles: counts.profiles, presets: counts.presets }) + '\n' + t('ai.syncRestoreWarning'),
          confirmLabel: t('ai.restoreBackup'),
          t,
          signal,
        }),
      )
      .then((ok) => (ok ? sync.restore(path).then(() => controller.reload()) : undefined))
      .catch((error) => controller.report(error))
      .finally(() => {
        this.#restoring = false;
      });
  }

  #render(parts: Parts, binding: SyncBinding, i18n: I18nStore): void {
    const t = i18n.t;
    const { handle, permission } = binding.getState();
    setText(parts.notice, t('ai.syncNotice'));
    setText(parts.choose, t('ai.syncChoose'));
    setText(parts.folder, handle?.name ?? '');
    setText(parts.disable, t('ai.syncDisable'));
    setText(parts.reactivate, t('ai.syncReactivate'));
    showChildren(parts.actions, [parts.choose, ...(handle ? [parts.folder, parts.disable, ...(permission ? [] : [parts.reactivate])] : [])], [parts.folder, parts.disable, parts.reactivate]);
    const sync = this.#sync?.service;
    const wanted: Element[] = [parts.notice, parts.actions];
    if (sync) {
      const state = sync.getState();
      setText(parts.status, `${t(`ai.syncStatus.${state.status}` as MessageKey)} ${state.lastSync ? new Date(state.lastSync).toLocaleString() : ''}`);
      setText(parts.error, state.error ? t(`ai.error.${state.error}` as MessageKey) : '');
      setText(parts.conflicts, `${t('ai.syncConflict')}: ${state.conflicts.join(', ')}`);
      setText(parts.syncNow, t('ai.syncNow'));
      parts.syncNow.disabled = state.status === 'syncing';
      setText(parts.backupsSummary, t('ai.backups'));
      this.#renderBackups(parts, t);
      wanted.push(parts.status, ...(state.error ? [parts.error] : []), ...(state.conflicts.length > 0 ? [parts.conflicts] : []), parts.syncActions, parts.backups);
    }
    showChildren(parts.root, wanted, [parts.status, parts.error, parts.conflicts, parts.syncActions, parts.backups]);
  }

  /** Un `p` per backup, figli diretti di `details` dopo il `summary` (come in AiSyncSection.tsx), riusati per percorso. */
  #renderBackups(parts: Parts, t: I18nStore['t']): void {
    const nodes = new Map<string, HTMLParagraphElement>();
    for (const path of this.#backups) {
      const node = this.#backupNodes.get(path) ?? el('p', { class: 'help' }, path, el('button', { type: 'button', on: { click: () => this.#restore(path) } }));
      setText(node.lastElementChild!, t('ai.restoreBackup'));
      nodes.set(path, node);
    }
    showChildren(parts.backups, [parts.backupsSummary, ...nodes.values()], [...this.#backupNodes.values()]);
    this.#backupNodes = nodes;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings-sync': HmdSettingsSync;
  }
}
```

`src/elements/define.ts`: import `HmdSettingsSync` e voce `['hmd-settings-sync', HmdSettingsSync]` dopo `hmd-settings-profiles`. `src/elements/jsx.d.ts`: `import type { SyncBinding } from '../ai/syncBinding';` e `import type { SyncController } from './settings/sync.element';`, e dopo `'hmd-settings-profiles'`:

```ts
      'hmd-settings-sync': HmdProps<{ controller: SyncController; binding: SyncBinding | null; i18n: I18nStore }>;
```

- [ ] **Step 4: I chiamanti React**

`src/ui/WorkspaceView.tsx`: via `import { useAiSync } from './ai/settings/AiSyncSection';`, e:

```tsx
import { browserSyncBinding, type SyncBinding } from '../ai/syncBinding';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react';
```

```tsx
const NO_TERMS: string[] = [];
const noSubscribe = () => () => {};
```

al posto di `const syncBinding = useAiSync(ai);`:

```tsx
  // Una sync per controller: la sidebar AI ne legge il permesso, le impostazioni la gestiscono.
  const [syncBinding, setSyncBinding] = useState<SyncBinding | null>(null);
  useEffect(() => {
    if (!ai) return;
    const binding = browserSyncBinding(ai);
    setSyncBinding(binding);
    return () => {
      binding.dispose();
      setSyncBinding(null);
    };
  }, [ai]);
  const syncNeedsPermission = useSyncExternalStore(syncBinding?.subscribe ?? noSubscribe, () => !!syncBinding?.needsPermission);
```

e sulla sidebar AI `syncNeedsPermission={syncNeedsPermission}`.

`src/ui/SettingsView.tsx`: `import type { SyncBinding } from '../ai/syncBinding';` al posto dell'import di `AiSyncSection`; la prop diventa `syncBinding: SyncBinding | null;`; nella sezione della sync:

```tsx
              <hmd-settings-sync controller={ai} binding={syncBinding} i18n={i18nStore} />
```

```bash
git rm src/ui/ai/settings/AiSyncSection.tsx src/ui/ai/settings/Settings.module.css
grep -rn "useAiSync\|AiSyncSection\|Settings.module" src; echo "uscita $?"   # atteso: uscita 1
ls src/ui/ai/settings 2>&1                                                  # atteso: No such file or directory
```

- [ ] **Step 5: Verifica**

```bash
npx tsc --noEmit && npm test            # 1003 verdi
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/ai-composer.spec.ts e2e/settings-sections.spec.ts e2e/settings.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/ai-composer.spec.ts e2e/settings-sections.spec.ts e2e/settings.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "settings|ai-sync"
pgrep -af "vite|chrom|playwright"
```

Nel prototipo (copia React con le tre sezioni): 41 e2e verdi su questi file più `ai-model.spec.ts`, audit `settings*` e `ai-sync-reactivate` verde (al secondo giro: `start-resume` nel progetto `baseline` era caduto con «Target page… closed», la trappola nota).

- [ ] **Step 6: Commit**

`test:` (Step 1), `feat:` (Step 2–3), `refactor:` (Step 4). Nessun `Co-authored-by`.

### Task 4: `hmd-settings`, cornice e sezione generale (Builder)

`SettingsView.tsx` diventa `hmd-settings`: indice, sezione generale (lingua, tema, autosalvataggio con il ritardo, larghezze del testo, Salva tutto) e le tre sezioni AI create dall'elemento. La logica (sezioni, conferma dei campi numerici, voce dell'indice) va in `settingsView.ts`. `WorkspaceView.tsx` monta il tag e collega la rotta: la guardia legge `settings.dirty`, Indietro bloccato chiama `settings.requestClose()` (al posto del contatore `closeRequest` e di `onDirtyChange`). Lingua e tema vanno direttamente ai loro store; il resto esce come eventi. Fine della 7a (decisione 1).

**Files:**
- Create: `src/elements/settings/settingsView.ts`, `settingsView.test.ts`, `settings.element.ts`, `settings.css`, `settings.dom.test.ts`
- Modify: `src/elements/events.ts` (5 voci), `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/SettingsView.tsx`, `src/ui/SettingsView.module.css`, `src/ui/Dialog.module.css`

**Interfaces:**
- Consumes: le tre sezioni (Task 2–3), `SyncBinding`, `ThemeStore` (`getThemeStore()` finché c'è React), `I18nStore.setLocale`, `showDiscardChangesDialog`, `lib/route.ts` (`formatRoute`), `lib/textWidth.ts`, `workspace/autosave.ts`.
- Produces: `HmdSettings` — ingressi `section`, `ai: SettingsController | null`, `syncBinding`, `theme`, `autosave`, `textWidth`, `i18n`; getter `dirty`; metodo `requestClose()`; eventi `hmd-settings-section { section }`, `hmd-settings-close`, `hmd-settings-autosave { autosave }`, `hmd-settings-text-width { textWidth }`, `hmd-settings-save-all`. `SettingsController = ProfilesController & PresetsController & SyncController`. In `settingsView.ts`: `SECTION_LABELS`, `settingsSections`, `sectionId`, `sectionOf`, `topSection`, `widthText`, `commitWidths`, `commitDelay`.

**Criteri di accettazione:** RED annotato; `npm test` 1003 + 13 = **1016**; lint pulito; `settings.spec.ts`, `settings-sections.spec.ts`, `theme-i18n.spec.ts`, `ai-model.spec.ts`, `ai-composer.spec.ts`, `visual.spec.ts` («settings») verdi in build e in sviluppo; audit `settings*`, `unsaved-dialog`, `ai-sync-reactivate` verdi; `grep -rn "SettingsView\|Dialog.module\|closeRequest\|onDirtyChange" src` → solo i commenti di `elements/settings/*` che citano `SettingsView.tsx` (`grep -rn "SettingsView" src --include=*.tsx` → uscita 1).

- [ ] **Step 1: I test, prima del codice**

`src/elements/settings/settingsView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { commitDelay, commitWidths, sectionId, sectionOf, settingsSections, topSection, widthText } from './settingsView';

test('without the AI controller only the general section is shown, with it all four in order', () => {
  assert.deepEqual(settingsSections(false), ['general']);
  assert.deepEqual(settingsSections(true), ['general', 'ai-profiles', 'ai-presets', 'ai-sync']);
});

test('section ids go both ways; an unknown or hidden section is null', () => {
  assert.equal(sectionId('ai-sync'), 'settings-ai-sync');
  assert.equal(sectionOf('settings-ai-sync', settingsSections(true)), 'ai-sync');
  assert.equal(sectionOf('settings-ai-sync', settingsSections(false)), null);
  assert.equal(sectionOf('settings-nope', settingsSections(true)), null);
});

test('the index follows the topmost intersecting section; none intersecting leaves it alone', () => {
  const sections = settingsSections(true);
  const entries = [
    { id: 'settings-ai-presets', top: 300, intersecting: true },
    { id: 'settings-general', top: -900, intersecting: false },
    { id: 'settings-ai-profiles', top: 20, intersecting: true },
  ];
  assert.equal(topSection(entries, sections), 'ai-profiles');
  assert.equal(topSection([{ id: 'settings-general', top: 0, intersecting: false }], sections), null);
});

test('text widths: an empty field is no limit, values are clamped, unchanged widths give no update', () => {
  assert.equal(widthText({ editor: null, preview: 72 }, 'editor'), '');
  assert.equal(widthText({ editor: null, preview: 72 }, 'preview'), '72');
  assert.deepEqual(commitWidths({ editor: '10', preview: '' }, { editor: null, preview: 72 }), {
    texts: { editor: '30', preview: '' },
    next: { editor: 30, preview: null },
  });
  assert.deepEqual(commitWidths({ editor: '', preview: '72' }, { editor: null, preview: 72 }), { texts: { editor: '', preview: '72' }, next: null });
});

test('the autosave delay is clamped; the same delay gives no update', () => {
  const autosave = { mode: 'afterDelay' as const, delayMs: 1000 };
  assert.deepEqual(commitDelay('50', autosave), { text: '500', next: { mode: 'afterDelay', delayMs: 500 } });
  assert.deepEqual(commitDelay('1000', autosave), { text: '1000', next: null });
  // Non numerico → il default (1000): uguale a quello di adesso, nessun aggiornamento. Vuoto = 0 → il minimo.
  assert.deepEqual(commitDelay('abc', autosave), { text: '1000', next: null });
  assert.deepEqual(commitDelay('', autosave), { text: '500', next: { mode: 'afterDelay', delayMs: 500 } });
});
```

`src/elements/settings/settings.dom.test.ts` (jsdom non scorre: uno stub di `scrollIntoView` registra la sezione portata in vista; senza `IntersectionObserver` l'elemento salta l'indice che segue lo scorrimento, lo prova `settings-sections.spec.ts`):

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { builtInPresets } from '../../ai/presets';
import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createThemeStore } from '../../state/themeStore';
import { countListeners } from '../../testing/countListeners';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';

installDialogStub();
installPopoverStub();
test.afterEach(() => document.body.replaceChildren());

/** jsdom non scorre: si registra quale sezione è stata portata in vista. */
const scrolled: string[] = [];
window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
  scrolled.push(this.id);
};

const IT = { ...EN_MESSAGES, 'settings.title': 'Impostazioni' };

function mount(options: { ai?: boolean } = {}) {
  const loaded: string[] = [];
  const { store: i18n, listeners } = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => (loaded.push(locale), { locale, messages: locale === 'it' ? IT : EN_MESSAGES }), persist() {} }),
  );
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const ai = fakeAi({ profiles: [defaultProfile()], presets: [builtInPresets()[0]] } as Partial<AiState>);
  Object.assign(ai, { reload: async () => {}, store: { getMeta: async () => null, setMeta: async () => {} } });
  const el = document.createElement('hmd-settings');
  el.section = 'general';
  el.ai = options.ai ? (ai as never) : null;
  el.syncBinding = null;
  el.theme = theme;
  el.autosave = { mode: 'afterDelay', delayMs: 1000 };
  el.textWidth = { editor: null, preview: 72 };
  el.i18n = i18n;
  scrolled.length = 0;
  document.body.append(el);
  const events: [string, unknown][] = [];
  for (const type of ['hmd-settings-section', 'hmd-settings-close', 'hmd-settings-autosave', 'hmd-settings-text-width', 'hmd-settings-save-all'] as const) {
    el.addEventListener(type, (event) => events.push([type, event.detail]));
  }
  const field = (label: string) => [...el.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)!.querySelector('input, select') as HTMLInputElement;
  const radio = (text: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === text)!.querySelector('input')!;
  const close = () => el.querySelector<HTMLButtonElement>('.navHeader button')!;
  return { el, i18n, theme, ai, listeners, loaded, events, field, radio, close };
}

test('the same DOM as SettingsView.tsx: a region with the index and the general section; the focus goes to the title', () => {
  const { el } = mount();
  const view = el.firstElementChild!;
  assert.equal(view.getAttribute('role'), 'region');
  assert.equal(view.getAttribute('aria-label'), EN_MESSAGES['settings.title']);
  assert.deepEqual([...view.children].map((c) => `${c.localName}.${c.className}`), ['nav.nav', 'div.content']);
  const nav = view.firstElementChild!;
  assert.deepEqual([...nav.children].map((c) => c.localName), ['div', 'a']);
  assert.equal(nav.querySelector('a')!.getAttribute('href'), '#settings');
  assert.equal(nav.querySelector('a')!.getAttribute('aria-current'), 'true');
  const general = el.querySelector('#settings-general')!;
  assert.deepEqual([...general.children].map((c) => c.localName), ['h2', 'label', 'fieldset', 'fieldset', 'fieldset', 'button']);
  assert.ok(document.activeElement === el.querySelector('h1'), 'focus on the title');
});

test('with the AI controller: four links and the three AI sections with their elements, in order', () => {
  const { el } = mount({ ai: true });
  assert.deepEqual([...el.querySelectorAll('nav a')].map((a) => a.getAttribute('href')), ['#settings', '#settings/ai-profiles', '#settings/ai-presets', '#settings/ai-sync']);
  assert.deepEqual([...el.querySelectorAll('.content > section')].map((s) => s.id), ['settings-general', 'settings-ai-profiles', 'settings-ai-presets', 'settings-ai-sync']);
  assert.deepEqual([...el.querySelectorAll('.content > section > :last-child')].slice(1).map((c) => c.localName), ['hmd-settings-profiles', 'hmd-settings-presets', 'hmd-settings-sync']);
});

test('the section of the route is scrolled into view, again when it changes; a link asks for its section and scrolls', () => {
  const { el, events } = mount({ ai: true });
  assert.deepEqual(scrolled, ['settings-general']);
  el.section = 'ai-sync';
  assert.deepEqual(scrolled, ['settings-general', 'settings-ai-sync']);
  el.querySelectorAll<HTMLAnchorElement>('nav a')[2].click();
  assert.deepEqual(events, [['hmd-settings-section', { section: 'ai-presets' }]]);
  assert.equal(scrolled.at(-1), 'settings-ai-presets');
});

test('language and theme go straight to their stores; the radios and the select follow them', async () => {
  const { field, radio, theme, loaded, i18n, el } = mount();
  const language = field(EN_MESSAGES['settings.language']) as unknown as HTMLSelectElement;
  language.value = 'it';
  language.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => i18n.getState().locale === 'it');
  assert.deepEqual(loaded, ['it']);
  assert.equal(el.firstElementChild!.getAttribute('aria-label'), 'Impostazioni');
  radio(EN_MESSAGES['theme.option.dark']).click();
  assert.equal(theme.getState(), 'dark');
  assert.equal(radio(EN_MESSAGES['theme.option.dark']).checked, true);
});

test('autosave: a mode is an event; the delay field shows only for afterDelay and is committed on Enter and blur, clamped', () => {
  const { el, field, radio, events } = mount();
  const delay = field(EN_MESSAGES['settings.delay']);
  delay.value = '50';
  delay.dispatchEvent(new Event('input', { bubbles: true }));
  delay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(delay.value, '500');
  assert.deepEqual(events, [['hmd-settings-autosave', { autosave: { mode: 'afterDelay', delayMs: 500 } }]]);
  radio(EN_MESSAGES['settings.autosave.off']).click();
  assert.deepEqual(events.at(-1), ['hmd-settings-autosave', { autosave: { mode: 'off', delayMs: 1000 } }]);
  el.autosave = { mode: 'off', delayMs: 1000 };
  assert.ok(!el.textContent!.includes(EN_MESSAGES['settings.delay']));
});

test('closing commits both width fields, then closes; Save all is an event', () => {
  const { field, close, events, el } = mount();
  const editor = field(EN_MESSAGES['settings.textWidth.editor']);
  editor.value = '10';
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  close().click();
  assert.deepEqual(events, [
    ['hmd-settings-text-width', { textWidth: { editor: 30, preview: 72 } }],
    ['hmd-settings-close', null],
  ]);
  assert.equal(editor.value, '30');
  [...el.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['settings.saveAll'])!.click();
  assert.deepEqual(events.at(-1), ['hmd-settings-save-all', null]);
});

test('with a dirty section, closing (✕, Esc, requestClose) asks once; Discard clears dirty and closes', async () => {
  const { el, close, events } = mount({ ai: true });
  const presets = el.querySelector('hmd-settings-presets')!;
  presets.querySelector<HTMLButtonElement>('.list button')!.click();
  const name = presets.querySelector<HTMLInputElement>('.detail input')!;
  name.value = 'Changed';
  name.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(el.dirty, true);
  close().click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  el.requestClose();
  assert.equal(document.querySelectorAll('dialog').length, 1);
  assert.deepEqual(events, []);
  [...document.querySelector('dialog')!.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES['ai.discardChanges'])!.click();
  await waitFor(() => events.length === 1);
  assert.deepEqual(events, [['hmd-settings-close', null]]);
  assert.equal(el.dirty, false);
});

test('detached: no keydown listener left (Esc does nothing), the dialog closes, the stores are free', async () => {
  const { el, listeners, events } = mount({ ai: true });
  el.remove();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(events, []);
  assert.equal(listeners(), 0);
});
```

RED atteso: `Cannot find module './settingsView'`; poi, con il modulo, il tag non definito (`el.firstElementChild` null).

- [ ] **Step 2: La logica pura**

`src/elements/settings/settingsView.ts`:

```ts
import type { MessageKey } from '../../i18n/messages';
import type { SettingsSection } from '../../lib/route';
import { clampTextWidth, type TextWidth, type TextWidthPane } from '../../lib/textWidth';
import { clampDelay, type AutosaveSettings } from '../../workspace/autosave';

/** Etichetta di ogni sezione: voce dell'indice e titolo `h2`. */
export const SECTION_LABELS: Record<SettingsSection, MessageKey> = {
  general: 'settings.general',
  'ai-profiles': 'settings.aiProfiles',
  'ai-presets': 'settings.aiPresets',
  'ai-sync': 'settings.aiSync',
};

/** Sezioni mostrate: quelle AI solo con il controller pronto (come SettingsView.tsx). */
export function settingsSections(hasAi: boolean): SettingsSection[] {
  return hasAi ? ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] : ['general'];
}

/** Id del `section` di una sezione, bersaglio dello scorrimento e dell'IntersectionObserver. */
export const sectionId = (section: SettingsSection) => `settings-${section}`;

/** Sezione di un id `settings-…` (l'inverso di `sectionId`), o null. */
export function sectionOf(id: string, sections: readonly SettingsSection[]): SettingsSection | null {
  const section = id.replace(/^settings-/, '');
  return (sections as readonly string[]).includes(section) ? (section as SettingsSection) : null;
}

/**
 * Sezione da segnare nell'indice: la più in alto tra quelle che si intersecano (come il callback
 * dell'IntersectionObserver di SettingsView.tsx). Null = nessuna, l'indice resta com'è.
 */
export function topSection(entries: readonly { id: string; top: number; intersecting: boolean }[], sections: readonly SettingsSection[]): SettingsSection | null {
  const top = entries.filter((e) => e.intersecting).sort((a, b) => a.top - b.top)[0];
  return top ? sectionOf(top.id, sections) : null;
}

/** Testo del campo di una larghezza: vuoto = nessun limite. */
export const widthText = (width: TextWidth, pane: TextWidthPane) => String(width[pane] ?? '');

/**
 * Conferma dei due campi delle larghezze insieme (chiudendo con un campo ancora a fuoco la modifica non va
 * persa): i testi riscritti nei limiti e il valore nuovo, o `next: null` se non cambia nulla.
 */
export function commitWidths(texts: Record<TextWidthPane, string>, current: TextWidth): { texts: Record<TextWidthPane, string>; next: TextWidth | null } {
  const next: TextWidth = { editor: clampTextWidth(texts.editor), preview: clampTextWidth(texts.preview) };
  const changed = next.editor !== current.editor || next.preview !== current.preview;
  return { texts: { editor: widthText(next, 'editor'), preview: widthText(next, 'preview') }, next: changed ? next : null };
}

/** Conferma del ritardo dell'autosalvataggio: il testo nei limiti e le impostazioni nuove, o `next: null`. */
export function commitDelay(text: string, autosave: AutosaveSettings): { text: string; next: AutosaveSettings | null } {
  const delayMs = clampDelay(Number(text));
  return { text: String(delayMs), next: delayMs === autosave.delayMs ? null : { ...autosave, delayMs } };
}
```

- [ ] **Step 3: Gli eventi**

`src/elements/events.ts`: gli import `import type { SettingsSection } from '../lib/route';`, `import type { TextWidth } from '../lib/textWidth';`, `import type { AutosaveSettings } from '../workspace/autosave';` (in ordine con gli altri), e intorno a `hmd-settings-dirty` (sopra il JSDoc di `hmd-start-pick`, in ordine alfabetico):

```ts
  /** Impostazioni: il ritardo o la modalità dell'autosalvataggio confermati (da salvare e applicare). */
  'hmd-settings-autosave': CustomEvent<{ autosave: AutosaveSettings }>;
  /** Impostazioni: chiuse (con la conferma, se c'erano modifiche aperte). */
  'hmd-settings-close': CustomEvent<null>;
  /** Sezione di profili o preset: la bozza aperta è diventata (o non è più) da salvare. */
  'hmd-settings-dirty': CustomEvent<{ dirty: boolean }>;
  /** Impostazioni: «Salva tutto». */
  'hmd-settings-save-all': CustomEvent<null>;
  /** Impostazioni: voce dell'indice scelta (la rotta passa a quella sezione). */
  'hmd-settings-section': CustomEvent<{ section: SettingsSection }>;
  /** Impostazioni: larghezze del testo confermate (da salvare e applicare). */
  'hmd-settings-text-width': CustomEvent<{ textWidth: TextWidth }>;
```

- [ ] **Step 4: `hmd-settings` e il suo foglio**

`src/elements/settings/settings.element.ts` (focus sul titolo solo alla prima connessione; Esc sulla finestra legato al `signal`; i testi dei campi numerici partono dai valori di adesso e si riscrivono solo alla conferma; una conferma alla volta, e Scarta svuota `dirty` **prima** di emettere `hmd-settings-close`, altrimenti la guardia bloccherebbe di nuovo; l'indice con un `IntersectionObserver` rifatto solo quando cambiano le sezioni; lo scorrimento solo quando cambiano sezione o controller, come l'effetto `[section, ai]`):

```ts
import type { SyncBinding } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../../i18n/i18n';
import { formatRoute, type SettingsSection } from '../../lib/route';
import { MAX_TEXT_WIDTH, MIN_TEXT_WIDTH, TEXT_WIDTH_PANES, type TextWidth, type TextWidthPane } from '../../lib/textWidth';
import type { I18nStore } from '../../state/i18nStore';
import type { ThemeStore } from '../../state/themeStore';
import { THEME_PREFS } from '../../theme/theme';
import { AUTOSAVE_MODES, DEFAULT_AUTOSAVE, MAX_DELAY_MS, MIN_DELAY_MS, type AutosaveSettings } from '../../workspace/autosave';
import { showDiscardChangesDialog } from '../dialogs/confirmDialog';
import { emit } from '../events';
import { showChildren } from './fields';
import type { HmdSettingsPresets, PresetsController } from './presets.element';
import type { HmdSettingsProfiles, ProfilesController } from './profiles.element';
import { SECTION_LABELS, commitDelay, commitWidths, sectionId, settingsSections, topSection, widthText } from './settingsView';
import type { HmdSettingsSync, SyncController } from './sync.element';
import './settings.css';

/** Quello che le impostazioni usano del controller AI: quello delle tre sezioni. */
export type SettingsController = ProfilesController & PresetsController & SyncController;

interface Parts {
  view: HTMLDivElement;
  nav: HTMLElement;
  close: HTMLButtonElement;
  title: HTMLHeadingElement;
  links: Map<SettingsSection, HTMLAnchorElement>;
  content: HTMLDivElement;
  general: HTMLElement;
  generalTitle: HTMLHeadingElement;
  languageCaption: HTMLSpanElement;
  language: HTMLSelectElement;
  themeLegend: HTMLLegendElement;
  themes: Map<string, { input: HTMLInputElement; text: Text }>;
  autosaveGroup: HTMLFieldSetElement;
  autosaveLegend: HTMLLegendElement;
  autosaves: Map<string, { input: HTMLInputElement; text: Text }>;
  delayLabel: HTMLLabelElement;
  delayCaption: HTMLSpanElement;
  delay: HTMLInputElement;
  widthLegend: HTMLLegendElement;
  widths: Record<TextWidthPane, { caption: HTMLSpanElement; input: HTMLInputElement }>;
  widthHint: HTMLParagraphElement;
  saveAll: HTMLButtonElement;
  ai: { profiles: HTMLElement; presets: HTMLElement; sync: HTMLElement; titles: HTMLHeadingElement[] };
  profiles: HmdSettingsProfiles;
  presets: HmdSettingsPresets;
  sync: HmdSettingsSync;
}

/**
 * Impostazioni a pagina, sopra l'area di lavoro (era SettingsView.tsx): indice delle sezioni, generale
 * (lingua, tema, autosalvataggio, larghezze del testo, Salva tutto) e, con il controller AI pronto, profili,
 * preset e sync. La sezione arriva dalla rotta (`section`) e si porta in vista; la voce dell'indice segue
 * lo scorrimento. Chiudere (✕, Esc, `requestClose()` quando Indietro è bloccato) conferma prima i campi e,
 * con bozze aperte, chiede se scartarle. Lingua e tema vanno direttamente ai loro store; il resto esce come
 * eventi `hmd-settings-*` verso `hmd-workspace`.
 */
export class HmdSettings extends HmdElement {
  #section: SettingsSection = 'general';
  #ai: SettingsController | null = null;
  #syncBinding: SyncBinding | null = null;
  #theme: ThemeStore | null = null;
  #autosave: AutosaveSettings = DEFAULT_AUTOSAVE;
  #textWidth: TextWidth = { editor: null, preview: null };
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Testi dei campi numerici: si confermano al blur, a Invio e alla chiusura (come lo stato di SettingsView.tsx). */
  #delayText = '';
  #widthTexts: Record<TextWidthPane, string> = { editor: '', preview: '' };
  #dirty = new Set<SettingsSection>();
  #visible: SettingsSection = 'general';
  #confirming = false;
  #observer: IntersectionObserver | null = null;
  /** Sezioni osservate (cambiano solo con il controller AI). */
  #observed: SettingsSection[] = [];
  /** Sezione e controller dell'ultimo scorrimento: si scorre solo quando cambiano (l'effetto `[section, ai]`). */
  #scrolled: { section: SettingsSection; ai: SettingsController | null } | null = null;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#theme && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#theme!, this.#i18n!),
  });

  get section(): SettingsSection { return this.#section; }
  set section(value: SettingsSection) {
    this.#section = value ?? 'general';
    this.#loop.update();
  }
  get ai(): SettingsController | null { return this.#ai; }
  set ai(value: SettingsController | null) {
    value ??= null;
    if (value === this.#ai) return;
    this.#ai = value;
    // Senza controller le sezioni AI spariscono con le loro bozze.
    if (!value) this.#dirty.clear();
    this.#loop.update();
  }
  get syncBinding(): SyncBinding | null { return this.#syncBinding; }
  set syncBinding(value: SyncBinding | null) {
    value ??= null;
    if (value === this.#syncBinding) return;
    this.#syncBinding = value;
    this.#loop.update();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) {
    value ??= null;
    if (value === this.#theme) return;
    this.#theme = value;
    this.reconnect();
  }
  get autosave(): AutosaveSettings { return this.#autosave; }
  set autosave(value: AutosaveSettings) {
    this.#autosave = value ?? DEFAULT_AUTOSAVE;
    this.#loop.update();
  }
  get textWidth(): TextWidth { return this.#textWidth; }
  set textWidth(value: TextWidth) {
    this.#textWidth = value ?? { editor: null, preview: null };
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  /** Qualche sezione ha bozze non salvate: la guardia della rotta blocca Indietro. */
  get dirty(): boolean { return this.#dirty.size > 0; }

  /** Indietro del browser bloccato dalla guardia: si chiude passando dalla conferma. */
  requestClose(): void {
    this.#close();
  }

  protected connect(signal: AbortSignal): void {
    const first = !this.#parts;
    if (first) {
      // I testi dei campi partono dai valori di adesso (come gli useState iniziali di SettingsView.tsx).
      this.#delayText = String(this.#autosave.delayMs);
      this.#widthTexts = { editor: widthText(this.#textWidth, 'editor'), preview: widthText(this.#textWidth, 'preview') };
      this.#visible = this.#section;
      this.#parts = this.#build();
      this.append(this.#parts.view);
    }
    this.#dialogs ??= new AbortController();
    const parts = this.#parts!;
    parts.content.addEventListener('hmd-settings-dirty', (event) => this.#onDirty(event), { signal });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && !document.querySelector('dialog[open]')) this.#close();
      },
      { signal },
    );
    const { theme, i18n } = { theme: this.#theme, i18n: this.#i18n };
    if (!theme || !i18n) return;
    this.watch(theme, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
    // Aprendo, il focus va sul titolo: il resto dell'app è inerte e il focus precedente andrebbe perso.
    if (first) parts.title.focus({ preventScroll: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed = [];
    this.#scrolled = null;
    this.#dialogs?.abort();
    this.#dialogs = null;
  }

  #onDirty(event: HTMLElementEventMap['hmd-settings-dirty']): void {
    const target = event.target as Element;
    const parts = this.#parts!;
    const section: SettingsSection | null = target === parts.profiles ? 'ai-profiles' : target === parts.presets ? 'ai-presets' : null;
    if (!section) return;
    if (event.detail.dirty) this.#dirty.add(section);
    else this.#dirty.delete(section);
  }

  #commitDelay(): void {
    const { text, next } = commitDelay(this.#delayText, this.#autosave);
    this.#delayText = text;
    if (this.#parts) this.#parts.delay.value = text;
    if (next) emit(this, 'hmd-settings-autosave', { autosave: next });
  }

  // Entrambi i campi insieme: chiudendo con un campo ancora a fuoco (Esc) la modifica non va persa.
  #commitWidths(): void {
    const { texts, next } = commitWidths(this.#widthTexts, this.#textWidth);
    this.#widthTexts = texts;
    if (this.#parts) for (const pane of TEXT_WIDTH_PANES) this.#parts.widths[pane].input.value = texts[pane];
    if (next) emit(this, 'hmd-settings-text-width', { textWidth: next });
  }

  #close(): void {
    this.#commitDelay();
    this.#commitWidths();
    if (this.#dirty.size === 0) return emit(this, 'hmd-settings-close', null);
    // Una conferma alla volta: «Indietro» con la conferma già aperta richiama la chiusura.
    const t = this.#i18n?.t;
    const signal = this.#dialogs?.signal;
    if (this.#confirming || !t || !signal) return;
    this.#confirming = true;
    void showDiscardChangesDialog({ t, signal }).then((discard) => {
      this.#confirming = false;
      if (!discard || signal.aborted) return;
      // Prima di uscire: altrimenti la guardia della rotta bloccherebbe di nuovo la cronologia.
      this.#dirty.clear();
      emit(this, 'hmd-settings-close', null);
    });
  }

  #scrollTo(section: SettingsSection): void {
    this.#parts?.content.querySelector(`#${sectionId(section)}`)?.scrollIntoView({ block: 'start' });
  }

  #build(): Parts {
    const value = (event: Event) => (event.currentTarget as HTMLInputElement).value;
    const onEnter = (commit: () => void) => (event: KeyboardEvent) => {
      if (event.key === 'Enter') commit();
    };
    const radio = (name: string, v: string, onChange: () => void) => {
      const input = el('input', { type: 'radio', name, value: v, on: { change: onChange } });
      return { input, text: document.createTextNode('') };
    };
    const themes = new Map(THEME_PREFS.map((v) => [v, radio('theme', v, () => this.#theme?.setTheme(v))]));
    const autosaves = new Map(AUTOSAVE_MODES.map((mode) => [mode, radio('autosave', mode, () => emit(this, 'hmd-settings-autosave', { autosave: { ...this.#autosave, mode } }))]));
    const option = (r: { input: HTMLInputElement; text: Text }) => el('label', { class: 'option' }, r.input, r.text);
    const delayCaption = el('span');
    const delay = el('input', {
      class: 'input',
      type: 'number',
      min: String(MIN_DELAY_MS),
      max: String(MAX_DELAY_MS),
      step: '100',
      on: { input: (e) => (this.#delayText = value(e)), blur: () => this.#commitDelay(), keydown: onEnter(() => this.#commitDelay()) },
    });
    const widths = Object.fromEntries(
      TEXT_WIDTH_PANES.map((pane) => [
        pane,
        {
          caption: el('span'),
          input: el('input', {
            class: 'input',
            type: 'number',
            min: String(MIN_TEXT_WIDTH),
            max: String(MAX_TEXT_WIDTH),
            step: '1',
            on: { input: (e) => (this.#widthTexts = { ...this.#widthTexts, [pane]: value(e) }), blur: () => this.#commitWidths(), keydown: onEnter(() => this.#commitWidths()) },
          }),
        },
      ]),
    ) as Parts['widths'];
    delay.value = this.#delayText;
    for (const pane of TEXT_WIDTH_PANES) widths[pane].input.value = this.#widthTexts[pane];
    const sectionBox = (id: SettingsSection, ...children: Node[]) => el('section', { id: sectionId(id), class: 'section' }, ...children);
    const titles = [el('h2'), el('h2'), el('h2')];
    const parts: Parts = {
      view: el('div', { class: 'view', role: 'region' }),
      nav: el('nav', { class: 'nav' }),
      close: el('button', { type: 'button', class: 'iconButton tooltip', on: { click: () => this.#close() } }, icon('close')),
      title: el('h1', { tabIndex: -1 }),
      links: new Map(),
      content: el('div', { class: 'content' }),
      general: el('section', { id: sectionId('general'), class: 'section' }),
      generalTitle: el('h2'),
      languageCaption: el('span'),
      language: el(
        'select',
        { class: 'input', on: { change: (e) => void this.#i18n?.setLocale(value(e) as Locale) } },
        SUPPORTED_LOCALES.map((l) => el('option', { value: l, lang: l }, LOCALE_NAMES[l])),
      ),
      themeLegend: el('legend'),
      themes,
      autosaveGroup: el('fieldset', { class: 'group' }),
      autosaveLegend: el('legend'),
      autosaves,
      delayLabel: el('label', { class: 'field' }, delayCaption, delay),
      delayCaption,
      delay,
      widthLegend: el('legend'),
      widths,
      widthHint: el('p', { class: 'hint' }),
      saveAll: el('button', { type: 'button', class: 'secondary', on: { click: () => emit(this, 'hmd-settings-save-all', null) } }),
      ai: { profiles: el('section'), presets: el('section'), sync: el('section'), titles },
      profiles: el('hmd-settings-profiles'),
      presets: el('hmd-settings-presets'),
      sync: el('hmd-settings-sync'),
    };
    parts.ai = {
      profiles: sectionBox('ai-profiles', titles[0], parts.profiles),
      presets: sectionBox('ai-presets', titles[1], parts.presets),
      sync: sectionBox('ai-sync', titles[2], parts.sync),
      titles,
    };
    parts.autosaveGroup.append(parts.autosaveLegend, ...[...autosaves.values()].map(option));
    parts.general.append(
      parts.generalTitle,
      el('label', { class: 'field' }, parts.languageCaption, parts.language),
      el('fieldset', { class: 'group' }, parts.themeLegend, ...[...themes.values()].map(option)),
      parts.autosaveGroup,
      el('fieldset', { class: 'group' }, parts.widthLegend, ...TEXT_WIDTH_PANES.map((pane) => el('label', { class: 'field' }, widths[pane].caption, widths[pane].input)), parts.widthHint),
      parts.saveAll,
    );
    parts.content.append(parts.general);
    parts.nav.append(el('div', { class: 'navHeader' }, parts.close, parts.title));
    parts.view.append(parts.nav, parts.content);
    return parts;
  }

  #link(section: SettingsSection): HTMLAnchorElement {
    return el('a', {
      class: 'navLink',
      href: formatRoute({ view: 'settings', section }),
      on: {
        click: (event) => {
          event.preventDefault();
          emit(this, 'hmd-settings-section', { section });
          // Se la sezione è già quella della rotta non cambia nulla: si scorre direttamente.
          this.#scrollTo(section);
        },
      },
    });
  }

  #render(parts: Parts, theme: ThemeStore, i18n: I18nStore): void {
    const t = i18n.t;
    const ai = this.#ai;
    const sections = settingsSections(!!ai);
    toggleAttr(parts.view, 'aria-label', true, t('settings.title'));
    toggleAttr(parts.nav, 'aria-label', true, t('settings.sections'));
    toggleAttr(parts.close, 'aria-label', true, t('settings.close'));
    toggleAttr(parts.close, 'data-tooltip', true, t('settings.close'));
    setText(parts.title, t('settings.title'));
    // Indice: un link per sezione mostrata, dopo la testata.
    for (const section of sections) if (!parts.links.has(section)) parts.links.set(section, this.#link(section));
    for (const [section, link] of parts.links) {
      setText(link, t(SECTION_LABELS[section]));
      toggleAttr(link, 'aria-current', this.#visible === section, 'true');
    }
    showChildren(parts.nav, [parts.nav.firstElementChild!, ...sections.map((s) => parts.links.get(s)!)], [...parts.links.values()]);
    // Generale.
    setText(parts.generalTitle, t('settings.general'));
    setText(parts.languageCaption, t('settings.language'));
    if (parts.language.value !== i18n.getState().locale) parts.language.value = i18n.getState().locale;
    setText(parts.themeLegend, t('settings.theme'));
    for (const [v, r] of parts.themes) {
      setText(r.text, t(`theme.option.${v as (typeof THEME_PREFS)[number]}`));
      r.input.checked = theme.getState() === v;
    }
    setText(parts.autosaveLegend, t('settings.autosave'));
    for (const [mode, r] of parts.autosaves) {
      setText(r.text, t(`settings.autosave.${mode as (typeof AUTOSAVE_MODES)[number]}`));
      r.input.checked = this.#autosave.mode === mode;
    }
    setText(parts.delayCaption, t('settings.delay'));
    showChildren(parts.autosaveGroup, [...parts.autosaveGroup.children].filter((c) => c !== parts.delayLabel).concat(this.#autosave.mode === 'afterDelay' ? [parts.delayLabel] : []), [parts.delayLabel]);
    setText(parts.widthLegend, t('settings.textWidth'));
    for (const pane of TEXT_WIDTH_PANES) {
      setText(parts.widths[pane].caption, t(`settings.textWidth.${pane}`));
      toggleAttr(parts.widths[pane].input, 'placeholder', true, t('settings.textWidth.none'));
    }
    setText(parts.widthHint, t('settings.textWidth.hint', { min: MIN_TEXT_WIDTH, max: MAX_TEXT_WIDTH }));
    setText(parts.saveAll, t('settings.saveAll'));
    // Sezioni AI: proprietà prima dell'inserimento, solo se cambiano.
    parts.ai.titles.forEach((h2, i) => setText(h2, t(SECTION_LABELS[(['ai-profiles', 'ai-presets', 'ai-sync'] as const)[i]])));
    if (ai) {
      for (const child of [parts.profiles, parts.presets]) {
        if (child.controller !== ai) child.controller = ai;
        if (child.i18n !== i18n) child.i18n = i18n;
      }
      if (parts.sync.controller !== ai) parts.sync.controller = ai;
      if (parts.sync.binding !== this.#syncBinding) parts.sync.binding = this.#syncBinding;
      if (parts.sync.i18n !== i18n) parts.sync.i18n = i18n;
    }
    showChildren(parts.content, [parts.general, ...(ai ? [parts.ai.profiles, parts.ai.presets, parts.ai.sync] : [])], [parts.ai.profiles, parts.ai.presets, parts.ai.sync]);
    this.#observe(parts, sections);
    // Entrando (o cambiando sezione dalla rotta) si scorre alla sezione; anche quando compaiono le sezioni AI.
    if (this.#scrolled?.section !== this.#section || this.#scrolled.ai !== ai) {
      this.#scrolled = { section: this.#section, ai };
      this.#scrollTo(this.#section);
    }
  }

  /** La voce dell'indice segue la sezione visibile mentre si scorre (un observer per insieme di sezioni). */
  #observe(parts: Parts, sections: SettingsSection[]): void {
    if (this.#observer && this.#observed.join() === sections.join()) return;
    this.#observer?.disconnect();
    this.#observed = sections;
    if (typeof IntersectionObserver === 'undefined') return;
    this.#observer = new IntersectionObserver(
      (entries) => {
        const top = topSection(entries.map((e) => ({ id: e.target.id, top: e.boundingClientRect.top, intersecting: e.isIntersecting })), this.#observed);
        if (!top || top === this.#visible) return;
        this.#visible = top;
        this.#loop.update();
      },
      { root: parts.content, rootMargin: '0px 0px -60% 0px' },
    );
    parts.content.querySelectorAll('section[id^="settings-"]').forEach((section) => this.#observer!.observe(section));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-settings': HmdSettings;
  }
}
```

`src/elements/settings/settings.css` (valori di `SettingsView.module.css` e dei campi di `Dialog.module.css`; il limite inferiore lascia le sezioni AI a `sections.css`):

```css
@layer components {
  /*
   * Valori copiati da SettingsView.module.css e Dialog.module.css (campi della sezione generale). Il limite
   * inferiore lascia le tre sezioni AI al loro foglio (sections.css).
   */
  @scope (hmd-settings) to (hmd-settings-profiles, hmd-settings-presets, hmd-settings-sync) {
    :scope {
      display: contents;
    }

    /* Impostazioni a pagina, sopra l'area di lavoro. */
    .view {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      background: var(--c-bg);
      color: var(--c-text);
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px;
      border-right: 1px solid var(--c-border);
      background: var(--c-sidebar);
      font-family: var(--font-pixel);
    }

    .navHeader {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
    }

    .navHeader h1 {
      margin: 0;
      font-size: 16px;
      font-weight: normal;
    }

    /* Il titolo riceve il focus solo da script (all'apertura): nessun anello. */
    .navHeader h1:focus {
      outline: none;
    }

    .navLink {
      padding: 6px 10px;
      border-radius: 6px;
      color: var(--c-text);
      text-decoration: none;
    }

    .navLink[aria-current='true'] {
      background: var(--c-accent-soft);
    }

    .content {
      overflow: auto;
      padding: 24px clamp(16px, 4vw, 48px) 40vh;
    }

    .section {
      max-width: 52rem;
      margin: 0 0 40px;
      scroll-margin-top: 16px;
    }

    .section h2 {
      margin: 0 0 16px;
      font: 18px/1.3 var(--font-pixel);
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

    .iconButton:hover {
      background: var(--c-accent-soft);
    }

    @media (width < 700px) {
      .view {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
      }

      .nav {
        flex-direction: row;
        overflow-x: auto;
        border-right: none;
        border-bottom: 1px solid var(--c-border);
      }

      .navHeader {
        margin: 0 8px 0 0;
      }
    }

    .hint {
      margin: 4px 0 0;
      color: var(--c-muted);
      font-size: 13px;
    }

    /* Campi della sezione generale (erano in Dialog.module.css). */
    .input {
      width: 100%;
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: var(--c-bg);
      color: var(--c-text);
    }

    .secondary {
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-weight: 600;
      background: transparent;
      border: 1px solid var(--c-border);
    }

    .field {
      display: grid;
      gap: 4px;
      margin: 12px 0 0;
    }

    .group {
      border: 1px solid var(--c-border);
      border-radius: 8px;
      margin: 16px 0 0;
      padding: 8px 12px 12px;
      display: grid;
      gap: 6px;
    }

    .group legend {
      padding: 0 4px;
      font-weight: 600;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
  }
}
```

`src/elements/define.ts`: import `HmdSettings` e voce `['hmd-settings', HmdSettings]` dopo `hmd-search-panel` (prima di `hmd-settings-presets`).

- [ ] **Step 5: `WorkspaceView.tsx` monta `hmd-settings`**

`src/elements/jsx.d.ts`: import `SettingsSection` (`../lib/route`), `TextWidth` (`../lib/textWidth`), `AutosaveSettings` (`../workspace/autosave`), `HmdSettings, SettingsController` (`./settings/settings.element`), e prima di `'hmd-settings-presets'`:

```ts
      'hmd-settings': HmdProps<
        {
          section: SettingsSection;
          ai: SettingsController | null;
          syncBinding: SyncBinding | null;
          theme: ThemeStore;
          autosave: AutosaveSettings;
          textWidth: TextWidth;
          i18n: I18nStore;
        },
        'hmd-settings-autosave' | 'hmd-settings-close' | 'hmd-settings-save-all' | 'hmd-settings-section' | 'hmd-settings-text-width'
      > & { ref?: Ref<HmdSettings> };
```

`src/ui/WorkspaceView.tsx`: `import { SettingsView } from './SettingsView';` → `import type { HmdSettings } from '../elements/settings/settings.element';`; `import { getThemeStore, useTheme } from '../theme/useTheme';` → `import { getThemeStore } from '../theme/useTheme';` e via `const [theme, setTheme] = useTheme();`; al posto di `settingsDirty`, `closeRequest`, `onSettingsDirty` e della `useRoute` di prima:

```tsx
  const settingsRef = useRef<HmdSettings>(null);
  const { route, navigate } = useRoute({ canLeave: () => !settingsRef.current?.dirty, onBlocked: () => settingsRef.current?.requestClose() });
```

e al posto di `<SettingsView … />`:

```tsx
      {settingsOpen && (
        <hmd-settings
          ref={settingsRef}
          section={route.section}
          ai={ai}
          syncBinding={syncBinding}
          theme={getThemeStore()}
          autosave={state.autosave}
          textWidth={textWidth}
          i18n={i18nStore}
          onhmd-settings-section={(event) => navigate({ view: 'settings', section: event.detail.section })}
          onhmd-settings-close={() => navigate({ view: 'workspace' })}
          onhmd-settings-autosave={(event) => {
            writePref('autosave', event.detail.autosave);
            workspace.setAutosave(event.detail.autosave);
          }}
          onhmd-settings-text-width={(event) => {
            writePref('textWidth', event.detail.textWidth);
            setTextWidth(event.detail.textWidth);
          }}
          onhmd-settings-save-all={() => void workspace.saveAll()}
        />
      )}
```

(`route.section` esiste perché il ramo è dentro `settingsOpen`; se TypeScript non lo restringe, `route.view === 'settings' ? route.section : 'general'`.) Poi:

```bash
git rm src/ui/SettingsView.tsx src/ui/SettingsView.module.css src/ui/Dialog.module.css
grep -rn "SettingsView" src --include=*.tsx; echo "uscita $?"          # atteso: uscita 1
grep -rn "Dialog.module\|closeRequest\|onDirtyChange" src; echo "uscita $?"   # atteso: uscita 1
```

- [ ] **Step 6: Verifica**

```bash
npx tsc --noEmit && npm test            # 1016 verdi
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/settings.spec.ts e2e/settings-sections.spec.ts e2e/theme-i18n.spec.ts e2e/ai-model.spec.ts e2e/ai-composer.spec.ts e2e/visual.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/settings.spec.ts e2e/settings-sections.spec.ts e2e/theme-i18n.spec.ts e2e/ai-model.spec.ts e2e/ai-composer.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "settings|unsaved-dialog|ai-sync"
pgrep -af "vite|chrom|playwright"
```

Nel prototipo: questi e2e verdi (49 in build, salvo i 2 snapshot noti dello start screen in `visual.spec.ts`), audit verde.

- [ ] **Step 7: Commit**

`test:` (Step 1), `feat:` (Step 2–4), `refactor:` (Step 5). Nessun `Co-authored-by`.

### Task 5: Chiusura della 7a — suite complete, spec, PR (Builder)

Solo con la divisione in 7a/7b (decisione 1). Con la variante A questo task si salta e le sue misure finiscono nel Task 8.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 «Fase 7», §13), questo piano (paragrafo «Esecuzione 7a» in fondo a «Misure»)

**Criteri di accettazione:** le tre suite complete verdi **una volta** sul commit finale della 7a (attesi nel prototipo, calcolati sui passi: `npm test` 1016; `test:e2e` 202 = 200 + i 2 noti; `test:e2e:dev` 187; audit 136); snapshot e `dist-baseline/` invariati; bundle gzip annotato (React c'è ancora: atteso poco sopra 441 143 B); spec aggiornata; PR #10 pronta con titolo e corpo della 7a.

- [ ] **Step 1: Suite complete, una volta, in sequenza**

```bash
npx tsc --noEmit && npm test && npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit
npm run build && gzip -c dist/assets/index-*.js | wc -c
pgrep -af "vite|chrom|playwright"
```

Una caduta isolata si ripete da sola (`--repeat-each=3`) prima di chiamarla regressione; le instabilità note sono nei Global Constraints. Se una suite cade per memoria: di nuovo con `E2E_WORKERS=1`, e lo si scrive.

- [ ] **Step 2: Spec**

In §7 «Fase 7», sotto i punti 1–5, una riga «7a **fatta**: …» nello stile delle note «6c fatta» (elementi, logica pura nuova, cambio voluto della chiave, eccezioni di `architecture.test.ts`, stati di audit nuovi, «In `src/ui/` restano `WorkspaceView`, `App` e gli hook (7b)», bundle prima → dopo). In §13 il piano: `docs/superpowers/plans/2026-10-12-housemd-wc-13-fase-7-impostazioni-workspace-app.md (fase 7, 7a e 7b)`.

- [ ] **Step 3: PR della 7a**

```bash
gh pr edit 10 --title "LAB-5: fase 7a, impostazioni senza React" --body-file <corpo: riepilogo, decisioni 2–6, come provare, misure>
gh pr ready 10
```

Il corpo finisce con la riga «🤖 Generated with [Claude Code](https://claude.com/claude-code)» come le altre PR della migrazione; nessuna riga di attribuzione nei commit.

- [ ] **Step 4: Commit**

`docs: spec e piano allineati alla fase 7a` (nessun `Co-authored-by`), push. Il merge lo fa il PM dopo la review; la 7b parte dal branch dell'epica aggiornato (Task 6, Step 0).

### Task 6: `hmd-workspace` (Planner)

`WorkspaceView.tsx` diventa `hmd-workspace`. La sessione AI della cartella (era `useAiController`) va in `aiSession.ts`, i calcoli (vista mostrata, chiave del documento, toast, `beforeunload`, riapertura) in `workspaceView.ts`; l'elemento crea i figli, li aggiorna, tiene i listener della finestra e lo stato della vista. `App.tsx` lo monta con uno store della rotta suo (decisione 7). Spariscono `WorkspaceView.tsx`, il suo modulo, `Icon.tsx` e gli hook `useRoute`, `useUnmountSignal`, `useWorkspace`, `useAiController`, `useAiState`. A Planner: è il punto dove un dettaglio sbagliato rompe molti flussi (il prototipo ne ha trovato uno, decisione 9).

**Files:**
- Create: `src/elements/workspace/aiSession.ts`, `aiSession.test.ts`, `workspaceView.ts`, `workspaceView.test.ts`, `workspace.element.ts`, `workspace.css`, `workspace.dom.test.ts`
- Modify: `src/elements/events.ts` (`hmd-workspace-change-folder`), `src/elements/define.ts`, `src/elements/jsx.d.ts` (restano solo i quattro tag che React monta ancora), `src/App.tsx`
- Delete: `src/ui/WorkspaceView.tsx`, `src/ui/WorkspaceView.module.css`, `src/ui/Icon.tsx`, `src/ui/useRoute.ts`, `src/ui/useUnmountSignal.ts`, `src/ui/useWorkspace.ts`, `src/ui/ai/useAiController.ts`, `src/ui/ai/useAiState.ts`

**Interfaces:**
- Consumes: tutti gli elementi del workspace (`hmd-ai-sidebar`, `hmd-search-panel`, `hmd-file-tree`, `hmd-theme-switcher`, `hmd-conflict-bar`, `hmd-ai-review`, `hmd-editor`, `hmd-history-panel`, `hmd-preview`, `hmd-settings`, `hmd-toasts`), `layout.ts`, `keymap.ts`, `saveIndicator.ts`, `dialogFor.ts`, `treeDialogs.ts`, `ui/shortcuts.ts`, `ui/tree.ts`, `lib/prefs.ts`, `lib/pageTitle.ts`, `lib/textWidth.ts`, `editor/docSession.ts`, `showAccessLostDialog`, `browserSyncBinding`, `RouteStore`.
- Produces: `HmdWorkspace` — ingressi `workspace`, `workspaceId`, `handle`, `switchingFolder`, `i18n`, `theme`, `route`; solo per i test `openAi: OpenAiSession` e `syncFor`; evento `hmd-workspace-change-folder`. `openAiSession(workspace, deps, signal)`, `aiWorkspace(workspace)`, `AiSessionDeps`, `browserAiSessionDeps`. In `workspaceView.ts`: `shownMode`, `docKey`, `toastItems`, `toastTarget`, `unloadNeedsConfirm`, `reopenPlan`.

**Criteri di accettazione:** RED annotato; `npm test` 1016 + 18 (4 + 5 + 9) = **1034**; lint pulito; e2e in build di tutti i file tranne `visual.spec.ts` (il workspace li attraversa tutti: qui «i file toccati» sono la suite; `visual.spec.ts` dà comunque solo i 2 noti), in sviluppo `workspace-shell`, `settings`, `settings-sections`, `startup`, `editor`, `external`, `history`, `ai-review`, `ai-review-bar`, `ai-composer`, `theme-i18n`; audit degli stati del workspace (comando sotto) verde, **in particolare `ai-review-conflict`**; i `grep` di pulizia con uscita 1.

- [ ] **Step 0 (solo con la divisione 7a/7b): branch della 7b**

Dopo il merge della 7a nell'epica:

```bash
git fetch origin
git switch -c lab/LAB-5-fase-7b origin/epic/LAB-3-web-components
git push -u origin lab/LAB-5-fase-7b
gh pr create --draft --base epic/LAB-3-web-components --title "LAB-5: fase 7b, workspace e app senza React" --body-file <riepilogo e link al piano>
npm ci
```

La baseline **non** si ricostruisce dalla HEAD dell'epica: dopo il merge della 7a quella build ha già le impostazioni migrate, e l'audit della 7b non confronterebbe più con l'app React. Due strade, nell'ordine:

```bash
# (a) copiarla dal checkout della 7a (dist-baseline/ non è versionata, resta nel worktree del Task 1)
cp -r <worktree della 7a>/dist-baseline ./dist-baseline
cat dist-baseline/BASELINE_SHA                     # deve essere lo SHA annotato nel Task 1

# (b) se quel checkout non c'è più: ricostruirla in un worktree separato, dallo SHA del Task 1
SHA=<SHA annotato nel Task 1 (commento finale della sub-issue del Task 1)>
git worktree add --detach /home/agent/work/housemd-baseline-7 "$SHA"
(cd /home/agent/work/housemd-baseline-7 && npm ci && npm run build)
rm -rf dist-baseline && cp -r /home/agent/work/housemd-baseline-7/dist dist-baseline && echo "$SHA" > dist-baseline/BASELINE_SHA
git worktree remove --force /home/agent/work/housemd-baseline-7
```

Nel commento finale del Task 6: quale strada e lo SHA di `dist-baseline/BASELINE_SHA`.

- [ ] **Step 1: I test, prima del codice**

`src/elements/workspace/aiSession.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { AiController } from '../../ai/aiController';
import { createMemoryAiStores } from '../../ai/stores';
import type { WorkspaceState } from '../../workspace/workspace';
import { aiWorkspace, openAiSession, type AiSessionDeps } from './aiSession';

function workspace(doc: Partial<NonNullable<WorkspaceState['doc']>> | null = null, updating = false) {
  const opened: string[] = [];
  return {
    getState: () => ({ doc, updating }) as unknown as WorkspaceState,
    snapshotBeforeAi: () => {},
    openFile: async (path: string) => void opened.push(path),
    opened,
  };
}

function deps(options: { idbFails?: boolean } = {}) {
  const registered: AiController[] = [];
  let unregistered = 0;
  const d: AiSessionDeps = {
    idbStores: async () => (options.idbFails ? Promise.reject(new Error('no idb')) : createMemoryAiStores()),
    memoryStores: () => createMemoryAiStores(),
    savedProfile: () => undefined,
    register: (controller) => (registered.push(controller), () => void unregistered++),
  };
  return { deps: d, registered, unregistered: () => unregistered };
}

test('the AI workspace binding reads the open document as the controller wants it', () => {
  const ws = workspace({ path: 'a.md', text: 'A', conflict: undefined } as never, true);
  const binding = aiWorkspace(ws as never);
  assert.deepEqual(binding.getDoc(), { path: 'a.md', textLf: 'A', conflict: undefined, updating: true });
  void binding.openFile('b.md');
  assert.deepEqual(ws.opened, ['b.md']);
  assert.equal(aiWorkspace(workspace() as never).getDoc(), null);
});

test('a session: the controller is initialised, registered for updates, and closed once', async () => {
  const { deps: d, registered, unregistered } = deps();
  const session = await openAiSession(workspace() as never, d, new AbortController().signal);
  assert.ok(session);
  assert.equal(registered.length, 1);
  assert.ok(session.controller.getState().profiles.length > 0);
  assert.equal(session.controller.getState().error, null);
  session.close();
  assert.equal(unregistered(), 1);
});

test('without IndexedDB the chat lives in memory and the error says so', async () => {
  const { deps: d } = deps({ idbFails: true });
  const session = await openAiSession(workspace() as never, d, new AbortController().signal);
  assert.equal(session!.controller.getState().error, 'server');
});

test('aborted before it is ready: nothing registered, null', async () => {
  const { deps: d, registered } = deps();
  const abort = new AbortController();
  const pending = openAiSession(workspace() as never, d, abort.signal);
  abort.abort();
  assert.equal(await pending, null);
  assert.equal(registered.length, 0);
});
```

`src/elements/workspace/workspaceView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { WorkspaceState } from '../../workspace/workspace';
import { docKey, reopenPlan, shownMode, toastItems, toastTarget, unloadNeedsConfirm } from './workspaceView';

const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

test('AI mode without the controller shows the split view; the others stay', () => {
  assert.equal(shownMode('ai', false), 'split');
  assert.equal(shownMode('ai', true), 'ai');
  assert.equal(shownMode('preview', false), 'preview');
});

test('the document key follows path and revision (no document: undefined#undefined, as with React)', () => {
  assert.equal(docKey({ path: 'a.md', revision: 3 }), 'a.md#3');
  assert.equal(docKey(null), 'undefined#undefined');
});

test('toasts: the workspace ones keyed ws-<id>, then the AI error; dismissing goes back to the right owner', () => {
  const toasts = [{ id: 7, kind: 'info', code: 'saveAllDone' }] as unknown as WorkspaceState['toasts'];
  assert.deepEqual(toastItems(toasts, 'server', t), [
    { key: 'ws-7', kind: 'info', text: EN_MESSAGES['toast.saveAllDone'] },
    { key: 'ai-error', kind: 'error', text: EN_MESSAGES['ai.error.server'] },
  ]);
  assert.deepEqual(toastItems([], null, t), []);
  assert.deepEqual(toastTarget('ai-error'), { kind: 'ai' });
  assert.deepEqual(toastTarget('ws-7'), { kind: 'workspace', id: 7 });
});

test('beforeunload asks only when text is in memory, unless the protected update reload is ready', () => {
  const doc = (saveState: string) => ({ saveState }) as NonNullable<WorkspaceState['doc']>;
  assert.equal(unloadNeedsConfirm({ doc: doc('saved'), drafts: [], updateReady: false }, false), false);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: false }, false), true);
  assert.equal(unloadNeedsConfirm({ doc: null, drafts: ['a.md'], updateReady: false }, false), true);
  assert.equal(unloadNeedsConfirm({ doc: null, drafts: [], updateReady: false }, true), true);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: true }, false), false);
  assert.equal(unloadNeedsConfirm({ doc: doc('dirty'), drafts: [], updateReady: true }, true), true);
});

test('reopening the last file: open it if it is still there, otherwise only through its draft', () => {
  assert.deepEqual(reopenPlan(null, ['a.md']), { kind: 'none' });
  assert.deepEqual(reopenPlan('a.md', ['a.md']), { kind: 'open', path: 'a.md' });
  assert.deepEqual(reopenPlan('gone.md', ['a.md']), { kind: 'draft', path: 'gone.md' });
});
```

`src/elements/workspace/workspace.dom.test.ts` (uno `Workspace` vero su `memoryOps`, `localStorage` in memoria **prima** di importare `define` (le preferenze si leggono alla prima connessione), sessione AI e sync finte iniettate):

```ts
import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../../testing/memoryStorage';
const storage = installMemoryStorage();

import '../define';
import type { AiController } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { SyncBinding } from '../../ai/syncBinding';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { memoryOps } from '../../fs/testing/memoryOps';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createRouteStore, type RouteWindow } from '../../state/routeStore';
import { createThemeStore } from '../../state/themeStore';
import { installDialogStub } from '../../testing/dialogStub';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';
import { memoryBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';
import type { HmdWorkspace } from './workspace.element';

installDialogStub();
installPopoverStub();
window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom non ha ResizeObserver (l'anteprima lo usa per le ancore): basta che esista.
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });

test.afterEach(() => {
  document.body.replaceChildren();
  storage.clear();
});

/** Finestra finta della rotta: l'hash e i suoi listener. */
function routeWindow(): RouteWindow & { hashValue: string } {
  const listeners = new Set<() => void>();
  const win = {
    hashValue: '',
    hash: () => win.hashValue,
    pushState: (url: string) => void (win.hashValue = url.startsWith('#') ? url : ''),
    replaceState: (url: string) => void (win.hashValue = url.startsWith('#') ? url : ''),
    back: () => {
      win.hashValue = '';
      listeners.forEach((l) => l());
    },
    setHash: (hash: string) => {
      win.hashValue = hash;
      listeners.forEach((l) => l());
    },
    cleanUrl: () => '/',
    onHashChange: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
  };
  return win;
}

async function mount(options: { files?: Record<string, string>; ai?: boolean; lastFile?: string } = {}) {
  const ops = memoryOps();
  for (const [path, text] of Object.entries(options.files ?? { 'a.md': '# A', 'b.md': '# B' })) ops.setFile(path, text);
  const workspace = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: 'ws', name: 'notes', buffers: memoryBufferStore() });
  await workspace.load();
  if (options.lastFile) storage.set('housemd:lastFile:ws', JSON.stringify(options.lastFile));
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const win = routeWindow();
  const route = createRouteStore(win);
  const ai = fakeAi({ profiles: [defaultProfile()] }, defaultProfile());
  const documents: string[] = [];
  Object.assign(ai, {
    documentChanged: (path: string, _c: unknown, reset: boolean) => void documents.push(`${path}:${reset}`),
    hasPendingWork: () => false,
    clearError: () => {},
    reload: async () => {},
    store: { getMeta: async () => null, setMeta: async () => {} },
  });
  let closed = 0;
  const el = document.createElement('hmd-workspace') as HmdWorkspace;
  el.openAi = async () => (options.ai ? { controller: ai as unknown as AiController, close: () => void closed++ } : null);
  el.syncFor = () => ({ subscribe: () => () => {}, getState: () => ({ sync: null, handle: null, permission: false }), needsPermission: false, dispose() {} }) as unknown as SyncBinding;
  el.workspaceId = 'ws';
  el.handle = null;
  el.i18n = i18n;
  el.theme = theme;
  el.route = route;
  el.workspace = workspace;
  document.body.append(el);
  if (options.ai) await waitFor(() => !!el.querySelector('[aria-label="' + EN_MESSAGES['mode.ai'] + '"]'));
  const button = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return { el, workspace, ai, route, win, documents, button, closed: () => closed };
}

test('the same DOM as WorkspaceView.tsx with no file open: layout with sidebar, separator and main, then the toasts', async () => {
  const { el } = await mount();
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-toasts']);
  const layout = el.firstElementChild as HTMLElement;
  assert.equal(layout.className, 'layout');
  assert.equal(layout.style.gridTemplateColumns, '280px 5px minmax(0, 1fr)');
  assert.deepEqual([...layout.children].map((c) => `${c.localName}.${c.className}`), ['aside.sidebar', 'div.resizer', 'main.main']);
  const aside = layout.firstElementChild!;
  assert.deepEqual([...aside.children].map((c) => c.localName), ['div', 'hmd-search-panel', 'hmd-file-tree']);
  const main = layout.lastElementChild!;
  assert.deepEqual([...main.children].map((c) => `${c.localName}.${c.className}`), ['header.toolbar', 'div.empty']);
  const toolbar = main.firstElementChild!;
  assert.deepEqual([...toolbar.children].map((c) => c.className), ['lead', 'modes', 'actions']);
  assert.deepEqual([...toolbar.querySelectorAll('.modes button')].map((b) => b.getAttribute('aria-label')), [EN_MESSAGES['mode.editor'], EN_MESSAGES['mode.split'], EN_MESSAGES['mode.preview']]);
  assert.equal(toolbar.querySelector<HTMLButtonElement>(`button[aria-label="${EN_MESSAGES['toolbar.history']}"]`)!.disabled, true);
  assert.equal(document.title, 'HouseMD');
});

test('a file opened: split panes with the editor and the preview, the path, the title; preview only drops the editor', async () => {
  const { el, workspace, button } = await mount();
  await workspace.openFile('a.md');
  const panes = el.querySelector('.panes')!;
  assert.equal(panes.getAttribute('data-mode'), 'split');
  assert.deepEqual([...panes.children].map((c) => `${c.getAttribute('aria-label')}>${c.firstElementChild!.localName}`), [`${EN_MESSAGES['pane.editor']}>hmd-editor`, `${EN_MESSAGES['pane.preview']}>hmd-preview`]);
  assert.equal(el.querySelector('.path')!.textContent, 'a.md');
  assert.equal(document.title, 'HMD - a.md');
  const editor = panes.querySelector('hmd-editor');
  button(EN_MESSAGES['mode.preview']).click();
  assert.deepEqual([...panes.children].map((c) => c.firstElementChild!.localName), ['hmd-preview']);
  // Tornando alla vista divisa l'editor è un elemento nuovo, come quando React lo rimontava.
  button(EN_MESSAGES['mode.split']).click();
  assert.ok(panes.querySelector('hmd-editor') !== editor, 'a new editor');
  assert.equal(storage.get('housemd:mode'), '"split"');
});

test('the last file of the folder is reopened once', async () => {
  const { el } = await mount({ lastFile: 'b.md' });
  await waitFor(() => el.querySelector('.path')!.textContent === 'b.md');
});

test('the settings come from the route: on top of an inert layout, the title follows, closing brings the focus back', async () => {
  const { el, button, route } = await mount();
  const settingsButton = button(EN_MESSAGES['toolbar.settings']);
  settingsButton.focus();
  settingsButton.click();
  assert.deepEqual([...el.children].map((c) => c.localName), ['div', 'hmd-settings', 'hmd-toasts']);
  assert.equal((el.firstElementChild as HTMLElement).inert, true);
  assert.equal(document.title, `HMD - ${EN_MESSAGES['settings.title']}`);
  el.querySelector<HTMLButtonElement>('hmd-settings .navHeader button')!.click();
  assert.equal(route.getState().view, 'workspace');
  assert.equal(el.querySelector('hmd-settings'), null);
  assert.equal((el.firstElementChild as HTMLElement).inert, false);
  assert.ok(document.activeElement === settingsButton, 'focus back on the settings button');
});

test('shortcuts on the window: Ctrl+B toggles the sidebar and is remembered; detached, nothing listens', async () => {
  const { el } = await mount();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  assert.equal(el.querySelector('aside'), null);
  assert.equal((el.firstElementChild as HTMLElement).style.gridTemplateColumns, 'minmax(0, 1fr)');
  assert.equal(storage.get('housemd:sidebarOpen'), 'false');
  el.remove();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  assert.equal(storage.get('housemd:sidebarOpen'), 'false');
});

test('the separator: arrows resize the panel and save the width', async () => {
  const { el } = await mount();
  const separator = el.querySelector<HTMLElement>('[role="separator"]')!;
  assert.equal(separator.getAttribute('aria-valuenow'), '280');
  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(separator.getAttribute('aria-valuenow'), '296');
  assert.equal(storage.get('housemd:sidebarWidth'), '296');
});

test('beforeunload asks only with text in memory', async () => {
  const { workspace } = await mount();
  await workspace.openFile('a.md');
  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  assert.equal(clean.defaultPrevented, false);
  workspace.edit('# A changed');
  const dirty = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirty);
  assert.equal(dirty.defaultPrevented, true);
});

test('with the AI session: four modes, AI mode shows the AI sidebar and the review, the chat hears about the document', async () => {
  const { el, workspace, button, documents } = await mount({ ai: true });
  await workspace.openFile('a.md');
  assert.deepEqual(documents, ['a.md:true']);
  button(EN_MESSAGES['mode.ai']).click();
  assert.deepEqual([...el.querySelector('aside')!.children].map((c) => c.localName), ['hmd-ai-sidebar']);
  const review = el.querySelector('hmd-ai-review')!;
  assert.ok(review);
  // Un doc nuovo a ogni notifica dello workspace: la revisione rilegge canAccept (conflitto, aggiornamento).
  const before = review.doc;
  workspace.dismissToast(-1);
  workspace.edit('# A!');
  assert.ok(review.doc !== before, 'a new doc object');
});

test('detached: the AI session is closed and the title goes back to the app name', async () => {
  const { el, workspace, closed } = await mount({ ai: true });
  await workspace.openFile('a.md');
  el.remove();
  assert.equal(closed(), 1);
  assert.equal(document.title, 'HouseMD');
});
```

RED atteso: `Cannot find module './aiSession'` e `'./workspaceView'`; il test jsdom cade finché il tag non è definito.

- [ ] **Step 2: La sessione AI della cartella**

`src/elements/workspace/aiSession.ts`:

```ts
import { AiController, type AiWorkspace } from '../../ai/aiController';
import { createIdbAiStores } from '../../ai/idbStores';
import { createMemoryAiStores, type AiStores } from '../../ai/stores';
import { readPref } from '../../lib/prefs';
import { registerUpdateParticipant } from '../../pwa/updateHost';
import type { Workspace } from '../../workspace/workspace';

/** Quello che la sessione AI usa dello workspace. */
export type AiSessionWorkspace = Pick<Workspace, 'getState' | 'snapshotBeforeAi' | 'openFile'>;

/** Archivi e registrazione: iniettati, così la sessione si prova senza IndexedDB. */
export interface AiSessionDeps {
  idbStores(): Promise<AiStores>;
  memoryStores(): AiStores;
  /** Profilo scelto l'ultima volta (preferenza `aiProfile`). */
  savedProfile(): string | undefined;
  /** Registra il controller nel flusso di aggiornamento della PWA; restituisce come toglierlo. */
  register(controller: AiController): () => void;
}

/** Il documento aperto visto dal controller AI (era il `binding` di useAiController). */
export function aiWorkspace(workspace: AiSessionWorkspace): AiWorkspace {
  return {
    getDoc: () => {
      const s = workspace.getState();
      return s.doc ? { path: s.doc.path, textLf: s.doc.text, conflict: s.doc.conflict, updating: s.updating } : null;
    },
    snapshotBeforeAi: () => workspace.snapshotBeforeAi(),
    openFile: (path) => workspace.openFile(path),
  };
}

/**
 * Una sessione AI per cartella (era `useAiController`): il controller su IndexedDB, o in memoria se
 * IndexedDB non c'è (con l'errore `server`). Se `signal` si interrompe prima che sia pronto il
 * controller si butta e la Promise dà null; pronto, si registra nel flusso di aggiornamento. Chi lo
 * riceve lo chiude con `close` (toglie la registrazione e lo elimina).
 */
export async function openAiSession(workspace: AiSessionWorkspace, deps: AiSessionDeps, signal: AbortSignal): Promise<{ controller: AiController; close(): void } | null> {
  const binding = aiWorkspace(workspace);
  let controller: AiController | null = null;
  try {
    controller = new AiController(await deps.idbStores(), binding);
    await controller.initialize(deps.savedProfile());
  } catch {
    controller?.dispose();
    controller = new AiController(deps.memoryStores(), binding);
    await controller.initialize();
    controller.report({ code: 'server' });
  }
  if (signal.aborted) {
    controller.dispose();
    return null;
  }
  const unregister = deps.register(controller);
  const ready = controller;
  return {
    controller: ready,
    close() {
      unregister();
      ready.dispose();
    },
  };
}

/** La sessione AI del browser: IndexedDB, profilo salvato, flusso di aggiornamento della PWA. */
export const browserAiSessionDeps: AiSessionDeps = {
  idbStores: () => createIdbAiStores(),
  memoryStores: () => createMemoryAiStores(),
  savedProfile: () => readPref('aiProfile'),
  register: (controller) => registerUpdateParticipant(controller),
};
```

- [ ] **Step 3: I calcoli della vista**

`src/elements/workspace/workspaceView.ts`:

```ts
import type { AiErrorCode } from '../../ai/types';
import type { MessageKey } from '../../i18n/messages';
import type { Params } from '../../i18n/i18n';
import type { WorkspaceState } from '../../workspace/workspace';
import type { ToastItem } from '../toasts/toasts.element';
import type { Mode } from './layout';

/** La vista mostrata: con la preferenza «AI» ma il controller non ancora pronto (IndexedDB lento), la divisa. */
export function shownMode(mode: Mode, hasAi: boolean): Mode {
  return mode === 'ai' && !hasAi ? 'split' : mode;
}

/** Chiave della sessione dell'editor e del `resetKey`: cambia con il file o con una revisione nuova. */
export function docKey(doc: Pick<NonNullable<WorkspaceState['doc']>, 'path' | 'revision'> | null): string {
  return `${doc?.path}#${doc?.revision}`;
}

/** Toast del workspace più l'errore AI non legato a un messaggio (sync, chiave, selezione persa), nello stesso contenitore. */
export function toastItems(toasts: WorkspaceState['toasts'], aiError: AiErrorCode | null | undefined, t: (key: MessageKey, params?: Params) => string): ToastItem[] {
  return [
    ...toasts.map((toast) => ({ key: `ws-${toast.id}`, kind: toast.kind, text: t(`toast.${toast.code}` as MessageKey, toast.params) })),
    ...(aiError ? [{ key: 'ai-error', kind: 'error' as const, text: t(`ai.error.${aiError}` as MessageKey) }] : []),
  ];
}

/** Chiusura di un toast: l'errore AI si toglie dal controller, gli altri dallo workspace. */
export function toastTarget(key: string): { kind: 'ai' } | { kind: 'workspace'; id: number } {
  return key === 'ai-error' ? { kind: 'ai' } : { kind: 'workspace', id: Number(key.slice('ws-'.length)) };
}

/**
 * `beforeunload`: chiedere conferma (e intanto mettere al sicuro con `blur`) se il testo è solo in memoria.
 * Il reload protetto dell'aggiornamento PWA passa senza domanda quando tutto è già durevole: annullarlo
 * lascerebbe l'app in sola lettura; mentre il documento si mette ancora al sicuro l'avviso resta.
 */
export function unloadNeedsConfirm(state: Pick<WorkspaceState, 'doc' | 'drafts' | 'updateReady'>, aiPending: boolean): boolean {
  if (state.updateReady && !aiPending) return false;
  return (!!state.doc && state.doc.saveState !== 'saved') || state.drafts.length > 0 || aiPending;
}

/**
 * Riapertura dell'ultimo file della cartella, una volta a cartella pronta: il file se c'è ancora, altrimenti
 * (`draft`) solo se ha una bozza nel buffer di emergenza, unica strada per recuperarla.
 */
export function reopenPlan(last: string | null, files: readonly string[]): { kind: 'none' } | { kind: 'open'; path: string } | { kind: 'draft'; path: string } {
  if (!last) return { kind: 'none' };
  return files.includes(last) ? { kind: 'open', path: last } : { kind: 'draft', path: last };
}
```

- [ ] **Step 4: L'evento**

`src/elements/events.ts`, in fondo (dopo `hmd-toast-dismiss`):

```ts
  /** Workspace: cambiare cartella (pulsante con il nome della cartella nella sidebar). */
  'hmd-workspace-change-folder': CustomEvent<null>;
```

- [ ] **Step 5: `hmd-workspace` e il suo foglio**

Punti da rispettare (tutti misurati nel prototipo):

- **Figli condizionali come React** (`#slot`, decisione 8): `aside` e separatore con la sidebar aperta; nella sidebar `hmd-ai-sidebar` in modalità AI, altrimenti testata, ricerca, orfane (solo se ce ne sono) e albero, dimenticati passando all'AI e ricreati tornando; nel documento `hmd-ai-review` | `div.panes` (editor se non sola anteprima; cronologia **per file**, un pannello nuovo quando cambia il percorso; anteprima se non solo editor) | `div.empty`; `hmd-conflict-bar` con il conflitto; `hmd-settings` con la rotta.
- **Proprietà prima dell'inserimento e solo se cambiano** (`assign`), salvo il `doc` di `hmd-ai-review`, nuovo a ogni render (decisione 9: è quello che fa spegnere gli «accetta» dei blocchi durante un conflitto).
- **Effetti di React dentro il render, nello stesso ordine**: sessione dell'editor e selezione AI per `path#revision` (e `ai.documentChanged(path, …, true)` **solo** quando cambia la chiave, come l'effetto `[path, revision]`: un controller arrivato dopo non lo riceve); cronologia chiusa senza documento; `writeLastFile`; bozze orfane (richieste scartate se superate); riapertura dell'ultimo file una volta (in un microtask); dialog dell'accesso perso (in un microtask, chiuso quando lo stato cambia o al distacco); titolo della scheda (e `APP_TITLE` al distacco); focus restituito all'elemento di prima chiudendo le impostazioni (dopo aver tolto `inert`); ripristino in coda dalla sola anteprima (in un microtask, solo se il file è ancora quello).
- **Listener della finestra con il `signal`**: `focus`, `blur`, `visibilitychange`, `beforeunload` (`unloadNeedsConfirm`), `keydown` (scorciatoie con lo stato del momento; Ctrl+K apre la sidebar e mette il focus nella ricerca al fotogramma dopo).
- **Separatore**: `pointerdown` con `setPointerCapture`, `pointermove`/`pointerup`/`pointercancel`/`lostpointercapture` legati a un `AbortController` della trascinata; frecce con `resizeByKey`; larghezze separate per albero e AI, salvate.
- **Sessione AI**: aperta alla prima connessione con un `AbortController` suo (non il `signal` di `connect`, che si interrompe anche al `reconnect()`), chiusa in `disconnectedCallback` con la sync; pronta, si ascolta con il `signal` del momento.
- **Toast**: un array nuovo solo quando cambiano toast, errore AI o lingua (decisione 10).

`src/elements/workspace/workspace.element.ts`:

```ts
import type { ChangeDesc } from '@codemirror/state';
import { match } from 'ts-pattern';

import type { AiController } from '../../ai/aiController';
import { sameRange, type TextRange } from '../../ai/selectionChip';
import { browserSyncBinding, type SyncBinding } from '../../ai/syncBinding';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import { createDocSession, type DocSession } from '../../editor/docSession';
import { requestAccess } from '../../fs/access';
import { APP_TITLE, pageTitle } from '../../lib/pageTitle';
import { readLastFile, readPref, readValidPref, writeLastFile, writePref } from '../../lib/prefs';
import type { SettingsSection } from '../../lib/route';
import { parseTextWidth, textWidthVars, type TextWidth } from '../../lib/textWidth';
import type { I18nStore } from '../../state/i18nStore';
import type { RouteStore } from '../../state/routeStore';
import type { ThemeStore } from '../../state/themeStore';
import type { IconName } from '../../ui/icons';
import { shortcutFor } from '../../ui/shortcuts';
import { buildTree, type TreeNode } from '../../ui/tree';
import type { Workspace, WorkspaceState } from '../../workspace/workspace';
import type { HmdAiReview } from '../ai/review.element';
import type { HmdAiSidebar } from '../ai/sidebar.element';
import type { HmdConflictBar } from '../conflict-bar/conflict-bar.element';
import { showAccessLostDialog } from '../dialogs/accessLostDialog';
import type { HmdEditor } from '../editor/editor.element';
import { emit } from '../events';
import type { HmdFileTree } from '../file-tree/file-tree.element';
import type { HmdHistoryPanel } from '../history-panel/history-panel.element';
import type { HmdPreview } from '../preview/preview.element';
import type { HmdSearchPanel } from '../search-panel/search-panel.element';
import type { HmdSettings } from '../settings/settings.element';
import type { HmdToasts } from '../toasts/toasts.element';
import { openAiSession, browserAiSessionDeps, type AiSessionWorkspace } from './aiSession';
import { dialogFor, type TreeAction } from './dialogFor';
import { allowedInSettings } from './keymap';
import { clampWidth, gridColumns, MODES, nextPaneMode, PANE_MODES, panesMode, resizeByKey, sidePanel, WIDTH_LIMITS, type Mode, type PaneMode } from './layout';
import { saveIndicator } from './saveIndicator';
import { runTreeDialog } from './treeDialogs';
import { docKey, reopenPlan, shownMode, toastItems, toastTarget, unloadNeedsConfirm } from './workspaceView';
import './workspace.css';

/** Apre la sessione AI di una cartella (iniettabile nei test: IndexedDB in jsdom non c'è). */
export type OpenAiSession = (workspace: AiSessionWorkspace, signal: AbortSignal) => Promise<{ controller: AiController; close(): void } | null>;

const NO_TERMS: string[] = [];

interface Parts {
  layout: HTMLDivElement;
  main: HTMLElement;
  toggle: HTMLButtonElement;
  path: HTMLSpanElement;
  modes: HTMLDivElement;
  modeButtons: Map<Mode, HTMLButtonElement>;
  saveState: HTMLSpanElement;
  saveText: Text;
  history: HTMLButtonElement;
  saveAll: HTMLButtonElement;
  settings: HTMLButtonElement;
  toolbar: HTMLElement;
  toasts: HmdToasts;
}

/** Nodi che compaiono e spariscono con lo stato (come i rami condizionali di WorkspaceView.tsx): ricreati a ogni ricomparsa. */
interface Slots {
  aside: HTMLElement;
  resizer: HTMLDivElement;
  aiSidebar: HmdAiSidebar;
  treeHeader: HTMLDivElement;
  search: HmdSearchPanel;
  orphans: HTMLElement;
  tree: HmdFileTree;
  conflict: HmdConflictBar;
  review: HmdAiReview;
  panes: HTMLDivElement;
  editorPane: HTMLElement;
  historyPane: HTMLElement;
  previewPane: HTMLElement;
  empty: HTMLDivElement;
  settings: HmdSettings;
  draftIcon: HTMLSpanElement;
}

/** Togli i figli non voluti e inserisci i mancanti nell'ordine dato, senza spostare quelli già al loro posto. */
function place(parent: Element, wanted: readonly Element[]): void {
  for (const child of [...parent.children]) if (!wanted.includes(child)) child.remove();
  let cursor: Element | null = parent.firstElementChild;
  for (const node of wanted) {
    if (node === cursor) cursor = cursor.nextElementSibling;
    else parent.insertBefore(node, cursor);
  }
}

/** Assegna una proprietà solo se cambia (i setter dei figli possono riconciliare tutto). */
function assign<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  if (target[key] !== value) target[key] = value;
}

/**
 * Area di lavoro di una cartella (era WorkspaceView.tsx): griglia con il pannello a sinistra (albero, ricerca,
 * bozze orfane o, in modalità AI, la chat) e il separatore ridimensionabile, la barra degli strumenti, il
 * documento (editor, anteprima, cronologia o revisione AI), le impostazioni sopra (dalla rotta) e i toast.
 * Crea la sessione AI della cartella e la sync, riapre l'ultimo file, elenca le bozze orfane, gestisce le
 * scorciatoie globali e i listener della finestra (tutti legati al `signal`), il dialog dell'accesso perso e
 * il titolo della scheda. Verso fuori manda solo `hmd-workspace-change-folder`.
 */
export class HmdWorkspace extends HmdElement {
  #workspace: Workspace | null = null;
  #workspaceId = '';
  #handle: FileSystemDirectoryHandle | null = null;
  #switchingFolder = false;
  #i18n: I18nStore | null = null;
  #theme: ThemeStore | null = null;
  #route: RouteStore | null = null;
  #openAi: OpenAiSession = (workspace, signal) => openAiSession(workspace, browserAiSessionDeps, signal);
  #syncFor: (controller: AiController) => SyncBinding = browserSyncBinding;

  #parts: Parts | null = null;
  #slots: Partial<Slots> = {};
  #signal: AbortSignal | null = null;
  // Stato della vista (era lo stato di React), letto dalle preferenze alla prima connessione.
  #mode: Mode = 'split';
  #lastPane: PaneMode = 'split';
  #sidebarOpen = true;
  #sidebarWidth = WIDTH_LIMITS.sidebar.initial;
  #aiWidth = WIDTH_LIMITS.ai.initial;
  #textWidth: TextWidth = { editor: null, preview: null };
  #highlight: string[] = NO_TERMS;
  #historyOpen = false;
  #historyPath = '';
  #queuedRestore: { id: number; path: string } | null = null;
  #aiSelection: TextRange | null = null;
  #orphans: string[] = [];
  #orphanNodes = new Map<string, HTMLButtonElement>();
  #orphanKey: unknown[] = [];
  #orphanRequest = 0;
  #reopened = false;
  #docKey = '';
  #session: DocSession = createDocSession('undefined#undefined', '');
  #lastFile: string | null = null;
  #settingsWasOpen = false;
  #focusBeforeSettings: HTMLElement | null = null;
  #memo: { entries?: WorkspaceState['entries']; locale?: string; tree?: TreeNode[]; files?: string[]; drafts?: readonly string[]; draftSet?: ReadonlySet<string> } = {};
  #toastKey: unknown[] = [];
  // Sessione AI e sync: vivono con l'elemento collegato.
  #ai: AiController | null = null;
  #aiSession: { close(): void } | null = null;
  #aiAbort: AbortController | null = null;
  #sync: SyncBinding | null = null;
  #accessLost: AbortController | null = null;
  #dialogs: AbortController | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#workspace && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#parts!, this.#workspace!, this.#i18n!),
  });

  get workspace(): Workspace | null { return this.#workspace; }
  set workspace(value: Workspace | null) {
    value ??= null;
    if (value === this.#workspace) return;
    this.#workspace = value;
    this.reconnect();
  }
  get workspaceId(): string { return this.#workspaceId; }
  set workspaceId(value: string) { this.#workspaceId = value ?? ''; }
  get handle(): FileSystemDirectoryHandle | null { return this.#handle; }
  set handle(value: FileSystemDirectoryHandle | null) { this.#handle = value ?? null; }
  get switchingFolder(): boolean { return this.#switchingFolder; }
  set switchingFolder(value: boolean) {
    value = !!value;
    if (value === this.#switchingFolder) return;
    this.#switchingFolder = value;
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) {
    value ??= null;
    if (value === this.#theme) return;
    this.#theme = value;
    this.#loop.update();
  }
  get route(): RouteStore | null { return this.#route; }
  set route(value: RouteStore | null) {
    value ??= null;
    if (value === this.#route) return;
    this.#route = value;
    this.reconnect();
  }
  /** Solo per i test: come si apre la sessione AI e come si crea la sync. */
  set openAi(value: OpenAiSession) { this.#openAi = value; }
  set syncFor(value: (controller: AiController) => SyncBinding) { this.#syncFor = value; }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      this.#mode = readPref('mode');
      this.#lastPane = this.#mode === 'ai' ? 'split' : this.#mode;
      this.#sidebarOpen = readPref('sidebarOpen');
      this.#sidebarWidth = clampWidth('sidebar', readPref('sidebarWidth'));
      this.#aiWidth = clampWidth('ai', readPref('aiSidebarWidth'));
      this.#textWidth = readValidPref('textWidth', parseTextWidth);
      this.#applyTextWidth();
      this.#parts = this.#build();
      this.append(this.#parts.layout, this.#parts.toasts);
    }
    this.#signal = signal;
    this.#dialogs ??= new AbortController();
    const { workspace, i18n, route } = { workspace: this.#workspace, i18n: this.#i18n, route: this.#route };
    if (!workspace || !i18n || !route) return;
    this.#startAi(workspace);
    route.setGuard({ canLeave: () => !this.#slots.settings?.dirty, onBlocked: () => this.#slots.settings?.requestClose() });
    this.#listen(workspace, signal);
    this.watch(workspace, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
    this.watch(route, () => this.#loop.update(), signal);
    if (this.#ai) this.watch(this.#ai, () => this.#loop.update(), signal);
    if (this.#sync) this.watch(this.#sync, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#signal = null;
    this.#route?.setGuard({ canLeave: () => true, onBlocked: () => {} });
    this.#accessLost?.abort();
    this.#accessLost = null;
    this.#dialogs?.abort();
    this.#dialogs = null;
    this.#aiAbort?.abort();
    this.#aiAbort = null;
    this.#sync?.dispose();
    this.#sync = null;
    this.#aiSession?.close();
    this.#aiSession = null;
    this.#ai = null;
    // Tornando alla schermata iniziale il titolo è quello dell'app.
    document.title = APP_TITLE;
  }

  /** Una sessione AI per cartella: pronta, si ascolta con il signal del momento e porta con sé la sync. */
  #startAi(workspace: Workspace): void {
    if (this.#aiAbort) return;
    const abort = (this.#aiAbort = new AbortController());
    void this.#openAi(workspace, abort.signal).then((session) => {
      if (!session) return;
      if (abort.signal.aborted) return session.close();
      this.#aiSession = session;
      this.#ai = session.controller;
      this.#sync = this.#syncFor(session.controller);
      const signal = this.#signal;
      if (signal) {
        this.watch(session.controller, () => this.#loop.update(), signal);
        this.watch(this.#sync, () => this.#loop.update(), signal);
      }
    });
  }

  /** Listener della finestra e del documento, legati al `signal`. */
  #listen(workspace: Workspace, signal: AbortSignal): void {
    const onFocus = () => void workspace.checkExternal();
    const onBlur = () => void workspace.blur();
    window.addEventListener('focus', onFocus, { signal });
    window.addEventListener('blur', onBlur, { signal });
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? onFocus() : onBlur()), { signal });
    window.addEventListener(
      'beforeunload',
      (event) => {
        if (!unloadNeedsConfirm(workspace.getState(), !!this.#ai?.hasPendingWork())) return;
        void workspace.blur();
        event.preventDefault();
      },
      { signal },
    );
    window.addEventListener('keydown', (event) => this.#onKey(event, workspace), { signal });
  }

  get #settingsOpen(): boolean {
    return this.#route?.getState().view === 'settings';
  }

  get #shown(): Mode {
    return shownMode(this.#mode, !!this.#ai);
  }

  /** Scorciatoie globali: vedi src/ui/shortcuts.ts. */
  #onKey(event: KeyboardEvent, workspace: Workspace): void {
    const shown = this.#shown;
    const settingsOpen = this.#settingsOpen;
    if (event.key === 'Escape' && shown === 'ai' && !settingsOpen) this.#ai?.stop();
    // Già gestito dall'editor (Ctrl+B è il grassetto lì, la barra laterale altrove).
    if (event.defaultPrevented) return;
    const shortcut = shortcutFor(event);
    if (!shortcut) return;
    // Con le impostazioni aperte restano solo i salvataggi (altrimenti Ctrl+S apre "Salva pagina").
    if (settingsOpen && !allowedInSettings(shortcut)) return;
    event.preventDefault();
    match(shortcut)
      .with('save', () => void workspace.saveNow())
      .with('saveAll', () => void workspace.saveAll())
      .with('search', () => {
        if (shown === 'ai') this.#changeMode(this.#lastPane);
        this.#setSidebar(true);
        requestAnimationFrame(() => this.#slots.search?.focusInput());
      })
      .with('toggleAi', () => {
        if (this.#ai) this.#changeMode(shown === 'ai' ? this.#lastPane : 'ai');
      })
      .with('toggleSidebar', () => this.#setSidebar(!this.#sidebarOpen))
      .with('cycleMode', () => this.#changeMode(nextPaneMode(shown)))
      .exhaustive();
  }

  #setSidebar(open: boolean): void {
    this.#sidebarOpen = open;
    writePref('sidebarOpen', open);
    this.#loop.update();
  }

  #changeMode(next: Mode): void {
    if (next !== 'ai') this.#lastPane = next;
    // La chat sta nella sidebar: entrando in AI la si apre.
    else this.#setSidebar(true);
    this.#mode = next;
    writePref('mode', next);
    this.#loop.update();
  }

  #openFile(path: string, terms: string[] = NO_TERMS): Promise<void> {
    this.#highlight = terms;
    this.#loop.update();
    return this.#workspace!.openFile(path);
  }

  #openSettings(section: SettingsSection = 'general'): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) this.#focusBeforeSettings = active;
    this.#route?.navigate({ view: 'settings', section });
  }

  // Il ripristino deve passare dall'editor come transazione (annullabile con Ctrl+Z): in sola anteprima
  // l'editor non c'è, quindi si passa alla vista affiancata e si ripristina solo dopo.
  #restoreVersion(id: number): void {
    const workspace = this.#workspace!;
    const path = workspace.getState().doc?.path;
    if (!path) return;
    if (this.#shown !== 'preview') return void workspace.restoreVersion(id);
    this.#queuedRestore = { id, path };
    this.#changeMode('split');
  }

  #onTreeAction(action: TreeAction, node: TreeNode | null): void {
    const workspace = this.#workspace!;
    const t = this.#i18n!.t;
    match(dialogFor(action, node))
      .with({ kind: 'history' }, ({ path }) => {
        // La cronologia si apre solo se il file richiesto è davvero quello aperto.
        void this.#openFile(path).then(() => {
          if (workspace.getState().doc?.path !== path) return;
          this.#historyOpen = true;
          this.#loop.update();
        });
      })
      .with({ kind: 'dialog' }, ({ dialog }) => {
        const signal = this.#dialogs?.signal;
        if (signal) void runTreeDialog(dialog, { t, signal, paths: () => workspace.getState().entries.map((e) => e.path), workspace });
      })
      .with({ kind: 'none' }, () => {})
      .exhaustive();
  }

  #onResizeStart(event: PointerEvent): void {
    const target = event.currentTarget as HTMLDivElement;
    target.setPointerCapture(event.pointerId);
    const panel = sidePanel(this.#shown);
    let width = panel === 'ai' ? this.#aiWidth : this.#sidebarWidth;
    const done = new AbortController();
    const move = (e: PointerEvent) => {
      width = clampWidth(panel, e.clientX);
      if (panel === 'ai') this.#aiWidth = width;
      else this.#sidebarWidth = width;
      this.#loop.update();
    };
    const up = () => {
      done.abort();
      writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', width);
    };
    target.addEventListener('pointermove', move, { signal: done.signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) target.addEventListener(type, up, { signal: done.signal });
  }

  #onResizeKey(event: KeyboardEvent): void {
    const panel = sidePanel(this.#shown);
    const next = resizeByKey(panel, panel === 'ai' ? this.#aiWidth : this.#sidebarWidth, event.key);
    if (next === null) return;
    event.preventDefault();
    if (panel === 'ai') this.#aiWidth = next;
    else this.#sidebarWidth = next;
    writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', next);
    this.#loop.update();
  }

  #applyTextWidth(): void {
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(textWidthVars(this.#textWidth))) root.setProperty(name, value);
  }

  #build(): Parts {
    const modeButtons = new Map(
      MODES.map((m) => [m.id, el('button', { class: 'mode tooltip', on: { click: () => this.#changeMode(m.id) } }, icon(m.icon))] as const),
    );
    const saveText = document.createTextNode('');
    const parts: Parts = {
      layout: el('div', { class: 'layout' }),
      main: el('main', { class: 'main' }),
      toggle: el('button', { class: 'iconButton tooltip', on: { click: () => this.#setSidebar(!this.#sidebarOpen) } }, icon('sidebarOpen')),
      path: el('span', { class: 'path' }),
      modes: el('div', { class: 'modes', role: 'group' }),
      modeButtons,
      saveState: el('span', { class: 'saveState' }, saveText),
      saveText,
      history: el(
        'button',
        {
          class: 'iconButton tooltip',
          on: {
            click: () => {
              const ai = this.#shown === 'ai';
              if (ai) this.#changeMode(this.#lastPane);
              this.#historyOpen = ai ? true : !this.#historyOpen;
              this.#loop.update();
            },
          },
        },
        icon('history'),
      ),
      saveAll: el('button', { class: 'iconButton tooltip', on: { click: () => void this.#workspace?.saveAll() } }, icon('save')),
      settings: el('button', { class: 'iconButton tooltip', on: { click: () => this.#openSettings() } }, icon('settings')),
      toolbar: el('header', { class: 'toolbar' }),
      toasts: el('hmd-toasts', {
        on: {
          'hmd-toast-dismiss': (event) => {
            const target = toastTarget(event.detail.key);
            if (target.kind === 'ai') this.#ai?.clearError();
            else this.#workspace?.dismissToast(target.id);
          },
        },
      }),
    };
    const themeSwitcher = el('hmd-theme-switcher');
    themeSwitcher.store = this.#theme;
    themeSwitcher.i18n = this.#i18n;
    parts.toolbar.append(
      el('div', { class: 'lead' }, parts.toggle, parts.path),
      parts.modes,
      el('div', { class: 'actions' }, parts.saveState, parts.history, parts.saveAll, themeSwitcher, parts.settings),
    );
    parts.main.append(parts.toolbar);
    return parts;
  }

  /** Un nodo condizionale: creato quando serve, dimenticato quando non serve più (alla ricomparsa è nuovo, come con React). */
  #slot<K extends keyof Slots>(name: K, show: boolean, create: () => Slots[K]): Slots[K] | null {
    if (!show) {
      delete this.#slots[name];
      return null;
    }
    return (this.#slots[name] ??= create());
  }

  #createReview(): HmdAiReview {
    return el('hmd-ai-review');
  }

  #createEditor(): HmdEditor {
    return el('hmd-editor', {
      on: {
        'hmd-doc-change': (event) => this.#docChanged(event.detail.changes, event.detail),
        'hmd-selection': (event) => this.#onSelection(event.detail.range),
        'hmd-top-line': (event) => {
          if (this.#shown === 'split') this.#slots.previewPane?.querySelector('hmd-preview')?.scrollToLine(event.detail.line);
        },
      },
    });
  }

  #onSelection(range: TextRange | null): void {
    // Scatta a ogni movimento del cursore: si aggiorna solo se il tratto cambia.
    if (sameRange(this.#aiSelection, range)) return;
    this.#aiSelection = range;
    this.#loop.update();
  }

  #render(parts: Parts, workspace: Workspace, i18n: I18nStore): void {
    const t = i18n.t;
    const state = workspace.getState();
    const doc = state.doc;
    const ai = this.#ai;
    const aiState = ai?.getState() ?? null;
    const shown = this.#shown;
    const settingsOpen = this.#settingsOpen;
    const theme = this.#theme!;

    // Effetti di React, nell'ordine: sessione e selezione per documento, chat AI avvisata, bozze, ultimo file.
    const key = docKey(doc);
    if (key !== this.#docKey) {
      this.#docKey = key;
      this.#session = createDocSession(key, doc?.text || '');
      this.#aiSelection = null;
      if (doc) ai?.documentChanged(doc.path, { iterChangedRanges: () => {}, mapPos: (n: number) => n } as never, true);
    }
    if (!doc) this.#historyOpen = false;
    if (doc && doc.path !== this.#lastFile) writeLastFile(this.#workspaceId, doc.path);
    this.#lastFile = doc?.path ?? this.#lastFile;
    this.#watchOrphans(workspace, state);
    this.#reopen(workspace, state);
    this.#watchAccess(workspace, state, i18n);
    document.title = pageTitle({ settings: settingsOpen, filePath: doc?.path }, t('settings.title'));

    // Griglia, pannello e separatore.
    const panel = sidePanel(shown);
    const width = shown === 'ai' ? this.#aiWidth : this.#sidebarWidth;
    parts.layout.inert = settingsOpen;
    const columns = gridColumns(this.#sidebarOpen, width);
    if (parts.layout.style.gridTemplateColumns !== columns) parts.layout.style.gridTemplateColumns = columns;
    const aside = this.#slot('aside', this.#sidebarOpen, () => el('aside', { class: 'sidebar' }));
    const resizer = this.#slot('resizer', this.#sidebarOpen, () =>
      el('div', {
        class: 'resizer',
        role: 'separator',
        'aria-orientation': 'vertical',
        tabIndex: 0,
        on: { pointerdown: (event) => this.#onResizeStart(event), keydown: (event) => this.#onResizeKey(event) },
      }),
    );
    if (aside) this.#renderSidebar(aside, workspace, state, i18n);
    else for (const name of ['aiSidebar', 'treeHeader', 'search', 'orphans', 'tree'] as const) delete this.#slots[name];
    if (resizer) {
      toggleAttr(resizer, 'aria-label', true, t('sidebar.resize'));
      toggleAttr(resizer, 'aria-valuenow', true, String(width));
      toggleAttr(resizer, 'aria-valuemin', true, String(WIDTH_LIMITS[panel].min));
      toggleAttr(resizer, 'aria-valuemax', true, String(WIDTH_LIMITS[panel].max));
    }
    place(parts.layout, [...(aside && resizer ? [aside, resizer] : []), parts.main]);

    // Barra degli strumenti.
    const sidebarLabel = this.#sidebarOpen ? t('sidebar.hide') : t('sidebar.show');
    toggleAttr(parts.toggle, 'aria-pressed', true, String(this.#sidebarOpen));
    toggleAttr(parts.toggle, 'aria-label', true, sidebarLabel);
    toggleAttr(parts.toggle, 'data-tooltip', true, sidebarLabel);
    const toggleIcon: IconName = this.#sidebarOpen ? 'sidebarClose' : 'sidebarOpen';
    if (parts.toggle.dataset.icon !== toggleIcon) {
      parts.toggle.replaceChildren(icon(toggleIcon));
      parts.toggle.dataset.icon = toggleIcon;
    }
    setText(parts.path, doc?.path ?? t('toolbar.noFile'));
    toggleAttr(parts.modes, 'aria-label', true, t('toolbar.modes'));
    const modes = ai ? MODES : PANE_MODES;
    for (const m of modes) {
      const button = parts.modeButtons.get(m.id)!;
      toggleAttr(button, 'aria-pressed', true, String(shown === m.id));
      toggleAttr(button, 'aria-label', true, t(m.label));
      toggleAttr(button, 'data-tooltip', true, t(m.label));
    }
    place(parts.modes, modes.map((m) => parts.modeButtons.get(m.id)!));
    const indicator = saveIndicator(doc);
    toggleAttr(parts.saveState, 'data-state', true, indicator.state);
    toggleAttr(parts.saveState, 'aria-live', true, indicator.live);
    toggleAttr(parts.saveState, 'role', !!indicator.role, indicator.role ?? '');
    const draftIcon = this.#slot('draftIcon', indicator.draftIcon, () => icon('draft', { size: 10 }));
    if (draftIcon && draftIcon.parentNode !== parts.saveState) parts.saveState.prepend(draftIcon);
    for (const child of [...parts.saveState.children]) if (child !== draftIcon) child.remove();
    setText(parts.saveText, indicator.label ? t(indicator.label) : '');
    toggleAttr(parts.history, 'aria-pressed', true, String(shown !== 'ai' && this.#historyOpen));
    parts.history.disabled = !doc;
    toggleAttr(parts.history, 'aria-label', true, t('toolbar.history'));
    toggleAttr(parts.history, 'data-tooltip', true, t('toolbar.history'));
    toggleAttr(parts.saveAll, 'aria-label', true, t('toolbar.saveAll'));
    toggleAttr(parts.saveAll, 'data-tooltip', true, t('toolbar.saveAll'));
    toggleAttr(parts.settings, 'aria-label', true, t('toolbar.settings'));
    toggleAttr(parts.settings, 'data-tooltip', true, t('toolbar.settings'));
    const themeSwitcher = parts.toolbar.querySelector('hmd-theme-switcher')!;
    assign(themeSwitcher, 'store', theme);
    assign(themeSwitcher, 'i18n', i18n);

    // Conflitto e documento.
    const conflict = this.#slot('conflict', !!doc?.conflict, () =>
      el('hmd-conflict-bar', { on: { 'hmd-conflict': (event) => void this.#workspace?.resolveConflict(event.detail.choice) } }),
    );
    if (conflict) assign(conflict, 'i18n', i18n);
    const review = this.#slot('review', !!doc && shown === 'ai' && !!ai, () => this.#createReview());
    const panes = this.#slot('panes', !!doc && !review, () => el('div', { class: 'panes' }));
    const empty = this.#slot('empty', !doc, () =>
      el('div', { class: 'empty' }, el('p'), el('button', { class: 'primary', on: { click: () => this.#onTreeAction('new-file', null) } })),
    );
    if (review && doc && ai) this.#renderReview(review, state, ai, i18n);
    if (panes && doc) this.#renderPanes(panes, workspace, state, i18n);
    else for (const name of ['editorPane', 'historyPane', 'previewPane'] as const) delete this.#slots[name];
    if (empty) {
      setText(empty.firstElementChild!, t('empty.hint'));
      setText(empty.lastElementChild!, t('file.new'));
    }
    place(parts.main, [parts.toolbar, ...(conflict ? [conflict] : []), (review ?? panes ?? empty)!]);

    // Impostazioni sopra l'area di lavoro, e i toast.
    const settings = this.#slot('settings', settingsOpen, () => this.#createSettings());
    if (settings) this.#renderSettings(settings, state, i18n);
    place(this, [parts.layout, ...(settings ? [settings] : []), parts.toasts]);
    assign(parts.toasts, 'i18n', i18n);
    // Un array nuovo solo quando cambiano toast, errore AI o lingua (lo useMemo di React): i toast riavviano i timer a ogni array.
    const toastKey = [state.toasts, aiState?.error, i18n.getState()];
    if (!toastKey.every((v, i) => v === this.#toastKey[i])) {
      this.#toastKey = toastKey;
      parts.toasts.items = toastItems(state.toasts, aiState?.error, t);
    }

    // Chiuse le impostazioni, il focus torna dove era prima di aprirle.
    if (this.#settingsWasOpen && !settingsOpen) {
      const previous = this.#focusBeforeSettings;
      this.#focusBeforeSettings = null;
      if (previous?.isConnected) previous.focus();
    }
    this.#settingsWasOpen = settingsOpen;

    // Ripristino chiesto in sola anteprima: parte appena l'editor c'è.
    const queued = this.#queuedRestore;
    if (queued && shown !== 'preview' && this.#slots.editorPane) {
      this.#queuedRestore = null;
      // Nel frattempo si è passati a un altro file: quella versione non riguarda più il documento.
      if (doc?.path === queued.path) queueMicrotask(() => void workspace.restoreVersion(queued.id));
    }
  }

  #renderSidebar(aside: HTMLElement, workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const t = i18n.t;
    const ai = this.#ai;
    const doc = state.doc;
    const aiMode = this.#shown === 'ai' && !!ai;
    const aiSidebar = this.#slot('aiSidebar', aiMode, () => {
      const sidebar = el('hmd-ai-sidebar', {
        on: { 'hmd-ai-manage': () => this.#openSettings('ai-profiles'), 'hmd-ai-sync-reactivate': () => this.#openSettings('ai-sync') },
      });
      sidebar.getSelection = () => {
        const selected = this.#session.selection?.main;
        return selected && !selected.empty ? { from: selected.from, to: selected.to, originalText: this.#session.textLf.slice(selected.from, selected.to), status: 'valid' } : undefined;
      };
      return sidebar;
    });
    if (aiSidebar && ai) {
      assign(aiSidebar, 'controller', ai);
      assign(aiSidebar, 'text', doc?.text ?? '');
      assign(aiSidebar, 'selection', this.#aiSelection);
      assign(aiSidebar, 'syncNeedsPermission', !!this.#sync?.needsPermission);
      assign(aiSidebar, 'i18n', i18n);
      place(aside, [aiSidebar]);
      for (const name of ['treeHeader', 'search', 'orphans', 'tree'] as const) delete this.#slots[name];
      return;
    }
    const header = this.#slot('treeHeader', true, () =>
      el(
        'div',
        { class: 'sidebarHeader' },
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#setSidebar(false) } }, icon('sidebarClose')),
        el('button', { class: 'folder tooltip', on: { click: () => emit(this, 'hmd-workspace-change-folder', null) } }),
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#onTreeAction('new-file', null) } }, icon('newFile')),
        el('button', { class: 'iconButton tooltip', on: { click: () => this.#onTreeAction('new-folder', null) } }, icon('newFolder')),
      ),
    )!;
    const [hide, folder, newFile, newFolder] = [...header.children] as HTMLButtonElement[];
    for (const [button, label] of [[hide, t('sidebar.hide')], [newFile, t('file.new')], [newFolder, t('folder.new')]] as const) {
      toggleAttr(button, 'aria-label', true, label);
      toggleAttr(button, 'data-tooltip', true, label);
    }
    setText(folder, state.name);
    folder.disabled = this.#switchingFolder;
    toggleAttr(folder, 'data-tooltip', true, t('sidebar.changeFolder'));
    const search = this.#slot('search', true, () => el('hmd-search-panel', { on: { 'hmd-search-open': (event) => void this.#openFile(event.detail.path, event.detail.terms) } }))!;
    assign(search, 'index', workspace.search);
    assign(search, 'indexRevision', state.indexRevision);
    assign(search, 'i18n', i18n);
    const orphans = this.#slot('orphans', this.#orphans.length > 0, () => el('section', { class: 'orphans' }, el('h2', { class: 'orphansTitle' })));
    if (orphans) this.#renderOrphans(orphans, doc?.path ?? null, t);
    else this.#orphanNodes.clear();
    const tree = this.#slot('tree', true, () =>
      el('hmd-file-tree', {
        on: { 'hmd-open': (event) => void this.#openFile(event.detail.path), 'hmd-tree-action': (event) => this.#onTreeAction(event.detail.action, event.detail.node) },
      }),
    )!;
    // Albero, file e bozze ricalcolati solo quando cambiano le voci (o la lingua), come gli useMemo di React.
    const memo = this.#memo;
    if (memo.entries !== state.entries || memo.locale !== i18n.getState().locale) {
      memo.tree = buildTree(state.entries, i18n.getState().locale);
      memo.locale = i18n.getState().locale;
    }
    if (memo.drafts !== state.drafts) {
      memo.drafts = state.drafts;
      memo.draftSet = new Set(state.drafts);
    }
    assign(tree, 'nodes', memo.tree!);
    assign(tree, 'openPath', doc?.path ?? null);
    assign(tree, 'drafts', memo.draftSet!);
    assign(tree, 'i18n', i18n);
    place(aside, [header, search, ...(orphans ? [orphans] : []), tree]);
    delete this.#slots.aiSidebar;
  }

  #renderOrphans(section: HTMLElement, openPath: string | null, t: I18nStore['t']): void {
    toggleAttr(section, 'aria-label', true, t('orphans.title'));
    setText(section.firstElementChild!, t('orphans.title'));
    const nodes = new Map<string, HTMLButtonElement>();
    for (const path of this.#orphans) {
      const button = this.#orphanNodes.get(path) ?? el('button', { class: 'orphan tooltip', on: { click: () => void this.#openFile(path) } }, path);
      toggleAttr(button, 'aria-current', openPath === path, 'true');
      toggleAttr(button, 'data-tooltip', true, t('orphans.recover', { path }));
      nodes.set(path, button);
    }
    this.#orphanNodes = nodes;
    place(section, [section.firstElementChild!, ...nodes.values()]);
  }

  #files(state: WorkspaceState): string[] {
    const memo = this.#memo;
    if (memo.entries !== state.entries || !memo.files) {
      memo.entries = state.entries;
      memo.files = state.entries.filter((e) => e.kind === 'file').map((e) => e.path);
    }
    return memo.files;
  }

  #getDocs = () => this.#workspace!.search.titles();
  #readBlob = (path: string) => this.#workspace!.readBlob(path);
  #saveImage = (file: File) => this.#workspace!.saveImage(file, file.name);

  #renderReview(review: HmdAiReview, state: WorkspaceState, ai: AiController, i18n: I18nStore): void {
    const doc = state.doc!;
    assign(review, 'controller', ai);
    assign(review, 'i18n', i18n);
    // Un oggetto nuovo a ogni render, come con React: la revisione rilegge allora `canAccept`, che dipende anche dallo
    // stato dello workspace (un conflitto spegne gli «accetta» dei blocchi). Confrontare i campi la lascerebbe ferma.
    review.doc = {
      path: doc.path,
      text: doc.text,
      resetKey: docKey(doc),
      session: this.#session,
      restore: doc.restore,
      readOnly: state.updating,
      getDocs: this.#getDocs,
      saveImage: this.#saveImage,
      docChanged: this.#docChanged,
      selectionChanged: this.#selectionChanged,
    };
  }

  #docChanged = (changes: ChangeDesc, texts: { before: string; after: string }) => {
    const workspace = this.#workspace!;
    const path = workspace.getState().doc?.path;
    if (path) this.#ai?.documentChanged(path, changes, false, texts);
    workspace.edit(texts.after);
  };
  #selectionChanged = (range: TextRange | null) => this.#onSelection(range);

  #renderPanes(panes: HTMLDivElement, workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const t = i18n.t;
    const doc = state.doc!;
    const shown = this.#shown;
    toggleAttr(panes, 'data-mode', true, panesMode(shown, this.#historyOpen));
    const editorPane = this.#slot('editorPane', shown !== 'preview', () => el('section', { class: 'pane' }, this.#createEditor()));
    if (editorPane) {
      toggleAttr(editorPane, 'aria-label', true, t('pane.editor'));
      const editor = editorPane.firstElementChild as HmdEditor;
      assign(editor, 'text', doc.text);
      assign(editor, 'resetKey', docKey(doc));
      assign(editor, 'session', this.#session);
      assign(editor, 'restore', doc.restore);
      assign(editor, 'readOnly', state.updating);
      assign(editor, 'getDocs', this.#getDocs);
      assign(editor, 'saveImage', this.#saveImage);
      assign(editor, 'i18n', i18n);
    }
    // La cronologia è per file (la `key` di React): un file nuovo, un pannello nuovo.
    if (this.#historyOpen && this.#historyPath !== doc.path) delete this.#slots.historyPane;
    const historyPane = this.#slot('historyPane', this.#historyOpen, () =>
      el(
        'section',
        { class: 'pane' },
        el('hmd-history-panel', {
          on: {
            'hmd-history-restore': (event) => this.#restoreVersion(event.detail.id),
            'hmd-history-close': () => {
              this.#historyOpen = false;
              this.#loop.update();
            },
          },
        }),
      ),
    );
    if (historyPane) {
      this.#historyPath = doc.path;
      toggleAttr(historyPane, 'aria-label', true, t('toolbar.history'));
      const history = historyPane.firstElementChild as HmdHistoryPanel;
      assign(history, 'workspace', workspace);
      assign(history, 'path', doc.path);
      assign(history, 'currentText', doc.text);
      assign(history, 'i18n', i18n);
    }
    const previewPane = this.#slot('previewPane', !this.#historyOpen && shown !== 'editor', () =>
      el(
        'section',
        { class: 'pane' },
        el('hmd-preview', {
          on: {
            'hmd-top-line': (event) => {
              if (this.#shown === 'split') (this.#slots.editorPane?.firstElementChild as HmdEditor | undefined)?.scrollToLine(event.detail.line);
            },
            'hmd-open-wiki': (event) => {
              this.#highlight = NO_TERMS;
              this.#loop.update();
              void workspace.followWikiLink(event.detail.target);
            },
            'hmd-open': (event) => void this.#openFile(event.detail.path),
          },
        }),
      ),
    );
    if (previewPane) {
      toggleAttr(previewPane, 'aria-label', true, t('pane.preview'));
      const preview = previewPane.firstElementChild as HmdPreview;
      assign(preview, 'text', doc.text);
      assign(preview, 'path', doc.path);
      assign(preview, 'files', this.#files(state));
      assign(preview, 'config', state.config);
      assign(preview, 'readBlob', this.#readBlob);
      assign(preview, 'highlight', this.#highlight);
      assign(preview, 'i18n', i18n);
    }
    place(panes, [...(editorPane ? [editorPane] : []), ...(historyPane ? [historyPane] : previewPane ? [previewPane] : [])]);
  }

  #createSettings(): HmdSettings {
    return el('hmd-settings', {
      on: {
        'hmd-settings-section': (event) => this.#route?.navigate({ view: 'settings', section: event.detail.section }),
        'hmd-settings-close': () => this.#route?.navigate({ view: 'workspace' }),
        'hmd-settings-autosave': (event) => {
          writePref('autosave', event.detail.autosave);
          this.#workspace?.setAutosave(event.detail.autosave);
        },
        'hmd-settings-text-width': (event) => {
          writePref('textWidth', event.detail.textWidth);
          this.#textWidth = event.detail.textWidth;
          this.#applyTextWidth();
          this.#loop.update();
        },
        'hmd-settings-save-all': () => void this.#workspace?.saveAll(),
      },
    });
  }

  #renderSettings(settings: HmdSettings, state: WorkspaceState, i18n: I18nStore): void {
    const route = this.#route!.getState();
    if (route.view === 'settings') assign(settings, 'section', route.section);
    assign(settings, 'ai', this.#ai);
    assign(settings, 'syncBinding', this.#sync);
    assign(settings, 'theme', this.#theme);
    assign(settings, 'autosave', state.autosave);
    assign(settings, 'textWidth', this.#textWidth);
    assign(settings, 'i18n', i18n);
  }

  // Bozze nel buffer di emergenza di file spariti dal disco: senza questa lista non si ritroverebbero.
  #watchOrphans(workspace: Workspace, state: WorkspaceState): void {
    const key = [state.status, state.indexRevision, state.entries, state.drafts];
    if (key.every((v, i) => v === this.#orphanKey[i])) return;
    this.#orphanKey = key;
    const request = ++this.#orphanRequest;
    if (state.status !== 'ready') return;
    void workspace.orphanDrafts().then((paths) => {
      if (request !== this.#orphanRequest || !this.isConnected) return;
      this.#orphans = paths;
      this.#loop.update();
    });
  }

  /** Riapre l'ultimo file della cartella, una volta. */
  #reopen(workspace: Workspace, state: WorkspaceState): void {
    if (this.#reopened || state.status !== 'ready') return;
    this.#reopened = true;
    const plan = reopenPlan(readLastFile(this.#workspaceId), this.#files(state));
    // Dopo il render: aprire un file notifica, e una notifica dentro il render chiede solo un'altra passata.
    if (plan.kind === 'open') queueMicrotask(() => void this.#openFile(plan.path));
    else if (plan.kind === 'draft') {
      // Non scavalca un file che l'utente ha già aperto nel frattempo.
      void workspace.hasDraft(plan.path).then((has) => {
        if (has && !workspace.getState().doc && this.isConnected) void this.#openFile(plan.path);
      });
    }
  }

  /** Accesso perso: dialog bloccante finché il permesso non torna; se lo stato cambia per altre vie (o al distacco) si chiude. */
  #watchAccess(workspace: Workspace, state: WorkspaceState, i18n: I18nStore): void {
    const lost = state.status === 'access-lost';
    if (lost === !!this.#accessLost) return;
    if (!lost) {
      this.#accessLost?.abort();
      this.#accessLost = null;
      return;
    }
    const controller = (this.#accessLost = new AbortController());
    const handle = this.#handle;
    // Dopo il render (come l'effetto di React): il dialog modale sposta il focus.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void showAccessLostDialog({
        folderName: state.name,
        t: i18n.t,
        signal: controller.signal,
        onResume: async () => {
          const granted = !!handle && (await requestAccess(handle));
          if (granted) await workspace.resume();
          return granted;
        },
      });
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-workspace': HmdWorkspace;
  }
}
```

`src/elements/workspace/workspace.css` (valori di `WorkspaceView.module.css`; `.saveState :global(.icon)` diventa `.saveState .icon`; il limite inferiore è necessario: con i nomi di classe non più cifrati, `.iconButton` prenderebbe anche quelli della sidebar AI):

```css
@layer components {
  /*
   * Valori copiati da WorkspaceView.module.css. Il limite inferiore lascia ai loro fogli tutti gli elementi
   * contenuti: con i nomi di classe non più cifrati dai CSS Modules, `.iconButton` di questo foglio
   * prenderebbe anche quelli della sidebar AI, `.empty` e `.path` quelli di altri pannelli.
   */
  @scope (hmd-workspace) to (hmd-ai-sidebar, hmd-search-panel, hmd-file-tree, hmd-theme-switcher, hmd-conflict-bar, hmd-ai-review, hmd-editor, hmd-history-panel, hmd-preview, hmd-settings, hmd-toasts) {
    :scope {
      display: contents;
    }

    .layout {
      display: grid;
      height: 100%;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--c-sidebar);
    }

    .sidebarHeader {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--c-border);
      font-family: var(--font-pixel);
    }

    .folder {
      flex: 1;
      min-width: 0;
      text-align: left;
      font-weight: 700;
      background: none;
      border: none;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .folder:hover:not(:disabled),
    .iconButton:hover {
      background: var(--c-accent-soft);
    }

    /* Cambio cartella in corso. */
    .folder:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    .iconButton {
      background: none;
      border: none;
      border-radius: 6px;
      width: 30px;
      height: 30px;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
      color: var(--c-text);
    }

    .resizer {
      cursor: col-resize;
      background: var(--c-border);
      touch-action: none;
    }

    .resizer:hover,
    .resizer:focus-visible {
      background: var(--c-accent);
    }

    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--c-border);
      background: var(--c-bg);
      font-family: var(--font-pixel);
    }

    /* Le due ali occupano lo stesso spazio: così il gruppo delle modalità resta al centro. */
    .lead,
    .actions {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .actions {
      justify-content: flex-end;
    }

    .path {
      flex: 1;
      min-width: 0;
      color: var(--c-muted);
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .modes {
      display: flex;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .mode {
      background: none;
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
    }

    .mode[aria-pressed='true'] {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
    }

    .saveState {
      min-width: 11ch;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      font-size: 13px;
      color: var(--c-muted);
    }

    .saveState[data-state='error'] {
      color: var(--c-danger);
      font-weight: 600;
    }

    .saveState .icon {
      color: var(--c-accent);
    }

    .panes {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .panes[data-mode='split'] {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .pane {
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }

    .panes[data-mode='split'] .pane + .pane {
      border-left: 1px solid var(--c-border);
    }

    .empty {
      flex: 1;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 12px;
      color: var(--c-muted);
    }

    .primary {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: 600;
    }

    .orphans {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--c-border);
      background: var(--c-warning-bg);
    }

    .orphansTitle {
      margin: 0 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--c-muted);
    }

    .orphan {
      text-align: left;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 3px 6px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .orphan:hover,
    .orphan[aria-current='true'] {
      background: var(--c-accent-soft);
    }
  }
}
```

`src/elements/define.ts`: import `HmdWorkspace` e voce `['hmd-workspace', HmdWorkspace]` in fondo (dopo `hmd-update-notice`).

- [ ] **Step 6: `App.tsx` monta `hmd-workspace`**

`src/App.tsx`: via `import { WorkspaceView } from './ui/WorkspaceView';`; dopo gli import di `I18nProvider`:

```tsx
import { browserRouteWindow, createRouteStore } from './state/routeStore';
import { getThemeStore } from './theme/useTheme';
```

nel componente, prima di `dbBlocked`: `const [route] = useState(() => createRouteStore(browserRouteWindow()));` e il ramo `open`:

```tsx
    .with({ kind: 'open' }, (s) => (
      <hmd-workspace
        key={`${s.stored.workspaceId}:${openCount}`}
        workspace={s.workspace}
        workspaceId={s.stored.workspaceId}
        handle={s.stored.handle}
        switchingFolder={switching}
        i18n={i18nStore}
        theme={getThemeStore()}
        route={route}
        onhmd-workspace-change-folder={choose}
      />
    ))
```

`src/elements/jsx.d.ts`: React monta ormai solo `hmd-start-screen`, `hmd-workspace`, `hmd-update-notice` e `hmd-notice`; le altre voci e i loro import si tolgono (6c, decisione 9: il file dice solo quello che React monta), e si aggiunge:

```ts
      'hmd-workspace': HmdProps<
        {
          workspace: Workspace;
          workspaceId: string;
          handle: FileSystemDirectoryHandle;
          switchingFolder: boolean;
          i18n: I18nStore;
          theme: ThemeStore;
          route: RouteStore;
        },
        'hmd-workspace-change-folder'
      > & { key?: Key };
```

(import `RouteStore` da `../state/routeStore`, `Workspace` da `../workspace/workspace`; `HmdDocProps` e gli import di editor, AI, preview, ricerca, albero, cronologia, toast e impostazioni non servono più.) Poi:

```bash
git rm src/ui/WorkspaceView.tsx src/ui/WorkspaceView.module.css src/ui/Icon.tsx src/ui/useRoute.ts src/ui/useUnmountSignal.ts src/ui/useWorkspace.ts src/ui/ai/useAiController.ts src/ui/ai/useAiState.ts
grep -rln "useRoute\|useUnmountSignal\|useWorkspaceState\|useAiController\|useAiState\|ui/Icon\|from './Icon'\|<WorkspaceView" src; echo "uscita $?"
# atteso (misurato nel prototipo): solo src/architecture.test.ts (il caso sintetico `ui/Icon.tsx`) e
# src/elements/workspace/aiSession.ts (i commenti «era useAiController»); uscita 0 per quelle due righe
```

- [ ] **Step 7: Verifica**

```bash
npx tsc --noEmit && npm test            # 1034 verdi
npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts $(ls e2e/*.spec.ts | grep -v visual.spec.ts)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/workspace-shell.spec.ts e2e/settings.spec.ts e2e/settings-sections.spec.ts e2e/startup.spec.ts e2e/editor.spec.ts e2e/external.spec.ts e2e/history.spec.ts e2e/ai-review.spec.ts e2e/ai-review-bar.spec.ts e2e/ai-composer.spec.ts e2e/theme-i18n.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "workspace|editor-mode|ai-review|tree|search|history|toast|conflict|orphans|sidebar|resizer|focus"
pgrep -af "vite|chrom|playwright"
```

Nel prototipo, a questo passo: suite e2e completa 185 verdi + i 2 noti (2,6 min), audit completo 116 verdi dopo la correzione della decisione 9 (prima: `ai-review-conflict` con «expect(locator).toBeDisabled() failed» sugli «accetta» dei blocchi).

- [ ] **Step 8: Commit**

`test:` (Step 1), `feat:` (Step 2–5), `refactor:` (Step 6). Nessun `Co-authored-by`.

### Task 7: `hmd-app`, `main.ts`, via React (Builder)

`App.tsx` diventa `hmd-app` (schermate, cambio cartella, avvisi), con le dipendenze del browser in `appDeps.ts` (decisione 13). `main.ts` crea gli store unici (lingua, tema, rotta, aggiornamenti) e `<hmd-app>` dentro `#root` (spec §5.3); `<html lang>` segue la lingua caricata (era l'effetto di `I18nProvider`). Il tema passa a `theme/browserTheme.ts`, senza `flushSync` (decisione 12). Poi via React: file, test, dipendenze, plugin, `"jsx"`, e un controllo statico che lo verifica.

**Files:**
- Create: `src/elements/app/appDeps.ts`, `app.element.ts`, `app.css`, `app.dom.test.ts`, `src/main.ts`, `src/theme/browserTheme.ts`
- Modify: `src/elements/define.ts` (`hmd-app`, commento), `src/architecture.test.ts` (niente React), `src/elements/editor/editor.dom.test.ts`, `src/elements/ai/diff-pane.dom.test.ts` (via i test StrictMode e gli import di React), `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`
- Delete: `src/App.tsx`, `src/main.tsx`, `src/i18n/I18nProvider.tsx`, `src/theme/useTheme.ts`, `src/elements/jsx.d.ts`, `src/elements/reactInterop.dom.test.ts`

**Interfaces:**
- Consumes: `app/switchFolder.ts`, `elements/app/screens.ts` (`afterSwitch`), `fs/access.ts`, `fs/handleStore.ts`, `fs/fsaOps.ts`, `fs/workspaceFS.ts`, `history/historyStore.ts`, `workspace/buffers.ts`, `lib/db.ts` (`onDbBlocked`), `pwa/updateHost.ts`, `pwa/registerUpdates.ts`, `state/i18nStore.ts`, `state/routeStore.ts`, `state/themeStore.ts`.
- Produces: `HmdApp` — ingressi `updates`, `i18n`, `theme`, `route`; solo per i test `deps: AppDeps` e il getter `screen`. `AppDeps`, `browserAppDeps`, `browserThemeStore()`.

**Criteri di accettazione:** RED annotato; `npm test` 1034 + 6 (app) + 1 (niente React) − 3 (`reactInterop`) − 2 (StrictMode) = **1036**; lint pulito; `package.json` senza `react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`; `npm run build` senza il plugin; bundle principale gzip annotato (prototipo: **379 165 B**); `startup.spec.ts`, `theme-i18n.spec.ts`, `visual.spec.ts`, `workspace-shell.spec.ts`, `settings.spec.ts` verdi in build e in sviluppo (salvo i 2 noti); audit `start*`, `workspace*`, `access-lost-dialog` verdi; nessun `.tsx` in `src/` e nessun import di `react` (solo i casi sintetici di `architecture.test.ts`).

- [ ] **Step 1: I test, prima del codice**

`src/elements/app/app.dom.test.ts` (browser finto con `AppDeps`; workspace veri su `memoryOps`):

```ts
import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../../testing/memoryStorage';
installMemoryStorage();

import '../define';
import type { StoredWorkspace } from '../../fs/handleStore';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { memoryOps } from '../../fs/testing/memoryOps';
import { EN_MESSAGES } from '../../i18n/messages';
import type { UpdateFlow } from '../../pwa/updateFlow';
import { createI18nStore } from '../../state/i18nStore';
import { createRouteStore } from '../../state/routeStore';
import { createThemeStore } from '../../state/themeStore';
import { installDialogStub } from '../../testing/dialogStub';
import { installPopoverStub } from '../../testing/popoverStub';
import { waitFor } from '../../testing/waitFor';
import { memoryBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';
import type { HmdApp } from './app.element';
import type { AppDeps } from './appDeps';

installDialogStub();
installPopoverStub();
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });
test.afterEach(() => document.body.replaceChildren());

const handle = (name: string) => ({ name, isSameEntry: async () => false }) as unknown as FileSystemDirectoryHandle;

function deps(overrides: Partial<AppDeps> = {}) {
  const log: string[] = [];
  let blocked: (() => void) | null = null;
  const opened: Workspace[] = [];
  const d: AppDeps = {
    isSupported: () => true,
    unsupportedReason: () => 'firefox',
    loadWorkspace: async () => null,
    hasAccess: async () => true,
    requestAccess: async () => true,
    pickFolder: async () => handle('picked'),
    knownWorkspaceId: async () => null,
    saveWorkspace: async (stored) => void log.push(`save ${stored.handle.name}`),
    async openWorkspace(stored: StoredWorkspace) {
      const ops = memoryOps();
      ops.setFile('a.md', '# A');
      const workspace = new Workspace({ fs: createWorkspaceFS(ops), workspaceId: stored.workspaceId, name: stored.handle.name, buffers: memoryBufferStore() });
      await workspace.load();
      opened.push(workspace);
      return workspace;
    },
    onDbBlocked: (listener) => ((blocked = listener), () => void (blocked = null)),
    setUpdateWorkspace: (workspace) => void log.push(`update ${workspace ? 'open' : 'none'}`),
    ...overrides,
  };
  return { deps: d, log, opened, block: () => blocked?.() };
}

function mount(d: AppDeps) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
  const el = document.createElement('hmd-app') as HmdApp;
  el.deps = d;
  el.updates = { subscribe: () => () => {}, getState: () => ({ kind: 'idle' }) } as unknown as UpdateFlow;
  el.i18n = i18n;
  el.theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  el.route = createRouteStore({ hash: () => '', pushState() {}, replaceState() {}, back() {}, setHash() {}, cleanUrl: () => '/', onHashChange: () => () => {} });
  document.body.append(el);
  return el;
}

const kinds = (el: Element) => [...el.children].map((c) => c.localName);

test('an unsupported browser: the start screen in its unsupported mode, and the update notice', () => {
  const el = mount(deps({ isSupported: () => false }).deps);
  assert.equal(el.screen, 'unsupported');
  assert.deepEqual(kinds(el), ['hmd-start-screen', 'hmd-update-notice']);
  assert.equal(el.querySelector('hmd-start-screen')!.mode, 'unsupported');
});

test('no saved folder: the start screen; picking a folder opens it, saves it and tells the update flow', async () => {
  const { deps: d, log } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  const start = el.querySelector('hmd-start-screen')!;
  start.dispatchEvent(new CustomEvent('hmd-start-pick', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
  assert.deepEqual(kinds(el), ['hmd-workspace', 'hmd-update-notice']);
  assert.deepEqual(log, ['update none', 'save picked', 'update open']);
});

test('a saved folder without permission: resume; granted, the folder opens', async () => {
  const el = mount(deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }), hasAccess: async () => false }).deps);
  await waitFor(() => el.screen === 'resume');
  assert.equal(el.querySelector('hmd-start-screen')!.folderName, 'notes');
  el.querySelector('hmd-start-screen')!.dispatchEvent(new CustomEvent('hmd-start-resume', { bubbles: true, detail: null }));
  await waitFor(() => el.screen === 'open');
});

test('changing folder from the workspace makes a new hmd-workspace (also for the same folder) and disposes the old one', async () => {
  const { deps: d, opened } = deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) });
  const el = mount(d);
  await waitFor(() => el.screen === 'open');
  const first = el.querySelector('hmd-workspace')!;
  first.dispatchEvent(new CustomEvent('hmd-workspace-change-folder', { bubbles: true, detail: null }));
  await waitFor(() => el.querySelector('hmd-workspace') !== first && !!el.querySelector('hmd-workspace'));
  assert.equal(opened.length, 2);
  assert.equal(first.isConnected, false);
});

test('a blocked database shows the dismissible notice at the top; dismissed, it goes', async () => {
  const { deps: d, block } = deps();
  const el = mount(d);
  await waitFor(() => el.screen === 'start');
  block();
  const notice = el.querySelector('hmd-notice')!;
  assert.equal(notice.message, EN_MESSAGES['toast.reloadOtherTabs']);
  assert.equal(notice.placement, 'top');
  notice.dispatchEvent(new CustomEvent('hmd-notice-dismiss', { bubbles: true, detail: null }));
  assert.equal(el.querySelector('hmd-notice'), null);
});

test('detached while the folder is opening: the folder opened afterwards is disposed', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const disposed: string[] = [];
  const { deps: d } = deps({ loadWorkspace: async () => ({ handle: handle('notes'), workspaceId: 'w' }) });
  const open = d.openWorkspace;
  let opening = false;
  d.openWorkspace = async (stored) => {
    opening = true;
    await gate;
    const w = await open(stored);
    const dispose = w.dispose.bind(w);
    w.dispose = () => (disposed.push('w'), dispose());
    return w;
  };
  const el = mount(d);
  await waitFor(() => opening);
  el.remove();
  release();
  await waitFor(() => disposed.length === 1);
  assert.equal(el.screen, 'boot');
});
```

In `src/architecture.test.ts`, prima del test di `customElements.define`:

```ts
/** Fase 7 (spec WC §8.3, §11): React non c'è più, né come import né come file `.tsx`. */
const REACT = /\bfrom\s+['"](?:react|react-dom)(?:\/[^'"]*)?['"]|\bimport\(\s*['"](?:react|react-dom)(?:\/[^'"]*)?['"]/;

test('no React anywhere in src/: no import of react or react-dom, no .tsx file (tests included)', () => {
  const all = walk(SRC).map((full) => ({ path: relative(SRC, full).split(sep).join('/'), full }));
  assert.deepEqual(all.filter(({ path }) => path.endsWith('.tsx')).map(({ path }) => path), []);
  // Questo file contiene i casi sintetici del controllo: si salta.
  const ts = all.filter(({ path }) => path.endsWith('.ts') && path !== 'architecture.test.ts').map(({ path, full }) => ({ path, source: readFileSync(full, 'utf8') }));
  assert.deepEqual(offenders(REACT, () => false, ts), []);
});
```

e nel test «the patterns fire on what they must…», prima delle righe di `DEFINE`:

```ts
  for (const bad of ["import { useState } from 'react';", "import { createRoot } from 'react-dom/client';", "await import('react')"]) {
    assert.ok(REACT.test(bad), bad);
  }
  for (const ok of ["import { reactive } from './reactive';", '// niente React qui', "import { x } from 'preact'"]) {
    assert.ok(!REACT.test(ok), ok);
  }
```

RED atteso: `app.dom.test.ts` non trova `./app.element`/`./appDeps`; il test statico elenca `App.tsx`, `main.tsx`, `i18n/I18nProvider.tsx` e gli import di `react` (`theme/useTheme.ts`, `elements/jsx.d.ts`, `reactInterop.dom.test.ts`, `editor.dom.test.ts`, `diff-pane.dom.test.ts`).

- [ ] **Step 2: Le dipendenze del browser e `hmd-app`**

`src/elements/app/appDeps.ts`:

```ts
import { hasAccess, isSupported, pickFolder, requestAccess, unsupportedReason, type UnsupportedReason } from '../../fs/access';
import { fsaOps } from '../../fs/fsaOps';
import { findKnownWorkspaceId, loadWorkspace, saveWorkspace, type StoredWorkspace } from '../../fs/handleStore';
import { createWorkspaceFS } from '../../fs/workspaceFS';
import { indexedDbHistoryStore } from '../../history/historyStore';
import { onDbBlocked } from '../../lib/db';
import { readValidPref } from '../../lib/prefs';
import { setUpdateWorkspace } from '../../pwa/updateHost';
import { parseAutosave } from '../../workspace/autosave';
import { indexedDbBufferStore } from '../../workspace/buffers';
import { Workspace } from '../../workspace/workspace';

/** Quello che l'app usa del browser (cartelle, permessi, IndexedDB): iniettato, così l'elemento si prova in jsdom. */
export interface AppDeps {
  isSupported(): boolean;
  unsupportedReason(): UnsupportedReason;
  loadWorkspace(): Promise<StoredWorkspace | null>;
  hasAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  requestAccess(handle: FileSystemDirectoryHandle): Promise<boolean>;
  pickFolder(): Promise<FileSystemDirectoryHandle | null>;
  /** Id di una cartella già aperta in passato (anche A → B → A), o null. */
  knownWorkspaceId(handle: FileSystemDirectoryHandle): Promise<string | null>;
  saveWorkspace(stored: StoredWorkspace): Promise<unknown>;
  openWorkspace(stored: StoredWorkspace): Promise<Workspace>;
  onDbBlocked(listener: () => void): () => void;
  /** Il flusso di aggiornamento mette al sicuro il documento dello workspace aperto prima del reload. */
  setUpdateWorkspace(workspace: Workspace | null): void;
}

const buffers = indexedDbBufferStore();
const history = indexedDbHistoryStore();

/** L'app nel browser (era il modulo di App.tsx). */
export const browserAppDeps: AppDeps = {
  isSupported,
  unsupportedReason: () => unsupportedReason(navigator.userAgent),
  loadWorkspace: () => loadWorkspace(),
  hasAccess,
  requestAccess,
  pickFolder,
  knownWorkspaceId: (handle) => findKnownWorkspaceId(handle),
  saveWorkspace: (stored) => saveWorkspace(stored.handle, undefined, stored.workspaceId),
  async openWorkspace(stored) {
    const workspace = new Workspace({
      fs: createWorkspaceFS(fsaOps(stored.handle)),
      workspaceId: stored.workspaceId,
      name: stored.handle.name,
      buffers,
      history,
      autosave: readValidPref('autosave', parseAutosave),
    });
    await workspace.load();
    return workspace;
  },
  onDbBlocked,
  setUpdateWorkspace,
};
```

`src/elements/app/app.element.ts`:

```ts
import { match } from 'ts-pattern';

import { switchFolder, switchGuard } from '../../app/switchFolder';
import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import { RenderLoop } from '../../dom/renderLoop';
import type { StoredWorkspace } from '../../fs/handleStore';
import type { UpdateFlow } from '../../pwa/updateFlow';
import type { I18nStore } from '../../state/i18nStore';
import type { RouteStore } from '../../state/routeStore';
import type { ThemeStore } from '../../state/themeStore';
import type { Workspace } from '../../workspace/workspace';
import type { HmdNotice } from '../notice/notice.element';
import type { HmdStartScreen } from '../start-screen/start-screen.element';
import type { HmdUpdateNotice } from '../update-notice/update-notice.element';
import type { HmdWorkspace } from '../workspace/workspace.element';
import { browserAppDeps, type AppDeps } from './appDeps';
import { afterSwitch, type Screen as AppScreen } from './screens';
import './app.css';

type Screen = AppScreen<StoredWorkspace, Workspace>;

/**
 * Radice dell'app (era App.tsx): schermata iniziale (browser non supportato, prima apertura, ripresa
 * dell'accesso) o area di lavoro della cartella aperta, l'avviso di nuova versione e l'avviso del database
 * bloccato da un'altra scheda. Un cambio cartella (o una ripresa) alla volta; ogni apertura riuscita crea un
 * `hmd-workspace` nuovo (anche per la stessa cartella), così il suo stato non sopravvive. Gli store unici
 * (lingua, tema, rotta, aggiornamenti) arrivano da `main.ts` e scendono ai figli.
 */
export class HmdApp extends HmdElement {
  #updates: UpdateFlow | null = null;
  #i18n: I18nStore | null = null;
  #theme: ThemeStore | null = null;
  #route: RouteStore | null = null;
  #deps: AppDeps = browserAppDeps;

  #screen: Screen = { kind: 'boot' };
  #guard = switchGuard();
  #switching = false;
  #dbBlocked = false;
  #booted = false;
  #boot: AbortController | null = null;
  #start: HmdStartScreen | null = null;
  #workspace: HmdWorkspace | null = null;
  #updateNotice: HmdUpdateNotice | null = null;
  #notice: HmdNotice | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#updates && !!this.#i18n && !!this.#theme && !!this.#route && this.isConnected,
    render: () => this.#render(this.#i18n!),
  });

  get updates(): UpdateFlow | null { return this.#updates; }
  set updates(value: UpdateFlow | null) { this.#updates = value ?? null; this.#loop.update(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }
  get theme(): ThemeStore | null { return this.#theme; }
  set theme(value: ThemeStore | null) { this.#theme = value ?? null; this.#loop.update(); }
  get route(): RouteStore | null { return this.#route; }
  set route(value: RouteStore | null) { this.#route = value ?? null; this.#loop.update(); }
  /** Solo per i test: il browser finto. */
  set deps(value: AppDeps) { this.#deps = value; }
  /** Schermata corrente (per i test). */
  get screen(): Screen['kind'] { return this.#screen.kind; }

  protected connect(signal: AbortSignal): void {
    const deps = this.#deps;
    signal.addEventListener('abort', deps.onDbBlocked(() => this.#set({ dbBlocked: true })), { once: true });
    if (!this.#booted) {
      this.#booted = true;
      this.#startBoot(deps);
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#boot?.abort();
  }

  /** Avvio: la cartella salvata, riaperta se c'è ancora il permesso. Uno workspace aperto dopo il distacco si butta. */
  #startBoot(deps: AppDeps): void {
    if (!deps.isSupported()) return this.#show({ kind: 'unsupported' });
    const boot = (this.#boot = new AbortController());
    void (async () => {
      const stored = await deps.loadWorkspace().catch(() => null);
      if (boot.signal.aborted) return;
      if (!stored) return this.#show({ kind: 'start' });
      if (!(await deps.hasAccess(stored.handle))) {
        if (!boot.signal.aborted) this.#show({ kind: 'resume', stored });
        return;
      }
      const workspace = await deps.openWorkspace(stored);
      if (boot.signal.aborted) return workspace.dispose();
      this.#show({ kind: 'open', stored, workspace });
    })();
  }

  #set(patch: { dbBlocked?: boolean; switching?: boolean }): void {
    if (patch.dbBlocked !== undefined) this.#dbBlocked = patch.dbBlocked;
    if (patch.switching !== undefined) this.#switching = patch.switching;
    this.#loop.update();
  }

  /** Una schermata nuova; un'apertura riuscita vuole un hmd-workspace nuovo. Lo stato si salva prima del render. */
  #show(screen: Screen): void {
    if (screen.kind === 'open') this.#workspace = null;
    this.#screen = screen;
    this.#deps.setUpdateWorkspace(screen.kind === 'open' ? screen.workspace : null);
    this.#loop.update();
  }

  // Un cambio cartella (o ripresa dell'accesso) alla volta: ognuno cattura lo workspace aperto all'inizio.
  async #exclusive(task: () => Promise<void>): Promise<void> {
    if (this.#guard.active) return;
    this.#set({ switching: true });
    try {
      await this.#guard.run(task);
    } finally {
      this.#set({ switching: false });
    }
  }

  #choose(): void {
    const deps = this.#deps;
    void this.#exclusive(async () => {
      const screen = this.#screen;
      const current = screen.kind === 'open' ? screen.workspace : null;
      const result = await switchFolder({
        pick: () => deps.pickFolder(),
        current,
        open: async (handle: FileSystemDirectoryHandle) => {
          // Una cartella già aperta in passato tiene il suo workspaceId (bozze e ultimo file restano suoi).
          const workspaceId = (await deps.knownWorkspaceId(handle).catch(() => null)) ?? crypto.randomUUID();
          const stored: StoredWorkspace = { handle, workspaceId };
          return { stored, workspace: await deps.openWorkspace(stored) };
        },
        // Diventa la cartella salvata solo a cambio riuscito; se il salvataggio fallisce resta aperta lo stesso.
        persist: ({ stored }) => void deps.saveWorkspace(stored).catch(() => undefined),
        // La cartella vecchia non si è potuta lasciare: quella nuova, già caricata, si butta.
        discard: ({ workspace }) => workspace.dispose(),
      });
      match(afterSwitch(result, current !== null))
        .with({ kind: 'show' }, ({ screen: next }) => this.#show(next))
        .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
        .with({ kind: 'stay' }, () => {})
        .exhaustive();
    });
  }

  #resume(): void {
    const deps = this.#deps;
    void this.#exclusive(async () => {
      const screen = this.#screen;
      if (screen.kind !== 'resume') return;
      if (!(await deps.requestAccess(screen.stored.handle))) return;
      const workspace = await deps.openWorkspace(screen.stored);
      this.#show({ kind: 'open', stored: screen.stored, workspace });
    });
  }

  #render(i18n: I18nStore): void {
    const t = i18n.t;
    const screen = this.#screen;
    // La schermata iniziale resta lo stesso elemento tra le sue modalità (come il tag in App.tsx).
    const start = screen.kind === 'unsupported' || screen.kind === 'start' || screen.kind === 'resume';
    if (!start) this.#start = null;
    if (screen.kind !== 'open') this.#workspace = null;
    const content = match(screen)
      .with({ kind: 'boot' }, () => null)
      .with({ kind: 'unsupported' }, () => {
        const s = this.#startScreen(i18n);
        // Le proprietà che il ramo non passa tornano al default (React 19 le azzerava sullo stesso elemento).
        Object.assign(s, { mode: 'unsupported', reason: this.#deps.unsupportedReason(), error: undefined, folderName: '', busy: false });
        return s;
      })
      .with({ kind: 'start' }, ({ error }) => {
        const s = this.#startScreen(i18n);
        Object.assign(s, { mode: 'start', reason: undefined, error, folderName: '', busy: this.#switching });
        return s;
      })
      .with({ kind: 'resume' }, ({ stored }) => {
        const s = this.#startScreen(i18n);
        Object.assign(s, { mode: 'resume', reason: undefined, error: undefined, folderName: stored.handle.name, busy: this.#switching });
        return s;
      })
      .with({ kind: 'open' }, ({ stored, workspace }) => {
        const w = (this.#workspace ??= el('hmd-workspace', { on: { 'hmd-workspace-change-folder': () => this.#choose() } }));
        // Proprietà prima dell'inserimento (lo workspace legge le preferenze e apre la sessione AI collegandosi).
        if (w.workspace !== workspace) {
          w.workspaceId = stored.workspaceId;
          w.handle = stored.handle;
          w.i18n = i18n;
          w.theme = this.#theme;
          w.route = this.#route;
          w.workspace = workspace;
        }
        w.switchingFolder = this.#switching;
        return w;
      })
      .exhaustive();
    const update = (this.#updateNotice ??= el('hmd-update-notice'));
    if (update.flow !== this.#updates) update.flow = this.#updates;
    if (update.i18n !== i18n) update.i18n = i18n;
    if (this.#dbBlocked) {
      const notice = (this.#notice ??= el('hmd-notice', { on: { 'hmd-notice-dismiss': () => this.#set({ dbBlocked: false }) } }));
      notice.placement = 'top';
      notice.message = t('toast.reloadOtherTabs');
      notice.dismissLabel = t('toast.close');
      notice.dismissible = true;
    } else {
      this.#notice = null;
    }
    const wanted: Element[] = [...(content ? [content] : []), update, ...(this.#notice ? [this.#notice] : [])];
    for (const child of [...this.children]) if (!wanted.includes(child)) child.remove();
    let cursor: Element | null = this.firstElementChild;
    for (const node of wanted) {
      if (node === cursor) cursor = cursor.nextElementSibling;
      else this.insertBefore(node, cursor);
    }
  }

  #startScreen(i18n: I18nStore): HmdStartScreen {
    const s = (this.#start ??= el('hmd-start-screen', { on: { 'hmd-start-pick': () => this.#choose(), 'hmd-start-resume': () => this.#resume() } }));
    if (s.i18n !== i18n) s.i18n = i18n;
    return s;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-app': HmdApp;
  }
}
```

`src/elements/app/app.css`:

```css
@layer components {
  /* La radice non ha un box: l'albero sotto #root resta quello di App.tsx. */
  @scope (hmd-app) {
    :scope {
      display: contents;
    }
  }
}
```

`src/elements/define.ts`: import `HmdApp` dopo quello di `HmdAiSuggestions`, voce `['hmd-app', HmdApp]` dopo `hmd-ai-suggestions`; il commento in testa: «`main.ts` lo importa prima di creare `<hmd-app>`: le proprietà assegnate prima della definizione oscurerebbero i setter (spec R9)».

- [ ] **Step 3: Tema e avvio senza React**

`src/theme/browserTheme.ts`:

```ts
import { readValidPref, writePref } from '../lib/prefs';
import { createThemeStore, type ThemeStore } from '../state/themeStore';
import { applyTheme } from './applyTheme';
import { pixelTransition } from './pixelTransition';
import { parseTheme } from './theme';

/**
 * Lo store del tema della pagina (era `getThemeStore` di useTheme.ts): legge la preferenza salvata, la
 * transizione a pixel avvolge il cambio, `auto` segue il sistema. Lo crea `main.ts`, una volta. Gli
 * elementi ridisegnano dentro la notifica, che arriva dentro la view transition: niente più `flushSync`.
 */
export function browserThemeStore(): ThemeStore {
  return createThemeStore({
    initial: readValidPref('theme', parseTheme),
    persist: (theme) => writePref('theme', theme),
    transition: (apply) => void pixelTransition(apply),
    apply: applyTheme,
    watchSystem: (onChange) => {
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
  });
}
```

`src/main.ts`:

```ts
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
```

`index.html`: `<script type="module" src="/src/main.ts"></script>`.

- [ ] **Step 4: Via React**

```bash
git rm src/App.tsx src/main.tsx src/i18n/I18nProvider.tsx src/theme/useTheme.ts src/elements/jsx.d.ts src/elements/reactInterop.dom.test.ts
npm uninstall react react-dom @types/react @types/react-dom @vitejs/plugin-react
```

- `vite.config.ts`: via `import react from '@vitejs/plugin-react';` e `react(),`.
- `tsconfig.json`: via `"jsx": "react-jsx",`.
- `src/elements/editor/editor.dom.test.ts`: via gli import di `react`, `react-dom`, `react-dom/client`, `import type { HmdEditor } from './editor.element';` e il test «under React StrictMode: properties (also saveImage) set before connecting, the view is never recreated».
- `src/elements/ai/diff-pane.dom.test.ts`: via gli import di React, `import type { HmdAiDiffPane } from './diff-pane.element';` e il test «under React StrictMode the MergeView is not recreated: the focus given by the parent stays».

```bash
grep -rln "from 'react\|react-dom" src index.html vite.config.ts tsconfig.json; echo "uscita $?"   # atteso (prototipo): solo src/architecture.test.ts, i casi sintetici
find src -name "*.tsx" | wc -l                                                                       # atteso: 0
grep -n "react" package.json; echo "uscita $?"                                                       # atteso: uscita 1
```

- [ ] **Step 5: Verifica**

```bash
npx tsc --noEmit && npm test            # 1036 verdi
npm run lint
npm run build && gzip -c dist/assets/index-*.js | wc -c     # annotare (prototipo: 379 165)
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/playwright.config.ts e2e/startup.spec.ts e2e/theme-i18n.spec.ts e2e/visual.spec.ts e2e/workspace-shell.spec.ts e2e/settings.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/dev.config.ts e2e/startup.spec.ts e2e/theme-i18n.spec.ts e2e/workspace-shell.spec.ts e2e/settings.spec.ts
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npx playwright test -c e2e/audit.config.ts -g "start|workspace|access-lost"
pgrep -af "vite|chrom|playwright"
```

`visual.spec.ts` «index.html applies dark before the app starts» trattiene `assets/index-*.js` e guarda `#root` vuoto: `hmd-app` entra in `#root` solo dopo il caricamento delle lingue, come prima.

- [ ] **Step 6: Commit**

`test:` (Step 1), `feat:` (Step 2–3), `chore:` (Step 4: «togli React, i suoi tipi e il plugin di Vite»). Nessun `Co-authored-by`.

### Task 8: Documenti, misure, chiusura (Builder)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7, §11, §13), `CLAUDE.md`, `README.md`, `e2e/dev.config.ts`, `e2e/support/app.ts`, `e2e/theme-i18n.spec.ts` (commenti che parlano di React al presente), questo piano (paragrafo «Esecuzione»)
- Create: `docs/superpowers/notes/2026-10-xx-handover-fase-8.md`

**Criteri di accettazione:** le tre suite complete verdi **una volta** sul commit finale (attese dal prototipo: `npm test` 1036; `test:e2e` 202 = 200 + i 2 noti dello start screen; `test:e2e:dev` 187; audit 136), snapshot e `dist-baseline/` invariati; bundle annotato; spec, `CLAUDE.md`, `README.md` aggiornati; handover della fase 8 scritto; PR pronta.

- [ ] **Step 1: Suite complete, una volta, in sequenza**

```bash
npx tsc --noEmit && npm test && npm run lint
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:dev
E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e:audit
npm run build && gzip -c dist/assets/index-*.js | wc -c && wc -c dist/assets/index-*.js
pgrep -af "vite|chrom|playwright"
```

Nel prototipo: 2,6 min, 4,9 min, 4,1 min con 2 worker; nessuna caduta oltre ai 2 snapshot noti. Una caduta isolata si ripete da sola prima di chiamarla regressione; con 1 worker solo se cade per memoria, e lo si scrive.

- [ ] **Step 2: Spec**

- §7 «Fase 7»: la riga «7b **fatta**» (o «7 **fatta**» con la variante A) nello stile delle note precedenti: elementi (`hmd-workspace`, `hmd-app`), moduli puri (`aiSession.ts`, `workspaceView.ts`, `appDeps.ts`, `browserTheme.ts`), store unici da `main.ts`, figli condizionali ricreati come React, `doc` della revisione a ogni render, test di React tolti, «in `src/` nessun `.tsx` né `*.module.css`», bundle principale gzip 441 143 → (misura) B.
- §7 «Fase 8»: il riferimento del bundle è la misura di questo task (la rimozione di React è già fatta: −62 KB gzip nel prototipo, contro i −40 KB attesi).
- §8.3: il controllo «nessun import di React né `.tsx`» è attivo (senza `skip`: è un test normale).
- §5.1: la «Convivenza con React 19 (fasi 4–7)» al passato, `jsx.d.ts` cancellato.
- §11: segnare come fatti i punti su `package.json`, `.tsx`/`*.module.css`, `architecture.test.ts`, `CLAUDE.md` e `README.md`; restano la checklist §9 in Chrome ed Edge e il merge (Davide).
- §13: il piano (se non già fatto nel Task 5).

- [ ] **Step 3: `CLAUDE.md` e `README.md`**

`CLAUDE.md`, in «Regole»: «i componenti React restano sottili» → «gli elementi restano sottili»; dopo la regola sulla logica, una sezione «## Interfaccia» con:

```markdown
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
```

`README.md`, in «Sviluppo»: «(StrictMode)» via dalla riga di `test:e2e:dev`; dopo il blocco dei comandi, un paragrafo sullo stack:

```markdown
Com'è fatto: TypeScript e custom element senza framework (light DOM, CSS con `@layer` e `@scope`), CodeMirror 6
per l'editor e il diff, markdown-it con DOMPurify (o la Sanitizer API) per l'anteprima, MiniSearch per la ricerca,
zod ai confini (file system, storage, risposte dei provider), ts-pattern per i `match` esaustivi; Vite e
vite-plugin-pwa per la build. I test: `node:test` con jsdom, Playwright per gli e2e e per l'audit degli stili.
```

E2e, solo i commenti che parlano di React al presente: `e2e/dev.config.ts` («Le stesse spec contro `vite` in sviluppo, con gli avvisi in console che qui fanno fallire il test (spec WC R18); fino alla fase 7 anche React con StrictMode…»); `e2e/support/app.ts` (`failOnConsole`: «per la suite in sviluppo»); `e2e/theme-i18n.spec.ts` (il pulsante si aggiorna in modo sincrono dentro la transizione: «gli elementi ridisegnano dentro la notifica dello store», non più `flushSync`). I commenti storici («React 19 tratta `inert`…», «prima della fase 4b…») restano: spiegano perché il test esiste.

- [ ] **Step 4: Handover della fase 8**

`docs/superpowers/notes/2026-10-xx-handover-fase-8.md` nello stile di quello della fase 7: stato (branch, PR, misure delle suite e del bundle), `dist-baseline/` con commit e provenienza (lo SHA di `dist-baseline/BASELINE_SHA`, cioè il commit React del Task 1, e come è arrivata nella 7b: copiata dal checkout della 7a o ricostruita in un worktree detached), invariata per tutta la fase, cosa resta per la fase 8 (l'elenco «Per la fase 8» dell'handover della fase 7, più: la regola «mai disabled» su Salva chiave, Sincronizza ora, la cartella durante un cambio, la Cronologia senza documento e l'indirizzo per Anthropic; l'indice delle impostazioni che non arriva a «Sync»; il `padding` di 40vh; la checklist §9 in Chrome ed Edge; bundle e tempo di avvio contro il baseline della fase 3), le lezioni nuove di questa fase (dal paragrafo «Misure» e da quello che emerge nell'esecuzione: `:scope` contro la prossimità di `@scope`; `doc` nuovo a ogni render quando la vista dipende da uno stato esterno; figli condizionali ricreati; `#saveSecret(` e il test statico; l'hook `prepare-commit-msg` del daemon), le trappole dell'ambiente.

- [ ] **Step 5: Esecuzione, PR, commit**

In questo piano, in fondo a «Misure», un paragrafo «**Esecuzione (data).**» con le misure sul branch finale, le deviazioni dal piano e le correzioni arrivate dalle review. Poi:

```bash
git add -A && git -c core.hooksPath=/dev/null commit -m "docs: spec, CLAUDE.md, README e handover allineati alla fase 7"
git log --format=%B -n 3      # nessun Co-authored-by
git push
gh pr ready <numero della PR della 7b (o #10 con la variante A)>
```
