# Pulizia della UI AI

Data: 2026-09-29 · Branch: `feat/ai-ui` (PR impilata su `feat/ai-tool`, PR #1) · Stato: design approvato in chat

## 1. Obiettivo

La UI AI arrivata con la PR #1 funziona ma sembra un corpo estraneo: bottoni e checkbox nativi senza stile,
tre modi per entrare nella stessa vista, impostazioni in un modale lungo, una barra di revisione con una decina di
controlli. L'obiettivo è che chat, revisione e impostazioni sembrino parte di HouseMD (icone, tooltip, CSS modules
come la toolbar) e facciano le stesse cose di oggi con meno rumore.

**Criterio di successo:** con un profilo configurato si entra in modalità AI da un'icona, si chiede o si lancia un
preset, si scorre e si accetta la proposta senza incontrare controlli inutili; le impostazioni sono una pagina
raggiungibile per link; nessuna funzione della logica AI (`src/ai/*`) cambia comportamento, salvo quelle rimosse
esplicitamente in §7.

**Fuori perimetro:** logica dei provider, bridge, sync, prompt, chunking; nuove funzioni AI; restyling di parti non AI
dell'app (albero file, cronologia, ricerca) oltre a quanto serve per ospitare la vista impostazioni.

## 2. Decisioni prese (dalla conversazione del 29/9)

| # | Decisione |
|---|---|
| D1 | AI diventa la quarta modalità nella toolbar (icona accanto a Editor, Split, Preview). Spariscono i tab Files/AI in cima alla sidebar e il bottone testuale "AI" della toolbar. |
| D2 | In modalità AI la sidebar mostra la chat **al posto** dell'albero file. È solo un tipo di visualizzazione: niente pannelli aggiuntivi. |
| D3 | Le impostazioni (tutte, non solo AI) diventano una vista a pagina, senza router, indirizzata dall'hash (`#settings`, `#settings/<sezione>`). |
| D4 | Composer in stile Claude: una casella con chip modello (ed effort, se supportato) e pulsante invio dentro. Invio invia, Shift+Invio va a capo. |
| D5 | La checkbox "Selection only" sparisce: un chip compare da solo quando nell'editor c'è una selezione. |
| D6 | I preset diventano suggerimenti sotto il composer e **spariscono** appena c'è un messaggio nella chat. Il bottone "Manage presets…" sparisce. |
| D7 | "Nuova chat" è un'icona in cima alla sidebar AI. |
| D8 | La vista affiancata ("Side by side") viene rimossa. La barra di revisione tiene solo frecce precedente/successivo, avvisi, Scarta e Accetta tutto (questi ultimi meno evidenti). Spariscono "Complete", conteggio parole, "1/1" a lavoro finito, "Diff", "Hide unchanged parts" e la riga "Original / AI proposal". |
| D9 | Approccio: riscrittura dei componenti AI in stile del repo (formattati, CSS modules, `Icon`/`tooltip`), logica pura invariata. |

## 3. Navigazione e layout

### 3.1 Modalità

`type Mode = 'editor' | 'split' | 'preview' | 'ai'`. `MODES` in `WorkspaceView.tsx` guadagna
`{ id: 'ai', label: 'mode.ai', icon: 'modeAi' }` (icona `pixelarticons/svg/sparkles.svg`). La modalità AI appare solo
se il controller AI esiste (`ai` non nullo); altrimenti i pulsanti restano tre.

- La preferenza `mode` può valere `'ai'`. La vecchia preferenza `sidebarView` non si legge più: al primo avvio
  chi l'aveva a `'ai'` si ritrova nella modalità salvata in `mode` (nessuna migrazione, perdita accettabile).
- `Ctrl/Cmd+Shift+E` alterna AI ↔ ultima modalità non AI (salvata in memoria, default `editor`).
- `Ctrl/Cmd+K` (ricerca, `shortcuts.ts`) resta. Oggi fa `switchSidebar('files')` e mette il focus sul campo di
  ricerca; in modalità AI farà lo stesso uscendo prima dalla modalità AI verso l'ultima modalità non AI.
- `Esc` in modalità AI con una generazione in corso chiama `ai.stop()` (come oggi).
- Il bottone Cronologia in modalità AI passa prima alla modalità precedente e poi apre la cronologia (oggi fa
  `switchSidebar('files')`).

### 3.2 Sidebar

- Modalità Editor/Split/Preview: albero file com'è oggi, **senza** la riga dei tab Files/AI.
- Modalità AI: `AiSidebar`. Larghezza separata (`aiSidebarWidth`, 300–640 px) come oggi. `Ctrl/Cmd+B` la apre e
  chiude anche in AI.
- Il file si cambia dai separatori-link nella chat o tornando in un'altra modalità.

### 3.3 Area principale in modalità AI

`ReviewView` con la barra compatta (§5) e il diff. Senza proposta per il documento corrente: l'editor normale
(stesse props di oggi) e, al posto della barra, un testo tenue "Scrivi una richiesta o scegli un suggerimento"
(chiave `ai.emptyProposal`, già esistente, testo aggiornato).

### 3.4 Vista impostazioni (hash)

- Modulo puro `src/lib/route.ts`:
  - `type Route = { view: 'workspace' } | { view: 'settings'; section: SettingsSection }`
  - `type SettingsSection = 'general' | 'ai-profiles' | 'ai-presets' | 'ai-sync'`
  - `parseRoute(hash: string): Route` — `''`, `'#'` e qualsiasi hash sconosciuto → `workspace`;
    `#settings` → `settings/general`; `#settings/<sezione valida>` → quella sezione; sezione sconosciuta →
    `settings/general`.
  - `formatRoute(route: Route): string` — inverso (`workspace` → `''`, `settings/general` → `#settings`).
- Hook sottile `useRoute()` in `src/ui/useRoute.ts`: legge `location.hash`, ascolta `hashchange`, espone
  `navigate(route, { replace? })`. Aprire le impostazioni fa `location.hash = …` (nuova voce di cronologia);
  chiuderle fa `history.back()` se si è entrati dall'app nella stessa sessione, altrimenti `replaceState` a `''`.
- Con `settings` la vista sostituisce toolbar e area principale; la sidebar resta nascosta. Si chiude con la X,
  con `Esc` (se il focus non è in un campo con modifiche non salvate, vedi §6) o con Indietro del browser; si torna
  alla modalità di prima (lo stato React non si smonta: `WorkspaceView` resta montato e la vista impostazioni si
  sovrappone come layout alternativo).
- L'hash non contiene mai dati (niente percorsi di file, nomi di profili, chiavi).
- Link interni che oggi aprono il modale (`onSettings`, "Manage profiles…", avviso "Riattiva sincronizzazione")
  diventano `navigate({ view: 'settings', section })` con la sezione pertinente.

Restano `<dialog>` solo `ConfirmDialog` e `NameDialog` (regola di `CLAUDE.md`).

## 4. Chat e composer (`AiSidebar`)

### 4.1 Struttura

```
AiSidebar
├─ intestazione: titolo "AI" · icona Nuova chat
├─ ChatLog            (occupa lo spazio, scorre)
├─ Composer
│   ├─ SelectionChip  (solo con selezione)
│   ├─ textarea
│   └─ riga: ModelChip · EffortChip? · pulsante Invia/Stop
└─ Suggestions        (solo con chat vuota)
```

### 4.2 Composer

- **Tastiera** (modulo puro `src/ai/composerKeys.ts`,
  `composerAction(e: { key; shiftKey; ctrlKey; metaKey; altKey; isComposing }, running: boolean)` →
  `'send' | 'newline' | 'stop' | 'none'`):
  - `isComposing` → `none` (IME);
  - `Enter` senza modificatori → `send`; `Shift+Enter` → `newline` (comportamento nativo, niente
    `preventDefault`); `Ctrl/Cmd+Enter` e `Alt+Enter` → `none` (la vecchia scorciatoia Ctrl+Invio sparisce);
  - `Escape` con `running` → `stop`;
  - tutto il resto → `none`.
  Con `send` il componente fa `preventDefault` e invia solo se il testo non è vuoto e c'è un profilo.
- **Pulsante**: icona `arrow-up` (Invia, disabilitato con testo vuoto o senza profilo) che durante la generazione
  diventa `stop-solid` (Stop). Tooltip e `aria-label` da `t()`.
- **Textarea**: altezza automatica da 2 a ~10 righe (`field-sizing: content` con `min-height`/`max-height`),
  placeholder `ai.request` aggiornato con l'indicazione di Shift+Invio (es. "Chiedi qualcosa… (Shift+Invio per
  andare a capo)").
- Dopo l'invio di un messaggio libero la textarea si svuota (come oggi).

### 4.3 Chip della selezione

- `Editor` guadagna una prop opzionale `onSelection?: (range: { from: number; to: number } | null) => void`,
  chiamata dall'`updateListener` di CodeMirror quando cambia `selection.main` (`null` se vuota). Nessun'altra
  modifica all'editor.
- `WorkspaceView` tiene `aiSelection` nello stato e lo passa ad `AiSidebar`; `getSelection()` (lo scope inviato)
  resta calcolato al momento dell'invio da `session`, come oggi, quindi il comportamento di `scope.ts` non cambia.
- Modulo puro `src/ai/selectionChip.ts`: `selectionLabel(text: string, range)` →
  `{ lines: number; chars: number } | null` (null se vuota o solo spazi).
- Il chip mostra "Selezione · N righe" (o "N caratteri" se è una riga sola) e una ✕. La ✕ imposta "ignorata" per
  quella selezione: il chip ricompare alla successiva selezione diversa. Con il chip visibile l'invio usa lo scope
  della selezione; senza chip (assente o ignorato), il documento intero.
- Se al momento dell'invio il chip è visibile ma `getSelection()` non restituisce nulla (selezione persa nel
  frattempo), si mostra l'errore `scopeLost` come oggi. Non può più capitare il caso "checkbox attiva senza
  selezione".

### 4.4 Chip modello ed effort

- `ModelChip`: pulsante con `nome profilo · modello` (o `CLI default`), `⌄`, pallino "•" se ci sono override della
  chat. Tooltip: la nota privacy di oggi (`ai.claudePrivacy` / `ai.localPrivacy` / `ai.cloudPrivacy`).
- Apre un popover (Popover API, `popover="auto"`, posizionato con Anchor Positioning sopra il chip) con, in ordine:
  profili raggruppati Locali/Cloud (radio), modello del profilo attivo (`ModelSelect` esistente), parametri
  supportati (`Parameters` esistente, formattato), azioni "Salva nel profilo", "Salva come nuovo", "Ripristina",
  link "Gestisci profili" (`#settings/ai-profiles`).
- `EffortChip`: presente solo se `capabilities(...).effort`; menu con `Predefinito, low, medium, high, xhigh, max`.
  Scrive nello stesso override della chat usato oggi dal popover parametri. Per non duplicarlo, `Parameters`
  guadagna una prop `hideEffort` usata nel popover del modello; il dettaglio dei preset nelle impostazioni
  continua a mostrare l'effort.

### 4.5 Suggerimenti

Preset non nascosti, ordinati per `order`, resi come chip leggeri sotto il composer; clic = `send(preset)`
come oggi. Visibili solo quando `state.chat.messages.length === 0` e nessuna generazione è in corso.
Tornano con Nuova chat.

### 4.6 Messaggi

- Utente: riquadro leggero allineato a destra, testo semplice.
- Assistente: markdown (via `safeRender` + `setSafeHTML` come oggi), senza riquadro.
- Separatore con nome file cliccabile quando `docPath` cambia rispetto al messaggio precedente (come oggi).
- Metadati (profilo, modello, token, riepilogo parti/parole) in una riga piccola visibile al passaggio del mouse e
  al focus del messaggio.
- Errori del messaggio, avvisi e "Riprova" / "Ripristina · Riprova" restano nel messaggio.
- Nessun cambiamento a cosa viene persistito (niente).

### 4.7 Errori generali

`state.error` (errori non legati a un messaggio: sync, chiave mancante, `scopeLost`…) compare nello stesso
contenitore dei toast dell'app. `Toasts` oggi accetta solo i `Toast` del `Workspace`, con codici chiusi
(`workspace/toasts.ts`) tradotti come `toast.<code>`; i codici AI non vanno aggiunti lì (sono un altro dominio).

- `Toasts` diventa presentazionale: `items: { key: string; kind: Toast['kind']; text: string }[]`
  e `onDismiss(key)`. Chiusura automatica solo per `info` (come oggi), popover e stile invariati.
- `WorkspaceView` costruisce la lista: i toast del `Workspace` (`key: 'ws-<id>'`, testo
  `t('toast.' + code, params)`, come oggi) seguiti, se `ai.state.error` è valorizzato, da
  `{ key: 'ai-error', kind: 'error', text: t('ai.error.' + code) }`. Le chiavi `ai.error.*` esistono già in tutti
  i locali. `onDismiss('ai-error')` chiama `ai.clearError()`; gli altri `dismissToast(id)`.
- Si eliminano `AiNotice` e il `<p role="alert">` della sidebar.

## 5. Barra di revisione (`ReviewBar`)

```
[↑] [↓]   ‹stato›                                   ⚠ 2    Scarta   Accetta tutto
```

- Frecce: icone `chevron-up` / `chevron-down`, tooltip "Modifica precedente/successiva", disabilitate durante la
  generazione o senza proposta.
- Stato (modulo puro `src/ai/reviewStatus.ts`,
  `reviewStatus({ proposal, running, elapsedSeconds, applied })` → descrittore). `applied` lo calcola `ReviewView`
  come oggi (`ReviewView.tsx:21`: testo della proposta applicata uguale al testo del documento e proposta non in
  streaming); `appliedPaths` del controller resta privato:
  - nessuna proposta → nessuno stato (la barra mostra il testo di §3.3);
  - generazione in corso → "Generazione… 12 s" e, se multi-parte, "3/7";
  - `partial` → "Parziale" + pulsante **Continua**;
  - `truncated` → "Troncata: accetta per blocchi";
  - `scope.status === 'lost'` → "La selezione è cambiata";
  - proposta completa e già applicata → "Applicata";
  - proposta completa → nessuno stato.
- Avvisi: "⚠ N" solo se N > 0; apre un popover con l'elenco, clic = salta alla riga (come oggi).
- Scarta e Accetta tutto: stile secondario; Accetta tutto con testo in colore accento. Stesse condizioni di
  abilitazione e stessa conferma (`ConfirmDialog` quando il documento è cambiato) di oggi.
- `streamingPreview` (anteprima grezza durante lo streaming): resta, come `<details>` chiuso sotto la barra.

## 6. Pagina impostazioni (`SettingsView`)

- Layout a due colonne: indice a sinistra (Generale, AI · Profili, AI · Preset, AI · Sync), contenuto a destra
  come una pagina unica con le sezioni una sotto l'altra. Le voci dell'indice sono link all'hash della sezione;
  la voce della sezione visibile è evidenziata (IntersectionObserver). Sotto i 700 px l'indice va in cima,
  orizzontale e scorrevole.
- Entrando con `#settings/<sezione>` si scorre a quella sezione.
- **Generale**: lingua, tema, salvataggio automatico e pausa (i campi di oggi di `SettingsDialog`) e il pulsante
  "Salva tutto ora".
- **AI · Profili** e **AI · Preset**: elenco/dettaglio. Elenco a sinistra con "+ Nuovo"; dettaglio a destra con gli
  stessi campi di oggi (per i preset senza "Vista", vedi §7). Salva, Duplica, Elimina; Elimina chiede conferma con
  `ConfirmDialog`. Cambiare elemento con modifiche non salvate chiede conferma.
- **AI · Sync**: la sezione di oggi, formattata.
- Senza controller AI (`ai` nullo) le sezioni AI non compaiono.
- `Esc` chiude la vista solo se non ci sono modifiche non salvate in un dettaglio; altrimenti chiede conferma.

## 7. Rimozioni

- `src/ui/ai/SideBySidePane.tsx`, lo scorrimento collegato, l'anteprima nel pannello destro.
- Preferenze `aiView`, `aiRightPane`, `aiLinkedScroll`, `sidebarView` (non più lette né scritte).
- Il selettore "Vista" nel dettaglio preset. **Il campo `view` di `PromptPreset` resta** nel tipo, in
  `normalizePreset` e nello schema di sync (`src/ai/sync/schema.ts`), ignorato dalla UI: toglierlo romperebbe la
  compatibilità con file di sync già scritti da altri browser.
- `src/ui/ai/AiNotice.tsx`, `src/ui/ai/ai.css`, `src/ui/SettingsDialog.tsx` (+ il suo CSS module).
- Le chiavi i18n rimaste senza uso, da tutti i `locales/*.json`.

## 8. Struttura del codice

- Nuovi moduli puri con test: `src/lib/route.ts`, `src/ai/composerKeys.ts`, `src/ai/selectionChip.ts`,
  `src/ai/reviewStatus.ts`.
- Componenti in `src/ui/ai/`: `AiSidebar`, `Composer`, `SelectionChip`, `ModelChip`, `EffortChip`, `Suggestions`,
  `ChatLog`, `ReviewView`, `ReviewBar`, `DiffPane`, `ModelSelect`, `Parameters` (estratto da `ModelSelector.tsx`,
  che sparisce); ognuno con il suo `*.module.css` quando ha stili.
- `src/ui/SettingsView.tsx` (+ `.module.css`), `src/ui/useRoute.ts`; le sezioni restano in
  `src/ui/ai/settings/`.
- Tutto il codice toccato è formattato come il resto del repo (niente componenti su una riga).
- Testi solo via `t()`; ogni chiave nuova in tutti i `src/i18n/locales/*.json` (`en.json` riferimento).
- Nuove icone in `src/ui/icons.ts`: `modeAi` (sparkles), `newChat` (plus), `send` (arrow-up), `stop`
  (stop-solid), `chevronUp`, `warning` (warning-diamond); `close` e `chevronDown` se non già presenti.

## 9. Verifica

- `npm test` (inclusi i test nuovi di §8 e `locales.test.ts`), `npm run lint`, `npm run build`.
- `npm run test:browser` (`tests/browser/run-ai-smoke.mjs`) aggiornato ai nuovi selettori: ingresso in AI
  dall'icona modalità, invio con Invio, niente vista affiancata, impostazioni da `#settings`.
- Prova manuale in Chrome con il profilo "APE" (bridge Claude Code su tailnet): modalità AI, chip selezione,
  preset, accettazione per blocchi e totale, undo, impostazioni via link e Indietro.
- README, sezione "Modalità AI": scorciatoie (Invio / Shift+Invio, niente Ctrl+K), niente vista affiancata,
  impostazioni in `#settings`.

## 10. Rischi

- **Hash e PWA**: l'hash non deve interferire con l'avvio (`StartScreen`) né con l'aggiornamento del service worker;
  `parseRoute` ignora ogni hash che non inizia con `#settings`.
- **Selezione reattiva**: `onSelection` scatta a ogni movimento del cursore; lo stato in `WorkspaceView` va
  aggiornato solo quando cambia davvero (confronto `from`/`to`) per non ridisegnare la sidebar a ogni tasto.
- **Invio accidentale**: chi era abituato a Invio = a capo invia per sbaglio. Accettato (D4); Shift+Invio è
  indicato nel placeholder.
