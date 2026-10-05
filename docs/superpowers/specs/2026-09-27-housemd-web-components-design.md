# HouseMD — migrazione a Web Components e CSS con `@scope` — design

Data: 2026-09-27 · **Revisione: 2026-10-05**
Base: `main` (HEAD `822f52d`: v1.1, strumenti AI, impostazioni a pagina, barra di formattazione,
larghezza del testo, tooltip disegnati, albero con un solo tab stop).
Stato: fasi 0–3 implementate (fase 0 PR #6, fase 1 PR #7, fase 2 in `main` (merge locale, commit 1b23305), fase 3 in `main` (merge locale)); fasi 4a e 4b sul branch `feat/web-components`; fasi 4c–8 ancora piano.

Decisioni (27/09, riviste il 01/10; risposte alle domande aperte, §12):

1. **Merge in due tempi.** Le fasi 0–3 (e2e, logica pura, zod/ts-pattern, store, infrastruttura
   DOM/CSS, React 19) non cambiano la UI ed entrano in `main` con **PR separate**, una per fase. Le
   fasi 4–8 (convivenza e uscita da React) vivono su un branch di integrazione e arrivano in `main`
   con **un solo merge**, solo dopo approvazione esplicita di Davide.
2. **zod ridotto**: solo ai confini con dati che il codice non controlla (file system, storage del
   browser, risposte JSON dei provider), mai sulla logica interna (§6.2).
3. **Playwright** entra nel progetto ed è la **prima parte implementativa**: una suite end-to-end
   sull'app React di oggi che fa da rete di sicurezza per tutta la migrazione (§7 fase 0, §8.4). Il
   collaudo AI scritto a mano (`tests/browser/run-ai-smoke.mjs`, CDP grezzo) diventa una spec
   Playwright e sparisce.
4. **React 19 prima della convivenza** (nuova). React 19 assegna da solo proprietà ed eventi ai
   custom element: il `reactBridge.tsx` della prima versione non serve più (§7 fase 3).

## 0. Cosa è cambiato rispetto alla versione del 27/09

- La UI è raddoppiata: AI (modalità AI, composer, chip modello/effort, revisione con
  `@codemirror/merge`, profili, preset, sync), impostazioni a pagina con rotta nell'hash,
  pannello della cronologia, avviso di aggiornamento PWA, barra di formattazione sulla selezione,
  larghezza massima del testo, tooltip disegnati, navigazione da tastiera dell'albero.
- Alcune estrazioni previste dalla fase 1 esistono già: `ui/shortcuts.ts` (`shortcutFor`, al posto
  del `keymap.ts` previsto), `ui/treeNav.ts`, `lib/route.ts`, `lib/textWidth.ts`,
  `lib/pageTitle.ts`, `app/switchFolder.ts`, `ai/reviewStatus.ts`, `ai/composerKeys.ts`,
  `ai/selectionChip.ts`. `AiController` e `UpdateFlow` sono già store esterni come `Workspace`.
- v1.1 è in `main`: il branch `plan/web-components-stack` non esiste più e l'avvertenza sul merge di
  v1.1 cade.
- La fase 0 non è mai partita: non c'è `e2e/` né Playwright.
- Esiste un selettore di lingua (impostazioni → generale): il cambio di lingua a caldo ora si
  verifica anche end-to-end.
- `CLAUDE.md` ha regole nuove che la riscrittura deve rispettare: coda `runExclusive`, cronologia
  senza `await`, regole AI (rete solo da `ai/providers`, chiavi solo in `aiSecrets`, risposte non
  fidate).

## Obiettivo

Togliere React e i CSS Modules e costruire l'interfaccia con soli standard web: Custom Elements, DOM
API, `<dialog>`, Popover, Anchor Positioning, CSS `@scope` e `@layer`. Le uniche librerie nuove sono
`ts-pattern` (match esaustivi sugli stati) e `zod` (validazione di ciò che arriva da fuori).

Il comportamento visibile non cambia: stessa UI, stessi testi, stesse scorciatoie, stessi toast,
stessi tooltip. La migrazione riesce se alla fine `npm test`, `npm run lint`, `npm run build` e
`npm run test:e2e` passano, i test di oggi ci sono ancora (adattati dove serve, mai cancellati per
farli passare) e la checklist manuale (§9) va a buon fine.

## Fuori scope

- Nuove funzionalità o ritocchi grafici. Se qualcosa cambia aspetto, è un bug della migrazione.
- Sostituire CodeMirror (anche `@codemirror/merge`), markdown-it, MiniSearch, DOMPurify, `yaml`,
  `diff`, `@anthropic-ai/sdk`: sono già indipendenti dal framework e restano come sono.
- Toccare `bridge/` (il bridge locale Claude Code è un processo Node, senza UI).
- Un "mini-framework" fatto in casa (virtual DOM, template reattivi, signals). Si scrivono al
  massimo quattro helper piccoli e testati (§5.2).
- Librerie di componenti (Lit, FAST, Stencil…): la richiesta è "standard puri" (§4.3).

---

## 1. Lo stack di oggi

### 1.1 Numeri (misurati su `822f52d`)

| Area | File | Righe (circa) | Dipende da React? |
|---|---|---|---|
| Logica pura `.ts` (escluse le prove) | 98 | ~5 900 | 6 file sì: gli hook `ui/useWorkspace.ts`, `ui/useRoute.ts`, `theme/useTheme.ts`, `ui/ai/useAiController.ts`, `ui/ai/useAiState.ts` e un tipo in `editor/docExtensions.ts` |
| Componenti `.tsx` | 35 | ~3 800 (`WorkspaceView` da solo 712) | Sì |
| CSS Modules (`*.module.css`) | 15 | ~1 640 | Sì (import `styles.x`) |
| `global.css` | 1 | 142 | No |
| Test (`*.test.ts`) | 67 | ~5 800, **488 test verdi** | **Nessuno importa React** |
| Collaudo browser (`tests/browser/`) | 3 | ~210 | Sì: `ai-smoke.tsx` monta componenti React |

### 1.2 Dipendenze coinvolte

- Aggiornate nella fase 3: `react`/`react-dom` 18 → 19.3, con `@types/react*` 19.3 (fatto).
- Da togliere alla fine: `react`, `react-dom`, `@types/react`, `@types/react-dom`,
  `@vitejs/plugin-react`.
- Da aggiungere: `ts-pattern`, `zod` (v4, import da `zod/mini`, §6.2); in sviluppo
  `@playwright/test` (versione esatta, §8.4).
- Invariate: CodeMirror 6 e `@codemirror/merge`, `@anthropic-ai/sdk`, `markdown-it`, `dompurify`,
  `minisearch`, `yaml`, `diff`, `pixelarticons`, `@fontsource/*`, `vite`, `vite-plugin-pwa`, `tsx`,
  `typescript`, `jsdom`, `fake-indexeddb`.
- `tsconfig.json`: via `"jsx": "react-jsx"` alla fine; `useDefineForClassFields: true` resta (R9).

### 1.3 Come React è usato davvero

| Uso di React | Dove | Sostituto |
|---|---|---|
| `useSyncExternalStore` su store esterni | `useWorkspace`, `useAiState`, `UpdateNotice`, chip e sezioni AI | L'elemento si iscrive in `connect()` con `watch()` (§5.1). `Workspace`, `AiController`, `UpdateFlow` sono **già** store: non cambiano. |
| Context `I18nProvider` / `useT` / `useI18n` | `i18n/I18nProvider.tsx` | `i18nStore` (§5.3), stessa semantica "vince l'ultima richiesta". |
| `useTheme` + `flushSync` dentro la view transition | `theme/useTheme.ts` | `themeStore`; la notifica sincrona dentro `apply` sostituisce `flushSync`. |
| `useRoute` (hash, guardia sulle modifiche aperte delle impostazioni) | `ui/useRoute.ts` | `routeStore` (§5.3): `hashchange` + `parseRoute`/`formatRoute` di `lib/route.ts`, stessa guardia. |
| `useDraft` (bozza con stato "sporco" nelle impostazioni AI) | `ui/ai/settings/ItemList.tsx` | Modulo puro `draftState.ts` (`edit`, `reset`, `isDirty`) con test. |
| `useAiController` (crea il controller, legge `aiProfile`) e `useAiSync` | `ui/ai/useAiController.ts`, `AiSyncSection.tsx` | Funzioni di creazione chiamate da `hmd-workspace`; la parte asincrona resta nel modulo puro. |
| `forwardRef` + `useImperativeHandle` (`scrollToLine`, `focus`, `focusInput`…) | `Editor`, `Preview`, `SearchPanel`, `Composer`, `DiffPane` | Metodi pubblici della classe dell'elemento. |
| `useId` | `ModelChip`, `ReviewBar` | Helper `uid(prefix)` in `src/dom/` (contatore per documento). |
| `key` per rimontare `WorkspaceView` (`openCount`) | `App.tsx` | L'app sostituisce l'elemento con una nuova istanza; `openCount` sparisce. |
| `useEffect` con `showModal()` + workaround per StrictMode | `NameDialog`, `ConfirmDialog`, dialog dentro `WorkspaceView` | Dialog con API a promessa (§5.4). |
| Liste con `key` (albero, risultati, toast, bozze orfane, chat, profili, preset, cronologia) | molti | Helper `reconcileList` (§5.2). |
| Tipo `MutableRefObject` | `editor/docExtensions.ts` | Tipo locale `{ current: T }`. |
| `switch (screen.kind)` | `App.tsx` | `match(screen)…exhaustive()` di ts-pattern. |

Conclusione: il progetto è già scritto "da standard web" (dialog, popover, anchor, Custom Highlight,
view transition, File System Access, tooltip con Anchor Positioning) con React usato come motore di
rendering. Il rischio sta nel rendering a mano delle liste, nella pulizia dei listener e — nuovo —
nella mole: `WorkspaceView` e la parte AI sono metà della UI.

---

## 2. Vincoli (invariati, più tre nuovi)

Invariati da `CLAUDE.md`:

- Solo Chromium desktop recente, niente polyfill né fallback, tranne `setHTML()` → DOMPurify.
- Mai `innerHTML` con HTML non sanitizzato: l'unico `innerHTML` resta dentro `preview/sanitize.ts`.
- Mai `alert/confirm/prompt`: `<dialog>` con `showModal()` e `closedby`.
- Solo `fs/fsaOps.ts` e `fs/access.ts` toccano la File System Access API.
- Logica in moduli puri testati con `npm test`; testi UI da `t()`, chiavi in tutti i `locales/*.json`.
- Le operazioni del `Workspace` passano da `runExclusive`; nessun `await` della cronologia nei
  percorsi che cambiano il documento. La migrazione **non tocca** `workspace/`: gli elementi chiamano
  le stesse API pubbliche che chiamano oggi i componenti.
- AI: rete solo da `ai/providers/*`; chiavi solo in `aiSecrets` o in memoria (mai in attributi,
  `dataset`, log o toast); risposte e proposte non fidate, rese solo da `ai/safeRender.ts` +
  `setSafeHTML`.
- Tooltip: mai `title` nativo sui controlli, sempre `.tooltip` + `data-tooltip` + `aria-label`
  (lo controlla `ui/tooltips.test.ts`).

Nuovi:

1. **Elementi sottili.** Un custom element crea il suo DOM, lo aggiorna da uno stato, trasforma
   eventi DOM in chiamate a moduli puri o store. Calcoli, validazioni e macchine a stati stanno
   fuori, in moduli `.ts` testati senza DOM.
2. **Niente costruzione di DOM da stringhe.** Niente `innerHTML`, `insertAdjacentHTML`,
   `outerHTML =`, `document.write` fuori da `sanitize.ts`: il DOM si crea con `el()` (§5.2) e i testi
   entrano con `textContent`. Lo fa rispettare un test statico (§8.3).
3. **Light DOM + `@scope`** per tutti gli elementi dell'app (§4). Lo Shadow DOM non si usa, salvo
   una revisione esplicita di questo documento.

---

## 3. Architettura di arrivo

```
index.html
  <hmd-app>                           ← macchina a stati delle schermate (ts-pattern)
    <hmd-start-screen>                ← unsupported | start | resume
    <hmd-workspace>                   ← layout, toolbar, scorciatoie, pannelli, rotta
      <hmd-search-panel>
      <hmd-file-tree>                 ← menu azioni in popover ancorato, un solo tab stop
      <hmd-history-panel>
      <hmd-editor>                    ← EditorView di CodeMirror (+ barra di formattazione, già CM)
      <hmd-preview>                   ← HTML sanitizzato + <hmd-frontmatter-card>
      <hmd-ai-sidebar>                ← <hmd-ai-chat-log> <hmd-ai-suggestions> <hmd-ai-composer>
                                        <hmd-ai-model-chip> <hmd-ai-effort-chip> <hmd-ai-parameters>
      <hmd-ai-review>                 ← <hmd-ai-review-bar> <hmd-ai-diff-pane> (MergeView)
      <hmd-settings>                  ← pagina da #/settings/<sezione>: generale, profili, preset, sync
      <hmd-conflict-bar>
      <hmd-theme-switcher>
      <hmd-notice> <hmd-update-notice>
      <hmd-toasts>                    ← popover="manual"
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
    uid.ts       uid.test.ts       ← id unici per aria-* e popovertarget (era useId)
    maskIcon.ts  maskIcon.test.ts  ← <span class="icon"> da un URL (era Icon.tsx)
    icon.ts                        ← icon(name, { size, className }): nome → URL (icons.ts) → maskIcon
  state/
    i18nStore.ts  themeStore.ts  routeStore.ts  draftState.ts   (+ test)
    prefs.schema.ts prefs.schema.test.ts
  elements/
    app/            app.element.ts  app.css  screens.ts (+ test)
    start-screen/   …
    workspace/      workspace.element.ts  workspace.css  layout.ts dialogFor.ts saveIndicator.ts (+ test)
    file-tree/      file-tree.element.ts  file-tree.css  treeState.ts (+ test)
    search-panel/   …  segments.ts (+ test)
    history-panel/  …
    editor/         editor.element.ts  editor.css
    preview/        preview.element.ts  frontmatter-card.element.ts  preview.css  cardDate.ts (+ test)
    ai/             sidebar, chat-log, composer, suggestions, model-chip, model-select,
                    effort-chip, parameters, review, review-bar, diff-pane  (*.element.ts + *.css)
    settings/       settings.element.ts + sezioni (general, profiles, presets, sync, item-list)
    toasts/ notice/ update-notice/ conflict-bar/ theme-switcher/
    dialogs/        nameDialog.ts confirmDialog.ts accessLostDialog.ts dialogs.css
    events.ts                      ← mappa tipizzata dei CustomEvent
    define.ts                      ← unico punto con customElements.define()
  testing/
    domEnv.ts    domEnv.test.ts    ← globali jsdom per i test *.dom.test.ts
e2e/                               ← Playwright (fase 0), fuori da src/
  playwright.config.ts  tsconfig.json
  support/  fsHarness.ts  aiHarness.ts  app.ts  i18n.ts
  *.spec.ts                        ← suffisso .spec: `tsx --test` non li raccoglie
```

I moduli puri esistenti (`workspace/`, `fs/`, `ai/`, `history/`, `preview/render.ts`, `ui/tree.ts`,
`ui/treeNav.ts`, `ui/shortcuts.ts`, `ui/names.ts`, `lib/*`…) **non si spostano**. `src/ui/` perde i
`.tsx` e gli hook e tiene i `.ts` puri.

Nomi: prefisso `hmd-` (`hmd-ai-` per la parte AI); un file `*.element.ts` per elemento; la classe si
chiama come il tag in PascalCase (`HmdFileTree`). Identificatori in inglese, testi da `t()`.

---

## 4. Decisione: Light DOM + `@scope` (non Shadow DOM)

### 4.1 La scelta

Tutti gli elementi rendono nel **light DOM**. L'isolamento degli stili arriva da:

- `@layer` dichiarati una volta in `global.css`: `@layer reset, base, components, overrides;`
- un file CSS per elemento, tutto dentro `@layer components { @scope (hmd-x) to (<figli hmd-*>) { … } }`;
- classi brevi e locali (`.row`, `.name`, `.menu`), che non escono dallo scope e al limite inferiore
  non entrano negli elementi figli.

Le utilità condivise restano globali in `@layer base`: `.icon`, `:focus-visible` (focus ring oreo e
la variante `forced-colors`), `::highlight(housemd-search)` e i **tooltip disegnati**
(`.tooltip` + `data-tooltip` con `anchor-name`/`anchor-scope`/`position-try-fallbacks`).

```css
@layer components {
  @scope (hmd-file-tree) {
    :scope { display: block; flex: 1; overflow-y: auto; padding: 6px 4px 24px; }
    .list { list-style: none; margin: 0; padding: 0 0 0 12px; }
    .row:hover, .row[data-active='true'] { background: var(--c-accent-soft); }
    .menu { position-anchor: --housemd-tree-menu; /* … */ }
  }
}
```

`workspace.css` usa il limite inferiore per non stilizzare i componenti che contiene:

```css
@scope (hmd-workspace) to (hmd-file-tree, hmd-search-panel, hmd-history-panel, hmd-editor,
  hmd-preview, hmd-ai-sidebar, hmd-ai-review, hmd-settings, hmd-toasts) { … }
```

### 4.2 Perché non Shadow DOM

| Funzionalità usata oggi | Con Shadow DOM | Con light DOM + `@scope` |
|---|---|---|
| **CSS Custom Highlight** (`::highlight(housemd-search)`) | La regola deve stare dentro lo shadow root che contiene il testo. | Funziona com'è. |
| **Tooltip disegnati** (`.tooltip::after` globale, ancorato con `anchor-scope`) | Il foglio globale non entra negli shadow root: andrebbe adottato in ogni elemento. | Funziona com'è. |
| **Anchor Positioning** (menu dell'albero, chip e popover AI, tooltip) | Ancora e popover devono stare nello stesso albero: da verificare a ogni confine. | Funziona com'è. |
| **Riferimenti per ID** (`aria-labelledby`, `for`, `popovertarget`, `commandfor`) | Non attraversano lo shadow root; *Reference Target* non è una base su cui contare oggi. | Funzionano. |
| **CodeMirror 6 e `@codemirror/merge`** (iniettano gli stili nel `document`) | Opzione `root` dell'`EditorView`, da verificare per tooltip, autocompletamento, barra di formattazione e MergeView. | Invariato. |
| **Stili di base condivisi** (`.icon`, focus ring, `button { font: inherit }`) | Servono `adoptedStyleSheets` in ogni elemento. | Si ereditano dal documento. |
| **HTML sanitizzato** (anteprima e chat AI) | Da stilizzare dentro ogni shadow root. | `@scope (hmd-preview)`, `@scope (hmd-ai-chat-log)`. |
| **View transition del tema**, token `light-dark()` | Indifferente. | Indifferente. |

Lo Shadow DOM protegge un componente da pagine ospiti che non si controllano. HouseMD è
un'applicazione unica: `@scope` con limite inferiore e `@layer` bastano e sostituiscono l'hashing
dei CSS Modules.

Il limite: nessuno *impedisce* a un foglio di stilizzare un altro elemento. Contromisura: un test
statico (§8.3) controlla che ogni CSS sotto `src/elements/` contenga solo blocchi `@scope` con le
radici ammesse:

| Cartella | Radici `@scope` ammesse |
|---|---|
| `elements/<nome>/` (regola generale) | `hmd-<nome>` |
| `elements/preview/` | `hmd-preview`, `hmd-frontmatter-card` |
| `elements/ai/` | `hmd-ai-*` |
| `elements/settings/` | `hmd-settings`, `hmd-settings-*` |
| `elements/dialogs/` | `dialog.hmd-dialog` (dialog nativi aggiunti a `document.body`) |

Una nuova eccezione si aggiunge alla tabella del test con una riga di motivazione, mai con uno `skip`.

### 4.3 Criteri per rivedere la decisione

Shadow DOM (e probabilmente Lit) per un elemento solo se deve essere incorporato in pagine di terzi
o se serve `<slot>` con contenuto dell'utente. Oggi nessun elemento ha questi requisiti.

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

  /** Iscrizione a uno store legata al ciclo di vita: `fn` gira subito e a ogni notifica. */
  protected watch(store: Subscribable, fn: () => void, signal: AbortSignal): void {
    // Un signal già interrotto non emette più 'abort': l'iscrizione resterebbe per sempre.
    if (signal.aborted) return;
    const off = store.subscribe(fn);
    signal.addEventListener('abort', off, { once: true });
    fn();
  }
}
```

`watch` riceve lo store, non il metodo `subscribe` staccato: alcuni store lo espongono come metodo di un oggetto (`i18nStore`, `routeStore`, `themeStore`, `UpdateFlow`), altri come arrow function (`Workspace`, `AiController`).

- Tutti i `addEventListener` passano `{ signal }`: niente cleanup a mano.
- Dove un elemento si sposta senza dover perdere lo stato, `moveBefore()` + `connectedMoveCallback()`.
  Oggi non serve: regola per il futuro.
- Input come **proprietà JS** tipizzate (`workspace`, `ai`, `nodes`, `openPath`), non attributi
  stringa. Gli attributi riflettono solo lo stato che serve al CSS (`data-mode`, `data-state`, `aria-*`).
- Output come `CustomEvent` tipizzati con `bubbles: true` (`hmd-open`, `hmd-tree-action`), dichiarati
  in `src/elements/events.ts`, oppure callback passate come proprietà dove l'evento non serve ad
  altri (es. `onImage` dell'editor, che restituisce una Promise).
- **Convivenza con React 19 (fasi 4–7).** React 19 assegna come proprietà ogni prop il cui nome
  esiste sull'istanza dell'elemento e registra come listener le prop `on<nome-evento>`. Quindi:
  `define.ts` va importato **prima** del primo render (altrimenti React vede un elemento non
  aggiornato e imposta attributi); i nomi degli eventi sono minuscoli con trattino (`hmd-open` →
  prop `onhmd-open`); i tipi JSX dei tag `hmd-*` si dichiarano in un solo file temporaneo
  `src/elements/jsx.d.ts`, cancellato nella fase 7.

Host con `display: contents` quando l'elemento sostituisce un componente dentro un layout React: l'albero interno resta quello di React e l'audit degli stili (`e2e/support/styleAudit.ts`) salta il wrapper.

### 5.2 Quattro helper per il DOM (testati in jsdom)

1. `el(tag, props?, ...children)`: crea un elemento. `props` accetta `class`, `dataset`, attributi
   (`'aria-label'`, `'data-tooltip'`), proprietà (`hidden`, `value`) e listener (`on: { click }`).
   I figli stringa diventano **nodi di testo**, mai HTML. Sostituisce JSX. Chiavi `innerHTML`,
   `outerHTML`, `srcdoc` (in qualsiasi grafia) e `on…` in stringa: errore a runtime (le prime tre anche
   nei tipi). Ogni altra chiave: `undefined`/`null` = niente; un booleano su una chiave `aria-*` diventa
   la stringa `"true"`/`"false"` (gli stati ARIA sono enumerati); un altro booleano su una proprietà non
   booleana (o inesistente, come `popover`) è un attributo booleano (`true` = vuoto, `false` = niente);
   altrimenti è una proprietà se esiste ed è scrivibile, e un attributo se no (`list`, `form`).
2. `reconcileList(parent, items, key, create, update)`: allinea i figli di `parent` a `items` per
   chiave: riusa i nodi (così restano focus e selezione), crea i nuovi, rimuove gli altri e riordina
   con `moveBefore` quando c'è, altrimenti `insertBefore`. `update` gira su ogni nodo, nuovo o
   riusato; `moveBefore` solo con `parent` connesso.
3. `setText(node, text)` / `toggleAttr(node, name, on)`: scrivono solo se il valore cambia.
   `toggleAttr(node, name, on, value = '')`.
4. `uid(prefix)`: id stabile e unico nel documento, al posto di `useId`.

Regola di rendering: **creare una volta, aggiornare in modo mirato.** `connect()` costruisce lo
scheletro; `render()` (chiamato dalle iscrizioni) aggiorna testi, attributi e liste. Non si
ricostruisce mai un sottoalbero che contiene un campo con il focus (ricerca, composer, input dei
dialog e delle impostazioni).

### 5.3 Store

- `Workspace`, `AiController`, `UpdateFlow` restano come sono (`subscribe`/`getState`).
- `i18nStore` (`src/state/i18nStore.ts`): `createI18nStore({ locale, messages, load, persist })` →
  `{ getState, subscribe, t, setLocale }`. Contiene la logica di `I18nProvider` ("vince l'ultima
  richiesta, non l'ultima caricata"; si salva la lingua **effettivamente caricata**;
  `document.documentElement.lang` aggiornato da chi si iscrive). Oggi questa logica **non ha test**:
  li riceve (§8.2). Ora `setLocale` ha un chiamante reale (il selettore nelle impostazioni).
- `themeStore` (`src/state/themeStore.ts`): `setTheme(next)` salva e chiama
  `pixelTransition(() => { state = next; notify(); applyTheme(next); })`; la notifica sincrona dentro
  la callback sostituisce `flushSync`. Iscrizione a `prefers-color-scheme` in modalità `auto`.
- `routeStore` (`src/state/routeStore.ts`): stato da `parseRoute(location.hash)`, `navigate(route)`
  con la stessa guardia di `useRoute` (modifiche aperte nelle impostazioni → conferma), `hashchange`
  e titolo della scheda (`pageTitle`) aggiornati da chi si iscrive.
- `draftState` (`src/state/draftState.ts`): la bozza delle sezioni profili/preset (`useDraft`).

Istanze uniche create in `main.ts` e passate come proprietà a `<hmd-app>`, che le passa ai figli.
Niente singleton importati dagli elementi: nei test si usa uno store finto.

### 5.4 Dialog come funzioni che restituiscono Promise

```ts
const name = await showNameDialog({ title, kind, initial, confirmLabel, validate, t, signal });   // string | null
const ok   = await showConfirmDialog({ title, message, confirmLabel, t, signal });               // boolean
await showAccessLostDialog({ folderName, onResume, t, signal });                                 // si chiude solo con accesso concesso
```

Ogni funzione crea un `<dialog closedby="any">` (`closedby="none"` per l'accesso perso), lo aggiunge
a `document.body`, chiama `showModal()`, risolve la Promise all'evento `close` e rimuove il dialog.
"Annulla" usa `command="close" commandfor="<id>"`. Il focus torna da solo al pulsante che ha aperto
il dialog. I workaround per StrictMode spariscono. Le conferme oggi sparse (eliminazione, modifiche
aperte su Indietro/Chiudi delle impostazioni, elimina profilo/preset) passano tutte da
`showConfirmDialog`.

`signal` (facoltativo) chiude il dialog quando chi l'ha aperto sparisce; la Promise si risolve come un annullamento. Il dialog si rimuove dopo l'evento `close`, così il focus torna all'elemento d'origine anche dopo una conferma (prima della 4b, con React, cadeva sul `body`). La conferma «Scartare le modifiche?» è `showDiscardChangesDialog({ t, signal })`; i dialog dell'albero passano da `runTreeDialog(dialog, deps)` (`elements/workspace/treeDialogs.ts`).

La logica che decide quale dialog aprire per un'azione dell'albero diventa
`dialogFor(action, node)` con `match(...).exhaustive()`, testata.

---

## 6. ts-pattern e zod: dove e perché

### 6.1 ts-pattern: match esaustivi al posto di `switch` e mappe parziali

| Punto | Oggi | Con ts-pattern |
|---|---|---|
| Schermata dell'app (`boot/unsupported/start/resume/open`) | `switch` in `App.tsx` | `screens.ts`: `match(screen)….exhaustive()` |
| Scorciatoia → comando | `shortcutFor` restituisce `Shortcut`, poi `if/else` in `WorkspaceView` | `match(shortcut)….exhaustive()`: un `Shortcut` nuovo senza ramo è un errore di `tsc` |
| Modalità (`editor/split/preview/ai`) → colonne e pannelli | ternari in `WorkspaceView` | `layout.ts`: `gridColumns`, `nextMode`, `clampWidth` (sidebar e AI) |
| Azione dell'albero → dialog | `if/else` | `dialogFor(action, node)` |
| Stato di salvataggio → etichetta, `role`, `aria-live` | `Record<SaveState, MessageKey>` + ternari | `saveIndicator(doc)`, esaustivo anche su `deletedOnDisk` |
| Rotta → vista | ternario su `route.view` | `match(route)` in `hmd-workspace` |
| Nodo dell'albero, `toast.kind`, stato della revisione | ternari | `match` |

Regola: `.exhaustive()` sempre. `ts-pattern` entra nella logica pura, così i test la coprono.

### 6.2 zod: solo ai confini

**Regola (decisione 2):** zod valida solo dati che arrivano da **fuori dal processo**: file della
cartella dell'utente, storage del browser (IndexedDB, `localStorage`, che possono contenere formati
vecchi, corrotti o modificati a mano) e i campi delle risposte dei modelli che i provider non
controllavano. **Mai** sulla
logica interna (stato di `Workspace` e `AiController`, store, proprietà ed eventi degli elementi,
traduzioni).

Si usa **`zod/mini`**. Criterio: la crescita del bundle principale gzip, misurata con `vite build`
prima e dopo, va annotata nel commit che introduce zod; oltre 8 KB si rivaluta. Misura della fase 1:
bundle principale 400 915 → 410 146 B gzip (+9 231 B in tutto, moduli nuovi compresi); da soli zod/mini con gli schemi
usati ≈ 6,5 KB e ts-pattern ≈ 1,8 KB. I provider sono importati staticamente (`aiController` →
`./providers`), quindi anche i loro schemi stanno nel bundle principale: solo l'SDK di Anthropic è un
chunk a parte.

Contratto: i test esistenti di ciascun confine **non cambiano le asserzioni**. Si aggiungono solo
casi per i dati corrotti.

| Confine | Oggi | Con zod |
|---|---|---|
| Preferenze in `localStorage` (`theme`, `locale`, `mode`, `sidebarOpen`, `sidebarWidth`, `aiSidebarWidth`, `aiProfile`, `autosave`, `textWidth`, `lastFile:<id>`) | `readPref<T>` = `JSON.parse(raw) as T`; validazione solo per alcune chiavi | `state/prefs.schema.ts`: uno schema per chiave; `readPref(key)` tipizzato dalla mappa `PREFS`, default se `safeParse` fallisce. `parseTheme`/`parseLocale`/`parseTextWidth`/`parseAutosave` restano come sono (validano già); zod copre le chiavi che non avevano controllo. `lastFile:<id>` ha `readLastFile`/`writeLastFile`. |
| `.housemd.json` | `parseConfig` a mano | Schemi per campo con `safeParse` per campo (fallback campo per campo, stesso ordine dei `problems`). Contratto: `config.test.ts`. |
| `housemd-sync.json` (sync AI) | `ai/sync/schema.ts`, validatori a mano completi | Resta com'è: è già validato campo per campo e coperto da `sync.test.ts`; zod non aggiunge garanzie. |
| Buffer di emergenza in IndexedDB | `normalizeStored` con `typeof` | `z.union([z.string(), z.object({ text, base })])`; record corrotto → `null`. |
| `handleStore` (`{ handle, workspaceId }`, lista `known`) | cast | Solo la forma del record; l'handle resta **opaco** (`z.custom` oggetto non nullo), nessun metodo della FSA nominato. Record non valido = nessuna cartella salvata. |
| Cronologia in IndexedDB (`history`) | cast | Forma dei record; un record non valido manca dall'elenco e `get` dà `null`. |
| Risposte dei provider: usage, elenchi modelli, delta di Anthropic | campi non controllati | `ai/providers/shapes.ts`: voci malformate scartate, token non numerici `undefined`, testo non stringa `badStream`. I campi già controllati a mano (testo OpenAI, bridge, fine) restano così; gli esiti visibili non cambiano. Contratto: `providers.test.ts`. |

Store AI in IndexedDB (profili, preset, `aiSecrets`): **rimandati**. `ai/idbStores.ts` riscrive l'intero
store a ogni scrittura (`clear()` + `put()`), quindi scartare in lettura un record non valido lo
cancellerebbe. Prima serve decidere cosa fare dei record illeggibili (per esempio una quarantena).

Esclusi di proposito: frontmatter → card (`toCard` è presentazione tollerante dopo il parser
`yaml`), messaggi di traduzione, stato interno.

---

## 7. Migrazione a passi

**Branch e merge (decisione 1).**

- **Fasi 0–3 → `main` con una PR per fase**, da branch corti creati da `main`. Ogni PR finisce con
  `npm test` verde, `npm run lint` e `npm run build` puliti, `npm run test:e2e` verde (snapshot
  invariati).
- **Fasi 4–8 → branch di integrazione `feat/web-components`**, creato da `main` dopo il merge della
  fase 3. Stesso cancello a fine fase più la checklist ridotta di §9. **Un solo merge in `main`**,
  alla fine della fase 8, dopo l'approvazione esplicita di Davide. Se `main` riceve modifiche, si fa
  rebase del branch (mai merge di `main` dentro il branch) rilanciando entrambe le suite; una
  funzionalità nuova arrivata in `main` va migrata nel branch prima del merge finale.

### Fase 0: Playwright e rete di sicurezza (PR in `main`)

Non cambia una riga dell'app.

1. `npm ci && npm test`: annotare il baseline (oggi 488 test verdi).
2. **Suite Playwright sull'app React di oggi** (§8.4): harness OPFS, harness AI con provider finto,
   spec funzionali per i flussi della checklist e snapshot visivi in tema chiaro e scuro. Gli
   snapshot sono il **riferimento visivo** di tutta la migrazione.
3. **Portare `tests/browser/run-ai-smoke.mjs` in Playwright** (`e2e/ai-review.spec.ts`), con le
   stesse asserzioni, contro l'app vera invece della pagina `ai-smoke.html`. Poi cancellare
   `tests/browser/` e lo script `test:browser` (sostituito da `test:e2e`); aggiornare README.
4. Rendere `uiText.test.ts` **indipendente dall'estensione** e mai vuoto (§8.1); estendere la regex di
   `tooltips.test.ts` alle forme di `el()`.
5. Aggiungere i test statici di §8.3 già validi sul codice di oggi.

### Fase 1: logica pura, ts-pattern, zod, store (PR in `main`)

1. Aggiungere `ts-pattern` e `zod`.
2. Estrarre dai componenti le funzioni pure che mancano, con test: `layout.ts`, `dialogFor.ts`,
   `saveIndicator.ts`, `segments.ts` (`Highlighted` in `SearchPanel`), `cardDate.ts`
   (`formatCardDate`), `screens.ts`, `treeState.ts` (`expanded` di `FileTree`), `draftState.ts`.
   I componenti React le importano: il comportamento non cambia.
3. zod ai confini di §6.2, senza modifiche alle asserzioni dei test esistenti.
4. `i18nStore`, `themeStore`, `routeStore` come moduli puri con test. `I18nProvider`, `useTheme` e
   `useRoute` diventano adattatori sottili (`useSyncExternalStore`), così React e i futuri elementi
   condividono una sola fonte di verità.

### Fase 2: infrastruttura DOM e CSS (PR in `main`)

1. `src/dom/el.ts`, `list.ts`, `element.ts`, `uid.ts`, `icon.ts` + `src/testing/domEnv.ts`, con test.
   Fino alla fase 4 non li usa la produzione: è voluto, sono la base del branch.
2. `global.css`: ordine `@layer reset, base, components, overrides;`, stili globali di oggi (tooltip
   e focus ring compresi) nei layer `reset`/`base`.
3. Estendere `buildCss.test.ts`: oltre a `light-dark()` verifica che `@layer` e `@scope` arrivino
   intatti nel CSS di produzione (il minificatore ha già trasformato `light-dark()` una volta).
4. I CSS Modules restano, senza layer, quindi vincono sui layer: nessun cambio visivo (snapshot).
5. **Fatta** (piano 3). In più: controlli statici `define` e `@scope` di §8.3 attivi da subito; audit
   degli stili calcolati (`npm run test:e2e:audit`, §8.4).

### Fase 3: React 19 (PR in `main`)

1. `react`/`react-dom` 19 e tipi allineati. Correggere ciò che React 19 cambia: `useRef` con
   argomento obbligatorio, `MutableRefObject` → `RefObject`, namespace `JSX` globale, `forwardRef`
   (ancora supportato, si lascia), doppio montaggio di StrictMode sui ref callback.
2. Nessun cambio di comportamento: lo provano e2e e snapshot. Se un comportamento cambia, è un bug
   dell'aggiornamento, non della spec.
3. **Fatta** (piano 4). Cambi reali: `inert` booleano (con la stringa vuota il workspace dietro le impostazioni non sarebbe più stato inerte), `popoverTarget`, `RefObject` al posto di `MutableRefObject`. Ref callback, `useRef` senza argomento e namespace `JSX` non toccavano il codice. Rete aggiunta: `npm run test:e2e:dev` (§8.4) e quattro e2e (workspace inerte, popover del chip del profilo e degli avvisi, tema con le animazioni; quello del tema conta anche le chiamate a `document.startViewTransition` e fallisce se la transizione viene saltata). Riparato un difetto che si vedeva solo con StrictMode: la revisione AI metteva il focus sull'editor appena montato, che StrictMode distruggeva e ricreava subito: il focus cadeva sul body e Ctrl+Z dopo «Accetta tutto» non arrivava a CodeMirror; ora `Editor` ridà il focus alla vista ricreata. Bundle principale gzip: 410 158 → 432 419 B.

### Fase 4: foglie come custom element dentro React (branch)

Divisa in tre piani: 4a (piano 5: infrastruttura, tema, conflitto, avvisi, toast), 4b (dialog), 4c (start screen e foglie AI).

Ordine: `theme-switcher`, `conflict-bar`, `notice`, `update-notice`, `toasts`, dialog (funzioni),
`start-screen`, `ai-suggestions`, `ai-effort-chip`, `ai-parameters`.

- Ogni componente migrato: il `.module.css` diventa `<nome>.css` con `@scope` dentro
  `@layer components`, il `.tsx` si cancella, chi lo usava monta il tag (proprietà ed eventi passati
  direttamente da React 19, §5.1).
- I dialog diventano le funzioni di §5.4, chiamate da `WorkspaceView`.
- 4a **fatta**: `hmd-theme-switcher`, `hmd-conflict-bar`, `hmd-notice`, `hmd-update-notice`, `hmd-toasts`; host con `display: contents`; store passati come proprietà (`useI18nStore`, `getThemeStore`); `HmdElement.reconnect()`; test degli elementi in jsdom con `src/testing/assetHooks.ts` e `popoverStub.ts`. I toast conservano il riavvio dei timer a ogni nuovo array (difetto preesistente, visibile: da decidere a parte).
- 4b **fatta**: `showNameDialog`, `showConfirmDialog`, `showDiscardChangesDialog`, `showAccessLostDialog` in `src/elements/dialogs/` (nucleo `modal.ts`, foglio `dialogs.css`), `runTreeDialog`, hook temporaneo `useUnmountSignal`; via `ConfirmDialog.tsx`, `NameDialog.tsx`, `AccessLostDialog`; `Dialog.module.css` resta per i campi delle impostazioni fino alla fase 7. Audit esteso ai `::backdrop` e agli stati conferma, modifiche aperte, accesso perso. Conservato un difetto: Esc nelle impostazioni con modifiche aperte apre e richiude subito la conferma. Bundle principale gzip: 433 971 → 434 481 B.

### Fase 5: editor, anteprima, diff (branch)

- `hmd-editor`: sposta `Editor.tsx` quasi uguale; `resetKey` diventa un setter che chiama
  `view.setState(...)` solo quando cambia; `scrollToLine`/`focus` metodi pubblici; l'evento di
  cambio selezione (usato dal chip del composer) diventa `hmd-selection`. `docSession.ts`,
  `useDocBinding.ts` (`applyDocRestore`), `formatToolbar.ts` non cambiano.
- `hmd-ai-diff-pane`: ospita la `MergeView`; resta la regola "mai `setState` sull'editor posseduto
  da MergeView". Ctrl+Z su accettazioni e rifiuti invariato. Con StrictMode la `MergeView` ricreata perde il focus quando Ctrl+Z fa ricomparire il diff (visto nella fase 3, solo in sviluppo): l'elemento deve ridare il focus alla vista nuova, come fa `Editor` dalla fase 3.
- `hmd-preview`: debounce, `setSafeHTML`, cache delle immagini, `ResizeObserver`, link,
  `highlightTerms` e larghezza del testo passano dagli effetti a metodi privati chiamati dai setter
  attraverso `scheduleRender()` (un microtask). Si conserva il flag `cancelled`.
  `hmd-frontmatter-card` è separato.
- `hmd-ai-chat-log`: messaggi via `safeRender` + `setSafeHTML`, metadati al passaggio del mouse,
  immagini remote solo su clic.
- Scroll sincronizzato (`suppressUntil` 150 ms) identico; lo copre `sync-scroll.spec.ts`.

### Fase 6: pannelli e AI (branch)

- `hmd-file-tree`: `treeState.ts` + `treeNav.ts` (un solo tab stop, frecce, menu da tastiera);
  `reconcileList` per livello; `<details>` nativo; menu `popover="auto"` ancorato.
- `hmd-search-panel`: debounce 120 ms, Invio, Esc; `segments()` → `<mark>`; il campo non viene mai
  ricreato; `focusInput()` pubblico.
- `hmd-history-panel`: elenco, diff (`diffRows`), ripristino annullabile.
- AI: `hmd-ai-composer` (`composerKeys`, chip della selezione, `focus()` pubblico),
  `hmd-ai-model-chip`/`model-select` (popover, nota privacy), `hmd-ai-review-bar`
  (`reviewStatus`), `hmd-ai-review`, `hmd-ai-sidebar`.

### Fase 7: impostazioni, `hmd-workspace`, `hmd-app`, via React (branch)

1. `hmd-settings` e sezioni (generale con lingua, autosalvataggio, larghezza del testo; profili;
   preset; sync), indirizzate da `routeStore`, con conferma su Indietro/Chiudi e Ctrl+S.
2. `hmd-workspace` al posto di `WorkspaceView`: griglia (`data-mode`, colonne via `--sidebar-width`),
   resizer con pointer capture e frecce (sidebar e AI), scorciatoie via `shortcutFor` + `match`,
   listener `focus/blur/visibilitychange/beforeunload` legati al `signal`, riapertura dell'ultimo
   file, bozze orfane, creazione di `AiController`, titolo della scheda.
3. `hmd-app` al posto di `App.tsx`; `main.ts` al posto di `main.tsx`.
4. Cancellare: tutti i `.tsx`, `*.module.css`, `elements/jsx.d.ts`, gli hook React. Togliere le
   dipendenze React, `@vitejs/plugin-react` e `"jsx"` da `tsconfig.json`.
5. Aggiornare `CLAUDE.md` ("elementi sottili", "light DOM + `@scope`", "niente DOM da stringhe") e
   `README.md` (stack).

### Fase 8: rifinitura e richiesta di merge

- Bundle e tempo di avvio rispetto al baseline della fase 0 (atteso: −40 KB gzip circa per
  React/ReactDOM, + zod/mini + ts-pattern). Il baseline per misurare la rimozione di React è il bundle della fase 3, 432 419 B gzip con React 19; rispetto alla fase 0 (410 158 B, React 18) il guadagno netto atteso è di circa 22 KB in meno.
- Passata di accessibilità con l'albero di accessibilità di Chrome sulle schermate principali.
- Richiesta di approvazione del merge a Davide.

---

## 8. Cosa succede ai test

### 8.1 Test esistenti: tutti restano

Nessuno dei 67 file di test importa React. Restano **identici** tutti tranne tre controlli statici
che scansionano i sorgenti dei componenti:

| File | Destino |
|---|---|
| `workspace/*`, `fs/*`, `config/*`, `preview/*`, `search/*`, `wikilinks/*`, `editor/*`, `history/*`, `ai/*` (anche `providers`, `sync`), `pwa/*`, `lib/*`, `app/*`, `theme/*`, `i18n/i18n|locales|keys`, `ui/tree|treeNav|names|icons|logo|shortcuts` | Invariati. Quelli dei confini zod sono il contratto della riscrittura. |
| `styles/buildCss.test.ts` | **Esteso** (fase 2): `@layer` e `@scope` sopravvivono alla build. |
| **`i18n/uiText.test.ts`** | **Adattato** (fase 0). |
| **`ui/tooltips.test.ts`** | **Esteso** (fase 0). |

**`uiText.test.ts`.** Oggi scansiona solo i `.tsx`: quando spariranno passerebbe **senza controllare
nulla**. Diventa:

- file scansionati: `.tsx` rimasti + tutti i `.ts` sotto `src/elements/` e `src/dom/`, più
  `assert.ok(files.length > 0)`;
- (a) nessun testo italiano di v1 scritto a mano: invariato;
- (b) nessun `aria-label|title|placeholder|alt|data-tooltip` letterale con lettere, esteso a
  `setAttribute('…', '<letterale>')`, chiavi di oggetto in `el()`, `.placeholder = '…'`,
  `.alt = '…'`, `textContent = '<letterale con lettere>'`;
- un caso **negativo** su una stringa sintetica per ogni forma, per provare che la regex scatta.

**`tooltips.test.ts`.** Già scansiona `.ts` e `.tsx`. Si aggiungono la forma `el(…, { title: … })` e
`setAttribute('title', …)` (sempre vietate sui controlli), con casi negativi sintetici.

### 8.2 Test nuovi

| File | Cosa verifica |
|---|---|
| `dom/el.test.ts` | Figli stringa = nodi di testo (`<b>` resta testo); attributi, dataset, proprietà, listener; `undefined`/`false` non impostano attributi. |
| `dom/list.test.ts` | `reconcileList`: riusa i nodi per chiave, rimuove, inserisce, riordina; **il focus su un nodo riusato resta**. |
| `dom/element.test.ts` | `connect` una volta sola; `disconnect` interrompe i listener; `watch` si disiscrive. |
| `dom/uid.test.ts` | Id unici e con prefisso. |
| `testing/domEnv.test.ts` | Globali da una sola `window`, signal, custom element. |
| `dom/maskIcon.test.ts` | Stessa uscita di `Icon.tsx`. |
| `state/i18nStore.test.ts` | Vince l'ultima richiesta con loader fuori ordine; chunk fallito → si salva `en`; notifiche. |
| `state/themeStore.test.ts` | Ciclo `auto→light→dark`; salvataggio; `apply` dentro la transizione (finta). |
| `state/routeStore.test.ts` | Hash → rotta; guardia che blocca la navigazione con modifiche aperte; rotta sconosciuta → workspace. |
| `state/draftState.test.ts` | Bozza sporca/pulita, reset. |
| `state/prefs.schema.test.ts` | Valori corrotti (`"sidebarWidth": "abc"`, `mode: 42`, JSON rotto, `textWidth` fuori limite) → default. |
| `workspace/buffers.test.ts`, `fs/handleStore.test.ts`, `history/historyStore.test.ts`, `ai/stores.test.ts`, `ai/sync/sync.test.ts`, `ai/providers/providers.test.ts` (estesi) | Record o risposte corrotti → `null` / scartati / `AiError`, nessuna eccezione non gestita. |
| `elements/app/screens.test.ts` | Scelta e transizioni di schermata (esaustiva). |
| `elements/workspace/layout.test.ts`, `dialogFor.test.ts`, `saveIndicator.test.ts` | Colonne per modalità (4), limiti delle larghezze, ciclo delle modalità, dialog per azione/nodo, etichette di salvataggio. |
| `elements/file-tree/treeState.test.ts` | `revealPath` apre gli antenati senza chiudere altro; toggle idempotente. |
| `elements/search-panel/segments.test.ts` | Segmenti testo/evidenziato con più termini e sovrapposizioni. |
| `elements/preview/cardDate.test.ts` | Date formattate per lingua; valori non data restituiti così come sono. |
| `elements/**/*.dom.test.ts` (smoke) | Per ogni elemento: si definisce, si monta in jsdom con store finti, mostra i testi da `t()`, cambio lingua → testi aggiornati, distacco → nessun listener rimasto. |

**Ambiente DOM nei test.** `src/testing/domEnv.ts` crea un `JSDOM` e mette su `globalThis`
`window`, `document`, `HTMLElement`, `customElements`, `Node`, `CustomEvent`, `Event`,
`AbortController` e `AbortSignal` **presi dalla `window` di quel `JSDOM`** (jsdom rifiuta un
`AbortSignal` di Node in `addEventListener`). Ogni `*.dom.test.ts` lo importa **come primo import**.
`node:test` esegue ogni file in un processo separato. `npm test` è `tsx --import ./src/testing/assetHooks.ts --test`: un hook di Node per gli import `?url` delle icone e `.css` (serve Node ≥ 22.15 per `module.registerHooks`; `engines` in `package.json`).

Limiti di jsdom 30.1.1, verificati nella fase 2: mancano `moveBefore`, `showModal`/`closedBy`, Popover (`popover`, `showPopover`), `commandForElement`, `CSS.highlights`/`Highlight`, Anchor Positioning. Ci sono `customElements`, `MutationObserver`, `role`/`ariaLabel` come proprietà; `addEventListener` accetta solo l'`AbortSignal` della stessa `window` (quello di Node dà `TypeError`). jsdom, come Chromium, toglie il focus a un nodo spostato con `insertBefore`; che `moveBefore` lo conservi si verifica solo in Chromium, con gli e2e della fase 6 su albero e ricerca. Lo stub `src/testing/dialogStub.ts` imita `showModal`/`close`/`returnValue` e `command="close"`. Gli stub entrano nel test che li usa, dalla fase 4; i comportamenti reali li verifica Playwright o la checklist manuale.

### 8.3 Test statici nuovi (`architecture.test.ts`)

- nessun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` in `src/` fuori da
  `preview/sanitize.ts` (e dai test);
- nessun import di `react`/`react-dom` e nessun `.tsx` in `src/` **a partire dalla fase 7** (prima
  saltato con `{ skip }` legato all'esistenza di `src/elements/jsx.d.ts` o di `src/main.tsx`: quando
  spariscono, il test si attiva da solo);
- ogni CSS in `src/elements/<cartella>/` contiene solo blocchi `@scope` con le radici di §4.2, dentro
  `@layer components`;
- `customElements.define` solo in `elements/define.ts`;
- `showDirectoryPicker`/`requestPermission`/`queryPermission` solo in `fs/fsaOps.ts` e `fs/access.ts`;
- `showModal(` e `<dialog` solo in `src/elements/dialogs/`;
- l'identificatore `fetch`, `XMLHttpRequest`, `EventSource`, `WebSocket` e gli import di
  `@anthropic-ai/sdk` solo in `src/ai/providers/` (regola AI di `CLAUDE.md`, finora non verificata;
  al 01/10 non ci sono eccezioni).

Il controllo su `customElements.define` e quello sui CSS di `src/elements/` sono attivi dalla fase 2: passano a vuoto finché non esistono elementi, con casi sintetici che provano che scattano.

### 8.4 End-to-end con Playwright (fase 0)

**Scopo.** Fissare comportamento e aspetto dell'app React di oggi **prima** di toccarla. Le spec non
devono sapere se sotto c'è React o un custom element.

**Regole delle spec.**

- Localizzatori solo per ruolo e nome accessibile (`getByRole('button', { name: t('file.new') })`),
  mai classi CSS. Eccezioni ammesse: `.cm-content`/`.cm-scroller`/`.cm-mergeView` e i pulsanti
  `.cm-merge-revert` di CodeMirror, che restano.
- Nessun testo scritto a mano: i nomi arrivano da `en.json` tramite `translate()` (lingua forzata a
  `en` nella fixture, tranne la spec della lingua).
- `reducedMotion: 'reduce'`: cambio tema istantaneo, snapshot stabili.
- **Tempi controllati, non misurati**: dove conta un timer dell'app (autosalvataggio, debounce della
  ricerca e dell'anteprima), `page.clock`.
- **Tema prima del render**: la spec trattiene il bundle `assets/index-*.js`, verifica `data-theme` e
  `color-scheme` con `#root` vuoto, poi rilascia il modulo.

**Cartella finta.** Uno script iniettato con `addInitScript` (solo nei test, `e2e/support/fsHarness.ts`)
sostituisce `window.showDirectoryPicker` con una sottocartella dell'**OPFS**. Gli handle sono veri
`FileSystemDirectoryHandle`: `fsaOps.ts`, `handleStore` e IndexedDB girano sul codice reale. Flag in
`localStorage` (`hmd-e2e`) simulano permesso `prompt`/`denied` e scritture che falliscono con
`NotAllowedError`.

**Provider AI finto.** L'app crea da sola il profilo predefinito Ollama
(`http://localhost:11434`). `e2e/support/aiHarness.ts` risponde a quell'indirizzo con `page.route`
(elenco modelli, stream SSE con il testo deciso dalla spec), come fa oggi il `fetch` finto di
`ai-smoke.tsx`. Nessun account, nessuna API a pagamento, nessuna chiave vera. Copre ciò che oggi copre
`run-ai-smoke.mjs`: "Accept all", rifiuto per blocco, revisione che si chiude senza differenze,
Ctrl+Z dopo accettazione, voce `before-ai` nella cronologia, stesso carattere nei due lati del diff.

**Esecuzione.** `npm run test:e2e` → `playwright test -c e2e/playwright.config.ts`, contro
`vite build` + `vite preview` (porta 4173), Chromium, service worker bloccati,
`reuseExistingServer: false`. Snapshot in `e2e/__screenshots__/`, generati su Linux. `npm test` non
raccoglie le spec (suffisso `.spec.ts`, cartella `e2e/`).

**Suite in sviluppo** (`npm run test:e2e:dev`, `e2e/dev.config.ts`): le stesse spec contro `vite` in sviluppo (porta 5174), con StrictMode attivo; ogni errore o avviso in console fa fallire il test (`failOnConsole`). Restano fuori gli snapshot e il test che trattiene `assets/index-*.js`.

**Audit degli stili calcolati** (`npm run test:e2e:audit`, `e2e/audit.config.ts`): gli stessi stati sulla build di riferimento in `dist-baseline/` (porta 4174) e sulla build corrente; ogni proprietà calcolata di ogni elemento e pseudo-elemento deve coincidere. Si usa prima e dopo ogni cambio di cascata (layer, `@scope`, spostamento di fogli), finché la struttura del DOM è la stessa. Copre focus da tastiera, `forced-colors` e tooltip al passaggio, che gli snapshot non vedono. Prima di leggere gli stili ogni stato viene stabilizzato: animazioni CSS in pausa, tutti i font caricati, un ridimensionamento della finestra 799/800 e rilettura del dump finché due letture coincidono. Dalla fase 4 l'audit salta i wrapper `hmd-*` con `display: contents`.

**Copertura** (una spec per area): avvio e browser non supportato; apertura, ripresa accesso e cambio
cartella; editor con autosalvataggio e `Ctrl+S`; barra di formattazione e scorciatoie (Ctrl+B, Ctrl+I,
Ctrl+Shift+X, Ctrl+E, Ctrl+Shift+K); anteprima (markdown, wikilink, link relativi, HTML malevolo,
frontmatter, larghezza del testo); scroll sincronizzato; albero (menu, tastiera con un solo tab stop,
nuovo, rinomina, elimina, nome già esistente); ricerca (`Ctrl+K`, Invio, Esc, `CSS.highlights`);
conflitto e file eliminato fuori; accesso perso; cronologia (diff, ripristino annullabile);
impostazioni (rotte nell'hash, Indietro/Chiudi con modifiche aperte, Ctrl+S); AI (modalità, composer,
chip, revisione, come sopra); tooltip (compaiono al focus da tastiera, mai `title` nativo); tema e
lingua (anche a caldo dal selettore); titolo della scheda; snapshot visivi.

---

## 9. Checklist (per ogni fase che tocca la UI)

**Automatica** (`npm run test:e2e`): punti 1–8 e 13–16 tutto, tranne la posizione dei popover vicino
ai bordi; 9 solo ciclo e tema prima del render; 10 tutto; 11 resizer, tastiera dell'albero e focus nel
menu. Più gli snapshot visivi.

**Manuale, sempre**: selettore nativo di cartelle e prompt reale dei permessi; posizione di popover e
tooltip vicino ai bordi; transizione a pixel e `prefers-reduced-motion`; screen reader, ordine del
focus e `aria-live`; focus ring in `forced-colors`; Edge; PWA (installazione, offline, avviso di nuova
versione); AI con un provider vero (bridge Claude Code o Ollama).

Dettaglio, in Chrome ed Edge stabili, cartella di prova con sottocartelle, immagini, frontmatter,
wikilink:

1. Avvio: browser non supportato, prima apertura, ripresa accesso, cambio cartella (anche A → B → A).
2. Editor: digitazione, autosalvataggio, `Ctrl+S`, incolla e trascina immagini, autocompletamento `[[`.
3. Anteprima: debounce, link wiki/relativi/esterni, immagine mancante, frontmatter valido e non
   valido, HTML malevolo neutralizzato, larghezza massima del testo.
4. Scroll sincronizzato in split in entrambe le direzioni, senza rimbalzi.
5. Albero: espandi/chiudi, menu da pulsante ⋯ e da tastiera (niente clic destro), popover vicino ai bordi,
   nuovo/rinomina/elimina, nome già esistente, un solo tab stop.
6. Ricerca: `Ctrl+K`, risultati, Invio, Esc, evidenziazione nell'anteprima.
7. Conflitto con modifica esterna: ricarica e sovrascrivi; file eliminato fuori; bozze orfane.
8. Accesso perso: dialog non chiudibile con Esc né clic fuori; accesso negato; ripresa.
9. Tema: ciclo con transizione a pixel, `prefers-reduced-motion`, `auto` che segue il sistema,
   nessun lampo all'avvio.
10. Lingua: preferenza salvata, lingua del browser, `lang` su `<html>`, cambio a caldo dalle
    impostazioni.
11. Tastiera e screen reader: ordine del focus, focus che torna dopo i dialog, `aria-live` del
    salvataggio, resizer con le frecce, tooltip al focus.
12. PWA: installazione, offline, avviso di nuova versione.
13. Barra di formattazione sulla selezione e scorciatoie.
14. Cronologia: elenco, diff, ripristino annullabile con Ctrl+Z.
15. Impostazioni: sezioni via hash, conferma su Indietro/Chiudi, Ctrl+S, autosalvataggio e larghezze.
16. AI: modalità AI, composer (Invio/Shift+Invio), chip della selezione, modello ed effort, revisione
    (accetta tutto, rifiuto per blocco, Ctrl+Z), errori nei toast, profili/preset/sync.

---

## 10. Rischi

| # | Rischio | Probabilità / impatto | Mitigazione |
|---|---|---|---|
| R1 | **UI non aggiornata**: un campo dello stato dimenticato in `render()`. | Alta / medio | Un solo `render()` guidato da `getState()`; smoke test che cambiano lo store; checklist §9. |
| R2 | **Focus e selezione persi** ricreando nodi (ricerca, composer, albero, dialog, impostazioni). | Media / alto | `reconcileList` con chiavi; mai ricreare un sottoalbero con il focus; test sul focus. |
| R3 | **Listener non tolti**: perdite, doppi salvataggi dopo un cambio di cartella. | Media / alto | `AbortController` in `HmdElement`; test del distacco; nessun `addEventListener` senza `signal`. |
| R4 | **XSS**: costruire DOM a mano invita a `innerHTML`; la chat AI rende testo non fidato. | Bassa / critico | `el()` solo testo; test statico §8.3; `sanitize.ts` unica eccezione; chat solo via `safeRender` + `setSafeHTML`. |
| R5 | **Controlli statici che passano a vuoto** (`uiText`, `tooltips`). | Alta se ignorato / medio | Fase 0: `files.length > 0` e casi negativi sintetici. |
| R6 | **Collisioni CSS** senza hashing. | Media / basso | `@scope` con limite inferiore, `@layer`, test statico. |
| R7 | **Regressioni nella convivenza** (fasi 4–7). | Media / medio | React 19 passa proprietà ed eventi; `define.ts` prima del render; `jsx.d.ts` unico debito, cancellato e verificato. |
| R8 | **HMR**: `customElements.define` non si ripete, ricarica completa. | Certa / basso | Accettato; `define.ts` controlla `customElements.get`. |
| R9 | **`useDefineForClassFields`** oscura proprietà impostate prima dell'upgrade. | Bassa / medio | Elementi definiti prima del montaggio; input come accessor su campi privati. |
| R10 | **Tempi sottili** (scroll sincronizzato, view transition, MergeView e Ctrl+Z). | Media / medio | Logica copiata identica; spec e2e dedicate; checklist 4, 9, 16. |
| R11 | **Accessibilità**: `aria-*`, `aria-label` + `data-tooltip`, tab stop dell'albero persi. | Media / medio | Inventario per componente preso dai `.tsx` prima di cancellarli (nel PR di fase); test `tooltips`; checklist 11. |
| R12 | **Bundle**: zod pesa più del previsto. | Bassa / basso | `zod/mini`; schemi dei provider nel loro chunk; soglia misurata. |
| R13 | **Limiti di jsdom**. | Certa / basso | Stub espliciti; comportamento reale in Playwright o a mano. |
| R14 | **Tempo**: ~3 800 righe di UI, rischio di fermarsi in convivenza. | Alta / medio | Fasi 0–3 già in `main` e utili da sole; convivenza solo sul branch; ordine dalle foglie. |
| R15 | **Harness OPFS** non è il file system reale. | Certa / medio | Selettore e permessi reali nella checklist manuale; maiuscole coperte da `workspaceFS`. |
| R16 | **Snapshot instabili**. | Media / medio | Font nel bundle, animazioni ridotte, Playwright a versione esatta, `maxDiffPixelRatio` dichiarato, rigenerazione solo con approvazione. |
| R17 | **Suite e2e lenta**. | Media / basso | Accettato; filtro per file durante lo sviluppo. |
| R18 | **React 19** cambia qualcosa di sottile (StrictMode e ref callback, tipi). | Media / medio | Fase a sé con PR in `main`, coperta da e2e e snapshot prima di qualsiasi custom element; suite e2e in sviluppo con la console come cancello (fase 3). |
| R19 | **Minificatore CSS** che trasforma `@scope`/`@layer` (è già successo con `light-dark()`). | Bassa / alto | `buildCss.test.ts` con un foglio di prova `@scope` e l'ordine dei layer calcolato per prima comparsa (il minificatore riscrive la dichiarazione `@layer`), dalla fase 2. |
| R20 | **`main` che si muove** durante il branch lungo (nuove funzionalità in React). | Alta / medio | Rebase frequente; ogni funzionalità nuova va migrata nel branch prima del merge finale; e2e scritte per ruolo valgono per entrambe. |
| R21 | **Regole AI violate nella riscrittura** (chiavi in `dataset`, fetch fuori dai provider). | Bassa / critico | Test statico su `fetch`/SDK; chiavi mai negli attributi; review dedicata della fase 6. |

---

## 11. Criteri di completamento

- `package.json` senza `react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`; con
  `ts-pattern` e `zod`; senza `tests/browser/` né `test:browser`.
- Nessun `.tsx` né `*.module.css` in `src/`; `architecture.test.ts` completamente attivo.
- `npm test`: tutti i test del baseline (488 al 01/10, più quelli aggiunti in `main` nel frattempo)
  ci sono ancora (stesso nome o rinominati in modo tracciato) e passano, più i nuovi di §8.2–8.3.
- `npm run lint` e `npm run build` puliti; PWA installabile e funzionante offline.
- `npm run test:e2e` verde con gli **stessi snapshot** della fase 0 (ogni rigenerazione elencata e
  motivata).
- Merge del branch in `main` solo dopo l'approvazione esplicita di Davide.
- Checklist §9 completata in Chrome ed Edge.
- `CLAUDE.md` e `README.md` aggiornati.

## 12. Domande aperte → decisioni

1. **Un merge solo o per fase?** → In due tempi: fasi 0–3 con PR separate in `main`; fasi 4–8 con un
   solo merge dopo approvazione esplicita (rivista il 01/10).
2. **Quanto zod?** → Ridotto: file system, storage del browser, risposte JSON dei provider;
   `zod/mini`.
3. **Test in browser reale?** → Playwright, prima parte implementativa; il collaudo CDP dell'AI ci
   confluisce (01/10).
4. **Come convivono React e custom element?** → React 19 prima della convivenza, niente bridge (01/10).

## 13. Piani di implementazione

1. `docs/superpowers/plans/2026-09-27-housemd-wc-01-e2e-baseline.md`: fase 0 (fatta, PR #6).
2. Un piano e una PR per fase: `docs/superpowers/plans/2026-10-01-housemd-wc-02-fase-1-logica-pura.md`
   (fase 1, PR #7); `docs/superpowers/plans/2026-10-02-housemd-wc-03-fase-2-infrastruttura-dom.md` (fase 2);
   `docs/superpowers/plans/2026-10-04-housemd-wc-04-fase-3-react-19.md` (fase 3);
   `docs/superpowers/plans/2026-10-05-housemd-wc-05-fase-4a-infrastruttura-e-foglie.md` (fase 4a, branch `feat/web-components`);
   `docs/superpowers/plans/2026-10-05-housemd-wc-06-fase-4b-dialog.md` (fase 4b); 4c da scrivere.
3. Fasi 4–6 (elementi in convivenza).
4. Fasi 7–8 (impostazioni, workspace, via React, rifinitura, richiesta di merge).
