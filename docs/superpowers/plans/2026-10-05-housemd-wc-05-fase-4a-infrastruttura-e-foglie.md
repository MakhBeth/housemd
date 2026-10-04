# HouseMD Web Components — Piano 5: fase 4a, infrastruttura degli elementi e prime foglie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far nascere i primi custom element dell'app dentro React 19 (`hmd-theme-switcher`, `hmd-conflict-bar`, `hmd-notice`, `hmd-update-notice`, `hmd-toasts`) con tutta l'infrastruttura che servirà alle fasi successive, senza cambiare aspetto né comportamento.

**Architecture:** Ogni elemento estende `HmdElement` (fase 2), rende nel light DOM lo **stesso albero** che rendeva il componente React e ha un foglio `@layer components { @scope (hmd-x) { … } }`. L'host ha `display: contents`, così il layout e l'audit degli stili calcolati (reso trasparente ai wrapper `hmd-*`) restano confrontabili con `main`. Gli ingressi sono proprietà JS (store, testi), le uscite `CustomEvent` tipizzati in `src/elements/events.ts`; React 19 assegna le une e ascolta gli altri da solo (prop `onhmd-…`), purché `define.ts` sia importato prima del primo render. Gli elementi ricevono gli store (i18n, tema, aggiornamenti) come proprietà: nessun singleton importato dagli elementi.

**Tech Stack:** TypeScript 7, React 19.3, Custom Elements, CSS `@scope`/`@layer`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§3.1, §4, §5.1–5.3, §7 fase 4, §8.2–8.4, R1–R3, R7–R9, R11). Il Task 9 aggiorna lo spec (vedi "Scostamenti dallo spec").

## Global Constraints

- **Branch di integrazione** (spec §7): `feat/web-components`, creato da `main` (`a3ebc6f`, fase 3 fatta), lavorato nel worktree `../housemd-wc`. Le fasi 4–8 restano su questo branch; **nessun merge in `main`** in questo piano (uno solo alla fine della fase 8, con il via di Davide). Push solo con il via di Davide.
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi**; `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/` costruita da `main` al Task 1. Nessuno snapshot si rigenera.
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri), DOM solo con `el()`/`textContent` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css` in `src/elements/<nome>/`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso l'esterno con il `signal`.
- **Mai ricostruire un nodo che può avere il focus**: i pulsanti si creano una volta e si aggiornano (`setText`, `toggleAttr`).
- Testi solo da `t()` (store i18n); nessuna chiave nuova in questo piano. Tooltip: `.tooltip` + `data-tooltip` + `aria-label`, mai `title`.
- Commenti e commit in italiano, identificatori in inglese, commit con prefisso convenzionale, senza righe di attribuzione.
- Le regole e2e di `CLAUDE.md` valgono (ruolo e nome accessibile, testi da `en.json`).
- **Mai giudicare un comando di verifica dal suo output filtrato** (niente `| grep`/`| tail` sui test).
- Verifica di ogni task che tocca un elemento: `npm test`, `npm run lint`, `npm run test:e2e` (102), `npm run test:e2e:dev` (87), `npm run test:e2e:audit` (32). La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.

## Misure prese scrivendo il piano (05/10, su `main` = `a3ebc6f`)

1. Un hook di Node registrato con `--import` (`module.registerHooks`) che risolve gli import `…?url` in una stringa permette a `tsx --test` di caricare `src/ui/icons.ts` e quindi `src/dom/icon.ts`: verificato.
2. In jsdom, con React 19 e `react-dom/client`, un tag `hmd-*` definito prima del render riceve gli array come **proprietà** (nessun attributo) e una prop `onhmd-pick` riceve il `CustomEvent('hmd-pick')`: verificato.
3. Inventario dei componenti (dettaglio per componente, consumer, test che li coprono) fatto il 05/10: `ThemeSwitcher` (e2e tema, snapshot workspace), `ConflictBar` (e2e `external`, snapshot `conflict`), `Toasts` (e2e vari, snapshot `toast`) sono coperti; `Notice`/`UpdateNotice` **non hanno e2e né snapshot**.

## Scostamenti dallo spec (da riportare nello spec al Task 9)

1. **La fase 4 è divisa in tre piani**: 4a (questo: infrastruttura, tema, conflitto, avvisi, toast), 4b (dialog come funzioni-Promise: sei componenti consumer da riscrivere), 4c (start screen e foglie AI). Ognuno chiude con le suite verdi.
2. **Host con `display: contents`** per le foglie dentro layout React: l'albero interno resta identico a quello di React, il layout non cambia e l'audit degli stili calcolati, reso trasparente ai wrapper `hmd-*` con `display: contents` (Task 4), resta utilizzabile per tutta la convivenza.
3. **Store passati come proprietà anche durante la convivenza**: `I18nProvider` espone il suo store (`useI18nStore()`), `useTheme.ts` esporta `getThemeStore()`; React li passa agli elementi. Lo spostamento in `main.ts` resta alla fase 7.
4. **`HmdElement.reconnect()`**: rifà le iscrizioni quando cambia uno store passato come proprietà dopo il collegamento.
5. **Hook di Node per i test** (`src/testing/assetHooks.ts`, in `npm test`): `?url` e `.css` diventano moduli finti, così gli elementi che importano icone e fogli sono testabili in jsdom.
6. **I toast conservano un difetto**: ogni nuovo array `items` riavvia i timer dei toast informativi (come l'effetto React di oggi). È un comportamento visibile, quindi resta; correggerlo è una decisione a parte.

## Review Focus

1. **Ciclo del tema con le animazioni**: l'etichetta del pulsante deve essere già nuova quando la view transition fotografa la pagina; l'elemento si iscrive allo store del tema e si aggiorna nella notifica sincrona. Task 5 (test jsdom sull'ordine della notifica) + e2e esistente `theme-i18n.spec.ts`.
2. **Focus sui pulsanti durante gli aggiornamenti** (Aggiorna disabilitato mentre `busy`, toast che si aggiungono): i nodi esistenti non si ricreano. Task 7 (identità del pulsante dopo `busy`), Task 8 (identità del toast riusato per chiave).
3. **Popover manuali** (avvisi, toast): aperti solo dopo il collegamento, mai `hidePopover()` su un nodo staccato, riaperti dopo un riattacco. Task 7 e 8, con lo stub del Task 2.
4. **Cambio di lingua a caldo**: ogni testo e ogni etichetta degli elementi segue lo store i18n senza rimontare nulla. Un test per elemento (Task 5–8).
5. **Elementi staccati**: nessun listener o iscrizione o timer residuo (R3). Un test per elemento (Task 5–8).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `src/testing/assetHooks.ts`, `src/testing/popoverStub.ts`, `package.json` | Test degli elementi in Node: import di icone e fogli, Popover finto. |
| `src/elements/reactInterop.dom.test.ts` | Prova che React 19 passa proprietà ed eventi ai tag `hmd-*`. |
| `src/dom/element.ts` (+ test) | `reconnect()`. |
| `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/main.tsx` | Registro degli elementi, eventi tipizzati, tipi JSX dei tag, definizione prima del render. |
| `src/i18n/I18nProvider.tsx`, `src/theme/useTheme.ts` | Store raggiungibili da React per passarli agli elementi. |
| `e2e/support/styleAudit.ts` | Audit trasparente ai wrapper `hmd-*` con `display: contents`. |
| `src/elements/theme-switcher/*` | `hmd-theme-switcher` (era `ui/ThemeSwitcher.tsx`). |
| `src/elements/conflict-bar/*` | `hmd-conflict-bar` (era `ui/ConflictBar.tsx` + `.conflict` di `WorkspaceView.module.css`). |
| `src/elements/notice/*`, `src/elements/update-notice/*` | `hmd-notice`, `hmd-update-notice` (erano `ui/Notice.tsx`, `ui/Notice.module.css`, `ui/UpdateNotice.tsx`). |
| `src/elements/toasts/*` | `hmd-toasts` (era `ui/Toasts.tsx`, `ui/Toasts.module.css`). |
| `src/ui/WorkspaceView.tsx`, `src/App.tsx` | Montano i tag al posto dei componenti. |

Schema comune di un elemento (vale per i Task 5–8):

```ts
// <nome>.element.ts
import { HmdElement } from '../../dom/element';
import './<nome>.css';

export class HmdNome extends HmdElement {
  // ingressi: proprietà con accessor su campi privati (React 19 le assegna solo se esistono sull'istanza)
  // connect(signal): crea il DOM la prima volta (guardia su un campo), poi watch() sugli store
  // render(): aggiorna testi e attributi dei nodi esistenti, senza ricrearli
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-nome': HmdNome;
  }
}
```

---

### Task 1: Branch di integrazione e baseline

**Files:** nessuno.

- [ ] **Step 1: Branch e worktree**

```bash
cd /home/davidedipumpo/Projects/housemd
git switch main && git status --short                     # pulito, HEAD a3ebc6f (o successivo)
git branch feat/web-components main
git worktree add ../housemd-wc feat/web-components
cd ../housemd-wc && npm ci
```

Se questo piano è già committato su `feat/web-components` (primo commit sopra `main`), saltare `git branch` e usare `git worktree add ../housemd-wc feat/web-components`.

- [ ] **Step 2: Baseline e build di riferimento per l'audit**

```bash
npm test                                         # 602 pass
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c           # annotare (05/10: 432419)
rm -rf dist-baseline && cp -r dist dist-baseline # riferimento dell'audit: main prima degli elementi
npm run test:e2e                                 # 102 passed
npm run test:e2e:dev                             # 87 passed
npm run test:e2e:audit                           # 32 passed
git status --short                               # vuoto (dist-baseline è ignorata)
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla** nei task successivi.

---

### Task 2: Strumenti di test per gli elementi

**Files:**
- Create: `src/testing/assetHooks.ts`, `src/testing/popoverStub.ts`, `src/elements/reactInterop.dom.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` = `tsx --import ./src/testing/assetHooks.ts --test`; `installPopoverStub(): void`, `isPopoverOpen(el: Element): boolean` da `src/testing/popoverStub.ts`.

- [ ] **Step 1: Test che fallisce (import di un modulo con icone)**

`src/elements/reactInterop.dom.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { icon } from '../dom/icon';

/** Elemento di prova: le proprietà esistono sull'istanza prima del render, come vuole React 19 (spec WC §5.1). */
class HmdInteropProbe extends HTMLElement {
  #items: string[] = [];
  get items(): string[] {
    return this.#items;
  }
  set items(value: string[]) {
    this.#items = value;
  }
}
customElements.define('hmd-interop-probe', HmdInteropProbe);

test('React 19 assigns properties to a defined hmd-* tag and listens to its hmd-* events', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const items = ['a'];
  let detail: unknown = null;
  flushSync(() =>
    root.render(createElement('hmd-interop-probe', { items, 'onhmd-pick': (event: CustomEvent) => (detail = event.detail) })),
  );
  const probe = host.querySelector('hmd-interop-probe') as HmdInteropProbe;
  assert.equal(probe.items, items);
  assert.equal(probe.hasAttribute('items'), false);
  probe.dispatchEvent(new CustomEvent('hmd-pick', { detail: 42, bubbles: true }));
  assert.equal(detail, 42);
  flushSync(() => root.unmount());
});

test('modules that import icons load under tsx (assetHooks)', () => {
  assert.equal(icon('close').localName, 'span');
});
```

Run: `npx tsx --test src/elements/reactInterop.dom.test.ts`
Expected: FAIL al caricamento (`ERR_UNKNOWN_FILE_EXTENSION` o `Cannot find module` per un `…svg?url`).

- [ ] **Step 2: Hook per gli asset**

`src/testing/assetHooks.ts`:

```ts
/**
 * Hook di Node per `npm test` (registrato con --import, prima di qualsiasi import dei test): gli import
 * `…?url` di Vite diventano una stringa con il percorso, i fogli `.css` un modulo vuoto. Così gli elementi,
 * che importano icone (`dom/icon.ts` → `ui/icons.ts`) e il proprio foglio, si caricano in jsdom.
 */
import { registerHooks } from 'node:module';

const ASSET = 'housemd-asset:';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) return { url: ASSET + specifier.slice(0, -'?url'.length), shortCircuit: true };
    if (specifier.endsWith('.css')) return { url: `${ASSET}css`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === `${ASSET}css`) return { format: 'module', source: 'export {};', shortCircuit: true };
    if (url.startsWith(ASSET)) {
      return { format: 'module', source: `export default ${JSON.stringify(`/${url.slice(ASSET.length)}`)};`, shortCircuit: true };
    }
    return next(url, context);
  },
});
```

In `package.json`:

```json
    "test": "tsx --import ./src/testing/assetHooks.ts --test",
```

- [ ] **Step 3: Stub della Popover API**

`src/testing/popoverStub.ts`:

```ts
/**
 * jsdom 30 non ha la Popover API (spec WC §8.2): `showPopover`/`hidePopover` segnano lo stato in un
 * attributo di prova. Il comportamento vero (top layer, chiusura alla rimozione) lo verificano gli e2e.
 */
const OPEN = 'data-test-popover-open';

export function installPopoverStub(): void {
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.setAttribute(OPEN, '');
    },
    hidePopover(this: HTMLElement) {
      if (!this.isConnected) throw new DOMException('elemento non collegato', 'InvalidStateError');
      this.removeAttribute(OPEN);
    },
  });
}

export function isPopoverOpen(el: Element): boolean {
  return el.hasAttribute(OPEN);
}
```

(Lancia come Chromium su un nodo staccato: un elemento che chiama `hidePopover()` dopo il distacco fallisce anche nei test.)

- [ ] **Step 4: Verde**

Run: `npm test` (con il nuovo script)
Expected: 604 pass (602 + 2), nessun errore di caricamento. Poi `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/testing/assetHooks.ts src/testing/popoverStub.ts src/elements/reactInterop.dom.test.ts package.json
git commit -m "test: hook per icone e fogli in npm test, Popover finta e prova dell'interop di React 19 con i tag hmd-*"
```

---

### Task 3: Infrastruttura degli elementi nell'app

**Files:**
- Create: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/elements/define.dom.test.ts`
- Modify: `src/dom/element.ts`, `src/dom/element.test.ts`, `src/main.tsx`, `src/i18n/I18nProvider.tsx`, `src/theme/useTheme.ts`

**Interfaces:**
- Produces:
  - `HmdElement.reconnect(): void` (protetto): se collegato, interrompe il `signal` corrente e richiama `connect` con uno nuovo; se staccato, non fa nulla.
  - `src/elements/events.ts`: `export interface HmdEvents { }` (i task 6–8 aggiungono le voci), `emit<K extends keyof HmdEvents>(target: Element, type: K, detail: HmdEvents[K]['detail']): void` (evento con `bubbles: true`).
  - `src/elements/define.ts`: `defineElements(elements)` registra saltando i nomi già definiti; al caricamento registra l'elenco `ELEMENTS` (vuoto in questo task, i task 5–8 lo riempiono).
  - `events.ts` estende `HTMLElementEventMap` con `HmdEvents` (tipi di `addEventListener` e della chiave `on` di `el()`).
  - `src/elements/jsx.d.ts`: `HmdProps<P, E extends keyof HmdEvents = never>` e l'augment di `React.JSX.IntrinsicElements` (vuoto in questo task).
  - `useI18nStore(): I18nStore` da `src/i18n/I18nProvider.tsx`; `getThemeStore(): ThemeStore` da `src/theme/useTheme.ts`.

- [ ] **Step 1: Test di `reconnect()` (fallisce)**

In fondo a `src/dom/element.test.ts`:

```ts
class ReconnectProbe extends HmdElement {
  signals: AbortSignal[] = [];
  protected connect(signal: AbortSignal): void {
    this.signals.push(signal);
  }
  again(): void {
    this.reconnect();
  }
}
customElements.define('hmd-reconnect-probe', ReconnectProbe);

test('reconnect aborts the current signal and connects again; detached it does nothing', () => {
  const el = document.createElement('hmd-reconnect-probe') as ReconnectProbe;
  el.again();
  assert.equal(el.signals.length, 0);
  document.body.append(el);
  el.again();
  assert.equal(el.signals.length, 2);
  assert.equal(el.signals[0].aborted, true);
  assert.equal(el.signals[1].aborted, false);
  el.remove();
  assert.equal(el.signals[1].aborted, true);
});
```

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/dom/element.test.ts` → FAIL (`this.reconnect is not a function`).

- [ ] **Step 2: `reconnect()`**

In `src/dom/element.ts`, dentro la classe, dopo `disconnectedCallback`:

```ts
  /** Rifà le iscrizioni (per esempio dopo un cambio di store passato come proprietà): come staccare e riattaccare. */
  protected reconnect(): void {
    if (!this.#abort) return;
    this.#abort.abort();
    this.#abort = new AbortController();
    this.connect(this.#abort.signal);
  }
```

Run lo stesso test → PASS.

- [ ] **Step 3: Eventi, registro e tipi JSX**

`src/elements/events.ts`:

```ts
/**
 * Eventi che gli elementi mandano verso chi li usa (spec WC §5.1): `bubbles: true`, nomi minuscoli con
 * trattino. In React 19 si ascoltano con la prop `on<nome>` (es. `onhmd-toast-dismiss`).
 */
export interface HmdEvents {}

export function emit<K extends keyof HmdEvents>(target: Element, type: K, detail: HmdEvents[K] extends CustomEvent<infer D> ? D : never): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

// Così `addEventListener('hmd-…', …)` e la chiave `on` di `el()` conoscono il tipo di `detail`.
declare global {
  interface HTMLElementEventMap extends HmdEvents {}
}
```

`src/elements/define.ts`:

```ts
/**
 * Unico punto con `customElements.define` (spec WC §8.3). `main.tsx` lo importa prima del primo render:
 * React 19 assegna come proprietà solo ciò che esiste già sull'istanza (spec §5.1, R9). Con l'HMR di Vite il
 * modulo può rieseguire: un nome già definito si salta (R8).
 */
type Definitions = readonly (readonly [string, CustomElementConstructor])[];

const ELEMENTS: Definitions = [];

export function defineElements(elements: Definitions): void {
  for (const [name, ctor] of elements) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }
}

defineElements(ELEMENTS);
```

`src/elements/jsx.d.ts`:

```ts
/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { HmdEvents } from './events';

/** Proprietà dell'elemento (tutte facoltative per JSX) più gli eventi che manda, come prop `on<nome>`. */
export type HmdProps<P, E extends keyof HmdEvents = never> = Partial<P> & {
  [K in E as `on${K}`]?: (event: HmdEvents[K]) => void;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {}
  }
}
```

In `src/main.tsx`, subito dopo `import './styles/global.css';`:

```ts
import './elements/define';
```

- [ ] **Step 4: Test del registro**

`src/elements/define.dom.test.ts`:

```ts
import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { defineElements } from './define';

class DefineProbe extends HTMLElement {}

test('defining again (Vite HMR re-runs define.ts) skips the names already defined', () => {
  defineElements([['hmd-define-probe', DefineProbe]]);
  assert.doesNotThrow(() => defineElements([['hmd-define-probe', class extends HTMLElement {}]]));
  assert.equal(customElements.get('hmd-define-probe'), DefineProbe);
});
```

Run: `npm test` → verde (606 pass).

- [ ] **Step 5: Store raggiungibili da React**

In `src/i18n/I18nProvider.tsx`:
- `import { createI18nStore, type I18nStore } from '../state/i18nStore';`
- in `I18nValue` aggiungere `store: I18nStore;` (con commento: "Lo store stesso, da passare ai custom element come proprietà.");
- nel `useMemo` aggiungere `store,`;
- in fondo:

```ts
/** Lo store della lingua, per i custom element (che non leggono il Context di React). */
export function useI18nStore(): I18nStore {
  return useI18n().store;
}
```

In `src/theme/useTheme.ts` la funzione `themeStore()` diventa esportata e si chiama `getThemeStore()` (aggiornare i due usi interni). Commento: "Un solo store per pagina, creato al primo uso (legge la preferenza salvata). Esportato per i custom element, che lo ricevono come proprietà."

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint && npm run test:e2e && npm run test:e2e:dev
git add src/dom/element.ts src/dom/element.test.ts src/elements/define.ts src/elements/events.ts src/elements/jsx.d.ts src/elements/define.dom.test.ts src/main.tsx src/i18n/I18nProvider.tsx src/theme/useTheme.ts
git commit -m "feat: registro degli elementi prima del render, eventi e tipi JSX dei tag hmd-*, store di lingua e tema per gli elementi"
```

Expected: 606 pass, lint pulito, e2e 102, dev 87.

---

### Task 4: Audit trasparente ai wrapper `hmd-*`

**Files:**
- Modify: `e2e/support/styleAudit.ts`

**Interfaces:**
- Produces: in `dumpComputedStyles`, un elemento `hmd-*` con `display: contents` non compare nel dump e non conta nei percorsi: i suoi figli hanno lo stesso percorso che avrebbero senza di lui.

- [ ] **Step 1: Percorsi sull'albero "appiattito"**

In `e2e/support/styleAudit.ts`, dentro `dumpComputedStyles`, sostituire il calcolo di `pathOf` e il ciclo:

```ts
  // I wrapper dei custom element con `display: contents` non hanno un box: si saltano, così l'albero
  // confrontato è quello di React (spec WC fase 4, host trasparenti).
  const transparent = (node: Element) => node.localName.startsWith('hmd-') && getComputedStyle(node).display === 'contents';
  const flatChildren = (node: Element): Element[] => [...node.children].flatMap((child) => (transparent(child) ? flatChildren(child) : [child]));
  const parentOf = (node: Element): Element | null => {
    let parent = node.parentElement;
    while (parent && transparent(parent)) parent = parent.parentElement;
    return parent;
  };
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement; node = parentOf(node)) {
      const parent = parentOf(node);
      const index = parent ? flatChildren(parent).indexOf(node) : 0;
      parts.unshift(`${node.localName}:${index}`);
    }
    return parts.join('>') || 'html';
  };
```

e nel ciclo, subito dopo `if (skip.has(el.localName)) continue;`:

```ts
    if (transparent(el)) continue;
```

- [ ] **Step 2: L'audit resta verde e sensibile**

```bash
npm run lint
npm run test:e2e:audit          # 32 passed (nessun hmd-* ancora: nessun cambiamento)
```

Prova di sensibilità (poi ripristinare con `git checkout src/styles/global.css`): in `src/styles/global.css` cambiare `.icon { vertical-align: middle; }` in `top`; `npm run test:e2e:audit` deve FALLIRE.

- [ ] **Step 3: Commit**

```bash
git add e2e/support/styleAudit.ts
git commit -m "test: l'audit degli stili salta i wrapper hmd-* con display: contents"
```

---

### Task 5: `hmd-theme-switcher`

**Files:**
- Create: `src/elements/theme-switcher/theme-switcher.element.ts`, `src/elements/theme-switcher/theme-switcher.css`, `src/elements/theme-switcher/theme-switcher.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/ThemeSwitcher.tsx`

**Interfaces:**
- Consumes: `HmdElement`, `getThemeStore()`, `useI18nStore()`, `el`, `toggleAttr`, `icon`.
- Produces: `HmdThemeSwitcher` con proprietà `store: ThemeStore | null`, `i18n: I18nStore | null`; nessun evento (chiama `store.setTheme`).

- [ ] **Step 1: Test (fallisce)**

`src/elements/theme-switcher/theme-switcher.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { createThemeStore } from '../../state/themeStore';

function mount() {
  const theme = createThemeStore({ initial: 'auto', persist() {}, transition: (apply) => apply(), apply() {}, watchSystem: () => () => {} });
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'theme.auto': 'AUTO' } }),
    persist() {},
  });
  const el = document.createElement('hmd-theme-switcher');
  el.store = theme;
  el.i18n = i18n;
  document.body.append(el);
  return { el, theme, i18n, button: el.querySelector('button')! };
}

test('the button shows the current theme and cycles auto → light → dark, staying the same node', () => {
  const { el, theme, button } = mount();
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.auto']);
  assert.equal(button.getAttribute('data-tooltip'), EN_MESSAGES['theme.auto']);
  assert.ok(button.classList.contains('tooltip'));
  button.click();
  assert.equal(theme.getState(), 'light');
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.light']);
  button.click();
  assert.equal(theme.getState(), 'dark');
  assert.equal(el.querySelector('button'), button);
  el.remove();
});

test('the label is already new when the store notifies (inside the view transition)', () => {
  const { el, theme, button } = mount();
  const seen: (string | null)[] = [];
  theme.subscribe(() => seen.push(button.getAttribute('aria-label')));
  theme.setTheme('dark');
  assert.deepEqual(seen, [EN_MESSAGES['theme.dark']]);
  el.remove();
});

test('a language change relabels the button', async () => {
  const { el, i18n, button } = mount();
  await i18n.setLocale('it');
  assert.equal(button.getAttribute('aria-label'), 'AUTO');
  el.remove();
});

test('detached, it no longer follows the store', () => {
  const { el, theme, button } = mount();
  el.remove();
  theme.setTheme('dark');
  assert.equal(button.getAttribute('aria-label'), EN_MESSAGES['theme.auto']);
});
```

Run: `npm test` → FAIL (`el.store` non esiste / `button` è `null`).

- [ ] **Step 2: Elemento e foglio**

`src/elements/theme-switcher/theme-switcher.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import type { I18nStore } from '../../state/i18nStore';
import type { ThemeStore } from '../../state/themeStore';
import { nextTheme, type ThemePref } from '../../theme/theme';
import type { IconName } from '../../ui/icons';
import './theme-switcher.css';

const THEME_ICON: Record<ThemePref, IconName> = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };

/**
 * Cicla auto → chiaro → scuro (era ThemeSwitcher.tsx). Si iscrive direttamente allo store del tema: la
 * notifica arriva dentro la view transition e il pulsante deve essere già aggiornato quando la pagina viene
 * fotografata. Il pulsante resta lo stesso nodo, quindi il focus non si perde.
 */
export class HmdThemeSwitcher extends HmdElement {
  #store: ThemeStore | null = null;
  #i18n: I18nStore | null = null;
  #button: HTMLButtonElement | null = null;
  #shown: ThemePref | null = null;

  get store(): ThemeStore | null {
    return this.#store;
  }
  set store(value: ThemeStore | null) {
    if (value === this.#store) return;
    this.#store = value;
    this.reconnect();
  }

  get i18n(): I18nStore | null {
    return this.#i18n;
  }
  set i18n(value: I18nStore | null) {
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#button ??= this.appendChild(
      el('button', { class: 'button tooltip', on: { click: () => this.#store?.setTheme(nextTheme(this.#store.getState())) } }),
    );
    const store = this.#store;
    const i18n = this.#i18n;
    if (!store || !i18n) return;
    const render = () => this.#render(store, i18n);
    this.watch(store, render, signal);
    this.watch(i18n, render, signal);
  }

  #render(store: ThemeStore, i18n: I18nStore): void {
    const button = this.#button!;
    const theme = store.getState();
    const label = i18n.t(`theme.${theme}`);
    toggleAttr(button, 'aria-label', true, label);
    toggleAttr(button, 'data-tooltip', true, label);
    if (theme !== this.#shown) {
      this.#shown = theme;
      button.replaceChildren(icon(THEME_ICON[theme]));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-theme-switcher': HmdThemeSwitcher;
  }
}
```

`src/elements/theme-switcher/theme-switcher.css` (le regole di `.iconButton` di `WorkspaceView.module.css`, che resta per gli altri pulsanti della barra):

```css
@layer components {
  @scope (hmd-theme-switcher) {
    /* Nessun box proprio: il pulsante è un elemento della barra come gli altri. */
    :scope {
      display: contents;
    }

    .button {
      background: none;
      border: none;
      border-radius: 6px;
      width: 30px;
      height: 30px;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
      color: var(--c-text);
    }

    .button:hover {
      background: var(--c-accent-soft);
    }
  }
}
```

In `src/elements/define.ts`:

```ts
import { HmdThemeSwitcher } from './theme-switcher/theme-switcher.element';

const ELEMENTS: Definitions = [['hmd-theme-switcher', HmdThemeSwitcher]];
```

In `src/elements/jsx.d.ts`, aggiungere gli import `import type { I18nStore } from '../state/i18nStore';`, `import type { ThemeStore } from '../state/themeStore';` e dentro `IntrinsicElements`:

```ts
      'hmd-theme-switcher': HmdProps<{ store: ThemeStore; i18n: I18nStore }>;
```

Run: `npm test` → i 4 test passano.

- [ ] **Step 3: React monta il tag**

In `src/ui/WorkspaceView.tsx`:
- togliere `import { ThemeSwitcher } from './ThemeSwitcher';`;
- `import { getThemeStore, useTheme } from '../theme/useTheme';` (al posto dell'import di `useTheme`);
- `import { useI18n, useI18nStore } from '../i18n/I18nProvider';` (o aggiungere `useI18nStore` all'import esistente dal provider) e, accanto agli altri hook in cima al componente, `const i18nStore = useI18nStore();`;
- la riga 453 diventa:

```tsx
            <hmd-theme-switcher store={getThemeStore()} i18n={i18nStore} />
```

`useTheme()` resta: `theme`/`setTheme` servono ancora a `SettingsView`.

Cancellare `src/ui/ThemeSwitcher.tsx`.

- [ ] **Step 4: Verifica completa e commit**

```bash
npm test && npm run lint
npm run test:e2e         # 102 passed, snapshot invariati (workspace, settings, ai-review, conflict, format-toolbar)
npm run test:e2e:dev     # 87 passed
npm run test:e2e:audit   # 32 passed
git status --short       # nessun PNG
git add -A src/elements/theme-switcher src/elements/define.ts src/elements/jsx.d.ts src/ui/WorkspaceView.tsx src/ui/ThemeSwitcher.tsx
git commit -m "feat: hmd-theme-switcher al posto di ThemeSwitcher, iscritto allo store del tema"
```

Se l'audit mostra differenze sul pulsante del tema, confrontarle con `.iconButton` di `WorkspaceView.module.css` e allineare il foglio dell'elemento (le regole del modulo non hanno layer e prima vincevano su tutto, ora l'elemento sta in `components`): mai rigenerare snapshot.

---

### Task 6: `hmd-conflict-bar`

**Files:**
- Create: `src/elements/conflict-bar/conflict-bar.element.ts`, `src/elements/conflict-bar/conflict-bar.css`, `src/elements/conflict-bar/conflict-bar.dom.test.ts`
- Modify: `src/elements/events.ts`, `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`, `src/ui/WorkspaceView.module.css` (via le regole `.conflict*`)
- Delete: `src/ui/ConflictBar.tsx`

**Interfaces:**
- Produces: `HmdConflictBar` con proprietà `i18n: I18nStore | null`; evento `'hmd-conflict': CustomEvent<{ choice: 'reload' | 'overwrite' }>` (voce in `HmdEvents`).

- [ ] **Step 1: Test (fallisce)**

`src/elements/conflict-bar/conflict-bar.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';

function mount() {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'conflict.reload': 'RICARICA' } }),
    persist() {},
  });
  const el = document.createElement('hmd-conflict-bar');
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n };
}

test('an alert with the message and the two choices', () => {
  const { el } = mount();
  const alert = el.querySelector('[role="alert"]')!;
  assert.match(alert.textContent!, new RegExp(EN_MESSAGES['conflict.message'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual([...alert.querySelectorAll('button')].map((b) => b.textContent), [EN_MESSAGES['conflict.reload'], EN_MESSAGES['conflict.overwrite']]);
  assert.ok(alert.querySelector('.icon'));
  el.remove();
});

test('each button sends hmd-conflict with its choice', () => {
  const { el } = mount();
  const choices: string[] = [];
  el.addEventListener('hmd-conflict', (event) => choices.push(event.detail.choice));
  const [reload, overwrite] = el.querySelectorAll('button');
  reload.click();
  overwrite.click();
  assert.deepEqual(choices, ['reload', 'overwrite']);
  el.remove();
});

test('a language change relabels the buttons without recreating them', async () => {
  const { el, i18n } = mount();
  const reload = el.querySelector('button')!;
  await i18n.setLocale('it');
  assert.equal(el.querySelector('button'), reload);
  assert.equal(reload.textContent, 'RICARICA');
  el.remove();
});
```

(`addEventListener('hmd-conflict', …)` è tipizzato grazie all'augment di `HTMLElementEventMap` in `events.ts`, Task 3.)

Run: `npm test` → FAIL.

- [ ] **Step 2: Evento, elemento, foglio**

In `src/elements/events.ts`, dentro `HmdEvents`:

```ts
  /** Conflitto con il disco: l'utente sceglie se ricaricare o sovrascrivere. */
  'hmd-conflict': CustomEvent<{ choice: 'reload' | 'overwrite' }>;
```

`src/elements/conflict-bar/conflict-bar.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { icon } from '../../dom/icon';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import './conflict-bar.css';

/** Barra del conflitto con il disco (era ConflictBar.tsx): annunciata come alert quando compare. */
export class HmdConflictBar extends HmdElement {
  #i18n: I18nStore | null = null;
  #parts: { message: HTMLSpanElement; reload: HTMLButtonElement; overwrite: HTMLButtonElement } | null = null;

  get i18n(): I18nStore | null {
    return this.#i18n;
  }
  set i18n(value: I18nStore | null) {
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const message = el('span');
      const reload = el('button', { on: { click: () => emit(this, 'hmd-conflict', { choice: 'reload' }) } });
      const overwrite = el('button', { on: { click: () => emit(this, 'hmd-conflict', { choice: 'overwrite' }) } });
      this.append(el('div', { class: 'bar', role: 'alert' }, icon('warning'), message, reload, overwrite));
      this.#parts = { message, reload, overwrite };
    }
    const i18n = this.#i18n;
    if (i18n) this.watch(i18n, () => this.#render(i18n), signal);
  }

  #render(i18n: I18nStore): void {
    const { message, reload, overwrite } = this.#parts!;
    setText(message, i18n.t('conflict.message'));
    setText(reload, i18n.t('conflict.reload'));
    setText(overwrite, i18n.t('conflict.overwrite'));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-conflict-bar': HmdConflictBar;
  }
}
```

`src/elements/conflict-bar/conflict-bar.css` (le regole `.conflict*` di `WorkspaceView.module.css`):

```css
@layer components {
  @scope (hmd-conflict-bar) {
    :scope {
      display: contents;
    }

    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--c-warning-bg);
      border-bottom: 1px solid var(--c-border);
    }

    .bar span {
      flex: 1;
    }

    .bar button {
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
    }
  }
}
```

In `define.ts` aggiungere `['hmd-conflict-bar', HmdConflictBar]` (con l'import); in `jsx.d.ts`:

```ts
      'hmd-conflict-bar': HmdProps<{ i18n: I18nStore }, 'hmd-conflict'>;
```

Run: `npm test` → i 3 test passano.

- [ ] **Step 3: React monta il tag**

In `src/ui/WorkspaceView.tsx` togliere l'import di `ConflictBar` e sostituire il blocco:

```tsx
        {doc?.conflict && (
          <hmd-conflict-bar i18n={i18nStore} onhmd-conflict={(event) => void workspace.resolveConflict(event.detail.choice)} />
        )}
```

In `src/ui/WorkspaceView.module.css` cancellare le regole `.conflict`, `.conflict span`, `.conflict button` (solo `ConflictBar` le usava: verificare con `grep -n "styles.conflict" src -r` → nessun risultato). Cancellare `src/ui/ConflictBar.tsx`.

- [ ] **Step 4: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e         # 102 passed; external.spec (conflitto) e snapshot conflict invariati
npm run test:e2e:dev     # 87 passed
npm run test:e2e:audit   # 32 passed (stato "conflict")
git add -A src/elements/conflict-bar src/elements/events.ts src/elements/define.ts src/elements/jsx.d.ts src/ui/WorkspaceView.tsx src/ui/WorkspaceView.module.css src/ui/ConflictBar.tsx
git commit -m "feat: hmd-conflict-bar al posto di ConflictBar, scelta con l'evento hmd-conflict"
```

---

### Task 7: `hmd-notice` e `hmd-update-notice`

**Files:**
- Create: `src/elements/notice/notice.element.ts`, `src/elements/notice/notice.css`, `src/elements/notice/notice.dom.test.ts`, `src/elements/update-notice/update-notice.element.ts`, `src/elements/update-notice/update-notice.css`, `src/elements/update-notice/update-notice.dom.test.ts`
- Modify: `src/elements/events.ts`, `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/App.tsx`
- Delete: `src/ui/Notice.tsx`, `src/ui/Notice.module.css`, `src/ui/UpdateNotice.tsx`

**Interfaces:**
- Produces:
  - `HmdNotice`: proprietà `message: string`, `actionLabel: string` (vuoto = nessun pulsante d'azione), `busy: boolean`, `dismissLabel: string`, `dismissible: boolean`, `placement: 'top' | 'bottom'`; eventi `'hmd-notice-action': CustomEvent<null>`, `'hmd-notice-dismiss': CustomEvent<null>`.
  - `HmdUpdateNotice`: proprietà `flow: UpdateFlow | null`, `i18n: I18nStore | null`; usa un `hmd-notice` interno solo quando c'è un aggiornamento.

Comportamento da conservare (era `Notice.tsx`): popover `manual` aperto appena collegato; `role="status"`; pulsante d'azione presente solo con un'etichetta, disabilitato mentre `busy`; pulsante di chiusura presente solo se si può chiudere; `data-placement` sul popover.

- [ ] **Step 1: Test di `hmd-notice` (fallisce)**

`src/elements/notice/notice.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';

installPopoverStub();

function mount(props: Partial<{ message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' }> = {}) {
  const el = document.createElement('hmd-notice');
  Object.assign(el, { message: 'msg', dismissLabel: 'chiudi', ...props });
  document.body.append(el);
  return { el, box: el.querySelector('[role="status"]') as HTMLElement };
}

test('it opens as a manual popover with the message, placed at the bottom by default', () => {
  const { el, box } = mount();
  assert.equal(box.getAttribute('popover'), 'manual');
  assert.ok(isPopoverOpen(box));
  assert.equal(box.dataset.placement, 'bottom');
  assert.equal(box.querySelector('p')!.textContent, 'msg');
  assert.equal(box.querySelectorAll('button').length, 0);
  el.remove();
});

test('action and dismiss buttons exist only when asked, and send their events', () => {
  const { el, box } = mount({ actionLabel: 'Aggiorna', dismissible: true, placement: 'top' });
  const [action, dismiss] = box.querySelectorAll('button');
  assert.equal(action.textContent, 'Aggiorna');
  assert.equal(dismiss.getAttribute('aria-label'), 'chiudi');
  assert.equal(dismiss.getAttribute('data-tooltip'), 'chiudi');
  assert.equal(box.dataset.placement, 'top');
  const events: string[] = [];
  el.addEventListener('hmd-notice-action', () => events.push('action'));
  el.addEventListener('hmd-notice-dismiss', () => events.push('dismiss'));
  action.click();
  dismiss.click();
  assert.deepEqual(events, ['action', 'dismiss']);
  el.remove();
});

test('busy disables the same action button; not dismissible removes the dismiss button', () => {
  const { el, box } = mount({ actionLabel: 'Aggiorna', dismissible: true });
  const action = box.querySelector('button')!;
  Object.assign(el, { busy: true, dismissible: false });
  assert.equal(box.querySelector('button'), action);
  assert.equal(action.disabled, true);
  assert.equal(box.querySelectorAll('button').length, 1);
  el.remove();
});

test('detached it does not call hidePopover; attached again it reopens', () => {
  const { el, box } = mount();
  el.remove();
  assert.doesNotThrow(() => document.body.append(el));
  assert.ok(isPopoverOpen(box));
  el.remove();
});
```

Run: `npm test` → FAIL.

- [ ] **Step 2: `hmd-notice`**

In `src/elements/events.ts`, dentro `HmdEvents`:

```ts
  /** Pulsante d'azione di un avviso (es. "Aggiorna"). */
  'hmd-notice-action': CustomEvent<null>;
  /** Chiusura di un avviso. */
  'hmd-notice-dismiss': CustomEvent<null>;
```

`src/elements/notice/notice.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { emit } from '../events';
import './notice.css';

type Placement = 'top' | 'bottom';

/**
 * Avviso persistente in basso (o in alto) a sinistra, fuori dal flusso: popover `manual`, non sparisce da
 * solo (era Notice.tsx). I pulsanti si creano una volta e si inseriscono o tolgono: chi ha il focus resta.
 */
export class HmdNotice extends HmdElement {
  #message = '';
  #actionLabel = '';
  #busy = false;
  #dismissLabel = '';
  #dismissible = false;
  #placement: Placement = 'bottom';
  #parts: { box: HTMLDivElement; text: HTMLParagraphElement; action: HTMLButtonElement; dismiss: HTMLButtonElement } | null = null;
  #open = false;

  get message(): string { return this.#message; }
  set message(value: string) { this.#message = value; this.#render(); }
  get actionLabel(): string { return this.#actionLabel; }
  set actionLabel(value: string) { this.#actionLabel = value; this.#render(); }
  get busy(): boolean { return this.#busy; }
  set busy(value: boolean) { this.#busy = value; this.#render(); }
  get dismissLabel(): string { return this.#dismissLabel; }
  set dismissLabel(value: string) { this.#dismissLabel = value; this.#render(); }
  get dismissible(): boolean { return this.#dismissible; }
  set dismissible(value: boolean) { this.#dismissible = value; this.#render(); }
  get placement(): Placement { return this.#placement; }
  set placement(value: Placement) { this.#placement = value; this.#render(); }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const text = el('p');
      const action = el('button', { class: 'action', on: { click: () => emit(this, 'hmd-notice-action', null) } });
      const dismiss = el('button', { class: 'dismiss tooltip', on: { click: () => emit(this, 'hmd-notice-dismiss', null) } }, icon('close', { size: 16 }));
      const box = el('div', { class: 'notice', popover: 'manual', role: 'status' }, text);
      this.append(box);
      this.#parts = { box, text, action, dismiss };
    }
    this.#render();
    // Un popover staccato dal documento si chiude da solo: niente hidePopover() su un nodo staccato.
    if (!this.#open) {
      this.#parts.box.showPopover();
      this.#open = true;
    }
    signal.addEventListener('abort', () => (this.#open = false), { once: true });
  }

  #render(): void {
    if (!this.#parts) return;
    const { box, text, action, dismiss } = this.#parts;
    box.dataset.placement = this.#placement;
    setText(text, this.#message);
    setText(action, this.#actionLabel);
    action.disabled = this.#busy;
    toggleAttr(dismiss, 'aria-label', true, this.#dismissLabel);
    toggleAttr(dismiss, 'data-tooltip', true, this.#dismissLabel);
    place(box, action, this.#actionLabel !== '', text);
    place(box, dismiss, this.#dismissible, this.#actionLabel !== '' ? action : text);
  }
}

/** Mette `node` subito dopo `after` dentro `parent`, o lo toglie; non tocca un nodo già al suo posto. */
function place(parent: Element, node: Element, present: boolean, after: Element): void {
  if (!present) {
    node.remove();
    return;
  }
  if (node.parentElement !== parent || node.previousElementSibling !== after) after.after(node);
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-notice': HmdNotice;
  }
}
```

`src/elements/notice/notice.css` (le regole di `Notice.module.css`, con le classi dentro lo scope):

```css
@layer components {
  @scope (hmd-notice) {
    :scope {
      display: contents;
    }

    .notice {
      position: fixed;
      inset: auto auto 16px 16px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(420px, calc(100vw - 32px));
      padding: 10px 12px;
      border: 1px solid var(--c-border);
      border-left: 4px solid var(--c-accent);
      border-radius: 8px;
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.15);
    }

    .notice[data-placement='top'] {
      inset: 16px auto auto 16px;
    }

    .notice p {
      flex: 1;
      margin: 0;
      line-height: 1.4;
    }

    .action {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .action:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    .dismiss {
      background: none;
      border: none;
      color: var(--c-muted);
      cursor: pointer;
      display: inline-grid;
    }
  }
}
```

- [ ] **Step 3: Test di `hmd-update-notice` (fallisce)**

`src/elements/update-notice/update-notice.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import type { UpdateFlow, UpdateState } from '../../pwa/updateFlow';
import { createI18nStore } from '../../state/i18nStore';
import { installPopoverStub } from '../../testing/popoverStub';

installPopoverStub();

function fakeFlow() {
  let state: UpdateState = { available: false, busy: false };
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const flow = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    needRefresh() {},
    dismiss: () => calls.push('dismiss'),
    apply: async () => void calls.push('apply'),
    needReload: async () => {},
  } satisfies UpdateFlow;
  const set = (next: UpdateState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return { flow, set, calls, listeners };
}

function mount() {
  const { flow, set, calls, listeners } = fakeFlow();
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'update.apply': 'AGGIORNA' } }),
    persist() {},
  });
  const el = document.createElement('hmd-update-notice');
  el.flow = flow;
  el.i18n = i18n;
  document.body.append(el);
  return { el, set, calls, i18n, listeners };
}

test('no notice until an update is available', () => {
  const { el, set } = mount();
  assert.equal(el.querySelector('hmd-notice'), null);
  set({ available: true, busy: false });
  const notice = el.querySelector('hmd-notice')!;
  assert.equal(notice.message, EN_MESSAGES['toast.newVersion']);
  assert.equal(notice.actionLabel, EN_MESSAGES['update.apply']);
  assert.equal(notice.dismissLabel, EN_MESSAGES['update.dismiss']);
  assert.equal(notice.dismissible, true);
  set({ available: false, busy: false });
  assert.equal(el.querySelector('hmd-notice'), null);
  el.remove();
});

test('Update calls apply; Later calls dismiss; while busy it cannot be dismissed', () => {
  const { el, set, calls } = mount();
  set({ available: true, busy: false });
  const notice = el.querySelector('hmd-notice')!;
  notice.dispatchEvent(new CustomEvent('hmd-notice-action', { detail: null, bubbles: true }));
  notice.dispatchEvent(new CustomEvent('hmd-notice-dismiss', { detail: null, bubbles: true }));
  assert.deepEqual(calls, ['apply', 'dismiss']);
  set({ available: true, busy: true });
  assert.equal(el.querySelector('hmd-notice'), notice);
  assert.equal(notice.busy, true);
  assert.equal(notice.dismissible, false);
  el.remove();
});

test('a language change relabels the notice; detached it unsubscribes', async () => {
  const { el, set, i18n, listeners } = mount();
  set({ available: true, busy: false });
  await i18n.setLocale('it');
  assert.equal(el.querySelector('hmd-notice')!.actionLabel, 'AGGIORNA');
  el.remove();
  assert.equal(listeners.size, 0);
});
```

Run: `npm test` → FAIL.

- [ ] **Step 4: `hmd-update-notice`**

`src/elements/update-notice/update-notice.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el } from '../../dom/el';
import type { UpdateFlow } from '../../pwa/updateFlow';
import type { I18nStore } from '../../state/i18nStore';
import type { HmdNotice } from '../notice/notice.element';
import './update-notice.css';

/** "Nuova versione" con "Aggiorna" (disabilitato mentre si mette al sicuro il documento). Era UpdateNotice.tsx. */
export class HmdUpdateNotice extends HmdElement {
  #flow: UpdateFlow | null = null;
  #i18n: I18nStore | null = null;
  #notice: HmdNotice | null = null;

  get flow(): UpdateFlow | null { return this.#flow; }
  set flow(value: UpdateFlow | null) {
    if (value === this.#flow) return;
    this.#flow = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    const flow = this.#flow;
    const i18n = this.#i18n;
    if (!flow || !i18n) return;
    const render = () => this.#render(flow, i18n);
    this.watch(flow, render, signal);
    this.watch(i18n, render, signal);
  }

  #render(flow: UpdateFlow, i18n: I18nStore): void {
    const state = flow.getState();
    if (!state.available) {
      this.#notice?.remove();
      this.#notice = null;
      return;
    }
    this.#notice ??= this.appendChild(
      el('hmd-notice', {
        on: {
          'hmd-notice-action': () => void this.#flow?.apply(),
          'hmd-notice-dismiss': () => this.#flow?.dismiss(),
        },
      }),
    );
    Object.assign(this.#notice, {
      message: i18n.t('toast.newVersion'),
      actionLabel: i18n.t('update.apply'),
      busy: state.busy,
      dismissLabel: i18n.t('update.dismiss'),
      dismissible: !state.busy,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-update-notice': HmdUpdateNotice;
  }
}
```

(`el()` accetta `on` solo con i tipi di `HTMLElementEventMap`: l'augment di `events.ts` (Task 3) vi aggiunge `hmd-notice-action`/`hmd-notice-dismiss`.)

`src/elements/update-notice/update-notice.css`:

```css
@layer components {
  @scope (hmd-update-notice) to (hmd-notice) {
    :scope {
      display: contents;
    }
  }
}
```

In `define.ts` aggiungere `['hmd-notice', HmdNotice]` e `['hmd-update-notice', HmdUpdateNotice]` (con gli import). In `jsx.d.ts`:

```ts
      'hmd-notice': HmdProps<
        { message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' },
        'hmd-notice-action' | 'hmd-notice-dismiss'
      >;
      'hmd-update-notice': HmdProps<{ flow: UpdateFlow; i18n: I18nStore }>;
```

(con `import type { UpdateFlow } from '../pwa/updateFlow';`). Run: `npm test` → tutti i test di notice e update-notice passano.

- [ ] **Step 5: React monta i tag**

In `src/App.tsx`: togliere gli import di `Notice` e `UpdateNotice`; aggiungere `useI18nStore` all'import dal provider e `const i18nStore = useI18nStore();` accanto agli altri hook; il frammento finale diventa:

```tsx
    <>
      {content}
      <hmd-update-notice flow={updates} i18n={i18nStore} />
      {dbBlocked && (
        <hmd-notice
          placement="top"
          message={t('toast.reloadOtherTabs')}
          dismissLabel={t('toast.close')}
          dismissible
          onhmd-notice-dismiss={() => setDbBlocked(false)}
        />
      )}
    </>
```

Cancellare `src/ui/Notice.tsx`, `src/ui/Notice.module.css`, `src/ui/UpdateNotice.tsx`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e && npm run test:e2e:dev && npm run test:e2e:audit
git add -A src/elements/notice src/elements/update-notice src/elements/events.ts src/elements/define.ts src/elements/jsx.d.ts src/App.tsx src/ui/Notice.tsx src/ui/Notice.module.css src/ui/UpdateNotice.tsx
git commit -m "feat: hmd-notice e hmd-update-notice al posto di Notice e UpdateNotice"
```

Expected: e2e 102, dev 87, audit 32. Nessuna spec e2e esercita questi avvisi (nota del piano): la checklist manuale del Task 9 li prova a mano.

---

### Task 8: `hmd-toasts`

**Files:**
- Create: `src/elements/toasts/toasts.element.ts`, `src/elements/toasts/toasts.css`, `src/elements/toasts/toasts.dom.test.ts`
- Modify: `src/elements/events.ts`, `src/elements/define.ts`, `src/elements/jsx.d.ts`, `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/Toasts.tsx`, `src/ui/Toasts.module.css`

**Interfaces:**
- Produces: `export interface ToastItem { key: string; kind: 'info' | 'error'; text: string }` (da `toasts.element.ts`), `HmdToasts` con proprietà `items: readonly ToastItem[]`, `i18n: I18nStore | null`; evento `'hmd-toast-dismiss': CustomEvent<{ key: string }>`.

Comportamento da conservare (era `Toasts.tsx`): contenitore popover `manual` aperto quando ci sono toast e chiuso quando non ce ne sono; `role="alert"` per gli errori, `"status"` per le informazioni; ogni toast informativo si chiude da solo dopo 6 s; **ogni nuovo array `items` riavvia i timer di tutti i toast informativi** (come l'effetto React); i nodi dei toast si riusano per chiave.

- [ ] **Step 1: Test (fallisce)**

`src/elements/toasts/toasts.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { installPopoverStub, isPopoverOpen } from '../../testing/popoverStub';
import type { ToastItem } from './toasts.element';

installPopoverStub();

function mount() {
  const i18n = createI18nStore({
    locale: 'en',
    messages: EN_MESSAGES,
    load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'toast.close': 'CHIUDI' } }),
    persist() {},
  });
  const el = document.createElement('hmd-toasts');
  el.i18n = i18n;
  document.body.append(el);
  const dismissed: string[] = [];
  el.addEventListener('hmd-toast-dismiss', (event) => dismissed.push(event.detail.key));
  return { el, i18n, dismissed, box: el.querySelector('[popover]') as HTMLElement };
}

const info: ToastItem = { key: 'ws-1', kind: 'info', text: 'salvato' };
const error: ToastItem = { key: 'ai-error', kind: 'error', text: 'errore' };

test('the popover opens with toasts and closes without; roles follow the kind', () => {
  const { el, box } = mount();
  assert.equal(isPopoverOpen(box), false);
  el.items = [info, error];
  assert.ok(isPopoverOpen(box));
  const toasts = box.querySelectorAll('.toast');
  assert.deepEqual([...toasts].map((t) => t.getAttribute('role')), ['status', 'alert']);
  assert.deepEqual([...toasts].map((t) => (t as HTMLElement).dataset.kind), ['info', 'error']);
  assert.equal(toasts[0].querySelector('p')!.textContent, 'salvato');
  el.items = [];
  assert.equal(isPopoverOpen(box), false);
  el.remove();
});

test('nodes are reused by key; the close button sends hmd-toast-dismiss', () => {
  const { el, box, dismissed } = mount();
  el.items = [info];
  const first = box.querySelector('.toast')!;
  el.items = [info, error];
  assert.equal(box.querySelector('.toast'), first);
  const close = first.querySelector('button')!;
  assert.equal(close.getAttribute('aria-label'), EN_MESSAGES['toast.close']);
  close.click();
  assert.deepEqual(dismissed, ['ws-1']);
  el.remove();
});

test('info toasts close after 6 s, errors stay; a new items array restarts the info timers', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { el, dismissed } = mount();
    el.items = [info, error];
    mock.timers.tick(5000);
    el.items = [info, error, { key: 'ws-2', kind: 'info', text: 'altro' }];
    mock.timers.tick(5000);
    assert.deepEqual(dismissed, []);
    mock.timers.tick(1000);
    assert.deepEqual(dismissed.sort(), ['ws-1', 'ws-2']);
    el.remove();
  } finally {
    mock.timers.reset();
  }
});

test('detached: timers cleared, no hidePopover on a detached node', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { el, dismissed } = mount();
    el.items = [info];
    el.remove();
    mock.timers.tick(7000);
    assert.deepEqual(dismissed, []);
  } finally {
    mock.timers.reset();
  }
});

test('a language change relabels the close buttons', async () => {
  const { el, i18n, box } = mount();
  el.items = [info];
  await i18n.setLocale('it');
  assert.equal(box.querySelector('.toast button')!.getAttribute('aria-label'), 'CHIUDI');
  el.remove();
});
```

Run: `npm test` → FAIL.

- [ ] **Step 2: Evento, elemento, foglio**

In `src/elements/events.ts`, dentro `HmdEvents`:

```ts
  /** Chiusura di un toast (dal pulsante o dal timer dei toast informativi). */
  'hmd-toast-dismiss': CustomEvent<{ key: string }>;
```

`src/elements/toasts/toasts.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import './toasts.css';

/** Un toast già tradotto: il Workspace e il controller AI hanno codici diversi, qui arriva solo testo. */
export interface ToastItem {
  key: string;
  kind: 'info' | 'error';
  text: string;
}

const INFO_TIMEOUT_MS = 6000;

/**
 * Toast in basso a destra (era Toasts.tsx): popover `manual` aperto finché ci sono toast. I toast
 * informativi si chiudono dopo 6 s; come l'effetto React di prima, ogni nuovo array `items` riavvia i timer.
 */
export class HmdToasts extends HmdElement {
  #items: readonly ToastItem[] = [];
  #i18n: I18nStore | null = null;
  #box: HTMLDivElement | null = null;
  #open = false;
  #timers: ReturnType<typeof setTimeout>[] = [];

  get items(): readonly ToastItem[] { return this.#items; }
  set items(value: readonly ToastItem[]) {
    this.#items = value;
    this.#render();
    if (this.isConnected) this.#restartTimers();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#box ??= this.appendChild(el('div', { class: 'toasts', popover: 'manual' }));
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
    else this.#render();
    this.#restartTimers();
    signal.addEventListener('abort', () => {
      this.#clearTimers();
      // Staccato, il popover si è già chiuso: si dimentica lo stato, senza hidePopover().
      this.#open = false;
    }, { once: true });
  }

  #render(): void {
    const box = this.#box;
    if (!box) return;
    const close = this.#i18n?.t('toast.close') ?? '';
    reconcileList(
      box,
      this.#items,
      (item) => item.key,
      (item) =>
        el('div', { class: 'toast' }, el('p'), el('button', { class: 'tooltip', on: { click: () => emit(this, 'hmd-toast-dismiss', { key: item.key }) } }, icon('close', { size: 16 }))),
      (node, item) => {
        node.dataset.kind = item.kind;
        toggleAttr(node, 'role', true, item.kind === 'error' ? 'alert' : 'status');
        setText(node.querySelector('p')!, item.text);
        const button = node.querySelector('button')!;
        toggleAttr(button, 'aria-label', true, close);
        toggleAttr(button, 'data-tooltip', true, close);
      },
    );
    if (!this.isConnected) return;
    if (this.#items.length > 0 && !this.#open) {
      box.showPopover();
      this.#open = true;
    } else if (this.#items.length === 0 && this.#open) {
      box.hidePopover();
      this.#open = false;
    }
  }

  #restartTimers(): void {
    this.#clearTimers();
    this.#timers = this.#items
      .filter((item) => item.kind === 'info')
      .map((item) => setTimeout(() => emit(this, 'hmd-toast-dismiss', { key: item.key }), INFO_TIMEOUT_MS));
  }

  #clearTimers(): void {
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-toasts': HmdToasts;
  }
}
```

`src/elements/toasts/toasts.css` (le regole di `Toasts.module.css`):

```css
@layer components {
  @scope (hmd-toasts) {
    :scope {
      display: contents;
    }

    .toasts {
      position: fixed;
      inset: auto 16px 16px auto;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(380px, calc(100vw - 32px));
      overflow: visible;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: var(--c-surface);
      color: var(--c-text);
      border: 1px solid var(--c-border);
      border-left: 4px solid var(--c-accent);
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.15);
    }

    .toast[data-kind='error'] {
      border-left-color: var(--c-danger);
    }

    .toast p {
      margin: 0;
      flex: 1;
      line-height: 1.4;
    }

    .toast button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: var(--c-muted);
    }
  }
}
```

In `define.ts` aggiungere `['hmd-toasts', HmdToasts]`; in `jsx.d.ts`:

```ts
      'hmd-toasts': HmdProps<{ items: readonly ToastItem[]; i18n: I18nStore }, 'hmd-toast-dismiss'>;
```

(con `import type { ToastItem } from './toasts/toasts.element';`). Run: `npm test` → i 5 test passano.

- [ ] **Step 3: React monta il tag**

In `src/ui/WorkspaceView.tsx`: `import { Toasts, type ToastItem } from './Toasts';` diventa `import type { ToastItem } from '../elements/toasts/toasts.element';`; la riga 619 diventa:

```tsx
      <hmd-toasts items={toastItems} i18n={i18nStore} onhmd-toast-dismiss={(event) => dismissToast(event.detail.key)} />
```

Cancellare `src/ui/Toasts.tsx` e `src/ui/Toasts.module.css`.

- [ ] **Step 4: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e         # 102 passed, snapshot "toast" invariato
npm run test:e2e:dev     # 87 passed
npm run test:e2e:audit   # 32 passed (stato "toast")
git add -A src/elements/toasts src/elements/events.ts src/elements/define.ts src/elements/jsx.d.ts src/ui/WorkspaceView.tsx src/ui/Toasts.tsx src/ui/Toasts.module.css
git commit -m "feat: hmd-toasts al posto di Toasts, chiusura con l'evento hmd-toast-dismiss"
```

---

### Task 9: Documentazione, verifica finale, checklist manuale

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`

- [ ] **Step 1: Spec**

1. Intestazione: `**Revisione: 2026-10-05**`; riga "Stato": fase 4a sul branch `feat/web-components`.
2. §7 fase 4: in apertura, "Divisa in tre piani: 4a (piano 5: infrastruttura, tema, conflitto, avvisi, toast), 4b (dialog), 4c (start screen e foglie AI)." In fondo: "4a **fatta**: `hmd-theme-switcher`, `hmd-conflict-bar`, `hmd-notice`, `hmd-update-notice`, `hmd-toasts`; host con `display: contents`; store passati come proprietà (`useI18nStore`, `getThemeStore`); `HmdElement.reconnect()`; test degli elementi in jsdom con `src/testing/assetHooks.ts` e `popoverStub.ts`. I toast conservano il riavvio dei timer a ogni nuovo array (difetto preesistente, visibile: da decidere a parte)."
3. §5.1: dopo l'elenco, "Host con `display: contents` quando l'elemento sostituisce un componente dentro un layout React: l'albero interno resta quello di React e l'audit degli stili (`e2e/support/styleAudit.ts`) salta il wrapper."
4. §8.4, paragrafo sull'audit: "Dalla fase 4 l'audit salta i wrapper `hmd-*` con `display: contents`."
5. §13: "`docs/superpowers/plans/2026-10-05-housemd-wc-05-fase-4a-infrastruttura-e-foglie.md` (fase 4a, branch `feat/web-components`); 4b e 4c da scrivere."

- [ ] **Step 2: Verifica finale**

```bash
npm test
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c                 # annotare rispetto al Task 1
npm run test:e2e -- --repeat-each=2                    # 204 passed
npm run test:e2e:dev                                   # 87 passed
npm run test:e2e:audit                                 # 32 passed
git status --short
grep -rn "ThemeSwitcher\|ConflictBar\|UpdateNotice\|from './Notice'\|from './Toasts'" src   # nessun risultato
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md
git commit -m "docs: spec allineato alla fase 4a (prime foglie come custom element, host trasparenti)"
```

- [ ] **Step 4: Checklist manuale (Davide, in Chrome)**

Da fare a mano perché nessun e2e la copre (i service worker sono bloccati nei test):
1. Avviso "nuova versione": `npm run build && npm run preview`, aprire l'app in Chrome; cambiare un testo qualsiasi in `src/`, `npm run build` di nuovo (il server di preview resta acceso) e ricaricare una volta la scheda. L'avviso compare in basso a sinistra; "Aggiorna" si disabilita mentre salva e ricarica; in una seconda prova "Più tardi" lo chiude.
2. Tooltip al focus da tastiera sul pulsante del tema e sul pulsante di chiusura di un toast.
3. Cambio di lingua dalle impostazioni con un toast visibile: il tooltip di chiusura cambia lingua.

L'avviso "chiudi le altre schede" (database bloccato da un'altra scheda) non è riproducibile senza un cambio di versione del database: resta coperto dai test jsdom di `hmd-notice`. Riportare l'esito nel messaggio di chiusura della fase.
