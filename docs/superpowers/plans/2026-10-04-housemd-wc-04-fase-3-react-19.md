# HouseMD Web Components — Piano 4: fase 3, React 19

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare l'app da React 18.3 a React 19.3 senza cambi di comportamento, con una rete che copra anche la modalità di sviluppo (StrictMode), così che nella fase 4 React passi da solo proprietà ed eventi ai custom element.

**Architecture:** Prima si allarga la rete, poi si aggiorna. Una suite e2e nuova (`npm run test:e2e:dev`) fa girare le stesse spec contro `vite` in sviluppo, dove React monta due volte gli effetti (StrictMode) e scrive i suoi avvisi in console; un avviso o un errore in console fa fallire il test. Si ripara il solo fallimento che quella suite trova già oggi con React 18, si aggiungono tre e2e sui punti che React 19 cambia (`inert`, `popoverTarget`, `flushSync` dentro la view transition) e solo allora si aggiornano le dipendenze e si correggono i tre punti del codice.

**Tech Stack:** React 19.3.0, react-dom 19.3.0, @types/react 19.3.0, @types/react-dom 19.3.0, @vitejs/plugin-react 6.1.1 (invariato), TypeScript 7, Vite 8, Playwright 1.63.0, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§1.2, §7 fase 3, §8.4, §11, R18). Il Task 6 aggiorna lo spec (vedi "Scostamenti dallo spec").

## Global Constraints

- **Comportamento e aspetto invariati.** `npm run test:e2e` resta verde **con gli snapshot di oggi**: nessuno si rigenera in questa fase. Se uno snapshot cambia, è un bug dell'aggiornamento (spec §7 fase 3: "Se un comportamento cambia, è un bug dell'aggiornamento, non della spec").
- I test esistenti non cambiano le asserzioni. Si aggiungono solo test nuovi.
- Versioni: `react` e `react-dom` `^19.3.0` in `dependencies`; `@types/react` e `@types/react-dom` `^19.3.0` in `devDependencies`. Nessun'altra dipendenza cambia (`@vitejs/plugin-react` 6.1.1 supporta già React 19; `pixelarticons` dichiara `react >=16`).
- `forwardRef` resta (spec §7 fase 3: "ancora supportato, si lascia"). Niente React Compiler, niente API nuove di React 19 (`use`, Actions, `useOptimistic`): la fase cambia la versione, non lo stile.
- Le regole di `CLAUDE.md` valgono tutte: commenti e commit in italiano, identificatori in inglese, test e2e solo per ruolo e nome accessibile con testi da `en.json` (eccezione già ammessa dallo spec: classi di CodeMirror), snapshot rigenerati solo con approvazione.
- Branch `refactor/fase-3-react-19` creato da `main` (primo commit: questo piano), lavorato nel worktree `../housemd-fase3`. Alla fine si chiede a Davide se fare merge locale o PR; push e merge solo con il suo via.
- Commit in italiano con prefisso convenzionale (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`), senza righe di attribuzione.
- **Mai giudicare un comando di verifica dal suo output filtrato**: niente `| grep`/`| tail` sui comandi di test (restituirebbero l'exit code del filtro). Si guarda l'exit code del comando stesso.
- Comandi di verifica di ogni task: `npm test`, `npm run lint`, `npm run test:e2e` (~50 s, worker a 2), e dal Task 2 in poi `npm run test:e2e:dev` (~60 s).

## Misure prese scrivendo il piano (04/10, su `main` = `1b23305`)

Provato in worktree usa-e-getta, poi rimossi:

1. **Typecheck con i tipi di React 19**: un solo errore, `src/ui/WorkspaceView.tsx:344` (`{...{ inert: settingsOpen ? '' : undefined }}`). Non è solo un tipo: React 19 tratta `inert` come booleano e la stringa vuota come **falso**, quindi a impostazioni aperte il workspace dietro tornerebbe raggiungibile da tastiera e da screen reader, senza errori e senza snapshot diversi.
2. **Con `inert={settingsOpen}`**: `npm run lint`, `npm test` (602), `npm run build`, `npm run test:e2e` (98, snapshot invariati) tutti verdi. JS principale gzip 410 158 → 432 396 B (+22 KB).
3. **e2e contro `vite` in sviluppo** (spec senza `visual.spec.ts` e senza il test che trattiene `assets/index-*.js`, 83 test):
   - React 18: 82 passati, **1 fallito in modo stabile** (4 su 4): `ai-review.spec.ts` › "Ctrl+Z undoes a block accept, a block reject and Accept all", all'ultimo passo (Ctrl+Z dopo "Accept all" non riporta il documento). In produzione lo stesso test passa: è un difetto che si vede solo con StrictMode. Console: **nessun errore né avviso**.
   - React 19: stesso risultato (82 + lo stesso fallimento). Console: **10 errori** `Invalid DOM property 'popovertarget'. Did you mean 'popoverTarget'?` (da `ModelChip.tsx:74` e `ReviewBar.tsx:81`).
4. Nessuna ref callback nel codice (`ref={(el) => …}`): il doppio montaggio delle ref callback di React 19 (R18) non ha punti d'appoggio oggi. Nessun `useRef()` senza argomento, nessun uso del namespace globale `JSX`, nessun `defaultProps`/`propTypes`/`findDOMNode`.
5. Un e2e su `inert` (Task 4) passa con React 18 e fallisce togliendo `inert`; uno sul popover del chip del profilo passa e fallisce togliendo `popovertarget`; uno sul ciclo del tema con le animazioni attive passa.

## Scostamenti dallo spec (da riportare nello spec al Task 6)

1. **Suite e2e in sviluppo** (`npm run test:e2e:dev`, nuova): lo spec affida R18 a "e2e e snapshot", ma la suite di oggi gira sulla build di produzione, dove StrictMode non c'è e React non scrive avvisi. Senza questa suite il cambio di React 19 su StrictMode sarebbe verificato solo a mano.
2. **Riparato un difetto preesistente** (Task 3, Ctrl+Z dopo "Accept all" in sviluppo): non è un cambio di comportamento in produzione, ma senza la riparazione la suite di sviluppo non può fare da cancello.
3. **Cosa React 19 ha cambiato davvero qui** (al posto dell'elenco generico dello spec): `inert` booleano, `popoverTarget` riconosciuto come proprietà, `MutableRefObject` deprecato a favore di `RefObject` (che in React 19 è scrivibile). `useRef` con argomento obbligatorio, namespace `JSX` e ref callback non toccano il codice di oggi.
4. **Bundle**: +22 KB gzip per React 19, da riportare nel baseline della fase 8 (spec §7 fase 8 stima −40 KB togliendo React: il confronto va fatto con React 19).

## Review Focus

1. **Impostazioni aperte**: il workspace dietro deve restare inerte (niente focus da tastiera, fuori dall'albero di accessibilità). React 19 lo romperebbe in silenzio con `inert=""`. Task 4, e2e in `settings.spec.ts`; Task 5 lo fa passare con React 19.
2. **Popover aperti da `popovertarget`** (chip del profilo AI, avvisi della revisione): con React 19 il nome della prop cambia; un errore lascerebbe il pulsante senza effetto. Task 4, e2e sul chip del profilo; Task 5 passa a `popoverTarget`.
3. **Ciclo del tema con le animazioni attive**: `useTheme` chiama `flushSync` dentro la callback della view transition; tutta la suite usa `reducedMotion: 'reduce'` e non passa mai da lì. Task 4, e2e con `reducedMotion: 'no-preference'` (in produzione e in sviluppo, dove un avviso di React su `flushSync` farebbe fallire il test).
4. **Doppio montaggio di StrictMode** su dialog (`NameDialog`, `ConfirmDialog`, accesso perso), editor e MergeView: oggi coperto solo a mano. Task 2 (suite in sviluppo), Task 3 (difetto già presente), Task 5 (stessa suite con React 19).
5. **Avvisi di React in sviluppo**: React 19 segnala in console prop e attributi che React 18 lasciava passare. Task 2 rende ogni errore o avviso in console un fallimento della suite in sviluppo.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/dev.config.ts` (nuovo) | Suite e2e contro `vite` in sviluppo (porta 5174), console senza errori né avvisi. |
| `e2e/support/app.ts` | Opzione `failOnConsole` della fixture `app`. |
| `package.json`, `package-lock.json` | Script `test:e2e:dev`; React 19 e tipi. |
| `e2e/settings.spec.ts`, `e2e/ai-review.spec.ts`, `e2e/theme-i18n.spec.ts` | Tre e2e sui punti che React 19 cambia. |
| file dell'app individuati dal Task 3 | Riparazione del Ctrl+Z dopo "Accept all" con StrictMode. |
| `src/ui/WorkspaceView.tsx`, `src/ui/ai/ModelChip.tsx`, `src/ui/ai/ReviewBar.tsx`, `src/editor/docExtensions.ts` | Le tre correzioni per React 19. |
| spec, `README.md`, `CLAUDE.md` | Documentazione. |

---

### Task 1: Branch e baseline

**Files:** nessuno.

- [ ] **Step 1: Worktree**

```bash
# Il branch esiste già, con il commit di questo piano sopra main.
git log --oneline main..refactor/fase-3-react-19                     # solo il commit del piano
git worktree add ../housemd-fase3 refactor/fase-3-react-19
cd ../housemd-fase3 && npm ci
```

- [ ] **Step 2: Baseline**

```bash
npm test                                    # al 04/10: 602 pass
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c      # al 04/10: 410158
npm run test:e2e                            # al 04/10: 98 passed
git status --short                          # vuoto
```

Expected: tutto verde. Altrimenti fermarsi e riferire.

---

### Task 2: Suite e2e in sviluppo, senza errori né avvisi in console

**Files:**
- Create: `e2e/dev.config.ts`
- Modify: `e2e/support/app.ts`, `package.json`

**Interfaces:**
- Produces: `npm run test:e2e:dev`; opzione di fixture `failOnConsole: boolean` (default `false`), tipo esportato `AppOptions` da `e2e/support/app.ts`.

- [ ] **Step 1: Opzione `failOnConsole` nella fixture**

In `e2e/support/app.ts`, sopra `export const test`:

```ts
/** Opzioni impostabili dalla configurazione (`use`). */
export interface AppOptions {
  /** Ogni errore o avviso in console fa fallire il test: per la suite in sviluppo, dove React avvisa lì. */
  failOnConsole: boolean;
}
```

Il tipo di `base.extend<…>` diventa `base.extend<{ flags: Partial<HarnessFlags>; appLocale: E2ELocale; ai: FakeModel; app: App } & AppOptions>`. Tra le fixture, dopo `appLocale`:

```ts
  failOnConsole: [false, { option: true }],
```

Nella fixture `app`, la firma riceve anche `failOnConsole`:

```ts
  app: async ({ page, flags, appLocale, ai, failOnConsole }, use) => {
```

e dopo `page.on('pageerror', …)`:

```ts
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
```

e in fondo, dopo l'`expect` sulle eccezioni:

```ts
    if (failOnConsole) expect(consoleProblems, 'errori o avvisi in console').toEqual([]);
```

- [ ] **Step 2: Configurazione**

`e2e/dev.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

import base from './playwright.config.ts';
import type { AppOptions } from './support/app.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5174;

/**
 * Le stesse spec contro `vite` in sviluppo: React in modalità dev, con StrictMode che monta due volte
 * gli effetti e con i suoi avvisi in console, che qui fanno fallire il test (spec WC R18). Restano fuori
 * gli snapshot (il riferimento è la build) e il test che trattiene `assets/index-*.js`, che in sviluppo
 * non esiste.
 */
export default defineConfig<AppOptions>({
  ...base,
  outputDir: '../test-results/dev',
  testIgnore: ['**/visual.spec.ts'],
  grepInvert: /applies dark before the app starts/,
  use: { ...base.use, baseURL: `http://localhost:${PORT}`, failOnConsole: true },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

In `package.json`, dopo `"test:e2e:audit"`:

```json
    "test:e2e:dev": "playwright test -c e2e/dev.config.ts"
```

- [ ] **Step 3: Typecheck e suite di produzione invariata**

Run: `npm run lint` poi `npm run test:e2e`
Expected: lint pulito; **98 passed**, nessun PNG modificato (`failOnConsole` è `false` nella configurazione normale).

- [ ] **Step 4: Suite in sviluppo, stato di partenza**

Run: `npm run test:e2e:dev`
Expected (misurato il 04/10): **82 passed, 1 failed**: `ai-review.spec.ts` › "Ctrl+Z undoes a block accept, a block reject and Accept all", all'asserzione dopo l'ultimo Ctrl+Z (riceve `A2…C2` invece di `A…C`). Nessun altro fallimento, nessun errore in console. Se il risultato è diverso, fermarsi e riferire.

Prova di sensibilità del controllo sulla console: aggiungere per un momento in `src/main.tsx`, prima di `createRoot`, la riga `console.warn('prova');`, eseguire `npx playwright test -c e2e/dev.config.ts startup.spec.ts`: ogni test deve FALLIRE con `warning: prova` nel messaggio. Togliere la riga (`git checkout src/main.tsx`).

- [ ] **Step 5: Commit**

```bash
git add e2e/dev.config.ts e2e/support/app.ts package.json
git commit -m "test: suite e2e in sviluppo con StrictMode, senza errori né avvisi in console (npm run test:e2e:dev)"
```

---

### Task 3: Ctrl+Z dopo "Accept all" in sviluppo

**Files:** da individuare (sospetti in ordine: `src/ui/ai/ReviewView.tsx`, `src/editor/Editor.tsx`, `src/ui/ai/DiffPane.tsx`, `src/ai/aiController.ts`).

**Interfaces:** nessuna nuova. Il test che guida il task esiste già e **non cambia**: `e2e/ai-review.spec.ts:117`.

REQUIRED SUB-SKILL: superpowers:systematic-debugging. Niente correzioni prima di aver trovato la causa.

- [ ] **Step 1: Riprodurre**

```bash
npx playwright test -c e2e/dev.config.ts ai-review.spec.ts -g "Ctrl\+Z undoes" --repeat-each=3 --trace on
npx playwright test -c e2e/playwright.config.ts ai-review.spec.ts -g "Ctrl\+Z undoes" --repeat-each=3
```

Expected: in sviluppo 3 su 3 falliti all'ultimo `expect.poll` (riga 133); in produzione 3 su 3 passati.

- [ ] **Step 2: Trovare la causa**

Fatti da cui partire:
- In produzione passa, in sviluppo no: la differenza è StrictMode, che monta due volte (effetto, pulizia, effetto) i componenti **appena montati**. Dopo "Accept all" la revisione passa dalla `MergeView` (`DiffPane`) all'editor normale (`Editor`), che quindi viene montato: `Editor.tsx:49-67` crea l'`EditorView`, la distrugge salvando la sessione (`saveDocSession`) e ne crea un'altra.
- Il Ctrl+Z arriva a CodeMirror solo se il focus è nell'editor giusto: `ReviewView.tsx:47-58` sposta il focus sull'editor nuovo con `plain.current?.focus()`.
- Il Ctrl+Z dopo "Accept all" deve annullare la sostituzione fatta dall'accettazione, che sta nella cronologia dell'editor (`docSession.history` tramite `historyField`).

Ipotesi da verificare una per volta con la traccia (`npx playwright show-trace`) o con `console.debug` temporanei (da togliere prima del commit): (a) il focus finisce sull'`EditorView` distrutta o resta sul `body`; (b) la cronologia salvata alla pulizia di StrictMode non contiene l'accettazione, perché l'accettazione arriva dopo il primo montaggio; (c) un effetto di `ReviewView`/`AiController` che decide di riaprire la revisione si registra due volte o con uno stato vecchio. Scrivere nel report quale ipotesi è vera, con la prova.

- [ ] **Step 3: Correggere la causa**

La correzione sta nel codice dell'app, non nel test. Regole:
- se la causa è in logica pura (`src/ai/`, `src/editor/docSession.ts`, `restoreCommand.ts`…), si aggiunge prima un test unitario che fallisce;
- un componente React che deve sopravvivere al doppio montaggio crea e distrugge le sue risorse nello stesso effetto, senza stato condiviso tra i due montaggi;
- se la correzione cambia il comportamento in produzione, o tocca `workspace/` o la coda `runExclusive`, **fermarsi e riferire**.

- [ ] **Step 4: Verifica**

```bash
npx playwright test -c e2e/dev.config.ts ai-review.spec.ts -g "Ctrl\+Z undoes" --repeat-each=3   # 3 passed
npm test
npm run lint
npm run test:e2e        # 98 passed, nessun PNG modificato
npm run test:e2e:dev    # 83 passed
```

- [ ] **Step 5: Commit**

Messaggio: `fix: <cosa> (Ctrl+Z dopo "Accetta tutto" con StrictMode)`, con nel corpo la causa in una o due righe. Esempio di forma: `fix: il focus segue l'editor ricreato da StrictMode, Ctrl+Z dopo "Accetta tutto" torna a funzionare`.

---

### Task 4: e2e sui punti che React 19 cambia

**Files:**
- Modify: `e2e/settings.spec.ts`, `e2e/ai-review.spec.ts`, `e2e/theme-i18n.spec.ts`

**Interfaces:**
- Consumes: fixture e helper esistenti (`app.treeFile`, `app.openFolder`, `app.openFile`, `app.mode`, `app.t`). In `settings.spec.ts` il `beforeEach` apre già la cartella con `a.md` e apre il file.

Tutti e tre i test passano già con React 18 (verificato il 04/10): servono a garantire che non smettano di passare con React 19.

- [ ] **Step 1: Workspace inerte a impostazioni aperte**

In fondo a `e2e/settings.spec.ts`:

```ts
// React 19 tratta `inert` come booleano: la stringa vuota di React 18 diventerebbe "non inerte".
test('with the settings open the workspace behind is inert: its controls cannot take the focus', async ({ app, page }) => {
  const file = app.treeFile('a.md');
  const takesFocus = () => file.evaluate((el: HTMLElement) => (el.focus(), document.activeElement === el));
  expect(await takesFocus()).toBe(true);
  await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await expect(page.getByRole('region', { name: app.t('settings.title') })).toBeVisible();
  expect(await takesFocus()).toBe(false);
});
```

Nota: i localizzatori per ruolo di Playwright trovano ancora gli elementi `inert`, quindi il test verifica il comportamento (il focus), non la presenza nell'albero.

- [ ] **Step 2: Popover del chip del profilo**

In fondo a `e2e/ai-review.spec.ts`, fuori dai `describe`:

```ts
// React 19 vuole `popoverTarget`: il chip del profilo deve continuare ad aprire il suo popover.
test('the profile chip opens its popover with the profile choice', async ({ app, page }) => {
  await app.openFolder({ 'a.md': 'A' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
  await app.mode('mode.ai').click();
  const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
  const current = page.getByRole('radio', { checked: true });
  await expect(current).toBeHidden();
  await chip.click();
  await expect(current).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(current).toBeHidden();
});
```

- [ ] **Step 3: Ciclo del tema con le animazioni attive**

In fondo a `e2e/theme-i18n.spec.ts`:

```ts
// Con le animazioni attive il cambio passa dalla view transition (src/theme/pixelTransition.ts), dove
// React deve aggiornare il pulsante in modo sincrono (flushSync): il resto della suite usa reducedMotion.
test.describe('with animations on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the theme cycle runs through the view transition and updates the button each time', async ({ app, page }) => {
    await app.openFolder({ 'note.md': '# Note' });
    const html = page.locator('html');
    await page.getByRole('button', { name: app.t('theme.auto') }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: app.t('theme.light') }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: app.t('theme.dark') }).click();
    await expect(html).toHaveAttribute('data-theme', 'auto');
    await expect(page.getByRole('button', { name: app.t('theme.auto') })).toBeVisible();
  });
});
```

- [ ] **Step 4: Verde con React 18, e sensibilità**

```bash
npx playwright test -c e2e/playwright.config.ts settings.spec.ts ai-review.spec.ts theme-i18n.spec.ts -g "inert|profile chip|animations on"   # 3 passed
npx playwright test -c e2e/dev.config.ts settings.spec.ts ai-review.spec.ts theme-i18n.spec.ts -g "inert|profile chip|animations on"        # 3 passed
```

Prove di sensibilità (ripristinare con `git checkout` dopo ciascuna):
- in `src/ui/WorkspaceView.tsx:344` sostituire `settingsOpen ? '' : undefined` con `undefined`: il test `inert` deve FALLIRE (`Expected: false, Received: true`);
- in `src/ui/ai/ModelChip.tsx:74` togliere `{...{ popovertarget: id }}`: il test del chip deve FALLIRE su `toBeVisible`.

- [ ] **Step 5: Suite complete e commit**

```bash
npm run test:e2e        # 101 passed, nessun PNG modificato
npm run test:e2e:dev    # 86 passed
git add e2e/settings.spec.ts e2e/ai-review.spec.ts e2e/theme-i18n.spec.ts
git commit -m "test: e2e su workspace inerte, popover del chip del profilo e ciclo del tema con le animazioni"
```

---

### Task 5: React 19

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/ui/WorkspaceView.tsx:344`, `src/ui/ai/ModelChip.tsx:74`, `src/ui/ai/ReviewBar.tsx:81`, `src/editor/docExtensions.ts:11,18`

**Interfaces:**
- Consumes: `npm run test:e2e:dev` (Task 2) e i tre e2e del Task 4.

- [ ] **Step 1: Dipendenze**

```bash
npm install react@^19.3.0 react-dom@^19.3.0
npm install -D @types/react@^19.3.0 @types/react-dom@^19.3.0
npm ls react react-dom @types/react @types/react-dom      # tutte 19.3.0, nessun duplicato
```

- [ ] **Step 2: Il typecheck fallisce dove previsto**

Run: `npm run lint`
Expected: FAIL con un solo errore, `src/ui/WorkspaceView.tsx(343,6): … Types of property 'inert' are incompatible. Type 'string | undefined' is not assignable to type 'boolean | undefined'.` Altri errori: fermarsi e riferire.

- [ ] **Step 3: `inert` booleano**

In `src/ui/WorkspaceView.tsx`, la riga

```tsx
      {...{ inert: settingsOpen ? '' : undefined }}
```

diventa

```tsx
      inert={settingsOpen}
```

- [ ] **Step 4: `popoverTarget`**

In `src/ui/ai/ModelChip.tsx` e in `src/ui/ai/ReviewBar.tsx`, la riga

```tsx
        {...{ popovertarget: id }}
```

diventa (con l'indentazione del punto in cui si trova)

```tsx
        popoverTarget={id}
```

- [ ] **Step 5: `RefObject` al posto di `MutableRefObject`**

In `src/editor/docExtensions.ts`:

```ts
import type { RefObject } from 'react';
```

e

```ts
export type Callbacks = RefObject<EditorProps & { t: Translate }>;
```

(In React 19 `RefObject.current` è scrivibile e `useRef(valore)` restituisce `RefObject`: `Editor.tsx` passa `callbacks` senza cambiamenti.)

- [ ] **Step 6: Verifica completa**

```bash
npm run lint                                  # pulito
npm test                                      # 602 pass (o di più, se il Task 3 ha aggiunto test)
npm run build
gzip -c dist/assets/index-*.js | wc -c        # atteso circa 432 000 (04/10: 432396); annotare
npm run test:e2e                              # 101 passed, nessun PNG modificato
npm run test:e2e:dev                          # 86 passed, nessun errore in console
git status --short                            # solo i file di questo task
```

Se `test:e2e:dev` fallisce per un avviso di React in console, è un punto che React 19 cambia e il piano non ha previsto: correggerlo come i tre sopra (prop con il nome che React 19 si aspetta), con lo stesso commit, e scriverlo nel report. Un cambio di comportamento o uno snapshot diverso: fermarsi e riferire.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/ui/WorkspaceView.tsx src/ui/ai/ModelChip.tsx src/ui/ai/ReviewBar.tsx src/editor/docExtensions.ts
git commit -m "chore: React 19 (inert booleano, popoverTarget, RefObject al posto di MutableRefObject)"
```

---

### Task 6: Documentazione, verifica finale, chiusura

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Spec**

1. Intestazione: `**Revisione: 2026-10-04**`; nella riga "Stato", le fasi implementate diventano 0–3 (fase 3 sul branch `refactor/fase-3-react-19`).
2. §1.2, primo punto: "Aggiornate nella fase 3: `react`/`react-dom` 18 → 19.3, con `@types/react*` 19.3 (fatto)."
3. §7 fase 3, in fondo: "3. **Fatta** (piano 4). Cambi reali: `inert` booleano (con la stringa vuota il workspace dietro le impostazioni non sarebbe più stato inerte), `popoverTarget`, `RefObject` al posto di `MutableRefObject`. Ref callback, `useRef` senza argomento e namespace `JSX` non toccavano il codice. Rete aggiunta: `npm run test:e2e:dev` (§8.4) e tre e2e (workspace inerte, popover del chip del profilo, tema con le animazioni). Riparato un difetto che si vedeva solo con StrictMode: <una riga con la causa trovata al Task 3>. Bundle principale gzip: 410 158 → <numero del Task 5> B."
4. §8.4, paragrafo **Esecuzione**, in fondo: "**Suite in sviluppo** (`npm run test:e2e:dev`, `e2e/dev.config.ts`): le stesse spec contro `vite` in sviluppo (porta 5174), con StrictMode attivo; ogni errore o avviso in console fa fallire il test (`failOnConsole`). Restano fuori gli snapshot e il test che trattiene `assets/index-*.js`."
5. §10, R18, mitigazione: aggiungere "suite e2e in sviluppo con la console come cancello (fase 3)".
6. §13, punto 2: aggiungere "`docs/superpowers/plans/2026-10-04-housemd-wc-04-fase-3-react-19.md` (fase 3)"; la fase 3 non è più "da scrivere".

- [ ] **Step 2: README e CLAUDE.md**

In `README.md`, dopo la riga di `npm run test:e2e:audit`:

```
npm run test:e2e:dev   # e2e contro vite in sviluppo (StrictMode), console senza errori né avvisi
```

In `CLAUDE.md`, nella riga sui test end-to-end, dopo "Gli snapshot visivi si rigenerano solo con approvazione.":

```
 La suite in sviluppo (`npm run test:e2e:dev`) non ammette errori o avvisi in console.
```

- [ ] **Step 3: Verifica finale**

```bash
npm test
npm run lint
npm run build
npm run test:e2e -- --repeat-each=2     # 202 passed
npm run test:e2e:dev                    # 86 passed
git status --short                      # vuoto dopo il commit
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md README.md CLAUDE.md
git commit -m "docs: spec, README e CLAUDE.md allineati alla fase 3 (React 19, suite in sviluppo)"
```

- [ ] **Step 5: Chiusura (solo con il via di Davide)**

Chiedere a Davide: merge locale in `main` (come per la fase 2) o push e PR. Con il via, per la PR:

```bash
git push -u origin refactor/fase-3-react-19
gh pr create --base main --title "Fase 3 Web Components: React 19" --body "<cosa cambia, verifica con i numeri dei Task 5–6, causa del difetto del Task 3>"
```
