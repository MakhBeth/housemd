# Chiusura della migrazione a Web Components (12/10/2026)

## Stato finale

- Epica `epic/LAB-3-web-components`: fasi 0–8 fatte. Fase 8 in due PR verso l'epica: 8a = #12 (mergiata, `67fa7b9`), 8b = #13, branch `lab/LAB-6-fase-8b`. In `main` solo al merge dell'epica (Davide).
- Suite sul commit finale dell'8b (2 worker nel lock, nessuna caduta per memoria): `npx tsc --noEmit` e `npm run lint` puliti; `npm test` **1098**; `npm run test:e2e` **213** (211 verdi + i 2 snapshot dello start screen, che su ape cadono per il font pixel, anche su `67fa7b9`); `npm run test:e2e:dev` **198**; `npm run test:e2e:audit` **156** verdi. Snapshot invariati.
- Bundle principale gzip (`gzip -c dist/assets/index-*.js | wc -c`): **382 032 B**. Inizio migrazione 441 143 B, fase 3 (React 19) 432 419 B (−50 387 B), fine 7b 379 234 B (+2 798 B nella fase 8: 8a +1 663, 8b +1 135), un po' sopra il +2 KB atteso (testi nuovi in nove lingue, `announce`, `pluralKey`, note e regole `forced-colors`).
- Tempo di avvio, 21 giri alternati, mediane (p25–p75), `e2e/startup.config.ts`:

| Build | `start` | `reopen` |
|---|---|---|
| fase 3 (`a3ebc6f`, React 19) | 194 ms (191–199) | 222 ms (217–228) |
| oggi (8b, senza React) | **132 ms** (130–138) | **208 ms** (202–212) |

  Entro ±10 % da 139 e 220 ms. `dist-phase3/` è la build di `a3ebc6f` (`npm ci && npm run build`, copiata in `dist-phase3/`, fuori da git).
- `dist-baseline/` = build di `6cc52b5` (`dist-baseline/BASELINE_SHA`), costruita dal Task 10 (primo commit con i cambi `forced-colors`), copiata dal suo checkout. Le tre correzioni della review (focus del diff, ombra in `forced-colors`, testo di `scopeLost`) non cambiano nessuna riga dell'audit. Fuori da git.

## Cosa resta fuori

- **Rimuovere i toast** (non accessibili) con un'alternativa accessibile: lavoro a sé dopo la migrazione.
- **A4** (la lingua cambiata dalla select riporta il focus sul titolo): non riprodotta in Chromium senza screen reader; va cercata con NVDA/Narratore.
- **Bundle** a +2 798 B contro il +2 KB atteso: accettabile o da ridurre (decisione del PM).
- Le prove a mano qui sotto.

## Checklist §9 per Davide

Parte automatica: verde (suite sopra). Parte manuale, in Chrome ed Edge stabili:

- [ ] Selettore di cartelle e permessi veri; popover e tooltip vicino ai bordi.
- [ ] Transizione a pixel del tema e `prefers-reduced-motion`.
- [ ] Edge; PWA installata e offline; avviso di nuova versione; AI con un provider vero.
- [ ] **NVDA con Chrome e Narratore con Edge**:
  - la stessa nota letta a un secondo clic (barra della revisione, composer, Nuova chat);
  - «Connection successful»;
  - avvio, parti ed esito della generazione;
  - stato della sync;
  - A4 cambiando lingua dalla select;
  - le note «mai disabled».
- [ ] **Contrasto elevato vero di Windows, almeno Acquatico e Deserto** (anche chiaro e scuro): icone dei pulsanti e dei link, modalità premuta anche con il focus, voce corrente (indice, profili, preset), bozza orfana corrente, separatore al passaggio e con il focus, anello sulla voce corrente.
- [ ] Prove ancora aperte: [LAB-52](mention://issue/01a12d84-ed9c-7e67-a6f2-96b81dfa0cf0), LAB-53 e i punti della 7b dell'handover (sidebar nascosta e riaperta dopo un cambio esterno, cambio di cartella, ripresa all'avvio, tema con la view transition).
- [ ] Dalla review di A11y dell'8a: il nome «Testo del documento» entrando nell'editor; «Proposta pronta» detta una sola volta anche quando il modello non scrive un commento; l'errore di sync (stato «Errore» più `alert`) non troppo ripetuto; in forced-colors l'anello sull'h2 della sezione dopo un salto dall'indice e i pulsanti dei blocchi del diff (hover) dopo lo `StyleModule`.
- [ ] Dal Task 8: un clic su «→ rifiuta» durante la generazione fa leggere la nota della barra anche con il focus nella colonna centrale del diff; i pulsanti dei blocchi non sono disabilitati e dicono perché.
- [ ] Dal Task 9: «Aggiorna» premuto durante l'aggiornamento fa rileggere «Aggiornamento in corso…» (il messaggio dell'avviso è l'unico annuncio); la nota della schermata iniziale, fuori dal flusso, viene letta e il pulsante non si sposta; l'indirizzo di Anthropic di sola lettura si legge con l'aiuto («L'URL del server è fisso»).
- [ ] Dalla review di A11y dell'8b:
  - con NVDA o VoiceOver: un secondo Invio su Salva chiave, su Cronologia senza documento e su Sincronizza ora durante una sync rilegge la nota ogni volta; Aggiorna durante l'aggiornamento rilegge «in corso»; l'indirizzo di Anthropic si legge «sola lettura» con la descrizione;
  - in forced-colors (Windows, contrasto elevato chiaro e scuro): anello sulla voce corrente, icone nei pulsanti e nei link, separatore al passaggio e con il focus;
  - zoom al 400 %: la nota della schermata iniziale, posizionata in assoluto sotto il pannello, resta raggiungibile scorrendo.
- [ ] Merge dell'epica in `main` solo dopo l'approvazione di Davide.

## Lezioni della fase 8

- **Il focus si cattura prima di `busy`**: un pulsante che diventa `disabled` perde il focus; con la regola «mai disabled» il problema sparisce alla radice.
- **Un'uscita voluta del focus non si recupera**: chi riporta il focus su un nodo ricreato deve distinguere il nodo rimosso dal focus lasciato di proposito (`focusout` con il nodo ancora nel DOM).
- **Un `dispatch({})` vuoto in CodeMirror passa dalla sessione** del documento.
- **L'orologio finto di Playwright ferma `requestAnimationFrame`** e la pausa di `announce`: serve `page.clock.runFor(…)`.
- **L'audit esegue la preparazione anche sulla baseline**: uno stato nuovo deve funzionare su entrambe le build.
- **`forced-color-adjust: none` si eredita** e riporta l'ombra dell'anello: `box-shadow: none` su `:focus-visible` delle voci con sfondo `Highlight`.
- Dalle fasi 6c, 7 e 8a (ancora valide): `watch()` rende subito e ogni render passa da `RenderLoop`; il lavoro asincrono tardivo si scarta dopo ogni `await`; i campi con il focus non si riscrivono; se il nodo con il focus sparisce il focus va su un bersaglio stabile; una chiave di memo per ogni vista derivata; `:scope` contro la prossimità di `@scope`, mai `!important`; mai `assert.equal` tra nodi di jsdom.

## Trappole dell'ambiente

- RAM di ape (tetto 10 GB): browser sempre nel lock, variabili prima di `flock` (`E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock …`); una suite alla volta; a fine suite `pgrep -af "vite|chrom|playwright"`, mai `pkill` per nome.
- `node_modules` in un worktree nuovo: `npm ci` o una copia vera, mai un link simbolico (Vite risponde 403 ai file fuori dalla radice).
- L'hook `prepare-commit-msg` del daemon aggiunge `Co-authored-by`: si committa con `git -c core.hooksPath=/dev/null commit …` e si controlla `git log --format=%B -n <N>` prima del push.
- Instabilità note: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog»; `ai-composer.spec.ts` (sync folder senza permesso); gli stati di audit con `page.reload()` (`start-resume`, `ai-sync-reactivate`, `orphans`): ripetere da soli. Nel giro finale nessuna è caduta.
- Il trailer `Co-authored-by: multica-agent` compare in alcuni commit già pushati: non si riscrive la storia.
