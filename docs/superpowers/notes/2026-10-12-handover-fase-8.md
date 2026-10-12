# Handover migrazione Web Components — fase 7 fatta, prossimo piano 8 (12/10/2026)

## Stato

- Fase 7 in due PR verso `epic/LAB-3-web-components`: 7a = #10 (impostazioni, già mergiata, `74aeabc`), 7b = #11, branch `lab/LAB-5-fase-7b` (workspace, app, via React). In `main` solo al merge dell'epica (Davide).
- Suite sul commit finale della 7b: `npm test` 1045 (1043 del Task 7 + 2 della correzione della review), `npm run test:e2e` 202 (200 verdi + i 2 snapshot dello start screen già noti), `npm run test:e2e:dev` 187, `npm run test:e2e:audit` 136. Tutte con 2 worker nel lock di Lab, nessuna caduta per memoria.
- Bundle principale gzip (`gzip -c dist/assets/index-*.js | wc -c`): **379 234 B**. Inizio fase 441 143 B (−61 909 B), fase 3 con React 19 432 419 B (−53 185 B), fine 7a 444 254 B. La rimozione di React è già fatta: la fase 8 parte da questa misura.
- `dist-baseline/` = build React del Task 1 della fase 7, commit **`7aab561`** (`dist-baseline/BASELINE_SHA`). Invariata per tutta la fase: costruita una volta nel Task 1, copiata nella 7a dal checkout del Task 3 e nella 7b dal checkout del Task 6 e poi del Task 7, mai ricostruita dalla HEAD dell'epica (che ha già le impostazioni migrate). Con la fase 7 chiusa il riferimento dell'audit diventa la build di `epic/LAB-3-web-components` dopo il merge della 7b, **se** la fase 8 cambia l'aspetto di proposito; finché non cambia, resta questa. La cartella è fuori da git (`.gitignore`).
- Snapshot visivi invariati in tutta la fase.
- Spec: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 stato per fase, §11, §13). Ultimo piano eseguito: `2026-10-12-housemd-wc-13-fase-7-impostazioni-workspace-app.md` (paragrafi «Esecuzione»).
- In `src/` non c'è più né un `.tsx` né un `*.module.css`; `package.json` senza React; il test statico «niente React» di `architecture.test.ts` è un test normale.

## Cosa resta

| Fase | Contenuto |
|---|---|
| 8 | Rifinitura, passata di accessibilità (elenco sotto), bundle e tempo di avvio rispetto al baseline della fase 3, checklist §9 in Chrome ed Edge, richiesta di merge a Davide. |
| Dopo la migrazione | Rimuovere i toast (non accessibili) con un'alternativa accessibile: lavoro a sé. |

### Per la fase 8

- **Rilievi di A11y su LAB-42** ([LAB-42](mention://issue/01a12c56-3201-7335-9d5c-392665c5db19)), preesistenti su `main`:
  - **P1** (WCAG 2.2.2, 4.1.3): il contatore «Generating… N s» è una regione live che parla ogni secondo; annunciare un testo fisso e `n/m`, secondi in `aria-hidden` (barra della revisione e composer);
  - **P2** (WCAG 1.4.11): le icone `.icon` (maschera con `background-color: currentColor`) spariscono in forced-colors; `forced-color-adjust: none; background-color: CanvasText`;
  - **P3** (WCAG 4.1.2): `.cm-content` senza nome accessibile, in revisione e in modalità Editor;
  - **P4**: `ai.warningsCount` senza forma singolare («1 warnings»);
  - da LAB-42 anche P5–P12 della review della 7a (Esc nelle impostazioni con modifiche non salvate, focus dopo l'eliminazione di un profilo o preset, voce corrente in forced-colors, regioni `role="status"`, nome dei «Ripristina backup», focus dopo il salto dall'indice, `widthHint`).
- **Indice delle impostazioni.** L'indice resta su «Profili» quando si salta a «Sync»: le ultime sezioni non arrivano in cima alla pagina e non diventano «correnti» (comportamento già presente con React, portato uguale nella 7a; la causa non è stata indagata, il `padding` finale di 40vh non basta). Da rivedere con la regola di scelta della sezione corrente (per esempio: l'ultima quando si è in fondo allo scorrimento).
- **Sezioni senza nome accessibile.** Le sezioni di profili, preset e sync non hanno un nome accessibile (`<section>` senza `aria-label`/`aria-labelledby`): i test e2e le raggiungono con `#settings-ai-presets`, l'id usato dallo scorrimento, eccezione ammessa alla regola «solo ruolo e nome». Dare alle sezioni `aria-labelledby` verso il loro `h2` e **sostituire** `#settings-ai-presets` nei test con `getByRole('region', { name })`.
- **Regola «mai disabled»** (Davide, 11/10), da estendere a: Salva chiave senza chiave, Sincronizza ora durante una sync, il cambio di cartella durante un cambio (`folder.disabled = this.#switchingFolder` in `hmd-workspace`), la Cronologia senza documento, l'indirizzo per Anthropic (e dei provider cloud), più i pulsanti dei blocchi nel diff e i dialog. Il pulsante resta attivo e, attivato, dice perché in una nota `role="status"` accanto.
- **Toast che riavviano i timer.** `hmd-toasts` riceve un array nuovo a ogni cambio di toast, errore AI o lingua (decisione 10 della fase 7, come lo `useMemo` di React) e riavvia i timer di tutti i toast presenti. Difetto noto dalla 4a; sparisce con la rimozione dei toast.
- **I tre `!important`** di `src/elements/ai/diff-pane.css` (`position: static`, `background`, `cursor`) diventano `StyleModule` di CodeMirror; il quarto sta in `docAppearance()` (`src/editor/docExtensions.ts`). Layer `vendor` per gli stili di CodeMirror: vedi «Analisi del layer `vendor`» nel piano 6c.
- **Dal handover della 6c, ancora aperti:** Scarta = Ferma + scarta, doppio clic su Invia che ferma la richiesta, «Continua» durante un aggiornamento; rilievo WCAG 3.3.3 su «Open a document before sending» in modalità AI (LAB-10); rilievo WCAG 4.1.3 sulla nota `role="status"` della barra della revisione (LAB-11), con la decisione «Proposta pronta» se LAB-41 dice che il log non basta.
- **Prove a mano della 7a**, ancora aperte: [LAB-52](mention://issue/01a12d84-ed9c-7e67-a6f2-96b81dfa0cf0) (screen reader e contrasto elevato sulle impostazioni, a Davide). Per la 7b restano da provare a mano in Chrome ed Edge (checklist §9): sidebar nascosta e riaperta dopo un cambio esterno, cambio di cartella, ripresa all'avvio, tema con la view transition.

## Regola UX di Davide (11/10)

I pulsanti **non diventano mai `disabled`** (né `aria-disabled`). Quando l'azione non è possibile il pulsante resta attivo e, attivato, dice perché in una nota `role="status"` accanto (vuota di norma, svuotata quando la causa sparisce), mai in un toast né in un tooltip, focus che resta sul pulsante. Applicata nella 6b a Invia e Nuova chat, nella 6c alla barra della revisione e al composer; nella fase 7 **non** applicata di proposito (aspetto e comportamento invariati): da estendere nella fase 8, vedi sopra.

## Lezioni nuove della fase 7 (oltre a quelle dei handover 6c e 7, ancora valide)

- **Una chiave di memo per ogni vista derivata.** Albero e lista dei file condividevano `memo.entries`: con la sidebar nascosta l'albero non si ricostruiva e tornava vecchio. Se due calcoli dipendono dallo stesso ingresso ma girano in momenti diversi, ognuno ricorda il *suo* ingresso. Test con la sidebar nascosta e riaperta (`workspace.dom.test.ts`).
- **`:scope` contro la prossimità di `@scope`.** Una regola dentro `@scope (hmd-a)` raggiunge anche i campi dei figli; nel layer, a pari specificità, vince il foglio del figlio più vicino. Un `:scope` davanti alla regola aggiunge una classe di specificità e tiene il risultato di prima (decisione 3), senza `!important`.
- **`doc` nuovo a ogni render quando la vista dipende da uno stato esterno.** `hmd-ai-review` ricalcola `canAccept` solo quando riceve un `doc`; confrontare i campi la lasciava ferma (audit `ai-review-conflict`). Eccezione misurata alla regola «proprietà solo se cambiano».
- **Figli condizionali ricreati come React** (`#slot`): un `hmd-editor` riusato dopo il distacco cambierebbe tempi e focus rispetto a ciò che gli e2e e l'audit hanno sempre misurato.
- **La chiave API non è nel DOM serializzato**: l'elemento scrive solo la proprietà `value` del campo password. `controller.setSecret(` è ammesso solo in `profiles.element.ts` dal test statico (decisione 4), con un caso sintetico.
- **Dopo ogni `await` si ricontrolla lo stato di dismissione** (`openAiSession` con `signal`, `isConnected`), e un blocco «una alla volta» ha un token o un contatore di richiesta.
- **`HmdElement.watch()` rende subito**: niente render ridondanti in fondo a `connect()`; ogni render passa da `RenderLoop`; nessun evento si emette dentro `connect`.
- **L'hook `prepare-commit-msg` del daemon** aggiunge `Co-authored-by`: si committa con `git -c core.hooksPath=/dev/null commit …` e prima di ogni push si controlla `git log --format=%B -n <N>`.

## Trappole dell'ambiente

- RAM di ape: tutto Multica ha un tetto di 10 GB (rallenta sopra i 7). Test con browser: `E2E_WORKERS=2` (default) dentro il lock, variabili d'ambiente PRIMA di `flock`: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e`. Una suite alla volta; 1 worker solo se una suite cade per memoria, annotandolo. A fine suite `pgrep -af "vite|chrom|playwright"`, chiudere solo i PID propri, mai `pkill` per nome.
- **`node_modules` in un worktree nuovo:** un link simbolico verso un altro checkout fa cadere tutto `test:e2e:dev` (Vite risponde 403 ai file fuori dalla radice, 186 rossi su 187 per «errori o avvisi in console»). Serve una copia vera (`cp -a`) o `npm ci`.
- Instabilità note estranee: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog», `ai-composer.spec.ts` (riattivazione della cartella di sync, `Target page… closed`), gli stati di audit che fanno `page.reload()` (`start-resume`, `ai-sync-reactivate`, `orphans`). Ripetere da soli e annotare. Con `-g` l'audit fa comunque girare il progetto `baseline` (Playwright 1.63).
- I due snapshot dello start screen cadono su ape per il font pixel.
- Il trailer `Co-authored-by: multica-agent` compare in alcuni commit già pushati delle fasi precedenti: non si riscrive la storia, il PM lo esclude dal messaggio di merge.
