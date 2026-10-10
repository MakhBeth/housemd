# HouseMD Web Components — Piano 10: fase 6a, pannelli del workspace (albero, ricerca, cronologia)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element i tre pannelli del workspace che non toccano l'AI: `hmd-file-tree` (era `ui/FileTree.tsx`), `hmd-search-panel` (era `ui/SearchPanel.tsx`) e `hmd-history-panel` (era `ui/HistoryPanel.tsx`), con aspetto e comportamento invariati, tranne il focus quando il nodo che lo ha sparisce (decisione 3).

**Architecture:** Stesso schema di 4c–5b: classe `Hmd<Nome>` su `HmdElement`, host con `display: contents`, DOM interno identico a quello di React (stesse classi, stessi attributi, anche i nodi dentro le cartelle chiuse e le voci del menu mai aperto), foglio `@layer components { @scope (hmd-…) { … } }` con i valori dei moduli, ingressi come proprietà JS, uscite come `CustomEvent` di `src/elements/events.ts`. Niente CodeMirror né effetti da ordinare: i setter disegnano subito (come `hmd-toasts`), con un solo punto d'ingresso `#update()` per elemento e un flag `#rendering` che rimanda alla fine del render in corso un render chiesto da dentro (un listener sincrono, un `focus()`); il lavoro asincrono si scarta se superato o dopo il distacco (`listHistory`), oppure si sospende e riparte al ricollegamento (la pausa della ricerca). La logica nuova sta in moduli puri accanto all'elemento (`treeView.ts`, `searchView.ts`, `historyView.ts`), quella esistente resta dov'è (`ui/treeNav.ts`, `ui/tree.ts`, `file-tree/treeState.ts`, `search-panel/segments.ts`, `history/diffRows.ts`).

**Tech Stack:** TypeScript 7, React 19.3 (solo in `WorkspaceView`), Custom Elements, CSS `@scope`/`@layer`, Popover API, `<details>`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, §3.1 cartelle `elements/file-tree/`, `elements/search-panel/`, `elements/history-panel/`, §4.1–4.2, §5.1–5.2, §7 «Fase 6», §8.2–8.4, §9 punti 5, 6, 11, 14, §10 R1–R3, R11, R13, §11).

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza = `main` = `cb691a6`, fasi 0–5b fatte). Regola del 05/10 (spec §7): a fine piano, con suite verdi, review finale pulita, `/codex-review-chat` sul diff e checklist provata in Chrome, **il controller** fa merge in `main` e push (anche del branch). Gli implementer non fanno merge né push.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da questo branch **prima di qualsiasi modifica all'app**, conteggi dei test e gzip del bundle principale annotati. `dist-baseline/` non si ricostruisce più fino alla fine del piano.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera: un nuovo snapshot o una rigenerazione solo con approvazione di Davide); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/`. Unica eccezione voluta: la decisione 3 (focus su un bersaglio stabile), che non cambia l'aspetto.
- **Un task per elemento**, sempre TDD: test jsdom che fallisce → logica pura + elemento + foglio → registrazione in `define.ts`, eventi in `events.ts`, tipi in `jsx.d.ts` → `WorkspaceView.tsx` monta il tag → `.tsx` e `.module.css` cancellati con `git rm`, poi `grep -r` (uscita 1 = nessuna occorrenza, il risultato giusto; 2 = comando fallito, da ripetere).
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri testati senza DOM), DOM solo con `el()` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts` (in ordine alfabetico), ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal` (i listener sui nodi creati dall'elemento muoiono con i nodi: `on` di `el()`).
- Cartelle: `src/elements/file-tree/` (radice `hmd-file-tree`), `src/elements/search-panel/` (`hmd-search-panel`), `src/elements/history-panel/` (`hmd-history-panel`): tutte ammesse dalla regola generale di `architecture.test.ts`, nessuna eccezione nuova.
- **`HmdElement.watch()` esegue subito la funzione**: niente render o timer ridondanti in fondo a `connect()`; **nessun evento si emette dentro `connect`** (siamo nel commit di React).
- **Nessun callback DOM rientra in un render in modo sincrono** (il crash della 4c: `focusout` durante `reconcileList` → `NotFoundError`, React smonta tutto). In tutti e tre gli elementi **ogni** render passa da `#update()`: setter, `watch`, gestori `focusin`/`toggle`/`keydown`/`click`/`input`, timer della pausa, risposta di `listHistory`, apertura del menu ⋯ (che cambia lo stato e chiama `#update()`, il quale disegna anche il menu). Nessun `#render…()` chiamato direttamente fuori da `#update()`. Se un render è già in corso (`#rendering`), `#update()` segna `#again` e il render si ripete alla fine, mai annidato: lo provano test jsdom che, imitando il `focusout` sincrono di Chromium alla rimozione del nodo con il focus (`focusoutOnRemove`), cambiano stato **durante** `reconcileList` (Task 2 e 3). Il `focusin` dell'albero durante un render aggiorna solo `#focused`: i tab stop si ricalcolano in fondo al render. Lo stato si salva **prima** di emettere (`#act` legge il nodo del menu prima di `emit`): un listener che nel frattempo cambia le proprietà non lo corrompe (test jsdom nel Task 2).
- **Niente di asincrono su un elemento che non c'è più, ma niente lavoro perso se torna**: la pausa della ricerca si annulla al distacco (e il callback controlla `isConnected`); se era in corso, o se `index`/`indexRevision` cambiano da staccato, `#pending` la fa ripartire quando lo **stesso** elemento si ricollega (`src/dom/element.ts`: il ciclo di vita è ricollegabile), non a `reconnect()` per un cambio di lingua. Una risposta di `listHistory` arrivata dopo il distacco, dopo un cambio di file o di `workspace` (anche a `null`) o dopo una richiesta più nuova si scarta: `#request` si incrementa nei setter di `path` e `workspace` e al distacco, indipendentemente dal fatto che parta un'altra richiesta (mai dentro `#reload`, che gira a ogni notifica e annullerebbe richieste valide). Un `requestAnimationFrame` che mette il focus su un nodo staccato non fa nulla (Chromium).
- **Il campo di ricerca è dell'elemento**: la query non è una proprietà (non arriva da fuori, quindi nessun eco tardivo può sovrascriverla), il campo si crea una volta e l'elemento non ne scrive mai il valore tranne con Esc. Un nodo con il focus non si ricrea mai: righe dell'albero, risultati e versioni per chiave con `reconcileList`; «Ripristina» e la nota del diff riusati; il menu ⋯ per chiave (le voci restano anche a menu aperto). Le righe del diff della cronologia si ricostruiscono solo quando cambiano elenco, versione scelta o `currentText` (come `useMemo` di React): una notifica qualsiasi del workspace non toglie una selezione fatta nel diff e non ricalcola `diffRows`. **Se il nodo con il focus sparisce, il focus va a un bersaglio stabile** (decisione 3): albero → riga col tab stop; ricerca → il campo; cronologia → la versione scelta, altrimenti «Chiudi». **Se nessuna riga può prendere il focus** (eliminato l'ultimo file, o restano solo asset), l'albero non lo sposta: resta dove lo ha lasciato il dialog, come oggi; nessun bersaglio nuovo (un `tabindex` sul `nav` cambierebbe il DOM e mostrerebbe un anello nello stato «nessun file»).
- **React 19 e i custom element** (misurato nelle fasi 4–5): ogni prop funzione `on*` diventa un listener → le uscite sono eventi `hmd-*` (`emit` di `events.ts`, con `bubbles: true`); gli ingressi sono proprietà con nomi che non cominciano per `on`. Al montaggio React assegna tutte le proprietà prima di inserire l'elemento (`connectedCallback` le trova già); negli aggiornamenti le assegna in sequenza nell'ordine del JSX; StrictMode non stacca né ricollega i custom element. `hmd-open` lo mandano ora sia `hmd-preview` sia `hmd-file-tree`: si ascolta **solo sul tag che lo manda** (`onhmd-open` sul tag), mai su un antenato comune.
- **jsdom 30**: mancano `moveBefore`, `showModal`/`closedBy`, Popover (stub `src/testing/popoverStub.ts`; `matches(':popover-open')` dà sempre `false`), `ToggleEvent` (nei test: `Object.assign(new Event('toggle'), { newState: 'closed' })`), `requestAnimationFrame` (coda a mano nel test, come `chat-log.dom.test.ts`), `CSS.escape`, Anchor Positioning. L'evento `toggle` di `<details>` c'è ed è asincrono. Che `moveBefore` conservi il focus si verifica solo in Chromium: e2e «a focused result that moves up…» del Task 1 (spec §8.2; senza `moveBefore` fallisce, misurato).
- Testi solo da `t()` (store i18n); **nessuna chiave nuova**. Tooltip mai con `title` (`.tooltip` + `data-tooltip` + `aria-label`, come oggi).
- Le regole e2e di `CLAUDE.md` valgono: localizzatori per ruolo e nome accessibile con i testi di `en.json`, mai classi CSS dell'app (attributi come `[tabindex="0"]` e i tag `summary` sì, come in `tree.spec.ts`); `test:e2e:dev` fallisce su qualsiasi errore o avviso in console; `expectedConsole` solo per diagnostiche esatte (in questo piano nessuna); nessuna richiesta di rete vera; dove conta un timer dell'app, `page.clock` **con `pauseAt`** (con `install` da solo il tempo scorre anche da sé: misurato); un e2e sospetto di instabilità si prova con `--repeat-each=5`.
- **Un difetto noto si afferma, non si nasconde**: niente `test.fail`. I tre test del Task 1 sul focus perso affermano il comportamento di oggi (focus sul `body`) e li rovesciano i Task 2, 3 e 4.
- Dialog solo con le funzioni di `src/elements/dialogs/` (l'albero non ne apre: manda `hmd-tree-action`, e `WorkspaceView` chiama `runTreeDialog` come oggi); File System Access API solo in `src/fs/fsaOps.ts` e `src/fs/access.ts`; le operazioni del `Workspace` restano quelle pubbliche di oggi (`openFile`, `restoreVersion`, `listHistory`), che passano già dalla coda `runExclusive` dove serve. `workspace/` non cambia.
- **Mai giudicare un comando di verifica dal suo output filtrato.** I `grep` di controllo sono ricorsivi (`-r`), si lanciano dopo il `git rm` e distinguono l'uscita 1 dalla 2.
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale (`test:`, `feat:`, `docs:`), nessuna riga di attribuzione.


## Misure prese scrivendo il piano (10/10, su `cb691a6`)

Baseline: `npm test` = **788** test verdi; `npm run test:e2e` = **132** test (`tree` 17, `search` 3, `history` 4, `external` 8, `focus-ring` 4, `visual` 14…); `npm run test:e2e:dev` = **117**; audit = **34** stati (68 test, `baseline` + `current`); bundle principale gzip = **435 509 B** (build di `cb691a6`: stesso file `index-DOXynNby.js` della `dist/` del worktree; il valore 435 435 dell'handover non torna con la build).

**Prototipo.** Il codice dei Task 1–4 è stato provato su una copia del repository fuori dal worktree (`git worktree add --detach ../housemd-proto-6a cb691a6`, niente commit): `npm run lint` pulito; `npm test` 788 → **841** (+20 Task 2, +17 Task 3, +16 Task 4, dopo la review di Codex); `npm run test:e2e` 132 → **155** (+23 del Task 1: `tree-rows` 9, `search-live` 9, `history-live` 5), snapshot invariati; `npm run test:e2e:dev` 117 → **140**; audit 68 → **84** (8 stati nuovi), uguale alla baseline dopo l'albero e dopo tutti e tre gli elementi; i tre file e2e nuovi ripetuti 3–5 volte senza instabilità, e nella forma del Task 1 `--repeat-each=3` verdi sull'app React (anche in sviluppo); bundle gzip 435 509 → **436 849 B** (+1 340: React resta, i tre componenti diventano elementi). Misurato anche:

- **Oggi il focus cade sul `body`** quando sparisce il nodo che lo ha: file eliminato o rinominato dal suo menu (il dialog ridà il focus al ⋯, poi la riga sparisce), risultato di ricerca che non corrisponde più, «Ripristina» che sparisce perché dopo il ripristino il testo è identico. I test del Task 1 lo affermano sull'app React; con la decisione 3 i Task 2–4 li rovesciano.
- **`moveBefore` conserva il focus in Chromium** (spec §8.2): l'e2e «a focused result that moves up…» passa con `hmd-search-panel` e fallisce se si toglie `Element.prototype.moveBefore` con uno script iniziale (con React passa perché React sposta l'altra riga). Nell'albero le righe esistenti non si riordinano mai con il focus dentro (l'ordine cambia solo con la lingua, che si sceglie dalle impostazioni): lo copre la ricerca.
- **Instabilità estranea alla 6a**: nell'ultima esecuzione completa di `npm run test:e2e` è fallito una volta `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog» (impostazioni, ancora React, non toccate qui), verde da solo e `--repeat-each=10`. Se ricapita durante l'esecuzione: ripetere quel file e annotarlo nel ledger, senza correggerlo in questo piano.
- **Review di Codex del piano (10/10), cinque rilievi accettati e provati sul prototipo**, ciascuno con un test jsdom (`npm test` 832 → **841**; e2e dei file di albero, ricerca e cronologia verdi in build e in sviluppo, 47 + 47; audit 84 senza differenze): (F1) due render saltavano la guardia `#rendering`: `hmd-search-panel` non aveva `#update()` e l'apertura del menu ⋯ chiamava `#renderMenu` diretto; un `focusout` sincrono durante la rimozione di un nodo con il focus, con un listener che cambia lo stato, lasciava l'elenco dei risultati visibile con la query vuota e il menu di una cartella sotto l'ancora di un file → tutto passa da `#update()` (test «a listener that empties the query from a focusout…» e «a listener that opens another menu from a focusout…», che falliscono senza la correzione; «a listener that changes the nodes from a focusout…» passava già e resta come rete); (F2) le righe del diff si ricostruivano a ogni notifica del workspace, togliendo una selezione fatta nel diff e ricalcolando `diffRows` → diff memorizzato per elenco, scelta e testo (test «a workspace notification that changes nothing keeps the diff rows…», che fallisce senza); (F3) con l'albero senza righe focalizzabili il focus resta dov'è: comportamento di oggi, ora definito e provato (test «deleting the last file leaves no tab stop…», nessun codice nuovo, quindi passa già); (F4) con `workspace = null` e un cambio di `path` la risposta vecchia mostrava le versioni di un file sotto il titolo di un altro → `#request++` nei setter di `path` e `workspace` (test «a request still pending when the workspace goes away…», che fallisce senza; «…when the workspace changes…» passava già e resta come rete); (F5) staccato prima dei 120 ms e ricollegato, il pannello non cercava più, e un `indexRevision` cambiato da staccato si perdeva → `#pending` (test «typed, detached before the pause and attached again…» e «a new index revision while detached…», che falliscono senza).
- **Trovato nel prototipo e corretto nel piano**: (1) un `<button>` ha già `tabIndex` 0, quindi scrivere la proprietà solo se cambia lasciava i file senza l'attributo `tabindex="0"` (che `tree.spec.ts` conta): l'elemento scrive sempre l'attributo (`toggleAttr`), come `tabIndex={…}` di React; (2) l'e2e della pausa di 120 ms con solo `page.clock.install()` passava per caso su React e falliva 5 volte su 5 con l'elemento (il tempo scorre da sé): serve `pauseAt`; (3) con React il menu ⋯ mai aperto contiene già «Rinomina» ed «Elimina» (nascosti), e l'audit vede anche i nodi nascosti, come quelli dentro le cartelle chiuse: l'elemento li disegna tutti; (4) `key` su un tag `hmd-*` non è ammesso dai tipi JSX (gli `IntrinsicAttributes` non valgono per i tag intrinseci): `& { key?: Key }` in `jsx.d.ts`.

### Inventario

**`src/ui/FileTree.tsx`** (182 righe) + `FileTree.module.css` (138)
- Props: `nodes: TreeNode[]`, `openPath: string | null`, `drafts: ReadonlySet<string>`, `onOpen(path)`, `onAction(action, node | null)`. Nessun ref verso l'esterno. Hook: `useT`, `useState` (`expanded`, `menuNode`, `focused`), `useRef` (menu, ancora, mappa delle righe), `useMemo` (`visibleItems`, `byPath`), due `useEffect` (`[openPath]` → `revealPath`; `[menuNode]` → listener `toggle` del menu).
- DOM: `nav.tree[aria-label]` > `ul.list` (o `p.emptyDir` «nessun file») + `div.menu[popover=auto]`. Cartella: `li > details[open] > summary.row` (icona aperta/chiusa, icona cartella, `span.name`, pulsante ⋯) + `ul.list` dei figli o `p.emptyDir` «cartella vuota». File: `li > div.row[data-active] > button.file[aria-current=page]` (icona, nome, pallino della bozza `span.draft.tooltip[role=img]`) + ⋯. Asset: `li > div.row.asset` (icona immagine o generica, nome), senza pulsante né menu. React disegna **tutti** i nodi, anche dentro le cartelle chiuse.
- Tastiera: **c'è già** quello che la spec §7 chiede (`ui/treeNav.ts`, dal v1.1): un solo tab stop (`tabStop`: riga col focus, poi file aperto, poi prima riga; `tabindex` scritto su tutte le righe, `-1` sui ⋯), frecce/Home/End/destra/sinistra (`treeKey`), Shift+F10 e tasto Menu aprono il menu. Il focus di riga si segue con `onFocus` (che per una cartella scatta anche dal ⋯ dentro il `<summary>`).
- Menu: pulsante ⋯ (`data-menu-trigger`, `.menuButton.tooltip`, `aria-label`/`data-tooltip` «Azioni per {name}») → `anchor-name: --housemd-tree-menu, --tooltip-anchor` scritto a mano sul pulsante (tolto dal precedente), `showPopover()` se chiuso, focus sulla prima voce in un `requestAnimationFrame`. Voci per tipo: cartella «Nuovo file, Nuova cartella, Rinomina, Elimina», file «Cronologia, Rinomina, Elimina» (senza nodo: «Rinomina, Elimina»), `.danger` su Elimina. Una voce chiude il menu (`hidePopover`) e chiama `onAction`. Chiuso il menu con il focus perso (sul `body` o ancora nel menu), il focus torna sulla riga d'origine. Il clic destro non apre nulla.
- I dialog **non** stanno nell'albero: `WorkspaceView.onTreeAction` → `dialogFor` → `runTreeDialog` (`elements/workspace/treeDialogs.ts`, fase 4b) o apertura della cronologia. Il dialog ridà il focus al pulsante che l'ha aperto (il ⋯).
- Logica pura già estratta: `ui/tree.ts` (`buildTree`, `ancestorsOf`), `ui/treeNav.ts`, `elements/file-tree/treeState.ts` (`toggleExpanded`, `revealPath`), `elements/workspace/dialogFor.ts` (`TreeAction`, ri-esportato oggi da `FileTree.tsx`). Test: `tree.test.ts`, `treeNav.test.ts`, `treeState.test.ts`, `dialogFor.test.ts`, `treeDialogs.dom.test.ts`; e2e `tree.spec.ts` (17: dialog, menu, tastiera, un solo tab stop), `external.spec.ts`, `visual` (`workspace-*`, `tree-menu`), audit `workspace-*`, `tree-menu`, `confirm-dialog`. **Scoperti**: pallino della bozza, asset, «cartella vuota» e «nessun file», cartella richiusa dopo l'apertura automatica, tab stop che segue il focus, ⋯ di una cartella che non la apre, cambio di lingua, focus dopo eliminazione o rinomina; audit di righe con bozza/asset/cartella vuota, passaggio del mouse, focus da tastiera.

**`src/ui/SearchPanel.tsx`** (68 righe, `forwardRef` verso l'`<input>`) + `SearchPanel.module.css` (67)
- Props: `index: SearchIndex`, `indexRevision: number`, `onOpen(path, terms)`. Ref: l'`<input>` stesso (`WorkspaceView` chiama `searchRef.current?.focus()` in un `requestAnimationFrame` per Ctrl+K). Stato: `query` (solo interno), `results`.
- Effetto `[query, index, indexRevision]`: `setTimeout(120)` → `index.search(query)`. Invio cerca subito sulla query corrente e apre il primo risultato; Esc svuota. Elenco `ul.results[aria-label]` solo con `query.trim()`: «nessun risultato» (`li.none`) quando i risultati (anche quelli **di prima**, finché la pausa non finisce) sono zero, altrimenti `li > button.result > span.title + span.path + span.snippet` con `segments()` → `<mark>`.
- Smontato con la sidebar nascosta e in modalità AI: la query riparte vuota.
- Logica pura: `elements/search-panel/segments.ts`, `search/searchIndex.ts`, `search/fold.ts`. Test: `segments.test.ts`, `searchIndex.test.ts`, `fold.test.ts`; e2e `search.spec.ts` (3), `external.spec.ts` (un file nuovo compare nella ricerca), `focus-ring.spec.ts`, `formatting.spec.ts`; audit `focus-search-*`. **Scoperti**: la pausa di 120 ms, scrivere veloce, un indice nuovo con la query già scritta, Tab + Invio su un risultato, Invio senza risultati, lingua, sidebar nascosta e riaperta, risultato con il focus che sparisce o si sposta; audit dei risultati, del passaggio del mouse, di «nessun risultato».

**`src/ui/HistoryPanel.tsx`** (99 righe) + `HistoryPanel.module.css` (107)
- Props: `workspace`, `path`, `currentText`, `onRestore(id)`, `onClose()`. Montato con `key={doc.path}` (cambio di file = pannello nuovo). Hook: `useI18n` (`t`, `locale`), `useWorkspaceState` (si ridisegna a ogni cambio del workspace; usa `indexRevision`), `useState` (`versions: Snapshot[] | null`, `selected`), `useMemo` (`diffRows`).
- Effetti: `[path]` → elenco e scelta azzerati; `[workspace, path, indexRevision]` → `listHistory(path)` con flag `alive` (una risposta superata si scarta).
- DOM: `div.panel` > `header.header` (`h2.title` «Cronologia di {path}», `button.close.tooltip` con icona) + `p.note` «nessuna versione» (solo con elenco vuoto) + `ul.list[aria-busy]` (`li.note` «caricamento…» oppure `button.version[aria-pressed]` con data relativa e motivo) + `section.diff` (`p.note` «scegli una versione» | «identica» | legenda + `pre.lines` di `span.line[data-kind]` + `button.restore`).
- Ripristino: `WorkspaceView.restoreVersion` → `workspace.restoreVersion(id)` (transazione dell'editor, annullabile); dalla sola anteprima passa alla vista divisa e ripristina dopo (`queuedRestore`). Non cambia.
- Logica pura: `history/diffRows.ts` (`diffRows`, `isIdentical`), `i18n/i18n.ts` (`formatRelative`). Test: `diffRows.test.ts`, `historyStore.test.ts`, `policy.test.ts`; e2e `history.spec.ts` (4), `tree.spec.ts` (voce Cronologia), `visual` `history`, audit `history`. **Scoperti**: cambio di file con il pannello aperto, salvataggio con il pannello aperto, diff che segue il testo, testo identico, cronologia vuota, lingua, focus dopo «Ripristina»; audit della cronologia vuota e identica.

**Gli altri sei (fasi 6b e 6c, solo per la divisione).** `ai/ModelSelect.tsx` (76: elenco dei modelli caricato a popover aperto da `controller.provider(profile).listModels`, campo libero; CSS in `Composer.module.css`), `ai/ModelChip.tsx` (140: chip con popover `auto`, `useId`, nota privacy, contiene `ModelSelect` e `hmd-ai-parameters`; `Composer.module.css`), `ai/Composer.tsx` (109, `forwardRef` con `sendPreset`: `composerKeys`, chip della selezione, invio/stop; contiene `ModelChip` e `hmd-ai-effort-chip`; `Composer.module.css`), `ai/AiSidebar.tsx` (58: testata, `hmd-ai-chat-log`, `Composer`, `hmd-ai-suggestions` che chiama `composer.sendPreset`; `AiSidebar.module.css`), `ai/ReviewBar.tsx` (102: `reviewStatus`, popover degli avvisi con `useId`, sei callback; CSS in `ReviewView.module.css`), `ai/ReviewView.tsx` (169: sceglie tra `hmd-editor` e `hmd-ai-diff-pane`, focus nel passaggio, «Accetta tutto», «Scarta» con `showConfirmDialog`, timer dei secondi; `ReviewView.module.css`).

### Divisione

Tre piani, ciascuno con un sottoalbero chiuso e i suoi moduli CSS interi:

- **6a (questo piano)**: `hmd-file-tree`, `hmd-search-panel`, `hmd-history-panel`. Nessuna dipendenza reciproca né con l'AI, ciascuno ha il suo modulo CSS; il rischio sta nel focus e nelle liste (R2), non nella rete o nelle chiavi.
- **6b**: `hmd-ai-model-select` → `hmd-ai-model-chip` → `hmd-ai-composer` → `hmd-ai-sidebar`. Correzione dell'ipotesi di partenza: `ModelSelect`, `ModelChip` e `Composer` condividono `Composer.module.css` e vanno insieme (o il modulo andrebbe spezzato a metà); `AiSidebar` (58 righe) entra qui perché contiene solo il composer, il registro e i suggerimenti, e così `sendPreset` diventa un dettaglio interno invece di un ref attraverso il confine React. È la sotto-fase con le regole AI (§10 R21: `listModels` passa da `ai/providers`, chiavi mai in attributi).
- **6c**: `hmd-ai-review-bar` + `hmd-ai-review`. Anche qui un modulo condiviso (`ReviewView.module.css` serve a entrambi) e un solo chiamante della barra (`ReviewView`); è la parte più delicata (focus tra `hmd-editor` e `hmd-ai-diff-pane`, Ctrl+Z, dialog di «Scarta»), da sola. **Nel piano della 6c va corretto il difetto preesistente di `ReviewView`**: dopo un «Accetta tutto» completo, «Scarta» rimonta `hmd-editor` a un altro indice e il focus finisce sul `body`; serve un test che lo affermi (Task 1 della 6c) e lo rovesci. Non si tocca nella 6a.

Ordine della 6a: rete (Task 1) → albero (Task 2: il più grande, fissa lo schema di render sincrono e il focus stabile) → ricerca (Task 3) → cronologia (Task 4) → documenti e chiusura (Task 5). Gli elementi sono indipendenti: tra un task e l'altro l'app funziona con quelli rimasti in React.

### Decisioni (da confermare con Davide; tra parentesi la raccomandazione)

1. **Divisione in 6a/6b/6c come sopra** (sì): rispetto all'ipotesi di partenza `ReviewBar` passa alla 6c e `AiSidebar` alla 6b, per non spezzare `Composer.module.css` e `ReviewView.module.css`.
2. **Ingressi e uscite** (sì): `hmd-file-tree` riceve `nodes`, `openPath`, `drafts`, `i18n` e manda `hmd-open` `{ path }` (lo stesso evento dell'anteprima, già previsto dalla spec §5.1) e `hmd-tree-action` `{ action, node }`; `hmd-search-panel` riceve `index` (interfaccia `SearchSource`), `indexRevision`, `i18n`, ha `focusInput()` e manda `hmd-search-open` `{ path, terms }` (evento a sé: porta i termini da evidenziare, che `hmd-open` non ha); `hmd-history-panel` riceve `workspace` (interfaccia minima `HistorySource`: `subscribe`, `getState().indexRevision`, `listHistory`), `path`, `currentText`, `i18n` e manda `hmd-history-restore` `{ id }` e `hmd-history-close`.
3. **Focus su un bersaglio stabile quando il nodo che lo ha sparisce** (sì): oggi cade sul `body` (misurato); dopo, nell'albero va sulla riga col tab stop (dopo un'eliminazione il file aperto, dopo una rinomina la riga rinominata), nella ricerca torna nel campo, nella cronologia va sulla versione scelta (altrimenti su «Chiudi»). Se nell'albero non resta nessuna riga che possa prendere il focus (eliminato l'ultimo file), l'elemento non lo sposta: resta dove lo lascia il dialog, come oggi (test jsdom «deleting the last file leaves no tab stop…»). È la lezione delle fasi 4–5 e la spec R2; non cambia l'aspetto (audit e snapshot invariati). Per la fedeltà stretta si tolgono le tre righe «hadFocus» degli elementi e si lasciano i test del Task 1 nella forma di oggi.
4. **`key={doc.path}` resta su `hmd-history-panel`** (sì): come oggi, un cambio di file crea un pannello nuovo. L'elemento gestisce comunque un cambio di `path` (elenco e scelta azzerati, richiesta nuova; test jsdom) per quando, nella fase 7, il montaggio non sarà più di React.
5. **Comportamenti di oggi della ricerca conservati** (sì): finché la prima pausa non finisce l'elenco mostra «nessun risultato» (i risultati sono ancora quelli vuoti di prima), durante la pausa restano i risultati della query precedente, e la query riparte vuota quando la sidebar si nasconde o si entra in modalità AI (il pannello si smonta). Cambiarli sarebbe un ritocco da decidere a parte.

## Review Focus

1. **Focus nell'albero da tastiera e dopo i dialog**: un solo tab stop che segue il focus (anche tornando con Shift+Tab), Shift+F10 e ⋯ con il focus nel menu, Esc o clic fuori che lo riportano alla riga, un dialog che lo ridà al ⋯, una riga con il focus eliminata o rinominata che lo passa alla riga col tab stop. Senza righe focalizzabili il focus non si sposta. Test jsdom del Task 2 («arrows move the focus…», «menu closed with the focus lost…», «the row with the focus disappears…», «deleting the last file leaves no tab stop…», «a listener that opens another menu from a focusout…») + `tree.spec.ts` + `tree-rows.spec.ts` («the tab stop follows…», «deleting…», «renaming…»).
2. **Il campo di ricerca mentre si scrive e mentre arrivano indici nuovi**: mai ricreato né riscritto, nessun carattere perso, focus che resta; un risultato con il focus che si sposta in cima lo tiene (`moveBefore`), uno che sparisce lo ridà al campo. Test jsdom del Task 3 («a new index revision searches again…», «result rows are reused by path…», «the focused result disappears…», «a listener that empties the query from a focusout…») + `search-live.spec.ts` («typing quickly…», «a file that starts matching…», «a focused result that moves up…»).
3. **Lavoro asincrono tardivo**: una pausa della ricerca che scade dopo il distacco (sidebar nascosta, modalità AI) non cerca né disegna; risposte di `listHistory` fuori ordine, dopo un cambio di file o dopo il distacco si scartano. Una pausa interrotta dal distacco riparte se lo stesso elemento torna. Test jsdom del Task 3 («a pending search after detaching…», «typed, detached before the pause and attached again…») e del Task 4 («a request still pending when the workspace goes away…», «a late answer…», «an answer arriving after detaching…») + `search-live.spec.ts` («the sidebar hidden and shown again…»).
4. **La cronologia con l'editor che cambia sotto**: il diff segue il testo mentre si scrive, «Ripristina» resta lo stesso nodo (e con lui il focus) finché c'è un diff, un salvataggio aggiunge la versione in cima, un cambio di file mostra l'altro file. Una notifica del workspace che non cambia nulla non tocca le righe del diff (né una selezione fatta lì). Test jsdom del Task 4 («the diff follows the current text…», «a workspace notification that changes nothing…», «a save reloads the list…») + `history-live.spec.ts` + `history.spec.ts` (ripristino annullabile anche dalla sola anteprima).
5. **Aspetto identico negli stati che oggi nessuno fotografa**: righe con bozza, asset, cartella vuota, passaggio del mouse (⋯ visibile), focus da tastiera su una cartella, risultati con `<mark>`, passaggio su un risultato, «nessun risultato», cronologia vuota e identica, voci del menu mai aperto. Stati di audit del Task 1, verdi contro `dist-baseline/` nei Task 2–4.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/tree-rows.spec.ts`, `e2e/search-live.spec.ts`, `e2e/history-live.spec.ts`, `e2e/computed-styles.audit.ts` | Rete di sicurezza: comportamenti scoperti dei tre pannelli, focus perso (forma di oggi, rovesciata nei Task 2–4), `moveBefore`; 8 stati di audit nuovi. |
| `src/elements/file-tree/treeView.ts` (+ test) | `menuActions`, `MENU_LABELS`, `nodeKey`, `nodesByPath`. |
| `src/elements/file-tree/file-tree.element.ts`, `file-tree.css` (+ `.dom.test.ts`) | `hmd-file-tree`. |
| `src/elements/search-panel/searchView.ts` (+ test) | `SEARCH_DEBOUNCE_MS`, `searchItems`, `searchItemKey`. |
| `src/elements/search-panel/search-panel.element.ts`, `search-panel.css` (+ `.dom.test.ts`) | `hmd-search-panel`, `SearchSource`. |
| `src/elements/history-panel/historyView.ts` (+ test) | `MARK`, `versionItems`, `versionItemKey`, `diffView`. |
| `src/elements/history-panel/history-panel.element.ts`, `history-panel.css` (+ `.dom.test.ts`) | `hmd-history-panel`, `HistorySource`. |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi (`hmd-tree-action`, `hmd-search-open`, `hmd-history-restore`, `hmd-history-close`; `hmd-open` anche dall'albero), tipi JSX. |
| `src/ui/WorkspaceView.tsx` | Monta i tre tag; `TreeAction` da `dialogFor`; `searchRef.current?.focusInput()`. |
| `src/ui/FileTree.tsx`, `FileTree.module.css`, `SearchPanel.tsx`, `SearchPanel.module.css`, `HistoryPanel.tsx`, `HistoryPanel.module.css` | Cancellati. |
| `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` | Stato, §7 fase 6, §8.2, §13 (Task 5). |

---

### Task 1: Baseline e rete di sicurezza sui pannelli di oggi

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**.

**Files:**
- Create: `e2e/tree-rows.spec.ts`, `e2e/search-live.spec.ts`, `e2e/history-live.spec.ts`
- Modify: `e2e/computed-styles.audit.ts` (8 stati nuovi)

**Interfaces:**
- Produces: i test «deleting the file whose row has the focus: where the focus goes», «renaming the open file from its row: where the focus goes» (Task 2), «a result that disappears while it has the focus: where the focus goes» (Task 3), «after Restore the button disappears (identical text): where the focus goes» (Task 4), che affermano il focus sul `body` di oggi e che i task indicati rovesciano; gli stati di audit `tree-rows`, `tree-row-hover`, `tree-focus-keyboard`, `search-results`, `search-result-hover`, `search-none`, `history-empty`, `history-identical`.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short && git log --oneline -1       # pulito, cb691a6 o il commit del piano
npm test                                          # annotare (10/10: 788)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (10/10: 435 509)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 6a
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla**.

- [ ] **Step 2: E2e dell'albero scoperti oggi**

`e2e/tree-rows.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
import { messagesFor } from './support/i18n.ts';

/** La riga di una cartella è il <summary> del suo <details> (come in tree.spec.ts). */
const folderRow = (app: App, name: string) => app.tree().locator('summary').filter({ hasText: name });
const actions = (app: App, name: string) => app.page.getByRole('button', { name: app.t('tree.actions', { name }) });

test('a file left with unsaved changes (autosave off) shows the draft mark', async ({ app, page }) => {
  await page.addInitScript(() => localStorage.setItem('housemd:autosave', JSON.stringify({ mode: 'off', delayMs: 1000 })));
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B' });
  await app.openFile('a.md');
  await app.typeAtEnd(' edited');
  await app.openFile('b.md');
  await expect(app.treeFileWithDraft('a.md')).toBeVisible();
  await expect(app.tree().getByRole('img', { name: app.t('tree.draft') })).toHaveCount(1);
});

test('an empty folder says so; a folder without files says there are none', async ({ app, page }) => {
  await app.openFolder({});
  await expect(app.tree().getByText(app.t('tree.noFiles'), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: app.t('folder.new') }).first().click();
  const dialog = page.getByRole('dialog', { name: app.t('folder.new') });
  await dialog.getByRole('textbox').fill('empty');
  await page.keyboard.press('Enter');
  await expect(app.tree().getByText(app.t('tree.noFiles'), { exact: true })).toHaveCount(0);
  await folderRow(app, 'empty').click();
  await expect(app.tree().getByText(app.t('tree.emptyFolder'), { exact: true })).toBeVisible();
});

test('images are listed but cannot be opened and have no menu', async ({ app }) => {
  await app.openFolder({ 'a.md': 'A', 'pic.png': { base64: PIXEL_PNG_BASE64 } });
  await expect(app.tree().getByText('pic.png', { exact: true })).toBeVisible();
  await expect(app.treeFile('pic.png')).toHaveCount(0);
  await expect(actions(app, 'pic.png')).toHaveCount(0);
  await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
});

test('opening a nested file reveals its folder; collapsed again, it stays collapsed while editing', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('Guide');
  await box.press('Enter');
  await app.expectOpen('guide.md');
  await expect(app.treeFile('guide.md')).toBeVisible();
  await folderRow(app, 'docs').click();
  await expect(app.treeFile('guide.md')).toBeHidden();
  await app.typeAtEnd(' more');
  await expect(app.saveState('save.saved')).toBeVisible();
  await expect(app.treeFile('guide.md')).toBeHidden();
});

test('the tab stop follows the last focused row, and comes back to it with Shift+Tab', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' });
  await app.openFile('a.md');
  await app.treeFile('a.md').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(app.treeFile('c.md')).toBeFocused();
  await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
  await expect(app.treeFile('c.md')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Tab'); // esce dall'albero (il separatore della sidebar)
  await expect(app.treeFile('c.md')).not.toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(app.treeFile('c.md')).toBeFocused();
});

test('the ⋯ button of a folder opens the menu without opening the folder', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  await actions(app, 'docs').click();
  await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeVisible();
  await expect(app.treeFile('guide.md')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeHidden();
  await expect(app.treeFile('guide.md')).toBeHidden();
});

test('the tree follows the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await app.openFolder({ 'a.md': 'A', 'docs/guide.md': '# Guide' });
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const tree = page.getByRole('navigation', { name: it('tree.label') });
  await expect(tree).toBeVisible();
  await tree.getByRole('button', { name: it('tree.actions', { name: 'docs' }) }).click();
  // Per una cartella la prima voce è «Nuovo file».
  await expect(tree.getByRole('button', { name: it('file.new'), exact: true })).toBeFocused();
  await expect(tree.getByRole('button', { name: it('tree.rename'), exact: true })).toBeVisible();
});

test('deleting the file whose row has the focus: where the focus goes', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B' });
  await app.openFile('a.md');
  await app.treeFile('b.md').focus();
  await page.keyboard.press('Shift+F10');
  await app.tree().getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'b.md' }) });
  await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
  await expect(app.treeFile('b.md')).toHaveCount(0);
  // Difetto di oggi (React): la riga sparisce con il focus e il focus cade sul body. Il Task 2 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('renaming the open file from its row: where the focus goes', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'c.md': 'C' });
  await app.openFile('b.md');
  await app.treeFile('b.md').focus();
  await page.keyboard.press('Shift+F10');
  await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
  await page.keyboard.type('renamed');
  await page.keyboard.press('Enter');
  await app.expectOpen('renamed.md');
  // Difetto di oggi (React): la riga di prima sparisce con il focus e il focus cade sul body. Il Task 2 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});
```

- [ ] **Step 3: E2e della ricerca scoperti oggi**

`e2e/search-live.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const FILES = {
  'alpha.md': '# Alpha\n\nThe quick brown fox jumps.',
  'beta.md': '# Beta\n\nNothing to see here.',
};

const box = (app: App) => app.page.getByRole('searchbox', { name: app.t('search.label') });
const results = (app: App) => app.page.getByRole('list', { name: app.t('search.results') });

test('results wait for the 120 ms pause after the last key', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder(FILES);
  // Tempo fermo: solo runFor lo fa avanzare (con install da solo il tempo scorre anche da sé).
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await box(app).fill('fox');
  await page.clock.runFor(100);
  await expect(results(app).getByRole('button')).toHaveCount(0);
  await page.clock.runFor(30);
  await expect(results(app).getByRole('button')).toHaveCount(1);
});

test('typing quickly keeps every character and the focus in the box', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).click();
  await page.keyboard.type('quick brown');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.keyboard.type(' fox');
  await expect(box(app)).toHaveValue('quick brown fox');
  await expect(box(app)).toBeFocused();
  await expect(results(app).getByRole('button')).toHaveCount(1);
});

test('a file that starts matching while the query is in the box shows up; the box keeps the focus', async ({ app }) => {
  await app.openFolder(FILES);
  await box(app).fill('unicorn');
  await expect(app.page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  await app.writeExternal('fresh.md', '# Fresh\n\nunicorn');
  await app.windowFocus();
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await expect(box(app)).toBeFocused();
  await expect(box(app)).toHaveValue('unicorn');
});

test('a result reached with Tab opens with Enter, with the terms highlighted', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(results(app).getByRole('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await app.expectOpen('alpha.md');
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('housemd-search')?.size ?? 0)).toBeGreaterThan(0);
});

test('Enter with no result opens nothing', async ({ app }) => {
  await app.openFolder(FILES);
  await box(app).fill('zzzzqqq');
  await box(app).press('Enter');
  await expect(app.editorPane()).toHaveCount(0);
  await expect(box(app)).toBeFocused();
});

test('the search box follows the interface language', async ({ app, page }) => {
  const it = (key: string) => translate(messagesFor('it'), key);
  await app.openFolder(FILES);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const search = page.getByRole('searchbox', { name: it('search.label') });
  await expect(search).toHaveAttribute('placeholder', it('search.placeholder'));
  await search.fill('zzzzqqq');
  await expect(page.getByText(it('search.none'), { exact: true })).toBeVisible();
  await search.fill('fox');
  await expect(page.getByRole('list', { name: it('search.results') }).getByRole('button')).toHaveCount(1);
});

test('the sidebar hidden and shown again starts with an empty search', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: app.t('sidebar.hide') }).first().click();
  await expect(box(app)).toHaveCount(0);
  await page.getByRole('button', { name: app.t('sidebar.show') }).click();
  await expect(box(app)).toHaveValue('');
  await expect(results(app)).toHaveCount(0);
});

test('a result that disappears while it has the focus: where the focus goes', async ({ app, page }) => {
  await app.openFolder(FILES);
  await box(app).fill('fox');
  await results(app).getByRole('button').focus();
  await app.removeExternal('alpha.md');
  await app.windowFocus();
  await expect(app.page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  // Difetto di oggi (React): il pulsante sparisce con il focus e il focus cade sul body. Il Task 3 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('a focused result that moves up (the index changed) keeps the focus', async ({ app }) => {
  await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'gamma.md': '# Gamma\n\nAnother fox story.' });
  await box(app).fill('fox');
  await expect(results(app).getByRole('button')).toHaveCount(2);
  // Il secondo risultato (quale dei due lo decide l'indice) diventa il primo dopo una modifica esterna.
  const second = results(app).getByRole('button').last();
  const path = (await second.textContent())!.includes('gamma.md') ? 'gamma.md' : 'alpha.md';
  const moved = results(app).getByRole('button', { name: new RegExp(path.replace('.', '\\.')) });
  await moved.focus();
  await app.writeExternal(path, '# Fox fox fox\n\nfox fox fox fox');
  await app.windowFocus();
  await expect(results(app).getByRole('button').first()).toHaveAccessibleName(new RegExp(path.replace('.', '\\.')));
  // Riordinato da reconcileList con moveBefore (con React spostando l'altra riga): il focus resta.
  await expect(moved).toBeFocused();
});
```

- [ ] **Step 4: E2e della cronologia scoperti oggi**

`e2e/history-live.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test, type App } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

const panel = (app: App) => app.page.getByRole('region', { name: app.t('toolbar.history') });
const versions = (app: App) => panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) });

/** Sostituisce tutto il testo dell'editor e salva con Ctrl+S (una versione nella cronologia). */
async function saveAs(app: App, text: string): Promise<void> {
  await app.editor().click();
  await app.page.keyboard.press('ControlOrMeta+a');
  await app.page.keyboard.type(text);
  await app.page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe(text);
}

/** Due versioni salvate di note.md, «v1» e 6 minuti dopo «v2» (quella aperta), con il pannello aperto. */
async function openWithTwoVersions(app: App, files: Record<string, string> = {}): Promise<void> {
  await app.page.clock.install();
  await app.openFolder({ 'note.md': 'v0', ...files });
  await app.openFile('note.md');
  await saveAs(app, 'v1');
  await app.page.clock.fastForward('06:00');
  await saveAs(app, 'v2');
  await app.page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await expect(versions(app)).toHaveCount(2);
}

test('switching file with the panel open shows the other file, without its versions', async ({ app }) => {
  await openWithTwoVersions(app, { 'other.md': 'O' });
  await app.openFile('other.md');
  await expect(panel(app).getByRole('heading', { name: app.t('history.title', { path: 'other.md' }) })).toBeVisible();
  await expect(panel(app).getByText(app.t('history.empty'))).toBeVisible();
  await expect(versions(app)).toHaveCount(0);
});

test('a save with the panel open adds the new version at the top', async ({ app }) => {
  await openWithTwoVersions(app);
  await app.page.clock.fastForward('06:00');
  await saveAs(app, 'v3');
  await expect(versions(app)).toHaveCount(3);
  await versions(app).first().click();
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
});

test('the diff follows the text being edited', async ({ app, page }) => {
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await expect(panel(app).getByText(app.t('history.legend'))).toBeVisible();
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v1');
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
  await expect(panel(app).getByRole('button', { name: app.t('history.restore') })).toHaveCount(0);
});

test('the history panel follows the interface language', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  // «Chiudi» c'è due volte (impostazioni e cronologia): quello delle impostazioni.
  await page.getByRole('region', { name: it('settings.title') }).getByRole('button', { name: it('settings.close') }).click();
  const region = page.getByRole('region', { name: it('toolbar.history') });
  await expect(region.getByRole('heading', { name: it('history.title', { path: 'note.md' }) })).toBeVisible();
  await expect(region.getByRole('button', { name: it('history.restore') })).toBeVisible();
  await expect(region.getByRole('button', { name: new RegExp(it('history.reason.save')) })).toHaveCount(2);
  await expect(region.getByRole('button', { name: it('history.close') })).toBeVisible();
});

test('after Restore the button disappears (identical text): where the focus goes', async ({ app, page }) => {
  await openWithTwoVersions(app);
  await versions(app).nth(1).click();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.editor()).toHaveText('v1');
  await expect(panel(app).getByText(app.t('history.identical'))).toBeVisible();
  // Difetto di oggi (React): il pulsante sparisce con il focus e il focus cade sul body. Il Task 4 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
});
```

Note per chi esegue:
- Se un **localizzatore** non trova l'elemento sull'app di oggi, si corregge il localizzatore (ruolo e nome da `en.json`, o `summary`/`[tabindex]` come in `tree.spec.ts`), mai l'asserzione sul comportamento. Se il comportamento di oggi è diverso, fermarsi e riportarlo.
- I quattro test «…: where the focus goes» **affermano il difetto di oggi** (focus sul `body`, misurato il 10/10 in build e in sviluppo). Se il focus non cadesse sul `body`, fermarsi e riportarlo. Nessun `test.fail`.
- «Chiudi» compare due volte con le impostazioni aperte (impostazioni e cronologia): il test della lingua della cronologia cerca quello dentro la regione delle impostazioni.
- L'autosalvataggio spento si imposta con `localStorage` (`housemd:autosave`) prima dell'apertura, come lo scriverebbe la pagina delle impostazioni.

- [ ] **Step 5: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, nell'array `STATES`, subito **prima** dello stato `tooltip-hover` (cioè dopo `history`):

```ts
  {
    name: 'tree-rows',
    async setup(app, page) {
      // Bozza (autosalvataggio spento e cambio file), immagine, cartella vuota aperta, file annidato aperto.
      await page.addInitScript(() => localStorage.setItem('housemd:autosave', JSON.stringify({ mode: 'off', delayMs: 1000 })));
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide', 'pic.png': { base64: PIXEL_PNG_BASE64 } });
      await app.openFile('a.md');
      await app.typeAtEnd(' edited');
      await app.tree().locator('summary').filter({ hasText: 'docs' }).click();
      await app.openFile('guide.md');
      await expect(app.treeFileWithDraft('a.md')).toBeVisible();
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.getByRole('dialog', { name: app.t('folder.new') }).getByRole('textbox').fill('empty');
      await page.keyboard.press('Enter');
      await app.tree().locator('summary').filter({ hasText: 'empty' }).click();
      await expect(app.tree().getByText(app.t('tree.emptyFolder'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'tree-row-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide' });
      await app.openFile('a.md');
      // Al passaggio sulla riga compare il pulsante ⋯ (opacità 1) e la riga si colora.
      await app.treeFile('b.md').hover();
      const more = page.getByRole('button', { name: app.t('tree.actions', { name: 'b.md' }) });
      await expect.poll(() => more.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    },
  },
  {
    name: 'tree-focus-keyboard',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'A', 'b.md': 'B', 'docs/guide.md': '# Guide' });
      await app.openFile('a.md');
      // Come focus-ring.spec.ts: l'ultima interazione è la tastiera; poi Tab fino alla riga del file aperto.
      await page.getByRole('button', { name: app.t('folder.new') }).first().click();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab'); // ricerca
      await page.keyboard.press('Tab'); // albero: il file aperto
      await expect(app.treeFile('a.md')).toBeFocused();
      await page.keyboard.press('ArrowUp'); // la cartella: il ⋯ dentro il <summary> compare con :focus-within
      await expect(app.tree().locator('summary').filter({ hasText: 'docs' })).toBeFocused();
    },
  },
  {
    name: 'search-results',
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'sub/gamma.md': '# Gamma\n\nAnother fox story.' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('fox');
      const results = page.getByRole('list', { name: app.t('search.results') });
      await expect(results.getByRole('button')).toHaveCount(2);
      await expect(results.locator('mark').first()).toBeVisible();
    },
  },
  {
    name: 'search-result-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha\n\nThe quick brown fox jumps.', 'sub/gamma.md': '# Gamma\n\nAnother fox story.' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('fox');
      const first = page.getByRole('list', { name: app.t('search.results') }).getByRole('button').first();
      await first.hover();
      await expect.poll(() => first.evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    },
  },
  {
    name: 'search-none',
    async setup(app, page) {
      await app.openFolder({ 'alpha.md': '# Alpha' });
      await page.getByRole('searchbox', { name: app.t('search.label') }).fill('zzzzqqq');
      await expect(page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
    },
  },
  {
    name: 'history-empty',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      await expect(page.getByRole('region', { name: app.t('toolbar.history') }).getByText(app.t('history.empty'))).toBeVisible();
    },
  },
  {
    name: 'history-identical',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await app.editor().click();
      await page.keyboard.press('ControlOrMeta+a');
      // Come lo stato `history`: il livello della selezione di CodeMirror si disegna nel fotogramma dopo.
      await page.waitForTimeout(100);
      await page.keyboard.type('v1');
      await page.waitForTimeout(100);
      await page.keyboard.press('ControlOrMeta+s');
      await expect.poll(() => app.disk('note.md')).toBe('v1');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      const panel = page.getByRole('region', { name: app.t('toolbar.history') });
      await panel.getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).first().click();
      await expect(panel.getByText(app.t('history.identical'))).toBeVisible();
      await page.clock.pauseAt(NOW.getTime() + 60_000);
    },
  },
```

`PIXEL_PNG_BASE64` e `NOW` sono già importati in cima al file.

- [ ] **Step 6: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: 132 + 23 = 155
npx playwright test -c e2e/playwright.config.ts e2e/tree-rows.spec.ts e2e/search-live.spec.ts e2e/history-live.spec.ts --repeat-each=5
npm run test:e2e:dev        # annotare: 117 + 23 = 140
npm run test:e2e:audit      # annotare: 68 + 16 = 84 (due test per stato)
```

Expected: tutto verde, nessuna ripetizione instabile.

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete su albero, ricerca e cronologia (focus perso, moveBefore, stati di audit) prima della 6a"
```

---

### Task 2: `hmd-file-tree`

**Files:**
- Create: `src/elements/file-tree/treeView.ts`, `treeView.test.ts`, `file-tree.element.ts`, `file-tree.css`, `file-tree.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `e2e/tree-rows.spec.ts` (due test rovesciati)
- Delete: `src/ui/FileTree.tsx`, `src/ui/FileTree.module.css`

**Interfaces:**
- Consumes: `TreeNode` (`src/ui/tree.ts`); `visibleItems`, `tabStop`, `treeKey`, `VisibleItem` (`src/ui/treeNav.ts`); `toggleExpanded`, `revealPath`, `Expanded` (`src/elements/file-tree/treeState.ts`); `TreeAction` (`src/elements/workspace/dialogFor.ts`); `HmdElement`, `el`, `setText`, `toggleAttr`, `reconcileList`, `icon` (`src/dom/`); `ICONS` (`src/ui/icons.ts`); `emit` (`src/elements/events.ts`); `installPopoverStub`, `isPopoverOpen`, `countListeners` (`src/testing/`).
- Produces:
  - `menuActions(kind: TreeNode['kind'] | null): TreeAction[]`, `MENU_LABELS: Record<TreeAction, MessageKey>`, `nodeKey(node: TreeNode): string`, `nodesByPath(nodes: readonly TreeNode[]): Map<string, TreeNode>` da `treeView.ts`
  - `class HmdFileTree` con proprietà `nodes: readonly TreeNode[]`, `openPath: string | null`, `drafts: ReadonlySet<string>`, `i18n: I18nStore | null`; eventi `hmd-open` `{ path }` e `hmd-tree-action` `{ action: TreeAction; node: TreeNode | null }`
  - schema di render dei Task 3–4: `#update()` con `#rendering`/`#again`, focus stabile «hadFocus»

- [ ] **Step 1: Test che falliscono**

`src/elements/file-tree/treeView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { TreeNode } from '../../ui/tree';
import { MENU_LABELS, menuActions, nodeKey, nodesByPath } from './treeView';

const file = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'file', children: [] });
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'directory', children });

test('menu entries by kind, in the order of the old menu', () => {
  assert.deepEqual(menuActions('directory'), ['new-file', 'new-folder', 'rename', 'delete']);
  assert.deepEqual(menuActions('file'), ['history', 'rename', 'delete']);
  assert.deepEqual(menuActions(null), ['rename', 'delete']);
  assert.deepEqual(menuActions('asset'), ['rename', 'delete']);
});

test('every menu entry has a label', () => {
  for (const action of [...menuActions('directory'), ...menuActions('file')]) assert.ok(MENU_LABELS[action], action);
});

test('the row key changes with the kind of the node', () => {
  assert.notEqual(nodeKey(file('a')), nodeKey(dir('a', [])));
  assert.equal(nodeKey(file('a/b.md')), nodeKey(file('a/b.md')));
});

test('nodesByPath reaches every depth', () => {
  const guide = file('docs/deep/guide.md');
  const map = nodesByPath([dir('docs', [dir('docs/deep', [guide])]), file('a.md')]);
  assert.deepEqual([...map.keys()].sort(), ['a.md', 'docs', 'docs/deep', 'docs/deep/guide.md']);
  assert.equal(map.get('docs/deep/guide.md'), guide);
});
```

`src/elements/file-tree/file-tree.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';
import type { TreeNode } from '../../ui/tree';
import type { HmdEvents } from '../events';

installPopoverStub();

// jsdom non ha requestAnimationFrame: coda a mano, svuotata dal test.
const frames: FrameRequestCallback[] = [];
Object.assign(globalThis, { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback) });
const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

const file = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'file', children: [] });
const asset = (path: string): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'asset', children: [] });
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split('/').at(-1)!, path, kind: 'directory', children });
const NODES = [dir('docs', [file('docs/guide.md')]), file('a.md'), file('z.md')];

test.afterEach(() => {
  document.body.replaceChildren();
  frames.length = 0;
});

function mount(nodes: TreeNode[] = NODES, openPath: string | null = null) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'tree.label': 'FILE', 'tree.rename': 'RINOMINA' } }),
      persist() {},
    }),
  );
  const el = document.createElement('hmd-file-tree');
  el.nodes = nodes;
  el.openPath = openPath;
  el.i18n = i18n;
  document.body.append(el);
  const opened: string[] = [];
  const actions: HmdEvents['hmd-tree-action']['detail'][] = [];
  el.addEventListener('hmd-open', (event) => opened.push(event.detail.path));
  el.addEventListener('hmd-tree-action', (event) => actions.push(event.detail));
  const row = (path: string) => el.querySelector<HTMLElement>(`[data-tree-item="${path}"]`);
  const trigger = (name: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${EN_MESSAGES['tree.actions'].replace('{name}', name)}"]`);
  const menu = el.querySelector<HTMLElement>('[popover]')!;
  const key = (target: Element, key: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  return { el, i18n, listeners, opened, actions, row, trigger, menu, key };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Chromium manda `focusout` in modo sincrono quando si rimuove il nodo con il focus (il crash della 4c);
 * jsdom no: qui lo si manda a mano, dentro `remove()`, cioè nel mezzo di reconcileList.
 */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

test('the same DOM as FileTree.tsx: nav, nested lists, details for folders, buttons for files', () => {
  const { el, row } = mount();
  const nav = el.querySelector('nav')!;
  assert.equal(nav.className, 'tree');
  assert.equal(nav.getAttribute('aria-label'), EN_MESSAGES['tree.label']);
  assert.deepEqual([...nav.children].map((c) => c.localName), ['ul', 'div']);
  const summary = row('docs')!;
  assert.equal(summary.localName, 'summary');
  assert.equal(summary.className, 'row');
  assert.equal(summary.getAttribute('aria-keyshortcuts'), 'Shift+F10');
  assert.equal(summary.parentElement!.localName, 'details');
  // Anche i file dentro una cartella chiusa sono nel DOM, come con React.
  assert.equal(row('docs/guide.md')!.localName, 'button');
  assert.equal(row('a.md')!.className, 'file');
  assert.equal(row('a.md')!.parentElement!.className, 'row');
  assert.equal(row('a.md')!.textContent, 'a.md');
});

test('one tab stop: the open file, then the first row; the ⋯ buttons are never tab stops', () => {
  const { el, row } = mount(NODES, 'a.md');
  assert.deepEqual([...el.querySelectorAll('[tabindex="0"]')], [row('a.md')]);
  assert.ok([...el.querySelectorAll<HTMLElement>('[data-menu-trigger]')].every((b) => b.tabIndex === -1));
  el.openPath = null;
  assert.deepEqual([...el.querySelectorAll('[tabindex="0"]')], [row('docs')]);
});

test('the open file is marked; its ancestors open once, a folder closed afterwards stays closed', () => {
  const { el, row } = mount();
  el.openPath = 'docs/guide.md';
  const details = row('docs')!.parentElement as HTMLDetailsElement;
  assert.equal(details.open, true);
  assert.equal(row('docs/guide.md')!.getAttribute('aria-current'), 'page');
  assert.equal(row('docs/guide.md')!.parentElement!.dataset.active, 'true');
  assert.equal(row('a.md')!.parentElement!.dataset.active, 'false');
  details.open = false;
  details.dispatchEvent(new Event('toggle'));
  el.nodes = [...NODES];
  assert.equal(details.open, false);
});

test('a click on a file sends hmd-open; assets have neither button nor menu', () => {
  const { el, row, opened, trigger } = mount([file('a.md'), asset('pic.png')]);
  row('a.md')!.click();
  assert.deepEqual(opened, ['a.md']);
  assert.equal(row('pic.png'), null);
  assert.equal(trigger('pic.png'), null);
  assert.equal(el.querySelector('.asset')!.textContent, 'pic.png');
});

test('arrows move the focus; right opens a folder, left closes it; the tab stop follows the focus', () => {
  const { row, key } = mount(NODES, 'a.md');
  row('a.md')!.focus();
  key(row('a.md')!, 'Home');
  assert.equal(document.activeElement, row('docs'));
  assert.equal(row('docs')!.tabIndex, 0);
  assert.equal(row('a.md')!.tabIndex, -1);
  key(row('docs')!, 'ArrowRight');
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, true);
  key(row('docs')!, 'ArrowRight');
  assert.equal(document.activeElement, row('docs/guide.md'));
  key(row('docs/guide.md')!, 'ArrowLeft');
  assert.equal(document.activeElement, row('docs'));
  key(row('docs')!, 'ArrowLeft');
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, false);
});

test('Shift+F10 opens the menu anchored to the row ⋯, focus on the first entry; an entry sends hmd-tree-action and closes it', () => {
  const { row, trigger, menu, key, actions } = mount(NODES, 'a.md');
  row('a.md')!.focus();
  key(row('a.md')!, 'F10', { shiftKey: true });
  assert.ok(isPopoverOpen(menu));
  assert.equal(trigger('a.md')!.style.getPropertyValue('anchor-name'), '--housemd-tree-menu, --tooltip-anchor');
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['History', 'Rename', 'Delete']);
  flushFrames();
  assert.equal(document.activeElement, menu.querySelector('button'));
  (menu.querySelectorAll('button')[1] as HTMLButtonElement).click();
  assert.equal(isPopoverOpen(menu), false);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'rename');
  assert.equal(actions[0].node?.path, 'a.md');
});

test('the ⋯ of a folder: menu for folders, the folder does not toggle; another ⋯ moves the anchor', () => {
  const { trigger, menu, row } = mount();
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  trigger('docs')!.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.equal((row('docs')!.parentElement as HTMLDetailsElement).open, false);
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['New file', 'New folder', 'Rename', 'Delete']);
  assert.equal(menu.querySelector('.danger')!.textContent, 'Delete');
  trigger('a.md')!.click();
  assert.equal(trigger('docs')!.style.getPropertyValue('anchor-name'), '');
  assert.notEqual(trigger('a.md')!.style.getPropertyValue('anchor-name'), '');
});

test('menu closed with the focus lost: back on the row it was opened from', () => {
  const { row, menu, key } = mount(NODES, 'a.md');
  row('z.md')!.focus();
  key(row('z.md')!, 'ContextMenu');
  flushFrames();
  menu.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
  assert.equal(document.activeElement, row('z.md'));
});

test('the draft mark, the empty folder note, the no-files note', () => {
  const { el, row } = mount([dir('empty', []), file('a.md')]);
  el.drafts = new Set(['a.md']);
  const mark = row('a.md')!.querySelector('[role="img"]')!;
  assert.equal(mark.getAttribute('aria-label'), EN_MESSAGES['tree.draft']);
  assert.equal(mark.getAttribute('data-tooltip'), EN_MESSAGES['tree.draft']);
  assert.equal(el.querySelector('.emptyDir')!.textContent, EN_MESSAGES['tree.emptyFolder']);
  el.drafts = new Set();
  assert.equal(row('a.md')!.querySelector('[role="img"]'), null);
  el.nodes = [];
  assert.deepEqual([...el.querySelector('nav')!.children].map((c) => c.localName), ['p', 'div']);
  assert.equal(el.querySelector('nav > p')!.textContent, EN_MESSAGES['tree.noFiles']);
});

test('the row with the focus disappears: the focus goes to the tab stop row (decision 3)', () => {
  const { el, row, trigger } = mount(NODES, 'a.md');
  trigger('z.md')!.focus();
  el.nodes = [NODES[0], NODES[1]];
  assert.equal(row('z.md'), null);
  assert.equal(document.activeElement, row('a.md'));
});

test('rows are reused by path: the focused row keeps the focus across new node arrays', () => {
  const { el, row } = mount(NODES, 'a.md');
  const before = row('z.md')!;
  before.focus();
  el.nodes = [...NODES, file('zz.md')];
  assert.equal(row('z.md'), before);
  assert.equal(document.activeElement, before);
});

test('a listener that changes the nodes while handling hmd-tree-action does not break the tree', () => {
  const { el, row, key, menu } = mount(NODES, 'a.md');
  el.addEventListener('hmd-tree-action', () => {
    el.nodes = [file('a.md')];
  });
  row('z.md')!.focus();
  key(row('z.md')!, 'F10', { shiftKey: true });
  (menu.querySelectorAll('button')[2] as HTMLButtonElement).click();
  assert.equal(row('z.md'), null);
  assert.deepEqual([...el.querySelectorAll('[data-tree-item]')].map((r) => (r as HTMLElement).dataset.treeItem), ['a.md']);
});

test('a listener that changes the nodes from a focusout while a focused row is being removed: rendered once, no duplicates', () => {
  const { el, row } = mount(NODES, 'a.md');
  row('z.md')!.focus();
  focusoutOnRemove(row('z.md')!.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    el.nodes = [file('a.md'), file('b.md')];
  });
  el.nodes = [NODES[0], NODES[1]];
  assert.deepEqual([...el.querySelectorAll<HTMLElement>('[data-tree-item]')].map((r) => r.dataset.treeItem), ['a.md', 'b.md']);
  assert.equal(el.querySelectorAll('nav > ul > li').length, 2);
});

test('a listener that opens another menu from a focusout while the menu is being redrawn: one set of entries, the last menu', () => {
  const { el, trigger, menu } = mount(NODES, 'a.md');
  trigger('a.md')!.click();
  const history = menu.querySelector('button')!;
  history.focus();
  focusoutOnRemove(history);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    trigger('z.md')!.click();
  });
  // Il menu di una cartella toglie «Cronologia» (che ha il focus): il listener apre quello di z.md.
  trigger('docs')!.click();
  assert.deepEqual([...menu.querySelectorAll('button')].map((b) => b.textContent), ['History', 'Rename', 'Delete']);
  assert.notEqual(trigger('z.md')!.style.getPropertyValue('anchor-name'), '');
  assert.equal(trigger('docs')!.style.getPropertyValue('anchor-name'), '');
});

test('deleting the last file leaves no tab stop and does not move the focus (decision 3: no target)', () => {
  const { el, row } = mount([file('a.md'), asset('pic.png')], 'a.md');
  row('a.md')!.focus();
  assert.doesNotThrow(() => (el.nodes = [asset('pic.png')]));
  assert.equal(el.querySelector('[tabindex="0"]'), null);
  assert.equal(document.activeElement, document.body);
  el.nodes = [];
  assert.equal(el.querySelector('[tabindex="0"]'), null);
  assert.equal(document.activeElement, document.body);
  assert.equal(el.querySelector('nav > p')!.textContent, EN_MESSAGES['tree.noFiles']);
});

test('language change relabels the tree and the menu; detached, no listener left', async () => {
  const { el, i18n, listeners, menu, trigger } = mount();
  trigger('a.md')!.click();
  await i18n.setLocale('it');
  assert.equal(el.querySelector('nav')!.getAttribute('aria-label'), 'FILE');
  assert.ok([...menu.querySelectorAll('button')].some((b) => b.textContent === 'RINOMINA'));
  el.remove();
  assert.equal(listeners(), 0);
  await tick();
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/file-tree/treeView.test.ts src/elements/file-tree/file-tree.dom.test.ts`
Expected: FAIL: `Cannot find module './treeView'` nel primo file; nel secondo `TypeError: Cannot read properties of null` (il tag non è definito: niente `<nav>`).

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/file-tree/treeView.ts`:

```ts
import type { MessageKey } from '../../i18n/messages';
import type { TreeNode } from '../../ui/tree';
import type { TreeAction } from '../workspace/dialogFor';

/** Voci del menu ⋯ per il tipo di nodo, nell'ordine di FileTree.tsx; senza nodo (mai aperto) solo le comuni. */
export function menuActions(kind: TreeNode['kind'] | null): TreeAction[] {
  const common: TreeAction[] = ['rename', 'delete'];
  if (kind === 'directory') return ['new-file', 'new-folder', ...common];
  if (kind === 'file') return ['history', ...common];
  return common;
}

/** Etichetta di ogni voce del menu. */
export const MENU_LABELS: Record<TreeAction, MessageKey> = {
  'new-file': 'file.new',
  'new-folder': 'folder.new',
  history: 'tree.history',
  rename: 'tree.rename',
  delete: 'tree.delete',
};

/** Chiave di una riga: un percorso che cambia tipo (file ↔ cartella) è una riga nuova, come un componente diverso in React. */
export const nodeKey = (node: TreeNode): string => `${node.kind}:${node.path}`;

/** Ogni nodo dell'albero per percorso, a tutte le profondità. */
export function nodesByPath(nodes: readonly TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      map.set(node.path, node);
      walk(node.children);
    }
  };
  walk(nodes);
  return map;
}
```

`src/elements/file-tree/file-tree.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { isImage } from '../../lib/paths';
import type { I18nStore } from '../../state/i18nStore';
import { ICONS } from '../../ui/icons';
import type { TreeNode } from '../../ui/tree';
import { tabStop, treeKey, visibleItems, type VisibleItem } from '../../ui/treeNav';
import { emit } from '../events';
import type { TreeAction } from '../workspace/dialogFor';
import { revealPath, toggleExpanded, type Expanded } from './treeState';
import { MENU_LABELS, menuActions, nodeKey, nodesByPath } from './treeView';
import './file-tree.css';

/** Nome dell'ancora del menu: il pulsante ⋯ che l'ha aperto (anchor-name scritto a mano, come in FileTree.tsx). */
const ANCHOR = '--housemd-tree-menu';

/** Nodi fissi dell'elemento: elenco radice, nota «nessun file», menu ⋯. */
interface Parts {
  nav: HTMLElement;
  root: HTMLUListElement;
  none: HTMLParagraphElement;
  menu: HTMLDivElement;
}

/** Nodi di una riga, legati al suo <li>; `node` è l'ultimo ricevuto (i listener lo leggono al momento). */
interface Row {
  node: TreeNode;
  /** La riga col tab stop: <summary> di una cartella o pulsante di un file (assente per gli asset). */
  focusable: HTMLElement | null;
  trigger: HTMLButtonElement | null;
  name: HTMLSpanElement;
  /** Cartella: <details>, icona aperta/chiusa, elenco dei figli o nota «cartella vuota». */
  details?: HTMLDetailsElement;
  folderIcon?: HTMLSpanElement;
  list?: HTMLUListElement;
  empty?: HTMLParagraphElement;
  /** File: riga esterna (data-active) e pallino della bozza. */
  box?: HTMLDivElement;
  draft?: HTMLSpanElement;
}

/**
 * Albero dei file della sidebar (era FileTree.tsx). Cartelle con <details> nativo, un solo tab stop
 * (treeNav.ts), menu ⋯ in un popover ancorato al pulsante che l'ha aperto. Tutti i nodi sono nel DOM,
 * anche dentro le cartelle chiuse, come con React. I setter disegnano subito (niente CodeMirror né
 * effetti da ordinare); un render chiesto mentre ne gira un altro si ripete alla fine.
 */
export class HmdFileTree extends HmdElement {
  #nodes: readonly TreeNode[] = [];
  #openPath: string | null = null;
  #drafts: ReadonlySet<string> = new Set();
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, Row>();
  /** Percorso → riga col tab stop e pulsante ⋯, ricostruite a ogni render. */
  #focusables = new Map<string, HTMLElement>();
  #triggers = new Map<string, HTMLButtonElement>();
  #byPath = new Map<string, TreeNode>();
  #items: VisibleItem[] = [];
  #expanded: Expanded = new Set();
  #focused: string | null = null;
  #menuNode: TreeNode | null = null;
  #anchor: HTMLElement | null = null;
  #rendering = false;
  #again = false;

  get nodes(): readonly TreeNode[] { return this.#nodes; }
  set nodes(value: readonly TreeNode[]) {
    value ??= [];
    if (value === this.#nodes) return;
    this.#nodes = value;
    this.#update();
  }
  get openPath(): string | null { return this.#openPath; }
  set openPath(value: string | null) {
    value ??= null;
    if (value === this.#openPath) return;
    this.#openPath = value;
    // Come l'effetto [openPath] di FileTree.tsx: solo quando il file aperto cambia, così una cartella
    // chiusa a mano dopo resta chiusa.
    if (value) this.#expanded = revealPath(this.#expanded, value);
    this.#update();
  }
  get drafts(): ReadonlySet<string> { return this.#drafts; }
  set drafts(value: ReadonlySet<string>) {
    value ??= new Set();
    if (value === this.#drafts) return;
    this.#drafts = value;
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
      const root = el('ul', { class: 'list' });
      const none = el('p', { class: 'emptyDir' });
      const menu = el('div', { class: 'menu', popover: 'auto', on: { toggle: (event) => this.#onMenuToggle(event as ToggleEvent) } });
      const nav = el('nav', { class: 'tree', on: { keydown: (event) => this.#onKeyDown(event), focusin: (event) => this.#onFocusIn(event) } }, menu);
      this.append(nav);
      this.#parts = { nav, root, none, menu };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#update(), signal);
  }

  #update(): void {
    if (!this.#parts || !this.#i18n || !this.isConnected) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        this.#render(this.#parts, this.#i18n);
      } while (this.#again);
    } finally {
      this.#rendering = false;
    }
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { nav, root, none, menu } = parts;
    const t = i18n.t;
    const hadFocus = nav.contains(document.activeElement);
    toggleAttr(nav, 'aria-label', true, t('tree.label'));
    this.#focusables.clear();
    this.#triggers.clear();
    this.#byPath = nodesByPath(this.#nodes);
    if (this.#nodes.length > 0) {
      none.remove();
      if (root.parentNode !== nav) nav.prepend(root);
      this.#renderList(root, this.#nodes, i18n);
    } else {
      root.remove();
      setText(none, t('tree.noFiles'));
      if (none.parentNode !== nav) nav.prepend(none);
    }
    this.#renderMenu(menu, i18n);
    this.#items = visibleItems(this.#nodes as TreeNode[], this.#expanded);
    // La riga con il focus è sparita (file eliminato o rinominato): il focus va sulla riga col tab stop.
    if (hadFocus && !nav.contains(document.activeElement)) {
      const stop = tabStop(this.#items, this.#focused, this.#openPath);
      if (stop !== null) this.#focusables.get(stop)?.focus();
    }
    this.#applyTabStops();
  }

  #renderList(list: HTMLUListElement, nodes: readonly TreeNode[], i18n: I18nStore): void {
    reconcileList(list, nodes, nodeKey, (node) => this.#createRow(node), (li, node) => this.#updateRow(li, node, i18n));
  }

  #createRow(node: TreeNode): HTMLLIElement {
    const name = el('span', { class: 'name' });
    if (node.kind === 'asset') {
      const li = el('li', null, el('div', { class: 'row asset' }, icon(isImage(node.name) ? 'image' : 'asset', { size: 16 }), name));
      this.#rows.set(li, { node, focusable: null, trigger: null, name });
      return li;
    }
    const row: Row = { node, focusable: null, trigger: null, name };
    const trigger = el(
      'button',
      {
        dataset: { menuTrigger: '' },
        tabindex: '-1',
        class: 'menuButton tooltip',
        on: {
          click: (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.#openMenu(row.node, trigger);
          },
        },
      },
      icon('more', { size: 16 }),
    );
    row.trigger = trigger;
    if (node.kind === 'directory') {
      const folderIcon = icon('folderClosed', { size: 16 });
      const summary = el('summary', { class: 'row', 'aria-keyshortcuts': 'Shift+F10' }, folderIcon, icon('folder', { size: 16 }), name, trigger);
      const details = el('details', { on: { toggle: () => this.#toggle(row.node.path, details.open) } }, summary);
      Object.assign(row, { focusable: summary, details, folderIcon, list: el('ul', { class: 'list' }), empty: el('p', { class: 'emptyDir' }) });
      const li = el('li', null, details);
      this.#rows.set(li, row);
      return li;
    }
    const button = el(
      'button',
      { class: 'file', 'aria-keyshortcuts': 'Shift+F10', on: { click: () => emit(this, 'hmd-open', { path: row.node.path }) } },
      icon('file', { size: 16 }),
      name,
    );
    const box = el('div', { class: 'row' }, button, trigger);
    row.focusable = button;
    row.box = box;
    row.draft = el('span', { class: 'draft tooltip', role: 'img' }, icon('draft', { size: 10 }));
    const li = el('li', null, box);
    this.#rows.set(li, row);
    return li;
  }

  #updateRow(li: HTMLLIElement, node: TreeNode, i18n: I18nStore): void {
    const row = this.#rows.get(li)!;
    const t = i18n.t;
    row.node = node;
    setText(row.name, node.name);
    if (row.trigger) {
      const label = t('tree.actions', { name: node.name });
      toggleAttr(row.trigger, 'aria-label', true, label);
      toggleAttr(row.trigger, 'data-tooltip', true, label);
      this.#triggers.set(node.path, row.trigger);
    }
    if (row.focusable) {
      row.focusable.dataset.treeItem = node.path;
      this.#focusables.set(node.path, row.focusable);
    }
    if (row.details && row.folderIcon && row.list && row.empty) {
      const open = this.#expanded.has(node.path);
      if (row.details.open !== open) row.details.open = open;
      row.folderIcon.style.setProperty('mask-image', `url("${ICONS[open ? 'folderOpen' : 'folderClosed']}")`);
      if (node.children.length > 0) {
        row.empty.remove();
        if (row.list.parentNode !== row.details) row.details.append(row.list);
        this.#renderList(row.list, node.children, i18n);
      } else {
        row.list.remove();
        setText(row.empty, t('tree.emptyFolder'));
        if (row.empty.parentNode !== row.details) row.details.append(row.empty);
      }
    }
    if (row.box && row.draft && row.focusable) {
      const active = node.path === this.#openPath;
      row.box.dataset.active = String(active);
      toggleAttr(row.focusable, 'aria-current', active, 'page');
      if (this.#drafts.has(node.path)) {
        toggleAttr(row.draft, 'aria-label', true, t('tree.draft'));
        toggleAttr(row.draft, 'data-tooltip', true, t('tree.draft'));
        if (row.draft.parentNode !== row.focusable) row.focusable.append(row.draft);
      } else {
        row.draft.remove();
      }
    }
  }

  #renderMenu(menu: HTMLDivElement, i18n: I18nStore): void {
    // Per chiave: i pulsanti restano (e con loro il focus) se il menu aperto si ridisegna.
    reconcileList(
      menu,
      menuActions(this.#menuNode?.kind ?? null),
      (action) => action,
      (action) => el('button', { class: action === 'delete' ? 'danger' : undefined, on: { click: () => this.#act(action) } }),
      (button, action) => setText(button, i18n.t(MENU_LABELS[action])),
    );
  }

  /** Un solo tab stop: la riga col focus se visibile, altrimenti il file aperto, altrimenti la prima. */
  #applyTabStops(): void {
    const stop = tabStop(this.#items, this.#focused, this.#openPath);
    // L'attributo sempre scritto (anche 0 su un pulsante, che lo è già): come tabIndex={…} di React.
    for (const [path, row] of this.#focusables) toggleAttr(row, 'tabindex', true, path === stop ? '0' : '-1');
  }

  #onFocusIn(event: FocusEvent): void {
    // Come onFocus di React sulla riga: vale anche per il ⋯ dentro il <summary> di una cartella.
    const row = (event.target as Element).closest<HTMLElement>('[data-tree-item]');
    if (!row || !this.contains(row)) return;
    this.#focused = row.dataset.treeItem!;
    // Durante un render il tab stop si ricalcola alla fine: qui niente.
    if (!this.#rendering) this.#applyTabStops();
  }

  #toggle(path: string, open: boolean): void {
    const next = toggleExpanded(this.#expanded, path, open);
    if (next === this.#expanded) return;
    this.#expanded = next;
    this.#update();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const current = (event.target as HTMLElement).dataset?.treeItem;
    if (current === undefined) return; // focus nel menu o altrove: tasti normali
    const move = treeKey(this.#items, current, event);
    if (!move) return;
    event.preventDefault();
    if ('focus' in move) this.#focusables.get(move.focus)?.focus();
    else if ('expand' in move) this.#toggle(move.expand, true);
    else if ('collapse' in move) this.#toggle(move.collapse, false);
    else {
      const node = this.#byPath.get(move.menu);
      const trigger = this.#triggers.get(move.menu);
      if (node && trigger) this.#openMenu(node, trigger);
    }
  }

  #openMenu(node: TreeNode, trigger: HTMLElement): void {
    const parts = this.#parts;
    if (!parts || !this.#i18n) return;
    this.#anchor?.style.removeProperty('anchor-name');
    // Il pulsante resta anche l'ancora del suo tooltip (.tooltip in global.css).
    trigger.style.setProperty('anchor-name', `${ANCHOR}, --tooltip-anchor`);
    this.#anchor = trigger;
    this.#menuNode = node;
    // Come ogni altro cambio di stato: un render alla volta (#update disegna anche il menu). Un render
    // chiesto da un listener mentre questo è in corso si ripete alla fine, mai annidato.
    this.#update();
    if (!parts.menu.matches(':popover-open')) parts.menu.showPopover();
    requestAnimationFrame(() => parts.menu.querySelector('button')?.focus());
  }

  /** Chiuso il menu (Esc, clic fuori) col focus perso, il focus torna sulla riga da cui era partito. */
  #onMenuToggle(event: ToggleEvent): void {
    const menuNode = this.#menuNode;
    if (event.newState !== 'closed' || !menuNode || !this.#parts) return;
    const lost = document.activeElement === document.body || this.#parts.menu.contains(document.activeElement);
    if (lost) this.#focusables.get(menuNode.path)?.focus();
  }

  #act(action: TreeAction): void {
    const node = this.#menuNode;
    this.#parts?.menu.hidePopover();
    emit(this, 'hmd-tree-action', { action, node });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-file-tree': HmdFileTree;
  }
}
```

`src/elements/file-tree/file-tree.css` (valori copiati da `FileTree.module.css`, stesse classi; solo `:scope { display: contents }` in più):

```css
@layer components {
  @scope (hmd-file-tree) {
    :scope {
      display: contents;
    }

    /* Valori copiati da FileTree.module.css. */
    .tree {
      flex: 1;
      overflow-y: auto;
      /* Stessi margini laterali della casella di ricerca, così righe e icone si allineano. */
      padding: 6px 10px 24px;
    }

    .list {
      list-style: none;
      margin: 0;
      padding: 0 0 0 20px;
    }

    .tree > .list {
      padding-left: 0;
    }

    .row {
      display: flex;
      align-items: center;
      border-radius: 6px;
      min-height: 28px;
      padding-right: 2px;
    }

    summary.row {
      cursor: pointer;
      padding-left: 10px;
      gap: 4px;
      list-style: none;
    }

    summary.row::-webkit-details-marker {
      display: none;
    }

    .row:hover,
    .row[data-active='true'] {
      background: var(--c-accent-soft);
    }

    .name,
    .file {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file {
      display: flex;
      align-items: center;
      gap: 6px;
      text-align: left;
      background: none;
      border: none;
      padding: 4px 6px 4px 10px;
      cursor: pointer;
    }

    /* Stesso rientro di .file, così nome e icona si allineano agli altri file. */
    .asset {
      gap: 6px;
      padding: 4px 6px 4px 10px;
      color: var(--c-muted);
      opacity: 0.7;
      cursor: not-allowed;
    }

    .asset:hover {
      background: none;
    }

    .menuButton {
      background: none;
      border: none;
      border-radius: 4px;
      padding: 0 6px;
      cursor: pointer;
      color: var(--c-muted);
      opacity: 0;
    }

    .row:hover .menuButton,
    .row:focus-within .menuButton,
    .menuButton:focus-visible {
      opacity: 1;
    }

    .emptyDir {
      color: var(--c-muted);
      font-size: 13px;
      margin: 4px 0 4px 10px;
    }

    .menu {
      position-anchor: --housemd-tree-menu;
      position-area: block-end span-inline-start;
      position-try-fallbacks: flip-block, flip-inline;
      inset: auto;
      margin: 4px 0 0;
      padding: 4px;
      min-width: 170px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    }

    .menu:popover-open {
      display: flex;
      flex-direction: column;
    }

    .menu button {
      text-align: left;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
    }

    .menu button:hover,
    .menu button:focus-visible {
      background: var(--c-accent-soft);
    }

    .menu .danger {
      color: var(--c-danger);
    }

    .draft {
      display: inline-grid;
      color: var(--c-accent);
    }
  }
}
```

Note per chi esegue:
- L'attributo `tabindex` si scrive **sempre** (`toggleAttr`), anche `0` su un `<button>` che ha già `tabIndex` 0: `tree.spec.ts` conta `[tabindex="0"]` (misurato: con la sola proprietà il test fallisce).
- Si disegnano **tutti** i nodi, anche dentro le cartelle chiuse, e il menu mai aperto contiene già «Rinomina» ed «Elimina»: come React, e l'audit li confronta.
- `revealPath` solo nel setter di `openPath` (quando il file aperto cambia), non a ogni render: una cartella richiusa a mano resta chiusa (test jsdom e `tree-rows.spec.ts`).
- `#openMenu` aggiorna ancora e nodo del menu e chiama `#update()`, che disegna anche il menu: mai `#renderMenu` fuori dal render (review di Codex, F1). Il test «a listener that opens another menu from a focusout…» imita il `focusout` sincrono di Chromium alla rimozione della voce con il focus (`focusoutOnRemove`, jsdom non lo manda) e fallisce se `#openMenu` disegna il menu da sé: le voci restano quelle della cartella mentre l'ancora è passata al file.
- Albero senza righe focalizzabili (eliminato l'ultimo file, o solo asset): `tabStop` dà `null`, nessun `tabindex="0"`, il focus non si sposta (test «deleting the last file leaves no tab stop…»; decisione 3).
- Il focus del menu resta in un `requestAnimationFrame` e il ritorno alla riga resta sul `toggle` del menu, come in `FileTree.tsx` (il ritorno al ⋯ dopo una voce lo fa il browser con `hidePopover`, poi il dialog: `tree.spec.ts`).

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: import `import { HmdFileTree } from './file-tree/file-tree.element';` dopo quello di `HmdEditor`, e nella lista, dopo `['hmd-editor', HmdEditor],`:

```ts
  ['hmd-file-tree', HmdFileTree],
```

`src/elements/events.ts`: dopo `import type { GenParams } from '../ai/types';`

```ts
import type { TreeNode } from '../ui/tree';
import type { TreeAction } from './workspace/dialogFor';
```

il commento di `hmd-open` diventa `/** Anteprima (link relativo nel testo) e albero dei file (clic su un file): aprire un file markdown. */`, e prima di `'hmd-toast-dismiss'`:

```ts
  /** Albero dei file: voce del menu ⋯ scelta (`node`: la riga del menu; null solo prima di aprirlo). */
  'hmd-tree-action': CustomEvent<{ action: TreeAction; node: TreeNode | null }>;
```

`src/elements/jsx.d.ts`: import `import type { TreeNode } from '../ui/tree';` dopo quello di `ThemeStore`, e prima di `'hmd-notice'`:

```ts
      'hmd-file-tree': HmdProps<
        { nodes: readonly TreeNode[]; openPath: string | null; drafts: ReadonlySet<string>; i18n: I18nStore },
        'hmd-open' | 'hmd-tree-action'
      >;
```

- [ ] **Step 5: `WorkspaceView.tsx` monta il tag**

Via `import { FileTree, type TreeAction } from './FileTree';`; l'import di `dialogFor` diventa:

```ts
import { dialogFor, type TreeAction } from '../elements/workspace/dialogFor';
```

e `<FileTree nodes={tree} openPath={doc?.path ?? null} drafts={drafts} onOpen={(path) => openFile(path)} onAction={onTreeAction} />` diventa:

```tsx
            <hmd-file-tree
              nodes={tree}
              openPath={doc?.path ?? null}
              drafts={drafts}
              i18n={i18nStore}
              onhmd-open={(event) => void openFile(event.detail.path)}
              onhmd-tree-action={(event) => onTreeAction(event.detail.action, event.detail.node)}
            />
```

- [ ] **Step 6: Rovesciare i due test del focus perso (decisione 3)**

In `e2e/tree-rows.spec.ts`, il test «deleting the file whose row has the focus: where the focus goes» diventa «deleting the file whose row has the focus: the focus goes to the open file», e le sue ultime due righe

```ts
  // Difetto di oggi (React): la riga sparisce con il focus e il focus cade sul body. Il Task 2 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
```

diventano

```ts
  // Decisione 3: il focus va sulla riga col tab stop (il file aperto), non sul body.
  await expect(app.treeFile('a.md')).toBeFocused();
```

Il test «renaming the open file from its row: where the focus goes» diventa «renaming the open file from its row: the focus goes to the renamed row», e le sue ultime due righe diventano

```ts
  // Decisione 3: la riga di prima è sparita; il tab stop è il file aperto, cioè la riga rinominata.
  await expect(app.treeFile('renamed.md')).toBeFocused();
```

- [ ] **Step 7: Via `FileTree.tsx`, controlli**

```bash
git rm src/ui/FileTree.tsx src/ui/FileTree.module.css
grep -rnE "from '\./FileTree'|<FileTree[ />]|FileTree\.module\.css'" src; echo "exit $?"   # atteso: exit 1
grep -n "onhmd-open=" src/ui/WorkspaceView.tsx   # due righe: una sul tag hmd-file-tree, una su hmd-preview
```

- [ ] **Step 8: Verifica completa**

```bash
npm test                    # 788 + 20 = 808
npm run lint
npm run test:e2e            # 155, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/tree.spec.ts e2e/tree-rows.spec.ts --repeat-each=5
npm run test:e2e:dev        # 140
npm run test:e2e:audit      # 84, nessuna differenza
```

- [ ] **Step 9: Commit**

```bash
git add src/elements/ src/ui/WorkspaceView.tsx e2e/tree-rows.spec.ts
git commit -m "feat: hmd-file-tree al posto di FileTree (un solo tab stop, menu ⋯ ancorato, focus stabile se la riga sparisce)"
```

---

### Task 3: `hmd-search-panel`

**Files:**
- Create: `src/elements/search-panel/searchView.ts`, `searchView.test.ts`, `search-panel.element.ts`, `search-panel.css`, `search-panel.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `e2e/search-live.spec.ts` (un test rovesciato)
- Delete: `src/ui/SearchPanel.tsx`, `src/ui/SearchPanel.module.css`

**Interfaces:**
- Consumes: `segments` (`src/elements/search-panel/segments.ts`); `SearchResult` (`src/search/searchIndex.ts`); `HmdElement`, `el`, `setText`, `toggleAttr`, `reconcileList`, `icon` (`src/dom/`); `emit`; `countListeners`; lo schema del Task 2 (focus stabile).
- Produces:
  - `SEARCH_DEBOUNCE_MS = 120`, `type SearchItem`, `searchItems(query: string, results: readonly SearchResult[]): SearchItem[] | null`, `searchItemKey(item: SearchItem): string` da `searchView.ts`
  - `interface SearchSource { search(query: string): SearchResult[] }` e `class HmdSearchPanel` con proprietà `index: SearchSource | null`, `indexRevision: number`, `i18n: I18nStore | null`, metodo `focusInput(): void`; evento `hmd-search-open` `{ path: string; terms: string[] }`; stesso `#update()` con `#rendering`/`#again` del Task 2, più `#pending` per la pausa interrotta dal distacco

- [ ] **Step 1: Test che falliscono**

`src/elements/search-panel/searchView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { SearchResult } from '../../search/searchIndex';
import { searchItemKey, searchItems } from './searchView';

const result = (path: string): SearchResult => ({ path, title: path, snippet: '', terms: [] });

test('no list for an empty or blank query, whatever the results', () => {
  assert.equal(searchItems('', [result('a.md')]), null);
  assert.equal(searchItems('   ', [result('a.md')]), null);
});

test('a query without results shows the "none" row; with results, one row each', () => {
  assert.deepEqual(searchItems('fox', []), [{ kind: 'none' }]);
  const a = result('a.md');
  assert.deepEqual(searchItems('fox', [a]), [{ kind: 'result', result: a }]);
});

test('keys: one per path, and the "none" row never equals a path key', () => {
  assert.equal(searchItemKey({ kind: 'result', result: result('a.md') }), 'r:a.md');
  assert.notEqual(searchItemKey({ kind: 'none' }), searchItemKey({ kind: 'result', result: result('none') }));
});
```

`src/elements/search-panel/search-panel.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import type { SearchResult } from '../../search/searchIndex';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { SearchSource } from './search-panel.element';

const result = (path: string, snippet = `about ${path}`, terms = ['about']): SearchResult => ({ path, title: path.toUpperCase(), snippet, terms });

test.beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
test.afterEach(() => {
  mock.timers.reset();
  document.body.replaceChildren();
});

/** Indice finto: risultati decisi dal test per ogni query; registra le query cercate. */
function fakeIndex(table: Record<string, SearchResult[]>) {
  const queries: string[] = [];
  const index: SearchSource = { search: (query) => (queries.push(query), table[query] ?? []) };
  return { index, queries, table };
}

/** Come nell'albero: il `focusout` sincrono di Chromium alla rimozione del nodo con il focus, dentro reconcileList. */
function focusoutOnRemove(node: Element): void {
  node.remove = function (this: Element) {
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    Element.prototype.remove.call(this);
  };
}

function mount(table: Record<string, SearchResult[]> = { fox: [result('a.md'), result('b.md')] }) {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'search.label': 'CERCA', 'search.none': 'NIENTE' } }),
      persist() {},
    }),
  );
  const fake = fakeIndex(table);
  const el = document.createElement('hmd-search-panel');
  el.index = fake.index;
  el.indexRevision = 1;
  el.i18n = i18n;
  document.body.append(el);
  const opened: { path: string; terms: string[] }[] = [];
  el.addEventListener('hmd-search-open', (event) => opened.push(event.detail));
  const input = el.querySelector('input')!;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (key: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('.result')];
  return { el, i18n, listeners, fake, opened, input, type, key, buttons };
}

test('the same DOM as SearchPanel.tsx: role=search box, icon, labelled search input, no list', () => {
  const { el, input } = mount();
  const box = el.querySelector('.search')!;
  assert.equal(box.getAttribute('role'), 'search');
  assert.deepEqual([...box.children].map((c) => c.localName), ['span', 'input']);
  assert.equal(box.firstElementChild!.className, 'icon searchIcon');
  assert.equal(input.type, 'search');
  assert.equal(input.className, 'input');
  assert.equal(input.getAttribute('aria-label'), EN_MESSAGES['search.label']);
  assert.equal(input.getAttribute('placeholder'), EN_MESSAGES['search.placeholder']);
  assert.equal(el.querySelector('ul'), null);
});

test('results 120 ms after the last key, with marks in the snippet', () => {
  const { el, type, buttons, fake } = mount({ fox: [result('a.md', 'the fox runs', ['fox'])] });
  type('fo');
  type('fox');
  // Prima della pausa: l'elenco c'è (query non vuota) con i risultati di prima, cioè nessuno.
  assert.equal(el.querySelector('ul')!.getAttribute('aria-label'), EN_MESSAGES['search.results']);
  assert.equal(el.querySelector('.none')!.textContent, EN_MESSAGES['search.none']);
  mock.timers.tick(119);
  assert.deepEqual(fake.queries, []);
  mock.timers.tick(1);
  assert.deepEqual(fake.queries, ['fox']);
  assert.equal(el.querySelector('.none'), null);
  const [button] = buttons();
  assert.deepEqual([...button.children].map((c) => c.className), ['title', 'path', 'snippet']);
  assert.equal(button.querySelector('.title')!.textContent, 'A.MD');
  assert.deepEqual([...button.querySelector('.snippet')!.childNodes].map((n) => [n.nodeName, n.textContent]), [['#text', 'the '], ['MARK', 'fox'], ['#text', ' runs']]);
});

test('a new index revision searches again after the pause; the field is never replaced', () => {
  const { el, type, buttons, fake, input } = mount({ fox: [] });
  type('fox');
  mock.timers.tick(120);
  assert.equal(buttons().length, 0);
  fake.table.fox = [result('new.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(buttons().length, 1);
  assert.equal(el.querySelector('input'), input);
  assert.equal(input.value, 'fox');
});

test('Enter opens the first result at once, without waiting; with no result nothing', () => {
  const { type, key, opened } = mount();
  type('fox');
  key('Enter');
  assert.deepEqual(opened, [{ path: 'a.md', terms: ['about'] }]);
  type('zzz');
  key('Enter');
  assert.equal(opened.length, 1);
});

test('a click on a result sends hmd-search-open with its terms', () => {
  const { type, buttons, opened } = mount();
  type('fox');
  mock.timers.tick(120);
  buttons()[1].click();
  assert.deepEqual(opened, [{ path: 'b.md', terms: ['about'] }]);
});

test('Esc empties the field and removes the list', () => {
  const { el, type, key, input } = mount();
  type('fox');
  mock.timers.tick(120);
  key('Escape');
  assert.equal(input.value, '');
  assert.equal(el.querySelector('ul'), null);
});

test('result rows are reused by path: the focused result keeps the focus', () => {
  const { el, type, buttons, fake } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  fake.table.fox = [result('b.md'), result('c.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(buttons()[0], b);
  assert.equal(document.activeElement, b);
});

test('the focused result disappears: the focus goes back to the field (decision 3)', () => {
  const { el, type, buttons, fake, input } = mount();
  type('fox');
  mock.timers.tick(120);
  buttons()[0].focus();
  fake.table.fox = [];
  el.indexRevision = 2;
  mock.timers.tick(120);
  assert.equal(document.activeElement, input);
});

test('a listener that empties the query from a focusout while a focused result is being removed: no list left', () => {
  const { el, type, buttons, fake, key, input } = mount();
  type('fox');
  mock.timers.tick(120);
  const b = buttons()[1];
  b.focus();
  focusoutOnRemove(b.closest('li')!);
  let once = false;
  el.addEventListener('focusout', () => {
    if (once) return;
    once = true;
    key('Escape');
  });
  fake.table.fox = [result('a.md')];
  el.indexRevision = 2;
  mock.timers.tick(120);
  // Esc arriva nel mezzo del render: alla fine la query è vuota e l'elenco non c'è (niente righe rimaste).
  assert.equal(input.value, '');
  assert.equal(el.querySelector('ul'), null);
  assert.equal(el.querySelectorAll('li').length, 0);
});

test('typed, detached before the pause and attached again: the pending search runs once', () => {
  const { el, type, fake } = mount();
  type('fox');
  mock.timers.tick(60);
  el.remove();
  mock.timers.tick(120);
  document.body.append(el);
  mock.timers.tick(119);
  assert.deepEqual(fake.queries, []);
  mock.timers.tick(1);
  assert.deepEqual(fake.queries, ['fox']);
  assert.equal(el.querySelectorAll('.result').length, 2);
});

test('a new index revision while detached searches after attaching again; a language change alone starts nothing', async () => {
  const { el, type, fake, i18n } = mount();
  type('fox');
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox']);
  el.remove();
  el.indexRevision = 5;
  document.body.append(el);
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox', 'fox']);
  await i18n.setLocale('it');
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, ['fox', 'fox']);
});

test('focusInput() puts the focus in the field', () => {
  const { el, input } = mount();
  el.focusInput();
  assert.equal(document.activeElement, input);
});

test('a pending search after detaching does nothing; no listener left', () => {
  const { el, type, fake, listeners } = mount();
  type('fox');
  el.remove();
  mock.timers.tick(120);
  assert.deepEqual(fake.queries, []);
  assert.equal(listeners(), 0);
});

test('language change relabels the field and the "none" row, keeping what was typed', async () => {
  const { el, i18n, type, input } = mount({});
  type('zzz');
  await i18n.setLocale('it');
  assert.equal(input.getAttribute('aria-label'), 'CERCA');
  assert.equal(el.querySelector('.none')!.textContent, 'NIENTE');
  assert.equal(el.querySelector('input'), input);
  assert.equal(input.value, 'zzz');
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/search-panel/searchView.test.ts src/elements/search-panel/search-panel.dom.test.ts`
Expected: FAIL: `Cannot find module './searchView'`; nel secondo file `TypeError: Cannot read properties of null` (niente `<input>`).

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/search-panel/searchView.ts`:

```ts
import type { SearchResult } from '../../search/searchIndex';

/** Pausa dopo l'ultima battuta prima di cercare (come SearchPanel.tsx); Invio non la aspetta. */
export const SEARCH_DEBOUNCE_MS = 120;

/** Voce dell'elenco sotto la casella: un risultato, oppure la riga «nessun risultato». */
export type SearchItem = { kind: 'result'; result: SearchResult } | { kind: 'none' };

/**
 * Elenco sotto la casella: nessuno con la query vuota (o di soli spazi); altrimenti i risultati
 * dell'ultima ricerca, o «nessun risultato» se sono zero. I risultati possono essere di una query
 * precedente finché la pausa non finisce, come con React.
 */
export function searchItems(query: string, results: readonly SearchResult[]): SearchItem[] | null {
  if (!query.trim()) return null;
  if (results.length === 0) return [{ kind: 'none' }];
  return results.map((result) => ({ kind: 'result', result }));
}

/** Chiave per reconcileList: i risultati per percorso; «nessun risultato» non collide con un percorso. */
export const searchItemKey = (item: SearchItem): string => (item.kind === 'none' ? '\u0000none' : `r:${item.result.path}`);
```

`src/elements/search-panel/search-panel.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { SearchResult } from '../../search/searchIndex';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { SEARCH_DEBOUNCE_MS, searchItemKey, searchItems, type SearchItem } from './searchView';
import { segments } from './segments';
import './search-panel.css';

/** Ciò che il pannello chiede all'indice (Workspace.search). */
export interface SearchSource {
  search(query: string): SearchResult[];
}

interface Parts {
  box: HTMLDivElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
}

/** Nodi di una riga dei risultati; `item` è l'ultimo ricevuto (il clic lo legge al momento). */
interface ResultRow {
  item: SearchItem;
  title?: HTMLSpanElement;
  path?: HTMLSpanElement;
  snippet?: HTMLSpanElement;
  /** Testo e termini disegnati nell'estratto: si ridisegna solo se cambiano. */
  drawn?: string;
}

/**
 * Ricerca nella sidebar (era SearchPanel.tsx). Il campo si crea una volta e non viene mai riscritto
 * dall'elemento (tranne Esc, che lo svuota): la query è sua, non arriva da fuori. Risultati dopo
 * 120 ms dall'ultima battuta, o da un nuovo indice; Invio apre subito il primo. Un timer rimasto dopo il
 * distacco non disegna nulla.
 */
export class HmdSearchPanel extends HmdElement {
  #index: SearchSource | null = null;
  #indexRevision = 0;
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, ResultRow>();
  #query = '';
  #results: SearchResult[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Una ricerca chiesta (o interrotta dal distacco) mentre l'elemento era staccato: riparte al ricollegamento. */
  #pending = false;
  #rendering = false;
  #again = false;

  get index(): SearchSource | null { return this.#index; }
  set index(value: SearchSource | null) {
    value ??= null;
    if (value === this.#index) return;
    this.#index = value;
    this.#debounce();
  }
  get indexRevision(): number { return this.#indexRevision; }
  set indexRevision(value: number) {
    value ??= 0;
    if (value === this.#indexRevision) return;
    this.#indexRevision = value;
    this.#debounce();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  /** Porta il focus nella casella (Ctrl+K). */
  focusInput(): void {
    this.#parts?.input.focus();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const input = el('input', {
        type: 'search',
        class: 'input',
        on: {
          input: () => this.#setQuery(input.value),
          keydown: (event) => this.#onKeyDown(event),
        },
      });
      const box = el('div', { class: 'search', role: 'search' }, icon('search', { size: 16, className: 'searchIcon' }), input);
      this.append(box);
      this.#parts = { box, input, list: el('ul', { class: 'results' }) };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#update(), signal);
    // Ricollegato dopo un distacco con una ricerca in sospeso: riparte la pausa. A reconnect (cambio di
    // lingua) #pending è falso e non riparte nulla.
    if (this.#pending) {
      this.#pending = false;
      this.#debounce();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco (non a reconnect, che arriva con un cambio di lingua): un timer tardivo non disegna,
    // ma la ricerca che aspettava riparte se lo stesso elemento torna nel documento.
    if (this.#timer !== undefined) this.#pending = true;
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #setQuery(query: string): void {
    this.#query = query;
    this.#update();
    this.#debounce();
  }

  /** Come l'effetto [query, index, indexRevision] di React: la ricerca riparte dopo la pausa. */
  #debounce(): void {
    if (!this.isConnected) {
      this.#pending = true;
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (!this.isConnected || !this.#index) return;
      this.#results = this.#index.search(this.#query);
      this.#update();
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Un render alla volta, come albero e cronologia: uno chiesto da dentro (un listener) si ripete alla fine. */
  #update(): void {
    if (!this.#parts || !this.#i18n || !this.isConnected) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        this.#render(this.#parts, this.#i18n);
      } while (this.#again);
    } finally {
      this.#rendering = false;
    }
  }

  #onKeyDown(event: KeyboardEvent): void {
    // Invio non aspetta la pausa: cerca subito sulla query corrente.
    if (event.key === 'Enter') {
      const first = this.#index?.search(this.#query)[0];
      if (first) emit(this, 'hmd-search-open', { path: first.path, terms: first.terms });
    }
    if (event.key === 'Escape') {
      this.#parts!.input.value = '';
      this.#setQuery('');
    }
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { box, input, list } = parts;
    const t = i18n.t;
    toggleAttr(input, 'placeholder', true, t('search.placeholder'));
    toggleAttr(input, 'aria-label', true, t('search.label'));
    const items = searchItems(this.#query, this.#results);
    if (!items) {
      list.remove();
      return;
    }
    const hadFocus = list.contains(document.activeElement);
    toggleAttr(list, 'aria-label', true, t('search.results'));
    reconcileList(list, items, searchItemKey, (item) => this.#createRow(item), (li, item) => this.#updateRow(li, item, i18n));
    if (list.parentNode !== box) box.append(list);
    // Il risultato con il focus è sparito (file eliminato o non più trovato): il focus torna nella casella.
    if (hadFocus && !list.contains(document.activeElement)) input.focus();
  }

  #createRow(item: SearchItem): HTMLLIElement {
    if (item.kind === 'none') {
      const li = el('li', { class: 'none' });
      this.#rows.set(li, { item });
      return li;
    }
    const row: ResultRow = { item, title: el('span', { class: 'title' }), path: el('span', { class: 'path' }), snippet: el('span', { class: 'snippet' }) };
    const open = () => {
      if (row.item.kind === 'result') emit(this, 'hmd-search-open', { path: row.item.result.path, terms: row.item.result.terms });
    };
    const li = el('li', null, el('button', { class: 'result', on: { click: open } }, row.title, row.path, row.snippet));
    this.#rows.set(li, row);
    return li;
  }

  #updateRow(li: HTMLLIElement, item: SearchItem, i18n: I18nStore): void {
    const row = this.#rows.get(li)!;
    row.item = item;
    if (item.kind === 'none') {
      setText(li, i18n.t('search.none'));
      return;
    }
    const { title, path, snippet, terms } = item.result;
    setText(row.title!, title);
    setText(row.path!, path);
    const drawn = JSON.stringify([snippet, terms]);
    if (row.drawn === drawn) return;
    row.drawn = drawn;
    row.snippet!.replaceChildren(...segments(snippet, terms).map((part) => (part.mark ? el('mark', null, part.text) : part.text)));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-search-panel': HmdSearchPanel;
  }
}
```

`src/elements/search-panel/search-panel.css` (valori copiati da `SearchPanel.module.css`):

```css
@layer components {
  @scope (hmd-search-panel) {
    :scope {
      display: contents;
    }

    /* Valori copiati da SearchPanel.module.css. */
    .search {
      position: relative;
      padding: 8px 10px;
      border-bottom: 1px solid var(--c-border);
    }

    .input {
      width: 100%;
      font: inherit;
      padding: 6px 10px 6px 32px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: var(--c-surface);
      color: var(--c-text);
    }

    .searchIcon {
      position: absolute;
      left: 20px;
      top: 16px;
      color: var(--c-muted);
      pointer-events: none;
    }

    .results {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      max-height: 45vh;
      overflow-y: auto;
    }

    .none {
      color: var(--c-muted);
      padding: 6px 4px;
    }

    .result {
      display: grid;
      gap: 2px;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 6px;
      cursor: pointer;
    }

    .result:hover {
      background: var(--c-accent-soft);
    }

    .title {
      font-weight: 600;
    }

    .path,
    .snippet {
      font-size: 12px;
      color: var(--c-muted);
    }

    .snippet mark {
      background: var(--c-highlight);
      color: inherit;
    }
  }
}
```

Note per chi esegue:
- La query **non** è una proprietà: è del campo, che l'elemento crea una volta e non riscrive mai (solo Esc lo svuota). Niente `value` da fuori, quindi niente echi tardivi possibili.
- La pausa riparte a ogni battuta e a ogni `index`/`indexRevision` nuovo, come l'effetto di React; al primo montaggio non parte (la ricerca vuota di React dava `[]` e non cambiava nulla). Il timer si annulla in `disconnectedCallback` (non in `reconnect`, che arriva con un cambio di lingua) e il callback ricontrolla `isConnected`; se un timer era vivo, o se `#debounce` è chiamato da staccato, `#pending` lo fa ripartire in `connect` quando lo stesso elemento torna nel documento (review di Codex, F5: test «typed, detached before the pause…» e «a new index revision while detached…», che falliscono senza `#pending`). A `reconnect()` `#pending` è falso: un cambio di lingua non cerca (stesso test).
- Ogni render passa da `#update()` (setter, `#setQuery`, timer, `watch`): review di Codex, F1. Il test «a listener that empties the query from a focusout…» manda Esc dal `focusout` sincrono della riga col focus mentre `reconcileList` la rimuove: senza la guardia l'elenco resta attaccato con la query vuota.
- I risultati si riusano per percorso (`reconcileList`): un risultato con il focus che sale in cima si sposta con `moveBefore` e tiene il focus (e2e del Task 1; in jsdom `moveBefore` non c'è e il test jsdom lo prova solo senza spostamento).

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: `import { HmdSearchPanel } from './search-panel/search-panel.element';` dopo quello di `HmdPreview`, e dopo `['hmd-preview', HmdPreview],`:

```ts
  ['hmd-search-panel', HmdSearchPanel],
```

`src/elements/events.ts`, prima di `'hmd-start-pick'`:

```ts
  /** Ricerca: aprire un risultato (clic o Invio sul primo), con i termini da evidenziare nell'anteprima. */
  'hmd-search-open': CustomEvent<{ path: string; terms: string[] }>;
```

`src/elements/jsx.d.ts`: `import type { HmdSearchPanel, SearchSource } from './search-panel/search-panel.element';` dopo quello di `HmdPreview`, e prima di `'hmd-start-screen'`:

```ts
      'hmd-search-panel': HmdProps<{ index: SearchSource; indexRevision: number; i18n: I18nStore }, 'hmd-search-open'> & {
        ref?: Ref<HmdSearchPanel>;
      };
```

- [ ] **Step 5: `WorkspaceView.tsx` monta il tag**

Via `import { SearchPanel } from './SearchPanel';`; dopo `import type { HmdPreview } from '../elements/preview/preview.element';`:

```ts
import type { HmdSearchPanel } from '../elements/search-panel/search-panel.element';
```

`const searchRef = useRef<HTMLInputElement>(null);` → `const searchRef = useRef<HmdSearchPanel>(null);`; nella scorciatoia `search`, `requestAnimationFrame(() => searchRef.current?.focus());` → `requestAnimationFrame(() => searchRef.current?.focusInput());`; e `<SearchPanel ref={searchRef} index={workspace.search} indexRevision={state.indexRevision} onOpen={openFile} />` diventa:

```tsx
            <hmd-search-panel
              ref={searchRef}
              index={workspace.search}
              indexRevision={state.indexRevision}
              i18n={i18nStore}
              onhmd-search-open={(event) => void openFile(event.detail.path, event.detail.terms)}
            />
```

- [ ] **Step 6: Rovesciare il test del focus perso (decisione 3)**

In `e2e/search-live.spec.ts` il test

```ts
test('a result that disappears while it has the focus: where the focus goes', async ({ app, page }) => {
```

diventa

```ts
test('a result that disappears while it has the focus: the focus goes back to the box', async ({ app }) => {
```

e le sue ultime due righe

```ts
  // Difetto di oggi (React): il pulsante sparisce con il focus e il focus cade sul body. Il Task 3 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
```

diventano

```ts
  // Decisione 3: il focus torna nella casella, non sul body.
  await expect(box(app)).toBeFocused();
```

- [ ] **Step 7: Via `SearchPanel.tsx`, controlli**

```bash
git rm src/ui/SearchPanel.tsx src/ui/SearchPanel.module.css
grep -rnE "from '\./SearchPanel'|<SearchPanel[ />]|SearchPanel\.module\.css'" src; echo "exit $?"   # atteso: exit 1
grep -n "searchRef" src/ui/WorkspaceView.tsx   # useRef<HmdSearchPanel>, ref={searchRef}, focusInput()
```

- [ ] **Step 8: Verifica completa**

```bash
npm test                    # 808 + 17 = 825
npm run lint
npm run test:e2e            # 155, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/search.spec.ts e2e/search-live.spec.ts --repeat-each=5
npm run test:e2e:dev        # 140
npm run test:e2e:audit      # 84, nessuna differenza
```

- [ ] **Step 9: Commit**

```bash
git add src/elements/ src/ui/WorkspaceView.tsx e2e/search-live.spec.ts
git commit -m "feat: hmd-search-panel al posto di SearchPanel (campo mai ricreato, pausa di 120 ms, focus stabile)"
```

---

### Task 4: `hmd-history-panel`

**Files:**
- Create: `src/elements/history-panel/historyView.ts`, `historyView.test.ts`, `history-panel.element.ts`, `history-panel.css`, `history-panel.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `e2e/history-live.spec.ts` (un test rovesciato)
- Delete: `src/ui/HistoryPanel.tsx`, `src/ui/HistoryPanel.module.css`

**Interfaces:**
- Consumes: `diffRows`, `isIdentical`, `DiffRow` (`src/history/diffRows.ts`); `Snapshot` (`src/history/historyStore.ts`); `formatRelative` (`src/i18n/i18n.ts`); `HmdElement`, `el`, `setText`, `toggleAttr`, `reconcileList`, `icon`; `emit`; `countListeners`; lo schema del Task 2 (`#update()`, focus stabile).
- Produces:
  - `MARK`, `type VersionItem`, `type DiffView`, `versionItems(versions: readonly Snapshot[] | null): VersionItem[]`, `versionItemKey(item: VersionItem): string`, `diffView(versions: readonly Snapshot[] | null, selected: number | null, currentText: string): DiffView` da `historyView.ts`
  - `interface HistorySource { subscribe(listener: () => void): () => void; getState(): { indexRevision: number }; listHistory(path: string): Promise<Snapshot[]> }` (il `Workspace` la soddisfa) e `class HmdHistoryPanel` con proprietà `workspace: HistorySource | null`, `path: string`, `currentText: string`, `i18n: I18nStore | null`; eventi `hmd-history-restore` `{ id: number }`, `hmd-history-close`

- [ ] **Step 1: Test che falliscono**

`src/elements/history-panel/historyView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { Snapshot } from '../../history/historyStore';
import { diffView, versionItemKey, versionItems } from './historyView';

const snap = (id: number, text: string): Snapshot => ({ id, workspaceId: 'w', path: 'a.md', savedAt: id * 1000, text, reason: 'save' });

test('while loading the list is one "loading" row; then one row per version, keyed by id', () => {
  assert.deepEqual(versionItems(null), [{ kind: 'loading' }]);
  const items = versionItems([snap(2, 'b'), snap(1, 'a')]);
  assert.deepEqual(items.map(versionItemKey), ['v:2', 'v:1']);
  assert.notEqual(versionItemKey({ kind: 'loading' }), versionItemKey(items[0]));
});

test('no selection, or a selection that is not in the list: pick a version', () => {
  assert.deepEqual(diffView([snap(1, 'a')], null, 'a'), { kind: 'pick' });
  assert.deepEqual(diffView([snap(1, 'a')], 7, 'a'), { kind: 'pick' });
  assert.deepEqual(diffView(null, 1, 'a'), { kind: 'pick' });
});

test('a version equal to the current text (line endings aside) is identical', () => {
  assert.deepEqual(diffView([snap(1, 'a\r\nb')], 1, 'a\nb'), { kind: 'identical' });
});

test('a different version gives the rows from the current text to the version', () => {
  const version = snap(1, 'one\ntwo');
  assert.deepEqual(diffView([version], 1, 'one\nthree'), {
    kind: 'diff',
    version,
    rows: [{ kind: 'same', text: 'one' }, { kind: 'removed', text: 'three' }, { kind: 'added', text: 'two' }],
  });
});
```

`src/elements/history-panel/history-panel.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { Snapshot } from '../../history/historyStore';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { HistorySource } from './history-panel.element';

const snap = (id: number, text: string, reason: Snapshot['reason'] = 'save'): Snapshot => ({
  id, workspaceId: 'w', path: 'note.md', savedAt: Date.parse('2026-10-01T08:00:00Z') + id * 60_000, text, reason,
});

test.afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Workspace finto: ogni richiesta resta in sospeso finché il test non la risolve, nell'ordine che vuole. */
function fakeWorkspace() {
  let state = { indexRevision: 1 };
  const listeners = new Set<() => void>();
  const requests: { path: string; resolve: (list: Snapshot[]) => void }[] = [];
  const workspace: HistorySource = {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getState: () => state,
    listHistory: (path) => new Promise((resolve) => requests.push({ path, resolve })),
  };
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const save = () => {
    state = { indexRevision: state.indexRevision + 1 };
    notify();
  };
  /** Una notifica che non cambia i salvataggi (una battuta, un toast). */
  const poke = notify;
  return { workspace, requests, save, poke, listeners: () => listeners.size };
}

function mount(path = 'note.md', currentText = 'v2') {
  const { store: i18n, listeners } = countListeners(
    createI18nStore({
      locale: 'en',
      messages: EN_MESSAGES,
      load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'history.restore': 'RIPRISTINA', 'history.title': 'STORIA {path}' } }),
      persist() {},
    }),
  );
  const ws = fakeWorkspace();
  const el = document.createElement('hmd-history-panel');
  el.workspace = ws.workspace;
  el.path = path;
  el.currentText = currentText;
  el.i18n = i18n;
  document.body.append(el);
  const restored: number[] = [];
  let closed = 0;
  el.addEventListener('hmd-history-restore', (event) => restored.push(event.detail.id));
  el.addEventListener('hmd-history-close', () => closed++);
  const versions = () => [...el.querySelectorAll<HTMLButtonElement>('.version')];
  const restore = () => el.querySelector<HTMLButtonElement>('.restore');
  return { el, i18n, listeners, ws, restored, closed: () => closed, versions, restore };
}

test('the same DOM as HistoryPanel.tsx: header with title and close, busy list while loading, the pick note', () => {
  const { el } = mount();
  const panel = el.querySelector('.panel')!;
  assert.deepEqual([...panel.children].map((c) => c.localName), ['header', 'ul', 'section']);
  assert.equal(el.querySelector('h2')!.textContent, 'History of note.md');
  const close = el.querySelector('.close')!;
  assert.equal(close.className, 'close tooltip');
  assert.equal(close.getAttribute('aria-label'), EN_MESSAGES['history.close']);
  assert.equal(close.getAttribute('data-tooltip'), EN_MESSAGES['history.close']);
  const list = el.querySelector('ul')!;
  assert.equal(list.getAttribute('aria-busy'), 'true');
  assert.equal(list.textContent, EN_MESSAGES['history.loading']);
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.pick']);
});

test('the versions arrive: one button each with date and reason; an empty history says so', async () => {
  const first = mount();
  first.ws.requests[0].resolve([snap(2, 'v2'), snap(1, 'v1', 'before-ai')]);
  await tick();
  assert.equal(first.el.querySelector('ul')!.getAttribute('aria-busy'), 'false');
  assert.deepEqual(first.versions().map((b) => b.getAttribute('aria-pressed')), ['false', 'false']);
  assert.equal(first.versions()[1].querySelector('.reason')!.textContent, EN_MESSAGES['history.reason.before-ai']);
  assert.ok(first.versions()[0].firstElementChild!.textContent);
  first.el.remove();
  const second = mount();
  second.ws.requests[0].resolve([]);
  await tick();
  const panel = second.el.querySelector('.panel')!;
  assert.deepEqual([...panel.children].map((c) => c.localName), ['header', 'p', 'ul', 'section']);
  assert.equal(panel.children[1].textContent, EN_MESSAGES['history.empty']);
});

test('picking a version shows the diff from the current text, with Restore; an identical one says so', async () => {
  const { el, ws, versions, restore, restored } = mount('note.md', 'one\nthree');
  ws.requests[0].resolve([snap(2, 'one\nthree'), snap(1, 'one\ntwo')]);
  await tick();
  versions()[1].click();
  assert.deepEqual(versions().map((b) => b.getAttribute('aria-pressed')), ['false', 'true']);
  const lines = [...el.querySelectorAll<HTMLElement>('.line')];
  assert.deepEqual(lines.map((l) => [l.dataset.kind, l.textContent]), [['same', '  one\n'], ['removed', '− three\n'], ['added', '+ two\n']]);
  assert.equal(el.querySelector('section .note')!.textContent, EN_MESSAGES['history.legend']);
  restore()!.click();
  assert.deepEqual(restored, [1]);
  versions()[0].click();
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.identical']);
  assert.equal(restore(), null);
});

test('the diff follows the current text; Restore keeps its node (and its focus) while the text changes', async () => {
  const { el, ws, versions, restore } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  const button = restore()!;
  button.focus();
  el.currentText = 'c';
  assert.equal(restore(), button);
  assert.equal(document.activeElement, button);
  assert.equal(el.querySelectorAll('.line')[0].textContent, '− c\n');
});

test('a workspace notification that changes nothing keeps the diff rows (and a text selection in them); no new diff', async () => {
  const { el, ws, versions } = mount('note.md', 'a\nb');
  // Conta le letture del testo della versione: il diff lo legge solo quando si ricalcola.
  let reads = 0;
  const version = snap(1, 'a\nc');
  const text = version.text;
  Object.defineProperty(version, 'text', { get: () => (reads++, text) });
  ws.requests[0].resolve([version]);
  await tick();
  versions()[0].click();
  const lines = el.querySelector('.lines')!;
  const first = lines.firstChild;
  const before = reads;
  assert.ok(before > 0);
  ws.poke();
  ws.poke();
  assert.equal(lines.firstChild, first);
  assert.equal(reads, before);
  el.currentText = 'a\nd';
  assert.notEqual(lines.firstChild, first);
  assert.equal(el.querySelectorAll('.line')[1].textContent, '− d\n');
});

test('Restore disappears with the focus (identical text): the focus goes to the chosen version (decision 3)', async () => {
  const { el, ws, versions, restore } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  restore()!.focus();
  el.currentText = 'b';
  assert.equal(restore(), null);
  assert.equal(document.activeElement, versions()[0]);
});

test('a save reloads the list (new version on top); a notification without a save does not', async () => {
  const { ws, versions } = mount();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  ws.save();
  assert.equal(ws.requests.length, 2);
  ws.requests[1].resolve([snap(2, 'v2'), snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 2);
});

test('a late answer for an older request or another file is dropped; a new path starts from loading', async () => {
  const { el, ws, versions } = mount();
  ws.save();
  // Arriva prima la risposta nuova, poi quella vecchia: resta la nuova.
  ws.requests[1].resolve([snap(2, 'v2'), snap(1, 'v1')]);
  await tick();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 2);
  versions()[0].click();
  el.path = 'other.md';
  assert.equal(el.querySelector('ul')!.getAttribute('aria-busy'), 'true');
  assert.equal(el.querySelector('h2')!.textContent, 'History of other.md');
  assert.equal(ws.requests[2].path, 'other.md');
  ws.requests[2].resolve([]);
  await tick();
  assert.equal(el.querySelector('section')!.textContent, EN_MESSAGES['history.pick']);
});

test('a request still pending when the workspace goes away and the path changes is dropped', async () => {
  const { el, ws, versions } = mount();
  el.workspace = null;
  el.path = 'b.md';
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(el.querySelector('h2')!.textContent, 'History of b.md');
  assert.equal(versions().length, 0);
  assert.equal(el.querySelector('ul')!.getAttribute('aria-busy'), 'true');
});

test('a request still pending when the workspace changes is dropped, the new workspace is asked', async () => {
  const { el, ws, versions } = mount();
  const other = fakeWorkspace();
  el.workspace = other.workspace;
  assert.equal(other.requests.length, 1);
  ws.requests[0].resolve([snap(1, 'old'), snap(2, 'old')]);
  await tick();
  assert.equal(versions().length, 0);
  other.requests[0].resolve([snap(3, 'new')]);
  await tick();
  assert.equal(versions().length, 1);
});

test('an answer arriving after detaching does nothing; no listener left', async () => {
  const { el, ws, listeners, versions } = mount();
  el.remove();
  ws.requests[0].resolve([snap(1, 'v1')]);
  await tick();
  assert.equal(versions().length, 0);
  assert.equal(listeners(), 0);
  assert.equal(ws.listeners(), 0);
});

test('close sends hmd-history-close; language change relabels title and Restore', async () => {
  const { el, i18n, ws, versions, restore, closed } = mount('note.md', 'a');
  ws.requests[0].resolve([snap(1, 'b')]);
  await tick();
  versions()[0].click();
  (el.querySelector('.close') as HTMLButtonElement).click();
  assert.equal(closed(), 1);
  await i18n.setLocale('it');
  assert.equal(el.querySelector('h2')!.textContent, 'STORIA note.md');
  assert.equal(restore()!.textContent, 'RIPRISTINA');
  // Il cambio di lingua non richiede di nuovo l'elenco.
  assert.equal(ws.requests.length, 1);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/history-panel/historyView.test.ts src/elements/history-panel/history-panel.dom.test.ts`
Expected: FAIL: `Cannot find module './historyView'`; nel secondo file `TypeError: Cannot read properties of null` (niente `.panel`).

- [ ] **Step 3: Logica pura, elemento e foglio**

`src/elements/history-panel/historyView.ts`:

```ts
import { diffRows, isIdentical, type DiffRow } from '../../history/diffRows';
import type { Snapshot } from '../../history/historyStore';

/** Segno davanti a ogni riga del diff (il testo resta testo: nodi di testo, mai HTML). */
export const MARK: Record<DiffRow['kind'], string> = { added: '+ ', removed: '− ', same: '  ' };

/** Voce dell'elenco delle versioni: una versione, oppure «caricamento…» finché l'elenco non arriva. */
export type VersionItem = { kind: 'version'; version: Snapshot } | { kind: 'loading' };

/** Cosa mostra la sezione sotto l'elenco: invito a scegliere, testo identico, o diff con «Ripristina». */
export type DiffView = { kind: 'pick' } | { kind: 'identical' } | { kind: 'diff'; version: Snapshot; rows: DiffRow[] };

export function versionItems(versions: readonly Snapshot[] | null): VersionItem[] {
  return versions === null ? [{ kind: 'loading' }] : versions.map((version) => ({ kind: 'version', version }));
}

export const versionItemKey = (item: VersionItem): string => (item.kind === 'loading' ? 'loading' : `v:${item.version.id}`);

/** La sezione del diff per la versione scelta (cercata nell'elenco: una versione sparita torna all'invito). */
export function diffView(versions: readonly Snapshot[] | null, selected: number | null, currentText: string): DiffView {
  const version = versions?.find((v) => v.id === selected) ?? null;
  if (!version) return { kind: 'pick' };
  const rows = diffRows(currentText, version.text);
  return isIdentical(rows) ? { kind: 'identical' } : { kind: 'diff', version, rows };
}
```

`src/elements/history-panel/history-panel.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { Snapshot } from '../../history/historyStore';
import { formatRelative } from '../../i18n/i18n';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { MARK, diffView, versionItemKey, versionItems, type DiffView, type VersionItem } from './historyView';
import './history-panel.css';

/** Ciò che il pannello chiede al Workspace: le versioni di un file e il contatore dei salvataggi. */
export interface HistorySource {
  subscribe(listener: () => void): () => void;
  getState(): { indexRevision: number };
  listHistory(path: string): Promise<Snapshot[]>;
}

interface Parts {
  panel: HTMLDivElement;
  title: HTMLHeadingElement;
  close: HTMLButtonElement;
  empty: HTMLParagraphElement;
  list: HTMLUListElement;
  diff: HTMLElement;
  note: HTMLParagraphElement;
  lines: HTMLPreElement;
  restore: HTMLButtonElement;
}

/** Nodi di una riga dell'elenco; `item` è l'ultimo ricevuto (il clic lo legge al momento). */
interface VersionRow {
  item: VersionItem;
  button?: HTMLButtonElement;
  when?: HTMLSpanElement;
  reason?: HTMLSpanElement;
}

/**
 * Cronologia del file aperto (era HistoryPanel.tsx): elenco delle versioni, diff dal testo attuale alla
 * versione scelta, «Ripristina» (che il workspace applica come transazione dell'editor, annullabile).
 * L'elenco si ricarica a ogni salvataggio (indexRevision) e al cambio di file; una risposta superata da
 * una richiesta più nuova, o arrivata dopo il distacco, si scarta.
 */
export class HmdHistoryPanel extends HmdElement {
  #workspace: HistorySource | null = null;
  #path = '';
  #currentText = '';
  #i18n: I18nStore | null = null;

  #parts: Parts | null = null;
  #rows = new WeakMap<Element, VersionRow>();
  #versionButtons = new Map<number, HTMLButtonElement>();
  #versions: Snapshot[] | null = null;
  #selected: number | null = null;
  /** Versione del diff mostrato, per «Ripristina». */
  #shown: number | null = null;
  /** Ultimo elenco chiesto (file e salvataggi): una notifica del workspace che non lo cambia non ricarica. */
  #loaded: { path: string; revision: number } | null = null;
  #request = 0;
  /**
   * Ultimo diff calcolato e per cosa (come useMemo di React): elenco, scelta e testo uguali → stesso diff e
   * stesse righe nel DOM, così una notifica qualsiasi non toglie una selezione fatta nel diff.
   */
  #diff: { versions: Snapshot[] | null; selected: number | null; currentText: string; view: DiffView } | null = null;
  #rendering = false;
  #again = false;

  get workspace(): HistorySource | null { return this.#workspace; }
  set workspace(value: HistorySource | null) {
    value ??= null;
    if (value === this.#workspace) return;
    this.#workspace = value;
    this.#loaded = null;
    // Una risposta del workspace di prima non vale più, anche se ora non parte nessuna richiesta (null).
    this.#request++;
    this.reconnect();
  }
  get path(): string { return this.#path; }
  set path(value: string) {
    value ??= '';
    if (value === this.#path) return;
    this.#path = value;
    // Cambio di file: l'elenco del file di prima non resta visibile mentre arriva quello nuovo.
    this.#versions = null;
    this.#selected = null;
    // Una risposta per il file di prima non vale più, anche se una nuova non può partire (niente workspace).
    this.#request++;
    this.#reload();
    this.#update();
  }
  get currentText(): string { return this.#currentText; }
  set currentText(value: string) {
    value ??= '';
    if (value === this.#currentText) return;
    this.#currentText = value;
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
      const title = el('h2', { class: 'title' });
      const close = el('button', { class: 'close tooltip', on: { click: () => emit(this, 'hmd-history-close', null) } }, icon('close'));
      const restore = el('button', {
        class: 'restore',
        on: { click: () => this.#shown !== null && emit(this, 'hmd-history-restore', { id: this.#shown }) },
      });
      const note = el('p', { class: 'note' });
      const parts: Parts = {
        panel: el('div', { class: 'panel' }),
        title,
        close,
        empty: el('p', { class: 'note' }),
        list: el('ul', { class: 'list' }),
        diff: el('section', { class: 'diff' }),
        note,
        lines: el('pre', { class: 'lines' }),
        restore,
      };
      parts.panel.append(el('header', { class: 'header' }, title, close), parts.list, parts.diff);
      this.append(parts.panel);
      this.#parts = parts;
    }
    const { workspace, i18n } = { workspace: this.#workspace, i18n: this.#i18n };
    if (i18n) this.watch(i18n, () => this.#update(), signal);
    // Ogni notifica ridisegna (le date relative si ricalcolano, come a ogni render di React); ricarica
    // solo se è cambiato il contatore dei salvataggi.
    if (workspace) this.watch(workspace, () => (this.#reload(), this.#update()), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco: una risposta in arrivo non tocca più nulla; ricollegato, l'elenco si richiede.
    this.#request++;
    this.#loaded = null;
  }

  #reload(): void {
    const workspace = this.#workspace;
    if (!workspace || !this.isConnected) return;
    const path = this.#path;
    const revision = workspace.getState().indexRevision;
    if (this.#loaded?.path === path && this.#loaded.revision === revision) return;
    this.#loaded = { path, revision };
    const request = ++this.#request;
    void workspace.listHistory(path).then((list) => {
      if (request !== this.#request) return;
      this.#versions = list;
      this.#update();
    });
  }

  #update(): void {
    if (!this.#parts || !this.#i18n || !this.isConnected) return;
    if (this.#rendering) {
      this.#again = true;
      return;
    }
    this.#rendering = true;
    try {
      do {
        this.#again = false;
        this.#render(this.#parts, this.#i18n);
      } while (this.#again);
    } finally {
      this.#rendering = false;
    }
  }

  #render(parts: Parts, i18n: I18nStore): void {
    const { panel, title, close, empty, list, diff, note, lines, restore } = parts;
    const t = i18n.t;
    const hadFocus = panel.contains(document.activeElement);
    setText(title, t('history.title', { path: this.#path }));
    toggleAttr(close, 'aria-label', true, t('history.close'));
    toggleAttr(close, 'data-tooltip', true, t('history.close'));

    const versions = this.#versions;
    if (versions !== null && versions.length === 0) {
      setText(empty, t('history.empty'));
      if (empty.parentNode !== panel) list.before(empty);
    } else {
      empty.remove();
    }
    list.setAttribute('aria-busy', String(versions === null));
    const now = new Date();
    const locale = i18n.getState().locale;
    this.#versionButtons.clear();
    reconcileList(list, versionItems(versions), versionItemKey, (item) => this.#createRow(item), (li, item) => {
      const row = this.#rows.get(li)!;
      row.item = item;
      if (item.kind === 'loading') {
        setText(li, t('history.loading'));
        return;
      }
      const { id, savedAt, reason } = item.version;
      row.button!.setAttribute('aria-pressed', String(id === this.#selected));
      setText(row.when!, formatRelative(locale, new Date(savedAt), now));
      setText(row.reason!, t(`history.reason.${reason}`));
      this.#versionButtons.set(id, row.button!);
    });

    const memo = this.#diff;
    const fresh = !memo || memo.versions !== versions || memo.selected !== this.#selected || memo.currentText !== this.#currentText;
    const view = fresh ? diffView(versions, this.#selected, this.#currentText) : memo.view;
    if (fresh) {
      this.#diff = { versions, selected: this.#selected, currentText: this.#currentText, view };
      if (view.kind === 'diff') lines.replaceChildren(...view.rows.map((row) => el('span', { class: 'line', dataset: { kind: row.kind } }, MARK[row.kind], row.text, '\n')));
    }
    this.#shown = view.kind === 'diff' ? view.version.id : null;
    setText(note, t(view.kind === 'pick' ? 'history.pick' : view.kind === 'identical' ? 'history.identical' : 'history.legend'));
    if (view.kind === 'diff') setText(restore, t('history.restore'));
    const children = view.kind === 'diff' ? [note, lines, restore] : [note];
    // Solo se cambia la forma: riappendere «Ripristina» gli toglierebbe il focus.
    if (diff.children.length !== children.length || children.some((child, i) => diff.children[i] !== child)) diff.replaceChildren(...children);

    // Il nodo con il focus è sparito («Ripristina» dopo un ripristino, che rende il testo identico):
    // il focus va sulla versione scelta, o sul pulsante di chiusura.
    if (hadFocus && !panel.contains(document.activeElement)) (this.#versionButtons.get(this.#selected ?? NaN) ?? close).focus();
  }

  #createRow(item: VersionItem): HTMLLIElement {
    if (item.kind === 'loading') {
      const li = el('li', { class: 'note' });
      this.#rows.set(li, { item });
      return li;
    }
    const row: VersionRow = { item, when: el('span'), reason: el('span', { class: 'reason' }) };
    row.button = el(
      'button',
      {
        class: 'version',
        on: {
          click: () => {
            if (row.item.kind !== 'version') return;
            this.#selected = row.item.version.id;
            this.#update();
          },
        },
      },
      row.when,
      row.reason,
    );
    const li = el('li', null, row.button);
    this.#rows.set(li, row);
    return li;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-history-panel': HmdHistoryPanel;
  }
}
```

`src/elements/history-panel/history-panel.css` (valori copiati da `HistoryPanel.module.css`):

```css
@layer components {
  @scope (hmd-history-panel) {
    :scope {
      display: contents;
    }

    /* Valori copiati da HistoryPanel.module.css. */
    .panel {
      height: 100%;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      background: var(--c-surface);
      min-height: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--c-border);
    }

    .title {
      flex: 1;
      margin: 0;
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .close {
      background: none;
      border: none;
      border-radius: 6px;
      width: 30px;
      height: 30px;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      color: var(--c-text);
    }

    .list {
      list-style: none;
      margin: 0;
      padding: 6px;
      max-height: 30vh;
      overflow-y: auto;
      border-bottom: 1px solid var(--c-border);
    }

    .version {
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      text-align: left;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
    }

    .version:hover,
    .version[aria-pressed='true'] {
      background: var(--c-accent-soft);
    }

    .reason {
      color: var(--c-muted);
      font-size: 13px;
    }

    .diff {
      overflow: auto;
      padding: 8px 12px 24px;
      min-height: 0;
    }

    .note {
      color: var(--c-muted);
      margin: 4px 0 8px;
    }

    .lines {
      margin: 0 0 12px;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .line[data-kind='added'] {
      background: color-mix(in srgb, var(--c-accent) 18%, transparent);
    }

    .line[data-kind='removed'] {
      background: color-mix(in srgb, var(--c-danger) 18%, transparent);
      text-decoration: line-through;
    }

    .restore {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
    }
  }
}
```

Note per chi esegue:
- Come `useWorkspaceState` di React, **ogni** notifica del workspace ridisegna (le date relative si ricalcolano con un `now` nuovo); l'elenco si richiede solo se cambiano file o `indexRevision` (`#loaded`), così un cambio di lingua (`reconnect`) o una battuta non rifanno la richiesta.
- `#request` scarta una risposta superata (più richieste in volo, arrivo fuori ordine), una risposta per il file di prima e una risposta dopo il distacco (`disconnectedCallback` incrementa il contatore e dimentica `#loaded`, così un elemento ricollegato richiede di nuovo).
- Il diff si memorizza per elenco, versione scelta e `currentText` (`#diff`, come `useMemo` di React): solo allora `diffRows` si ricalcola e `.lines` si ricostruisce. Il test «a workspace notification that changes nothing…» conta le letture del testo della versione e controlla che `lines.firstChild` resti lo stesso nodo (è ciò che conserva una selezione): senza la memoria fallisce (review di Codex, F2).
- `#request++` nei setter di `path` e `workspace`, anche quando non parte una richiesta nuova (`workspace = null`): test «a request still pending when the workspace goes away…», che senza mostra le versioni di `note.md` sotto «Cronologia di b.md» (review di Codex, F4). Mai dentro `#reload`, che gira a ogni notifica.
- «Ripristina» e la nota si riusano: la sezione del diff si riscrive solo se ne cambia la forma (scegli / identica / diff), altrimenti `replaceChildren` toglierebbe il focus a «Ripristina» a ogni battuta nell'editor (test jsdom).

- [ ] **Step 4: Registrazione, eventi, tipi**

`src/elements/define.ts`: `import { HmdHistoryPanel } from './history-panel/history-panel.element';` dopo quello di `HmdFileTree`, e dopo `['hmd-frontmatter-card', HmdFrontmatterCard],`:

```ts
  ['hmd-history-panel', HmdHistoryPanel],
```

`src/elements/events.ts`, prima di `'hmd-params-change'`:

```ts
  /** Cronologia: chiudere il pannello. */
  'hmd-history-close': CustomEvent<null>;
  /** Cronologia: ripristinare la versione `id` (il workspace la applica come transazione dell'editor, annullabile). */
  'hmd-history-restore': CustomEvent<{ id: number }>;
```

`src/elements/jsx.d.ts`: `import type { Ref } from 'react';` → `import type { Key, Ref } from 'react';`; `import type { HistorySource } from './history-panel/history-panel.element';` dopo quello di `HmdEvents`; e dopo la voce `'hmd-file-tree'`:

```ts
      'hmd-history-panel': HmdProps<
        { workspace: HistorySource; path: string; currentText: string; i18n: I18nStore },
        'hmd-history-close' | 'hmd-history-restore'
      > & { key?: Key };
```

(`key` va dichiarata: gli `IntrinsicAttributes` di React non valgono per i tag intrinseci; misurato con `tsc`.)

- [ ] **Step 5: `WorkspaceView.tsx` monta il tag**

Via `import { HistoryPanel } from './HistoryPanel';`; il blocco `<HistoryPanel key={doc.path} … onRestore={restoreVersion} onClose={() => setHistoryOpen(false)} />` diventa:

```tsx
                <hmd-history-panel
                  key={doc.path}
                  workspace={workspace}
                  path={doc.path}
                  currentText={doc.text}
                  i18n={i18nStore}
                  onhmd-history-restore={(event) => restoreVersion(event.detail.id)}
                  onhmd-history-close={() => setHistoryOpen(false)}
                />
```

`restoreVersion` (con il ripristino in coda dalla sola anteprima) non cambia.

- [ ] **Step 6: Rovesciare il test del focus perso (decisione 3)**

In `e2e/history-live.spec.ts` il test

```ts
test('after Restore the button disappears (identical text): where the focus goes', async ({ app, page }) => {
```

diventa

```ts
test('after Restore the button disappears (identical text): the focus goes to the chosen version', async ({ app }) => {
```

e le sue ultime due righe

```ts
  // Difetto di oggi (React): il pulsante sparisce con il focus e il focus cade sul body. Il Task 4 lo rovescia (decisione 3).
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
```

diventano

```ts
  // Decisione 3: il focus va sulla versione scelta, non sul body.
  await expect(versions(app).nth(1)).toBeFocused();
```

- [ ] **Step 7: Via `HistoryPanel.tsx`, controlli**

```bash
git rm src/ui/HistoryPanel.tsx src/ui/HistoryPanel.module.css
grep -rnE "from '\./(FileTree|SearchPanel|HistoryPanel)'|<(FileTree|SearchPanel|HistoryPanel)[ />]|(FileTree|SearchPanel|HistoryPanel)\.module\.css'" src; echo "exit $?"   # atteso: exit 1
grep -n "useWorkspaceState" src/ui/WorkspaceView.tsx   # resta: lo usa ancora WorkspaceView
```

- [ ] **Step 8: Verifica completa**

```bash
npm test                    # 825 + 16 = 841
npm run lint
npm run test:e2e            # 155, snapshot invariati
npx playwright test -c e2e/playwright.config.ts e2e/history.spec.ts e2e/history-live.spec.ts --repeat-each=5
npm run test:e2e:dev        # 140
npm run test:e2e:audit      # 84, nessuna differenza
```

- [ ] **Step 9: Commit**

```bash
git add src/elements/ src/ui/WorkspaceView.tsx e2e/history-live.spec.ts
git commit -m "feat: hmd-history-panel al posto di HistoryPanel (risposte superate scartate, Ripristina che tiene il focus)"
```

---

### Task 5: Documenti, misure, chiusura

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1 (prototipo: 436 849)
npm test                                    # annotare: 841
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: «fasi 5a e 5b in `main` (merge del 09/10, dal branch `feat/web-components`); fasi 6–8 ancora piano» → «fasi 5a e 5b in `main` (merge del 09/10, dal branch `feat/web-components`); fase 6a sul branch `feat/web-components`, in `main` al merge della sotto-fase; fasi 6b–8 ancora piano».
2. §7 «Fase 6: pannelli e AI (branch)», prima del primo punto: «Divisa in tre piani: 6a (piano 10: albero, ricerca, cronologia), 6b (selettore e chip del modello, composer, sidebar AI: condividono `Composer.module.css`), 6c (barra e vista della revisione: condividono `ReviewView.module.css`; corregge il focus perso da «Scarta» dopo un «Accetta tutto» completo).»
3. In fondo a §7 fase 6: «- 6a **fatta**: `hmd-file-tree` (eventi `hmd-open`, `hmd-tree-action`; `<details>` nativo, tutte le righe nel DOM anche nelle cartelle chiuse, un solo tab stop e menu da tastiera con `ui/treeNav.ts` com'era, menu ⋯ `popover="auto"` ancorato al pulsante con `anchor-name`; logica in `file-tree/treeView.ts`), `hmd-search-panel` (`focusInput()`, evento `hmd-search-open` con i termini; campo creato una volta e mai riscritto, pausa di 120 ms, `segments()` → `<mark>`; `search-panel/searchView.ts`), `hmd-history-panel` (eventi `hmd-history-restore`, `hmd-history-close`; ingresso `workspace` come `HistorySource`; risposte di `listHistory` superate o tardive scartate; `history-panel/historyView.ts`). I setter disegnano subito, con un render alla volta (`#update()` e `#rendering`); la pausa della ricerca interrotta dal distacco riparte al ricollegamento; il diff della cronologia è memorizzato come con `useMemo`. Cambiato di proposito (decisione 3 del piano 10): quando il nodo con il focus sparisce il focus va sulla riga col tab stop, nel campo di ricerca o sulla versione scelta, non più sul `body`. Audit esteso a righe con bozza/asset/cartella vuota, passaggio e focus da tastiera sulle righe, risultati, nessun risultato, cronologia vuota e identica. Bundle principale gzip: <valore del Task 1> → <valore dello Step 1> B.» (sostituire i due valori con i numeri annotati).
4. §8.2, nel paragrafo «Limiti di jsdom 30.1.1…», la frase «che `moveBefore` lo conservi si verifica solo in Chromium, con gli e2e della fase 6 su albero e ricerca.» diventa «che `moveBefore` lo conservi si verifica solo in Chromium: lo prova `e2e/search-live.spec.ts` («a focused result that moves up…», che senza `moveBefore` fallisce; fase 6a); nell'albero le righe esistenti non si riordinano mai con il focus dentro.»
5. §13: aggiungere `docs/superpowers/plans/2026-10-10-housemd-wc-10-fase-6a-pannelli-del-workspace.md` (fase 6a) dopo il piano 9.

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
git commit -m "docs: spec allineato alla fase 6a (albero, ricerca, cronologia)"
```

- [ ] **Step 5: Chiusura (controller, non l'implementer)**

Nell'ordine: review finale dell'intero diff del branch rispetto a `main`; `/codex-review-chat` sul diff (escludendo `docs/superpowers/plans`); checklist manuale (Step 6); solo con tutto pulito, merge in `main` e push:

```bash
cd /home/davidedipumpo/Projects/housemd && git status --short   # pulito
git merge --no-ff feat/web-components -m "Merge: fase 6a Web Components (albero, ricerca, cronologia)"
npm test && npm run lint
git push origin main
cd ../housemd-wc && git merge --ff-only main && git push origin feat/web-components
```

- [ ] **Step 6: Checklist manuale** (Chrome su Linux, server di sviluppo del worktree con `npx vite --port 5197 --strictPort --host 127.0.0.1`, quindi con StrictMode; cartella di prova in OPFS con sottocartelle, immagini, cartella vuota, file con frontmatter). Le schede di Claude in Chrome sono `visibilityState: hidden`: niente `requestAnimationFrame`, quindi il focus sulla prima voce del menu ⋯ e Ctrl+K vanno provati in una finestra visibile (o da Davide).
  1. Albero: apri e chiudi cartelle con il clic e con le frecce; un solo tab stop (Tab entra sul file aperto, Shift+Tab torna all'ultima riga col focus); ⋯ con il mouse, Invio sul ⋯, Shift+F10 e tasto Menu; Esc e clic fuori riportano il focus; il clic destro non apre nulla; menu vicino al bordo inferiore e destro (si capovolge).
  2. Nuovo file e nuova cartella dalla testata e dal menu di una cartella; rinomina (nome preselezionato senza `.md`), elimina con conferma; nome già esistente; dopo eliminazione e rinomina il focus è nell'albero, non sul `body`.
  3. Pallino della bozza con l'autosalvataggio spento; immagini visibili ma non apribili; «cartella vuota» e «nessun file markdown»; aprendo un file annidato dalla ricerca la cartella si apre, richiusa resta chiusa.
  4. Ricerca: Ctrl+K anche dalla modalità AI e con la sidebar chiusa; risultati con evidenziazione, Invio sul primo, Tab + Invio su un risultato, Esc; scrivere veloce non perde caratteri; un file modificato fuori che compare o sparisce dai risultati; evidenziazione nell'anteprima del file aperto.
  5. Cronologia: dalla barra e dal menu ⋯ del file; elenco, diff, versione identica, cronologia vuota; ripristino annullabile con Ctrl+Z, anche dalla sola anteprima; cambio di file con il pannello aperto; un salvataggio aggiunge la versione in cima; dopo «Ripristina» il focus è sulla versione scelta.
  6. Cambio di lingua a caldo: etichette di albero, menu, ricerca, cronologia (date relative comprese) nella lingua nuova; ordine dei nomi secondo la lingua.
  7. Tastiera e screen reader: focus ring sulle righe, sul ⋯, sui risultati e sulle versioni; `forced-colors`; tooltip al focus dei ⋯ e di «Chiudi»; tema chiaro, scuro e automatico.
