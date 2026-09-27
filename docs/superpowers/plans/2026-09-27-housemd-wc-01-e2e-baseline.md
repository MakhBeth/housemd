# HouseMD Web Components — Piano 1: baseline end-to-end e rete di sicurezza

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prima di migrare qualcosa, fissare con Playwright il comportamento e l'aspetto dell'app React di oggi e rafforzare i due controlli statici che la migrazione renderebbe ciechi.

**Architecture:** Suite Playwright in `e2e/` contro `vite build` + `vite preview`. Il selettore nativo di cartelle viene sostituito, **solo nei test**, da uno script iniettato che restituisce una cartella dell'Origin Private File System (OPFS): `fsaOps.ts`, `handleStore.ts` e IndexedDB girano sul codice reale. Le spec usano solo ruoli e nomi accessibili presi da `en.json`, quindi valgono identiche per React e per i futuri custom element. In più: `uiText.test.ts` non potrà più passare a vuoto e un nuovo `architecture.test.ts` fa rispettare le regole di `CLAUDE.md`.

**Tech Stack:** `@playwright/test` 1.63.0 (Chromium), TypeScript 7, Vite 8, `tsx --test` (`node:test`).

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§7 fase 0, §8.1, §8.3, §8.4, §9).

## Global Constraints

- **Nessuna modifica a `src/` tranne** `src/i18n/uiText.test.ts` (Task 11) e il nuovo `src/architecture.test.ts` (Task 12), **nemmeno temporanea**: le prove di sensibilità cambiano solo spec e test, mai file di `src/`. Se una spec e2e fallisce, **non si tocca l'app**: la spec descrive l'app di oggi (vedi "Regola delle spec di caratterizzazione").
- Dove un risultato dipende da un timer dell'app (autosalvataggio a 1000 ms), la spec controlla l'orologio con `page.clock` invece di affidarsi a timeout più corti del timer.
- La suite prova sempre una build nuova: `reuseExistingServer: false`.
- Branch: `feat/web-components`, creato dalla punta di `plan/web-components-stack` (contiene v1.1, che non è in `main`). **Nessun merge in `main`**: il merge è uno solo, alla fine di tutta la migrazione, dopo approvazione esplicita di Davide.
- `npm test` resta `tsx --test` e deve raccogliere **esattamente** gli stessi test di prima più quelli nuovi dei Task 11–12; le spec e2e hanno suffisso `.spec.ts` e stanno in `e2e/`, quindi `tsx --test` non le raccoglie.
- Le spec e2e usano solo `getByRole`/`getByText` con nomi da `app.t('<chiave di en.json>')`. Mai classi CSS (spariranno con i CSS Modules). Uniche eccezioni: `.cm-scroller` di CodeMirror e i tag `script`/`mark`/`img`/`h2`.
- Nessun testo UI scritto a mano nelle spec: sempre `app.t(...)`. Nomi di file e contenuti dei file di prova sono dati, non UI, e restano letterali.
- `reducedMotion: 'reduce'`, service worker bloccati, viewport 1280×800, `locale: 'en-US'`, fuso `Europe/Rome`.
- Gli snapshot visivi creati nel Task 10 sono il riferimento di **tutta** la migrazione: non si rigenerano mai senza approvazione.
- Commit in italiano con prefisso convenzionale (`test:`, `chore:`, `docs:`), senza righe di attribuzione.
- Dipendenze fissate: `npm i -D --save-exact @playwright/test@1.63.0`.

## Regola delle spec di caratterizzazione

Queste spec **non sono TDD**: descrivono un'app che esiste già, quindi il ciclo di ogni task è:

1. scrivere la spec;
2. eseguirla: deve **passare** sull'app di oggi;
3. se fallisce, aprire il trace (`npx playwright show-trace test-results/<...>/trace.zip`) e capire se sbaglia la spec (selettore, tempi) o se l'app si comporta diversamente da quanto scritto. **Si corregge sempre la spec**, mai `src/`. Se il comportamento reale sembra un bug, la spec lo fissa così com'è con un commento `// Comportamento attuale: …` e il caso va nel messaggio di commit sotto "Da discutere";
4. **prova di sensibilità**: cambiare temporaneamente un valore atteso **nella spec** (es. un nome di file) e verificare che la spec fallisca con un messaggio chiaro, poi ripristinarlo. Mai modificare `src/` per questa prova;
5. commit.

## Review Focus

Casi non ovvi che la spec implica e che nessun controllo copriva; ciascuno ha un test nel task indicato.

1. **Bozza d'emergenza dopo un salvataggio fallito e un ricaricamento**: il testo scritto mentre l'accesso era revocato deve tornare nell'editor con il toast `toast.restoredDraft` (Task 8, `draft survives a failed save and a reload`).
2. **Rinominare il file aperto**: il file resta aperto con il nuovo nome e il contenuto non cambia (Task 6, `renaming the open file keeps it open`).
3. **Menu dell'albero solo da tastiera**: aprendolo, il focus va sulla prima voce; con Esc il menu si chiude (Task 6, `tree menu works from the keyboard`).
4. **Nomi non ASCII**: `città.md` si crea dal dialog e un link `[c](citt%C3%A0.md)` nell'anteprima lo apre (Task 4 e Task 6).
5. **File creato fuori dall'app**: dopo il focus della finestra compare nell'albero e nella ricerca (Task 8, `a file created outside appears in tree and search`).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/playwright.config.ts` | Config: server di anteprima, progetto Chromium, opzioni di contesto, snapshot. |
| `e2e/tsconfig.json` | Tipi per `e2e/` (`npm run lint`). |
| `e2e/support/fsHarness.ts` | Script iniettato (selettore → OPFS, permessi, scritture negate) e helper OPFS lato test. |
| `e2e/support/i18n.ts` | Messaggi `en`/`it` letti da `src/i18n/locales/*.json`. |
| `e2e/support/app.ts` | Fixture `test` con `app: App` (navigazione, localizzatori, disco). |
| `e2e/startup.spec.ts` | Avvio, browser non supportato, ripresa accesso, cambio cartella, config non valida. |
| `e2e/editor.spec.ts` | Autosalvataggio, `Ctrl+S`, modalità, sidebar e resizer. |
| `e2e/preview.spec.ts` | Markdown, frontmatter, immagini, link, HTML malevolo. |
| `e2e/sync-scroll.spec.ts` | Scroll sincronizzato in split, nei due sensi. |
| `e2e/tree.spec.ts` | Dialog nuovo/rinomina/elimina, errori di nome, menu. |
| `e2e/search.spec.ts` | `Ctrl+K`, risultati, Invio, Esc, Custom Highlight. |
| `e2e/external.spec.ts` | Modifiche esterne, conflitto, file eliminato, accesso perso, bozza. |
| `e2e/theme-i18n.spec.ts` | Ciclo del tema, tema prima del render, lingua. |
| `e2e/visual.spec.ts` + `e2e/__screenshots__/` | Snapshot visivi di riferimento. |
| `src/i18n/uiText.test.ts` | Modificato: scansiona anche i futuri `.ts` di UI, non passa a vuoto, ha casi negativi. |
| `src/architecture.test.ts` | Nuovo: niente DOM da stringhe fuori da `sanitize.ts`, File System Access solo in `fsaOps.ts`/`access.ts`. |
| `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CLAUDE.md` | Script, dipendenza, artefatti ignorati, documentazione. |

---

### Task 1: Branch, baseline, Playwright e harness OPFS

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/tsconfig.json`, `e2e/support/fsHarness.ts`, `e2e/support/i18n.ts`, `e2e/support/app.ts`, `e2e/startup.spec.ts`
- Modify: `package.json` (scripts, devDependencies), `package-lock.json`, `.gitignore`

**Interfaces:**
- Produces (usati da tutti i task successivi):
  - `test`, `expect` da `e2e/support/app.ts`; opzioni di fixture `flags: Partial<HarnessFlags>`, `appLocale: E2ELocale`.
  - `class App { page; locale; folder: string; t(key, params?): string; start(); openFolder(files: Seed, folder?: string); setFlags(flags: Partial<HarnessFlags>); tree(): Locator; treeFile(name): Locator; openFile(name); expectOpen(name); editorPane(); editor(); previewPane(); typeAtEnd(text); saveState(key: SaveKey): Locator; disk(path): Promise<string | null>; exists(path): Promise<boolean>; writeExternal(path, text); removeExternal(path); windowFocus() }`
  - da `fsHarness.ts`: `type HarnessFlags`, `type Seed`, `PIXEL_PNG_BASE64`, `DEFAULT_FLAGS`, `FLAGS_KEY`, `harnessScript`, `seedFolder(page, folder, files)`, `readText(page, folder, path)`, `pathExists(page, folder, path)`, `removePath(page, folder, path)`.
  - da `i18n.ts`: `type E2ELocale = 'en' | 'it'`, `messagesFor(locale)`.

- [ ] **Step 1: Creare il branch di integrazione**

Eseguire nel worktree preparato con `superpowers:using-git-worktrees`:

```bash
git switch plan/web-components-stack
git switch -c feat/web-components
git log --oneline main..HEAD | wc -l   # atteso: ≥ 10 (v1.1 + documenti)
```

- [ ] **Step 2: Registrare la baseline**

```bash
npm ci
npm test 2>&1 | tail -8      # annotare "# tests N" e "# pass N" (atteso 189)
npm run lint && npm run build
```

Expected: tutto verde. Se `npm test` non è verde **prima** di toccare qualcosa, fermarsi e riferire: il piano presuppone una baseline verde.

- [ ] **Step 3: Installare Playwright**

```bash
npm i -D --save-exact @playwright/test@1.63.0
npx playwright install chromium
```

- [ ] **Step 4: Script, `.gitignore`, tsconfig**

In `package.json`, sezione `scripts` (le altre voci restano):

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

- [ ] **Step 7: Messaggi e fixture**

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
import {
  DEFAULT_FLAGS, FLAGS_KEY, harnessScript, pathExists, readText, removePath, seedFolder,
  type HarnessFlags, type Seed,
} from './fsHarness.ts';
import { messagesFor, type E2ELocale } from './i18n.ts';

type SaveKey = 'save.saved' | 'save.dirty' | 'save.saving' | 'save.error' | 'save.deleted';

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

  async openFile(name: string): Promise<void> {
    await this.treeFile(name).click();
    await this.expectOpen(name);
  }

  /** Il file aperto è quello con aria-current="page" nell'albero. */
  async expectOpen(name: string): Promise<void> {
    await expect(this.treeFile(name)).toHaveAttribute('aria-current', 'page');
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

  saveState(key: SaveKey): Locator {
    return this.page.getByText(this.t(key), { exact: true });
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

export const test = base.extend<{ flags: Partial<HarnessFlags>; appLocale: E2ELocale; app: App }>({
  flags: [{}, { option: true }],
  appLocale: ['en', { option: true }],
  app: async ({ page, flags, appLocale }, use) => {
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

- [ ] **Step 8: Prima spec (smoke)**

`e2e/startup.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

test('opening a folder lists markdown files and visible folders only', async ({ app, page }) => {
  await app.openFolder({
    'note.md': '# Note',
    'sub/other.md': 'other',
    'img/pic.png': 'not markdown',
    '.hidden/secret.md': 'secret',
  });
  await expect(app.treeFile('note.md')).toBeVisible();
  await expect(app.tree().getByText('sub', { exact: true })).toBeVisible();
  // Cartelle con soli file non markdown e cartelle nascoste non compaiono.
  await expect(app.tree().getByText('img', { exact: true })).toHaveCount(0);
  await expect(app.tree().getByText('.hidden', { exact: true })).toHaveCount(0);
  await expect(page.getByText(app.t('toolbar.noFile'), { exact: true })).toBeVisible();
});
```

- [ ] **Step 9: Eseguire la spec**

Run: `npm run test:e2e -- startup.spec.ts`
Expected: `1 passed`. Se fallisce all'avvio del server, eseguire `npm run build` da solo e leggere l'errore; se la porta 4173 è occupata, chiudere il processo che la usa (non cambiare `reuseExistingServer`). Se `showDirectoryPicker` o `createWritable` sull'OPFS non si comportano come previsto, fermarsi e riferire: è il presupposto dell'intero piano.

- [ ] **Step 10: Prova di sensibilità**

Cambiare temporaneamente `'note.md'` in `'nope.md'` nella prima `expect`, eseguire di nuovo: deve fallire con un timeout su `getByRole('button', { name: 'nope.md' })`. Ripristinare.

- [ ] **Step 11: `npm test` non raccoglie le spec e il lint passa**

Run: `npm test 2>&1 | tail -8 && npm run lint`
Expected: stesso numero di test dello Step 2, lint pulito.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json .gitignore e2e/
git commit -m "test: suite Playwright con cartella finta su OPFS"
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
  // Il pulsante della cartella nella sidebar ha come nome il nome della cartella.
  await page.getByRole('button', { name: 'alpha', exact: true }).click();
  await expect(app.treeFile('b.md')).toBeVisible();
  await expect(app.treeFile('a.md')).toHaveCount(0);
  await app.setFlags({ folder: 'alpha' });
  await page.getByRole('button', { name: 'beta', exact: true }).click();
  await app.expectOpen('a.md');
});

test('an invalid .housemd.json shows a toast and the app still opens', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'alpha', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(page.getByRole('status').filter({ hasText: prefix })).toBeVisible();
  await expect(app.treeFile('a.md')).toBeVisible();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- startup.spec.ts`
Expected: `7 passed`. In caso di fallimento applicare la "Regola delle spec di caratterizzazione".

- [ ] **Step 3: Prova di sensibilità**

Nel test A → B → A, sostituire temporaneamente l'ultima riga con `await app.expectOpen('b.md')` su un file che non c'è: deve fallire. Ripristinare.

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
- Consumes: `test`, `expect`, `App` (Task 1), `PIXEL_PNG_BASE64`. `App` deve essere esportata come tipo da `e2e/support/app.ts` (lo è: `export class App`).

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
  // Clic e non Invio: @codemirror/autocomplete ignora Invio per i primi 75 ms (interactionDelay),
  // quindi su una macchina veloce Invio andrebbe a capo invece di completare.
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

test('view modes: buttons, Ctrl+\\ cycle, remembered after reload', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await app.openFile('note.md');
  const modes = page.getByRole('group', { name: app.t('toolbar.modes') });
  const mode = (key: string) => modes.getByRole('button', { name: app.t(key), exact: true });

  await expect(mode('mode.split')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.editorPane()).toBeVisible();
  await expect(app.previewPane()).toBeVisible();

  await mode('mode.preview').click();
  await expect(app.editorPane()).toHaveCount(0);
  await expect(app.previewPane()).toBeVisible();

  // Ordine del ciclo: editor → split → preview → editor.
  await page.keyboard.press('ControlOrMeta+Backslash');
  await expect(mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
  await expect(app.previewPane()).toHaveCount(0);

  await page.reload();
  await app.expectOpen('note.md');
  await expect(mode('mode.editor')).toHaveAttribute('aria-pressed', 'true');
});

test('sidebar: arrow keys resize it, hiding it is remembered', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  const separator = page.getByRole('separator', { name: app.t('sidebar.resize') });
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '296');

  await page.getByRole('button', { name: app.t('sidebar.hide') }).click();
  await expect(app.tree()).toHaveCount(0);

  await page.reload();
  const show = page.getByRole('button', { name: app.t('sidebar.show') });
  await expect(show).toBeVisible();
  await expect(app.tree()).toHaveCount(0);
  await show.click();
  await expect(separator).toHaveAttribute('aria-valuenow', '296');
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- editor.spec.ts`
Expected: `7 passed`. Se con l'orologio in pausa CodeMirror non registra la digitazione, aumentare `runFor` a piccoli passi restando **sotto** i 1000 ms dell'autosalvataggio; non togliere la pausa (il test perderebbe il senso). Il nome dell'immagine salvata viene da `imageFileName` (`src/config/images.ts`): se il link reale è diverso, la spec si adegua all'app.

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
- Consumes: `test`, `expect`, `App` (Task 1).

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
Expected: `7 passed`. Nota per il trace: il frontmatter della card usa `toLocaleDateString('en', …)`; se il testo della data è diverso, correggere la stringa attesa con quella reale (è l'app a fare fede).

- [ ] **Step 3: Prova di sensibilità**

Nel test dell'HTML ostile cambiare temporaneamente `.toBeUndefined()` in `.toBe(1)`: deve fallire con `undefined` (la prova si fa sempre sulla spec, mai su `src/`). Ripristinare.

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

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- sync-scroll.spec.ts --repeat-each=3`
Expected: `6 passed`. Ripetere tre volte serve a scoprire subito una spec instabile: se una ripetizione fallisce, stabilizzare la spec (mai `src/`).

- [ ] **Step 3: Prova di sensibilità**

Cambiare temporaneamente `<= 1` in `< 0`: entrambe devono fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/sync-scroll.spec.ts
git commit -m "test: e2e dello scroll sincronizzato in split"
```

---

### Task 6: Albero, dialog e menu

**Files:**
- Create: `e2e/tree.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).

- [ ] **Step 1: Scrivere la spec**

`e2e/tree.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

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

test('tree menu works from the keyboard', async ({ app, page }) => {
  const actions = page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) });
  await actions.focus();
  await page.keyboard.press('Enter');
  // Per una cartella la prima voce è "Nuovo file", e riceve il focus. Il menu sta dentro la
  // navigazione dell'albero: lì "New file" c'è solo come voce di menu (la testata della sidebar
  // e il pulsante della schermata vuota stanno fuori).
  const first = app.tree().getByRole('button', { name: app.t('file.new'), exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeHidden();
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- tree.spec.ts`
Expected: `9 passed`. La posizione del popover vicino ai bordi della finestra resta manuale (spec §9). Punto da controllare nel trace se fallisce: il nome "New file" compare fino a tre volte (testata della sidebar, voce del menu delle cartelle dentro l'albero, pulsante della schermata vuota). `.first()` è la testata della sidebar; la voce di menu si prende sempre dentro `app.tree()`.

- [ ] **Step 3: Prova di sensibilità**

Nel test di rinomina attendere `'renamed.md.md'`: deve fallire. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/tree.spec.ts
git commit -m "test: e2e dell'albero (nuovo, rinomina, elimina, errori, menu da tastiera)"
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
- Consumes: `test`, `expect`, `App` (Task 1), in particolare `writeExternal`, `removeExternal`, `windowFocus`, `setFlags`.

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

test('the open file deleted outside: toast and "deleted on disk" state', async ({ app, page }) => {
  await app.removeExternal('note.md');
  await app.windowFocus();
  await expect(page.getByRole('status').filter({ hasText: app.t('toast.deletedOutside', { path: 'note.md' }) })).toBeVisible();
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
  await app.expectOpen('note.md');
  await expect(app.editor()).toContainText('draft');
  await expect(page.getByRole('status').filter({ hasText: app.t('toast.restoredDraft', { path: 'note.md' }) })).toBeVisible();
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
  await expect(
    page.getByRole('status').filter({ hasText: app.t('toast.restoredDraftDeleted', { path: 'note.md' }) }),
  ).toBeVisible();
  await expect(app.editor()).toContainText('orphan text');
});
```

- [ ] **Step 2: Eseguire**

Run: `npm run test:e2e -- external.spec.ts --repeat-each=3`
Expected: `24 passed`. Le spec di conflitto non dipendono dai tempi della macchina (orologio in pausa); se una ripetizione fallisce, cercare nel trace un timer dell'app che il test non fa avanzare, e farlo avanzare con `page.clock.runFor` restando sotto i 1000 ms prima della modifica esterna.

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
- Consumes: `test`, `expect`, `App` (Task 1); opzioni `appLocale` e `locale` di Playwright.
- Nota: il cambio di lingua "a caldo" non ha un'interfaccia nell'app di oggi (nessuno chiama `setLocale`), quindi qui si prova solo la lingua all'avvio (spec §9).

- [ ] **Step 1: Scrivere la spec**

`e2e/theme-i18n.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

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
Expected: `3 passed`. Il bundle d'ingresso di Vite si chiama `assets/index-<hash>.js`: se `npm run build` produce un nome diverso (vedi `dist/index.html`), adeguare il pattern di `page.route`. `#root` è il punto di montaggio di `index.html` e resta anche dopo la migrazione (spec §7 fase 6).

- [ ] **Step 3: Prova di sensibilità**

Nel test italiano usare temporaneamente `appLocale: 'en'`: deve fallire perché il pulsante si chiama in italiano. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add e2e/theme-i18n.spec.ts
git commit -m "test: e2e di tema e lingua"
```

---

### Task 10: Snapshot visivi di riferimento

**Files:**
- Create: `e2e/visual.spec.ts`, `e2e/__screenshots__/visual.spec.ts/*.png`

**Interfaces:**
- Consumes: `test`, `expect`, `App` (Task 1).
- Produces: gli snapshot PNG che tutti i piani successivi devono rispettare.

- [ ] **Step 1: Scrivere la spec**

`e2e/visual.spec.ts`:

```ts
import { expect, test } from './support/app.ts';

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

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('start screen', async ({ app, page }) => {
      await app.start();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`start-${scheme}.png`);
    });

    test('workspace in split mode', async ({ app, page }) => {
      await app.openFolder({ 'note.md': NOTE, 'docs/guide.md': '# Guide' });
      await app.openFile('note.md');
      await expect(app.previewPane().getByRole('heading', { name: 'Heading' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`workspace-${scheme}.png`);
    });
  });
}

test('name dialog', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note' });
  await page.getByRole('button', { name: app.t('file.new') }).first().click();
  await page.getByRole('dialog', { name: app.t('file.new') }).getByRole('textbox').fill('draft');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('name-dialog.png');
});

test('tree actions menu', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note', 'docs/guide.md': '# Guide' });
  await page.getByRole('button', { name: app.t('tree.actions', { name: 'docs' }) }).click();
  await expect(page.getByRole('button', { name: app.t('tree.rename'), exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('tree-menu.png');
});

test('toast', async ({ app, page }) => {
  await app.openFolder({ 'note.md': '# Note', '.housemd.json': '{ images: ' });
  const prefix = app.t('toast.configInvalidJson', { file: '.housemd.json', detail: '' }).trim();
  await expect(page.getByRole('status').filter({ hasText: prefix })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // I toast informativi spariscono dopo 6 s: lo snapshot va preso subito.
  await expect(page).toHaveScreenshot('toast.png', { timeout: 3000 });
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
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('conflict.png');
});
```

- [ ] **Step 2: Creare gli snapshot (unica volta autorizzata)**

Run: `npm run test:e2e -- visual.spec.ts --update-snapshots`
Expected: 8 PNG creati in `e2e/__screenshots__/visual.spec.ts/` con suffisso `-linux`.

- [ ] **Step 3: Aprire e controllare ogni PNG**

Aprire ciascuna immagine (Read tool sul PNG) e verificare a occhio: font Space Grotesk/Mono caricati (non font di sistema), tema giusto, nessun elemento a metà transizione, cursore assente. Se un'immagine è sbagliata, correggere la spec e ricreare solo quella.

- [ ] **Step 4: Verificare la stabilità**

Run: `npm run test:e2e -- visual.spec.ts --repeat-each=3`
Expected: `24 passed`. Se uno snapshot varia tra un'esecuzione e l'altra, individuare la causa (font non pronti, animazione, contenuto variabile) e correggere la spec; **non** alzare `maxDiffPixelRatio`.

- [ ] **Step 5: Commit**

```bash
git add e2e/visual.spec.ts e2e/__screenshots__/
git commit -m "test: snapshot visivi di riferimento per la migrazione"
```

---

### Task 11: `uiText.test.ts` non passa più a vuoto

**Files:**
- Modify: `src/i18n/uiText.test.ts` (riscrittura completa, stessa lista `LEGACY`)

**Interfaces:**
- Produces: la regola "file di UI" = `*.tsx` (non di test) + `src/elements/**/*.ts` + `src/dom/**/*.ts` (non di test), usata dai piani successivi.

- [ ] **Step 1: Riscrivere il test**

Sostituire l'intero contenuto di `src/i18n/uiText.test.ts` con:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));
// `join` serve solo a walk(); i percorsi confrontati nei test usano sempre '/'.

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

/** File di interfaccia: i .tsx di oggi e, con i Web Components, i .ts sotto elements/ e dom/. */
function isUiFile(path: string): boolean {
  if (/\.test\.tsx?$/.test(path)) return false;
  if (path.endsWith('.tsx')) return true;
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

const LABEL = '(?:aria-label|title|placeholder|alt)';
const QUOTED = '(?<q>[\'"`])(?<v>(?:(?!\\k<q>).)*)\\k<q>';

/** Tutte le forme con cui un'etichetta accessibile o un testo può finire nel DOM con un valore letterale. */
const LITERAL_PATTERNS: RegExp[] = [
  // JSX: title="…"
  new RegExp(`\\b${LABEL}="(?<v>[^"]*)"`, 'g'),
  // el.setAttribute('aria-label', '…')
  new RegExp(`setAttribute\\(\\s*['"]${LABEL}['"]\\s*,\\s*${QUOTED}`, 'g'),
  // el('button', { 'aria-label': '…', title: '…' })
  new RegExp(`(?:['"]${LABEL}['"]|\\b(?:title|placeholder|alt))\\s*:\\s*${QUOTED}`, 'g'),
  // node.title = '…', node.textContent = '…'
  new RegExp(`\\.(?:title|placeholder|alt|ariaLabel|textContent)\\s*=\\s*${QUOTED}`, 'g'),
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

test('the file filter covers today\'s .tsx and tomorrow\'s custom elements', () => {
  assert.equal(isUiFile('ui/FileTree.tsx'), true);
  assert.equal(isUiFile('elements/file-tree/file-tree.element.ts'), true);
  assert.equal(isUiFile('dom/icon.ts'), true);
  assert.equal(isUiFile('elements/app/screens.test.ts'), false);
  assert.equal(isUiFile('ui/tree.ts'), false);
});

test('an offending file is reported by path (sensitivity check on synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Probe.tsx', source: "const probe = { title: 'Prova' };" },
    { path: 'elements/probe/probe.element.ts', source: "el('button', {}, 'Annulla')" },
    { path: 'ui/Clean.tsx', source: "<button title={t('toast.close')} />" },
  ];
  assert.deepEqual(findLiteralLabels(probes), ["ui/Probe.tsx: title: 'Prova'"]);
  assert.deepEqual(findLegacyTexts(probes), ['elements/probe/probe.element.ts: Annulla']);
});

test('the checks fire on every supported form (guard against silent regex rot)', () => {
  assert.deepEqual(legacyTextsIn("el('button', {}, 'Annulla')"), ['Annulla']);
  const positives = [
    '<button title="Chiudi">',
    "el.setAttribute('aria-label', 'Chiudi')",
    'el.setAttribute("title", `Nuovo file`)',
    "el('button', { 'aria-label': 'Chiudi' })",
    "el('input', { placeholder: 'Cerca' })",
    "input.placeholder = 'Cerca'",
    "p.textContent = 'Nessun risultato'",
    "img.alt = 'Logo'",
  ];
  for (const source of positives) assert.equal(literalLabelsIn(source).length, 1, source);
});

test('the checks ignore translated and non-textual values', () => {
  const negatives = [
    "<button title={t('toast.close')}>",
    "el.setAttribute('aria-label', t('toast.close'))",
    "p.textContent = ''",
    'node.title = `${path}`',
    'interface Props { title: string }',
    "el('div', { 'aria-label': '' })",
    "setAttribute('aria-valuenow', '280')",
  ];
  for (const source of negatives) assert.deepEqual(literalLabelsIn(source), [], source);
});
```

- [ ] **Step 2: Eseguire**

Run: `npx tsx --test src/i18n/uiText.test.ts`
Expected: 7 test, tutti `pass`. Se il terzo test trova occorrenze nei `.tsx` di oggi, **non** modificare i `.tsx`: significa che una delle nuove forme dà un falso positivo; restringere la regex e aggiungere quel caso ai `negatives`.

La prova di sensibilità è il test `an offending file is reported by path`, permanente e su sorgenti sintetici: nessun file di `src/` va toccato, nemmeno per un momento.

- [ ] **Step 3: Suite completa e commit**

Run: `npm test 2>&1 | tail -8 && git status --short src/`
Expected: baseline + 5 test (erano 2 in questo file, ora 7), tutti verdi; in `src/` risulta modificato solo `src/i18n/uiText.test.ts`.

```bash
git add src/i18n/uiText.test.ts
git commit -m "test: uiText controlla anche i futuri custom element e non può passare a vuoto"
```

---

### Task 12: Test di architettura

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
  .filter(({ path }) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith('.d.ts'))
  .map(({ full, path }) => ({ path, source: readFileSync(full, 'utf8') }));

/** HTML da stringa nel DOM: solo sanitize.ts può farlo, e solo con HTML già sanitizzato. */
const UNSAFE_DOM = /\.(?:innerHTML|outerHTML)\s*=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/;
const UNSAFE_DOM_ALLOWED = new Set(['preview/sanitize.ts']);

/** File System Access API: solo fsaOps.ts e access.ts. */
const FSA = /\b(?:showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|queryPermission|requestPermission|createWritable|getDirectoryHandle|getFileHandle)\b/;
const FSA_ALLOWED = new Set(['fs/fsaOps.ts', 'fs/access.ts']);

/** Percorsi dei file che usano `pattern` senza esserne autorizzati. */
function offenders(pattern: RegExp, allowed: ReadonlySet<string>, list: SourceFile[] = sources): string[] {
  return list.filter(({ path, source }) => !allowed.has(path) && pattern.test(source)).map(({ path }) => path);
}

test('the source list is not empty', () => {
  assert.ok(sources.length > 20, `solo ${sources.length} file sorgente trovati`);
});

test('HTML strings reach the DOM only through preview/sanitize.ts', () => {
  assert.deepEqual(offenders(UNSAFE_DOM, UNSAFE_DOM_ALLOWED), []);
});

test('only fs/fsaOps.ts and fs/access.ts touch the File System Access API', () => {
  assert.deepEqual(offenders(FSA, FSA_ALLOWED), []);
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
});

test('offending files are reported by path and allowed files are not (synthetic sources)', () => {
  const probes: SourceFile[] = [
    { path: 'ui/Icon.tsx', source: '// probe: document.write(x)' },
    { path: 'preview/sanitize.ts', source: 'el.innerHTML = sanitizeWith(purify, html);' },
    { path: 'workspace/probe.ts', source: 'await handle.createWritable();' },
    { path: 'fs/fsaOps.ts', source: 'await handle.createWritable();' },
  ];
  assert.deepEqual(offenders(UNSAFE_DOM, UNSAFE_DOM_ALLOWED, probes), ['ui/Icon.tsx']);
  assert.deepEqual(offenders(FSA, FSA_ALLOWED, probes), ['workspace/probe.ts']);
});
```

Nota: `isSameEntry` (usato da `fs/handleStore.ts` per riconoscere una cartella già aperta) non è nell'elenco: `handleStore` confronta handle già ottenuti, non accede al file system. È un'eccezione esistente e documentata qui; allargare la regola è una decisione da prendere con Davide, non in questo piano.

- [ ] **Step 2: Eseguire**

Run: `npx tsx --test src/architecture.test.ts`
Expected: 5 test `pass`. La prova di sensibilità è l'ultimo test, permanente e su sorgenti sintetici: nessun file di `src/` va toccato.

- [ ] **Step 3: Suite completa e commit**

Run: `npm test 2>&1 | tail -8 && git status --short src/`
Expected: baseline + 5 (Task 11) + 5 (questo task), tutti verdi; in `src/` solo `src/architecture.test.ts` è nuovo.

```bash
git add src/architecture.test.ts
git commit -m "test: regole di architettura (DOM da stringhe, File System Access) verificate sul sorgente"
```

---

### Task 13: Documentazione e verifica finale

**Files:**
- Modify: `README.md` (sezione "Sviluppo"), `CLAUDE.md` (sezione "Regole")

- [ ] **Step 1: README**

In `README.md`, nel blocco di comandi della sezione "Sviluppo", dopo la riga di `npm test`, aggiungere:

```bash
npm run test:e2e # test end-to-end (Playwright, Chromium); la prima volta: npx playwright install chromium
```

E subito dopo il blocco:

```markdown
I test end-to-end usano una cartella finta nell'Origin Private File System al posto del selettore
di cartelle (vedi `e2e/support/fsHarness.ts`). Gli snapshot in `e2e/__screenshots__/` sono il
riferimento visivo: si rigenerano (`--update-snapshots`) solo per un cambiamento voluto e approvato.
```

- [ ] **Step 2: CLAUDE.md**

In fondo alla sezione `## Regole` di `CLAUDE.md` aggiungere:

```markdown
- I test end-to-end (`e2e/*.spec.ts`, `npm run test:e2e`) trovano gli elementi solo per ruolo e nome accessibile, con i testi da `en.json`: mai classi CSS. Gli snapshot visivi si rigenerano solo con approvazione.
```

- [ ] **Step 3: Verifica completa**

```bash
npm test 2>&1 | tail -8
npm run lint
npm run build
npm run test:e2e -- --repeat-each=2
git status --short    # atteso: pulito a parte README.md e CLAUDE.md
git diff --stat plan/web-components-stack -- src/   # atteso: solo src/i18n/uiText.test.ts e src/architecture.test.ts
```

Expected: `npm test` = baseline + 10, lint e build puliti, e2e tutti verdi due volte di fila, nessun file di `src/` toccato oltre ai due test.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: test end-to-end in README e CLAUDE.md"
```

- [ ] **Step 5: Riepilogo per Davide (niente merge)**

Riferire: numero dei test prima/dopo, numero delle spec e2e, elenco degli snapshot, eventuali comportamenti fissati con `// Comportamento attuale:` (sezione "Da discutere" dei commit). Il branch `feat/web-components` **resta non unito**: il piano 2 (fasi 1–2 dello spec) si scrive a partire da qui.
