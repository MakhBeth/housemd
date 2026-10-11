# HouseMD Web Components — Piano 12: fase 6c, barra e vista della revisione AI (pulsanti mai disattivati, ragioni dal controller)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element i due componenti React della revisione AI: `hmd-ai-review-bar` (era `ui/ai/ReviewBar.tsx`) e `hmd-ai-review` (era `ui/ai/ReviewView.tsx`, con `ReviewView.module.css` e `reviewDoc.ts`), con aspetto e comportamento invariati, tranne tre cambi voluti: (1) i quattro pulsanti della barra (Precedente, Successivo, Scarta, Accetta tutto) non si disattivano più e, attivati quando l'azione non è possibile, dicono perché in una nota `role="status"` sotto la riga dei pulsanti (decisione 3, regola di Davide, spec §2 vincolo 4, proposta di Designer su LAB-14 accettata dal PM); (2) un invio che il controller scarterebbe in silenzio (nessun documento aperto, aggiornamento in corso, generazione in corso anche da Invio) lo dice nella nota del composer e conserva la bozza (decisione 2: `sendBlocker()` sincrono del controller, più `acceptBlocker(p)` da cui deriva `canAccept`); (3) il focus, quando il nodo che lo ha sparisce passando tra diff ed editor semplice (Scarta, Accetta tutto, Continua), va sempre su un bersaglio stabile (decisione 4). Chiude la fase 6 (spec §7): dopo questo piano in `src/ui/` restano solo `WorkspaceView`, `SettingsView` e le sezioni AI delle impostazioni (fase 7).

**Architecture:** Stesso schema di 4c–6b: classe `Hmd<Nome>` su `HmdElement`, DOM interno identico a quello di React (stesse classi, stessi attributi, stesso ordine dei figli: l'audit confronta gli stili per percorso nel DOM saltando gli host con `display: contents`), foglio `@layer components { @scope (hmd-ai-…) to (…) { … } }` con i valori del modulo e il **limite inferiore** sui figli `hmd-*` (`hmd-editor` ha anch'esso una classe `.editor`), ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`, ogni render da un `RenderLoop` (`src/dom/renderLoop.ts`). La catena passa da React agli elementi dal fondo: prima la barra (`ReviewView.tsx` la monta, con eventi `hmd-ai-review-action` e `hmd-ai-review-warning`), poi la vista (`WorkspaceView.tsx` monta `hmd-ai-review`, che crea barra, `hmd-editor` e `hmd-ai-diff-pane` e passa loro le proprietà prima dell'inserimento); nessun componente React finisce mai dentro un elemento. La logica nuova sta in moduli puri accanto agli elementi (`reviewBarView.ts`: ragioni e riga di stato; `reviewView.ts`: il modello della vista, il testo ritoccato, la conferma) e nel controller (`ai/aiController.ts`: `sendBlocker()`, `acceptBlocker()`); quella esistente resta dov'è (`ai/reviewStatus.ts`, `ai/scope.ts`). L'host della barra, dalla seconda parte del Task 3, ha un box (`display: block` con il bordo inferiore) perché la nota sta sotto la riga dei pulsanti e dentro il bordo; l'host della vista resta `display: contents`.

**Tech Stack:** TypeScript 7, React 19.3 (solo in `WorkspaceView` e nelle impostazioni), Custom Elements, CSS `@scope`/`@layer`, Popover API (`popover="auto"`, `popovertarget`), Anchor Positioning (`position-area` del popover degli avvisi), CodeMirror 6 + `@codemirror/merge`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, in particolare il 4 «pulsanti mai disattivati»; §5.1–5.4; §7 «Fase 6» con le note «6a fatta» e «6b fatta»; §8.2–8.4; §9 punti 11 e 16; §10 R1, R2, R3, R10, R11, R13, R21; §11; §13); handover `docs/superpowers/notes/2026-10-11-handover-fase-6c.md` («Da fare nella 6c», «Regola UX di Davide», «Lezioni da mettere nei piani», «Trappole dell'ambiente»); proposta di Designer su LAB-14 (variante A della nota, pulsanti con lo stesso aspetto in ogni stato, chiavi e testi, priorità e svuotamento, sentinella e2e da sostituire, stati di audit); spec AI `docs/superpowers/specs/2026-09-27-ai-tool-design.md` (proposte non fidate) e `docs/superpowers/specs/2026-09-29-ai-ui-cleanup-design.md` (§4: revisione).

## Global Constraints

- **Branch** `lab/LAB-4-fase-6c` creato da `main` (`0ba9ccb`, fasi 0–6b fatte), worktree del run; PR in bozza verso `main` aperta da questo piano (`gh pr create --draft`), portata a pronta dal task finale. Commit piccoli in italiano, prefisso convenzionale (`test:`, `feat:`, `refactor:`, `docs:`), **nessuna riga di attribuzione**. Mai push su `main`, nessun merge: lo fa Davide.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da `main` **prima di qualsiasi modifica all'app**, conteggi delle suite e gzip del bundle principale annotati. `dist-baseline/` non si ricostruisce più fino alla fine del piano, tranne dopo i due cambi d'aspetto voluti (Step 13 del Task 3, seconda parte; Step 9 del Task 2, ragioni dal controller: solo se l'audit segnala differenze, atteso nessuna).
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (atteso nessuna rigenerazione: la nota vuota non occupa pixel, misurato nel prototipo; una rigenerazione solo con approvazione di Davide, con `--update-snapshots=all -g "nome"` ed elenco motivato nel commento finale e nella PR); `npm run test:e2e:dev` verde (console senza errori né avvisi, `expectedConsole` solo per diagnostiche esatte); `npm run test:e2e:audit` verde contro `dist-baseline/`. Eccezioni volute: decisione 3 (nota della barra: un `p` in più sposta gli indici dei 5 stati `ai-review*` → baseline ricostruita nella seconda parte del Task 3), decisione 4 (focus su un bersaglio stabile: non cambia l'aspetto), decisione 2 (note del composer: nessun pixel in più con la nota vuota; lo stato di audit nuovo `ai-composer-note-no-document` va in baseline con la sua ricostruzione).
- **Un task per elemento, sempre TDD**: test jsdom che fallisce (**il RED si vede e si annota nel commento finale prima di scrivere l'elemento**: nel dispatch all'implementer va chiesto esplicitamente «test prima, poi il codice», non «scrivere tutto e ripristinare HEAD per vedere il rosso») → logica pura + elemento + foglio → registrazione in `define.ts` (ordine alfabetico), eventi in `events.ts`, tipi in `jsx.d.ts` → i chiamanti montano il tag → `.tsx`, `.module.css` e `reviewDoc.ts` cancellati con `git rm`, poi `grep -r` (uscita 1 = nessuna occorrenza, il risultato giusto; 2 = comando fallito, da ripetere).
- **`events.ts`: ogni voce nuova (JSDoc + chiave) va subito sopra il JSDoc della voce successiva, mai tra un JSDoc e la sua chiave.** Qui due voci, `hmd-ai-review-action` e `hmd-ai-review-warning`, sopra il JSDoc di `hmd-ai-suggestion` (dopo `hmd-ai-retry`: ordine alfabetico).
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri testati senza DOM), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal` (i listener sui nodi creati dall'elemento muoiono con i nodi: `on` di `el()`).
- Cartella: `src/elements/ai/` (radici `hmd-ai-*`, già ammesse da `architecture.test.ts`; il limite inferiore `to (hmd-…)` è ammesso dalla regola). Nessuna eccezione nuova.
- **Schema di render (`RenderLoop`)**: ogni render passa da `this.#loop.update()`: setter, `watch`, gestori (`click`, notifiche del controller, tick del contatore), risposte asincrone (la conferma del dialog). Nessun `#render()` fuori dal loop. **`HmdElement.watch()` esegue subito la funzione**: niente render ridondanti in fondo a `connect()`; **nessun evento si emette dentro `connect`**. I prerequisiti si ricontrollano a ogni passata; `hadFocus` prima della prima, recupero del focus dopo l'ultima, contro il DOM finito.
- **Lo stato si salva prima di emettere**: la barra registra la nota (o la toglie) e fa il render **prima** di mandare `hmd-ai-review-action`; la vista non emette nulla verso fuori (gli eventi di editor e diff risalgono da soli).
- **Nessun callback DOM rientra in un render in modo sincrono**: la vista toglie e inserisce i figli della sezione (barra, diff, editor semplice, suggerimento, anteprima) senza mai spostarne uno già al suo posto; il `focusout` sincrono di Chromium quando sparisce il nodo con il focus (Scarta, Continua, il pulsante degli avvisi) arriva dentro il render e chiede solo una passata in più (`RenderLoop`). Il popover degli avvisi si apre e chiude solo con `popovertarget`: nessun `toggle` ascoltato.
- **Lavoro asincrono tardivo scartato**: il contatore dei secondi (`setInterval` di 1 s) vive con il run in corso e si ferma al distacco (`disconnectedCallback`); la conferma di «Accetta tutto» (`showConfirmDialog`) ha un `signal` che si interrompe al distacco e, risolta, accetta **la proposta di quel momento** (come `acceptRef` di ReviewView.tsx), non quella del clic.
- **Campi con il focus mai riscritti né ricreati; focus su un bersaglio stabile se il nodo sparisce** (decisione 4): la vista crea `hmd-editor` e `hmd-ai-diff-pane` una volta sola e li inserisce o toglie (come React, che li smontava); passando tra diff ed editor semplice il focus segue l'editor nuovo se prima era nella sezione **o sul `body`** (le due regole dell'effetto `[view]` di ReviewView.tsx); nella barra, se sparisce il nodo con il focus (Continua dopo il clic, il pulsante degli avvisi quando non restano avvisi) il focus va su Accetta tutto.
- **Proprietà dei figli `hmd-*` assegnate prima dell'inserimento e solo se cambiano**: la vista assegna a barra, editor e diff le proprietà nel render, confrontandole una a una, e solo dopo inserisce i nodi mancanti. `doc` è un oggetto nuovo a ogni render di React: il setter non confronta l'oggetto, il render confronta i campi.
- **React 19 e i custom element**: ogni prop funzione `on*` diventa un listener → uscite come eventi `hmd-*`; ingressi senza prefisso `on` (`doc`, `controller`, `i18n`; dentro `doc` le callback `docChanged` e `selectionChanged` non cominciano per `on`). React assegna tutte le proprietà prima di inserire l'elemento; StrictMode non stacca i custom element. `hmd-ai-review` non manda eventi a `WorkspaceView`; `hmd-doc-change` e `hmd-selection` di editor e diff risalgono attraverso di lui, e lui li ascolta sui figli che ha creato.
- **jsdom 30**: mancano Popover (stub `src/testing/popoverStub.ts`), `showModal` (stub `src/testing/dialogStub.ts`), Anchor Positioning, `requestAnimationFrame` (CodeMirror e MergeView girano con `src/testing/codemirrorEnv.ts`). Il popover vero, la posizione (`position-area`), il focus ring e il ritorno del focus al pulsante alla chiusura del popover li verificano Playwright e la checklist.
- **I pulsanti non si disattivano mai** (spec §2 vincolo 4): né `disabled` né `aria-disabled` su Precedente, Successivo, Scarta, Accetta tutto (e Continua, che già non lo era). Attivati quando l'azione non è possibile scrivono il perché nella nota `p.note[role=status]` sotto la riga (vuota di norma), il focus resta sul pulsante; la nota ricorda la causa e si svuota quando quella non vale più, quando un'azione della barra riesce, o quando la barra sparisce. Mai un toast, mai un tooltip. I pulsanti **dentro il diff** (← accetta, → rifiuta, creati dalla MergeView) restano `disabled` come oggi: fuori da questo piano (fase 8, con la regola estesa a tutta l'app).
- Testi solo da `t()`; **nove chiavi nuove** in tutti i `src/i18n/locales/*.json` (`en.json` riferimento, `locales.test.ts` controlla): `ai.review.generating|updating|conflict|scopeLost|truncated|notAcceptable` (Task 3, seconda parte) e `ai.composer.noDocument|updating|generating` (Task 2). Testi en/it della proposta di Designer; «Ricarica dal disco», «sovrascrivi», «Ferma» riprendono le parole dei pulsanti esistenti (`conflict.reload`, `conflict.overwrite`, `ai.stop`) in ogni lingua. Tooltip mai con `title`.
- **Regole AI** (CLAUDE.md §AI, spec R21): gli elementi non importano `ai/providers` né toccano le chiavi (test statico della 6b); proposte e risposte non fidate passano solo da `hmd-ai-chat-log` e dal diff (CodeMirror: testo, mai HTML).
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app (eccezioni ammesse dalla spec §8.4: `.cm-mergeView`, `.cm-content`, `.cm-line`, `.cm-merge-revert`); `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; nessuna richiesta di rete vera (finto Ollama di `e2e/support/aiHarness.ts`); `page.clock.install({ time: NOW })` **prima** di aprire la cartella dove conta il contatore dei secondi; un e2e sospetto di instabilità si prova con `--repeat-each=3`.
- **La sentinella «proposta arrivata» non è mai «Accetta tutto attivo»**: `expect(acceptAll).toBeEnabled()` con i pulsanti mai disattivati passa subito, prima della proposta. Il Task 1 la sostituisce ovunque (14 punti, elenco nello Step 2) con il diff visibile (`expect(page.locator('.cm-mergeView')).toBeVisible()`, eccezione ammessa), sull'app React di oggi.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail`. I test del Task 1 che affermano i pulsanti spenti durante la generazione e con la proposta troncata, la casella svuotata senza documento e il silenzio di Invio durante una generazione li riscrivono nella forma nuova la seconda parte del Task 3 e il Task 2.
- Dialog solo con le funzioni di `src/elements/dialogs/` (qui `showConfirmDialog` per «Accetta tutto» a documento cambiato); File System Access API solo in `src/fs/`; `workspace/` non cambia; `ai/` cambia solo per i due metodi nuovi del controller.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo sono ricorsivi, si lanciano dopo il `git rm` e distinguono l'uscita 1 dalla 2. Il controller rilancia almeno i file e2e nuovi o toccati di ogni task.
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM (ape 15 GB, ma con altri worktree attivi): **mai due suite e2e in parallelo**. Instabilità estranee note: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog» e `ai-composer.spec.ts` «a sync folder without permission…» («page closed» sotto carico: ripetuta da sola nel prototipo, 3/3 verde); ripetere il file da solo e annotarlo.
- Commenti e commit in italiano, identificatori in inglese.


## Misure prese scrivendo il piano (11/10, su `0ba9ccb`)

@@MISURE@@

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
4. **Focus su un bersaglio stabile quando il nodo che lo ha sparisce** (sì): la vista recupera il focus con `RenderLoop` (`focusScope` = la sezione, `refocus` = l'editor della vista mostrata) **più** la regola «focus sul `body`» dell'effetto di ReviewView.tsx (un cambio di vista con il focus da nessuna parte porta il focus nell'editor nuovo); la barra recupera su Accetta tutto (Continua che sparisce dopo il clic, il pulsante degli avvisi senza avvisi). **Il difetto «focus perso da Scarta dopo Accetta tutto completo» non si riproduce** (vedi «Misure»: 11 scenari in produzione e in sviluppo, focus sempre nell'editor): il Task 1 afferma il comportamento di oggi (focus nell'editor dopo Scarta, dopo Accetta tutto, dopo Ctrl+Z), e l'elemento lo mantiene per costruzione; il test jsdom del Task 4 «Discard with the focus on the button…» fallisce senza `refocus` (RED per costruzione). Resta a Davide una verifica a mano in Chrome (sub-issue «[Davide]…»): se il difetto si vede solo con la scheda nascosta o con lo screen reader, lo stesso recupero lo copre.
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
2. **Ragioni dal controller, bozza conservata**: senza documento, durante un aggiornamento, durante una generazione (Invio) l'invio non parte, la casella non si svuota, la nota lo dice e si svuota quando la causa sparisce; l'ordine generazione → documento → aggiornamento → profilo → testo; `send()` resta la stessa guardia; `acceptBlocker` nell'ordine della barra e `canAccept` identico a prima. Test del Task 2: `aiController.test.ts` («sendBlocker: …», «acceptBlocker: una ragione per volta…», «acceptBlocker: la selezione persa…»), `composerView.test.ts`, `composer.dom.test.ts` («without a document Send says so…», «during an update…», «a suggestion (or Enter) during a generation…», «the order of the reasons…»), `ai-review-bar.spec.ts` («with no document open, Send says so…», «Enter in the composer during a generation says so…»), audit `ai-composer-note-no-document`.
3. **Il focus tra diff ed editor semplice e dentro la barra**: Accetta tutto, Scarta, Ctrl+Z, Continua, la chiusura del popover degli avvisi, la conferma annullata; mai sul `body`, anche in sviluppo con StrictMode. Test jsdom del Task 4 («Discard with the focus on the button…», «a view change with the focus already on the body…») e della barra («the focused Continue removed…») + `ai-review-bar.spec.ts` (i tre test del focus) + `ai-diff.spec.ts` («Ctrl+Z that brings the diff back…»).
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
git status --short && git log --oneline -1       # pulito, 0ba9ccb o il commit del piano
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
npx playwright test -c e2e/playwright.config.ts e2e/ai-review-bar.spec.ts --repeat-each=3   # 30/30
npm run test:e2e            # annotare: 176 + 10 = 186 (2 snapshot dello start screen cadono su ape per il font pixel: estraneo, vedi «Misure»)
npm run test:e2e:dev        # annotare: 161 + 10 = 171
npm run test:e2e:audit      # annotare: 104 + 8 = 112 (due test per stato)
```

Expected: tutto verde, nessuna ripetizione instabile (nel prototipo «a sync folder without permission…» è caduta una volta sotto carico e 3/3 da sola).

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete sulla barra e sulla vista della revisione AI (pulsanti spenti, troncata, focus, stati di audit) e sentinella della proposta prima della 6c"
```

---
