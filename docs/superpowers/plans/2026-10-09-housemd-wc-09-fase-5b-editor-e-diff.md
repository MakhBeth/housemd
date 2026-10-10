# HouseMD Web Components — Piano 9: fase 5b, editor e diff (CodeMirror)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element la parte della fase 5 che ospita CodeMirror: `hmd-editor` (era `editor/Editor.tsx`) e `hmd-ai-diff-pane` (era `ui/ai/DiffPane.tsx`), senza cambiare aspetto né comportamento, e togliere React da `editor/docExtensions.ts`. Con questo piano la fase 5 è finita.

**Architecture:** Stesso schema di 4c e 5a: classe `Hmd<Nome>` su `HmdElement`, host con `display: contents`, DOM interno identico a quello di React, foglio `@layer components { @scope (hmd-…) { … } }`, ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`. Le due viste condividono una classe base astratta, `HmdDocElement` (`elements/editor/docElement.ts`): le proprietà del documento (`text`, `resetKey`, `session`, `restore`, `readOnly`, `getDocs`, `saveImage`, `i18n`), il `DocHost` che le estensioni di CodeMirror leggono a ogni uso, gli eventi `hmd-doc-change` e `hmd-selection`, la sessione da cui è nata la vista mostrata. I setter segnano soltanto; documento nuovo, ripristino, sola lettura e proposta si applicano in un microtask, nell'ordine degli effetti di React. Il calcolo (riga in cima, scroll, rifiuto di un blocco, filtro del tratto, pulsanti attivi) sta in `elements/editor/editorLogic.ts` e `elements/ai/diffLogic.ts`, testati senza DOM.

**Tech Stack:** TypeScript 7, React 19.3 (solo nei chiamanti), Custom Elements, CSS `@scope`/`@layer`, CodeMirror 6 (`@codemirror/view` 6.43, `@codemirror/merge` 6.12), `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, §3.1 cartelle `elements/editor/` e `elements/ai/`, §4.1–4.2 radici `hmd-editor` e `hmd-ai-*`, §5.1–5.2, §7 fase 3 punto 3 e fase 5, §8.2–8.4, §9 punti 2, 4, 13, 14, 16, §10 R2, R10, R13, §11).

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza = `main` = `c997136`, fasi 0–5a fatte). Regola del 05/10 (spec §7): a fine piano, con suite verdi, review finale pulita, `/codex-review-chat` sul diff e checklist provata in Chrome, **il controller** fa merge in `main` e push (anche del branch). Gli implementer non fanno merge.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da questo branch **prima di qualsiasi modifica all'app**, conteggi dei test e gzip del bundle principale annotati. `dist-baseline/` non si ricostruisce più fino alla fine del piano.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera: un nuovo snapshot o una rigenerazione solo con approvazione di Davide); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/`.
- **Un task per elemento**, sempre TDD: test jsdom che fallisce → elemento + foglio → registrazione in `define.ts`, eventi in `events.ts`, tipi in `jsx.d.ts` → i chiamanti montano il tag → `.tsx` e `.module.css` (o le loro regole) cancellati.
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal` (i listener sui pulsanti creati dall'elemento muoiono con i pulsanti).
- Cartelle: `src/elements/editor/` (radice `hmd-editor`, già ammessa dalla regola generale di `architecture.test.ts`); `src/elements/ai/` (radice `hmd-ai-diff-pane`).
- **React 19 e i custom element, misurato il 09/10** (jsdom + `react-dom` del progetto): al montaggio React assegna **tutte** le proprietà prima di inserire l'elemento (`connectedCallback` le trova già); negli aggiornamenti le assegna in sequenza nell'ordine del JSX (con `{...editor}` di `ReviewView` `resetKey` arriva **prima** di `session`); StrictMode **non** stacca né ricollega un custom element (doppi solo effetti e ref callback del genitore); **ogni prop funzione il cui nome comincia con `on` diventa un listener** dell'evento omonimo, anche se l'elemento ha una proprietà con quel nome (`onImage` → listener di `Image`, la proprietà resta vuota). Quindi: callback come proprietà solo con nomi che non cominciano per `on` (`saveImage`, `beforeAccept`); niente che dipenda dall'ordine dei setter.
- **I setter segnano, un microtask applica.** `resetKey`, `restore`, `readOnly`, `proposal`, `canAccept`, `streaming` chiamano `docInputChanged()`, che pianifica un solo `#flush` in un microtask; `#flush` fa ciò che facevano gli effetti di React, nel loro ordine. Così nessun `dispatch`/`setState` avviene dentro un aggiornamento di CodeMirror («Calls to EditorView.update are not allowed while an update is in progress») né durante il commit di React, e l'ordine dei setter non conta.
- **Lezioni della 4c e della 5a**: `HmdElement.watch()` esegue subito la funzione (niente render o `schedule` ridondanti in fondo a `connect`); nessun gestore di evento DOM rientra in modo sincrono in un render dell'elemento (il crash della 4c: `focusout` durante `reconcileList` → `NotFoundError`) e le callback di CodeMirror e MergeView (`updateListener`, focus, scroll, `mousedown` sui pulsanti dei blocchi) sono della stessa classe di rischio: ciò che mandano fuori sono eventi, e ciò che torna dentro passa dal microtask; **nessun evento si emette dentro `connect`** (siamo nel commit di React: la selezione iniziale si annuncia nel microtask); un commit del genitore che arriva in ritardo da un evento React non deve sovrascrivere ciò che l'utente ha appena scritto (`text` si legge solo quando cambia `resetKey`; `proposal` si applica solo quando la proprietà cambia, e solo se diversa dal lato destro); un e2e sospetto di instabilità si prova con `--repeat-each=5`.
- **Niente di asincrono su una vista che non c'è più.** Un salvataggio d'immagine che finisce dopo il distacco dell'elemento, dopo un `setState` o dopo che la vista è stata ricreata con lo stesso `resetKey` non inserisce nulla e non avvia i salvataggi successivi: la chiave confrontata da `insertImageLinks` include la vita della vista (plugin `lifecycle` di `docExtensions`, Task 2). Ogni microtask e ogni callback rinviata controlla che la vista esista ancora (`#view`/`#merge` non nulli).
- **Gli echi delle modifiche locali non sono aggiornamenti.** Ciò che l'elemento manda fuori torna dentro come proprietà, a volte dopo altre battute: `hmd-editor` legge `text` solo quando cambia `resetKey`; `hmd-ai-diff-pane` ricorda i testi mandati con `hmd-ai-proposal-edit` non ancora confermati e, quando uno di questi torna come `proposal`, lo tratta come conferma (non tocca il lato destro, né testo né cursore né cronologia); solo un valore che non è un suo eco sostituisce la proposta.
- **`hmd-top-line` risale** (`emit` usa `bubbles: true`) e dopo questo piano lo mandano sia `hmd-editor` sia `hmd-preview`: si ascolta **solo sull'elemento che lo manda** (`onhmd-top-line` sul tag), mai su un antenato comune (in `WorkspaceView` editor e anteprima stanno sotto lo stesso `.panes`). Lo controlla un `grep` nel Task 4.
- **Mai `setState` sull'editor posseduto da MergeView** (spec §7 fase 5): i ripristini sul lato documento del diff passano da `applyDocRestore` (una transazione); un documento nuovo ricrea l'intera MergeView. `docSession.ts`, `useDocBinding.ts` (`applyDocRestore`), `restoreCommand.ts`, `formatToolbar.ts`, `formatting.ts`, `images.ts`, `wikiCompletion.ts` non cambiano.
- **Gli stili di CodeMirror stanno fuori dai layer.** CodeMirror e `@codemirror/merge` iniettano i loro fogli (temi, `.cm-merge-revert button { position: absolute; background: none; cursor: pointer }`) senza `@layer`, e uno stile fuori dai layer vince su qualsiasi regola normale di un layer. Nel `@layer components` di un elemento, solo le proprietà che **collidono** con una regola di CodeMirror si dichiarano `!important` (dentro un layer `!important` vince sugli stili normali fuori dai layer), ciascuna con un commento; lo prova l'audit (stati `ai-review-hover` e `ai-review-conflict` del Task 1). Una regola del modulo che oggi perde contro il tema di CodeMirror (`.diff :global(.cm-content) { padding-bottom: 40vh }`, stesso valore del tema) non si porta.
- **Test jsdom con CodeMirror**: `src/testing/codemirrorEnv.ts` (Task 2) subito dopo `domEnv`. Ogni vista creata da un test si **distrugge** sempre nel teardown (`view.destroy()`: una vista viva tiene acceso il processo e lascia listener globali, come il `pointerup` della barra di formattazione); per gli elementi basta toglierli dal documento (`document.body.replaceChildren()` in `afterEach`: il distacco distrugge la vista). Le promesse che un test lascia in sospeso (salvataggi d'immagine, conferme) si risolvono a mano, in un ordine deciso dal test. Le misure vere (altezze, scroll, layout) le verifica Playwright.
- Testi solo da `t()` (store i18n); **nessuna chiave nuova**. Tooltip mai con `title` (i pulsanti dei blocchi usano già `.tooltip` + `data-tooltip` + `aria-label`).
- Le regole e2e di `CLAUDE.md` valgono (ruolo e nome accessibile, testi da `en.json`, mai classi CSS dell'app). Eccezioni ammesse dalla spec §8.4: `.cm-content`, `.cm-scroller`, `.cm-mergeView` e i pulsanti `.cm-merge-revert` di CodeMirror, con un commento. Nessuna richiesta di rete vera dagli e2e. Un e2e che simula un errore HTTP del provider usa l'opzione `expectedConsole` della fixture (in questo piano non ce ne sono).
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale, senza righe di attribuzione.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail` (marcherebbe come atteso anche un errore di console o un'eccezione della pagina, che la fixture controlla in fondo al test); il difetto di sviluppo del Task 1 è un'asserzione esplicita in un ramo `if (failOnConsole)`, rovesciata nel Task 5.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I controlli con `grep` sono ricorsivi (`-r`), si lanciano **dopo** il `git rm`, e distinguono l'uscita 1 (nessuna occorrenza: il risultato giusto) dalla 2 (comando fallito: da ripetere).
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.

## Misure prese scrivendo il piano (09/10, su `c997136`)

Baseline: `npm test` = **740** test verdi; `npm run test:e2e` = **123** test in 17 file (`editor` 8, `formatting` 6, `ai-review` 12, `sync-scroll` 2, `history` 4, `external` 8, `focus-ring` 4, `visual` 14, `ai-chips` 5); `npm run test:e2e:dev` = **108**; audit = **30** stati (60 test, `baseline` + `current`); bundle principale gzip = **436 004 B** (build di `c997136`).

**Prototipo.** Il codice dei Task 1–5 è stato provato su una copia del repository fuori dal worktree (nessun file del worktree toccato, niente commit): `npm run lint` pulito; `npm test` 740 → **785** (+9 Task 2, +8 Task 3, +13 Task 4, +15 Task 5); `npm run test:e2e` **132/132** (snapshot invariati); `npm run test:e2e:dev` **117/117**; audit uguale alla baseline su tutti gli stati dell'editor e del diff, compresi i quattro nuovi; bundle gzip 436 004 → **435 345 B**. Misurato anche:

- **CodeMirror e MergeView girano in jsdom 30** con tre aggiunte: `requestAnimationFrame` sulla `window` di jsdom (CodeMirror misura in un fotogramma: `this.win.requestAnimationFrame is not a function`), il costruttore `Window` globale (`isScrolledToBottom`: `Window is not defined`) e `Range.prototype.getClientRects`/`getBoundingClientRect` (`textRange(...).getClientRects is not a function`). Funzionano `dispatch`, `setState`, cronologia, `focus`/`hasFocus`, `lineBlockAt`, `scrollTop`, i pulsanti dei blocchi e il loro `mousedown`, `goToNextChunk`.
- **Il difetto della fase 3 sul diff c'è ancora oggi, solo in sviluppo**: «Accetta tutto» → Ctrl+Z fa ricomparire il diff → in `npm run test:e2e:dev` il focus è sul `body` (StrictMode distrugge e ricrea la MergeView di `DiffPane.tsx`), nella build di produzione è nel documento e Ctrl+Y rifà. Con `hmd-ai-diff-pane` la MergeView non viene più ricreata (StrictMode non stacca i custom element) e il test del Task 1 passa anche in sviluppo.
- **`!important` serve**: togliendolo dal foglio del diff l'audit fallisce esattamente su `position: static → absolute` dei pulsanti, `background-color` al passaggio e `cursor: default → pointer` sui disattivati.
- Review di Codex del piano (09/10), quattro rilievi accettati e provati sul prototipo, ognuno con un test che fallisce senza la correzione: (1) una conferma in ritardo di una modifica fatta a mano nella proposta (`proposal = 'B1'` arrivato dopo `B12`) riportava indietro il lato destro → echi ricordati in `hmd-ai-diff-pane`; (2) un'immagine ancora in salvataggio quando l'elemento si stacca (o torna con lo stesso `resetKey`) avviava il salvataggio successivo e scriveva su una vista distrutta → plugin `lifecycle`; (3) `test.fail` nascondeva anche gli errori di console → asserzione esplicita del difetto; (4) le viste dei test di `docExtensions` non venivano distrutte → registro e `destroy()` nel teardown.
- Trovato nel prototipo e corretto nel piano: salvare lo stato della vista nella proprietà `session` al momento del distacco scrive il testo vecchio nella **sessione del documento nuovo** quando il cambio è ancora in attesa del microtask; la base salva nella sessione da cui la vista è nata (test nei Task 4 e 5).

### Inventario (aggiornato al 09/10 dall'inventario della 5a)

**`src/editor/Editor.tsx`** (118 righe, `forwardRef`)
- Props `EditorProps`: `text`, `session?`, `onTransactions?`, `canChange?`, `resetKey`, `getDocs`, `onChange`, `onImage`, `onTopLine`, `onSelection?`, `restore?`, `readOnly?`. **Nessun chiamante passa `canChange`**: il filtro di transazione di `docExtensions` (con l'eccezione `input.restore`) non scarta mai nulla. Handle `EditorHandle`: `scrollToLine` (con `suppressUntil` di 150 ms), `focus`, `getView` (nessun chiamante), `replace` (nessun chiamante sull'editor semplice).
- Effetti, nell'ordine: vista creata una volta (ref `refocus`: correzione della fase 3 per StrictMode); `[resetKey]` → se la sessione ha un'altra chiave la si azzera dal testo, poi `view.setState(...)` e `onSelection` della selezione ripristinata (anche al montaggio); `[restore.seq]` → `applyDocRestore`; `[readOnly]` → riconfigurazione del compartimento `editable`. Allo smontaggio: `saveDocSession` nella sessione, `destroy`.
- `callbacks` è un `RefObject<EditorProps & { t }>` letto da `docExtensions.ts`, che per questo importa `RefObject` da React ed `EditorProps` da `Editor.tsx`.
- Chiamanti: `src/ui/WorkspaceView.tsx` (vista divisa ed editor: `editorRef.scrollToLine` dall'`onhmd-top-line` dell'anteprima, presenza dell'editor per il ripristino in coda), `src/ui/ai/ReviewView.tsx` (due rami con `<Editor ref={plain} {...editor} />`, `plain.focus()` nel passaggio diff ↔ editor). CSS `Editor.module.css` (8 righe: `.editor { height: 100%; overflow: hidden }`, `.editor .cm-editor { height: 100% }`, lo stesso valore del tema di `docExtensions`).

**`src/ui/ai/DiffPane.tsx`** (56 righe compatte, `forwardRef`)
- Props: `editor: EditorProps`, `proposal`, `range?`, `canAccept`, `streaming`, `beforeAccept()`, `onEdit(text)`, `acceptLabel`, `rejectLabel`, `onAllRejected()`. Handle `DiffHandle`: `next`, `previous`, `scrollToLine`, `replace`, `focus`, `getView` (nessun chiamante).
- Effetti, nell'ordine: `[resetKey]` → MergeView nuova (lato `a` da `docStateConfig(session, docExtensions(callbacks))`, lato `b` con `basicSetup`, filtro di transazione sul tratto `range` saltato con il flag `remote`, `docAppearance()`, compartimento di sola lettura con `streaming`, `updateListener` → `onEdit` se non `remote`; `revertControls: 'b-to-a'`, `renderRevertControl`), `onSelection` della selezione di `a`; pulizia: `saveDocSession(session, a)`, `destroy`. `[proposal]` → `b` sostituito con `addToHistory: false` sotto `remote`, solo se diverso. `[canAccept, streaming, readOnly]` → riconfigura `a` e `b`, `disabled` sui pulsanti. `[restore.seq]` → `applyDocRestore` su `a`.
- Pulsanti per blocco costruiti a mano: `div.revert` (classe del modulo) con `button.tooltip[data-action=accept|reject]`, `aria-label` e `data-tooltip` dalle etichette, `←`/`→`. «Accetta»: `mousedown` → se `!canAccept || !beforeAccept()` ferma l'evento, altrimenti focus su `a` in un microtask (la libreria applica il blocco nel suo `mousedown` sul contenitore); `keydown` Invio/Spazio → `mousedown` sintetico. «Rifiuta»: `mousedown`/`keydown` Invio/Spazio → l'originale torna in `b` (`userEvent: 'revert'`), poi `onAllRejected` se non restano blocchi, altrimenti focus su `b`. Le etichette dei pulsanti già disegnati **non** seguono un cambio di lingua.
- CSS in `ReviewView.module.css` righe 98–139 (`.diff`, `.diff :global(.cm-mergeView|.cm-editor|.cm-content)`, `.diff :global(.cm-merge-revert) .revert …`); il resto del modulo resta a `ReviewView` e `ReviewBar`.

**`src/ui/ai/ReviewView.tsx`** (154 righe) resta React fino alla fase 6: riceve `editor: EditorProps & { path }` da `WorkspaceView`, sceglie tra editor semplice (nessuna proposta, o proposta applicata) e diff, sposta il focus nel `useEffect([view])`, chiama `diff.replace` per «Accetta tutto», `diff.next/previous/scrollToLine` dalla barra.

**`src/ui/ai/Composer.tsx`**: il chip della selezione legge `aiSelection` di `WorkspaceView`, aggiornato da `onSelection` (ora `hmd-selection`) di entrambe le viste; `getSelection()` legge `session.selection`, salvata dall'`updateListener` a ogni aggiornamento. Non cambia.

**Test.** Unitari: `docSession`, `restoreCommand`, `formatting`, `wikiCompletion`, `images` (nessuno su `docExtensions`, `Editor.tsx`, `DiffPane.tsx`). E2e: `editor.spec.ts` (8), `formatting.spec.ts` (6), `history.spec.ts` (4, ripristino annullabile anche dalla sola anteprima), `external.spec.ts` (8), `sync-scroll.spec.ts` (2, `scrollTop` scritto da script: in Playwright la pagina è visibile), `focus-ring.spec.ts` (4), `ai-review.spec.ts` (12: accetta tutto, rifiuto per blocco, Ctrl+Z su accetta/rifiuta/accetta tutto, chip della selezione in modalità editor, selezione dentro una riga), `visual.spec.ts` (`workspace-*`, `AI review`, `format-toolbar`, `history`), audit `workspace-*`, `ai-review`, `history`, `tooltip-hover`, `conflict`. **Scoperti**: cronologia che non passa tra file, ricarica dal disco che azzera la cronologia, cronologia che continua dalla vista divisa alla modalità AI, chip da una selezione fatta nell'editor della modalità AI, barra di formattazione nella lingua scelta, proposta modificata a mano (anche scrivendo veloce), pulsanti dei blocchi da tastiera, filtro del tratto selezionato, focus quando Ctrl+Z fa ricomparire il diff; audit della modalità editor, della revisione senza proposta, dei pulsanti dei blocchi al passaggio e disattivati.

### Divisione

Un piano solo per `hmd-editor` e `hmd-ai-diff-pane`, come deciso il 09/10 nella 5a: condividono `docExtensions`, la sessione, `resetKey`, i ripristini, gli eventi del documento e il passaggio del focus con `ReviewView`, e il prototipo mostra che stanno in sei task di dimensione normale. Una 5c separata per il diff dovrebbe portare avanti per un merge in più `refDocHost.ts` e la doppia forma di `ReviewDoc`.

Ordine: rete (Task 1) → `docExtensions` senza React, con l'ambiente CodeMirror per jsdom (Task 2) → logica pura (Task 3) → `hmd-editor` (Task 4: rischio più basso, fissa la base comune) → `hmd-ai-diff-pane` (Task 5) → documenti e chiusura (Task 6). Tra il Task 4 e il Task 5 `DiffPane.tsx` resta React e riceve il documento come `ReviewDoc` attraverso `refDocHost.ts`, che il Task 5 cancella.

### Decisioni (da confermare con Davide; tra parentesi la raccomandazione)

1. **Un piano, sei task** (sì): vedi «Divisione».
2. **`!important` dentro `@layer components`** per le tre proprietà dei pulsanti dei blocchi che collidono con il foglio di `@codemirror/merge` (`position`, `background` al passaggio, `cursor` sui disattivati) (sì). Alternative: un `StyleModule` di CodeMirror in TypeScript (stili fuori da `@scope` e dal test di architettura), o un'eccezione in `architecture.test.ts` per CSS fuori dai layer (contro la spec §4.1).
3. **Uscite**: `onChange` + `onTransactions` diventano un solo evento `hmd-doc-change` `{ changes, before, after }` (stesso ordine delle chiamate di oggi nel gestore: prima la proposta AI, poi il salvataggio); `onSelection` → `hmd-selection` (spec); `onTopLine` → `hmd-top-line` (5a); `onEdit` → `hmd-ai-proposal-edit`; `onAllRejected` → `hmd-ai-all-rejected`; `onImage` → proprietà **`saveImage`** e `beforeAccept` resta proprietà (sì: la spec §5.1 nomina `onImage` come esempio di callback, ma con React 19 non può chiamarsi così; il Task 6 corregge la spec).
4. **Non portati** (sì): `canChange` e il suo filtro (nessun chiamante); `getView` e `replace` di `hmd-editor` (nessun chiamante; `replace` resta sul diff); il ref `refocus` della fase 3 in `hmd-editor` (StrictMode non ricrea più la vista: lo prova un test jsdom con StrictMode; il focus restituito resta dove la vista si ricrea davvero, cioè la MergeView a un `resetKey` nuovo).
5. **Etichette dei pulsanti dei blocchi aggiornate a un cambio di lingua** (sì, piccola correzione invisibile all'audit; oggi restano nella lingua vecchia finché la MergeView non ridisegna i blocchi). Per la fedeltà stretta si toglie `#refreshControls` dal `watch` dello store.
6. **`ReviewView` riceve il documento come `ReviewDoc`** (`src/ui/ai/reviewDoc.ts`, interfaccia senza React, nomi come `DocHost`) e lo traduce nelle proprietà dei due tag (sì): `WorkspaceView` cambia una volta sola, e nella fase 6 `hmd-ai-review` riceverà la stessa forma.

## Review Focus

1. **Ordine dei setter e documento nuovo**: con `{...docProps}` React assegna `resetKey` prima di `session`; l'elemento deve comunque mostrare il testo della sessione nuova, azzerare la cronologia e non scrivere mai lo stato del documento vecchio nella sessione nuova, neanche se viene staccato con il cambio ancora in attesa. Test jsdom nel Task 4 («a new resetKey replaces the text…», «removed while a new document is still pending…») e nel Task 5 («a new resetKey recreates the MergeView…»).
2. **Ctrl+Z attraverso le viste della revisione**: accetta, rifiuta e «Accetta tutto» si annullano; quando Ctrl+Z fa ricomparire il diff il focus è nel documento e la scorciatoia dopo arriva a CodeMirror, **anche in sviluppo** (StrictMode). E2e del Task 1 (`ai-diff.spec.ts`, che fino al Task 5 afferma in sviluppo il difetto di oggi) + test jsdom con StrictMode nei Task 4 e 5 + `ai-review.spec.ts` esistente.
3. **Scrivere mentre arrivano i commit di React**: un `text` in ritardo non tocca l'editor; una proposta modificata a mano scrivendo veloce non perde caratteri, anche quando le conferme arrivano in ritardo una battuta alla volta, e «Accetta tutto» applica quella; un'immagine incollata che finisce di salvarsi dopo il distacco non va da nessuna parte; con una selezione, le modifiche fuori dal tratto si scartano. Test jsdom nel Task 4 («a new text alone changes nothing…») e nel Task 5 («late confirmations of edits made here…», «a new proposal from outside…», «with a selection range…»), test delle immagini in ritardo nei Task 2, 4 e 5 + e2e del Task 1.
4. **Scroll sincronizzato senza rimbalzi**: `hmd-top-line` dell'editor arriva solo al gestore sul tag `hmd-editor`, e dopo `scrollToLine` per 150 ms non riparte. Test jsdom nel Task 4 («scroll: the top line…») + `sync-scroll.spec.ts` + `grep` del Task 4 + checklist con la rotella del mouse.
5. **Stili di CodeMirror fuori dai layer**: pulsanti dei blocchi impilati nella colonna centrale, sfondo al passaggio, cursore normale da disattivati, focus ring e tooltip come oggi. Audit `ai-review`, `ai-review-hover`, `ai-review-conflict` (Task 1) nel Task 5.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/editor-session.spec.ts`, `e2e/ai-diff.spec.ts`, `e2e/computed-styles.audit.ts` | Rete di sicurezza: cronologia per file e tra le viste, ricarica, chip dall'editor AI, lingua della barra; proposta modificata, tastiera sui blocchi, tratto selezionato, focus dopo Ctrl+Z; stati di audit nuovi. |
| `src/testing/codemirrorEnv.ts` | Ciò che manca a jsdom per CodeMirror (rAF, `Window`, rettangoli dei Range). |
| `src/editor/docExtensions.ts` (+ `.dom.test.ts`) | Estensioni del documento su `DocHost`, senza React. |
| `src/editor/refDocHost.ts` | Ponte temporaneo (Task 2–4) dalle props React a `DocHost`; cancellato nel Task 5. |
| `src/elements/editor/editorLogic.ts` (+ test) | `adoptResetKey`, `topLine`, `lineNumberFor`, `scrollTopFor`. |
| `src/elements/ai/diffLogic.ts` (+ test) | `rejectChange`, `insideRange`, `controlDisabled`. |
| `src/elements/editor/docElement.ts` | `HmdDocElement`: proprietà del documento, `DocHost`, sessione mostrata, `SaveImage`. |
| `src/elements/editor/editor.element.ts`, `editor.css` (+ `.dom.test.ts`) | `hmd-editor`. |
| `src/elements/ai/diff-pane.element.ts`, `diff-pane.css` (+ `.dom.test.ts`) | `hmd-ai-diff-pane`. |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi, tipi JSX (`HmdDocProps`). |
| `src/ui/ai/reviewDoc.ts` | `ReviewDoc`: il documento come lo riceve `ReviewView`. |
| `src/ui/WorkspaceView.tsx`, `src/ui/ai/ReviewView.tsx` | Montano i tag. |
| `src/editor/Editor.tsx`, `Editor.module.css`, `src/ui/ai/DiffPane.tsx` | Cancellati. `ReviewView.module.css` perde le regole del diff. |

---

### Task 1: Baseline e rete di sicurezza sull'editor e sul diff di oggi

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**.

**Files:**
- Create: `e2e/editor-session.spec.ts`, `e2e/ai-diff.spec.ts`
- Modify: `e2e/computed-styles.audit.ts` (stati nuovi)

**Interfaces:**
- Produces: stati di audit `editor-mode`, `ai-review-empty`, `ai-review-hover`, `ai-review-conflict`; il test «Ctrl+Z that brings the diff back…» con il ramo `if (failOnConsole)` che afferma il difetto di sviluppo, ramo che il Task 5 toglie.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short && git log --oneline -1       # pulito, c997136 o il commit del piano
npm test                                          # annotare (09/10: 740)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (09/10: 436 004)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 5b
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla**.

- [ ] **Step 2: E2e dell'editor scoperti oggi**

`e2e/editor-session.spec.ts`:

```ts
import type { Locator } from '@playwright/test';

import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

/**
 * Testo di un editor CodeMirror riga per riga (textContent non mette gli a capo tra le .cm-line; una riga
 * vuota contiene solo un <br>, che innerText rende come "\n").
 */
const lines = (content: Locator) =>
  content.locator('.cm-line').allInnerTexts().then((all) => all.map((t) => t.replace(/\n$/, '')).join('\n'));

/**
 * L'editor della modalità AI: non sta nella regione «Editor» della vista divisa. `.cm-content` è
 * un'eccezione ammessa dalla spec (§8.4); il composer è un <textarea>, non un .cm-content.
 */
const aiEditor = (app: App) => app.page.locator('.cm-content');

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible(); // il controller AI è pronto
  await app.mode('mode.ai').click();
  await expect(app.page.getByRole('textbox', { name: app.t('ai.request') })).toBeVisible();
}

test('opening another file starts from an empty undo history', async ({ app, page }) => {
  await app.openFolder({ 'a.md': '# Alpha', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await app.typeAtEnd(' edited');
  await app.openFile('b.md');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('# Beta');
  await app.openFile('a.md');
  await expect(app.editor()).toHaveText('# Alpha edited');
});

test('a file reloaded from disk replaces the text and the undo history', async ({ app, page }) => {
  await app.openFolder({ 'note.md': 'start' });
  await app.openFile('note.md');
  await app.typeAtEnd(' mine');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('start mine');
  await app.writeExternal('note.md', 'from outside');
  await app.windowFocus();
  await expect(app.editor()).toHaveText('from outside');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('from outside');
});

test('the AI mode editor continues the undo history of the split editor', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'one' });
  await app.openFile('a.md');
  await app.typeAtEnd(' two');
  await enterAi(app);
  await expect.poll(() => lines(aiEditor(app))).toBe('one two');
  await aiEditor(app).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => lines(aiEditor(app))).toBe('one');
});

test('a selection made in the AI mode editor shows the chip', async ({ app, page }) => {
  await app.openFolder({ 'b.md': 'uno\ndue\ntre\nquattro' });
  await app.openFile('b.md');
  await enterAi(app);
  await aiEditor(app).click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let i = 0; i < 11; i++) await page.keyboard.press('Shift+ArrowRight'); // "uno\ndue\ntre"
  await expect(page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toBeVisible();
});

test('the formatting toolbar follows the interface language', async ({ app, page }) => {
  const it = (key: string) => translate(messagesFor('it'), key);
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  await page.getByRole('region', { name: it('pane.editor') }).getByRole('textbox').click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
  const toolbar = page.getByRole('toolbar', { name: it('format.toolbar') });
  await expect(toolbar.getByRole('button', { name: it('format.bold') })).toBeVisible();
});
```

- [ ] **Step 3: E2e del diff scoperti oggi**

`e2e/ai-diff.spec.ts`:

```ts
import type { Locator } from '@playwright/test';

import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
// .cm-mergeView, .cm-content e i pulsanti .cm-merge-revert: eccezioni ammesse dalla spec (§8.4).
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const blockButtons = (app: App, action: 'accept' | 'reject'): Locator =>
  app.page.locator(`.cm-merge-revert button[data-action=${action}]`);
/** Il documento (primo editor della MergeView) e la proposta (l'ultimo). */
const documentSide = (app: App) => mergeView(app).locator('.cm-content').first();
const proposal = (app: App) => mergeView(app).locator('.cm-content').last();
const lines = (content: Locator) =>
  content.locator('.cm-line').allInnerTexts().then((all) => all.map((t) => t.replace(/\n$/, '')).join('\n'));

/** Testo del documento: salvato con Ctrl+S e letto dal disco (niente accesso allo stato interno). */
async function docText(app: App, path = 'a.md'): Promise<string | null> {
  await app.page.keyboard.press('ControlOrMeta+s');
  await app.page.waitForTimeout(100);
  return app.disk(path);
}

async function review(app: App, original: string): Promise<void> {
  await app.openFolder({ 'a.md': original });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
}

test.describe('blocks', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await review(app, 'A\n\nB\n\nC');
    await expect(blockButtons(app, 'reject')).toHaveCount(2);
  });

  test('a proposal edited by hand: typed quickly, nothing lost, Accept all applies it', async ({ app, page }) => {
    await proposal(app).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' and more words');
    await expect.poll(() => lines(proposal(app))).toBe('A2\n\nB\n\nC2 and more words');
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC2 and more words');
  });

  test('block buttons from the keyboard: Enter accepts, Space rejects, the last reject closes the review', async ({ app, page }) => {
    await blockButtons(app, 'accept').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
    await expect(blockButtons(app, 'reject')).toHaveCount(1);
    await blockButtons(app, 'reject').first().focus();
    await page.keyboard.press('Space');
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
  });

  test('Ctrl+Z that brings the diff back leaves the focus in the document: the next shortcut reaches it', async ({ app, page, failOnConsole }) => {
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(mergeView(app)).toBeVisible();
    if (failOnConsole) {
      // Difetto noto, solo in sviluppo (`failOnConsole` è vero solo in e2e/dev.config.ts; misurato il 09/10):
      // StrictMode distrugge e ricrea la MergeView di DiffPane.tsx e il focus cade sul body. Lo si afferma
      // esplicitamente; il clic serve solo a proseguire. Il Task 5 della fase 5b toglie questo ramo.
      await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
      await documentSide(app).click();
    } else {
      await expect(documentSide(app)).toBeFocused();
    }
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(mergeView(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC2');
  });
});

test('a proposal on a selection: edits outside the selection are dropped', async ({ app, ai, page }) => {
  const ORIGINAL = 'prefisso BAD\none\nBAD suffisso';
  ai.reply = 'GOOD\none\nGOOD';
  await app.openFolder({ 'a.md': ORIGINAL });
  await app.openFile('a.md');
  await app.mode('mode.editor').click();
  await app.selectRange(9, ORIGINAL.length - 9);
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
  const before = await lines(proposal(app));
  expect(before).toBe('prefisso GOOD\none\nGOOD suffisso');
  await proposal(app).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.type('X');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('Y');
  await expect.poll(() => lines(proposal(app))).toBe(before);
});
```

Note per chi esegue:
- Se un **localizzatore** non trova l'elemento sull'app di oggi, si corregge il localizzatore (ruolo e nome da `en.json`, o le eccezioni `.cm-*` della spec), mai l'asserzione sul comportamento. Se il comportamento di oggi è diverso, fermarsi e riportarlo.
- Il terzo test di `blocks` **afferma il difetto di oggi in sviluppo** (`failOnConsole` è vero solo in `e2e/dev.config.ts`): misurato il 09/10, con StrictMode il focus cade sul `body`. Il ramo `if (failOnConsole)` lo controlla esplicitamente e poi clicca nel documento solo per proseguire: tutto il resto del test, e i controlli di console ed eccezioni della fixture, restano normali. Se in sviluppo il focus **non** cadesse sul `body`, il test fallirebbe: fermarsi e riportarlo. Nessun `test.fail`.
- `ControlOrMeta+Shift+z` è il «ripeti» di CodeMirror su tutte le piattaforme.

- [ ] **Step 4: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, nell'array `STATES`, subito **prima** dello stato `ai-chat-error`:

```ts
  {
    name: 'editor-mode',
    async setup(app) {
      await app.openFolder({ 'note.md': NOTE });
      await app.openFile('note.md');
      await app.mode('mode.editor').click();
      await expect(app.previewPane()).toHaveCount(0);
      await expect(app.editor()).toBeVisible();
    },
  },
  {
    name: 'ai-review-empty',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A\n\nB' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByText(app.t('ai.emptyProposal'))).toBeVisible();
    },
  },
  {
    name: 'ai-review-hover',
    keepMouse: true,
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      // Pulsante «rifiuta» del primo blocco (eccezione .cm-merge-revert della spec §8.4): sfondo e tooltip al passaggio.
      const reject = page.locator('.cm-merge-revert button[data-action=reject]').first();
      await reject.hover();
      await expect.poll(() => reject.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'ai-review-conflict',
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await page.clock.install();
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      // Modifica locale non salvata nel documento (lato sinistro del diff) e modifica esterna: conflitto,
      // e i pulsanti «accetta» dei blocchi si disattivano (stile :disabled).
      await page.clock.pauseAt(new Date(Date.now() + 10_000));
      await page.locator('.cm-mergeView .cm-content').first().click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type('!');
      await page.clock.runFor(100);
      await app.writeExternal('a.md', 'theirs');
      await app.windowFocus();
      await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
      await expect(page.locator('.cm-merge-revert button[data-action=accept]').first()).toBeDisabled();
    },
  },
```

- [ ] **Step 5: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: 123 + 9 = 132
npx playwright test -c e2e/playwright.config.ts e2e/editor-session.spec.ts e2e/ai-diff.spec.ts --repeat-each=5
npm run test:e2e:dev        # annotare: 108 + 9 = 117 (il terzo test di blocks passa dal ramo del difetto, vedi Step 3)
npm run test:e2e:audit      # annotare: 60 + 8 = 68 (due test per stato)
```

Expected: tutto verde, nessuna ripetizione instabile.

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "test: rete su editor e diff (cronologia, viste, tastiera sui blocchi, focus dopo Ctrl+Z) prima della 5b"
```

---

### Task 2: `docExtensions` senza React e CodeMirror nei test jsdom

**Files:**
- Create: `src/testing/codemirrorEnv.ts`, `src/editor/docExtensions.dom.test.ts`, `src/editor/refDocHost.ts` (temporaneo)
- Modify: `src/editor/docExtensions.ts`, `src/editor/Editor.tsx`, `src/ui/ai/DiffPane.tsx`

**Interfaces:**
- Produces:
  - `src/testing/codemirrorEnv.ts` (solo effetti: import dopo `domEnv`)
  - `interface DocHost { resetKey(): string; readOnly(): boolean; session(): DocSession | null; t(): Translate; getDocs(): DocTitle[]; saveImage(file: File): Promise<string | null>; docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void; selectionChanged(range: TextRange | null): void }` da `src/editor/docExtensions.ts`
  - `docExtensions(host: DocHost)` (era `docExtensions(callbacks: Callbacks)`; il tipo `Callbacks` sparisce), con il plugin privato `lifecycle` che segna la fine di una vista o del suo stato; `editable`, `readOnlyExtensions`, `mainSelectionRange`, `docAppearance` invariati
  - `refDocHost(ref: RefObject<EditorProps & { t: Translate }>): DocHost` da `src/editor/refDocHost.ts` (il Task 4 lo cambia, il Task 5 lo cancella)
  - `EditorProps` senza `canChange`

- [ ] **Step 1: Ambiente CodeMirror per jsdom**

`src/testing/codemirrorEnv.ts`:

```ts
/**
 * Quello che manca a jsdom perché una EditorView (o una MergeView) di CodeMirror giri nei test: un
 * requestAnimationFrame (CodeMirror misura in un fotogramma), il costruttore `Window` globale (lo
 * confronta `isScrolledToBottom`) e i rettangoli dei Range (jsdom non fa layout: tutto a zero).
 * Va importato subito DOPO `domEnv`. Le misure vere (altezze, scroll) le verifica Playwright.
 */
import { dom } from './domEnv';

const win = dom.window as unknown as Window & typeof globalThis;
const raf = (callback: FrameRequestCallback): number => setTimeout(() => callback(performance.now()), 0) as unknown as number;
const caf = (id: number): void => clearTimeout(id);
win.requestAnimationFrame = raf;
win.cancelAnimationFrame = caf;
Object.assign(globalThis, { Window: win.Window, requestAnimationFrame: raf, cancelAnimationFrame: caf });

const emptyRect = (): DOMRect => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
win.Range.prototype.getBoundingClientRect = emptyRect;
win.Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
```

- [ ] **Step 2: Test che falliscono**

`src/editor/docExtensions.dom.test.ts`:

```ts
import '../testing/domEnv';
import '../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, StateEffect, type ChangeDesc } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';

import type { TextRange } from '../ai/selectionChip';
import { translate } from '../i18n/i18n';
import { EN_MESSAGES } from '../i18n/messages';
import { docExtensions, editable, readOnlyExtensions, type DocHost } from './docExtensions';
import { createDocSession, docStateConfig, type DocSession } from './docSession';

// Ogni vista creata qui si distrugge sempre, anche se il test fallisce a metà: una vista viva tiene
// acceso il processo e lascia listener globali (il `pointerup` della barra di formattazione).
const views = new Set<EditorView>();
test.afterEach(() => {
  for (const view of views) view.destroy();
  views.clear();
  document.body.replaceChildren();
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ospite finto: registra le chiamate; `key`, `readOnly` e `saveImage` li decide il test. */
function fakeHost(patch: { key?: string; readOnly?: boolean; session?: DocSession | null; saveImage?: (file: File) => Promise<string | null> } = {}) {
  const calls: (['change', ChangeDesc, { before: string; after: string }] | ['selection', TextRange | null])[] = [];
  const state = { key: patch.key ?? 'a.md#1', readOnly: patch.readOnly ?? false };
  const host: DocHost = {
    resetKey: () => state.key,
    readOnly: () => state.readOnly,
    session: () => patch.session ?? null,
    t: () => (key) => translate(EN_MESSAGES, key),
    getDocs: () => [],
    saveImage: patch.saveImage ?? (async () => null),
    docChanged: (changes, texts) => void calls.push(['change', changes, texts]),
    selectionChanged: (range) => void calls.push(['selection', range]),
  };
  return { host, calls, state };
}

function mount(doc: string, host: DocHost, session?: DocSession) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({ parent, state: EditorState.create(session ? docStateConfig(session, docExtensions(host)) : { doc, extensions: docExtensions(host) }) });
  views.add(view);
  const done = () => {
    views.delete(view);
    view.destroy();
    parent.remove();
  };
  return { view, done };
}

test('a text change reaches the host with before and after, then the selection; the session follows', () => {
  const session = createDocSession('a.md#1', 'abc');
  const { host, calls } = fakeHost({ session });
  const { view, done } = mount('', host, session);
  view.dispatch({ changes: { from: 3, insert: 'd' }, selection: { anchor: 1, head: 4 }, userEvent: 'input.type' });
  assert.deepEqual(calls.map((c) => c[0]), ['change', 'selection']);
  const [, changes, texts] = calls[0] as ['change', ChangeDesc, { before: string; after: string }];
  assert.deepEqual(texts, { before: 'abc', after: 'abcd' });
  assert.equal(changes.length, 3);
  assert.deepEqual(calls[1], ['selection', { from: 1, to: 4 }]);
  assert.equal(session.textLf, 'abcd');
  assert.equal(session.selection?.main.head, 4);
  assert.ok(session.history);
  done();
});

test('moving the cursor reports an empty selection as null, without a text change', () => {
  const { host, calls } = fakeHost();
  const { view, done } = mount('hello', host);
  view.dispatch({ selection: { anchor: 2 } });
  assert.deepEqual(calls, [['selection', null]]);
  done();
});

test('the history saved in the session survives a new state (the other side of the review)', () => {
  const session = createDocSession('a.md#1', 'one');
  const { host } = fakeHost({ session });
  const first = mount('', host, session);
  first.view.dispatch({ changes: { from: 3, insert: ' two' }, userEvent: 'input.type' });
  first.done();
  const second = mount('', host, session);
  assert.equal(second.view.state.doc.toString(), 'one two');
  assert.equal(undo(second.view), true);
  assert.equal(second.view.state.doc.toString(), 'one');
  second.done();
});

test('read-only from the host, and the compartment that switches it', () => {
  const { host } = fakeHost({ readOnly: true });
  const { view, done } = mount('locked', host);
  assert.equal(view.state.readOnly, true);
  assert.equal(view.contentDOM.getAttribute('contenteditable'), 'false');
  view.dispatch({ effects: editable.reconfigure(readOnlyExtensions(false)) });
  assert.equal(view.state.readOnly, false);
  assert.equal(view.contentDOM.getAttribute('contenteditable'), 'true');
  done();
});

/** Incolla dei file: jsdom non ha ClipboardEvent né DataTransfer, basta un evento con `clipboardData`. */
function paste(view: EditorView, ...files: File[]): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } });
  view.contentDOM.dispatchEvent(event);
}

test('a pasted image is saved by the host and linked at the cursor', async () => {
  const saved: string[] = [];
  const { host } = fakeHost({ saveImage: async (file) => (saved.push(file.name), `assets/${file.name}`) });
  const { view, done } = mount('ab', host);
  view.dispatch({ selection: { anchor: 1 } });
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  await tick();
  assert.deepEqual(saved, ['pic.png']);
  assert.equal(view.state.doc.toString(), 'a![](assets/pic.png)\nb');
  done();
});

test('an image saved after a document change is not linked (resetKey read again)', async () => {
  let release!: (link: string) => void;
  const { host, state } = fakeHost({ saveImage: () => new Promise((resolve) => (release = resolve)) });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  state.key = 'b.md#1';
  release('assets/pic.png');
  await tick();
  assert.equal(view.state.doc.toString(), 'ab');
  done();
});

test('a paste without images is left to CodeMirror', () => {
  const { host } = fakeHost({ saveImage: async () => assert.fail('nessuna immagine da salvare') });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'notes.txt', { type: 'text/plain' }));
  assert.equal(view.state.doc.toString(), 'ab');
  done();
});

test('a view destroyed while an image is saving: no link, no further saves', async () => {
  const saving: ((link: string) => void)[] = [];
  const saved: string[] = [];
  const { host } = fakeHost({ saveImage: (file) => (saved.push(file.name), new Promise((resolve) => saving.push(resolve))) });
  const { view, done } = mount('ab', host);
  const changes: number[] = [];
  const watch = EditorView.updateListener.of((update) => void (update.docChanged && changes.push(1)));
  view.dispatch({ effects: StateEffect.appendConfig.of(watch) });
  paste(view, new File(['1'], 'one.png', { type: 'image/png' }), new File(['2'], 'two.png', { type: 'image/png' }));
  done();
  saving[0]('assets/one.png');
  await tick();
  assert.deepEqual(saved, ['one.png']);
  assert.deepEqual(changes, []);
});

test('a new state in the same view (another document, same key): the pending image is dropped', async () => {
  let release!: (link: string) => void;
  const { host } = fakeHost({ saveImage: () => new Promise((resolve) => (release = resolve)) });
  const { view, done } = mount('ab', host);
  paste(view, new File(['x'], 'pic.png', { type: 'image/png' }));
  view.setState(EditorState.create({ doc: 'other', extensions: docExtensions(host) }));
  release('assets/pic.png');
  await tick();
  assert.equal(view.state.doc.toString(), 'other');
  done();
});
```

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/editor/docExtensions.dom.test.ts`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'readOnly')` (oggi `docExtensions` legge `callbacks.current`).

- [ ] **Step 4: `docExtensions.ts` su `DocHost`**

`src/editor/docExtensions.ts` (file intero; tema, evidenziazione, `docAppearance`, `editable`, `readOnlyExtensions`, `mainSelectionRange`, gestori di incolla e trascinamento invariati; via il filtro di `canChange`; nuovo il plugin `lifecycle`, che fa cadere un'immagine salvata dopo la fine della vista o del suo stato):

```ts
import { basicSetup } from 'codemirror';
import { Compartment, EditorState, type ChangeDesc } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import type { TextRange } from '../ai/selectionChip';
import type { DocTitle } from '../search/searchIndex';
import { imageFiles, insertImageLinks } from './images';
import { wikiCompletionSource } from './wikiCompletion';
import { saveDocSession, type DocSession } from './docSession';
import { formatToolbar, type Translate } from './formatToolbar';

/**
 * Ciò che le estensioni del documento chiedono a chi ospita l'editor (hmd-editor, lato documento di
 * hmd-ai-diff-pane). Ogni valore si legge al momento dell'uso, mai copiato: l'ospite cambia sotto
 * (altro file, sola lettura, lingua) senza ricreare le estensioni.
 */
export interface DocHost {
  /** Chiave del documento mostrato: un'immagine salvata dopo un cambio di documento non si inserisce. */
  resetKey(): string;
  readOnly(): boolean;
  /** Sessione in cui salvare testo, selezione e cronologia a ogni aggiornamento (null = nessuna). */
  session(): DocSession | null;
  t(): Translate;
  getDocs(): DocTitle[];
  /** Salva un'immagine incollata o trascinata; restituisce il link relativo, null se non salvata. */
  saveImage(file: File): Promise<string | null>;
  /** Il testo è cambiato: prima e dopo, con le modifiche (per la proposta AI e per il salvataggio). */
  docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void;
  /** Selezione principale cambiata (null se vuota): chip della selezione del composer AI. */
  selectionChanged(range: TextRange | null): void;
}

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--c-surface)', color: 'var(--c-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', fontSize: '14px' },
  // Larghezza del testo dalle impostazioni (src/lib/textWidth.ts), più il padding delle righe; centrato.
  '.cm-content': { padding: '20px 0 40vh', caretColor: 'var(--c-text)', maxWidth: 'calc(var(--editor-text-width, 100%) + 48px)', margin: '0 auto' },
  '.cm-line': { padding: '0 24px' },
  '.cm-gutters': { backgroundColor: 'var(--c-surface)', color: 'var(--c-muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--c-accent-soft) 35%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--c-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--c-accent) 25%, transparent) !important',
  },
  '.cm-tooltip': { backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)' },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.heading1, fontSize: '1.25em' },
  { tag: tags.heading2, fontSize: '1.12em' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--c-accent)' },
  { tag: tags.monospace, color: 'var(--c-accent)' },
  { tag: tags.quote, color: 'var(--c-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--c-muted)' },
]);

export const editable = new Compartment();
export const readOnlyExtensions = (readOnly: boolean) => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];

/**
 * Vita di una vista con il suo stato: `alive` torna false quando la vista viene distrutta (distacco
 * dell'elemento) o il suo stato sostituito (`setState`, che reinizializza i plugin).
 */
const lifecycle = ViewPlugin.define(() => ({
  alive: true,
  destroy() {
    this.alive = false;
  },
}));

/** Chiave di una vista che non c'è più: diversa da qualsiasi resetKey. */
const GONE = '\u0000gone';

function insertImages(view: EditorView, files: File[], pos: number, host: DocHost): void {
  // insertImageLinks legge la chiave subito (al momento dell'incolla/trascinamento) e dopo ogni
  // salvataggio la riconfronta: se l'editor è passato a un altro documento, o questa vista è stata
  // distrutta (anche se l'elemento è tornato con lo stesso resetKey), non salva altro e non la tocca.
  const life = view.plugin(lifecycle);
  void insertImageLinks(files, pos, (file) => host.saveImage(file), {
    key: () => (life?.alive ? host.resetKey() : GONE),
    length: () => view.state.doc.length,
    insert(at, insert) {
      view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
    },
  });
}

/** Selezione principale come tratto, null se vuota (chip della selezione del composer AI). */
export function mainSelectionRange(state: EditorState): { from: number; to: number } | null {
  const main = state.selection.main;
  return main.empty ? null : { from: main.from, to: main.to };
}

/** Aspetto del documento (markdown, colori, carattere, a capo): condiviso con il lato AI del diff. */
export function docAppearance() {
  return [markdown(), syntaxHighlighting(highlight), EditorView.lineWrapping, theme];
}

export function docExtensions(host: DocHost) {
  return [
      basicSetup,
      lifecycle,
      docAppearance(),
      editable.of(readOnlyExtensions(host.readOnly())),
      autocompletion({ override: [wikiCompletionSource(() => host.getDocs())] }),
      formatToolbar(() => host.t()),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) host.docChanged(update.changes, { before: update.startState.doc.toString(), after: update.state.doc.toString() });
        if (update.selectionSet || update.docChanged) host.selectionChanged(mainSelectionRange(update.state));
        const session = host.session();
        if (session) saveDocSession(session, update.state);
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = imageFiles(event.clipboardData?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          insertImages(view, files, view.state.selection.main.head, host);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
          insertImages(view, files, pos, host);
          return true;
        },
      }),
    ];
}
```

`src/editor/refDocHost.ts`:

```ts
import type { RefObject } from 'react';

import type { DocHost } from './docExtensions';
import type { EditorProps } from './Editor';
import type { Translate } from './formatToolbar';

/**
 * Ponte temporaneo: le props di Editor.tsx e DiffPane.tsx, lette dal ref a ogni uso, come DocHost.
 * Sparisce con DiffPane.tsx (fase 5b, Task 5).
 */
export function refDocHost(ref: RefObject<EditorProps & { t: Translate }>): DocHost {
  return {
    resetKey: () => ref.current.resetKey,
    readOnly: () => ref.current.readOnly ?? false,
    session: () => ref.current.session ?? null,
    t: () => ref.current.t,
    getDocs: () => ref.current.getDocs(),
    saveImage: (file) => ref.current.onImage(file),
    docChanged(changes, texts) {
      ref.current.onTransactions?.(changes, texts);
      ref.current.onChange(texts.after);
    },
    selectionChanged: (range) => ref.current.onSelection?.(range),
  };
}
```

In `src/editor/Editor.tsx`:
- dopo `import { docStateConfig, saveDocSession, type DocSession } from './docSession';` aggiungere `import { refDocHost } from './refDocHost';`;
- in `EditorProps` togliere la riga `canChange?: (changes: ChangeDesc) => boolean;` (`ChangeDesc` resta importato: lo usa `onTransactions`);
- nell'effetto `[props.resetKey]`, `docExtensions(callbacks)` → `docExtensions(refDocHost(callbacks))` (due volte nella stessa riga).

In `src/ui/ai/DiffPane.tsx`:
- dopo `import { initialRestoreSeq } from '../../editor/restoreCommand';` aggiungere `import { refDocHost } from '../../editor/refDocHost';`;
- nella creazione della MergeView, `a:docStateConfig(session,docExtensions(callbacks))` → `a:docStateConfig(session,docExtensions(refDocHost(callbacks)))`.

`before` del testo ora si calcola a ogni modifica anche senza `onTransactions`: entrambi i chiamanti lo passano già, quindi nulla cambia.

- [ ] **Step 5: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/editor/docExtensions.dom.test.ts   # 9 pass
npm test                     # 740 + 9 = 749
npm run lint
npm run test:e2e             # editor, formatting, history, external, ai-review, editor-session, ai-diff
npm run test:e2e:dev
npm run test:e2e:audit
```

- [ ] **Step 6: Commit**

```bash
git add src/testing/codemirrorEnv.ts src/editor src/ui/ai/DiffPane.tsx
git commit -m "refactor: docExtensions su DocHost, senza React; CodeMirror nei test jsdom"
```

---

### Task 3: Logica pura dell'editor e del diff

**Files:**
- Create: `src/elements/editor/editorLogic.ts`, `src/elements/editor/editorLogic.test.ts`
- Create: `src/elements/ai/diffLogic.ts`, `src/elements/ai/diffLogic.test.ts`

**Interfaces:**
- Produces (`editorLogic.ts`):
  - `interface LineBox { top: number; height: number }`
  - `adoptResetKey(session: DocSession, resetKey: string, text: string): void`
  - `topLine(number: number, box: LineBox, scrollTop: number): number`
  - `lineNumberFor(line: number, lines: number): number`
  - `scrollTopFor(line: number, box: LineBox): number`
- Produces (`diffLogic.ts`):
  - `interface ChunkRange { fromA: number; toA: number; fromB: number; toB: number }`
  - `rejectChange(a: EditorState, b: EditorState, chunk: ChunkRange): { from: number; to: number; insert: string }`
  - `insideRange(changes: ChangeDesc, range: TextRange | null): boolean`
  - `type ControlAction = 'accept' | 'reject'`; `controlDisabled(action: ControlAction, state: { canAccept: boolean; streaming: boolean }): boolean`

- [ ] **Step 1: Test che falliscono**

`src/elements/editor/editorLogic.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createDocSession } from '../../editor/docSession';
import { adoptResetKey, lineNumberFor, scrollTopFor, topLine } from './editorLogic';

test('a new reset key restarts the session from the text; the same key leaves it alone', () => {
  const session = createDocSession('a.md#1', 'old');
  session.history = {} as never;
  session.selection = {} as never;
  adoptResetKey(session, 'a.md#1', 'ignored');
  assert.equal(session.textLf, 'old');
  assert.ok(session.history && session.selection);
  adoptResetKey(session, 'a.md#2', 'new');
  assert.deepEqual(session, { resetKey: 'a.md#2', textLf: 'new', history: undefined, selection: undefined });
});

test('top line: block line plus the scrolled fraction, clamped to the block', () => {
  assert.equal(topLine(1, { top: 0, height: 20 }, 0), 0);
  assert.equal(topLine(5, { top: 100, height: 20 }, 110), 4.5);
  assert.equal(topLine(5, { top: 100, height: 20 }, 90), 4);
  assert.equal(topLine(5, { top: 100, height: 20 }, 130), 5);
  assert.equal(topLine(3, { top: 40, height: 0 }, 41), 2);
});

test('line to show: 1-based, inside the document', () => {
  assert.deepEqual([lineNumberFor(0, 10), lineNumberFor(2.7, 10), lineNumberFor(-3, 10), lineNumberFor(42, 10)], [1, 3, 1, 10]);
});

test('scroll offset for a fractional line inside its block', () => {
  assert.equal(scrollTopFor(4, { top: 80, height: 20 }), 80);
  assert.equal(scrollTopFor(4.25, { top: 80, height: 20 }), 85);
});
```

`src/elements/ai/diffLogic.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { Chunk } from '@codemirror/merge';
import { ChangeSet, EditorState } from '@codemirror/state';

import { controlDisabled, insideRange, rejectChange } from './diffLogic';

/** Rifiuta il blocco `index` come farebbe hmd-ai-diff-pane e restituisce la proposta che ne esce. */
function reject(original: string, proposal: string, index = 0): string {
  const a = EditorState.create({ doc: original });
  const b = EditorState.create({ doc: proposal });
  const chunk = Chunk.build(a.doc, b.doc)[index];
  return b.update({ changes: rejectChange(a, b, chunk) }).state.doc.toString();
}

test('reject: the original lines go back into the proposal, the other blocks stay', () => {
  assert.equal(reject('A\n\nB\n\nC', 'A2\n\nB\n\nC2'), 'A\n\nB\n\nC2');
  assert.equal(reject('A\n\nB\n\nC', 'A2\n\nB\n\nC2', 1), 'A2\n\nB\n\nC');
});

test('reject of an added or a removed line', () => {
  assert.equal(reject('A\nB', 'A\nnew\nB'), 'A\nB');
  assert.equal(reject('A\nold\nB', 'A\nB'), 'A\nold\nB');
});

test('edits to the proposal: anywhere without a range, only inside it with one', () => {
  const change = (from: number, to: number) => ChangeSet.of({ from, to, insert: 'x' }, 20);
  assert.equal(insideRange(change(0, 1), null), true);
  assert.equal(insideRange(change(5, 8), { from: 5, to: 10 }), true);
  assert.equal(insideRange(change(4, 6), { from: 5, to: 10 }), false);
  assert.equal(insideRange(change(9, 11), { from: 5, to: 10 }), false);
});

test('block buttons: accept follows canAccept, reject is off only while generating', () => {
  assert.deepEqual(
    [
      controlDisabled('accept', { canAccept: true, streaming: true }),
      controlDisabled('accept', { canAccept: false, streaming: false }),
      controlDisabled('reject', { canAccept: false, streaming: false }),
      controlDisabled('reject', { canAccept: true, streaming: true }),
    ],
    [false, true, false, true],
  );
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/editor/editorLogic.test.ts src/elements/ai/diffLogic.test.ts`
Expected: FAIL, moduli mancanti.

- [ ] **Step 3: Implementazione**

`src/elements/editor/editorLogic.ts`:

```ts
import type { DocSession } from '../../editor/docSession';

/** Blocco di una riga come lo misura CodeMirror (`lineBlockAt`): posizione e altezza in pixel. */
export interface LineBox {
  top: number;
  height: number;
}

/**
 * Nuovo documento (altro file, ricarica): la sessione riparte dal testo, senza cronologia né selezione
 * (era la prima riga dell'effetto [resetKey] di Editor.tsx). Una sessione già creata per quella chiave resta.
 */
export function adoptResetKey(session: DocSession, resetKey: string, text: string): void {
  if (session.resetKey === resetKey) return;
  session.resetKey = resetKey;
  session.textLf = text;
  session.history = undefined;
  session.selection = undefined;
}

/** Riga (0-based, frazionaria) in cima alla vista: `number` è la riga 1-based del blocco in cima. */
export function topLine(number: number, box: LineBox, scrollTop: number): number {
  const fraction = box.height > 0 ? Math.min(1, Math.max(0, (scrollTop - box.top) / box.height)) : 0;
  return number - 1 + fraction;
}

/** Riga 1-based da mostrare per la riga sorgente `line` (0-based, frazionaria), dentro il documento. */
export function lineNumberFor(line: number, lines: number): number {
  return Math.min(Math.max(Math.floor(line) + 1, 1), lines);
}

/** scrollTop che porta in cima la parte frazionaria di `line` dentro il blocco della sua riga. */
export function scrollTopFor(line: number, box: LineBox): number {
  return box.top + (line - Math.floor(line)) * box.height;
}
```

`src/elements/ai/diffLogic.ts`:

```ts
import type { ChangeDesc, EditorState } from '@codemirror/state';

import type { TextRange } from '../../ai/selectionChip';

/** Un blocco della MergeView (`Chunk` di @codemirror/merge): tratti nel documento (a) e nella proposta (b). */
export interface ChunkRange {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
}

/**
 * Rifiuto di un blocco: il testo originale torna nella proposta, verso opposto al «revert» della libreria
 * (stessa regola dell'a capo finale di `revertClicked` in @codemirror/merge).
 */
export function rejectChange(a: EditorState, b: EditorState, chunk: ChunkRange): { from: number; to: number; insert: string } {
  let insert = a.sliceDoc(chunk.fromA, Math.max(chunk.fromA, chunk.toA - 1));
  if (chunk.fromA !== chunk.toA && chunk.toB <= b.doc.length) insert += a.lineBreak;
  return { from: chunk.fromB, to: Math.min(b.doc.length, chunk.toB), insert };
}

/** Le modifiche alla proposta restano dentro il tratto selezionato (senza tratto: tutto ammesso). */
export function insideRange(changes: ChangeDesc, range: TextRange | null): boolean {
  if (!range) return true;
  let inside = true;
  changes.iterChangedRanges((from, to) => {
    if (from < range.from || to > range.to) inside = false;
  });
  return inside;
}

export type ControlAction = 'accept' | 'reject';

/** Pulsanti dei blocchi: «accetta» solo quando si può accettare, «rifiuta» mai durante la generazione. */
export function controlDisabled(action: ControlAction, state: { canAccept: boolean; streaming: boolean }): boolean {
  return action === 'reject' ? state.streaming : !state.canAccept;
}
```

- [ ] **Step 4: Passano, poi tutto**

Run: i due file di test, poi `npm test` e `npm run lint`.
Expected: PASS; `npm test` = 749 + 8 = 757. Nessun file dell'app cambia: le suite e2e non servono.

- [ ] **Step 5: Commit**

```bash
git add src/elements/editor/editorLogic.ts src/elements/editor/editorLogic.test.ts src/elements/ai/diffLogic.ts src/elements/ai/diffLogic.test.ts
git commit -m "feat: logica pura dell'editor (riga in cima, scroll, sessione) e del diff (rifiuto, tratto, pulsanti)"
```

---

### Task 4: `hmd-editor`

**Files:**
- Create: `src/elements/editor/docElement.ts`, `src/elements/editor/editor.element.ts`, `src/elements/editor/editor.css`, `src/elements/editor/editor.dom.test.ts`
- Create: `src/ui/ai/reviewDoc.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `src/ui/ai/ReviewView.tsx`, `src/ui/ai/DiffPane.tsx`, `src/editor/refDocHost.ts`
- Delete: `src/editor/Editor.tsx`, `src/editor/Editor.module.css`

**Interfaces:**
- Consumes: `DocHost`, `docExtensions`, `editable`, `readOnlyExtensions`, `mainSelectionRange` (Task 2); `adoptResetKey`, `topLine`, `lineNumberFor`, `scrollTopFor` (Task 3); `SCROLL_SUPPRESS_MS` da `src/elements/preview/previewView.ts`; `codemirrorEnv` (Task 2).
- Produces:
  - `type SaveImage = (file: File) => Promise<string | null>` e `abstract class HmdDocElement extends HmdElement` da `src/elements/editor/docElement.ts`: proprietà `text: string`, `resetKey: string`, `session: DocSession | null`, `restore: RestoreCommand | null`, `readOnly: boolean`, `getDocs: () => DocTitle[]`, `saveImage: SaveImage | null`, `i18n: I18nStore | null`; protetti `docHost: DocHost`, `translator(): Translate`, `abstract docInputChanged(): void`, `i18nChanged(): void` (vuoto), `docConfig(): EditorStateConfig`, `saveSession(state: EditorState): void`. Emette `hmd-doc-change` e `hmd-selection`.
  - `HmdEditor extends HmdDocElement`: metodi `scrollToLine(line: number): void`, `focus(): void`; evento in più `hmd-top-line`.
  - Eventi: `'hmd-doc-change': CustomEvent<{ changes: ChangeDesc; before: string; after: string }>`, `'hmd-selection': CustomEvent<{ range: TextRange | null }>`.
  - `type HmdDocProps<E extends keyof HmdEvents = never>` esportato da `src/elements/jsx.d.ts`.
  - `interface ReviewDoc { path; text; resetKey; session: DocSession; restore: RestoreCommand | null; readOnly: boolean; getDocs(); saveImage(file); docChanged(changes, texts); selectionChanged(range) }` da `src/ui/ai/reviewDoc.ts`.
  - `refDocHost(ref: RefObject<ReviewDoc & { t: Translate }>): DocHost`.

- [ ] **Step 1: Test che falliscono**

`src/elements/editor/editor.dom.test.ts`:

```ts
import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import { StrictMode, createElement, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import '../define';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import type { HmdEvents } from '../events';
import type { HmdEditor } from './editor.element';

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: EN_MESSAGES }), persist() {} });
type Recorded = [keyof HmdEvents, unknown];

/** Incolla delle immagini nella vista (jsdom non ha ClipboardEvent né DataTransfer). */
function pasteImages(view: EditorView, ...names: string[]): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const files = names.map((name) => new File(['x'], name, { type: 'image/png' }));
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } });
  view.contentDOM.dispatchEvent(event);
}

/** saveImage finto che resta in attesa finché il test non risponde. */
function slowSave() {
  const saved: string[] = [];
  const pending: ((link: string) => void)[] = [];
  const saveImage = (file: File) => (saved.push(file.name), new Promise<string | null>((resolve) => pending.push(resolve)));
  return { saveImage, saved, pending };
}

function mount(text: string, key = 'a.md#1') {
  const session = createDocSession(key, text);
  const el = document.createElement('hmd-editor');
  el.text = text;
  el.resetKey = key;
  el.session = session;
  el.restore = null;
  el.readOnly = false;
  el.i18n = i18n;
  const events: Recorded[] = [];
  for (const type of ['hmd-doc-change', 'hmd-selection', 'hmd-top-line'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  document.body.append(el);
  const view = () => EditorView.findFromDOM(el.querySelector<HTMLElement>('.cm-editor')!)!;
  return { el, session, events, view };
}

test('the tree of Editor.tsx: a div.editor holding the CodeMirror view, filled from the session', () => {
  const { el, view } = mount('# Title');
  const box = el.firstElementChild!;
  assert.deepEqual([box.localName, box.className, el.childElementCount], ['div', 'editor', 1]);
  assert.equal(box.firstElementChild, view().dom);
  assert.equal(view().state.doc.toString(), '# Title');
  el.remove();
});

test('the session selection is announced after mounting, in a microtask', async () => {
  const session = createDocSession('a.md#1', 'hello world');
  session.selection = EditorSelection.single(0, 5);
  const el = document.createElement('hmd-editor');
  Object.assign(el, { text: 'hello world', resetKey: 'a.md#1', session, i18n });
  const ranges: unknown[] = [];
  el.addEventListener('hmd-selection', (event) => ranges.push(event.detail.range));
  document.body.append(el);
  assert.deepEqual(ranges, []);
  await tick();
  assert.deepEqual(ranges, [{ from: 0, to: 5 }]);
  el.remove();
});

test('typing: hmd-doc-change with before and after, then hmd-selection; the session follows', async () => {
  const { el, session, events, view } = mount('abc');
  await tick();
  events.length = 0;
  view().dispatch({ changes: { from: 3, insert: 'd' }, selection: { anchor: 4 }, userEvent: 'input.type' });
  assert.deepEqual(events.map(([type]) => type), ['hmd-doc-change', 'hmd-selection']);
  const change = events[0][1] as HmdEvents['hmd-doc-change']['detail'];
  assert.deepEqual([change.before, change.after, change.changes.length], ['abc', 'abcd', 3]);
  assert.equal(session.textLf, 'abcd');
  el.remove();
});

test('a new text alone changes nothing (it comes back from the editor while typing)', async () => {
  const { el, view } = mount('mine');
  el.text = 'stale';
  await tick();
  assert.equal(view().state.doc.toString(), 'mine');
  el.remove();
});

test('a new resetKey replaces the text in the same view, clears the history, announces the selection', async () => {
  const { el, events, view } = mount('old');
  const first = view();
  first.dispatch({ changes: { from: 3, insert: '!' }, userEvent: 'input.type' });
  await tick();
  events.length = 0;
  // React assegna le proprietà nell'ordine del JSX: resetKey può arrivare prima della sessione nuova.
  el.resetKey = 'b.md#1';
  el.text = 'new';
  el.session = createDocSession('b.md#1', 'new');
  await tick();
  assert.equal(view(), first);
  assert.equal(first.state.doc.toString(), 'new');
  assert.equal(undo(first), false);
  assert.deepEqual(events, [['hmd-selection', { range: null }]]);
  el.remove();
});

test('restore: a transaction (undoable), applied once; the one present at mount counts as applied', async () => {
  const { el, view } = mount('v2');
  el.restore = { seq: 1, textLf: 'v1' };
  await tick();
  assert.equal(view().state.doc.toString(), 'v1');
  assert.equal(undo(view()), true);
  assert.equal(view().state.doc.toString(), 'v2');
  // Lo stesso comando (un nuovo render di React) non si riapplica.
  el.restore = { seq: 1, textLf: 'v1' };
  await tick();
  assert.equal(view().state.doc.toString(), 'v2');
  el.remove();
  const late = document.createElement('hmd-editor');
  Object.assign(late, { text: 'v1', resetKey: 'a.md#1', session: createDocSession('a.md#1', 'v1'), restore: { seq: 5, textLf: 'other' }, i18n });
  document.body.append(late);
  await tick();
  assert.equal(EditorView.findFromDOM(late.querySelector<HTMLElement>('.cm-editor')!)!.state.doc.toString(), 'v1');
  late.remove();
});

test('read-only follows the property', async () => {
  const { el, view } = mount('text');
  el.readOnly = true;
  await tick();
  assert.equal(view().state.readOnly, true);
  assert.equal(view().contentDOM.getAttribute('contenteditable'), 'false');
  el.readOnly = false;
  await tick();
  assert.equal(view().state.readOnly, false);
  el.remove();
});

test('scroll: the top line goes out as hmd-top-line, except right after scrollToLine', async () => {
  let now = 1000;
  mock.method(performance, 'now', () => now);
  const { el, events, view } = mount(Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n'));
  await tick();
  events.length = 0;
  const scroller = view().scrollDOM;
  scroller.dispatchEvent(new Event('scroll'));
  assert.deepEqual(events.map(([type]) => type), ['hmd-top-line']);
  assert.equal(typeof (events[0][1] as { line: number }).line, 'number');
  el.scrollToLine(10);
  assert.ok(scroller.scrollTop > 0);
  now += 149;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, 1);
  now += 2;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, 2);
  mock.restoreAll();
  el.remove();
});

test('focus() puts the focus in the text', () => {
  const { el, view } = mount('text');
  el.focus();
  assert.equal(document.activeElement, view().contentDOM);
  el.remove();
});

test('detached: the session keeps text and history, a new view picks them up', async () => {
  const { el, session, view } = mount('one');
  view().dispatch({ changes: { from: 3, insert: ' two' }, userEvent: 'input.type' });
  el.remove();
  assert.equal(el.querySelector('.cm-editor'), null);
  assert.equal(session.textLf, 'one two');
  document.body.append(el);
  assert.equal(view().state.doc.toString(), 'one two');
  assert.equal(undo(view()), true);
  assert.equal(view().state.doc.toString(), 'one');
  el.remove();
});

test('removed while a new document is still pending: each session keeps its own text', async () => {
  const { el, session, view } = mount('old');
  view().dispatch({ changes: { from: 3, insert: '!' }, userEvent: 'input.type' });
  const next = createDocSession('b.md#1', 'new');
  el.resetKey = 'b.md#1';
  el.session = next;
  el.text = 'new';
  el.remove();
  await tick();
  assert.equal(session.textLf, 'old!');
  assert.equal(next.textLf, 'new');
});

test('an image still saving when the editor is detached goes nowhere, even if it comes back with the same document', async () => {
  const { el, session, view } = mount('ab');
  const slow = slowSave();
  el.saveImage = slow.saveImage;
  pasteImages(view(), 'one.png', 'two.png');
  el.remove();
  document.body.append(el); // stessa chiave: una vista nuova dalla sessione
  slow.pending[0]('assets/one.png');
  await tick();
  assert.deepEqual(slow.saved, ['one.png']);
  assert.equal(view().state.doc.toString(), 'ab');
  assert.equal(session.textLf, 'ab');
});

test('under React StrictMode: properties (also saveImage) set before connecting, the view is never recreated', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const saveImage = async () => null;
  let editor: HmdEditor | null = null;
  function Parent() {
    const ref = useRef<HmdEditor>(null);
    // Come ReviewView: il genitore dà il focus all'editor appena montato.
    useEffect(() => ref.current?.focus(), []);
    return createElement('hmd-editor', { ref, text: 'abc', resetKey: 'a.md#1', session: createDocSession('a.md#1', 'abc'), saveImage, i18n });
  }
  flushSync(() => root.render(createElement(StrictMode, null, createElement(Parent))));
  editor = host.querySelector('hmd-editor');
  assert.equal(editor!.saveImage, saveImage);
  assert.equal(host.querySelectorAll('.cm-editor').length, 1);
  assert.equal(document.activeElement, editor!.querySelector('.cm-content'));
  flushSync(() => root.unmount());
  host.remove();
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/editor/editor.dom.test.ts`
Expected: FAIL (tag non definito: nessun `.cm-editor`).

- [ ] **Step 3: La base comune e l'elemento**

`src/elements/editor/docElement.ts`:

```ts
import type { EditorState, EditorStateConfig } from '@codemirror/state';

import { HmdElement } from '../../dom/element';
import { docExtensions, type DocHost } from '../../editor/docExtensions';
import { docStateConfig, saveDocSession, type DocSession } from '../../editor/docSession';
import type { Translate } from '../../editor/formatToolbar';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { adoptResetKey } from './editorLogic';

/** Salva un'immagine incollata o trascinata e restituisce il link relativo (null se non salvata). */
export type SaveImage = (file: File) => Promise<string | null>;

const NO_DOCS = (): DocTitle[] => [];
const KEY_ONLY: Translate = (key) => key;

/**
 * Il documento aperto come lo ricevono hmd-editor e hmd-ai-diff-pane (lato documento): stesse proprietà,
 * stesse estensioni, stessi eventi `hmd-doc-change` e `hmd-selection`. I setter segnano soltanto; ciò che
 * cambia la vista (documento nuovo, ripristino, sola lettura) la sottoclasse lo applica in un microtask
 * (`docInputChanged`), qualunque sia l'ordine in cui React assegna le proprietà.
 */
export abstract class HmdDocElement extends HmdElement {
  #text = '';
  #resetKey = '';
  #session: DocSession | null = null;
  #restore: RestoreCommand | null = null;
  #readOnly = false;
  #getDocs: () => DocTitle[] = NO_DOCS;
  #saveImage: SaveImage | null = null;
  #i18n: I18nStore | null = null;
  /**
   * Sessione da cui è nata la vista mostrata: la vista salva lì, anche quando la proprietà `session` è già
   * quella del documento nuovo (la sostituzione arriva nel microtask dopo).
   */
  #shownSession: DocSession | null = null;

  /** Le estensioni del documento leggono da qui a ogni uso: valori sempre attuali, senza ricrearle. */
  protected readonly docHost: DocHost = {
    resetKey: () => this.#resetKey,
    readOnly: () => this.#readOnly,
    session: () => this.#shownSession,
    t: () => this.translator(),
    getDocs: () => this.#getDocs(),
    saveImage: (file) => this.#saveImage?.(file) ?? Promise.resolve(null),
    docChanged: (changes, texts) => emit(this, 'hmd-doc-change', { changes, before: texts.before, after: texts.after }),
    selectionChanged: (range) => emit(this, 'hmd-selection', { range }),
  };

  /** Letto solo quando cambia `resetKey`: mentre si scrive il testo arriva dall'editor stesso. */
  get text(): string { return this.#text; }
  set text(value: string) { this.#text = value ?? ''; }
  /** Quando cambia, il contenuto si sostituisce e la cronologia riparte (altro file, ricarica). */
  get resetKey(): string { return this.#resetKey; }
  set resetKey(value: string) {
    value ??= '';
    if (value === this.#resetKey) return;
    this.#resetKey = value;
    this.docInputChanged();
  }
  get session(): DocSession | null { return this.#session; }
  set session(value: DocSession | null) { this.#session = value ?? null; }
  /** Ripristino dalla cronologia: una transazione, quindi annullabile con Ctrl+Z. */
  get restore(): RestoreCommand | null { return this.#restore; }
  set restore(value: RestoreCommand | null) {
    this.#restore = value ?? null;
    this.docInputChanged();
  }
  /** Sola lettura (aggiornamento dell'app in corso). */
  get readOnly(): boolean { return this.#readOnly; }
  set readOnly(value: boolean) {
    this.#readOnly = value ?? false;
    this.docInputChanged();
  }
  get getDocs(): () => DocTitle[] { return this.#getDocs; }
  set getDocs(value: () => DocTitle[]) { this.#getDocs = value ?? NO_DOCS; }
  /** Non `onImage`: React 19 tratta ogni prop `on…` di un custom element come un listener. */
  get saveImage(): SaveImage | null { return this.#saveImage; }
  set saveImage(value: SaveImage | null) { this.#saveImage = value ?? null; }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.i18nChanged();
  }

  /** Traduzione attuale (la barra di formattazione la legge quando compare). Non `translate`: è di HTMLElement. */
  protected translator(): Translate {
    return this.#i18n?.t ?? KEY_ONLY;
  }

  /** `resetKey`, `restore` o `readOnly` assegnati: da applicare in un microtask. */
  protected abstract docInputChanged(): void;

  /** Store della lingua cambiato: niente di default (hmd-editor legge le traduzioni quando servono). */
  protected i18nChanged(): void {}

  /** Configurazione del documento: dalla sessione (testo, selezione, cronologia) o dal testo. */
  protected docConfig(): EditorStateConfig {
    const session = this.#session;
    this.#shownSession = session;
    if (session) adoptResetKey(session, this.#resetKey, this.#text);
    const extensions = docExtensions(this.docHost);
    return session ? docStateConfig(session, extensions) : { doc: this.#text, extensions };
  }

  /** Prima di distruggere la vista: testo, selezione e cronologia nella sua sessione, per la vista dopo. */
  protected saveSession(state: EditorState): void {
    if (this.#shownSession) saveDocSession(this.#shownSession, state);
  }
}
```

`src/elements/editor/editor.element.ts`:

```ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { el } from '../../dom/el';
import { editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import { applyDocRestore } from '../../editor/useDocBinding';
import { emit } from '../events';
import { SCROLL_SUPPRESS_MS } from '../preview/previewView';
import { HmdDocElement } from './docElement';
import { lineNumberFor, scrollTopFor, topLine } from './editorLogic';
import './editor.css';

/**
 * Editor del documento (era Editor.tsx). La EditorView nasce alla connessione e muore al distacco (la
 * sessione conserva testo, selezione e cronologia); un documento nuovo arriva con `setState` sulla stessa
 * vista. Documento nuovo, ripristino e sola lettura si applicano in un microtask nell'ordine degli
 * effetti di Editor.tsx: mai dentro un aggiornamento di CodeMirror, mai durante il commit di React.
 */
export class HmdEditor extends HmdDocElement {
  #box: HTMLDivElement | null = null;
  #view: EditorView | null = null;
  /** Ciò che la vista mostra già: chiave del documento, ultimo ripristino, sola lettura. */
  #applied = { resetKey: '', restore: 0, readOnly: false };
  /** Selezione da annunciare: uno stato creato da zero non passa dall'updateListener. */
  #announce = false;
  #scheduled = false;
  #suppressUntil = 0;

  /** Porta in cima la riga sorgente `line` (0-based, frazionaria); lo scroll che ne segue non torna all'anteprima. */
  scrollToLine(line: number): void {
    const view = this.#view;
    if (!view) return;
    const box = view.lineBlockAt(view.state.doc.line(lineNumberFor(line, view.state.doc.lines)).from);
    this.#suppressUntil = performance.now() + SCROLL_SUPPRESS_MS;
    view.scrollDOM.scrollTop = scrollTopFor(line, box);
  }

  /** Focus nel testo (passaggio tra editor e diff nella revisione AI). */
  focus(): void {
    this.#view?.focus();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'editor' }));
    if (!this.#view) {
      this.#view = new EditorView({ parent: this.#box, state: EditorState.create(this.docConfig()) });
      // Il ripristino già presente è già nel testo (come al montaggio di Editor.tsx).
      this.#applied = { resetKey: this.resetKey, restore: initialRestoreSeq(this.restore), readOnly: this.readOnly };
      // La selezione della sessione si annuncia in un microtask, non qui: siamo dentro il commit di React.
      this.#announce = true;
      this.docInputChanged();
    }
    this.#view.scrollDOM.addEventListener('scroll', () => this.#onScroll(), { passive: true, signal });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Come lo smontaggio di Editor.tsx: la sessione conserva testo, selezione e cronologia per la vista dopo.
    const view = this.#view;
    if (!view) return;
    this.saveSession(view.state);
    view.destroy();
    this.#view = null;
  }

  protected docInputChanged(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  /** Gli effetti di Editor.tsx nel loro ordine: documento nuovo e sua selezione, ripristino, sola lettura. */
  #flush(): void {
    const view = this.#view;
    if (!view) return;
    if (this.#applied.resetKey !== this.resetKey) {
      view.setState(EditorState.create(this.docConfig()));
      this.#applied.resetKey = this.resetKey;
      this.#applied.readOnly = this.readOnly;
      this.#announce = true;
    }
    if (this.#announce) {
      this.#announce = false;
      emit(this, 'hmd-selection', { range: mainSelectionRange(view.state) });
    }
    // Non passa da resetKey: la sostituzione resta nella cronologia di annullamento. Una volta sola.
    this.#applied.restore = applyDocRestore(view, this.#applied.restore, this.restore);
    if (this.#applied.readOnly !== this.readOnly) {
      this.#applied.readOnly = this.readOnly;
      view.dispatch({ effects: editable.reconfigure(readOnlyExtensions(this.readOnly)) });
    }
  }

  #onScroll(): void {
    const view = this.#view;
    if (!view || performance.now() < this.#suppressUntil) return;
    const scrollTop = view.scrollDOM.scrollTop;
    const box = view.lineBlockAtHeight(scrollTop);
    emit(this, 'hmd-top-line', { line: topLine(view.state.doc.lineAt(box.from).number, box, scrollTop) });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-editor': HmdEditor;
  }
}
```

`src/elements/editor/editor.css`:

```css
@layer components {
  @scope (hmd-editor) {
    :scope {
      display: contents;
    }

    :scope > .editor {
      height: 100%;
      overflow: hidden;
    }

    /* Lo stesso valore lo mette il tema di docExtensions (stile di CodeMirror, fuori dai layer). */
    :scope > .editor > .cm-editor {
      height: 100%;
    }
  }
}
```

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: `import { HmdEditor } from './editor/editor.element';` dopo l'import di `HmdConflictBar`, e `['hmd-editor', HmdEditor],` dopo `['hmd-conflict-bar', HmdConflictBar],`.

`src/elements/events.ts`, in testa:

```ts
import type { ChangeDesc } from '@codemirror/state';

import type { TextRange } from '../ai/selectionChip';
import type { GenParams } from '../ai/types';
```

in `HmdEvents`, dopo `'hmd-conflict'`:

```ts
  /** Editor e lato documento del diff: testo cambiato (`changes` e `before` per la proposta AI, `after` da salvare). */
  'hmd-doc-change': CustomEvent<{ changes: ChangeDesc; before: string; after: string }>;
```

il commento di `'hmd-top-line'` diventa:

```ts
  /**
   * Riga sorgente (0-based, frazionaria) in cima al pannello, per lo scroll sincronizzato (anteprima ed
   * editor). Va ascoltato sull'elemento che lo manda, mai su un antenato comune: risale da entrambi.
   */
```

e subito dopo `'hmd-top-line'`:

```ts
  /** Editor e lato documento del diff: selezione principale cambiata (null se vuota), per il chip del composer AI. */
  'hmd-selection': CustomEvent<{ range: TextRange | null }>;
```

`src/elements/jsx.d.ts`: import

```ts
import type { DocSession } from '../editor/docSession';
import type { RestoreCommand } from '../editor/restoreCommand';
import type { DocTitle } from '../search/searchIndex';
import type { SaveImage } from './editor/docElement';
import type { HmdEditor } from './editor/editor.element';
```

(ognuno accanto agli import della stessa cartella), dopo il tipo `HmdProps`:

```ts
/** Il documento aperto, comune a hmd-editor e hmd-ai-diff-pane (HmdDocElement), più gli eventi propri `E`. */
export type HmdDocProps<E extends keyof HmdEvents = never> = HmdProps<
  {
    text: string; resetKey: string; session: DocSession; restore: RestoreCommand | null; readOnly: boolean;
    getDocs: () => DocTitle[]; saveImage: SaveImage; i18n: I18nStore;
  },
  'hmd-doc-change' | 'hmd-selection' | E
>;
```

e in `IntrinsicElements`, dopo `'hmd-conflict-bar'`:

```ts
      'hmd-editor': HmdDocProps<'hmd-top-line'> & { ref?: Ref<HmdEditor> };
```

- [ ] **Step 5: Il documento della revisione AI senza `EditorProps`**

`src/ui/ai/reviewDoc.ts`:

```ts
import type { ChangeDesc } from '@codemirror/state';

import type { TextRange } from '../../ai/selectionChip';
import type { DocSession } from '../../editor/docSession';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';

/** Il documento aperto come lo riceve la revisione AI, per l'editor semplice e per il lato documento del diff. */
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
```

`src/editor/refDocHost.ts` (file intero, ora da `ReviewDoc`):

```ts
import type { RefObject } from 'react';

import type { ReviewDoc } from '../ui/ai/reviewDoc';
import type { DocHost } from './docExtensions';
import type { Translate } from './formatToolbar';

/**
 * Ponte temporaneo: le props di DiffPane.tsx, lette dal ref a ogni uso, come DocHost.
 * Sparisce con DiffPane.tsx (fase 5b, Task 5).
 */
export function refDocHost(ref: RefObject<ReviewDoc & { t: Translate }>): DocHost {
  return {
    resetKey: () => ref.current.resetKey,
    readOnly: () => ref.current.readOnly,
    session: () => ref.current.session,
    t: () => ref.current.t,
    getDocs: () => ref.current.getDocs(),
    saveImage: (file) => ref.current.saveImage(file),
    docChanged: (changes, texts) => ref.current.docChanged(changes, texts),
    selectionChanged: (range) => ref.current.selectionChanged(range),
  };
}
```

In `src/ui/ai/DiffPane.tsx` (resta React fino al Task 5):
- togliere `import type { EditorProps, EditorHandle } from '../../editor/Editor';`, aggiungere dopo l'import di `styles` `import type { ReviewDoc } from './reviewDoc';`;
- `export interface DiffHandle extends EditorHandle { next():void; previous():void; }` → `export interface DiffHandle { scrollToLine(line:number):void; focus():void; getView():EditorView|null; replace(text:string):void; next():void; previous():void; }`;
- in `Props`, `editor:EditorProps;` → `editor:ReviewDoc;`;
- `const session=props.editor.session!;` → `const session=props.editor.session;`;
- `callbacks.current.onSelection?.(mainSelectionRange(m.a.state));` → `callbacks.current.selectionChanged(mainSelectionRange(m.a.state));`;
- `readOnlyExtensions(props.editor.readOnly??false)` → `readOnlyExtensions(props.editor.readOnly)`.

- [ ] **Step 6: `ReviewView.tsx` monta `hmd-editor`**

In `src/ui/ai/ReviewView.tsx`:
- togliere `import { Editor, type EditorHandle, type EditorProps } from '../../editor/Editor';`; `import { useT } from '../../i18n/I18nProvider';` → `import { useI18nStore, useT } from '../../i18n/I18nProvider';`; aggiungere `import type { HmdEvents } from '../../elements/events';`, `import type { HmdEditor } from '../../elements/editor/editor.element';` e `import type { ReviewDoc } from './reviewDoc';`;
- in `Props`, `editor: EditorProps & { path: string };` → `editor: ReviewDoc;`;
- dopo `const t = useT();`: `const i18nStore = useI18nStore();`;
- `const plain = useRef<EditorHandle>(null);` → `const plain = useRef<HmdEditor>(null);`;
- prima di `const accept = () => {`:

```tsx
  // Le stesse proprietà per l'editor semplice e per il lato documento del diff.
  const docProps = {
    text: editor.text,
    resetKey: editor.resetKey,
    session: editor.session,
    restore: editor.restore,
    readOnly: editor.readOnly,
    getDocs: editor.getDocs,
    saveImage: editor.saveImage,
    i18n: i18nStore,
    'onhmd-doc-change': (event: HmdEvents['hmd-doc-change']) => editor.docChanged(event.detail.changes, event.detail),
    'onhmd-selection': (event: HmdEvents['hmd-selection']) => editor.selectionChanged(event.detail.range),
  };
```

- nei due rami dell'editor semplice, `<Editor ref={plain} {...editor} />` → `<hmd-editor ref={plain} {...docProps} />`.

`<DiffPane … editor={editor} …/>` resta com'è: riceve già un `ReviewDoc`.

- [ ] **Step 7: `WorkspaceView.tsx` monta `hmd-editor`**

In `src/ui/WorkspaceView.tsx`:
- togliere `import { Editor, type EditorHandle } from '../editor/Editor';`; dopo `import type { SettingsSection } from '../lib/route';` aggiungere `import type { HmdEditor } from '../elements/editor/editor.element';`;
- `const editorRef = useRef<EditorHandle>(null);` → `const editorRef = useRef<HmdEditor>(null);`;
- dopo `const readBlob = useCallback(…);`: `const saveImage = useCallback((file: File) => workspace.saveImage(file, file.name), [workspace]);`;
- al posto di `<ReviewView controller={ai} editor={{ … onTopLine: () => {}, onSelection }} />`:

```tsx
        {doc && shownMode === 'ai' && ai ? (
          <ReviewView
            controller={ai}
            editor={{
              path: doc.path,
              text: doc.text,
              resetKey: `${doc.path}#${doc.revision}`,
              session,
              restore: doc.restore,
              readOnly: state.updating,
              getDocs,
              saveImage,
              docChanged: (changes, texts) => {
                ai.documentChanged(doc.path, changes, false, texts);
                workspace.edit(texts.after);
              },
              selectionChanged: onSelection,
            }}
          />
        ) : doc ? (
```

- al posto di `<Editor ref={editorRef} … onSelection={onSelection} />` nella sezione `pane.editor`:

```tsx
                <hmd-editor
                  ref={editorRef}
                  text={doc.text}
                  resetKey={`${doc.path}#${doc.revision}`}
                  session={session}
                  restore={doc.restore}
                  readOnly={state.updating}
                  getDocs={getDocs}
                  saveImage={saveImage}
                  i18n={i18nStore}
                  onhmd-doc-change={(event) => {
                    ai?.documentChanged(doc.path, event.detail.changes, false, event.detail);
                    workspace.edit(event.detail.after);
                  }}
                  onhmd-selection={(event) => onSelection(event.detail.range)}
                  onhmd-top-line={(event) => {
                    if (shownMode === 'split') previewRef.current?.scrollToLine(event.detail.line);
                  }}
                />
```

L'ordine delle chiamate resta quello di oggi (`documentChanged` prima di `edit`). L'effetto del ripristino in coda (`!editorRef.current`) funziona com'è: il ref è l'elemento, presente appena montato.

- [ ] **Step 8: Via `Editor.tsx`, controlli**

```bash
git rm src/editor/Editor.tsx src/editor/Editor.module.css
grep -rnE "editor/Editor['\"]|EditorHandle|EditorProps|Editor\.module\.css|onImage[=:(]|onTopLine|canChange|Callbacks\b" src e2e; test $? -eq 1 && echo "nessun riferimento"
grep -rn "onhmd-top-line" src
```

Expected: «nessun riferimento» (uscita 1 di `grep`; con 2 il comando è fallito: ripeterlo); il secondo `grep` trova **due** righe, entrambe in `WorkspaceView.tsx`, una su `<hmd-editor` e una su `<hmd-preview` (mai su un contenitore).

- [ ] **Step 9: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/editor/editor.dom.test.ts   # 13 pass
npm test                     # 757 + 13 = 770
npm run lint
npm run test:e2e             # editor, editor-session, formatting, history, external, sync-scroll, focus-ring, ai-review, ai-diff, visual
npx playwright test -c e2e/playwright.config.ts e2e/editor.spec.ts e2e/editor-session.spec.ts e2e/sync-scroll.spec.ts e2e/history.spec.ts --repeat-each=5
npm run test:e2e:dev         # «Ctrl+Z that brings the diff back…» passa ancora dal ramo del difetto: DiffPane.tsx è React
npm run test:e2e:audit       # workspace-*, editor-mode, ai-review-empty, history, tooltip-hover, conflict uguali
```

Se l'audit trova differenze, **non toccare i test**: confrontare il CSS con `Editor.module.css` e la struttura con quella di `Editor.tsx`.

- [ ] **Step 10: Commit**

```bash
git add -A src/elements src/editor src/ui
git commit -m "feat: hmd-editor al posto di Editor (sessione, ripristini, sola lettura e scroll sincronizzato invariati)"
```

---

### Task 5: `hmd-ai-diff-pane`

**Files:**
- Create: `src/elements/ai/diff-pane.element.ts`, `src/elements/ai/diff-pane.css`, `src/elements/ai/diff-pane.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/ai/ReviewView.tsx`, `src/ui/ai/ReviewView.module.css`, `e2e/ai-diff.spec.ts`
- Delete: `src/ui/ai/DiffPane.tsx`, `src/editor/refDocHost.ts`

**Interfaces:**
- Consumes: `HmdDocElement`, `SaveImage`, `HmdDocProps`, `ReviewDoc` (Task 4); `rejectChange`, `insideRange`, `controlDisabled`, `ControlAction` (Task 3); `lineNumberFor` (Task 3); `docAppearance`, `editable`, `mainSelectionRange`, `readOnlyExtensions` (Task 2); `countListeners` da `src/testing/countListeners.ts`.
- Produces:
  - `HmdAiDiffPane extends HmdDocElement`: proprietà `proposal: string`, `range: TextRange | null`, `canAccept: boolean`, `streaming: boolean`, `beforeAccept: () => boolean`; metodi `next()`, `previous()`, `scrollToLine(line: number)`, `replace(text: string)`, `focus()`; eventi `hmd-doc-change`, `hmd-selection` (dalla base), `hmd-ai-proposal-edit`, `hmd-ai-all-rejected`.
  - Eventi: `'hmd-ai-all-rejected': CustomEvent<null>`, `'hmd-ai-proposal-edit': CustomEvent<{ text: string }>`.

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/diff-pane.dom.test.ts`:

```ts
import '../../testing/domEnv';
import '../../testing/codemirrorEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorView } from '@codemirror/view';
import { undo, undoDepth } from '@codemirror/commands';
import { StrictMode, createElement, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import '../define';
import { createDocSession } from '../../editor/docSession';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { HmdEvents } from '../events';
import type { HmdAiDiffPane } from './diff-pane.element';

// Una vista di CodeMirror rimasta montata (test fallito a metà) tiene vivo il processo: si smonta sempre.
test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Incolla delle immagini nella vista (jsdom non ha ClipboardEvent né DataTransfer). */
function pasteImages(view: EditorView, ...names: string[]): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const files = names.map((name) => new File(['x'], name, { type: 'image/png' }));
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } });
  view.contentDOM.dispatchEvent(event);
}

/** saveImage finto che resta in attesa finché il test non risponde. */
function slowSave() {
  const saved: string[] = [];
  const pending: ((link: string) => void)[] = [];
  const saveImage = (file: File) => (saved.push(file.name), new Promise<string | null>((resolve) => pending.push(resolve)));
  return { saveImage, saved, pending };
}

function i18nStore() {
  return countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.acceptBlock': 'ACCETTA', 'ai.rejectBlock': 'RIFIUTA' } }),
      persist() {},
    }),
  );
}

interface Options {
  original?: string;
  proposal?: string;
  canAccept?: boolean;
  streaming?: boolean;
  beforeAccept?: () => boolean;
}

/** Diff montato come lo monta ReviewView: documento dalla sessione, proposta a destra. Aspetta il primo disegno. */
async function mount(options: Options = {}) {
  const original = options.original ?? 'A\n\nB\n\nC';
  const { store, listeners } = i18nStore();
  const el = document.createElement('hmd-ai-diff-pane');
  Object.assign(el, {
    text: original,
    resetKey: 'a.md#1',
    session: createDocSession('a.md#1', original),
    restore: null,
    readOnly: false,
    i18n: store,
    proposal: options.proposal ?? 'A2\n\nB\n\nC2',
    range: null,
    canAccept: options.canAccept ?? true,
    streaming: options.streaming ?? false,
    beforeAccept: options.beforeAccept ?? (() => true),
  });
  const events: [keyof HmdEvents, unknown][] = [];
  for (const type of ['hmd-doc-change', 'hmd-selection', 'hmd-ai-proposal-edit', 'hmd-ai-all-rejected'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  document.body.append(el);
  await tick();
  const editors = () => [...el.querySelectorAll<HTMLElement>('.cm-mergeView .cm-editor')].map((dom) => EditorView.findFromDOM(dom)!);
  return {
    el,
    events,
    i18n: store,
    listeners,
    a: () => editors()[0],
    b: () => editors()[1],
    buttons: (action: 'accept' | 'reject') => [...el.querySelectorAll<HTMLButtonElement>(`.cm-merge-revert button[data-action="${action}"]`)],
  };
}

const mousedown = (button: HTMLElement) => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
const key = (button: HTMLElement, name: string) => button.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

test('the tree of DiffPane.tsx: div.diff with the MergeView, two buttons per block with drawn tooltips', async () => {
  const { el, a, b, buttons } = await mount();
  const box = el.firstElementChild!;
  assert.deepEqual([box.localName, box.className, box.firstElementChild!.className], ['div', 'diff', 'cm-mergeView']);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  const revert = el.querySelector('.cm-merge-revert > .revert')!;
  assert.deepEqual([...revert.children].map((button) => [button.localName, button.className, button.getAttribute('type'), button.textContent]), [
    ['button', 'tooltip', 'button', '←'],
    ['button', 'tooltip', 'button', '→'],
  ]);
  assert.deepEqual(buttons('accept').map((button) => [button.getAttribute('aria-label'), button.dataset.tooltip]), [
    [EN_MESSAGES['ai.acceptBlock'], EN_MESSAGES['ai.acceptBlock']],
    [EN_MESSAGES['ai.acceptBlock'], EN_MESSAGES['ai.acceptBlock']],
  ]);
  assert.equal(buttons('reject')[0].getAttribute('aria-label'), EN_MESSAGES['ai.rejectBlock']);
  el.remove();
});

test('accept: beforeAccept first, the block goes into the document, the focus follows it (Ctrl+Z undoes it)', async () => {
  let asked = 0;
  const { el, a, buttons, events } = await mount({ beforeAccept: () => (asked++, true) });
  events.length = 0;
  mousedown(buttons('accept')[0]);
  await tick();
  assert.equal(asked, 1);
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC');
  assert.equal(document.activeElement, a().contentDOM);
  assert.equal(events[0][0], 'hmd-doc-change');
  assert.equal(undo(a()), true);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  el.remove();
});

test('accept refused: nothing happens when it cannot accept or beforeAccept says no', async () => {
  let asked = 0;
  const refused = await mount({ beforeAccept: () => (asked++, false) });
  mousedown(refused.buttons('accept')[0]);
  await tick();
  assert.equal(asked, 1);
  assert.equal(refused.a().state.doc.toString(), 'A\n\nB\n\nC');
  refused.el.remove();
  const blocked = await mount({ canAccept: false, beforeAccept: () => (asked++, true) });
  assert.equal(blocked.buttons('accept')[0].disabled, true);
  mousedown(blocked.buttons('accept')[0]);
  await tick();
  assert.equal(asked, 1);
  assert.equal(blocked.a().state.doc.toString(), 'A\n\nB\n\nC');
  blocked.el.remove();
});

test('keyboard: Enter on accept accepts, Space on reject rejects', async () => {
  const { el, a, b, buttons } = await mount();
  key(buttons('accept')[0], 'Enter');
  await tick();
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC');
  key(buttons('reject')[0], ' ');
  await tick();
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC');
  el.remove();
});

test('reject: the original goes back into the proposal (an edit), focus on it; the last one closes the review', async () => {
  const { el, a, b, buttons, events } = await mount();
  events.length = 0;
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A\n\nB\n\nC2');
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events, [['hmd-ai-proposal-edit', { text: 'A\n\nB\n\nC2' }]]);
  assert.equal(document.activeElement, b().contentDOM);
  assert.equal(undo(b()), true);
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  mousedown(buttons('reject')[0]);
  await tick();
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A\n\nB\n\nC');
  assert.deepEqual(events.at(-1), ['hmd-ai-all-rejected', null]);
  el.remove();
});

test('while generating: proposal read-only, reject disabled and ignored; canAccept switches the accept buttons', async () => {
  const { el, b, buttons } = await mount({ streaming: true, canAccept: false });
  assert.equal(b().state.readOnly, true);
  assert.deepEqual([buttons('accept')[0].disabled, buttons('reject')[0].disabled], [true, true]);
  mousedown(buttons('reject')[0]);
  await tick();
  assert.equal(b().state.doc.toString(), 'A2\n\nB\n\nC2');
  el.streaming = false;
  el.canAccept = true;
  await tick();
  assert.equal(b().state.readOnly, false);
  assert.deepEqual([buttons('accept')[0].disabled, buttons('reject')[0].disabled], [false, false]);
  el.remove();
});

test('a new proposal from outside replaces the right side, outside its history and without an edit event', async () => {
  const { el, b, events } = await mount();
  events.length = 0;
  el.proposal = 'A3\n\nB\n\nC3';
  await tick();
  assert.equal(b().state.doc.toString(), 'A3\n\nB\n\nC3');
  assert.deepEqual(events, []);
  assert.equal(undo(b()), false);
  el.remove();
});

test('late confirmations of edits made here never pull the proposal back (text, cursor, history)', async () => {
  const { el, b, events } = await mount();
  const view = b();
  const typeAtEnd = (char: string) => {
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: char }, selection: { anchor: end + 1 }, userEvent: 'input.type' });
  };
  events.length = 0;
  typeAtEnd('1');
  typeAtEnd('2');
  const typed = 'A2\n\nB\n\nC212';
  const edits = events.map(([, detail]) => (detail as { text: string }).text);
  assert.deepEqual(edits, ['A2\n\nB\n\nC21', typed]);
  const depth = undoDepth(view.state);
  // ReviewView conferma in ritardo, una battuta alla volta, quando l'utente ha già scritto la seconda.
  el.proposal = edits[0];
  await tick();
  assert.equal(view.state.doc.toString(), typed);
  assert.equal(view.state.selection.main.head, typed.length);
  assert.equal(undoDepth(view.state), depth);
  el.proposal = edits[1];
  await tick();
  assert.equal(view.state.doc.toString(), typed);
  assert.equal(undoDepth(view.state), depth);
  assert.equal(events.length, 2);
  // Una proposta nuova da fuori (il modello) sostituisce ancora il lato destro, senza voci nuove nella
  // cronologia (CodeMirror scarta quelle delle battute sostituite, come con DiffPane.tsx).
  el.proposal = 'A3\n\nB\n\nC3';
  await tick();
  assert.equal(view.state.doc.toString(), 'A3\n\nB\n\nC3');
  assert.ok(undoDepth(view.state) <= depth);
  assert.equal(events.length, 2);
  el.remove();
});

test('with a selection range, edits to the proposal outside it are dropped', async () => {
  const { el, b } = await mount({ original: 'keep BAD keep', proposal: 'keep GOOD keep' });
  el.range = { from: 5, to: 9 };
  b().dispatch({ changes: { from: 0, to: 4, insert: 'lost' }, userEvent: 'input.type' });
  assert.equal(b().state.doc.toString(), 'keep GOOD keep');
  b().dispatch({ changes: { from: 5, to: 9, insert: 'FINE' }, userEvent: 'input.type' });
  assert.equal(b().state.doc.toString(), 'keep FINE keep');
  el.remove();
});

test('replace (Accept all) is one undoable transaction on the document; next and previous walk the blocks', async () => {
  const { el, a } = await mount();
  // Cursore all'inizio, sul primo blocco: «successivo» va al blocco di C, «precedente» torna a quello di A.
  el.next();
  assert.equal(a().state.selection.main.head, 'A\n\nB\n\n'.length);
  el.previous();
  assert.equal(a().state.selection.main.head, 0);
  el.replace('A2\n\nB\n\nC2');
  assert.equal(a().state.doc.toString(), 'A2\n\nB\n\nC2');
  assert.equal(undo(a()), true);
  assert.equal(a().state.doc.toString(), 'A\n\nB\n\nC');
  el.remove();
});

test('restore: a transaction on the document (never setState on the MergeView editor)', async () => {
  const { el, a } = await mount();
  const view = a();
  el.restore = { seq: 1, textLf: 'restored' };
  await tick();
  assert.equal(a(), view);
  assert.equal(view.state.doc.toString(), 'restored');
  assert.equal(undo(view), true);
  el.remove();
});

test('a new resetKey recreates the MergeView from the new session and gives the focus back', async () => {
  const { el, a, events } = await mount();
  const old = el.querySelector('.cm-mergeView');
  el.focus();
  assert.equal(document.activeElement, a().contentDOM);
  events.length = 0;
  el.resetKey = 'a.md#2';
  el.session = createDocSession('a.md#2', 'reloaded');
  el.text = 'reloaded';
  await tick();
  assert.notEqual(el.querySelector('.cm-mergeView'), old);
  assert.equal(el.querySelectorAll('.cm-mergeView').length, 1);
  assert.equal(a().state.doc.toString(), 'reloaded');
  assert.equal(document.activeElement, a().contentDOM);
  assert.deepEqual(events, [['hmd-selection', { range: null }]]);
  el.remove();
});

test('a language change relabels the drawn buttons in place; detached, no listener is left', async () => {
  const { el, i18n, listeners, buttons } = await mount();
  const button = buttons('accept')[0];
  await i18n.setLocale('it');
  assert.equal(buttons('accept')[0], button);
  assert.deepEqual([button.getAttribute('aria-label'), button.dataset.tooltip], ['ACCETTA', 'ACCETTA']);
  assert.equal(buttons('reject')[0].getAttribute('aria-label'), 'RIFIUTA');
  el.remove();
  assert.equal(listeners(), 0);
  assert.equal(el.querySelector('.cm-mergeView'), null);
});

test('an image pasted in the document side and still saving when the diff goes away: no link, no further saves', async () => {
  const { el, a } = await mount();
  const session = el.session!;
  const slow = slowSave();
  el.saveImage = slow.saveImage;
  pasteImages(a(), 'one.png', 'two.png');
  el.remove();
  slow.pending[0]('assets/one.png');
  await tick();
  assert.deepEqual(slow.saved, ['one.png']);
  assert.equal(session.textLf, 'A\n\nB\n\nC');
});

test('under React StrictMode the MergeView is not recreated: the focus given by the parent stays', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const { store } = i18nStore();
  function Parent() {
    const ref = useRef<HmdAiDiffPane>(null);
    useEffect(() => ref.current?.focus(), []);
    return createElement('hmd-ai-diff-pane', {
      ref, text: 'A', resetKey: 'a.md#1', session: createDocSession('a.md#1', 'A'), i18n: store, proposal: 'B', canAccept: true, streaming: false,
    });
  }
  flushSync(() => root.render(createElement(StrictMode, null, createElement(Parent))));
  await tick();
  assert.equal(host.querySelectorAll('.cm-mergeView').length, 1);
  assert.equal(document.activeElement, host.querySelector('.cm-mergeView .cm-content'));
  flushSync(() => root.unmount());
  host.remove();
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/diff-pane.dom.test.ts`
Expected: FAIL (tag non definito: nessuna `.cm-mergeView`).

- [ ] **Step 3: L'elemento e il foglio**

`src/elements/ai/diff-pane.element.ts`:

```ts
import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';

import type { TextRange } from '../../ai/selectionChip';
import { el } from '../../dom/el';
import { docAppearance, editable, mainSelectionRange, readOnlyExtensions } from '../../editor/docExtensions';
import { initialRestoreSeq } from '../../editor/restoreCommand';
import { applyDocRestore } from '../../editor/useDocBinding';
import { HmdDocElement } from '../editor/docElement';
import { lineNumberFor } from '../editor/editorLogic';
import { emit } from '../events';
import { controlDisabled, insideRange, rejectChange, type ControlAction } from './diffLogic';
import './diff-pane.css';

const LABEL: Record<ControlAction, 'ai.acceptBlock' | 'ai.rejectBlock'> = { accept: 'ai.acceptBlock', reject: 'ai.rejectBlock' };

/**
 * Diff della revisione AI (era DiffPane.tsx): MergeView con il documento a sinistra (a, dalla sessione:
 * stesse estensioni e stessi eventi di hmd-editor) e la proposta a destra (b). Regola: mai `setState`
 * sull'editor posseduto da MergeView; i ripristini passano da una transazione su `a`. Un documento nuovo
 * (`resetKey`) ricrea la MergeView e, se il focus era dentro, lo ridà alla vista nuova.
 * Per blocco: ← accetta (lo applica la libreria, `revertControls: 'b-to-a'`; il focus va su `a` perché
 * Ctrl+Z lo annulli), → rifiuta (l'originale torna in `b`, focus su `b`; l'ultimo rifiutato chiude).
 */
export class HmdAiDiffPane extends HmdDocElement {
  #proposal = '';
  #range: TextRange | null = null;
  #canAccept = false;
  #streaming = true;
  #beforeAccept: () => boolean = () => false;

  #box: HTMLDivElement | null = null;
  #merge: MergeView | null = null;
  #rightEditable = new Compartment();
  /** La proposta arriva da fuori: la sua transazione su `b` non è una modifica dell'utente. */
  #remote = false;
  /**
   * Testi mandati con `hmd-ai-proposal-edit` e non ancora tornati come `proposal`, dal più vecchio. Il
   * ritorno di uno di questi (anche in ritardo, dopo altre battute) è una conferma, non una proposta nuova:
   * il lato destro non si tocca.
   */
  #echoes: string[] = [];
  /** Ciò che la MergeView mostra già (gli effetti di DiffPane.tsx scattavano al cambio di questi valori). */
  #applied = { resetKey: '', restore: 0, readOnly: false, proposal: '', canAccept: false, streaming: true };
  #announce = false;
  #scheduled = false;

  /** Testo della proposta (già applicato al documento se la richiesta era su una selezione). */
  get proposal(): string { return this.#proposal; }
  set proposal(value: string) {
    this.#proposal = value ?? '';
    this.docInputChanged();
  }
  /** Tratto della selezione nella proposta: le modifiche a mano fuori da qui si scartano. */
  get range(): TextRange | null { return this.#range; }
  set range(value: TextRange | null) { this.#range = value ?? null; }
  get canAccept(): boolean { return this.#canAccept; }
  set canAccept(value: boolean) {
    this.#canAccept = value ?? false;
    this.docInputChanged();
  }
  /** Generazione in corso (o selezione persa): proposta in sola lettura, niente rifiuti. */
  get streaming(): boolean { return this.#streaming; }
  set streaming(value: boolean) {
    this.#streaming = value ?? true;
    this.docInputChanged();
  }
  /** Chiamata al `mousedown` di «accetta»: false ferma l'accettazione (fotografia «prima dell'AI» compresa). */
  get beforeAccept(): () => boolean { return this.#beforeAccept; }
  set beforeAccept(value: () => boolean) { this.#beforeAccept = value ?? (() => false); }

  next(): void {
    if (this.#merge) goToNextChunk(this.#merge.a);
  }

  previous(): void {
    if (this.#merge) goToPreviousChunk(this.#merge.a);
  }

  /** Porta in vista la riga sorgente `line` (0-based) del documento (avvisi della revisione). */
  scrollToLine(line: number): void {
    const a = this.#merge?.a;
    if (a) a.dispatch({ effects: EditorView.scrollIntoView(a.state.doc.line(lineNumberFor(line, a.state.doc.lines)).from) });
  }

  /** «Accetta tutto»: il testo intero con una transazione sul documento (annullabile con Ctrl+Z). */
  replace(text: string): void {
    const a = this.#merge?.a;
    if (a) a.dispatch({ changes: { from: 0, to: a.state.doc.length, insert: text }, userEvent: 'input.ai' });
  }

  focus(): void {
    this.#merge?.a.focus();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'diff' }));
    if (!this.#merge) {
      this.#create();
      this.#applied.restore = initialRestoreSeq(this.restore);
    }
    // Cambio di lingua: etichette dei pulsanti dei blocchi già disegnati.
    if (this.i18n) this.watch(this.i18n, () => this.#refreshControls(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#destroy();
  }

  protected i18nChanged(): void {
    this.reconnect();
  }

  protected docInputChanged(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  #create(): void {
    this.#merge = new MergeView({
      parent: this.#box!,
      a: this.docConfig(),
      b: {
        doc: this.#proposal,
        extensions: [
          basicSetup,
          EditorState.transactionFilter.of((tr) => (this.#remote || !tr.docChanged || insideRange(tr.changes, this.#range) ? tr : [])),
          docAppearance(),
          this.#rightEditable.of(readOnlyExtensions(this.#streaming)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || this.#remote) return;
            const text = update.state.doc.toString();
            this.#echoes.push(text);
            emit(this, 'hmd-ai-proposal-edit', { text });
          }),
        ],
      },
      revertControls: 'b-to-a',
      renderRevertControl: () => this.#controls(),
    });
    this.#echoes = [];
    Object.assign(this.#applied, {
      resetKey: this.resetKey, readOnly: this.readOnly, proposal: this.#proposal, canAccept: this.#canAccept, streaming: this.#streaming,
    });
    // Lo stato creato dalla sessione non passa dall'updateListener: la selezione si annuncia nel microtask.
    this.#announce = true;
    this.docInputChanged();
  }

  #destroy(): void {
    const merge = this.#merge;
    if (!merge) return;
    this.saveSession(merge.a.state);
    merge.destroy();
    this.#merge = null;
  }

  /** Gli effetti di DiffPane.tsx nel loro ordine: documento nuovo, proposta, sola lettura e pulsanti, ripristino. */
  #flush(): void {
    let merge = this.#merge;
    if (!merge) return;
    if (this.#applied.resetKey !== this.resetKey) {
      const hadFocus = merge.a.hasFocus || merge.b.hasFocus;
      this.#destroy();
      this.#create();
      merge = this.#merge!;
      if (hadFocus) merge.a.focus();
    }
    if (this.#announce) {
      this.#announce = false;
      emit(this, 'hmd-selection', { range: mainSelectionRange(merge.a.state) });
    }
    if (this.#applied.proposal !== this.#proposal) {
      this.#applied.proposal = this.#proposal;
      const echo = this.#echoes.indexOf(this.#proposal);
      if (echo >= 0) {
        // Conferma di una modifica fatta qui: si dimenticano lei e quelle prima, il lato destro è già più avanti.
        this.#echoes.splice(0, echo + 1);
      } else if (merge.b.state.doc.toString() !== this.#proposal) {
        // Proposta nuova da fuori (modello, documento cambiato sotto una selezione): sostituisce il lato destro.
        this.#echoes = [];
        this.#remote = true;
        try {
          merge.b.dispatch({ changes: { from: 0, to: merge.b.state.doc.length, insert: this.#proposal }, annotations: Transaction.addToHistory.of(false) });
        } finally {
          this.#remote = false;
        }
      }
    }
    const applied = this.#applied;
    if (applied.readOnly !== this.readOnly || applied.streaming !== this.#streaming || applied.canAccept !== this.#canAccept) {
      Object.assign(applied, { readOnly: this.readOnly, streaming: this.#streaming, canAccept: this.#canAccept });
      merge.a.dispatch({ effects: editable.reconfigure(readOnlyExtensions(this.readOnly)) });
      merge.b.dispatch({ effects: this.#rightEditable.reconfigure(readOnlyExtensions(this.#streaming)) });
      this.#refreshControls();
    }
    applied.restore = applyDocRestore(merge.a, applied.restore, this.restore);
  }

  /** Due pulsanti per blocco, creati dalla MergeView quando disegna il blocco (renderRevertControl). */
  #controls(): HTMLElement {
    const accept = this.#button('←', 'accept');
    const reject = this.#button('→', 'reject');
    const box = el('div', { class: 'revert' }, accept, reject);
    accept.addEventListener('mousedown', (event) => {
      if (!this.#canAccept || !this.#beforeAccept()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // La libreria applica il blocco subito dopo, sul documento: il focus va lì perché Ctrl+Z lo annulli.
      queueMicrotask(() => this.#merge?.a.focus());
    });
    accept.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && this.#canAccept) {
        event.preventDefault();
        accept.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }
    });
    const onReject = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#reject(Number(box.dataset.chunk));
    };
    reject.addEventListener('mousedown', onReject);
    reject.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') onReject(event);
    });
    return box;
  }

  #button(glyph: string, action: ControlAction): HTMLButtonElement {
    const label = this.translator()(LABEL[action]);
    return el(
      'button',
      {
        type: 'button',
        class: 'tooltip',
        dataset: { tooltip: label, action },
        'aria-label': label,
        disabled: controlDisabled(action, { canAccept: this.#canAccept, streaming: this.#streaming }),
      },
      glyph,
    );
  }

  /** Stato ed etichette dei pulsanti già disegnati (la MergeView li ricrea solo quando cambiano i blocchi). */
  #refreshControls(): void {
    const t = this.translator();
    for (const button of this.#box?.querySelectorAll<HTMLButtonElement>('.cm-merge-revert button') ?? []) {
      const action = button.dataset.action as ControlAction;
      button.disabled = controlDisabled(action, { canAccept: this.#canAccept, streaming: this.#streaming });
      const label = t(LABEL[action]);
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
    }
  }

  /** Rifiuto di un blocco: il testo originale torna nella proposta (verso opposto a quello della libreria). */
  #reject(index: number): void {
    const merge = this.#merge;
    const chunk = merge?.chunks[index];
    if (!merge || !chunk || this.#streaming) return;
    merge.b.dispatch({ changes: rejectChange(merge.a.state, merge.b.state, chunk), userEvent: 'revert' });
    // Focus sulla proposta: Ctrl+Z annulla il rifiuto (è nella cronologia di b).
    if (merge.chunks.length === 0) emit(this, 'hmd-ai-all-rejected', null);
    else merge.b.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-diff-pane': HmdAiDiffPane;
  }
}
```

`src/elements/ai/diff-pane.css`:

```css
@layer components {
  @scope (hmd-ai-diff-pane) {
    :scope {
      display: contents;
    }

    :scope > .diff {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }

    .cm-mergeView {
      height: 100%;
    }

    .cm-editor {
      min-width: 0;
    }

    /* Controlli per blocco: ← accetta, → rifiuta, uno sotto l'altro nella colonna centrale del diff. */
    .cm-merge-revert > .revert {
      position: absolute;
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    /*
     * @codemirror/merge inietta `.cm-merge-revert button { position: absolute; background: none;
     * cursor: pointer; … }` fuori da ogni layer, e uno stile fuori dai layer vince su ogni regola
     * normale di un layer. Le proprietà in comune si dichiarano !important: dentro un layer,
     * !important vince sugli stili normali fuori dai layer (prima vinceva la specificità del CSS Module).
     */
    .cm-merge-revert > .revert > button {
      position: static !important;
      padding: 2px 0;
      border-radius: 4px;
      color: var(--c-muted);
    }

    .cm-merge-revert > .revert > button:hover:not(:disabled) {
      background: var(--c-accent-soft) !important;
      color: var(--c-text);
    }

    .cm-merge-revert > .revert > button:disabled {
      opacity: 0.35;
      cursor: default !important;
    }
  }
}
```

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: `import { HmdAiDiffPane } from './ai/diff-pane.element';` dopo l'import di `HmdAiChatLog`, e `['hmd-ai-diff-pane', HmdAiDiffPane],` dopo `['hmd-ai-chat-log', HmdAiChatLog],`.

`src/elements/events.ts`, in testa a `HmdEvents`:

```ts
  /** Diff della revisione AI: rifiutato l'ultimo blocco rimasto (equivale a scartare la proposta). */
  'hmd-ai-all-rejected': CustomEvent<null>;
```

e dopo `'hmd-ai-open-file'`:

```ts
  /** Diff della revisione AI: proposta modificata a mano (anche da un rifiuto), testo intero del lato destro. */
  'hmd-ai-proposal-edit': CustomEvent<{ text: string }>;
```

`src/elements/jsx.d.ts`: `import type { TextRange } from '../ai/selectionChip';` accanto a `../ai/types`, `import type { HmdAiDiffPane } from './ai/diff-pane.element';` accanto a `./ai/aiChips`, e in `IntrinsicElements` dopo `'hmd-ai-chat-log'`:

```ts
      'hmd-ai-diff-pane': HmdDocProps<'hmd-ai-proposal-edit' | 'hmd-ai-all-rejected'> &
        HmdProps<{ proposal: string; range: TextRange | null; canAccept: boolean; streaming: boolean; beforeAccept: () => boolean }> & {
          ref?: Ref<HmdAiDiffPane>;
        };
```

- [ ] **Step 5: `ReviewView.tsx` monta il tag**

In `src/ui/ai/ReviewView.tsx`:
- togliere `import { DiffPane, type DiffHandle } from './DiffPane';`; aggiungere `import type { HmdAiDiffPane } from '../../elements/ai/diff-pane.element';`;
- `const diff = useRef<DiffHandle>(null);` → `const diff = useRef<HmdAiDiffPane>(null);`;
- `const range = p?.scope ? { … } : undefined;` → `… : null;`;
- al posto di `<DiffPane … />`:

```tsx
      <hmd-ai-diff-pane
        ref={diff}
        {...docProps}
        range={range}
        proposal={text}
        canAccept={controller.canAccept(p)}
        streaming={streaming}
        beforeAccept={() => controller.beforeAccept(p)}
        onhmd-ai-proposal-edit={(event) => edit(event.detail.text)}
        onhmd-ai-all-rejected={() => controller.discard(p.path)}
      />
```

Le etichette `ai.acceptBlock`/`ai.rejectBlock` le legge l'elemento dallo store (`i18n` arriva con `docProps`).

In `src/ui/ai/ReviewView.module.css` cancellare `.diff`, `.diff :global(.cm-mergeView)`, `.diff :global(.cm-editor)`, `.diff :global(.cm-content)`, il commento dei controlli per blocco e le quattro regole `.diff :global(.cm-merge-revert) .revert…` (righe 98–139 di oggi). `.editor`, `.hint`, `.stream` e le regole di `ReviewBar` restano.

In `e2e/ai-diff.spec.ts`, nel test «Ctrl+Z that brings the diff back…»: il blocco `if (failOnConsole) { … } else { … }` diventa la sola riga `await expect(documentSide(app)).toBeFocused();`, e `failOnConsole` esce dalla firma (`async ({ app, page }) => {`). Da qui l'asserzione del focus vale **anche** in sviluppo: è la correzione chiesta dalla spec (fase 5, StrictMode). Provato sul prototipo: 117/117 in sviluppo.

- [ ] **Step 6: Via `DiffPane.tsx` e il ponte, controlli**

```bash
git rm src/ui/ai/DiffPane.tsx src/editor/refDocHost.ts
grep -rnE "DiffPane['\"]|DiffHandle|refDocHost|styles\.(diff|revert)\b|acceptLabel|rejectLabel|onAllRejected|onEdit\b" src/ui/ai src/editor src/elements e2e; test $? -eq 1 && echo "nessun riferimento"
grep -rn "from 'react'" src/editor; test $? -eq 1 && echo "editor/ senza React"
```

Expected: «nessun riferimento» e «editor/ senza React» (uscita 1; con 2 ripetere). Il primo `grep` non guarda il resto di `src/ui`: `HistoryPanel.tsx` ha un suo `styles.diff`.

- [ ] **Step 7: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/diff-pane.dom.test.ts   # 15 pass
npm test                     # 770 + 15 = 785
npm run lint
npm run test:e2e             # ai-review, ai-diff, ai-chips, ai-chat-log, visual AI review
npx playwright test -c e2e/playwright.config.ts e2e/ai-review.spec.ts e2e/ai-diff.spec.ts --repeat-each=5
npm run test:e2e:dev         # «Ctrl+Z that brings the diff back…» ora passa
npx playwright test -c e2e/dev.config.ts e2e/ai-review.spec.ts e2e/ai-diff.spec.ts --repeat-each=3
npm run test:e2e:audit       # ai-review, ai-review-hover, ai-review-conflict, ai-review-empty uguali alla baseline
```

Se l'audit trova differenze sui pulsanti dei blocchi, **non toccare i test**: controllare quali proprietà collidono con il foglio di `@codemirror/merge` (`node_modules/@codemirror/merge/dist/index.js`, `externalTheme`) prima di aggiungere un `!important`.

- [ ] **Step 8: Commit**

```bash
git add -A src/elements src/editor src/ui e2e/ai-diff.spec.ts
git commit -m "feat: hmd-ai-diff-pane al posto di DiffPane (Ctrl+Z su accetta e rifiuta invariato, focus anche con StrictMode)"
```

---

### Task 6: Documenti, misure, chiusura

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1 (prototipo: 435 345)
npm test                                    # annotare: 785
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: «fase 5a in `main` (merge del 09/10, dal branch `feat/web-components`); fasi 5b–8 ancora piano» → «fase 5a in `main` (merge del 09/10, dal branch `feat/web-components`); fase 5b sul branch `feat/web-components`, in `main` al merge della sotto-fase; fasi 6–8 ancora piano».
2. §5.1, il punto delle uscite: «oppure callback passate come proprietà dove l'evento non serve ad altri (es. `onImage` dell'editor, che restituisce una Promise).» → «oppure callback passate come proprietà dove l'evento non serve ad altri (es. `saveImage` dell'editor, che restituisce una Promise). Il nome di una callback-proprietà non comincia mai con `on`: React 19 tratta ogni prop funzione `on…` di un custom element come un listener dell'evento omonimo, anche se la proprietà esiste (misurato nella fase 5b).»
3. §7 «Fase 5», prima riga: «Divisa in due piani: 5a (piano 8: scheda del frontmatter, anteprima, chat AI), 5b (editor e diff, CodeMirror).» → «Divisa in due piani: 5a (piano 8: scheda del frontmatter, anteprima, chat AI), 5b (piano 9: editor e diff, CodeMirror).»
4. In fondo a §7 fase 5, dopo il punto «5a **fatta**»: «- 5b **fatta**: `hmd-editor` (`scrollToLine()`, `focus()`; eventi `hmd-doc-change`, `hmd-selection`, `hmd-top-line`) e `hmd-ai-diff-pane` (`next()`, `previous()`, `scrollToLine()`, `replace()`, `focus()`; eventi `hmd-ai-proposal-edit`, `hmd-ai-all-rejected`) sulla base comune `HmdDocElement` (`editor/docElement.ts`: proprietà del documento, `saveImage`, sessione da cui è nata la vista); `resetKey`, ripristino, sola lettura e proposta applicati in un microtask nell'ordine degli effetti di React; `docExtensions.ts` su `DocHost`, senza React; logica in `editor/editorLogic.ts` e `ai/diffLogic.ts`; aiuto di test `codemirrorEnv.ts`. StrictMode non ricrea più le viste: corretto il focus perso in sviluppo quando Ctrl+Z fa ricomparire il diff; la MergeView ricreata da un `resetKey` nuovo ridà il focus alla vista nuova. Non portati `canChange` (nessun chiamante), `getView` e `replace` dell'editor, il ref `refocus` della fase 3. Echi delle modifiche alla proposta riconosciuti (una conferma in ritardo non riporta indietro il lato destro); immagini salvate dopo la fine della vista scartate (plugin `lifecycle`). Pulsanti dei blocchi: tre proprietà `!important` dentro `@layer components` contro il foglio fuori dai layer di `@codemirror/merge`; etichette aggiornate al cambio di lingua. Audit esteso a modalità editor, revisione senza proposta, pulsanti dei blocchi al passaggio e disattivati. Bundle principale gzip: <valore del Task 1> → <valore dello Step 1> B.» (sostituire i due valori con i numeri annotati).
5. §8.2, in fondo al paragrafo «Limiti di jsdom 30.1.1…»: «CodeMirror e MergeView girano in jsdom con `src/testing/codemirrorEnv.ts` (`requestAnimationFrame`, `Window` globale, rettangoli dei Range a zero; fase 5b); altezze e scroll veri li verifica Playwright.»
6. §13: aggiungere `docs/superpowers/plans/2026-10-09-housemd-wc-09-fase-5b-editor-e-diff.md` (fase 5b) dopo il piano 8.

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
git commit -m "docs: spec allineato alla fase 5b (editor e diff)"
```

- [ ] **Step 5: Chiusura (controller, non l'implementer)**

Nell'ordine: review finale dell'intero diff del branch rispetto a `main`; `/codex-review-chat` sul diff; checklist manuale (Step 6); solo con tutto pulito, merge in `main` e push:

```bash
cd /home/davidedipumpo/Projects/housemd && git status --short   # pulito
git merge --no-ff feat/web-components -m "Merge: fase 5b Web Components (editor e diff)"
npm test && npm run lint
git push origin main
cd ../housemd-wc && git merge --ff-only main && git push origin feat/web-components
```

- [ ] **Step 6: Checklist manuale** (Chrome, server di sviluppo del worktree, porta 5173, quindi con StrictMode; cartella di prova con sottocartelle, immagini, frontmatter, wikilink). Le schede aperte da Claude in Chrome sono `visibilityState: hidden`: niente `requestAnimationFrame` (CodeMirror non misura) e uno `scrollTop` scritto da script non manda eventi `scroll`. Lo scroll si prova **solo con la rotella del mouse**, mai con `scrollTop`; se la scheda resta nascosta, i punti 3 e 4 li prova Davide in una finestra visibile.
  1. Editor: digitazione, autosalvataggio, `Ctrl+S`, incolla e trascina un'immagine vera, autocompletamento `[[`.
  2. Barra di formattazione sulla selezione, pulsanti e scorciatoie (Ctrl+B, Ctrl+I, Ctrl+Shift+X, Ctrl+E, Ctrl+Shift+K); dopo un cambio di lingua la barra parla la lingua nuova.
  3. Scroll sincronizzato in split nei due versi con la rotella, senza rimbalzi; in modalità editor l'anteprima non c'è e nulla si rompe.
  4. Cambio file: Ctrl+Z non passa da un file all'altro; modifica esterna ricaricata (Ctrl+Z non torna al testo vecchio); conflitto con ricarica e sovrascrittura.
  5. Cronologia: ripristino dalla vista divisa e dalla sola anteprima, annullabile con Ctrl+Z.
  6. AI: chip della selezione da vista divisa, modalità editor ed editor della modalità AI; «Ignora la selezione».
  7. Revisione: accetta e rifiuta per blocco con il mouse e con la tastiera (Tab fino ai pulsanti, Invio e Spazio), tooltip al passaggio e al focus, Ctrl+Z dopo ognuno; ultimo blocco rifiutato che chiude la revisione; proposta modificata a mano; richiesta su una selezione (le modifiche fuori dal tratto non entrano); Successivo/Precedente; un avviso che porta alla riga.
  8. «Accetta tutto» → Ctrl+Z (il diff ricompare con il focus nel documento) → Ctrl+Shift+Z (torna l'editor), **in sviluppo**: era il difetto di StrictMode.
  9. Cambio di lingua con il diff aperto: etichette e tooltip dei pulsanti dei blocchi nella lingua nuova.
  10. Tastiera e screen reader: ordine del focus nella revisione, focus ring sui pulsanti dei blocchi, `forced-colors`; tema chiaro, scuro e automatico.
