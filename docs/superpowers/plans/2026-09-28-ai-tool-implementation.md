# Implementazione AI HouseMD

Spec di riferimento: `../specs/2026-09-27-ai-tool-design.md`, autorizzata da Davide il 28 settembre 2026.
Branch: `feat/ai-tool`, base `6f9a568` (v1.1). Nessuna migrazione Web Components.

## Sequenza e verifiche

- [x] 0: lettura completa spec, baseline 342 test, lint e build verdi.
- [x] 1: tipi, profili, secret binding, provider, SSE; fetch e SDK simulati.
- [x] 2: bridge CLI isolato, origini, coda/abort e health; binario simulato.
- [x] 3: store IndexedDB v3, impostazioni, selettore, sidebar e chat.
- [x] 4: DocSession verificato prima della vista; MergeView, accettazione undoabile, before-ai, PWA.
- [x] 5: preset personalizzabili, frontmatter, controlli.
- [x] 6: affiancata e preview non fidata; allineamento e scroll.
- [x] 7: runner sequenziale, Stop/Continua, selezione rimappata.
- [x] 8: sync opzionale best effort, backup verificati, restore per epoche.
- [x] 9: localizzazione (148 chiavi AI + motivo cronologia nelle 9 lingue), README, test/lint/build e smoke Chromium automatizzato.
- [ ] 9, collaudi esterni: account/provider reali, CORS pubblicato, CLI reale, FSA tra profili e PWA offline (richiedono ambiente utente).

Ownership parallela: provider/bridge; store/sync; integrazione e UI. Dipendenze previste: @codemirror/merge,
@codemirror/commands e SDK Anthropic importato dinamicamente. Nessuna chiamata API a pagamento.

## Collaudi esterni non verificabili automaticamente

Restano da eseguire con account/server reali e Chromium: CORS da origine pubblicata e locale, permesso rete
locale, Ollama/LM Studio/Anthropic, autenticazione CLI Claude e mancata persistenza reale, PWA offline,
interazioni visuali/tastiera e rete DevTools, due profili Chrome con cartella condivisa. I mock non attestano
questi collaudi. Non sono richiesti push, merge o deploy.

## Esito delle verifiche

- Suite finale: **432 test passati**, zero fallimenti (baseline 342). Comprende provider, bridge simulato,
  store IndexedDB, algebra merge, concorrenza/restore, runner/controller, protocollo e sicurezza rendering.
- `npm run lint`: passato. `npm run build`: passato; SDK Anthropic in chunk separato. Warning chunk >500 kB
  già presente nella baseline, nessun errore di build/precache.
- `npm run test:browser`: passato su Chromium headless isolato; filesystem in memoria e fetch finto.
  Verifica sidebar AI senza proposta, generazione, accettazione totale e per blocco, Diff → Affiancata → File →
  undo, snapshot `before-ai`, proposta con immagine/HTML/srcset/frontmatter ostili senza richieste di rete,
  caricamento immagine solo dopo clic; selezione intra-riga con accettazione ripetuta e per blocchi;
  ripristino cronologia di lunghezza diversa seguito da undo. Nessuna eccezione runtime o errore console.
- Review indipendente: corrette regressioni snapshot con referenza obsoleta, scarto durante thinking,
  pending dopo ritocco, accettazione durante rigenerazione, scope rimappato, cambio provider, selettore Altro,
  sequenza monotona editor destro e blocco delle modifiche esterne alla selezione nella proposta.
- Revisione finale del parent: corretti scope che si allargava alle righe esterne durante accettazioni,
  selezione obsoleta su Riprova, nomi backup concorrenti, perdita del contesto live del modello e
  RangeError sul ripristino della cronologia. Aggiunte regressioni riprodotte prima dei fix; suite completa,
  lint, build, Chromium e `git diff --check` riconfermati dopo tutte le correzioni.
- Nessun push, merge o deploy. Nessun account reale o documento privato usato nei collaudi.

## Scelte attuative

- Origine pubblicata non nota: bridge fail-closed su origine dev; `ALLOWED_ORIGINS` esplicita per produzione.
- Verifica connessione Anthropic tramite GET modelli, senza generazione a pagamento.
- Se IndexedDB non è disponibile, sessione AI in memoria con avviso; nessuna persistenza simulata come riuscita.
- Test browser riproducibile senza dipendenze aggiuntive (`CHROMIUM_BIN` opzionale). Profili temporanei eliminati.
