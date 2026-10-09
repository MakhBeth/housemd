# HouseMD Web Components — Piano 8: fase 5a, anteprima, scheda del frontmatter e chat AI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element la parte della fase 5 che rende HTML senza CodeMirror: `hmd-frontmatter-card` (era `preview/FrontmatterCard.tsx`), `hmd-preview` (era `preview/Preview.tsx`) e `hmd-ai-chat-log` (era `ui/ai/ChatLog.tsx`), senza cambiare aspetto né comportamento. Editor e diff (CodeMirror) sono la 5b, con un piano a parte.

**Architecture:** Stesso schema della 4c: classe `Hmd<Nome>` che estende `HmdElement`, host con `display: contents`, DOM interno identico a quello di React, foglio `@layer components { @scope (hmd-…) { … } }`, ingressi come proprietà JS, uscite come `CustomEvent` dichiarati in `src/elements/events.ts`. Le decisioni (che azione fa un link, quando rifare il documento, cosa mostra la scheda, che figli ha un messaggio) stanno in moduli puri testati senza DOM (`elements/preview/previewView.ts`, `elements/ai/chatLogView.ts`). Gli effetti di `Preview.tsx` diventano metodi privati chiamati da una coda in un microtask (`#schedule`), come chiede la spec; l'HTML entra solo da `setSafeHTML`.

**Tech Stack:** TypeScript 7, React 19.3 (solo nei chiamanti), Custom Elements, CSS `@scope`/`@layer`, markdown-it, DOMPurify / Sanitizer API, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§2 vincoli, §3.1 cartelle `elements/preview/` e `elements/ai/`, §4.1–4.2 radici `hmd-preview`, `hmd-frontmatter-card`, `hmd-ai-*`, §5.1–5.2, §7 fase 5, §8.2–8.4, §9 punti 3, 4, 10, 16, R1, R2, R4, R6, R10).

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza = `main` = `51e5785`, fasi 0–4c fatte). Regola del 05/10 (spec §7): a fine piano, con suite verdi, review finale pulita, `/codex-review-chat` sul diff e checklist provata in Chrome, **il controller** fa merge in `main` e push (anche del branch). Gli implementer non fanno merge.
- **Task 1 prima di tutto**: rete di sicurezza scritta e verde **sull'app React di oggi**, `dist-baseline/` ricostruita da questo branch **prima di qualsiasi modifica all'app**, conteggi dei test e gzip del bundle principale annotati. `dist-baseline/` non si ricostruisce più fino alla fine del piano.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera: un nuovo snapshot o una rigenerazione solo con approvazione di Davide); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/`.
- **Un task per elemento**, sempre TDD: test jsdom che fallisce → elemento + foglio → registrazione in `define.ts`, eventi in `events.ts`, tipi in `jsx.d.ts` → i chiamanti montano il tag → `.tsx` e `.module.css` (o le loro regole) cancellati.
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri), DOM solo con `el()`/`setText`/`toggleAttr` (mai stringhe HTML: l'unico HTML entra da `setSafeHTML` di `preview/sanitize.ts`), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso nodi che sopravvivono all'elemento con il `signal`.
- Cartelle: `src/elements/preview/` (radici `hmd-preview`, `hmd-frontmatter-card`, già ammesse da `architecture.test.ts`); `src/elements/ai/` (radice `hmd-ai-chat-log`).
- **Mai ricostruire un nodo che può avere il focus**: il contenitore scorrevole dell'anteprima (in Chromium un contenitore scorrevole senza figli focalizzabili prende il focus da tastiera), gli `article` della chat (`tabIndex = 0`) e i pulsanti della chat si creano una volta e si aggiornano; le liste con `reconcileList` per chiave. Il corpo dell'anteprima si sostituisce per intero a ogni render **come oggi** (`setSafeHTML`).
- **Nodi inseriti e tolti solo dove React li montava o smontava** (l'audit confronta il DOM per posizione): un nodo assente resta assente, non nascosto. Gli host `hmd-*` con `display: contents` l'audit li salta.
- **Lezioni della 4c**: `HmdElement.watch()` esegue subito la funzione (niente render ridondanti dopo `watch`); i setter accettano `null`/`undefined` (React 19 li passa quando una prop sparisce) e funzionano anche a elemento collegato; un handler (`focusout`, `click`…) non deve mai rientrare nel render mentre `reconcileList` sta lavorando (guardia o rinvio a un microtask); un commit del genitore che arriva in ritardo da un evento React non deve sovrascrivere un campo che l'utente sta usando (in 5a non ci sono campi, la regola resta); un e2e sospetto di instabilità si prova con `--repeat-each=5`.
- Testi solo da `t()` (store i18n); **nessuna chiave nuova**. Tooltip mai con `title` (eccezione già prevista da `tooltips.test.ts`: il `title` nativo delle immagini mancanti dell'anteprima, scritto con una variabile chiamata `img`).
- Regole AI di `CLAUDE.md`: la chat rende le risposte **solo** con `safeRender` + `setSafeHTML`, niente HTML grezzo, nessuna risorsa remota caricata; nessuna richiesta di rete dagli elementi.
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale, senza righe di attribuzione.
- Le regole e2e di `CLAUDE.md` valgono (ruolo e nome accessibile, testi da `en.json`, mai classi CSS dell'app; selettori di tag o attributo solo dove il ruolo non esiste, con un commento). Nessuna richiesta di rete vera dagli e2e.
- **Mai giudicare un comando di verifica dal suo output filtrato.**
- Verifica di ogni task che tocca l'app, **in sequenza**: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.

## Misure prese scrivendo il piano (09/10, su `51e5785`)

Baseline: `npm test` = **704** test verdi; bundle principale gzip a fine 4c = **435 469 B** (spec §7); e2e per file: `preview.spec.ts` 7, `sync-scroll.spec.ts` 4, `ai-review.spec.ts` 12, `editor.spec.ts` 8, `formatting.spec.ts` 6, `history.spec.ts` 4, `external.spec.ts` 8, `settings.spec.ts` 11 (due sulla larghezza del testo), `search.spec.ts` 3 (uno su `CSS.highlights` nell'anteprima).

### Inventario dei cinque componenti della fase 5

**`src/preview/Preview.tsx`** (193 righe, `forwardRef`)
- Props: `text`, `path`, `files: string[]`, `config: HouseConfig`, `readBlob`, `highlight: string[]`, `onTopLine`, `onOpenWiki`, `onOpenPath`, `untrusted?: UntrustedOptions`.
- Handle: `PreviewHandle.scrollToLine(line)`.
- Chiamante unico: `src/ui/WorkspaceView.tsx` (righe 517–533), con `previewRef` usato dall'`onTopLine` dell'editor in vista divisa. **Nessun chiamante passa `untrusted`** da `71bf326` («rimossa la vista affiancata»): lo stato `approved`, il ramo `[data-ai-image]` del clic, `safeRender(…, untrusted)` e le prop `blockedLabel`/`onAllowImage` della scheda sono codice morto (vedi «Decisioni»).
- Stato ed effetti: `doc` (stato con `path` + `splitFrontmatter(text)`); effetto `[text, path]`: cambio di file subito, cambio di testo dopo `PREVIEW_DEBOUNCE_MS = 150` (al montaggio parte anche un timer ridondante che rifà lo stesso documento dopo 150 ms: non si riproduce). `ImageUrlCache` per `readBlob` (stabile: `useCallback` su `workspace`), svuotata allo smontaggio. Effetto di render `[doc, files, config, cache, highlight, t, untrusted]`: `setSafeHTML(body, renderMarkdown(…))`, poi **flag `cancelled`** controllato dopo l'`await` e in ogni risoluzione d'immagine; immagini locali risolte con `resolveImageSrc` → `cache.get` → `src` blob o `missingImage` + `title` nativo; `cache.retain(usate, anche quella della scheda)`; link esterni con `target=_blank rel="noopener noreferrer"`; `highlightTerms(body, highlight)`. Un cambio di lingua (`t`) rifà il corpo.
- `ResizeObserver` sul corpo che invalida le ancore. `getAnchors()` dalle classi `hmd-l-N`. `scrollToLine`: `suppressUntil = now + 150`, poi `scrollTop = offsetForLine(…)`; `onScroll` ignora gli eventi prima di `suppressUntil`, poi `onTopLine(lineForOffset(…))`.
- Clic: `[data-ai-image]` → (approva, morto) e stop; `#wiki=` → `onOpenWiki`; `#…` ed esterni → comportamento nativo; il resto → `preventDefault`, decode, `resolveRelative`/`normalizePath`, `onOpenPath` solo se `.md`.
- Larghezza del testo: solo CSS (`--preview-text-width` messo su `:root` da `WorkspaceView`).
- CSS: `Preview.module.css` (161 righe; condiviso con `FrontmatterCard.tsx`). `.prose :global(img)` arriva anche all'immagine della scheda (`max-width`, `height`): il foglio di `hmd-preview` **non** può avere un limite inferiore su `hmd-frontmatter-card`.
- Test unitari dei moduli: `frontmatter.test`, `imageCache.test`, `render.test`, `sanitize.test`, `scrollSync.test`, `elements/preview/cardDate.test`. E2e: `preview.spec.ts` (markdown e scheda, immagini locali e mancanti con `title`, HTML ostile, link esterni, wikilink e link relativi, anteprima che segue l'editor, frontmatter non valido), `sync-scroll.spec.ts`, `search.spec.ts` (evidenziazione), `settings.spec.ts` (larghezza), `visual.spec.ts` (`workspace-*`), audit `workspace-light/dark`. **Scoperti**: debounce, cambio di lingua, campi extra e immagine della scheda, rientro nell'anteprima, classi della nota.

**`src/preview/FrontmatterCard.tsx`** (67 righe)
- Props: `frontmatter`, `resolveImage`, `blockedLabel?`, `onAllowImage?` (le ultime due solo con `untrusted`: morte). Usa `useI18n()` per `t` e `locale` (`formatCardDate`).
- Effetto `[image, resolveImage]` con flag `alive`: `imageUrl` a `null`, poi risoluzione. `resolveImage` cambia identità solo con `doc.path`, `config`, `cache`: mentre si scrive l'immagine **non** si ricarica e React riusa lo stesso `<img>` (niente lampeggio).
- Tag con `key={tag}`: tag doppi = avviso di chiavi doppie di React (l'elemento usa l'indice).
- Rami: `error` → `div.cardError[role=note]`; `data` nullo → niente; altrimenti `header.card` con `img`? `p.cardTitle`? `p.cardMeta`(`time`? + `span.tag`*)? `p.cardDescription`? `dl.cardExtra`?.

**`src/ui/ai/ChatLog.tsx`** (79 righe)
- Props: `messages`, `onOpen(path)`, `onRetry(id, removeRejected?)`. Chiamante unico: `src/ui/ai/AiSidebar.tsx` (`state.chat.messages` da `useSyncExternalStore`).
- `div.log[role=log]` > `article.message[tabIndex=0]` per messaggio (chiave `id`): pulsante del documento solo quando cambia dal messaggio prima; utente `p.user` (testo); assistente `div.assistant > div` riempito da `Markdown`: `requestAnimationFrame` → `setSafeHTML(ref, safeRender(text))`, annullato a ogni cambio di testo e allo smontaggio; testo vuoto → `ai.working` / `ai.proposalReady`; avvisi `p.notice` (riepilogo, errore, warning, in quest'ordine); `ai.retry` se `status === 'error'`; `ai.reset · ai.retry` se `error === 'paramRejected'`; `small.meta` (profilo · modello · token) per le risposte, visibile al passaggio o con `:focus-within` (solo CSS).
- `safeRender(text)` **senza opzioni**: un'immagine remota diventa `<span>alt (host)</span>`, mai caricata e mai cliccabile. La frase della spec «immagini remote solo su clic» descrive il ramo `untrusted` dell'anteprima, non la chat: la si corregge nel Task 6.
- CSS in `AiSidebar.module.css` (`.log`, `.message`, `.user`, `.assistant pre`, `.meta`, `.file`, `.notice`); `.file` lo usa anche il pulsante «riattiva sync» di `AiSidebar`, quindi resta nel modulo.
- Test: nessuno unitario. E2e: `ai-review.spec.ts` («hostile model output loads nothing remote»), audit `ai-review`, `visual.spec.ts` (`AI review`). **Scoperti**: errore e Riprova, parametro rifiutato, pulsante del documento, metadati, markdown della risposta.

**`src/editor/Editor.tsx`** (118 righe, `forwardRef`) — fase 5b
- Props `EditorProps`: `text`, `session?`, `onTransactions?`, `canChange?`, `resetKey`, `getDocs`, `onChange`, `onImage`, `onTopLine`, `onSelection?`, `restore?`, `readOnly?`. Handle: `scrollToLine` (con `suppressUntil` 150 ms), `focus`, `getView` (nessun chiamante), `replace` (nessun chiamante sull'editor semplice).
- Effetti: vista creata una volta (ref `refocus`: correzione della fase 3 per StrictMode, che distrugge e ricrea la vista dopo che il genitore le ha dato il focus); `[resetKey]` → reset della sessione + `view.setState(...)` + `onSelection` della selezione ripristinata; `[restore.seq]` → `applyDocRestore` (transazione, annullabile); `[readOnly]` → riconfigurazione.
- `callbacks` è un `RefObject<EditorProps & { t }>` letto da `docExtensions.ts`, che importa `RefObject` da React e `EditorProps` da `Editor.tsx`: va spostato in un modulo senza React prima di qualsiasi elemento CodeMirror.
- Chiamanti: `WorkspaceView` (`editorRef.scrollToLine`, presenza dell'editor per il ripristino in coda), `ReviewView` (`plain.focus`, `{...editor}`). CSS `Editor.module.css` (8 righe). Test: `docSession`, `restoreCommand`, `formatting`, `wikiCompletion`, `images`; e2e `editor`, `formatting`, `history`, `external`, `sync-scroll`, `focus-ring`, `ai-review`.

**`src/ui/ai/DiffPane.tsx`** (56 righe compatte, `forwardRef`) — fase 5b
- Props: `editor: EditorProps`, `proposal`, `range?`, `canAccept`, `streaming`, `beforeAccept()`, `onEdit`, `acceptLabel`, `rejectLabel`, `onAllRejected`. Handle `DiffHandle`: `next`, `previous`, `scrollToLine`, `replace`, `focus`, `getView`.
- `MergeView` ricreata a ogni `resetKey`; lato `a` dalla sessione (mai `setState` sull'editor posseduto da MergeView: ripristini con `applyDocRestore` su `a`); lato `b` con filtro di transazione sul tratto selezionato e flag `remote`; controlli di blocco costruiti a mano (`mousedown` di «accetta» con `beforeAccept` e focus su `a` in un microtask, così Ctrl+Z annulla; «rifiuta» rimette l'originale in `b` e dà il focus a `b`; ultimo blocco rifiutato → `onAllRejected`); proposta aggiornata senza cronologia; `canAccept`/`streaming`/`readOnly` riconfigurano e disabilitano i pulsanti.
- Chiamante: `ReviewView` (che sposta il focus tra editor semplice e diff a ogni cambio di vista). CSS in `ReviewView.module.css` (`.diff`, `.revert`, condiviso con `ReviewBar`). E2e: `ai-review.spec.ts` (12 test, Ctrl+Z su accetta/rifiuta/accetta tutto), `visual` `AI review`, audit `ai-review`.

### Divisione della fase 5

| Sotto-fase | Elementi | Perché |
|---|---|---|
| **5a (questo piano)** | `hmd-frontmatter-card`, `hmd-preview`, `hmd-ai-chat-log` | Rendono HTML sanificato senza CodeMirror né cronologia di annullamento: stessi rischi (tempi del debounce, immagini e cache, XSS, focus su nodi riusati) e stesso percorso `setSafeHTML`. Toccano solo `WorkspaceView` e `AiSidebar`. Rischio medio-basso: va prima e fissa il contratto dello scroll sincronizzato (`scrollToLine()` + evento `hmd-top-line`) che l'editor della 5b riprende. |
| **5b (piano successivo)** | `hmd-editor`, `hmd-ai-diff-pane` | Condividono `docExtensions`/`Callbacks` (da togliere da React), sessione, `resetKey`, ripristini, Ctrl+Z su accetta e rifiuta, passaggio del focus con `ReviewView`, correzione StrictMode. Rischio alto (R10): baseline e audit propri, dopo che la 5a è in `main`. |

Ordine dentro la 5a: la scheda prima (è figlia dell'anteprima e si monta già nel `Preview.tsx` di React), poi l'anteprima, poi la chat (indipendente).

### Decisioni

1. **Ramo `untrusted` dell'anteprima non portato.** Nessun chiamante dal 71bf326; `safeRender` con opzioni resta (è testato in `ai/logic.test.ts`), `PURIFY_CONFIG` e il Sanitizer continuano ad ammettere `data-ai-image`/`data-local-src`. Si conserva solo, per fedeltà, il «clic su `[data-ai-image]` non segue il link» (una riga). La chiave `ai.loadImage` resta nei locali (pulizia nella fase 8). Se Davide vuole il ramo, è un task in più (prop `untrusted`, stato `approved`, pulsante «carica immagine» nella scheda).
2. **Classi della nota contro le classi dell'anteprima.** Senza l'hash dei CSS Modules, un `<div class="prose">` scritto in una nota prenderebbe gli stili della cornice. Le regole della cornice si ancorano alla radice (`:scope > .scroller`, `:scope > .scroller > .prose`): lo prova un e2e del Task 1. Resta accettato che un `<img class="missing-image">` scritto a mano prenda il bordo tratteggiato (solo estetica, nessun effetto sul resto).

## Review Focus

1. **Scrivere e cambiare file dentro i 150 ms**: l'anteprima deve mostrare il file nuovo subito e **non** tornare mai al testo del file precedente quando scade il timer vecchio. Test jsdom nel Task 4 («a pending debounce never brings back the previous file») + e2e del Task 1 (debounce con `page.clock`).
2. **Immagini fuori tempo e rientro**: un'immagine risolta per un render superato non tocca il corpo nuovo (flag `cancelled`); uscire dall'anteprima (modalità editor) e rientrare ricarica le immagini con URL validi (cache revocata solo al distacco). Test jsdom nel Task 4 + e2e del Task 1 («leaving the preview and coming back loads the images again»).
3. **Immagine della scheda mentre si scrive**: stessa sorgente → stesso `<img>`, nessuna nuova richiesta (niente lampeggio); file o risolutore nuovo → immagine tolta e richiesta di nuovo. Test jsdom nel Task 3.
4. **Focus**: contenitore scorrevole dell'anteprima, `article` e pulsanti della chat restano gli stessi nodi tra un aggiornamento e l'altro (messaggi in streaming, Riprova, cambio di lingua). Test di identità nei Task 4 e 5.
5. **Contenuto non fidato**: il testo dell'utente nella chat resta testo (`<b>` letterale); la risposta del modello passa solo da `safeRender` + `setSafeHTML` (nessun `img`/`iframe`); le classi scritte in una nota non stilizzano la cornice dell'anteprima. Test jsdom nel Task 5 + e2e del Task 1 + `ai-review.spec.ts` esistente.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/support/aiHarness.ts`, `e2e/preview-live.spec.ts`, `e2e/ai-chat-log.spec.ts`, `e2e/computed-styles.audit.ts` | Rete di sicurezza: debounce, scheda completa, lingua, rientro, classi della nota; chat (markdown, errori, Riprova, documento, metadati); stati di audit nuovi. |
| `src/elements/preview/previewView.ts` (+ test) | `linkAction`, `isExternalHref`, `docUpdate`, `cardView`, `cardImagePath`, costanti dei tempi, tipo `ResolveImage`. |
| `src/elements/ai/chatLogView.ts` (+ test) | `chatEntries`: figli e testi di ogni messaggio. |
| `src/testing/countListeners.ts`, `src/testing/waitFor.ts` | Aiuti dei test: iscrizioni attive di uno store; attesa di una condizione (render asincroni). |
| `src/elements/preview/frontmatter-card.element.ts`, `frontmatter-card.css` (+ `.dom.test.ts`) | `hmd-frontmatter-card`. |
| `src/elements/preview/preview.element.ts`, `preview.css` (+ `.dom.test.ts`) | `hmd-preview`. |
| `src/elements/ai/chat-log.element.ts`, `chat-log.css` (+ `.dom.test.ts`) | `hmd-ai-chat-log`. |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi, tipi JSX. |
| `src/preview/Preview.tsx` (Task 3, poi cancellato), `src/ui/WorkspaceView.tsx`, `src/ui/ai/AiSidebar.tsx` | Montano i tag. |
| `src/preview/FrontmatterCard.tsx`, `Preview.tsx`, `Preview.module.css`, `src/ui/ai/ChatLog.tsx` | Cancellati. `AiSidebar.module.css` perde le regole della chat (`.file` resta). |

---

### Task 1: Baseline e rete di sicurezza sull'anteprima e sulla chat di oggi

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**.

**Files:**
- Modify: `e2e/support/aiHarness.ts` (risposte d'errore del modello finto)
- Modify: `e2e/support/app.ts` (opzione `expectedConsole`)
- Create: `e2e/preview-live.spec.ts`, `e2e/ai-chat-log.spec.ts`
- Modify: `e2e/computed-styles.audit.ts` (stati nuovi)

**Interfaces:**
- Produces: `FakeModel.status: number` (200 = risposta normale) e `FakeModel.errorBody: string` (corpo della risposta d'errore); opzione della fixture `expectedConsole: RegExp[]` (default `[]`: errori di console attesi, da usare solo con `test.use` nei test che simulano un errore HTTP del provider); stati di audit `preview-card`, `preview-frontmatter-invalid`, `ai-chat-error`, `ai-chat-summary`.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short && git log --oneline -1       # pulito, 51e5785 o il commit del piano
npm test                                          # annotare (09/10: 704)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (fine 4c: 435 469)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 5a
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla**.

- [ ] **Step 2: Modello finto che sa rispondere con un errore**

In `e2e/support/aiHarness.ts`, nella classe `FakeModel`, dopo `requests = 0;`:

```ts
  /** Stato HTTP delle risposte di chat: diverso da 200 = errore del provider, con `errorBody` come corpo. */
  status = 200;
  errorBody = '';
```

e in `#answer`, subito dopo `this.requests++;`:

```ts
    if (this.status !== 200) {
      await route.fulfill({ status: this.status, headers: cors, contentType: 'text/plain', body: this.errorBody });
      return;
    }
```

(500 → codice `server`; 400 con `temperature` nel corpo → `paramRejected`, come `httpError` in `src/ai/errors.ts`.)

Una risposta 4xx/5xx fa scrivere a Chromium in console «Failed to load resource: the server responded with a status of 500 (Internal Server Error)» come **errore**, e la suite in sviluppo (`failOnConsole: true`, `e2e/dev.config.ts`) fallirebbe. Si aggiunge un'opzione stretta, vuota per default, che scarta **solo** i messaggi indicati; tutto il resto della console resta un errore.

In `e2e/support/app.ts`, nell'interfaccia `AppOptions`, dopo `failOnConsole: boolean;`:

```ts
  /**
   * Errori di console attesi dal test (confronto sul testo, solo per i messaggi di tipo `error`). Vuoto per
   * default: si imposta con `test.use` solo nei test che simulano un errore HTTP del provider.
   */
  expectedConsole: RegExp[];
```

nella fixture, dopo `failOnConsole: [false, { option: true }],`:

```ts
  expectedConsole: [[], { option: true }],
```

e nella fixture `app`: firma `async ({ page, flags, appLocale, ai, failOnConsole, expectedConsole }, use) => {` e il listener `console` diventa:

```ts
    page.on('console', (message) => {
      if (message.type() === 'error' && expectedConsole.some((pattern) => pattern.test(message.text()))) return;
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
```

- [ ] **Step 3: E2e dell'anteprima scoperti oggi**

`e2e/preview-live.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
import { messagesFor } from './support/i18n.ts';

const PIXEL = { base64: PIXEL_PNG_BASE64 };

test('typing reaches the preview after the pause, switching file right away', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'a.md': '# Alpha', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Alpha' })).toBeVisible();
  // Da qui nessun timer dell'app scatta se non lo facciamo avanzare noi.
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('\n\n## Later');
  await page.clock.runFor(100); // meno dei 150 ms del debounce
  await expect(app.previewPane().getByRole('heading', { name: 'Later' })).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(app.previewPane().getByRole('heading', { name: 'Later' })).toBeVisible();
  // Il cambio di file non aspetta il debounce (l'orologio resta fermo).
  await app.openFile('b.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Beta' })).toBeVisible();
});

test('the frontmatter card shows its image, the description and the other fields', async ({ app }) => {
  await app.openFolder({
    'card.md': ['---', 'title: Card', 'description: A short description', 'image: assets/pixel.png', 'author: Ada', '---', 'Body text'].join('\n'),
    'assets/pixel.png': PIXEL,
  });
  await app.openFile('card.md');
  const preview = app.previewPane();
  await expect(preview.getByText('A short description', { exact: true })).toBeVisible();
  await expect(preview.getByRole('term')).toHaveText(['author']);
  await expect(preview.getByRole('definition')).toHaveText(['Ada']);
  // L'immagine della scheda ha alt="" (decorativa, nessun ruolo): la si trova dall'URL blob della cartella.
  await expect(preview.locator('img[src^="blob:"]')).toHaveCount(1);
});

test('a language change renders the preview again: card date and missing image title', async ({ app, page }) => {
  const it = (key: string, params?: Record<string, string>) => translate(messagesFor('it'), key, params);
  await app.openFolder({ 'note.md': '---\ndate: 2026-01-15\n---\n![missing](missing.png)' });
  await app.openFile('note.md');
  await expect(app.previewPane().getByText('January 15, 2026', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await page.getByRole('button', { name: it('settings.close') }).click();
  const preview = page.getByRole('region', { name: it('pane.preview') });
  await expect(preview.getByText('15 gennaio 2026', { exact: true })).toBeVisible();
  await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute('title', it('preview.imageMissing', { path: 'missing.png' }));
});

test('leaving the preview and coming back loads the images again', async ({ app }) => {
  await app.openFolder({ 'a.md': '# A\n\n![pixel](assets/pixel.png)', 'assets/pixel.png': PIXEL });
  await app.openFile('a.md');
  const pixel = app.previewPane().getByRole('img', { name: 'pixel' });
  await expect(pixel).toHaveAttribute('src', /^blob:/);
  await app.mode('mode.editor').click();
  await expect(app.previewPane()).toHaveCount(0);
  await app.mode('mode.split').click();
  await expect(pixel).toHaveAttribute('src', /^blob:/);
  // URL ancora valido: la cache revocata all'uscita non lascia un'immagine rotta.
  await expect.poll(() => pixel.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBeGreaterThan(0);
});

test("HTML in a note cannot take the preview's own classes", async ({ app }) => {
  await app.openFolder({ 'a.md': '# Title\n\n<div class="scroller">inner scroller</div>\n\n<div class="prose">inner prose</div>' });
  await app.openFile('a.md');
  const preview = app.previewPane();
  await expect(preview.getByText('inner prose', { exact: true })).toBeVisible();
  const overflow = await preview.getByText('inner scroller', { exact: true }).evaluate((node) => getComputedStyle(node).overflowY);
  const maxWidth = await preview.getByText('inner prose', { exact: true }).evaluate((node) => getComputedStyle(node).maxWidth);
  expect([overflow, maxWidth]).toEqual(['visible', 'none']);
});
```

- [ ] **Step 4: E2e della chat**

`e2e/ai-chat-log.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const log = (app: App) => app.page.getByRole('log');
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });

async function send(app: App, text = 'fix'): Promise<void> {
  await composer(app).fill(text);
  await composer(app).press('Enter');
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# Alpha\n\nText.', 'b.md': '# Beta' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
});

test('the reply is markdown, the request stays plain text', async ({ app, ai }) => {
  ai.comment = 'Some **bold** words';
  await send(app, 'keep <b>this</b> literal');
  await expect(acceptAll(app)).toBeEnabled();
  await expect(log(app).getByText('keep <b>this</b> literal', { exact: true })).toBeVisible();
  const bold = log(app).getByText('bold', { exact: true });
  await expect(bold).toBeVisible();
  expect(await bold.evaluate((node) => node.localName)).toBe('strong');
});

test.describe('provider errors', () => {
  // Solo la diagnostica di Chromium per la risposta d'errore simulata (400 o 500): ogni altro errore o avviso
  // in console continua a far fallire la suite in sviluppo.
  test.use({ expectedConsole: [/^Failed to load resource: the server responded with a status of (400|500) \(/] });

test('a failed request shows the error with Retry; Retry sends it again', async ({ app, ai }) => {
  ai.status = 500;
  await send(app);
  await expect(log(app).getByText(app.t('ai.error.server'), { exact: true })).toBeVisible();
  const retry = log(app).getByRole('button', { name: app.t('ai.retry'), exact: true });
  await expect(retry).toBeVisible();
  ai.status = 200;
  await retry.click();
  await expect(acceptAll(app)).toBeEnabled();
  expect(ai.requests).toBe(2);
});

test('a rejected parameter offers Reset · Retry next to Retry', async ({ app, ai }) => {
  ai.status = 400;
  ai.errorBody = 'temperature unsupported';
  await send(app);
  await expect(log(app).getByText(app.t('ai.error.paramRejected'), { exact: true })).toBeVisible();
  await expect(log(app).getByRole('button', { name: app.t('ai.retry'), exact: true })).toBeVisible();
  await expect(log(app).getByRole('button', { name: `${app.t('ai.reset')} · ${app.t('ai.retry')}`, exact: true })).toBeVisible();
});
});

test('the document button of a message opens that document', async ({ app }) => {
  await send(app);
  await expect(acceptAll(app)).toBeEnabled();
  await app.openFile('b.md');
  // Una volta sola: richiesta e risposta sullo stesso documento condividono il pulsante.
  const file = log(app).getByRole('button', { name: 'a.md', exact: true });
  await expect(file).toHaveCount(1);
  await file.click();
  await app.expectOpen('a.md');
});

test('reply metadata show on hover and on focus', async ({ app, page }) => {
  await send(app);
  await expect(acceptAll(app)).toBeEnabled();
  const reply = log(app).getByRole('article').last();
  // Il profilo predefinito si chiama come il suo tipo: «ollama · <modello>».
  const meta = reply.getByText(/^ollama/);
  await expect(meta).toBeHidden();
  await reply.hover();
  await expect(meta).toBeVisible();
  await page.mouse.move(1279, 799);
  await expect(meta).toBeHidden();
  await reply.focus();
  await expect(meta).toBeVisible();
});
```

Note per chi esegue:
- Se un **localizzatore** non trova l'elemento sull'app di oggi, si corregge il localizzatore (ruolo e nome da `en.json`), mai l'asserzione sul comportamento. Se il comportamento di oggi è diverso (per esempio la chat si svuota cambiando file, o un 400 non dà `paramRejected`), fermarsi e riportarlo.
- `page.clock.install()` deve stare prima di `openFolder` (come in `editor.spec.ts`): installato dopo, i timer già partiti restano veri.
- I due test di `provider errors` devono passare **anche** con `npx playwright test -c e2e/dev.config.ts e2e/ai-chat-log.spec.ts` sull'app di oggi. Se in console compare un messaggio diverso (altro testo della diagnostica, un avviso di React), **non allargare** la regex a caso: riportarlo. Per provare che il filtro è stretto, una volta a mano: togliere `test.use(...)` e vedere i due test fallire in dev con il solo messaggio «Failed to load resource … 500/400»; poi rimetterlo.
- Lo stato di audit `ai-chat-error` usa `ai.status = 500` ma l'audit non ha `failOnConsole`: lì non serve l'opzione.

- [ ] **Step 5: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, import in testa:

```ts
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';
```

e nell'array `STATES`, dopo `workspace-dark`:

```ts
  {
    name: 'preview-card',
    async setup(app) {
      await app.openFolder({
        'note.md': [
          '---', 'title: Card', 'date: 2026-01-15', 'tags: [alpha, beta]', 'description: A short description',
          'image: assets/pixel.png', 'author: Ada', '---', '# Heading', '', '![pixel](assets/pixel.png)', '',
          '![missing](missing.png)', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', '---', '', '[outside](https://example.com)',
        ].join('\n'),
        'assets/pixel.png': { base64: PIXEL_PNG_BASE64 },
      });
      await app.openFile('note.md');
      const preview = app.previewPane();
      await expect(preview.getByRole('heading', { name: 'Heading' })).toBeVisible();
      await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute('title', app.t('preview.imageMissing', { path: 'missing.png' }));
      await expect(preview.locator('img[src^="blob:"]')).toHaveCount(2);
    },
  },
  {
    name: 'preview-frontmatter-invalid',
    async setup(app) {
      await app.openFolder({ 'bad.md': '---\ntitle: [\n---\nbody' });
      await app.openFile('bad.md');
      const prefix = app.t('preview.frontmatterInvalid', { detail: '' }).trim();
      await expect(app.previewPane().getByText(prefix)).toBeVisible();
    },
  },
```

e dopo `ai-review`:

```ts
  {
    name: 'ai-chat-error',
    async setup(app, page, ai) {
      ai.status = 500;
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      const log = page.getByRole('log');
      await expect(log.getByRole('button', { name: app.t('ai.retry'), exact: true })).toBeVisible();
      // Metadati della risposta visibili con il focus sul messaggio (:focus-within).
      await log.getByRole('article').last().focus();
    },
  },
  {
    name: 'ai-chat-summary',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('group', { name: app.t('ai.suggestions') }).getByRole('button').first().click();
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      // Il riepilogo di un preset: «parti · parole → parole words».
      await expect(page.getByRole('log').getByText(new RegExp(`${app.t('ai.words')}$`))).toBeVisible();
    },
  },
```

Se la forma `setup(app, page, ai)` è diversa nel file, seguire quella di `ai-review`.

- [ ] **Step 6: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: +10 test
npx playwright test -c e2e/playwright.config.ts e2e/preview-live.spec.ts e2e/ai-chat-log.spec.ts --repeat-each=5
npx playwright test -c e2e/dev.config.ts e2e/ai-chat-log.spec.ts e2e/preview-live.spec.ts   # console pulita (errori HTTP attesi esclusi)
npm run test:e2e:dev        # annotare: +10
npm run test:e2e:audit      # annotare: +8 (due test per stato)
```

Expected: tutto verde, nessuna ripetizione instabile (le due build dell'audit sono identiche).

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete su anteprima (debounce, scheda, lingua, rientro) e chat AI prima della 5a"
```

---

### Task 2: Logica pura dell'anteprima e della chat

**Files:**
- Create: `src/elements/preview/previewView.ts`, `src/elements/preview/previewView.test.ts`
- Create: `src/elements/ai/chatLogView.ts`, `src/elements/ai/chatLogView.test.ts`

**Interfaces:**
- Produces (`previewView.ts`):
  - `PREVIEW_DEBOUNCE_MS = 150`, `SCROLL_SUPPRESS_MS = 150`
  - `type ResolveImage = (src: string) => Promise<string | null>`
  - `isExternalHref(href: string): boolean`
  - `type LinkAction = { kind: 'native' } | { kind: 'wiki'; target: string } | { kind: 'open'; path: string } | { kind: 'block' }`; `linkAction(href: string, docPath: string): LinkAction`
  - `interface PreviewDoc { path: string; split: SplitDocument }`; `docUpdate(doc: Pick<PreviewDoc, 'path'> | null, path: string, textChanged: boolean): 'now' | 'debounce' | 'keep'`
  - `type CardView = { kind: 'none' } | { kind: 'error'; detail: string } | { kind: 'card'; card: FrontmatterCardData }`; `cardView(frontmatter: Frontmatter | null): CardView`
  - `cardImagePath(split: SplitDocument, docPath: string, config: HouseConfig): string | null`
- Produces (`chatLogView.ts`):
  - `interface ChatEntry { id: string; file: string | null; role: 'user' | 'assistant'; text: string; notices: string[]; retry: string | null; reset: string | null; meta: string | null }`
  - `chatEntries(messages: readonly ChatMessage[], t: (key: string, params?: Params) => string): ChatEntry[]`

- [ ] **Step 1: Test che falliscono**

`src/elements/preview/previewView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG } from '../../config/config';
import { splitFrontmatter } from '../../preview/frontmatter';
import { cardImagePath, cardView, docUpdate, isExternalHref, linkAction } from './previewView';

test('links: wiki, native (#, schemes, //), relative markdown, everything else blocked', () => {
  assert.deepEqual(linkAction('#wiki=idea', 'note.md'), { kind: 'wiki', target: 'idea' });
  assert.deepEqual(linkAction('#wiki=brand%20new', 'note.md'), { kind: 'wiki', target: 'brand new' });
  assert.deepEqual(linkAction('#top', 'note.md'), { kind: 'native' });
  for (const href of ['https://example.com', 'mailto:a@b.c', '//cdn.test/x']) assert.deepEqual(linkAction(href, 'note.md'), { kind: 'native' });
  assert.deepEqual(linkAction('sub/other.md', 'note.md'), { kind: 'open', path: 'sub/other.md' });
  assert.deepEqual(linkAction('../up.md?x=1#h', 'dir/note.md'), { kind: 'open', path: 'up.md' });
  assert.deepEqual(linkAction('citt%C3%A0.md', 'note.md'), { kind: 'open', path: 'città.md' });
  assert.deepEqual(linkAction('/root/a.md', 'dir/note.md'), { kind: 'open', path: 'root/a.md' });
  // Una sequenza % non valida resta com'è (come il try/catch di Preview.tsx).
  assert.deepEqual(linkAction('%E0%A4%A.md', 'note.md'), { kind: 'open', path: '%E0%A4%A.md' });
  assert.deepEqual(linkAction('image.png', 'note.md'), { kind: 'block' });
  assert.deepEqual(linkAction('', 'note.md'), { kind: 'block' });
});

test('external hrefs: a scheme or a protocol-relative host', () => {
  assert.deepEqual(['https://x', 'mailto:a', '//h/x', 'x.md', '#a', '/abs.md'].map(isExternalHref), [true, true, true, false, false, false]);
});

test('document update: right away on the first render or a new path, debounced on a text change', () => {
  assert.equal(docUpdate(null, 'a.md', false), 'now');
  assert.equal(docUpdate({ path: 'a.md' }, 'b.md', true), 'now');
  assert.equal(docUpdate({ path: 'a.md' }, 'a.md', true), 'debounce');
  assert.equal(docUpdate({ path: 'a.md' }, 'a.md', false), 'keep');
});

test('card view: none, error, or the card data (an empty frontmatter is an empty card)', () => {
  const fm = (yaml: string) => splitFrontmatter(`---\n${yaml}\n---\nbody`).frontmatter;
  assert.deepEqual(cardView(null), { kind: 'none' });
  const broken = cardView(fm('title: ['));
  assert.equal(broken.kind, 'error');
  assert.ok(broken.kind === 'error' && broken.detail.length > 0);
  assert.deepEqual(cardView(fm('')), { kind: 'card', card: { title: null, date: null, description: null, image: null, tags: [], extra: [] } });
  const card = cardView(fm('title: T\nauthor: Ada'));
  assert.ok(card.kind === 'card' && card.card.title === 'T');
  assert.deepEqual(card.kind === 'card' && card.card.extra, [['author', 'Ada']]);
});

test('card image path: resolved like the body images, null for remote or missing', () => {
  const split = (yaml: string) => splitFrontmatter(`---\n${yaml}\n---\nbody`);
  assert.equal(cardImagePath(split('image: pic.png'), 'dir/note.md', DEFAULT_CONFIG), 'dir/pic.png');
  assert.equal(cardImagePath(split('image: https://example.com/a.png'), 'note.md', DEFAULT_CONFIG), null);
  assert.equal(cardImagePath(split('title: T'), 'note.md', DEFAULT_CONFIG), null);
  assert.equal(cardImagePath(splitFrontmatter('no frontmatter'), 'note.md', DEFAULT_CONFIG), null);
});
```

`src/elements/ai/chatLogView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage } from '../../ai/types';
import { translate, type Params } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { chatEntries } from './chatLogView';

const t = (key: string, params?: Params) => translate(EN_MESSAGES, key, params);
const msg = (patch: Partial<ChatMessage>): ChatMessage => ({ id: 'm', role: 'assistant', text: '', docPath: null, status: 'done', ...patch });

test('the document button shows only when the document changes from the message before', () => {
  const entries = chatEntries(
    [msg({ id: '1', role: 'user', docPath: 'a.md' }), msg({ id: '2', docPath: 'a.md' }), msg({ id: '3', role: 'user', docPath: 'b.md' }), msg({ id: '4', docPath: null })],
    t,
  );
  assert.deepEqual(entries.map((e) => e.file), ['a.md', null, 'b.md', null]);
});

test('user text stays as typed; an empty reply says working or ready', () => {
  const [user, streaming, done, filled] = chatEntries(
    [msg({ id: '1', role: 'user', text: '<b>x</b>' }), msg({ id: '2', status: 'streaming' }), msg({ id: '3', status: 'done' }), msg({ id: '4', text: '**ok**', status: 'streaming' })],
    t,
  );
  assert.deepEqual([user.role, user.text, user.meta], ['user', '<b>x</b>', null]);
  assert.equal(streaming.text, EN_MESSAGES['ai.working']);
  assert.equal(done.text, EN_MESSAGES['ai.proposalReady']);
  assert.equal(filled.text, '**ok**');
});

test('notices in order (summary, error, warnings); Retry on errors, Reset · Retry on a rejected parameter', () => {
  const [entry] = chatEntries(
    [msg({ status: 'error', error: 'paramRejected', summary: { parts: 2, originalWords: 10, proposalWords: 12 }, warnings: [{ code: 'code' }, { code: 'urls' }] })],
    t,
  );
  assert.deepEqual(entry.notices, [
    `2 · 10 → 12 ${EN_MESSAGES['ai.words']}`,
    EN_MESSAGES['ai.error.paramRejected'],
    EN_MESSAGES['ai.warning.code'],
    EN_MESSAGES['ai.warning.urls'],
  ]);
  assert.equal(entry.retry, EN_MESSAGES['ai.retry']);
  assert.equal(entry.reset, `${EN_MESSAGES['ai.reset']} · ${EN_MESSAGES['ai.retry']}`);
  const [ok] = chatEntries([msg({ status: 'done' })], t);
  assert.deepEqual([ok.notices, ok.retry, ok.reset], [[], null, null]);
  // Un errore senza status 'error' (richiesta interrotta) non offre Riprova.
  const [aborted] = chatEntries([msg({ status: 'aborted', error: 'aborted' })], t);
  assert.equal(aborted.retry, null);
});

test('reply metadata: profile, model and tokens, skipping what is missing (empty string when nothing)', () => {
  const metas = chatEntries(
    [
      msg({ id: '1', profileName: 'ollama', model: 'qwen', usage: { inputTokens: 12, outputTokens: 34 } }),
      msg({ id: '2', profileName: 'ollama', usage: { inputTokens: 5 } }),
      msg({ id: '3', model: 'qwen', usage: { outputTokens: 9 } }),
      msg({ id: '4' }),
    ],
    t,
  ).map((e) => e.meta);
  assert.deepEqual(metas, ['ollama · qwen · 12 → 34', 'ollama · 5 → 0', 'qwen', '']);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/preview/previewView.test.ts src/elements/ai/chatLogView.test.ts`
Expected: FAIL, moduli mancanti.

- [ ] **Step 3: Implementazione**

`src/elements/preview/previewView.ts`:

```ts
import type { HouseConfig } from '../../config/config';
import { resolveImageSrc } from '../../config/images';
import { isMarkdown, normalizePath, resolveRelative } from '../../lib/paths';
import { toCard, type Frontmatter, type FrontmatterCardData, type SplitDocument } from '../../preview/frontmatter';
import { wikiTargetOfHref } from '../../preview/render';

/** Pausa tra l'ultima modifica del testo e il render dell'anteprima (era PREVIEW_DEBOUNCE_MS di Preview.tsx). */
export const PREVIEW_DEBOUNCE_MS = 150;
/** Dopo uno scroll comandato dall'altro pannello, per questo tempo lo scroll non torna indietro (niente rimbalzi). */
export const SCROLL_SUPPRESS_MS = 150;

/** Risolve la sorgente di un'immagine in un URL da mostrare (blob della cartella o remoto), null se manca. */
export type ResolveImage = (src: string) => Promise<string | null>;

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Link con schema (`https:`, `mailto:`…) o `//host`: lo apre il browser, in una scheda nuova. */
export function isExternalHref(href: string): boolean {
  return EXTERNAL.test(href);
}

export type LinkAction = { kind: 'native' } | { kind: 'wiki'; target: string } | { kind: 'open'; path: string } | { kind: 'block' };

/** Cosa fa un clic su un link dell'anteprima (era onClick di Preview.tsx). `block` = niente, ma senza navigare. */
export function linkAction(href: string, docPath: string): LinkAction {
  const wiki = wikiTargetOfHref(href);
  if (wiki !== null) return { kind: 'wiki', target: wiki };
  if (href.startsWith('#') || isExternalHref(href)) return { kind: 'native' };
  let clean = href.replace(/[?#].*$/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // lascia il link così com'è
  }
  const target = clean.startsWith('/') ? normalizePath(clean) : resolveRelative(docPath, clean);
  return isMarkdown(target) ? { kind: 'open', path: target } : { kind: 'block' };
}

/** Documento mostrato dall'anteprima: cambia subito con il file, con il debounce con il testo. */
export interface PreviewDoc {
  path: string;
  split: SplitDocument;
}

/** Quando rifare il documento mostrato (era l'effetto [text, path] di Preview.tsx). */
export function docUpdate(doc: Pick<PreviewDoc, 'path'> | null, path: string, textChanged: boolean): 'now' | 'debounce' | 'keep' {
  if (!doc || doc.path !== path) return 'now';
  return textChanged ? 'debounce' : 'keep';
}

export type CardView = { kind: 'none' } | { kind: 'error'; detail: string } | { kind: 'card'; card: FrontmatterCardData };

/** Cosa mostra la scheda del frontmatter (era il ramo iniziale di FrontmatterCard.tsx). */
export function cardView(frontmatter: Frontmatter | null): CardView {
  if (!frontmatter) return { kind: 'none' };
  if (frontmatter.error) return { kind: 'error', detail: frontmatter.error };
  if (!frontmatter.data) return { kind: 'none' };
  return { kind: 'card', card: toCard(frontmatter.data) };
}

/** Percorso nella cartella dell'immagine della scheda: va tenuto nella cache delle immagini usate. */
export function cardImagePath(split: SplitDocument, docPath: string, config: HouseConfig): string | null {
  const image = split.frontmatter?.data ? toCard(split.frontmatter.data).image : null;
  return image ? resolveImageSrc(image, docPath, config) : null;
}
```

`src/elements/ai/chatLogView.ts`:

```ts
import type { ChatMessage } from '../../ai/types';
import type { Params } from '../../i18n/i18n';

type Translate = (key: string, params?: Params) => string;

/** Un messaggio della chat come lo mostra hmd-ai-chat-log, nell'ordine dei figli di ChatLog.tsx. */
export interface ChatEntry {
  id: string;
  /** Pulsante del documento: solo quando il documento cambia rispetto al messaggio prima. */
  file: string | null;
  role: 'user' | 'assistant';
  /** Utente: testo semplice. Assistente: markdown da rendere con safeRender (mai HTML grezzo). */
  text: string;
  /** Riepilogo del preset, errore, avvisi dei controlli, in quest'ordine. */
  notices: string[];
  /** Etichetta di «Riprova» (richiesta fallita), null se il pulsante non c'è. */
  retry: string | null;
  /** Etichetta di «Reimposta · Riprova» (parametro rifiutato), null se il pulsante non c'è. */
  reset: string | null;
  /** Profilo · modello · token, solo per le risposte (anche vuoto); null per l'utente. */
  meta: string | null;
}

export function chatEntries(messages: readonly ChatMessage[], t: Translate): ChatEntry[] {
  return messages.map((m, i) => ({
    id: m.id,
    file: m.docPath && m.docPath !== messages[i - 1]?.docPath ? m.docPath : null,
    role: m.role,
    text: m.role === 'user' ? m.text : m.text || t(m.status === 'done' ? 'ai.proposalReady' : 'ai.working'),
    notices: [
      ...(m.summary ? [`${m.summary.parts} · ${m.summary.originalWords} → ${m.summary.proposalWords} ${t('ai.words')}`] : []),
      ...(m.error ? [t(`ai.error.${m.error}`)] : []),
      ...(m.warnings ?? []).map((w) => t(`ai.warning.${w.code}`)),
    ],
    retry: m.status === 'error' ? t('ai.retry') : null,
    reset: m.error === 'paramRejected' ? `${t('ai.reset')} · ${t('ai.retry')}` : null,
    meta:
      m.role === 'assistant'
        ? [m.profileName, m.model, m.usage?.inputTokens !== undefined ? `${m.usage.inputTokens} → ${m.usage.outputTokens ?? 0}` : ''].filter(Boolean).join(' · ')
        : null,
  }));
}
```

- [ ] **Step 4: Passano, poi tutto**

Run: i due file di test, poi `npm test` e `npm run lint`.
Expected: PASS; `npm test` = 704 + 9.

- [ ] **Step 5: Commit**

```bash
git add src/elements/preview/previewView.ts src/elements/preview/previewView.test.ts src/elements/ai/chatLogView.ts src/elements/ai/chatLogView.test.ts
git commit -m "feat: logica pura dell'anteprima (link, debounce, scheda) e dei messaggi della chat"
```

---

### Task 3: `hmd-frontmatter-card`

**Files:**
- Create: `src/elements/preview/frontmatter-card.element.ts`, `frontmatter-card.css`, `frontmatter-card.dom.test.ts`
- Create: `src/testing/countListeners.ts`
- Modify: `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/preview/Preview.tsx`, `src/preview/Preview.module.css`
- Delete: `src/preview/FrontmatterCard.tsx`

**Interfaces:**
- Consumes: `cardView`, `ResolveImage` (Task 2); `formatCardDate` da `src/elements/preview/cardDate.ts`.
- Produces:
  - `countListeners<S extends Subscribable>(store: S): { store: S; listeners: () => number }` da `src/testing/countListeners.ts`
  - `HmdFrontmatterCard` con proprietà `frontmatter: Frontmatter | null`, `resolveImage: ResolveImage | null`, `i18n: I18nStore | null`; nessun evento. Render in un microtask (i setter arrivano a raffica da React e da `hmd-preview`).

- [ ] **Step 1: Aiuto dei test**

`src/testing/countListeners.ts`:

```ts
import type { Subscribable } from '../dom/element';

/**
 * Avvolge uno store e conta le iscrizioni attive: dopo il distacco di un elemento devono essere zero.
 * Copia le proprietà proprie dello store: va bene per gli store fatti di closure (i18nStore), non per le classi.
 */
export function countListeners<S extends Subscribable>(store: S): { store: S; listeners: () => number } {
  let active = 0;
  const wrapped = {
    ...store,
    subscribe(listener: () => void): () => void {
      active++;
      const off = store.subscribe(listener);
      return () => {
        active--;
        off();
      };
    },
  };
  return { store: wrapped, listeners: () => active };
}
```

- [ ] **Step 2: Test che falliscono**

`src/elements/preview/frontmatter-card.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { splitFrontmatter, type Frontmatter } from '../../preview/frontmatter';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { ResolveImage } from './previewView';

const t = (key: string, params?: Record<string, string>) => translate(EN_MESSAGES, key, params);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const fm = (yaml: string): Frontmatter => splitFrontmatter(`---\n${yaml}\n---\n`).frontmatter!;

/** Risolutore finto: registra le richieste e risponde quando lo dice il test. */
function resolver() {
  const calls: string[] = [];
  const pending = new Map<string, (url: string | null) => void>();
  const resolve: ResolveImage = (src) => {
    calls.push(src);
    return new Promise((done) => pending.set(src, done));
  };
  return { resolve, calls, answer: (src: string, url: string | null) => pending.get(src)!(url) };
}

function mount(frontmatter: Frontmatter | null, resolveImage: ResolveImage = resolver().resolve) {
  const counted = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'preview.frontmatterInvalid': 'NON VALIDO {detail}' } }), persist() {} }),
  );
  const el = document.createElement('hmd-frontmatter-card');
  el.frontmatter = frontmatter;
  el.resolveImage = resolveImage;
  el.i18n = counted.store;
  document.body.append(el);
  return { el, i18n: counted.store, listeners: counted.listeners };
}

test('nothing without frontmatter; an empty frontmatter is an empty card', async () => {
  const none = mount(null);
  await tick();
  assert.equal(none.el.childElementCount, 0);
  none.el.remove();
  const empty = mount(fm(''));
  await tick();
  assert.deepEqual([...empty.el.children].map((c) => [c.localName, c.className, c.childElementCount]), [['header', 'card', 0]]);
  empty.el.remove();
});

test('invalid YAML: a note with the error, no card', async () => {
  const frontmatter = fm('title: [');
  const { el } = mount(frontmatter);
  await tick();
  const note = el.firstElementChild!;
  assert.deepEqual([note.localName, note.className, note.getAttribute('role')], ['div', 'card-error', 'note']);
  assert.equal(note.textContent, t('preview.frontmatterInvalid', { detail: frontmatter.error! }));
  assert.equal(el.childElementCount, 1);
  el.remove();
});

test('the same tree as FrontmatterCard.tsx: title, meta (date and tags), description, extra fields', async () => {
  const { el } = mount(fm('title: Hello\ndate: 2026-01-15\ntags: [alpha, beta]\ndescription: Short\nauthor: Ada\nimage: pic.png'));
  await tick();
  const header = el.firstElementChild!;
  assert.deepEqual([header.localName, header.className], ['header', 'card']);
  // L'immagine non è ancora arrivata: nessun <img>.
  assert.deepEqual([...header.children].map((c) => [c.localName, c.className]), [
    ['p', 'card-title'], ['p', 'card-meta'], ['p', 'card-description'], ['dl', 'card-extra'],
  ]);
  const meta = header.children[1];
  assert.deepEqual([...meta.children].map((c) => [c.localName, c.className, c.textContent]), [
    ['time', '', 'January 15, 2026'], ['span', 'tag', 'alpha'], ['span', 'tag', 'beta'],
  ]);
  assert.equal(meta.firstElementChild!.getAttribute('datetime'), '2026-01-15');
  assert.deepEqual([...header.querySelectorAll('dl > div')].map((row) => [...row.children].map((c) => [c.localName, c.textContent])), [
    [['dt', 'author'], ['dd', 'Ada']],
  ]);
  el.remove();
});

test('the image comes first once resolved; the same image on a new frontmatter keeps the node and is not asked again', async () => {
  const r = resolver();
  const { el } = mount(fm('title: T\nimage: pic.png'), r.resolve);
  await tick();
  r.answer('pic.png', 'blob:pic');
  await tick();
  const img = el.querySelector('header')!.firstElementChild as HTMLImageElement;
  assert.deepEqual([img.localName, img.className, img.getAttribute('src'), img.getAttribute('alt')], ['img', 'card-image', 'blob:pic', '']);
  // Mentre si scrive l'anteprima passa un frontmatter nuovo a ogni debounce: niente lampeggio.
  el.frontmatter = fm('title: T2\nimage: pic.png');
  await tick();
  assert.equal(el.querySelector('img'), img);
  assert.deepEqual(r.calls, ['pic.png']);
  // Risolutore nuovo (altro file, altra configurazione): immagine tolta finché non arriva di nuovo.
  const r2 = resolver();
  el.resolveImage = r2.resolve;
  await tick();
  assert.equal(el.querySelector('img'), null);
  assert.deepEqual(r2.calls, ['pic.png']);
  el.remove();
});

test('a late answer for an image no longer shown is ignored', async () => {
  const r = resolver();
  const { el } = mount(fm('image: a.png'), r.resolve);
  await tick();
  el.frontmatter = fm('image: b.png');
  await tick();
  r.answer('a.png', 'blob:a');
  await tick();
  assert.equal(el.querySelector('img'), null);
  r.answer('b.png', 'blob:b');
  await tick();
  assert.equal(el.querySelector('img')!.getAttribute('src'), 'blob:b');
  el.remove();
});

test('duplicate tags are shown twice (no key error)', async () => {
  const { el } = mount(fm('tags: [a, a]'));
  await tick();
  assert.deepEqual([...el.querySelectorAll('.tag')].map((s) => s.textContent), ['a', 'a']);
  el.remove();
});

test('a language change reformats the date and the error in place', async () => {
  const { el, i18n } = mount(fm('date: 2026-01-15'));
  await tick();
  const time = el.querySelector('time')!;
  await i18n.setLocale('it');
  await tick();
  assert.equal(el.querySelector('time'), time);
  assert.equal(time.textContent, '15 gennaio 2026');
  el.frontmatter = fm('title: [');
  await tick();
  assert.match(el.firstElementChild!.textContent!, /^NON VALIDO /);
  el.remove();
});

test('detached: no listener left, a pending image is dropped and asked again on return', async () => {
  const r = resolver();
  const { el, listeners } = mount(fm('image: a.png'), r.resolve);
  await tick();
  el.remove();
  assert.equal(listeners(), 0);
  r.answer('a.png', 'blob:a');
  await tick();
  assert.equal(el.querySelector('img'), null);
  document.body.append(el);
  await tick();
  assert.deepEqual(r.calls, ['a.png', 'a.png']);
  el.remove();
});
```

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/preview/frontmatter-card.dom.test.ts`
Expected: FAIL (tag non definito).

- [ ] **Step 4: Elemento, foglio, registrazione**

`src/elements/preview/frontmatter-card.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { Frontmatter } from '../../preview/frontmatter';
import type { I18nStore } from '../../state/i18nStore';
import { formatCardDate } from './cardDate';
import { cardView, type ResolveImage } from './previewView';
import './frontmatter-card.css';

type CardPart = 'image' | 'title' | 'meta' | 'description' | 'extra';
type MetaItem = { key: string; tag: string | null };

/**
 * Scheda del frontmatter in cima all'anteprima (era FrontmatterCard.tsx). Nodi creati una volta e
 * riusati: l'anteprima passa un frontmatter nuovo a ogni debounce, e l'<img> non deve lampeggiare.
 * Render in un microtask: frontmatter e risolutore arrivano uno dopo l'altro.
 */
export class HmdFrontmatterCard extends HmdElement {
  #frontmatter: Frontmatter | null = null;
  #resolveImage: ResolveImage | null = null;
  #i18n: I18nStore | null = null;
  #signal: AbortSignal | null = null;
  #scheduled = false;
  /** Immagine chiesta (sorgente + risolutore), URL arrivato, token che scarta le risposte superate. */
  #image: { src: string | null; resolve: ResolveImage | null } | null = null;
  #imageUrl: string | null = null;
  #imageToken = 0;
  #parts: {
    error: HTMLDivElement;
    header: HTMLElement;
    image: HTMLImageElement;
    title: HTMLParagraphElement;
    meta: HTMLParagraphElement;
    time: HTMLTimeElement;
    description: HTMLParagraphElement;
    extra: HTMLDListElement;
  } | null = null;

  get frontmatter(): Frontmatter | null { return this.#frontmatter; }
  set frontmatter(value: Frontmatter | null) { this.#frontmatter = value ?? null; this.#schedule(); }
  get resolveImage(): ResolveImage | null { return this.#resolveImage; }
  set resolveImage(value: ResolveImage | null) { this.#resolveImage = value ?? null; this.#schedule(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#parts ??= {
      error: el('div', { class: 'card-error', role: 'note' }),
      header: el('header', { class: 'card' }),
      image: el('img', { class: 'card-image', alt: '' }),
      title: el('p', { class: 'card-title' }),
      meta: el('p', { class: 'card-meta' }),
      time: el('time'),
      description: el('p', { class: 'card-description' }),
      extra: el('dl', { class: 'card-extra' }),
    };
    this.#signal = signal;
    if (this.#i18n) this.watch(this.#i18n, () => this.#schedule(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Come lo smontaggio di FrontmatterCard.tsx: la risposta in volo non conta più, al rientro si richiede.
    this.#imageToken++;
    this.#image = null;
    this.#imageUrl = null;
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#render();
    });
  }

  #loadImage(src: string | null): void {
    const resolve = this.#resolveImage;
    if (this.#image && this.#image.src === src && this.#image.resolve === resolve) return;
    this.#image = { src, resolve };
    this.#imageUrl = null;
    const token = ++this.#imageToken;
    if (!src || !resolve) return;
    void resolve(src).then((url) => {
      if (token !== this.#imageToken) return;
      this.#imageUrl = url;
      this.#schedule();
    });
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n || !this.#signal || this.#signal.aborted) return;
    const view = cardView(this.#frontmatter);
    this.#loadImage(view.kind === 'card' ? view.card.image : null);
    const top = view.kind === 'error' ? ['error'] : view.kind === 'card' ? ['header'] : [];
    reconcileList(this, top, (k) => k, (k) => (k === 'error' ? parts.error : parts.header));
    if (view.kind === 'error') {
      setText(parts.error, i18n.t('preview.frontmatterInvalid', { detail: view.detail }));
      return;
    }
    if (view.kind !== 'card') return;
    const { card } = view;
    // Figli montati come in React: nodo assente, non nascosto.
    const keys: CardPart[] = [
      ...(this.#imageUrl ? (['image'] as const) : []),
      ...(card.title ? (['title'] as const) : []),
      ...(card.date || card.tags.length > 0 ? (['meta'] as const) : []),
      ...(card.description ? (['description'] as const) : []),
      ...(card.extra.length > 0 ? (['extra'] as const) : []),
    ];
    reconcileList(parts.header, keys, (k) => k, (k) => parts[k]);
    if (this.#imageUrl && parts.image.getAttribute('src') !== this.#imageUrl) parts.image.src = this.#imageUrl;
    if (card.title) setText(parts.title, card.title);
    const metaItems: MetaItem[] = [
      ...(card.date ? [{ key: 'time', tag: null }] : []),
      // Per indice: i tag possono ripetersi.
      ...card.tags.map((tag, i) => ({ key: `tag:${i}`, tag })),
    ];
    reconcileList(
      parts.meta,
      metaItems,
      (item) => item.key,
      (item): HTMLElement => (item.tag === null ? parts.time : el('span', { class: 'tag' })),
      (node, item) => {
        if (item.tag !== null) setText(node, item.tag);
      },
    );
    if (card.date) {
      toggleAttr(parts.time, 'datetime', true, card.date);
      setText(parts.time, formatCardDate(card.date, i18n.getState().locale));
    }
    if (card.description) setText(parts.description, card.description);
    reconcileList(
      parts.extra,
      card.extra,
      ([key]) => key,
      () => el('div', null, el('dt'), el('dd')),
      (row, [key, value]) => {
        setText(row.children[0], key);
        setText(row.children[1], value);
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-frontmatter-card': HmdFrontmatterCard;
  }
}
```

(Se tsc non accetta `parts[k]` come tipo di ritorno di `create`, annotare `(k): HTMLElement => parts[k]`.)

`src/elements/preview/frontmatter-card.css` (valori copiati da `Preview.module.css`, righe 98–161, classi in kebab-case):

```css
@layer components {
  @scope (hmd-frontmatter-card) {
    :scope {
      display: contents;
    }

    .card {
      font-family: var(--font-ui);
      border: 1px solid var(--c-border);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 28px;
      background: var(--c-bg);
    }

    .card-image {
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 1.25em;
      font-weight: 700;
      margin: 0 0 6px;
    }

    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: var(--c-muted);
      font-size: 0.85em;
      margin: 0 0 8px;
    }

    .tag {
      background: var(--c-accent-soft);
      color: var(--c-text);
      border-radius: 999px;
      padding: 1px 10px;
    }

    .card-description {
      margin: 0;
      color: var(--c-muted);
    }

    .card-extra {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px 12px;
      margin: 12px 0 0;
      font-size: 0.85em;
    }

    .card-extra div {
      display: contents;
    }

    .card-extra dt {
      color: var(--c-muted);
    }

    .card-extra dd {
      margin: 0;
      font-family: var(--font-mono);
    }

    .card-error {
      font-family: var(--font-ui);
      background: var(--c-warning-bg);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 24px;
    }
  }
}
```

Nota sulla cascata: oggi `.prose :global(img)` (non a layer) e `.cardImage` hanno in comune solo `border-radius: 6px`; dopo, con `.prose img` nel layer (Task 4) e la vicinanza di `@scope` che dà la precedenza alla scheda, il valore è lo stesso. `max-width: 100%` e `height: auto` continuano ad arrivare da `.prose img`. Lo verifica l'audit `preview-card`.

`src/elements/define.ts`: import di `HmdFrontmatterCard` da `./preview/frontmatter-card.element` e riga `['hmd-frontmatter-card', HmdFrontmatterCard],` dopo `hmd-conflict-bar`.

`src/elements/jsx.d.ts`: import `type { Frontmatter } from '../preview/frontmatter'` e `type { ResolveImage } from './preview/previewView'`; in `IntrinsicElements`, dopo `hmd-conflict-bar`:

```ts
      'hmd-frontmatter-card': HmdProps<{ frontmatter: Frontmatter; resolveImage: ResolveImage; i18n: I18nStore }>;
```

- [ ] **Step 5: `Preview.tsx` monta il tag**

In `src/preview/Preview.tsx`:
- togliere `import { FrontmatterCard } from './FrontmatterCard';` e `resourceHost` dall'import di `../ai/safeRender` (non più usato);
- `useT` → `useI18nStore, useT` nell'import di `../i18n/I18nProvider`; nel corpo, dopo `const t = useT();`: `const i18nStore = useI18nStore();`;
- la riga della scheda diventa:

```tsx
        {doc.split.frontmatter && <hmd-frontmatter-card frontmatter={doc.split.frontmatter} resolveImage={resolveImage} i18n={i18nStore} />}
```

(`blockedLabel`/`onAllowImage` spariscono: esistevano solo con `untrusted`, che nessuno passa. Il resto del ramo `untrusted` lo toglie il Task 4 insieme al file.)

In `src/preview/Preview.module.css` cancellare le regole da `.card` a `.cardError` comprese (righe 98–161): restano la cornice, `.prose …` e `.missingImage`.

`git rm src/preview/FrontmatterCard.tsx`.

- [ ] **Step 6: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/preview/frontmatter-card.dom.test.ts   # 8 pass
npm test
npm run lint
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit       # workspace-*, preview-card, preview-frontmatter-invalid uguali alla baseline
```

Se l'audit trova differenze, **non toccare i test**: confrontare il CSS con il modulo originale e correggere il CSS.

- [ ] **Step 7: Commit**

```bash
git add -A src/elements/preview src/elements/define.ts src/elements/jsx.d.ts src/testing/countListeners.ts src/preview
git commit -m "feat: hmd-frontmatter-card al posto di FrontmatterCard"
```

---

### Task 4: `hmd-preview`

**Files:**
- Create: `src/elements/preview/preview.element.ts`, `preview.css`, `preview.dom.test.ts`
- Create: `src/testing/waitFor.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/preview/Preview.tsx`, `src/preview/Preview.module.css`

**Interfaces:**
- Consumes: `PREVIEW_DEBOUNCE_MS`, `SCROLL_SUPPRESS_MS`, `ResolveImage`, `PreviewDoc`, `docUpdate`, `linkAction`, `isExternalHref`, `cardImagePath` (Task 2); `HmdFrontmatterCard`, `countListeners` (Task 3).
- Produces:
  - `waitFor(check: () => boolean, ms?: number): Promise<void>` da `src/testing/waitFor.ts`
  - `HmdPreview` con proprietà `text: string`, `path: string`, `files: string[]`, `config: HouseConfig | null`, `readBlob: ((path: string) => Promise<Blob>) | null`, `highlight: string[]`, `i18n: I18nStore | null`; metodo `scrollToLine(line: number): void`; eventi `hmd-open` (`CustomEvent<{ path: string }>`), `hmd-open-wiki` (`CustomEvent<{ target: string }>`), `hmd-top-line` (`CustomEvent<{ line: number }>`, riusato dall'editor nella 5b).

- [ ] **Step 1: Aiuto dei test**

`src/testing/waitFor.ts`:

```ts
/** Aspetta che `check` diventi vera (render asincroni: setSafeHTML, immagini, debounce); errore dopo `ms`. */
export async function waitFor(check: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor: la condizione non è mai diventata vera');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
```

- [ ] **Step 2: Test che falliscono**

`src/elements/preview/preview.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { DEFAULT_CONFIG } from '../../config/config';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { waitFor } from '../../testing/waitFor';

// jsdom non ha ResizeObserver: basta che esista (le ancore si rifanno comunque a ogni render).
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });

const t = (key: string, params?: Record<string, string>) => translate(EN_MESSAGES, key, params);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cartella finta: i file elencati esistono, gli altri mancano; `slow` aspetta `release` prima di rispondere. */
function folder(present: Record<string, string>, slow?: { path: string; release: Promise<void> }) {
  const reads: string[] = [];
  const readBlob = async (path: string): Promise<Blob> => {
    reads.push(path);
    if (slow && path === slow.path) await slow.release;
    if (path in present) return new Blob([present[path]]);
    throw new Error(`manca ${path}`);
  };
  return { readBlob, reads };
}

function mount(props: { text: string; path?: string; readBlob?: (path: string) => Promise<Blob> }) {
  const counted = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'preview.imageMissing': 'MANCA {path}' } }), persist() {} }),
  );
  const el = document.createElement('hmd-preview');
  el.text = props.text;
  el.path = props.path ?? 'note.md';
  el.files = ['note.md', 'idea.md'];
  el.config = DEFAULT_CONFIG;
  el.readBlob = props.readBlob ?? folder({}).readBlob;
  el.highlight = [];
  el.i18n = counted.store;
  document.body.append(el);
  const events: [string, unknown][] = [];
  for (const type of ['hmd-open', 'hmd-open-wiki', 'hmd-top-line'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  const parts = () => {
    const scroller = el.firstElementChild as HTMLDivElement;
    const article = scroller.firstElementChild as HTMLElement;
    return { scroller, article, body: article.lastElementChild as HTMLDivElement };
  };
  const h1 = () => parts().body.querySelector('h1')?.textContent ?? null;
  return { el, i18n: counted.store, listeners: counted.listeners, events, parts, h1 };
}

test('the tree of Preview.tsx: scroller, prose article, body filled through the sanitizer', async () => {
  const { el, parts } = mount({ text: '# Title\n\ntext <script>window.__x = 1</script>' });
  const { scroller, article, body } = parts();
  assert.deepEqual([scroller.localName, scroller.className, article.localName, article.className, body.localName, body.className], [
    'div', 'scroller', 'article', 'prose', 'div', '',
  ]);
  await waitFor(() => body.querySelector('h1') !== null);
  assert.equal(article.childElementCount, 1);
  assert.equal(body.querySelector('h1')!.className, 'hmd-l-0');
  assert.equal(body.querySelector('script'), null);
  el.remove();
});

test('frontmatter: the card comes before the body only when there is one; the frame keeps its nodes', async () => {
  const { el, parts, h1 } = mount({ text: '---\ntitle: Hello\n---\n# Body' });
  const { scroller, article, body } = parts();
  await waitFor(() => article.firstElementChild!.localName === 'hmd-frontmatter-card' && article.firstElementChild!.textContent === 'Hello');
  assert.equal(article.lastElementChild, body);
  el.path = 'other.md';
  el.text = '# Plain';
  await waitFor(() => h1() === 'Plain');
  assert.equal(article.querySelector('hmd-frontmatter-card'), null);
  assert.equal(parts().scroller, scroller);
  assert.equal(parts().body, body);
  el.remove();
});

test('text changes wait the debounce; a path change renders right away', async () => {
  const { el, h1 } = mount({ text: '# One' });
  await waitFor(() => h1() === 'One');
  el.text = '# Two';
  await sleep(60);
  assert.equal(h1(), 'One');
  await waitFor(() => h1() === 'Two', 1000);
  el.text = '# Three';
  el.path = 'other.md';
  await sleep(20);
  assert.equal(h1(), 'Three');
  el.remove();
});

test('a pending debounce never brings back the previous file', async () => {
  const { el, h1 } = mount({ text: '# A1', path: 'a.md' });
  await waitFor(() => h1() === 'A1');
  el.text = '# A2';
  await sleep(30); // timer di a.md in volo
  el.path = 'b.md';
  el.text = '# B';
  await waitFor(() => h1() === 'B', 100);
  await sleep(250);
  assert.equal(h1(), 'B');
  el.remove();
});

test('links: wiki and relative markdown become events; external links and anchors stay native', async () => {
  const { el, events, parts } = mount({ text: '[[idea]] [rel](sub/other.md) [pic](image.png) [out](https://example.com) [top](#top)' });
  const { body } = parts();
  await waitFor(() => body.querySelectorAll('a').length === 5);
  // Registrato dopo quello dell'elemento: legge se il clic è stato fermato, poi lo ferma (jsdom non naviga).
  const prevented: boolean[] = [];
  const record = (event: Event) => {
    prevented.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener('click', record);
  for (const name of ['idea', 'rel', 'pic', 'out', 'top']) {
    [...body.querySelectorAll('a')].find((a) => a.textContent === name)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  document.removeEventListener('click', record);
  assert.deepEqual(prevented, [true, true, true, false, false]);
  assert.deepEqual(events, [['hmd-open-wiki', { target: 'idea' }], ['hmd-open', { path: 'sub/other.md' }]]);
  const out = [...body.querySelectorAll('a')].find((a) => a.textContent === 'out')!;
  assert.deepEqual([out.getAttribute('target'), out.getAttribute('rel')], ['_blank', 'noopener noreferrer']);
  el.remove();
});

test('local images load through readBlob; missing ones get the class and a native title', async () => {
  const fs = folder({ 'assets/pixel.png': 'png' });
  const { el, parts } = mount({ text: '![pixel](assets/pixel.png)\n\n![missing](missing.png)\n\n![remote](https://example.com/r.png)', readBlob: fs.readBlob });
  const { body } = parts();
  const img = (alt: string) => body.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);
  await waitFor(() => img('pixel')?.getAttribute('src')?.startsWith('blob:') === true);
  await waitFor(() => img('missing')?.classList.contains('missing-image') === true);
  assert.equal(img('missing')!.getAttribute('title'), t('preview.imageMissing', { path: 'missing.png' }));
  assert.equal(img('remote')!.getAttribute('src'), 'https://example.com/r.png');
  assert.deepEqual([...fs.reads].sort(), ['assets/pixel.png', 'missing.png']);
  el.remove();
});

test('a late image of a superseded render does not touch it (cancelled)', async () => {
  let release!: () => void;
  const fs = folder({}, { path: 'slow.png', release: new Promise<void>((done) => (release = done)) });
  const { el, parts } = mount({ text: '![slow](slow.png)', readBlob: fs.readBlob });
  const { body } = parts();
  await waitFor(() => body.querySelector('img') !== null && fs.reads.includes('slow.png'));
  const old = body.querySelector('img')!;
  el.path = 'other.md';
  el.text = 'no images';
  await waitFor(() => body.querySelector('img') === null);
  release();
  await sleep(20);
  assert.equal(old.classList.contains('missing-image'), false);
  assert.equal(old.hasAttribute('title'), false);
  el.remove();
});

test('scroll: the top line goes out as hmd-top-line, except right after scrollToLine', async () => {
  let now = 1000;
  mock.method(performance, 'now', () => now);
  const { el, events, parts } = mount({ text: '# A\n\ntext' });
  const { scroller, body } = parts();
  await waitFor(() => body.querySelector('h1') !== null);
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.at(-1)![0], 'hmd-top-line');
  const count = events.length;
  el.scrollToLine(1);
  scroller.dispatchEvent(new Event('scroll'));
  now += 149;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, count);
  now += 2;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, count + 1);
  mock.restoreAll();
  el.remove();
});

test('a language change renders the body again (missing image title)', async () => {
  const { el, i18n, parts } = mount({ text: '![missing](missing.png)' });
  await waitFor(() => parts().body.querySelector('img')?.classList.contains('missing-image') === true);
  await i18n.setLocale('it');
  await waitFor(() => parts().body.querySelector('img')?.getAttribute('title') === 'MANCA missing.png');
  el.remove();
});

test('detached: the pending debounce does not render, no listener is left', async () => {
  const { el, listeners, h1 } = mount({ text: '# One' });
  await waitFor(() => h1() === 'One');
  el.text = '# Two';
  await sleep(30); // timer in volo
  el.remove();
  assert.equal(listeners(), 0);
  await sleep(250);
  assert.equal(h1(), 'One');
});
```

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/preview/preview.dom.test.ts`
Expected: FAIL (tag non definito).

- [ ] **Step 4: L'elemento**

`src/elements/preview/preview.element.ts`:

```ts
import type { HouseConfig } from '../../config/config';
import { resolveImageSrc } from '../../config/images';
import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { splitFrontmatter } from '../../preview/frontmatter';
import { highlightTerms } from '../../preview/highlight';
import { ImageUrlCache } from '../../preview/imageCache';
import { LINE_CLASS_PREFIX, renderMarkdown, sourceLineOf } from '../../preview/render';
import { setSafeHTML } from '../../preview/sanitize';
import { lineForOffset, offsetForLine, type Anchor } from '../../preview/scrollSync';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import type { HmdFrontmatterCard } from './frontmatter-card.element';
import {
  PREVIEW_DEBOUNCE_MS, SCROLL_SUPPRESS_MS, cardImagePath, docUpdate, isExternalHref, linkAction,
  type PreviewDoc, type ResolveImage,
} from './previewView';
import './preview.css';

/**
 * Anteprima del documento (era Preview.tsx). Gli effetti di React diventano metodi privati: i setter
 * segnano cosa è cambiato e `#schedule` decide in un microtask (cambio di file subito, testo con il
 * debounce, il resto subito). Il corpo si riscrive solo con setSafeHTML; un render superato non tocca
 * più nulla (flag `cancelled`, come oggi).
 */
export class HmdPreview extends HmdElement {
  #text = '';
  #path = '';
  #files: string[] = [];
  #config: HouseConfig | null = null;
  #readBlob: ((path: string) => Promise<Blob>) | null = null;
  #highlight: string[] = [];
  #i18n: I18nStore | null = null;

  #parts: { scroller: HTMLDivElement; article: HTMLElement; card: HmdFrontmatterCard; body: HTMLDivElement } | null = null;
  #signal: AbortSignal | null = null;
  #doc: PreviewDoc | null = null;
  #textChanged = false;
  #dirty = false;
  #scheduled = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #run = { cancelled: false };
  #cache: ImageUrlCache | null = null;
  #resolver: { path: string; config: HouseConfig; cache: ImageUrlCache; fn: ResolveImage } | null = null;
  #anchors: Anchor[] | null = null;
  #suppressUntil = 0;

  get text(): string { return this.#text; }
  set text(value: string) {
    value ??= '';
    if (value === this.#text) return;
    this.#text = value;
    this.#textChanged = true;
    this.#schedule();
  }
  get path(): string { return this.#path; }
  set path(value: string) {
    value ??= '';
    if (value === this.#path) return;
    this.#path = value;
    this.#schedule();
  }
  get files(): string[] { return this.#files; }
  set files(value: string[]) {
    value ??= [];
    if (value === this.#files) return;
    this.#files = value;
    this.#invalidate();
  }
  get config(): HouseConfig | null { return this.#config; }
  set config(value: HouseConfig | null) {
    value ??= null;
    if (value === this.#config) return;
    this.#config = value;
    this.#invalidate();
  }
  get readBlob(): ((path: string) => Promise<Blob>) | null { return this.#readBlob; }
  set readBlob(value: ((path: string) => Promise<Blob>) | null) {
    value ??= null;
    if (value === this.#readBlob) return;
    this.#readBlob = value;
    // Come la cache di Preview.tsx (useMemo su readBlob): una lettura nuova, una cache nuova.
    void this.#cache?.clear();
    this.#cache = null;
    this.#invalidate();
  }
  get highlight(): string[] { return this.#highlight; }
  set highlight(value: string[]) {
    value ??= [];
    if (value === this.#highlight) return;
    this.#highlight = value;
    this.#invalidate();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  /** Porta in cima la riga sorgente `line` (0-based, frazionaria); lo scroll che ne segue non torna all'editor. */
  scrollToLine(line: number): void {
    const scroller = this.#parts?.scroller;
    if (!scroller) return;
    this.#suppressUntil = performance.now() + SCROLL_SUPPRESS_MS;
    scroller.scrollTop = offsetForLine(this.#getAnchors(), line);
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const body = el('div');
      const article = el('article', { class: 'prose' }, body);
      const scroller = el('div', { class: 'scroller' }, article);
      this.append(scroller);
      this.#parts = { scroller, article, card: el('hmd-frontmatter-card'), body };
    }
    this.#signal = signal;
    const { scroller, body } = this.#parts;
    scroller.addEventListener('scroll', () => this.#onScroll(), { signal });
    scroller.addEventListener('click', (event) => this.#onClick(event), { signal });
    // Le posizioni cambiano con il ridimensionamento e il caricamento delle immagini.
    const observer = new ResizeObserver(() => {
      this.#anchors = null;
    });
    observer.observe(body);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    this.#dirty = true;
    if (this.#i18n) this.watch(this.#i18n, () => this.#invalidate(), signal);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Solo al distacco (non a reconnect, che arriva con un cambio di lingua): come lo smontaggio di Preview.tsx.
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#run.cancelled = true;
    void this.#cache?.clear();
    this.#cache = null;
    this.#resolver = null;
    this.#doc = null;
  }

  #invalidate(): void {
    this.#dirty = true;
    this.#schedule();
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#flush();
    });
  }

  #flush(): void {
    if (!this.#signal || this.#signal.aborted) return;
    const update = docUpdate(this.#doc, this.#path, this.#textChanged);
    this.#textChanged = false;
    if (update === 'now') {
      clearTimeout(this.#timer);
      this.#timer = undefined;
      this.#setDoc();
      this.#render();
      return;
    }
    if (update === 'debounce') {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        this.#setDoc();
        this.#render();
      }, PREVIEW_DEBOUNCE_MS);
    }
    if (this.#dirty) this.#render();
  }

  #setDoc(): void {
    this.#doc = { path: this.#path, split: splitFrontmatter(this.#text) };
  }

  #resolveImage(path: string, config: HouseConfig, cache: ImageUrlCache): ResolveImage {
    const current = this.#resolver;
    if (current && current.path === path && current.config === config && current.cache === cache) return current.fn;
    // Stessa identità finché non cambiano file, configurazione o cache: la scheda non ricarica l'immagine.
    const fn: ResolveImage = async (src) => {
      const local = resolveImageSrc(src, path, config);
      return local ? cache.get(local) : src;
    };
    this.#resolver = { path, config, cache, fn };
    return fn;
  }

  #render(): void {
    const parts = this.#parts;
    const doc = this.#doc;
    const i18n = this.#i18n;
    const config = this.#config;
    const readBlob = this.#readBlob;
    if (!parts || !doc || !i18n || !config || !readBlob) return;
    this.#dirty = false;
    this.#run.cancelled = true;
    const run = { cancelled: false };
    this.#run = run;
    const cache = (this.#cache ??= new ImageUrlCache(readBlob));
    const { card, body, article } = parts;
    card.i18n = i18n;
    card.resolveImage = this.#resolveImage(doc.path, config, cache);
    card.frontmatter = doc.split.frontmatter;
    // La scheda si monta e smonta come in React: prima del corpo, solo con il frontmatter.
    reconcileList(article, doc.split.frontmatter ? ['card', 'body'] : ['body'], (k) => k, (k): HTMLElement => (k === 'card' ? card : body));
    void this.#fill(run, doc, cache, config, i18n, this.#highlight);
  }

  /** Corpo del documento (era l'effetto di render di Preview.tsx): HTML sanificato, immagini, link, evidenziazione. */
  async #fill(run: { cancelled: boolean }, doc: PreviewDoc, cache: ImageUrlCache, config: HouseConfig, i18n: I18nStore, highlight: string[]): Promise<void> {
    const body = this.#parts!.body;
    const { split } = doc;
    await setSafeHTML(body, renderMarkdown(split.body, { currentPath: doc.path, files: this.#files, lineOffset: split.bodyLine }));
    if (run.cancelled) return;
    this.#anchors = null;

    const used: string[] = [];
    const cardLocal = cardImagePath(split, doc.path, config);
    if (cardLocal) used.push(cardLocal);
    for (const img of body.querySelectorAll('img')) {
      const src = img.getAttribute('data-local-src') || img.getAttribute('src');
      const local = src ? resolveImageSrc(src, doc.path, config) : null;
      if (!local) continue;
      used.push(local);
      img.removeAttribute('src');
      void cache.get(local).then((url) => {
        if (run.cancelled) return;
        if (url) {
          img.src = url;
        } else {
          img.classList.add('missing-image');
          // Title nativo voluto (niente ::after su <img>): eccezione di tooltips.test.ts, che vuole il nome `img`.
          img.title = i18n.t('preview.imageMissing', { path: local });
        }
      });
    }
    void cache.retain(used);

    for (const a of body.querySelectorAll('a[href]')) {
      if (isExternalHref(a.getAttribute('href') ?? '')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }
    highlightTerms(body, highlight);
  }

  #getAnchors(): Anchor[] {
    if (this.#anchors) return this.#anchors;
    const scroller = this.#parts!.scroller;
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const list: Anchor[] = [{ line: 0, top: 0 }];
    for (const node of scroller.querySelectorAll<HTMLElement>(`[class*="${LINE_CLASS_PREFIX}"]`)) {
      const line = sourceLineOf(node);
      if (line !== null) list.push({ line, top: node.getBoundingClientRect().top - base });
    }
    list.sort((a, b) => a.line - b.line || a.top - b.top);
    this.#anchors = list.filter((a, i) => i === 0 || a.line !== list[i - 1].line);
    return this.#anchors;
  }

  #onScroll(): void {
    if (performance.now() < this.#suppressUntil) return;
    emit(this, 'hmd-top-line', { line: lineForOffset(this.#getAnchors(), this.#parts!.scroller.scrollTop) });
  }

  #onClick(event: MouseEvent): void {
    const target = event.target as Element;
    // Come Preview.tsx: un clic su un'immagine bloccata (`data-ai-image`) non segue il link che la contiene.
    if (target.closest('[data-ai-image]')) return;
    const link = target.closest('a');
    if (!link || !this.#doc) return;
    const action = linkAction(link.getAttribute('href') ?? '', this.#doc.path);
    if (action.kind === 'native') return;
    event.preventDefault();
    if (action.kind === 'wiki') emit(this, 'hmd-open-wiki', { target: action.target });
    else if (action.kind === 'open') emit(this, 'hmd-open', { path: action.path });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-preview': HmdPreview;
  }
}
```

Note: il timer ridondante di `Preview.tsx` (stesso documento rifatto 150 ms dopo il montaggio) non si riproduce; `untrusted` non si porta (vedi «Decisioni»). Il clic e lo scroll non rientrano mai nel render: emettono un evento e basta.

`src/elements/preview/preview.css` (valori copiati da `Preview.module.css`; `:global(x)` → `x`; `missingImage` → `missing-image`):

```css
@layer components {
  /*
   * Senza limite inferiore: `.prose img` deve arrivare anche all'immagine della scheda del frontmatter
   * (max-width, height), come quando la scheda stava nello stesso CSS Module.
   */
  @scope (hmd-preview) {
    :scope {
      display: contents;
    }

    /*
     * Cornice ancorata alla radice: l'HTML di una nota arriva dal sanitizer con le classi, e un
     * <div class="scroller"> o class="prose" scritto nella nota non deve prendere questi stili (prima
     * lo impediva l'hash dei CSS Modules; lo controlla e2e/preview-live.spec.ts).
     */
    :scope > .scroller {
      height: 100%;
      overflow-y: auto;
      background: var(--c-surface);
    }

    :scope > .scroller > .prose {
      /* Larghezza del testo dalle impostazioni (src/lib/textWidth.ts), più il padding orizzontale. */
      max-width: calc(var(--preview-text-width, 72ch) + 64px);
      margin: 0 auto;
      padding: 24px 32px 40vh;
      font-family: var(--font-prose);
      font-size: 17px;
      line-height: 1.7;
      overflow-wrap: break-word;
    }

    .prose h1,
    .prose h2,
    .prose h3,
    .prose h4 {
      font-family: var(--font-ui);
      line-height: 1.25;
      margin: 1.6em 0 0.6em;
    }

    .prose h1 { font-size: 1.9em; }
    .prose h2 { font-size: 1.45em; }
    .prose h3 { font-size: 1.2em; }

    .prose a { color: var(--c-accent); }

    .prose a.wikilink {
      text-decoration: underline dashed;
      text-underline-offset: 3px;
    }

    .prose a.wikilink.missing { color: var(--c-danger); }

    .prose img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    .prose code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background: var(--c-code-bg);
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }

    .prose pre {
      background: var(--c-code-bg);
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
    }

    .prose pre code {
      background: none;
      padding: 0;
    }

    .prose blockquote {
      margin: 1em 0;
      padding: 0 1em;
      border-left: 3px solid var(--c-border);
      color: var(--c-muted);
    }

    .prose table {
      border-collapse: collapse;
      display: block;
      overflow-x: auto;
    }

    .prose th,
    .prose td {
      border: 1px solid var(--c-border);
      padding: 6px 10px;
    }

    .prose hr {
      border: none;
      border-top: 1px solid var(--c-border);
      margin: 2em 0;
    }

    .missing-image {
      display: inline-block;
      min-width: 120px;
      min-height: 60px;
      border: 1px dashed var(--c-danger);
    }
  }
}
```

Specificità: `:scope > .scroller` e `:scope > .scroller > .prose` salgono rispetto a `.scroller`/`.prose`, ma nessun'altra regola colpisce quei due nodi (le altre sono nel layer `base`, sotto `components`): l'esito non cambia. `.prose img` (0,1,1) continua a vincere su `.missing-image` (0,1,0) nello stesso scope, come prima.

`src/elements/events.ts`, in `HmdEvents`:

```ts
  /** Anteprima: aprire un file markdown (link relativo nel testo). */
  'hmd-open': CustomEvent<{ path: string }>;
  /** Anteprima: seguire un wikilink (crea la nota se manca). */
  'hmd-open-wiki': CustomEvent<{ target: string }>;
  /** Riga sorgente (0-based, frazionaria) in cima al pannello, per lo scroll sincronizzato (anteprima; editor dalla 5b). */
  'hmd-top-line': CustomEvent<{ line: number }>;
```

`src/elements/define.ts`: import di `HmdPreview` da `./preview/preview.element` e riga `['hmd-preview', HmdPreview],` dopo `hmd-notice`.

`src/elements/jsx.d.ts`:
- togliere la riga `'hmd-frontmatter-card'` del Task 3 e i due import che le servivano (`Frontmatter`, `ResolveImage`): il tag lo crea solo `hmd-preview`;
- import `type { Ref } from 'react'`, `type { HouseConfig } from '../config/config'`, `type { HmdPreview } from './preview/preview.element'`;
- in `IntrinsicElements`, dopo `hmd-notice`:

```ts
      'hmd-preview': HmdProps<
        { text: string; path: string; files: string[]; config: HouseConfig; readBlob: (path: string) => Promise<Blob>; highlight: string[]; i18n: I18nStore },
        'hmd-open' | 'hmd-open-wiki' | 'hmd-top-line'
      > & { ref?: Ref<HmdPreview> };
```

- [ ] **Step 5: `WorkspaceView.tsx` monta il tag**

In `src/ui/WorkspaceView.tsx`:
- togliere `import { Preview, type PreviewHandle } from '../preview/Preview';`, aggiungere `import type { HmdPreview } from '../elements/preview/preview.element';`;
- `const previewRef = useRef<PreviewHandle>(null);` → `const previewRef = useRef<HmdPreview>(null);` (l'`onTopLine` dell'editor chiama già `previewRef.current?.scrollToLine(line)`);
- al posto di `<Preview … />`:

```tsx
                  <hmd-preview
                    ref={previewRef}
                    text={doc.text}
                    path={doc.path}
                    files={files}
                    config={state.config}
                    readBlob={readBlob}
                    highlight={highlight}
                    i18n={i18nStore}
                    onhmd-top-line={(event) => {
                      if (shownMode === 'split') editorRef.current?.scrollToLine(event.detail.line);
                    }}
                    onhmd-open-wiki={(event) => {
                      setHighlight(NO_TERMS);
                      void workspace.followWikiLink(event.detail.target);
                    }}
                    onhmd-open={(event) => void openFile(event.detail.path)}
                  />
```

Poi `git rm src/preview/Preview.tsx src/preview/Preview.module.css`. Controllare che non resti nessun riferimento al vecchio componente (`PREVIEW_DEBOUNCE_MS` invece esiste ancora, in `previewView.ts`, ed è giusto):

```bash
grep -rnE "from ['\"][./]*(preview/)?Preview['\"]|PreviewHandle|Preview\.module\.css" src e2e; test $? -eq 1 && echo "nessun riferimento"
```

(`grep` esce con 1 quando non trova nulla e con 2 se il comando fallisce: solo «nessun riferimento» è il risultato giusto.)

- [ ] **Step 6: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/preview/preview.dom.test.ts   # 10 pass
npm test
npm run lint
npm run test:e2e             # preview, preview-live, sync-scroll, search, settings (larghezza), visual workspace-*
npx playwright test -c e2e/playwright.config.ts e2e/preview-live.spec.ts e2e/sync-scroll.spec.ts --repeat-each=5
npm run test:e2e:dev
npm run test:e2e:audit       # workspace-*, preview-card, preview-frontmatter-invalid, focus-* uguali alla baseline
```

Se l'audit trova differenze, **non toccare i test**: confrontare il CSS con il modulo originale e la struttura del DOM con quella di `Preview.tsx`.

- [ ] **Step 7: Commit**

```bash
git add -A src/elements src/testing/waitFor.ts src/ui/WorkspaceView.tsx src/preview
git commit -m "feat: hmd-preview al posto di Preview (debounce, immagini, link e scroll sincronizzato invariati)"
```

---

### Task 5: `hmd-ai-chat-log`

**Files:**
- Create: `src/elements/ai/chat-log.element.ts`, `chat-log.css`, `chat-log.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/ui/ai/AiSidebar.tsx`, `src/ui/ai/AiSidebar.module.css`
- Delete: `src/ui/ai/ChatLog.tsx`

**Interfaces:**
- Consumes: `chatEntries`, `ChatEntry` (Task 2); `waitFor` (Task 4); `safeRender` da `src/ai/safeRender.ts`; `setSafeHTML`.
- Produces: `HmdAiChatLog` con proprietà `messages: readonly ChatMessage[]`, `i18n: I18nStore | null`; eventi `hmd-ai-open-file` (`CustomEvent<{ path: string }>`), `hmd-ai-retry` (`CustomEvent<{ id: string; removeRejected: boolean }>`).

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/chat-log.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { ChatMessage } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { waitFor } from '../../testing/waitFor';

// jsdom non ha requestAnimationFrame: coda a mano, svuotata dal test.
const frames = new Map<number, FrameRequestCallback>();
let lastFrame = 0;
Object.assign(globalThis, {
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    frames.set(++lastFrame, callback);
    return lastFrame;
  },
  cancelAnimationFrame: (id: number) => void frames.delete(id),
});
const flushFrames = () => {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback(0);
  }
};

const msg = (patch: Partial<ChatMessage>): ChatMessage => ({ id: 'm', role: 'assistant', text: '', docPath: null, status: 'done', ...patch });

function mount(messages: ChatMessage[]) {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.retry': 'RIPROVA', 'ai.working': 'IN CORSO' } }),
    persist() {},
  });
  const el = document.createElement('hmd-ai-chat-log');
  el.messages = messages;
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n, log: () => el.querySelector<HTMLDivElement>('[role="log"]')!, articles: () => [...el.querySelectorAll('article')] };
}

test('the tree of ChatLog.tsx: a log of focusable articles, user text as text, meta under replies', async () => {
  const { el, log, articles } = mount([
    msg({ id: 'u', role: 'user', text: '<b>keep</b>', docPath: 'a.md' }),
    msg({ id: 'a', text: 'Some **bold**', docPath: 'a.md', profileName: 'ollama', model: 'qwen' }),
  ]);
  assert.equal(log().className, 'log');
  const [user, reply] = articles();
  assert.deepEqual([user.className, user.tabIndex], ['message', 0]);
  assert.deepEqual([...user.children].map((c) => [c.localName, c.className, c.textContent]), [
    ['button', 'file', 'a.md'], ['p', 'user', '<b>keep</b>'],
  ]);
  assert.equal(user.querySelector('b'), null);
  assert.deepEqual([...reply.children].map((c) => [c.localName, c.className]), [['div', 'assistant'], ['small', 'meta']]);
  assert.equal(reply.querySelector('.meta')!.textContent, 'ollama · qwen');
  flushFrames();
  await waitFor(() => reply.querySelector('strong') !== null);
  assert.equal(reply.querySelector('.assistant > div strong')!.textContent, 'bold');
  el.remove();
});

test('model output never becomes live HTML or a remote image', async () => {
  const { el, articles } = mount([
    msg({ id: 'a', text: '![x](http://evil.test/i.png) <img src="http://evil.test/raw" onerror="alert(1)"><iframe src="http://evil.test/f"></iframe>' }),
  ]);
  flushFrames();
  const body = articles()[0].querySelector('.assistant > div')!;
  await waitFor(() => body.childElementCount > 0);
  assert.equal(body.querySelector('img, iframe'), null);
  assert.match(body.textContent!, /evil\.test/);
  el.remove();
});

test('the document button opens it; Retry and Reset · Retry send hmd-ai-retry', () => {
  const { el, articles } = mount([msg({ id: 'a', docPath: 'a.md', status: 'error', error: 'paramRejected' })]);
  const sent: unknown[] = [];
  el.addEventListener('hmd-ai-open-file', (event) => sent.push(['open', event.detail.path]));
  el.addEventListener('hmd-ai-retry', (event) => sent.push(['retry', event.detail]));
  const buttons = [...articles()[0].querySelectorAll('button')];
  assert.deepEqual(buttons.map((b) => [b.type, b.className, b.textContent]), [
    ['button', 'file', 'a.md'],
    ['button', 'file', EN_MESSAGES['ai.retry']],
    ['button', 'file', `${EN_MESSAGES['ai.reset']} · ${EN_MESSAGES['ai.retry']}`],
  ]);
  for (const b of buttons) b.click();
  assert.deepEqual(sent, [['open', 'a.md'], ['retry', { id: 'a', removeRejected: false }], ['retry', { id: 'a', removeRejected: true }]]);
  el.remove();
});

test('updates reuse articles and buttons; streaming renders only the latest text', async () => {
  const failed = msg({ id: 'a', status: 'error', error: 'server' });
  const { el, articles } = mount([failed]);
  // Anche la risposta fallita (testo vuoto → «Working…») ha il suo fotogramma: lo si rende subito.
  flushFrames();
  const article = articles()[0];
  const retry = article.querySelector('button')!;
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'one' })];
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'two' })];
  assert.equal(articles()[0], article);
  assert.equal(article.querySelector('button'), retry);
  assert.equal(frames.size, 1);
  flushFrames();
  await waitFor(() => articles()[1].textContent!.includes('two'));
  assert.ok(!articles()[1].textContent!.includes('one'));
  el.remove();
});

test('a language change relabels in place; detached, pending frames are cancelled', async () => {
  const failed = msg({ id: 'a', status: 'error', error: 'server' });
  const { el, i18n, articles } = mount([failed, msg({ id: 'b', status: 'streaming' })]);
  const retry = articles()[0].querySelector('button')!;
  flushFrames();
  await i18n.setLocale('it');
  assert.equal(articles()[0].querySelector('button'), retry);
  assert.equal(retry.textContent, 'RIPROVA');
  flushFrames();
  await waitFor(() => articles()[1].textContent!.includes('IN CORSO'));
  el.messages = [failed, msg({ id: 'b', status: 'streaming', text: 'later' })];
  assert.equal(frames.size, 1);
  el.remove();
  assert.equal(frames.size, 0);
  // Staccato non ascolta più la lingua.
  await i18n.setLocale('en');
  assert.equal(retry.textContent, 'RIPROVA');
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/chat-log.dom.test.ts`
Expected: FAIL (tag non definito).

- [ ] **Step 3: L'elemento**

`src/elements/ai/chat-log.element.ts`:

```ts
import { safeRender } from '../../ai/safeRender';
import type { ChatMessage } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import { setSafeHTML } from '../../preview/sanitize';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { chatEntries, type ChatEntry } from './chatLogView';
import './chat-log.css';

/**
 * Messaggi della chat AI (era ChatLog.tsx). Le risposte del modello sono non fidate: passano solo da
 * safeRender (niente HTML grezzo, immagini remote come etichetta) e setSafeHTML, un fotogramma dopo il
 * cambio di testo come faceva il componente Markdown.
 */
export class HmdAiChatLog extends HmdElement {
  #messages: readonly ChatMessage[] = [];
  #i18n: I18nStore | null = null;
  #log: HTMLDivElement | null = null;
  /** Render del markdown in attesa del fotogramma, per contenitore. */
  #frames = new Map<HTMLDivElement, number>();
  /** Testo già chiesto per ogni contenitore (reso o in attesa): lo stesso testo non si rende due volte. */
  #shown = new WeakMap<HTMLDivElement, string>();

  get messages(): readonly ChatMessage[] { return this.#messages; }
  set messages(value: readonly ChatMessage[]) {
    this.#messages = value ?? [];
    this.#render();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#log ??= this.appendChild(el('div', { class: 'log', role: 'log' }));
    // Come la pulizia di Markdown: nessun fotogramma in volo dopo il distacco; al rientro il testo si richiede.
    signal.addEventListener(
      'abort',
      () => {
        for (const [body, frame] of this.#frames) {
          cancelAnimationFrame(frame);
          this.#shown.delete(body);
        }
        this.#frames.clear();
      },
      { once: true },
    );
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #render(): void {
    const log = this.#log;
    const i18n = this.#i18n;
    if (!log || !i18n || !this.isConnected) return;
    reconcileList(
      log,
      chatEntries(this.#messages, i18n.t),
      (entry) => entry.id,
      () => el('article', { class: 'message', tabIndex: 0 }),
      (article, entry) => this.#fill(article, entry),
    );
  }

  /** Figli di un messaggio nell'ordine di ChatLog.tsx; nodi riusati per chiave (il focus resta sui pulsanti). */
  #fill(article: HTMLElement, entry: ChatEntry): void {
    const keys = [
      ...(entry.file ? ['file'] : []),
      entry.role,
      ...entry.notices.map((_, i) => `notice:${i}`),
      ...(entry.retry ? ['retry'] : []),
      ...(entry.reset ? ['reset'] : []),
      ...(entry.meta !== null ? ['meta'] : []),
    ];
    reconcileList(article, keys, (key) => key, (key) => this.#create(key, entry), (node, key) => this.#update(node, key, entry));
  }

  #create(key: string, entry: ChatEntry): HTMLElement {
    const button = (onClick: () => void) => el('button', { type: 'button', class: 'file', on: { click: onClick } });
    if (key === 'file') {
      // Il documento di un messaggio non cambia: l'id è la chiave dell'article.
      const path = entry.file!;
      return button(() => emit(this, 'hmd-ai-open-file', { path }));
    }
    if (key === 'retry') return button(() => emit(this, 'hmd-ai-retry', { id: entry.id, removeRejected: false }));
    if (key === 'reset') return button(() => emit(this, 'hmd-ai-retry', { id: entry.id, removeRejected: true }));
    if (key === 'user') return el('p', { class: 'user' });
    if (key === 'assistant') return el('div', { class: 'assistant' }, el('div'));
    if (key === 'meta') return el('small', { class: 'meta' });
    return el('p', { class: 'notice' });
  }

  #update(node: HTMLElement, key: string, entry: ChatEntry): void {
    if (key === 'file') setText(node, entry.file!);
    else if (key === 'retry') setText(node, entry.retry!);
    else if (key === 'reset') setText(node, entry.reset!);
    else if (key === 'user') setText(node, entry.text);
    else if (key === 'assistant') this.#markdown(node.firstElementChild as HTMLDivElement, entry.text);
    else if (key === 'meta') setText(node, entry.meta!);
    else setText(node, entry.notices[Number(key.slice('notice:'.length))]);
  }

  /** Markdown della risposta al prossimo fotogramma; un testo nuovo annulla quello in attesa. */
  #markdown(body: HTMLDivElement, text: string): void {
    if (this.#shown.get(body) === text) return;
    this.#shown.set(body, text);
    const pending = this.#frames.get(body);
    if (pending !== undefined) cancelAnimationFrame(pending);
    this.#frames.set(
      body,
      requestAnimationFrame(() => {
        this.#frames.delete(body);
        void setSafeHTML(body, safeRender(text));
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-chat-log': HmdAiChatLog;
  }
}
```

(I clic emettono un evento e basta: nessun handler rientra nel render mentre `reconcileList` lavora; React aggiorna `messages` dopo, in un suo commit.)

`src/elements/ai/chat-log.css` (valori copiati da `AiSidebar.module.css`):

```css
@layer components {
  @scope (hmd-ai-chat-log) {
    :scope {
      display: contents;
    }

    .log {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 10px;
      overflow-wrap: anywhere;
    }

    .message {
      margin: 0 0 12px;
    }

    .user {
      margin-inline-start: 15%;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--c-accent-soft);
      white-space: pre-wrap;
    }

    .assistant pre {
      white-space: pre-wrap;
    }

    /* Metadati (profilo, modello, token): visibili al passaggio del mouse o al focus del messaggio. */
    .meta {
      display: block;
      color: var(--c-muted);
      font-size: 11px;
      visibility: hidden;
    }

    .message:hover .meta,
    .message:focus-within .meta {
      visibility: visible;
    }

    .file {
      display: block;
      width: 100%;
      margin: 8px 0;
      padding: 2px 0;
      border: none;
      border-top: 1px solid var(--c-border);
      background: none;
      color: var(--c-muted);
      font-size: 12px;
      text-align: start;
      cursor: pointer;
    }

    .notice {
      margin: 4px 0;
      color: var(--c-muted);
      font-size: 13px;
    }
  }
}
```

`src/elements/events.ts`, in `HmdEvents`:

```ts
  /** Chat AI: aprire il documento di un messaggio. */
  'hmd-ai-open-file': CustomEvent<{ path: string }>;
  /** Chat AI: ripetere un messaggio fallito (`removeRejected`: senza i parametri che il provider ha rifiutato). */
  'hmd-ai-retry': CustomEvent<{ id: string; removeRejected: boolean }>;
```

`src/elements/define.ts`: import di `HmdAiChatLog` da `./ai/chat-log.element` e riga `['hmd-ai-chat-log', HmdAiChatLog],` in testa (ordine alfabetico).

`src/elements/jsx.d.ts`: import `type { ChatMessage } from '../ai/types'` (accanto a `GenParams`, `ModelProfile`) e in testa a `IntrinsicElements`:

```ts
      'hmd-ai-chat-log': HmdProps<{ messages: readonly ChatMessage[]; i18n: I18nStore }, 'hmd-ai-open-file' | 'hmd-ai-retry'>;
```

- [ ] **Step 4: `AiSidebar.tsx` monta il tag**

In `src/ui/ai/AiSidebar.tsx`: togliere `import { ChatLog } from './ChatLog';` e al posto di `<ChatLog … />`:

```tsx
      <hmd-ai-chat-log
        messages={state.chat.messages}
        i18n={i18nStore}
        onhmd-ai-open-file={(event) => void controller.workspace.openFile(event.detail.path)}
        onhmd-ai-retry={(event) => void controller.retry(event.detail.id, event.detail.removeRejected)}
      />
```

In `src/ui/ai/AiSidebar.module.css` cancellare `.log`, `.message`, `.user`, `.assistant pre`, il commento e la regola `.meta`, `.message:hover .meta, .message:focus-within .meta`, `.notice`. **`.file` resta** (lo usa il pulsante «riattiva sync» di `AiSidebar`).

Prima `git rm src/ui/ai/ChatLog.tsx` (non ha un CSS Module suo: usava `AiSidebar.module.css`), poi controllare:

```bash
grep -rnE "styles\.(log|message|user|assistant|meta|notice)\b" src/ui; test $? -eq 1 && echo "nessun riferimento"
```

(exit 1 = nessuna occorrenza, il risultato giusto; exit 2 = comando fallito, da ripetere.)

- [ ] **Step 5: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/chat-log.dom.test.ts   # 5 pass
npm test
npm run lint
npm run test:e2e             # ai-chat-log, ai-review (output ostile), ai-chips, visual AI review
npx playwright test -c e2e/playwright.config.ts e2e/ai-chat-log.spec.ts --repeat-each=5
npm run test:e2e:dev
npm run test:e2e:audit       # ai-review, ai-chat-error, ai-chat-summary, ai-suggestions uguali alla baseline
```

- [ ] **Step 6: Commit**

```bash
git add -A src/elements src/ui/ai
git commit -m "feat: hmd-ai-chat-log al posto di ChatLog (risposte solo da safeRender + setSafeHTML)"
```

---

### Task 6: Documenti, misure, chiusura

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1
npm test                                    # annotare: 704 + i nuovi
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: dopo «fasi 4a–4c in `main` (…)» aggiungere «; fase 5a sul branch `feat/web-components`, in `main` al merge della sotto-fase» e lasciare «fasi 5b–8 ancora piano».
2. §7 «Fase 5», in testa: «Divisa in due piani: 5a (piano 8: scheda del frontmatter, anteprima, chat AI), 5b (editor e diff, CodeMirror).»
3. Nel punto `hmd-ai-chat-log` di §7 fase 5: «immagini remote solo su clic» → «immagini remote mai caricate (`safeRender` le rende come etichetta con l'host)».
4. In fondo a §7 fase 5: «- 5a **fatta**: `hmd-frontmatter-card`, `hmd-preview` (`scrollToLine()`, eventi `hmd-open`, `hmd-open-wiki`, `hmd-top-line`; render in un microtask con debounce di 150 ms solo sul testo; flag `cancelled`; cache delle immagini revocata al distacco), `hmd-ai-chat-log` (eventi `hmd-ai-open-file`, `hmd-ai-retry`); logica in `preview/previewView.ts` e `ai/chatLogView.ts`; aiuti di test `countListeners`, `waitFor`. Non portato il ramo `untrusted` dell'anteprima (nessun chiamante dal 71bf326; `ai.loadImage` resta nei locali fino alla fase 8). Cornice dell'anteprima ancorata a `:scope >` perché le classi di una nota non la stilizzino. Audit esteso a scheda completa, frontmatter non valido, errore e riepilogo della chat. Bundle principale gzip: <valore del Task 1> → <valore dello Step 1> B.» (sostituire i due valori con i numeri annotati).
5. §13: aggiungere `docs/superpowers/plans/2026-10-09-housemd-wc-08-fase-5a-anteprima-e-chat.md` (fase 5a).

- [ ] **Step 3: Verifica finale**

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit
git status --short
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md
git commit -m "docs: spec allineato alla fase 5a (anteprima, scheda del frontmatter, chat AI)"
```

- [ ] **Step 5: Chiusura (controller, non l'implementer)**

Nell'ordine: review finale dell'intero diff del branch rispetto a `main`; `/codex-review-chat` sul diff; checklist manuale (Step 6); solo con tutto pulito, merge in `main` e push:

```bash
cd /home/davidedipumpo/Projects/housemd && git status --short   # pulito
git merge --no-ff feat/web-components -m "Merge: fase 5a Web Components (anteprima, scheda del frontmatter, chat AI)"
npm test && npm run lint
git push origin main
cd ../housemd-wc && git merge --ff-only main && git push origin feat/web-components
```

- [ ] **Step 6: Checklist manuale** (Chrome, server di sviluppo del worktree, porta 5173, cartella di prova con sottocartelle, immagini, frontmatter, wikilink):
  1. Anteprima che segue la scrittura con la pausa di sempre; cambio file immediato; nessun ritorno al testo del file prima.
  2. Scheda del frontmatter con immagine locale: nessun lampeggio dell'immagine mentre si scrive; data nella lingua dell'interfaccia; frontmatter non valido.
  3. Immagine locale, immagine mancante (bordo tratteggiato, `title` al passaggio), immagine remota.
  4. Link: wikilink esistente e mancante (crea la nota), link relativo, link esterno in una scheda nuova, ancora `#…`.
  5. HTML ostile neutralizzato (script, `onerror`, `javascript:`); un `<div class="prose">` nella nota non cambia la cornice.
  6. Scroll sincronizzato in split nei due versi, senza rimbalzi; evidenziazione dei termini dopo una ricerca; larghezza del testo dalle impostazioni.
  7. Modalità editor → split: immagini di nuovo visibili; cambio di lingua a caldo con l'anteprima aperta.
  8. Chat: risposta in markdown, richiesta con `<b>` mostrata come testo, errore con Riprova (provider spento), metadati al passaggio e con Tab sul messaggio, pulsante del documento, Nuova chat.
  9. Tastiera e screen reader: Tab raggiunge l'anteprima scorrevole e i messaggi; il registro della chat si annuncia (`role=log`); tema chiaro, scuro e automatico.
