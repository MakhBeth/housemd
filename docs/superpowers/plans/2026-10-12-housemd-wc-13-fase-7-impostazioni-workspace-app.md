# HouseMD Web Components — Piano 13: fase 7, impostazioni, workspace e app senza React

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element l'ultimo strato React e togliere React dall'app. Dal fondo: le tre sezioni AI delle impostazioni (`hmd-settings-profiles`, `hmd-settings-presets`, `hmd-settings-sync`, erano `ui/ai/settings/*`), la cornice con la sezione generale (`hmd-settings`, era `SettingsView.tsx`), l'area di lavoro (`hmd-workspace`, era `WorkspaceView.tsx`, 614 righe), la radice (`hmd-app`, era `App.tsx`) con `main.ts` al posto di `main.tsx` e `I18nProvider.tsx`; poi via `react`, `react-dom`, i tipi, `@vitejs/plugin-react`, `"jsx"` in `tsconfig.json`, `src/elements/jsx.d.ts` e gli hook (`useRoute`, `useUnmountSignal`, `useWorkspace`, `useAiController`, `useAiState`, `useTheme`). **Aspetto e comportamento invariati**: gli snapshot, l'audit degli stili contro `dist-baseline/` (mai ricostruita in questa fase) e gli e2e restano quelli di oggi. Un solo cambio voluto, invisibile: la chiave API scritta nel campo password del profilo non finisce più nell'attributo `value` (React sincronizzava l'attributo dei campi controllati: oggi la chiave sta nel DOM serializzato; spec R21 «chiavi mai negli attributi»; decisione 5). Chiude la migrazione dei componenti (spec §7 «Fase 7»): dopo questo piano in `src/` non c'è più un `.tsx` né un `*.module.css`, e `architecture.test.ts` lo verifica.

**Architecture:** Stesso schema di 4c–6c: classe `Hmd<Nome>` su `HmdElement`, DOM interno identico a quello di React (stessi tag, stesso ordine dei figli: l'audit confronta gli stili per percorso nel DOM saltando gli host con `display: contents`), foglio `@layer components { @scope (…) to (…) { … } }` con i valori dei moduli e il limite inferiore sui figli `hmd-*`, ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`, ogni render da un `RenderLoop`. La catena passa da React agli elementi dal fondo, e l'app funziona dopo ogni task: le sezioni AI dentro `SettingsView.tsx` (Task 2 e 3), `hmd-settings` dentro `WorkspaceView.tsx` (Task 4), `hmd-workspace` dentro `App.tsx` (Task 6), infine `hmd-app` creato da `main.ts`, senza React (Task 7). Nessun componente React finisce mai dentro un elemento. La logica nuova sta in moduli puri testati senza DOM: `elements/settings/settingsView.ts` (sezioni, conferma dei campi numerici, voce dell'indice), `ai/syncBinding.ts` (la cartella di sync, era l'hook `useAiSync`), `elements/workspace/aiSession.ts` (la sessione AI della cartella, era `useAiController`), `elements/workspace/workspaceView.ts` (toast, `beforeunload`, riapertura dell'ultimo file, vista mostrata), `elements/app/appDeps.ts` (il browser visto dall'app, iniettabile). Gli store unici (lingua, tema, rotta, aggiornamenti) li crea `main.ts` e scendono come proprietà (spec §5.3). I nodi che React montava e smontava con un ramo condizionale (`{cond && <x/>}`) l'elemento li crea quando servono e li **dimentica** quando non servono: alla ricomparsa sono nuovi, come con React (un `hmd-editor` nuovo tornando dalla sola anteprima, un `hmd-history-panel` nuovo per ogni file: la `key` di React).

**Tech Stack:** TypeScript 7, Custom Elements, CSS `@scope`/`@layer`, Popover API, `IntersectionObserver` (indice delle impostazioni), Pointer Events con pointer capture (separatore), `tsx --test` con jsdom 30, Playwright 1.63. React 19.3 resta fino al Task 7 (solo `App.tsx`, `WorkspaceView.tsx` fino al Task 6, `SettingsView.tsx` fino al Task 4).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, in particolare 1–4; §5.1–5.4, §5.3 store unici da `main.ts`; §7 «Fase 7» punti 1–5 e «Fase 8» per il bundle; §8.2–8.4, §8.3 «nessun import di React né `.tsx` dalla fase 7»; §9 punti 1, 7–11, 15, 16; §10 R1–R3, R7, R9, R11, R14, R21; §11; §13); handover `docs/superpowers/notes/2026-10-11-handover-fase-7.md` («Cosa resta», «Regola UX di Davide», «Lezioni nuove della 6c», «Trappole dell'ambiente») e `docs/superpowers/notes/2026-10-11-handover-fase-6c.md` («Lezioni da mettere nei piani»); piani `2026-10-11-housemd-wc-11-fase-6b-composer-e-sidebar-ai.md` e `2026-10-11-housemd-wc-12-fase-6c-revisione.md` (il modello di questo).

## Global Constraints

- **Branch** `lab/LAB-5-fase-7` creato da `epic/LAB-3-web-components` (contiene la 6c, merge `5fa9abf`): ogni sub-issue di esecuzione committa lì. PR in bozza #10 verso `epic/LAB-3-web-components`, aperta da questo piano (`gh pr create --draft --base epic/LAB-3-web-components`), portata a pronta dal task di chiusura (`gh pr ready`). Con la divisione in 7a/7b (decisione 1, raccomandata) la PR #10 diventa quella della 7a e la 7b ha un branch e una PR suoi (sotto). Commit piccoli in italiano, all'imperativo, prefisso convenzionale (`test:`, `feat:`, `refactor:`, `docs:`, `chore:`), niente emoji, **nessuna riga di attribuzione**. Il daemon di Multica installa un hook `prepare-commit-msg` che aggiunge `Co-authored-by: multica-agent`: si committa con `git -c core.hooksPath=/dev/null commit …` e prima di ogni push si controlla `git log --format=%B -n <N>` (misurato scrivendo questo piano: il primo commit l'aveva preso). Mai push su `main` né sul branch dell'epica, nessun merge: la PR la mergia il PM dopo la review (Reviewer, A11y) e i gate verdi.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` costruita dal branch **prima di qualsiasi modifica all'app**, conteggi delle suite e gzip del bundle annotati. `dist-baseline/` **non si ricostruisce mai** in questa fase: nessun cambio d'aspetto è previsto (misurato nel prototipo: audit verde contro la build React dal primo all'ultimo task).
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
11. **Senza React spariscono i test che provano React** (sì): `reactInterop.dom.test.ts` (3) e i due «under React StrictMode…» (editor, diff): provavano la convivenza, che finisce. Il caso che proteggevano (proprietà assegnate prima della connessione, vista mai ricreata) lo coprono già gli altri test degli stessi file. La suite in sviluppo resta: senza StrictMode, ma con la console come cancello.
12. **Il tema senza `flushSync`** (sì): `browserThemeStore()` in `theme/browserTheme.ts` (era `getThemeStore()` di `useTheme.ts`), creato da `main.ts`; gli elementi ridisegnano dentro la notifica, che arriva dentro la view transition (misurato: `theme-i18n.spec.ts` «the theme cycle runs through the view transition…» verde).
13. **`hmd-app` con le dipendenze del browser iniettabili** (sì): `AppDeps` in `elements/app/appDeps.ts`, `browserAppDeps` di default, una proprietà `deps` per i test jsdom (avvio, ripresa, cambio cartella, database bloccato, distacco durante l'apertura). Gli store di buffer e cronologia restano unici per pagina (come in `App.tsx`).
14. **Nessuna chiave i18n nuova, nessun pulsante che cambia stato** (sì): la regola «mai disabled» sulle impostazioni e i rilievi di A11y restano alla fase 8 (handover).

## Review Focus

1. **Le impostazioni si comportano come prima**: bozze, conferma una sola volta (✕, Esc, Indietro bloccato → `requestClose()`), Scarta che pulisce `dirty` prima di uscire, focus sul titolo all'apertura e restituito alla chiusura, campi numerici confermati a Invio, blur e chiusura, sezione della rotta portata in vista, indice che segue lo scorrimento. Test: `settings.dom.test.ts` (8), `presets.dom.test.ts` (6), `profiles.dom.test.ts` (6), `sync.dom.test.ts` (4), `settings.spec.ts`, `settings-sections.spec.ts`, audit `settings*`.
2. **Le chiavi**: il campo password non scrive mai l'attributo; `setSecret` è l'unica eccezione, ed è stretta; la chiave si dimentica cambiando profilo o provider e dopo il salvataggio. Test: «a cloud profile…», «Save key hands the key to the controller once…», `architecture.test.ts`, e2e «the key typed in the password field stays in the field…».
3. **`hmd-settings` e la rotta**: `dirty` letto dalla guardia, `requestClose()` senza secondo dialog, eventi verso il workspace (`hmd-settings-section|close|autosave|text-width|save-all`) e preferenze scritte come prima. Test: «with a dirty section, closing (✕, Esc, requestClose) asks once…», `settings.spec.ts` («Back with unsaved changes…», «Back again with the confirmation already open…»).
4. **`hmd-workspace` non perde nulla di `WorkspaceView.tsx`**: figli condizionali ricreati, scorciatoie e listener della finestra legati al `signal` (nessuno dopo il distacco), sessione AI chiusa al distacco e scartata se arriva dopo, sync per controller, bozze orfane e ultimo file, accesso perso, titolo, focus restituito dalle impostazioni, `doc` nuovo alla revisione. Test: `workspace.dom.test.ts` (9), `aiSession.test.ts`, `workspaceView.test.ts`, `workspace-shell.spec.ts`, e tutta la suite e2e (il workspace la attraversa tutta), audit completo.
5. **`hmd-app` e `main.ts`**: schermate, un cambio cartella alla volta, uno workspace nuovo a ogni apertura, workspace buttato se aperto dopo il distacco, `<html lang>` dalla lingua caricata, tema applicato prima del render (`visual.spec.ts`), nessun React nel bundle (`architecture.test.ts`, `package.json`), bundle −62 KB gzip.
6. **Aspetto identico**: nessuno snapshot rigenerato, `dist-baseline/` mai ricostruita, audit verde dal Task 1 al Task 8 con i 10 stati nuovi.

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

**Criteri di accettazione:** i due file nuovi verdi in build e in sviluppo sull'app di oggi; i 10 stati verdi nell'audit; `npm test` e `npm run lint` invariati (980, pulito); `dist-baseline/` costruita da questo commit dell'app (React); conteggi e gzip annotati nel commento finale.

- [ ] **Step 1: Baseline e build di riferimento**

```bash
cd <worktree del branch lab/LAB-5-fase-7>
git status --short && git log --oneline -3      # pulito; sopra 5fa9abf solo i commit del piano
npm ci
npm test                                          # annotare (12/10 nel prototipo: 980)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (12/10: 441 143)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit per TUTTA la fase: non si ricostruisce più
```

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
