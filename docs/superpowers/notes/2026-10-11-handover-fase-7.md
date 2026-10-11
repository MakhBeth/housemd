# Handover migrazione Web Components — fase 6c fatta, prossimo piano 7 (11/10/2026)

## Stato

- Branch della fase: `lab/LAB-4-fase-6c` (PR #9 verso `epic/LAB-3-web-components`); in `main` solo al merge dell'epica (Davide). Fasi 0–6b in `main`, 6c nell'epica.
- Suite sul commit finale della fase: `npm test` 980, `npm run test:e2e` 186, `npm run test:e2e:dev` 171, `npm run test:e2e:audit` 116. Bundle principale gzip 439 717 → 441 143 B (`gzip -c dist/assets/index-*.js | wc -c`).
- `dist-baseline/` = build dell'ultimo cambio voluto (nota della barra della revisione, ricostruita a fine fase). Il riferimento per la fase 7 è quella, finché non cambia l'aspetto di proposito.
- Spec: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 stato per fase, §2 vincolo 4, §13 elenco dei piani). Ultimo piano eseguito: `2026-10-11-housemd-wc-12-fase-6c-revisione.md` (paragrafo «Esecuzione»).

## Cosa resta

| Fase | Contenuto |
|---|---|
| 7 | `SettingsView` e sezioni AI (montano ancora `hmd-ai-model-select` e `hmd-ai-parameters`), `WorkspaceView`, `App`; `jsx.d.ts` sparisce. |
| 8 | Rifinitura e passata di accessibilità (elenco sotto). |
| Dopo la migrazione | Rimuovere i toast (non accessibili) con un'alternativa accessibile: lavoro a sé. |

### Per la fase 8

- Regola «mai disabled» estesa a pulsanti dei blocchi nel diff, impostazioni, dialog.
- Scarta = Ferma + scarta (oggi Scarta durante la generazione scrive solo la nota), doppio clic su Invia che ferma la richiesta (nodo unico Invia/Stop), «Continua» durante un aggiornamento.
- Layer `vendor` per gli stili di CodeMirror: vedi l'analisi nel piano 6c («Analisi del layer `vendor`»). I tre `!important` di `diff-pane.css` diventano `StyleModule`; il quarto sta in `docAppearance()`.
- **Rilievo di A11y su LAB-10 (WCAG 3.3.3).** In modalità AI l'albero dei file non c'è: per seguire la nota «Open a document before sending» bisogna passare alla modalità editor, che smonta la sidebar e fa perdere la bozza (`e2e/ai-review-bar.spec.ts` ~riga 164 dichiara il comportamento di oggi). Il testo non dice dove aprire il documento. Da rivedere insieme al ri-annuncio della stessa nota a un secondo Invia (limite accettato nella 6b).
- **Rilievo di A11y su LAB-11 (WCAG 4.1.3).** In `src/elements/ai/review-bar.element.ts` (~righe 174-176), se il testo della nota non cambia la regione `role="status"` resta uguale e lo screen reader non rilegge. Durante la generazione Successivo, Scarta e Accetta tutto danno tutti `ai.review.generating`: si sente solo il primo clic. Correzione proposta: svuotare la nota e riscriverla al frame successivo, insieme al caso del composer (limite accettato nel piano, riga 120).
- **Rilievi di A11y su LAB-12, preesistenti su `main`**: vedi [LAB-42](mention://issue/01a12c56-3201-7335-9d5c-392665c5db19). Contatore «Generating… N s» in una regione live che parla ogni secondo (WCAG 2.2.2); icone `.icon` invisibili in forced-colors con Precedente e Successivo vuoti (WCAG 1.4.11); `.cm-content` senza nome accessibile (WCAG 4.1.2). Caso minore senza azione: se `hmd-ai-review` si stacca con il dialog di conferma aperto, il focus torna su un Accetta tutto non più nel DOM e finisce sul `body` (solo per cause esterne, il dialog modale rende inerte la pagina).
- **Decisione presa in LAB-12 (approvata da A11y).** Quando arriva la proposta con il focus nella barra, il focus resta sul pulsante e non segue il diff (WCAG 2.4.3 e 3.2.2). L'annuncio «proposta pronta» è per ora affidato al log della chat; se le prove di LAB-41 dicono che non si sente, la nota della barra scriverà «Proposta pronta» invece di svuotarsi.

## Regola UX di Davide (11/10)

I pulsanti **non diventano mai `disabled`** (né `aria-disabled`). Quando l'azione non è possibile il pulsante resta attivo e, attivato, dice perché in una nota `role="status"` accanto (vuota di norma, svuotata quando la causa sparisce), mai in un toast né in un tooltip, focus che resta sul pulsante. Applicata nella 6b a Invia e Nuova chat, nella 6c alla barra della revisione e al composer (ragioni dal controller: `sendBlocker()`, `acceptBlocker()`); da estendere nella fase 8.

## Lezioni nuove della 6c (oltre a quelle dell'handover 6c, ancora valide)

- Mai `assert.equal` tra nodi di jsdom: il messaggio del RED non finisce più. Usare `focusOn` o valori derivati.
- `--test-timeout` sui test che montano CodeMirror.
- `fakeAi` con `proposals` e `streamingPreview` nello stato di default.
- Uno stato di audit irraggiungibile sulla build vecchia blocca tutto il progetto `current`: `--grep-invert` prima di ricostruire la baseline. Con Playwright 1.63 `--grep-invert` non filtra il progetto `baseline` se `current` ne dipende: lanciare `--project baseline --grep-invert "<stato>"` e poi `--project current --no-deps --grep-invert "<stato>"`.
- Con nessun documento aperto non si apre un documento restando in modalità AI.
- Le ragioni di un'azione rifiutata stanno nel controller, non nella vista: la vista le legge prima di cambiare stato.

## Trappole dell'ambiente

- RAM di ape: tutto Multica ha un tetto di 10 GB (rallenta sopra i 7). Test con browser: `E2E_WORKERS=2` (default) dentro il lock, variabili d'ambiente PRIMA di `flock`: `E2E_WORKERS=2 flock /home/agent/work/.browser-tests.lock npm run test:e2e`. Una suite alla volta; 1 worker solo se una suite cade per memoria (browser chiuso, `QuotaExceededError`), annotandolo. A fine suite `pgrep -af "vite|chrom|playwright"`, chiudere solo i PID propri, mai `pkill` per nome.
- Instabilità note estranee: `settings.spec.ts` «Back again with the confirmation already open keeps a single dialog», `ai-composer.spec.ts:190` (riattivazione della cartella di sync, `Target page… closed`), `ai-review-bar.spec.ts` sul contatore «2 s». Ripetere da soli e annotare.
- I due snapshot dello start screen cadono su ape per il font pixel.
- Il trailer `Co-authored-by: multica-agent` compare in alcuni commit già pushati della fase: non si riscrive la storia, il PM lo esclude dal messaggio di merge.
