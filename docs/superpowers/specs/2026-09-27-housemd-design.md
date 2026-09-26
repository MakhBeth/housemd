# HouseMD — design

Data: 2026-09-27

## Obiettivo

Una webapp statica, nello stile di Pivella, per scrivere markdown su file locali: si apre una cartella dal browser e la si modifica con editor e anteprima affiancati, come su HackMD. Nessun server, nessun account: i file restano dove sono.

Usi previsti (mix):

- **Blog**: i post di `davidedipumpo/posts/` (frontmatter YAML, coppie `nome.md` / `nome.it.md`, immagini referenziate come `/images/…` ma salvate in `static/images/`).
- **Note personali**: tante note in cartelle, collegate con `[[wikilink]]`, da ritrovare con la ricerca.
- **Editor generico**: qualsiasi cartella di markdown, senza convenzioni obbligatorie.

Criterio di successo: la si usa davvero al posto di un editor di testo per scrivere post e note.

## Vincoli

- Solo browser Chromium recenti (Chrome, Edge), desktop: serve la File System Access API. Un dispositivo alla volta, nessuna collaborazione.
- **Policy browser**: poiché l'app richiede comunque Chromium, si usano liberamente le feature supportate da Chromium stabile (Popover, Anchor Positioning, `<dialog closedby>`, CSS Custom Highlight API, `light-dark()`) **senza polyfill**. Unica eccezione: il Sanitizer API, che si usa con fallback a DOMPurify se `Element.prototype.setHTML` non esiste (sicurezza, vedi sotto). Questa policy va scritta nel `CLAUDE.md` del repo.
- Browser non supportati: schermata con messaggio chiaro (come `getUnsupportedBrowserMessage()` di Pivella).

## Scope v1

Essenziale:

- apertura cartella, permessi persistenti, albero file;
- editor CodeMirror 6 + anteprima markdown-it, split con scroll sincronizzato, modalità editor / split / anteprima;
- salvataggio automatico;
- nuovo file, nuova cartella, rinomina, elimina.

In più:

1. frontmatter mostrato come scheda nell'anteprima;
2. incolla / trascina immagini, salvate nella cartella con link inserito in automatico;
3. ricerca full-text;
4. `[[wikilink]]` con autocompletamento.

### Fuori scope (lista "dopo")

- evidenziazione sintassi del codice nell'anteprima, mermaid, KaTeX;
- coppie di traduzione `post.md` ↔ `post.it.md`;
- più cartelle aperte con selettore;
- aggiornamento automatico dei wikilink quando si rinomina un file;
- modalità live preview stile Obsidian;
- supporto mobile.

## Stack

Come Pivella: React 18, Vite, TypeScript, CSS modules, `vite-plugin-pwa`, test con `tsx --test`, deploy su Netlify.

Librerie:

- **CodeMirror 6** (`@codemirror/state`, `view`, `commands`, `lang-markdown`, `autocomplete`, `search`): lo stesso editor di HedgeDoc 2.
- **markdown-it**: lo stesso renderer di HackMD/HedgeDoc.
- **yaml**: parsing del frontmatter (solo lettura, per l'anteprima).
- **MiniSearch**: indice full-text in memoria.
- **DOMPurify**: solo come fallback del Sanitizer API, caricato dinamicamente se serve.

## Architettura

```
src/
  fs/          unico modulo che tocca la File System Access API
  workspace/   stato dell'app: albero, file aperto, contenuto, stato salvataggio
  editor/      CodeMirror 6 + estensioni
  preview/     markdown-it + plugin, sanitizzazione, risoluzione immagini
  search/      indice MiniSearch
  wikilinks/   parsing e risoluzione dei [[link]] (logica pura)
  config/      impostazioni per cartella (.housemd.json)
  ui/          layout e componenti
```

### `fs/`

Interfaccia piccola, implementata una volta con la File System Access API e una volta in memoria per i test (stesso pattern di `SyncFileSystem` / `fsaFileSystem` in Pivella):

```ts
interface WorkspaceFS {
  list(): Promise<Entry[]>;                  // scansione ricorsiva, con Version per ogni file
  read(path: string): Promise<{ text: string; version: Version }>;
  readBlob(path: string): Promise<Blob>;     // immagini
  write(path: string, data: string | Blob): Promise<{ version: Version }>;
  stat(path: string): Promise<Version | null>;
  mkdir(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}
```

- Percorsi sempre relativi alla radice, separati da `/`.
- `Version = { lastModified: number; size: number }` (come `fileVersion()` di Pivella): due versioni sono uguali solo se coincidono entrambi i campi.
- `rename` cambia solo il nome, restando nella stessa cartella padre (spostare file o cartelle altrove è fuori scope v1):
  - **file**: `FileSystemFileHandle.prototype.move(nuovoNome)` se esiste (feature detection come in `pivella/src/lib/sync/fsaFileSystem.ts`), altrimenti copia nel nuovo nome + elimina l'originale;
  - **cartella**: nessun `move()` affidabile per le directory, quindi copia ricorsiva nella nuova cartella, verifica che tutto sia stato copiato, poi `removeEntry(vecchia, { recursive: true })`. Se la copia fallisce a metà, la copia parziale viene eliminata e l'originale resta intatto;
  - dopo la rinomina si aggiornano file aperto, buffer di emergenza e indice per tutti i percorsi coinvolti.
- La scansione salta `.git`, `node_modules` e le cartelle che iniziano con `.`. Nell'albero compaiono solo i `.md` e le cartelle che (anche indirettamente) ne contengono, più le cartelle vuote (così una cartella appena creata dall'app resta visibile).
- Handle della cartella salvato in IndexedDB; gestione dei permessi con `queryPermission` / `requestPermission` (riuso dell'approccio di `pivella/src/lib/utils/fileSystemSync.ts`).

### `config/`

File opzionale `.housemd.json` nella radice della cartella aperta:

```json
{
  "images": {
    "saveTo": "static/images",
    "linkPrefix": "/images"
  }
}
```

- `saveTo`: dove salvare le immagini incollate (default `assets`).
- `linkPrefix`: se presente, il link inserito è `linkPrefix/nome` e nell'anteprima i percorsi che iniziano con `linkPrefix/` vengono risolti in `saveTo/`. Se assente, il link inserito è relativo al file corrente.
- File mancante o non valido: si usano i default, con un avviso non bloccante se il JSON è rotto.

### `wikilinks/`

- Sintassi: `[[nome]]`, `[[cartella/nome]]`, `[[nome|testo mostrato]]`. Il `.md` è implicito.
- Risoluzione: confronto senza distinzione maiuscole/minuscole sul percorso senza estensione. `[[nome]]` trova tutti i file `nome.md` in qualunque cartella; con più risultati vince quello con il percorso più vicino al file corrente (più segmenti in comune), a parità quello più corto e poi in ordine alfabetico.
- Link senza destinazione: segnalati come "mancanti"; se cliccati creano `nome.md` nella cartella del file corrente.

### `preview/`

Pipeline, eseguita con un debounce di circa 150 ms dopo le modifiche:

1. Separazione del frontmatter (`---` iniziale) → parsing con `yaml` → dati per la scheda (title, date, description, tags, image; gli altri campi in una lista chiave/valore). YAML non valido: la scheda mostra un errore e il resto viene renderizzato comunque.
2. markdown-it con `html: true`, `linkify: true`, plugin interni per:
   - `[[wikilink]]` → `<a>` con classe `wikilink` / `wikilink missing`;
   - attributo con la riga sorgente sui blocchi (per lo scroll sincronizzato).
3. **Sanitizzazione obbligatoria**: una cartella clonata da internet può contenere HTML malevolo, e uno script in pagina avrebbe accesso alla cartella aperta. Si inserisce l'HTML con `Element.setHTML()` (Sanitizer API) se disponibile, altrimenti con DOMPurify caricato dinamicamente e configurato in modo equivalente. Mai `innerHTML` o `dangerouslySetInnerHTML` con HTML non sanitizzato.
4. Post-processing sul DOM già sanitizzato: le `<img>` con percorsi locali vengono risolte leggendo il file dalla cartella → `URL.createObjectURL` (con cache per percorso, revoca quando l'immagine non serve più o cambia la cartella). I link esterni si aprono in una nuova scheda; i wikilink e i link relativi a `.md` aprono il file nell'app.

Da verificare in fase di implementazione, con un test: che gli attributi usati per righe sorgente e wikilink sopravvivano al sanitizer (in caso contrario si codificano in `href` o `class`).

**Scroll sincronizzato**: dalla riga in cima all'editor si trova il blocco dell'anteprima con la riga sorgente più vicina e si interpola la posizione, in entrambe le direzioni, con un flag per evitare cicli.

### `search/`

- All'apertura della cartella si leggono tutti i `.md` e si costruisce un indice MiniSearch con i campi `title` (frontmatter o primo `# titolo` o nome file), `path` e `body`.
- Ricerca con prefisso e fuzzy (tolleranza errori), il titolo pesa di più.
- Aggiornamento incrementale a ogni salvataggio, rinomina o eliminazione.
- Risultati con snippet e termine evidenziato. Aprendo un risultato, i termini vengono evidenziati anche nell'anteprima con la **CSS Custom Highlight API** (`CSS.highlights` + `::highlight()`), senza toccare il DOM.
- La stessa lista di file e titoli alimenta l'autocompletamento dei wikilink.

### `editor/`

CodeMirror 6 con:

- `lang-markdown`, history, tasti standard, cerca/sostituisci nel file;
- autocompletamento dopo `[[` con file e titoli;
- gestione di `paste` e `drop` di immagini: salvataggio in `images.saveTo` con nome ricavato dall'originale (slug) oppure `incollata-AAAA-MM-GG-HHMMSS.ext`, con suffisso `-1`, `-2` se il nome esiste già, e inserimento di `![](link)` alla posizione del cursore o del drop;
- tema chiaro/scuro coerente con quello dell'app.

## Flusso dei dati

### Apertura

1. Prima volta: "Apri cartella" → `showDirectoryPicker({ mode: 'readwrite' })` → handle salvato in IndexedDB insieme a un `workspaceId` casuale (UUID) generato in quel momento. Se si sceglie una cartella diversa, cambia anche il `workspaceId`.
2. Volte successive: handle ritrovato; se il permesso è `prompt`, schermata "Riprendi accesso a *nome*" (Chrome richiede un gesto dell'utente).
3. Scansione → albero → lettura dei `.md` → indice e lista dei titoli. Viene riaperto l'ultimo file aperto, se esiste ancora.

### Modifica e salvataggio

- Salvataggio automatico dopo 1 s di inattività; salvataggio immediato cambiando file, con `Ctrl+S` e quando la finestra perde il focus (`visibilitychange` / `blur`).
- Stato nella toolbar: *salvato* / *modifiche…* / *errore*.
- Il file viene scritto esattamente come è nell'editor: il frontmatter non viene mai riscritto.
- Dopo il salvataggio si memorizzano la `Version` restituita e il testo scritto (ultimo contenuto noto su disco).

### Modifiche esterne

Quando la finestra torna in primo piano:

- nuova scansione dell'albero con le `Version` di tutti i `.md`: i file aggiunti o con versione diversa vengono riletti e aggiornati nell'indice di ricerca e nella lista per l'autocompletamento dei wikilink; quelli spariti vengono rimossi;
- per il file aperto, se la `Version` è diversa dall'ultima nota si rilegge il testo e lo si confronta con l'ultimo contenuto noto su disco: se è identico si aggiorna solo la versione, altrimenti
  - senza modifiche in sospeso → ricarica senza chiedere niente;
  - con modifiche in sospeso → barra "Il file è cambiato su disco" con **Ricarica** / **Sovrascrivi**; il salvataggio automatico si sospende finché non si sceglie.
- Il file aperto è stato eliminato da fuori → avviso; il contenuto resta nell'editor e si può salvare di nuovo.

## Interfaccia

```
┌───────────┬───────────────────────────────────────────────┐
│ 🔍 cerca  │ percorso · [Editor|Split|Anteprima] · ● salvato│
│───────────├──────────────────────┬────────────────────────┤
│ 📁 posts  │ editor               │ anteprima              │
│   a.md    │                      │ ┌ scheda frontmatter ┐ │
│ 📁 notes  │                      │ └────────────────────┘ │
└───────────┴──────────────────────┴────────────────────────┘
```

- Sidebar ridimensionabile (larghezza ricordata in `localStorage`) e richiudibile.
- Modalità di default split; l'ultima scelta viene ricordata.
- **Menu contestuale** dell'albero (tasto destro o pulsante "⋯" sulla riga): gruppo di pulsanti in un `popover` posizionato con **Anchor Positioning** e `position-try-fallbacks` per non uscire dallo schermo. Gruppo di pulsanti, non menu ARIA: niente `role="menu"` né `aria-haspopup`.
- **Conferma eliminazione** e **rinomina**: `<dialog>` aperto con `showModal()` e `closedby="any"`. Mai `alert()` / `confirm()` / `prompt()`.
- **Errori e avvisi** (scrittura fallita, config non valida, file eliminato da fuori): toast con `popover="manual"`, che restano visibili finché non vengono chiusi o scadono. La barra "file cambiato su disco" invece è inline sopra l'editor.
- **Tema**: `<meta name="color-scheme" content="light dark">`, `color-scheme: light dark` su `:root`, token colore con `light-dark()`, `accent-color` e `scrollbar-color` coerenti.
- Scorciatoie: `Ctrl+S` salva, `Ctrl+K` va alla ricerca, `Ctrl+\` cambia modalità.
- Accessibilità: albero navigabile da tastiera, focus visibile, stato di salvataggio annunciato con `aria-live="polite"`.

## Gestione errori

- **Permesso revocato o cartella non più raggiungibile**: si torna alla schermata "Riprendi accesso". Il contenuto non salvato viene conservato in memoria e in un buffer di emergenza in IndexedDB, con chiave `workspaceId + percorso` (così file con lo stesso percorso in cartelle diverse non si confondono), e riproposto alla riapertura di quel file in quella cartella. Il buffer viene cancellato dopo un salvataggio riuscito.
- **Scrittura fallita**: stato *errore* + toast; nuovo tentativo al salvataggio successivo; il buffer di emergenza viene aggiornato.
- **Rinomina verso un nome esistente**: errore nel dialog, nessuna sovrascrittura.
- **Browser non supportato**: schermata dedicata.

## Test

Logica pura con `tsx --test`, contro l'implementazione in memoria di `WorkspaceFS`:

- risoluzione dei wikilink (ambiguità, percorsi, alias, mancanti);
- parsing del frontmatter (valido, assente, YAML rotto);
- risoluzione dei percorsi delle immagini con e senza `linkPrefix`;
- generazione di nomi immagine univoci;
- indice di ricerca (costruzione, aggiornamento, rimozione);
- decisione su modifiche esterne (ricarica / conflitto / file eliminato / versione cambiata ma contenuto identico) e aggiornamento dell'indice per i file cambiati da fuori;
- rinomina di file e cartelle, incluso il rollback se la copia ricorsiva fallisce;
- chiavi del buffer di emergenza separate per `workspaceId`;
- plugin markdown-it (wikilink, righe sorgente) e sopravvivenza degli attributi alla sanitizzazione (con DOMPurify in ambiente di test).

UI: verifica manuale in Chrome su una copia della cartella del blog, con una checklist nel piano di implementazione.
