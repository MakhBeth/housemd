# Grammarly nell'editor e scroll conservato tra le modalità — piano veloce

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (o subagent-driven-development). Il Task 1 parte con superpowers:systematic-debugging: prima la causa, poi la correzione.

**Goal:** (1) capire perché Grammarly non riesce a scrivere nell'area dell'editor e, se si può fare in sicurezza, farlo funzionare; (2) passando tra Editor / Affiancata / Anteprima / AI, editor e anteprima tornano dove erano invece di ripartire dall'inizio.

**Base:** `main` (`b0db9d1`), branch nuovo `fix/grammarly-e-scroll`. Indipendente dalla fase 2 (worktree `../housemd-fase2`): tocca `src/editor/`, `src/preview/Preview.tsx`, `src/ui/ai/DiffPane.tsx`, `src/ui/WorkspaceView.tsx` ed `e2e/`, nessun file della migrazione.

## Contesto (verificato sul codice)

- L'editor è CodeMirror 6 (`src/editor/Editor.tsx`). L'area modificabile è il `contenteditable` `.cm-content`; CodeMirror legge le modifiche esterne del DOM con un `MutationObserver` e ridisegna il DOM a partire dal proprio stato. Nessun `contentAttributes` imposta `spellcheck`, `data-gramm` o `data-enable-grammarly` (`grep` vuoto).
- Cambiando modalità, `WorkspaceView.tsx:469-520` smonta il pannello che sparisce: `Editor` distrugge la `EditorView` (salva testo, selezione e cronologia in `DocSession`, **non lo scroll**), `Preview` perde il proprio `scrollRef`. Al rientro entrambi ripartono da `scrollTop = 0`.
- `DocSession` (`src/editor/docSession.ts`) vive per `path#revision` (`WorkspaceView.tsx:65`): è il posto giusto per lo scroll dell'editor e dell'anteprima.
- `@codemirror/view` installato espone `EditorView.scrollSnapshot()` e il campo `scrollTo` della configurazione: fanno già ciò che serve per l'editor.

## Task 1: Grammarly (indagine, poi correzione)

- [ ] **Riprodurre** in Chrome con l'estensione Grammarly: aprire un `.md`, scrivere un errore, guardare se Grammarly (a) non si attiva affatto, (b) sottolinea ma "Accetta" non cambia il testo, (c) cambia il testo e CodeMirror lo annulla. Annotare quale.
- [ ] **Ispezionare** `.cm-content` in DevTools: attributi presenti (`contenteditable`, `spellcheck`, `data-gramm*`), eventuali nodi `grammarly-*` iniettati, errori in console. Controllare anche se lo stesso succede nel `textarea` del composer AI (se lì funziona, il problema è specifico di CodeMirror).
- [ ] **Causa attesa** da confermare o smentire: Grammarly esclude di proposito gli editor CodeMirror/`contenteditable` gestiti, oppure scrive nel DOM con modalità (sostituzione di nodi testo, `execCommand`) che il `MutationObserver` di CodeMirror non traduce in una transazione e quindi ridisegna via.
- [ ] **Se la causa è l'esclusione:** provare `EditorView.contentAttributes.of({ spellcheck: 'true', 'data-gramm': 'true', 'data-gramm_editor': 'true', 'data-enable-grammarly': 'true' })` in `docExtensions.ts`. Il test (`docExtensions` in un test esistente o nuovo `*.test.ts`) verifica solo che gli attributi siano nella configurazione.
- [ ] **Se Grammarly scrive ma CodeMirror annulla:** non c'è una correzione affidabile lato app. Documentare il limite (README, sezione compatibilità) invece di inseguire hack sul DOM.
- [ ] **Vincoli da rispettare** se Grammarly diventa attivo: in sola lettura (`readOnly`, aggiornamento in corso) non deve cambiare nulla; le modifiche devono passare da `canChange` e arrivare a `onChange` (quindi autosave e cronologia di annullamento normali). Verificarlo a mano, e annotare l'esito nel commit.
- [ ] `npm test`, `npm run lint`, `npm run test:e2e` verdi (gli snapshot non devono cambiare: gli attributi non sono visibili). Commit: `fix: …` o `docs: …` a seconda dell'esito.

## Task 2: scroll conservato tra le modalità

- [ ] **Test prima** in `src/editor/docSession.test.ts`: `saveDocSession` conserva anche lo scroll; `docStateConfig` non lo usa (lo scroll non è stato del documento); un nuovo campo `previewTopLine?: number` si legge e si scrive. Nessun campo nuovo deve rompere i test esistenti.
- [ ] **`DocSession`:** aggiungere `scroll?: StateEffect<unknown>` (da `view.scrollSnapshot()`) e `previewTopLine?: number`. `saveDocSession(session, state, view?)` salva lo snapshot quando riceve la vista.
- [ ] **`Editor.tsx`:** nella pulizia dell'effetto di montaggio passare `view` a `saveDocSession`; nell'effetto su `resetKey`, dopo `view.setState(...)`, se `session.scroll` esiste fare `view.dispatch({ effects: session.scroll })`. Con un `resetKey` nuovo (altro file, ricarica) lo snapshot va azzerato insieme a `history` e `selection` (riga del reset già esistente).
- [ ] **`Preview.tsx`:** ricevere `session` come prop opzionale; in `onScroll` aggiornare `session.previewTopLine` (già calcolato come `lineForOffset`); dopo il primo render del documento, se `previewTopLine` c'è, chiamare `scrollToLine` interno una volta sola. Attenzione alle immagini caricate dopo: se l'àncora si sposta, ripetere al primo `load` delle immagini oppure accettarlo e scriverlo nel commit.
- [ ] **`src/ui/ai/DiffPane.tsx` (modalità AI con proposta):** la `MergeView` crea il proprio editor `a` dalla stessa `DocSession` (`docStateConfig`, riga 44) e alla chiusura chiama `saveDocSession(session, m.a.state)` (riga 49) senza vista. Passare `m.a` a `saveDocSession` e, dopo la creazione della `MergeView`, se `session.scroll` esiste fare `m.a.dispatch({ effects: session.scroll })`. Nella `MergeView` lo scroller è il contenitore `.cm-mergeView`, non `m.a.scrollDOM`: verificare a mano che l'effetto di `scrollSnapshot` sposti davvero quel contenitore (CodeMirror scorre gli antenati scorrevoli); se no, salvare e ripristinare lo `scrollTop` di `m.dom` in un campo a parte e scriverlo nel commit. Senza proposta la modalità AI usa `Editor` (`ReviewView.tsx:93,105`) ed è già coperta dal punto sopra.
- [ ] **`WorkspaceView.tsx`:** passare `session` a `Preview`. In modalità Affiancata lo scroll sincronizzato resta com'è: al rientro vince l'editor (che chiama già `onTopLine`), quindi niente doppio ripristino in conflitto.
- [ ] **E2E:** in `e2e/editor.spec.ts` (o `preview.spec.ts`) un caso nuovo: documento lungo, scorrere a metà, passare ad Anteprima e tornare a Editor → la riga in cima è la stessa (±1); idem Anteprima → Editor → Anteprima. In `e2e/ai-review.spec.ts` (provider simulato con `page.route`, come i casi esistenti): Editor → AI con una proposta aperta → Editor, e lo stesso senza proposta; la riga in cima resta la stessa (±1) in entrambe le direzioni. Solo ruoli e nomi da `en.json`, niente classi CSS; nessuno snapshot visivo nuovo.
- [ ] `npm test`, `npm run lint`, `npm run test:e2e` verdi. Commit: `fix: editor e anteprima conservano lo scroll quando si cambia modalità`.

## Fuori ambito

- Ricordare lo scroll tornando a un file aperto in precedenza: oggi `DocSession` si ricrea a ogni cambio di file (`WorkspaceView.tsx:65`). Se serve, è una mappa `path → DocSession` in un modulo puro: piano a parte.
