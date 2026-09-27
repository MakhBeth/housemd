# HouseMD — migrazione a Web Components e CSS con `@scope` — design

Data: 2026-09-27
Base: branch `plan/web-components-stack` (HEAD `e2a4448`, v1.1 con i18n e tema a pixel).
Stato: **solo piano**. Nessun file di implementazione è stato toccato per scrivere questo documento.

Decisioni prese il 2026-09-27 (risposte alle domande aperte, §12):

1. **Un solo merge in `main`**, alla fine, e **solo dopo approvazione esplicita** di Davide. Tutte le
   fasi vivono su un branch di integrazione.
2. **zod ridotto**: solo ai confini critici (file system e provider esterni di dati), mai sulla
   logica interna (§6.2).
3. **Playwright** entra nel progetto ed è la **prima parte implementativa**: una suite end-to-end
   sull'app React di oggi che fa da rete di sicurezza per tutta la migrazione (§7 fase 0, §8.4).

## Obiettivo

Togliere React e i CSS Modules e costruire l'interfaccia con soli standard web: Custom Elements, DOM
API, `<dialog>`, Popover, Anchor Positioning, CSS `@scope` e `@layer`. Le uniche librerie nuove sono
`ts-pattern` (match esaustivi sugli stati) e `zod` (validazione di tutto ciò che arriva da fuori:
`localStorage`, IndexedDB, `.housemd.json`, frontmatter).

Il comportamento visibile non cambia: stessa UI, stessi testi, stesse scorciatoie, stessi toast.
La migrazione riesce se alla fine `npm test` e `npm run build` passano, i test di oggi ci sono ancora
(adattati dove serve, mai cancellati per farli passare) e la checklist manuale (§9) va a buon fine.

## Fuori scope

- Nuove funzionalità o ritocchi grafici. Se qualcosa cambia aspetto, è un bug della migrazione.
- Sostituire CodeMirror, markdown-it, MiniSearch, DOMPurify, `yaml`, `diff`: sono già
  indipendenti dal framework e restano come sono.
- Un "mini-framework" fatto in casa (virtual DOM, template reattivi, signals). Si scrivono al
  massimo tre helper piccoli e testati (§5.2).
- Librerie di componenti (Lit, FAST, Stencil…): la richiesta è "standard puri"; Lit sarebbe la
  scelta naturale se servisse un livello in più, ma qui non serve (§4.3).

---

## 1. Lo stack di oggi

### 1.1 Numeri

| Area | File | Righe (circa) | Dipende da React? |
|---|---|---|---|
| Logica pura (`fs/`, `workspace/`, `search/`, `preview/*.ts`, `config/`, `lib/`, `i18n/i18n.ts`, `theme/*.ts`, `ui/*.ts`, `wikilinks/`) | ~35 | ~2 700 | **No** |
| Componenti `.tsx` | 17 | ~1 900 | Sì |
| CSS Modules (`*.module.css`) | 8 | ~960 | Sì (import `styles.x`) |
| `global.css` | 1 | 84 | No |
| Test (`*.test.ts`) | 31 | ~2 400, **189 `test()`** | **Nessuno importa React** |

(Conteggio statico dei `test(`: nel worktree del piano non c'è `node_modules`, quindi il primo passo
dell'implementazione registra il baseline reale di `npm test`.)

### 1.2 Dipendenze coinvolte

- Da togliere: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`.
- Da aggiungere: `ts-pattern`, `zod` (v4, import da `zod/mini`, vedi §6.2); in sviluppo
  `@playwright/test` (§8.4).
- Invariate: CodeMirror 6 (già vanilla: in React c'è solo un `<div ref>` che lo ospita),
  `markdown-it`, `dompurify`, `minisearch`, `yaml`, `diff`, `pixelarticons`, `@fontsource/*`,
  `vite`, `vite-plugin-pwa`, `tsx`, `typescript`, `jsdom`, `fake-indexeddb`.
- `tsconfig.json`: via `"jsx": "react-jsx"`; `useDefineForClassFields: true` resta (vedi rischio R9).

### 1.3 Come React è usato davvero

La mappa conta più delle righe: dice cosa va sostituito e con cosa.

| Uso di React | Dove | Sostituto |
|---|---|---|
| `useSyncExternalStore(workspace.subscribe, workspace.getState)` | `ui/useWorkspace.ts` | L'elemento si iscrive a `workspace.subscribe` in `connectedCallback` e si disiscrive in `disconnectedCallback`. `Workspace` è **già** uno store esterno: non cambia. |
| Context `I18nProvider` / `useT` / `useI18n` | `i18n/I18nProvider.tsx` | Store `i18nStore` (modulo puro con `subscribe`/`getState`/`setLocale`), stessa semantica "vince l'ultima richiesta". |
| `useTheme` + `flushSync` dentro la view transition | `theme/useTheme.ts` | `themeStore`; dentro `startViewTransition(apply)` il DOM si aggiorna in modo sincrono per natura, `flushSync` sparisce. |
| `forwardRef` + `useImperativeHandle` (`scrollToLine`, `focus`) | `Editor`, `Preview`, `SearchPanel` | Metodi pubblici della classe dell'elemento (`editor.scrollToLine(n)`). |
| `key` per forzare il rimontaggio di `WorkspaceView` (`openCount`) | `App.tsx` | L'app sostituisce esplicitamente l'elemento con una nuova istanza; `openCount` sparisce. |
| `useEffect` con `showModal()` + gestione dei "close fantasma" di StrictMode | `NameDialog`, `ConfirmDialog`, `AccessLostDialog` | Dialog con API a promessa (§5.4); niente StrictMode, niente doppio montaggio. |
| Liste con `key` (albero, risultati, toast, bozze orfane) | `FileTree`, `SearchPanel`, `Toasts`, `WorkspaceView` | Helper `reconcileList` (§5.2). |
| Attributi non tipizzati da React 18 (`closedby`, `popover`) passati con cast | dialog, toast, menu | Attributi HTML normali: il cast sparisce. |
| `switch (screen.kind)` | `App.tsx` | `match(screen)…exhaustive()` di ts-pattern. |

Conclusione dell'analisi: il progetto è già scritto "da standard web" (dialog, popover, anchor,
Custom Highlight, view transition, File System Access) con React usato come motore di rendering e
poco altro. Il rischio sta nel rendering a mano delle liste e nella pulizia dei listener, non
nell'architettura.

---

## 2. Vincoli (invariati, più tre nuovi)

Invariati da `CLAUDE.md`:

- Solo Chromium desktop recente, niente polyfill né fallback, tranne `setHTML()` → DOMPurify.
- Mai `innerHTML` con HTML non sanitizzato: l'unico `innerHTML` resta dentro `preview/sanitize.ts`.
- Mai `alert/confirm/prompt`: `<dialog>` con `showModal()` e `closedby`.
- Solo `fs/fsaOps.ts` e `fs/access.ts` toccano la File System Access API.
- Logica in moduli puri testati con `npm test`; testi UI da `t()`.

Nuovi:

1. **Elementi sottili.** Un custom element fa tre cose: crea il suo DOM, lo aggiorna da uno stato,
   trasforma eventi DOM in chiamate a moduli puri o store. Calcoli, validazioni e macchine a stati
   stanno fuori, in moduli `.ts` testati senza DOM.
2. **Niente costruzione di DOM da stringhe.** Niente `innerHTML`, `insertAdjacentHTML`,
   `outerHTML =`, `document.write` fuori da `sanitize.ts`: il DOM si crea con `el()` (§5.2) e i testi
   entrano con `textContent`. Lo fa rispettare un test statico (§8.3).
3. **Light DOM + `@scope`** per tutti gli elementi dell'app (§4). Lo Shadow DOM non si usa, salvo
   una revisione esplicita di questo documento.

---

## 3. Architettura di arrivo

```
index.html
  <hmd-app>                         ← macchina a stati delle schermate (ts-pattern)
    <hmd-start-screen>              ← unsupported | start | resume
    <hmd-workspace>                 ← layout, toolbar, scorciatoie, pannelli
      <hmd-search-panel>
      <hmd-file-tree>               ← menu azioni in popover ancorato
      <hmd-editor>                  ← ospita l'EditorView di CodeMirror
      <hmd-preview>                 ← HTML sanitizzato + <hmd-frontmatter-card>
      <hmd-conflict-bar>
      <hmd-theme-switcher>
      <hmd-toasts>                  ← popover="manual"
  dialog: showNameDialog() / showConfirmDialog() / showAccessLostDialog()  (funzioni, non elementi)
```

### 3.1 Struttura delle cartelle

```
src/
  main.ts                          (era main.tsx)
  dom/
    el.ts        el.test.ts        ← creazione di elementi, niente stringhe HTML
    list.ts      list.test.ts      ← reconcileList per liste con chiave
    element.ts   element.test.ts   ← classe base HmdElement (ciclo di vita, AbortController)
    icon.ts                        ← icon(name, size?) → <span class="icon">  (era Icon.tsx)
  state/
    i18nStore.ts i18nStore.test.ts
    themeStore.ts themeStore.test.ts
    prefs.schema.ts prefs.schema.test.ts   ← schemi zod delle preferenze
  elements/
    app/            app.element.ts            app.css           screens.ts (+ test)
    start-screen/   start-screen.element.ts   start-screen.css
    workspace/      workspace.element.ts      workspace.css     layout.ts, keymap.ts, dialogState.ts (+ test)
    file-tree/      file-tree.element.ts      file-tree.css     treeState.ts (+ test)
    search-panel/   search-panel.element.ts   search-panel.css  segments.ts (+ test)
    editor/         editor.element.ts         editor.css
    preview/        preview.element.ts        preview.css
                    frontmatter-card.element.ts               cardDate.ts (+ test)
    toasts/         toasts.element.ts         toasts.css
    conflict-bar/   conflict-bar.element.ts
    theme-switcher/ theme-switcher.element.ts
    dialogs/        nameDialog.ts confirmDialog.ts accessLostDialog.ts  dialogs.css
    define.ts                                 ← unico punto con customElements.define()
  testing/
    domEnv.ts                                 ← globali jsdom per i test *.dom.test.ts
e2e/                                          ← Playwright (fase 0), fuori da src/
  playwright.config.ts  tsconfig.json
  support/  fsHarness.ts  app.ts  i18n.ts     ← cartella finta su OPFS, fixture, t()
  *.spec.ts                                   ← suffisso .spec: `tsx --test` non li raccoglie
```

I moduli puri esistenti (`workspace/`, `fs/`, `preview/render.ts`, `ui/tree.ts`, `ui/names.ts`…)
**non si spostano**: spostarli adesso sporcherebbe la storia e i diff senza guadagno. `src/ui/` perde
i `.tsx` e tiene i `.ts` puri (`tree`, `names`, `icons`, `logo`).

Nomi: prefisso `hmd-`; un file `*.element.ts` per elemento; la classe si chiama come il tag in
PascalCase (`HmdFileTree`). Identificatori in inglese, testi da `t()`.

---

## 4. Decisione: Light DOM + `@scope` (non Shadow DOM)

### 4.1 La scelta

Tutti gli elementi rendono nel **light DOM**. L'isolamento degli stili arriva da:

- `@layer` dichiarati una volta in `global.css`: `@layer reset, base, components, overrides;`
- un file CSS per elemento, tutto dentro `@layer components { @scope (hmd-x) to (<figli hmd-*>) { … } }`;
- classi brevi e locali (`.row`, `.name`, `.menu`), che non escono dallo scope e al limite inferiore
  (`to (…)`) non entrano negli elementi figli.

Esempio (`file-tree.css`):

```css
@layer components {
  @scope (hmd-file-tree) {
    :scope { display: block; flex: 1; overflow-y: auto; padding: 6px 4px 24px; }
    .list { list-style: none; margin: 0; padding: 0 0 0 12px; }
    :scope > nav > .list { padding-left: 0; }
    .row:hover, .row[data-active='true'] { background: var(--c-accent-soft); }
    .menu { position-anchor: --housemd-tree-menu; /* … */ }
  }
}
```

`workspace.css` usa il limite inferiore per non stilizzare i componenti che contiene:

```css
@scope (hmd-workspace) to (hmd-file-tree, hmd-search-panel, hmd-editor, hmd-preview, hmd-toasts) { … }
```

### 4.2 Perché non Shadow DOM

HouseMD usa già diverse piattaforme web che dentro uno shadow root costano lavoro in più o si
rompono. Per ciascuna:

| Funzionalità usata oggi | Con Shadow DOM | Con light DOM + `@scope` |
|---|---|---|
| **CSS Custom Highlight** (`::highlight(housemd-search)` in `global.css`, evidenziazione ricerca nell'anteprima) | La regola `::highlight()` deve stare in un foglio **dentro** lo shadow root che contiene il testo; quella globale non basta. | Funziona com'è. |
| **Anchor Positioning** (menu dell'albero: `anchor-name` sul pulsante, `position-anchor` sul popover) | I nomi delle ancore dipendono dall'albero: ancora e popover devono stare nello stesso albero, cosa da verificare a ogni confine tra shadow root. | Funziona com'è. |
| **Riferimenti per ID** (`aria-labelledby`, `aria-describedby`, `for`, `popovertarget`, `commandfor`) | Non attraversano il confine dello shadow root; la *Reference Target* non è una base su cui contare oggi (da riverificare quando sarà stabile). | Funzionano. |
| **CodeMirror 6** (inietta i suoi stili con `StyleModule` nel `document`) | Va passata l'opzione `root` all'`EditorView` e verificato il comportamento di tooltip e autocompletamento. | Invariato. |
| **Stili di base condivisi** (`.icon`, `:focus-visible`, `button { font: inherit }`, `box-sizing`) | Non entrano negli shadow root: servono un `CSSStyleSheet` condiviso e `adoptedStyleSheets` in ogni elemento. | Si ereditano dal documento. |
| **HTML dell'anteprima** (sanitizzato, stilizzato da `Preview.module.css`) | Da stilizzare dentro lo shadow root dell'anteprima. | `@scope (hmd-preview) { .prose … }`. |
| **View transition del tema** (cattura di `root`) | Indifferente. | Indifferente. |
| **Token `light-dark()` e font** | Le custom property si ereditano: nessun problema. | Nessun problema. |

Lo Shadow DOM serve soprattutto a proteggere un componente da **pagine ospiti che non si
controllano**. HouseMD è un'applicazione unica: controlliamo tutto il CSS. Quello che serve davvero
(nessuna collisione di nomi di classe, nessuna fuga di stili verso i figli) lo danno già `@scope`
con il limite inferiore e `@layer`, senza i costi della tabella. Sostituiscono anche l'hashing dei
CSS Modules.

Il limite di questa scelta: nessuno *impedisce* a un foglio di stilizzare un altro elemento.
Contromisura: un test statico (§8.3) controlla che ogni CSS sotto `src/elements/` contenga solo
blocchi `@scope` con le radici ammesse per la sua cartella, secondo una tabella esplicita nel test:

| Cartella | Radici `@scope` ammesse |
|---|---|
| `elements/<nome>/` (regola generale) | `hmd-<nome>` |
| `elements/preview/` | `hmd-preview`, `hmd-frontmatter-card` |
| `elements/dialogs/` | `dialog.hmd-dialog` (i dialog sono `<dialog>` nativi aggiunti a `document.body`, non custom element; le funzioni di §5.4 mettono sempre la classe `hmd-dialog`) |

Una nuova eccezione si aggiunge alla tabella del test, con una riga di motivazione, mai con un
`skip`.

### 4.3 Criteri per rivedere la decisione

Si passa allo Shadow DOM (e probabilmente a Lit) per un elemento solo se deve essere incorporato in
pagine di terzi, o se serve `<slot>` con contenuto dell'utente. Oggi nessun elemento ha questi
requisiti.

---

## 5. Pattern degli elementi

### 5.1 Classe base `HmdElement` (`src/dom/element.ts`)

```ts
export abstract class HmdElement extends HTMLElement {
  #abort: AbortController | null = null;

  connectedCallback(): void {
    if (this.#abort) return;                      // idempotente
    this.#abort = new AbortController();
    this.connect(this.#abort.signal);
  }

  disconnectedCallback(): void {
    this.#abort?.abort();                         // toglie OGNI listener/iscrizione registrati con il signal
    this.#abort = null;
  }

  /** Crea il DOM (la prima volta) e registra listener e iscrizioni legati a `signal`. */
  protected abstract connect(signal: AbortSignal): void;

  /** `store.subscribe` legato al ciclo di vita dell'elemento. */
  protected watch(subscribe: (fn: () => void) => () => void, fn: () => void, signal: AbortSignal): void {
    const off = subscribe(fn);
    signal.addEventListener('abort', off, { once: true });
    fn();
  }
}
```

- Tutti i `addEventListener` passano `{ signal }`: niente cleanup a mano, quindi niente perdite
  (oggi ci pensano i `return () => …` degli effetti).
- Dove un elemento si sposta nel DOM senza dover perdere lo stato, si usa `moveBefore()` e si
  implementa `connectedMoveCallback()` (Chromium stabile), così il ciclo di vita non riparte.
  Oggi non serve in nessun punto: è solo una regola per il futuro.
- Gli input arrivano come **proprietà JS** tipizzate (`workspace`, `nodes`, `openPath`), non come
  attributi stringa. Gli attributi riflettono solo lo stato che serve al CSS
  (`data-mode`, `data-state`, `aria-*`).
- Gli output sono `CustomEvent` tipizzati con `bubbles: true` (`hmd-open`, `hmd-tree-action`), i
  cui nomi e `detail` sono dichiarati in una mappa di tipi in `src/elements/events.ts`, oppure
  callback passate come proprietà dove l'evento non serve a nessun altro (es. `onImage` dell'editor,
  che restituisce una Promise).

### 5.2 Tre helper per il DOM (puri rispetto allo stato, testati in jsdom)

1. `el(tag, props?, ...children)`: crea un elemento. `props` accetta `class`, `dataset`, attributi
   (`'aria-label'`), proprietà (`hidden`, `value`) e listener (`on: { click }`). I figli stringa
   diventano **nodi di testo**, mai HTML. Sostituisce JSX.
2. `reconcileList(parent, items, key, create, update)`: allinea i figli di `parent` a `items` per
   chiave: riusa i nodi esistenti (così restano focus e selezione), crea quelli nuovi, rimuove gli
   altri e riordina con `moveBefore` quando c'è, altrimenti `insertBefore`. Serve per albero,
   risultati di ricerca, toast e bozze orfane.
3. `setText(node, text)` / `toggleAttr(node, name, on)`: scrivono solo se il valore cambia, per non
   invalidare il layout a ogni notifica dello store.

Regola di rendering: **creare una volta, aggiornare in modo mirato.** `connect()` costruisce lo
scheletro; `render()` (chiamato dalle iscrizioni) aggiorna testi, attributi e liste. Non si
ricostruisce mai un sottoalbero che contiene un campo con il focus (campo di ricerca, input dei
dialog).

### 5.3 Store

- `Workspace` resta com'è (`subscribe`/`getState`).
- `i18nStore` (`src/state/i18nStore.ts`): `createI18nStore({ locale, messages, load, persist })`
  → `{ getState, subscribe, t, setLocale }`. Contiene la logica oggi in `I18nProvider`
  (contatore delle richieste: "vince l'ultima richiesta, non l'ultima caricata"; si salva come
  preferenza la lingua **effettivamente caricata**, quindi `en` quando il chunk richiesto fallisce,
  esattamente come `I18nProvider.tsx` oggi; `document.documentElement.lang` aggiornato da chi si
  iscrive, non dallo store). La migrazione non cambia questo comportamento: se lo si vuole cambiare
  (es. non salvare nulla quando il chunk fallisce) è una correzione separata, con un suo commit e un
  suo test. Oggi questa logica **non ha test**: con la
  migrazione li riceve (§8.2).
- `themeStore` (`src/state/themeStore.ts`): preferenza, `setTheme(next)` che salva e chiama
  `pixelTransition(() => { state = next; notify(); applyTheme(next); })`. La notifica dentro la
  callback aggiorna in modo sincrono l'icona dello switcher prima dello snapshot "new" della view
  transition, lo stesso effetto che oggi dà `flushSync`. Iscrizione a `prefers-color-scheme` in
  modalità `auto` come in `useTheme`.

Istanze uniche create in `main.ts` e passate come proprietà a `<hmd-app>`, che le passa ai figli.
Niente singleton importati dagli elementi: nei test si usa uno store finto.

### 5.4 Dialog come funzioni che restituiscono Promise

```ts
const name = await showNameDialog({ title, kind, initial, confirmLabel, validate, t });   // string | null
const ok   = await showConfirmDialog({ title, message, confirmLabel, t });               // boolean
await showAccessLostDialog({ folderName, onResume, t });                                 // si chiude solo con accesso concesso
```

Ogni funzione crea un `<dialog closedby="any">` (o `closedby="none"` per l'accesso perso), lo
aggiunge a `document.body`, chiama `showModal()` e risolve la Promise all'evento `close`, poi rimuove
il dialog. I pulsanti "Annulla" usano `command="close" commandfor="<id>"` (Invoker Commands,
Chromium stabile) invece di un handler JS. Il focus torna da solo al pulsante che ha aperto il
dialog (comportamento nativo di `showModal`). I workaround per StrictMode spariscono.

La logica di `WorkspaceView` che oggi decide quale dialog aprire (`DialogState`) diventa una
funzione pura `dialogFor(action, node)` con `match(...).exhaustive()`, testata.

---

## 6. ts-pattern e zod: dove e perché

### 6.1 ts-pattern: match esaustivi al posto di `switch` e mappe parziali

| Punto | Oggi | Con ts-pattern |
|---|---|---|
| Schermata dell'app (`boot/unsupported/start/resume/open`) | `switch` in `App.tsx` | `screens.ts`: `renderScreen(screen)` con `match(screen).with({ kind: 'open' }, …).exhaustive()` |
| Azione dell'albero → dialog | `if/else` in `onTreeAction` | `dialogFor(action, node)` in `workspace/dialogState.ts` |
| Scorciatoie da tastiera | `if/else if` su `event.key` | `keymap.ts`: `commandForKey({ key, ctrl, meta })` → `'save' \| 'search' \| 'cycleMode' \| null` con `match` + `P.union` |
| Stato di salvataggio → etichetta, `role`, `aria-live` | `Record<SaveState, MessageKey>` + ternari | `saveIndicator(doc)` puro, esaustivo anche su `deletedOnDisk` |
| Nodo dell'albero (`file`/`directory`) | ternari nel JSX | `match(node.kind)` in `file-tree` |
| Toast `kind` → `role` | ternario | `match(toast.kind)` |

Regola: `.exhaustive()` sempre. Un caso nuovo in un'unione diventa un errore di `tsc` (`npm run
lint`), non un ramo silenzioso. `ts-pattern` entra nella logica pura, così i test la coprono.

### 6.2 zod: solo ai confini critici

**Regola (decisione 2):** zod valida solo dati che arrivano da **fuori dal processo** e che il
codice non controlla: il **file system** della cartella dell'utente e i **provider esterni** di dati
persistenti del browser (IndexedDB, `localStorage`), che possono contenere formati di versioni
precedenti, dati corrotti o modificati a mano. **Mai** sulla logica interna: stato di `Workspace`,
stato degli store, proprietà ed eventi degli elementi, risultati di funzioni pure, messaggi di
traduzione. Lì bastano i tipi di TypeScript e ts-pattern.

Si usa **`zod/mini`** (API a funzioni, tree-shakable) per tenere piccolo il bundle della PWA. Criterio
di accettazione: la crescita del bundle principale gzip, misurata con `vite build` prima e dopo, va
annotata nel commit che introduce zod. Se supera 8 KB, si rivaluta.

| Confine | Oggi | Con zod |
|---|---|---|
| Preferenze in `localStorage` (`theme`, `locale`, `mode`, `sidebarOpen`, `sidebarWidth`, `lastFile:<id>`) | `readPref<T>` fa `JSON.parse(raw) as T`, **senza validazione** per `mode`, `sidebarOpen`, `sidebarWidth`, `lastFile` | `state/prefs.schema.ts`: uno schema per chiave; `readPref(key)` è tipizzato dalla mappa `PREFS` e ricade sul default se `safeParse` fallisce. `readValidPref` e `parseTheme`/`parseLocale` restano come API (i loro test non cambiano) ma internamente usano gli schemi. |
| `.housemd.json` | `parseConfig` con controlli a mano | Schemi per campo con `safeParse` **per campo**, per tenere il fallback campo per campo e l'ordine dei `problems` di oggi (`invalidSaveTo` prima di `invalidLinkPrefix`). La normalizzazione (`normalizePath`) resta fuori dagli schemi, nel codice che segue. Il contratto è `config.test.ts`, che non cambia. |
| Buffer di emergenza in IndexedDB (formato vecchio stringa / nuovo `{text, base}`) | `normalizeStored` con `typeof` | `z.union([z.string(), z.object({ text, base })])` + trasformazione; un record corrotto diventa `null` invece di un'eccezione a runtime. Test nuovo per il record corrotto. |
| `handleStore` (record `{ handle, workspaceId }` e lista `known`) | cast | Si valida solo la **forma del record**: `workspaceId` stringa non vuota, `handle` oggetto non nullo (`z.custom((v) => typeof v === 'object' && v !== null)`), `known` array di record (le voci non valide si scartano). L'handle resta **opaco**: nessun controllo su `kind` o sui metodi, perché `handleStore.ts` è generico sul tipo di handle (`H`), i suoi test salvano oggetti `{ name }` e si aspettano di riaverli identici, e nominare metodi della File System Access API in quel file violerebbe la regola "solo `fsaOps.ts`/`access.ts`" (e il test di architettura). Un record non valido equivale a "nessuna cartella salvata" (`null`), come un database vuoto. |

Esclusi di proposito:

- **Frontmatter → card (`toCard`)**: il confine con il file è il parser `yaml`, che già restituisce
  `unknown` o un errore mostrato nella card. `toCard` è logica di presentazione tollerante per
  scelta (un campo strano finisce in `extra`), non una validazione: resta com'è.
- **Messaggi di traduzione**: arrivano dal bundle, sono tipizzati dall'import JSON e controllati da
  `locales.test.ts`/`keys.test.ts`.
- **Stato interno** di qualsiasi tipo.

---

## 7. Migrazione a passi

**Branch e merge (decisione 1).** Tutto il lavoro avviene su un branch di integrazione
`feat/web-components`, creato dalla punta di `plan/web-components-stack`. Attenzione: quel branch
contiene anche i commit di v1.1 (font, icone, logo, i18n, tema) che **non sono ancora in `main`**
(`git log main..plan/web-components-stack`). Il merge finale li porta con sé: o l'approvazione
finale copre anche v1.1, o v1.1 va unito prima, separatamente. Ogni fase è una serie di commit su quel branch e finisce
con `npm test` verde, `npm run lint` e `npm run build` puliti, `npm run test:e2e` verde (snapshot
invariati) e la checklist manuale ridotta di §9. **Nessun merge in `main` a fine fase**: il merge
è uno solo, alla fine della fase 7, e si fa solo dopo l'approvazione esplicita di Davide. Se durante
la migrazione `main` riceve altre modifiche, si fa rebase del branch di integrazione (mai merge di
`main` dentro il branch), rilanciando entrambe le suite.

### Fase 0: Playwright e rete di sicurezza (React ancora dentro)

È la prima parte implementativa (decisione 3). Non cambia una riga dell'app.

1. `npm ci && npm test`: annotare il numero reale di test passati (atteso: 189 `test()`).
2. **Suite Playwright sull'app React di oggi** (§8.4): harness con cartella finta su OPFS, spec
   funzionali per i flussi della checklist e snapshot visivi delle schermate principali in tema
   chiaro e scuro. Gli snapshot generati qui sono il **riferimento visivo** di tutta la migrazione:
   non si rigenerano mai per far passare una fase, salvo differenze motivate e approvate.
3. Rendere `uiText.test.ts` **indipendente dall'estensione**: oggi scansiona solo i `.tsx`; quando i
   `.tsx` spariranno passerebbe **senza controllare nulla**. Si aggiunge
   `assert.ok(files.length > 0)` e la lista dei file diventa "`*.tsx` + `*.element.ts` +
   `src/elements/**/*.ts`" (vedi §8.1).
4. Aggiungere i test statici di §8.3 già validi sul codice React di oggi (niente `innerHTML` fuori
   da `sanitize.ts`; File System Access solo in `fsaOps.ts`/`access.ts`).

### Fase 1: logica pura, ts-pattern, zod (React ancora dentro)

1. Aggiungere `ts-pattern` e `zod`.
2. Estrarre dai componenti le funzioni pure, con i loro test: `keymap.ts`, `layout.ts`
   (`clampWidth`, `nextMode`, `gridColumns`), `dialogState.ts`, `saveIndicator`, `segments.ts`
   (oggi `Highlighted` in `SearchPanel`), `cardDate.ts` (oggi `formatCardDate` in
   `FrontmatterCard`), `screens.ts`. I componenti React le importano: il comportamento non cambia.
3. zod ai soli confini di §6.2: `prefs.schema.ts` + `readPref` tipizzato dagli schemi
   (`localStorage`), `parseConfig` (`.housemd.json`), `normalizeStored` e `handleStore` (IndexedDB).
   I test esistenti devono passare **senza modifiche alle asserzioni**.
4. `i18nStore` e `themeStore` come moduli puri con test. `I18nProvider` e `useTheme` diventano
   adattatori sottili (`useSyncExternalStore` sugli store), così React e i futuri custom element
   condividono una sola fonte di verità durante la convivenza.

### Fase 2: infrastruttura DOM e CSS

1. `src/dom/el.ts`, `list.ts`, `element.ts`, `icon.ts` + `src/testing/domEnv.ts`, con test in jsdom.
2. `global.css`: dichiarare l'ordine `@layer reset, base, components, overrides;` e spostare gli stili
   globali di oggi nei layer `reset`/`base`. Il reset `*, *::before, *::after { box-sizing }` resta,
   ma dentro `@layer reset`, così qualsiasi regola di componente lo sovrascrive senza problemi di
   specificità.
3. I CSS Modules restano per ora, senza layer, quindi vincono sui layer: nessun cambio visivo.

### Fase 3: foglie come custom element dentro React

Ordine: `theme-switcher`, `conflict-bar`, `toasts`, dialog (funzioni), `start-screen`.

- React 18 passa ai custom element **solo attributi**, non proprietà né eventi. Serve una
  convivenza: un solo helper temporaneo `src/dom/reactBridge.tsx`
  (`useElement(ref, props, events)`: assegna le proprietà in un effetto e registra i listener).
  Il file è marcato come temporaneo e **si cancella nella fase 6**; un test statico ne verifica
  l'assenza alla fine (§8.3).
- Ogni componente migrato: il suo `.module.css` diventa `<nome>.css` con `@scope` dentro
  `@layer components`, il `.tsx` si cancella e chi lo usava monta il tag tramite il bridge.
- I dialog: `NameDialog`/`ConfirmDialog`/`AccessLostDialog` diventano le funzioni di §5.4, chiamate
  da `WorkspaceView` (con un `useEffect` che reagisce a `state.status === 'access-lost'`).

### Fase 4: editor e anteprima

- `hmd-editor`: sposta `Editor.tsx` quasi uguale (`createState`, `theme`, `highlight`,
  `insertImages` non cambiano); `resetKey` diventa un setter che chiama `view.setState(...)` solo
  quando il valore cambia; `scrollToLine`/`focus` diventano metodi pubblici.
- `hmd-preview`: debounce, `setSafeHTML`, cache delle immagini, `ResizeObserver`, link e
  `highlightTerms` passano dagli effetti a metodi privati chiamati dai setter delle proprietà
  (`text`, `path`, `files`, `config`, `highlight`) attraverso un `scheduleRender()` che raccoglie
  più assegnazioni nello stesso microtask. Si conserva il flag `cancelled` per i render asincroni
  superati. `hmd-frontmatter-card` è un elemento separato con la sua gestione di `alive`.
- Punto delicato: lo scroll sincronizzato (`suppressUntil` a 150 ms) deve restare identico.
  I moduli puri `scrollSync.ts` non cambiano; lo copre la spec e2e `sync-scroll.spec.ts` (§8.4).

### Fase 5: albero e ricerca

- `hmd-file-tree`: `expanded` diventa uno stato puro (`treeState.ts`: `expand`, `collapse`,
  `revealPath` con `ancestorsOf`) con test; il rendering usa `reconcileList` per livello, e
  `<details>` resta nativo. Il menu resta un `popover="auto"` con `anchor-name` impostato sul
  pulsante che l'ha aperto.
- `hmd-search-panel`: debounce a 120 ms, Invio senza attesa, Esc che svuota. I risultati usano
  `reconcileList` e `segments()` → nodi `<mark>` creati con `el()`. Il campo non viene mai
  ricreato. `focusInput()` è un metodo pubblico (per `Ctrl+K`).

### Fase 6: `hmd-workspace`, `hmd-app`, via React

1. `hmd-workspace` al posto di `WorkspaceView`: layout a griglia (`data-mode`, colonne via custom
   property `--sidebar-width` invece di `style.gridTemplateColumns`), resizer con pointer capture,
   scorciatoie via `commandForKey`, listener `focus/blur/visibilitychange/beforeunload` legati al
   `signal`, riapertura dell'ultimo file e bozze orfane.
2. `hmd-app` al posto di `App.tsx`; `main.ts` al posto di `main.tsx`: carica i messaggi, crea gli
   store, importa `elements/define.ts`, poi monta `<hmd-app>` in `#root`.
3. Cancellare: tutti i `.tsx`, `*.module.css`, `reactBridge.tsx`, `ui/useWorkspace.ts`,
   `i18n/I18nProvider.tsx`, `theme/useTheme.ts`. Togliere le dipendenze React e
   `@vitejs/plugin-react`, e `"jsx"` da `tsconfig.json`.
4. Aggiornare `CLAUDE.md` (regole: "elementi sottili", "light DOM + `@scope`", "niente DOM da
   stringhe") e `README.md` (stack).

### Fase 7: rifinitura

- Misurare bundle e tempo di avvio rispetto al baseline della fase 0 (atteso: −40 KB gzip circa per
  React/ReactDOM, + zod/mini + ts-pattern).
- Passata di accessibilità con l'albero di accessibilità di Chrome sulle schermate principali.

---

## 8. Cosa succede ai test

### 8.1 Test esistenti: tutti restano

Nessuno dei 31 file di test importa React: 29 restano **identici**, 1 si adatta, 1 si rafforza.

| File | Destino | Note |
|---|---|---|
| `workspace/workspace.test.ts` (924 righe) e gli altri di `workspace/` | Invariati | `Workspace` non cambia. |
| `fs/*.test.ts` (access, handleStore, types, workspaceFS) | Invariati | `handleStore` passa a zod internamente; le asserzioni restano. |
| `config/config.test.ts`, `config/images.test.ts` | Invariati | Sono il contratto della riscrittura con zod. |
| `preview/*.test.ts` (render, sanitize, frontmatter, imageCache, scrollSync) | Invariati | `sanitize.test.ts` usa già jsdom. |
| `search/*.test.ts`, `wikilinks/*.test.ts`, `editor/*.test.ts`, `lib/paths.test.ts` | Invariati | |
| `theme/*.test.ts`, `ui/tree.test.ts`, `ui/names.test.ts`, `ui/logo.test.ts` | Invariati | |
| `ui/icons.test.ts` | Invariato | `icons.ts` resta (import `?url` degli SVG). |
| `i18n/i18n.test.ts`, `locales.test.ts`, `keys.test.ts` | Invariati | |
| **`i18n/uiText.test.ts`** | **Adattato** | Vedi sotto. |

**Adattamento di `uiText.test.ts`.** Oggi fa due controlli sui `.tsx`: (a) nessun testo italiano di
v1 scritto a mano; (b) nessun `aria-label|title|placeholder|alt="…"` letterale con lettere. Con i
custom element la sintassi cambia, quindi:

- File scansionati: tutti i `.ts`/`.tsx` sotto `src/elements/`, `src/dom/` e i `.tsx` rimasti
  (durante la convivenza). Più `assert.ok(files.length > 0)` contro il passaggio a vuoto.
- (a) resta com'è: la regex cerca il testo dopo `'`, `"`, `` ` `` o `>`, e funziona anche con `el()`.
- (b) si estende alle forme nuove, sempre con valore letterale che contiene lettere:
  - `setAttribute('aria-label' | 'title' | 'placeholder' | 'alt', '<letterale>')`
  - chiavi di oggetto in `el()`: `'aria-label': '<letterale>'`, `title: '<letterale>'`, …
  - `.title = '<letterale>'`, `.placeholder = '<letterale>'`, `.alt = '<letterale>'`
  - `textContent = '<letterale con lettere>'` (nuovo: in JSX un testo nudo si vedeva come figlio,
    qui passa da `textContent`)
- Si aggiunge un caso di test **negativo** su una stringa sorgente sintetica per ogni forma, per
  dimostrare che la regex scatta davvero (oggi manca, ed è così che un controllo statico smette di
  controllare senza che nessuno se ne accorga).

### 8.2 Test nuovi

| File | Cosa verifica |
|---|---|
| `dom/el.test.ts` | Figli stringa = nodi di testo (`<b>` resta testo letterale); attributi, dataset, proprietà, listener; `undefined`/`false` non impostano attributi. |
| `dom/list.test.ts` | `reconcileList`: riusa i nodi per chiave (stesso oggetto), rimuove, inserisce, riordina; **il focus su un nodo riusato resta**. |
| `dom/element.test.ts` | `connect` una volta sola; `disconnect` interrompe i listener (evento dopo il distacco → nessuna chiamata); `watch` si disiscrive. |
| `state/i18nStore.test.ts` | Vince l'ultima richiesta con loader che si risolvono fuori ordine; con chunk fallito si salva `en` (la lingua caricata), come oggi; notifiche. |
| `state/themeStore.test.ts` | Ciclo `auto→light→dark`; salvataggio; `apply` chiamato dentro la transizione (con `pixelTransition` iniettato finto). |
| `state/prefs.schema.test.ts` | Valori corrotti in `localStorage` (`"sidebarWidth": "abc"`, `mode: 42`, JSON rotto) → default. |
| `workspace/buffers.test.ts` (esteso) | Record IndexedDB corrotto → `null`, nessuna eccezione. |
| `elements/app/screens.test.ts` | Transizioni di schermata e scelta della schermata (esaustiva). |
| `elements/workspace/keymap.test.ts`, `layout.test.ts`, `dialogState.test.ts` | Scorciatoie (Ctrl e Meta), `clampWidth` ai limiti, ciclo delle modalità, dialog per azione/nodo. |
| `elements/file-tree/treeState.test.ts` | `revealPath` apre gli antenati senza chiudere altro; toggle idempotente. |
| `elements/search-panel/segments.test.ts` | Segmenti testo/evidenziato, anche con più termini e sovrapposizioni (stessa semantica di `findMatches`). |
| `elements/preview/cardDate.test.ts` | Date `YYYY-MM-DD` formattate per lingua; valori non data restituiti così come sono. |
| `elements/**/*.dom.test.ts` (smoke) | Per ogni elemento: si definisce, si monta in jsdom con store finti, mostra i testi da `t()`, cambia lingua → testi aggiornati, distacco → nessun listener rimasto. Niente pixel e niente layout: jsdom non ne ha. |

**Ambiente DOM nei test.** `src/testing/domEnv.ts` crea un `JSDOM` e mette su `globalThis`
`window`, `document`, `HTMLElement`, `customElements`, `Node`, `CustomEvent`, `Event`,
`AbortController` e `AbortSignal` **presi tutti dalla `window` di quel `JSDOM`**. Non quelli di Node:
jsdom rifiuta in `addEventListener` un `signal` che non sia un suo `AbortSignal`, e `HmdElement`
passa proprio il suo signal ai listener. Un test di `element.test.ts` lo verifica (listener con
signal registrato senza errori e rimosso dall'`abort()`). Ogni `*.dom.test.ts` lo importa **come primo import** (gli import ESM si valutano
nell'ordine, quindi le classi estendono l'`HTMLElement` di jsdom). `node:test` esegue ogni file in
un processo separato, per cui i globali non passano da un file all'altro. `npm test` resta
`tsx --test`, senza script nuovi.

Limiti noti di jsdom da verificare nello spike della fase 2: `showModal()`/`closedby`, Popover,
`CSS.highlights`, Anchor Positioning e `moveBefore` possono mancare o essere parziali. Regola: il
codice che li usa è già protetto (es. `highlightTerms`) oppure viene sostituito da uno stub
esplicito in `domEnv.ts`. I **comportamenti** di queste API si verificano a mano (§9), non in jsdom.

### 8.3 Test statici nuovi (architettura)

- `architecture.test.ts`:
  - nessun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` in `src/` fuori da
    `preview/sanitize.ts` (e dai test);
  - nessun import di `react`/`react-dom` e nessun `.tsx` in `src/` **a partire dalla fase 6**
    (prima è saltato con `{ skip: … }` legato all'esistenza di `reactBridge.tsx`: quando il bridge
    sparisce, il test si attiva da solo);
  - ogni file in `src/elements/<nome>/*.css` contiene solo blocchi `@scope` con le radici ammesse
    dalla tabella di §4.2 per quella cartella, dentro `@layer components`;
  - `customElements.define` compare solo in `elements/define.ts`;
  - `showDirectoryPicker`/`requestPermission`/`queryPermission` compaiono solo in `fs/fsaOps.ts` e
    `fs/access.ts` (regola di `CLAUDE.md` finora non verificata da un test).

### 8.4 End-to-end con Playwright (fase 0)

**Scopo.** Fissare il comportamento e l'aspetto dell'app React di oggi **prima** di toccarla, così
che ogni fase della migrazione si verifichi contro lo stesso riferimento. Le spec non devono sapere
se sotto c'è React o un custom element.

**Regole delle spec.**

- Localizzatori solo per ruolo e nome accessibile (`getByRole('button', { name: t('file.new') })`),
  mai classi CSS né struttura del DOM: le classi dei CSS Modules spariscono con la migrazione. Unica
  eccezione ammessa: `.cm-content`/`.cm-scroller` di CodeMirror, che resta.
- Nessun testo scritto a mano: i nomi arrivano da `en.json` tramite `translate()` di
  `src/i18n/i18n.ts` (lingua forzata a `en` nella fixture).
- Animazioni ridotte (`reducedMotion: 'reduce'`): il cambio tema è istantaneo e gli snapshot sono
  stabili. La transizione a pixel resta nella checklist manuale.
- **Tempi controllati, non misurati.** Dove il risultato dipende da un timer dell'app
  (autosalvataggio a 1000 ms, gara tra modifica locale ed esterna), la spec usa l'orologio di
  Playwright (`page.clock`): lo mette in pausa prima della modifica e lo fa avanzare di proposito.
  Mai un timeout più corto del timer come prova che "non è stato il timer".
- **Tema prima del render.** La spec trattiene la richiesta del modulo dell'app (`page.route` sul
  bundle `assets/index-*.js`) durante il ricaricamento, verifica `data-theme` e `color-scheme`
  impostati dallo script inline mentre l'app **non** è ancora partita (`#root` vuoto), poi rilascia
  il modulo e verifica che l'avvio si completi.

**Cartella finta.** Il selettore nativo di cartelle non si può pilotare. Uno script iniettato con
`addInitScript` (solo nei test, in `e2e/support/fsHarness.ts`) sostituisce
`window.showDirectoryPicker` con una funzione che restituisce una sottocartella dell'**Origin
Private File System** (`navigator.storage.getDirectory()`). Gli handle OPFS sono veri
`FileSystemDirectoryHandle` di Chromium: `fsaOps.ts`, `handleStore` (IndexedDB) e i permessi
passano dal codice reale. Lo stesso script permette di simulare, con flag in `localStorage`
(`hmd-e2e`, fuori dal prefisso `housemd:`), permesso `prompt`/`denied` e scritture che falliscono
con `NotAllowedError` (accesso perso). I test scrivono e leggono la cartella OPFS con
`page.evaluate` per preparare i file e simulare modifiche esterne. Il codice di produzione non
cambia: la regola "solo `fsaOps.ts`/`access.ts` toccano la File System Access API" riguarda `src/`.

**Esecuzione.** `npm run test:e2e` → `playwright test -c e2e/playwright.config.ts`, contro
`vite build` + `vite preview` sulla porta 4173, progetto Chromium, service worker bloccati
(la PWA resta nella checklist manuale). **Build sempre nuova**: `reuseExistingServer: false`,
quindi se la porta è occupata la suite fallisce invece di provare un `dist/` vecchio o un'altra
cartella; la suite fa da cancello di ogni fase e deve provare il codice del commit corrente. Snapshot in `e2e/__screenshots__/`, generati su Linux.
`npm test` resta `tsx --test` e non raccoglie le spec (suffisso `.spec.ts`, cartella `e2e/`).

**Copertura** (una spec per area): avvio e browser non supportato; apertura, ripresa accesso e
cambio cartella; editor con autosalvataggio e `Ctrl+S`; anteprima (markdown, wikilink, link
relativi, HTML malevolo neutralizzato, frontmatter); scroll sincronizzato; albero (menu, nuovo,
rinomina, elimina, nome già esistente); ricerca (`Ctrl+K`, Invio, Esc, evidenziazione con
`CSS.highlights`); conflitto e file eliminato fuori; accesso perso; tema e lingua; snapshot visivi.

---

## 9. Checklist (per ogni fase che tocca la UI)

**Automatica** (`npm run test:e2e`), punto per punto: 1 tutto; 2 tutto (incolla e trascina
immagini con eventi sintetici, autocompletamento `[[`); 3 tutto; 4 tutto; 5 tutto tranne la
posizione del popover vicino ai bordi; 6 tutto; 7 tutto, bozze orfane comprese; 8 tutto (Esc e
clic fuori); 9 solo ciclo e tema applicato prima del render; 10 solo lingua dalla preferenza
salvata e `lang` (vedi sotto); 11 solo resizer e focus nel menu dell'albero. Più gli snapshot
visivi.

**Manuale, sempre**: selettore nativo di cartelle e prompt reale dei permessi; posizione dei
popover vicino ai bordi della finestra; transizione a pixel del tema e `prefers-reduced-motion`;
screen reader, ordine del focus e `aria-live`; Edge; PWA (installazione, offline, avviso di nuova
versione).

**Non verificabile oggi**: il cambio di lingua "a caldo". Nessun punto dell'interfaccia attuale
chiama `setLocale` (la lingua si sceglie solo con la preferenza salvata o quella del browser),
quindi non c'è un flusso da fissare con Playwright. Il comportamento a caldo si copre con i test
di `i18nStore` e con gli smoke test degli elementi (§8.2); un e2e arriverà quando esisterà un
selettore di lingua.

Dettaglio, in Chrome ed Edge stabili, cartella di prova con sottocartelle, immagini, frontmatter,
wikilink:

1. Avvio: browser non supportato (UA finto), prima apertura, ripresa accesso, cambio cartella
   (anche A → B → A).
2. Editor: digitazione, autosalvataggio, `Ctrl+S`, incolla e trascina immagini,
   autocompletamento `[[`.
3. Anteprima: aggiornamento con debounce, link wiki/relativi/esterni, immagine mancante,
   frontmatter valido e non valido, HTML malevolo (script, `onerror`, `javascript:`) neutralizzato.
4. Scroll sincronizzato in split in entrambe le direzioni, senza rimbalzi.
5. Albero: espandi/chiudi, menu da pulsante e da clic destro, posizione del popover vicino ai bordi,
   nuovo/rinomina/elimina file e cartelle, nome già esistente.
6. Ricerca: `Ctrl+K`, risultati, Invio, Esc, evidenziazione nell'anteprima (Custom Highlight).
7. Conflitto con modifica esterna: ricarica e sovrascrivi; file eliminato fuori dall'app; bozze
   orfane.
8. Accesso perso: dialog non chiudibile con Esc né con clic fuori; accesso negato; ripresa.
9. Tema: ciclo con transizione a pixel, `prefers-reduced-motion`, modalità `auto` che segue il
   sistema, nessun lampo del tema sbagliato all'avvio.
10. Lingua: preferenza salvata e lingua del browser all'avvio, `lang` su `<html>`. (Il cambio a
    caldo non ha oggi un'interfaccia: vedi sopra.)
11. Tastiera e screen reader: ordine del focus, focus che torna al pulsante dopo i dialog,
    `aria-live` dello stato di salvataggio, resizer con le frecce.
12. PWA: installazione, offline, avviso di nuova versione.

---

## 10. Rischi

| # | Rischio | Probabilità / impatto | Mitigazione |
|---|---|---|---|
| R1 | **UI non aggiornata**: senza rendering dichiarativo un campo dello stato viene dimenticato in `render()`. | Alta / medio | Ogni elemento ha un solo `render()` guidato da `getState()`; smoke test che cambiano lo store e controllano il DOM; checklist §9. |
| R2 | **Focus e selezione persi** ricreando nodi (ricerca, albero, input dei dialog). | Media / alto per l'usabilità | `reconcileList` con chiavi; regola "mai ricreare un sottoalbero con il focus"; test sul focus in `list.test.ts`. |
| R3 | **Listener e iscrizioni non tolti**: perdite di memoria, doppi salvataggi dopo un cambio di cartella. | Media / alto | `AbortController` per connessione in `HmdElement`; test del distacco; nessun `addEventListener` senza `signal` (regola di review). |
| R4 | **XSS**: costruire DOM a mano invita a `innerHTML`. | Bassa / critico (la pagina ha accesso alla cartella) | `el()` crea solo nodi di testo; test statico di §8.3; `sanitize.ts` resta l'unica eccezione. |
| R5 | **Controlli statici che passano a vuoto** (`uiText.test.ts` senza più `.tsx`). | Alta se ignorato / medio | Fase 0: `files.length > 0` e casi negativi sintetici. |
| R6 | **Collisioni CSS** senza l'hashing dei CSS Modules. | Media / basso | `@scope` con limite inferiore, `@layer`, test statico sui file CSS. |
| R7 | **Regressioni nella convivenza React + custom element** (fasi 3–5): React 18 non passa proprietà né eventi. | Media / medio | Un solo `reactBridge.tsx`, temporaneo, cancellato nella fase 6 (verificato da un test); fasi brevi. |
| R8 | **Dev experience**: `customElements.define` non si può ripetere, quindi l'HMR di Vite ricarica tutta la pagina. | Certa / basso | Accettato. `define.ts` controlla `customElements.get` per non lanciare errori in dev. Lo stato importante sta nel buffer di emergenza, quindi un ricaricamento non perde dati. |
| R9 | **`useDefineForClassFields`**: un campo di classe con lo stesso nome di una proprietà impostata prima dell'upgrade la oscura. | Bassa / medio | Tutti gli elementi sono definiti prima di montare `<hmd-app>`; gli input sono setter privati (`#workspace`) con accessor pubblici, mai campi pubblici omonimi. |
| R10 | **Scroll sincronizzato e view transition del tema** dipendono da tempi sottili (`suppressUntil`, DOM aggiornato dentro la callback). | Media / medio | Logica copiata identica; `themeStore` notifica in modo sincrono dentro `apply`; test del `themeStore` con transizione finta; checklist §9 punti 4 e 9. |
| R11 | **Accessibilità**: si perdono `aria-*` che JSX rendeva ovvi (`aria-pressed`, `aria-current`, `aria-valuenow`). | Media / medio | Inventario degli `aria-*` per componente preso dai `.tsx` prima di cancellarli (allegato al PR di ogni fase); checklist §9 punto 11. |
| R12 | **Bundle**: zod pesa più del previsto. | Bassa / basso | `zod/mini`; soglia misurata nella fase 1 (§6.2). |
| R13 | **Limiti di jsdom** su dialog/popover/highlight. | Certa / basso | Stub espliciti; il comportamento reale si verifica a mano. |
| R14 | **Tempo**: 1 900 righe di UI da riscrivere, con rischio di fermarsi a metà in convivenza. | Media / medio | Tutto resta sul branch di integrazione fino all'approvazione (decisione 1): `main` non vede mai la convivenza. Le fasi 0–2 (e2e, test, zod, ts-pattern, store) sono comunque recuperabili da sole con un merge separato, se Davide lo approva. Il bridge è l'unico debito della convivenza ed è tracciato. |
| R15 | **L'harness OPFS non è il file system reale**: permessi e selettore sono simulati; OPFS non ha i nomi "case-insensitive" di Windows/macOS. | Certa / medio | Selettore e permessi reali restano nella checklist manuale; i casi di maiuscole restano coperti dai test unitari di `workspaceFS`. |
| R16 | **Snapshot visivi instabili** (font, antialiasing, versione di Chromium). | Media / medio | Font nel bundle, animazioni ridotte, stessa versione di Playwright bloccata in `package-lock.json`; tolleranza `maxDiffPixelRatio` piccola e dichiarata nella config; snapshot rigenerati solo con approvazione. |
| R17 | **Lentezza della suite e2e** (build + preview a ogni esecuzione). | Media / basso | Accettata: niente riuso del server (proverebbe build vecchie); la suite si lancia a fine task, non a ogni salvataggio, e durante lo sviluppo di una spec si filtra per file. |

---

## 11. Criteri di completamento

- `package.json` senza `react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`; con
  `ts-pattern` e `zod`.
- Nessun `.tsx` né `*.module.css` in `src/`; `architecture.test.ts` completamente attivo.
- `npm test`: tutti i test del baseline della fase 0 ci sono ancora (stesso nome o rinominati in
  modo tracciato nel PR) e passano, più i nuovi di §8.2–8.3.
- `npm run lint` e `npm run build` puliti; PWA installabile e funzionante offline.
- `npm run test:e2e` verde con gli **stessi snapshot** generati nella fase 0 (ogni snapshot
  rigenerato è elencato e motivato).
- Merge in `main` solo dopo l'approvazione esplicita di Davide.
- Checklist §9 completata in Chrome ed Edge.
- `CLAUDE.md` e `README.md` aggiornati allo stack nuovo.

## 12. Domande aperte → decisioni

1. **Un merge solo o per fase?** → Un solo merge in `main`, alla fine, dopo approvazione esplicita.
2. **Quanto zod?** → Ridotto: solo file system e provider esterni (§6.2); pacchetto `zod/mini`.
3. **Test in browser reale?** → Sì: Playwright, come prima parte implementativa (fase 0, §8.4).

## 13. Piani di implementazione

Lo spec copre più sottosistemi, quindi l'implementazione è divisa in piani separati, ciascuno con
software funzionante e testato alla fine:

1. `docs/superpowers/plans/2026-09-27-housemd-wc-01-e2e-baseline.md`: fase 0.
2. Fasi 1–2 (logica pura, ts-pattern, zod, store, infrastruttura DOM/CSS): da scrivere dopo il
   piano 1, perché la suite e2e ne è il prerequisito.
3. Fasi 3–5 (elementi in convivenza).
4. Fasi 6–7 (via React, rifinitura, richiesta di approvazione del merge).
