# HouseMD Web Components — Piano 1: baseline end-to-end e rete di sicurezza

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Revisione del 2026-10-01: riscritto su `main` (`822f52d`) dopo AI, impostazioni a pagina, cronologia,
> barra di formattazione, tooltip disegnati e albero con un solo tab stop. Sostituisce la versione del
> 27/09, che non è mai stata eseguita.

**Goal:** Prima di migrare qualcosa, fissare con Playwright il comportamento e l'aspetto dell'app React di oggi (AI compresa), assorbire il collaudo CDP `tests/browser/` e rafforzare i controlli statici che la migrazione renderebbe ciechi.

**Architecture:** Suite Playwright in `e2e/` contro `vite build` + `vite preview`. Il selettore nativo di cartelle viene sostituito, **solo nei test**, da uno script iniettato che restituisce una cartella dell'Origin Private File System (OPFS): `fsaOps.ts`, `handleStore.ts` e IndexedDB girano sul codice reale. Il provider AI è il profilo Ollama predefinito, a cui risponde `page.route`. Le spec usano solo ruoli e nomi accessibili presi da `en.json`, quindi valgono identiche per React e per i futuri custom element. In più: `uiText.test.ts` e `tooltips.test.ts` non potranno più passare a vuoto e un nuovo `architecture.test.ts` fa rispettare le regole di `CLAUDE.md`.

**Tech Stack:** `@playwright/test` 1.63.0 (Chromium), TypeScript 7, Vite 8, React 18 (invariato), `tsx --test` (`node:test`).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (revisione 2026-10-01: §7 fase 0, §8.1, §8.3, §8.4, §9).

## Global Constraints

- **Nessuna modifica all'app.** In `src/` cambiano solo `src/i18n/uiText.test.ts`, `src/ui/tooltips.test.ts` (Task 15) e il nuovo `src/architecture.test.ts` (Task 16), **nemmeno temporaneamente** altro: le prove di sensibilità cambiano solo spec e test. Se una spec e2e fallisce, **non si tocca l'app**: la spec descrive l'app di oggi (vedi "Regola delle spec di caratterizzazione").
- Fuori da `src/` cambiano: `e2e/` (nuovo), `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CLAUDE.md`; `tests/browser/` viene cancellata nel Task 17, solo dopo che `e2e/` copre tutto quello che verificava.
- Dove un risultato dipende da un timer dell'app (autosalvataggio a 1000 ms, soglia di 5 minuti della cronologia), la spec controlla l'orologio con `page.clock` invece di affidarsi a timeout più corti del timer.
- La suite prova sempre una build nuova: `reuseExistingServer: false`.
- **Branch e merge (decisione 1 dello spec):** branch `test/e2e-baseline` creato da `main`. Alla fine si apre **una PR verso `main`**, ma `git push` e `gh pr create` si fanno solo dopo il via esplicito di Davide (Task 17).
- `npm test` resta `tsx --test` e deve raccogliere **esattamente** gli stessi test di prima più quelli nuovi dei Task 15–16; le spec e2e hanno suffisso `.spec.ts` e stanno in `e2e/`, quindi `tsx --test` non le raccoglie.
- Localizzatori: `getByRole`/`getByText`/`getByLabel` con nomi da `app.t('<chiave di en.json>')`. Mai classi CSS dell'app (spariranno con i CSS Modules). Eccezioni ammesse: le classi di CodeMirror (`.cm-content`, `.cm-scroller`, `.cm-mergeView`, `.cm-merge-revert`), i tag `script`/`mark`/`img`/`iframe`/`h1`/`h2`/`summary`/`html`/`meta` e gli attributi che sono essi stessi il comportamento sotto prova (`tabindex`, `data-action` dei pulsanti di CodeMirror merge).
- Nessun testo UI scritto a mano nelle spec: sempre `app.t(...)`. Nomi di file e contenuti dei file di prova sono dati, non UI, e restano letterali.
- `reducedMotion: 'reduce'`, service worker bloccati, viewport 1280×800, `locale: 'en-US'`, fuso `Europe/Rome`.
- Gli snapshot visivi creati nel Task 14 sono il riferimento di **tutta** la migrazione: non si rigenerano mai senza approvazione.
- Commit in italiano con prefisso convenzionale (`test:`, `chore:`, `docs:`), senza righe di attribuzione.
- Dipendenze fissate: `npm i -D --save-exact @playwright/test@1.63.0`.

## Regola delle spec di caratterizzazione

Queste spec **non sono TDD**: descrivono un'app che esiste già, quindi il ciclo di ogni task è:

1. scrivere la spec;
2. eseguirla: deve **passare** sull'app di oggi;
3. se fallisce, aprire il trace (`npx playwright show-trace test-results/<...>/trace.zip`) e capire se sbaglia la spec (selettore, tempi) o se l'app si comporta diversamente da quanto scritto. **Si corregge sempre la spec**, mai `src/`. Se il comportamento reale sembra un bug, la spec lo fissa così com'è con un commento `// Comportamento attuale: …` e il caso va nel messaggio di commit sotto "Da discutere";
4. **prova di sensibilità**: cambiare temporaneamente un valore atteso **nella spec** e verificare che la spec fallisca con un messaggio chiaro, poi ripristinarlo. Mai modificare `src/` per questa prova;
5. commit.

Due trappole note dei nomi accessibili, da tenere presenti leggendo un trace:

- i pulsanti con tooltip hanno `aria-label`, quindi il testo del tooltip (`::after`) non entra nel nome. Il pulsante della cartella nella sidebar **non** ha `aria-label`: il suo nome è il testo (`state.name`), e il tooltip nascosto (`visibility: hidden`) non conta. Se un passaggio del mouse lo rende visibile, il nome può cambiare: le spec non passano il mouse su quel pulsante prima di cercarlo;
- un file con una bozza ha dentro il pulsante un `role="img"` con nome `t('tree.draft')`: il nome del pulsante diventa `"<file> <Unsaved changes>"`. `treeFile(name)` usa `exact: true`, quindi per un file con bozza si usa `treeFileWithDraft(name)`.

## Review Focus

Casi non ovvi che lo spec implica e che nessun controllo copriva; ciascuno ha un test nel task indicato.

1. **Bozza d'emergenza dopo un salvataggio fallito e un ricaricamento**: il testo scritto mentre l'accesso era revocato torna nell'editor con il toast `toast.restoredDraft` (Task 8, `draft survives a failed save and a reload`).
2. **Ctrl+B dipende dal focus**: nell'editor mette il grassetto e non tocca la sidebar; fuori dall'editor nasconde la sidebar (Task 3 `Ctrl+B outside the editor toggles the sidebar` e Task 10 `Ctrl+B in the editor is bold, not the sidebar`).
3. **Indietro del browser con modifiche aperte nelle impostazioni**: l'hash non cambia e compare la conferma; Annulla lascia tutto com'è (Task 12, `Back with unsaved changes asks first`).
4. **Risposte AI ostili**: immagini, `srcset`, `iframe` e frontmatter remoti nella risposta o nella proposta non generano **nessuna** richiesta di rete (Task 13, `hostile model output loads nothing remote`).
5. **Ripristino dalla cronologia in sola anteprima**: passa alla vista affiancata e resta annullabile con Ctrl+Z (Task 11, `restoring from preview-only mode switches to split and stays undoable`).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/playwright.config.ts` | Config: server di anteprima, progetto Chromium, opzioni di contesto, snapshot. |
| `e2e/tsconfig.json` | Tipi per `e2e/` (`npm run lint`). |
| `e2e/support/fsHarness.ts` | Script iniettato (selettore → OPFS, permessi, scritture negate) e helper OPFS lato test. |
| `e2e/support/aiHarness.ts` | Provider finto su `http://localhost:11434` con `page.route`, risposta decisa dalla spec. |
| `e2e/support/i18n.ts` | Messaggi `en`/`it` letti da `src/i18n/locales/*.json`. |
| `e2e/support/app.ts` | Fixture `test` con `app: App` (navigazione, localizzatori, disco, editor). |
| `e2e/startup.spec.ts` | Avvio, browser non supportato, ripresa accesso, cambio cartella, config non valida. |
| `e2e/editor.spec.ts` | Autosalvataggio, `Ctrl+S`, `[[`, immagini, modalità, sidebar e resizer. |
| `e2e/preview.spec.ts` | Markdown, frontmatter, immagini, link, HTML malevolo. |
| `e2e/sync-scroll.spec.ts` | Scroll sincronizzato in split, nei due sensi. |
| `e2e/tree.spec.ts` | Dialog nuovo/rinomina/elimina, errori di nome, menu, tastiera con un solo tab stop. |
| `e2e/search.spec.ts` | `Ctrl+K`, risultati, Invio, Esc, Custom Highlight. |
| `e2e/external.spec.ts` | Modifiche esterne, conflitto, file eliminato, accesso perso, bozza. |
| `e2e/theme-i18n.spec.ts` | Ciclo del tema, tema prima del render, lingua all'avvio e a caldo. |
| `e2e/formatting.spec.ts` | Barra di formattazione, scorciatoie, tooltip disegnati, titolo della scheda. |
| `e2e/history.spec.ts` | Pannello della cronologia, diff, ripristino annullabile. |
| `e2e/settings.spec.ts` | Rotte nell'hash, focus, conferma su Indietro/Chiudi, larghezza del testo. |
| `e2e/ai-review.spec.ts` | Modalità AI, composer, revisione, blocchi, Ctrl+Z, selezione, output ostile (era `run-ai-smoke.mjs`). |
| `e2e/visual.spec.ts` + `e2e/__screenshots__/` | Snapshot visivi di riferimento. |
| `src/i18n/uiText.test.ts` | Modificato: scansiona anche i futuri `.ts` di UI, non passa a vuoto, ha casi negativi. |
| `src/ui/tooltips.test.ts` | Modificato: vieta `title` anche nelle forme di `el()`/`setAttribute`, con casi negativi. |
| `src/architecture.test.ts` | Nuovo: DOM da stringhe, File System Access, rete verso i modelli. |
| `tests/browser/*` | Cancellati nel Task 17. |
| `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CLAUDE.md` | Script, dipendenza, artefatti ignorati, documentazione. |

---

### Task 1: Branch, baseline, Playwright, harness OPFS e AI

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/tsconfig.json`, `e2e/support/fsHarness.ts`, `e2e/support/aiHarness.ts`, `e2e/support/i18n.ts`, `e2e/support/app.ts`, `e2e/startup.spec.ts`
- Modify: `package.json` (scripts, devDependencies), `package-lock.json`, `.gitignore`

**Interfaces:**
- Produces (usati da tutti i task successivi):
  - `test`, `expect` da `e2e/support/app.ts`; opzioni di fixture `flags: Partial<HarnessFlags>`, `appLocale: E2ELocale`; fixture `ai: FakeModel`.
  - `class App { page; locale; folder: string; t(key, params?): string; start(); openFolder(files: Seed, folder?: string); setFlags(flags: Partial<HarnessFlags>); tree(): Locator; treeFile(name): Locator; treeFileWithDraft(name): Locator; openFile(name); expectOpen(name); modes(): Locator; mode(key: ModeKey): Locator; editorPane(); editor(); previewPane(); typeAtEnd(text); selectRange(from: number, to: number); saveState(key: SaveKey): Locator; toast(text: string): Locator; disk(path): Promise<string | null>; exists(path): Promise<boolean>; writeExternal(path, text); removeExternal(path); windowFocus() }`
  - da `fsHarness.ts`: `type HarnessFlags`, `type Seed`, `PIXEL_PNG_BASE64`, `DEFAULT_FLAGS`, `FLAGS_KEY`, `harnessScript`, `seedFolder(page, folder, files)`, `readText(page, folder, path)`, `pathExists(page, folder, path)`, `removePath(page, folder, path)`.
  - da `aiHarness.ts`: `const OLLAMA = 'http://localhost:11434'`, `class FakeModel { reply: string; comment: string; requests: number; install(page): Promise<void> }`.
  - da `i18n.ts`: `type E2ELocale = 'en' | 'it'`, `messagesFor(locale)`.

- [ ] **Step 1: Creare il branch**

Eseguire nel worktree preparato con `superpowers:using-git-worktrees`:

```bash
git switch main && git pull --ff-only
git switch -c test/e2e-baseline
```

- [ ] **Step 2: Registrare la baseline**

```bash
npm ci
npm test 2>&1 | tail -8      # annotare "tests N" e "pass N" (al 01/10: 488)
npm run lint && npm run build
```

Expected: tutto verde. Se `npm test` non è verde **prima** di toccare qualcosa, fermarsi e riferire: il piano presuppone una baseline verde. Annotare anche la dimensione gzip di `dist/assets/index-*.js` (serve allo spec, fase 8).

- [ ] **Step 3: Installare Playwright**

```bash
npm i -D --save-exact @playwright/test@1.63.0
npx playwright install chromium
```

- [ ] **Step 4: Script, `.gitignore`, tsconfig**

In `package.json`, sezione `scripts` (le altre voci restano; `test:browser` si toglie nel Task 17):

```json
"lint": "tsc --noEmit && tsc --noEmit -p e2e",
"test": "tsx --test",
"test:e2e": "playwright test -c e2e/playwright.config.ts"
```

In fondo a `.gitignore`:

```
test-results/
playwright-report/
blob-report/
```

`e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "DOM.AsyncIterable"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 5: Config di Playwright**

`e2e/playwright.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'Europe/Rome',
    reducedMotion: 'reduce',
    // La PWA si verifica a mano: un service worker nei test aggiungerebbe cache tra un'esecuzione e l'altra.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    // Mai riusare un server già attivo: proverebbe un dist/ vecchio o un'altra cartella. Se la porta
    // è occupata la suite deve fallire, non passare sul codice sbagliato.
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium' }],
});
```

- [ ] **Step 6: Harness OPFS**

`e2e/support/fsHarness.ts`:

```ts
import type { Page } from '@playwright/test';

/**
 * Comportamento simulato del browser. Letto a OGNI chiamata da localStorage (chiave FLAGS_KEY):
 * i test lo cambiano al volo con App.setFlags, anche senza ricaricare la pagina.
 */
export interface HarnessFlags {
  /** false = browser senza File System Access (niente showDirectoryPicker). */
  picker: boolean;
  /** Sottocartella dell'OPFS restituita dal selettore. */
  folder: string;
  /** Risultato di queryPermission (avvio con cartella già nota). */
  query: PermissionState;
  /** Risultato di requestPermission (clic su "Riprendi accesso"). */
  request: PermissionState;
  /** createWritable fallisce con NotAllowedError: il browser ha revocato l'accesso. */
  denyWrites: boolean;
}

export const FLAGS_KEY = 'hmd-e2e';

export const DEFAULT_FLAGS: HarnessFlags = {
  picker: true,
  folder: 'notes',
  query: 'granted',
  request: 'granted',
  denyWrites: false,
};

/** Contenuto dei file di prova: testo, oppure byte in base64 (immagini). */
export type Seed = Record<string, string | { base64: string }>;

/** PNG 1×1 trasparente, per immagini di prova. */
export const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Eseguito nella pagina prima di qualsiasi script dell'app (page.addInitScript).
 * Deve essere autosufficiente: niente riferimenti a variabili di questo modulo.
 */
export function harnessScript({ defaults, key }: { defaults: HarnessFlags; key: string }): void {
  const flags = (): HarnessFlags => {
    try {
      return { ...defaults, ...(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<HarnessFlags>) };
    } catch {
      return defaults;
    }
  };
  const win = window as unknown as Record<string, unknown>;
  if (!flags().picker) {
    delete win.showDirectoryPicker;
    delete (Window.prototype as unknown as Record<string, unknown>).showDirectoryPicker;
    return;
  }
  win.showDirectoryPicker = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle(flags().folder, { create: true });
  const handleProto = FileSystemHandle.prototype as unknown as Record<string, unknown>;
  handleProto.queryPermission = async () => flags().query;
  handleProto.requestPermission = async () => flags().request;
  const createWritable = FileSystemFileHandle.prototype.createWritable;
  FileSystemFileHandle.prototype.createWritable = function (
    this: FileSystemFileHandle,
    ...args: Parameters<typeof createWritable>
  ) {
    if (flags().denyWrites) return Promise.reject(new DOMException('Accesso revocato (e2e)', 'NotAllowedError'));
    return createWritable.apply(this, args);
  };
}

/** Scrive i file nella cartella OPFS `folder`, creando le sottocartelle. Con denyWrites attivo fallisce. */
export async function seedFolder(page: Page, folder: string, files: Seed): Promise<void> {
  await page.evaluate(
    async ({ folder, files }) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split('/');
        let dir = root;
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(
          typeof content === 'string' ? content : Uint8Array.from(atob(content.base64), (c) => c.charCodeAt(0)),
        );
        await writable.close();
      }
    },
    { folder, files },
  );
}

/** Contenuto testuale di un file della cartella OPFS, oppure null se non esiste. */
export async function readText(page: Page, folder: string, path: string): Promise<string | null> {
  return page.evaluate(
    async ({ folder, path }) => {
      try {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
        const parts = path.split('/');
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text();
      } catch {
        return null;
      }
    },
    { folder, path },
  );
}

/** true se `path` (file o cartella) esiste nella cartella OPFS. */
export async function pathExists(page: Page, folder: string, path: string): Promise<boolean> {
  return page.evaluate(
    async ({ folder, path }) => {
      try {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
        const parts = path.split('/');
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        const last = parts[parts.length - 1];
        for await (const name of dir.keys()) if (name === last) return true;
        return false;
      } catch {
        return false;
      }
    },
    { folder, path },
  );
}

/** Elimina un file o una cartella (ricorsivamente) dalla cartella OPFS, "fuori dall'app". */
export async function removePath(page: Page, folder: string, path: string): Promise<void> {
  await page.evaluate(
    async ({ folder, path }) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
      const parts = path.split('/');
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
      await dir.removeEntry(parts[parts.length - 1], { recursive: true });
    },
    { folder, path },
  );
}
```

- [ ] **Step 7: Provider AI finto**

L'app crea da sola il profilo Ollama predefinito (`src/ai/profiles.ts`, `DEFAULT_URLS.ollama`). Il provider chiede l'elenco dei modelli a `/api/tags` e la risposta in streaming in formato OpenAI (`choices[].delta.content`); la proposta sta tra `<housemd-proposal>` e `</housemd-proposal>`, il resto è il commento in chat. È lo stesso protocollo che simulava `tests/browser/ai-smoke.tsx`.

`e2e/support/aiHarness.ts`:

```ts
import type { Page, Route } from '@playwright/test';

/** Indirizzo del profilo Ollama che l'app crea da sola al primo avvio. */
export const OLLAMA = 'http://localhost:11434';

/**
 * Modello finto: ogni richiesta di chat riceve `comment` + la proposta `reply`, in un solo evento SSE.
 * Le spec cambiano `reply`/`comment` prima di inviare una richiesta.
 */
export class FakeModel {
  reply = '# Changed\n\nNew paragraph.';
  comment = 'Fixed';
  /** Richieste di chat ricevute (non conta l'elenco dei modelli). */
  requests = 0;

  async install(page: Page): Promise<void> {
    await page.route(`${OLLAMA}/**`, (route) => this.#answer(route));
  }

  async #answer(route: Route): Promise<void> {
    const request = route.request();
    // L'app (localhost:4173) e il modello (localhost:11434) sono origini diverse: Chromium applica CORS
    // anche alle risposte di route.fulfill, e il POST JSON passa prima da un preflight OPTIONS.
    const origin = request.headers()['origin'] ?? '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
      vary: 'Origin',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (request.url().includes('/api/tags')) {
      await route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3.6:35b-mlx' }] }) });
      return;
    }
    this.requests++;
    const content = `${this.comment}<housemd-proposal>${this.reply}</housemd-proposal>`;
    const event = JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] });
    await route.fulfill({ headers: cors, contentType: 'text/event-stream', body: `data: ${event}\n\ndata: [DONE]\n\n` });
  }
}
```

Se Chromium chiede anche il permesso di "accesso alla rete locale" (Local Network Access) per `localhost:11434`, la prima spec AI (Task 13) fallisce con un errore di rete nel trace: in quel caso aggiungere in `e2e/playwright.config.ts`, dentro `use`, `permissions: ['local-network-access']` se Playwright 1.63 lo supporta, altrimenti `launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] }`, e annotarlo.

- [ ] **Step 8: Messaggi e fixture**

`e2e/support/i18n.ts`:

```ts
import { readFileSync } from 'node:fs';

import type { Messages } from '../../src/i18n/i18n.ts';

export type E2ELocale = 'en' | 'it';

const cache = new Map<E2ELocale, Messages>();

/** Messaggi reali dell'app (stessi file del bundle), così le spec non scrivono testi a mano. */
export function messagesFor(locale: E2ELocale): Messages {
  let messages = cache.get(locale);
  if (!messages) {
    const url = new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url);
    messages = JSON.parse(readFileSync(url, 'utf8')) as Messages;
    cache.set(locale, messages);
  }
  return messages;
}
```

`e2e/support/app.ts`:

```ts
import { test as base, expect, type Locator, type Page } from '@playwright/test';

import { translate, type Params } from '../../src/i18n/i18n.ts';
import { FakeModel } from './aiHarness.ts';
import {
  DEFAULT_FLAGS, FLAGS_KEY, harnessScript, pathExists, readText, removePath, seedFolder,
  type HarnessFlags, type Seed,
} from './fsHarness.ts';
import { messagesFor, type E2ELocale } from './i18n.ts';

type SaveKey = 'save.saved' | 'save.dirty' | 'save.saving' | 'save.error' | 'save.deleted';
type ModeKey = 'mode.editor' | 'mode.split' | 'mode.preview' | 'mode.ai';

/** Tutto ciò che le spec sanno dell'app: ruoli, nomi accessibili e disco. Niente classi CSS. */
export class App {
  folder: string = DEFAULT_FLAGS.folder;

  constructor(
    readonly page: Page,
    readonly locale: E2ELocale,
  ) {}

  t(key: string, params?: Params): string {
    return translate(messagesFor(this.locale), key, params);
  }

  async start(): Promise<void> {
    await this.page.goto('/');
  }

  /** Apre l'app, prepara la cartella nell'OPFS, la sceglie dal "selettore" e aspetta l'albero. */
  async openFolder(files: Seed, folder: string = DEFAULT_FLAGS.folder): Promise<void> {
    await this.start();
    await seedFolder(this.page, folder, files);
    await this.setFlags({ folder });
    await this.page.getByRole('button', { name: this.t('start.openFolder') }).click();
    await expect(this.tree()).toBeVisible();
  }

  async setFlags(flags: Partial<HarnessFlags>): Promise<void> {
    if (flags.folder) this.folder = flags.folder;
    await this.page.evaluate(
      ({ key, flags }) => {
        const current = JSON.parse(localStorage.getItem(key) ?? '{}') as object;
        localStorage.setItem(key, JSON.stringify({ ...current, ...flags }));
      },
      { key: FLAGS_KEY, flags },
    );
  }

  tree(): Locator {
    return this.page.getByRole('navigation', { name: this.t('tree.label') });
  }

  treeFile(name: string): Locator {
    return this.tree().getByRole('button', { name, exact: true });
  }

  /** Un file con bozza ha nel nome anche l'indicatore `tree.draft` (role="img" dentro il pulsante). */
  treeFileWithDraft(name: string): Locator {
    return this.tree().getByRole('button', { name: `${name} ${this.t('tree.draft')}`, exact: true });
  }

  async openFile(name: string): Promise<void> {
    await this.treeFile(name).click();
    await this.expectOpen(name);
  }

  /** Il file aperto è quello con aria-current="page" nell'albero. */
  async expectOpen(name: string): Promise<void> {
    await expect(this.treeFile(name)).toHaveAttribute('aria-current', 'page');
  }

  modes(): Locator {
    return this.page.getByRole('group', { name: this.t('toolbar.modes') });
  }

  /** Pulsante di una modalità. "AI" compare solo quando il controller AI è pronto. */
  mode(key: ModeKey): Locator {
    return this.modes().getByRole('button', { name: this.t(key), exact: true });
  }

  editorPane(): Locator {
    return this.page.getByRole('region', { name: this.t('pane.editor') });
  }

  /** Il contenuto editabile di CodeMirror (role="textbox"). */
  editor(): Locator {
    return this.editorPane().getByRole('textbox');
  }

  previewPane(): Locator {
    return this.page.getByRole('region', { name: this.t('pane.preview') });
  }

  async typeAtEnd(text: string): Promise<void> {
    await this.editor().click();
    await this.page.keyboard.press('ControlOrMeta+End');
    await this.page.keyboard.type(text);
  }

  /**
   * Seleziona nell'editor i caratteri [from, to) del documento, solo con la tastiera (niente API di
   * CodeMirror: in produzione non sono raggiungibili). Il documento non deve avere righe a capo morbido.
   */
  async selectRange(from: number, to: number): Promise<void> {
    await this.editor().click();
    await this.page.keyboard.press('ControlOrMeta+Home');
    for (let i = 0; i < from; i++) await this.page.keyboard.press('ArrowRight');
    for (let i = from; i < to; i++) await this.page.keyboard.press('Shift+ArrowRight');
  }

  saveState(key: SaveKey): Locator {
    return this.page.getByText(this.t(key), { exact: true });
  }

  toast(text: string): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }

  disk(path: string): Promise<string | null> {
    return readText(this.page, this.folder, path);
  }

  exists(path: string): Promise<boolean> {
    return pathExists(this.page, this.folder, path);
  }

  writeExternal(path: string, text: string): Promise<void> {
    return seedFolder(this.page, this.folder, { [path]: text });
  }

  removeExternal(path: string): Promise<void> {
    return removePath(this.page, this.folder, path);
  }

  /** La finestra torna in primo piano: l'app controlla le modifiche esterne. */
  async windowFocus(): Promise<void> {
    await this.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  }
}

export const test = base.extend<{ flags: Partial<HarnessFlags>; appLocale: E2ELocale; ai: FakeModel; app: App }>({
  flags: [{}, { option: true }],
  appLocale: ['en', { option: true }],
  // Sempre installato: senza, l'app proverebbe a contattare un Ollama vero sulla macchina che esegue i test.
  ai: async ({ page }, use) => {
    const model = new FakeModel();
    await model.install(page);
    await use(model);
  },
  app: async ({ page, flags, appLocale, ai }, use) => {
    void ai;
    await page.addInitScript(harnessScript, { defaults: { ...DEFAULT_FLAGS, ...flags }, key: FLAGS_KEY });
    await page.addInitScript((locale) => {
      if (localStorage.getItem('housemd:locale') === null) localStorage.setItem('housemd:locale', JSON.stringify(locale));
    }, appLocale);
    // Con modifiche non salvate l'app chiede conferma prima di uscire: nei test si accetta sempre.
    page.on('dialog', (dialog) => void (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
    await use(new App(page, appLocale));
  },
});

export { expect };
```

- [ ] **Step 9: Prima spec (smoke)**

`e2e/startup.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

test('opening a folder lists markdown files and visible folders only', async ({ app, page }) => {
  await app.openFolder({
    'note.md': '# Note',
    'sub/other.md': 'other',
    '.hidden/secret.md': 'secret',
  });
  await expect(app.treeFile('note.md')).toBeVisible();
  await expect(app.tree().getByText('sub', { exact: true })).toBeVisible();
  await expect(app.tree().getByText('.hidden', { exact: true })).toHaveCount(0);
  await expect(page.getByText(app.t('toolbar.noFile'), { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('HouseMD');
});
```

Nota: l'albero di oggi mostra anche i file non markdown come voci non apribili (`node.kind === 'asset'`); questa spec non li tocca, ci pensa `preview.spec.ts` con le immagini.

- [ ] **Step 10: Eseguire la spec**

Run: `npm run test:e2e -- startup.spec.ts`
Expected: `1 passed`. Se fallisce all'avvio del server, eseguire `npm run build` da solo e leggere l'errore; se la porta 4173 è occupata, chiudere il processo che la usa (non cambiare `reuseExistingServer`). Se `showDirectoryPicker` o `createWritable` sull'OPFS non si comportano come previsto, fermarsi e riferire: è il presupposto dell'intero piano.

- [ ] **Step 11: Prova di sensibilità**

Cambiare temporaneamente `'note.md'` in `'nope.md'` nella prima `expect`, eseguire di nuovo: deve fallire con un timeout su `getByRole('button', { name: 'nope.md' })`. Ripristinare.

- [ ] **Step 12: `npm test` non raccoglie le spec e il lint passa**

Run: `npm test 2>&1 | tail -8 && npm run lint`
Expected: stesso numero di test dello Step 2, lint pulito.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json .gitignore e2e/
git commit -m "test: suite Playwright con cartella finta su OPFS e modello AI finto"
```

---

### Task 2: Avvio, ripresa accesso, cambio cartella, config non valida

**Files:**
- Modify: `e2e/startup.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1); `seedFolder` da `./support/fsHarness.ts`.

- [ ] **Step 1: Aggiungere le spec**

In testa a `e2e/startup.spec.ts` aggiungere l'import:

```ts
import { seedFolder } from './support/fsHarness.ts';
```

In fondo al file:

```ts
test.describe('browser without File System Access', () => {
  test.use({
    flags: { picker: false },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  });

  test('explains why and offers no open button', async ({ app, page }) => {
    await app.start();
    await expect(page.getByText(app.t('unsupported.firefox'))).toBeVisible();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toHaveCount(0);
  });
});

test('after a reload the folder and the last open file come back', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha', 'b.md': 'beta' });
  await app.openFile('b.md');
  await page.reload();
  await app.expectOpen('b.md');
  await expect(app.editor()).toHaveText('beta');
});

test('without permission the start screen offers to resume access', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  await app.setFlags({ query: 'prompt', request: 'granted' });
  await page.reload();
  const resume = page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) });
  await expect(resume).toBeVisible();
  await expect(page.getByRole('button', { name: app.t('start.openOther') })).toBeVisible();
  await resume.click();
  await expect(app.treeFile('a.md')).toBeVisible();
});

test('a denied resume leaves the start screen in place', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' });
  await app.setFlags({ query: 'prompt', request: 'denied' });
  await page.reload();
  const resume = page.getByRole('button', { name: app.t('start.resume', { folder: 'notes' }) });
  await resume.click();
  await expect(resume).toBeVisible();
  await expect(app.tree()).toHaveCount(0);
});

test('switching folders A → B → A brings back the last file of A', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha' }, 'alpha');
  await app.openFile('a.md');
  await seedFolder(page, 'beta', { 'b.md': 'beta' });
  await app.setFlags({ folder: 'beta' });
  // Il pulsante della cartella nella sidebar ha come nome il nome della cartella (niente aria-label).
  await page.getByRole('button', { name: 'alpha', exact: true }).click();
  await expect(app.treeFile('b.md')).toBeVisible();
  await expect(app.treeFile('a.md')).toHaveCount(0);
  await app.setFlags({ folder: 'alpha' });
  await page.getByRole('button', { name: 'beta', exact: true }).click();
  await app.expectOpen('a.md');
});

test('an invalid .housemd.json shows a toast and the app still opens', async ({ app }) => {
  await app.openFolder({ 'a.md': 'alpha', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(app.toast(prefix)).toBeVisible();
  await expect(app.treeFile('a.md')).toBeVisible();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- startup.spec.ts`
Expected: `7 passed`. In caso di fallimento applicare la "Regola delle spec di caratterizzazione".

- [ ] **Step 3: Prova di sensibilità**

Nel test A → B → A, sostituire temporaneamente l'ultima riga con `await app.expectOpen('b.md')`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/startup.spec.ts
git commit -m "test: e2e di avvio, ripresa accesso, cambio cartella e config non valida"
```

---

### Task 3: Editor, salvataggio, modalità, sidebar

**Files:**
- Create: `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1), `PIXEL_PNG_BASE64`.

- [ ] **Step 1: Scrivere la spec**

`e2e/editor.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';

test('typing autosaves to disk after a pause', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await app.typeAtEnd('\nhello');
  await expect(app.saveState('save.dirty')).toBeVisible();
  await expect.poll(() => app.disk('note.md')).toBe('# Note\n\nhello');
  await expect(app.saveState('save.saved')).toBeVisible();
});

test('Ctrl+S saves right away, with the autosave timer frozen', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  // Da qui nessun timer dell'app scatta se non lo facciamo avanzare noi.
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('x');
  await page.clock.runFor(100); // molto meno dei 1000 ms dell'autosalvataggio
  expect(await app.disk('note.md')).toBe('# Note\n');
  await page.keyboard.press('ControlOrMeta+s');
  // L'orologio è fermo: il salvataggio può venire solo da Ctrl+S.
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nx');
});

test('[[ suggests the folder files and completes the wikilink', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note\n', 'idea.md': '# Idea' });
  await app.openFile('note.md');
  await app.typeAtEnd('[[ide');
  const option = page.getByRole('option', { name: /^idea/ });
  await expect(option).toBeVisible();
  // Clic e non Invio: @codemirror/autocomplete ignora Invio per i primi 75 ms (interactionDelay).
  await option.click();
  await expect(app.editor()).toContainText('[[idea]]');
});

/** Incolla o trascina nell'editor un'immagine, con gli stessi eventi che userebbe il browser. */
async function sendImage(app: App, kind: 'paste' | 'drop', name: string): Promise<void> {
  await app.editor().evaluate(
    (el, { kind, name, base64 }) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], name, { type: 'image/png' }));
      const box = el.getBoundingClientRect();
      el.dispatchEvent(
        kind === 'paste'
          ? new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
          : new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10 }),
      );
    },
    { kind, name, base64: PIXEL_PNG_BASE64 },
  );
}

test('pasting an image saves it under assets/ and links it', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await app.editor().click();
  await sendImage(app, 'paste', 'diagram.png');
  await expect(app.editor()).toContainText('(assets/diagram.png)');
  await expect.poll(() => app.exists('assets/diagram.png')).toBe(true);
});

test('dropping an image saves it under assets/ and links it', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await sendImage(app, 'drop', 'photo.png');
  await expect(app.editor()).toContainText('(assets/photo.png)');
  await expect.poll(() => app.exists('assets/photo.png')).toBe(true);
});

test('view modes: buttons, Ctrl+\\ cycles the document views, remembered after reload', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await app.openFile('note.md');

  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.editorPane()).toBeVisible();
  await expect(app.previewPane()).toBeVisible();

  await app.mode('mode.preview').click();
  await expect(app.editorPane()).toHaveCount(0);
  await expect(app.previewPane()).toBeVisible();

  // Ordine del ciclo: editor → split → preview → editor. La modalità AI non fa parte del ciclo.
  await page.keyboard.press('ControlOrMeta+Backslash');
  await expect(app.mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.previewPane()).toHaveCount(0);

  await page.reload();
  await app.expectOpen('note.md');
  await expect(app.mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
});

test('sidebar: arrow keys resize it, hiding it is remembered', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const separator = page.getByRole('separator', { name: app.t('sidebar.resize') });
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '296');

  // "Nascondi" esiste due volte (testata della sidebar e barra degli strumenti): quello della barra
  // è un interruttore con aria-pressed.
  await page.getByRole('button', { name: app.t('sidebar.hide'), pressed: true }).click();
  await expect(app.tree()).toHaveCount(0);

  await page.reload();
  const show = page.getByRole('button', { name: app.t('sidebar.show') });
  await expect(show).toBeVisible();
  await expect(app.tree()).toHaveCount(0);
  await show.click();
  await expect(separator).toHaveAttribute('aria-valuenow', '296');
});

test('Ctrl+B outside the editor toggles the sidebar', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('separator', { name: app.t('sidebar.resize') }).focus();
  await page.keyboard.press('ControlOrMeta+b');
  await expect(app.tree()).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+b');
  await expect(app.tree()).toBeVisible();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- editor.spec.ts`
Expected: `8 passed`. Se con l'orologio in pausa CodeMirror non registra la digitazione, aumentare `runFor` a piccoli passi restando **sotto** i 1000 ms; non togliere la pausa. Il nome dell'immagine salvata viene da `imageFileName` (`src/config/images.ts`): se il link reale è diverso, la spec si adegua all'app. Nell'ultimo test, se dopo il primo Ctrl+B il separatore sparisce e il focus va sul `body`, il secondo Ctrl+B deve comunque arrivare a `window`: se non arriva, premere prima `Escape` e annotarlo.

- [ ] **Step 3: Prova di sensibilità**

Nel primo test attendere `'# Note\n\nhellO'`: deve fallire mostrando il contenuto reale del disco. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/editor.spec.ts
git commit -m "test: e2e di editor, salvataggio, modalità e sidebar"
```

---

### Task 4: Anteprima

**Files:**
- Create: `e2e/preview.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1), `PIXEL_PNG_BASE64`.

- [ ] **Step 1: Scrivere la spec**

`e2e/preview.spec.ts`:

```ts
import { expect, test } from './support/app.ts';
import { PIXEL_PNG_BASE64 } from './support/fsHarness.ts';

const PIXEL = { base64: PIXEL_PNG_BASE64 };

const NOTE = [
  '---',
  'title: Test note',
  'tags: [alpha, beta]',
  'date: 2026-01-15',
  '---',
  '# Heading',
  '',
  'Go to [[idea]], to [[brand new]], to [other](sub/other.md), to [accent](citt%C3%A0.md) or [outside](https://example.com).',
  '',
  '![missing](missing.png)',
  '',
  '![pixel](assets/pixel.png)',
  '',
  '<img src="x.png" onerror="window.__pwned = 1">',
  '',
  '<a href="javascript:window.__pwned = 2">bad link</a>',
  '',
  '<script>window.__pwned = 3</script>',
  '',
].join('\n');

const FILES = {
  'note.md': NOTE,
  'idea.md': '# Idea',
  'sub/other.md': '# Other',
  'città.md': '# Città',
  'assets/pixel.png': PIXEL,
  'bad.md': '---\ntitle: [\n---\nbody',
};

test.beforeEach(async ({ app }) => {
  await app.openFolder(FILES);
  await app.openFile('note.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
});

test('renders markdown and the frontmatter card', async ({ app }) => {
  const preview = app.previewPane();
  await expect(preview.getByText('Test note', { exact: true })).toBeVisible();
  await expect(preview.getByText('alpha', { exact: true })).toBeVisible();
  await expect(preview.getByText('beta', { exact: true })).toBeVisible();
  await expect(preview.getByText('January 15, 2026', { exact: true })).toBeVisible();
});

test('local images load from the folder, missing ones say so', async ({ app }) => {
  const preview = app.previewPane();
  await expect(preview.getByRole('img', { name: 'pixel' })).toHaveAttribute('src', /^blob:/);
  // Le immagini dell'anteprima tengono il title nativo (niente ::after su <img>): eccezione voluta.
  await expect(preview.getByRole('img', { name: 'missing' })).toHaveAttribute(
    'title',
    app.t('preview.imageMissing', { path: 'missing.png' }),
  );
});

test('hostile HTML in a note is neutralized', async ({ app, page }) => {
  const preview = app.previewPane();
  await expect(preview.locator('script')).toHaveCount(0);
  await expect(preview.getByText('bad link')).not.toHaveAttribute('href', /javascript:/);
  // Lascia al browser il tempo di caricare (e far fallire) le immagini.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('external links open in a new tab without opener', async ({ app }) => {
  const link = app.previewPane().getByRole('link', { name: 'outside', exact: true });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('wikilinks and relative links open files, a missing wikilink creates the note', async ({ app }) => {
  const preview = app.previewPane();
  await preview.getByRole('link', { name: 'idea', exact: true }).click();
  await app.expectOpen('idea.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'other', exact: true }).click();
  await app.expectOpen('other.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'accent', exact: true }).click();
  await app.expectOpen('città.md');

  await app.openFile('note.md');
  await preview.getByRole('link', { name: 'brand new', exact: true }).click();
  await app.expectOpen('brand new.md');
  await expect.poll(() => app.disk('brand new.md')).toBe('');
});

test('the preview follows the editor', async ({ app }) => {
  await app.typeAtEnd('\n## Added later');
  await expect(app.previewPane().getByRole('heading', { name: 'Added later' })).toBeVisible();
});

test('invalid frontmatter is reported in the preview', async ({ app }) => {
  await app.openFile('bad.md');
  const prefix = app.t('preview.frontmatterInvalid', { detail: '' }).trim();
  await expect(app.previewPane().getByText(prefix)).toBeVisible();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- preview.spec.ts`
Expected: `7 passed`. La card usa `toLocaleDateString` con la lingua dell'interfaccia; se il testo della data è diverso, correggere la stringa attesa con quella reale.

- [ ] **Step 3: Prova di sensibilità**

Nel test dell'HTML ostile cambiare temporaneamente `.toBeUndefined()` in `.toBe(1)`: deve fallire con `undefined`. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/preview.spec.ts
git commit -m "test: e2e dell'anteprima (frontmatter, immagini, link, HTML ostile)"
```

---

### Task 5: Scroll sincronizzato

**Files:**
- Create: `e2e/sync-scroll.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

- [ ] **Step 1: Scrivere la spec**

`e2e/sync-scroll.spec.ts`:

```ts
import type { Locator } from '@playwright/test';

import { expect, test } from './support/app.ts';

const LONG = Array.from(
  { length: 80 },
  (_, i) => `## Section ${i + 1}\n\n${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6)}\n`,
).join('\n');

/** Primo elemento scorrevole dentro il pannello (per l'editor è .cm-scroller di CodeMirror). */
async function scrollPane(pane: Locator, fraction: number): Promise<void> {
  await pane.evaluate((root, fraction) => {
    const scroller = [root, ...root.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY),
    ) as HTMLElement;
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * fraction;
  }, fraction);
}

/** Numero della prima "Section N" visibile in cima al pannello (titolo h2 o riga "## Section N"). */
async function sectionAtTop(pane: Locator): Promise<number | null> {
  return pane.evaluate((root) => {
    const scroller = [root, ...root.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY),
    );
    if (!scroller) return null;
    const top = scroller.getBoundingClientRect().top;
    for (const el of scroller.querySelectorAll('h2, .cm-line')) {
      const match = /^(?:## )?Section (\d+)$/.exec(el.textContent?.trim() ?? '');
      if (match && el.getBoundingClientRect().bottom > top + 1) return Number(match[1]);
    }
    return null;
  });
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'long.md': LONG });
  await app.openFile('long.md');
  await expect(app.previewPane().getByRole('heading', { name: 'Section 80' })).toBeAttached();
});

test('scrolling the editor brings the preview to the same section', async ({ app }) => {
  await scrollPane(app.editorPane(), 0.5);
  await expect.poll(() => sectionAtTop(app.editorPane())).toBeGreaterThan(20);
  await expect
    .poll(async () => {
      const [editor, preview] = [await sectionAtTop(app.editorPane()), await sectionAtTop(app.previewPane())];
      return editor !== null && preview !== null && Math.abs(editor - preview) <= 1;
    })
    .toBe(true);
});

test('scrolling the preview brings the editor to the same section', async ({ app, page }) => {
  await scrollPane(app.previewPane(), 0.3);
  await expect.poll(() => sectionAtTop(app.previewPane())).toBeGreaterThan(10);
  await expect
    .poll(async () => {
      const [editor, preview] = [await sectionAtTop(app.editorPane()), await sectionAtTop(app.previewPane())];
      return editor !== null && preview !== null && Math.abs(editor - preview) <= 1;
    })
    .toBe(true);
  // Nessun rimbalzo: dopo la finestra di soppressione (150 ms) la posizione resta ferma.
  const settled = await sectionAtTop(app.previewPane());
  await page.waitForTimeout(400);
  expect(await sectionAtTop(app.previewPane())).toBe(settled);
});
```

Nota: la larghezza massima del testo dell'anteprima (72 caratteri di default) rende i paragrafi più alti che a piena larghezza; se `LONG` non basta a far scorrere l'editor oltre la sezione 20, allungare il testo nella spec.

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- sync-scroll.spec.ts --repeat-each=3`
Expected: `6 passed`. Se una ripetizione fallisce, stabilizzare la spec (mai `src/`).

- [ ] **Step 3: Prova di sensibilità**

Cambiare temporaneamente `<= 1` in `< 0`: entrambe devono fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/sync-scroll.spec.ts
git commit -m "test: e2e dello scroll sincronizzato in split"
```

---

### Task 6: Albero, dialog, menu e tastiera

**Files:**
- Create: `e2e/tree.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

- [ ] **Step 1: Scrivere la spec**

`e2e/tree.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

test.describe('dialogs and menu', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
  });

  test('new file from the sidebar: created on disk and opened', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('file.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('file.new') });
    await dialog.getByRole('textbox').fill('città');
    await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
    await expect(dialog).toHaveCount(0);
    await app.expectOpen('città.md');
    await expect.poll(() => app.exists('città.md')).toBe(true);
  });

  test('name errors keep the dialog open, Esc closes it', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('file.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('file.new') });
    const input = dialog.getByRole('textbox');
    const create = dialog.getByRole('button', { name: app.t('dialog.create') });

    await create.click();
    await expect(dialog.getByText(app.t('name.error.empty'))).toBeVisible();

    await input.fill('note');
    await create.click();
    await expect(dialog.getByText(app.t('name.error.taken'))).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('.secret');
    await create.click();
    await expect(dialog.getByText(app.t('name.error.dot'))).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('new folder appears in the tree (empty folders are shown)', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('folder.new') }).first().click();
    const dialog = page.getByRole('dialog', { name: app.t('folder.new') });
    await dialog.getByRole('textbox').fill('drafts');
    await dialog.getByRole('button', { name: app.t('dialog.create') }).click();
    await expect(app.tree().getByText('drafts', { exact: true })).toBeVisible();
    await expect.poll(() => app.exists('drafts')).toBe(true);
  });

  test('renaming the open file keeps it open, the name is preselected without .md', async ({ app, page }) => {
    await app.openFile('note.md');
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await page.getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) });
    // "note" è selezionato: scrivere lo sostituisce, ".md" resta.
    await page.keyboard.type('renamed');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await app.expectOpen('renamed.md');
    await expect.poll(() => app.disk('renamed.md')).toBe('# Note');
    await expect.poll(() => app.exists('note.md')).toBe(false);
  });

  test('delete from the context menu asks first; cancel keeps the file', async ({ app, page }) => {
    const openMenu = async () => {
      await app.treeFile('note.md').click({ button: 'right' });
      await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
      return page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) });
    };

    let dialog = await openMenu();
    await expect(dialog.getByText(app.t('dialog.delete.file'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(dialog).toHaveCount(0);
    expect(await app.exists('note.md')).toBe(true);

    dialog = await openMenu();
    await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
    await expect(app.treeFile('note.md')).toHaveCount(0);
    await expect.poll(() => app.exists('note.md')).toBe(false);
  });

  test('deleting a folder warns that its content goes too', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
    await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'docs' }) });
    await expect(dialog.getByText(app.t('dialog.delete.folder'))).toBeVisible();
    await dialog.getByRole('button', { name: app.t('dialog.delete.confirm') }).click();
    await expect.poll(() => app.exists('docs')).toBe(false);
  });

  test('folders expand and collapse', async ({ app }) => {
    const folder = app.tree().getByText('docs', { exact: true });
    await expect(app.treeFile('guide.md')).toBeHidden();
    await folder.click();
    await expect(app.treeFile('guide.md')).toBeVisible();
    await folder.click();
    await expect(app.treeFile('guide.md')).toBeHidden();
  });

  test('renaming a folder moves its files', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'docs' }) });
    // Per le cartelle è selezionato tutto il nome: scrivere lo sostituisce.
    await page.keyboard.type('manuals');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(app.tree().getByText('manuals', { exact: true })).toBeVisible();
    await expect.poll(() => app.disk('manuals/guide.md')).toBe('# Guide');
    await expect.poll(() => app.exists('docs')).toBe(false);
  });

  test('the file menu has History, which opens the history panel for that file', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.history'), exact: true }).click();
    await app.expectOpen('note.md');
    await expect(page.getByRole('heading', { name: app.t('history.title', { path: 'note.md' }) })).toBeVisible();
  });
});

test.describe('keyboard', () => {
  const FILES = { 'a.md': 'A', 'docs/b.md': 'B', 'z.md': 'Z' };

  /** La riga dell'albero di una cartella è il <summary> del suo <details>. */
  const folderRow = (app: App, name: string) => app.tree().locator('summary').filter({ hasText: name });

  test.beforeEach(async ({ app }) => {
    await app.openFolder(FILES);
    await app.openFile('a.md');
  });

  test('one tab stop: the open file; the ⋯ buttons are not tab stops', async ({ app }) => {
    await expect(app.tree().locator('[tabindex="0"]')).toHaveCount(1);
    await expect(app.treeFile('a.md')).toHaveAttribute('tabindex', '0');
    await expect(app.tree().getByRole('button', { name: app.t('tree.actions', { name: 'a.md' }) })).toHaveAttribute('tabindex', '-1');
  });

  test('arrows, Home/End and left/right on folders move the focus', async ({ app, page }) => {
    await app.treeFile('a.md').focus();
    await page.keyboard.press('Home');
    await expect(folderRow(app, 'docs')).toBeFocused();
    await page.keyboard.press('ArrowRight'); // apre la cartella
    await page.keyboard.press('ArrowRight'); // entra nel primo figlio
    await expect(app.treeFile('b.md')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(app.treeFile('a.md')).toBeFocused();
    await page.keyboard.press('End');
    await expect(app.treeFile('z.md')).toBeFocused();

    await app.treeFile('b.md').focus();
    await page.keyboard.press('ArrowLeft'); // torna alla cartella
    await expect(folderRow(app, 'docs')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // la chiude
    await expect(app.treeFile('b.md')).toBeHidden();
  });

  test('Shift+F10 opens the menu with the focus inside, Esc brings it back to the row', async ({ app, page }) => {
    await app.treeFile('z.md').focus();
    await page.keyboard.press('Shift+F10');
    // Per un file la prima voce è "Cronologia".
    await expect(app.tree().getByRole('button', { name: app.t('tree.history'), exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(app.treeFile('z.md')).toBeFocused();
  });

  test('Enter on the ⋯ button opens the menu from the keyboard, for a folder too', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).focus();
    await page.keyboard.press('Enter');
    // Per una cartella la prima voce è "Nuovo file": dentro l'albero c'è solo come voce di menu.
    await expect(app.tree().getByRole('button', { name: app.t('file.new'), exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeHidden();
  });
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- tree.spec.ts`
Expected: `13 passed`. La posizione del popover vicino ai bordi resta manuale (spec §9). Il nome "New file" compare fino a tre volte (testata della sidebar, voce del menu delle cartelle, pulsante della schermata vuota): `.first()` è la testata della sidebar; la voce di menu si prende sempre dentro `app.tree()`.

- [ ] **Step 3: Prova di sensibilità**

Nel test di rinomina attendere `'renamed.md.md'`: deve fallire. Nel test del tab stop attendere `toHaveCount(2)`: deve fallire con `1`. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/tree.spec.ts
git commit -m "test: e2e dell'albero (dialog, menu, tastiera con un solo tab stop)"
```

---

### Task 7: Ricerca

**Files:**
- Create: `e2e/search.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

- [ ] **Step 1: Scrivere la spec**

`e2e/search.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

const FILES = {
  'alpha.md': '# Alpha\n\nThe quick brown fox jumps.',
  'beta.md': '# Beta\n\nNothing to see here.',
  'sub/gamma.md': '# Gamma\n\nAnother fox story.',
};

test.beforeEach(async ({ app }) => {
  await app.openFolder(FILES);
});

test('Ctrl+K focuses the search box and results show matches', async ({ app, page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await expect(box).toBeFocused();
  await box.fill('fox');
  const results = page.getByRole('list', { name: app.t('search.results') });
  await expect(results.getByRole('button')).toHaveCount(2);
  await expect(results.locator('mark').first()).toBeVisible();

  await results.getByRole('button', { name: /Gamma/ }).click();
  await app.expectOpen('gamma.md');
  // I termini cercati sono evidenziati nell'anteprima con la CSS Custom Highlight API.
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get('housemd-search')?.size ?? 0))
    .toBeGreaterThan(0);
});

test('Enter opens the first result without waiting', async ({ app, page }) => {
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('Nothing');
  await box.press('Enter');
  await app.expectOpen('beta.md');
});

test('no results, then Esc clears the query', async ({ app, page }) => {
  const box = page.getByRole('searchbox', { name: app.t('search.label') });
  await box.fill('zzzzqqq');
  await expect(page.getByText(app.t('search.none'), { exact: true })).toBeVisible();
  await box.press('Escape');
  await expect(box).toHaveValue('');
  await expect(page.getByRole('list', { name: app.t('search.results') })).toHaveCount(0);
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- search.spec.ts`
Expected: `3 passed`.

- [ ] **Step 3: Prova di sensibilità**

Attendere `toHaveCount(3)` sui risultati: deve fallire con `2`. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "test: e2e della ricerca (Ctrl+K, Invio, Esc, evidenziazione)"
```

---

### Task 8: Modifiche esterne, conflitto, accesso perso, bozza d'emergenza

**Files:**
- Create: `e2e/external.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1), in particolare `writeExternal`, `removeExternal`, `windowFocus`, `setFlags`, `toast`.

- [ ] **Step 1: Scrivere la spec**

`e2e/external.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

// L'orologio finto si installa prima che la pagina carichi; scorre normalmente finché un test non
// lo mette in pausa (solo i test di conflitto lo fanno).
test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
});

/**
 * Modifica locale non salvata + modifica esterna, con l'autosalvataggio fermo: l'orologio della
 * pagina è in pausa, quindi il conflitto non dipende da quanto è veloce la macchina.
 */
async function localAndExternalEdit(app: App): Promise<void> {
  await app.page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('mine');
  await app.page.clock.runFor(100); // molto meno dei 1000 ms dell'autosalvataggio
  await app.writeExternal('note.md', 'theirs, longer text');
  await app.windowFocus();
}

test('an external change with no local edits is reloaded', async ({ app }) => {
  await app.writeExternal('note.md', '# Changed outside\n');
  await app.windowFocus();
  await expect(app.editor()).toHaveText('# Changed outside');
});

test('an external change during local edits raises a conflict; reload takes the disk', async ({ app, page }) => {
  await localAndExternalEdit(app);
  const bar = page.getByRole('alert').filter({ hasText: app.t('conflict.message') });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: app.t('conflict.reload') }).click();
  await expect(bar).toHaveCount(0);
  await expect(app.editor()).toHaveText('theirs, longer text');
});

test('conflict: overwrite writes the local text', async ({ app, page }) => {
  await localAndExternalEdit(app);
  const bar = page.getByRole('alert').filter({ hasText: app.t('conflict.message') });
  await bar.getByRole('button', { name: app.t('conflict.overwrite') }).click();
  await page.clock.runFor(1500); // se la sovrascrittura passa da un timer, lo si lascia scattare
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nmine');
});

test('the open file deleted outside: toast and "deleted on disk" state', async ({ app }) => {
  await app.removeExternal('note.md');
  await app.windowFocus();
  await expect(app.toast(app.t('toast.deletedOutside', { path: 'note.md' }))).toBeVisible();
  await expect(app.saveState('save.deleted')).toBeVisible();
});

test('a file created outside appears in tree and search', async ({ app, page }) => {
  await app.writeExternal('fresh.md', '# Fresh\n\nunicorn');
  await app.windowFocus();
  await expect(app.treeFile('fresh.md')).toBeVisible();
  await page.getByRole('searchbox', { name: app.t('search.label') }).fill('unicorn');
  await expect(page.getByRole('list', { name: app.t('search.results') }).getByRole('button')).toHaveCount(1);
});

test('access lost: blocking dialog, denied retry, then resume saves the text', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('x');
  const dialog = page.getByRole('dialog', { name: app.t('access.title') });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5); // clic sul backdrop, fuori dal dialog
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: app.t('access.resume') }).click();
  await expect(dialog.getByText(app.t('access.denied'))).toBeVisible();

  await app.setFlags({ denyWrites: false, request: 'granted' });
  await dialog.getByRole('button', { name: app.t('access.resume') }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => app.disk('note.md')).toBe('# Note\nx');
});

test('draft survives a failed save and a reload', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('draft');
  await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();

  await app.setFlags({ denyWrites: false, request: 'granted' });
  await page.reload();
  await expect(app.editor()).toContainText('draft');
  await expect(app.toast(app.t('toast.restoredDraft', { path: 'note.md' }))).toBeVisible();
});

test('a draft whose file vanished is listed under "drafts without a file"', async ({ app, page }) => {
  await app.setFlags({ denyWrites: true, request: 'denied' });
  await app.typeAtEnd('orphan text');
  await expect(page.getByRole('dialog', { name: app.t('access.title') })).toBeVisible();
  await app.setFlags({ denyWrites: false, request: 'granted' });
  await app.removeExternal('note.md');

  await page.reload();
  const orphans = page.getByRole('region', { name: app.t('orphans.title') });
  await expect(orphans.getByRole('button', { name: 'note.md', exact: true })).toBeVisible();
  await expect(app.toast(app.t('toast.restoredDraftDeleted', { path: 'note.md' }))).toBeVisible();
  await expect(app.editor()).toContainText('orphan text');
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- external.spec.ts --repeat-each=3`
Expected: `24 passed`. Dopo il ricaricamento della bozza il file nell'albero ha l'indicatore di bozza: per questo il test non usa `app.expectOpen` (che cerca il nome esatto); se serve, usare `app.treeFileWithDraft('note.md')`. Se una ripetizione fallisce, cercare nel trace un timer dell'app che il test non fa avanzare.

- [ ] **Step 3: Prova di sensibilità**

Nel test dell'accesso perso, attendere `'# Note\ny'`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/external.spec.ts
git commit -m "test: e2e di modifiche esterne, conflitto, accesso perso e bozza d'emergenza"
```

---

### Task 9: Tema e lingua

**Files:**
- Create: `e2e/theme-i18n.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1); opzioni `appLocale` e `locale` di Playwright; `messagesFor`.

- [ ] **Step 1: Scrivere la spec**

`e2e/theme-i18n.spec.ts`:

```ts
import { translate } from '../src/i18n/i18n.ts';
import { expect, test } from './support/app.ts';
import { messagesFor } from './support/i18n.ts';

test('theme button cycles auto → light → dark; index.html applies dark before the app starts', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'auto');

  await page.getByRole('button', { name: app.t('theme.auto') }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: app.t('theme.light') }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161a');

  // Si trattiene il modulo dell'app durante il ricaricamento: quello che si vede finché è fermo lo
  // ha fatto solo lo script inline di index.html.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/assets/index-*.js', async (route) => {
    await held;
    await route.continue();
  });
  await page.reload({ waitUntil: 'commit' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await html.evaluate((el) => (el as HTMLElement).style.colorScheme)).toBe('dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161a');
  // L'app non è ancora partita: il punto di montaggio è vuoto.
  await expect(page.locator('#root')).toBeEmpty();

  release();
  await page.unroute('**/assets/index-*.js');
  await expect(page.getByRole('button', { name: app.t('theme.dark') })).toBeVisible();
});

test('switching language in the settings updates the UI right away and is remembered', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const it = (key: string) => translate(messagesFor('it'), key);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await page.getByLabel(app.t('settings.language')).selectOption('it');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('heading', { name: it('settings.title'), level: 1 })).toBeVisible();
  await page.getByRole('button', { name: it('settings.close') }).click();
  await expect(page.getByRole('button', { name: it('toolbar.settings') })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: it('toolbar.settings') })).toBeVisible();
});

test.describe('Italian', () => {
  test.use({ appLocale: 'it' });

  test('a saved language preference is used, <html lang> follows', async ({ app, page }) => {
    await app.start();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  });
});

test.describe('unknown saved language', () => {
  test.use({ appLocale: 'it', locale: 'it-IT' });

  test('falls back to the browser language', async ({ app, page }) => {
    await page.addInitScript(() => localStorage.setItem('housemd:locale', JSON.stringify('xx')));
    await app.start();
    await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
  });
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- theme-i18n.spec.ts`
Expected: `4 passed`. Il bundle d'ingresso di Vite si chiama `assets/index-<hash>.js`: se `npm run build` produce un nome diverso (vedi `dist/index.html`), adeguare il pattern di `page.route`. Il chunk della lingua si carica al volo: `toHaveAttribute('lang', 'it')` aspetta che sia arrivato.

- [ ] **Step 3: Prova di sensibilità**

Nel test italiano usare temporaneamente `appLocale: 'en'`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/theme-i18n.spec.ts
git commit -m "test: e2e di tema e lingua (anche a caldo dalle impostazioni)"
```

---

### Task 10: Barra di formattazione, scorciatoie, tooltip, titolo della scheda

Copre la parte "formattazione" e "titolo" di `tests/browser/run-ai-smoke.mjs`.

**Files:**
- Create: `e2e/formatting.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1), in particolare `selectRange`.

- [ ] **Step 1: Scrivere la spec**

`e2e/formatting.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
});

test('the tab title follows the open file', async ({ page }) => {
  await expect(page).toHaveTitle('HMD - a.md');
});

test('a selection shows the formatting toolbar; it goes away on blur', async ({ app, page }) => {
  const toolbar = page.getByRole('toolbar', { name: app.t('format.toolbar') });
  await expect(toolbar).toHaveCount(0);
  await app.selectRange(4, 7); // "due"
  await expect(toolbar).toBeVisible();
  await page.getByRole('searchbox', { name: app.t('search.label') }).focus();
  await expect(toolbar).toHaveCount(0);
});

test('Ctrl+B in the editor is bold, not the sidebar', async ({ app }) => {
  await app.selectRange(4, 7);
  await app.page.keyboard.press('ControlOrMeta+b');
  await expect(app.editor()).toHaveText('uno **due** tre');
  await expect(app.tree()).toBeVisible();
});

test('toolbar buttons format and keep the focus in the editor', async ({ app, page }) => {
  await app.selectRange(4, 7);
  const toolbar = page.getByRole('toolbar', { name: app.t('format.toolbar') });
  await toolbar.getByRole('button', { name: app.t('format.bold') }).click();
  await toolbar.getByRole('button', { name: app.t('format.italic') }).click();
  await expect(app.editor()).toHaveText('uno ***due*** tre');
  await expect(app.editor()).toBeFocused();
});

test('shortcuts: strikethrough, code, link', async ({ app, page }) => {
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+Shift+x');
  await expect(app.editor()).toHaveText('uno ~~due~~ tre');
  await page.keyboard.press('ControlOrMeta+Shift+x');
  await expect(app.editor()).toHaveText('uno due tre');
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+e');
  await expect(app.editor()).toHaveText('uno `due` tre');
  await page.keyboard.press('ControlOrMeta+e');
  await app.selectRange(4, 7);
  await page.keyboard.press('ControlOrMeta+Shift+k');
  await expect(app.editor()).toContainText('[due](');
});

test('controls use the drawn tooltip, not the native title', async ({ app, page }) => {
  await app.selectRange(4, 7);
  const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
  await bold.hover();
  await expect
    .poll(() =>
      bold.evaluate((b) => {
        const after = getComputedStyle(b, '::after');
        return { title: (b as HTMLElement).title, content: after.content, visibility: after.visibility };
      }),
    )
    .toEqual({ title: '', content: JSON.stringify(app.t('format.bold')), visibility: 'visible' });

  // Anche al focus da tastiera, sui pulsanti della barra degli strumenti.
  const settings = page.getByRole('button', { name: app.t('toolbar.settings') });
  await settings.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect
    .poll(() => settings.evaluate((b) => getComputedStyle(b, '::after').visibility))
    .toBe('visible');
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- formatting.spec.ts`
Expected: `6 passed`. Il risultato esatto del link viene da `src/editor/formatting.ts`: la spec controlla solo il prefisso `[due](`. Il tooltip al focus compare solo con `:focus-visible`: per questo il focus ci arriva con Tab e non con `focus()`.

- [ ] **Step 3: Prova di sensibilità**

Nel test di Ctrl+B attendere `'uno *due* tre'`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/formatting.spec.ts
git commit -m "test: e2e della barra di formattazione, scorciatoie, tooltip e titolo della scheda"
```

---

### Task 11: Cronologia

**Files:**
- Create: `e2e/history.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

La cronologia salva uno snapshot `save` solo se l'ultimo ha almeno 5 minuti (`SAVE_THROTTLE_MS` in `src/history/policy.ts`); i `before-*` sempre. La spec fa avanzare l'orologio di 6 minuti tra due salvataggi.

- [ ] **Step 1: Scrivere la spec**

`e2e/history.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

/** Due versioni salvate di note.md: "v1" e, 6 minuti dopo, "v2" (quella aperta). */
async function twoVersions(app: App): Promise<void> {
  const { page } = app;
  await page.clock.install();
  await app.openFolder({ 'note.md': 'v0' });
  await app.openFile('note.md');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v1');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('v1');
  await page.clock.fastForward('06:00');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('v2');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('note.md')).toBe('v2');
}

const panel = (app: App) => app.page.getByRole('region', { name: app.t('toolbar.history') });

test('the toolbar button opens the history next to the editor', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await expect(panel(app).getByRole('heading', { name: app.t('history.title', { path: 'note.md' }) })).toBeVisible();
  await expect(panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) })).toHaveCount(2);
  await expect(panel(app).getByText(app.t('history.pick'))).toBeVisible();
});

test('picking a version shows the diff; restore is undoable with Ctrl+Z', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  const versions = panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) });
  // La più recente è in cima: la seconda è "v1".
  await versions.nth(1).click();
  await expect(versions.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(app).getByText(app.t('history.legend'))).toBeVisible();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.editor()).toHaveText('v1');
  // Il testo sostituito diventa a sua volta una versione ("prima di un ripristino").
  await expect(panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.before-restore')) })).toBeVisible();

  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('v2');
});

test('restoring from preview-only mode switches to split and stays undoable', async ({ app, page }) => {
  await twoVersions(app);
  await app.mode('mode.preview').click();
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await panel(app).getByRole('button', { name: new RegExp(app.t('history.reason.save')) }).nth(1).click();
  await panel(app).getByRole('button', { name: app.t('history.restore') }).click();
  await expect(app.mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.editor()).toHaveText('v1');
  await app.editor().click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(app.editor()).toHaveText('v2');
});

test('closing the panel brings the preview back', async ({ app, page }) => {
  await twoVersions(app);
  await page.getByRole('button', { name: app.t('toolbar.history') }).click();
  await panel(app).getByRole('button', { name: app.t('history.close') }).click();
  await expect(panel(app)).toHaveCount(0);
  await expect(app.previewPane()).toBeVisible();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- history.spec.ts --repeat-each=2`
Expected: `8 passed`. I nomi dei pulsanti delle versioni contengono il tempo relativo e il motivo: la spec cerca solo il motivo con una regex. Se `fastForward` non basta a superare la soglia (la cronologia legge `Date.now()`), usare `page.clock.setSystemTime(Date.now() + 6 * 60_000)` e annotarlo.

- [ ] **Step 3: Prova di sensibilità**

Nel primo test attendere `toHaveCount(3)`: deve fallire con `2`. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/history.spec.ts
git commit -m "test: e2e della cronologia (diff, ripristino annullabile, da sola anteprima)"
```

---

### Task 12: Impostazioni

Copre la parte "impostazioni" e "larghezza del testo" di `tests/browser/run-ai-smoke.mjs`.

**Files:**
- Create: `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

- [ ] **Step 1: Scrivere la spec**

`e2e/settings.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

async function openSettings(app: App): Promise<void> {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(settings(app)).toBeVisible();
}

/** Crea un profilo senza salvarlo: la sezione resta con modifiche aperte. */
async function dirtyProfile(app: App): Promise<void> {
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await expect(app.page).toHaveURL(/#settings\/ai-profiles$/);
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).click();
  await settings(app).getByLabel(app.t('ai.name'), { exact: true }).fill('Bozza');
}

test.beforeEach(async ({ app }) => {
  await app.openFolder({ 'a.md': '# A' });
  await app.openFile('a.md');
});

test('opening moves the focus to the title; closing brings it back', async ({ app, page }) => {
  // Il clic lascia il focus sul pulsante: è lì che deve tornare alla chiusura.
  await openSettings(app);
  await expect(settings(app).getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle(`HMD - ${app.t('settings.title')}`);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await expect(settings(app)).toHaveCount(0);
  await expect(page.getByRole('button', { name: app.t('toolbar.settings') })).toBeFocused();
  await expect(page).toHaveTitle('HMD - a.md');
});

test('sections are addressed by the hash', async ({ app, page }) => {
  // Ricaricando con l'hash la cartella torna da sola (permesso già concesso) e si apre la sezione.
  await page.goto('/#settings/ai-presets');
  await expect(settings(app)).toBeVisible();
  await expect(settings(app).getByRole('link', { name: app.t('settings.aiPresets') })).toHaveAttribute('aria-current', 'true');
});

test('Back with unsaved changes asks first; Cancel keeps everything', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  await page.goBack();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#settings/);
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(settings(app)).toBeVisible();
  await expect(page).toHaveURL(/#settings/);
});

test('Close with unsaved changes asks first; Discard closes', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await dialog.getByRole('button', { name: app.t('ai.discardChanges') }).click();
  await expect(settings(app)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('text width: editor limited in characters, preview without limit, both remembered', async ({ app, page }) => {
  await openSettings(app);
  const editorWidth = settings(app).getByLabel(app.t('settings.textWidth.editor'));
  const previewWidth = settings(app).getByLabel(app.t('settings.textWidth.preview'));
  await expect(previewWidth).toHaveValue('72');
  await editorWidth.fill('40');
  await editorWidth.blur();
  await previewWidth.fill('');
  await previewWidth.blur();
  const root = page.locator('html');
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--editor-text-width'))).toBe('40ch');
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--preview-text-width'))).toBe('100%');

  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();

  // Senza limite l'anteprima occupa tutto il pannello (era un controllo di run-ai-smoke.mjs).
  await app.mode('mode.preview').click();
  const heading = app.previewPane().getByRole('heading', { name: 'A' });
  await expect
    .poll(async () => {
      const pane = await app.previewPane().evaluate((el) => el.clientWidth);
      const box = await heading.boundingBox();
      // Tolleranza per il padding del contenitore (64px in Preview.module.css).
      return box !== null && pane - box.width <= 80;
    })
    .toBe(true);

  await page.reload();
  await expect.poll(() => root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--editor-text-width'))).toBe('40ch');
});

test('with the default limit the preview is narrower than the pane', async ({ app }) => {
  // Contro-prova del test precedente: con 72 caratteri il titolo non arriva ai bordi.
  await app.mode('mode.preview').click();
  const heading = app.previewPane().getByRole('heading', { name: 'A' });
  const pane = await app.previewPane().evaluate((el) => el.clientWidth);
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(pane - box!.width).toBeGreaterThan(80);
});

test('Ctrl+S works with the settings open (no "Save page" dialog)', async ({ app, page }) => {
  await app.typeAtEnd('\nmore');
  await openSettings(app);
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => app.disk('a.md')).toBe('# A\nmore');
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- settings.spec.ts`
Expected: `7 passed`. Nel secondo test, se ricaricando con l'hash l'app mostra la schermata iniziale o perde l'hash, la spec naviga invece con `page.evaluate(() => { location.hash = '#settings/ai-presets'; })` senza ricaricare, e il comportamento al ricaricamento va annotato sotto "Da discutere". Il pulsante "Crea" della lista ha come testo `+ Create` (`ItemList.tsx`): se il nome accessibile è diverso, usare quello reale. Il primo test controlla che il focus torni all'elemento che lo aveva prima: se l'app lo riporta altrove, fissare il comportamento attuale.

- [ ] **Step 3: Prova di sensibilità**

Nel test della larghezza attendere `'41ch'`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test: e2e delle impostazioni (hash, focus, conferme, larghezza del testo, Ctrl+S)"
```

---

### Task 13: Modalità AI e revisione (porting di `run-ai-smoke.mjs`)

**Files:**
- Create: `e2e/ai-review.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App`, fixture `ai: FakeModel` (Task 1).

Corrispondenze con il collaudo CDP: `smoke.ws.getState().doc.text` diventa "salva con Ctrl+S e leggi il disco" (`docText`); le selezioni impostate con `EditorView.dispatch` diventano `app.selectRange`; i `mousedown` sintetici sui pulsanti di `@codemirror/merge` diventano clic veri; il conteggio delle voci `before-ai` in IndexedDB diventa la voce nel pannello della cronologia.

- [ ] **Step 1: Scrivere la spec**

`e2e/ai-review.spec.ts`:

```ts
import type { Locator } from '@playwright/test';

import { expect, test, type App } from './support/app.ts';

const composer = (app: App) => app.page.getByRole('textbox', { name: app.t('ai.request') });
const acceptAll = (app: App) => app.page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true });
const discard = (app: App) => app.page.getByRole('button', { name: app.t('ai.discard'), exact: true });
const mergeView = (app: App) => app.page.locator('.cm-mergeView');
const blockButtons = (app: App, action: 'accept' | 'reject'): Locator =>
  app.page.locator(`.cm-merge-revert button[data-action=${action}]`);
/** Testo della proposta: l'ultimo editor della MergeView. */
const proposal = (app: App) => mergeView(app).locator('.cm-content').last();

/** Testo del documento: salvato con Ctrl+S e letto dal disco (niente accesso allo stato interno). */
async function docText(app: App, path = 'a.md'): Promise<string | null> {
  await app.page.keyboard.press('ControlOrMeta+s');
  await app.page.waitForTimeout(100);
  return app.disk(path);
}

async function enterAi(app: App): Promise<void> {
  await expect(app.mode('mode.ai')).toBeVisible(); // il controller AI è pronto
  await app.mode('mode.ai').click();
  await expect(composer(app)).toBeVisible();
}

/** Invia una richiesta con Invio e aspetta la proposta. */
async function request(app: App): Promise<void> {
  await composer(app).fill('fix');
  await composer(app).press('Enter');
  await expect(acceptAll(app)).toBeEnabled();
}

test.describe('whole document', () => {
  test.beforeEach(async ({ app }) => {
    await app.openFolder({ 'a.md': '# Original\n\nParagraph.' });
    await app.openFile('a.md');
    await enterAi(app);
  });

  test('Accept all applies the proposal; with no differences the review bar goes away', async ({ app }) => {
    await request(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(acceptAll(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('# Changed\n\nNew paragraph.');
  });

  test('undo works across views and a "before AI" version is in the history', async ({ app, page }) => {
    await request(app);
    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await app.mode('mode.editor').click();
    await app.editor().click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(app.editor()).toHaveText('# Original\n\nParagraph.');
    await page.getByRole('button', { name: app.t('toolbar.history') }).click();
    await expect(
      page.getByRole('region', { name: app.t('toolbar.history') }).getByRole('button', { name: new RegExp(app.t('history.reason.before-ai')) }),
    ).toHaveCount(1);
  });

  test('hostile model output loads nothing remote', async ({ app, ai, page }) => {
    const remote: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes(':59999')) remote.push(r.url());
    });
    ai.reply =
      '---\nimage: http://127.0.0.1:59999/frontmatter\n---\n![x](http://127.0.0.1:59999/image)\n\n' +
      '<img src="http://127.0.0.1:59999/raw" srcset="http://127.0.0.1:59999/srcset 2x"><iframe src="http://127.0.0.1:59999/frame"></iframe>';
    ai.comment =
      'Nota ![x](http://127.0.0.1:59999/image) <img src="http://127.0.0.1:59999/raw"><iframe src="http://127.0.0.1:59999/frame"></iframe>';
    await request(app);
    await page.waitForTimeout(500);
    expect(remote).toEqual([]);
    const log = page.getByRole('log');
    await expect(log.locator('img, iframe')).toHaveCount(0);
    // L'immagine è resa come etichetta con l'host, da caricare solo con un clic esplicito.
    await expect(log.getByText('127.0.0.1:59999').first()).toBeVisible();
  });
});

test.describe('blocks', () => {
  test.beforeEach(async ({ app, ai }) => {
    ai.reply = 'A2\n\nB\n\nC2';
    await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
    await app.openFile('a.md');
    await enterAi(app);
    await request(app);
    await expect(blockButtons(app, 'reject')).toHaveCount(2);
  });

  test('both sides of the diff use the same font and line height', async ({ app }) => {
    const styles = await mergeView(app).locator('.cm-scroller').evaluateAll((els) =>
      els.map((el) => `${getComputedStyle(el).fontFamily}|${getComputedStyle(el).lineHeight}`),
    );
    expect(new Set(styles).size).toBe(1);
  });

  test('rejecting a block leaves the document alone and puts the original back in the proposal', async ({ app }) => {
    await blockButtons(app, 'reject').first().click();
    await expect(proposal(app)).toHaveText('A\n\nB\n\nC2');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
    // Rifiutato anche l'ultimo blocco: proposta scartata e barra chiusa.
    await blockButtons(app, 'reject').first().click();
    await expect(mergeView(app)).toHaveCount(0);
    await expect(discard(app)).toHaveCount(0);
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
  });

  test('Ctrl+Z undoes a block accept, a block reject and Accept all', async ({ app, page }) => {
    await blockButtons(app, 'accept').first().click();
    await expect.poll(() => docText(app)).toBe('A2\n\nB\n\nC');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');

    await expect(blockButtons(app, 'reject')).toHaveCount(2);
    await blockButtons(app, 'reject').first().click();
    await expect(proposal(app)).toHaveText('A\n\nB\n\nC2');
    await page.keyboard.press('ControlOrMeta+z');
    // Annulla il rifiuto senza toccare il testo arrivato dal modello.
    await expect(proposal(app)).toHaveText('A2\n\nB\n\nC2');

    await acceptAll(app).click();
    await expect(mergeView(app)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => docText(app)).toBe('A\n\nB\n\nC');
    await expect(mergeView(app)).toBeVisible();
  });
});

test.describe('selection', () => {
  const ORIGINAL = 'prefisso BAD\none\ntwo\nthree\nfour\nfive\nBAD suffisso';
  const FROM = 9;
  const TO = ORIGINAL.length - 9;
  const REPLY = ORIGINAL.slice(FROM, TO).replaceAll('BAD', 'GOOD');
  const TARGET = `prefisso ${REPLY} suffisso`;

  test.beforeEach(async ({ app, ai }) => {
    ai.reply = REPLY;
    await app.openFolder({ 'a.md': ORIGINAL, 'b.md': 'uno\ndue\ntre\nquattro' });
  });

  test('the chip reflects a selection made in Editor mode', async ({ app }) => {
    await app.openFile('b.md');
    await app.mode('mode.editor').click();
    await app.selectRange(0, 11); // "uno\ndue\ntre"
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toBeVisible();
    await app.mode('mode.editor').click();
    await app.selectRange(4, 11); // "due\ntre"
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 2 }), { exact: true })).toBeVisible();
  });

  test('Accept all on an intra-line selection keeps the text outside it', async ({ app }) => {
    await app.openFile('a.md');
    await app.mode('mode.editor').click();
    await app.selectRange(FROM, TO);
    await enterAi(app);
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 7 }), { exact: true })).toBeVisible();
    await request(app);
    await acceptAll(app).click();
    await expect.poll(() => docText(app)).toBe(TARGET);
  });

  test('accepting the blocks one by one keeps the selection boundaries', async ({ app }) => {
    await app.openFile('a.md');
    await app.mode('mode.editor').click();
    await app.selectRange(FROM, TO);
    await enterAi(app);
    await request(app);
    await expect(blockButtons(app, 'accept')).toHaveCount(2);
    await blockButtons(app, 'accept').first().click();
    await blockButtons(app, 'accept').first().click();
    await expect.poll(() => docText(app)).toBe(TARGET);
  });

  test('"Use the whole document" drops the selection chip', async ({ app }) => {
    await app.openFile('b.md');
    await app.mode('mode.editor').click();
    await app.selectRange(0, 11);
    await enterAi(app);
    await app.page.getByRole('button', { name: app.t('ai.selectionIgnore') }).click();
    await expect(app.page.getByText(app.t('ai.selectionLines', { count: 3 }), { exact: true })).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- ai-review.spec.ts --repeat-each=2`
Expected: `20 passed`. Punti da controllare nel trace se fallisce:
- il pulsante "AI" compare solo quando `AiController` è pronto (IndexedDB): `enterAi` lo aspetta;
- `docText` salva con Ctrl+S: se il focus è dentro un pulsante del merge, Ctrl+S arriva comunque a `window`; se la spec vede il testo vecchio, alzare l'attesa dopo Ctrl+S, mai togliere il salvataggio;
- dopo un'accettazione completa la vista AI mostra l'editor con il documento intero (non la MergeView): `proposal()` vale solo con la MergeView aperta;
- `ai.selectionLines` per la selezione intra-riga conta le righe toccate (7): se l'app conta diversamente, usare il numero reale.

- [ ] **Step 3: Prova di sensibilità**

Nel test "hostile model output" aggiungere temporaneamente `remote.push('x')` prima dell'`expect`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/ai-review.spec.ts
git commit -m "test: e2e della modalità AI e della revisione (porting del collaudo CDP)"
```

---

### Task 14: Snapshot visivi di riferimento

**Files:**
- Create: `e2e/visual.spec.ts`, `e2e/__screenshots__/visual.spec.ts/*.png`

**Interfaces:**
- Consumes: `test`, `expect`, `App`, `ai` (Task 1).
- Produces: gli snapshot PNG che tutti i piani successivi devono rispettare.

- [ ] **Step 1: Scrivere la spec**

`e2e/visual.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

const NOTE = [
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
const NOW = new Date('2026-10-01T10:00:00+02:00');

async function shot(app: App, name: string): Promise<void> {
  await app.page.evaluate(() => document.fonts.ready);
  await expect(app.page).toHaveScreenshot(name);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('start screen', async ({ app }) => {
      await app.start();
      await shot(app, `start-${scheme}.png`);
    });

    test('workspace in split mode', async ({ app }) => {
      await app.openFolder({ 'note.md': NOTE, 'docs/guide.md': '# Guide' });
      await app.openFile('note.md');
      await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
      await shot(app, `workspace-${scheme}.png`);
    });

    test('settings', async ({ app, page }) => {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      await expect(page.getByRole('region', { name: app.t('settings.title') })).toBeVisible();
      await shot(app, `settings-${scheme}.png`);
    });

    test('AI review', async ({ app, ai, page }) => {
      ai.reply = 'A2\n\nB\n\nC2';
      await app.openFolder({ 'a.md': 'A\n\nB\n\nC' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      const composer = page.getByRole('textbox', { name: app.t('ai.request') });
      await composer.fill('fix');
      await composer.press('Enter');
      await expect(page.getByRole('button', { name: app.t('ai.acceptAll'), exact: true })).toBeEnabled();
      await shot(app, `ai-review-${scheme}.png`);
    });
  });
}

test('name dialog', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('button', { name: app.t('file.new') }).first().click();
  await page.getByRole('dialog', { name: app.t('file.new') }).getByRole('textbox').fill('draft');
  await shot(app, 'name-dialog.png');
});

test('tree actions menu', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
  await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
  await expect(page.getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeVisible();
  await shot(app, 'tree-menu.png');
});

test('toast', async ({ app }) => {
  await app.openFolder({ 'note.md': '# Note', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(app.toast(prefix)).toBeVisible();
  await app.page.evaluate(() => document.fonts.ready);
  // I toast informativi spariscono dopo 6 s: lo snapshot va preso subito.
  await expect(app.page).toHaveScreenshot('toast.png', { timeout: 3000 });
});

test('conflict bar', async ({ app, page }) => {
  await page.clock.install();
  await app.openFolder({ 'note.md': '# Note\n' });
  await app.openFile('note.md');
  await page.clock.pauseAt(new Date(Date.now() + 10_000));
  await app.typeAtEnd('mine');
  await page.clock.runFor(100);
  await app.writeExternal('note.md', 'theirs, longer text');
  await app.windowFocus();
  await expect(page.getByRole('alert').filter({ hasText: app.t('conflict.message') })).toBeVisible();
  await shot(app, 'conflict.png');
});

test('formatting toolbar with tooltip', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'uno due tre' });
  await app.openFile('a.md');
  await app.selectRange(4, 7);
  const bold = page.getByRole('toolbar', { name: app.t('format.toolbar') }).getByRole('button', { name: app.t('format.bold') });
  await bold.hover();
  await expect.poll(() => bold.evaluate((b) => getComputedStyle(b, '::after').visibility)).toBe('visible');
  await shot(app, 'format-toolbar.png');
});

test('history panel', async ({ app, page }) => {
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
  await shot(app, 'history.png');
});
```

- [ ] **Step 2: Creare gli snapshot (unica volta autorizzata)**

Run: `npm run test:e2e -- visual.spec.ts --update-snapshots`
Expected: 13 PNG creati in `e2e/__screenshots__/visual.spec.ts/` con suffisso `-linux` (4 schermate × 2 temi + 5).

- [ ] **Step 3: Aprire e controllare ogni PNG**

Aprire ciascuna immagine (Read tool sul PNG) e verificare a occhio: font Space Grotesk/Mono/Pixelify caricati (non font di sistema), tema giusto, nessun elemento a metà transizione, cursore assente, nessun tempo che cambia (cronologia, "Generating… N s"). Se un'immagine è sbagliata, correggere la spec e ricreare solo quella.

- [ ] **Step 4: Verificare la stabilità**

Run: `npm run test:e2e -- visual.spec.ts --repeat-each=3`
Expected: `39 passed`. Se uno snapshot varia, individuare la causa (font non pronti, animazione, contenuto variabile) e correggere la spec; **non** alzare `maxDiffPixelRatio`.

- [ ] **Step 5: Commit**

```bash
git add e2e/visual.spec.ts e2e/__screenshots__/
git commit -m "test: snapshot visivi di riferimento per la migrazione"
```

---

### Task 15: `uiText.test.ts` e `tooltips.test.ts` non passano più a vuoto

**Files:**
- Modify: `src/i18n/uiText.test.ts` (riscrittura completa, stessa lista `LEGACY`)
- Modify: `src/ui/tooltips.test.ts` (due test in più)

**Interfaces:**
- Produces: la regola "file di UI" = `*.tsx` (non di test) + `src/elements/**/*.ts` + `src/dom/**/*.ts` (non di test) + `editor/formatToolbar.ts`, usata dai piani successivi.

- [ ] **Step 1: Riscrivere `uiText.test.ts`**

Sostituire l'intero contenuto di `src/i18n/uiText.test.ts` con:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

interface SourceFile {
  /** Percorso relativo a src/, con separatore '/'. */
  path: string;
  source: string;
}

/** DOM costruito a mano fuori da elements/ e dom/ (CodeMirror): conta come interfaccia. */
const UI_TS = new Set(['editor/formatToolbar.ts']);

/** File di interfaccia: i .tsx di oggi e, con i Web Components, i .ts sotto elements/ e dom/. */
function isUiFile(path: string): boolean {
  if (/\.test\.tsx?$/.test(path)) return false;
  if (path.endsWith('.tsx') || UI_TS.has(path)) return true;
  return /^(?:elements|dom)\/.+\.ts$/.test(path);
}

const files: SourceFile[] = walk(SRC)
  .map((full) => ({ full, path: relative(SRC, full).split(sep).join('/') }))
  .filter(({ path }) => isUiFile(path))
  .map(({ full, path }) => ({ path, source: readFileSync(full, 'utf8') }));

/** Testi scritti a mano nei componenti di v1: nessuno deve sopravvivere al passaggio a t(). */
const LEGACY = [
  'Salvato', 'Modifiche…', 'Salvataggio…', 'Errore di salvataggio', 'Eliminato su disco', 'Nessun file aperto',
  'Modalità di visualizzazione', 'Anteprima', 'Split', 'Nuovo file', 'Nuova cartella', "Apri un'altra cartella",
  'Apri cartella', 'Bozze senza file', 'Recupera la bozza', 'Larghezza della barra laterale', 'Nascondi barra laterale',
  'Mostra barra laterale', 'Scegli un file', 'Rinomina', 'Elimina', 'Crea', 'Annulla', 'Chiudi', 'Esiste già',
  'La cartella e tutto', 'Il file verrà eliminato', 'Accesso alla cartella perso', 'Il browser non permette',
  'Accesso non concesso', 'Riprendi accesso', 'Il file è cambiato su disco', 'Ricarica dal disco', 'Sovrascrivi',
  'Azioni per', 'Cartella vuota', 'Nessun file markdown', 'File della cartella', 'Cerca', 'Risultati della ricerca',
  'Nessun risultato', 'Scrivi markdown nel browser', 'Impossibile aprire la cartella', 'Frontmatter non valido',
  'Immagine non trovata',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Testi di LEGACY presenti come stringa ('…', "…", `…`), come figlio JSX (>…) o da soli su una riga. */
function legacyTextsIn(source: string): string[] {
  return LEGACY.filter((text) =>
    new RegExp(`(['"\`>]\\s*${escape(text)})|(^\\s*${escape(text)}\\s*$)`, 'm').test(source),
  );
}

const LABEL = '(?:aria-label|title|placeholder|alt|data-tooltip)';
const QUOTED = '(?<q>[\'"`])(?<v>(?:(?!\\k<q>).)*)\\k<q>';

/** Tutte le forme con cui un'etichetta accessibile o un testo può finire nel DOM con un valore letterale. */
const LITERAL_PATTERNS: RegExp[] = [
  // JSX: title="…", data-tooltip="…"
  new RegExp(`\\b${LABEL}="(?<v>[^"]*)"`, 'g'),
  // el.setAttribute('aria-label', '…')
  new RegExp(`setAttribute\\(\\s*['"]${LABEL}['"]\\s*,\\s*${QUOTED}`, 'g'),
  // el('button', { 'aria-label': '…', 'data-tooltip': '…', title: '…' })
  new RegExp(`(?:['"]${LABEL}['"]|\\b(?:title|placeholder|alt))\\s*:\\s*${QUOTED}`, 'g'),
  // node.title = '…', node.textContent = '…', node.dataset.tooltip = '…'
  new RegExp(`\\.(?:title|placeholder|alt|ariaLabel|textContent|dataset\\.tooltip)\\s*=\\s*${QUOTED}`, 'g'),
];

/** Valori letterali con almeno una lettera (le interpolazioni `${…}` non contano). */
function literalLabelsIn(source: string): string[] {
  const found: string[] = [];
  for (const pattern of LITERAL_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const value = (match.groups?.v ?? '').replace(/\$\{[^}]*\}/g, '');
      if (/\p{L}/u.test(value)) found.push(match[0]);
    }
  }
  return found;
}

/** Ogni occorrenza come "<percorso>: <testo trovato>", così un errore dice subito dove guardare. */
function findLegacyTexts(list: SourceFile[]): string[] {
  return list.flatMap(({ path, source }) => legacyTextsIn(source).map((text) => `${path}: ${text}`));
}

function findLiteralLabels(list: SourceFile[]): string[] {
  return list.flatMap(({ path, source }) => literalLabelsIn(source).map((hit) => `${path}: ${hit}`));
}

test('the UI file list is not empty (the checks below would pass vacuously)', () => {
  assert.ok(files.length > 0, 'nessun file di interfaccia trovato sotto src/');
});

test('no UI file contains the hand-written UI texts of v1', () => {
  assert.deepEqual(findLegacyTexts(files), []);
});

test('no UI file has a literal label or text with words in it', () => {
  assert.deepEqual(findLiteralLabels(files), []);
});

test("the file filter covers today's .tsx and tomorrow's custom elements", () => {
  assert.equal(isUiFile('ui/FileTree.tsx'), true);
  assert.equal(isUiFile('editor/formatToolbar.ts'), true);
  assert.equal(isUiFile('elements/file-tree/file-tree.element.ts'), true);
  assert.equal(isUiFile('dom/icon.ts'), true);
  assert.equal(isUiFile('elements/app/screens.test.ts'), false);
  assert.equal(isUiFile('ui/tree.ts'), false);
});

test('an offending file is reported by path (sensitivity check on synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Probe.tsx', source: "const probe = { title: 'Prova' };" },
    { path: 'elements/probe/probe.element.ts', source: "el('button', {}, 'Annulla')" },
    { path: 'ui/Clean.tsx', source: "<button aria-label={t('toast.close')} data-tooltip={t('toast.close')} />" },
  ];
  assert.deepEqual(findLiteralLabels(probes), ["ui/Probe.tsx: title: 'Prova'"]);
  assert.deepEqual(findLegacyTexts(probes), ['elements/probe/probe.element.ts: Annulla']);
});

test('the checks fire on every supported form (guard against silent regex rot)', () => {
  assert.deepEqual(legacyTextsIn("el('button', {}, 'Annulla')"), ['Annulla']);
  const positives = [
    '<button title="Chiudi">',
    '<button data-tooltip="Chiudi">',
    "el.setAttribute('aria-label', 'Chiudi')",
    'el.setAttribute("data-tooltip", `Nuovo file`)',
    "el('button', { 'aria-label': 'Chiudi' })",
    "el('button', { 'data-tooltip': 'Chiudi' })",
    "el('input', { placeholder: 'Cerca' })",
    "input.placeholder = 'Cerca'",
    "p.textContent = 'Nessun risultato'",
    "button.dataset.tooltip = 'Grassetto'",
    "img.alt = 'Logo'",
  ];
  for (const source of positives) assert.equal(literalLabelsIn(source).length, 1, source);
});

test('the checks ignore translated and non-textual values', () => {
  const negatives = [
    "<button title={t('toast.close')}>",
    "el.setAttribute('aria-label', t('toast.close'))",
    "button.dataset.tooltip = label",
    "p.textContent = ''",
    'node.title = `${path}`',
    'interface Props { title: string }',
    "el('div', { 'aria-label': '' })",
    "setAttribute('aria-valuenow', '280')",
  ];
  for (const source of negatives) assert.deepEqual(literalLabelsIn(source), [], source);
});
```

- [ ] **Step 2: Eseguire `uiText.test.ts`**

Run: `npx tsx --test src/i18n/uiText.test.ts`
Expected: 7 test, tutti `pass`. Se il terzo test trova occorrenze nei file di oggi, **non** modificarli: significa che una delle nuove forme dà un falso positivo; restringere la regex e aggiungere quel caso ai `negatives`.

- [ ] **Step 3: Estendere `tooltips.test.ts`**

`src/ui/tooltips.test.ts` oggi ha un solo test e cerca `title=` in JSX e `.title =`. In fondo al file aggiungere:

```ts
/** Forme dei Web Components: title come prop di el() o come attributo. Restano vietate sui controlli. */
const EL_TITLE = /\bel\(\s*['"][a-z][\w-]*['"]\s*,\s*\{[^}]*\btitle\s*:/g;
const SET_TITLE = /\bsetAttribute\(\s*['"]title['"]/g;

test('custom elements do not set the native title either', () => {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of [EL_TITLE, SET_TITLE]) for (const match of source.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(found, []);
});

test('the title patterns fire on synthetic sources and ignore look-alikes', () => {
  const hits = (source: string) => [EL_TITLE, SET_TITLE].flatMap((p) => [...source.matchAll(p)]).length;
  assert.equal(hits("el('button', { class: 'x', title: label })"), 1);
  assert.equal(hits("button.setAttribute('title', label)"), 1);
  assert.equal(hits("el('button', { 'data-tooltip': label, 'aria-label': label })"), 0);
  assert.equal(hits('const card = { title: frontmatter.title }'), 0);
  assert.equal(hits("dialog.setAttribute('aria-labelledby', id)"), 0);
});
```

- [ ] **Step 4: Eseguire `tooltips.test.ts`**

Run: `npx tsx --test src/ui/tooltips.test.ts`
Expected: 3 test `pass`.

- [ ] **Step 5: Suite completa e commit**

Run: `npm test 2>&1 | tail -8 && git status --short src/`
Expected: baseline + 7 (5 in `uiText`, 2 in `tooltips`), tutti verdi; in `src/` risultano modificati solo i due file di test.

```bash
git add src/i18n/uiText.test.ts src/ui/tooltips.test.ts
git commit -m "test: uiText e tooltips controllano anche i futuri custom element e non passano a vuoto"
```

---

### Task 16: Test di architettura

**Files:**
- Create: `src/architecture.test.ts`

**Interfaces:**
- Produces: `architecture.test.ts`, che i piani successivi estendono (CSS con `@scope`, niente React, `customElements.define` solo in `elements/define.ts`).

- [ ] **Step 1: Scrivere il test**

`src/architecture.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Regole di CLAUDE.md verificate sul sorgente: ciò che la review a occhio può lasciarsi sfuggire. */

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

interface SourceFile {
  /** Percorso relativo a src/, con separatore '/'. */
  path: string;
  source: string;
}

const sources: SourceFile[] = walk(SRC)
  .map((full) => ({ full, path: relative(SRC, full).split(sep).join('/') }))
  .filter(({ path }) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith('.d.ts') && !path.includes('/testing/'))
  .map(({ full, path }) => ({ path, source: readFileSync(full, 'utf8') }));

/** HTML da stringa nel DOM: solo sanitize.ts può farlo, e solo con HTML già sanitizzato. */
const UNSAFE_DOM = /\.(?:innerHTML|outerHTML)\s*=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/;
const UNSAFE_DOM_ALLOWED = new Set(['preview/sanitize.ts']);

/** File System Access API: solo fsaOps.ts e access.ts. */
const FSA = /\b(?:showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|queryPermission|requestPermission|createWritable|getDirectoryHandle|getFileHandle)\b/;
const FSA_ALLOWED = new Set(['fs/fsaOps.ts', 'fs/access.ts']);

/** Rete: solo i provider AI parlano con l'esterno (regola AI di CLAUDE.md). */
const NETWORK = /\bfetch\b|\bXMLHttpRequest\b|\bEventSource\b|\bWebSocket\b|\bsendBeacon\b|['"]@anthropic-ai\/sdk['"]/;
const NETWORK_ALLOWED = (path: string) => path.startsWith('ai/providers/');

/** Percorsi dei file che usano `pattern` senza esserne autorizzati. */
function offenders(pattern: RegExp, allowed: (path: string) => boolean, list: SourceFile[] = sources): string[] {
  return list.filter(({ path, source }) => !allowed(path) && pattern.test(source)).map(({ path }) => path);
}

const inSet = (set: ReadonlySet<string>) => (path: string) => set.has(path);

test('the source list is not empty', () => {
  assert.ok(sources.length > 50, `solo ${sources.length} file sorgente trovati`);
});

test('HTML strings reach the DOM only through preview/sanitize.ts', () => {
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED)), []);
});

test('only fs/fsaOps.ts and fs/access.ts touch the File System Access API', () => {
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED)), []);
});

test('only src/ai/providers/ makes network requests', () => {
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED), []);
});

test('the patterns fire on what they must and ignore what they must', () => {
  for (const bad of ['el.innerHTML = html', 'el.outerHTML = x', "el.insertAdjacentHTML('beforeend', x)", 'document.write(x)']) {
    assert.ok(UNSAFE_DOM.test(bad), bad);
  }
  for (const ok of ['if (el.innerHTML === "")', 'const s = el.outerHTML', "el.textContent = 'x'"]) {
    assert.ok(!UNSAFE_DOM.test(ok), ok);
  }
  for (const bad of ['await handle.createWritable()', 'window.showDirectoryPicker()', 'h.requestPermission(m)']) {
    assert.ok(FSA.test(bad), bad);
  }
  for (const ok of ['handle: FileSystemDirectoryHandle', 'ops.removeEntry(path, true)', 'handle.isSameEntry(other)']) {
    assert.ok(!FSA.test(ok), ok);
  }
  for (const bad of ["await fetch('/x')", 'const f = deps.fetch ?? fetch', 'new WebSocket(url)', "import('@anthropic-ai/sdk')"]) {
    assert.ok(NETWORK.test(bad), bad);
  }
  for (const ok of ['prefetch()', 'fetchedAt: number', "import type { X } from './sdk'"]) {
    assert.ok(!NETWORK.test(ok), ok);
  }
});

test('offending files are reported by path and allowed files are not (synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Icon.tsx', source: '// probe: document.write(x)' },
    { path: 'preview/sanitize.ts', source: 'el.innerHTML = sanitizeWith(purify, html);' },
    { path: 'workspace/probe.ts', source: 'await handle.createWritable();' },
    { path: 'fs/fsaOps.ts', source: 'await handle.createWritable();' },
    { path: 'ai/aiController.ts', source: "await fetch('https://example.com')" },
    { path: 'ai/providers/anthropic.ts', source: "await fetch('https://api.anthropic.com')" },
  ];
  assert.deepEqual(offenders(UNSAFE_DOM, inSet(UNSAFE_DOM_ALLOWED), probes), ['ui/Icon.tsx']);
  assert.deepEqual(offenders(FSA, inSet(FSA_ALLOWED), probes), ['workspace/probe.ts']);
  assert.deepEqual(offenders(NETWORK, NETWORK_ALLOWED, probes), ['ai/aiController.ts']);
});
```

Note:
- `isSameEntry` (usato da `fs/handleStore.ts`) non è nell'elenco FSA: confronta handle già ottenuti, non accede al file system. Allargare la regola è una decisione da prendere con Davide, non in questo piano.
- `src/fs/testing/` (es. `memoryOps.ts`) è escluso: è codice di prova, non dell'app.
- Al 01/10 `fetch` compare solo in `src/ai/providers/` (verificato con `grep -rn "fetch\b" src`). Se il test trova un'occorrenza legittima altrove (es. un commento), riferire invece di allargare la regola da soli.

- [ ] **Step 2: Eseguire**

Run: `npx tsx --test src/architecture.test.ts`
Expected: 6 test `pass`.

- [ ] **Step 3: Suite completa e commit**

Run: `npm test 2>&1 | tail -8 && git status --short src/`
Expected: baseline + 7 (Task 15) + 6 (questo task) = baseline + 13, tutti verdi; in `src/` solo `src/architecture.test.ts` è nuovo.

```bash
git add src/architecture.test.ts
git commit -m "test: regole di architettura (DOM da stringhe, File System Access, rete) verificate sul sorgente"
```

---

### Task 17: Via `tests/browser/`, documentazione, verifica finale e PR

**Files:**
- Delete: `tests/browser/ai-smoke.html`, `tests/browser/ai-smoke.tsx`, `tests/browser/run-ai-smoke.mjs`
- Modify: `package.json` (script `test:browser`), `README.md` (sezioni "Sviluppo" e "Verifiche AI"), `CLAUDE.md` (sezione "Regole")

- [ ] **Step 1: Controllare la copertura prima di cancellare**

Ogni `assert` di `tests/browser/run-ai-smoke.mjs` deve avere un corrispondente in `e2e/`. Tabella di controllo (spuntare ogni riga guardando la spec indicata):

| Verifica del collaudo CDP | Spec |
|---|---|
| Accept all, barra che sparisce senza differenze | `ai-review.spec.ts` › whole document |
| Undo da AI a Editor, voce `before-ai` | `ai-review.spec.ts` › undo works across views |
| Accettazione per blocco | `ai-review.spec.ts` › Ctrl+Z undoes… |
| Stesso carattere nei due lati del diff | `ai-review.spec.ts` › both sides of the diff |
| Rifiuto per blocco, ultimo blocco scarta la proposta | `ai-review.spec.ts` › rejecting a block |
| Ctrl+Z su accetta blocco, rifiuta blocco, Accept all | `ai-review.spec.ts` › Ctrl+Z undoes… |
| Selezione intra-riga: Accept all e blocchi | `ai-review.spec.ts` › selection |
| Nessuna risorsa remota, immagine come etichetta | `ai-review.spec.ts` › hostile model output |
| Ripristino dalla cronologia annullabile | `history.spec.ts` |
| Chip della selezione dopo selezione in Editor | `ai-review.spec.ts` › the chip reflects… |
| Barra di formattazione, Ctrl+B grassetto e non sidebar, corsivo, focus | `formatting.spec.ts` |
| Titolo della scheda (file e impostazioni) | `formatting.spec.ts`, `settings.spec.ts` |
| Tooltip disegnato sulla barra | `formatting.spec.ts` › controls use the drawn tooltip |
| Impostazioni: focus sul titolo e ritorno, Indietro/Chiudi con conferma | `settings.spec.ts` |
| Larghezza del testo (variabili CSS e anteprima a piena larghezza senza limite) | `settings.spec.ts` › text width, with the default limit |
| Albero con un solo tab stop, frecce, Shift+F10 | `tree.spec.ts` › keyboard |
| Nessuna eccezione runtime | vedi Step 2 |

Due verifiche del collaudo CDP non passano in `e2e/` così come sono e vanno dichiarate nel messaggio di commit: la misura in pixel della larghezza dell'editor a 40 caratteri (coperta dalla variabile CSS e dallo snapshot; l'anteprima a piena larghezza invece è misurata) e il conteggio delle tre fasce del focus ring oreo (coperto dallo snapshot dell'albero da tastiera nella checklist manuale).

- [ ] **Step 2: Nessuna eccezione runtime in nessuna spec**

Il collaudo CDP falliva su qualsiasi eccezione non gestita. In `e2e/support/app.ts`, dentro la fixture `app`, prima di `await use(...)`:

```ts
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
```

e dopo `await use(new App(page, appLocale));`:

```ts
    expect(errors, 'eccezioni non gestite nella pagina').toEqual([]);
```

Run: `npm run test:e2e`
Expected: tutto verde. Se una spec ora fallisce per un'eccezione, è un comportamento dell'app di oggi: la spec lo fissa filtrando **quel messaggio preciso** con un commento `// Comportamento attuale: …`, e il caso va nel commit sotto "Da discutere".

- [ ] **Step 3: Cancellare il collaudo CDP**

```bash
git rm tests/browser/ai-smoke.html tests/browser/ai-smoke.tsx tests/browser/run-ai-smoke.mjs
```

In `package.json` togliere la riga `"test:browser": "node tests/browser/run-ai-smoke.mjs"`.

- [ ] **Step 4: README**

In `README.md`, nel blocco di comandi della sezione "Sviluppo", dopo la riga di `npm test`, aggiungere:

```bash
npm run test:e2e # test end-to-end (Playwright, Chromium); la prima volta: npx playwright install chromium
```

E subito dopo il blocco:

```markdown
I test end-to-end usano una cartella finta nell'Origin Private File System al posto del selettore
di cartelle (`e2e/support/fsHarness.ts`) e un modello finto al posto di Ollama
(`e2e/support/aiHarness.ts`): nessun account né API a pagamento. Gli snapshot in
`e2e/__screenshots__/` sono il riferimento visivo: si rigenerano (`--update-snapshots`) solo per un
cambiamento voluto e approvato.
```

Nella sezione "Verifiche AI", sostituire il paragrafo che inizia con `` `npm test`, `npm run lint`, `npm run build`; `npm run test:browser` richiede Chromium `` con:

```markdown
`npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`. Le spec AI (`e2e/ai-review.spec.ts`)
usano un profilo temporaneo, una cartella finta e risposte simulate: verificano revisione,
accettazione anche ripetuta e per blocchi sulla selezione, undo attraverso le viste, snapshot e
assenza di richieste per immagini ostili prima del consenso. Non usano account o API a pagamento.
Restano da verificare con servizi reali CORS dall'origine pubblicata, autenticazione CLI/API,
permessi FSA su due profili Chrome e PWA offline con il server locale.
```

- [ ] **Step 5: CLAUDE.md**

In fondo alla sezione `## Regole` di `CLAUDE.md` aggiungere:

```markdown
- I test end-to-end (`e2e/*.spec.ts`, `npm run test:e2e`) trovano gli elementi solo per ruolo e nome accessibile, con i testi da `en.json`: mai classi CSS dell'app. Gli snapshot visivi si rigenerano solo con approvazione.
```

- [ ] **Step 6: Verifica completa**

```bash
npm test 2>&1 | tail -8
npm run lint
npm run build
npm run test:e2e -- --repeat-each=2
git status --short
git diff --stat main -- src/   # atteso: solo uiText.test.ts, tooltips.test.ts, architecture.test.ts
grep -rn "test:browser\|tests/browser" README.md CLAUDE.md package.json   # atteso: nessun risultato
```

Expected: `npm test` = baseline + 13, lint e build puliti, e2e tutti verdi due volte di fila, nessun file di `src/` toccato oltre ai tre test.

- [ ] **Step 7: Commit**

```bash
git add -A package.json README.md CLAUDE.md e2e/support/app.ts tests/
git commit -m "test: e2e al posto del collaudo CDP; docs dei test end-to-end"
```

- [ ] **Step 8: Riepilogo per Davide e PR solo con il suo via**

Riferire: numero dei test prima/dopo, numero delle spec e2e, elenco degli snapshot, comportamenti fissati con `// Comportamento attuale:` (sezione "Da discutere" dei commit), le due verifiche del collaudo CDP non portate così com'erano (Step 1), tempo di esecuzione di `npm run test:e2e`.

**Fermarsi e chiedere** prima di pubblicare. Con il via esplicito:

```bash
git push -u origin test/e2e-baseline
gh pr create --base main --title "Test end-to-end con Playwright (fase 0 della migrazione a Web Components)" \
  --body "Fase 0 dello spec docs/superpowers/specs/2026-09-27-housemd-web-components-design.md: suite Playwright sull'app React di oggi, snapshot visivi di riferimento, porting del collaudo CDP, controlli statici rafforzati. Nessuna modifica all'app."
```

Il piano 2 (fasi 1–3 dello spec: logica pura, zod, ts-pattern, store, infrastruttura DOM/CSS, React 19) si scrive dopo il merge di questa PR.
