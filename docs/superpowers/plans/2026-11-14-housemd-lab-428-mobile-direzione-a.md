# LAB-428 — HouseMD su telefono, direzione A

Piano del Planner, 14/11/2026. Riferimenti: proposta del Designer in LAB-37 (`proposta-mobile.md`, `direzione-A.html`), scelte di Davide del 14/11 (note veloci e lettura; download va bene; tablet solo responsive), LAB-22 (PR #19, file singolo e `memoryFile`), LAB-417 (focus e typewriter).

## Global Constraints

- **Base.** PR #19 (LAB-22) non è mergiata: il branch `lab/LAB-428-mobile` nasce da `lab/LAB-22-single-file` (`9225467`). Quando #19 entra in `main`, il PM (o chi ha il task in corso) fa `git rebase origin/main`; la PR resta verso `main`, in inglese.
- **Prima i test, poi il codice**: il RED si vede e si annota nel commento finale. Mai `test.fail`.
- **Gate per task**: `npm run lint`, i test unitari dei file toccati, gli e2e dei soli spec toccati. La suite unitaria completa e gli e2e completi (desktop + mobile) girano una volta sola nel Task 8. Tutto ciò che è pesante dentro `flock /home/agent/work/.browser-tests.lock`, `E2E_WORKERS=2`. Niente `cd <dir> && …`.
- **Desktop invariato.** Tutto il nuovo layout sta sotto una sola media query `(max-width: 599px)` (token `--bp-phone` documentato in `global.css`); sopra, nessuno stile calcolato cambia. Verifica: `npm run test:e2e:audit` verde senza rinnovare la baseline (Task 8). Se un task lo rompe, è un bug del task.
- **Niente direzione B**: niente OPFS come archivio di note, niente lista persistente di note, niente sync. «Recenti» = le copie già conservate da LAB-22 (`listPending`), nient'altro.
- **Regole HouseMD**: pulsanti mai `disabled`/`aria-disabled` (nota adiacente con `announce`), niente toast, testi da `t()` in tutte e nove le lingue (chiavi nuove in `en.json` e `it.json` scritte dal task, le altre sette tradotte dal Builder nello stesso task).
- **Rilevamento telefono**: per larghezza (`matchMedia('(max-width: 599px)')`), mai per user agent o `pointer: coarse` da solo. Il rilevamento della File System Access resta quello di LAB-22 (`fs/access.ts`).

## Misure prese scrivendo il piano (14/11, prototipo su `9225467`)

Prototipo: worktree `/home/agent/work/housemd-proto-428` (rimosso a fine piano), `npm ci`, build servita da `vite preview`, sonda Playwright 1.63 con `devices['iPhone 13']` (WebKit 2370) e `devices['Pixel 7']` (Chromium 1243), locale `it-IT`.

| Misura | Valore |
| --- | --- |
| `npm test` (completo, nel lock) | 1246 test, 0 fail, 104 s |
| `npm run lint` | verde |
| bundle gzip | `index.js` 391 711 B, `sdk.js` 47 869 B, `index.css` 14 045 B |
| Schermata iniziale, WebKit 390 px | overflow orizzontale **33 px**; «Apri un file» largo 407 px, alto **39 px** |
| Schermata iniziale, WebKit 320 px | overflow 20 px |
| Workspace con file aperto, WebKit 390 px | sidebar a 280 px fissa + split: anteprima larga ~30 px (una lettera per riga), testata con nome del file sovrapposto ai pulsanti. **Inutilizzabile** |
| Workspace, WebKit 320 px | overflow 7 px |
| Chromium mobile emulato | `showOpenFilePicker` **presente** (l'emulazione non lo toglie; su Android Chrome vero manca). Senza stub gli e2e Chromium mobile prendono il ramo FSA |

Obiettivo dopo il piano: overflow 0 a 320 e 390 px su entrambi i motori; target ≥ 44×44; editor e campi a 16 px; budget bundle `index.js` +6 KB gzip al massimo (niente dipendenze nuove).

## Decisioni (con varianti scartate)

1. **Una regione per volta sotto 600 px** (tavole A). Il workspace a telefono mostra solo Editor *oppure* Anteprima, con un selettore a due pulsanti `aria-pressed` (riuso di `mode.editor`, `mode.preview`). Split e AI non compaiono nel selettore a telefono; se la modalità salvata è `split`, a telefono vale `editor`. *Scartato*: split verticale (illeggibile a 390), tabs ARIA completi (la proposta chiede di non mescolare i contratti; il selettore attuale è già `aria-pressed`).
2. **Sidebar = vista File a tutto schermo** con Chiudi, aperta dal pulsante «File» della testata; mai affiancata all'editor. *Scartato*: drawer sovrapposto (focus trap e scroll in più senza guadagno).
3. **Testata compatta**: File · nome documento (ellissi) · Scarica (sempre visibile, azione primaria) · Altro (menu con focus, stampa/PDF, cronologia, impostazioni, tema). *Scartato*: barra in basso (si scontra con la tastiera virtuale e con la barra di Safari).
4. **«Nuova nota»** = `memoryFile` vuoto con nome provvisorio, nello stesso percorso di LAB-22 (sessione, bozze e recupero gratis). Il nome si decide al download: prima riga non vuota, ripulita da `#`, caratteri non validi e spazi in testa/coda, tagliata a 60, + `.md`; se vuota `nota-AAAA-MM-GG-HHmm.md`. Su browser con FSA, «Scarica» diventa «Salva» e apre `showSaveFilePicker` con quel nome suggerito; da lì il file scrive sul posto (`fsaFile`). *Scartato*: chiedere il nome all'apertura (un tocco in più, contro il criterio dei 3 tocchi).
5. **Cursore pronto solo per «Nuova nota»** (focus nell'editor vuoto: su iOS la tastiera si apre perché il tocco è un gesto dell'utente). Aprendo un file **non** si apre la tastiera e si parte in Anteprima (uso «lettura»). Coerente con la proposta del Designer.
6. **Tastiera virtuale**: `visualViewport` (`resize`/`scroll`) scrive `--vv-height` e `--vv-offset` su `hmd-workspace`; l'area documento usa `height: var(--vv-height, 100dvh)` e il typewriter centra la riga nell'altezza visibile, non in `innerHeight`. Su `focusin` nell'editor dopo un resize, `EditorView.scrollIntoView(cursor, { y: 'nearest', yMargin: 48 })`. *Scartato*: VirtualKeyboard API (solo Chromium, la proposta lo esclude per iOS).
7. **Recenti** sulla schermata iniziale: le copie non scaricate già listate da `listPending` (fino a 5, più recenti prima), con «Riprendi». Nient'altro: senza FSA il browser non conserva file aperti. *Scartato*: memorizzare ogni file aperto in IndexedDB (è la direzione B).
8. **Policy**: `CLAUDE.md` passa da «solo Chromium desktop» a «Chromium desktop completo; Safari iOS ≥ 17 e Chrome Android recenti in modalità file singolo». Lo scrive il Task 1.

## Task

Ognuno è una sessione di Builder. Stage seriali: 1 → 2 → (3, 4 in parallelo) → 5 → 6 → 7 → 8.

### Task 1 — Rete di sicurezza mobile e progetti Playwright

File: `e2e/playwright.config.ts`, `e2e/mobile/*.spec.ts` (nuova cartella), `e2e/support/app.ts` (helper `stubNoFsa(page)` che toglie `showOpenFilePicker`/`showSaveFilePicker`/`showDirectoryPicker` con `addInitScript`), `CLAUDE.md` (policy, decisione 8).

- Due progetti nuovi `mobile-webkit` (`devices['iPhone 13']`) e `mobile-chromium` (`devices['Pixel 7']`), `testMatch: 'mobile/**'`; il progetto `chromium` esistente ignora `mobile/**`. Il comando base resta `npm run test:e2e`; aggiungere `test:e2e:mobile` = `--project=mobile-webkit --project=mobile-chromium`.
- `e2e/mobile/layout.spec.ts`: overflow orizzontale 0 a 320 e 390 sulla schermata iniziale e sul workspace con un file aperto; ogni pulsante visibile ≥ 44×44; `font-size` ≥ 16 px su `.cm-content` e input. **Oggi rossi** (misure sopra): annotarli come RED nel commento, e committarli con `test.fixme` solo per questo task, rimosso dal task che li fa passare (eccezione esplicita alla regola «mai test.fail»: `fixme` non gira, è un segnaposto con il numero di task nel titolo).
- Verificare `npx playwright install webkit` già fatto su ape (webkit-2370 presente).
- Accettazione: `npm run lint` verde; `test:e2e:mobile` gira su entrambi i progetti con solo i `fixme` attesi; e2e desktop toccati (nessuno) invariati.

### Task 2 — Layout telefono del workspace: una regione per volta

File: `src/elements/workspace/layout.ts` (+ test), `workspace.element.ts`, `workspace.css`, `src/styles/global.css`, `src/i18n/*.json`.

- Test prima: `layout.test.ts` — `phoneMode(mode)` mappa `split`→`editor`, `ai`→`ai` resta fuori dal selettore; `gridColumns` a telefono restituisce sempre `minmax(0, 1fr)`.
- `matchMedia('(max-width: 599px)')` in `workspace.element.ts` (attributo `phone` sull'host, aggiornato al `change`): sidebar mai nella griglia, separatore nascosto, selettore con solo Editor/Anteprima.
- Vista File a tutto schermo (decisione 2): pulsante «File» (`mobile.files`) apre la sidebar come `section` a tutta pagina con «Chiudi» (`mobile.closeFiles`); il focus va al primo elemento e torna al pulsante. Scegliere un file chiude la vista.
- Testata (decisione 3): nome con `text-overflow: ellipsis`, «Scarica» visibile, il resto nel menu «Altro» (`mobile.more`) con il pattern menu già usato dall'albero (`⋯`).
- Target 44 px solo sotto la media query.
- Accettazione: `layout.spec.ts` (workspace) verde su entrambi i progetti, `fixme` del workspace tolti; `workspace.dom.test.ts` verde; `visual.spec.ts` desktop invariato (gira solo quel file).

### Task 3 — Schermata iniziale: Nuova nota, Apri file, Recenti

File: `src/elements/start-screen/startView.ts` (+ test), `start-screen.element.ts` (+ dom test), `start-screen.css`, `src/elements/app/app.element.ts`, `screens.ts`, `src/fs/singleFile.ts` (+ test), i18n.

- Test prima: `startView` a telefono → bottoni `['new-note', 'pick-file', …recover]`, «Nuova nota» primario; `newNoteFile(now)` in `singleFile.ts` crea un `memoryFile` vuoto, `pending: false`, nome provvisorio `mobile.untitled`.
- «Nuova nota» apre il workspace in modalità editor con il cursore nell'editor vuoto (decisione 5); «Apri un file» apre in Anteprima senza focus nell'editor.
- Recenti (decisione 7): `listPending` → lista di al massimo 5 con «Riprendi», sotto le azioni. Vuoto: niente titolo «Recenti».
- Su desktop la schermata resta com'è (cartelle prima): la differenza sta solo nel ramo telefono di `startView`.
- Accettazione: `e2e/mobile/new-note.spec.ts`: Nuova nota → scrivo → il cursore è nell'editor; layout iniziale a 320/390 verde (via i `fixme` della schermata iniziale).

### Task 4 — Nome del download e «Salva» sul posto

File: `src/fs/noteName.ts` (nuovo, + test), `src/fs/fileInput.ts`, `src/fs/fsaOps.ts`, `workspace.element.ts`, i18n.

- Test prima: `noteName(text, now)` — `# Titolo` → `Titolo.md`; caratteri `/\:*?"<>|` tolti; 60 caratteri; vuoto → `nota-2026-11-14-1530.md` (data locale); un file aperto (non nuova nota) mantiene il suo nome.
- «Scarica» su `memoryFile` usa `noteName` solo per le note nuove. Con FSA presente e nota nuova: «Salva» → `showSaveFilePicker({ suggestedName })`, poi la sessione passa a `fsaFile` (scrive sul posto, `writesToDisk: true`); annullare il picker non cambia nulla e non annuncia nulla.
- Stato `mobile.downloadStarted` («Download avviato», mai «Salvato») via `announce`; errore `mobile.exportError` adiacente, la nota resta.
- Accettazione: unitari verdi; `e2e/mobile/download.spec.ts` (WebKit, con `page.waitForEvent('download')`): Nuova nota → scrivo «# Spesa» → Scarica → `suggestedFilename() === 'Spesa.md'`, **3 tocchi**. Variante Chromium mobile senza stub: «Salva» chiama il picker (stub che registra il `suggestedName`).

### Task 5 — Lettura comoda

File: `src/elements/preview/*.css`, `workspace.css`, `workspace.element.ts`.

- Anteprima a tutta larghezza, padding 16 px, `font-size: 17px`, `line-height: 1.6`, `max-width: 70ch`; tabelle e blocchi di codice con `overflow-x: auto` locale (il file di prova del prototipo con una tabella a 6 colonne non deve far scorrere la pagina).
- Passaggio Editor ↔ Anteprima conserva il punto di lettura (sync-scroll esistente, verificare che a telefono usi la riga in cima alla vista).
- Accettazione: `e2e/mobile/read.spec.ts`: Apri file → anteprima visibile senza altri tocchi, overflow 0 con tabella larga; ritorno all'editor sulla stessa sezione (±1 riga).

### Task 6 — Tastiera virtuale, focus e typewriter

File: `src/dom/visualViewport.ts` (nuovo, + test), `workspace.element.ts`, `src/editor/*typewriter*`, `workspace.css`.

- Test prima: `trackVisualViewport(target, vv)` con un `visualViewport` finto: scrive `--vv-height`/`--vv-offset`, si stacca al `dispose`; senza `visualViewport` non fa nulla.
- Il typewriter (LAB-417) centra nella `--vv-height`; il cursore resta visibile dopo un resize (decisione 6). Pulsante «Esci da focus» sempre visibile a telefono.
- Barra di formattazione: fuori perimetro (la proposta la descrive, ma non è nei criteri di LAB-428): annotata come seguito.
- Accettazione: e2e `e2e/mobile/keyboard.spec.ts` che simula la tastiera riducendo il viewport (`page.setViewportSize({ width: 390, height: 400 })` dopo il focus) e verifica che il cursore sia nel rettangolo visibile, con e senza focus mode. Prova su dispositivo vero → sub-issue `[Davide]` (Task 8).

### Task 7 — Pulizia e tablet

File: CSS dei task precedenti, `layout.ts`.

- Togliere dal perimetro telefono tutto ciò che serve solo alla direzione B (nessuna chiave `mobile.emptyNotebook`, `mobile.savingLocal`, `mobile.savedLocal`: non vanno create; verificare con `grep`).
- Tablet (600–1023 px): nessun layout dedicato. Verificare a 820 px che la sidebar sia richiudibile e niente overflow: `layout.spec.ts` aggiunge 820 px.
- Accettazione: `test:e2e:mobile` completo verde (è piccolo, gira qui nel lock).

### Task 8 — Chiusura: suite complete, audit, verifica manuale

- Nel lock, una volta: `npm test`, `npm run lint`, `E2E_WORKERS=2 … npm run test:e2e` (desktop + mobile), `npm run test:e2e:audit` (atteso verde senza rinnovare la baseline: il desktop non cambia), misure bundle contro la tabella sopra.
- Sub-issue `[Davide] Prova HouseMD su iPhone e Android` (stage dopo il Task 8): 3 tocchi Nuova nota → Scarica, tastiera e typewriter, VoiceOver/TalkBack sui pulsanti della testata, rotazione, zoom 200%.
- Review: Reviewer e A11y sull'ultimo commit.

## Rischi e dubbi aperti

- **Emulazione ≠ dispositivo**: WebKit di Playwright non ha tastiera virtuale né la barra di Safari; il Task 6 la simula con il resize. La prova vera è la sub-issue di Davide.
- **Rebase su #19**: se la review di LAB-22 cambia `singleFile.ts` o `startView.ts`, i Task 3 e 4 si adattano; il piano resta valido.
- **`showOpenFilePicker` nell'emulazione Chromium** (misurato): senza `stubNoFsa` gli e2e mobile Chromium provano il ramo FSA, che su Android vero non esiste. Ogni spec mobile dichiara quale ramo prova.
- **AI a telefono**: esclusa dal selettore (la proposta la prevede come vista dedicata, ma non è nelle scelte di Davide). Resta raggiungibile solo sopra 600 px.
