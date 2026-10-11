# HouseMD Web Components — Piano 11: fase 6b, composer e sidebar AI (selettore e chip del modello, composer, sidebar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element i quattro componenti React della sidebar AI: `hmd-ai-model-select` (era `ui/ai/ModelSelect.tsx`), `hmd-ai-model-chip` (era `ui/ai/ModelChip.tsx`), `hmd-ai-composer` (era `ui/ai/Composer.tsx`) e `hmd-ai-sidebar` (era `ui/ai/AiSidebar.tsx`), con aspetto e comportamento invariati, tranne il focus quando il nodo che lo ha sparisce (decisione 3); prima, lo schema di render della 6a diventa un helper comune (`src/dom/renderLoop.ts`, decisione 2).

**Architecture:** Stesso schema di 4c–6a: classe `Hmd<Nome>` su `HmdElement`, host con `display: contents`, DOM interno identico a quello di React (stesse classi, stessi attributi, stesso ordine dei figli: l'audit confronta gli stili per percorso nel DOM saltando gli host), foglio `@layer components { @scope (hmd-ai-…) to (…) { … } }` con i valori dei moduli e il **limite inferiore** sui figli `hmd-*` (il registro della chat ha anch'esso una classe `.file`), ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`. Ogni render passa da un `RenderLoop` (un render alla volta, prerequisiti ricontrollati a ogni passata, focus guardato prima e recuperato dopo, contro il DOM finito). La catena di contenimento passa da React agli elementi un anello alla volta, dal fondo: dopo ogni task l'app funziona con i componenti rimasti in React (vedi «Divisione»). La rete resta in `src/ai/providers`: il selettore chiede l'elenco con `controller.provider(profile).listModels(signal)` come oggi, e un test statico vieta agli elementi di importare i provider o di toccare le chiavi. La logica nuova sta in moduli puri accanto agli elementi (`modelSelectView.ts`, `modelChipView.ts`, `composerView.ts`); quella esistente resta dov'è (`ai/composerKeys.ts`, `ai/selectionChip.ts`, `ai/presetName.ts`, `ai/models.ts`, `ai/profiles.ts`, `elements/ai/aiChips.ts`).

**Tech Stack:** TypeScript 7, React 19.3 (solo in `WorkspaceView` e nelle impostazioni), Custom Elements, CSS `@scope`/`@layer`, Popover API (`popover="auto"`, `popovertarget`), Anchor Positioning, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, §3.1 cartella `elements/ai/`, §4, §5.1–5.2, §7 «Fase 6» con la divisione 6a/6b/6c e la nota «6a fatta», §8.2–8.4, §9 punti 11 e 16, §10 R1–R3, R11, R13, R21, §11); spec AI `docs/superpowers/specs/2026-09-27-ai-tool-design.md` (provider, chiavi, nota privacy) e `docs/superpowers/specs/2026-09-29-ai-ui-cleanup-design.md` (§4: composer, chip della selezione, chip del modello, suggerimenti).

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza = `main` = `547f529`, fasi 0–6a fatte). Regola del 05/10 (spec §7): a fine piano, con suite verdi, review finale pulita, `/codex-review-chat` sul diff e checklist provata in Chrome, **il controller** fa merge in `main` e push (anche del branch). Gli implementer non fanno merge né push.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da questo branch **prima di qualsiasi modifica all'app**, conteggi dei test e gzip del bundle principale annotati. `dist-baseline/` non si ricostruisce più fino alla fine del piano.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera: un nuovo snapshot o una rigenerazione solo con approvazione di Davide); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/`. Uniche eccezioni volute: la decisione 3 (focus su un bersaglio stabile), che non cambia l'aspetto, e le piccole deviazioni della decisione 7.
- **Un task per elemento**, sempre TDD: test jsdom che fallisce (**il RED si vede e si annota prima di scrivere l'elemento**: nel dispatch all'implementer va chiesto esplicitamente) → logica pura + elemento + foglio → registrazione in `define.ts` (ordine alfabetico), eventi in `events.ts`, tipi in `jsx.d.ts` → i chiamanti montano il tag → `.tsx` e `.module.css` cancellati con `git rm`, poi `grep -r` (uscita 1 = nessuna occorrenza, il risultato giusto; 2 = comando fallito, da ripetere).
- **`events.ts`: ogni voce nuova (JSDoc + chiave) va subito sopra il JSDoc della voce successiva, mai tra un JSDoc e la sua chiave** (sbagliato due volte nella 6a). Il piano dice per ogni voce la riga del JSDoc sopra cui va.
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri testati senza DOM), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal` (i listener sui nodi creati dall'elemento muoiono con i nodi: `on` di `el()`).
- Cartella: `src/elements/ai/` (radici `hmd-ai-*`, già ammesse da `architecture.test.ts`; il limite inferiore `to (hmd-…)` è ammesso dalla regola). Nessuna eccezione nuova.
- **Schema di render (RenderLoop, decisione 2)**: ogni render passa da `this.#loop.update()`: setter, `watch`, gestori (`input`, `keydown`, `click`, `change`, `toggle`), risposte asincrone. Nessun `#render()` chiamato fuori dal loop. Se un render è in corso, la richiesta segna una passata in più alla fine, mai annidata; **i prerequisiti (`ready`: parti, controller, store i18n, `isConnected`) si ricontrollano prima di ogni passata**; **`hadFocus` si calcola prima della prima passata e il recupero del focus si fa dopo l'ultima, contro il DOM finito**, solo con l'elemento ancora collegato. Dopo un `update()` dentro un gestore non si fa nulla che presupponga lo stato di prima senza ricontrollarlo (qui nessun gestore lo fa: lo verifica la review).
- **Un attributo o una proprietà che l'utente può cambiare da solo si scrive solo quando cambia l'ultimo valore mostrato dall'elemento, mai confrontando con il DOM vivo**: la `<select>` del modello (`#shownValue`), il campo libero «Altro…» (`#shownModel`, e mai con il focus), i radio dei profili (`checked` per riga). La scelta dell'utente conta come già mostrata. Il popover non si apre mai da codice (`popovertarget`); si chiude da codice solo con «Gestisci profili…».
- **`HmdElement.watch()` esegue subito la funzione**: niente render ridondanti in fondo a `connect()`; **nessun evento si emette dentro `connect`** (siamo nel commit di React).
- **Nessun callback DOM rientra in un render in modo sincrono** (il crash della 4c): lo provano i test jsdom con `focusoutOnRemove` del selettore (Task 3: il campo «Altro…» tolto con il focus, il cui `focusout` chiede una passata in più) e del composer (Task 5). L'aiuto `focusoutOnRemove` dei test manda il `focusout` solo se il nodo è collegato e contiene il focus, come Chromium (un nodo già tolto non manda nulla: nel prototipo un aiuto che lo mandava a ogni `remove()` faceva girare il loop all'infinito). Lo stato si salva **prima** di emettere (`#onSelect` del selettore, i radio del chip).
- **Il `toggle` del popover è un task asincrono**: il chip legge lo stato vero del popover (`matches(':popover-open')`), mai `newState`, che può essere superato (staccato e ricollegato prima del task, il popover è chiuso senza evento). L'ancora del chip si ricollega solo dopo aver riconciliato il popover, così un selettore rimasto dentro non si ricollega (né chiede l'elenco).
- **Lavoro asincrono tardivo scartato**: l'elenco dei modelli si chiede con un `AbortController` per richiesta; una risposta (o un errore) arrivata dopo il distacco, o dopo una richiesta più nuova (cambio di tipo, indirizzo o chiave salvata del profilo, «Aggiorna»), non tocca nulla e non segnala errori. Ricollegato, il selettore richiede l'elenco. Un salvataggio del profilo fallito si segnala con `controller.report`, come oggi.
- **Campi con il focus mai ricreati né riscritti**: la casella del composer è dell'elemento (si crea una volta; l'elemento la svuota **solo** dopo l'invio di un testo scritto, spec AI UI §4.2); il campo «Altro…» non si riscrive mentre ha il focus (un eco in ritardo non lo tocca) e si riallinea al modello del profilo quando il focus esce (`focusout` → `update()`); i figli del popover sono per chiave (`reconcileList`). **Se il nodo con il focus sparisce, il focus va a un bersaglio stabile** (decisione 3): composer → la casella; chip del modello → il chip (o «Gestisci profili» senza profili). I pulsanti che si **disattivano** con il focus (Invia dopo l'invio o dopo Stop, Nuova chat) restano come oggi (decisione 4: Chromium sposta il focus sul `body` in modo asincrono, misurato).
- **Regole AI (CLAUDE.md §AI, spec §10 R21)**: solo `src/ai/providers/*` fa rete — gli elementi chiedono l'elenco dei modelli **solo** con `controller.provider(profile)` e `listModels(signal)`; il test statico nuovo di `architecture.test.ts` vieta agli elementi di importare `ai/providers` e di toccare le chiavi (`getSecret`, `setSecret`, `saveSecret`, `deleteSecret`, `aiSecrets`, `.secret(`); le chiavi (e l'id della chiave salvata) **mai in attributi, `dataset`, log o toast** (test jsdom: `outerHTML` senza `secretId` né indirizzo del server nel selettore); risposte e proposte non fidate passano solo da `hmd-ai-chat-log` (`safeRender` + `setSafeHTML`, invariato); nessuna risorsa remota caricata senza clic esplicito (l'elenco dei modelli parte solo all'apertura del popover, come oggi: lo afferma un e2e).
- **React 19 e i custom element** (misurato nelle fasi 4–6a): ogni prop funzione `on*` diventa un listener → le uscite sono eventi `hmd-*` (`emit` di `events.ts`, `bubbles: true`); gli ingressi sono proprietà con nomi che non cominciano per `on` (`getSelection` è una proprietà-funzione: non comincia per `on`). Al montaggio React assegna tutte le proprietà prima di inserire l'elemento, e così fanno gli elementi con i loro figli `hmd-*` (`#passDown()` prima dell'`append`); StrictMode non stacca i custom element. `hmd-ai-manage` sale dal chip del modello attraverso composer e sidebar: lo ascolta un solo antenato per volta (il componente React più vicino, poi `WorkspaceView` sul tag della sidebar), e lo manda un solo elemento. `key` su un tag `hmd-*` richiede `& { key?: Key }` in `jsx.d.ts` (qui non serve).
- **jsdom 30**: mancano `moveBefore`, `showModal`/`closedBy`, Popover (stub `src/testing/popoverStub.ts`: `showPopover`/`hidePopover` segnano un attributo di prova e, dal Task 4, `matches(':popover-open')` risponde da quell'attributo; prima dava sempre `false`), `ToggleEvent` (nei test: `Object.assign(new Event('toggle'), { newState: 'open' })`), `requestAnimationFrame`, `CSS.escape`, Anchor Positioning, `popoverTargetElement`. Il popover vero, l'ancora, il ritorno del focus al chip alla chiusura li verificano Playwright e la checklist.
- Testi solo da `t()` (store i18n); **nessuna chiave nuova**. Tooltip mai con `title` (`.tooltip` + `data-tooltip` + `aria-label`, come oggi).
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app; `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; `expectedConsole` solo per diagnostiche esatte (qui una sola: `Failed to load resource: net::ERR_CONNECTION_REFUSED` del finto Ollama spento, misurata necessaria in sviluppo); **nessuna richiesta di rete vera** (il finto Ollama di `e2e/support/aiHarness.ts`, `https://api.anthropic.com/**` interrotto con `route.abort()`); `page.clock` con `pauseAt` dove conta un timer (qui nessuno); un e2e sospetto di instabilità si prova con `--repeat-each=5`.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail`. Il test del Task 1 «ignoring the selection with ✕: where the focus goes» afferma il focus sul `body` di oggi e lo rovescia il Task 5; «New chat waits for a message…» afferma il focus sul `body` dopo «Nuova chat» (decisione 4, conservato).
- Dialog solo con le funzioni di `src/elements/dialogs/` (qui nessun dialog); File System Access API solo in `src/fs/fsaOps.ts` e `src/fs/access.ts`; `workspace/` e `ai/` non cambiano.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo sono ricorsivi (`-r`), si lanciano dopo il `git rm` e distinguono l'uscita 1 dalla 2. Il controller rilancia almeno i file e2e nuovi o toccati di ogni task (i rapporti brevi non bastano).
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**. Instabilità estranea nota: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog» (ripetere il file e annotarlo nel ledger).
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale (`test:`, `refactor:`, `feat:`, `docs:`), nessuna riga di attribuzione.


## Misure prese scrivendo il piano (11/10, su `547f529`)

Baseline: `npm test` = **848** test verdi; `npm run test:e2e` = **155**; `npm run test:e2e:dev` = **140**; audit = **42** stati (84 test, `baseline` + `current`); bundle principale gzip = **437 013 B** (`dist/assets/index-9cuW-47X.js` della build di `547f529` nel prototipo; il valore 436 972 dell'handover non torna con la build).

**Prototipo.** Il codice di tutti i task è stato provato su una copia del repository fuori dal worktree (`git worktree add --detach ../housemd-proto-6b 547f529` + `npm ci`, `dist-baseline/` costruita da `547f529` prima di toccare l'app, niente commit): `npm run lint` pulito a ogni task; `npm test` 848 → **921** (+7 Task 2, +23 Task 3 compreso il test statico, +21 Task 4, +15 Task 5, +7 Task 6); `npm run test:e2e` 155 → **175** (+20 del Task 1: `ai-model` 10, `ai-composer` 10), snapshot invariati; `npm run test:e2e:dev` 140 → **160**; audit 84 → **100** (8 stati nuovi), uguale alla baseline dopo ogni task (Task 1, 3, 4, 5, 6: tutte e tre le suite verdi); bundle gzip 437 013 → **439 425 B** (+2 412: React resta, quattro componenti diventano elementi, più `RenderLoop`). I due file e2e nuovi `--repeat-each=3` verdi sull'app React (60/60) e, sull'app finale, insieme ad `ai-chips` e `ai-review`, 4 esecuzioni `--repeat-each=3`/`6` (555 test): **una** sola caduta non riprodotta (in un'esecuzione da 111; le tre seguenti, 444 test, tutte verdi): se ricapita, annotare il nome del test nel ledger e ripetere quel file con `--repeat-each=5` sull'app React (`git stash` del task) per sapere se è preesistente. In sviluppo `--repeat-each=3` 60/60. Dopo le correzioni della review di Codex: `npm test` 921, `npm run lint` pulito, `test:e2e` 175, `test:e2e:dev` 160, `test:e2e:dev` dei file `ai-model`, `ai-composer`, `ai-chips`, `ai-review` 37, audit 100, tutti verdi. Misurato anche:

- **Oggi il focus cade sul `body`** quando sparisce il nodo che lo ha: la ✕ del chip della selezione (cliccata, sparisce). Il Task 1 lo afferma sull'app React; con la decisione 3 il Task 5 lo rovescia.
- **I pulsanti che si disattivano con il focus lo perdono in modo asincrono** (Chromium: `disabled = true` lascia `activeElement` sul pulsante, dopo un fotogramma il focus è sul `body` con un `blur`): Invia subito dopo il clic (la casella si svuota prima che parta la generazione), Invia dopo Stop, Nuova chat. Recuperarlo vorrebbe un `blur` ascoltato fuori dal render: decisione 4 (lasciato com'è).
- **L'elenco dei modelli** si chiede solo a popover aperto (0 richieste `/api/tags` prima, 1 all'apertura, 1 a ogni riapertura, 1 con «Aggiorna»): React smonta `ModelSelect` alla chiusura. L'elemento fa lo stesso (un selettore nuovo a ogni apertura).
- **Dopo «Gestisci profili…» e la chiusura delle impostazioni il focus torna sul chip** (oggi e con l'elemento): Chromium riporta il focus all'invocatore del popover quando lo si chiude con il focus dentro, e `WorkspaceView` ridà il focus all'elemento che lo aveva prima delle impostazioni.
- **`ModelSelect` ha due chiamanti**, non uno: il popover del chip e il dettaglio di un profilo nelle impostazioni (`ui/ai/settings/AiProfilesSection.tsx`, che resta React fino alla fase 7). Il Task 3 monta il tag in entrambi; l'e2e «in the profile settings the model list loads…» e lo stato di audit `settings-profile` coprono il secondo (lì le regole non stratificate di `Settings.module.css` vincono su quelle del foglio, come oggi su quelle del modulo: audit invariato).
- **Una richiesta dell'elenco rifiutata dal server spento** produce in sviluppo `Failed to load resource: net::ERR_CONNECTION_REFUSED` in console: senza `expectedConsole` il test «an unreachable server…» fallisce in `test:e2e:dev` (misurato).
- **Review di Codex del piano (11/10): F1–F3 corretti**, provati sul prototipo con il RED prima della correzione: (F1a) il chip si fidava di `newState` del `toggle`, che è un task asincrono: staccato e ricollegato prima del task (il distacco chiude il popover senza evento), un «open» in ritardo montava il selettore e chiedeva l'elenco a popover chiuso → il chip legge `matches(':popover-open')`, e lo stub di jsdom lo sa rispondere (test «a late toggle that says open while the popover is closed…», che fallisce senza; i test che aprivano solo con l'evento ora chiamano anche `showPopover`/`hidePopover`); (F1b) con il popover aperto, profili spariti e tornati: l'ancora si ricollegava con il vecchio selettore dentro, che chiedeva l'elenco prima che `reconcileList` lo togliesse (richiesta fantasma, avviata e interrotta) → l'ancora si ricollega dopo la riconciliazione del popover (test «profiles gone and back with the popover open…», che fallisce senza: 2 richieste invece di 1); (F2) il campo «Altro…» con il focus non seguiva un cambio di modello da fuori nemmeno dopo l'uscita del focus → `focusout` sul campo chiama `update()` (test «a model changed outside while the free field has the focus…», che fallisce senza; «the focused free field removed by a choice…» prova che il `focusout` sincrono della rimozione chiede solo una passata in più); (F3) il test del distacco rispondeva e poi rifiutava la stessa richiesta, quindi il rifiuto non contava → due test separati per il rifiuto dopo il distacco e dopo una richiesta più nuova, senza `report` né `small` (verificati togliendo il controllo `aborted` dal ramo d'errore: falliscono).
- **Trovato nel prototipo e corretto nel piano**: (1) senza limite inferiore la regola `.file` della sidebar colpirebbe il pulsante del file nei messaggi della chat (classe `file` anche in `hmd-ai-chat-log`): `@scope (hmd-ai-sidebar) to (hmd-ai-chat-log, hmd-ai-composer, hmd-ai-suggestions)`, e lo stesso per composer e chip; (2) le regole `.popoverSection label > span` e dei campi non hanno più bersagli nel chip (stanno nei fogli del selettore e dei parametri): tolte dal foglio del chip; (3) nei test `t` va tipizzato con `Params` di `i18n/i18n.ts` (con `Record<string, string>` `tsc` rifiuta il tipo); (4) `fieldset` con `legend` e `reconcileList`: la legenda è una voce della lista (chiave `legend`), altrimenti `reconcileList` inserirebbe le righe prima di lei; (5) in `jsx.d.ts` gli import del composer vanno prima di quello di `diff-pane` (ordine alfabetico); (6) `controller.provider` di `fakeAi` deve leggere `models` al momento della chiamata.

### Inventario

**`src/ui/ai/ModelSelect.tsx`** (76 righe; CSS: `.popoverSection`, `.link` di `Composer.module.css`)
- Props: `controller: AiController`, `profile: ModelProfile`, `onChange(selection: Pick<ModelProfile, 'model' | 'contextTokens'>)`. Nessun ref. Hook: `useT`, `useState` (`models: ModelOption[] | null`, `custom`, `revision`, `error`), un `useEffect` con dipendenze `[profile.kind, profile.baseUrl, profile.secretId, revision, controller]`: `AbortController`, `setError(false)`, `setModels(null)`, `controller.provider(profile).then(p => p.listModels(signal))`, lista `null` = errore «non raggiungibile», eccezione = errore + `controller.report(e)`, cleanup = `abort()`.
- DOM: `div.popoverSection` > `label` (`span` «Modello» + `select` con `option[value=""]` «Predefinito della CLI» | «Scegli un modello», i modelli di `modelOptions(kind, model, models)` senza valori vuoti, `option[value=__custom]` «Altro…») + `input[aria-label]` (solo con «Altro…», `value={profile.model}`) + `button.link[type=button]` «Aggiorna i modelli» + `small` «non raggiungibile» (solo con errore). La select è controllata (`custom ? '__custom' : profile.model`).
- Chiamanti: `ModelChip.tsx` (`{opened && <ModelSelect profile={effective} onChange={(s) => controller.override({ ...overrides, ...s })} />}`) e `settings/AiProfilesSection.tsx` (`profile={draft}`, `onChange={(s) => setDraft({ ...draft, ...s })}`, sempre montato).
- Logica pura già estratta: `ai/models.ts` (`modelOptions`), `ai/profiles.ts` (`modelSelection`). Test: `logic.test.ts`, `modelContext.test.ts`; e2e solo indiretti (`ai-chips`, audit `model-popover`, `settings-profile`). **Scoperti**: richiesta solo a popover aperto e a ogni riapertura, «Aggiorna», scelta dall'elenco (override e pallino), «Altro…» con scrittura veloce e focus, popover riaperto senza il campo, server non raggiungibile, dettaglio del profilo nelle impostazioni; audit di «Altro…» e dell'errore.

**`src/ui/ai/ModelChip.tsx`** (140 righe; CSS: `.chip`, `.chipAnchor`, `.popover`, `.popoverSection` (+`legend`, `label`), `.popoverNote`, `.popoverActions`, `.link`)
- Props: `controller`, `onManage()`. Hook: `useT`, `useI18nStore`, `useSyncExternalStore(controller)`, `useId` (id del popover, `-privacy`, nome del gruppo di radio `-profile`), `useRef` (popover), `useState(opened)`, `useEffect([profile?.id])` → listener `toggle` (`opened = matches(':popover-open')`).
- DOM senza profilo: `button.chip[type=button]` «Gestisci profili…» → `onManage`. Con profilo: `span.chipAnchor` > `button.chip.tooltip[type=button][data-tooltip=nota][aria-label="Profilo: nome · modello"][aria-describedby=id-privacy][popovertarget=id]` (testo `nome · modello` o «Predefinito della CLI», ` •` con override, icona `chevronDown` 12) + `div#id[popover=auto].popover` > `p#id-privacy.popoverNote` (nota) + `fieldset.popoverSection` per «Locali» e «Cloud» (solo se non vuoti: `legend` + `label > input[type=radio][name=id-profile]` + nome, ` ⚠` per Anthropic senza chiave; `onChange` → `selectProfile` + `writePref('aiProfile')`) + `ModelSelect` (solo `opened`) + `hmd-ai-parameters` (`profile=effective`, `value={...profile.params, ...overrides}`, `hideEffort`, evento → `override`) + `div.popoverActions` (Salva nel profilo, Salva come nuovo, Ripristina, `button.link` Gestisci profili… che chiude il popover e chiama `onManage`).
- Logica: `ai/profiles.ts` (`effectiveProfile`, `isLocalProfile`), `lib/prefs.ts`; `privacyNote` dentro il componente. Test: e2e `ai-review` («the profile chip opens its popover…»), `ai-chips` (effort, Cloud), audit `model-popover`, `effort-chip`. **Scoperti**: gruppi e ⚠, nota privacy per locale e cloud, scelta ricordata dopo un reload, Salva/Salva come nuovo/Ripristina, Gestisci con ritorno del focus, lingua; audit di passaggio sul chip con override, gruppi, focus.

**`src/ui/ai/Composer.tsx`** (109 righe, `forwardRef<ComposerHandle>` con `sendPreset(id)`; CSS: `.composer` (+`:focus-within`), `.input`, `.row` (+`> :last-child`), `.send` (+`:disabled`), `.selection`, `.selectionClose`)
- Props: `controller`, `text`, `selection: TextRange | null`, `getSelection(): SelectionScope | undefined`, `onManage()`. Hook: `useT`, `useI18nStore`, `useSyncExternalStore`, `useState` (`request`, `ignored`), `useImperativeHandle` senza dipendenze.
- `send(presetId?)`: niente se in corso; preset trovato → la sua etichetta, altrimenti `request.trim()`; niente senza messaggio o profilo; con il chip visibile lo scope di `getSelection()` (assente → `report({ code: 'scopeLost' })`); `controller.send(…).catch(report)`; svuota la casella solo senza preset.
- DOM: `div.composer` > [`span.selection` (testo «Selezione · N righe/caratteri» + `button.selectionClose.tooltip` con icona `close` 12, ✕ = ignora quella selezione)] + `textarea.input[aria-label][placeholder]` (controllata, `composerAction` su `keydown`) + `div.row` > `ModelChip`, `hmd-ai-effort-chip`, un **solo** `button.send.tooltip` (React riusa lo stesso nodo: Invia con icona `send` 16 e `disabled` senza testo o profilo; Stop con icona `stop` durante la generazione).
- Logica pura già estratta: `ai/composerKeys.ts`, `ai/selectionChip.ts`, `ai/presetName.ts`. Test: `composerKeys.test.ts`, `selectionChip.test.ts`, `presetName.test.ts`; e2e `ai-review` (chip della selezione, ignora), `ai-chat-log`/`ai-diff`/`ai-review` (Invio). **Scoperti**: Invia spento/acceso, Shift+Invio e Ctrl+Invio, svuotamento, Stop con Esc e con il pulsante, Invio durante la generazione, scrittura mentre arriva la risposta, testo che resta con il popover, chip «N caratteri», focus dopo ✕, lingua; audit del chip della selezione, del testo scritto con il focus, della generazione in corso.

**`src/ui/ai/AiSidebar.tsx`** (58 righe; `AiSidebar.module.css` 56: `.sidebar`, `.header`, `.title`, `.iconButton` (+`:hover`), `.file`, `.bottom`)
- Props: `controller`, `text`, `selection`, `getSelection`, `onSettings(section)`, `syncNeedsPermission?`. Hook: `useT`, `useI18nStore`, `useSyncExternalStore`, `useRef<ComposerHandle>`.
- DOM: `div.sidebar` > `div.header` (`h2.title` «AI» + `button.iconButton.tooltip` «Nuova chat», icona `newFile`, `disabled` con chat vuota e niente in corso → `newChat()`) + `hmd-ai-chat-log` (`messages`, eventi `hmd-ai-open-file` → `controller.workspace.openFile`, `hmd-ai-retry` → `controller.retry`) + `div.bottom` > [`button.file` «⚠ Riattiva il permesso di sync» → `onSettings('ai-sync')`] + `Composer` (`onManage` → `onSettings('ai-profiles')`) + `hmd-ai-suggestions` (`hmd-ai-suggestion` → `composer.current?.sendPreset(id)`).
- Chiamante: `WorkspaceView.tsx` (in modalità AI al posto della testata, della ricerca e dell'albero; `getSelection` è una funzione nuova a ogni render, calcolata dalla sessione dell'editor). Test: e2e `ai-chips` (suggerimenti e Nuova chat), `ai-chat-log`. **Scoperti**: Nuova chat spenta/accesa e chat svuotata, pulsante di riattivazione della sync, lingua della testata; audit del pulsante della sync.

**Catena di contenimento.** Oggi `WorkspaceView` → `AiSidebar` → (`hmd-ai-chat-log`, `Composer` → (`ModelChip` → (`ModelSelect`, `hmd-ai-parameters`), `hmd-ai-effort-chip`), `hmd-ai-suggestions`). Con gli elementi, **chi crea i figli `hmd-*` è il loro genitore elemento**, che passa le proprietà prima dell'inserimento (`#passDown()`): la sidebar crea registro, composer e suggerimenti; il composer crea chip del modello e chip dell'effort; il chip crea parametri e (a popover aperto) il selettore. Controller (con un'interfaccia minima per elemento: `ModelSelectController` ⊂ `ModelChipController` ⊂ `ComposerController` ⊂ `SidebarController`, tutte `Pick` di `AiController`), `i18n`, `text`, `selection`, `getSelection` scendono come proprietà; verso `WorkspaceView` salgono solo `hmd-ai-manage` (dal chip) e `hmd-ai-sync-reactivate` (dalla sidebar). Il resto (override, profilo, invio, stop, nuova chat, riprova, apertura di un file, preset dei suggerimenti) è chiamata al controller dentro gli elementi, come facevano i componenti.

### Divisione

La 6b è il sottoalbero chiuso della sidebar AI: quattro componenti, due moduli CSS (`Composer.module.css` condiviso da tre), un chiamante esterno (`WorkspaceView`) più il secondo chiamante di `ModelSelect` nelle impostazioni. **Ordine della spec confermato: dal fondo verso l'alto**, `hmd-ai-model-select` → `hmd-ai-model-chip` → `hmd-ai-composer` → `hmd-ai-sidebar`, un elemento per task. Così ogni passo intermedio ha un **genitore React che monta l'elemento nuovo** e l'elemento nuovo **non ospita mai componenti React** (contiene solo elementi già migrati): nessun ponte React-dentro-elemento, che sarebbe il passo costoso. L'ordine inverso (sidebar per prima) costringerebbe la sidebar a ospitare un `Composer` React. `Composer.module.css` resta finché il suo ultimo utente (`Composer.tsx`) non sparisce nel Task 5; fino ad allora le sue classi restano anche se in parte senza utenti (nessun effetto: sono classi con hash).

Passi intermedi (l'app funziona dopo ognuno):

- **dopo il Task 3** (`hmd-ai-model-select`): `ModelChip.tsx` monta `{opened && <hmd-ai-model-select controller profile={effective} i18n onhmd-ai-model-change={…override…} />}` (React lo crea e lo toglie con `opened`: un'istanza nuova a ogni apertura, come prima); `AiProfilesSection.tsx` monta `<hmd-ai-model-select controller profile={draft} i18n onhmd-ai-model-change={…setDraft…} />`.
- **dopo il Task 4** (`hmd-ai-model-chip`): `Composer.tsx` monta `<hmd-ai-model-chip controller i18n onhmd-ai-manage={onManage} />`; il chip crea `hmd-ai-parameters` e, a popover aperto, `hmd-ai-model-select`.
- **dopo il Task 5** (`hmd-ai-composer`): `AiSidebar.tsx` monta `<hmd-ai-composer ref={composer} controller text selection getSelection i18n onhmd-ai-manage={() => onSettings('ai-profiles')} />` e chiama `composer.current?.sendPreset(id)` dai suggerimenti; il composer crea i due chip.
- **dopo il Task 6** (`hmd-ai-sidebar`): `WorkspaceView.tsx` monta `<hmd-ai-sidebar … onhmd-ai-manage={() => openSettings('ai-profiles')} onhmd-ai-sync-reactivate={() => openSettings('ai-sync')} />`; `sendPreset` diventa un dettaglio interno della sidebar.

Prima degli elementi, il **Task 2** estrae lo schema di render della 6a in `src/dom/renderLoop.ts` e lo applica ai tre pannelli (decisione 2): i quattro elementi nuovi lo usano da subito.

Ordine della 6b: rete (Task 1) → `RenderLoop` (Task 2) → selettore (Task 3) → chip (Task 4) → composer (Task 5) → sidebar (Task 6) → documenti e chiusura (Task 7).

### Decisioni (da confermare con Davide; tra parentesi la raccomandazione)

1. **Ordine e divisione come sopra** (sì): spec confermata, dal fondo (selettore) alla sidebar, un elemento per task; il Task 3 monta il selettore anche nelle impostazioni (secondo chiamante, che l'ipotesi di partenza non contava).
2. **Estrarre lo schema di render in `src/dom/renderLoop.ts`** (sì): tre elementi della 6a lo copiano identico e ne arrivano quattro (sette con la 6c); la copia è dove sono nati i tre MAJOR della review di Codex della 6a (focus recuperato tra due passate, prerequisiti non ricontrollati). `RenderLoop` (classe, non metodo di `HmdElement`, così tocca solo chi lo usa) prende `ready`, `render` e facoltativi `focusScope`/`refocus`, espone `rendering` (l'albero lo usa nel `focusin`). Il Task 2 lo introduce con 7 test e lo applica ad albero, ricerca e cronologia **senza cambiarne il comportamento** (i loro 68 test jsdom e i 47 e2e restano verdi). Per non farlo: si toglie il Task 2 e i quattro elementi copiano il ciclo `#update()` della cronologia (con `#rendering`/`#again`).
3. **Focus su un bersaglio stabile quando il nodo che lo ha sparisce** (sì): come la decisione 3 della 6a e la spec R2. Oggi la ✕ del chip della selezione cliccata sparisce e il focus cade sul `body` (misurato); dopo va nella casella del composer. Nel chip del modello, nei casi rari in cui il nodo con il focus sparisce (un profilo tolto a popover aperto, per esempio da una sync; il chip che diventa «Gestisci profili» perché non restano profili, o il contrario), il focus va sul chip. Non cambia l'aspetto. Per la fedeltà stretta si tolgono `focusScope`/`refocus` dai due elementi e si lascia il test del Task 1 nella forma di oggi.
4. **Pulsanti che si disattivano con il focus: lasciati come oggi** (sì, cioè non toccarli in 6b): Invia dopo l'invio con il mouse (la casella si svuota e Invia si spegne prima che parta la generazione), Invia dopo Stop, Nuova chat. Chromium lascia il focus sul pulsante e lo sposta sul `body` un fotogramma dopo, con un `blur` (misurato): recuperarlo vorrebbe un listener `blur` fuori dal render, cioè un meccanismo nuovo. Da rivalutare nella fase 8 (passata di accessibilità) insieme a «Scarta» della 6c. L'e2e «New chat waits for a message…» afferma il comportamento di oggi.
5. **Ingressi e uscite** (sì): `hmd-ai-model-select` riceve `controller` (`ModelSelectController` = `Pick<AiController, 'provider' | 'report'>`), `profile`, `i18n` e manda `hmd-ai-model-change` `{ selection }`; `hmd-ai-model-chip` riceve `controller` (`ModelChipController`), `i18n` e manda `hmd-ai-manage`; `hmd-ai-composer` riceve `controller` (`ComposerController`), `text`, `selection`, `getSelection`, `i18n` e ha `sendPreset(presetId)`; `hmd-ai-sidebar` riceve `controller` (`SidebarController`, con `workspace: Pick<AiWorkspace, 'openFile'>`), `text`, `selection`, `getSelection`, `syncNeedsPermission`, `i18n` e manda `hmd-ai-sync-reactivate` (e lascia salire `hmd-ai-manage`). Due eventi distinti verso `WorkspaceView` invece di un `hmd-ai-settings { section }` comune: un evento, un elemento che lo manda (la regola del bubbling).
6. **Niente `focus()` pubblico sul composer** (sì): la spec §7 lo elenca, ma oggi nessuno mette il focus nel composer da fuori; si aggiorna la spec (Task 7) invece di aggiungere un metodo senza chiamanti. Per aggiungerlo: `focus(): void { this.#parts?.input.focus(); }` più un test.
7. **Piccole deviazioni invisibili** (sì): (a) il selettore tiene una volta sola un valore di modello doppio nell'elenco del server (React lo mostrava due volte con un avviso di chiave doppia; `reconcileList` lancerebbe); (b) il chip dimentica che il popover era aperto quando lo si stacca o quando restano zero profili (React teneva `opened` e avrebbe chiesto l'elenco dei modelli con il popover chiuso al ritorno del profilo); (c) testi composti in un solo nodo di testo (`nome · modello •`, `nome ⚠`, `⚠ Riattiva…`) invece di due o tre (stesso testo, stessi pixel).
8. **`jsx.d.ts` dice solo quello che React monta** (sì): a ogni task si tolgono i tag che React non monta più (`hmd-ai-effort-chip` e `hmd-ai-model-chip` nel Task 5; `hmd-ai-chat-log`, `hmd-ai-composer`, `hmd-ai-suggestions` nel Task 6); `hmd-ai-model-select` e `hmd-ai-parameters` restano (le impostazioni li montano). Il file sparisce nella fase 7.

## Review Focus

1. **La casella del composer mentre si scrive e mentre arriva la risposta**: mai ricreata né riscritta da una notifica del controller, da un testo nuovo del documento o da un cambio di parametri; nessun carattere perso, cursore e focus che restano; svuotata solo dopo l'invio di un testo; Invio durante la generazione non invia una seconda volta e non svuota. Test jsdom del Task 5 («the box is never rewritten…», «while running the button is Stop…», «Enter sends the trimmed text…») + `ai-composer.spec.ts` («typing while the reply arrives…», «what is typed stays…», «while the reply is generated…»).
2. **Elenco dei modelli tardivo o superato**: una risposta o un errore dopo il distacco (popover chiuso a metà richiesta) o dopo una richiesta più nuova non tocca il DOM e non segnala errori; la richiesta si interrompe; ricollegato si richiede; un profilo con stesso tipo, indirizzo e chiave non richiede; nessuna rete fuori dal controller. Test jsdom del Task 3 («detached, the request is aborted…», «a failure after detaching…», «a failure of a superseded request…», «an answer superseded…», «the list is asked again only for…») + test statico di `architecture.test.ts` + `ai-model.spec.ts` («the model list is asked only with the popover open…»).
3. **Echi della select e del campo «Altro…»**: la scelta dell'utente non si riscrive con il modello vecchio prima che il genitore (React, asincrono) applichi l'override; il campo con il focus non si riscrive con un eco in ritardo; senza focus segue il modello. Test jsdom del Task 3 («the select is not written back…», «Other… opens the free field…», «without the focus the free field follows…», «a model changed outside while the free field has the focus…», «the focused free field removed by a choice…») + `ai-model.spec.ts` («Other… gives a text field…») + impostazioni («in the profile settings…»).
4. **Ciclo di vita del popover del chip**: selettore nuovo a ogni apertura e tolto alla chiusura, staccato e ricollegato a popover aperto senza richieste fantasma, «Gestisci profili…» che chiude e riporta il focus al chip dopo le impostazioni, profili che compaiono e spariscono con il focus sul chip. Test jsdom del Task 4 («the model select is there only while…», «a late toggle that says open…», «profiles gone and back with the popover open…», «detached with the popover open…», «profiles appearing and disappearing…», «the focused radio of a profile that goes away…») + `ai-model.spec.ts` («Manage profiles…», «the popover opened again…»).
5. **Aspetto identico negli stati che oggi nessuno fotografa**: chip della selezione, testo scritto con il focus (bordo `:focus-within`), generazione in corso (Stop), passaggio sul chip con override, gruppi Locali/Cloud con ⚠, «Altro…» con il campo, server non raggiungibile, pulsante di riattivazione della sync, selettore nelle impostazioni. Stati di audit del Task 1 (più `settings-profile`, `model-popover`), verdi contro `dist-baseline/` nei Task 3–6.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/ai-model.spec.ts`, `e2e/ai-composer.spec.ts`, `e2e/support/aiHarness.ts`, `e2e/computed-styles.audit.ts` | Rete di sicurezza (Task 1): comportamenti scoperti di selettore, chip, composer e sidebar; finto Ollama con elenco dei modelli configurabile, server spento e risposte trattenute; 8 stati di audit nuovi. |
| `src/dom/renderLoop.ts` (+ test) | `RenderLoop`: un render alla volta, prerequisiti a ogni passata, focus recuperato contro il DOM finito (Task 2). |
| `src/elements/file-tree/file-tree.element.ts`, `search-panel/search-panel.element.ts`, `history-panel/history-panel.element.ts` | Usano `RenderLoop` al posto del ciclo copiato (Task 2). |
| `src/elements/ai/modelSelectView.ts` (+ test) | `CUSTOM`, `ModelSelectController`, `modelSelectOptions`, `selectValue`, `modelListKey`. |
| `src/elements/ai/model-select.element.ts`, `model-select.css` (+ `.dom.test.ts`) | `hmd-ai-model-select`. |
| `src/elements/ai/modelChipView.ts` (+ test) | `ModelChipController`, `privacyNote`, `chipLabel`, `hasOverrides`, `profileGroups`, `profileName`, `groupRows`, `groupRowKey`, `popoverParts`. |
| `src/elements/ai/model-chip.element.ts`, `model-chip.css` (+ `.dom.test.ts`) | `hmd-ai-model-chip`. |
| `src/elements/ai/composerView.ts` (+ test) | `ComposerController`, `selectionChipText`, `outgoing`, `sendButton`. |
| `src/elements/ai/composer.element.ts`, `composer.css` (+ `.dom.test.ts`) | `hmd-ai-composer`. |
| `src/elements/ai/sidebar.element.ts`, `sidebar.css` (+ `.dom.test.ts`) | `hmd-ai-sidebar`, `SidebarController`. |
| `src/testing/popoverStub.ts` | Anche `matches(':popover-open')` dall'attributo di prova (Task 4). |
| `src/testing/fakeAi.ts` | Controller finto esteso (profilo attivo da `profileId`, `calls`, `reports`, `models`) per chip, composer e sidebar (Task 4). |
| `src/architecture.test.ts` | Test statico: elementi senza import dei provider né accesso alle chiavi (Task 3). |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi (`hmd-ai-model-change`, `hmd-ai-manage`, `hmd-ai-sync-reactivate`), tipi JSX. |
| `src/ui/ai/settings/AiProfilesSection.tsx`, `src/ui/WorkspaceView.tsx` | Montano `hmd-ai-model-select` e `hmd-ai-sidebar`. |
| `src/ui/ai/ModelSelect.tsx`, `ModelChip.tsx`, `Composer.tsx`, `Composer.module.css`, `AiSidebar.tsx`, `AiSidebar.module.css` | Cancellati (Task 3–6). |
| `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` | Stato, §7 fase 6, §13 (Task 7). |

---
### Task 1: Baseline e rete di sicurezza sulla sidebar AI di oggi

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**.

**Files:**
- Create: `e2e/ai-model.spec.ts`, `e2e/ai-composer.spec.ts`
- Modify: `e2e/support/aiHarness.ts` (elenco dei modelli configurabile, server spento, risposte trattenute), `e2e/computed-styles.audit.ts` (8 stati nuovi)

**Interfaces:**
- Produces: `FakeModel.models: string[]`, `FakeModel.modelLists: number`, `FakeModel.modelsDown: boolean`, `FakeModel.hold(): void`, `FakeModel.release(): void`; il test «ignoring the selection with ✕: where the focus goes» (focus sul `body` di oggi, rovesciato dal Task 5); gli stati di audit `ai-composer-selection`, `ai-composer-typed`, `ai-composer-running`, `model-chip-hover`, `model-popover-groups`, `model-popover-custom`, `model-popover-unreachable`, `ai-sync-reactivate`.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short && git log --oneline -1       # pulito, 547f529 o il commit del piano
npm test                                          # annotare (11/10: 848)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (11/10: 437 013)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 6b
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla**.

- [ ] **Step 2: Il finto Ollama impara tre cose**

In `e2e/support/aiHarness.ts`, dopo `errorBody = '';`:

```ts
  /** Modelli dell'elenco (`/api/tags`), e quante volte l'app lo ha chiesto. */
  models = ['qwen3.6:35b-mlx'];
  modelLists = 0;
  /** true = il server dei modelli non risponde (connessione rifiutata): l'elenco è «non raggiungibile». */
  modelsDown = false;
  /** Risposte di chat trattenute finché `release()`: per vedere la generazione in corso. */
  #held: (() => void)[] | null = null;

  hold(): void {
    this.#held ??= [];
  }

  release(): void {
    const held = this.#held ?? [];
    this.#held = null;
    for (const go of held) go();
  }
```

e in `#answer` il ramo dell'elenco e l'inizio delle risposte di chat diventano:

```ts
    if (request.url().includes('/api/tags')) {
      this.modelLists++;
      if (this.modelsDown) {
        await route.abort('connectionrefused');
        return;
      }
      await route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ models: this.models.map((name) => ({ name })) }) });
      return;
    }
    this.requests++;
    const held = this.#held;
    if (held) await new Promise<void>((go) => held.push(go));
```

(il resto di `#answer` non cambia; l'elenco di default è quello di prima, quindi snapshot e audit esistenti non cambiano). Una risposta trattenuta e mai rilasciata (Stop) resta in attesa: quando la richiesta è interrotta `route.fulfill` lancia e `install` lo ignora già.

- [ ] **Step 3: E2e di selettore e chip del modello scoperti oggi**

`e2e/ai-model.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const chip = (app: App) => app.page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
/** Il nome accessibile della select comprende anche l'opzione scelta: si cerca per sottostringa. */
const models = (app: App) => app.page.getByRole('combobox', { name: app.t('ai.model') });
const customModel = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.model'), exact: true });
const refresh = (app: App) => app.page.getByRole('button', { name: app.t('ai.refresh') });
const temperature = (app: App) => app.page.getByRole('spinbutton', { name: app.t('ai.param.temperature') });
const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function enterAi(app: App): Promise<void> {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(chip(app)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Nessuna richiesta verso provider cloud: un profilo Anthropic senza chiave non deve uscire in rete.
  await page.route('https://api.anthropic.com/**', (route) => route.abort());
});

test('the model list is asked only with the popover open, again with Refresh and at every opening', async ({ app, ai, page }) => {
  ai.models = ['qwen3.6:35b-mlx', 'llama3:8b'];
  await enterAi(app);
  expect(ai.modelLists).toBe(0);
  await chip(app).click();
  await expect(models(app).getByRole('option', { name: 'llama3:8b' })).toHaveCount(1);
  expect(ai.modelLists).toBe(1);
  await refresh(app).click();
  await expect.poll(() => ai.modelLists).toBe(2);
  await page.keyboard.press('Escape');
  // Chiuso il popover, il selettore del modello non c'è più (come con React: smontato).
  await expect(models(app)).toHaveCount(0);
  await chip(app).click();
  await expect.poll(() => ai.modelLists).toBe(3);
  await expect(models(app)).toBeVisible();
});

test('a model chosen from the list changes the chip and marks the override; Reset brings the profile model back', async ({ app, ai, page }) => {
  ai.models = ['qwen3.6:35b-mlx', 'llama3:8b'];
  await enterAi(app);
  await chip(app).click();
  await expect(models(app).getByRole('option', { name: 'llama3:8b' })).toHaveCount(1);
  await models(app).selectOption('llama3:8b');
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · llama3:8b`);
  await expect(chip(app)).toContainText('•');
  await page.getByRole('button', { name: app.t('ai.reset'), exact: true }).click();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · qwen3.6:35b-mlx`);
  await expect(chip(app)).not.toContainText('•');
  await expect(models(app)).toHaveValue('qwen3.6:35b-mlx');
});

test('Other… gives a text field: every character typed reaches the chip and the field keeps the focus', async ({ app }) => {
  await enterAi(app);
  await chip(app).click();
  await models(app).selectOption('__custom');
  await expect(customModel(app)).toHaveValue('qwen3.6:35b-mlx');
  await customModel(app).fill('');
  await customModel(app).pressSequentially('my-model:1b');
  await expect(customModel(app)).toHaveValue('my-model:1b');
  await expect(customModel(app)).toBeFocused();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · my-model:1b`);
  await expect(models(app)).toHaveValue('__custom');
});

test('the popover opened again starts from the list, without the text field', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await models(app).selectOption('__custom');
  await expect(customModel(app)).toBeVisible();
  await page.keyboard.press('Escape');
  await chip(app).click();
  await expect(models(app)).toBeVisible();
  await expect(customModel(app)).toHaveCount(0);
});

test.describe('model server down', () => {
  // Solo la diagnostica di Chromium per la connessione rifiutata del finto Ollama.
  test.use({ expectedConsole: [/^Failed to load resource: net::ERR_CONNECTION_REFUSED/] });

  test('an unreachable server is said under the list; Refresh asks again', async ({ app, ai }) => {
    ai.modelsDown = true;
    await enterAi(app);
    await chip(app).click();
    const unreachable = app.page.getByText(app.t('ai.error.unreachable'), { exact: true });
    await expect(unreachable).toBeVisible();
    ai.modelsDown = false;
    await refresh(app).click();
    await expect(unreachable).toHaveCount(0);
    await expect(models(app).getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
  });
});

test('profiles grouped Local and Cloud, a cloud profile without key marked; the privacy note and the choice follow the profile, also after a reload', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.createProfile('anthropic', 'Cloud');
  await app.mode('mode.ai').click();
  await expect(chip(app)).toHaveAccessibleDescription(app.t('ai.localPrivacy'));
  await chip(app).click();
  const local = page.getByRole('group', { name: app.t('ai.local') });
  const cloud = page.getByRole('group', { name: app.t('ai.cloud') });
  await expect(local.getByRole('radio', { name: 'ollama', exact: true })).toBeChecked();
  await cloud.getByRole('radio', { name: 'Cloud ⚠', exact: true }).check();
  await expect(chip(app)).toHaveAccessibleName(new RegExp(`^${app.t('ai.profile')}: Cloud · `));
  await expect(chip(app)).toHaveAccessibleDescription(app.t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  await page.reload();
  await expect(chip(app)).toHaveAccessibleName(new RegExp(`^${app.t('ai.profile')}: Cloud · `));
});

test('a temperature changed in the popover marks the override; Save as new profile adds a profile with it, Save profile keeps it', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await temperature(app).fill('0.9');
  await expect(chip(app)).toContainText('•');
  await page.getByRole('button', { name: app.t('ai.saveAs'), exact: true }).click();
  const local = page.getByRole('group', { name: app.t('ai.local') });
  await expect(local.getByRole('radio')).toHaveCount(2);
  await expect(chip(app)).not.toContainText('•');
  await expect(temperature(app)).toHaveValue('0.9');
  // Il profilo di prima ha ancora la temperatura predefinita.
  await local.getByRole('radio', { checked: false }).check();
  await expect(temperature(app)).toHaveValue('0.3');
  await temperature(app).fill('0.5');
  await page.getByRole('button', { name: app.t('ai.saveProfile'), exact: true }).click();
  await expect(chip(app)).not.toContainText('•');
  await page.keyboard.press('Escape');
  await chip(app).click();
  await expect(temperature(app)).toHaveValue('0.5');
});

test('Manage profiles… opens the profile settings; closing them brings the focus back to the chip', async ({ app, page }) => {
  await enterAi(app);
  await chip(app).click();
  await page.getByRole('button', { name: app.t('ai.manage') }).click();
  await expect(page).toHaveURL(/#settings\/ai-profiles$/);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await expect(chip(app)).toBeFocused();
});

test('the chip and its popover follow the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await enterAi(app);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const itChip = page.getByRole('button', { name: new RegExp(`^${it('ai.profile')}: `) });
  await expect(itChip).toHaveAccessibleDescription(it('ai.localPrivacy'));
  await itChip.click();
  await expect(page.getByRole('group', { name: it('ai.local') })).toBeVisible();
  await expect(page.getByRole('combobox', { name: it('ai.model') })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.refresh') })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.saveProfile'), exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: it('ai.manage') })).toBeVisible();
});

test('in the profile settings the model list loads, and a model typed in Other… is saved with the profile', async ({ app }) => {
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  const select = settings(app).getByRole('combobox', { name: app.t('ai.model') });
  await expect(select.getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
  await select.selectOption('__custom');
  const field = settings(app).getByRole('textbox', { name: app.t('ai.model'), exact: true });
  await field.fill('typed:1b');
  await expect(field).toHaveValue('typed:1b');
  await expect(field).toBeFocused();
  await settings(app).getByRole('button', { name: app.t('ai.save'), exact: true }).first().click();
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await app.mode('mode.ai').click();
  await expect(chip(app)).toHaveAccessibleName(`${app.t('ai.profile')}: ollama · typed:1b`);
});
```

- [ ] **Step 4: E2e di composer e sidebar scoperti oggi**

`e2e/ai-composer.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const send = (app: App) => app.page.getByRole('button', { name: app.t('ai.send'), exact: true });
const stop = (app: App) => app.page.getByRole('button', { name: app.t('ai.stop'), exact: true });
const newChat = (app: App) => app.page.getByRole('button', { name: app.t('ai.newChat') });
const log = (app: App) => app.page.getByRole('log');
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const chip = (app: App) => app.page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
const focusOnBody = (app: App) => app.page.evaluate(() => document.activeElement === document.body);

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

test.describe('composer', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': 'uno\ndue\ntre', 'b.md': 'B' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('Send waits for some text; Shift+Enter and Ctrl+Enter do not send; Enter sends and empties the box', async ({ app, ai }) => {
    await expect(send(app)).toBeDisabled();
    await composer(app).fill('   ');
    await expect(send(app)).toBeDisabled();
    await composer(app).fill('first');
    await expect(send(app)).toBeEnabled();
    await composer(app).press('Control+Enter');
    await composer(app).press('Shift+Enter');
    await composer(app).pressSequentially('second');
    await expect(composer(app)).toHaveValue('first\nsecond');
    expect(ai.requests).toBe(0);
    await composer(app).press('Enter');
    await expect.poll(() => ai.requests).toBe(1);
    await expect(composer(app)).toHaveValue('');
    await expect(send(app)).toBeDisabled();
  });

  test('while the reply is generated the button is Stop and Enter does not send again; Escape in the box stops it', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(stop(app)).toBeVisible();
    await expect(send(app)).toHaveCount(0);
    await expect(composer(app)).toBeFocused();
    await composer(app).pressSequentially('more');
    await composer(app).press('Enter');
    await expect(composer(app)).toHaveValue('more');
    expect(ai.requests).toBe(1);
    await composer(app).press('Escape');
    await expect(send(app)).toBeEnabled();
    await expect(stop(app)).toHaveCount(0);
    ai.release();
  });

  test('the Stop button stops the generation', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await send(app).click();
    await stop(app).click();
    await expect(send(app)).toBeVisible();
    await expect(stop(app)).toHaveCount(0);
    ai.release();
  });

  test('typing while the reply arrives keeps every character and the focus', async ({ app, ai }) => {
    ai.hold();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await composer(app).pressSequentially('next question');
    ai.release();
    await composer(app).pressSequentially(' and more');
    await expect(acceptAll(app)).toBeEnabled();
    await expect(composer(app)).toHaveValue('next question and more');
    await expect(composer(app)).toBeFocused();
  });

  test('what is typed stays while the model popover changes the parameters', async ({ app, page }) => {
    await composer(app).fill('keep me');
    await chip(app).click();
    await page.getByRole('spinbutton', { name: app.t('ai.param.temperature') }).fill('1');
    await page.keyboard.press('Escape');
    await expect(composer(app)).toHaveValue('keep me');
    await composer(app).press('End');
    await composer(app).pressSequentially(' too');
    await expect(composer(app)).toHaveValue('keep me too');
  });

  test('the selection chip counts the characters of a one-line selection; ✕ hides it, a different selection brings it back', async ({ app, page }) => {
    await app.mode('mode.editor').click();
    await app.selectRange(0, 3); // "uno"
    await enterAi(app);
    const chars = page.getByText(app.t('ai.selectionChars', { count: 3 }), { exact: true });
    await expect(chars).toBeVisible();
    await page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    await expect(chars).toHaveCount(0);
    await app.mode('mode.editor').click();
    await app.selectRange(4, 11); // "due\ntre"
    await enterAi(app);
    await expect(page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
  });

  test('ignoring the selection with ✕: where the focus goes', async ({ app, page }) => {
    await app.mode('mode.editor').click();
    await app.selectRange(0, 3);
    await enterAi(app);
    await page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    // Difetto di oggi (React): il ✕ sparisce con il focus e il focus cade sul body. Il Task 5 lo rovescia (decisione 3).
    await expect.poll(() => focusOnBody(app)).toBe(true);
  });

  test('the composer and the sidebar follow the interface language', async ({ app, page }) => {
    const it = (key: string) => translate(messagesFor('it'), key);
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await page.getByLabel(app.t('settings.language')).selectOption('it');
    await page.getByRole('button', { name: it('settings.close') }).click();
    const box = page.getByRole('textbox', { name: it('ai.request') });
    await expect(box).toHaveAttribute('placeholder', it('ai.request'));
    await expect(page.getByRole('heading', { name: it('ai.title') })).toBeVisible();
    await expect(page.getByRole('button', { name: it('ai.newChat') })).toBeDisabled();
    await expect(page.getByRole('button', { name: it('ai.send'), exact: true })).toBeDisabled();
    await box.fill('ciao');
    await expect(page.getByRole('button', { name: it('ai.send'), exact: true })).toBeEnabled();
  });
});

test.describe('sidebar', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': '# Alpha' });
    await app.openFile('a.md');
  });

  test('New chat waits for a message, empties the chat and is disabled again', async ({ app }) => {
    await enterAi(app);
    await expect(app.page.getByRole('heading', { name: app.t('ai.title') })).toBeVisible();
    await expect(newChat(app)).toBeDisabled();
    await composer(app).fill('fix');
    await composer(app).press('Enter');
    await expect(acceptAll(app)).toBeEnabled();
    await expect(newChat(app)).toBeEnabled();
    await newChat(app).click();
    await expect(log(app).getByRole('article')).toHaveCount(0);
    await expect(newChat(app)).toBeDisabled();
    // Comportamento di oggi, conservato (decisione 4): il pulsante si disattiva con il focus e Chromium lo porta sul body.
    await expect.poll(() => focusOnBody(app)).toBe(true);
  });

  test('a sync folder without permission: the sidebar offers to reactivate it, the button opens the sync settings', async ({ app, page }) => {
    const settings = page.getByRole('region', { name: app.t('settings.title') });
    await expect(app.mode('mode.ai')).toBeVisible();
    await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
    await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
    await app.setFlags({ folder: 'sync' });
    await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
    await expect(settings.getByRole('button', { name: app.t('ai.syncDisable') })).toBeVisible();
    await settings.getByRole('button', { name: app.t('settings.close') }).click();
    // Al prossimo avvio il browser chiede di nuovo il permesso, anche per la cartella di sync.
    await app.setFlags({ query: 'prompt', request: 'granted' });
    await page.reload();
    await page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) }).click();
    await enterAi(app);
    const reactivate = page.getByRole('button', { name: `⚠ ${app.t('ai.syncReactivate')}` });
    await expect(reactivate).toBeVisible();
    await reactivate.click();
    await expect(page).toHaveURL(/#settings\/ai-sync$/);
    await expect(settings.getByRole('button', { name: app.t('ai.syncReactivate') })).toBeVisible();
  });
});
```

Note per chi esegue:
- Se un **localizzatore** non trova l'elemento sull'app di oggi, si corregge il localizzatore (ruolo e nome da `en.json`), mai l'asserzione sul comportamento. Se il comportamento di oggi è diverso, fermarsi e riportarlo.
- «ignoring the selection with ✕: where the focus goes» **afferma il difetto di oggi** (focus sul `body`, misurato l'11/10 in build e in sviluppo); «New chat waits for a message…» afferma il focus sul `body` dopo Nuova chat (decisione 4: resta così). Se il focus non cadesse sul `body`, fermarsi e riportarlo. Nessun `test.fail`.
- Il nome accessibile della select del modello comprende l'opzione scelta (etichetta del `<label>`): la si cerca per sottostringa (`{ name: app.t('ai.model') }` senza `exact`); il campo «Altro…» è un `textbox` con nome esatto.
- La sync senza permesso: si sceglie una cartella di sync dalle impostazioni (la sottocartella `sync` del finto selettore), poi un riavvio con `query: 'prompt'` riprende la cartella di lavoro ma lascia la sync senza permesso.
- `expectedConsole` del gruppo «model server down»: senza, `test:e2e:dev` fallisce sulla diagnostica di Chromium per la connessione rifiutata (misurato). Nessun altro test lo usa.

- [ ] **Step 5: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, nell'array `STATES`, subito **prima** dello stato `tree-menu` (cioè dopo `ai-chat-summary`):

```ts
  {
    name: 'ai-composer-selection',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'uno\ndue\ntre' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.editor').click();
      await app.selectRange(0, 7);
      await app.mode('mode.ai').click();
      await expect(page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'ai-composer-typed',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Testo scritto (Invia attivo) e casella con il focus (bordo del composer con :focus-within).
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix this');
      await expect(page.getByRole('button', { name: app.t('ai.send'), exact: true })).toBeEnabled();
      await expect(composer).toBeFocused();
    },
  },
  {
    name: 'ai-composer-running',
    async setup(app, page, ai) {
      ai.hold();
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.stop'), exact: true })).toBeVisible();
    },
  },
  {
    name: 'model-chip-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      // Un override (pallino nel chip), poi il puntatore sul chip: sfondo e tooltip con la nota privacy.
      const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
      await chip.click();
      await page.getByRole('spinbutton', { name: app.t('ai.param.temperature') }).fill('1');
      await page.keyboard.press('Escape');
      await expect(chip).toContainText('•');
      await chip.hover();
      await expect.poll(() => chip.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'model-popover-groups',
    async setup(app, page) {
      await page.route('https://api.anthropic.com/**', (route) => route.abort());
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.createProfile('anthropic', 'Cloud');
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByRole('group', { name: app.t('ai.cloud') }).getByRole('radio', { name: 'Cloud ⚠' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: app.t('ai.model') }).getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
    },
  },
  {
    name: 'model-popover-custom',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      const models = page.getByRole('combobox', { name: app.t('ai.model') });
      await expect(models.getByRole('option', { name: 'qwen3.6:35b-mlx' })).toHaveCount(1);
      await models.selectOption('__custom');
      await expect(page.getByRole('textbox', { name: app.t('ai.model'), exact: true })).toBeVisible();
    },
  },
  {
    name: 'model-popover-unreachable',
    async setup(app, page, ai) {
      ai.modelsDown = true;
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByText(app.t('ai.error.unreachable'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'ai-sync-reactivate',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      // Cartella di sync scelta, poi un avvio senza permesso: la sidebar AI propone di riattivarla.
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await settings.getByRole('link', { name: app.t('settings.aiSync') }).click();
      await app.setFlags({ folder: 'sync' });
      await settings.getByRole('button', { name: app.t('ai.syncChoose') }).click();
      await expect(settings.getByRole('button', { name: app.t('ai.syncDisable') })).toBeVisible();
      await settings.getByRole('button', { name: app.t('settings.close') }).click();
      await app.setFlags({ query: 'prompt', request: 'granted' });
      await page.reload();
      await page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) }).click();
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByRole('button', { name: `⚠ ${app.t('ai.syncReactivate')}` })).toBeVisible();
    },
  },
```

- [ ] **Step 6: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: 155 + 20 = 175
npx playwright test -c e2e/playwright.config.ts e2e/ai-model.spec.ts e2e/ai-composer.spec.ts --repeat-each=5
npm run test:e2e:dev        # annotare: 140 + 20 = 160
npm run test:e2e:audit      # annotare: 84 + 16 = 100 (due test per stato)
```

Expected: tutto verde, nessuna ripetizione instabile.

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete su selettore e chip del modello, composer e sidebar AI (focus perso, elenco dei modelli, stati di audit) prima della 6b"
```

---

### Task 2: `RenderLoop`, lo schema di render della 6a in un helper

Nessun cambio di comportamento: i tre pannelli della 6a usano l'helper al posto del ciclo copiato.

**Files:**
- Create: `src/dom/renderLoop.ts`, `src/dom/renderLoop.test.ts`
- Modify: `src/elements/file-tree/file-tree.element.ts`, `src/elements/search-panel/search-panel.element.ts`, `src/elements/history-panel/history-panel.element.ts`

**Interfaces:**
- Produces: `interface RenderLoopOptions { ready(): boolean; render(): void; focusScope?(): Element | null; refocus?(): void }` e `class RenderLoop { constructor(host: Element, options: RenderLoopOptions); readonly rendering: boolean; update(): void }` da `src/dom/renderLoop.ts`. Ogni elemento dei Task 3–6 lo usa così: `#loop = new RenderLoop(this, { ready: () => …, render: () => this.#render(…) })` e chiama solo `this.#loop.update()`.

- [ ] **Step 1: Test che falliscono**

`src/dom/renderLoop.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { RenderLoop, type RenderLoopOptions } from './renderLoop';

test.afterEach(() => document.body.replaceChildren());

/** Un host collegato, un contatore delle passate e il loop; `pass` personalizza la passata. */
function setup(options: Partial<RenderLoopOptions> = {}, pass: (n: number) => void = () => {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const state = { ready: true, passes: 0, depth: 0, maxDepth: 0 };
  const loop: RenderLoop = new RenderLoop(host, {
    ready: () => state.ready && host.isConnected,
    render: () => {
      state.depth++;
      state.maxDepth = Math.max(state.maxDepth, state.depth);
      state.passes++;
      try {
        pass(state.passes);
      } finally {
        state.depth--;
      }
    },
    ...options,
  });
  return { host, state, loop };
}

test('one pass per update, none before the prerequisites', () => {
  const { state, loop } = setup();
  state.ready = false;
  loop.update();
  assert.equal(state.passes, 0);
  state.ready = true;
  loop.update();
  loop.update();
  assert.equal(state.passes, 2);
});

test('an update asked during a pass runs one more pass after it, never nested', () => {
  let loop!: RenderLoop;
  const ctx = setup({}, (n) => {
    if (n === 1) {
      loop.update();
      loop.update();
    }
  });
  loop = ctx.loop;
  loop.update();
  assert.equal(ctx.state.passes, 2);
  assert.equal(ctx.state.maxDepth, 1);
});

test('rendering is true only during the passes', () => {
  const seen: boolean[] = [];
  let loop!: RenderLoop;
  const ctx = setup({}, () => seen.push(loop.rendering));
  loop = ctx.loop;
  assert.equal(loop.rendering, false);
  loop.update();
  assert.deepEqual(seen, [true]);
  assert.equal(loop.rendering, false);
});

test('the prerequisites are checked before every pass: a pass that detaches the host is the last one', () => {
  let loop!: RenderLoop;
  const ctx = setup({}, (n) => {
    if (n === 1) {
      loop.update();
      ctx.host.remove();
    }
  });
  loop = ctx.loop;
  loop.update();
  assert.equal(ctx.state.passes, 1);
});

test('a pass that throws leaves the loop usable', () => {
  let fail = true;
  const ctx = setup({}, () => {
    if (fail) throw new Error('boom');
  });
  assert.throws(() => ctx.loop.update(), /boom/);
  assert.equal(ctx.loop.rendering, false);
  fail = false;
  ctx.loop.update();
  assert.equal(ctx.state.passes, 2);
});

test('the focus lost during the passes goes to the stable target, judged on the final DOM', () => {
  const scope = document.createElement('div');
  const doomed = document.createElement('button');
  const stable = document.createElement('button');
  scope.append(doomed);
  let loop!: RenderLoop;
  const ctx = setup({ focusScope: () => scope, refocus: () => stable.focus() }, (n) => {
    // Prima passata: il nodo con il focus sparisce e si chiede un'altra passata; la seconda aggiunge il bersaglio.
    if (n === 1) {
      doomed.remove();
      loop.update();
    } else scope.append(stable);
  });
  loop = ctx.loop;
  ctx.host.append(scope);
  doomed.focus();
  loop.update();
  assert.equal(ctx.state.passes, 2);
  assert.equal(document.activeElement, stable);
});

test('no refocus when the focus was elsewhere, when it stayed inside, or when the host went away', () => {
  const scope = document.createElement('div');
  const inside = document.createElement('button');
  const outside = document.createElement('button');
  scope.append(inside);
  let calls = 0;
  let detach = false;
  const ctx = setup({ focusScope: () => scope, refocus: () => calls++ }, () => {
    if (detach) {
      inside.remove();
      ctx.host.remove();
    }
  });
  ctx.host.append(scope);
  document.body.append(outside);
  outside.focus();
  ctx.loop.update();
  inside.focus();
  ctx.loop.update();
  assert.equal(calls, 0);
  detach = true;
  ctx.loop.update();
  assert.equal(calls, 0);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/dom/renderLoop.test.ts`
Expected: FAIL: `Cannot find module './renderLoop'`.

- [ ] **Step 3: L'helper**

`src/dom/renderLoop.ts`:

```ts
/** Cosa serve a un ciclo di render: prerequisiti, una passata, e (facoltativo) dove recuperare il focus. */
export interface RenderLoopOptions {
  /** Prerequisiti di una passata (parti create, store, elemento collegato): ricontrollati prima di ognuna. */
  ready(): boolean;
  /** Una passata di render: aggiorna il DOM dallo stato. */
  render(): void;
  /** Contenitore da sorvegliare: se aveva il focus prima del render e non ce l'ha più dopo, si chiama `refocus`. */
  focusScope?(): Element | null;
  /** Porta il focus su un bersaglio stabile (riga col tab stop, campo, pulsante fisso). */
  refocus?(): void;
}

/**
 * Un render alla volta (schema delle fasi 6a–6b). Ogni cambio di stato di un elemento passa da `update()`:
 * se un render è già in corso (un listener sincrono, il `focusout` che Chromium manda quando si toglie il
 * nodo con il focus, un `focus()`), la richiesta segna una passata in più alla fine, mai annidata. I
 * prerequisiti si ricontrollano prima di ogni passata. Il focus si guarda prima della prima passata e si
 * recupera dopo l'ultima, contro il DOM finito, solo con l'elemento ancora collegato.
 */
export class RenderLoop {
  readonly #host: Element;
  readonly #options: RenderLoopOptions;
  #rendering = false;
  #again = false;

  constructor(host: Element, options: RenderLoopOptions) {
    this.#host = host;
    this.#options = options;
  }

  /** Vero mentre gira una passata (anche tra una passata e la successiva). */
  get rendering(): boolean {
    return this.#rendering;
  }

  update(): void {
    const options = this.#options;
    if (!options.ready()) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    const doc = this.#host.ownerDocument;
    const scope = options.focusScope?.() ?? null;
    const hadFocus = scope !== null && scope.contains(doc.activeElement);
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        options.render();
      } while (this.#again && options.ready());
    } finally {
      this.#rendering = false;
    }
    if (hadFocus && this.#host.isConnected && !scope.contains(doc.activeElement)) options.refocus?.();
  }
}
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/dom/renderLoop.test.ts` → 7 PASS.

- [ ] **Step 4: L'albero usa `RenderLoop`**

In `src/elements/file-tree/file-tree.element.ts`: import `import { RenderLoop } from '../../dom/renderLoop';` dopo quello di `reconcileList`; i due campi

```ts
  #rendering = false;
  #again = false;
```

diventano

```ts
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    focusScope: () => this.#parts?.nav ?? null,
    // La riga con il focus è sparita (file eliminato o rinominato): il focus va sulla riga col tab stop
    // (il suo focusin ricalcola i tab stop).
    refocus: () => {
      const stop = tabStop(this.#items, this.#focused, this.#openPath);
      if (stop !== null) this.#focusables.get(stop)?.focus();
    },
  });
```

tutto il corpo di `#update()` (dal controllo dei prerequisiti al recupero del focus) diventa

```ts
  /** Un render alla volta (RenderLoop): la riga col tab stop può esistere solo nell'albero finale. */
  #update(): void {
    this.#loop.update();
  }
```

e in `#onFocusIn` `if (!this.#rendering) this.#applyTabStops();` diventa `if (!this.#loop.rendering) this.#applyTabStops();`.

- [ ] **Step 5: Ricerca e cronologia usano `RenderLoop`**

In `src/elements/search-panel/search-panel.element.ts`: stesso import; i campi `#rendering`/`#again` diventano

```ts
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    // Anche quando l'ultima passata toglie l'elenco intero (query svuotata).
    focusScope: () => this.#parts?.list ?? null,
    // Il risultato con il focus è sparito (file eliminato o non più trovato): il focus torna nella casella.
    refocus: () => this.#parts?.input.focus(),
  });
```

e il corpo di `#update()` diventa `this.#loop.update();` (il JSDoc «Un render alla volta, come albero e cronologia…» resta).

In `src/elements/history-panel/history-panel.element.ts`: stesso import; i campi `#rendering`/`#again` diventano

```ts
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!),
    focusScope: () => this.#parts?.panel ?? null,
    // Il nodo con il focus è sparito («Ripristina» dopo un ripristino, che rende il testo identico):
    // il focus va sulla versione scelta, o sul pulsante di chiusura.
    refocus: () => (this.#versionButtons.get(this.#selected ?? NaN) ?? this.#parts?.close)?.focus(),
  });
```

e `#update()` diventa

```ts
  /** Un render alla volta (RenderLoop), come albero e ricerca. */
  #update(): void {
    this.#loop.update();
  }
```

Controllo: `grep -rn "#rendering\|#again" src/elements/file-tree src/elements/search-panel src/elements/history-panel; echo "exit $?"` → `exit 1`.

- [ ] **Step 6: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/file-tree/*.test.ts src/elements/search-panel/*.test.ts src/elements/history-panel/*.test.ts   # 68, tutti verdi come prima
npm test                    # 848 + 7 = 855
npm run lint
npm run test:e2e            # 175
npx playwright test -c e2e/playwright.config.ts e2e/tree.spec.ts e2e/tree-rows.spec.ts e2e/search.spec.ts e2e/search-live.spec.ts e2e/history.spec.ts e2e/history-live.spec.ts --repeat-each=3
npm run test:e2e:dev        # 160
npm run test:e2e:audit      # 100, nessuna differenza
```

- [ ] **Step 7: Commit**

```bash
git add src/dom/renderLoop.ts src/dom/renderLoop.test.ts src/elements/file-tree/file-tree.element.ts src/elements/search-panel/search-panel.element.ts src/elements/history-panel/history-panel.element.ts
git commit -m "refactor: RenderLoop in src/dom al posto del ciclo di render copiato in albero, ricerca e cronologia"
```

---
### Task 3: `hmd-ai-model-select`

**Files:**
- Create: `src/elements/ai/modelSelectView.ts`, `modelSelectView.test.ts`, `model-select.element.ts`, `model-select.css`, `model-select.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/architecture.test.ts`, `src/ui/ai/ModelChip.tsx`, `src/ui/ai/settings/AiProfilesSection.tsx`
- Delete: `src/ui/ai/ModelSelect.tsx` (le sue classi restano in `Composer.module.css`, usate ancora da `ModelChip.tsx`)

**Interfaces:**
- Consumes: `RenderLoop` (Task 2); `modelOptions` (`src/ai/models.ts`); `modelSelection` (`src/ai/profiles.ts`); `AiController`, `ModelOption`, `ModelProfile`, `ChatProvider` (`src/ai/`); `HmdElement`, `el`, `setText`, `toggleAttr`, `reconcileList` (`src/dom/`); `emit` (`src/elements/events.ts`); `countListeners` (`src/testing/`).
- Produces:
  - da `modelSelectView.ts`: `CUSTOM = '__custom'`, `type ModelSelectController = Pick<AiController, 'provider' | 'report'>`, `interface SelectOption { value: string; label: string }`, `modelSelectOptions(profile: Pick<ModelProfile, 'kind' | 'model'>, models: readonly ModelOption[] | null, t: I18nStore['t']): SelectOption[]`, `selectValue(custom: boolean, model: string): string`, `modelListKey(profile: Pick<ModelProfile, 'kind' | 'baseUrl' | 'secretId'>, revision: number): string`
  - `class HmdAiModelSelect` con proprietà `controller: ModelSelectController | null`, `profile: ModelProfile | null`, `i18n: I18nStore | null`; evento `hmd-ai-model-change` `{ selection: Pick<ModelProfile, 'model' | 'contextTokens'> }`

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/modelSelectView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { translate } from '../../i18n/i18n';
import { CUSTOM, modelListKey, modelSelectOptions, selectValue } from './modelSelectView';

const t = (key: string) => translate(EN_MESSAGES, key);

test('options: the empty one, the known models with the current one, Other… last', () => {
  const values = modelSelectOptions({ kind: 'ollama', model: 'mine:1b' }, null, t).map((o) => o.value);
  assert.deepEqual(values, ['', 'qwen3.6:35b-mlx', 'qwen3:8b', 'llama3.2', 'mine:1b', CUSTOM]);
  const labels = modelSelectOptions({ kind: 'ollama', model: '' }, null, t);
  assert.equal(labels[0].label, EN_MESSAGES['ai.chooseModel']);
  assert.equal(labels.at(-1)!.label, EN_MESSAGES['ai.other']);
});

test('the server list replaces the known models; the CLI has its own empty label and no empty duplicate', () => {
  assert.deepEqual(
    modelSelectOptions({ kind: 'ollama', model: 'b' }, [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], t).map((o) => o.value),
    ['', 'a', 'b', CUSTOM],
  );
  const cli = modelSelectOptions({ kind: 'claude-code', model: '' }, null, t);
  assert.equal(cli[0].label, EN_MESSAGES['ai.cliDefault']);
  assert.equal(cli.filter((o) => o.value === '').length, 1);
});

test('a value listed twice (or equal to Other…) is kept once', () => {
  const values = modelSelectOptions({ kind: 'ollama', model: 'a' }, [{ value: 'a', label: 'A' }, { value: 'a', label: 'A2' }, { value: CUSTOM, label: 'x' }], t).map((o) => o.value);
  assert.deepEqual(values, ['', 'a', CUSTOM]);
});

test('the select shows Other… with the free field open, the model otherwise', () => {
  assert.equal(selectValue(true, 'a'), CUSTOM);
  assert.equal(selectValue(false, 'a'), 'a');
});

test('the list key follows provider kind, address, saved key and Refresh, not the model or the name', () => {
  const base = defaultProfile('ollama', 'p');
  const key = modelListKey(base, 0);
  assert.equal(modelListKey({ ...base, model: 'other', name: 'renamed' } as typeof base, 0), key);
  assert.notEqual(modelListKey({ ...base, baseUrl: 'http://localhost:1234' }, 0), key);
  assert.notEqual(modelListKey({ ...base, kind: 'lmstudio' }, 0), key);
  assert.notEqual(modelListKey({ ...base, secretId: 's' }, 0), key);
  assert.notEqual(modelListKey(base, 1), key);
});
```

`src/elements/ai/model-select.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { ChatProvider, ModelOption, ModelProfile } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { HmdEvents } from '../events';
import { CUSTOM, type ModelSelectController } from './modelSelectView';

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Controller finto: ogni richiesta dell'elenco resta in attesa finché il test non risponde. */
function fakeController() {
  const requests: { profile: ModelProfile; signal: AbortSignal; answer(list: ModelOption[] | null): void; fail(error: unknown): void }[] = [];
  const reports: unknown[] = [];
  const controller = {
    async provider(profile: ModelProfile) {
      return {
        listModels: (signal: AbortSignal) =>
          new Promise<ModelOption[] | null>((resolve, reject) => requests.push({ profile, signal, answer: resolve, fail: reject })),
      } as unknown as ChatProvider;
    },
    report: (error: unknown) => void reports.push(error),
  } as unknown as ModelSelectController;
  return { controller, requests, reports };
}

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus; jsdom no: qui lo si
 * manda a mano dentro `remove()`, cioè nel mezzo di un render.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    // Come Chromium: solo se il nodo è nel documento e contiene il focus (un nodo già tolto non manda nulla).
    if (this.isConnected && this.contains(document.activeElement)) this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

const PROFILE: ModelProfile = { ...defaultProfile('ollama', 'p'), secretId: 'secret-id-1' };

async function mount(profile: ModelProfile = PROFILE) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.model': 'MODELLO', 'ai.refresh': 'AGGIORNA' } }),
      persist() {},
    }),
  );
  const fake = fakeController();
  const el = document.createElement('hmd-ai-model-select');
  el.controller = fake.controller;
  el.profile = profile;
  el.i18n = i18n;
  document.body.append(el);
  const changes: HmdEvents['hmd-ai-model-change']['detail'][] = [];
  el.addEventListener('hmd-ai-model-change', (event) => changes.push(event.detail));
  await tick();
  const select = () => el.querySelector('select')!;
  const field = () => el.querySelector<HTMLInputElement>('input');
  const values = () => [...select().options].map((o) => o.value);
  const choose = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event('change', { bubbles: true }));
  };
  const type = (value: string) => {
    field()!.value = value;
    field()!.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { el, i18n, listeners, ...fake, changes, select, field, values, choose, type };
}

test('the same DOM as ModelSelect.tsx: a section with the labelled select and Refresh; no free field, no error', async () => {
  const { el, select, field } = await mount();
  const section = el.querySelector('div')!;
  assert.equal(section.className, 'section');
  assert.deepEqual([...section.children].map((c) => c.localName), ['label', 'button']);
  assert.equal(section.querySelector('label > span')!.textContent, EN_MESSAGES['ai.model']);
  assert.equal(select().parentElement!.localName, 'label');
  const refresh = section.querySelector('button')!;
  assert.equal(refresh.className, 'link');
  assert.equal(refresh.type, 'button');
  assert.equal(refresh.textContent, EN_MESSAGES['ai.refresh']);
  assert.equal(field(), null);
  assert.equal(select().value, PROFILE.model);
});

test('the list is asked once at connection, through the controller, and the options follow the answer', async () => {
  const { requests, values, select } = await mount();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].profile, PROFILE);
  assert.deepEqual(values(), ['', 'qwen3.6:35b-mlx', 'qwen3:8b', 'llama3.2', CUSTOM]);
  requests[0].answer([{ value: 'qwen3.6:35b-mlx', label: 'qwen3.6:35b-mlx' }, { value: 'big:70b', label: 'big:70b', contextTokens: 8192 }]);
  await tick();
  assert.deepEqual(values(), ['', 'qwen3.6:35b-mlx', 'big:70b', CUSTOM]);
  assert.equal(select().options[0].textContent, EN_MESSAGES['ai.chooseModel']);
  assert.equal(select().options[3].textContent, EN_MESSAGES['ai.other']);
  assert.equal(select().value, 'qwen3.6:35b-mlx');
});

test('choosing a model sends hmd-ai-model-change, with the context of the listed model', async () => {
  const { requests, choose, changes } = await mount();
  requests[0].answer([{ value: 'big:70b', label: 'big:70b', contextTokens: 8192 }]);
  await tick();
  choose('big:70b');
  assert.deepEqual(changes, [{ selection: { model: 'big:70b', contextTokens: 8192 } }]);
});

test('the select is not written back while the parent has not applied the choice yet', async () => {
  const { el, choose, select, i18n } = await mount();
  choose('qwen3:8b');
  // Un render qualsiasi (la lingua) prima che arrivi il profilo nuovo: la scelta dell'utente resta.
  await i18n.setLocale('it');
  assert.equal(select().value, 'qwen3:8b');
  el.profile = { ...PROFILE, model: 'qwen3:8b' };
  assert.equal(select().value, 'qwen3:8b');
  el.profile = { ...PROFILE, model: 'llama3.2' };
  assert.equal(select().value, 'llama3.2');
});

test('Other… opens the free field with the model; every value typed is sent; a late echo does not rewrite the focused field', async () => {
  const { el, choose, field, type, changes, select } = await mount();
  choose(CUSTOM);
  assert.equal(changes.length, 0);
  assert.equal(select().value, CUSTOM);
  assert.equal(field()!.value, PROFILE.model);
  assert.equal(field()!.getAttribute('aria-label'), EN_MESSAGES['ai.model']);
  assert.equal(field()!.previousElementSibling!.localName, 'label');
  field()!.focus();
  type('m');
  type('my');
  assert.deepEqual(changes.map((c) => c.selection.model), ['m', 'my']);
  el.profile = { ...PROFILE, model: 'm' };
  assert.equal(field()!.value, 'my');
  el.profile = { ...PROFILE, model: 'my' };
  assert.equal(field()!.value, 'my');
  assert.equal(document.activeElement, field());
});

test('without the focus the free field follows the model; leaving Other… removes it, opening it again starts from the model', async () => {
  const { el, choose, field } = await mount();
  choose(CUSTOM);
  el.profile = { ...PROFILE, model: 'from-outside' };
  assert.equal(field()!.value, 'from-outside');
  choose('qwen3:8b');
  assert.equal(field(), null);
  el.profile = { ...PROFILE, model: 'qwen3:8b' };
  choose(CUSTOM);
  assert.equal(field()!.value, 'qwen3:8b');
});

test('a model changed outside while the free field has the focus shows up when the focus leaves', async () => {
  const { el, choose, field } = await mount();
  choose(CUSTOM);
  field()!.focus();
  el.profile = { ...PROFILE, model: 'from-sync' };
  assert.equal(field()!.value, PROFILE.model);
  field()!.blur();
  assert.equal(field()!.value, 'from-sync');
});

test('the focused free field removed by a choice: the synchronous focusout asks one more pass, never a nested one', async () => {
  const { el, choose, field, select } = await mount();
  choose(CUSTOM);
  const input = field()!;
  input.focus();
  focusoutOnRemove(input);
  let nested = 0;
  el.addEventListener('focusout', () => {
    // Un listener che cambia il profilo mentre il campo viene tolto: il render riparte dopo, non dentro.
    if (nested++ === 0) el.profile = { ...PROFILE, model: 'llama3.2' };
  });
  choose('qwen3:8b');
  assert.equal(field(), null);
  assert.equal(el.querySelectorAll('input').length, 0);
  assert.equal(select().value, 'llama3.2');
});

test('the list is asked again only for another provider kind, address or saved key, or with Refresh', async () => {
  const { el, requests } = await mount();
  el.profile = { ...PROFILE, model: 'qwen3:8b', name: 'renamed' };
  assert.equal(requests.length, 1);
  el.profile = { ...PROFILE, baseUrl: 'http://localhost:1234' };
  await tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  assert.equal(requests.length, 3);
  assert.equal(requests[1].signal.aborted, true);
});

test('an unreachable server (null) shows the error under Refresh; asking again hides it', async () => {
  const { el, requests } = await mount();
  requests[0].answer(null);
  await tick();
  const error = () => el.querySelector('small');
  assert.equal(error()!.textContent, EN_MESSAGES['ai.error.unreachable']);
  assert.equal(error()!.previousElementSibling!.localName, 'button');
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  assert.equal(error(), null);
});

test('a failure is reported to the controller and shown as unreachable', async () => {
  const { el, requests, reports } = await mount();
  const failure = { code: 'unauthorized' };
  requests[0].fail(failure);
  await tick();
  assert.deepEqual(reports, [failure]);
  assert.equal(el.querySelector('small')!.textContent, EN_MESSAGES['ai.error.unreachable']);
});

test('an answer superseded by a newer request is discarded', async () => {
  const { el, requests, values } = await mount();
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  requests[0].answer([{ value: 'old', label: 'old' }]);
  await tick();
  assert.ok(!values().includes('old'));
  requests[1].answer([{ value: 'new', label: 'new' }]);
  await tick();
  assert.ok(values().includes('new'));
});

test('detached, the request is aborted and its answer discarded; attached again, the list is asked again', async () => {
  const { el, requests, reports, values } = await mount();
  el.remove();
  assert.equal(requests[0].signal.aborted, true);
  requests[0].answer([{ value: 'late', label: 'late' }]);
  await tick();
  assert.deepEqual(reports, []);
  document.body.append(el);
  await tick();
  assert.equal(requests.length, 2);
  assert.ok(!values().includes('late'));
});

test('a failure after detaching is not reported and shows no error', async () => {
  const { el, requests, reports } = await mount();
  el.remove();
  requests[0].fail({ code: 'server' });
  await tick();
  assert.deepEqual(reports, []);
  assert.equal(el.querySelector('small'), null);
});

test('a failure of a superseded request is not reported and shows no error', async () => {
  const { el, requests, reports } = await mount();
  el.querySelector<HTMLButtonElement>('button.link')!.click();
  await tick();
  assert.equal(requests[0].signal.aborted, true);
  requests[0].fail({ code: 'server' });
  await tick();
  assert.deepEqual(reports, []);
  assert.equal(el.querySelector('small'), null);
  assert.equal(requests[1].signal.aborted, false);
});

test('the saved key id and the address never reach the DOM', async () => {
  const { el, choose } = await mount({ ...PROFILE, baseUrl: 'http://secret-host.example:11434' });
  choose(CUSTOM);
  assert.ok(!el.outerHTML.includes('secret-id-1'));
  assert.ok(!el.outerHTML.includes('secret-host'));
});

test('language change relabels without asking the list again; detached, no listener left', async () => {
  const { el, i18n, listeners, requests } = await mount();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('label > span')!.textContent, 'MODELLO');
  assert.equal(el.querySelector('button')!.textContent, 'AGGIORNA');
  assert.equal(requests.length, 1);
  el.remove();
  assert.equal(listeners(), 0);
});
```

In `src/architecture.test.ts`, prima del JSDoc `/** Custom element: un solo punto di registrazione …`:

```ts
/**
 * Elementi (spec WC §10 R21): la rete passa solo dal controller AI (`controller.provider(...)`), mai da un
 * modulo di src/ai/providers importato direttamente; le chiavi non passano mai di lì (né lettura né scrittura).
 */
const ELEMENT_AI = /\bfrom\s+['"][^'"]*\/ai\/providers(?:\/[^'"]*)?['"]|\bimport\(\s*['"][^'"]*\/ai\/providers|\b(?:getSecret|setSecret|saveSecret|deleteSecret)\s*\(|['"]aiSecrets['"]|\.secret\s*\(/;
const ELEMENT_AI_ALLOWED = (path: string) => !path.startsWith('elements/');
```

prima di `test('customElements.define appears only in elements/define.ts', …`:

```ts
test('elements reach the AI providers only through the controller and never touch the keys', () => {
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED), []);
});
```

in «the patterns fire on what they must and ignore what they must», prima di `assert.ok(DEFINE.test(…))`:

```ts
  for (const bad of ["import { createProvider } from '../../ai/providers';", "import { x } from '../../ai/providers/anthropic';", "await import('../../ai/providers/index')", 'controller.secret(profile)', 'store.getSecret(id)', "tx.objectStore('aiSecrets')"]) {
    assert.ok(ELEMENT_AI.test(bad), bad);
  }
  for (const ok of ["import type { AiController } from '../../ai/aiController';", 'controller.provider(profile)', '// la rete passa da src/ai/providers', 'profile.secretId']) {
    assert.ok(!ELEMENT_AI.test(ok), ok);
  }
```

e in «offending files are reported by path…» due sonde in fondo all'array `probes` e un'asserzione in fondo al test:

```ts
    { path: 'elements/ai/probe.element.ts', source: "import { createProvider } from '../../ai/providers';" },
    { path: 'ui/ai/settings/AiProfilesSection.tsx', source: 'controller.setSecret(draft, key, remember)' },
```

```ts
  assert.deepEqual(offenders(ELEMENT_AI, ELEMENT_AI_ALLOWED, probes), ['elements/ai/probe.element.ts']);
```

(Il test statico passa già, perché nessun elemento importa i provider oggi: è la rete per i Task 3–6, e le sonde provano che scatta.)

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/modelSelectView.test.ts src/elements/ai/model-select.dom.test.ts src/architecture.test.ts`
Expected: FAIL: `Cannot find module './modelSelectView'` nel primo file; nel secondo 17 FAIL con `TypeError: Cannot read properties of null` (il tag non è definito: niente `<div>`); `architecture.test.ts` verde. Annotare il RED nel ledger prima di scrivere l'elemento.

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/ai/modelSelectView.ts`:

```ts
import type { AiController } from '../../ai/aiController';
import { modelOptions } from '../../ai/models';
import type { ModelOption, ModelProfile } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';

/** Valore dell'opzione «Altro…»: mostra il campo libero (come ModelSelect.tsx). */
export const CUSTOM = '__custom';

/**
 * Quello che il selettore usa del controller: il provider del profilo, che è l'unico a fare la richiesta
 * di rete (src/ai/providers, CLAUDE.md §AI), e la segnalazione degli errori. Le chiavi non passano di qui.
 */
export type ModelSelectController = Pick<AiController, 'provider' | 'report'>;

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Opzioni della select nell'ordine di ModelSelect.tsx: la vuota («Predefinito della CLI» o «Scegli un
 * modello»), i modelli (elenco del server se c'è, altrimenti quelli noti, più quello scelto), «Altro…».
 * I valori vuoti si saltano come prima; un valore doppio si tiene una volta sola (sono le chiavi delle righe).
 */
export function modelSelectOptions(
  profile: Pick<ModelProfile, 'kind' | 'model'>,
  models: readonly ModelOption[] | null,
  t: I18nStore['t'],
): SelectOption[] {
  const seen = new Set(['', CUSTOM]);
  const listed: SelectOption[] = [];
  for (const { value, label } of modelOptions(profile.kind, profile.model, models ? [...models] : null)) {
    if (seen.has(value)) continue;
    seen.add(value);
    listed.push({ value, label });
  }
  return [
    { value: '', label: t(profile.kind === 'claude-code' ? 'ai.cliDefault' : 'ai.chooseModel') },
    ...listed,
    { value: CUSTOM, label: t('ai.other') },
  ];
}

/** Valore mostrato dalla select: «Altro…» con il campo libero aperto, altrimenti il modello del profilo. */
export const selectValue = (custom: boolean, model: string): string => (custom ? CUSTOM : model);

/**
 * Chiave dell'elenco dei modelli: cambia (e l'elenco si richiede) solo con tipo di provider, indirizzo,
 * chiave salvata o «Aggiorna», come le dipendenze dell'effetto di ModelSelect.tsx. Resta in memoria:
 * mai in un attributo.
 */
export const modelListKey = (profile: Pick<ModelProfile, 'kind' | 'baseUrl' | 'secretId'>, revision: number): string =>
  JSON.stringify([profile.kind, profile.baseUrl, profile.secretId, revision]);
```

`src/elements/ai/model-select.element.ts`:

```ts
import { modelSelection } from '../../ai/profiles';
import type { ModelOption, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { CUSTOM, modelListKey, modelSelectOptions, selectValue, type ModelSelectController, type SelectOption } from './modelSelectView';
import './model-select.css';

interface Parts {
  section: HTMLDivElement;
  label: HTMLLabelElement;
  caption: HTMLSpanElement;
  select: HTMLSelectElement;
  /** Campo libero di «Altro…». */
  input: HTMLInputElement;
  refresh: HTMLButtonElement;
  /** «Server non raggiungibile». */
  error: HTMLElement;
}

/**
 * Selettore del modello (era ModelSelect.tsx): nel popover del chip del modello, montato solo a popover
 * aperto, e nel dettaglio di un profilo nelle impostazioni. L'elenco dei modelli lo chiede il provider del
 * profilo attraverso il controller (l'elemento non fa rete né vede chiavi) al collegamento e quando cambiano
 * tipo, indirizzo o chiave salvata, o con «Aggiorna»; una risposta arrivata dopo il distacco o superata da
 * una richiesta più nuova si scarta. Select e campo libero si riscrivono solo quando cambia il valore che
 * l'elemento vuole mostrare (mai confrontando con il DOM vivo), il campo mai mentre ha il focus.
 */
export class HmdAiModelSelect extends HmdElement {
  #controller: ModelSelectController | null = null;
  #profile: ModelProfile | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #models: ModelOption[] | null = null;
  #error = false;
  #custom = false;
  #revision = 0;
  /** Richiesta dell'elenco (in corso o finita) e il suo abort; null = da fare (anche dopo il distacco). */
  #request: { key: string; abort: AbortController } | null = null;
  /** Ultimo valore mostrato dalla select e dal campo libero (scritto dall'elemento o dall'utente). */
  #shownValue: string | null = null;
  #shownModel: string | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#i18n && !!this.#profile && this.isConnected,
    render: () => this.#render(this.#parts!, this.#i18n!, this.#profile!),
  });

  get controller(): ModelSelectController | null { return this.#controller; }
  set controller(value: ModelSelectController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    // Un controller nuovo: l'elenco si richiede (come la dipendenza `controller` dell'effetto di React).
    this.#request?.abort.abort();
    this.#request = null;
    this.#load();
    this.#loop.update();
  }
  get profile(): ModelProfile | null { return this.#profile; }
  set profile(value: ModelProfile | null) {
    value ??= null;
    if (value === this.#profile) return;
    this.#profile = value;
    this.#load();
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
      const caption = el('span');
      const select = el('select', { on: { change: () => this.#onSelect() } });
      const parts: Parts = {
        section: el('div', { class: 'section' }),
        label: el('label', null, caption, select),
        caption,
        select,
        // Uscito il focus, il campo si riallinea al modello del profilo se nel frattempo è cambiato da fuori.
        input: el('input', { on: { input: () => this.#onInput(), focusout: () => this.#loop.update() } }),
        refresh: el('button', { type: 'button', class: 'link', on: { click: () => this.#refresh() } }),
        error: el('small'),
      };
      parts.section.append(parts.label, parts.refresh);
      this.append(parts.section);
      this.#parts = parts;
    }
    // Al (ri)collegamento l'elenco si chiede se manca; un cambio di lingua (reconnect) non lo richiede.
    this.#load();
    if (this.#i18n) this.watch(this.#i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco: la risposta in arrivo non tocca più nulla; ricollegato, l'elenco si richiede.
    this.#request?.abort.abort();
    this.#request = null;
  }

  /** Chiede l'elenco se la chiave (provider, indirizzo, chiave salvata, «Aggiorna») è cambiata. Non disegna. */
  #load(): void {
    const controller = this.#controller;
    const profile = this.#profile;
    if (!controller || !profile || !this.isConnected) return;
    const key = modelListKey(profile, this.#revision);
    if (this.#request?.key === key) return;
    this.#request?.abort.abort();
    const abort = new AbortController();
    this.#request = { key, abort };
    this.#models = null;
    this.#error = false;
    void controller
      .provider(profile)
      .then((provider) => provider.listModels(abort.signal))
      .then(
        (list) => {
          if (abort.signal.aborted) return;
          this.#models = list;
          this.#error = !list;
          this.#loop.update();
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          this.#error = true;
          controller.report(error);
          this.#loop.update();
        },
      );
  }

  #refresh(): void {
    this.#revision++;
    this.#load();
    this.#loop.update();
  }

  #onSelect(): void {
    const parts = this.#parts;
    const profile = this.#profile;
    if (!parts || !profile) return;
    const value = parts.select.value;
    this.#custom = value === CUSTOM;
    // La select mostra già la scelta: si riscrive solo quando cambia il modello del profilo (o «Altro…»).
    this.#shownValue = selectValue(this.#custom, profile.model);
    if (!this.#custom) emit(this, 'hmd-ai-model-change', { selection: modelSelection(profile, value, this.#models?.find((m) => m.value === value)) });
    this.#loop.update();
  }

  #onInput(): void {
    const parts = this.#parts;
    const profile = this.#profile;
    if (!parts || !profile) return;
    const value = parts.input.value;
    this.#shownModel = value;
    emit(this, 'hmd-ai-model-change', { selection: modelSelection(profile, value, this.#models?.find((m) => m.value === value)) });
  }

  #render(parts: Parts, i18n: I18nStore, profile: ModelProfile): void {
    const t = i18n.t;
    setText(parts.caption, t('ai.model'));
    reconcileList(
      parts.select,
      modelSelectOptions(profile, this.#models, t),
      (option: SelectOption) => option.value,
      (option) => el('option', { value: option.value }),
      (node, option) => setText(node, option.label),
    );
    const value = selectValue(this.#custom, profile.model);
    if (value !== this.#shownValue) {
      parts.select.value = value;
      this.#shownValue = value;
    }
    if (this.#custom) {
      toggleAttr(parts.input, 'aria-label', true, t('ai.model'));
      // Il campo segue il modello solo senza focus: chi scrive è la fonte del valore (un eco in ritardo non lo tocca).
      if (profile.model !== this.#shownModel && document.activeElement !== parts.input) {
        parts.input.value = profile.model;
        this.#shownModel = profile.model;
      }
      if (parts.input.parentNode !== parts.section) parts.label.after(parts.input);
    } else {
      parts.input.remove();
      // Riaperto, il campo riparte dal modello del profilo (come il campo nuovo di React).
      this.#shownModel = null;
    }
    setText(parts.refresh, t('ai.refresh'));
    if (this.#error) {
      setText(parts.error, t('ai.error.unreachable'));
      if (parts.error.parentNode !== parts.section) parts.section.append(parts.error);
    } else {
      parts.error.remove();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-model-select': HmdAiModelSelect;
  }
}
```

`src/elements/ai/model-select.css` (valori copiati da `.popoverSection` e `.link` di `Composer.module.css`; la classe del contenitore è `section` come in `hmd-ai-parameters`):

```css
@layer components {
  @scope (hmd-ai-model-select) {
    :scope {
      display: contents;
    }

    /* Valori copiati da .popoverSection e .link di Composer.module.css. */
    .section {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 10px;
      padding: 0;
      border: none;
    }

    .section label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section label > span {
      flex: 0 0 45%;
    }

    .section input:not([type='radio']),
    .section select {
      flex: 1;
      min-width: 0;
    }

    .link {
      align-self: flex-start;
      padding: 0;
      border: none;
      background: none;
      color: var(--c-accent);
      font-size: 13px;
      cursor: pointer;
    }
  }
}
```

Nel dettaglio di un profilo delle impostazioni le regole non stratificate di `Settings.module.css` (`.detail label`, `.detail label > span`) vincono su quelle del foglio, come oggi vincono su quelle del modulo: lo verifica lo stato di audit `settings-profile`.

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: import `import { HmdAiModelSelect } from './ai/model-select.element';` dopo quello di `HmdAiEffortChip`, e nella lista, dopo `['hmd-ai-effort-chip', HmdAiEffortChip],`:

```ts
  ['hmd-ai-model-select', HmdAiModelSelect],
```

`src/elements/events.ts`: `import type { GenParams } from '../ai/types';` diventa `import type { GenParams, ModelProfile } from '../ai/types';`, e **subito sopra** la riga `/** Chat AI: aprire il documento di un messaggio. */` (il JSDoc di `'hmd-ai-open-file'`):

```ts
  /** Selettore del modello: modello scelto dall'elenco o scritto in «Altro…», con il suo contesto se noto. */
  'hmd-ai-model-change': CustomEvent<{ selection: Pick<ModelProfile, 'model' | 'contextTokens'> }>;
```

`src/elements/jsx.d.ts`: import `import type { ModelSelectController } from './ai/modelSelectView';` dopo quello di `HmdAiDiffPane`, e prima di `'hmd-ai-parameters'`:

```ts
      'hmd-ai-model-select': HmdProps<{ controller: ModelSelectController; profile: ModelProfile; i18n: I18nStore }, 'hmd-ai-model-change'>;
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/modelSelectView.test.ts src/elements/ai/model-select.dom.test.ts src/architecture.test.ts` → tutto PASS (5 + 17 + 11).

- [ ] **Step 5: I due chiamanti montano il tag**

`src/ui/ai/ModelChip.tsx`: via `import { ModelSelect } from './ModelSelect';`, e
`{opened && <ModelSelect controller={controller} profile={effective} onChange={(selection) => controller.override({ ...overrides, ...selection })} />}` diventa:

```tsx
        {opened && (
          <hmd-ai-model-select
            controller={controller}
            profile={effective}
            i18n={i18nStore}
            onhmd-ai-model-change={(event) => controller.override({ ...overrides, ...event.detail.selection })}
          />
        )}
```

`src/ui/ai/settings/AiProfilesSection.tsx`: via `import { ModelSelect } from '../ModelSelect';`, e
`<ModelSelect controller={controller} profile={draft} onChange={(selection) => setDraft({ ...draft, ...selection })} />` diventa:

```tsx
          <hmd-ai-model-select
            controller={controller}
            profile={draft}
            i18n={i18nStore}
            onhmd-ai-model-change={(event) => setDraft({ ...draft, ...event.detail.selection })}
          />
```

(`i18nStore` c'è già in entrambi.)

- [ ] **Step 6: Via `ModelSelect.tsx`, controlli**

```bash
git rm src/ui/ai/ModelSelect.tsx
grep -rnE "from '\.\.?/ModelSelect'|<ModelSelect[ />]" src; echo "exit $?"   # atteso: exit 1
grep -rn "<hmd-ai-model-select" src | wc -l                                   # 2: ModelChip.tsx e AiProfilesSection.tsx
```

- [ ] **Step 7: Verifica completa**

```bash
npm test                    # 855 + 23 = 878
npm run lint
npm run test:e2e            # 175, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/ai-model.spec.ts e2e/ai-chips.spec.ts --repeat-each=3
npm run test:e2e:dev        # 160
npm run test:e2e:audit      # 100, nessuna differenza (model-popover, model-popover-custom, -unreachable, settings-profile)
```

- [ ] **Step 8: Commit**

```bash
git add src/elements/ src/architecture.test.ts src/ui/ai/ModelChip.tsx src/ui/ai/settings/AiProfilesSection.tsx
git commit -m "feat: hmd-ai-model-select al posto di ModelSelect (elenco dal provider via controller, risposte superate scartate, select e campo libero mai riscritti a vuoto)"
```

---

### Task 4: `hmd-ai-model-chip`

**Files:**
- Create: `src/elements/ai/modelChipView.ts`, `modelChipView.test.ts`, `model-chip.element.ts`, `model-chip.css`, `model-chip.dom.test.ts`
- Modify: `src/testing/fakeAi.ts`, `src/testing/popoverStub.ts`, `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/ai/Composer.tsx`
- Delete: `src/ui/ai/ModelChip.tsx`

**Interfaces:**
- Consumes: `RenderLoop` (Task 2); `HmdAiModelSelect`, `ModelSelectController`, evento `hmd-ai-model-change` (Task 3); `HmdAiParameters` e `hmd-params-change` (fase 4c); `AiChipController` (`elements/ai/aiChips.ts`); `effectiveProfile`, `isLocalProfile` (`src/ai/profiles.ts`); `writePref` (`src/lib/prefs.ts`); `uid`, `icon`, `reconcileList` (`src/dom/`); `installPopoverStub` (`src/testing/`).
- Produces:
  - da `modelChipView.ts`: `type ModelChipController = AiChipController & ModelSelectController & Pick<AiController, 'selectProfile' | 'saveOverrides'>`, `privacyNote(t, profile): string`, `chipLabel(t, profile, overrides): string`, `hasOverrides(overrides): boolean`, `interface ProfileGroup { local: boolean; profiles: ModelProfile[] }`, `profileGroups(profiles): ProfileGroup[]`, `profileName(profile): string`, `type GroupRow`, `groupRows(group): GroupRow[]`, `groupRowKey(row): string`, `type PopoverPart = 'note' | 'group:local' | 'group:cloud' | 'model' | 'params' | 'actions'`, `popoverParts(groups, open): PopoverPart[]`
  - `class HmdAiModelChip` con proprietà `controller: ModelChipController | null`, `i18n: I18nStore | null`; evento `hmd-ai-manage` (`null`)
  - `installPopoverStub()` che fa rispondere anche `matches(':popover-open')` dall'attributo di prova (gli altri selettori passano a jsdom)
  - `fakeAi(initial, profile)` esteso: il profilo attivo è quello di `profileId` tra `profiles` (altrimenti `profile`), e in più `selectProfile`, `saveOverrides`, `report`, `provider` (risponde `models`), `send`, `stop`, `newChat`, `retry`, `workspace.openFile`, con `calls: unknown[][]` e `reports: unknown[]` (usati anche dai Task 5–6)

- [ ] **Step 1: Test che falliscono**

`src/testing/fakeAi.ts` (sostituisce il file; i test di `hmd-ai-effort-chip` e `hmd-ai-suggestions` restano verdi: senza `profiles` il profilo è quello passato, come prima):

```ts
import type { AiState } from '../ai/aiController';
import type { ChatProvider, ModelOption, ModelProfile, ProfileOverrides } from '../ai/types';
import type { AiChipController } from '../elements/ai/aiChips';

/**
 * Controller AI finto per i test degli elementi: stato in memoria, notifiche sincrone, override registrati.
 * Il profilo attivo è quello di `profileId` tra `profiles`, altrimenti `profile`. Le altre chiamate
 * (scelta e salvataggio del profilo, invio, stop, nuova chat, riprova, apertura di un file) finiscono in
 * `calls`; l'elenco dei modelli risponde `models` (null = server non raggiungibile).
 */
export function fakeAi(initial: Partial<AiState> = {}, profile?: ModelProfile) {
  let state = { chat: { id: 'c', messages: [], overrides: {} }, running: null, presets: [], profiles: [], profileId: '', ...initial } as unknown as AiState;
  const listeners = new Set<() => void>();
  const overrides: ProfileOverrides[] = [];
  const calls: unknown[][] = [];
  const reports: unknown[] = [];
  const set = (patch: Partial<AiState>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn();
  };
  const controller = {
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    getState: () => state,
    profile: () => state.profiles.find((p) => p.id === state.profileId) ?? profile,
    override: (next: ProfileOverrides) => {
      overrides.push(next);
      set({ chat: { ...state.chat, overrides: next } });
    },
    selectProfile: (id: string) => {
      calls.push(['selectProfile', id]);
      set({ profileId: id, chat: { ...state.chat, overrides: {} } });
    },
    saveOverrides: async (asNew = false) => void calls.push(['saveOverrides', asNew]),
    report: (error: unknown) => void reports.push(error),
    models: null as ModelOption[] | null,
    provider: async () => ({ listModels: async () => controller.models }) as unknown as ChatProvider,
    send: async (...args: unknown[]) => void calls.push(['send', ...args]),
    stop: () => void calls.push(['stop']),
    newChat: () => void calls.push(['newChat']),
    retry: async (...args: unknown[]) => void calls.push(['retry', ...args]),
    workspace: { openFile: (path: string) => void calls.push(['openFile', path]) },
    set,
    overrides,
    calls,
    reports,
    listeners: () => listeners.size,
  };
  return controller as unknown as AiChipController & Omit<typeof controller, keyof AiChipController>;
}
```

`src/testing/popoverStub.ts` (sostituisce il file: in più `matches(':popover-open')`, usato dal chip per leggere lo stato vero del popover; albero, avvisi e toast restano verdi):

```ts
/**
 * jsdom 30 non ha la Popover API (spec WC §8.2): `showPopover`/`hidePopover` segnano lo stato in un
 * attributo di prova, e `matches(':popover-open')` lo legge da lì (gli altri selettori passano a jsdom).
 * Il comportamento vero (top layer, chiusura alla rimozione) lo verificano gli e2e.
 */
const OPEN = 'data-test-popover-open';
const matches = Element.prototype.matches;

export function installPopoverStub(): void {
  Object.assign(Element.prototype, {
    matches(this: Element, selectors: string): boolean {
      return selectors === ':popover-open' ? this.hasAttribute(OPEN) : matches.call(this, selectors);
    },
  });
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.setAttribute(OPEN, '');
    },
    hidePopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.removeAttribute(OPEN);
    },
  });
}

export function isPopoverOpen(el: Element): boolean {
  return el.hasAttribute(OPEN);
}
```

`src/elements/ai/modelChipView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { chipLabel, groupRowKey, groupRows, hasOverrides, popoverParts, privacyNote, profileGroups, profileName } from './modelChipView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const ollama = defaultProfile('ollama', 'o');
const cloud: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud' };
const cli = defaultProfile('claude-code', 'cli');

test('privacy note: the CLI, a local server, a cloud host (none if the address is broken)', () => {
  assert.equal(privacyNote(t, cli), EN_MESSAGES['ai.claudePrivacy']);
  assert.equal(privacyNote(t, ollama), EN_MESSAGES['ai.localPrivacy']);
  assert.equal(privacyNote(t, cloud), t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  const generic: ModelProfile = { ...defaultProfile('openai-compatible', 'g'), baseUrl: 'https://llm.example.org/v1' };
  assert.equal(privacyNote(t, generic), t('ai.cloudPrivacy', { host: 'llm.example.org' }));
  assert.equal(privacyNote(t, { ...generic, baseUrl: 'not a url' }), t('ai.cloudPrivacy', { host: '' }));
});

test('chip label: profile · model of the chat (override first), CLI default without a model', () => {
  assert.equal(chipLabel(t, ollama, {}), `ollama · ${ollama.model}`);
  assert.equal(chipLabel(t, ollama, { model: 'llama3.2' }), 'ollama · llama3.2');
  assert.equal(chipLabel(t, { ...cli, model: '' }, {}), `claude-code · ${EN_MESSAGES['ai.cliDefault']}`);
  assert.equal(hasOverrides({}), false);
  assert.equal(hasOverrides({ temperature: 1 }), true);
});

test('groups: local first, then cloud, empty groups left out; a cloud profile without key is marked', () => {
  assert.deepEqual(profileGroups([cloud, ollama]).map((g) => [g.local, g.profiles.map((p) => p.id)]), [[true, ['o']], [false, ['c']]]);
  assert.deepEqual(profileGroups([cloud]).map((g) => g.local), [false]);
  assert.equal(profileName(cloud), 'Cloud ⚠');
  assert.equal(profileName({ ...cloud, secretId: 's' }), 'Cloud');
  assert.equal(profileName(ollama), 'ollama');
});

test('group rows: the legend, then one row per profile, keyed by id', () => {
  const rows = groupRows({ local: true, profiles: [ollama] });
  assert.deepEqual(rows.map(groupRowKey), ['legend', 'profile:o']);
});

test('popover parts in the order of ModelChip.tsx; the model select only while open', () => {
  const groups = profileGroups([cloud, ollama]);
  assert.deepEqual(popoverParts(groups, false), ['note', 'group:local', 'group:cloud', 'params', 'actions']);
  assert.deepEqual(popoverParts(groups, true), ['note', 'group:local', 'group:cloud', 'model', 'params', 'actions']);
});
```

`src/elements/ai/model-chip.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);

const OLLAMA: ModelProfile = defaultProfile('ollama', 'o');
const CLOUD: ModelProfile = { ...defaultProfile('anthropic', 'c'), name: 'Cloud', secretId: 'secret-id-1' };
const KEYLESS: ModelProfile = { ...defaultProfile('anthropic', 'k'), name: 'Keyless' };

function mount(profiles: ModelProfile[] = [OLLAMA, CLOUD], profileId = 'o') {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.local': 'LOCALI', 'ai.profile': 'PROFILO' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ profiles, profileId });
  const el = document.createElement('hmd-ai-model-chip');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  let manage = 0;
  el.addEventListener('hmd-ai-manage', () => manage++);
  const chip = () => el.querySelector<HTMLButtonElement>('button.chip')!;
  const popover = () => el.querySelector<HTMLElement>('[popover]')!;
  /** L'evento `toggle` da solo (asincrono in Chromium: può arrivare quando lo stato è già un altro). */
  const toggleEvent = (newState: 'open' | 'closed') => popover().dispatchEvent(Object.assign(new Event('toggle'), { newState }));
  /** Apertura o chiusura vera: lo stato del popover, poi il suo evento. */
  const toggle = (newState: 'open' | 'closed') => {
    if (newState === 'open') popover().showPopover();
    else popover().hidePopover();
    toggleEvent(newState);
  };
  /** Richieste dell'elenco dei modelli fatte dai selettori del popover (attraverso il controller). */
  let lists = 0;
  (ai as unknown as { provider: () => Promise<unknown> }).provider = async () => {
    lists++;
    return { listModels: async () => null };
  };
  const radio = (name: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === name)?.querySelector('input') ?? null;
  const button = (key: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === EN_MESSAGES[key as keyof typeof EN_MESSAGES])!;
  return { el, ai, i18n, listeners, chip, popover, toggle, toggleEvent, radio, button, manages: () => manage, lists: () => lists };
}

test('the same DOM as ModelChip.tsx: anchor span with the chip and its popover; parts in order, no model select while closed', () => {
  const { el, chip, popover } = mount();
  const anchor = el.firstElementChild!;
  assert.equal(anchor.localName, 'span');
  assert.equal(anchor.className, 'chipAnchor');
  assert.equal(chip().className, 'chip tooltip');
  assert.equal(chip().type, 'button');
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model}`);
  assert.equal(chip().getAttribute('aria-label'), `${EN_MESSAGES['ai.profile']}: ollama · ${OLLAMA.model}`);
  assert.equal(chip().getAttribute('data-tooltip'), EN_MESSAGES['ai.localPrivacy']);
  assert.equal(chip().getAttribute('popovertarget'), popover().id);
  assert.equal(chip().getAttribute('aria-describedby'), `${popover().id}-privacy`);
  assert.equal(popover().getAttribute('popover'), 'auto');
  assert.equal(popover().className, 'popover');
  assert.deepEqual([...popover().children].map((c) => c.localName), ['p', 'fieldset', 'fieldset', 'hmd-ai-parameters', 'div']);
  const note = popover().querySelector('p')!;
  assert.equal(note.id, `${popover().id}-privacy`);
  assert.equal(note.className, 'popoverNote');
  assert.equal(note.textContent, EN_MESSAGES['ai.localPrivacy']);
  assert.deepEqual([...popover().querySelectorAll('legend')].map((l) => l.textContent), [EN_MESSAGES['ai.local'], EN_MESSAGES['ai.cloud']]);
  assert.deepEqual([...popover().querySelectorAll('.popoverActions > button')].map((b) => b.textContent), [
    EN_MESSAGES['ai.saveProfile'], EN_MESSAGES['ai.saveAs'], EN_MESSAGES['ai.reset'], EN_MESSAGES['ai.manage'],
  ]);
  assert.equal(popover().querySelector('.popoverActions > button:last-child')!.className, 'link');
});

test('two chips get different popover ids; the radios share a group name per chip', () => {
  const first = mount();
  const second = mount();
  assert.notEqual(first.popover().id, second.popover().id);
  const names = new Set([...first.el.querySelectorAll<HTMLInputElement>('input[type=radio]')].map((r) => r.name));
  assert.deepEqual([...names], [`${first.popover().id}-profile`]);
});

test('profiles grouped local then cloud; the active one checked; a cloud profile without key marked ⚠', () => {
  const { radio } = mount([CLOUD, KEYLESS, OLLAMA], 'c');
  assert.equal(radio('ollama')!.checked, false);
  assert.equal(radio('Cloud')!.checked, true);
  assert.ok(radio('Keyless ⚠'));
});

test('choosing a profile selects it; the chip, the note and the radios follow', () => {
  const { ai, radio, chip } = mount();
  radio('Cloud')!.checked = true;
  radio('Cloud')!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.calls, [['selectProfile', 'c']]);
  assert.match(chip().getAttribute('aria-label')!, /: Cloud · /);
  assert.equal(chip().getAttribute('data-tooltip'), t('ai.cloudPrivacy', { host: 'api.anthropic.com' }));
  assert.equal(radio('ollama')!.checked, false);
  assert.equal(radio('Cloud')!.checked, true);
});

test('an override puts the dot in the chip and reaches the parameters; Reset empties it', () => {
  const { el, ai, chip, button } = mount();
  ai.override({ temperature: 1 });
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model} •`);
  assert.deepEqual(el.querySelector('hmd-ai-parameters')!.value, { ...OLLAMA.params, temperature: 1 });
  assert.equal(el.querySelector('hmd-ai-parameters')!.hideEffort, true);
  button('ai.reset').click();
  assert.deepEqual(ai.overrides.at(-1), {});
  assert.equal(chip().textContent, `ollama · ${OLLAMA.model}`);
});

test('a parameter changed in the popover overrides it, keeping the other overrides', () => {
  const { el, ai } = mount();
  ai.override({ model: 'llama3.2' });
  el.querySelector('hmd-ai-parameters')!.dispatchEvent(new CustomEvent('hmd-params-change', { detail: { params: { temperature: 0.7 } }, bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { model: 'llama3.2', temperature: 0.7 });
});

test('the model select is there only while the popover is open, a new one at each opening, with the effective profile', async () => {
  const { el, ai, popover, toggle } = mount();
  ai.override({ model: 'llama3.2' });
  toggle('open');
  const select = popover().querySelector('hmd-ai-model-select')!;
  assert.equal(select.nextElementSibling!.localName, 'hmd-ai-parameters');
  assert.equal(select.profile!.model, 'llama3.2');
  select.dispatchEvent(new CustomEvent('hmd-ai-model-change', { detail: { selection: { model: 'qwen3:8b', contextTokens: null } }, bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { model: 'qwen3:8b', contextTokens: null });
  toggle('closed');
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  toggle('open');
  assert.notEqual(popover().querySelector('hmd-ai-model-select'), select);
  await tick();
  el.remove();
});

test('Save profile, Save as new: the controller saves; a failure is reported', async () => {
  const { ai, button } = mount();
  button('ai.saveProfile').click();
  button('ai.saveAs').click();
  assert.deepEqual(ai.calls, [['saveOverrides', false], ['saveOverrides', true]]);
  const failure = { code: 'server' };
  (ai as unknown as { saveOverrides: () => Promise<void> }).saveOverrides = async () => Promise.reject(failure);
  button('ai.saveProfile').click();
  await tick();
  assert.deepEqual(ai.reports, [failure]);
});

test('Manage profiles… closes the popover and sends hmd-ai-manage; without a profile the chip itself does', async () => {
  const { el, popover, button, manages } = mount();
  popover().showPopover();
  button('ai.manage').click();
  assert.equal(popover().hasAttribute('data-test-popover-open'), false);
  assert.equal(manages(), 1);
  const empty = mount([], '');
  const only = empty.el.querySelector('button')!;
  assert.deepEqual([...empty.el.children].map((c) => c.localName), ['button']);
  assert.equal(only.className, 'chip');
  assert.equal(only.textContent, EN_MESSAGES['ai.manage']);
  only.click();
  assert.equal(empty.manages(), 1);
  el.remove();
});

test('profiles appearing and disappearing swap the manage chip and the anchor; the focus stays on the chip', () => {
  const { el, ai, chip } = mount([], '');
  const manage = el.querySelector('button')!;
  manage.focus();
  ai.set({ profiles: [OLLAMA], profileId: 'o' });
  assert.equal(el.firstElementChild!.className, 'chipAnchor');
  assert.equal(document.activeElement, chip());
  ai.set({ profiles: [], profileId: '' });
  assert.equal(el.firstElementChild, manage);
  assert.equal(document.activeElement, manage);
});

test('the focused radio of a profile that goes away: the focus goes to the chip (decision 3)', () => {
  const { ai, radio, chip } = mount();
  radio('Cloud')!.focus();
  ai.set({ profiles: [OLLAMA] });
  assert.equal(radio('Cloud'), null);
  assert.equal(document.activeElement, chip());
});

test('a late toggle that says open while the popover is closed mounts nothing and asks nothing', async () => {
  const { popover, toggle, toggleEvent, lists } = mount();
  // Staccato e ricollegato prima del task dell'evento: il popover è chiuso, l'evento dice ancora «open».
  toggleEvent('open');
  await tick();
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  assert.equal(lists(), 0);
  toggle('open');
  await tick();
  assert.ok(popover().querySelector('hmd-ai-model-select'));
  assert.equal(lists(), 1);
  // E il contrario: un «closed» in ritardo con il popover di nuovo aperto non toglie il selettore.
  toggleEvent('closed');
  assert.ok(popover().querySelector('hmd-ai-model-select'));
});

test('profiles gone and back with the popover open: the model select is not reattached and asks nothing more', async () => {
  const { ai, popover, toggle, lists } = mount();
  toggle('open');
  await tick();
  assert.equal(lists(), 1);
  ai.set({ profiles: [], profileId: '' });
  ai.set({ profiles: [OLLAMA, CLOUD], profileId: 'o' });
  await tick();
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
  assert.equal(lists(), 1);
});

test('detached with the popover open and attached again: no model select until it opens again', () => {
  const { el, popover, toggle } = mount();
  toggle('open');
  assert.ok(popover().querySelector('hmd-ai-model-select'));
  el.remove();
  document.body.append(el);
  assert.equal(popover().querySelector('hmd-ai-model-select'), null);
});

test('the saved key id never reaches the DOM', () => {
  const { el, toggle } = mount([OLLAMA, CLOUD], 'c');
  toggle('open');
  assert.ok(!el.outerHTML.includes('secret-id-1'));
});

test('language change relabels the chip and the popover; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, chip, popover } = mount();
  await i18n.setLocale('it');
  assert.match(chip().getAttribute('aria-label')!, /^PROFILO: /);
  assert.equal(popover().querySelector('legend')!.textContent, 'LOCALI');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/modelChipView.test.ts src/elements/ai/model-chip.dom.test.ts src/elements/ai/effort-chip.dom.test.ts src/elements/ai/suggestions.dom.test.ts`
Expected: FAIL: `Cannot find module './modelChipView'`; 16 FAIL nel test dell'elemento (`TypeError: Cannot read properties of null`: tag non definito); i 10 test di effort-chip e suggestions PASS con il `fakeAi` nuovo. Annotare il RED.

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/ai/modelChipView.ts`:

```ts
import type { AiController } from '../../ai/aiController';
import { effectiveProfile, isLocalProfile } from '../../ai/profiles';
import type { ModelProfile, ProfileOverrides } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';
import type { AiChipController } from './aiChips';
import type { ModelSelectController } from './modelSelectView';

/**
 * Quello che il chip usa del controller: stato e override (come gli altri chip), il provider per il
 * selettore del modello, la scelta e il salvataggio del profilo.
 */
export type ModelChipController = AiChipController & ModelSelectController & Pick<AiController, 'selectProfile' | 'saveOverrides'>;

/** Nota privacy del profilo (tooltip del chip e prima riga del popover), come ModelChip.tsx. */
export function privacyNote(t: I18nStore['t'], profile: ModelProfile): string {
  if (profile.kind === 'claude-code') return t('ai.claudePrivacy');
  if (isLocalProfile(profile)) return t('ai.localPrivacy');
  let host = '';
  try {
    host = new URL(profile.baseUrl).host;
  } catch {
    // URL non valido: la nota resta senza host.
  }
  return t('ai.cloudPrivacy', { host });
}

/** Testo del chip: «profilo · modello», o «Predefinito della CLI» senza modello. */
export function chipLabel(t: I18nStore['t'], profile: ModelProfile, overrides: ProfileOverrides): string {
  return `${profile.name} · ${effectiveProfile(profile, overrides).model || t('ai.cliDefault')}`;
}

/** La chat ha override (pallino « •» dopo il testo del chip). */
export const hasOverrides = (overrides: ProfileOverrides): boolean => Object.keys(overrides).length > 0;

export interface ProfileGroup {
  local: boolean;
  profiles: ModelProfile[];
}

/** Gruppi del popover: prima i profili locali, poi quelli cloud; un gruppo senza profili non c'è. */
export function profileGroups(profiles: readonly ModelProfile[]): ProfileGroup[] {
  return [true, false]
    .map((local) => ({ local, profiles: profiles.filter((p) => isLocalProfile(p) === local) }))
    .filter((group) => group.profiles.length > 0);
}

/** Nome nella riga del profilo: un profilo Anthropic senza chiave salvata ha « ⚠». */
export const profileName = (profile: ModelProfile): string => (profile.kind === 'anthropic' && !profile.secretId ? `${profile.name} ⚠` : profile.name);

/** Righe di un gruppo (un <fieldset>): la legenda, poi un profilo per riga. */
export type GroupRow = { kind: 'legend' } | { kind: 'profile'; profile: ModelProfile };

export const groupRows = (group: ProfileGroup): GroupRow[] => [{ kind: 'legend' }, ...group.profiles.map((profile) => ({ kind: 'profile' as const, profile }))];

export const groupRowKey = (row: GroupRow): string => (row.kind === 'legend' ? 'legend' : `profile:${row.profile.id}`);

/** Parti del popover nell'ordine di ModelChip.tsx: il selettore del modello c'è solo a popover aperto. */
export type PopoverPart = 'note' | 'group:local' | 'group:cloud' | 'model' | 'params' | 'actions';

export function popoverParts(groups: readonly ProfileGroup[], open: boolean): PopoverPart[] {
  return [
    'note',
    ...groups.map((group): PopoverPart => (group.local ? 'group:local' : 'group:cloud')),
    ...(open ? (['model'] as const) : []),
    'params',
    'actions',
  ];
}
```

`src/elements/ai/model-chip.element.ts`:

```ts
import { effectiveProfile } from '../../ai/profiles';
import type { GenParams, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { RenderLoop } from '../../dom/renderLoop';
import { uid } from '../../dom/uid';
import { writePref } from '../../lib/prefs';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdAiParameters } from './parameters.element';
import type { HmdAiModelSelect } from './model-select.element';
import {
  chipLabel,
  groupRowKey,
  groupRows,
  hasOverrides,
  popoverParts,
  privacyNote,
  profileGroups,
  profileName,
  type GroupRow,
  type ModelChipController,
  type PopoverPart,
  type ProfileGroup,
} from './modelChipView';
import './model-chip.css';

interface Parts {
  /** Senza profilo: il chip «Gestisci profili» al posto di tutto il resto. */
  manage: HTMLButtonElement;
  anchor: HTMLSpanElement;
  chip: HTMLButtonElement;
  label: Text;
  popover: HTMLDivElement;
  note: HTMLParagraphElement;
  groups: { local: HTMLFieldSetElement; cloud: HTMLFieldSetElement };
  params: HmdAiParameters;
  actions: HTMLDivElement;
  save: HTMLButtonElement;
  saveAs: HTMLButtonElement;
  reset: HTMLButtonElement;
  manageLink: HTMLButtonElement;
}

/** Riga di un profilo; `profile` è l'ultimo ricevuto, `checked` l'ultimo valore mostrato dal radio. */
interface ProfileRow {
  profile: ModelProfile;
  radio: HTMLInputElement;
  name: Text;
  checked: boolean | null;
}

/**
 * Chip del modello nel composer (era ModelChip.tsx): «profilo · modello», con la nota privacy come tooltip,
 * e un popover `auto` con i profili (locali e cloud), il selettore del modello (montato solo a popover
 * aperto: l'elenco dei modelli si chiede solo allora), i parametri e le azioni. Senza profilo, solo il chip
 * «Gestisci profili». Manda `hmd-ai-manage`; il resto lo chiede al controller.
 */
export class HmdAiModelChip extends HmdElement {
  #controller: ModelChipController | null = null;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #id = '';
  #open = false;
  #rows = new WeakMap<Element, ProfileRow>();
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
    focusScope: () => this,
    // Il nodo con il focus è sparito (un profilo tolto a popover aperto, il chip diventato «Gestisci»): sul chip.
    refocus: () => {
      const parts = this.#parts;
      if (parts) (parts.anchor.isConnected ? parts.chip : parts.manage).focus();
    },
  });

  get controller(): ModelChipController | null { return this.#controller; }
  set controller(value: ModelChipController | null) {
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

  protected connect(signal: AbortSignal): void {
    this.#parts ??= this.#build();
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Staccato, il popover si chiude senza evento toggle: ricollegato, il selettore del modello non torna
    // (e non chiede l'elenco) finché il popover non si riapre.
    this.#open = false;
  }

  #build(): Parts {
    const id = (this.#id = uid('hmd-ai-model'));
    const label = document.createTextNode('');
    const chip = el('button', { type: 'button', class: 'chip tooltip', 'aria-describedby': `${id}-privacy`, popovertarget: id }, label, icon('chevronDown', { size: 12 }));
    const popover = el('div', { id, popover: 'auto', class: 'popover', on: { toggle: () => this.#onToggle() } });
    const button = (onClick: () => void, className?: string) => el('button', { type: 'button', class: className, on: { click: onClick } });
    const parts: Parts = {
      manage: button(() => emit(this, 'hmd-ai-manage', null), 'chip'),
      anchor: el('span', { class: 'chipAnchor' }, chip, popover),
      chip,
      label,
      popover,
      note: el('p', { id: `${id}-privacy`, class: 'popoverNote' }),
      groups: { local: el('fieldset', { class: 'popoverSection' }), cloud: el('fieldset', { class: 'popoverSection' }) },
      params: el('hmd-ai-parameters', { on: { 'hmd-params-change': (event) => this.#override(event.detail.params) } }),
      actions: el('div', { class: 'popoverActions' }),
      save: button(() => this.#run((controller) => controller.saveOverrides())),
      saveAs: button(() => this.#run((controller) => controller.saveOverrides(true))),
      reset: button(() => this.#controller?.override({})),
      manageLink: button(() => {
        this.#parts?.popover.hidePopover();
        emit(this, 'hmd-ai-manage', null);
      }, 'link'),
    };
    parts.actions.append(parts.save, parts.saveAs, parts.reset, parts.manageLink);
    return parts;
  }

  #override(params: GenParams | Pick<ModelProfile, 'model' | 'contextTokens'>): void {
    const controller = this.#controller;
    if (controller) controller.override({ ...controller.getState().chat.overrides, ...params });
  }

  #run(job: (controller: ModelChipController) => Promise<unknown>): void {
    const controller = this.#controller;
    if (controller) void job(controller).catch((error: unknown) => controller.report(error));
  }

  /**
   * L'elenco dei modelli si carica solo a popover aperto: il selettore si monta all'apertura, si toglie alla
   * chiusura. Vale lo stato vero del popover, non `newState`: l'evento è un task asincrono e può arrivare
   * quando lo stato è già un altro (staccato e ricollegato nel frattempo, il popover è chiuso senza evento).
   */
  #onToggle(): void {
    const open = this.#parts?.popover.matches(':popover-open') ?? false;
    if (open === this.#open) return;
    this.#open = open;
    this.#loop.update();
  }

  #render(parts: Parts, controller: ModelChipController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    const profile = controller.profile();
    if (!profile) {
      setText(parts.manage, t('ai.manage'));
      parts.anchor.remove();
      if (parts.manage.parentNode !== this) this.append(parts.manage);
      // Il popover tolto si chiude senza evento toggle: il selettore del modello non resta montato.
      this.#open = false;
      return;
    }
    parts.manage.remove();
    const overrides = state.chat.overrides;
    const effective = effectiveProfile(profile, overrides);
    const label = chipLabel(t, profile, overrides);
    const note = privacyNote(t, profile);
    setText(parts.label, hasOverrides(overrides) ? `${label} •` : label);
    toggleAttr(parts.chip, 'data-tooltip', true, note);
    toggleAttr(parts.chip, 'aria-label', true, `${t('ai.profile')}: ${label}`);
    setText(parts.note, note);
    const groups = profileGroups(state.profiles);
    reconcileList(
      parts.popover,
      popoverParts(groups, this.#open),
      (part: PopoverPart) => part,
      (part) => this.#createPart(parts, part),
      (node, part) => {
        if (part === 'group:local' || part === 'group:cloud') {
          const group = groups.find((g) => g.local === (part === 'group:local'))!;
          this.#renderGroup(node as HTMLFieldSetElement, group, profile.id, t);
        } else if (part === 'model') {
          const select = node as HmdAiModelSelect;
          select.controller = controller;
          select.profile = effective;
          select.i18n = i18n;
        } else if (part === 'params') {
          const params = node as HmdAiParameters;
          params.profile = effective;
          params.value = { ...profile.params, ...overrides };
          params.hideEffort = true;
          params.i18n = i18n;
        } else if (part === 'actions') {
          setText(parts.save, t('ai.saveProfile'));
          setText(parts.saveAs, t('ai.saveAs'));
          setText(parts.reset, t('ai.reset'));
          setText(parts.manageLink, t('ai.manage'));
        }
      },
    );
    // L'ancora si ricollega solo con il popover già riconciliato: un selettore rimasto dentro dalla volta
    // prima (popover aperto quando i profili sono spariti) è già fuori e non chiede l'elenco.
    if (parts.anchor.parentNode !== this) this.append(parts.anchor);
  }

  #createPart(parts: Parts, part: PopoverPart): Element {
    switch (part) {
      case 'note':
        return parts.note;
      case 'group:local':
        return parts.groups.local;
      case 'group:cloud':
        return parts.groups.cloud;
      case 'params':
        return parts.params;
      case 'actions':
        return parts.actions;
      case 'model':
        // Un selettore nuovo a ogni apertura, come il componente che React montava: riparte senza «Altro…».
        return el('hmd-ai-model-select', { on: { 'hmd-ai-model-change': (event) => this.#override(event.detail.selection) } });
    }
  }

  #renderGroup(fieldset: HTMLFieldSetElement, group: ProfileGroup, selectedId: string, t: I18nStore['t']): void {
    reconcileList(
      fieldset,
      groupRows(group),
      groupRowKey,
      (row: GroupRow) => (row.kind === 'legend' ? el('legend') : this.#createRow(row.profile)),
      (node, row) => {
        if (row.kind === 'legend') {
          setText(node, t(group.local ? 'ai.local' : 'ai.cloud'));
          return;
        }
        const entry = this.#rows.get(node)!;
        entry.profile = row.profile;
        setText(entry.name, profileName(row.profile));
        // Si scrive solo quando cambia il valore da mostrare: il clic dell'utente conta come già mostrato.
        const checked = row.profile.id === selectedId;
        if (checked !== entry.checked) {
          entry.radio.checked = checked;
          entry.checked = checked;
        }
      },
    );
  }

  #createRow(profile: ModelProfile): HTMLLabelElement {
    const entry: ProfileRow = { profile, radio: null!, name: document.createTextNode(''), checked: null };
    entry.radio = el('input', {
      type: 'radio',
      name: `${this.#id}-profile`,
      on: {
        change: () => {
          entry.checked = true;
          this.#controller?.selectProfile(entry.profile.id);
          writePref('aiProfile', entry.profile.id);
        },
      },
    });
    const label = el('label', null, entry.radio, entry.name);
    this.#rows.set(label, entry);
    return label;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-model-chip': HmdAiModelChip;
  }
}
```

`src/elements/ai/model-chip.css`:

```css
@layer components {
  /* Il limite inferiore lascia selettore del modello e parametri ai loro fogli. */
  @scope (hmd-ai-model-chip) to (hmd-ai-model-select, hmd-ai-parameters) {
    :scope {
      display: contents;
    }

    /*
     * Valori copiati da Composer.module.css (.chip, .chipAnchor, .popover, .popoverSection, .popoverNote,
     * .popoverActions, .link). Le regole per `label > span` e i campi di .popoverSection stanno nei fogli
     * del selettore del modello e dei parametri: qui le righe sono solo radio.
     */
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      min-width: 0;
      padding: 3px 8px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: none;
      color: var(--c-muted);
      font: 13px/1.3 var(--font-ui);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .chip:hover {
      background: var(--c-accent-soft);
      color: var(--c-text);
    }

    /* Il bottone porta `.tooltip` (che usa anchor-name per il tooltip): l'ancora del popover sta sul wrapper. */
    .chipAnchor {
      anchor-name: --ai-model-chip;
      min-width: 0;
    }

    .popover {
      position-anchor: --ai-model-chip;
      position-area: block-start span-inline-end;
      position-try-fallbacks: flip-block;
      margin: 0 0 6px;
      width: min(22rem, 90vw);
      max-height: 70vh;
      overflow: auto;
      padding: 12px;
      border: 1px solid var(--c-border);
      border-radius: 10px;
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: 0 4px 20px rgb(0 0 0 / 0.2);
    }

    .popoverSection {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 10px;
      padding: 0;
      border: none;
    }

    .popoverSection legend {
      margin-bottom: 4px;
      color: var(--c-muted);
      font-size: 12px;
    }

    .popoverSection label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .popoverNote {
      margin: 0 0 10px;
      color: var(--c-muted);
      font-size: 12px;
    }

    .popoverActions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .link {
      align-self: flex-start;
      padding: 0;
      border: none;
      background: none;
      color: var(--c-accent);
      font-size: 13px;
      cursor: pointer;
    }
  }
}
```

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: import `import { HmdAiModelChip } from './ai/model-chip.element';` prima di quello di `HmdAiModelSelect`, e nella lista, prima di `['hmd-ai-model-select', HmdAiModelSelect],`:

```ts
  ['hmd-ai-model-chip', HmdAiModelChip],
```

`src/elements/events.ts`, **subito sopra** la riga `/** Selettore del modello: modello scelto dall'elenco o scritto in «Altro…», con il suo contesto se noto. */` (il JSDoc di `'hmd-ai-model-change'`):

```ts
  /** Chip del modello: aprire le impostazioni dei profili («Gestisci profili…», o il chip senza profili). */
  'hmd-ai-manage': CustomEvent<null>;
```

`src/elements/jsx.d.ts`: import `import type { ModelChipController } from './ai/modelChipView';` prima di quello di `ModelSelectController`, e prima di `'hmd-ai-model-select'`:

```ts
      'hmd-ai-model-chip': HmdProps<{ controller: ModelChipController; i18n: I18nStore }, 'hmd-ai-manage'>;
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/modelChipView.test.ts src/elements/ai/model-chip.dom.test.ts` → 21 PASS (e `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/file-tree/*.test.ts src/elements/notice/*.test.ts src/elements/toasts/*.test.ts` verde con lo stub nuovo).

- [ ] **Step 5: `Composer.tsx` monta il tag**

Via `import { ModelChip } from './ModelChip';`, e `<ModelChip controller={controller} onManage={onManage} />` diventa:

```tsx
        <hmd-ai-model-chip controller={controller} i18n={i18nStore} onhmd-ai-manage={onManage} />
```

- [ ] **Step 6: Via `ModelChip.tsx`, controlli**

```bash
git rm src/ui/ai/ModelChip.tsx
grep -rnE "from '\./ModelChip'|<ModelChip[ />]" src; echo "exit $?"   # atteso: exit 1
```

- [ ] **Step 7: Verifica completa**

```bash
npm test                    # 878 + 21 = 899
npm run lint
npm run test:e2e            # 175, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/ai-model.spec.ts e2e/ai-chips.spec.ts e2e/ai-review.spec.ts --repeat-each=3
npm run test:e2e:dev        # 160
npm run test:e2e:audit      # 100, nessuna differenza
```

- [ ] **Step 8: Commit**

```bash
git add src/elements/ src/testing/fakeAi.ts src/testing/popoverStub.ts src/ui/ai/Composer.tsx
git commit -m "feat: hmd-ai-model-chip al posto di ModelChip (popover con selettore montato solo da aperto, radio e nota privacy, focus stabile)"
```

---
### Task 5: `hmd-ai-composer`

**Files:**
- Create: `src/elements/ai/composerView.ts`, `composerView.test.ts`, `composer.element.ts`, `composer.css`, `composer.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/ai/AiSidebar.tsx`, `e2e/ai-composer.spec.ts` (test del focus rovesciato)
- Delete: `src/ui/ai/Composer.tsx`, `src/ui/ai/Composer.module.css`

**Interfaces:**
- Consumes: `RenderLoop` (Task 2); `HmdAiModelChip`, `ModelChipController`, evento `hmd-ai-manage` (Task 4); `HmdAiEffortChip` (fase 4c); `composerAction` (`src/ai/composerKeys.ts`); `selectionLabel`, `sameRange`, `TextRange` (`src/ai/selectionChip.ts`); `presetLabel` (`src/ai/presetName.ts`); `ICONS` (`src/ui/icons.ts`); `fakeAi` esteso (Task 4).
- Produces:
  - da `composerView.ts`: `type ComposerController = ModelChipController & Pick<AiController, 'send' | 'stop'>`, `selectionChipText(t, text, selection, ignored): string | null`, `outgoing(request, preset, t): string | null`, `interface SendButton { label: 'ai.send' | 'ai.stop'; icon: 'send' | 'stop'; disabled: boolean }`, `sendButton(running, request, hasProfile): SendButton`
  - `class HmdAiComposer` con proprietà `controller: ComposerController | null`, `text: string`, `selection: TextRange | null`, `getSelection: () => SelectionScope | undefined`, `i18n: I18nStore | null` e metodo `sendPreset(presetId: string): void`

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/composerView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { PromptPreset } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { outgoing, selectionChipText, sendButton } from './composerView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);

test('selection chip: lines for several lines, characters for one, nothing for spaces or no selection', () => {
  const text = 'uno\ndue\ntre';
  assert.equal(selectionChipText(t, text, { from: 0, to: 7 }, null), t('ai.selectionLines', { count: 2 }));
  assert.equal(selectionChipText(t, text, { from: 0, to: 3 }, null), t('ai.selectionChars', { count: 3 }));
  assert.equal(selectionChipText(t, 'a   b', { from: 1, to: 4 }, null), null);
  assert.equal(selectionChipText(t, text, null, null), null);
});

test('selection chip: the ignored selection hides it, a different one brings it back', () => {
  const text = 'uno\ndue\ntre';
  assert.equal(selectionChipText(t, text, { from: 0, to: 3 }, { from: 0, to: 3 }), null);
  assert.equal(selectionChipText(t, text, { from: 4, to: 7 }, { from: 0, to: 3 }), t('ai.selectionChars', { count: 3 }));
});

test('outgoing: the preset label, else the trimmed text; nothing for blanks', () => {
  const preset = { id: 'p', name: '', builtInId: 'traduci' } as PromptPreset;
  assert.equal(outgoing('typed', preset, t), EN_MESSAGES['ai.preset.traduci']);
  assert.equal(outgoing('  hi \n', undefined, t), 'hi');
  assert.equal(outgoing('  \n ', undefined, t), null);
});

test('send button: Stop while running (never disabled), Send disabled without text or profile', () => {
  assert.deepEqual(sendButton(true, '', false), { label: 'ai.stop', icon: 'stop', disabled: false });
  assert.deepEqual(sendButton(false, 'x', true), { label: 'ai.send', icon: 'send', disabled: false });
  assert.equal(sendButton(false, '  ', true).disabled, true);
  assert.equal(sendButton(false, 'x', false).disabled, true);
});
```

`src/elements/ai/composer.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { AiState } from '../../ai/aiController';
import type { PromptPreset, SelectionScope } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const TEXT = 'uno\ndue\ntre';
const PRESET = { id: 'p1', name: 'Fix it', builtInId: undefined, order: 0, hidden: false } as unknown as PromptPreset;
const SCOPE = { from: 0, to: 3, originalText: 'uno', status: 'valid' } as SelectionScope;

function mount(withProfile = true) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.request': 'CHIEDI', 'ai.send': 'INVIA' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ presets: [PRESET] }, withProfile ? defaultProfile('ollama', 'o') : undefined);
  const el = document.createElement('hmd-ai-composer');
  el.controller = ai;
  el.text = TEXT;
  el.selection = null;
  el.getSelection = () => SCOPE;
  el.i18n = i18n;
  document.body.append(el);
  const input = () => el.querySelector('textarea')!;
  const send = () => el.querySelector<HTMLButtonElement>('button.send')!;
  const chip = () => el.querySelector<HTMLElement>('.selection');
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    input().dispatchEvent(event);
    return event;
  };
  const running = (on: boolean) => ai.set({ running: on ? { messageId: 'm', path: 'a.md', startedAt: 0 } : null } as Partial<AiState>);
  return { el, ai, i18n, listeners, input, send, chip, type, key, running };
}

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus; jsdom no: qui lo si
 * manda a mano dentro `remove()`, cioè nel mezzo di un render.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    // Come Chromium: solo se il nodo è nel documento e contiene il focus (un nodo già tolto non manda nulla).
    if (this.isConnected && this.contains(document.activeElement)) this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

test('the same DOM as Composer.tsx: box, textarea, row with the two chips and Send', () => {
  const { el, input, send, chip } = mount();
  const box = el.firstElementChild!;
  assert.equal(box.className, 'composer');
  assert.deepEqual([...box.children].map((c) => c.localName), ['textarea', 'div']);
  assert.equal(input().className, 'input');
  assert.equal(input().getAttribute('aria-label'), EN_MESSAGES['ai.request']);
  assert.equal(input().getAttribute('placeholder'), EN_MESSAGES['ai.request']);
  const row = box.lastElementChild!;
  assert.equal(row.className, 'row');
  assert.deepEqual([...row.children].map((c) => c.localName), ['hmd-ai-model-chip', 'hmd-ai-effort-chip', 'button']);
  assert.equal(send().className, 'send tooltip');
  assert.equal(send().type, 'button');
  assert.equal(send().getAttribute('aria-label'), EN_MESSAGES['ai.send']);
  assert.equal(send().getAttribute('data-tooltip'), EN_MESSAGES['ai.send']);
  assert.equal(send().disabled, true);
  assert.equal(chip(), null);
  assert.equal(el.querySelector('hmd-ai-model-chip')!.controller, el.controller);
  assert.equal(el.querySelector('hmd-ai-effort-chip')!.i18n, el.i18n);
});

test('Send follows the text and the profile', () => {
  const { send, type } = mount();
  type('  ');
  assert.equal(send().disabled, true);
  type('fix');
  assert.equal(send().disabled, false);
  const without = mount(false);
  without.type('fix');
  assert.equal(without.send().disabled, true);
});

test('Enter sends the trimmed text and empties the box; Shift+Enter, Ctrl+Enter and IME do not', () => {
  const { ai, type, key, input } = mount();
  type('  fix it  ');
  assert.equal(key('Enter', { shiftKey: true }).defaultPrevented, false);
  assert.equal(key('Enter', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(key('Enter', { isComposing: true } as KeyboardEventInit).defaultPrevented, false);
  assert.deepEqual(ai.calls, []);
  assert.equal(key('Enter').defaultPrevented, true);
  assert.deepEqual(ai.calls, [['send', 'fix it', undefined, undefined]]);
  assert.equal(input().value, '');
});

test('while running the button is Stop (same node): Escape and the button stop; Enter does not send again', () => {
  const { ai, send, type, key, running, input } = mount();
  const node = send();
  running(true);
  assert.equal(send(), node);
  assert.equal(node.getAttribute('aria-label'), EN_MESSAGES['ai.stop']);
  assert.equal(node.disabled, false);
  type('more');
  key('Enter');
  assert.equal(input().value, 'more');
  assert.equal(key('Escape').defaultPrevented, true);
  node.click();
  assert.deepEqual(ai.calls, [['stop'], ['stop']]);
  running(false);
  assert.equal(node.getAttribute('aria-label'), EN_MESSAGES['ai.send']);
});

test('the box is never rewritten by a store notification or a new text', () => {
  const { el, ai, input, type } = mount();
  type('half typed');
  input().setSelectionRange(4, 4);
  ai.override({ temperature: 1 });
  el.text = 'another document';
  assert.equal(input().value, 'half typed');
  assert.equal(input().selectionStart, 4);
});

test('the selection chip: text, ✕ that hides it until another selection, the scope sent with it', () => {
  const { el, ai, chip, type, key } = mount();
  el.selection = { from: 0, to: 7 };
  assert.equal(chip()!.firstChild!.textContent, t('ai.selectionLines', { count: 2 }));
  assert.equal(chip()!.parentElement!.firstElementChild, chip());
  const ignore = chip()!.querySelector('button')!;
  assert.equal(ignore.className, 'selectionClose tooltip');
  assert.equal(ignore.getAttribute('aria-label'), EN_MESSAGES['ai.selectionIgnore']);
  type('scoped');
  key('Enter');
  assert.deepEqual(ai.calls.at(-1), ['send', 'scoped', undefined, SCOPE]);
  ignore.click();
  assert.equal(chip(), null);
  type('whole');
  key('Enter');
  assert.deepEqual(ai.calls.at(-1), ['send', 'whole', undefined, undefined]);
  el.selection = { from: 4, to: 7 };
  assert.equal(chip()!.firstChild!.textContent, t('ai.selectionChars', { count: 3 }));
});

test('a selection lost before sending reports scopeLost and keeps the text', () => {
  const { el, ai, type, key, input } = mount();
  el.selection = { from: 0, to: 3 };
  el.getSelection = () => undefined;
  type('fix');
  key('Enter');
  assert.deepEqual(ai.calls, []);
  assert.deepEqual(ai.reports, [{ code: 'scopeLost' }]);
  assert.equal(input().value, 'fix');
});

test('sendPreset sends the preset label and keeps what is typed; nothing while running', () => {
  const { el, ai, type, input, running } = mount();
  type('draft');
  el.sendPreset('p1');
  assert.deepEqual(ai.calls, [['send', 'Fix it', PRESET, undefined]]);
  assert.equal(input().value, 'draft');
  running(true);
  el.sendPreset('p1');
  assert.equal(ai.calls.length, 1);
});

test('✕ with the focus: the chip goes away and the focus goes to the box (decision 3)', () => {
  const { el, chip, input } = mount();
  el.selection = { from: 0, to: 3 };
  const ignore = chip()!.querySelector('button')!;
  ignore.focus();
  ignore.click();
  assert.equal(chip(), null);
  assert.equal(document.activeElement, input());
});

test('a listener that changes the selection from a focusout while the chip is being removed: one chip at most, focus in the box', () => {
  const { el, chip, input } = mount();
  el.selection = { from: 0, to: 3 };
  const chipNode = chip()!;
  chipNode.querySelector('button')!.focus();
  focusoutOnRemove(chipNode);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.selection = null;
  });
  el.selection = { from: 1, to: 1 };
  assert.equal(el.querySelectorAll('.selection').length, 0);
  assert.equal(document.activeElement, input());
});

test('language change relabels; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, input, send } = mount();
  await i18n.setLocale('it');
  assert.equal(input().getAttribute('placeholder'), 'CHIEDI');
  assert.equal(send().getAttribute('aria-label'), 'INVIA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/composerView.test.ts src/elements/ai/composer.dom.test.ts`
Expected: FAIL: `Cannot find module './composerView'`; 11 FAIL nel test dell'elemento (tag non definito). Annotare il RED.

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/ai/composerView.ts`:

```ts
import type { AiController } from '../../ai/aiController';
import { presetLabel } from '../../ai/presetName';
import { sameRange, selectionLabel, type TextRange } from '../../ai/selectionChip';
import type { PromptPreset } from '../../ai/types';
import type { I18nStore } from '../../state/i18nStore';
import type { ModelChipController } from './modelChipView';

/** Quello che il composer usa del controller: quello del chip del modello, più invio e stop. */
export type ComposerController = ModelChipController & Pick<AiController, 'send' | 'stop'>;

/**
 * Testo del chip della selezione, o null se il chip non c'è: nessuna selezione, solo spazi, oppure la
 * stessa selezione ignorata con ✕ (una selezione diversa lo fa ricomparire).
 */
export function selectionChipText(t: I18nStore['t'], text: string, selection: TextRange | null, ignored: TextRange | null): string | null {
  const label = selectionLabel(text, selection);
  if (label === null || sameRange(ignored, selection)) return null;
  return label.lines > 1 ? t('ai.selectionLines', { count: label.lines }) : t('ai.selectionChars', { count: label.chars });
}

/**
 * Messaggio da inviare, come `send` di Composer.tsx: l'etichetta del preset se c'è (un id sconosciuto vale
 * come nessun preset), altrimenti il testo scritto senza spazi ai bordi; null se non c'è niente da inviare.
 */
export function outgoing(request: string, preset: PromptPreset | undefined, t: I18nStore['t']): string | null {
  const message = preset ? presetLabel(preset, t) : request.trim();
  return message || null;
}

export interface SendButton {
  label: 'ai.send' | 'ai.stop';
  icon: 'send' | 'stop';
  disabled: boolean;
}

/** Il pulsante della riga: Stop durante la generazione, altrimenti Invia (spento senza testo o senza profilo). */
export function sendButton(running: boolean, request: string, hasProfile: boolean): SendButton {
  if (running) return { label: 'ai.stop', icon: 'stop', disabled: false };
  return { label: 'ai.send', icon: 'send', disabled: !request.trim() || !hasProfile };
}
```

`src/elements/ai/composer.element.ts`:

```ts
import { composerAction } from '../../ai/composerKeys';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { ICONS } from '../../ui/icons';
import type { HmdAiEffortChip } from './effort-chip.element';
import type { HmdAiModelChip } from './model-chip.element';
import { outgoing, selectionChipText, sendButton, type ComposerController } from './composerView';
import './composer.css';

interface Parts {
  box: HTMLDivElement;
  /** Chip della selezione: testo e ✕. */
  chip: HTMLSpanElement;
  chipText: Text;
  ignore: HTMLButtonElement;
  input: HTMLTextAreaElement;
  modelChip: HmdAiModelChip;
  effortChip: HmdAiEffortChip;
  /** Un solo pulsante, Invia o Stop, come il nodo che React riusava: il focus non salta. */
  send: HTMLButtonElement;
  sendIcon: HTMLSpanElement;
}

/**
 * Composer della chat AI (era Composer.tsx): chip della selezione, casella della richiesta, riga con il
 * chip del modello, il chip dell'effort e Invia/Stop. La casella è dell'elemento: si crea una volta e
 * l'elemento la svuota solo dopo l'invio di un testo scritto (nessun eco da fuori la riscrive). Invio
 * invia, Shift+Invio va a capo, Esc ferma (composerKeys.ts). `sendPreset()` per i suggerimenti.
 */
export class HmdAiComposer extends HmdElement {
  #controller: ComposerController | null = null;
  #text = '';
  #selection: TextRange | null = null;
  #getSelection: () => SelectionScope | undefined = () => undefined;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  /** Selezione ignorata con ✕: il chip ricompare con una selezione diversa. */
  #ignored: TextRange | null = null;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
    focusScope: () => this.#parts?.box ?? null,
    // Il nodo con il focus è sparito (la ✕ del chip della selezione): il focus va nella casella (decisione 3).
    refocus: () => this.#parts?.input.focus(),
  });

  get controller(): ComposerController | null { return this.#controller; }
  set controller(value: ComposerController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#passDown();
    this.reconnect();
  }
  /** Testo del documento aperto, per contare la selezione. */
  get text(): string { return this.#text; }
  set text(value: string) {
    value ??= '';
    if (value === this.#text) return;
    this.#text = value;
    this.#loop.update();
  }
  get selection(): TextRange | null { return this.#selection; }
  set selection(value: TextRange | null) {
    value ??= null;
    if (value === this.#selection) return;
    this.#selection = value;
    this.#loop.update();
  }
  /** Scope della selezione calcolato al momento dell'invio dalla sessione dell'editor (come prima). */
  get getSelection(): () => SelectionScope | undefined { return this.#getSelection; }
  set getSelection(value: () => SelectionScope | undefined) {
    this.#getSelection = value ?? (() => undefined);
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.#passDown();
    this.reconnect();
  }

  /** Invia il preset (suggerimenti sotto il composer), come `sendPreset` del ref di Composer.tsx. */
  sendPreset(presetId: string): void {
    this.#send(presetId);
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const chipText = document.createTextNode('');
      const ignore = el('button', { type: 'button', class: 'selectionClose tooltip', on: { click: () => this.#ignore() } }, icon('close', { size: 12 }));
      const sendIcon = icon('send', { size: 16 });
      const parts: Parts = {
        box: el('div', { class: 'composer' }),
        chip: el('span', { class: 'selection' }, chipText, ignore),
        chipText,
        ignore,
        input: el('textarea', { class: 'input', on: { input: () => this.#loop.update(), keydown: (event) => this.#onKeyDown(event) } }),
        modelChip: el('hmd-ai-model-chip'),
        effortChip: el('hmd-ai-effort-chip'),
        send: el('button', { type: 'button', class: 'send tooltip', on: { click: () => this.#onButton() } }, sendIcon),
        sendIcon,
      };
      this.#parts = parts;
      // Le proprietà dei chip prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.box.append(parts.input, el('div', { class: 'row' }, parts.modelChip, parts.effortChip, parts.send));
      this.append(parts.box);
    }
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  /** Controller e lingua passano ai due chip (che si riallacciano da soli quando cambiano). */
  #passDown(): void {
    const parts = this.#parts;
    if (!parts) return;
    parts.modelChip.controller = this.#controller;
    parts.modelChip.i18n = this.#i18n;
    parts.effortChip.controller = this.#controller;
    parts.effortChip.i18n = this.#i18n;
  }

  #ignore(): void {
    this.#ignored = this.#selection;
    this.#loop.update();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const controller = this.#controller;
    if (!controller) return;
    const { key, shiftKey, ctrlKey, metaKey, altKey, isComposing } = event;
    const action = composerAction({ key, shiftKey, ctrlKey, metaKey, altKey, isComposing }, !!controller.getState().running);
    if (action === 'send') {
      event.preventDefault();
      this.#send();
    } else if (action === 'stop') {
      event.preventDefault();
      controller.stop();
    }
  }

  #onButton(): void {
    const controller = this.#controller;
    if (!controller) return;
    if (controller.getState().running) controller.stop();
    else this.#send();
  }

  #send(presetId?: string): void {
    const controller = this.#controller;
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!controller || !parts || !i18n) return;
    const state = controller.getState();
    if (state.running) return;
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    const message = outgoing(parts.input.value, preset, i18n.t);
    if (!message || !controller.profile()) return;
    const scoped = selectionChipText(i18n.t, this.#text, this.#selection, this.#ignored) !== null;
    const scope = scoped ? this.#getSelection() : undefined;
    if (scoped && !scope) {
      controller.report({ code: 'scopeLost' });
      return;
    }
    void controller.send(message, preset, scope).catch((error: unknown) => controller.report(error));
    if (preset) return;
    // L'unica scrittura della casella: dopo l'invio di un testo scritto si svuota (spec AI UI §4.2).
    parts.input.value = '';
    this.#loop.update();
  }

  #render(parts: Parts, controller: ComposerController, i18n: I18nStore): void {
    const t = i18n.t;
    const chipText = selectionChipText(t, this.#text, this.#selection, this.#ignored);
    if (chipText !== null) {
      setText(parts.chipText, chipText);
      toggleAttr(parts.ignore, 'aria-label', true, t('ai.selectionIgnore'));
      toggleAttr(parts.ignore, 'data-tooltip', true, t('ai.selectionIgnore'));
      if (parts.chip.parentNode !== parts.box) parts.box.prepend(parts.chip);
    } else {
      parts.chip.remove();
    }
    toggleAttr(parts.input, 'aria-label', true, t('ai.request'));
    toggleAttr(parts.input, 'placeholder', true, t('ai.request'));
    const button = sendButton(!!controller.getState().running, parts.input.value, !!controller.profile());
    toggleAttr(parts.send, 'aria-label', true, t(button.label));
    toggleAttr(parts.send, 'data-tooltip', true, t(button.label));
    if (parts.send.disabled !== button.disabled) parts.send.disabled = button.disabled;
    parts.sendIcon.style.setProperty('mask-image', `url("${ICONS[button.icon]}")`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-composer': HmdAiComposer;
  }
}
```

`src/elements/ai/composer.css`:

```css
@layer components {
  /* Il limite inferiore lascia i due chip ai loro fogli. */
  @scope (hmd-ai-composer) to (hmd-ai-model-chip, hmd-ai-effort-chip) {
    :scope {
      display: contents;
    }

    /* Valori copiati da Composer.module.css (.composer, .input, .row, .send, .selection, .selectionClose). */
    .composer {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border: 1px solid var(--c-border);
      border-radius: 14px;
      background: var(--c-surface);
    }

    .composer:focus-within {
      border-color: var(--c-accent);
    }

    .input {
      field-sizing: content;
      min-height: 2lh;
      max-height: 10lh;
      resize: none;
      border: none;
      outline: none;
      background: none;
      color: var(--c-text);
      font: inherit;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .row > :last-child {
      margin-inline-start: auto;
    }

    .send {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 50%;
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      cursor: pointer;
    }

    .send:disabled {
      background: var(--c-border);
      color: var(--c-muted);
      cursor: default;
    }

    .selection {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 8px;
      border-radius: 999px;
      background: var(--c-accent-soft);
      font-size: 12px;
    }

    .selectionClose {
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
    }
  }
}
```

- [ ] **Step 4: Registrazione e tipi** (nessun evento nuovo: `hmd-ai-manage` sale dal chip)

`src/elements/define.ts`: import `import { HmdAiComposer } from './ai/composer.element';` dopo quello di `HmdAiChatLog`, e nella lista, dopo `['hmd-ai-chat-log', HmdAiChatLog],`:

```ts
  ['hmd-ai-composer', HmdAiComposer],
```

`src/elements/jsx.d.ts`:
- `import type { ChatMessage, GenParams, ModelProfile } from '../ai/types';` diventa `import type { ChatMessage, GenParams, ModelProfile, SelectionScope } from '../ai/types';`;
- **prima** di `import type { HmdAiDiffPane } from './ai/diff-pane.element';` (ordine alfabetico):

```ts
import type { HmdAiComposer } from './ai/composer.element';
import type { ComposerController } from './ai/composerView';
```

- via `import type { ModelChipController } from './ai/modelChipView';`;
- via le righe di `'hmd-ai-effort-chip'` e `'hmd-ai-model-chip'` (React non li monta più: decisione 8);
- prima di `'hmd-ai-diff-pane'`:

```ts
      'hmd-ai-composer': HmdProps<
        { controller: ComposerController; text: string; selection: TextRange | null; getSelection: () => SelectionScope | undefined; i18n: I18nStore },
        'hmd-ai-manage'
      > & { ref?: Ref<HmdAiComposer> };
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/composerView.test.ts src/elements/ai/composer.dom.test.ts` → 15 PASS.

- [ ] **Step 5: `AiSidebar.tsx` monta il tag**

- via `import { Composer, type ComposerHandle } from './Composer';`; dopo `import type { SettingsSection } from '../../lib/route';`:

```ts
import type { HmdAiComposer } from '../../elements/ai/composer.element';
```

- `const composer = useRef<ComposerHandle>(null);` diventa `const composer = useRef<HmdAiComposer>(null);`;
- `<Composer ref={composer} controller={controller} text={text} selection={selection} getSelection={getSelection} onManage={() => onSettings('ai-profiles')} />` diventa:

```tsx
        <hmd-ai-composer
          ref={composer}
          controller={controller}
          text={text}
          selection={selection}
          getSelection={getSelection}
          i18n={i18nStore}
          onhmd-ai-manage={() => onSettings('ai-profiles')}
        />
```

(`onhmd-ai-suggestion={(event) => composer.current?.sendPreset(event.detail.presetId)}` non cambia: ora chiama il metodo dell'elemento.)

- [ ] **Step 6: Rovesciare il test del focus perso (decisione 3)**

In `e2e/ai-composer.spec.ts` il test «ignoring the selection with ✕: where the focus goes» diventa «ignoring the selection with ✕: the focus goes to the box», e le sue ultime due righe

```ts
    // Difetto di oggi (React): il ✕ sparisce con il focus e il focus cade sul body. Il Task 5 lo rovescia (decisione 3).
    await expect.poll(() => focusOnBody(app)).toBe(true);
```

diventano

```ts
    // Decisione 3: il ✕ sparisce con il focus, che va nella casella del composer e non sul body.
    await expect(composer(app)).toBeFocused();
```

(`focusOnBody` resta: lo usa «New chat waits for a message…».)

- [ ] **Step 7: Via `Composer.tsx` e `Composer.module.css`, controlli**

```bash
git rm src/ui/ai/Composer.tsx src/ui/ai/Composer.module.css
grep -rnE "from '\./Composer'|<Composer[ />]|Composer\.module\.css'" src; echo "exit $?"   # atteso: exit 1 (i commenti «copiati da Composer.module.css» non hanno l'apice)
grep -rnE "'hmd-ai-(effort-chip|model-chip)'" src/elements/jsx.d.ts; echo "exit $?"        # atteso: exit 1
```

- [ ] **Step 8: Verifica completa**

```bash
npm test                    # 899 + 15 = 914
npm run lint
npm run test:e2e            # 175, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/ai-composer.spec.ts e2e/ai-chat-log.spec.ts e2e/ai-review.spec.ts e2e/ai-diff.spec.ts --repeat-each=3
npm run test:e2e:dev        # 160
npm run test:e2e:audit      # 100, nessuna differenza (ai-composer-*, model-chip-hover, effort-chip, ai-review…)
```

- [ ] **Step 9: Commit**

```bash
git add src/elements/ src/ui/ai/AiSidebar.tsx e2e/ai-composer.spec.ts
git commit -m "feat: hmd-ai-composer al posto di Composer (casella mai riscritta, un solo pulsante Invia/Stop, focus nella casella se il chip della selezione sparisce)"
```

---

### Task 6: `hmd-ai-sidebar`

**Files:**
- Create: `src/elements/ai/sidebar.element.ts`, `sidebar.css`, `sidebar.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/ai/AiSidebar.tsx`, `src/ui/ai/AiSidebar.module.css`

**Interfaces:**
- Consumes: `RenderLoop` (Task 2); `HmdAiComposer`, `ComposerController`, `sendPreset` (Task 5); `HmdAiChatLog` ed eventi `hmd-ai-open-file`, `hmd-ai-retry` (fase 5a); `HmdAiSuggestions` ed evento `hmd-ai-suggestion` (fase 4c); `AiController`, `AiWorkspace` (`src/ai/aiController.ts`); `fakeAi` esteso (Task 4).
- Produces: `type SidebarController = ComposerController & Pick<AiController, 'newChat' | 'retry'> & { readonly workspace: Pick<AiWorkspace, 'openFile'> }` e `class HmdAiSidebar` con proprietà `controller: SidebarController | null`, `text: string`, `selection: TextRange | null`, `getSelection: () => SelectionScope | undefined`, `syncNeedsPermission: boolean`, `i18n: I18nStore | null`; evento `hmd-ai-sync-reactivate` (`null`).

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/sidebar.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { AiState } from '../../ai/aiController';
import { defaultProfile } from '../../ai/profiles';
import type { ChatMessage, PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { fakeAi } from '../../testing/fakeAi';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

test.afterEach(() => document.body.replaceChildren());

const PRESET = { id: 'p1', name: 'Fix it', order: 0, hidden: false } as unknown as PromptPreset;
const MESSAGE: ChatMessage = { id: 'm1', role: 'user', text: 'fix', docPath: 'a.md', status: 'done' };

function mount() {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.title': 'IA', 'ai.newChat': 'NUOVA' } }),
      persist() {},
    }),
  );
  const ai = fakeAi({ presets: [PRESET] }, defaultProfile('ollama', 'o'));
  const el = document.createElement('hmd-ai-sidebar');
  el.controller = ai;
  el.text = 'uno\ndue';
  el.selection = { from: 0, to: 3 };
  el.getSelection = () => undefined;
  el.syncNeedsPermission = false;
  el.i18n = i18n;
  document.body.append(el);
  let reactivate = 0;
  el.addEventListener('hmd-ai-sync-reactivate', () => reactivate++);
  const newChat = () => el.querySelector<HTMLButtonElement>('.header button')!;
  return { el, ai, i18n, listeners, newChat, reactivations: () => reactivate };
}

test('the same DOM as AiSidebar.tsx: header, chat log, bottom with composer and suggestions', () => {
  const { el, newChat } = mount();
  const root = el.firstElementChild!;
  assert.equal(root.className, 'sidebar');
  assert.deepEqual([...root.children].map((c) => c.localName), ['div', 'hmd-ai-chat-log', 'div']);
  const header = root.firstElementChild!;
  assert.equal(header.className, 'header');
  assert.equal(header.querySelector('h2')!.className, 'title');
  assert.equal(header.querySelector('h2')!.textContent, EN_MESSAGES['ai.title']);
  assert.equal(newChat().className, 'iconButton tooltip');
  assert.equal(newChat().getAttribute('aria-label'), EN_MESSAGES['ai.newChat']);
  assert.equal(newChat().getAttribute('data-tooltip'), EN_MESSAGES['ai.newChat']);
  const bottom = root.lastElementChild!;
  assert.equal(bottom.className, 'bottom');
  assert.deepEqual([...bottom.children].map((c) => c.localName), ['hmd-ai-composer', 'hmd-ai-suggestions']);
});

test('inputs reach the children: messages to the log, text, selection and controller to the composer', () => {
  const { el, ai } = mount();
  const composer = el.querySelector('hmd-ai-composer')!;
  assert.equal(composer.controller, ai);
  assert.equal(composer.text, 'uno\ndue');
  assert.deepEqual(composer.selection, { from: 0, to: 3 });
  assert.equal(composer.getSelection, el.getSelection);
  el.text = 'tre';
  assert.equal(composer.text, 'tre');
  ai.set({ chat: { id: 'c', messages: [MESSAGE], overrides: {} } } as Partial<AiState>);
  assert.deepEqual(el.querySelector('hmd-ai-chat-log')!.messages, [MESSAGE]);
});

test('New chat: disabled with an empty chat and nothing running, otherwise it starts a new chat', () => {
  const { ai, newChat } = mount();
  assert.equal(newChat().disabled, true);
  ai.set({ running: { messageId: 'm', path: 'a.md', startedAt: 0 } } as Partial<AiState>);
  assert.equal(newChat().disabled, false);
  ai.set({ running: null, chat: { id: 'c', messages: [MESSAGE], overrides: {} } } as Partial<AiState>);
  assert.equal(newChat().disabled, false);
  newChat().click();
  assert.deepEqual(ai.calls, [['newChat']]);
});

test('the chat log opens a file and retries through the controller', () => {
  const { el, ai } = mount();
  const log = el.querySelector('hmd-ai-chat-log')!;
  log.dispatchEvent(new CustomEvent('hmd-ai-open-file', { detail: { path: 'b.md' }, bubbles: true }));
  log.dispatchEvent(new CustomEvent('hmd-ai-retry', { detail: { id: 'm1', removeRejected: true }, bubbles: true }));
  assert.deepEqual(ai.calls, [['openFile', 'b.md'], ['retry', 'm1', true]]);
});

test('a suggestion sends its preset through the composer', () => {
  const { el, ai } = mount();
  el.querySelector('hmd-ai-suggestions')!.querySelector<HTMLButtonElement>('button')!.click();
  // La selezione c'è ma la sessione non ha più lo scope: scopeLost, come con l'invio di un testo.
  assert.deepEqual(ai.reports, [{ code: 'scopeLost' }]);
  el.selection = null;
  el.querySelector('hmd-ai-suggestions')!.querySelector<HTMLButtonElement>('button')!.click();
  assert.deepEqual(ai.calls, [['send', 'Fix it', PRESET, undefined]]);
});

test('the sync button: only when the permission is missing, first in the bottom; it sends hmd-ai-sync-reactivate', () => {
  const { el, reactivations } = mount();
  assert.equal(el.querySelector('button.file'), null);
  el.syncNeedsPermission = true;
  const sync = el.querySelector<HTMLButtonElement>('button.file')!;
  assert.equal(sync.textContent, `⚠ ${EN_MESSAGES['ai.syncReactivate']}`);
  assert.equal(sync.parentElement!.firstElementChild, sync);
  sync.click();
  assert.equal(reactivations(), 1);
  el.syncNeedsPermission = false;
  assert.equal(el.querySelector('button.file'), null);
});

test('language change relabels; detached, no listener left', async () => {
  const { el, ai, i18n, listeners, newChat } = mount();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('h2')!.textContent, 'IA');
  assert.equal(newChat().getAttribute('aria-label'), 'NUOVA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(ai.listeners(), 0);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/sidebar.dom.test.ts`
Expected: 7 FAIL (`TypeError: Cannot read properties of null`: tag non definito). Annotare il RED.

- [ ] **Step 3: Elemento e foglio** (nessuna logica pura nuova: le regole stanno in `aiChips.ts` e `composerView.ts`)

`src/elements/ai/sidebar.element.ts`:

```ts
import type { AiController, AiWorkspace } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdAiChatLog } from './chat-log.element';
import type { HmdAiComposer } from './composer.element';
import type { ComposerController } from './composerView';
import type { HmdAiSuggestions } from './suggestions.element';
import './sidebar.css';

/** Quello che la sidebar usa del controller: quello del composer, più nuova chat, riprova e apertura di un file. */
export type SidebarController = ComposerController & Pick<AiController, 'newChat' | 'retry'> & { readonly workspace: Pick<AiWorkspace, 'openFile'> };

interface Parts {
  root: HTMLDivElement;
  title: HTMLHeadingElement;
  newChat: HTMLButtonElement;
  log: HmdAiChatLog;
  bottom: HTMLDivElement;
  /** «⚠ Riattiva il permesso di sync», solo quando la cartella di sync non ha il permesso. */
  sync: HTMLButtonElement;
  composer: HmdAiComposer;
  suggestions: HmdAiSuggestions;
}

/**
 * Sidebar della modalità AI (era AiSidebar.tsx): testata con «Nuova chat», registro della chat, composer
 * e suggerimenti (che inviano il preset con `sendPreset` del composer). Aprire un file e riprovare un
 * messaggio passano dal controller come prima; verso fuori manda solo `hmd-ai-sync-reactivate` (e lascia
 * salire `hmd-ai-manage` dal chip del modello).
 */
export class HmdAiSidebar extends HmdElement {
  #controller: SidebarController | null = null;
  #text = '';
  #selection: TextRange | null = null;
  #getSelection: () => SelectionScope | undefined = () => undefined;
  #syncNeedsPermission = false;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  // Nessun recupero del focus qui: il registro e il composer hanno il loro (come con React).
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
  });

  get controller(): SidebarController | null { return this.#controller; }
  set controller(value: SidebarController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#passDown();
    this.reconnect();
  }
  get text(): string { return this.#text; }
  set text(value: string) {
    this.#text = value ?? '';
    this.#passDown();
  }
  get selection(): TextRange | null { return this.#selection; }
  set selection(value: TextRange | null) {
    this.#selection = value ?? null;
    this.#passDown();
  }
  get getSelection(): () => SelectionScope | undefined { return this.#getSelection; }
  set getSelection(value: () => SelectionScope | undefined) {
    this.#getSelection = value ?? (() => undefined);
    this.#passDown();
  }
  get syncNeedsPermission(): boolean { return this.#syncNeedsPermission; }
  set syncNeedsPermission(value: boolean) {
    value = !!value;
    if (value === this.#syncNeedsPermission) return;
    this.#syncNeedsPermission = value;
    this.#loop.update();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.#passDown();
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const parts: Parts = {
        root: el('div', { class: 'sidebar' }),
        title: el('h2', { class: 'title' }),
        newChat: el('button', { type: 'button', class: 'iconButton tooltip', on: { click: () => this.#controller?.newChat() } }, icon('newFile')),
        log: el('hmd-ai-chat-log', {
          on: {
            'hmd-ai-open-file': (event) => void this.#controller?.workspace.openFile(event.detail.path),
            'hmd-ai-retry': (event) => void this.#controller?.retry(event.detail.id, event.detail.removeRejected),
          },
        }),
        bottom: el('div', { class: 'bottom' }),
        sync: el('button', { type: 'button', class: 'file', on: { click: () => emit(this, 'hmd-ai-sync-reactivate', null) } }),
        composer: el('hmd-ai-composer'),
        suggestions: el('hmd-ai-suggestions', { on: { 'hmd-ai-suggestion': (event) => this.#parts?.composer.sendPreset(event.detail.presetId) } }),
      };
      this.#parts = parts;
      // Le proprietà dei figli prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.bottom.append(parts.composer, parts.suggestions);
      parts.root.append(el('div', { class: 'header' }, parts.title, parts.newChat), parts.log, parts.bottom);
      this.append(parts.root);
    }
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  /** Ingressi che passano ai figli così come arrivano (i figli ignorano i valori uguali). */
  #passDown(): void {
    const parts = this.#parts;
    if (!parts) return;
    parts.log.i18n = this.#i18n;
    parts.composer.controller = this.#controller;
    parts.composer.text = this.#text;
    parts.composer.selection = this.#selection;
    parts.composer.getSelection = this.#getSelection;
    parts.composer.i18n = this.#i18n;
    parts.suggestions.controller = this.#controller;
    parts.suggestions.i18n = this.#i18n;
  }

  #render(parts: Parts, controller: SidebarController, i18n: I18nStore): void {
    const t = i18n.t;
    const state = controller.getState();
    setText(parts.title, t('ai.title'));
    toggleAttr(parts.newChat, 'aria-label', true, t('ai.newChat'));
    toggleAttr(parts.newChat, 'data-tooltip', true, t('ai.newChat'));
    const empty = state.chat.messages.length === 0 && !state.running;
    if (parts.newChat.disabled !== empty) parts.newChat.disabled = empty;
    parts.log.messages = state.chat.messages;
    if (this.#syncNeedsPermission) {
      setText(parts.sync, `⚠ ${t('ai.syncReactivate')}`);
      if (parts.sync.parentNode !== parts.bottom) parts.bottom.prepend(parts.sync);
    } else {
      parts.sync.remove();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-sidebar': HmdAiSidebar;
  }
}
```

`src/elements/ai/sidebar.css` (valori copiati da `AiSidebar.module.css`; il limite inferiore è necessario: `hmd-ai-chat-log` ha anch'esso un pulsante `.file`, che senza limite prenderebbe bordo, margini e larghezza della sidebar):

```css
@layer components {
  /* Il limite inferiore lascia registro, composer e suggerimenti ai loro fogli (il registro ha anche un .file). */
  @scope (hmd-ai-sidebar) to (hmd-ai-chat-log, hmd-ai-composer, hmd-ai-suggestions) {
    :scope {
      display: contents;
    }

    /* Valori copiati da AiSidebar.module.css. */
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--c-border);
      font-family: var(--font-pixel);
    }

    .title {
      flex: 1;
      margin: 0;
      font-size: 14px;
      font-weight: normal;
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

    .file {
      display: block;
      width: 100%;
      margin: 8px 0;
      padding: 2px 0;
      border: none;
      border-top: 1px solid var(--c-border);
      background: none;
      color: var(--c-muted);
      font-size: 12px;
      text-align: start;
      cursor: pointer;
    }

    .bottom {
      padding: 10px;
    }
  }
}
```

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: import `import { HmdAiSidebar } from './ai/sidebar.element';` dopo quello di `HmdAiParameters`, e nella lista, dopo `['hmd-ai-parameters', HmdAiParameters],`:

```ts
  ['hmd-ai-sidebar', HmdAiSidebar],
```

`src/elements/events.ts`, **subito sopra** la riga `/** Conflitto con il disco: l'utente sceglie se ricaricare o sovrascrivere. */` (il JSDoc di `'hmd-conflict'`):

```ts
  /** Sidebar AI: la cartella di sync ha perso il permesso, aprire le impostazioni della sync per riattivarlo. */
  'hmd-ai-sync-reactivate': CustomEvent<null>;
```

`src/elements/jsx.d.ts` (React non monta più registro, composer e suggerimenti: decisione 8):
- `import type { ChatMessage, GenParams, ModelProfile, SelectionScope } from '../ai/types';` diventa `import type { GenParams, ModelProfile, SelectionScope } from '../ai/types';`;
- via `import type { AiChipController } from './ai/aiChips';`, `import type { HmdAiComposer } from './ai/composer.element';` e `import type { ComposerController } from './ai/composerView';`;
- dopo `import type { ModelSelectController } from './ai/modelSelectView';`:

```ts
import type { SidebarController } from './ai/sidebar.element';
```

- via le voci `'hmd-ai-chat-log'`, `'hmd-ai-composer'` (le quattro righe) e `'hmd-ai-suggestions'`; al posto di `'hmd-ai-suggestions'`:

```ts
      'hmd-ai-sidebar': HmdProps<
        {
          controller: SidebarController;
          text: string;
          selection: TextRange | null;
          getSelection: () => SelectionScope | undefined;
          syncNeedsPermission: boolean;
          i18n: I18nStore;
        },
        'hmd-ai-manage' | 'hmd-ai-sync-reactivate'
      >;
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/sidebar.dom.test.ts` → 7 PASS.

- [ ] **Step 5: `WorkspaceView.tsx` monta il tag**

Via `import { AiSidebar } from './ai/AiSidebar';`, e il ramo AI della sidebar

```tsx
            {shownMode === 'ai' && ai ? <AiSidebar
              controller={ai}
              …
              onSettings={openSettings}
              syncNeedsPermission={!!syncBinding.handle && !syncBinding.permission}
            /> : <>
```

diventa (la funzione `getSelection` resta identica):

```tsx
            {shownMode === 'ai' && ai ? <hmd-ai-sidebar
              controller={ai}
              text={doc?.text ?? ''}
              selection={aiSelection}
              getSelection={() => {
                const selected = session.selection?.main;
                return selected && !selected.empty
                  ? { from: selected.from, to: selected.to, originalText: session.textLf.slice(selected.from, selected.to), status: 'valid' }
                  : undefined;
              }}
              syncNeedsPermission={!!syncBinding.handle && !syncBinding.permission}
              i18n={i18nStore}
              onhmd-ai-manage={() => openSettings('ai-profiles')}
              onhmd-ai-sync-reactivate={() => openSettings('ai-sync')}
            /> : <>
```

- [ ] **Step 6: Via `AiSidebar.tsx` e il suo modulo, controlli**

```bash
git rm src/ui/ai/AiSidebar.tsx src/ui/ai/AiSidebar.module.css
grep -rnE "from '\./ai/AiSidebar'|<AiSidebar[ />]|AiSidebar\.module\.css'" src; echo "exit $?"           # atteso: exit 1
grep -rnE "'hmd-ai-(chat-log|composer|suggestions)'" src/elements/jsx.d.ts; echo "exit $?"           # atteso: exit 1
ls src/ui/ai/                       # restano ReviewBar.tsx, ReviewView.tsx (+ modulo), reviewDoc.ts, settings/, useAiController.ts, useAiState.ts
```

- [ ] **Step 7: Verifica completa**

```bash
npm test                    # 914 + 7 = 921
npm run lint
npm run test:e2e            # 175, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/ai-model.spec.ts e2e/ai-composer.spec.ts e2e/ai-chips.spec.ts e2e/ai-chat-log.spec.ts e2e/ai-review.spec.ts --repeat-each=3
npm run test:e2e:dev        # 160
npm run test:e2e:audit      # 100, nessuna differenza (ai-sync-reactivate, ai-chat-*, ai-suggestions…)
```

- [ ] **Step 8: Commit**

```bash
git add src/elements/ src/ui/WorkspaceView.tsx
git commit -m "feat: hmd-ai-sidebar al posto di AiSidebar (registro, composer e suggerimenti creati dall'elemento, sendPreset interno)"
```

---

### Task 7: Documenti, misure, chiusura

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1 (prototipo: 437 013 → 439 425)
npm test                                    # annotare: 921
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: «fase 6a sul branch `feat/web-components`, in `main` al merge della sotto-fase; fasi 6b–8 ancora piano» → «fase 6a in `main` (merge dell'11/10); fase 6b sul branch `feat/web-components`, in `main` al merge della sotto-fase; fasi 6c–8 ancora piano».
2. §7 «Fase 6», nel punto «AI: `hmd-ai-composer` (`composerKeys`, chip della selezione, `focus()` pubblico), …»: «`focus()` pubblico» → «`sendPreset()` pubblico».
3. In fondo a §7 fase 6, dopo il punto «6a **fatta**…»: «- 6b **fatta**: `hmd-ai-model-select` (evento `hmd-ai-model-change`; elenco dei modelli chiesto con `controller.provider(profile).listModels(signal)` solo al collegamento e quando cambiano tipo, indirizzo o chiave salvata, o con «Aggiorna», risposte tardive o superate scartate; montato anche nel dettaglio dei profili delle impostazioni; `ai/modelSelectView.ts`), `hmd-ai-model-chip` (evento `hmd-ai-manage`; popover `auto` con `popovertarget` e id da `uid`, selettore del modello creato a ogni apertura e tolto alla chiusura, nota privacy; `ai/modelChipView.ts`), `hmd-ai-composer` (`sendPreset()`; casella mai riscritta tranne lo svuotamento dopo l'invio, un solo pulsante Invia/Stop; `ai/composerView.ts`), `hmd-ai-sidebar` (evento `hmd-ai-sync-reactivate`; crea registro, composer e suggerimenti). Gli elementi creano i figli `hmd-*` e passano le proprietà prima dell'inserimento; fogli con limite inferiore sui figli (`@scope (…) to (hmd-…)`). Schema di render comune in `dom/renderLoop.ts` (`RenderLoop`, applicato anche ai tre pannelli della 6a). Test statico: gli elementi non importano `ai/providers` e non toccano le chiavi. Cambiato di proposito (decisione 3 del piano 11): la ✕ del chip della selezione che sparisce lascia il focus nella casella, non sul `body`. Restano come oggi (decisione 4) i pulsanti che si disattivano con il focus (Invia, Nuova chat): Chromium porta il focus sul `body` un fotogramma dopo. Audit esteso a chip della selezione, testo scritto, generazione in corso, passaggio sul chip, gruppi di profili, «Altro…», server non raggiungibile, riattivazione della sync. Bundle principale gzip: <valore del Task 1> → <valore dello Step 1> B.» (sostituire i due valori con i numeri annotati).
4. §13: aggiungere `docs/superpowers/plans/2026-10-11-housemd-wc-11-fase-6b-composer-e-sidebar-ai.md` (fase 6b) dopo il piano 10.

- [ ] **Step 3: Verifica finale**

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit
git status --short
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md
git commit -m "docs: spec allineato alla fase 6b (selettore e chip del modello, composer, sidebar AI)"
```

- [ ] **Step 5: Chiusura (controller, non l'implementer)**

Nell'ordine: review finale dell'intero diff del branch rispetto a `main` (Opus: tocca le regole AI, R21); `/codex-review-chat` sul diff (escludendo `docs/superpowers/plans`); checklist manuale (Step 6); solo con tutto pulito, merge in `main` e push:

```bash
cd /home/davidedipumpo/Projects/housemd && git status --short   # pulito
git merge --no-ff feat/web-components -m "Merge: fase 6b Web Components (selettore e chip del modello, composer, sidebar AI)"
npm test && npm run lint
git push origin main
cd ../housemd-wc && git merge --ff-only main && git push origin feat/web-components
```

- [ ] **Step 6: Checklist manuale** (Chrome su Linux, server di sviluppo del worktree con `npx vite --port 5197 --strictPort --host 127.0.0.1`, quindi con StrictMode, aperto su `http://127.0.0.1:5197/` e non sulla 5180 della cartella vera; cartella di prova in OPFS con `window.showDirectoryPicker` sostituito via script; Ollama finto sostituendo `window.fetch` per `localhost:11434` (`/api/tags` con due o tre modelli, chat in SSE con una risposta lenta per vedere Stop); alla fine pulire OPFS, IndexedDB e `localStorage`). Le schede di Claude in Chrome sono `visibilityState: hidden`: niente `requestAnimationFrame` affidabile e Ctrl+K preso da Chrome; ciò che dipende da un fotogramma (il focus che passa al `body` dopo un pulsante disattivato) va guardato in una finestra visibile o da Davide. Prima di chiamare regressione un comportamento sospetto, confrontarlo con `main` (React) su un'altra porta.
  1. Composer: Invio invia, Shift+Invio va a capo, Ctrl+Invio non fa nulla, Esc durante la generazione ferma; Invia spento senza testo; durante la generazione il pulsante è Stop e torna Invia; scrivere veloce mentre arriva la risposta non perde caratteri né il focus; la casella si svuota solo dopo l'invio di un testo.
  2. Chip della selezione: selezione su più righe e su una riga («N caratteri»), ✕ che lo nasconde e lascia il focus nella casella, una selezione diversa che lo fa tornare; invio con la selezione (proposta sul tratto).
  3. Chip del modello: tooltip con la nota privacy (locale, cloud con l'host, CLI); popover sopra il chip e capovolto vicino al bordo superiore; gruppi Locali/Cloud, ⚠ su un profilo cloud senza chiave; scegliere un profilo (ricordato al riavvio); elenco dei modelli chiesto solo all'apertura (rete del finto Ollama), «Aggiorna», «Altro…» con il campo libero, server spento con il messaggio; parametri nel popover (pallino nel chip), Salva nel profilo, Salva come nuovo, Ripristina; Gestisci profili… apre le impostazioni e alla chiusura il focus torna sul chip.
  4. Impostazioni → AI · Profili: il selettore del modello nel dettaglio, «Altro…», Salva; cambio di profilo con il campo libero aperto.
  5. Sidebar: titolo, Nuova chat spenta con la chat vuota, accesa dopo un messaggio, svuota la chat e riporta i suggerimenti; un suggerimento invia il preset; il pulsante del file in un messaggio apre il file; Riprova dopo un errore; con una cartella di sync senza permesso «⚠ Riattiva il permesso di sync» apre AI · Sync.
  6. Cambio di lingua a caldo: casella, Invia/Stop, chip della selezione, chip del modello e popover, titolo e Nuova chat nella lingua nuova.
  7. Tastiera e screen reader: ordine del focus nel composer e nel popover (radio con le frecce), focus ring sui chip e sui pulsanti, `forced-colors`, tooltip al focus di ✕, Invia, Nuova chat; tema chiaro, scuro e automatico.
