# HouseMD Web Components — Piano 3: fase 2, infrastruttura DOM e CSS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparare la base su cui la fase 4 costruirà i custom element (helper DOM testati in jsdom, classe base `HmdElement`, controlli statici su `define` e `@scope`) e mettere `global.css` nei layer `reset`/`base`, con la prova che la cascata e l'aspetto non cambiano.

**Architecture:** I moduli nuovi in `src/dom/` sono puri rispetto all'app: nessun componente React li importa, quindi non entrano nel bundle fino alla fase 4 (lo verifica la dimensione del JS, identica prima e dopo). I test DOM girano in jsdom tramite `src/testing/domEnv.ts`, importato per primo. Il cambio di cascata (`global.css` nei layer, CSS Modules senza layer) è verificato tre volte: test di build (`buildCss.test.ts`), un audit nuovo degli **stili calcolati** che confronta ogni proprietà di ogni elemento con una build di riferimento, e la suite e2e con gli stessi snapshot.

**Tech Stack:** TypeScript 7, React 18 (invariato), jsdom 30.1.1, `tsx --test`, Vite 8 (minificatore CSS: lightningcss, `cssTarget: 'chrome123'`), Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§4.1, §5.1, §5.2, §7 fase 2, §8.2, §8.3, R6, R13, R19). Il Task 11 aggiorna lo spec dove questo piano lo precisa (vedi "Scostamenti dallo spec").

## Global Constraints

- **Comportamento e aspetto invariati.** `npm run test:e2e` resta verde **con gli snapshot di oggi**: nessuno si rigenera in questa fase. Se uno snapshot cambia, è un bug del task.
- I test esistenti non cambiano le asserzioni (eccezione dichiarata: `buildCss.test.ts` si ristruttura per fare una build sola, con la stessa asserzione su `light-dark()`). Si aggiungono solo test nuovi.
- Ogni modulo nuovo nasce **test prima**: il test si scrive, si esegue e deve fallire (modulo inesistente o asserzione), poi si scrive il modulo.
- Nessuna dipendenza nuova. `jsdom` e `@types/jsdom` ci sono già.
- Nessun file di `src/` esistente cambia, tranne `src/styles/global.css`, `src/styles/buildCss.test.ts`, `src/architecture.test.ts`. Nessun componente `.tsx` importa `src/dom/`.
- `src/dom/*.ts` è scansionato da `uiText.test.ts` e `tooltips.test.ts`: niente testi letterali con lettere in etichette (`aria-label`, `data-tooltip`, `title`, `placeholder`, `alt`, `textContent`), nemmeno negli esempi dei commenti.
- Le regole di `CLAUDE.md` valgono tutte: commenti e commit in italiano, identificatori in inglese, mai `innerHTML` fuori da `preview/sanitize.ts`, test e2e solo per ruolo e nome accessibile.
- Branch `refactor/fase-2-infrastruttura-dom` creato da `main` (primo commit: questo piano), lavorato in un worktree. Alla fine **una PR verso `main`**; push e merge solo con il via esplicito di Davide.
- Commit in italiano con prefisso convenzionale (`feat:`, `test:`, `refactor:`, `chore:`, `docs:`), senza righe di attribuzione.
- **Mai giudicare un comando di verifica dal suo output filtrato**: niente `| grep`/`| tail` sui comandi di test (restituirebbero l'exit code del filtro). Si guarda l'exit code del comando stesso.
- Comandi di verifica di ogni task: `npm test` (tutto verde), `npm run lint`. I Task 9–10 aggiungono `npm run test:e2e` (worker a 2, profilo su disco, ~50 s su questa macchina).

## Scostamenti dallo spec (decisi scrivendo il piano, da riportare nello spec al Task 11)

1. **`watch(store, fn, signal)`** invece di `watch(subscribe, fn, signal)`: alcuni store espongono `subscribe` come metodo di un oggetto (`i18nStore`, `routeStore`, `themeStore`, `UpdateFlow`), altri come arrow function (`Workspace`, `AiController`). Passare l'oggetto e chiamare `store.subscribe(fn)` funziona con entrambi; passare il metodo staccato no, se un giorno usa `this`.
2. **Icone in due file**: `src/dom/maskIcon.ts` (testato: `<span class="icon">` da un URL) e `src/dom/icon.ts` (sottile: nome → URL tramite `ui/icons.ts`). `icons.ts` importa gli SVG con `?url`, che `tsx` non sa caricare: un modulo che lo importa non è testabile in Node. Firma: `icon(name, { size, className })`, come le props di `Icon.tsx`.
3. **L'ordine dei layer si verifica per prima comparsa, non sulla dichiarazione.** Provato il 02/10: lightningcss riscrive `@layer reset, base, components, overrides;` in `@layer reset;` + blocchi + `@layer overrides;` in fondo, togliendo i nomi che il file definisce più avanti. L'ordine effettivo resta giusto, ma un test che cercasse la riga dichiarata fallirebbe. Il test calcola l'ordine dalla prima comparsa di ogni nome.
4. **`@scope` si verifica su un foglio di prova** (`src/styles/fixtures/scope/`): nessun CSS dell'app usa `@scope` prima della fase 4, e il rischio R19 va chiuso prima.
5. **Due controlli statici di §8.3 entrano ora** (`customElements.define` solo in `elements/define.ts`; CSS di `src/elements/` solo `@layer components { @scope (…) }` con le radici di §4.2). Oggi passano a vuoto per costruzione (nessun `define`, nessun CSS sotto `elements/`), con casi sintetici che provano che scattano: così sono pronti al primo elemento della fase 4.
6. **Audit degli stili calcolati** (`npm run test:e2e:audit`, nuovo): stessi stati dell'app su una build di riferimento (`dist-baseline/`) e sulla build corrente, confronto di ogni proprietà calcolata di ogni elemento e pseudo-elemento. Gli snapshot vedono solo pixel e solo negli stati fotografati; l'audit vede anche focus ring da tastiera, `forced-colors`, tooltip al passaggio. Resta utile per tutta la migrazione dei fogli (fase 4+), finché la struttura del DOM è la stessa.
7. **Limiti di jsdom verificati** (§8.2, jsdom 30.1.1): mancano `moveBefore`, `showModal`/`closedBy`, Popover (`popover`, `showPopover`), `commandForElement`, `CSS.highlights`/`Highlight`, Anchor Positioning. Ci sono `customElements`, `MutationObserver`, `AbortSignal` in `addEventListener` (solo quello della stessa `window`: un `AbortSignal` di Node viene rifiutato con `TypeError`), `role`/`ariaLabel` come proprietà. Nessuno stub in questa fase: nessun helper li usa. Gli stub entrano nel test che ne ha bisogno, dalla fase 4.

## Review Focus

1. **Lista che si aggiorna mentre una sua riga ha il focus** (risultati della ricerca, albero): la riga riusata e non spostata tiene il focus; una riga spostata usa `moveBefore` quando c'è (Chromium), che conserva il focus. jsdom, come Chromium, perde il focus con `insertBefore` (verificato). Task 5, test "focus" e "moveBefore"; quest'ultimo prova solo la **scelta** di `moveBefore` (jsdom non lo implementa): la conservazione del focus nello spostamento resta da verificare in Chromium con gli e2e della fase 6 (albero e ricerca), e lo spec lo annota (Task 11).
2. **HTML iniettato attraverso `el()`**: una chiave `innerHTML`/`outerHTML`/`srcdoc` o un attributo `on…` in stringa aggirerebbe il test statico di `architecture.test.ts`. `el()` li rifiuta a runtime (e i primi tre anche a livello di tipi); i figli stringa sono sempre testo. Task 3.
3. **Una regola globale che oggi vince su un CSS Module (o su CodeMirror) per specificità e domani perde perché è in un layer**: invisibile negli snapshot se lo stato non è fotografato (focus da tastiera, `forced-colors`, tooltip). Task 9–10, audit degli stili calcolati con quegli stati.
4. **Minificatore che riscrive `@layer`/`@scope`**: già successo con `light-dark()`. Task 8 (foglio di prova) e Task 10 (CSS dell'app).
5. **Elemento spostato nel DOM** (in fase 4 React può rimontarlo in un altro genitore): `disconnectedCallback` + `connectedCallback`; i listener e le iscrizioni vecchie devono sparire, senza doppioni. Task 6, test "reconnect", `watch` e `watch` con signal già interrotto.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `src/testing/domEnv.ts` (+ `domEnv.test.ts`) | Globali DOM da una sola `window` di jsdom, per i test che montano elementi. |
| `src/dom/el.ts` (+ test) | `el()` crea elementi senza stringhe HTML; `setText`, `toggleAttr` scrivono solo se cambia. |
| `src/dom/uid.ts` (+ test) | Id unici nel documento (era `useId`). |
| `src/dom/maskIcon.ts` (+ test), `src/dom/icon.ts` | Icona pixel art come `<span class="icon">` (era `Icon.tsx`). |
| `src/dom/list.ts` (+ test) | `reconcileList`: figli allineati a una lista per chiave, nodi riusati. |
| `src/dom/element.ts` (+ test) | `HmdElement`: ciclo di vita con `AbortController`, `watch` sugli store. |
| `src/architecture.test.ts` | + `define` solo in `elements/define.ts`; + CSS di `src/elements/` solo `@scope` con radici ammesse. |
| `src/styles/buildCss.test.ts`, `src/styles/fixtures/scope/` | `@scope` e ordine dei layer intatti nel CSS di produzione. |
| `e2e/support/styleAudit.ts`, `e2e/support/notes.ts`, `e2e/computed-styles.audit.ts`, `e2e/audit.config.ts` | Audit degli stili calcolati contro `dist-baseline/`. |
| `e2e/support/app.ts`, `e2e/visual.spec.ts` | `forcedColors` passato al contesto; note di prova condivise. |
| `src/styles/global.css` | Stili globali nei layer `reset` e `base`. |
| `package.json`, `.gitignore`, `README.md`, `CLAUDE.md`, spec | Script `test:e2e:audit`, `dist-baseline/` ignorato, documentazione. |

---

### Task 1: Branch e baseline

**Files:** nessuno.

- [ ] **Step 1: Worktree e branch**

```bash
# Il branch esiste già, con il commit di questo piano sopra main.
git fetch origin && git log --oneline main..refactor/fase-2-infrastruttura-dom   # solo il commit del piano
git worktree add ../housemd-fase2 refactor/fase-2-infrastruttura-dom
cd ../housemd-fase2 && npm ci
```

- [ ] **Step 2: Baseline**

```bash
npm test                                    # annotare il riepilogo (al 02/10: 567 pass)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c      # annotare: JS principale gzip
gzip -c dist/assets/index-*.css | wc -c     # annotare: CSS gzip
npm run test:e2e                            # annotare: al 02/10, 98 passed (~50 s)
git status --short                          # vuoto
```

Expected: tutto verde, `git status` vuoto. Altrimenti fermarsi e riferire.

---

### Task 2: Ambiente DOM per i test (`domEnv`)

**Files:**
- Create: `src/testing/domEnv.ts`
- Test: `src/testing/domEnv.test.ts`

**Interfaces:**
- Produces: modulo con effetto collaterale; `import '../testing/domEnv';` come **primo import** di ogni test che usa il DOM. Esporta `dom: JSDOM`. Dopo l'import sono globali, tutti dalla stessa `window`: `window`, `document`, `Node`, `Element`, `HTMLElement`, `Text`, `DocumentFragment`, `customElements`, `MutationObserver`, `Event`, `CustomEvent`, `KeyboardEvent`, `MouseEvent`, `FocusEvent`, `AbortController`, `AbortSignal`.

- [ ] **Step 1: Scrivere il test**

`src/testing/domEnv.test.ts`:

```ts
import { dom } from './domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

test('DOM globals all come from the same jsdom window', () => {
  assert.equal(globalThis.document, dom.window.document);
  assert.equal(globalThis.HTMLElement, dom.window.HTMLElement);
  assert.equal(globalThis.AbortController, dom.window.AbortController);
  assert.ok(document.createElement('div') instanceof HTMLElement);
});

// jsdom rifiuta l'AbortSignal di Node con un TypeError: per questo anche AbortController viene dalla window.
test('a listener bound to a global AbortController signal stops after abort', () => {
  const button = document.createElement('button');
  const controller = new AbortController();
  let clicks = 0;
  button.addEventListener('click', () => clicks++, { signal: controller.signal });
  button.click();
  controller.abort();
  button.click();
  assert.equal(clicks, 1);
});

test('custom elements defined on the global registry are upgraded and connected', () => {
  let connected = 0;
  customElements.define('hmd-env-probe', class extends HTMLElement {
    connectedCallback() {
      connected++;
    }
  });
  document.body.append(document.createElement('hmd-env-probe'));
  assert.equal(connected, 1);
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx tsx --test src/testing/domEnv.test.ts`
Expected: FAIL, `Cannot find module './domEnv'` (o `ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Scrivere `domEnv.ts`**

`src/testing/domEnv.ts`:

```ts
/**
 * Globali del DOM per i test che montano elementi (spec WC §8.2). Va importato come PRIMO import, prima
 * di qualsiasi modulo che estende HTMLElement al caricamento. Tutto viene dalla stessa `window` di jsdom:
 * jsdom rifiuta in addEventListener un AbortSignal di Node, e `instanceof` tra realm diversi fallisce.
 * `node:test` esegue ogni file in un processo a sé: i globali non passano da un file all'altro.
 *
 * Limiti di jsdom 30 (verificati nella fase 2): mancano moveBefore, showModal/closedBy, Popover,
 * commandfor, CSS.highlights e Anchor Positioning. Chi li usa li controlla prima di chiamarli o riceve
 * uno stub nel suo test; il comportamento vero lo verificano Playwright e la checklist manuale.
 */
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });

const GLOBALS = [
  'document', 'Node', 'Element', 'HTMLElement', 'Text', 'DocumentFragment', 'customElements', 'MutationObserver',
  'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'AbortController', 'AbortSignal',
] as const;

const source = dom.window as unknown as Record<string, unknown>;
Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window });
for (const name of GLOBALS) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: source[name] });
}
```

- [ ] **Step 4: Eseguirlo e vederlo passare**

Run: `npx tsx --test src/testing/domEnv.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde (baseline + 3).

- [ ] **Step 6: Commit**

```bash
git add src/testing/domEnv.ts src/testing/domEnv.test.ts
git commit -m "test: ambiente DOM di jsdom per i test degli elementi, con i globali di una sola window"
```

---

### Task 3: `el()`, `setText`, `toggleAttr`

**Files:**
- Create: `src/dom/el.ts`
- Test: `src/dom/el.test.ts`

**Interfaces:**
- Consumes: `src/testing/domEnv.ts` (Task 2).
- Produces:
  - `type Child = Node | string | number | null | undefined | false`
  - `interface Props { class?: string; dataset?: Record<string, string | undefined>; on?: Listeners; innerHTML?: never; outerHTML?: never; srcdoc?: never; [name: string]: unknown }`
  - `el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: (Child | readonly Child[])[]): HTMLElementTagNameMap[K]`
  - `setText(node: Node, text: string): void`
  - `toggleAttr(node: Element, name: string, on: boolean, value?: string): void`

Regole di `el()`: `class` → `className`; `dataset` → `node.dataset` (valori `undefined` saltati); `on` → `addEventListener` per ogni tipo; ogni altra chiave è una **proprietà** se esiste sull'elemento (`name in node`: `hidden`, `value`, `disabled`, `role`…), altrimenti un **attributo** (`aria-*`, `data-*`, `popover`, `popovertarget`, `closedby`, `commandfor`…). `undefined`/`null` non impostano nulla; per gli attributi `false` non imposta nulla e `true` scrive `""` (attributo booleano). Gli stati ARIA vogliono stringhe (`'aria-pressed': 'false'`). Vietate, con errore: `innerHTML`, `outerHTML`, `srcdoc` e qualsiasi chiave che inizia con `on` diversa da `on`.

- [ ] **Step 1: Scrivere il test**

`src/dom/el.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { el, setText, toggleAttr, type Props } from './el';

test('string children become text nodes, never HTML', () => {
  const p = el('p', null, '<b>x</b>');
  assert.equal(p.childNodes.length, 1);
  assert.equal(p.firstChild?.nodeType, Node.TEXT_NODE);
  assert.equal(p.querySelector('b'), null);
  assert.equal(p.textContent, '<b>x</b>');
});

test('children: numbers become text, nodes are appended, arrays are flattened, null/undefined/false are skipped', () => {
  const ul = el('ul', null, [el('li', null, 'a'), null, el('li', null, 'b')], undefined, false, 3);
  assert.deepEqual([...ul.childNodes].map((n) => n.textContent), ['a', 'b', '3']);
  assert.equal(ul.lastChild?.nodeType, Node.TEXT_NODE);
});

test('class, dataset and hyphenated names become attributes', () => {
  const button = el('button', { class: 'row active', dataset: { path: 'docs/a.md', skip: undefined }, 'aria-label': 'x', 'data-tooltip': 'y' });
  assert.equal(button.className, 'row active');
  assert.equal(button.dataset.path, 'docs/a.md');
  assert.equal('skip' in button.dataset, false);
  assert.equal(button.getAttribute('aria-label'), 'x');
  assert.equal(button.getAttribute('data-tooltip'), 'y');
});

test('names that exist on the element are set as properties', () => {
  const input = el('input', { value: 'abc', disabled: true, hidden: false });
  assert.equal(input.value, 'abc');
  assert.equal(input.getAttribute('value'), null);
  assert.equal(input.disabled, true);
  assert.equal(input.hasAttribute('hidden'), false);
});

test('undefined, null and false set no attribute; true sets an empty boolean attribute', () => {
  const div = el('div', { 'aria-describedby': undefined, 'data-a': null, 'data-b': false, 'data-c': true, popover: 'auto' });
  assert.equal(div.hasAttribute('aria-describedby'), false);
  assert.equal(div.hasAttribute('data-a'), false);
  assert.equal(div.hasAttribute('data-b'), false);
  assert.equal(div.getAttribute('data-c'), '');
  assert.equal(div.getAttribute('popover'), 'auto');
});

test('listeners in `on` are attached', () => {
  let clicks = 0;
  const button = el('button', { on: { click: () => clicks++ } });
  button.click();
  assert.equal(clicks, 1);
});

test('HTML from strings and inline handlers are refused', () => {
  for (const props of [{ innerHTML: '<img src=x>' }, { outerHTML: '<p>' }, { srcdoc: '<p>' }, { onclick: 'go()' }, { onClick: 'go()' }]) {
    assert.throws(() => el('div', props as unknown as Props), /non è ammesso/, JSON.stringify(props));
  }
});

test('setText and toggleAttr write only when the value changes', () => {
  const span = el('span', null, 'a');
  const observer = new MutationObserver(() => {});
  observer.observe(span, { attributes: true, childList: true, characterData: true, subtree: true });

  setText(span, 'a');
  toggleAttr(span, 'data-active', false);
  assert.equal(observer.takeRecords().length, 0);

  toggleAttr(span, 'aria-current', true, 'page');
  toggleAttr(span, 'aria-current', true, 'page');
  assert.equal(observer.takeRecords().length, 1);
  assert.equal(span.getAttribute('aria-current'), 'page');

  toggleAttr(span, 'aria-current', false);
  setText(span, 'b');
  assert.equal(span.hasAttribute('aria-current'), false);
  assert.equal(span.textContent, 'b');
  assert.ok(observer.takeRecords().length > 0);
  observer.disconnect();
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx tsx --test src/dom/el.test.ts`
Expected: FAIL, modulo `./el` inesistente.

- [ ] **Step 3: Scrivere `el.ts`**

`src/dom/el.ts`:

```ts
/**
 * Costruzione del DOM senza stringhe HTML (spec WC §5.2): sostituisce JSX. I testi entrano solo come nodi
 * di testo; le chiavi che porterebbero HTML o codice da stringa (`innerHTML`, `srcdoc`, `onclick`…) sono
 * un errore, perché il test statico di architecture.test.ts non le vedrebbe dentro un oggetto.
 */

/** Figli accettati: i testi diventano nodi di testo; null, undefined e false si saltano. */
export type Child = Node | string | number | null | undefined | false;

type Listeners = { [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void };

export interface Props {
  class?: string;
  /** Valori `undefined` saltati. */
  dataset?: Record<string, string | undefined>;
  /** Listener dei nodi creati qui: spariscono con il nodo, non servono signal. */
  on?: Listeners;
  innerHTML?: never;
  outerHTML?: never;
  srcdoc?: never;
  /** Proprietà dell'elemento se esiste (`hidden`, `value`, `disabled`, `role`…), altrimenti attributo. */
  [name: string]: unknown;
}

const FORBIDDEN = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: (Child | readonly Child[])[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) {
    if (name === 'class') {
      if (typeof value === 'string' && value) node.className = value;
    } else if (name === 'dataset') {
      for (const [key, v] of Object.entries(value as Record<string, string | undefined>)) if (v !== undefined) node.dataset[key] = v;
    } else if (name === 'on') {
      for (const [type, listener] of Object.entries(value as Record<string, EventListener>)) node.addEventListener(type, listener);
    } else {
      setProp(node, name, value);
    }
  }
  node.append(...children.flat().flatMap((c) => (c === null || c === undefined || c === false ? [] : [typeof c === 'number' ? String(c) : c])));
  return node;
}

function setProp(node: HTMLElement, name: string, value: unknown): void {
  if (FORBIDDEN.has(name) || /^on/i.test(name)) throw new Error(`el(): "${name}" non è ammesso`);
  if (value === undefined || value === null) return;
  if (name in node) {
    (node as unknown as Record<string, unknown>)[name] = value;
    return;
  }
  if (value === false) return;
  node.setAttribute(name, value === true ? '' : String(value));
}

/** Scrive il testo solo se cambia: niente mutazioni inutili. */
export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Mette (con `value`, vuoto se manca) o toglie un attributo, solo se cambia. */
export function toggleAttr(node: Element, name: string, on: boolean, value = ''): void {
  if (!on) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value);
  }
}
```

- [ ] **Step 4: Eseguirlo e vederlo passare**

Run: `npx tsx --test src/dom/el.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde. `uiText.test.ts` e `tooltips.test.ts` ora scansionano anche `dom/el.ts` e non trovano nulla.

- [ ] **Step 6: Commit**

```bash
git add src/dom/el.ts src/dom/el.test.ts
git commit -m "feat: el(), setText e toggleAttr per costruire il DOM senza stringhe HTML"
```

---

### Task 4: `uid()` e icone

**Files:**
- Create: `src/dom/uid.ts`, `src/dom/maskIcon.ts`, `src/dom/icon.ts`
- Test: `src/dom/uid.test.ts`, `src/dom/maskIcon.test.ts`

**Interfaces:**
- Consumes: `el` (Task 3), `ICONS`/`IconName` da `src/ui/icons.ts` (esistente).
- Produces:
  - `uid(prefix: string, doc?: Document): string` → `"<prefix>-<n>"`, mai un id già presente in `doc`.
  - `maskIcon(url: string, options?: { size?: number; className?: string }): HTMLSpanElement`
  - `icon(name: IconName, options?: { size?: number; className?: string }): HTMLSpanElement`

`maskIcon` riproduce l'output di `Icon.tsx`: `<span class="icon[ className]" style="mask-image: url(&quot;…&quot;)[; width: Npx; height: Npx]" aria-hidden="true">`.

- [ ] **Step 1: Scrivere i test**

`src/dom/uid.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { uid } from './uid';

test('ids carry the prefix and never repeat', () => {
  const ids = Array.from({ length: 50 }, () => uid('review'));
  for (const id of ids) assert.match(id, /^review-\d+$/);
  assert.equal(new Set(ids).size, ids.length);
});

test('an id already in the document is skipped', () => {
  const n = Number(uid('probe').split('-')[1]);
  for (const taken of [n + 1, n + 2]) {
    const div = document.createElement('div');
    div.id = `probe-${taken}`;
    document.body.append(div);
  }
  assert.equal(uid('probe'), `probe-${n + 3}`);
});
```

`src/dom/maskIcon.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { maskIcon } from './maskIcon';

test('an icon is a decorative span masked by the SVG, sized by --icon-size by default', () => {
  const span = maskIcon('/assets/close.svg');
  assert.equal(span.localName, 'span');
  assert.equal(span.className, 'icon');
  assert.equal(span.getAttribute('aria-hidden'), 'true');
  assert.equal(span.style.getPropertyValue('mask-image'), 'url("/assets/close.svg")');
  assert.equal(span.style.width, '');
  assert.equal(span.childNodes.length, 0);
});

test('size and className behave like the props of Icon.tsx', () => {
  const span = maskIcon('/assets/search.svg', { size: 16, className: 'searchIcon' });
  assert.equal(span.className, 'icon searchIcon');
  assert.equal(span.style.width, '16px');
  assert.equal(span.style.height, '16px');
});
```

- [ ] **Step 2: Eseguirli e vederli fallire**

Run: `npx tsx --test src/dom/uid.test.ts src/dom/maskIcon.test.ts`
Expected: FAIL, moduli `./uid` e `./maskIcon` inesistenti.

- [ ] **Step 3: Scrivere i moduli**

`src/dom/uid.ts`:

```ts
let counter = 0;

/** Id unico nel documento per `aria-*`, `for`, `popovertarget`, `commandfor` (era useId di React). */
export function uid(prefix: string, doc: Document = document): string {
  let id: string;
  do id = `${prefix}-${++counter}`;
  while (doc.getElementById(id));
  return id;
}
```

`src/dom/maskIcon.ts`:

```ts
import { el } from './el';

export interface IconOptions {
  /** Lato in pixel; senza, vale `--icon-size` (20px, global.css). */
  size?: number;
  className?: string;
}

/** Icona pixel art: l'SVG fa da maschera, il colore è `currentColor`. Sempre decorativa. Come Icon.tsx. */
export function maskIcon(url: string, { size, className }: IconOptions = {}): HTMLSpanElement {
  const span = el('span', { class: className ? `icon ${className}` : 'icon', 'aria-hidden': 'true' });
  span.style.setProperty('mask-image', `url("${url}")`);
  if (size) {
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
  }
  return span;
}
```

`src/dom/icon.ts`:

```ts
import { ICONS, type IconName } from '../ui/icons';
import { maskIcon, type IconOptions } from './maskIcon';

/**
 * Icona per nome (era <Icon> di React). Sottile di proposito: icons.ts importa gli SVG con `?url`, che
 * tsx non carica, quindi la logica sta in maskIcon.ts, testato.
 */
export function icon(name: IconName, options?: IconOptions): HTMLSpanElement {
  return maskIcon(ICONS[name], options);
}
```

- [ ] **Step 4: Eseguirli e vederli passare**

Run: `npx tsx --test src/dom/uid.test.ts src/dom/maskIcon.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde; `lint` controlla anche `icon.ts` (tipi di `?url` da `vite/client`).

- [ ] **Step 6: Commit**

```bash
git add src/dom/uid.ts src/dom/uid.test.ts src/dom/maskIcon.ts src/dom/maskIcon.test.ts src/dom/icon.ts
git commit -m "feat: uid() per gli id del documento e icone pixel art senza React"
```

---

### Task 5: `reconcileList`

**Files:**
- Create: `src/dom/list.ts`
- Test: `src/dom/list.test.ts`

**Interfaces:**
- Consumes: `src/testing/domEnv.ts`, `el` (solo nei test).
- Produces: `reconcileList<T, N extends Element>(parent: Element, items: readonly T[], key: (item: T) => string, create: (item: T) => N, update?: (node: N, item: T) => void): void`

Contratto: `parent` contiene solo i nodi della lista. Per ogni chiave il nodo della chiamata precedente si riusa; `create` gira solo per le chiavi nuove; `update` gira su **ogni** nodo (nuovo o riusato) con il suo elemento, prima del posizionamento. Le chiavi che spariscono tolgono il nodo. Si spostano solo i nodi fuori posto: con `moveBefore` se il metodo esiste, `parent` è connesso e il nodo è già figlio di `parent`; altrimenti `insertBefore`. Chiave doppia → errore.

- [ ] **Step 1: Scrivere il test**

`src/dom/list.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { el } from './el';
import { reconcileList } from './list';

interface Item {
  id: string;
  label: string;
}

const items = (...ids: string[]): Item[] => ids.map((id) => ({ id, label: id.toUpperCase() }));

function render(parent: Element, list: Item[], created: string[] = []): void {
  reconcileList(
    parent,
    list,
    (item) => item.id,
    (item) => {
      created.push(item.id);
      return el('li', null, el('button'));
    },
    (node, item) => {
      node.firstElementChild!.textContent = item.label;
    },
  );
}

const labels = (parent: Element) => [...parent.children].map((n) => n.textContent);

test('the first render creates every node in order and fills it with update', () => {
  const ul = el('ul');
  const created: string[] = [];
  render(ul, items('a', 'b', 'c'), created);
  assert.deepEqual(labels(ul), ['A', 'B', 'C']);
  assert.deepEqual(created, ['a', 'b', 'c']);
});

test('nodes are reused by key and updated, new keys are created, missing keys are removed', () => {
  const ul = el('ul');
  render(ul, items('a', 'b', 'c'));
  const [a, , c] = [...ul.children];
  const created: string[] = [];
  render(ul, [{ id: 'a', label: 'A2' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }], created);
  assert.deepEqual(labels(ul), ['A2', 'C', 'D']);
  assert.equal(ul.children[0], a);
  assert.equal(ul.children[1], c);
  assert.deepEqual(created, ['d']);
});

test('reordering keeps the same nodes', () => {
  const ul = el('ul');
  render(ul, items('a', 'b', 'c'));
  const before = [...ul.children];
  render(ul, items('c', 'a', 'b'));
  assert.deepEqual(labels(ul), ['C', 'A', 'B']);
  assert.deepEqual([...ul.children], [before[2], before[0], before[1]]);
});

test('a focused node that is reused and does not move keeps the focus', () => {
  const ul = el('ul');
  document.body.append(ul);
  render(ul, items('a', 'b'));
  const button = ul.children[1].firstElementChild as HTMLButtonElement;
  button.focus();
  render(ul, items('x', 'a', 'b', 'y'));
  assert.equal(document.activeElement, button);
  ul.remove();
});

// jsdom non ha moveBefore: qui si prova solo che list.ts lo sceglie. Che il nodo spostato tenga il focus
// è una garanzia di Chromium, verificata end-to-end quando le liste diventano elementi (fase 6: albero e
// ricerca con il focus su una riga durante l'aggiornamento).
test('nodes out of place move with moveBefore when the connected parent has it', () => {
  const ul = el('ul');
  document.body.append(ul);
  render(ul, items('a', 'b', 'c'));
  const moved: string[] = [];
  Object.defineProperty(ul, 'moveBefore', {
    value(node: Element, ref: Node | null) {
      moved.push(node.textContent ?? '');
      ul.insertBefore(node, ref);
    },
  });
  render(ul, items('c', 'a', 'b'));
  assert.deepEqual(labels(ul), ['C', 'A', 'B']);
  assert.deepEqual(moved, ['C']);
  ul.remove();
});

test('a detached parent never uses moveBefore', () => {
  const ul = el('ul');
  const moved: unknown[] = [];
  Object.defineProperty(ul, 'moveBefore', { value: (node: Node) => moved.push(node) });
  render(ul, items('a', 'b'));
  render(ul, items('b', 'a'));
  assert.deepEqual(labels(ul), ['B', 'A']);
  assert.deepEqual(moved, []);
});

test('an empty list removes every node; a duplicate key is an error', () => {
  const ul = el('ul');
  render(ul, items('a', 'b'));
  render(ul, []);
  assert.equal(ul.children.length, 0);
  assert.throws(() => render(ul, items('a', 'a')), /chiave doppia "a"/);
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx tsx --test src/dom/list.test.ts`
Expected: FAIL, modulo `./list` inesistente.

- [ ] **Step 3: Scrivere `list.ts`**

`src/dom/list.ts`:

```ts
/** Nodi di ogni lista per chiave, dall'ultima chiamata. */
const lists = new WeakMap<Element, Map<string, Element>>();

/**
 * Allinea i figli di `parent` a `items` (spec WC §5.2, al posto delle liste con `key` di React). Per ogni
 * chiave riusa il nodo della volta prima, così focus, selezione e stato restano; `create` gira solo per le
 * chiavi nuove, `update` su ogni nodo. Sposta solo i nodi fuori posto: con `moveBefore`, che conserva il
 * focus, quando c'è; `insertBefore` lo perde. `parent` deve contenere solo i nodi della lista.
 */
export function reconcileList<T, N extends Element>(
  parent: Element,
  items: readonly T[],
  key: (item: T) => string,
  create: (item: T) => N,
  update: (node: N, item: T) => void = () => {},
): void {
  const before = (lists.get(parent) ?? new Map()) as Map<string, N>;
  const after = new Map<string, N>();
  for (const item of items) {
    const k = key(item);
    if (after.has(k)) throw new Error(`reconcileList: chiave doppia "${k}"`);
    const node = before.get(k) ?? create(item);
    update(node, item);
    after.set(k, node);
  }
  for (const [k, node] of before) if (!after.has(k)) node.remove();

  let cursor = parent.firstChild;
  for (const node of after.values()) {
    if (node === cursor) {
      cursor = node.nextSibling;
      continue;
    }
    place(parent, node, cursor);
  }
  lists.set(parent, after);
}

function place(parent: Element, node: Element, ref: ChildNode | null): void {
  if (typeof parent.moveBefore === 'function' && parent.isConnected && node.parentNode === parent) parent.moveBefore(node, ref);
  else parent.insertBefore(node, ref);
}
```

- [ ] **Step 4: Eseguirlo e vederlo passare**

Run: `npx tsx --test src/dom/list.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add src/dom/list.ts src/dom/list.test.ts
git commit -m "feat: reconcileList allinea le liste per chiave riusando i nodi (focus compreso)"
```

---

### Task 6: Classe base `HmdElement`

**Files:**
- Create: `src/dom/element.ts`
- Test: `src/dom/element.test.ts`

**Interfaces:**
- Consumes: `src/testing/domEnv.ts`.
- Produces:
  - `interface Subscribable { subscribe(listener: () => void): () => void }`
  - `abstract class HmdElement extends HTMLElement` con `connectedCallback()`, `disconnectedCallback()`, `protected abstract connect(signal: AbortSignal): void`, `protected watch(store: Subscribable, fn: () => void, signal: AbortSignal): void`.

Contratto: con un `signal` già interrotto `watch` non fa nulla (né iscrizione né chiamata). `connect` gira una volta per connessione (un `connectedCallback` ripetuto senza distacco non la richiama); il distacco interrompe il `signal`; una nuova connessione riceve un `signal` nuovo. `watch` chiama `fn` subito, poi a ogni notifica dello store, e si disiscrive quando il `signal` si interrompe.

- [ ] **Step 1: Scrivere il test**

`src/dom/element.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { HmdElement, type Subscribable } from './element';

function fakeStore(): Subscribable & { listeners: Set<() => void>; notify(): void } {
  const listeners = new Set<() => void>();
  return {
    listeners,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
}

const store = fakeStore();

class Probe extends HmdElement {
  connects = 0;
  renders = 0;
  events = 0;
  signals: AbortSignal[] = [];

  protected connect(signal: AbortSignal): void {
    this.connects++;
    this.signals.push(signal);
    window.addEventListener('probe', () => this.events++, { signal });
    this.watch(store, () => this.renders++, signal);
  }
}
customElements.define('hmd-element-probe', Probe);

const probe = () => document.createElement('hmd-element-probe') as Probe;

/** Espone `watch` per chiamarlo fuori da `connect`. */
class WatchProbe extends HmdElement {
  protected connect(): void {}
  watchFrom(store: Subscribable, fn: () => void, signal: AbortSignal): void {
    this.watch(store, fn, signal);
  }
}
customElements.define('hmd-watch-probe', WatchProbe);

test('watch with an already aborted signal neither subscribes nor calls fn', () => {
  const other = fakeStore();
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  (document.createElement('hmd-watch-probe') as WatchProbe).watchFrom(other, () => calls++, controller.signal);
  assert.equal(other.listeners.size, 0);
  assert.equal(calls, 0);
});

test('connect runs once per connection, also if connectedCallback repeats', () => {
  const el = probe();
  document.body.append(el);
  el.connectedCallback();
  assert.equal(el.connects, 1);
  el.remove();
});

test('detaching aborts the signal: listeners and subscriptions stop', () => {
  const el = probe();
  document.body.append(el);
  window.dispatchEvent(new Event('probe'));
  store.notify();
  assert.equal(el.events, 1);
  assert.equal(el.renders, 2); // subito + una notifica

  el.remove();
  assert.equal(el.signals[0].aborted, true);
  assert.equal(store.listeners.size, 0);
  window.dispatchEvent(new Event('probe'));
  store.notify();
  assert.equal(el.events, 1);
  assert.equal(el.renders, 2);
});

test('moving the element reconnects it with a fresh signal and no duplicate listeners', () => {
  const el = probe();
  const other = document.createElement('div');
  document.body.append(el, other);
  other.append(el);
  assert.equal(el.connects, 2);
  assert.equal(el.signals[0].aborted, true);
  assert.equal(el.signals[1].aborted, false);
  assert.equal(store.listeners.size, 1);
  window.dispatchEvent(new Event('probe'));
  assert.equal(el.events, 1);
  other.remove();
  assert.equal(store.listeners.size, 0);
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx tsx --test src/dom/element.test.ts`
Expected: FAIL, modulo `./element` inesistente.

- [ ] **Step 3: Scrivere `element.ts`**

`src/dom/element.ts`:

```ts
/** Uno store esterno (Workspace, AiController, UpdateFlow, i18nStore, themeStore, routeStore). */
export interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/**
 * Classe base degli elementi `hmd-*` (spec WC §5.1). Il ciclo di vita sta in un AbortController: ogni
 * listener e iscrizione registrati con il `signal` di `connect` spariscono al distacco, senza pulizia a
 * mano. Un elemento spostato nel DOM si stacca e si riattacca: riceve un `signal` nuovo.
 */
export abstract class HmdElement extends HTMLElement {
  #abort: AbortController | null = null;

  connectedCallback(): void {
    if (this.#abort) return;
    this.#abort = new AbortController();
    this.connect(this.#abort.signal);
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
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

- [ ] **Step 4: Eseguirlo e vederlo passare**

Run: `npx tsx --test src/dom/element.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add src/dom/element.ts src/dom/element.test.ts
git commit -m "feat: classe base HmdElement con ciclo di vita su AbortController e watch sugli store"
```

---

### Task 7: Controlli statici su `define` e `@scope`

**Files:**
- Modify: `src/architecture.test.ts`

**Interfaces:**
- Consumes: `walk`, `sources`, `offenders`, `inSet`, `SRC` già in `architecture.test.ts`.
- Produces (interni al file di test): `DEFINE`, `DEFINE_ALLOWED`, `topLevelBlocks(css)`, `scopeProblems(folder, css)`.

Il limite inferiore `to (…)` ammette solo una lista di elementi `hmd-*` (spec §4.1: lo scope si ferma ai componenti figli). Oggi nessun file chiama `customElements.define` fuori dai test e `src/elements/` non ha CSS: i due controlli passano a vuoto finché la fase 4 non aggiunge il primo elemento. I casi sintetici provano che scattano.

- [ ] **Step 1: Aggiungere i controlli e i casi sintetici**

In `src/architecture.test.ts`, dopo la definizione di `NETWORK_ALLOWED`:

```ts
/** Custom element: un solo punto di registrazione (spec WC §8.3), così l'ordine di definizione è uno. */
const DEFINE = /\bcustomElements\.define\s*\(/;
const DEFINE_ALLOWED = new Set(['elements/define.ts']);
```

Dopo il test `'only src/ai/providers/ makes network requests'`:

```ts
test('customElements.define appears only in elements/define.ts', () => {
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED)), []);
});
```

Nel test `'the patterns fire on what they must and ignore what they must'`, prima della chiusura:

```ts
  assert.ok(DEFINE.test("customElements.define('hmd-file-tree', HmdFileTree)"));
  assert.ok(!DEFINE.test("customElements.get('hmd-file-tree')"));
```

Nel test `'offending files are reported by path and allowed files are not (synthetic sources)'`, aggiungere a `probes`:

```ts
    { path: 'dom/element.ts', source: "customElements.define('hmd-x', X);" },
    { path: 'elements/define.ts', source: "customElements.define('hmd-x', X);" },
```

e prima della chiusura:

```ts
  assert.deepEqual(offenders(DEFINE, inSet(DEFINE_ALLOWED), probes), ['dom/element.ts']);
```

In fondo al file:

```ts
interface Block {
  prelude: string;
  /** Contenuto tra graffe; `null` per un'istruzione chiusa da `;` (o non chiusa). */
  body: string | null;
}

/** Blocchi di primo livello di un foglio, commenti tolti. Le graffe dentro le stringhe non sono gestite. */
function topLevelBlocks(css: string): Block[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        blocks.push({ prelude: text.slice(start, open).trim(), body: text.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (c === ';' && depth === 0) {
      blocks.push({ prelude: text.slice(start, i).trim(), body: null });
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) blocks.push({ prelude: rest, body: null });
  return blocks;
}

/**
 * Radici `@scope` ammesse per cartella di src/elements/ (spec WC §4.2). Regola generale: `hmd-<cartella>`.
 * Un'eccezione nuova si aggiunge qui con il motivo, mai con uno skip.
 */
const SCOPE_ROOTS: Record<string, (root: string) => boolean> = {
  preview: (root) => root === 'hmd-preview' || root === 'hmd-frontmatter-card',
  ai: (root) => /^hmd-ai-[a-z-]+$/.test(root),
  settings: (root) => /^hmd-settings(?:-[a-z-]+)?$/.test(root),
  // I dialog nativi stanno in document.body, fuori da qualsiasi elemento hmd-*.
  dialogs: (root) => root === 'dialog.hmd-dialog',
};

const rootAllowed = (folder: string, root: string) => (SCOPE_ROOTS[folder] ?? ((r: string) => r === `hmd-${folder}`))(root);

/** Problemi di un CSS di src/elements/<folder>/: ammesso solo `@layer components { @scope (radice) [to (hmd-…, …)] { … } }`. */
function scopeProblems(folder: string, css: string): string[] {
  const problems: string[] = [];
  for (const layer of topLevelBlocks(css)) {
    if (layer.prelude !== '@layer components' || layer.body === null) {
      problems.push(`fuori da @layer components: ${layer.prelude}`);
      continue;
    }
    for (const scope of topLevelBlocks(layer.body)) {
      // Limite inferiore (§4.1): solo elementi figli hmd-*, così lo scope si ferma ai componenti contenuti.
      const m = /^@scope\s*\(\s*([^)\s]+)\s*\)(?:\s+to\s*\(\s*(hmd-[a-z-]+(?:\s*,\s*hmd-[a-z-]+)*)\s*\))?$/.exec(scope.prelude);
      if (!m || scope.body === null) problems.push(`non è un @scope: ${scope.prelude}`);
      else if (!rootAllowed(folder, m[1])) problems.push(`radice non ammessa in ${folder}/: ${m[1]}`);
    }
  }
  return problems;
}

const elementSheets = walk(join(SRC, 'elements'))
  .filter((full) => full.endsWith('.css'))
  .map((full) => ({ path: relative(SRC, full).split(sep).join('/'), css: readFileSync(full, 'utf8') }));

test('every CSS file under src/elements/ is @layer components with @scope blocks on its own roots', () => {
  for (const { path, css } of elementSheets) assert.deepEqual(scopeProblems(path.split('/')[1], css), [], path);
});

test('the @scope check accepts the allowed shapes and rejects the others (synthetic sheets)', () => {
  assert.deepEqual(scopeProblems('file-tree', '@layer components { @scope (hmd-file-tree) to (hmd-x, hmd-y) { .row { color: red } } }'), []);
  assert.deepEqual(scopeProblems('ai', '/* c */ @layer components { @scope (hmd-ai-composer) { :scope { display: block } } @scope (hmd-ai-chat-log) {} }'), []);
  assert.deepEqual(scopeProblems('preview', '@layer components { @scope (hmd-frontmatter-card) {} }'), []);
  assert.deepEqual(scopeProblems('settings', '@layer components { @scope (hmd-settings-profiles) {} }'), []);
  assert.deepEqual(scopeProblems('dialogs', '@layer components { @scope (dialog.hmd-dialog) { :scope {} } }'), []);
  assert.deepEqual(scopeProblems('file-tree', '.row { color: red }'), ['fuori da @layer components: .row']);
  assert.deepEqual(scopeProblems('file-tree', '@layer base { @scope (hmd-file-tree) {} }'), ['fuori da @layer components: @layer base']);
  assert.deepEqual(scopeProblems('file-tree', '@layer components { .row { color: red } }'), ['non è un @scope: .row']);
  assert.deepEqual(scopeProblems('file-tree', '@layer components { @scope (hmd-search-panel) { .x {} } }'), ['radice non ammessa in file-tree/: hmd-search-panel']);
  assert.deepEqual(scopeProblems('ai', '@layer components { @scope (hmd-preview) {} }'), ['radice non ammessa in ai/: hmd-preview']);
  // Il limite inferiore ferma lo scope ai componenti figli: un selettore qualsiasi lo svuoterebbe o lo allargherebbe.
  assert.deepEqual(scopeProblems('workspace', '@layer components { @scope (hmd-workspace) to (body) {} }'), ['non è un @scope: @scope (hmd-workspace) to (body)']);
  assert.deepEqual(scopeProblems('workspace', '@layer components { @scope (hmd-workspace) to (hmd-editor, .row) {} }'), ['non è un @scope: @scope (hmd-workspace) to (hmd-editor, .row)']);
});
```

- [ ] **Step 2: Controllare che i casi sintetici scattino**

Run: `npx tsx --test src/architecture.test.ts`
Expected: PASS. Poi, a prova della sensibilità, cambiare per un momento in `SCOPE_ROOTS` la riga `dialogs` in `root === 'dialog'` e rieseguire: deve FALLIRE il test `the @scope check…` sul caso `dialogs`. Ripristinare la riga.

- [ ] **Step 3: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde.

- [ ] **Step 4: Commit**

```bash
git add src/architecture.test.ts
git commit -m "test: customElements.define solo in elements/define.ts e CSS degli elementi solo in @scope ammessi"
```

---

### Task 8: `@scope` e `@layer` intatti dopo il minificatore

**Files:**
- Create: `src/styles/fixtures/scope/index.html`, `src/styles/fixtures/scope/probe.css`
- Modify: `src/styles/buildCss.test.ts`

**Interfaces:**
- Produces (interni al test): `buildCss(inline: InlineConfig): Promise<string>`, `layerOrder(css: string): string[]`, `appCss` (CSS della build dell'app, calcolato una volta in `before`).

Il test esistente su `light-dark()` resta con la stessa asserzione; cambia solo da dove prende il CSS (una build condivisa). Il foglio di prova passa dallo stesso `vite.config.ts` (stesso `cssTarget`, stesso minificatore), con `root` sulla cartella della prova.

- [ ] **Step 1: Foglio di prova**

`src/styles/fixtures/scope/index.html`:

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./probe.css" />
  </head>
  <body></body>
</html>
```

`src/styles/fixtures/scope/probe.css`:

```css
/* Prova per buildCss.test.ts: le forme dei fogli degli elementi (spec WC §4.1) che il minificatore non deve toccare. */
@layer reset, base, components, overrides;

@layer components {
  @scope (hmd-probe) to (hmd-inner, hmd-other) {
    :scope {
      display: block;
      color: light-dark(#000, #fff);
    }

    .row:hover,
    .row[data-active='true'] {
      background: red;
    }
  }
}
```

- [ ] **Step 2: Riscrivere `buildCss.test.ts`**

`src/styles/buildCss.test.ts`:

```ts
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type InlineConfig } from 'vite';

/** Tutto il CSS che `vite build` produce con la configurazione del progetto (più `inline`). */
async function buildCss(inline: InlineConfig = {}): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 'housemd-build-'));
  try {
    await build({ configFile: 'vite.config.ts', logLevel: 'silent', ...inline, build: { outDir, emptyOutDir: true } });
    const assets = join(outDir, 'assets');
    return readdirSync(assets)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(assets, f), 'utf8'))
      .join('\n');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

/**
 * Nomi dei layer nell'ordine della prima comparsa: è quello che decide la cascata. Il minificatore riscrive
 * la dichiarazione `@layer a, b, c;` (toglie i nomi che il file definisce più avanti), quindi la riga
 * dichiarata non si può cercare così com'è.
 */
function layerOrder(css: string): string[] {
  const order: string[] = [];
  for (const m of css.matchAll(/@layer\s+([^{;]+)[{;]/g)) {
    for (const name of m[1].split(',').map((s) => s.trim())) if (!order.includes(name)) order.push(name);
  }
  return order;
}

const LAYERS = ['reset', 'base', 'components', 'overrides'];

let appCss = '';
before(async () => {
  appCss = await buildCss();
});

// Il tema si cambia con la proprietà `color-scheme` (src/theme/applyTheme.ts): funziona solo se
// light-dark() arriva nel CSS di produzione così com'è. Se il minificatore lo "abbassa" a un
// polyfill basato su prefers-color-scheme, i colori seguono solo il sistema e lo switcher non va.
test('the production CSS keeps native light-dark() so the theme switcher works', () => {
  assert.match(appCss, /light-dark\(/);
  assert.doesNotMatch(appCss, /lightningcss-(light|dark)/);
});

test('layerOrder reads the order of first appearance, also from the minified shape', () => {
  assert.deepEqual(layerOrder('@layer reset, base, components, overrides;'), LAYERS);
  assert.deepEqual(layerOrder('@layer reset;@layer base{.a{}}@layer components{@scope(x){}}@layer overrides;'), LAYERS);
  assert.deepEqual(layerOrder('@layer base{.a{}}@layer reset{.b{}}'), ['base', 'reset']);
});

// Rischio R19 dello spec: i fogli degli elementi (fase 4) vivono di @scope dentro @layer components.
test('@scope and its lower boundary survive the build inside @layer components', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/scope/', import.meta.url));
  const css = await buildCss({ root: fixture });
  assert.match(css, /@layer\s+components\s*\{\s*@scope\s*\(\s*hmd-probe\s*\)\s*to\s*\(\s*hmd-inner\s*,\s*hmd-other\s*\)\s*\{/);
  assert.match(css, /:scope\s*\{/);
  assert.ok(css.indexOf('.row:hover') > css.indexOf('@scope'), 'le regole restano dentro @scope');
  assert.match(css, /light-dark\(/);
  assert.deepEqual(layerOrder(css), LAYERS);
});
```

- [ ] **Step 3: Eseguirlo**

Run: `npx tsx --test src/styles/buildCss.test.ts`
Expected: PASS, 3 test (due build: app e prova). Verificato a mano il 02/10 con lo stesso `vite.config.ts`: l'output della prova è `@layer reset;@layer components{@scope(hmd-probe) to (hmd-inner,hmd-other){:scope{…}.row:hover,.row[data-active=true]{…}}}@layer overrides;`, che soddisfa ogni asserzione. Se il test fallisce sull'`@scope`, **fermarsi e riferire**: è il rischio R19 e la scelta (minificatore, `cssTarget`) spetta a Davide.

- [ ] **Step 4: Prova di sensibilità**

Cambiare per un momento in `probe.css` `to (hmd-inner, hmd-other)` in `to (hmd-inner)` e rieseguire: il test `@scope…` deve FALLIRE sulla prima `assert.match`. Ripristinare.

- [ ] **Step 5: Suite e typecheck**

Run: `npm test` poi `npm run lint`
Expected: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add src/styles/buildCss.test.ts src/styles/fixtures/scope
git commit -m "test: @scope e ordine dei layer verificati sul CSS di produzione, con un foglio di prova"
```

---

### Task 9: Audit degli stili calcolati

**Files:**
- Create: `e2e/support/styleAudit.ts`, `e2e/support/notes.ts`, `e2e/computed-styles.audit.ts`, `e2e/audit.config.ts`
- Modify: `e2e/support/app.ts` (opzione `forcedColors` passata al contesto), `e2e/visual.spec.ts` (note di prova importate da `notes.ts`), `package.json` (script), `.gitignore`

**Interfaces:**
- Consumes: fixture `test`/`expect`/`App`/`FakeModel` di `e2e/support/app.ts`.
- Produces:
  - `type StyleDump = Record<string, Record<string, string>>` (chiave: percorso nel DOM `body:1>div:0>…`, più `::before`/`::after` se esistono).
  - `dumpComputedStyles(): StyleDump` (gira nella pagina).
  - `styleDifferences(before: StyleDump, after: StyleDump): string[]`.
  - `NOTE`, `NOW` in `e2e/support/notes.ts`.
  - Script `npm run test:e2e:audit`: confronta `dist-baseline/` (porta 4174) con la build corrente (porta 4173).

Come si usa (anche nelle fasi successive): **prima** di cambiare la cascata, `npm run build && rm -rf dist-baseline && cp -r dist dist-baseline`; poi si cambia il CSS e si lancia `npm run test:e2e:audit`. Il progetto `baseline` scrive gli stili di ogni stato in `test-results/style-audit/`, il progetto `current` (che dipende da `baseline`) li confronta. Limite: le chiavi sono percorsi nel DOM, quindi l'audit vale finché la struttura del DOM non cambia.

- [ ] **Step 1: Note di prova condivise**

`e2e/support/notes.ts`:

```ts
/** Nota di riferimento per snapshot e audit: frontmatter, titoli, enfasi, codice, wikilink, liste, citazione. */
export const NOTE = [
  '---',
  'title: Visual reference',
  'tags: [alpha, beta]',
  'date: 2026-01-15',
  '---',
  '# Heading',
  '',
  'Some *emphasis*, **strong**, `code` and a [[wikilink]].',
  '',
  '- one',
  '- two',
  '',
  '> a quote',
  '',
  '```ts',
  'const answer = 42;',
  '```',
].join('\n');

/** Data fissa: i tempi relativi della cronologia non cambiano tra un'esecuzione e l'altra. */
export const NOW = new Date('2026-10-01T10:00:00+02:00');
```

In `e2e/visual.spec.ts` togliere le definizioni locali di `NOTE` e `NOW` (righe 3–24 di oggi, con il loro commento) e importarle:

```ts
import { expect, test, type App } from './support/app.ts';
import { NOTE, NOW } from './support/notes.ts';
```

- [ ] **Step 2: `forcedColors` nel contesto persistente**

In `e2e/support/app.ts`, nella fixture `context`, aggiungere `forcedColors` all'elenco delle opzioni ricevute e passate a mano:

```ts
  context: async (
    { baseURL, viewport, locale, timezoneId, reducedMotion, forcedColors, serviceWorkers, colorScheme, userAgent, headless, launchOptions },
    use,
    testInfo,
  ) => {
```

e in `launchPersistentContext`, dopo `reducedMotion,`:

```ts
      forcedColors,
```

- [ ] **Step 3: Raccolta e confronto degli stili**

`e2e/support/styleAudit.ts`:

```ts
/** Stili calcolati per elemento: chiave = percorso nel DOM (più `::before`/`::after`), valore = proprietà → valore. */
export type StyleDump = Record<string, Record<string, string>>;

/**
 * Gira nella pagina (page.evaluate): deve bastare a sé stessa. Prende <html>, <body> e tutto ciò che sta
 * nel body, compresi dialog e popover nel top layer; i pseudo-elementi solo se generano contenuto.
 */
export function dumpComputedStyles(): StyleDump {
  const out: StyleDump = {};
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
      const index = node.parentElement ? Array.prototype.indexOf.call(node.parentElement.children, node) : 0;
      parts.unshift(`${node.localName}:${index}`);
    }
    return parts.join('>') || 'html';
  };
  const read = (style: CSSStyleDeclaration) => {
    const props: Record<string, string> = {};
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      props[name] = style.getPropertyValue(name);
    }
    return props;
  };
  const skip = new Set(['script', 'style', 'template', 'link', 'meta']);
  for (const el of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
    if (skip.has(el.localName)) continue;
    const path = pathOf(el);
    out[path] = read(getComputedStyle(el));
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo);
      if (style.content !== 'none' && style.content !== 'normal') out[`${path}${pseudo}`] = read(style);
    }
  }
  return out;
}

/** Ogni differenza come riga leggibile: elementi spariti o nuovi, proprietà con valore diverso. */
export function styleDifferences(before: StyleDump, after: StyleDump): string[] {
  const found: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (!a || !b) {
      found.push(`${key}: ${a ? 'sparito' : 'nuovo'}`);
      continue;
    }
    for (const prop of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[prop] !== b[prop]) found.push(`${key} { ${prop}: ${a[prop]} → ${b[prop]} }`);
    }
  }
  return found;
}
```

- [ ] **Step 4: Gli stati dell'audit**

`e2e/computed-styles.audit.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

import type { FakeModel } from './support/aiHarness.ts';
import { expect, test, type App } from './support/app.ts';
import { NOTE, NOW } from './support/notes.ts';
import { dumpComputedStyles, styleDifferences, type StyleDump } from './support/styleAudit.ts';

/**
 * Audit degli stili calcolati (spec WC fase 2): ogni stato gira prima sulla build di riferimento
 * (progetto `baseline`, dist-baseline/) e poi sulla build corrente (progetto `current`), che deve dare
 * gli stessi valori per ogni proprietà di ogni elemento. Copre ciò che gli snapshot non fotografano:
 * focus da tastiera, forced-colors, tooltip al passaggio. Uso: e2e/audit.config.ts.
 */

const OUT = fileURLToPath(new URL('../test-results/style-audit/', import.meta.url));

interface State {
  name: string;
  scheme?: 'light' | 'dark';
  forcedColors?: boolean;
  /** Il mouse resta dove l'ha lasciato lo stato (tooltip al passaggio). */
  keepMouse?: boolean;
  setup(app: App, page: Page, ai: FakeModel): Promise<void>;
}

async function workspace(app: App): Promise<void> {
  await app.openFolder({ 'note.md': NOTE, 'docs/guide.md': '# Guide' });
  await app.openFile('note.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
}

async function searchFromKeyboard(app: App, page: Page): Promise<void> {
  await workspace(app);
  // Come focus-ring.spec.ts: dopo il dialog l'ultima interazione è la tastiera.
  await page.getByRole('button', { name: app.t('folder.new') }).first().click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('searchbox', { name: app.t('search.label') })).toBeFocused();
}

const STATES: State[] = [
  { name: 'start-light', setup: (app) => app.start() },
  { name: 'start-dark', scheme: 'dark', setup: (app) => app.start() },
  { name: 'workspace-light', setup: workspace },
  { name: 'workspace-dark', scheme: 'dark', setup: workspace },
  {
    name: 'settings',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await expect(page.getByRole('region', { name: app.t('settings.title') })).toBeVisible();
    },
  },
  {
    name: 'ai-review',
    async setup(app, page, ai) {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
    },
  },
  {
    name: 'tree-menu',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
      await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
      await expect(page.getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeVisible();
    },
  },
  {
    name: 'name-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('file.new') }).first().click();
      await page.getByRole('dialog', { name: app.t('file.new') }).getByRole('textbox').fill('draft');
    },
  },
  {
    name: 'toast',
    async setup(app) {
      await app.openFolder({ 'note.md': '# Note', '.housemd.json': '{ images: ' });
      const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
      await expect(app.toast(prefix)).toBeVisible();
    },
  },
  {
    name: 'conflict',
    async setup(app, page) {
      await page.clock.install();
      await app.openFolder({ 'note.md': '# Note\n' });
      await app.openFile('note.md');
      await page.clock.pauseAt(new Date(Date.now() + 10_000));
      await app.typeAtEnd('mine');
      await page.clock.runFor(100);
      await app.writeExternal('note.md', 'theirs, longer text');
      await app.windowFocus();
      await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
    },
  },
  {
    name: 'history',
    async setup(app, page) {
      await page.clock.install({ time: NOW });
      await app.openFolder({ 'note.md': 'v0' });
      await app.openFile('note.md');
      await app.editor().click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('v1');
      await page.keyboard.press('ControlOrMeta+s');
      await expect.poll(() => app.disk('note.md')).toBe('v1');
      await page.getByRole('button', { name: app.t('toolbar.history') }).click();
      const panel = page.getByRole('region', { name: app.t('toolbar.history') });
      await panel.getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).first().click();
      await page.clock.pauseAt(NOW.getTime() + 60_000);
    },
  },
  {
    name: 'tooltip-hover',
    keepMouse: true,
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'uno due tre' });
      await app.openFile('a.md');
      await app.selectRange(4, 7);
      const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
      await bold.hover();
      await expect.poll(() => bold.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
    },
  },
  {
    name: 'focus-button-keyboard',
    async setup(app, page) {
      await workspace(app);
      const button = page.getByRole('button', { name: app.t('folder.new') }).first();
      await button.click();
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
    },
  },
  { name: 'focus-search-keyboard', setup: searchFromKeyboard },
  {
    name: 'focus-search-pointer',
    async setup(app, page) {
      await workspace(app);
      const search = page.getByRole('searchbox', { name: app.t('search.label') });
      await search.click();
      await expect(search).toBeFocused();
    },
  },
  { name: 'focus-search-keyboard-forced-colors', forcedColors: true, setup: searchFromKeyboard },
];

for (const state of STATES) {
  test.describe(state.name, () => {
    test.use({ colorScheme: state.scheme ?? 'light', forcedColors: state.forcedColors ? 'active' : 'none' });

    test('computed styles match the baseline build', async ({ app, page, ai }, testInfo) => {
      await state.setup(app, page, ai);
      // Come visual.spec.ts: niente tooltip sotto il puntatore, transizioni di 0,15 s finite, font pronti.
      if (!state.keepMouse) await page.mouse.move(1279, 799);
      await page.waitForTimeout(300);
      await page.evaluate(() => document.fonts.ready);
      const dump = await page.evaluate(dumpComputedStyles);

      const file = join(OUT, `${state.name}.json`);
      if (testInfo.project.name === 'baseline') {
        await mkdir(OUT, { recursive: true });
        await writeFile(file, JSON.stringify(dump));
        return;
      }
      const before = JSON.parse(await readFile(file, 'utf8')) as StyleDump;
      const diff = styleDifferences(before, dump);
      expect(diff.slice(0, 40), `${diff.length} differenze rispetto a dist-baseline/`).toEqual([]);
    });
  });
}
```

- [ ] **Step 5: Configurazione dell'audit, script, `.gitignore`**

`e2e/audit.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

import base from './playwright.config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PORT = 4174;

const current = base.webServer;
if (!current || Array.isArray(current)) throw new Error('playwright.config.ts: webServer atteso come oggetto singolo');

/**
 * Audit degli stili calcolati (e2e/computed-styles.audit.ts). Prima di cambiare la cascata:
 *   npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
 * poi, dopo il cambio: npm run test:e2e:audit. `current` parte solo dopo `baseline`.
 */
export default defineConfig({
  ...base,
  testMatch: '**/*.audit.ts',
  outputDir: '../test-results/audit',
  reporter: 'list',
  projects: [
    { name: 'baseline', use: { baseURL: `http://localhost:${BASELINE_PORT}` } },
    { name: 'current', dependencies: ['baseline'] },
  ],
  webServer: [
    current,
    {
      command: `npx vite preview --outDir dist-baseline --port ${BASELINE_PORT} --strictPort`,
      cwd: root,
      url: `http://localhost:${BASELINE_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
```

In `package.json`, dopo `"test:e2e"`:

```json
    "test:e2e:audit": "playwright test -c e2e/audit.config.ts"
```

(con la virgola alla fine della riga di `test:e2e`).

In `.gitignore`, dopo `dist`:

```
dist-baseline
```

- [ ] **Step 6: Typecheck e suite e2e invariata**

Run: `npm run lint` poi `npm run test:e2e`
Expected: lint pulito; e2e **98 passed** (le spec non sono cambiate, `visual.spec.ts` importa solo le costanti) e `git status --short` senza PNG modificati. `npm run test:e2e` non raccoglie `*.audit.ts` (`testMatch` è `**/*.spec.ts`).

- [ ] **Step 7: L'audit è deterministico (riferimento = codice di oggi)**

```bash
npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
npm run test:e2e:audit
npm run test:e2e:audit
```

Expected: entrambe le esecuzioni **32 passed** (16 stati × 2 progetti). Se uno stato dà differenze tra due build identiche, la causa è nello stato, non nel CSS: renderlo stabile (orologio fermo con `page.clock`, attesa di una condizione con `expect`) e rieseguire. Escludere una proprietà dal confronto solo se è guidata dal tempo e non stabilizzabile, con una costante commentata in `styleAudit.ts` che dice quale e perché.

- [ ] **Step 8: L'audit vede un cambio di cascata (prova di sensibilità)**

In `src/styles/global.css`, per un momento, cambiare in `.icon` `vertical-align: middle;` in `vertical-align: top;`, poi:

```bash
npm run test:e2e:audit
```

Expected: FAIL negli stati con icone, con righe come `body:1>…>span:0 { vertical-align: middle → top }`. Ripristinare con `git checkout src/styles/global.css` e rieseguire: 32 passed.

- [ ] **Step 9: Commit**

```bash
git add e2e/support/styleAudit.ts e2e/support/notes.ts e2e/computed-styles.audit.ts e2e/audit.config.ts e2e/support/app.ts e2e/visual.spec.ts package.json .gitignore
git commit -m "test: audit degli stili calcolati contro una build di riferimento (npm run test:e2e:audit)"
```

---

### Task 10: `global.css` nei layer `reset` e `base`

**Files:**
- Modify: `src/styles/global.css`, `src/styles/buildCss.test.ts`

**Interfaces:**
- Consumes: `buildCss`, `layerOrder`, `LAYERS`, `appCss` (Task 8); audit (Task 9).
- Produces: ordine dei layer dell'app `reset, base, components, overrides`, che i fogli della fase 4 useranno (`@layer components`).

Perché non cambia nulla a schermo: i CSS Modules non hanno layer, e uno stile senza layer vince su qualsiasi layer dello stesso autore. Oggi `global.css` è caricato per primo, quindi a parità di specificità i moduli vincono già. L'unico cambio possibile: una regola globale che oggi vince **per specificità** su un modulo o su CodeMirror (anche loro senza layer) e domani perde. Lo cerca l'audit.

- [ ] **Step 1: Build di riferimento PRIMA di toccare il CSS**

```bash
git status --short                    # vuoto: global.css è quello di main
npm run build && rm -rf dist-baseline && cp -r dist dist-baseline
```

- [ ] **Step 2: Test che fallisce**

In `src/styles/buildCss.test.ts`, dopo il test su `light-dark()`:

```ts
// Spec WC §4.1: gli stili globali stanno in reset/base, i fogli degli elementi (fase 4) in components.
test('the production CSS declares the app layers in order: reset, base, components, overrides', () => {
  assert.deepEqual(layerOrder(appCss), LAYERS);
});
```

Run: `npx tsx --test src/styles/buildCss.test.ts`
Expected: FAIL, `[] !== ['reset', 'base', 'components', 'overrides']`.

- [ ] **Step 3: Riscrivere `global.css`**

`src/styles/global.css` (stesse regole di oggi, nello stesso ordine, dentro i layer):

```css
/*
 * Ordine dei layer (spec WC §4.1): reset < base < components (fogli @scope degli elementi) < overrides.
 * I CSS Modules non hanno layer e quindi vincono su tutti e quattro: è voluto fino alla loro migrazione.
 */
@layer reset, base, components, overrides;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }

  button {
    font: inherit;
    color: inherit;
  }
}

@layer base {
  :root {
    color-scheme: light dark;

    --c-bg: light-dark(#fbfaf7, #16161a);
    --c-surface: light-dark(#ffffff, #1e1e24);
    --c-sidebar: light-dark(#f3f1ec, #1a1a1f);
    --c-border: light-dark(#e2ded5, #2e2e36);
    --c-text: light-dark(#1f1d1a, #e7e5e0);
    --c-muted: light-dark(#6b665c, #9a978f);
    --c-accent: light-dark(#0f766e, #2dd4bf);
    --c-accent-soft: light-dark(#ccfbf1, #134e4a);
    --c-danger: light-dark(#b91c1c, #f87171);
    --c-warning-bg: light-dark(#fef3c7, #422006);
    --c-highlight: light-dark(#fde68a, #854d0e);
    --c-code-bg: light-dark(#f4f2ee, #25252c);
    /* Focus ring "oreo": scuro-chiaro-scuro, una delle fasce contrasta con qualsiasi sfondo. */
    --c-focus-dark: #101014;
    --c-focus-light: #ffffff;

    --font-ui: 'Space Grotesk', system-ui, sans-serif;
    --font-prose: 'Space Grotesk', system-ui, sans-serif;
    --font-mono: 'Space Mono', ui-monospace, monospace;
    --font-pixel: 'Pixelify Sans', var(--font-ui);

    accent-color: var(--c-accent);
    scrollbar-color: var(--c-border) transparent;
  }

  body {
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--font-ui);
    font-size: 15px;
  }

  /*
   * Focus ring "oreo": tre fasce di 2px (scuro, chiaro, scuro) disegnate con box-shadow, che segue i
   * bordi arrotondati. Il contorno trasparente sopra la fascia centrale serve in forced-colors (Windows
   * ad alto contrasto), dove le ombre spariscono e il contorno prende il colore di sistema.
   */
  :focus-visible {
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--c-focus-dark),
      0 0 0 4px var(--c-focus-light),
      0 0 0 6px var(--c-focus-dark);
  }

  /* Esplicito, senza contare sulla sostituzione del colore trasparente da parte del browser. */
  @media (forced-colors: active) {
    :focus-visible {
      outline-color: Highlight;
    }
  }

  /*
   * Campi di testo ed editor soddisfano :focus-visible anche al clic: lì il ring compare solo se il focus
   * è arrivato dalla tastiera (data-focus-source, src/ui/focusSource.ts). Il campo ha già il suo bordo.
   */
  :root[data-focus-source='pointer'] :is(input, textarea, select, [contenteditable]):focus-visible {
    outline: none;
    box-shadow: none;
  }

  ::highlight(housemd-search) {
    background-color: var(--c-highlight);
    color: inherit;
  }

  .icon {
    display: inline-block;
    flex: none;
    width: var(--icon-size, 20px);
    height: var(--icon-size, 20px);
    background-color: currentColor;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: 100% 100%;
    image-rendering: pixelated;
    vertical-align: middle;
  }

  /* Cambio tema: nessuna dissolvenza incrociata; il vecchio tema sta sopra e viene "mangiato" a blocchi
     dalla maschera animata in src/theme/pixelTransition.ts. */
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
  }

  ::view-transition-old(root) {
    z-index: 1;
    image-rendering: pixelated;
  }

  /*
   * Tooltip con Anchor Positioning: il pulsante porta `class="tooltip"`, `aria-label` (nome accessibile)
   * e `data-tooltip` (testo visibile). `anchor-scope` fa sì che ogni tooltip si ancori al proprio pulsante.
   * Compare anche al focus da tastiera; sotto il pulsante, girato sopra se non c'è spazio.
   */
  .tooltip {
    anchor-name: --tooltip-anchor;
    anchor-scope: --tooltip-anchor;
  }

  .tooltip::after {
    content: attr(data-tooltip);
    position: fixed;
    position-anchor: --tooltip-anchor;
    position-area: block-end;
    position-try-fallbacks: flip-block;
    margin-top: 6px;
    padding: 4px 8px;
    background: var(--c-surface);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
    font: 12px/1.3 var(--font-pixel);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
    pointer-events: none;
    z-index: 1000;
  }

  .tooltip:hover::after,
  .tooltip:focus-visible::after {
    opacity: 1;
    visibility: visible;
  }
}
```

Controllo: `git diff --stat src/styles/global.css` e una lettura del diff con `git diff -w src/styles/global.css` (ignorando l'indentazione): devono comparire solo le righe `@layer` e due spostamenti: `:root` dopo il blocco `reset` (oggi precede `*`) e `button` prima di `body` (oggi lo segue). Nessuna delle regole spostate ha proprietà in comune con quelle che scavalca, e `reset` contiene solo regole senza sovrapposizioni con `base`: l'ordine tra i due layer non cambia il risultato. Nessuna dichiarazione cambiata.

- [ ] **Step 4: Il test di build passa**

Run: `npx tsx --test src/styles/buildCss.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Audit degli stili calcolati**

Run: `npm run test:e2e:audit`
Expected: **32 passed**, nessuna differenza rispetto a `dist-baseline/`.

Se uno stato mostra differenze: è una regola globale che oggi vinceva per specificità su un modulo o su CodeMirror. **Non** rigenerare nulla e non cambiare la dichiarazione: spostare quella sola regola fuori dai layer, in fondo a `global.css`, con un commento che dice quale foglio la batteva e che va ripresa quando quel foglio passa a `@scope` (fase 4); rieseguire fino a 32 passed. Annotare il caso nel messaggio di commit e nella descrizione della PR.

- [ ] **Step 6: Suite e2e con gli stessi snapshot**

```bash
npm run test:e2e
git status --short
```

Expected: **98 passed**; `git status` mostra solo `src/styles/global.css` e `src/styles/buildCss.test.ts`, nessun PNG.

- [ ] **Step 7: Suite, typecheck, bundle**

```bash
npm test
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c
gzip -c dist/assets/index-*.css | wc -c
```

Expected: tutto verde. JS principale gzip **identico** al Task 1 (prova che `src/dom/` non entra nel bundle prima della fase 4); CSS gzip con poche decine di byte in più (le righe `@layer`). Annotare i due numeri per la PR.

- [ ] **Step 8: Commit**

```bash
git add src/styles/global.css src/styles/buildCss.test.ts
git commit -m "refactor: stili globali nei layer reset e base, ordine dei layer verificato sulla build"
```

---

### Task 11: Documentazione, verifica finale, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Spec**

Nello spec, in quest'ordine:

1. Intestazione: `Data: 2026-09-27 · **Revisione: 2026-10-02**`.
2. §3.1, cartella `dom/`: sostituire la riga di `icon.ts` con

```
    maskIcon.ts  maskIcon.test.ts  ← <span class="icon"> da un URL (era Icon.tsx)
    icon.ts                        ← icon(name, { size, className }): nome → URL (icons.ts) → maskIcon
```

   e nella cartella `testing/` aggiungere `domEnv.test.ts` accanto a `domEnv.ts`.
3. §5.1, nel blocco di codice: la firma di `watch` diventa

```ts
  /** Iscrizione a uno store legata al ciclo di vita: `fn` gira subito e a ogni notifica. */
  protected watch(store: Subscribable, fn: () => void, signal: AbortSignal): void {
    // Un signal già interrotto non emette più 'abort': l'iscrizione resterebbe per sempre.
    if (signal.aborted) return;
    const off = store.subscribe(fn);
    signal.addEventListener('abort', off, { once: true });
    fn();
  }
```

   con sotto il blocco la riga: "`watch` riceve lo store, non il metodo `subscribe` staccato: alcuni store lo espongono come metodo di un oggetto (`i18nStore`, `routeStore`, `themeStore`, `UpdateFlow`), altri come arrow function (`Workspace`, `AiController`)."
4. §5.2, punto 1: aggiungere "Chiavi `innerHTML`, `outerHTML`, `srcdoc` e `on…` in stringa: errore a runtime (le prime tre anche nei tipi). Ogni altra chiave è una proprietà se esiste sull'elemento, altrimenti un attributo; `true` = attributo booleano vuoto, `false`/`undefined`/`null` = niente." Punto 2: "`update` gira su ogni nodo, nuovo o riusato; `moveBefore` solo con `parent` connesso." Punto 3: "`toggleAttr(node, name, on, value = '')`."
5. §7 fase 2: aggiungere in fondo all'elenco "5. **Fatta** (piano 3). In più: controlli statici `define` e `@scope` di §8.3 attivi da subito; audit degli stili calcolati (`npm run test:e2e:audit`, §8.4)."
6. §8.2, paragrafo "Limiti di jsdom da verificare nella fase 2": sostituirlo con "Limiti di jsdom 30.1.1, verificati nella fase 2: mancano `moveBefore`, `showModal`/`closedBy`, Popover (`popover`, `showPopover`), `commandForElement`, `CSS.highlights`/`Highlight`, Anchor Positioning. Ci sono `customElements`, `MutationObserver`, `role`/`ariaLabel` come proprietà; `addEventListener` accetta solo l'`AbortSignal` della stessa `window` (quello di Node dà `TypeError`). jsdom, come Chromium, toglie il focus a un nodo spostato con `insertBefore`; che `moveBefore` lo conservi si verifica solo in Chromium, con gli e2e della fase 6 su albero e ricerca. Gli stub entrano nel test che li usa, dalla fase 4; i comportamenti reali li verifica Playwright o la checklist manuale." Nella tabella dei test nuovi aggiungere le righe `testing/domEnv.test.ts` (globali da una sola `window`, signal, custom element) e `dom/maskIcon.test.ts` (stessa uscita di `Icon.tsx`).
7. §8.3: sotto l'elenco, "Il controllo su `customElements.define` e quello sui CSS di `src/elements/` sono attivi dalla fase 2: passano a vuoto finché non esistono elementi, con casi sintetici che provano che scattano."
8. §8.4, paragrafo **Esecuzione**: aggiungere "**Audit degli stili calcolati** (`npm run test:e2e:audit`, `e2e/audit.config.ts`): gli stessi stati sulla build di riferimento in `dist-baseline/` (porta 4174) e sulla build corrente; ogni proprietà calcolata di ogni elemento e pseudo-elemento deve coincidere. Si usa prima e dopo ogni cambio di cascata (layer, `@scope`, spostamento di fogli), finché la struttura del DOM è la stessa. Copre focus da tastiera, `forced-colors` e tooltip al passaggio, che gli snapshot non vedono."
9. §10, R19: mitigazione "`buildCss.test.ts` con un foglio di prova `@scope` e l'ordine dei layer calcolato per prima comparsa (il minificatore riscrive la dichiarazione `@layer`), dalla fase 2."
10. §13, punto 2: "`docs/superpowers/plans/2026-10-01-housemd-wc-02-fase-1-logica-pura.md` (fase 1, PR #7); `docs/superpowers/plans/2026-10-02-housemd-wc-03-fase-2-infrastruttura-dom.md` (fase 2); fase 3 (React 19) da scrivere."

- [ ] **Step 2: README e CLAUDE.md**

In `README.md`, nel blocco dei comandi, dopo la riga di `npm run test:e2e`:

```
npm run test:e2e:audit # stili calcolati uguali a dist-baseline/ (prima: build copiata in dist-baseline/)
```

In `CLAUDE.md`, in fondo a "## Regole":

```markdown
- Un cambio alla cascata (layer, `@scope`, fogli spostati) non deve cambiare l'aspetto: prima del cambio
  `npm run build && rm -rf dist-baseline && cp -r dist dist-baseline`, dopo `npm run test:e2e:audit`.
```

- [ ] **Step 3: Verifica finale**

```bash
npm test
npm run lint
npm run build
npm run test:e2e -- --repeat-each=2
npm run test:e2e:audit
git status --short
```

Expected: `npm test` = baseline del Task 1 + **32** test nuovi (domEnv 3, el 8, uid 2, maskIcon 2, list 7, element 4, architecture 3, buildCss 3: `layerOrder`, `@scope`, ordine dei layer dell'app), lint e build puliti, e2e verde due volte (196 passed), audit 32 passed, `git status` vuoto.

- [ ] **Step 4: Commit della documentazione**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md README.md CLAUDE.md
git commit -m "docs: spec, README e CLAUDE.md allineati alla fase 2 (helper DOM, layer, audit degli stili)"
```

- [ ] **Step 5: PR (solo con il via di Davide)**

Chiedere a Davide il permesso di fare push. Con il via:

```bash
git push -u origin refactor/fase-2-infrastruttura-dom
gh pr create --base main --title "Fase 2 Web Components: helper DOM, HmdElement, layer CSS e audit degli stili" --body "$(cat <<'EOF'
## Cosa cambia

- `src/dom/`: `el()`, `setText`, `toggleAttr`, `reconcileList`, `HmdElement`, `uid`, icone; ambiente jsdom in `src/testing/domEnv.ts`. Nessun componente li usa ancora (fase 4): il JS di produzione è identico.
- `global.css` nei layer `reset` e `base`; ordine `reset, base, components, overrides` verificato sulla build.
- `buildCss.test.ts`: `@scope` e layer intatti dopo il minificatore (foglio di prova).
- `architecture.test.ts`: `customElements.define` solo in `elements/define.ts`; CSS di `src/elements/` solo `@scope` con radici ammesse.
- Nuovo `npm run test:e2e:audit`: stili calcolati di 16 stati confrontati con una build di riferimento.

## Verifica

- `npm test`: <riepilogo>
- `npm run test:e2e`: 98 passed due volte, snapshot invariati
- `npm run test:e2e:audit`: 32 passed contro la build di `main`
- Bundle gzip: JS <prima> → <dopo> (identico), CSS <prima> → <dopo>
EOF
)"
```

Sostituire i segnaposto `<…>` della descrizione con i numeri annotati ai Task 1, 10 e 11 prima di lanciare il comando. Merge solo con approvazione esplicita di Davide.
