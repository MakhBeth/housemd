# HouseMD Web Components — Piano 2: fase 1, logica pura, ts-pattern, zod, store

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Togliere dai componenti React la logica che i futuri custom element dovranno riusare, renderla pura e testata (con `ts-pattern` dove c'è una scelta tra casi), validare con `zod` i dati letti da storage e file system, e portare lingua, tema e rotta in store indipendenti da React. Comportamento visibile invariato.

**Architecture:** Ogni estrazione segue lo stesso schema: modulo puro nuovo sotto `src/elements/<area>/` o `src/state/` con il suo `*.test.ts` scritto prima, poi il componente React lo importa al posto del codice inline. Gli store (`i18nStore`, `themeStore`, `routeStore`) espongono `getState`/`subscribe`; `I18nProvider`, `useTheme` e `useRoute` diventano adattatori con `useSyncExternalStore`. La suite e2e della fase 0 è il cancello: deve restare verde con gli stessi snapshot.

**Tech Stack:** TypeScript 7, React 18, `ts-pattern` 5.9.0, `zod` 4.6.5 (`zod/mini`), `tsx --test`, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§5.3, §6, §7 fase 1, §8.2). Il Task 17 aggiorna lo spec dove questo piano lo restringe (vedi "Scostamenti dallo spec").

## Global Constraints

- **Comportamento visibile invariato.** `npm run test:e2e` resta verde **con gli snapshot di oggi**: nessuno si rigenera in questa fase. Se uno snapshot cambia, è un bug dell'estrazione.
- I test esistenti non cambiano le asserzioni. Si aggiungono solo test nuovi.
- Ogni modulo nuovo nasce **test prima**: il test si scrive, si esegue e deve fallire (modulo inesistente o asserzione), poi si scrive il modulo.
- `zod` solo da `zod/mini` (`import * as z from 'zod/mini'`), solo nei punti elencati nei Task 10–12. Mai su stato interno, props, eventi, traduzioni.
- `ts-pattern`: sempre `.exhaustive()`.
- Nessuna dipendenza nuova oltre a `ts-pattern@5.9.0` e `zod@4.6.5`, installate con `--save-exact`.
- Le regole di `CLAUDE.md` valgono tutte: niente testi UI fuori da `t()`, commenti e commit in italiano, identificatori in inglese, File System Access solo in `fsaOps.ts`/`access.ts`, niente `await` della cronologia nei percorsi che cambiano il documento, `workspace/` non si tocca salvo `buffers.ts`.
- Branch `refactor/fase-1-logica-pura` creato da `main` in un worktree. Alla fine **una PR verso `main`**; push e merge solo con il via esplicito di Davide.
- Commit in italiano con prefisso convenzionale (`refactor:`, `feat:`, `test:`, `chore:`, `docs:`), senza righe di attribuzione.
- **Mai giudicare un comando di verifica dal suo output filtrato**: niente `| grep`/`| tail` sui comandi di test, che restituirebbero l'exit code del filtro. Si guarda l'exit code del comando stesso (o si usa `set -o pipefail`).
- Comandi di verifica per ogni task: `npm test` (tutto verde), `npm run lint`. I task che toccano componenti aggiungono `npm run test:e2e` (in questo ambiente: worker a 2, profilo su disco, ~50 s).

## Scostamenti dallo spec (decisi scrivendo il piano, da riportare nello spec al Task 17)

1. **Nei provider AI zod controlla solo i campi oggi non controllati** (Task 13): token di usage, voci degli elenchi modelli, testo dei delta di Anthropic. I campi già controllati a mano (testo OpenAI, risposta del bridge, segnale di fine) restano come sono, e gli errori visibili non cambiano: una voce malformata si scarta, un token non numerico diventa `undefined`, un testo non stringa diventa `badStream` come già fa OpenAI.
2. **zod non entra negli store AI in IndexedDB** (`ai/idbStores.ts`): ogni scrittura svuota e riscrive l'intero store (`clear()` + `put()`), quindi scartare in lettura un record non valido lo **cancellerebbe** al salvataggio successivo. Serve prima una decisione su cosa fare dei record illeggibili (quarantena?). Rimandato.
3. **`housemd-sync.json` resta con `ai/sync/schema.ts`**: è già validato a mano in modo completo (URL senza credenziali, enum, interi positivi) e coperto da `sync.test.ts`; riscriverlo in zod non aggiunge garanzie.
4. **`parseTheme`, `parseLocale`, `parseTextWidth`, `parseAutosave` restano come sono**: validano già. zod copre le preferenze che oggi passano senza controllo (`mode`, `sidebarOpen`, `sidebarWidth`, `aiSidebarWidth`, `aiProfile`, `lastFile:<id>`).

## Review Focus

1. **Preferenze corrotte in `localStorage`** (`"mode": 42`, `"sidebarWidth": "abc"`, JSON rotto): l'app parte con i default invece di una griglia rotta (Task 10, `prefs.schema.test.ts`).
2. **Record IndexedDB corrotti** (buffer di emergenza, cartella salvata, cronologia): nessuna eccezione, il record vale come assente (Tasks 11–12).
3. **Cambi di lingua rapidi con chunk che arrivano fuori ordine**: vince l'ultima richiesta (Task 14, `i18nStore.test.ts`).
4. **Indietro del browser con modifiche aperte nelle impostazioni**: la guardia del `routeStore` rimette la voce e chiede conferma, come `useRoute` oggi (Task 16, test dedicato + e2e `settings.spec.ts`).
5. **StrictMode**: gli store con listener globali (`hashchange`, `prefers-color-scheme`) li registrano al primo iscritto e li tolgono all'ultimo, così il doppio montaggio di sviluppo non li perde né li duplica (Tasks 15–16, test "listener solo con iscritti").

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `src/elements/search-panel/segments.ts` (+ test) | Testo → segmenti evidenziati/non evidenziati per i risultati della ricerca. |
| `src/elements/preview/cardDate.ts` (+ test) | Data `YYYY-MM-DD` del frontmatter → testo nella lingua dell'interfaccia. |
| `src/elements/file-tree/treeState.ts` (+ test) | Cartelle aperte dell'albero: apri/chiudi, rivela il percorso del file aperto. |
| `src/elements/workspace/layout.ts` (+ test) | Modalità di vista, larghezze e limiti dei pannelli laterali, colonne della griglia. |
| `src/elements/workspace/saveIndicator.ts` (+ test) | Stato di salvataggio → etichetta, `role`, `aria-live`, icona. |
| `src/elements/workspace/dialogFor.ts` (+ test) | Azione dell'albero → dialog da aprire o cronologia. |
| `src/elements/workspace/keymap.ts` (+ test) | Scorciatoie ammesse con le impostazioni aperte. |
| `src/elements/app/screens.ts` (+ test) | Schermate dell'app ed esito di un cambio cartella. |
| `src/state/draftState.ts` (+ test) | Bozza delle sezioni profili/preset (era `useDraft`). |
| `src/state/prefs.schema.ts` (+ test) | Schemi zod delle preferenze non validate oggi. |
| `src/state/i18nStore.ts`, `themeStore.ts`, `routeStore.ts` (+ test) | Store di lingua, tema, rotta. |
| `src/testing/memoryStorage.ts` | `localStorage` finto per i test in Node. |
| `src/ai/providers/shapes.ts` (+ test) | Campi delle risposte dei modelli non controllati oggi (usage, elenchi modelli, delta di Anthropic). |
| `src/lib/prefs.ts`, `src/config/config.ts`, `src/workspace/buffers.ts`, `src/fs/handleStore.ts`, `src/history/historyStore.ts` | zod ai confini. |
| `src/ui/SearchPanel.tsx`, `src/preview/FrontmatterCard.tsx`, `src/ui/FileTree.tsx`, `src/ui/WorkspaceView.tsx`, `src/App.tsx`, `src/ui/ai/settings/ItemList.tsx`, `src/ui/ai/useAiController.ts`, `src/i18n/I18nProvider.tsx`, `src/theme/useTheme.ts`, `src/ui/useRoute.ts` | Importano i moduli puri; diventano adattatori. |

---

### Task 1: Branch, dipendenze, baseline

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Worktree e branch**

```bash
git switch main && git pull --ff-only
git worktree add ../housemd-fase1 -b refactor/fase-1-logica-pura main
cd ../housemd-fase1 && npm ci
```

- [ ] **Step 2: Baseline**

```bash
npm test                                               # annotare il riepilogo (al 01/10: 507 pass)
npm run lint && npm run build
gzip -c dist/assets/index-*.js | wc -c                 # annotare: bundle principale gzip prima di zod
npm run test:e2e                                       # annotare: al 01/10, 98 passed
```

Expected: tutto verde. Altrimenti fermarsi e riferire.

- [ ] **Step 3: Dipendenze**

```bash
npm i --save-exact ts-pattern@5.9.0 zod@4.6.5
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: ts-pattern e zod per la fase 1 della migrazione"
```

---

### Task 2: Segmenti evidenziati della ricerca

**Files:**
- Create: `src/elements/search-panel/segments.ts`, `src/elements/search-panel/segments.test.ts`
- Modify: `src/ui/SearchPanel.tsx:16-26`

**Interfaces:**
- Produces: `interface Segment { text: string; mark: boolean }`, `segments(text: string, terms: string[]): Segment[]`.

- [ ] **Step 1: Test**

`src/elements/search-panel/segments.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { segments } from './segments';

test('marks the matched term and keeps the text around it', () => {
  assert.deepEqual(segments('The quick fox', ['fox']), [
    { text: 'The quick ', mark: false },
    { text: 'fox', mark: true },
  ]);
});

test('matches ignore case and accents, like the search index', () => {
  assert.deepEqual(segments('Città e città', ['citta']), [
    { text: 'Città', mark: true },
    { text: ' e ', mark: false },
    { text: 'città', mark: true },
  ]);
});

test('adjacent matches merge into one marked segment (findMatches)', () => {
  assert.deepEqual(segments('foxfox!', ['fox']), [
    { text: 'foxfox', mark: true },
    { text: '!', mark: false },
  ]);
});

test('no terms or no match: one plain segment; empty text: one empty segment', () => {
  assert.deepEqual(segments('abc', []), [{ text: 'abc', mark: false }]);
  assert.deepEqual(segments('abc', ['zzz']), [{ text: 'abc', mark: false }]);
  assert.deepEqual(segments('', ['a']), [{ text: '', mark: false }]);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/search-panel/segments.test.ts`
Expected: FAIL, `Cannot find module './segments'`.

- [ ] **Step 3: Modulo**

`src/elements/search-panel/segments.ts`:

```ts
import { findMatches } from '../../search/fold';

/** Pezzo di testo di un risultato di ricerca: evidenziato (`<mark>`) o no. */
export interface Segment {
  text: string;
  mark: boolean;
}

/** Divide `text` attorno ai termini cercati, con la stessa piegatura (maiuscole, accenti) dell'indice. */
export function segments(text: string, terms: string[]): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const [start, end] of findMatches(text, terms)) {
    if (start > last) out.push({ text: text.slice(last, start), mark: false });
    out.push({ text: text.slice(start, end), mark: true });
    last = end;
  }
  if (last < text.length || out.length === 0) out.push({ text: text.slice(last), mark: false });
  return out;
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/search-panel/segments.test.ts`
Expected: 4 pass.

- [ ] **Step 5: SearchPanel usa il modulo**

In `src/ui/SearchPanel.tsx` sostituire la funzione `Highlighted` (righe 16-26) con:

```tsx
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return <>{segments(text, terms).map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : part.text))}</>;
}
```

Negli import: togliere `findMatches` e `type ReactNode` (non più usati), aggiungere `import { segments } from '../elements/search-panel/segments';`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts search.spec.ts
git add src/elements/search-panel src/ui/SearchPanel.tsx
git commit -m "refactor: segmenti evidenziati della ricerca in un modulo puro"
```

Expected: baseline + 4, lint pulito, `3 passed`.

---

### Task 3: Data della scheda del frontmatter

**Files:**
- Create: `src/elements/preview/cardDate.ts`, `src/elements/preview/cardDate.test.ts`
- Modify: `src/preview/FrontmatterCard.tsx:15-21`

**Interfaces:**
- Produces: `formatCardDate(value: string, locale: Locale): string`.

- [ ] **Step 1: Test**

`src/elements/preview/cardDate.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatCardDate } from './cardDate';

test('an ISO day is written out in the interface language', () => {
  assert.equal(formatCardDate('2026-01-15', 'en'), 'January 15, 2026');
  assert.equal(formatCardDate('2026-01-15', 'it'), '15 gennaio 2026');
});

test('anything that is not YYYY-MM-DD is shown as written', () => {
  assert.equal(formatCardDate('next week', 'en'), 'next week');
  assert.equal(formatCardDate('2026-1-5', 'en'), '2026-1-5');
});

test('an impossible month stays as written; an overflowing day rolls over (Date semantics, as today)', () => {
  assert.equal(formatCardDate('2026-13-45', 'en'), '2026-13-45');
  assert.equal(formatCardDate('2026-02-30', 'en'), 'March 2, 2026');
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/preview/cardDate.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/elements/preview/cardDate.ts`:

```ts
import type { Locale } from '../../i18n/i18n';

/** `date:` del frontmatter: un giorno ISO diventa testo nella lingua dell'interfaccia, il resto resta com'è. */
export function formatCardDate(value: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/preview/cardDate.test.ts`
Expected: 3 pass.

- [ ] **Step 5: FrontmatterCard usa il modulo**

In `src/preview/FrontmatterCard.tsx` cancellare la funzione `formatCardDate` (righe 15-21) e l'import `type Locale`; aggiungere `import { formatCardDate } from '../elements/preview/cardDate';`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts preview.spec.ts visual.spec.ts
git add src/elements/preview src/preview/FrontmatterCard.tsx
git commit -m "refactor: data della scheda del frontmatter in un modulo puro"
```

---

### Task 4: Cartelle aperte dell'albero

**Files:**
- Create: `src/elements/file-tree/treeState.ts`, `src/elements/file-tree/treeState.test.ts`
- Modify: `src/ui/FileTree.tsx:27, 50-62, 88-89`

**Interfaces:**
- Produces: `type Expanded = ReadonlySet<string>`, `toggleExpanded(expanded, path, open): Expanded`, `revealPath(expanded, path): Expanded`. Entrambe restituiscono **lo stesso oggetto** se non cambia nulla (React allora non ridisegna).

- [ ] **Step 1: Test**

`src/elements/file-tree/treeState.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { revealPath, toggleExpanded } from './treeState';

test('toggle opens and closes a folder', () => {
  const open = toggleExpanded(new Set(), 'docs', true);
  assert.deepEqual([...open], ['docs']);
  assert.deepEqual([...toggleExpanded(open, 'docs', false)], []);
});

test('toggle to the current state returns the same object', () => {
  const expanded = new Set(['docs']);
  assert.equal(toggleExpanded(expanded, 'docs', true), expanded);
  assert.equal(toggleExpanded(expanded, 'other', false), expanded);
});

test('revealPath opens every ancestor and closes nothing', () => {
  const next = revealPath(new Set(['notes']), 'a/b/c.md');
  assert.deepEqual([...next].sort(), ['a', 'a/b', 'notes']);
});

test('revealPath with ancestors already open (or a root file) returns the same object', () => {
  const expanded = new Set(['a', 'a/b']);
  assert.equal(revealPath(expanded, 'a/b/c.md'), expanded);
  assert.equal(revealPath(expanded, 'root.md'), expanded);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/file-tree/treeState.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/elements/file-tree/treeState.ts`:

```ts
import { ancestorsOf } from '../../ui/tree';

/** Percorsi delle cartelle aperte nell'albero dei file. */
export type Expanded = ReadonlySet<string>;

/** Apre o chiude una cartella. Stesso oggetto se è già così: chi disegna non deve ridisegnare. */
export function toggleExpanded(expanded: Expanded, path: string, open: boolean): Expanded {
  if (expanded.has(path) === open) return expanded;
  const next = new Set(expanded);
  if (open) next.add(path);
  else next.delete(path);
  return next;
}

/** Apre le cartelle che contengono `path` (il file aperto), senza chiudere le altre. */
export function revealPath(expanded: Expanded, path: string): Expanded {
  const missing = ancestorsOf(path).filter((dir) => !expanded.has(dir));
  return missing.length === 0 ? expanded : new Set([...expanded, ...missing]);
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/file-tree/treeState.test.ts`
Expected: 4 pass.

- [ ] **Step 5: FileTree usa il modulo**

In `src/ui/FileTree.tsx`:

- riga 27: `const [expanded, setExpanded] = useState<Expanded>(() => new Set());`
- l'effetto delle righe 50-53 diventa:

```tsx
  useEffect(() => {
    if (!openPath) return;
    setExpanded((prev) => revealPath(prev, openPath));
  }, [openPath]);
```

- la funzione `toggle` (righe 55-62) diventa:

```tsx
  const toggle = (path: string, open: boolean) => setExpanded((prev) => toggleExpanded(prev, path, open));
```

- import: togliere `ancestorsOf` da `./tree` (resta `type TreeNode`), aggiungere `import { revealPath, toggleExpanded, type Expanded } from '../elements/file-tree/treeState';`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts tree.spec.ts
git add src/elements/file-tree src/ui/FileTree.tsx
git commit -m "refactor: cartelle aperte dell'albero in un modulo puro"
```

---

### Task 5: Modalità e pannelli del workspace

**Files:**
- Create: `src/elements/workspace/layout.ts`, `src/elements/workspace/layout.test.ts`
- Modify: `src/ui/WorkspaceView.tsx` (righe 40-50, 59-61, 85, 98, 311, 319-346, 376, 433-435, 503)

**Interfaces:**
- Produces: `type Mode`, `type PaneMode`, `MODES`, `PANE_MODES`, `type SidePanel = 'sidebar' | 'ai'`, `WIDTH_LIMITS: Record<SidePanel, { min; max; initial }>`, `RESIZE_STEP = 16`, `sidePanel(mode): SidePanel`, `clampWidth(panel, width): number`, `resizeByKey(panel, width, key): number | null`, `nextPaneMode(mode): PaneMode`, `gridColumns(sidebarOpen, width): string`, `panesMode(mode, historyOpen): Mode`.
- Consumed by: Task 10 (`Mode`, `WIDTH_LIMITS` nei default delle preferenze).

- [ ] **Step 1: Test**

`src/elements/workspace/layout.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { clampWidth, gridColumns, MODES, nextPaneMode, PANE_MODES, panesMode, resizeByKey, sidePanel, WIDTH_LIMITS } from './layout';

test('four modes; Ctrl+\\ cycles only the three document views', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['editor', 'split', 'preview', 'ai']);
  assert.deepEqual(PANE_MODES.map((m) => m.id), ['editor', 'split', 'preview']);
  assert.equal(nextPaneMode('editor'), 'split');
  assert.equal(nextPaneMode('split'), 'preview');
  assert.equal(nextPaneMode('preview'), 'editor');
  assert.equal(nextPaneMode('ai'), 'editor');
});

test('the side panel is the AI chat in AI mode, the file sidebar otherwise', () => {
  assert.equal(sidePanel('ai'), 'ai');
  for (const mode of ['editor', 'split', 'preview'] as const) assert.equal(sidePanel(mode), 'sidebar');
});

test('widths are clamped to the limits of their panel; only the file sidebar is rounded (as today)', () => {
  assert.deepEqual(WIDTH_LIMITS.sidebar, { min: 180, max: 480, initial: 280 });
  assert.deepEqual(WIDTH_LIMITS.ai, { min: 300, max: 640, initial: 380 });
  assert.equal(clampWidth('sidebar', 100), 180);
  assert.equal(clampWidth('sidebar', 900), 480);
  assert.equal(clampWidth('sidebar', 300.6), 301);
  assert.equal(clampWidth('ai', 200), 300);
  assert.equal(clampWidth('ai', 700), 640);
  assert.equal(clampWidth('ai', 400.4), 400.4);
});

test('arrow keys resize by 16px within the limits; other keys do nothing', () => {
  assert.equal(resizeByKey('sidebar', 280, 'ArrowRight'), 296);
  assert.equal(resizeByKey('sidebar', 280, 'ArrowLeft'), 264);
  assert.equal(resizeByKey('sidebar', 475, 'ArrowRight'), 480);
  assert.equal(resizeByKey('ai', 305, 'ArrowLeft'), 300);
  assert.equal(resizeByKey('sidebar', 280, 'Enter'), null);
});

test('grid columns: side panel, 5px resizer and the main area; only the main area when closed', () => {
  assert.equal(gridColumns(true, 280), '280px 5px minmax(0, 1fr)');
  assert.equal(gridColumns(false, 280), 'minmax(0, 1fr)');
});

test('with the history open, Editor mode shows two panes like Split', () => {
  assert.equal(panesMode('editor', true), 'split');
  assert.equal(panesMode('editor', false), 'editor');
  assert.equal(panesMode('preview', true), 'preview');
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/workspace/layout.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/elements/workspace/layout.ts`:

```ts
import type { MessageKey } from '../../i18n/messages';
import type { IconName } from '../../ui/icons';

/** Vista del workspace: tre viste del documento più la revisione AI. */
export type Mode = 'editor' | 'split' | 'preview' | 'ai';
export type PaneMode = Exclude<Mode, 'ai'>;

export const MODES: ReadonlyArray<{ id: Mode; label: MessageKey; icon: IconName }> = [
  { id: 'editor', label: 'mode.editor', icon: 'modeEditor' },
  { id: 'split', label: 'mode.split', icon: 'modeSplit' },
  { id: 'preview', label: 'mode.preview', icon: 'modePreview' },
  { id: 'ai', label: 'mode.ai', icon: 'modeAi' },
];

/** Ctrl+\ scorre solo le viste del documento, non la revisione AI. */
export const PANE_MODES = MODES.filter((m): m is (typeof MODES)[number] & { id: PaneMode } => m.id !== 'ai');

/** Pannello a sinistra: l'albero dei file o, in modalità AI, la chat. Hanno larghezze separate. */
export type SidePanel = 'sidebar' | 'ai';

export const WIDTH_LIMITS: Record<SidePanel, { min: number; max: number; initial: number }> = {
  sidebar: { min: 180, max: 480, initial: 280 },
  ai: { min: 300, max: 640, initial: 380 },
};

/** Passo del ridimensionamento con le frecce sul separatore. */
export const RESIZE_STEP = 16;

export function sidePanel(mode: Mode): SidePanel {
  return mode === 'ai' ? 'ai' : 'sidebar';
}

/** Larghezza nei limiti del pannello. Come oggi, solo quella dell'albero dei file si arrotonda al pixel. */
export function clampWidth(panel: SidePanel, width: number): number {
  const { min, max } = WIDTH_LIMITS[panel];
  return Math.min(max, Math.max(min, panel === 'sidebar' ? Math.round(width) : width));
}

/** Nuova larghezza dopo una freccia sinistra/destra, oppure null per gli altri tasti. */
export function resizeByKey(panel: SidePanel, width: number, key: string): number | null {
  if (key === 'ArrowLeft') return clampWidth(panel, width - RESIZE_STEP);
  if (key === 'ArrowRight') return clampWidth(panel, width + RESIZE_STEP);
  return null;
}

/** Vista successiva nel ciclo di Ctrl+\ (dalla modalità AI si riparte dall'editor). */
export function nextPaneMode(mode: Mode): PaneMode {
  const index = PANE_MODES.findIndex((m) => m.id === mode);
  return PANE_MODES[(index + 1) % PANE_MODES.length].id;
}

/** `grid-template-columns` del layout: pannello, separatore di 5px, area principale. */
export function gridColumns(sidebarOpen: boolean, width: number): string {
  return sidebarOpen ? `${width}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)';
}

/** Disposizione dei pannelli: con la cronologia aperta la vista editor ne mostra due, come split. */
export function panesMode(mode: Mode, historyOpen: boolean): Mode {
  return historyOpen && mode === 'editor' ? 'split' : mode;
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/workspace/layout.test.ts`
Expected: 6 pass.

- [ ] **Step 5: WorkspaceView usa il modulo**

In `src/ui/WorkspaceView.tsx`:

1. Cancellare `type Mode`, `type PaneMode`, `MODES`, `PANE_MODES` (righe 40-50) e `MIN_SIDEBAR`, `MAX_SIDEBAR`, `clampWidth` (righe 59-61). Aggiungere:

```ts
import {
  clampWidth, gridColumns, MODES, nextPaneMode, PANE_MODES, panesMode, resizeByKey, sidePanel, WIDTH_LIMITS,
  type Mode, type PaneMode,
} from '../elements/workspace/layout';
```

2. Stato iniziale delle larghezze (righe 85 e 98):

```ts
  const [aiWidth, setAiWidth] = useState(() => clampWidth('ai', readPref('aiSidebarWidth', WIDTH_LIMITS.ai.initial)));
  const [sidebarWidth, setSidebarWidth] = useState(() => clampWidth('sidebar', readPref('sidebarWidth', WIDTH_LIMITS.sidebar.initial)));
```

3. Nel `case 'cycleMode'` (riga 311): `changeMode(nextPaneMode(shownMode));`

4. `onResizeStart` e `onResizeKey` (righe 319-346) diventano:

```tsx
  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const panel = sidePanel(shownMode);
    let width = panel === 'ai' ? aiWidth : sidebarWidth;
    const move = (e: globalThis.PointerEvent) => {
      width = clampWidth(panel, e.clientX);
      if (panel === 'ai') setAiWidth(width);
      else setSidebarWidth(width);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      target.removeEventListener('lostpointercapture', up);
      writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', width);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('lostpointercapture', up);
  };

  const onResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const panel = sidePanel(shownMode);
    const next = resizeByKey(panel, panel === 'ai' ? aiWidth : sidebarWidth, event.key);
    if (next === null) return;
    event.preventDefault();
    if (panel === 'ai') setAiWidth(next);
    else setSidebarWidth(next);
    writePref(panel === 'ai' ? 'aiSidebarWidth' : 'sidebarWidth', next);
  };
```

5. Lo `style` del layout (riga 376): `style={{ gridTemplateColumns: gridColumns(sidebarOpen, shownMode === 'ai' ? aiWidth : sidebarWidth) }}`

6. Gli attributi del separatore (righe 433-435):

```tsx
            aria-valuenow={shownMode === 'ai' ? aiWidth : sidebarWidth}
            aria-valuemin={WIDTH_LIMITS[sidePanel(shownMode)].min}
            aria-valuemax={WIDTH_LIMITS[sidePanel(shownMode)].max}
```

7. `data-mode` dei pannelli (riga 503): `data-mode={panesMode(shownMode, historyOpen)}`

`PaneMode` resta usato da `lastPane`. Nessun altro riferimento a `MIN_SIDEBAR`/`MAX_SIDEBAR` deve restare: `grep -n "MIN_SIDEBAR\|MAX_SIDEBAR\|640\|300)" src/ui/WorkspaceView.tsx` non deve trovare larghezze scritte a mano.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e
git add src/elements/workspace/layout.ts src/elements/workspace/layout.test.ts src/ui/WorkspaceView.tsx
git commit -m "refactor: modalità e larghezze dei pannelli del workspace in un modulo puro"
```

Expected: tutto verde, snapshot invariati.

---

### Task 6: Indicatore di salvataggio

**Files:**
- Create: `src/elements/workspace/saveIndicator.ts`, `src/elements/workspace/saveIndicator.test.ts`
- Modify: `src/ui/WorkspaceView.tsx` (`SAVE_LABEL` righe 52-57, span righe 466-474)

**Interfaces:**
- Produces: `interface SaveIndicator { state: SaveState | 'none'; label: MessageKey | null; live: 'polite' | 'assertive'; role: 'alert' | undefined; draftIcon: boolean }`, `saveIndicator(doc: Pick<OpenDoc, 'saveState' | 'deletedOnDisk'> | null): SaveIndicator`.

- [ ] **Step 1: Test**

`src/elements/workspace/saveIndicator.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { saveIndicator } from './saveIndicator';

test('no open document: nothing to show', () => {
  assert.deepEqual(saveIndicator(null), { state: 'none', label: null, live: 'polite', role: undefined, draftIcon: false });
});

test('each save state has its label; only "dirty" shows the draft icon', () => {
  const at = (saveState: 'saved' | 'dirty' | 'saving' | 'error') => saveIndicator({ saveState, deletedOnDisk: false });
  assert.equal(at('saved').label, 'save.saved');
  assert.equal(at('dirty').label, 'save.dirty');
  assert.equal(at('saving').label, 'save.saving');
  assert.equal(at('error').label, 'save.error');
  assert.equal(at('dirty').draftIcon, true);
  assert.equal(at('saved').draftIcon, false);
});

test('a save error is announced right away (role alert, assertive)', () => {
  const error = saveIndicator({ saveState: 'error', deletedOnDisk: false });
  assert.equal(error.role, 'alert');
  assert.equal(error.live, 'assertive');
  const saved = saveIndicator({ saveState: 'saved', deletedOnDisk: false });
  assert.equal(saved.role, undefined);
  assert.equal(saved.live, 'polite');
});

test('a file deleted on disk says so, without the draft icon', () => {
  const deleted = saveIndicator({ saveState: 'dirty', deletedOnDisk: true });
  assert.equal(deleted.label, 'save.deleted');
  assert.equal(deleted.draftIcon, false);
  assert.equal(deleted.state, 'dirty');
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/workspace/saveIndicator.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/elements/workspace/saveIndicator.ts`:

```ts
import { match } from 'ts-pattern';

import type { MessageKey } from '../../i18n/messages';
import type { OpenDoc, SaveState } from '../../workspace/workspace';

/** Cosa mostra (e come annuncia) l'indicatore di salvataggio nella barra degli strumenti. */
export interface SaveIndicator {
  /** Valore di `data-state`, per il CSS. */
  state: SaveState | 'none';
  label: MessageKey | null;
  live: 'polite' | 'assertive';
  role: 'alert' | undefined;
  /** Pallino delle modifiche non salvate. */
  draftIcon: boolean;
}

export function saveIndicator(doc: Pick<OpenDoc, 'saveState' | 'deletedOnDisk'> | null): SaveIndicator {
  if (!doc) return { state: 'none', label: null, live: 'polite', role: undefined, draftIcon: false };
  const label: MessageKey = doc.deletedOnDisk
    ? 'save.deleted'
    : match(doc.saveState)
        .with('saved', () => 'save.saved' as const)
        .with('dirty', () => 'save.dirty' as const)
        .with('saving', () => 'save.saving' as const)
        .with('error', () => 'save.error' as const)
        .exhaustive();
  const error = doc.saveState === 'error';
  return {
    state: doc.saveState,
    label,
    live: error ? 'assertive' : 'polite',
    role: error ? 'alert' : undefined,
    draftIcon: doc.saveState === 'dirty' && !doc.deletedOnDisk,
  };
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/workspace/saveIndicator.test.ts`
Expected: 4 pass.

- [ ] **Step 5: WorkspaceView usa il modulo**

Cancellare `SAVE_LABEL` (righe 52-57) e l'import di `SaveState` se resta inutilizzato. Lo span (righe 466-474) diventa:

```tsx
            <span className={styles.saveState} data-state={indicator.state} aria-live={indicator.live} role={indicator.role}>
              {indicator.draftIcon && <Icon name="draft" size={10} />}
              {indicator.label ? t(indicator.label) : ''}
            </span>
```

con, subito prima del `return (` del componente: `const indicator = saveIndicator(doc);` e l'import `import { saveIndicator } from '../elements/workspace/saveIndicator';`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts editor.spec.ts external.spec.ts visual.spec.ts
git add src/elements/workspace/saveIndicator.ts src/elements/workspace/saveIndicator.test.ts src/ui/WorkspaceView.tsx
git commit -m "refactor: indicatore di salvataggio in un modulo puro con match esaustivo"
```

---

### Task 7: Azioni dell'albero e scorciatoie

**Files:**
- Create: `src/elements/workspace/dialogFor.ts`, `dialogFor.test.ts`, `src/elements/workspace/keymap.ts`, `keymap.test.ts`
- Modify: `src/ui/FileTree.tsx:10` (tipo `TreeAction`), `src/ui/WorkspaceView.tsx` (`DialogState` righe 63-66, `onTreeAction` righe 348-365, scorciatoie righe 287-313)

**Interfaces:**
- Produces: `type TreeAction`, `type DialogState`, `type TreeCommand = { kind: 'dialog'; dialog: NonNullable<DialogState> } | { kind: 'history'; path: string } | { kind: 'none' }`, `dialogFor(action: TreeAction, node: TreeNode | null): TreeCommand`; `allowedInSettings(shortcut: Shortcut): boolean`.

- [ ] **Step 1: Test**

`src/elements/workspace/dialogFor.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { TreeNode } from '../../ui/tree';
import { dialogFor } from './dialogFor';

const file: TreeNode = { name: 'b.md', path: 'docs/b.md', kind: 'file', children: [] };
const folder: TreeNode = { name: 'docs', path: 'docs', kind: 'directory', children: [] };

test('new file/folder: in the folder itself, next to a file, or at the root from the sidebar', () => {
  assert.deepEqual(dialogFor('new-file', folder), { kind: 'dialog', dialog: { kind: 'new-file', dir: 'docs' } });
  assert.deepEqual(dialogFor('new-folder', file), { kind: 'dialog', dialog: { kind: 'new-folder', dir: 'docs' } });
  assert.deepEqual(dialogFor('new-file', null), { kind: 'dialog', dialog: { kind: 'new-file', dir: '' } });
});

test('rename and delete need a node', () => {
  assert.deepEqual(dialogFor('rename', file), { kind: 'dialog', dialog: { kind: 'rename', node: file } });
  assert.deepEqual(dialogFor('delete', folder), { kind: 'dialog', dialog: { kind: 'delete', node: folder } });
  assert.deepEqual(dialogFor('rename', null), { kind: 'none' });
});

test('history opens the panel for that file, nothing without a node', () => {
  assert.deepEqual(dialogFor('history', file), { kind: 'history', path: 'docs/b.md' });
  assert.deepEqual(dialogFor('history', null), { kind: 'none' });
});
```

`src/elements/workspace/keymap.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { allowedInSettings } from './keymap';

test('with the settings open only the save shortcuts work (Ctrl+S must not open "Save page")', () => {
  assert.equal(allowedInSettings('save'), true);
  assert.equal(allowedInSettings('saveAll'), true);
  for (const s of ['search', 'toggleAi', 'toggleSidebar', 'cycleMode'] as const) assert.equal(allowedInSettings(s), false, s);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/workspace/dialogFor.test.ts src/elements/workspace/keymap.test.ts`
Expected: FAIL, moduli inesistenti.

- [ ] **Step 3: Moduli**

`src/elements/workspace/dialogFor.ts`:

```ts
import { match } from 'ts-pattern';

import { dirname } from '../../lib/paths';
import type { TreeNode } from '../../ui/tree';

/** Voci del menu dell'albero (e pulsanti della testata della sidebar). */
export type TreeAction = 'new-file' | 'new-folder' | 'rename' | 'delete' | 'history';

/** Dialog aperto dal workspace. */
export type DialogState =
  | { kind: 'new-file' | 'new-folder'; dir: string }
  | { kind: 'rename' | 'delete'; node: TreeNode }
  | null;

export type TreeCommand =
  | { kind: 'dialog'; dialog: NonNullable<DialogState> }
  | { kind: 'history'; path: string }
  | { kind: 'none' };

/** Cosa fare per un'azione dell'albero. `node` è null per i pulsanti della testata (radice). */
export function dialogFor(action: TreeAction, node: TreeNode | null): TreeCommand {
  return match(action)
    .returnType<TreeCommand>()
    .with('history', () => (node ? { kind: 'history', path: node.path } : { kind: 'none' }))
    .with('new-file', 'new-folder', (kind) => ({
      kind: 'dialog',
      dialog: { kind, dir: node ? (node.kind === 'directory' ? node.path : dirname(node.path)) : '' },
    }))
    .with('rename', 'delete', (kind) => (node ? { kind: 'dialog', dialog: { kind, node } } : { kind: 'none' }))
    .exhaustive();
}
```

`src/elements/workspace/keymap.ts`:

```ts
import { match } from 'ts-pattern';

import type { Shortcut } from '../../ui/shortcuts';

/** Scorciatoie attive con le impostazioni aperte: una scorciatoia nuova obbliga a decidere qui. */
export function allowedInSettings(shortcut: Shortcut): boolean {
  return match(shortcut)
    .with('save', 'saveAll', () => true)
    .with('search', 'toggleAi', 'toggleSidebar', 'cycleMode', () => false)
    .exhaustive();
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/workspace/dialogFor.test.ts src/elements/workspace/keymap.test.ts`
Expected: 4 pass.

- [ ] **Step 5: FileTree e WorkspaceView usano i moduli**

`src/ui/FileTree.tsx` riga 10: `export type { TreeAction } from '../elements/workspace/dialogFor';` più `import type { TreeAction } from '../elements/workspace/dialogFor';` per l'uso interno.

`src/ui/WorkspaceView.tsx`:

1. Cancellare `type DialogState` (righe 63-66); importare `import { dialogFor, type DialogState } from '../elements/workspace/dialogFor';`, `import { allowedInSettings } from '../elements/workspace/keymap';`, `import { match } from 'ts-pattern';`. `dirname` resta importato (lo usa il dialog di rinomina).

2. `onTreeAction` (righe 348-365) diventa:

```tsx
  const onTreeAction = (action: TreeAction, node: TreeNode | null) =>
    match(dialogFor(action, node))
      .with({ kind: 'history' }, ({ path }) => {
        // La cronologia si apre solo se il file richiesto è davvero quello aperto: l'apertura può
        // fallire o essere scavalcata da un'altra, e il pannello mostrerebbe il documento sbagliato.
        void openFile(path).then(() => {
          if (workspace.getState().doc?.path === path) setHistoryOpen(true);
        });
      })
      .with({ kind: 'dialog' }, ({ dialog }) => setDialog(dialog))
      .with({ kind: 'none' }, () => {})
      .exhaustive();
```

3. Nel gestore delle scorciatoie, la riga `if (settingsOpen && shortcut !== 'save' && shortcut !== 'saveAll') return;` diventa `if (settingsOpen && !allowedInSettings(shortcut)) return;` e lo `switch (shortcut) { … }` (righe 292-313) diventa:

```tsx
      match(shortcut)
        .with('save', () => void workspace.saveNow())
        .with('saveAll', () => void workspace.saveAll())
        .with('search', () => {
          if (shownMode === 'ai') changeMode(lastPane.current);
          setSidebar(true);
          requestAnimationFrame(() => searchRef.current?.focus());
        })
        .with('toggleAi', () => {
          if (ai) changeMode(shownMode === 'ai' ? lastPane.current : 'ai');
        })
        .with('toggleSidebar', () => setSidebar(!sidebarOpen))
        .with('cycleMode', () => changeMode(nextPaneMode(shownMode)))
        .exhaustive();
```

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e
git add src/elements/workspace/dialogFor.ts src/elements/workspace/dialogFor.test.ts src/elements/workspace/keymap.ts src/elements/workspace/keymap.test.ts src/ui/FileTree.tsx src/ui/WorkspaceView.tsx
git commit -m "refactor: azioni dell'albero e scorciatoie con match esaustivo"
```

---

### Task 8: Schermate dell'app

**Files:**
- Create: `src/elements/app/screens.ts`, `src/elements/app/screens.test.ts`
- Modify: `src/App.tsx` (tipo `Screen` righe 22-27, `switch (result.kind)` righe 124-137, `switch (screen.kind)` righe 148-173)

**Interfaces:**
- Produces: `type Screen<S, W>`, `type SwitchOutcome<S, W> = { kind: 'show'; screen: Screen<S, W> } | { kind: 'reportError'; detail: string } | { kind: 'stay' }`, `afterSwitch<S, W>(result: FolderSwitch<{ stored: S; workspace: W }>, hasOpenWorkspace: boolean): SwitchOutcome<S, W>`.

- [ ] **Step 1: Test**

`src/elements/app/screens.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { afterSwitch } from './screens';

const value = { stored: 'S', workspace: 'W' };

test('a successful switch shows the new workspace', () => {
  assert.deepEqual(afterSwitch({ kind: 'opened', value }, true), { kind: 'show', screen: { kind: 'open', stored: 'S', workspace: 'W' } });
});

test('an error stays in the open workspace as a toast, or goes back to the start screen', () => {
  assert.deepEqual(afterSwitch({ kind: 'error', detail: 'boom' }, true), { kind: 'reportError', detail: 'boom' });
  assert.deepEqual(afterSwitch({ kind: 'error', detail: 'boom' }, false), { kind: 'show', screen: { kind: 'start', error: 'boom' } });
});

test('cancelled or blocked: nothing changes', () => {
  assert.deepEqual(afterSwitch({ kind: 'cancelled' }, true), { kind: 'stay' });
  assert.deepEqual(afterSwitch({ kind: 'blocked' }, false), { kind: 'stay' });
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/elements/app/screens.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/elements/app/screens.ts`:

```ts
import { match } from 'ts-pattern';

import type { FolderSwitch } from '../../app/switchFolder';

/** Schermata dell'app. `S` è la cartella salvata, `W` lo workspace aperto. */
export type Screen<S, W> =
  | { kind: 'boot' }
  | { kind: 'unsupported' }
  | { kind: 'start'; error?: string }
  | { kind: 'resume'; stored: S }
  | { kind: 'open'; stored: S; workspace: W };

export type SwitchOutcome<S, W> =
  | { kind: 'show'; screen: Screen<S, W> }
  | { kind: 'reportError'; detail: string }
  | { kind: 'stay' };

/**
 * Esito di un cambio cartella. Con una cartella aperta un errore resta lì come toast; dall'avvio
 * torna alla schermata iniziale con l'errore.
 */
export function afterSwitch<S, W>(
  result: FolderSwitch<{ stored: S; workspace: W }>,
  hasOpenWorkspace: boolean,
): SwitchOutcome<S, W> {
  return match(result)
    .returnType<SwitchOutcome<S, W>>()
    .with({ kind: 'opened' }, ({ value }) => ({ kind: 'show', screen: { kind: 'open', ...value } }))
    .with({ kind: 'error' }, ({ detail }) =>
      hasOpenWorkspace ? { kind: 'reportError', detail } : { kind: 'show', screen: { kind: 'start', error: detail } },
    )
    .with({ kind: 'cancelled' }, { kind: 'blocked' }, () => ({ kind: 'stay' }))
    .exhaustive();
}
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/elements/app/screens.test.ts`
Expected: 3 pass.

- [ ] **Step 5: App usa il modulo**

In `src/App.tsx`:

1. `type Screen = …` (righe 22-27) diventa `type Screen = AppScreen<StoredWorkspace, Workspace>;` con `import { afterSwitch, type Screen as AppScreen } from './elements/app/screens';` e `import { match } from 'ts-pattern';`.

2. Lo `switch (result.kind)` (righe 124-137) diventa:

```tsx
    match(afterSwitch(result, current !== null))
      .with({ kind: 'show' }, ({ screen: next }) => {
        if (next.kind === 'open') setOpenCount((c) => c + 1);
        setScreen(next);
      })
      .with({ kind: 'reportError' }, ({ detail }) => current?.reportFolderError(detail))
      .with({ kind: 'stay' }, () => {})
      .exhaustive();
```

3. `let content … switch (screen.kind) { … }` (righe 148-173) diventa:

```tsx
  const content: ReactNode = match(screen)
    .with({ kind: 'boot' }, () => null)
    .with({ kind: 'unsupported' }, () => <StartScreen mode="unsupported" reason={unsupportedReason(navigator.userAgent)} />)
    .with({ kind: 'start' }, (s) => <StartScreen mode="start" error={s.error} onPick={choose} busy={switching} />)
    .with({ kind: 'resume' }, (s) => (
      <StartScreen mode="resume" folderName={s.stored.handle.name} onResume={resume} onPick={choose} busy={switching} />
    ))
    .with({ kind: 'open' }, (s) => (
      <WorkspaceView
        key={`${s.stored.workspaceId}:${openCount}`}
        workspace={s.workspace}
        workspaceId={s.stored.workspaceId}
        handle={s.stored.handle}
        onChangeFolder={choose}
        switchingFolder={switching}
      />
    ))
    .exhaustive();
```

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts startup.spec.ts visual.spec.ts
git add src/elements/app src/App.tsx
git commit -m "refactor: schermate dell'app ed esito del cambio cartella con match esaustivo"
```

---

### Task 9: Bozza delle impostazioni AI

**Files:**
- Create: `src/state/draftState.ts`, `src/state/draftState.test.ts`
- Modify: `src/ui/ai/settings/ItemList.tsx:35-62` (`useDraft`)

**Interfaces:**
- Produces: `interface DraftState<T> { draft: T | null; saved: string | null; pending: T | null }`, `emptyDraft<T>()`, `isDirty(state)`, `openDraft(state, item)`, `editDraft(state, item)`, `selectDraft(state, item)`, `confirmSwitch(state)`, `cancelSwitch(state)`. `useDraft` mantiene la sua API.

- [ ] **Step 1: Test**

`src/state/draftState.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft } from './draftState';

const a = { id: 'a', name: 'A' };
const b = { id: 'b', name: 'B' };

test('a freshly opened item is clean; editing it makes it dirty; editing it back makes it clean', () => {
  const opened = openDraft(emptyDraft<typeof a>(), a);
  assert.equal(isDirty(opened), false);
  const edited = editDraft(opened, { ...a, name: 'A2' });
  assert.equal(isDirty(edited), true);
  assert.equal(isDirty(editDraft(edited, a)), false);
});

test('selecting another item while clean switches right away', () => {
  const next = selectDraft(openDraft(emptyDraft<typeof a>(), a), b);
  assert.deepEqual(next.draft, b);
  assert.equal(next.pending, null);
});

test('selecting while dirty waits for confirmation; confirm switches, cancel keeps the edits', () => {
  const dirty = editDraft(openDraft(emptyDraft<typeof a>(), a), { ...a, name: 'A2' });
  const waiting = selectDraft(dirty, b);
  assert.deepEqual(waiting.pending, b);
  assert.deepEqual(waiting.draft, { ...a, name: 'A2' });
  const confirmed = confirmSwitch(waiting);
  assert.deepEqual(confirmed.draft, b);
  assert.equal(confirmed.pending, null);
  assert.equal(isDirty(confirmed), false);
  const cancelled = cancelSwitch(waiting);
  assert.deepEqual(cancelled.draft, { ...a, name: 'A2' });
  assert.equal(cancelled.pending, null);
});

test('opening null (after a delete) leaves nothing selected and nothing dirty', () => {
  const cleared = openDraft(openDraft(emptyDraft<typeof a>(), a), null);
  assert.equal(cleared.draft, null);
  assert.equal(isDirty(cleared), false);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/state/draftState.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/state/draftState.ts`:

```ts
/**
 * Bozza del dettaglio di un elemento (profilo, preset): `dirty` finché differisce dall'ultimo
 * salvataggio; passare a un altro elemento con modifiche aperte resta in sospeso (`pending`) finché
 * l'utente non conferma o annulla. Puro: le funzioni restituiscono uno stato nuovo.
 */
export interface DraftState<T> {
  draft: T | null;
  /** JSON dell'ultimo stato salvato (o aperto), per il confronto. */
  saved: string | null;
  pending: T | null;
}

export const emptyDraft = <T>(): DraftState<T> => ({ draft: null, saved: null, pending: null });

export const isDirty = <T>(state: DraftState<T>): boolean => state.draft !== null && JSON.stringify(state.draft) !== state.saved;

/** Apre un elemento (o nessuno) come riferimento pulito. */
export const openDraft = <T>(state: DraftState<T>, item: T | null): DraftState<T> => ({
  ...state,
  draft: item,
  saved: item === null ? null : JSON.stringify(item),
});

export const editDraft = <T>(state: DraftState<T>, item: T): DraftState<T> => ({ ...state, draft: item });

export const selectDraft = <T>(state: DraftState<T>, item: T | null): DraftState<T> =>
  isDirty(state) ? { ...state, pending: item } : openDraft(state, item);

export const confirmSwitch = <T>(state: DraftState<T>): DraftState<T> => ({ ...openDraft(state, state.pending), pending: null });

export const cancelSwitch = <T>(state: DraftState<T>): DraftState<T> => ({ ...state, pending: null });
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/state/draftState.test.ts`
Expected: 4 pass.

- [ ] **Step 5: useDraft diventa un adattatore**

In `src/ui/ai/settings/ItemList.tsx` sostituire il corpo di `useDraft` (righe 35-62, commento compreso) con:

```tsx
/** Adattatore React di `state/draftState.ts`: stessa API di prima per le sezioni profili e preset. */
export function useDraft<T>(onDirty?: (dirty: boolean) => void) {
  const [state, setState] = useState<DraftState<T>>(emptyDraft);
  const dirty = isDirty(state);

  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  return {
    draft: state.draft,
    dirty,
    setDraft: (item: T) => setState((s) => editDraft(s, item)),
    /** Dopo un salvataggio riuscito: la bozza corrente diventa il riferimento. */
    markSaved: (item: T | null) => setState((s) => openDraft(s, item)),
    select: (item: T | null) => setState((s) => selectDraft(s, item)),
    pending: state.pending !== null,
    confirmSwitch: () => setState(confirmSwitch),
    cancelSwitch: () => setState(cancelSwitch),
  };
}
```

con l'import `import { cancelSwitch, confirmSwitch, editDraft, emptyDraft, isDirty, openDraft, selectDraft, type DraftState } from '../../../state/draftState';`.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts settings.spec.ts
git add src/state/draftState.ts src/state/draftState.test.ts src/ui/ai/settings/ItemList.tsx
git commit -m "refactor: bozza delle impostazioni AI in uno stato puro"
```

---

### Task 10: Preferenze validate con zod

**Files:**
- Create: `src/state/prefs.schema.ts`, `src/state/prefs.schema.test.ts`, `src/testing/memoryStorage.ts`
- Modify: `src/lib/prefs.ts`, `src/ui/WorkspaceView.tsx` (righe 85, 93, 97, 98, 233, 249), `src/ui/ai/useAiController.ts:15`

**Interfaces:**
- Consumes: `Mode`, `WIDTH_LIMITS` (Task 5).
- Produces: `PREFS` (mappa chiave → `{ schema, fallback }`), `type PrefKey`, `type PrefValue<K>`; in `lib/prefs.ts`: `readPref<K extends PrefKey>(key: K): PrefValue<K>`, `readLastFile(workspaceId): string | null`, `writeLastFile(workspaceId, path)`. `writePref` e `readValidPref` restano.

- [ ] **Step 1: localStorage finto per i test**

`src/testing/memoryStorage.ts`:

```ts
/** `localStorage` in memoria per i test in Node; restituisce la mappa per prepararla o leggerla. */
export function installMemoryStorage(): Map<string, string> {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return items;
}
```

- [ ] **Step 2: Test**

`src/state/prefs.schema.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from '../testing/memoryStorage';
import { readLastFile, readPref, writeLastFile, writePref } from '../lib/prefs';

const items = installMemoryStorage();

test('missing preferences give the defaults', () => {
  items.clear();
  assert.equal(readPref('mode'), 'split');
  assert.equal(readPref('sidebarOpen'), true);
  assert.equal(readPref('sidebarWidth'), 280);
  assert.equal(readPref('aiSidebarWidth'), 380);
  assert.equal(readPref('aiProfile'), '');
  assert.equal(readLastFile('ws'), null);
});

test('valid saved values are read back', () => {
  items.clear();
  writePref('mode', 'ai');
  writePref('sidebarOpen', false);
  writePref('sidebarWidth', 333);
  writePref('aiProfile', 'p1');
  writeLastFile('ws', 'docs/a.md');
  assert.equal(readPref('mode'), 'ai');
  assert.equal(readPref('sidebarOpen'), false);
  assert.equal(readPref('sidebarWidth'), 333);
  assert.equal(readPref('aiProfile'), 'p1');
  assert.equal(readLastFile('ws'), 'docs/a.md');
});

test('corrupt or hand-edited values fall back to the defaults', () => {
  items.clear();
  items.set('housemd:mode', '42');
  items.set('housemd:sidebarOpen', '"yes"');
  items.set('housemd:sidebarWidth', '"abc"');
  items.set('housemd:aiSidebarWidth', '{broken');
  items.set('housemd:aiProfile', 'null');
  items.set('housemd:lastFile:ws', '[1]');
  assert.equal(readPref('mode'), 'split');
  assert.equal(readPref('sidebarOpen'), true);
  assert.equal(readPref('sidebarWidth'), 280);
  assert.equal(readPref('aiSidebarWidth'), 380);
  assert.equal(readPref('aiProfile'), '');
  assert.equal(readLastFile('ws'), null);
});

test('the last file is per workspace', () => {
  items.clear();
  writeLastFile('a', 'x.md');
  assert.equal(readLastFile('a'), 'x.md');
  assert.equal(readLastFile('b'), null);
});
```

- [ ] **Step 3: Eseguire, deve fallire**

Run: `npx tsx --test src/state/prefs.schema.test.ts`
Expected: FAIL (`readPref` vuole due argomenti, `readLastFile` non esiste).

- [ ] **Step 4: Schemi e prefs.ts**

`src/state/prefs.schema.ts`:

```ts
import * as z from 'zod/mini';

import { WIDTH_LIMITS, type Mode } from '../elements/workspace/layout';

/**
 * Preferenze in localStorage che prima si leggevano senza controllo (`JSON.parse(raw) as T`). Un
 * valore di un'altra versione o modificato a mano ricade sul default invece di rompere la griglia.
 * Tema, lingua, autosalvataggio e larghezza del testo hanno già i loro parse* e restano lì.
 */
export const PREFS = {
  mode: { schema: z.enum(['editor', 'split', 'preview', 'ai'] as const satisfies readonly Mode[]), fallback: 'split' as Mode },
  sidebarOpen: { schema: z.boolean(), fallback: true },
  sidebarWidth: { schema: z.number(), fallback: WIDTH_LIMITS.sidebar.initial },
  aiSidebarWidth: { schema: z.number(), fallback: WIDTH_LIMITS.ai.initial },
  aiProfile: { schema: z.string(), fallback: '' },
} as const;

export type PrefKey = keyof typeof PREFS;
export type PrefValue<K extends PrefKey> = z.output<(typeof PREFS)[K]['schema']>;

/** Ultimo file aperto per cartella (`lastFile:<workspaceId>`). */
export const LAST_FILE = z.nullable(z.string());
```

`src/lib/prefs.ts` diventa:

```ts
import { LAST_FILE, PREFS, type PrefKey, type PrefValue } from '../state/prefs.schema';

/** Preferenze per questo browser (modalità, larghezza sidebar…). Mai dati importanti. */
const PREFIX = 'housemd:';

/** Valore grezzo salvato, oppure undefined se manca, è illeggibile o lo storage non c'è. */
function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Preferenza validata con il suo schema; il default se manca o non è valida. */
export function readPref<K extends PrefKey>(key: K): PrefValue<K> {
  const { schema, fallback } = PREFS[key];
  const parsed = schema.safeParse(readRaw(key));
  return (parsed.success ? parsed.data : fallback) as PrefValue<K>;
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage non disponibile (finestra privata, dati bloccati): si continua senza
  }
}

/** Legge una preferenza passando il valore grezzo (undefined se manca) a un validatore che dà il default. */
export function readValidPref<T>(key: string, parse: (raw: unknown) => T): T {
  return parse(readRaw(key));
}

export function readLastFile(workspaceId: string): string | null {
  const parsed = LAST_FILE.safeParse(readRaw(`lastFile:${workspaceId}`));
  return parsed.success ? parsed.data : null;
}

export function writeLastFile(workspaceId: string, path: string): void {
  writePref(`lastFile:${workspaceId}`, path);
}
```

- [ ] **Step 5: Eseguire, deve passare**

Run: `npx tsx --test src/state/prefs.schema.test.ts`
Expected: 4 pass.

- [ ] **Step 6: Chiamanti**

`src/ui/WorkspaceView.tsx`:

```ts
  const [aiWidth, setAiWidth] = useState(() => clampWidth('ai', readPref('aiSidebarWidth')));          // riga 85
  const [mode, setMode] = useState<Mode>(() => readPref('mode'));                                      // riga 93
  const [sidebarOpen, setSidebarOpen] = useState(() => readPref('sidebarOpen'));                        // riga 97
  const [sidebarWidth, setSidebarWidth] = useState(() => clampWidth('sidebar', readPref('sidebarWidth'))); // riga 98
    const last = readLastFile(workspaceId);                                                             // riga 233
    if (doc) writeLastFile(workspaceId, doc.path);                                                      // riga 249
```

e l'import da `../lib/prefs` diventa `readLastFile, readPref, readValidPref, writeLastFile, writePref`.

`src/ui/ai/useAiController.ts:15`: `controller.initialize(readPref('aiProfile'))`.

`npm run lint` deve passare: un `readPref` con la vecchia firma a due argomenti è un errore di tipo, quindi nessun chiamante resta indietro.

- [ ] **Step 7: Bundle**

```bash
npm run build && gzip -c dist/assets/index-*.js | wc -c
```

Annotare la differenza rispetto al Task 1 nel messaggio di commit. Oltre 8 KB (8192 B): fermarsi e riferire (spec §6.2).

- [ ] **Step 8: Verifica e commit**

```bash
npm test && npm run lint
npm run test:e2e
git add src/state/prefs.schema.ts src/state/prefs.schema.test.ts src/testing/memoryStorage.ts src/lib/prefs.ts src/ui/WorkspaceView.tsx src/ui/ai/useAiController.ts
git commit -m "feat: preferenze validate con zod, i valori corrotti tornano ai default

Bundle principale gzip: <prima> → <dopo> B (+<diff>)."
```

---

### Task 11: `.housemd.json` e buffer di emergenza con zod

**Files:**
- Modify: `src/config/config.ts`, `src/workspace/buffers.ts`, `src/workspace/buffers.test.ts` (solo aggiunte)

**Interfaces:**
- `parseConfig` e `BufferStore` non cambiano firma. `normalizeStored(value: unknown): BufferedText | null` (interno).

- [ ] **Step 1: Test nuovi (in fondo a `buffers.test.ts`)**

```ts
test('indexedDB: a corrupt buffer record loads as null instead of throwing', async () => {
  const dbName = `buffers-corrupt-${++dbCount}`;
  const store = indexedDbBufferStore(dbName);
  await store.save('ws', 'ok.md', 'text', 'base');
  const db = await openDb(dbName);
  const tx = db.transaction('buffers', 'readwrite');
  tx.objectStore('buffers').put({ text: 42 }, 'ws\u0000bad.md');
  tx.objectStore('buffers').put(null, 'ws\u0000null.md');
  await transactionDone(tx);
  db.close();
  assert.equal(await store.load('ws', 'bad.md'), null);
  assert.equal(await store.load('ws', 'null.md'), null);
  assert.deepEqual(await store.load('ws', 'ok.md'), { text: 'text', base: 'base' });
  // Comportamento attuale: il percorso resta nell'elenco (le bozze orfane lo mostrano, il caricamento dà null).
  assert.deepEqual((await store.list('ws')).sort(), ['bad.md', 'null.md', 'ok.md']);
});

test('indexedDB: a buffer in the old string format still loads', async () => {
  const dbName = `buffers-old-${++dbCount}`;
  const store = indexedDbBufferStore(dbName);
  await store.save('ws', 'seed.md', 'x', 'x');
  const db = await openDb(dbName);
  const tx = db.transaction('buffers', 'readwrite');
  tx.objectStore('buffers').put('vecchio testo', 'ws\u0000old.md');
  await transactionDone(tx);
  db.close();
  assert.deepEqual(await store.load('ws', 'old.md'), { text: 'vecchio testo', base: 'vecchio testo' });
});
```

Se `buffers.test.ts` non importa già `openDb`/`transactionDone`, l'import esiste (riga 5): verificarlo.

- [ ] **Step 2: Eseguire, il primo deve fallire**

Run: `npx tsx --test src/workspace/buffers.test.ts`
Expected: il test del record corrotto FALLISCE (oggi `{ text: 42 }` torna così com'è e `null` lancia o torna `null` per caso); il secondo passa già (formato vecchio supportato oggi).

- [ ] **Step 3: buffers.ts**

Sostituire `normalizeStored` (righe 30-33) con:

```ts
/** Formato salvato: stringa (versione precedente) oppure `{ text, base }`. */
const STORED = z.union([z.string(), z.object({ text: z.string(), base: z.string() })]);

/** Record letto dallo storage → buffer; null se manca o non è leggibile (dato corrotto). */
function normalizeStored(value: unknown): BufferedText | null {
  const parsed = STORED.safeParse(value);
  if (!parsed.success) return null;
  return typeof parsed.data === 'string' ? { text: parsed.data, base: parsed.data } : parsed.data;
}
```

con `import * as z from 'zod/mini';` in testa. Nei due `load`:

```ts
    async load(ws, path) {
      return normalizeStored(entries.get(bufferKey(ws, path)));
    },
```

```ts
    load: (ws, path) => withStore('readonly', async (s) => normalizeStored(await request(s.get(bufferKey(ws, path))))),
```

La mappa del memory store resta `Map<string, BufferedText | string>`.

- [ ] **Step 4: config.ts**

Le due validazioni a mano diventano schemi, la normalizzazione resta fuori:

```ts
import * as z from 'zod/mini';

import { normalizePath } from '../lib/paths';

/** Valori ammessi nei campi di `.housemd.json`; percorsi normalizzati dopo la validazione. */
const SAVE_TO = z.string();
const LINK_PREFIX = z.string().check(z.startsWith('/'));
```

e nel corpo di `parseConfig`:

```ts
  let saveTo = DEFAULT_CONFIG.images.saveTo;
  if (images.saveTo !== undefined) {
    const parsed = SAVE_TO.safeParse(images.saveTo);
    if (parsed.success && normalizePath(parsed.data) !== '') saveTo = normalizePath(parsed.data);
    else problems.push({ code: 'invalidSaveTo' });
  }

  let linkPrefix = DEFAULT_CONFIG.images.linkPrefix;
  if (images.linkPrefix !== undefined && images.linkPrefix !== null) {
    const parsed = LINK_PREFIX.safeParse(images.linkPrefix);
    if (parsed.success) linkPrefix = `/${normalizePath(parsed.data)}`;
    else problems.push({ code: 'invalidLinkPrefix' });
  }
```

Il resto (`CONFIG_FILE`, `HouseConfig`, `DEFAULT_CONFIG`, `ConfigProblem`, il `JSON.parse` e l'estrazione di `images`) non cambia. Contratto: `config.test.ts` senza modifiche.

- [ ] **Step 5: Verifica e commit**

```bash
npx tsx --test src/workspace/buffers.test.ts src/config/config.test.ts
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts external.spec.ts startup.spec.ts
git add src/config/config.ts src/workspace/buffers.ts src/workspace/buffers.test.ts
git commit -m "feat: buffer di emergenza e .housemd.json validati con zod"
```

---

### Task 12: Cartella salvata e cronologia con zod

**Files:**
- Modify: `src/fs/handleStore.ts`, `src/fs/handleStore.test.ts` (solo aggiunte), `src/history/historyStore.ts`, `src/history/historyStore.test.ts` (solo aggiunte)

- [ ] **Step 1: Test nuovi**

In fondo a `src/fs/handleStore.test.ts`:

```ts
test('a corrupt current record means no saved folder', async () => {
  const dbName = 'hs-corrupt-1';
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put({ handle: null, workspaceId: '' }, 'current');
  await transactionDone(tx);
  db.close();
  assert.equal(await loadWorkspace(dbName), null);
});

test('corrupt entries in the known list are skipped, valid ones still match', async () => {
  const dbName = 'hs-corrupt-2';
  const a = await saveWorkspace({ name: 'a' }, dbName);
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  const store = tx.objectStore('workspace');
  store.put(['garbage', { handle: { name: 'x' } }, { handle: { name: 'a' }, workspaceId: a.workspaceId }], 'known');
  await transactionDone(tx);
  db.close();
  assert.equal(await findKnownWorkspaceId(picked('a'), dbName), a.workspaceId);
  // Il salvataggio successivo riscrive la lista senza le voci illeggibili.
  await saveWorkspace({ name: 'b' }, dbName);
  assert.equal(await findKnownWorkspaceId(picked('a'), dbName), a.workspaceId);
});
```

(`picked` è l'helper già definito nel file; verificarne il nome e la firma prima di eseguire.)

In fondo a `src/history/historyStore.test.ts`:

```ts
test('indexedDB: a corrupt snapshot is left out of the list and reads as null', async () => {
  const dbName = 'history-corrupt';
  const store = indexedDbHistoryStore(dbName);
  const good = await store.add({ workspaceId: 'ws', path: 'a.md', savedAt: 1, text: 'ok', reason: 'save' });
  const db = await openDb(dbName);
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  const badId = (await new Promise<IDBValidKey>((resolve, reject) => {
    const req = tx.objectStore(HISTORY_STORE).add({ workspaceId: 'ws', path: 'a.md', savedAt: 2, text: 42, reason: 'nope' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  })) as number;
  await transactionDone(tx);
  db.close();
  assert.deepEqual((await store.list('ws', 'a.md')).map((s) => s.id), [good]);
  assert.equal(await store.get(badId), null);
  assert.equal((await store.get(good))?.text, 'ok');
});
```

con gli import `import { HISTORY_STORE, openDb, transactionDone } from '../lib/db';` se mancano.

- [ ] **Step 2: Eseguire, devono fallire**

Run: `npx tsx --test src/fs/handleStore.test.ts src/history/historyStore.test.ts`
Expected: i tre test nuovi FALLISCONO (oggi i record passano così come sono; `garbage.handle` fa lanciare `isSameEntry` o viene restituito).

- [ ] **Step 3: handleStore.ts**

In testa:

```ts
import * as z from 'zod/mini';
```

e dopo `KNOWN_KEY`:

```ts
/**
 * Forma di un record salvato. L'handle resta opaco (nessun metodo della File System Access API
 * nominato qui: solo fsaOps.ts e access.ts la toccano); basta che sia un oggetto.
 */
const RECORD = z.object({
  handle: z.custom<object>((value) => typeof value === 'object' && value !== null),
  workspaceId: z.string().check(z.minLength(1)),
});

function asStored<H>(value: unknown): StoredWorkspace<H> | null {
  const parsed = RECORD.safeParse(value);
  return parsed.success ? (parsed.data as StoredWorkspace<H>) : null;
}

/** Lista delle cartelle note: le voci illeggibili si scartano. */
function asKnown<H>(value: unknown): StoredWorkspace<H>[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asStored<H>(entry)).filter((entry): entry is StoredWorkspace<H> => entry !== null);
}
```

Poi, in `saveWorkspace` e `findKnownWorkspaceId`, il `Promise.all` resta ma senza cast, e le due righe dopo diventano:

```ts
  const [knownRaw, previousRaw] = await Promise.all([request(store.get(KNOWN_KEY)), request(store.get(KEY))]);
  const known = asKnown<H>(knownRaw);
  const previous = asStored<H>(previousRaw);
```

(in `findKnownWorkspaceId` la variabile si chiama `current` al posto di `previous`, come oggi). In `loadWorkspace`: `return asStored<H>(stored);`.

- [ ] **Step 4: historyStore.ts**

In testa `import * as z from 'zod/mini';` e dopo `SNAPSHOT_REASONS`:

```ts
const SNAPSHOT = z.object({
  id: z.number(),
  workspaceId: z.string(),
  path: z.string(),
  savedAt: z.number(),
  text: z.string(),
  reason: z.enum(['save', 'before-reload', 'before-overwrite', 'before-restore', 'before-ai'] as const satisfies readonly SnapshotReason[]),
});

/** Snapshot letto da IndexedDB, oppure null se il record è illeggibile. */
function asSnapshot(value: unknown): Snapshot | null {
  const parsed = SNAPSHOT.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const validSnapshots = (values: unknown[]): Snapshot[] =>
  values.map(asSnapshot).filter((s): s is Snapshot => s !== null);
```

e in `indexedDbHistoryStore`:

```ts
    list: (workspaceId, path) =>
      withStore('readonly', async (store) =>
        validSnapshots(await request(store.index('byFile').getAll(fileRange(workspaceId, path)))).sort(newestFirst),
      ),
    get: (id) => withStore('readonly', async (store) => asSnapshot(await request(store.get(id)))),
```

e in `move` e `prune` `const found = validSnapshots(await request(store.index('byFile').getAll(…)));` al posto del cast. `memoryHistoryStore` non cambia (dati in memoria, scritti dal codice).

- [ ] **Step 5: Verifica e commit**

```bash
npx tsx --test src/fs/handleStore.test.ts src/history/historyStore.test.ts
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts startup.spec.ts history.spec.ts
git add src/fs/handleStore.ts src/fs/handleStore.test.ts src/history/historyStore.ts src/history/historyStore.test.ts
git commit -m "feat: cartella salvata e cronologia validate con zod, i record corrotti valgono come assenti"
```

---

### Task 13: Campi non controllati delle risposte dei modelli

**Files:**
- Create: `src/ai/providers/shapes.ts`, `src/ai/providers/shapes.test.ts`
- Modify: `src/ai/providers/openaiCompatible.ts:24, 37-39`, `src/ai/providers/anthropic.ts:98, 100`

**Interfaces:**
- Produces: `tokens(value: unknown): number | undefined`, `ollamaModels(body: unknown): ModelOption[] | null`, `openaiModels(body: unknown): ModelOption[] | null`, `textDelta(value: unknown): string` (lancia `AiError('badStream')`). `null` = lista presente ma non un array, come oggi (oggi lì `.map` lancia `TypeError` → `unreachable` → `null`).

Oggi `value.usage.prompt_tokens`, le voci di `models`/`data` e `e.delta.text` di Anthropic passano senza controllo di tipo: un server che risponde male può far arrivare all'interfaccia un numero al posto del testo o un'etichetta `undefined`. Il resto dei provider (testo OpenAI, risposta del bridge Claude Code, `finish_reason`) è già controllato a mano e non si tocca. `providers.test.ts` è il contratto e non cambia.

- [ ] **Step 1: Test**

`src/ai/providers/shapes.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { ollamaModels, openaiModels, textDelta, tokens } from './shapes';

test('token counts: numbers pass, anything else is undefined', () => {
  assert.equal(tokens(12), 12);
  assert.equal(tokens('12'), undefined);
  assert.equal(tokens(null), undefined);
  assert.equal(tokens(undefined), undefined);
});

test('Ollama model list: entries without a string name are skipped', () => {
  assert.deepEqual(ollamaModels({ models: [{ name: 'qwen' }, { name: 3 }, null, { model: 'x' }] }), [{ value: 'qwen', label: 'qwen' }]);
});

test('model lists keep today\'s outcomes: missing list = empty; wrong list type or null body = null', () => {
  assert.deepEqual(ollamaModels({}), []);
  assert.deepEqual(ollamaModels(5), []);
  assert.equal(ollamaModels(null), null);
  assert.equal(ollamaModels({ models: 'nope' }), null);
  assert.deepEqual(openaiModels({}), []);
  assert.equal(openaiModels(null), null);
  assert.equal(openaiModels({ data: {} }), null);
});

test('OpenAI-style model list: ids, loaded marker, context size; embeddings and bad entries skipped', () => {
  assert.deepEqual(
    openaiModels({
      data: [
        { id: 'chat', max_context_length: 32000, state: 'loaded' },
        { id: 'emb', type: 'embeddings' },
        { id: 7 },
        { id: 'plain', max_context_length: 'big' },
      ],
    }),
    [
      { value: 'chat', label: 'chat ●', contextTokens: 32000 },
      { value: 'plain', label: 'plain', contextTokens: undefined },
    ],
  );
});

test('Anthropic text delta: missing is empty, a string passes, anything else is a bad stream', () => {
  assert.equal(textDelta(undefined), '');
  assert.equal(textDelta('ciao'), 'ciao');
  assert.throws(() => textDelta(42), { code: 'badStream' });
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/ai/providers/shapes.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/ai/providers/shapes.ts`:

```ts
import * as z from 'zod/mini';

import { AiError } from '../errors';
import type { ModelOption } from '../types';

/**
 * Campi delle risposte dei modelli che i provider non controllavano. Sta in providers/ (unica
 * cartella che parla con la rete), quindi finisce nel chunk dei provider e non nel bundle principale.
 */
const TOKENS = z.number();
const OLLAMA_MODEL = z.object({ name: z.string() });
const OPENAI_MODEL = z.object({
  id: z.string(),
  max_context_length: z.optional(z.unknown()),
  state: z.optional(z.unknown()),
  type: z.optional(z.unknown()),
});

export function tokens(value: unknown): number | undefined {
  const parsed = TOKENS.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Elementi validi di una lista arrivata dalla rete; il resto si scarta. Lista assente = vuota;
 * lista di un altro tipo = null, l'esito di oggi (`.map` lanciava TypeError → unreachable → null).
 */
function validItems<T>(schema: z.ZodMiniType<T>, list: unknown): T[] | null {
  if (list === NO_BODY) return null;
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  return list.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Segnaposto per un corpo `null`/`undefined`: oggi `body.models` lì lancia TypeError → null. */
const NO_BODY = Symbol('noBody');

/** `body[key]` come lo legge JavaScript (su un numero o una stringa è undefined, non un errore). */
const field = (body: unknown, key: string): unknown =>
  body === null || body === undefined ? NO_BODY : (body as Record<string, unknown>)[key];

export function ollamaModels(body: unknown): ModelOption[] | null {
  return validItems(OLLAMA_MODEL, field(body, 'models'))?.map((m) => ({ value: m.name, label: m.name })) ?? null;
}

export function openaiModels(body: unknown): ModelOption[] | null {
  const models = validItems(OPENAI_MODEL, field(body, 'data'));
  if (models === null) return null;
  return models
    .filter((m) => m.type !== 'embeddings' && m.type !== 'embedding')
    .map((m) => ({ value: m.id, label: m.id + (m.state === 'loaded' ? ' ●' : ''), contextTokens: tokens(m.max_context_length) }));
}

/** Testo di un delta di Anthropic: assente = vuoto; di un altro tipo = flusso non valido. */
export function textDelta(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new AiError('badStream');
  return value;
}
```

(`z.ZodMiniType<T>` esiste in `zod@4.6.5` e restituisce `data: T` tipizzato: verificato scrivendo il piano.)

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/ai/providers/shapes.test.ts`
Expected: 5 pass.

- [ ] **Step 5: I provider usano il modulo**

`src/ai/providers/openaiCompatible.ts`:
- riga 24: `if (value.usage) yield { type: 'usage', inputTokens: tokens(value.usage.prompt_tokens), outputTokens: tokens(value.usage.completion_tokens) };`
- righe 37-39:

```ts
        const value: unknown = await response.json();
        return profile.kind === 'ollama' ? ollamaModels(value) : openaiModels(value);
```

e l'import `import { ollamaModels, openaiModels, tokens } from './shapes';`.

`src/ai/providers/anthropic.ts`:
- riga 98: `if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') yield { type: 'text', text: textDelta(e.delta.text) };`
- riga 100: `const usage = e.usage ?? e.message?.usage; if (usage) yield { type: 'usage', inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };`

e l'import `import { textDelta, tokens } from './shapes';`.

Esiti di oggi, verificati scrivendo il piano e conservati: rete giù (`TypeError` dal `fetch`) → `null`; corpo non JSON → `response.json()` lancia → `badStream` (non tocca `shapes.ts`); corpo JSON `null` → `null`; lista assente (anche con corpo numero o stringa) → `[]`; lista di un altro tipo → `null`. Unico cambiamento: le voci malformate dentro una lista valida si scartano invece di diventare opzioni con etichetta `undefined`.

- [ ] **Step 6: Verifica e commit**

```bash
npx tsx --test src/ai/providers/shapes.test.ts src/ai/providers/providers.test.ts
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts ai-review.spec.ts
npm run build && gzip -c dist/assets/index-*.js | wc -c   # il bundle principale non deve crescere per questo task
git add src/ai/providers/shapes.ts src/ai/providers/shapes.test.ts src/ai/providers/openaiCompatible.ts src/ai/providers/anthropic.ts
git commit -m "feat: usage, elenchi modelli e delta di Anthropic validati, le voci malformate si scartano"
```

---

### Task 14: Store della lingua

**Files:**
- Create: `src/state/i18nStore.ts`, `src/state/i18nStore.test.ts`
- Modify: `src/i18n/I18nProvider.tsx`

**Interfaces:**
- Produces: `interface I18nState { locale: Locale; messages: Messages }`, `createI18nStore(deps: { locale: Locale; messages: Messages; load(locale: Locale): Promise<LoadedMessages>; persist(locale: Locale): void })` → `{ getState(): I18nState; subscribe(fn): () => void; t(key, params?): string; setLocale(locale): Promise<void> }`.

- [ ] **Step 1: Test**

`src/state/i18nStore.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { Locale, Messages } from '../i18n/i18n';
import type { LoadedMessages } from '../i18n/messages';
import { createI18nStore } from './i18nStore';

const EN: Messages = { hello: 'Hello {name}' };
const IT: Messages = { hello: 'Ciao {name}' };
const FR: Messages = { hello: 'Bonjour {name}' };

/** Loader controllato dal test: ogni richiesta resta in sospeso finché non la si risolve. */
function deferredLoader() {
  const pending = new Map<Locale, (value: LoadedMessages) => void>();
  return {
    load: (locale: Locale) => new Promise<LoadedMessages>((resolve) => pending.set(locale, resolve)),
    resolve: (locale: Locale, value: LoadedMessages) => pending.get(locale)!(value),
  };
}

test('translates with the current messages', () => {
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'en', messages: EN }), persist: () => {} });
  assert.equal(store.t('hello', { name: 'Ada' }), 'Hello Ada');
});

test('setLocale loads, persists the loaded language and notifies', async () => {
  const saved: Locale[] = [];
  let notified = 0;
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'it', messages: IT }), persist: (l) => saved.push(l) });
  store.subscribe(() => notified++);
  await store.setLocale('it');
  assert.equal(store.getState().locale, 'it');
  assert.equal(store.t('hello', { name: 'Ada' }), 'Ciao Ada');
  assert.deepEqual(saved, ['it']);
  assert.equal(notified, 1);
});

test('the last request wins, even if an earlier one resolves later', async () => {
  const loader = deferredLoader();
  const store = createI18nStore({ locale: 'en', messages: EN, load: loader.load, persist: () => {} });
  const first = store.setLocale('it');
  const second = store.setLocale('fr');
  loader.resolve('fr', { locale: 'fr', messages: FR });
  await second;
  loader.resolve('it', { locale: 'it', messages: IT });
  await first;
  assert.equal(store.getState().locale, 'fr');
});

test('a failed chunk falls back to English, and English is what gets saved', async () => {
  const saved: Locale[] = [];
  const store = createI18nStore({ locale: 'it', messages: IT, load: async () => ({ locale: 'en', messages: EN }), persist: (l) => saved.push(l) });
  await store.setLocale('ja');
  assert.equal(store.getState().locale, 'en');
  assert.deepEqual(saved, ['en']);
});

test('unsubscribe stops the notifications', async () => {
  let notified = 0;
  const store = createI18nStore({ locale: 'en', messages: EN, load: async () => ({ locale: 'it', messages: IT }), persist: () => {} });
  const off = store.subscribe(() => notified++);
  off();
  await store.setLocale('it');
  assert.equal(notified, 0);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/state/i18nStore.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/state/i18nStore.ts`:

```ts
import { translate, type Locale, type Messages, type Params } from '../i18n/i18n';
import type { LoadedMessages } from '../i18n/messages';

export interface I18nState {
  locale: Locale;
  messages: Messages;
}

/**
 * Lingua dell'interfaccia. Cambi rapidi: vince l'ultima richiesta, non l'ultima caricata. Si salva
 * la lingua effettivamente caricata (`en` se il chunk richiesto è fallito). `<html lang>` lo
 * aggiorna chi si iscrive, non lo store.
 */
export function createI18nStore(deps: {
  locale: Locale;
  messages: Messages;
  load(locale: Locale): Promise<LoadedMessages>;
  persist(locale: Locale): void;
}) {
  let state: I18nState = { locale: deps.locale, messages: deps.messages };
  let request = 0;
  const listeners = new Set<() => void>();

  return {
    getState: (): I18nState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    t: (key: string, params?: Params): string => translate(state.messages, key, params),
    async setLocale(locale: Locale): Promise<void> {
      const id = ++request;
      const { locale: loaded, messages } = await deps.load(locale);
      if (id !== request) return;
      deps.persist(loaded);
      state = { locale: loaded, messages };
      for (const listener of listeners) listener();
    },
  };
}

export type I18nStore = ReturnType<typeof createI18nStore>;
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/state/i18nStore.test.ts`
Expected: 5 pass.

- [ ] **Step 5: I18nProvider diventa un adattatore**

Il corpo di `I18nProvider` (righe 21-45) diventa:

```tsx
export function I18nProvider({ initialLocale, initialMessages, children }: Props) {
  const [store] = useState(() =>
    createI18nStore({
      locale: initialLocale,
      messages: initialMessages,
      load: loadMessages,
      persist: (locale) => writePref('locale', locale),
    }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getState);

  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale: state.locale,
      setLocale: (locale) => void store.setLocale(locale),
      t: (key, params) => translate(state.messages, key, params),
    }),
    [state, store],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
```

Import: `createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode` da `react`; `import { createI18nStore } from '../state/i18nStore';`. `useCallback` e `useRef` non servono più.

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts theme-i18n.spec.ts settings.spec.ts
git add src/state/i18nStore.ts src/state/i18nStore.test.ts src/i18n/I18nProvider.tsx
git commit -m "refactor: lingua in uno store testato, I18nProvider diventa un adattatore"
```

---

### Task 15: Store del tema

**Files:**
- Create: `src/state/themeStore.ts`, `src/state/themeStore.test.ts`
- Modify: `src/theme/useTheme.ts`

**Interfaces:**
- Produces: `createThemeStore(deps: { initial: ThemePref; persist(theme): void; transition(apply: () => void): void; apply(theme): void; watchSystem(onChange: () => void): () => void })` → `{ getState(): ThemePref; subscribe(fn): () => void; setTheme(next): void }`.

- [ ] **Step 1: Test**

`src/state/themeStore.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { ThemePref } from '../theme/theme';
import { createThemeStore } from './themeStore';

function fakeDeps(initial: ThemePref = 'auto') {
  const log: string[] = [];
  let systemListener: (() => void) | null = null;
  return {
    log,
    fireSystemChange: () => systemListener?.(),
    hasSystemListener: () => systemListener !== null,
    deps: {
      initial,
      persist: (t: ThemePref) => log.push(`persist:${t}`),
      transition: (apply: () => void) => {
        log.push('transition:start');
        apply();
        log.push('transition:end');
      },
      apply: (t: ThemePref) => log.push(`apply:${t}`),
      watchSystem: (onChange: () => void) => {
        systemListener = onChange;
        return () => {
          systemListener = null;
        };
      },
    },
  };
}

test('setTheme saves first, then updates and notifies inside the transition, then applies', () => {
  const f = fakeDeps();
  const store = createThemeStore(f.deps);
  store.subscribe(() => f.log.push(`notify:${store.getState()}`));
  store.setTheme('dark');
  assert.deepEqual(f.log, ['persist:dark', 'transition:start', 'notify:dark', 'apply:dark', 'transition:end']);
  assert.equal(store.getState(), 'dark');
});

test('a system color change re-applies the current theme', () => {
  const f = fakeDeps('auto');
  const store = createThemeStore(f.deps);
  store.subscribe(() => {});
  f.fireSystemChange();
  assert.deepEqual(f.log, ['apply:auto']);
});

test('the system listener exists only while someone is subscribed (StrictMode mounts twice)', () => {
  const f = fakeDeps();
  const store = createThemeStore(f.deps);
  assert.equal(f.hasSystemListener(), false);
  const off1 = store.subscribe(() => {});
  const off2 = store.subscribe(() => {});
  assert.equal(f.hasSystemListener(), true);
  off1();
  assert.equal(f.hasSystemListener(), true);
  off2();
  assert.equal(f.hasSystemListener(), false);
  store.subscribe(() => {});
  assert.equal(f.hasSystemListener(), true);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/state/themeStore.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/state/themeStore.ts`:

```ts
import type { ThemePref } from '../theme/theme';

/**
 * Tema dell'interfaccia. Lo stato cambia e gli iscritti vengono avvisati **dentro** la transizione:
 * così la view transition fotografa il DOM già aggiornato (icona dello switcher compresa). In `auto`
 * il cambio di colore del sistema riapplica il tema; quel listener esiste solo con almeno un iscritto.
 */
export function createThemeStore(deps: {
  initial: ThemePref;
  persist(theme: ThemePref): void;
  transition(apply: () => void): void;
  apply(theme: ThemePref): void;
  watchSystem(onChange: () => void): () => void;
}) {
  let theme = deps.initial;
  const listeners = new Set<() => void>();
  let stopWatching: (() => void) | null = null;

  return {
    getState: (): ThemePref => theme,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) stopWatching = deps.watchSystem(() => deps.apply(theme));
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stopWatching?.();
        stopWatching = null;
      };
    },
    setTheme(next: ThemePref): void {
      deps.persist(next);
      deps.transition(() => {
        theme = next;
        for (const listener of listeners) listener();
        deps.apply(next);
      });
    },
  };
}

export type ThemeStore = ReturnType<typeof createThemeStore>;
```

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/state/themeStore.test.ts`
Expected: 3 pass.

- [ ] **Step 5: useTheme diventa un adattatore**

`src/theme/useTheme.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

import { readValidPref, writePref } from '../lib/prefs';
import { createThemeStore, type ThemeStore } from '../state/themeStore';
import { applyTheme } from './applyTheme';
import { pixelTransition } from './pixelTransition';
import { parseTheme, type ThemePref } from './theme';

let store: ThemeStore | null = null;

/** Un solo store per pagina, creato al primo uso (legge la preferenza salvata). */
function themeStore(): ThemeStore {
  store ??= createThemeStore({
    initial: readValidPref('theme', parseTheme),
    persist: (theme) => writePref('theme', theme),
    transition: (apply) => void pixelTransition(apply),
    apply: applyTheme,
    watchSystem: (onChange) => {
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
  });
  return store;
}

export function useTheme(): [ThemePref, (next: ThemePref) => void] {
  const s = themeStore();
  // L'avviso arriva dentro la view transition: flushSync fa sì che React aggiorni il DOM prima che
  // la transizione lo fotografi (come faceva prima flushSync attorno a setState).
  const subscribe = useCallback((onChange: () => void) => s.subscribe(() => flushSync(onChange)), [s]);
  const theme = useSyncExternalStore(subscribe, s.getState);
  return [theme, s.setTheme];
}
```

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts theme-i18n.spec.ts visual.spec.ts
git add src/state/themeStore.ts src/state/themeStore.test.ts src/theme/useTheme.ts
git commit -m "refactor: tema in uno store testato, useTheme diventa un adattatore"
```

Nota per la checklist manuale (non e2e: le spec girano con `reducedMotion`): in Chrome senza "riduci animazioni", il ciclo del tema deve ancora fare la dissolvenza a pixel con l'icona già aggiornata nel fotogramma nuovo.

---

### Task 16: Store della rotta

**Files:**
- Create: `src/state/routeStore.ts`, `src/state/routeStore.test.ts`
- Modify: `src/ui/useRoute.ts`

**Interfaces:**
- Produces: `interface RouteWindow { hash(): string; pushState(url: string): void; replaceState(url: string): void; back(): void; setHash(hash: string): void; cleanUrl(): string; onHashChange(fn: () => void): () => void }`, `interface RouteGuard { canLeave(): boolean; onBlocked(): void }`, `createRouteStore(win: RouteWindow)` → `{ getState(): Route; subscribe(fn): () => void; setGuard(guard): void; navigate(next: Route): void }`, `browserRouteWindow(): RouteWindow`.

- [ ] **Step 1: Test**

`src/state/routeStore.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouteStore, type RouteWindow } from './routeStore';

/** Finestra finta: cronologia a voci, hashchange solo dove il browser lo emette (hash, back). */
function fakeWindow(initialHash = '') {
  const entries = [initialHash];
  let index = 0;
  const listeners = new Set<() => void>();
  const fire = () => listeners.forEach((l) => l());
  const win: RouteWindow = {
    hash: () => entries[index],
    pushState: (url) => {
      entries.splice(index + 1, Infinity, url.startsWith('#') ? url : '');
      index++;
    },
    replaceState: (url) => {
      entries[index] = url.startsWith('#') ? url : '';
    },
    back: () => {
      index--;
      fire();
    },
    setHash: (hash) => {
      entries.splice(index + 1, Infinity, hash);
      index++;
      fire();
    },
    cleanUrl: () => '/',
    onHashChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return { win, entries: () => entries.slice(0, index + 1), listeners, goBack: () => win.back() };
}

test('the initial route comes from the hash', () => {
  assert.deepEqual(createRouteStore(fakeWindow('#settings/ai-sync').win).getState(), { view: 'settings', section: 'ai-sync' });
  assert.deepEqual(createRouteStore(fakeWindow('').win).getState(), { view: 'workspace' });
});

test('opening the settings adds a history entry; changing section replaces it; closing goes back', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  store.navigate({ view: 'settings', section: 'general' });
  assert.deepEqual(store.getState(), { view: 'settings', section: 'general' });
  assert.deepEqual(f.entries(), ['', '#settings']);
  store.navigate({ view: 'settings', section: 'ai-presets' });
  assert.deepEqual(f.entries(), ['', '#settings/ai-presets']);
  store.navigate({ view: 'workspace' });
  assert.deepEqual(store.getState(), { view: 'workspace' });
  assert.deepEqual(f.entries(), ['']);
});

test('Back with unsaved changes puts the settings entry back and asks for confirmation', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  let blocked = 0;
  store.setGuard({ canLeave: () => false, onBlocked: () => blocked++ });
  store.navigate({ view: 'settings', section: 'general' });
  f.goBack();
  assert.equal(blocked, 1);
  assert.deepEqual(store.getState(), { view: 'settings', section: 'general' });
  assert.deepEqual(f.entries(), ['', '#settings']);
});

test('settings opened from a link (no entry pushed by the app): closing replaces the URL', () => {
  const f = fakeWindow('#settings');
  const store = createRouteStore(f.win);
  store.subscribe(() => {});
  store.navigate({ view: 'workspace' });
  assert.deepEqual(store.getState(), { view: 'workspace' });
  assert.deepEqual(f.entries(), ['']);
});

test('the hashchange listener exists only while someone is subscribed', () => {
  const f = fakeWindow('');
  const store = createRouteStore(f.win);
  assert.equal(f.listeners.size, 0);
  const off = store.subscribe(() => {});
  assert.equal(f.listeners.size, 1);
  off();
  assert.equal(f.listeners.size, 0);
});
```

- [ ] **Step 2: Eseguire, deve fallire**

Run: `npx tsx --test src/state/routeStore.test.ts`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Modulo**

`src/state/routeStore.ts`:

```ts
import { formatRoute, parseRoute, type Route } from '../lib/route';

/** Quello che serve della finestra: iniettato, così lo store si prova senza browser. */
export interface RouteWindow {
  hash(): string;
  pushState(url: string): void;
  replaceState(url: string): void;
  back(): void;
  setHash(hash: string): void;
  /** URL senza hash (per uscire dalle impostazioni senza voce di cronologia). */
  cleanUrl(): string;
  onHashChange(listener: () => void): () => void;
}

export interface RouteGuard {
  /** Falso se uscire dalle impostazioni perderebbe modifiche non salvate. */
  canLeave(): boolean;
  /** Uscita bloccata (es. Indietro del browser): chi la riceve chiede conferma. */
  onBlocked(): void;
}

/**
 * Vista indirizzata dall'hash. Entrare nelle impostazioni aggiunge una voce di cronologia (Indietro le
 * chiude); cambiare sezione la sostituisce; uscire torna indietro se ci si era entrati dall'app.
 * Con modifiche non salvate l'uscita via cronologia viene annullata e passa per la conferma.
 * Il listener di hashchange esiste solo con almeno un iscritto.
 */
export function createRouteStore(win: RouteWindow) {
  let route = parseRoute(win.hash());
  /** Le impostazioni sono state aperte dall'app con una voce di cronologia propria. */
  let pushed = false;
  let guard: RouteGuard = { canLeave: () => true, onBlocked: () => {} };
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;

  const set = (next: Route) => {
    route = next;
    for (const listener of listeners) listener();
  };

  const onHash = () => {
    const next = parseRoute(win.hash());
    if (route.view === 'settings' && next.view === 'workspace' && !guard.canLeave()) {
      // Si rimette la voce delle impostazioni e si chiede conferma: la bozza resta montata.
      win.pushState(formatRoute(route));
      pushed = true;
      guard.onBlocked();
      return;
    }
    if (next.view === 'workspace') pushed = false;
    set(next);
  };

  return {
    getState: (): Route => route,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) stopListening = win.onHashChange(onHash);
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stopListening?.();
        stopListening = null;
      };
    },
    setGuard(next: RouteGuard): void {
      guard = next;
    },
    navigate(next: Route): void {
      const current = parseRoute(win.hash());
      if (next.view === 'workspace') {
        if (current.view === 'workspace') return;
        if (pushed) {
          pushed = false;
          win.back();
          return;
        }
        win.replaceState(win.cleanUrl());
        set(next);
        return;
      }
      const hash = formatRoute(next);
      if (current.view === 'settings') {
        win.replaceState(hash);
        set(next);
        return;
      }
      pushed = true;
      win.setHash(hash);
    },
  };
}

export type RouteStore = ReturnType<typeof createRouteStore>;

export function browserRouteWindow(): RouteWindow {
  return {
    hash: () => location.hash,
    pushState: (url) => history.pushState(history.state, '', url),
    replaceState: (url) => history.replaceState(history.state, '', url),
    back: () => history.back(),
    setHash: (hash) => {
      location.hash = hash;
    },
    cleanUrl: () => location.pathname + location.search,
    onHashChange: (listener) => {
      window.addEventListener('hashchange', listener);
      return () => window.removeEventListener('hashchange', listener);
    },
  };
}
```

Nel finto, `setHash` e `back` emettono `hashchange` come il browser; `pushState`/`replaceState` no. Nel test "opening the settings…" la navigazione verso le impostazioni passa da `setHash` → `hashchange` → `onHash` → `set`, esattamente come oggi `location.hash = …` in `useRoute`.

- [ ] **Step 4: Eseguire, deve passare**

Run: `npx tsx --test src/state/routeStore.test.ts`
Expected: 5 pass.

- [ ] **Step 5: useRoute diventa un adattatore**

`src/ui/useRoute.ts`:

```ts
import { useState, useSyncExternalStore } from 'react';

import { browserRouteWindow, createRouteStore, type RouteGuard } from '../state/routeStore';

/** Adattatore React di `state/routeStore.ts`: stessa API di prima. */
export function useRoute(guard: RouteGuard) {
  const [store] = useState(() => createRouteStore(browserRouteWindow()));
  // La guardia cambia a ogni render (chiude su stato nuovo): come prima con il ref aggiornato al render.
  store.setGuard(guard);
  const route = useSyncExternalStore(store.subscribe, store.getState);
  return { route, navigate: store.navigate };
}
```

- [ ] **Step 6: Verifica e commit**

```bash
npm test && npm run lint
npx playwright test -c e2e/playwright.config.ts settings.spec.ts theme-i18n.spec.ts
git add src/state/routeStore.ts src/state/routeStore.test.ts src/ui/useRoute.ts
git commit -m "refactor: rotta delle impostazioni in uno store testato, useRoute diventa un adattatore"
```

---

### Task 17: Spec aggiornato, verifica finale, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§6.2, §7 fase 1, §13)

- [ ] **Step 1: Spec**

In §6.2:
- nella tabella, la riga "`housemd-sync.json`" diventa: `| housemd-sync.json (sync AI) | ai/sync/schema.ts, validatori a mano completi | Resta com'è: è già validato campo per campo e coperto da sync.test.ts; zod non aggiunge garanzie. |`
- la riga "Cronologia e store AI in IndexedDB" diventa solo cronologia; aggiungere sotto la tabella: `Store AI in IndexedDB (profili, preset, aiSecrets): rimandati. idbStores.ts riscrive l'intero store a ogni scrittura (clear + put), quindi scartare in lettura un record non valido lo cancellerebbe. Prima serve decidere cosa fare dei record illeggibili.`
- la riga "Risposte JSON dei provider" diventa: `| Risposte dei provider (usage, elenchi modelli, delta di Anthropic) | campi non controllati | ai/providers/shapes.ts: voci malformate scartate, token non numerici undefined, testo non stringa badStream. I campi già controllati a mano restano così; gli errori visibili non cambiano. |`
- nella riga delle preferenze, sostituire "`parseTheme`/`parseLocale`/`parseTextWidth` restano come API" con "`parseTheme`/`parseLocale`/`parseTextWidth`/`parseAutosave` restano come sono (validano già); zod copre le chiavi che non avevano controllo".

In §13: il punto 2 diventa tre piani, uno per fase (`…-wc-02-fase-1-logica-pura.md`, poi fase 2 e fase 3 da scrivere), ciascuno con la sua PR.

- [ ] **Step 2: Verifica completa**

```bash
npm test && npm run lint && npm run build
gzip -c dist/assets/index-*.js | wc -c
npm run test:e2e -- --repeat-each=2
git status --short
grep -rn "readPref<\|readPref('[a-zA-Z]*', " src --include=*.ts --include=*.tsx   # atteso: nessun risultato
```

Expected: baseline + i test nuovi (4+3+4+6+4+4+3+4+4+2+3+5+5+3+5 = 59), lint e build puliti, e2e verdi due volte con gli stessi snapshot (`git status` non mostra PNG modificati).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md
git commit -m "docs: spec allineato alla fase 1 (zod su preferenze, config, buffer, cartella, cronologia e campi dei provider)"
```

- [ ] **Step 4: PR solo con il via**

Riferire a Davide: test prima/dopo, bundle prima/dopo, scostamenti dallo spec, eventuali `// Comportamento attuale:`. **Fermarsi e chiedere** prima di `git push`, `gh pr create` e del merge.
