# HouseMD v1.1 — design

Data: 2026-09-27
Base: HouseMD v1 (branch `feat/housemd-v1`, spec `2026-09-27-housemd-design.md`).

## Obiettivo

Rifinire HouseMD dopo il primo collaudo: identità visiva (logo, icone, font, tema), interfaccia multilingua, autosave configurabile come VS Code, cronologia locale delle versioni, PWA installabile e con aggiornamenti sicuri.

## Vincoli (invariati da v1)

- Solo Chromium desktop recente, nessun polyfill; policy in `CLAUDE.md`.
- Nessuna risorsa da CDN o Google: font e icone arrivano da pacchetti npm e finiscono nel bundle.
- Mai `innerHTML`/`dangerouslySetInnerHTML` con HTML non sanitizzato; mai `alert/confirm/prompt`.
- Logica in moduli puri testati con `tsx --test`; componenti React sottili.
- Nessun testo dell'interfaccia scritto a mano nei componenti: tutto passa da `t()`.

## Fuori scope (lista "dopo")

- `file_handlers` nel manifest ("Apri con… HouseMD" per i `.md`).
- Undo persistente per file tra cambi di file (cronologia di CodeMirror per file in memoria).
- Lingue da destra a sinistra (arabo, ebraico).

## 1. Identità visiva

### Logo

- La schermata iniziale (`StartScreen`) mostra la casa in braille (le 33 righe di `README.md`, stesso testo) al posto del titolo testuale.
- `<pre aria-hidden="true">` in Space Mono, `line-height: 1`, `font-size: clamp()` calcolato perché 65 colonne stiano nella larghezza senza andare a capo; `<h1>` visivamente nascosto con "HouseMD" per gli screen reader.
- Il testo del logo sta in un modulo `src/ui/logo.ts` (costante esportata), con un test che lo confronta riga per riga con il blocco del README (33 righe da 65 caratteri).

### Icone (Pixelarticons)

- Dipendenza `pixelarticons` (SVG). Componente `src/ui/Icon.tsx`: `<span className="icon" style={{ maskImage: url(svg) }} aria-hidden />`, colore da `currentColor` tramite `background-color`, dimensione da `--icon-size` (default 20px), `image-rendering: pixelated` sul mask.
- Mappa nome → URL in `src/ui/icons.ts` (import `?url` di Vite dagli SVG del pacchetto), così un'icona inesistente è un errore di TypeScript. Un test verifica che ogni file SVG referenziato esista in `node_modules/pixelarticons/svg/`.
- Icone usate: sidebar (apri/chiudi), nuovo file, nuova cartella, menu azioni, cartella chiusa/aperta, file, file con bozza, ricerca, impostazioni, tema auto/chiaro/scuro, cronologia, chiudi, avviso/conflitto, salva.
- Pulsanti con sola icona: sempre `aria-label` tradotto e `title` (tooltip).

### Font

- `@fontsource/space-grotesk` (400, 500, 700) per interfaccia e anteprima; `@fontsource/space-mono` (400, 700) per editor, codice e logo. Importati in `main.tsx`; i `.woff2` finiscono nel bundle.
- Token: `--font-ui` e `--font-prose` → `'Space Grotesk', system-ui, sans-serif`; `--font-mono` → `'Space Mono', ui-monospace, monospace`. Il giapponese ricade sui font di sistema.

### Sidebar

- Pulsante con icona a sinistra nella toolbar (sempre visibile, anche a sidebar chiusa) e lo stesso nella testata della sidebar. Scorciatoia `Ctrl/Cmd+B`. Stato ricordato come oggi.

### Tema e switcher "a pixel"

- Tre stati: `auto` (segue il sistema), `light`, `dark`. Pulsante nella toolbar che cicla `auto → light → dark → auto`, icona e tooltip dello stato corrente; lo stesso valore è modificabile nelle impostazioni.
- Applicazione: `document.documentElement.dataset.theme` e `style.colorScheme` = `light dark` | `light` | `dark`. I token `light-dark()` di `global.css` restano invariati. `<meta name="theme-color">` aggiornato al colore di sfondo effettivo.
- Transizione: `document.startViewTransition(() => applyTheme(next))`. In `global.css`:
  - `::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }`
  - `::view-transition-old(root) { z-index: 1; }` (il vecchio tema sta sopra e viene "mangiato").
- Dopo `transition.ready`: un modulo puro `src/theme/pixelMask.ts` calcola l'ordine casuale dei blocchi di una griglia (celle da 24px sulla dimensione della finestra) e le soglie per 12 fotogrammi; `src/theme/pixelTransition.ts` disegna ogni fotogramma su un canvas (blocchi ancora visibili = opachi) → `toDataURL()`, e anima `document.documentElement.animate({ maskImage: frames.map(url) , maskSize: ['100% 100%'] }, { duration: 450, easing: 'steps(12, end)', pseudoElement: '::view-transition-old(root)', fill: 'forwards' })`. Mask con `image-rendering: pixelated`.
- Senza `startViewTransition` o con `prefers-reduced-motion: reduce`: cambio istantaneo. Il focus resta sul pulsante (non viene rimosso), quindi non serve spostarlo.
- Preferenza in `localStorage` (`housemd:theme`), applicata prima del primo render (script inline minimo in `index.html` che legge la preferenza e imposta `data-theme`/`color-scheme`, per evitare il lampo di tema sbagliato).
- Test: `pixelMask` (tutte le celle scoperte all'ultimo fotogramma, ordine deterministico con seed, numero di celle per fotogramma crescente), `nextTheme()` e `resolveColorScheme()`.

## 2. Multilingua

- Lingue: `it`, `en`, `es`, `fr`, `de`, `pt`, `nl`, `pl`, `ja`. File `src/i18n/locales/<lang>.json`, oggetto piatto `chiave → stringa`, segnaposto `{nome}`.
- `en.json` è il riferimento: `type MessageKey = keyof typeof en`.
- `src/i18n/i18n.ts` (puro):
  - `SUPPORTED_LOCALES`, `detectLocale(languages: readonly string[]): Locale` — prima lingua supportata (confronto sul prefisso: `pt-BR` → `pt`), altrimenti `en`.
  - `translate(messages, key, params?)` — interpolazione `{x}`; segnaposto mancante lasciato visibile.
  - `formatDate(locale, date)` e `formatRelative(locale, date, now)` con `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` ("oggi 14:32", "ieri 09:10", altrimenti data breve).
- React: `I18nProvider` (context) con `locale`, `setLocale`, `t`; `useT()`. Cambiando lingua aggiorna `<html lang>` e la preferenza `housemd:locale`. Le lingue diverse da `en` vengono caricate con `import()` dinamico (chunk separati, inclusi nel precache PWA).
- Messaggi dal `Workspace`: `Toast` diventa `{ id, kind, code: ToastCode, params?: Record<string, string | number> }`. `ToastCode` è un'unione chiusa (es. `saveFailed`, `configInvalid`, `restoredDraft`, `deletedOutside`, `unreadableFiles`, `alreadyExists`, `operationFailed`, `imageSaved`, `saveAllSkipped`, `newVersion`, …); l'interfaccia li traduce con `t('toast.' + code, params)`. I dettagli tecnici (messaggio d'errore del browser o del parser YAML) passano come parametro `{detail}` e restano in lingua originale.
- Anche i messaggi di `parseConfig` e di validazione dei nomi (`validateName`) diventano codici tradotti dall'interfaccia.
- Traduzioni: `it.json` ed `en.json` scritti durante l'implementazione; le altre 7 lingue generate da un subagent dedicato a partire da questi due.
- Test (`src/i18n/locales.test.ts`): ogni lingua ha esattamente le chiavi di `en.json`, nessuna stringa vuota, stessi segnaposto per chiave; più test per `detectLocale`, `translate`, `formatRelative`.

## 3. Autosave configurabile e impostazioni

### Modalità

- `afterDelay` (default, `delayMs` 1000, range 500–10000): come v1 — salvataggio dopo la pausa, al blur della finestra e al cambio file.
- `onFocusChange`: nessun salvataggio a tempo; salva al cambio file e al blur della finestra.
- `off`: solo `Ctrl/Cmd+S` (e "Salva tutto").

### Comportamento

- `Workspace.setAutosave({ mode, delayMs })`; il valore corrente sta in `WorkspaceState.autosave`.
- In `onFocusChange` e `off`, `edit()` non programma scritture su disco ma programma la scrittura del **buffer di emergenza** (debounce 1000 ms), come oggi in conflitto: una chiusura improvvisa non perde testo.
- Cambio file:
  - `afterDelay`/`onFocusChange`: `settle()` come oggi (scrive su disco).
  - `off`: `settle()` non scrive su disco; mette il testo nel buffer (con la sua base) e cambia file. Riaprendo il file, la bozza viene ripristinata con la logica esistente (`dirty` se la base coincide col disco, conflitto altrimenti).
- Blur della finestra: `WorkspaceView` chiama `flush()` solo in `afterDelay`/`onFocusChange`; in `off` bufferizza soltanto.
- File con bozza: `Workspace.draftPaths()` (da `BufferStore.list`) → `WorkspaceState.drafts: string[]`, aggiornato quando un buffer viene scritto o cancellato. L'albero mostra l'icona "file con bozza" (pallino) su quei file; la toolbar mostra "Non salvato" col pallino quando il file aperto è `dirty`.
- `saveAll()` (`Ctrl/Cmd+Alt+S` e voce nelle impostazioni/toolbar): per ogni bozza — se la base coincide con il disco scrive il file e cancella la bozza; altrimenti la lascia (conflitto) e alla fine mostra un toast `saveAllSkipped` con il numero.
- Chiusura della pagina con bozze o documento `dirty`: `beforeunload` con `preventDefault()` (avviso nativo del browser).
- Test: per ogni modalità — salvataggio a tempo solo in `afterDelay`; al cambio file scrittura su disco in `afterDelay`/`onFocusChange` e solo bozza in `off`; buffer scritto durante la digitazione in `off`/`onFocusChange`; `saveAll` scrive le bozze valide e salta quelle in conflitto; `drafts` aggiornato.

### Impostazioni

- Icona ingranaggio nella toolbar → `<dialog closedby="any">` (con la guardia sugli eventi `close` fantasma già usata in v1) con: lingua (select), tema (3 radio), autosave (3 radio) e ritardo (input numerico, visibile solo in `afterDelay`).
- Preferenze del browser in `localStorage` via `prefs.ts` (`housemd:locale`, `housemd:theme`, `housemd:autosave`), lette con validazione (valori sconosciuti → default).

## 4. Local History

- Nuovo object store IndexedDB `history` nel database `HouseMD` (versione del DB 1 → 2, con upgrade che crea lo store senza toccare gli altri), chiave autoincrement, indice `byFile` su `[workspaceId, path, savedAt]`.
- Record: `{ workspaceId, path, savedAt: number, text: string, reason: 'save' | 'before-reload' | 'before-overwrite' | 'before-restore' }`.
- `src/history/policy.ts` (puro):
  - `shouldSnapshot(last, candidate, now)`: no se il testo è uguale all'ultimo snapshot; per `save` no se l'ultimo `save` è più recente di 5 minuti; sempre sì per i `before-*`.
  - `toPrune(snapshots, now)`: oltre i 50 più recenti per file, e quelli più vecchi di 30 giorni.
- `src/history/historyStore.ts`: interfaccia `HistoryStore { add, list(ws, path), get(id), move(ws, from, to), prune(ws, path, now) }`, implementazione IndexedDB e in memoria (test).
- Aggancio in `Workspace` (dipendenza opzionale `history`):
  - dopo ogni scrittura riuscita del documento → snapshot `save` (se la policy lo consente);
  - prima di applicare una ricarica dal disco o di "Ricarica" in un conflitto → snapshot `before-reload` del testo che si sta per perdere;
  - prima di "Sovrascrivi" in un conflitto → snapshot `before-overwrite` del testo su disco;
  - prima di un ripristino → snapshot `before-restore` del testo corrente;
  - rinomina di file/cartelle → `history.move`; eliminazione → la cronologia resta.
  - Errori della cronologia non bloccano mai il salvataggio (catturati, al massimo un toast).
- Ripristino: `Workspace.restoreVersion(id)` sostituisce il testo del documento aperto come una modifica utente (`edit`), quindi è annullabile con `Ctrl+Z` e segue la modalità autosave. Nell'editor il ripristino passa da una transazione CodeMirror (non da `resetKey`), per mantenere la cronologia di annullamento.
- Interfaccia `src/ui/HistoryPanel.tsx`: aperto dalla voce "Cronologia" del menu ⋯ e dall'icona nella toolbar; si sovrappone al riquadro dell'anteprima (in modalità solo editor occupa la metà destra). Lista versioni con `formatRelative` e motivo tradotto; selezionando una versione mostra il diff a righe rispetto al testo corrente (libreria `diff`, `diffLines`), righe aggiunte/tolte colorate e renderizzate come testo (mai HTML); pulsante "Ripristina".
- Test: `policy` (throttle, dedup, pruning), `historyStore` (memoria + IndexedDB con fake-indexeddb, `move`), `Workspace` (snapshot nei quattro momenti, rinomina, errore della cronologia non blocca il salvataggio, `restoreVersion`).

## 5. PWA

- `registerType: 'prompt'`: all'arrivo di un nuovo service worker compare un toast persistente `newVersion` con pulsante "Aggiorna" → `settle()` del documento aperto, poi `updateSW(true)`.
- Manifest: `id: '/'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, nome e descrizione, icone 192 e 512 `any` più una 512 `maskable` separata (con margine di sicurezza, generata da un SVG dedicato), `theme_color`/`background_color` coerenti.
- Precache: JS, CSS, HTML, SVG (icone pixel), PNG, `woff2` (font), chunk delle lingue.
- Collaudo: icona "Installa" in Chrome, app installata che parte offline, toast di aggiornamento dopo un nuovo build.

## Test e collaudo

- Tutta la logica nuova in moduli puri con test (`tsx --test`): logo, icone, pixelMask/tema, i18n e locales, autosave nel `Workspace`, history policy/store/integrazione.
- `npm test`, `npm run lint`, `npm run build` puliti.
- Collaudo manuale in Chrome sulla copia del blog in `/tmp/housemd-prova`: logo, icone, font, toggle sidebar e `Ctrl+B`, switcher con dissolvenza a pixel (e senza con "riduci animazioni"), cambio lingua, tre modalità di autosave con bozze e "Salva tutto", cronologia con diff e ripristino, installazione e avvio offline, toast di aggiornamento.
