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
