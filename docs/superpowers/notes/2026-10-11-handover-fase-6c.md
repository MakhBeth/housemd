# Handover migrazione Web Components — fase 6b fatta, prossimo piano 6c (11/10/2026)

## Stato

- `main` = `feat/web-components` = **26e0b52** (merge `--no-ff` della 6b, pushati entrambi l'11/10). Fasi 0–6b fatte e in main.
- Worktree di lavoro: `../housemd-wc` (branch `feat/web-components`), pulito. Repo principale `../housemd` (main), pulito. Worktree vecchi e inutili: `../housemd-fase2`, `../housemd-fase3` (branch già in main).
- Suite su HEAD: `npm test` 934, `npm run test:e2e` 176, `npm run test:e2e:dev` 161, `npm run test:e2e:audit` 104. Bundle principale gzip 439 695 B (`gzip -c dist/assets/index-*.js | wc -c`).
- `dist-baseline/` in `../housemd-wc` = build di 5f64e28 (dopo le due note della decisione 4): è il riferimento giusto per la 6c finché non cambia l'aspetto di proposito.
- Spec: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 stato per fase, §2 vincolo 4 «pulsanti mai disattivati», §13 elenco dei piani). Piani in `docs/superpowers/plans/`; l'ultimo eseguito è `2026-10-11-housemd-wc-11-fase-6b-composer-e-sidebar-ai.md` (sezione «Misure» con la review di Codex e il paragrafo «Esecuzione (11/10)»): è il **modello** per il piano 6c.

## Cosa resta

| Fase | Contenuto |
|---|---|
| **6c** (prossima) | `hmd-ai-review-bar` + `hmd-ai-review` (`src/ui/ai/ReviewBar.tsx`, `ReviewView.tsx`, `ReviewView.module.css`); fix del focus perso da «Scarta» dopo «Accetta tutto» completo (con test); regola «mai pulsanti disabled» applicata ai pulsanti della revisione; **ragioni dal controller** (sotto). Rivalutare il layer `vendor` per gli stili di CodeMirror (togliere i 3 `!important` dei pulsanti del merge) in 7/8. |
| 7 | SettingsView + sezioni AI (montano ancora `hmd-ai-model-select` e `hmd-ai-parameters`), WorkspaceView, App; `jsx.d.ts` sparisce. |
| 8 | Rifinitura e passata di accessibilità: regola «mai disabled» su tutta l'app (impostazioni, dialog), `anchor-scope` se mai due chip, mappa tipizzata al posto dei cast `as` nel `reconcileList` del chip, doppio clic su Invia che ferma la richiesta (nodo unico Invia/Stop). |
| Dopo la migrazione | **Rimuovere i toast** (non accessibili) con un'alternativa accessibile: lavoro a sé, non durante 6–8. |

### Da fare nella 6c per la regola «mai pulsanti disabled» (trovati dalla review finale della 6b, preesistenti)

1. Il controller scarta un invio senza dire perché (`src/ai/aiController.ts` ~83: nessun documento aperto, o `updating`): il composer svuota la casella e la bozza va persa senza nota. Serve che `send()` restituisca una ragione (o un `canSend()`), chiavi nuove (`ai.composer.noDocument`, `ai.composer.busy`, …), nota nel composer e bozza conservata.
2. Suggerimento cliccato durante una generazione: `sendPreset` torna in silenzio (`composer.element.ts`, guardia `running`): nota «busy».
3. Una nota ripetuta con lo stesso testo non viene ri-annunciata dallo screen reader (accettato nella 6b; da rivedere nella passata di accessibilità).
4. Verifiche non possibili da Claude in Chrome: screen reader (Orca/NVDA), `forced-colors`, focus ring: da fare a mano.

## Regola UX di Davide (11/10)

I pulsanti **non diventano mai `disabled`** (né `aria-disabled`). Quando l'azione non è possibile il pulsante resta attivo e, attivato, dice perché in una nota `role="status"` accanto (vuota di norma, svuotata quando la causa sparisce), mai in un toast né in un tooltip. Applicata nella 6b a Invia e Nuova chat (chiavi `ai.composer.needText`, `ai.composer.needProfile`, `ai.newChat.alreadyEmpty`); da estendere a 6c e fase 8.

## Flusso (confermato da Davide)

1. Piano (skill writing-plans, agente Opus con prototipo su copia del repo: `git worktree add --detach ../housemd-proto-6c main`, tutte le suite e la baseline) → `/codex-review-chat` sul piano (max 3 scambi; i rilievi li corregge l'agente autore, prototipo prima e piano poi) → mostrare a Davide piano, divisione, decisioni con raccomandazione → ok.
2. Esecuzione subagent-driven (skill superpowers:subagent-driven-development): ledger `.superpowers/sdd/<piano>/progress.md`, brief con `scripts/task-brief`, implementer Sonnet, review per task (Opus sugli elementi rischiosi), `scripts/review-package`. Parallelismo ammesso: review del task N insieme all'implementer del task N+1; implementer sempre uno alla volta; mai due suite e2e insieme (7 GB RAM).
3. Fine: review finale Opus dell'intero diff vs main, in parallelo `/codex-review-chat` sul diff (escludendo `docs/superpowers/plans` e i PNG; tenerlo aperto finché l'ondata di correzioni non è ri-verificata) → UNA ondata di correzioni → checklist in Chrome → gate completi sul commit finale → merge `--no-ff` in main + `npm test && npm run lint` + push di main e del branch (permesso senza chiedere a sotto-fase verificata) → spec, memoria, cancellazione del workspace SDD e del prototipo.
- Commit e commenti in italiano, nessuna riga di attribuzione.

## Lezioni da mettere nei piani (bug reali trovati nelle fasi 4–6b)

- `HmdElement.watch()` rende subito: niente render ridondanti a fine `connect()`; nessun evento emesso dentro `connect`.
- Ogni render passa da `RenderLoop` (`src/dom/renderLoop.ts`: prerequisiti ricontrollati a ogni passata, `hadFocus` prima della prima passata, recupero del focus dopo l'ultima contro il DOM finito, mai un `#render()` fuori dal loop). Lo stato si salva **prima** di emettere.
- Nessun callback DOM rientra in un render in modo sincrono (focusout durante `reconcileList`, `toggle` del popover che è un task asincrono: leggere lo stato vero con `matches(':popover-open')`, mai `newState`).
- Lavoro asincrono tardivo (elenco dei modelli, debounce) scartato dopo distacco o richiesta più nuova (`AbortController` per richiesta); ricollegato si richiede.
- Campi con il focus mai riscritti né ricreati; il campo si riallinea al `focusout`; se il nodo con il focus sparisce, il focus va a un bersaglio stabile.
- Proprietà dei figli `hmd-*` assegnate **prima** dell'inserimento (`#passDown`), e solo se cambiano (i setter dei figli possono riconciliare tutto).
- React 19: ogni prop funzione `on*` diventa listener → uscite come eventi `hmd-*` (`emit` fa bubbling: un solo ascoltatore per percorso), ingressi senza prefisso `on`.
- `events.ts`: ogni voce nuova va sopra il JSDoc della voce successiva, mai tra JSDoc e chiave.
- Fogli con limite inferiore sui figli: `@scope (hmd-x) to (hmd-figlio, …)` (il registro della chat ha anch'esso `.file`).
- Gate: qualsiasi errore in console fa fallire `test:e2e:dev`; `expectedConsole` solo per diagnostiche esatte; mai `test.fail`; `page.clock.install({ time: NOW })` **prima** di aprire la cartella dove conta un timer; un cambio voluto dell'aspetto → `npm run build && rm -rf dist-baseline && cp -r dist dist-baseline`, snapshot rigenerati solo quelli, con `--update-snapshots=all -g "nome"`.
- Un cambio di decisione a metà piano: il Task 1 resta (afferma il comportamento di oggi), i task toccati si dividono in «parte 1 identica a React» e «parte 2 con il cambio».

## Trappole dell'ambiente

- `list_connected_browsers`: serve il Chrome su Linux, non il Mac. Vite con `npx vite --port 5197 --strictPort --host 127.0.0.1`, aperto su `http://127.0.0.1:5197/` (mai la 5180 della cartella vera). Cartella di prova in OPFS + `window.showDirectoryPicker` sostituito; Ollama finto sostituendo `window.fetch` per `localhost:11434` (`/api/tags`; chat in SSE formato OpenAI con `<housemd-proposal>`); un **commit sul worktree fa ricaricare la pagina (HMR) e cancella gli stub**; pulire OPFS/IndexedDB/localStorage alla fine. Le schede sono `visibilityState: hidden` (niente rAF; Ctrl+K preso da Chrome; Ctrl+Shift+lettera arriva minuscola). Le icone verdi nella textarea sono Grammarly.
- Il Playwright del prototipo (agente autore) si scontra con quello del worktree su porte 4173/4174 e RAM: cadute isolate (`ai-sync-reactivate` «page closed», `search*` in dev) sono da carico, non regressioni: ripetere da soli (`--repeat-each=3`).
- `pkill -f` uccide la propria shell (exit 144): controllare dopo con `pgrep`.
- Instabilità nota estranea: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog».
- Gli implementer Sonnet a volte scrivono tutto e poi ripristinano HEAD per vedere il RED: chiedere esplicitamente «test prima, poi il codice». I rapporti brevi non bastano: il controller rilancia i file e2e nuovi.
