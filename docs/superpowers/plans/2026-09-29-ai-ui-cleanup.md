# Pulizia della UI AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** far sembrare chat, revisione e impostazioni AI parte di HouseMD (modalità AI in toolbar, composer in stile Claude, barra di revisione compatta, impostazioni come pagina via hash) senza cambiare la logica di `src/ai/*`.

**Architecture:** quattro moduli puri nuovi e testati (`route`, `composerKeys`, `selectionChip`, `reviewStatus`) portano le decisioni; i componenti React in `src/ui/ai/` vengono riscritti sottili, formattati e con CSS modules. `WorkspaceView` guadagna la modalità `ai`, perde `sidebarView` e il modale impostazioni, e ospita `SettingsView` come livello sovrapposto indirizzato dall'hash.

**Tech Stack:** React 18, TypeScript 7 (`tsc`), CodeMirror 6 (`@codemirror/merge`), Vite, `tsx --test` (node:test), Chromium headless per `npm run test:browser`, icone Pixelarticons.

**Spec:** `docs/superpowers/specs/2026-09-29-ai-ui-cleanup-design.md`

## Global Constraints

- Solo Chromium desktop recente: Popover API, Anchor Positioning, `<dialog closedby>`, `field-sizing` si usano senza polyfill né fallback (`CLAUDE.md`).
- Mai `innerHTML` con HTML non sanitizzato; il markdown della chat passa da `safeRender` + `setSafeHTML` come oggi.
- Mai `alert()` / `confirm()` / `prompt()`: conferme con `ConfirmDialog`.
- Nessun testo UI scritto a mano nei componenti: tutto passa da `t()`. Ogni chiave nuova in **tutti** i `src/i18n/locales/*.json`; `en.json` è il riferimento (`locales.test.ts`).
- Commenti e messaggi di commit in italiano, identificatori in inglese.
- La logica va in moduli puri testati con `npm test`; i componenti restano sottili.
- Nessuna modifica di comportamento a `src/ai/*` oltre ai moduli nuovi; il campo `view` di `PromptPreset` resta nel tipo, in `normalizePreset` e nello schema di sync.
- L'hash non contiene mai dati (percorsi, nomi di profili, chiavi).
- Branch `feat/ai-ui` (impilato su `feat/ai-tool`). Ogni task finisce con `npm test` e `npm run lint` verdi e un commit.

## Review Focus

1. **Hash sconosciuto o sporco all'avvio** (`#foo`, `#settings/xyz`, `#settings/`): l'app si apre sul documento o sulle impostazioni generali, mai una pagina vuota → test in Task 1.
2. **Invio con IME attivo** (giapponese, `isComposing`): non deve inviare a metà parola → test in Task 2.
3. **Selezione di soli spazi o a capo**: nessun chip, invio sul documento intero → test in Task 3.
4. **Proposta in streaming senza `running`** (dopo un errore di rete o una ripresa): la barra non deve dire "Applicata" né abilitare le frecce come se fosse completa → test in Task 4.
5. **Preferenza `mode: 'ai'` con il controller AI non ancora pronto** (IndexedDB lento): all'avvio si vede la vista divisa, non una schermata vuota; quando il controller arriva si entra in AI → verifica manuale in Task 9 (passo dedicato) e smoke test in Task 16.

---

### Task 1: `route` — hash ↔ vista

**Files:**
- Create: `src/lib/route.ts`
- Test: `src/lib/route.test.ts`

**Interfaces:**
- Produces:
  - `type SettingsSection = 'general' | 'ai-profiles' | 'ai-presets' | 'ai-sync'`
  - `const SETTINGS_SECTIONS: readonly SettingsSection[]`
  - `type Route = { view: 'workspace' } | { view: 'settings'; section: SettingsSection }`
  - `parseRoute(hash: string): Route`
  - `formatRoute(route: Route): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/route.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRoute, parseRoute, SETTINGS_SECTIONS } from './route';

test('empty or unknown hashes open the workspace', () => {
  for (const hash of ['', '#', '#foo', '#settingsx', '#/settings', '#SETTINGS']) {
    assert.deepEqual(parseRoute(hash), { view: 'workspace' }, hash);
  }
});

test('#settings and unknown sections open the general settings', () => {
  assert.deepEqual(parseRoute('#settings'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/xyz'), { view: 'settings', section: 'general' });
  assert.deepEqual(parseRoute('#settings/ai-profiles/extra'), { view: 'settings', section: 'general' });
});

test('every known section round-trips', () => {
  for (const section of SETTINGS_SECTIONS) {
    const route = { view: 'settings', section } as const;
    assert.deepEqual(parseRoute(formatRoute(route)), route);
  }
});

test('formatRoute writes the shortest hash', () => {
  assert.equal(formatRoute({ view: 'workspace' }), '');
  assert.equal(formatRoute({ view: 'settings', section: 'general' }), '#settings');
  assert.equal(formatRoute({ view: 'settings', section: 'ai-sync' }), '#settings/ai-sync');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/route.test.ts`
Expected: FAIL con `Cannot find module './route'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/route.ts
/**
 * Vista corrente indirizzata dall'hash: `''` → documento, `#settings[/<sezione>]` → impostazioni.
 * Niente router: l'hash non porta mai dati (percorsi, nomi, chiavi), solo la sezione.
 */
export const SETTINGS_SECTIONS = ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type Route = { view: 'workspace' } | { view: 'settings'; section: SettingsSection };

const isSection = (value: string): value is SettingsSection => (SETTINGS_SECTIONS as readonly string[]).includes(value);

export function parseRoute(hash: string): Route {
  const [head, section, ...rest] = hash.replace(/^#/, '').split('/');
  if (head !== 'settings') return { view: 'workspace' };
  if (section === undefined || rest.length > 0 || !isSection(section)) return { view: 'settings', section: 'general' };
  return { view: 'settings', section };
}

export function formatRoute(route: Route): string {
  if (route.view === 'workspace') return '';
  return route.section === 'general' ? '#settings' : `#settings/${route.section}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/route.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/route.ts src/lib/route.test.ts
git commit -m "feat: modulo route per le impostazioni indirizzate dall'hash"
```

---

### Task 2: `composerKeys` — cosa fa un tasto nel composer

**Files:**
- Create: `src/ai/composerKeys.ts`
- Test: `src/ai/composerKeys.test.ts`

**Interfaces:**
- Produces:
  - `interface ComposerKey { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; isComposing: boolean }`
  - `type ComposerAction = 'send' | 'newline' | 'stop' | 'none'`
  - `composerAction(event: ComposerKey, running: boolean): ComposerAction`

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/composerKeys.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { composerAction, type ComposerKey } from './composerKeys';

const key = (k: string, extra: Partial<ComposerKey> = {}): ComposerKey => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

test('Enter sends, Shift+Enter goes to a new line', () => {
  assert.equal(composerAction(key('Enter'), false), 'send');
  assert.equal(composerAction(key('Enter', { shiftKey: true }), false), 'newline');
});

test('Enter during IME composition does nothing', () => {
  assert.equal(composerAction(key('Enter', { isComposing: true }), false), 'none');
  assert.equal(composerAction(key('Process', { isComposing: true }), false), 'none');
});

test('Ctrl, Cmd and Alt with Enter do nothing (the old Ctrl+Enter is gone)', () => {
  assert.equal(composerAction(key('Enter', { ctrlKey: true }), false), 'none');
  assert.equal(composerAction(key('Enter', { metaKey: true }), false), 'none');
  assert.equal(composerAction(key('Enter', { altKey: true }), false), 'none');
});

test('Escape stops only while running', () => {
  assert.equal(composerAction(key('Escape'), true), 'stop');
  assert.equal(composerAction(key('Escape'), false), 'none');
});

test('Enter while running still reports send (the caller ignores it)', () => {
  assert.equal(composerAction(key('Enter'), true), 'send');
});

test('other keys do nothing', () => {
  assert.equal(composerAction(key('a'), false), 'none');
  assert.equal(composerAction(key('ArrowUp'), true), 'none');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/ai/composerKeys.test.ts`
Expected: FAIL con `Cannot find module './composerKeys'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/composerKeys.ts
/** Tasti del composer AI (puro): Invio invia, Shift+Invio va a capo, Esc ferma la generazione. */
export interface ComposerKey {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Composizione IME in corso: l'Invio conferma i caratteri, non il messaggio. */
  isComposing: boolean;
}

export type ComposerAction = 'send' | 'newline' | 'stop' | 'none';

export function composerAction(event: ComposerKey, running: boolean): ComposerAction {
  if (event.isComposing) return 'none';
  if (event.key === 'Escape') return running ? 'stop' : 'none';
  if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) return 'none';
  return event.shiftKey ? 'newline' : 'send';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/ai/composerKeys.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add src/ai/composerKeys.ts src/ai/composerKeys.test.ts
git commit -m "feat: composerKeys, Invio invia e Shift+Invio va a capo"
```

---

### Task 3: `selectionChip` — etichetta del chip della selezione

**Files:**
- Create: `src/ai/selectionChip.ts`
- Test: `src/ai/selectionChip.test.ts`

**Interfaces:**
- Produces:
  - `type TextRange = { from: number; to: number }`
  - `selectionLabel(text: string, range: TextRange | null): { lines: number; chars: number } | null`
  - `sameRange(a: TextRange | null, b: TextRange | null): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/selectionChip.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { sameRange, selectionLabel } from './selectionChip';

const text = 'uno\ndue\ntre\n\n   \nquattro';

test('no range or an empty range gives no chip', () => {
  assert.equal(selectionLabel(text, null), null);
  assert.equal(selectionLabel(text, { from: 2, to: 2 }), null);
});

test('a selection of only spaces or newlines gives no chip', () => {
  const blank = text.indexOf('\n\n');
  assert.equal(selectionLabel(text, { from: blank, to: blank + 6 }), null);
});

test('a single-line selection counts characters', () => {
  assert.deepEqual(selectionLabel(text, { from: 0, to: 3 }), { lines: 1, chars: 3 });
});

test('a multi-line selection counts lines, ignoring a trailing newline', () => {
  assert.deepEqual(selectionLabel(text, { from: 0, to: 11 }), { lines: 3, chars: 11 });
  assert.deepEqual(selectionLabel(text, { from: 0, to: 12 }), { lines: 3, chars: 12 }, 'uno\\ndue\\ntre\\n');
});

test('a range past the end of the text is clamped', () => {
  assert.deepEqual(selectionLabel('abc', { from: 1, to: 99 }), { lines: 1, chars: 2 });
});

test('sameRange compares positions and nulls', () => {
  assert.equal(sameRange(null, null), true);
  assert.equal(sameRange({ from: 1, to: 2 }, { from: 1, to: 2 }), true);
  assert.equal(sameRange({ from: 1, to: 2 }, { from: 1, to: 3 }), false);
  assert.equal(sameRange(null, { from: 1, to: 2 }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/ai/selectionChip.test.ts`
Expected: FAIL con `Cannot find module './selectionChip'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/selectionChip.ts
/** Chip della selezione nel composer (puro): cosa mostrare per il tratto selezionato nell'editor. */
export type TextRange = { from: number; to: number };

export function selectionLabel(text: string, range: TextRange | null): { lines: number; chars: number } | null {
  if (!range) return null;
  const from = Math.max(0, Math.min(range.from, text.length));
  const to = Math.max(from, Math.min(range.to, text.length));
  const selected = text.slice(from, to);
  if (selected.trim() === '') return null;
  // Un a capo finale non apre una riga in più: "a\nb\n" sono due righe.
  const lines = selected.replace(/\n$/, '').split('\n').length;
  return { lines, chars: selected.length };
}

export function sameRange(a: TextRange | null, b: TextRange | null): boolean {
  if (a === null || b === null) return a === b;
  return a.from === b.from && a.to === b.to;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/ai/selectionChip.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add src/ai/selectionChip.ts src/ai/selectionChip.test.ts
git commit -m "feat: selectionChip, etichetta della selezione per il composer"
```

---

### Task 4: `reviewStatus` — cosa mostra la barra di revisione

**Files:**
- Create: `src/ai/reviewStatus.ts`
- Test: `src/ai/reviewStatus.test.ts`

**Interfaces:**
- Consumes: `Proposal` da `src/ai/types.ts`.
- Produces:
  - `type ReviewStatus = { kind: 'none' } | { kind: 'generating'; seconds: number; done?: number; total?: number } | { kind: 'partial' } | { kind: 'truncated' } | { kind: 'scopeLost' } | { kind: 'applied' }`
  - `reviewStatus(input: { proposal: Proposal | undefined; running: { path: string } | null; elapsedSeconds: number; applied: boolean }): ReviewStatus`
  - `isBusy(status: ReviewStatus): boolean` — vero per `generating` (frecce e Scarta disabilitati).

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/reviewStatus.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { Proposal } from './types';
import { isBusy, reviewStatus } from './reviewStatus';

const proposal = (extra: Partial<Proposal> = {}): Proposal => ({
  path: 'a.md',
  baseText: 'a',
  text: 'b',
  origin: 'ai',
  status: 'complete',
  snapshotTaken: false,
  createdAt: 1,
  ...extra,
});
const base = { running: null, elapsedSeconds: 0, applied: false };

test('no proposal shows nothing', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: undefined }), { kind: 'none' });
});

test('a run on this path is generating, with parts when known', () => {
  const p = proposal({ status: 'streaming', progress: { done: 3, total: 7 } });
  assert.deepEqual(reviewStatus({ ...base, proposal: p, running: { path: 'a.md' }, elapsedSeconds: 12 }), {
    kind: 'generating',
    seconds: 12,
    done: 3,
    total: 7,
  });
});

test('a run on another path does not make this proposal generating', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal(), running: { path: 'b.md' } }), { kind: 'none' });
});

test('a streaming proposal without a run is still generating, never applied', () => {
  const status = reviewStatus({ ...base, proposal: proposal({ status: 'streaming' }), applied: true });
  assert.deepEqual(status, { kind: 'generating', seconds: 0 });
  assert.equal(isBusy(status), true);
});

test('a lost selection wins over partial, truncated and applied', () => {
  const lost = { originalText: 'x', from: 0, to: 1, status: 'lost' as const };
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'partial', scope: lost }), applied: true }), { kind: 'scopeLost' });
});

test('partial and truncated proposals say so', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'partial' }) }), { kind: 'partial' });
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal({ status: 'truncated' }) }), { kind: 'truncated' });
});

test('a complete proposal is applied or shows nothing', () => {
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal(), applied: true }), { kind: 'applied' });
  assert.deepEqual(reviewStatus({ ...base, proposal: proposal() }), { kind: 'none' });
  assert.equal(isBusy({ kind: 'none' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/ai/reviewStatus.test.ts`
Expected: FAIL con `Cannot find module './reviewStatus'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/reviewStatus.ts
import type { Proposal } from './types';

/** Stato mostrato dalla barra di revisione (puro): compare solo quando c'è qualcosa da dire. */
export type ReviewStatus =
  | { kind: 'none' }
  | { kind: 'generating'; seconds: number; done?: number; total?: number }
  | { kind: 'partial' }
  | { kind: 'truncated' }
  | { kind: 'scopeLost' }
  | { kind: 'applied' };

interface Input {
  proposal: Proposal | undefined;
  running: { path: string } | null;
  elapsedSeconds: number;
  /** Calcolato da ReviewView: il testo applicabile coincide con il documento. */
  applied: boolean;
}

export function reviewStatus({ proposal, running, elapsedSeconds, applied }: Input): ReviewStatus {
  if (!proposal) return { kind: 'none' };
  const mine = running?.path === proposal.path;
  if (mine || proposal.status === 'streaming') {
    const seconds = mine ? elapsedSeconds : 0;
    return proposal.progress ? { kind: 'generating', seconds, ...proposal.progress } : { kind: 'generating', seconds };
  }
  if (proposal.scope?.status === 'lost') return { kind: 'scopeLost' };
  if (proposal.status === 'partial') return { kind: 'partial' };
  if (proposal.status === 'truncated') return { kind: 'truncated' };
  return applied ? { kind: 'applied' } : { kind: 'none' };
}

export function isBusy(status: ReviewStatus): boolean {
  return status.kind === 'generating';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/ai/reviewStatus.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add src/ai/reviewStatus.ts src/ai/reviewStatus.test.ts
git commit -m "feat: reviewStatus, stati essenziali della barra di revisione"
```

---

### Task 5: chiavi i18n nuove e aggiornate, icone nuove

**Files:**
- Create (temporaneo, non committato): `/tmp/housemd-ai-ui-keys.json`
- Modify: `src/i18n/locales/{en,it,es,fr,de,pt,nl,pl,ja}.json`
- Modify: `src/ui/icons.ts`
- Test: `src/i18n/locales.test.ts` (esistente), `src/ui/icons.test.ts` (esistente)

**Interfaces:**
- Produces (chiavi `MessageKey`): `mode.ai`, `ai.selectionLines` (`{count}`), `ai.selectionChars` (`{count}`), `ai.selectionIgnore`, `ai.suggestions`, `ai.generating` (`{seconds}`), `ai.warningsCount` (`{count}`), `settings.sections`, `settings.general`, `settings.aiProfiles`, `settings.aiPresets`, `settings.aiSync`, `ai.deleteTitle` (`{name}`), `ai.deleteMessage`, `ai.unsavedTitle`, `ai.unsavedMessage`, `ai.discardChanges`; testi aggiornati di `ai.request` e `ai.emptyProposal`.
- Produces (`IconName`): `modeAi`, `send`, `stop`, `chevronUp`, `chevronDown`.

- [ ] **Step 1: Scrivere il file delle traduzioni**

```bash
cat > /tmp/housemd-ai-ui-keys.json <<'EOF'
{
  "mode.ai": { "en": "AI", "it": "AI", "es": "IA", "fr": "IA", "de": "KI", "pt": "IA", "nl": "AI", "pl": "AI", "ja": "AI" },
  "ai.selectionLines": { "en": "Selection · {count} lines", "it": "Selezione · {count} righe", "es": "Selección · {count} líneas", "fr": "Sélection · {count} lignes", "de": "Auswahl · {count} Zeilen", "pt": "Seleção · {count} linhas", "nl": "Selectie · {count} regels", "pl": "Zaznaczenie · {count} wierszy", "ja": "選択範囲 · {count} 行" },
  "ai.selectionChars": { "en": "Selection · {count} characters", "it": "Selezione · {count} caratteri", "es": "Selección · {count} caracteres", "fr": "Sélection · {count} caractères", "de": "Auswahl · {count} Zeichen", "pt": "Seleção · {count} caracteres", "nl": "Selectie · {count} tekens", "pl": "Zaznaczenie · {count} znaków", "ja": "選択範囲 · {count} 文字" },
  "ai.selectionIgnore": { "en": "Use the whole document", "it": "Usa tutto il documento", "es": "Usar todo el documento", "fr": "Utiliser tout le document", "de": "Ganzes Dokument verwenden", "pt": "Usar o documento inteiro", "nl": "Hele document gebruiken", "pl": "Użyj całego dokumentu", "ja": "文書全体を使う" },
  "ai.suggestions": { "en": "Suggestions", "it": "Suggerimenti", "es": "Sugerencias", "fr": "Suggestions", "de": "Vorschläge", "pt": "Sugestões", "nl": "Suggesties", "pl": "Sugestie", "ja": "候補" },
  "ai.generating": { "en": "Generating… {seconds} s", "it": "Generazione… {seconds} s", "es": "Generando… {seconds} s", "fr": "Génération… {seconds} s", "de": "Wird erzeugt… {seconds} s", "pt": "Gerando… {seconds} s", "nl": "Bezig… {seconds} s", "pl": "Generowanie… {seconds} s", "ja": "生成中… {seconds} 秒" },
  "ai.warningsCount": { "en": "{count} warnings", "it": "{count} avvisi", "es": "{count} avisos", "fr": "{count} avertissements", "de": "{count} Hinweise", "pt": "{count} avisos", "nl": "{count} waarschuwingen", "pl": "Ostrzeżenia: {count}", "ja": "警告 {count} 件" },
  "settings.sections": { "en": "Settings sections", "it": "Sezioni delle impostazioni", "es": "Secciones de ajustes", "fr": "Sections des réglages", "de": "Einstellungsbereiche", "pt": "Seções das configurações", "nl": "Onderdelen van instellingen", "pl": "Sekcje ustawień", "ja": "設定の項目" },
  "settings.general": { "en": "General", "it": "Generale", "es": "General", "fr": "Général", "de": "Allgemein", "pt": "Geral", "nl": "Algemeen", "pl": "Ogólne", "ja": "一般" },
  "settings.aiProfiles": { "en": "AI · Profiles", "it": "AI · Profili", "es": "IA · Perfiles", "fr": "IA · Profils", "de": "KI · Profile", "pt": "IA · Perfis", "nl": "AI · Profielen", "pl": "AI · Profile", "ja": "AI · プロファイル" },
  "settings.aiPresets": { "en": "AI · Presets", "it": "AI · Preset", "es": "IA · Plantillas", "fr": "IA · Préréglages", "de": "KI · Vorlagen", "pt": "IA · Predefinições", "nl": "AI · Voorinstellingen", "pl": "AI · Szablony", "ja": "AI · プリセット" },
  "settings.aiSync": { "en": "AI · Sync", "it": "AI · Sincronizzazione", "es": "IA · Sincronización", "fr": "IA · Synchronisation", "de": "KI · Synchronisierung", "pt": "IA · Sincronização", "nl": "AI · Synchronisatie", "pl": "AI · Synchronizacja", "ja": "AI · 同期" },
  "ai.deleteTitle": { "en": "Delete “{name}”?", "it": "Eliminare «{name}»?", "es": "¿Eliminar «{name}»?", "fr": "Supprimer « {name} » ?", "de": "„{name}“ löschen?", "pt": "Excluir “{name}”?", "nl": "“{name}” verwijderen?", "pl": "Usunąć „{name}”?", "ja": "「{name}」を削除しますか？" },
  "ai.deleteMessage": { "en": "This cannot be undone.", "it": "L'operazione non si può annullare.", "es": "Esta acción no se puede deshacer.", "fr": "Cette action est irréversible.", "de": "Das kann nicht rückgängig gemacht werden.", "pt": "Esta ação não pode ser desfeita.", "nl": "Dit kan niet ongedaan worden gemaakt.", "pl": "Tej operacji nie można cofnąć.", "ja": "この操作は元に戻せません。" },
  "ai.unsavedTitle": { "en": "Discard unsaved changes?", "it": "Scartare le modifiche non salvate?", "es": "¿Descartar los cambios sin guardar?", "fr": "Abandonner les modifications non enregistrées ?", "de": "Ungespeicherte Änderungen verwerfen?", "pt": "Descartar alterações não salvas?", "nl": "Niet-opgeslagen wijzigingen negeren?", "pl": "Odrzucić niezapisane zmiany?", "ja": "保存されていない変更を破棄しますか？" },
  "ai.unsavedMessage": { "en": "The changes to this item have not been saved.", "it": "Le modifiche a questo elemento non sono state salvate.", "es": "Los cambios de este elemento no se han guardado.", "fr": "Les modifications de cet élément n'ont pas été enregistrées.", "de": "Die Änderungen an diesem Element wurden nicht gespeichert.", "pt": "As alterações deste item não foram salvas.", "nl": "De wijzigingen aan dit item zijn niet opgeslagen.", "pl": "Zmiany w tym elemencie nie zostały zapisane.", "ja": "この項目の変更は保存されていません。" },
  "ai.discardChanges": { "en": "Discard changes", "it": "Scarta le modifiche", "es": "Descartar cambios", "fr": "Abandonner les modifications", "de": "Änderungen verwerfen", "pt": "Descartar alterações", "nl": "Wijzigingen negeren", "pl": "Odrzuć zmiany", "ja": "変更を破棄" },
  "ai.request": { "en": "Ask about this document… (Shift+Enter for a new line)", "it": "Chiedi qualcosa su questo documento… (Shift+Invio per andare a capo)", "es": "Pregunta sobre este documento… (Mayús+Intro para nueva línea)", "fr": "Posez une question sur ce document… (Maj+Entrée pour aller à la ligne)", "de": "Frage zu diesem Dokument… (Umschalt+Enter für neue Zeile)", "pt": "Pergunte sobre este documento… (Shift+Enter para nova linha)", "nl": "Vraag iets over dit document… (Shift+Enter voor een nieuwe regel)", "pl": "Zapytaj o ten dokument… (Shift+Enter – nowy wiersz)", "ja": "この文書について質問…（Shift+Enter で改行）" },
  "ai.emptyProposal": { "en": "Write a request or pick a suggestion.", "it": "Scrivi una richiesta o scegli un suggerimento.", "es": "Escribe una petición o elige una sugerencia.", "fr": "Écrivez une demande ou choisissez une suggestion.", "de": "Schreib eine Anfrage oder wähle einen Vorschlag.", "pt": "Escreva um pedido ou escolha uma sugestão.", "nl": "Schrijf een verzoek of kies een suggestie.", "pl": "Napisz prośbę lub wybierz sugestię.", "ja": "リクエストを書くか、候補を選んでください。" }
}
EOF
```

- [ ] **Step 2: Unire le chiavi in tutti i locali**

```bash
node -e '
const fs=require("fs");const keys=JSON.parse(fs.readFileSync("/tmp/housemd-ai-ui-keys.json","utf8"));
for(const l of ["en","it","es","fr","de","pt","nl","pl","ja"]){
  const p=`src/i18n/locales/${l}.json`;const m=JSON.parse(fs.readFileSync(p,"utf8"));
  for(const [k,v] of Object.entries(keys)){if(!v[l])throw Error(`${k}/${l}`);m[k]=v[l];}
  fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n");
}'
git diff --stat src/i18n/locales
```

Expected: 9 file modificati. Controllare con `git diff src/i18n/locales/en.json` che l'indentazione del file resti a 2 spazi e che le chiavi esistenti non cambino ordine (le nuove sono in fondo, `ai.request` e `ai.emptyProposal` restano al loro posto).

- [ ] **Step 3: Aggiungere le icone**

In `src/ui/icons.ts`, dopo `import chevronDown …` aggiungere gli import (in ordine alfabetico con gli altri):

```ts
import arrowUp from 'pixelarticons/svg/arrow-up.svg?url';
import chevronUp from 'pixelarticons/svg/chevron-up.svg?url';
import sparkles from 'pixelarticons/svg/sparkles.svg?url';
import stopSolid from 'pixelarticons/svg/stop-solid.svg?url';
```

e in `ICONS`, dopo `modePreview: eye,`:

```ts
  modeAi: sparkles,
  send: arrowUp,
  stop: stopSolid,
  chevronUp,
  chevronDown,
```

(`chevronDown` è già importato per `folderOpen`: il nuovo nome riusa lo stesso import, non un secondo `import`.)

- [ ] **Step 4: Verificare**

Run: `npx tsx --test src/i18n/locales.test.ts src/ui/icons.test.ts && npm run lint`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales src/ui/icons.ts
git commit -m "feat: chiavi i18n e icone per la nuova UI AI"
```

---

### Task 6: toast presentazionali, errori AI nei toast, via `AiNotice`

**Files:**
- Modify: `src/ui/Toasts.tsx`
- Create: `src/ui/ai/useAiState.ts`
- Modify: `src/ui/WorkspaceView.tsx` (import, `dismissToast`, render di `Toasts`, rimozione di `AiNotice`)
- Delete: `src/ui/ai/AiNotice.tsx`
- Modify: `src/ui/ai/AiSidebar.tsx` (solo: togliere il `<p role="alert">`)

**Interfaces:**
- Consumes: `AiController.subscribe`, `AiController.getState`, `AiController.clearError` (esistenti; `subscribe`/`getState` sono già passati "slegati" a `useSyncExternalStore` nel codice attuale).
- Produces:
  - `interface ToastItem { key: string; kind: Toast['kind']; text: string }` esportata da `src/ui/Toasts.tsx`
  - `Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (key: string) => void })`
  - `useAiState(ai: AiController | null): AiState | null` in `src/ui/ai/useAiState.ts`

- [ ] **Step 1: `useAiState`**

```ts
// src/ui/ai/useAiState.ts
import { useSyncExternalStore } from 'react';

import type { AiController, AiState } from '../../ai/aiController';

const noSubscribe = () => () => {};
const noState = () => null;

/** Stato del controller AI, o null finché il controller non è pronto (o non esiste). */
export function useAiState(ai: AiController | null): AiState | null {
  return useSyncExternalStore(ai ? ai.subscribe : noSubscribe, ai ? ai.getState : noState);
}
```

Verificare che `AiState` sia esportato da `src/ai/aiController.ts` (riga 11: `export interface AiState`). Se `subscribe`/`getState` non fossero proprietà arrow, `useSyncExternalStore(controller.subscribe, …)` nel codice attuale non funzionerebbe già: nessuna modifica al controller.

- [ ] **Step 2: `Toasts` presentazionale**

Sostituire in `src/ui/Toasts.tsx` l'interfaccia `Props`, la firma e il render:

```tsx
import { useEffect, useRef } from 'react';

import { useT } from '../i18n/I18nProvider';
import type { Toast } from '../workspace/toasts';
import { Icon } from './Icon';
import styles from './Toasts.module.css';

/** Un toast già tradotto: il Workspace e il controller AI hanno codici diversi, qui arriva solo testo. */
export interface ToastItem {
  key: string;
  kind: Toast['kind'];
  text: string;
}

interface Props {
  items: ToastItem[];
  onDismiss: (key: string) => void;
}

const INFO_TIMEOUT_MS = 6000;
/** `popover` come attributo: resta visibile finché non lo chiudiamo noi (popover="manual"). */
const manualPopover = { popover: 'manual' } as Record<string, string>;

export function Toasts({ items, onDismiss }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const open = el.matches(':popover-open');
    if (items.length > 0 && !open) el.showPopover();
    if (items.length === 0 && open) el.hidePopover();
  }, [items.length]);

  useEffect(() => {
    const timers = items
      .filter((item) => item.kind === 'info')
      .map((item) => setTimeout(() => onDismiss(item.key), INFO_TIMEOUT_MS));
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  return (
    <div ref={ref} {...manualPopover} className={styles.toasts}>
      {items.map((item) => (
        <div key={item.key} className={styles.toast} data-kind={item.kind} role={item.kind === 'error' ? 'alert' : 'status'}>
          <p>{item.text}</p>
          <button aria-label={t('toast.close')} title={t('toast.close')} onClick={() => onDismiss(item.key)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `WorkspaceView` compone la lista**

In `src/ui/WorkspaceView.tsx`:
1. togliere `import { AiNotice } from './ai/AiNotice';`, aggiungere `import { useAiState } from './ai/useAiState';` e cambiare `import { Toasts } from './Toasts';` in `import { Toasts, type ToastItem } from './Toasts';`;
2. dopo `const ai = useAiController(workspace);` aggiungere `const aiState = useAiState(ai);`;
3. sostituire `const dismissToast = useCallback((id: number) => workspace.dismissToast(id), [workspace]);` con:

```tsx
  const toastItems = useMemo<ToastItem[]>(
    () => [
      ...state.toasts.map((toast) => ({ key: `ws-${toast.id}`, kind: toast.kind, text: t(`toast.${toast.code}`, toast.params) })),
      // Errori AI non legati a un messaggio (sync, chiave, selezione persa): stesso contenitore dei toast.
      ...(aiState?.error ? [{ key: 'ai-error', kind: 'error' as const, text: t(`ai.error.${aiState.error}` as MessageKey) }] : []),
    ],
    [state.toasts, aiState?.error, t],
  );
  const dismissToast = useCallback(
    (key: string) => {
      if (key === 'ai-error') ai?.clearError();
      else workspace.dismissToast(Number(key.slice('ws-'.length)));
    },
    [workspace, ai],
  );
```

4. in fondo al JSX togliere `{ai && <AiNotice controller={ai}/>}` e sostituire `<Toasts toasts={state.toasts} onDismiss={dismissToast} />` con `<Toasts items={toastItems} onDismiss={dismissToast} />`.

- [ ] **Step 4: Togliere il doppione nella sidebar e `AiNotice`**

In `src/ui/ai/AiSidebar.tsx` togliere la riga
`{state.error&&<p role="alert">{t(`ai.error.${state.error}` as MessageKey)}<button onClick={()=>controller.clearError()}>{t('settings.close')}</button></p>}`
e poi:

```bash
git rm src/ui/ai/AiNotice.tsx
grep -rn "AiNotice\|ai-notice" src tests || echo "nessun riferimento"
```

Expected: `nessun riferimento` (la regola `.ai-notice` in `ai.css` sparisce con il file in Task 16; se `grep` la trova solo lì va bene).

- [ ] **Step 5: Verificare e committare**

Run: `npm test && npm run lint`
Expected: PASS.

```bash
git add -A src/ui/Toasts.tsx src/ui/ai/useAiState.ts src/ui/WorkspaceView.tsx src/ui/ai/AiSidebar.tsx
git commit -m "refactor: errori AI nei toast dell'app, via AiNotice"
```

---

### Task 7: selezione reattiva dall'editor

**Files:**
- Modify: `src/editor/Editor.tsx` (prop `onSelection` in `EditorProps`)
- Modify: `src/editor/docExtensions.ts` (updateListener)
- Modify: `src/ui/WorkspaceView.tsx` (stato `aiSelection`)

**Interfaces:**
- Consumes: `sameRange`, `TextRange` (Task 3).
- Produces: `EditorProps.onSelection?: (range: TextRange | null) => void`; in `WorkspaceView` `aiSelection: TextRange | null` e `onSelection` stabile, passati ad `AiSidebar` e all'editor di `ReviewView` in Task 9/11.

- [ ] **Step 1: Prop e listener**

In `src/editor/Editor.tsx`, in `EditorProps` dopo `onTopLine`:

```ts
  /** Selezione principale cambiata (null se vuota): usata dal chip della selezione del composer AI. */
  onSelection?: (range: { from: number; to: number } | null) => void;
```

In `src/editor/docExtensions.ts`, nell'`EditorView.updateListener.of((update) => { … })` esistente, prima di `if (callbacks.current.session) saveDocSession(…)`:

```ts
        if (update.selectionSet || update.docChanged) {
          const main = update.state.selection.main;
          callbacks.current.onSelection?.(main.empty ? null : { from: main.from, to: main.to });
        }
```

(`DiffPane` usa `docExtensions(callbacks)` con `callbacks = useRef(props.editor)`: il lato sinistro del diff riceve la stessa prop senza altre modifiche.)

- [ ] **Step 2: Stato in `WorkspaceView`**

Aggiungere l'import `import { sameRange, type TextRange } from '../ai/selectionChip';` e, dopo la dichiarazione di `session`:

```tsx
  const [aiSelection, setAiSelection] = useState<TextRange | null>(null);
  // onSelection scatta a ogni movimento del cursore: si aggiorna lo stato solo se il tratto cambia.
  const onSelection = useCallback((range: TextRange | null) => setAiSelection((prev) => (sameRange(prev, range) ? prev : range)), []);
  useEffect(() => setAiSelection(null), [doc?.path, doc?.revision]);
  void aiSelection; // letto da AiSidebar in Task 11 (tsconfig ha noUnusedLocals)
```

Nel render di `ReviewView` (l'oggetto `editor={{ … }}` in linea) aggiungere `onSelection` accanto a `onTopLine: () => {}`: in modalità AI l'editor è lì.

- [ ] **Step 3: Verificare e committare**

Run: `npm test && npm run lint`
Expected: PASS.

```bash
git add src/editor/Editor.tsx src/editor/docExtensions.ts src/ui/WorkspaceView.tsx
git commit -m "feat: l'editor comunica i cambi di selezione"
```

---

### Task 8: `ModelChip`, `EffortChip`, `Parameters` e `ModelSelect` formattati

**Files:**
- Create: `src/ui/ai/Parameters.tsx`, `src/ui/ai/ModelChip.tsx`, `src/ui/ai/EffortChip.tsx`, `src/ui/ai/Composer.module.css`
- Modify: `src/ui/ai/ModelSelect.tsx` (solo formattazione e classi)
- Modify: `src/ui/ai/settings/AiProfilesSection.tsx`, `src/ui/ai/settings/AiPresetsSection.tsx` (import di `Parameters` da `../Parameters`)
- Delete: `src/ui/ai/ModelSelector.tsx`
- Modify: `src/ui/ai/AiSidebar.tsx` (usa `ModelChip` al posto di `ModelSelector`, provvisoriamente in cima)

**Interfaces:**
- Consumes: `capabilities`, `effectiveProfile`, `isLocalProfile` (esistenti), `writePref`.
- Produces:
  - `Parameters({ profile, value, onChange, hideEffort? }: { profile: ModelProfile; value: GenParams; onChange: (p: GenParams) => void; hideEffort?: boolean })`
  - `ModelChip({ controller, onManage }: { controller: AiController; onManage: () => void })`
  - `EffortChip({ controller }: { controller: AiController })` — non rende nulla se il profilo non supporta l'effort.
  - `Composer.module.css` con le classi `composer`, `input`, `row`, `chip`, `chipAnchor`, `popover`, `popoverSection`, `popoverActions`, `send`, `selection`, `selectionClose`, `suggestions`, `suggestion`, `link`.

- [ ] **Step 1: `Parameters.tsx`** (estratto da `ModelSelector.tsx`, con `hideEffort`)

```tsx
// src/ui/ai/Parameters.tsx
import { capabilities } from '../../ai/capabilities';
import type { GenParams, ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

const NUMERIC = ['temperature', 'topP', 'maxOutputTokens', 'chunkChars'] as const;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

interface Props {
  profile: ModelProfile;
  value: GenParams;
  onChange: (params: GenParams) => void;
  /** Nel popover del modello l'effort ha il suo chip: qui non va ripetuto. */
  hideEffort?: boolean;
}

export function Parameters({ profile, value, onChange, hideEffort = false }: Props) {
  const t = useT();
  const caps = capabilities(profile.kind, profile.model, { effort: !!profile.params.effort });
  return (
    <div className={styles.popoverSection}>
      {NUMERIC.filter((k) => caps[k]).map((k) => {
        const unit = k === 'temperature' || k === 'topP';
        return (
          <label key={k}>
            <span>{t(`ai.param.${k}`)}</span>
            <input
              type="number"
              min={unit ? 0 : 1}
              max={k === 'temperature' ? 2 : k === 'topP' ? 1 : undefined}
              step={unit ? 0.1 : 1}
              value={value[k] ?? ''}
              onChange={(e) => onChange({ ...value, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </label>
        );
      })}
      {caps.effort && !hideEffort && (
        <label>
          <span>{t('ai.param.effort')}</span>
          <select value={value.effort ?? ''} onChange={(e) => onChange({ ...value, effort: (e.target.value as GenParams['effort']) || undefined })}>
            <option value="">{t('ai.default')}</option>
            {EFFORTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `ModelSelect.tsx` formattato** (stessa logica di oggi)

```tsx
// src/ui/ai/ModelSelect.tsx
import { useEffect, useState } from 'react';

import type { AiController } from '../../ai/aiController';
import { modelOptions } from '../../ai/models';
import { modelSelection } from '../../ai/profiles';
import type { ModelOption, ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

interface Props {
  controller: AiController;
  profile: ModelProfile;
  onChange: (selection: Pick<ModelProfile, 'model' | 'contextTokens'>) => void;
}

export function ModelSelect({ controller, profile, onChange }: Props) {
  const t = useT();
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setModels(null);
    void controller
      .provider(profile)
      .then((p) => p.listModels(abort.signal))
      .then((list) => {
        if (abort.signal.aborted) return;
        setModels(list);
        if (!list) setError(true);
      })
      .catch((e) => {
        if (abort.signal.aborted) return;
        setError(true);
        controller.report(e);
      });
    return () => abort.abort();
  }, [profile.kind, profile.baseUrl, profile.secretId, revision, controller]);

  const select = (value: string) => onChange(modelSelection(profile, value, models?.find((m) => m.value === value)));

  return (
    <div className={styles.popoverSection}>
      <label>
        <span>{t('ai.model')}</span>
        <select
          value={custom ? '__custom' : profile.model}
          onChange={(e) => {
            if (e.target.value === '__custom') return setCustom(true);
            setCustom(false);
            select(e.target.value);
          }}
        >
          <option value="">{profile.kind === 'claude-code' ? t('ai.cliDefault') : t('ai.chooseModel')}</option>
          {modelOptions(profile.kind, profile.model, models)
            .filter((m) => m.value)
            .map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          <option value="__custom">{t('ai.other')}</option>
        </select>
      </label>
      {custom && <input aria-label={t('ai.model')} value={profile.model} onChange={(e) => select(e.target.value)} />}
      <button type="button" className={styles.link} onClick={() => setRevision((r) => r + 1)}>
        {t('ai.refresh')}
      </button>
      {error && <small>{t('ai.error.unreachable')}</small>}
    </div>
  );
}
```

- [ ] **Step 3: `ModelChip.tsx`**

```tsx
// src/ui/ai/ModelChip.tsx
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { effectiveProfile, isLocalProfile } from '../../ai/profiles';
import type { ModelProfile } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import { writePref } from '../../lib/prefs';
import { Icon } from '../Icon';
import { ModelSelect } from './ModelSelect';
import { Parameters } from './Parameters';
import styles from './Composer.module.css';

interface Props {
  controller: AiController;
  /** Apre #settings/ai-profiles. */
  onManage: () => void;
}

const autoPopover = { popover: 'auto' } as Record<string, string>;

function privacyNote(t: ReturnType<typeof useT>, profile: ModelProfile): string {
  if (profile.kind === 'claude-code') return t('ai.claudePrivacy');
  if (isLocalProfile(profile)) return t('ai.localPrivacy');
  let host = '';
  try {
    host = new URL(profile.baseUrl).host;
  } catch {
    // URL non valido: la nota resta senza host.
  }
  return t('ai.cloudPrivacy', { host });
}

export function ModelChip({ controller, onManage }: Props) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const profile = controller.profile();
  const overrides = state.chat.overrides;
  const effective = profile ? effectiveProfile(profile, overrides) : null;

  // L'elenco dei modelli si carica solo a popover aperto (niente richieste di rete a ogni render).
  useEffect(() => {
    const el = popover.current;
    if (!el) return;
    const toggle = () => setOpened(el.matches(':popover-open'));
    el.addEventListener('toggle', toggle);
    return () => el.removeEventListener('toggle', toggle);
  }, [profile?.id]);

  if (!profile || !effective) {
    return (
      <button type="button" className={styles.chip} onClick={onManage}>
        {t('ai.manage')}
      </button>
    );
  }

  const label = `${profile.name} · ${effective.model || t('ai.cliDefault')}`;
  const changed = Object.keys(overrides).length > 0;
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));

  return (
    <span className={styles.chipAnchor}>
      <button
        type="button"
        className={`${styles.chip} tooltip`}
        data-tooltip={privacyNote(t, profile)}
        aria-label={`${t('ai.profile')}: ${label}`}
        {...{ popovertarget: id }}
      >
        {label}
        {changed && ' •'}
        <Icon name="chevronDown" size={12} />
      </button>
      <div ref={popover} id={id} {...autoPopover} className={styles.popover}>
        {[true, false].map((local) => {
          const group = state.profiles.filter((p) => isLocalProfile(p) === local);
          if (group.length === 0) return null;
          return (
            <fieldset key={String(local)} className={styles.popoverSection}>
              <legend>{t(local ? 'ai.local' : 'ai.cloud')}</legend>
              {group.map((p) => (
                <label key={p.id}>
                  <input
                    type="radio"
                    name={`${id}-profile`}
                    checked={p.id === profile.id}
                    onChange={() => {
                      controller.selectProfile(p.id);
                      writePref('aiProfile', p.id);
                    }}
                  />
                  {p.name}
                  {p.kind === 'anthropic' && !p.secretId && ' ⚠'}
                </label>
              ))}
            </fieldset>
          );
        })}
        {opened && <ModelSelect controller={controller} profile={effective} onChange={(selection) => controller.override({ ...overrides, ...selection })} />}
        <Parameters
          profile={effective}
          value={{ ...profile.params, ...overrides }}
          onChange={(params) => controller.override({ ...overrides, ...params })}
          hideEffort
        />
        <div className={styles.popoverActions}>
          <button type="button" onClick={() => run(controller.saveOverrides())}>
            {t('ai.saveProfile')}
          </button>
          <button type="button" onClick={() => run(controller.saveOverrides(true))}>
            {t('ai.saveAs')}
          </button>
          <button type="button" onClick={() => controller.override({})}>
            {t('ai.reset')}
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              popover.current?.hidePopover();
              onManage();
            }}
          >
            {t('ai.manage')}
          </button>
        </div>
      </div>
    </span>
  );
}
```

- [ ] **Step 4: `EffortChip.tsx`**

```tsx
// src/ui/ai/EffortChip.tsx
import { useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { capabilities } from '../../ai/capabilities';
import { effectiveProfile } from '../../ai/profiles';
import type { GenParams } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import styles from './Composer.module.css';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Chip dell'effort: solo se il profilo lo supporta (Anthropic, o compatibile OpenAI con effort attivo). */
export function EffortChip({ controller }: { controller: AiController }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const profile = controller.profile();
  if (!profile) return null;
  const effective = effectiveProfile(profile, state.chat.overrides);
  if (!capabilities(effective.kind, effective.model, { effort: !!profile.params.effort }).effort) return null;
  const value = state.chat.overrides.effort ?? profile.params.effort ?? '';
  return (
    <select
      className={styles.chip}
      aria-label={t('ai.param.effort')}
      value={value}
      onChange={(e) => controller.override({ ...state.chat.overrides, effort: (e.target.value as GenParams['effort']) || undefined })}
    >
      <option value="">{t('ai.default')}</option>
      {EFFORTS.map((v) => (
        <option key={v}>{v}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 5: `Composer.module.css`**

```css
/* src/ui/ai/Composer.module.css — composer della chat AI e i suoi popover. */
.composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: var(--c-surface);
}

.composer:focus-within {
  border-color: var(--c-accent);
}

.input {
  field-sizing: content;
  min-height: 2lh;
  max-height: 10lh;
  resize: none;
  border: none;
  outline: none;
  background: none;
  color: var(--c-text);
  font: inherit;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.row > :last-child {
  margin-inline-start: auto;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  color: var(--c-muted);
  font: 13px/1.3 var(--font-ui);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.chip:hover {
  background: var(--c-accent-soft);
  color: var(--c-text);
}

/* Il bottone porta `.tooltip` (che usa anchor-name per il tooltip): l'ancora del popover sta sul wrapper. */
.chipAnchor {
  anchor-name: --ai-model-chip;
  min-width: 0;
}

.popover {
  position-anchor: --ai-model-chip;
  position-area: block-start span-inline-end;
  position-try-fallbacks: flip-block;
  margin: 0 0 6px;
  width: min(22rem, 90vw);
  max-height: 70vh;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface);
  color: var(--c-text);
  box-shadow: 0 4px 20px rgb(0 0 0 / 0.2);
}

.popoverSection {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 10px;
  padding: 0;
  border: none;
}

.popoverSection legend {
  margin-bottom: 4px;
  color: var(--c-muted);
  font-size: 12px;
}

.popoverSection label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.popoverSection label > span {
  flex: 0 0 45%;
}

.popoverSection input:not([type='radio']),
.popoverSection select {
  flex: 1;
  min-width: 0;
}

.popoverActions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.send {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--c-accent);
  color: light-dark(#fff, #042f2e);
  cursor: pointer;
}

.send:disabled {
  background: var(--c-border);
  color: var(--c-muted);
  cursor: default;
}

.selection {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border-radius: 999px;
  background: var(--c-accent-soft);
  font-size: 12px;
}

.selectionClose {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 2px 0;
}

.suggestion {
  padding: 3px 10px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: none;
  color: var(--c-muted);
  font-size: 13px;
  cursor: pointer;
}

.suggestion:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-text);
}

.link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--c-accent);
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 6: Aggiornare gli import e togliere `ModelSelector.tsx`**

- In `src/ui/ai/settings/AiProfilesSection.tsx` e `src/ui/ai/settings/AiPresetsSection.tsx`: `import { Parameters } from '../ModelSelector';` → `import { Parameters } from '../Parameters';`.
- In `src/ui/ai/AiSidebar.tsx`: `import { ModelSelector } from './ModelSelector';` → `import { ModelChip } from './ModelChip';` e `<ModelSelector controller={controller} onSettings={onSettings}/>` → `<ModelChip controller={controller} onManage={onSettings}/>` (posizione provvisoria, il composer arriva in Task 10).

```bash
git rm src/ui/ai/ModelSelector.tsx
grep -rn "ModelSelector" src tests || echo "nessun riferimento"
```

- [ ] **Step 7: Verificare e committare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS, build senza errori.

```bash
git add -A src/ui/ai
git commit -m "feat: chip del modello e dell'effort, Parameters e ModelSelect formattati"
```

---

### Task 9: AI come quarta modalità

**Files:**
- Modify: `src/ui/WorkspaceView.tsx`

**Interfaces:**
- Consumes: icona `modeAi`, chiave `mode.ai` (Task 5); `onSelection`, `aiSelection` (Task 7).
- Produces: `type Mode = 'editor' | 'split' | 'preview' | 'ai'`; `shownMode: Mode` (la modalità effettivamente mostrata); `lastPane: MutableRefObject<PaneMode>` con `type PaneMode = Exclude<Mode, 'ai'>`; props di `AiSidebar` invariate fino a Task 11.

- [ ] **Step 1: Tipi e modalità**

Sostituire il blocco `type Mode` / `MODES` con:

```tsx
type Mode = 'editor' | 'split' | 'preview' | 'ai';
type PaneMode = Exclude<Mode, 'ai'>;

const MODES: Array<{ id: Mode; label: MessageKey; icon: IconName }> = [
  { id: 'editor', label: 'mode.editor', icon: 'modeEditor' },
  { id: 'split', label: 'mode.split', icon: 'modeSplit' },
  { id: 'preview', label: 'mode.preview', icon: 'modePreview' },
  { id: 'ai', label: 'mode.ai', icon: 'modeAi' },
];
/** Ctrl+\ scorre solo le viste del documento, non la revisione AI. */
const PANE_MODES = MODES.filter((m) => m.id !== 'ai');
```

- [ ] **Step 2: Stato**

1. Togliere `const [sidebarView, setSidebarView] = …` e `const switchSidebar = …`.
2. Dopo `const [mode, setMode] = useState<Mode>(…)` aggiungere:

```tsx
  // Preferenza 'ai' con il controller non ancora pronto (IndexedDB lento): intanto la vista divisa.
  const shownMode: Mode = mode === 'ai' && !ai ? 'split' : mode;
  const lastPane = useRef<PaneMode>(mode === 'ai' ? 'split' : mode);
```

3. Sostituire `changeMode` con:

```tsx
  const changeMode = useCallback(
    (next: Mode) => {
      if (next !== 'ai') lastPane.current = next;
      // La chat sta nella sidebar: entrando in AI la si apre.
      else setSidebar(true);
      setMode(next);
      writePref('mode', next);
    },
    [setSidebar],
  );
```

(`setSidebar` è dichiarato prima di `changeMode` nel file: se non lo fosse, spostare la dichiarazione di `setSidebar` sopra.)

- [ ] **Step 3: Sostituire ogni uso di `sidebarView` e di `mode` per il render**

- Ovunque `sidebarView === 'ai'` → `shownMode === 'ai'` (resize, larghezza, `aria-value*`, `gridTemplateColumns`).
- In `restoreVersion`, nell'effetto `queuedRestore` e nel render dei pannelli: `mode` → `shownMode` (le condizioni `mode !== 'preview'`, `mode === 'split'`, `data-mode=…`).
- Scorciatoie, nell'effetto `onKey`:

```tsx
      if (event.key === 'Escape' && shownMode === 'ai') ai?.stop();
      …
        case 'search':
          if (shownMode === 'ai') changeMode(lastPane.current);
          setSidebar(true);
          requestAnimationFrame(() => searchRef.current?.focus());
          break;
        case 'toggleAi':
          if (ai) changeMode(shownMode === 'ai' ? lastPane.current : 'ai');
          break;
        …
        case 'cycleMode':
          changeMode(PANE_MODES[(PANE_MODES.findIndex((m) => m.id === shownMode) + 1) % PANE_MODES.length].id);
          break;
```

  e dipendenze dell'effetto: `[workspace, shownMode, changeMode, setSidebar, sidebarOpen, ai]`.
- Nella sidebar togliere la riga `<div className="ai-bar">{(['files', 'ai'] as const).map(…)}</div>`; la condizione `sidebarView === 'ai' && ai ? <AiSidebar …/> : <>…</>` diventa `shownMode === 'ai' && ai ? <AiSidebar …/> : <>…</>`.
- In toolbar togliere `<button aria-pressed={sidebarView === 'ai'} …>{t('ai.title')}</button>`; nel gruppo modalità iterare su `(ai ? MODES : PANE_MODES)` e usare `aria-pressed={shownMode === m.id}`.
- Bottone Cronologia: `onClick={() => { if (shownMode === 'ai') changeMode(lastPane.current); setHistoryOpen(!historyOpen); }}`.
- Area principale: `doc && sidebarView === 'ai' && ai ? <ReviewView …/>` → `doc && shownMode === 'ai' && ai ? <ReviewView …/>` (le props restano quelle di Task 7, con `onSelection`).

```bash
grep -n "sidebarView\|switchSidebar" src/ui/WorkspaceView.tsx || echo "nessun riferimento"
```

Expected: `nessun riferimento`.

- [ ] **Step 4: Verificare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

Verifica manuale (Review Focus 5) con `npm run dev` in Chrome: DevTools → Application → Local Storage, impostare la preferenza `mode` a `"ai"` (chiave usata da `writePref`, vedi `src/lib/prefs.ts`), ricaricare con la rete limitata ("Slow 4G"): si vede la vista divisa finché il controller non è pronto, poi la vista AI con la sidebar aperta; `Ctrl+Shift+E` torna alla vista precedente; `Ctrl+\` non entra mai in AI; `Ctrl+K` da AI torna ai file con il focus sulla ricerca.

- [ ] **Step 5: Commit**

```bash
git add src/ui/WorkspaceView.tsx
git commit -m "feat: AI come quarta modalità, via i tab Files/AI e il bottone testuale"
```

---

### Task 10: `ChatLog` formattato con stile

**Files:**
- Modify: `src/ui/ai/ChatLog.tsx`
- Create: `src/ui/ai/AiSidebar.module.css`

**Interfaces:**
- Consumes: `ChatMessage` (esistente), `safeRender`, `setSafeHTML`.
- Produces: `ChatLog({ messages, onOpen, onRetry })` con la stessa firma di oggi; `AiSidebar.module.css` con classi `sidebar`, `header`, `title`, `iconButton`, `log`, `message`, `user`, `assistant`, `meta`, `file`, `notice`, `bottom`.

- [ ] **Step 1: `AiSidebar.module.css`**

```css
/* src/ui/ai/AiSidebar.module.css — sidebar della modalità AI. */
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--c-border);
  font-family: var(--font-pixel);
}

.title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: normal;
}

.iconButton {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.iconButton:hover {
  background: var(--c-accent-soft);
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

.bottom {
  padding: 10px;
}
```

- [ ] **Step 2: `ChatLog.tsx`**

```tsx
// src/ui/ai/ChatLog.tsx
import { useEffect, useRef } from 'react';

import { safeRender } from '../../ai/safeRender';
import type { ChatMessage } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { setSafeHTML } from '../../preview/sanitize';
import styles from './AiSidebar.module.css';

/** Markdown della risposta: rendering sicuro (niente HTML grezzo, immagini remote solo su clic). */
function Markdown({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (ref.current) void setSafeHTML(ref.current, safeRender(text));
    });
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return <div ref={ref} />;
}

interface Props {
  messages: ChatMessage[];
  onOpen: (path: string) => void;
  onRetry: (id: string, removeRejected?: boolean) => void;
}

export function ChatLog({ messages, onOpen, onRetry }: Props) {
  const t = useT();
  return (
    <div className={styles.log} role="log">
      {messages.map((m, i) => (
        <article key={m.id} className={styles.message} tabIndex={-1}>
          {m.docPath && m.docPath !== messages[i - 1]?.docPath && (
            <button type="button" className={styles.file} onClick={() => onOpen(m.docPath!)}>
              {m.docPath}
            </button>
          )}
          {m.role === 'user' ? (
            <p className={styles.user}>{m.text}</p>
          ) : (
            <div className={styles.assistant}>
              <Markdown text={m.text || (m.status === 'done' ? t('ai.proposalReady') : t('ai.working'))} />
            </div>
          )}
          {m.summary && (
            <p className={styles.notice}>
              {m.summary.parts} · {m.summary.originalWords} → {m.summary.proposalWords} {t('ai.words')}
            </p>
          )}
          {m.error && <p className={styles.notice}>{t(`ai.error.${m.error}` as MessageKey)}</p>}
          {m.warnings?.map((w, j) => (
            <p key={j} className={styles.notice}>
              {t(`ai.warning.${w.code}` as MessageKey)}
            </p>
          ))}
          {m.status === 'error' && (
            <button type="button" className={styles.file} onClick={() => onRetry(m.id)}>
              {t('ai.retry')}
            </button>
          )}
          {m.error === 'paramRejected' && (
            <button type="button" className={styles.file} onClick={() => onRetry(m.id, true)}>
              {t('ai.reset')} · {t('ai.retry')}
            </button>
          )}
          {m.role === 'assistant' && (
            <small className={styles.meta}>
              {[m.profileName, m.model, m.usage?.inputTokens !== undefined ? `${m.usage.inputTokens} → ${m.usage.outputTokens ?? 0}` : '']
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verificare e committare**

Run: `npm test && npm run lint`
Expected: PASS.

```bash
git add src/ui/ai/ChatLog.tsx src/ui/ai/AiSidebar.module.css
git commit -m "refactor: ChatLog formattato, metadati al passaggio del mouse"
```

---

### Task 11: composer, chip della selezione, suggerimenti e nuova `AiSidebar`

**Files:**
- Create: `src/ui/ai/Composer.tsx`, `src/ui/ai/Suggestions.tsx`
- Modify: `src/ui/ai/AiSidebar.tsx` (riscritto)
- Modify: `src/ui/WorkspaceView.tsx` (props di `AiSidebar`)

**Interfaces:**
- Consumes: `composerAction` (Task 2), `selectionLabel`, `sameRange`, `TextRange` (Task 3), `ModelChip`, `EffortChip` (Task 8), `ChatLog` (Task 10), `aiSelection` (Task 7).
- Produces:
  - `Composer({ controller, text, selection, getSelection, onManage }: { controller: AiController; text: string; selection: TextRange | null; getSelection: () => SelectionScope | undefined; onManage: () => void })`
  - `Suggestions({ controller, onSend }: { controller: AiController; onSend: (presetId: string) => void })`
  - `AiSidebar({ controller, text, selection, getSelection, onSettings, syncNeedsPermission })` dove `onSettings: (section: SettingsSection) => void` (tipo da Task 1).

- [ ] **Step 1: `Composer.tsx`**

Il composer possiede anche l'invio dei preset (i suggerimenti gli passano l'id), così lo scope della selezione è deciso in un solo posto.

```tsx
// src/ui/ai/Composer.tsx
import { forwardRef, useImperativeHandle, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { composerAction } from '../../ai/composerKeys';
import { sameRange, selectionLabel, type TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { Icon } from '../Icon';
import { EffortChip } from './EffortChip';
import { ModelChip } from './ModelChip';
import styles from './Composer.module.css';

export interface ComposerHandle {
  sendPreset(presetId: string): void;
}

interface Props {
  controller: AiController;
  /** Testo del documento corrente, per l'etichetta della selezione. */
  text: string;
  selection: TextRange | null;
  /** Scope calcolato al momento dell'invio dalla sessione dell'editor (invariato rispetto a prima). */
  getSelection: () => SelectionScope | undefined;
  onManage: () => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ controller, text, selection, getSelection, onManage }, ref) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [request, setRequest] = useState('');
  const [ignored, setIgnored] = useState<TextRange | null>(null);
  const label = selectionLabel(text, selection);
  const scoped = label !== null && !sameRange(ignored, selection);
  const running = !!state.running;

  const send = (presetId?: string) => {
    if (running) return;
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    const message = preset ? preset.name || t(`ai.preset.${preset.builtInId}` as MessageKey) : request.trim();
    if (!message || !controller.profile()) return;
    const scope = scoped ? getSelection() : undefined;
    if (scoped && !scope) return controller.report({ code: 'scopeLost' });
    void controller.send(message, preset, scope).catch((e) => controller.report(e));
    if (!preset) setRequest('');
  };

  useImperativeHandle(ref, () => ({ sendPreset: (id) => send(id) }));

  return (
    <div className={styles.composer}>
      {scoped && label && (
        <span className={styles.selection}>
          {label.lines > 1 ? t('ai.selectionLines', { count: label.lines }) : t('ai.selectionChars', { count: label.chars })}
          <button
            type="button"
            className={`${styles.selectionClose} tooltip`}
            aria-label={t('ai.selectionIgnore')}
            data-tooltip={t('ai.selectionIgnore')}
            onClick={() => setIgnored(selection)}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      )}
      <textarea
        className={styles.input}
        aria-label={t('ai.request')}
        placeholder={t('ai.request')}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        onKeyDown={(e) => {
          const action = composerAction(
            { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.nativeEvent.isComposing },
            running,
          );
          if (action === 'send') {
            e.preventDefault();
            send();
          } else if (action === 'stop') {
            e.preventDefault();
            controller.stop();
          }
        }}
      />
      <div className={styles.row}>
        <ModelChip controller={controller} onManage={onManage} />
        <EffortChip controller={controller} />
        {running ? (
          <button type="button" className={`${styles.send} tooltip`} aria-label={t('ai.stop')} data-tooltip={t('ai.stop')} onClick={() => controller.stop()}>
            <Icon name="stop" size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.send} tooltip`}
            aria-label={t('ai.send')}
            data-tooltip={t('ai.send')}
            disabled={!request.trim() || !controller.profile()}
            onClick={() => send()}
          >
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
    </div>
  );
});
```

Nota: `isComposing` va preso da `nativeEvent` perché React 18 non lo espone sull'evento sintetico.

- [ ] **Step 2: `Suggestions.tsx`**

```tsx
// src/ui/ai/Suggestions.tsx
import { useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import styles from './Composer.module.css';

/** Preset visibili come suggerimenti: solo con la chat vuota, tornano con Nuova chat. */
export function Suggestions({ controller, onSend }: { controller: AiController; onSend: (presetId: string) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  if (state.chat.messages.length > 0 || state.running) return null;
  const presets = state.presets.filter((p) => !p.hidden).sort((a, b) => a.order - b.order);
  if (presets.length === 0) return null;
  return (
    <div className={styles.suggestions} role="group" aria-label={t('ai.suggestions')}>
      {presets.map((p) => (
        <button key={p.id} type="button" className={styles.suggestion} onClick={() => onSend(p.id)}>
          {p.name || t(`ai.preset.${p.builtInId}` as MessageKey)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `AiSidebar.tsx` riscritto**

```tsx
// src/ui/ai/AiSidebar.tsx
import { useRef, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { SettingsSection } from '../../lib/route';
import { Icon } from '../Icon';
import { ChatLog } from './ChatLog';
import { Composer, type ComposerHandle } from './Composer';
import { Suggestions } from './Suggestions';
import styles from './AiSidebar.module.css';

interface Props {
  controller: AiController;
  text: string;
  selection: TextRange | null;
  getSelection: () => SelectionScope | undefined;
  onSettings: (section: SettingsSection) => void;
  syncNeedsPermission?: boolean;
}

export function AiSidebar({ controller, text, selection, getSelection, onSettings, syncNeedsPermission }: Props) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const composer = useRef<ComposerHandle>(null);
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('ai.title')}</h2>
        <button
          type="button"
          className={`${styles.iconButton} tooltip`}
          aria-label={t('ai.newChat')}
          data-tooltip={t('ai.newChat')}
          disabled={state.chat.messages.length === 0 && !state.running}
          onClick={() => controller.newChat()}
        >
          <Icon name="newFile" />
        </button>
      </div>
      <ChatLog
        messages={state.chat.messages}
        onOpen={(path) => void controller.workspace.openFile(path)}
        onRetry={(id, remove) => void controller.retry(id, remove)}
      />
      <div className={styles.bottom}>
        {syncNeedsPermission && (
          <button type="button" className={styles.file} onClick={() => onSettings('ai-sync')}>
            ⚠ {t('ai.syncReactivate')}
          </button>
        )}
        <Composer ref={composer} controller={controller} text={text} selection={selection} getSelection={getSelection} onManage={() => onSettings('ai-profiles')} />
        <Suggestions controller={controller} onSend={(id) => composer.current?.sendPreset(id)} />
      </div>
    </div>
  );
}
```

(`newFile` è l'icona `plus` già esistente: evita un'icona duplicata. `controller.workspace` è già usato così nel codice attuale.)

- [ ] **Step 4: Props in `WorkspaceView`**

Sostituire il render di `AiSidebar` con:

```tsx
<AiSidebar
  controller={ai}
  text={doc?.text ?? ''}
  selection={aiSelection}
  getSelection={() => {
    const selected = session.selection?.main;
    return selected && !selected.empty
      ? { from: selected.from, to: selected.to, originalText: session.textLf.slice(selected.from, selected.to), status: 'valid' }
      : undefined;
  }}
  onSettings={() => setSettingsOpen(true)}
  syncNeedsPermission={!!syncBinding.handle && !syncBinding.permission}
/>
```

(`onSettings` ignora per ora la sezione: il routing arriva in Task 14. Togliere la riga `void aiSelection;` provvisoria di Task 7.)

- [ ] **Step 5: Verificare e committare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

Verifica manuale con `npm run dev` e il profilo APE: selezionare due righe → compare "Selezione · 2 righe"; ✕ lo nasconde fino a una selezione diversa; Invio invia, Shift+Invio va a capo; i suggerimenti spariscono al primo messaggio e tornano con Nuova chat; il chip modello apre il popover sopra di sé.

```bash
git add src/ui/ai src/ui/WorkspaceView.tsx
git commit -m "feat: composer in stile Claude, chip della selezione e suggerimenti"
```

---

### Task 12: barra di revisione compatta, via la vista affiancata

**Files:**
- Create: `src/ui/ai/ReviewBar.tsx`, `src/ui/ai/ReviewView.module.css`
- Modify: `src/ui/ai/ReviewView.tsx` (riscritto), `src/ui/ai/DiffPane.tsx` (via `collapse`, classe CSS module)
- Delete: `src/ui/ai/SideBySidePane.tsx`
- Modify: `src/ui/ai/settings/AiPresetsSection.tsx` (via il selettore "Vista")

**Interfaces:**
- Consumes: `reviewStatus`, `isBusy`, `ReviewStatus` (Task 4); icone `chevronUp`, `chevronDown`, `warning` (Task 5); `ai.generating`, `ai.warningsCount` (Task 5).
- Produces:
  - `ReviewBar({ status, warnings, onPrevious, onNext, onWarning, canAccept, canDiscard, onAcceptAll, onDiscard, onContinue })`
  - `ReviewView({ controller, editor })` — la prop `previewProps` sparisce (serviva solo alla vista affiancata).
  - `DiffPane` senza la prop `collapse`.

- [ ] **Step 1: `ReviewView.module.css`**

```css
/* src/ui/ai/ReviewView.module.css — revisione della proposta AI. */
.review {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--c-border);
  font-family: var(--font-pixel);
}

.status {
  color: var(--c-muted);
  font-size: 13px;
}

.spacer {
  flex: 1;
}

.iconButton {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.iconButton:hover:not(:disabled) {
  background: var(--c-accent-soft);
}

.secondary {
  padding: 4px 10px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: none;
  color: var(--c-text);
  cursor: pointer;
}

.accept {
  color: var(--c-accent);
  font-weight: 600;
}

.iconButton:disabled,
.secondary:disabled {
  opacity: 0.45;
  cursor: default;
}

.warnings {
  position-area: block-end span-inline-start;
  margin: 6px 0 0;
  padding: 8px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface);
  color: var(--c-text);
}

.warnings button {
  display: block;
  width: 100%;
  padding: 4px;
  border: none;
  background: none;
  text-align: start;
  cursor: pointer;
}

.hint {
  margin: 0;
  padding: 12px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 13px;
}

.stream pre {
  max-height: 15vh;
  overflow: auto;
  white-space: pre-wrap;
}

.diff {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.diff :global(.cm-mergeView) {
  height: 100%;
}

.diff :global(.cm-editor) {
  min-width: 0;
}

.diff :global(.cm-content) {
  padding-bottom: 40vh;
}

.editor {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: `ReviewBar.tsx`**

```tsx
// src/ui/ai/ReviewBar.tsx
import { useId } from 'react';

import { isBusy, type ReviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { Icon } from '../Icon';
import styles from './ReviewView.module.css';

interface Props {
  status: ReviewStatus;
  warnings: CheckWarning[];
  onPrevious: () => void;
  onNext: () => void;
  onWarning: (warning: CheckWarning) => void;
  canAccept: boolean;
  canDiscard: boolean;
  onAcceptAll: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}

const autoPopover = { popover: 'auto' } as Record<string, string>;

function StatusText({ status, onContinue }: { status: ReviewStatus; onContinue: () => void }) {
  const t = useT();
  switch (status.kind) {
    case 'none':
      return null;
    case 'generating':
      return (
        <span className={styles.status} aria-live="polite">
          {t('ai.generating', { seconds: status.seconds })}
          {status.total ? ` ${status.done}/${status.total}` : ''}
        </span>
      );
    case 'partial':
      return (
        <>
          <span className={styles.status}>{t('ai.status.partial')}</span>
          <button type="button" className={styles.secondary} onClick={onContinue}>
            {t('ai.continue')}
          </button>
        </>
      );
    case 'truncated':
      return <span className={styles.status}>{t('ai.status.truncated')}</span>;
    case 'scopeLost':
      return (
        <span className={styles.status} role="alert">
          {t('ai.error.scopeLost')}
        </span>
      );
    case 'applied':
      return <span className={styles.status}>{t('ai.applied')}</span>;
  }
}

export function ReviewBar(props: Props) {
  const t = useT();
  const id = useId();
  const busy = isBusy(props.status);
  return (
    <div className={styles.bar}>
      <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('ai.previous')} data-tooltip={t('ai.previous')} disabled={busy} onClick={props.onPrevious}>
        <Icon name="chevronUp" />
      </button>
      <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('ai.next')} data-tooltip={t('ai.next')} disabled={busy} onClick={props.onNext}>
        <Icon name="chevronDown" />
      </button>
      <StatusText status={props.status} onContinue={props.onContinue} />
      <span className={styles.spacer} />
      {props.warnings.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.secondary} tooltip`}
            aria-label={t('ai.warningsCount', { count: props.warnings.length })}
            data-tooltip={t('ai.warningsCount', { count: props.warnings.length })}
            {...{ popovertarget: id }}
          >
            <Icon name="warning" size={14} /> {props.warnings.length}
          </button>
          <div id={id} {...autoPopover} className={styles.warnings}>
            {props.warnings.map((w, i) => (
              <button key={i} type="button" onClick={() => props.onWarning(w)}>
                {t(`ai.warning.${w.code}` as MessageKey)}
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className={styles.secondary} disabled={!props.canDiscard} onClick={props.onDiscard}>
        {t('ai.discard')}
      </button>
      <button type="button" className={`${styles.secondary} ${styles.accept}`} disabled={!props.canAccept} onClick={props.onAcceptAll}>
        {t('ai.acceptAll')}
      </button>
    </div>
  );
}
```

Il popover degli avvisi usa `position-area` senza `position-anchor` esplicito: con `popovertarget` Chromium lo ancora implicitamente al bottone che lo apre.

- [ ] **Step 3: `ReviewView.tsx` riscritto**

```tsx
// src/ui/ai/ReviewView.tsx
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../ai/aiController';
import { reviewStatus } from '../../ai/reviewStatus';
import type { CheckWarning } from '../../ai/types';
import { Editor, type EditorProps } from '../../editor/Editor';
import { useT } from '../../i18n/I18nProvider';
import { ConfirmDialog } from '../ConfirmDialog';
import { DiffPane, type DiffHandle } from './DiffPane';
import { ReviewBar } from './ReviewBar';
import styles from './ReviewView.module.css';

interface Props {
  controller: AiController;
  editor: EditorProps & { path: string };
}

export function ReviewView({ controller, editor }: Props) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const diff = useRef<DiffHandle>(null);
  const [confirm, setConfirm] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const p = state.proposals.get(editor.path);

  useEffect(() => {
    const running = state.running;
    if (!running) return setElapsed(0);
    const tick = () => setElapsed(Math.floor((Date.now() - running.startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.running]);

  const warnings: CheckWarning[] = [...state.chat.messages].reverse().find((m) => m.role === 'assistant' && m.docPath === editor.path)?.warnings ?? [];
  const text = p ? (controller.proposalText(p) ?? p.text) : editor.text;
  const applied = !!p && p.status !== 'streaming' && text === editor.text;
  const status = reviewStatus({ proposal: p, running: state.running, elapsedSeconds: elapsed, applied });
  const streaming = !p || status.kind === 'generating' || status.kind === 'scopeLost';
  const range = p?.scope ? { from: p.scope.from, to: p.scope.from + p.text.length } : undefined;

  const accept = () => {
    if (!p || !controller.beforeAccept(p, true)) return;
    const next = controller.proposalText(p);
    if (next !== null) diff.current?.replace(next);
    setConfirm(false);
  };
  const edit = (next: string) => {
    if (!p) return;
    if (!p.scope) return controller.edited(p.path, next);
    const suffix = editor.text.length - p.scope.to;
    controller.edited(p.path, next.slice(p.scope.from, suffix ? next.length - suffix : undefined));
  };

  if (!p) {
    return (
      <section className={styles.review}>
        <p className={styles.hint}>{t('ai.emptyProposal')}</p>
        <div className={styles.editor}>
          <Editor {...editor} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.review}>
      <ReviewBar
        status={status}
        warnings={warnings}
        onPrevious={() => diff.current?.previous()}
        onNext={() => diff.current?.next()}
        onWarning={(w) => diff.current?.scrollToLine((w as { line?: number }).line ?? 0)}
        canAccept={controller.canAccept(p, true)}
        canDiscard={p.status !== 'streaming'}
        onAcceptAll={() => (editor.text !== p.baseText && !p.scope ? setConfirm(true) : accept())}
        onDiscard={() => controller.discard(p.path)}
        onContinue={() => void controller.continue(p.path)}
      />
      {state.streamingPreview && (
        <details className={styles.stream}>
          <summary>{t('ai.streamingPreview')}</summary>
          <pre>{state.streamingPreview}</pre>
        </details>
      )}
      <DiffPane
        ref={diff}
        editor={editor}
        range={range}
        proposal={text}
        canAccept={controller.canAccept(p)}
        streaming={streaming}
        beforeAccept={() => controller.beforeAccept(p)}
        onEdit={edit}
        acceptLabel={t('ai.acceptBlock')}
      />
      {confirm && (
        <ConfirmDialog title={t('ai.acceptAll')} message={t('ai.changedWarning')} confirmLabel={t('ai.acceptAll')} onConfirm={accept} onCancel={() => setConfirm(false)} />
      )}
    </section>
  );
}
```

Differenze volute rispetto a oggi: niente `left`/`SideBySidePane`, niente `view`/`override`/`right`/`linked`/`collapse`, il timer si sposta qui da `AiSidebar`. Condizioni di accettazione, conferma, scope ed `edited` restano identiche (confronta con `ReviewView.tsx:17-19` prima della modifica).

- [ ] **Step 4: `DiffPane` senza `collapse`**

In `src/ui/ai/DiffPane.tsx`:
1. togliere `collapse:boolean;` da `Props`;
2. nel costruttore `new MergeView({ … })` togliere `,collapseUnchanged:props.collapse?{margin:3,minSize:6}:undefined`;
3. nell'effetto di riconfigurazione togliere `m.reconfigure({collapseUnchanged:…});` e `props.collapse` dalle dipendenze;
4. aggiungere `import styles from './ReviewView.module.css';` e sostituire `className="ai-diff"` con `className={styles.diff}`.

- [ ] **Step 5: `WorkspaceView`, preset e rimozione**

In `src/ui/WorkspaceView.tsx` sostituire il render di `ReviewView` con:

```tsx
<ReviewView
  controller={ai}
  editor={{
    path: doc.path,
    text: doc.text,
    resetKey: `${doc.path}#${doc.revision}`,
    session,
    restore: doc.restore,
    readOnly: state.updating,
    getDocs,
    onChange: (text) => workspace.edit(text),
    onTransactions: (changes, texts) => ai.documentChanged(doc.path, changes, false, texts),
    onImage: (file) => workspace.saveImage(file, file.name),
    onTopLine: () => {},
    onSelection,
  }}
/>
```

In `src/ui/ai/settings/AiPresetsSection.tsx` togliere l'intero `<label>{t('ai.view.diff')}<select value={draft.view} …>…</select></label>` (il campo `view` resta nel draft e viene salvato così com'è).

```bash
git rm src/ui/ai/SideBySidePane.tsx
grep -rn "SideBySidePane\|aiView\|aiRightPane\|aiLinkedScroll\|ai\.view\.\|ai\.right\.\|ai\.collapse\|ai\.linked" src || echo "nessun riferimento"
```

Expected: `nessun riferimento` (le chiavi nei `.json` si tolgono in Task 16).

- [ ] **Step 6: Verificare e committare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

```bash
git add -A src/ui
git commit -m "feat: barra di revisione compatta, rimossa la vista affiancata"
```

---

### Task 13: sezioni AI delle impostazioni in forma elenco/dettaglio

**Files:**
- Create: `src/ui/ai/settings/Settings.module.css`, `src/ui/ai/settings/ItemList.tsx`
- Modify: `src/ui/ai/settings/AiProfilesSection.tsx`, `src/ui/ai/settings/AiPresetsSection.tsx`, `src/ui/ai/settings/AiSyncSection.tsx` (formattati)

**Interfaces:**
- Consumes: `ConfirmDialog`; chiavi `ai.deleteTitle`, `ai.deleteMessage`, `ai.unsavedTitle`, `ai.unsavedMessage`, `ai.discardChanges` (Task 5).
- Produces:
  - `ItemList<T extends { id: string }>({ items, selectedId, label, onSelect, onCreate })`
  - `AiProfilesSection({ controller, onDirty })`, `AiPresetsSection({ controller, onDirty })` con `onDirty?: (dirty: boolean) => void`
  - `useDraft<T>(onDirty)` locale al file `ItemList.tsx`: `{ draft, setDraft, select, pending, confirmSwitch, cancelSwitch }`

- [ ] **Step 1: `Settings.module.css`**

```css
/* src/ui/ai/settings/Settings.module.css — elenco/dettaglio di profili e preset. */
.split {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
}

.item {
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--c-text);
  text-align: start;
  cursor: pointer;
}

.item[aria-current='true'] {
  background: var(--c-accent-soft);
}

.create {
  composes: item;
  color: var(--c-accent);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.detail label {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail label > span {
  flex: 0 0 11rem;
}

.detail input:not([type='checkbox']):not([type='radio']),
.detail select,
.detail textarea {
  flex: 1;
  min-width: 0;
}

.detail textarea {
  min-height: 8rem;
}

.help {
  margin: 0;
  color: var(--c-muted);
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.actions > :last-child {
  margin-inline-start: auto;
}

@media (width < 700px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 2: `ItemList.tsx`** (elenco + gestione della bozza con conferma)

```tsx
// src/ui/ai/settings/ItemList.tsx
import { useEffect, useState } from 'react';

import { useT } from '../../../i18n/I18nProvider';
import styles from './Settings.module.css';

interface Props<T extends { id: string }> {
  items: T[];
  selectedId: string | null;
  label: (item: T) => string;
  onSelect: (item: T) => void;
  onCreate: () => void;
}

export function ItemList<T extends { id: string }>({ items, selectedId, label, onSelect, onCreate }: Props<T>) {
  const t = useT();
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <button key={item.id} type="button" className={styles.item} aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => onSelect(item)}>
          {label(item)}
        </button>
      ))}
      <button type="button" className={styles.create} onClick={onCreate}>
        + {t('ai.create')}
      </button>
    </div>
  );
}

/**
 * Bozza del dettaglio: `dirty` finché differisce dall'ultimo salvataggio; passare a un altro elemento
 * con modifiche aperte chiede conferma (`pending` finché l'utente non decide).
 */
export function useDraft<T>(onDirty?: (dirty: boolean) => void) {
  const [draft, setDraftState] = useState<T | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== saved;

  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  const open = (item: T | null) => {
    setDraftState(item);
    setSaved(item === null ? null : JSON.stringify(item));
  };
  return {
    draft,
    dirty,
    setDraft: (item: T) => setDraftState(item),
    /** Dopo un salvataggio riuscito: la bozza corrente diventa il riferimento. */
    markSaved: (item: T | null) => open(item),
    select: (item: T | null) => (dirty ? setPending(item) : open(item)),
    pending: pending !== null,
    confirmSwitch: () => {
      open(pending);
      setPending(null);
    },
    cancelSwitch: () => setPending(null),
  };
}
```

`select(null)` con modifiche aperte non può chiedere conferma perché `pending === null` significa "nessuna richiesta": `select(null)` si usa solo dopo un'eliminazione (bozza già salvata), dove `dirty` è falso.

- [ ] **Step 3: `AiProfilesSection.tsx` riscritto** (stessa logica: provider, URL, modello, parametri, contesto, effort, chiave, salva/duplica/elimina/prova)

```tsx
// src/ui/ai/settings/AiProfilesSection.tsx
import { useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../../ai/aiController';
import { changeProvider } from '../../../ai/models';
import { DEFAULT_URLS, defaultProfile, PROVIDER_KINDS, validateProfile } from '../../../ai/profiles';
import type { ModelProfile, ProviderKind } from '../../../ai/types';
import { useT } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { ConfirmDialog } from '../../ConfirmDialog';
import { ModelSelect } from '../ModelSelect';
import { Parameters } from '../Parameters';
import { ItemList, useDraft } from './ItemList';
import styles from './Settings.module.css';

export function AiProfilesSection({ controller, onDirty }: { controller: AiController; onDirty?: (dirty: boolean) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { draft, setDraft, markSaved, select, pending, confirmSwitch, cancelSwitch } = useDraft<ModelProfile>(onDirty);
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));
  const pick = (profile: ModelProfile | null) => {
    select(profile && { ...profile, params: { ...profile.params } });
    setKey('');
    setConnected(false);
  };

  const testConnection = (profile: ModelProfile) => {
    setConnected(false);
    run(
      controller.provider(profile).then(async (p) => {
        const signal = new AbortController().signal;
        if (p.testConnection) await p.testConnection(signal);
        else if ((await p.listModels(signal)) === null) throw { code: 'unreachable' };
        setConnected(true);
      }),
    );
  };

  return (
    <div className={styles.split}>
      <ItemList
        items={state.profiles}
        selectedId={draft?.id ?? null}
        label={(p) => p.name}
        onSelect={pick}
        onCreate={() => pick(defaultProfile('ollama', crypto.randomUUID()))}
      />
      {draft && (
        <div className={styles.detail}>
          <label>
            <span>{t('ai.name')}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.provider')}</span>
            <select
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as ProviderKind;
                setDraft({ ...changeProvider(draft, kind), baseUrl: DEFAULT_URLS[kind] });
                setKey('');
              }}
            >
              {PROVIDER_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.url')}</span>
            <input type="url" disabled={draft.kind === 'anthropic'} value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
          </label>
          <p className={styles.help}>{t(`ai.help.${draft.kind}` as MessageKey)}</p>
          <ModelSelect controller={controller} profile={draft} onChange={(selection) => setDraft({ ...draft, ...selection })} />
          <Parameters profile={draft} value={draft.params} onChange={(params) => setDraft({ ...draft, params })} />
          <label>
            <span>{t('ai.contextTokens')}</span>
            <input
              type="number"
              min="1"
              value={draft.contextTokens ?? ''}
              onChange={(e) => setDraft({ ...draft, contextTokens: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          {['ollama', 'lmstudio', 'openai-compatible'].includes(draft.kind) && (
            <label>
              <input
                type="checkbox"
                checked={!!draft.params.effort}
                onChange={(e) => setDraft({ ...draft, params: { ...draft.params, effort: e.target.checked ? 'medium' : undefined } })}
              />
              {t('ai.enableEffort')}
            </label>
          )}
          {['anthropic', 'openai-compatible'].includes(draft.kind) && (
            <>
              <label>
                <span>{t('ai.secret')}</span>
                <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
              </label>
              <label>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('ai.remember')}
              </label>
              <p className={styles.help}>{t('ai.secretNotice')}</p>
              <button
                type="button"
                disabled={!key}
                onClick={() =>
                  run(
                    controller.setSecret(validateProfile(draft), key, remember).then(() => {
                      setKey('');
                      markSaved(controller.getState().profiles.find((p) => p.id === draft.id) ?? draft);
                    }),
                  )
                }
              >
                {t('ai.saveSecret')}
              </button>
            </>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={() => testConnection(draft)}>
              {t('ai.connection')}
            </button>
            <button type="button" onClick={() => setDraft({ ...draft, id: crypto.randomUUID(), secretId: null })}>
              {t('ai.duplicate')}
            </button>
            <button type="button" onClick={() => setDeleting(true)}>
              {t('ai.delete')}
            </button>
            <button
              type="button"
              onClick={() => {
                const valid = validateProfile(draft);
                run(controller.saveProfile(valid).then(() => markSaved(valid)));
              }}
            >
              {t('ai.save')}
            </button>
          </div>
          {connected && <p role="status">{t('ai.connected')}</p>}
        </div>
      )}
      {deleting && draft && (
        <ConfirmDialog
          title={t('ai.deleteTitle', { name: draft.name })}
          message={t('ai.deleteMessage')}
          confirmLabel={t('ai.delete')}
          onConfirm={() => {
            setDeleting(false);
            run(controller.deleteProfile(draft.id).then(() => markSaved(null)));
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
      {pending && (
        <ConfirmDialog title={t('ai.unsavedTitle')} message={t('ai.unsavedMessage')} confirmLabel={t('ai.discardChanges')} onConfirm={confirmSwitch} onCancel={cancelSwitch} />
      )}
    </div>
  );
}
```

Verificare che `validateProfile` restituisca il profilo (lo usa già così il codice attuale: `controller.saveProfile(validateProfile(draft))`).

- [ ] **Step 4: `AiPresetsSection.tsx` riscritto** (senza "Vista")

```tsx
// src/ui/ai/settings/AiPresetsSection.tsx
import { useState, useSyncExternalStore } from 'react';

import type { AiController } from '../../../ai/aiController';
import { builtInPresets, restorePreset } from '../../../ai/presets';
import { defaultProfile } from '../../../ai/profiles';
import type { PromptPreset } from '../../../ai/types';
import { useT } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Parameters } from '../Parameters';
import { ItemList, useDraft } from './ItemList';
import styles from './Settings.module.css';

export function AiPresetsSection({ controller, onDirty }: { controller: AiController; onDirty?: (dirty: boolean) => void }) {
  const t = useT();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { draft, setDraft, markSaved, select, pending, confirmSwitch, cancelSwitch } = useDraft<PromptPreset>(onDirty);
  const [deleting, setDeleting] = useState(false);
  const run = (job: Promise<unknown>) => void job.catch((e) => controller.report(e));
  const name = (p: PromptPreset) => p.name || t(`ai.preset.${p.builtInId}` as MessageKey);
  const sorted = [...state.presets].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.split}>
      <ItemList
        items={sorted}
        selectedId={draft?.id ?? null}
        label={name}
        onSelect={(p) => select({ ...p })}
        onCreate={() =>
          select({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: state.presets.length })
        }
      />
      {draft && (
        <div className={styles.detail}>
          <label>
            <span>{t('ai.name')}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.instructions')}</span>
            <textarea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
          </label>
          <label>
            <span>{t('ai.targetLanguage')}</span>
            <input value={draft.variables?.targetLanguage ?? ''} onChange={(e) => setDraft({ ...draft, variables: { targetLanguage: e.target.value } })} />
          </label>
          <label>
            <span>{t('ai.strategy')}</span>
            <select value={draft.strategy} onChange={(e) => setDraft({ ...draft, strategy: e.target.value as PromptPreset['strategy'] })}>
              {(['whole', 'chunked'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`ai.strategy.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.frontmatter')}</span>
            <select value={draft.frontmatter} onChange={(e) => setDraft({ ...draft, frontmatter: e.target.value as PromptPreset['frontmatter'] })}>
              {(['keep', 'include'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`ai.frontmatter.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('ai.order')}</span>
            <input type="number" min="0" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label>
            <input type="checkbox" checked={draft.hidden} onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })} />
            {t('ai.hidden')}
          </label>
          <Parameters profile={defaultProfile()} value={draft.params ?? {}} onChange={(params) => setDraft({ ...draft, params })} />
          <div className={styles.actions}>
            <button type="button" onClick={() => setDraft({ ...draft, id: crypto.randomUUID(), builtInId: undefined })}>
              {t('ai.duplicate')}
            </button>
            {draft.builtInId ? (
              <button type="button" onClick={() => setDraft(restorePreset(draft))}>
                {t('ai.restoreOriginal')}
              </button>
            ) : (
              <button type="button" onClick={() => setDeleting(true)}>
                {t('ai.delete')}
              </button>
            )}
            <button type="button" onClick={() => run(controller.savePreset(draft).then(() => markSaved(draft)))}>
              {t('ai.save')}
            </button>
          </div>
        </div>
      )}
      {deleting && draft && (
        <ConfirmDialog
          title={t('ai.deleteTitle', { name: name(draft) })}
          message={t('ai.deleteMessage')}
          confirmLabel={t('ai.delete')}
          onConfirm={() => {
            setDeleting(false);
            run(controller.deletePreset(draft.id).then(() => markSaved(null)));
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
      {pending && (
        <ConfirmDialog title={t('ai.unsavedTitle')} message={t('ai.unsavedMessage')} confirmLabel={t('ai.discardChanges')} onConfirm={confirmSwitch} onCancel={cancelSwitch} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: `AiSyncSection.tsx` formattato**

Riformattare il file su più righe senza cambiare logica né testi: `useAiSync` resta identico (stessi effetti, stesse dipendenze, stesso oggetto restituito); `SyncDetails` e `AiSyncSection` sostituiscono `<fieldset className="ai-settings"><legend>{t('ai.sync')}</legend>…` con un `<div className={styles.detail}>…</div>` (import `styles from './Settings.module.css'`), `<p>` diventano `<p className={styles.help}>`, i gruppi di bottoni vanno in `<div className={styles.actions}>`. Il titolo della sezione diventa l'`<h2>` di `SettingsView` in Task 14.

- [ ] **Step 6: Verificare e committare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

Verifica manuale (le sezioni sono ancora nel modale `SettingsDialog`, sotto "AI"): nuovo profilo → modifica il nome → clic su un altro profilo → conferma "Scartare le modifiche non salvate?"; Elimina → conferma con il nome; preset senza campo "Vista"; Salva, poi cambio elemento senza conferma.

```bash
git add -A src/ui
git commit -m "feat: profili e preset in forma elenco/dettaglio, conferme su elimina e modifiche aperte"
```

---

### Task 14: impostazioni come vista indirizzata dall'hash

**Files:**
- Create: `src/ui/useRoute.ts`, `src/ui/SettingsView.tsx`, `src/ui/SettingsView.module.css`
- Modify: `src/ui/WorkspaceView.tsx`
- Delete: `src/ui/SettingsDialog.tsx`

**Interfaces:**
- Consumes: `parseRoute`, `formatRoute`, `Route`, `SettingsSection`, `SETTINGS_SECTIONS` (Task 1); `AiProfilesSection` e `AiPresetsSection` con `onDirty` (Task 13).
- Produces:
  - `useRoute(): { route: Route; navigate: (route: Route) => void }`
  - `SettingsView({ section, onSection, onClose, ai, syncBinding, theme, onTheme, autosave, onAutosave, onSaveAll })`

- [ ] **Step 1: `useRoute.ts`**

```ts
// src/ui/useRoute.ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatRoute, parseRoute, type Route } from '../lib/route';

/**
 * Vista indirizzata dall'hash. Entrare nelle impostazioni aggiunge una voce di cronologia (Indietro le
 * chiude); cambiare sezione la sostituisce; uscire torna indietro se ci si era entrati dall'app.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const pushed = useRef(false);

  useEffect(() => {
    const onHash = () => {
      const next = parseRoute(location.hash);
      if (next.view === 'workspace') pushed.current = false;
      setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Route) => {
    const current = parseRoute(location.hash);
    if (next.view === 'workspace') {
      if (current.view === 'workspace') return;
      if (pushed.current) {
        pushed.current = false;
        history.back();
        return;
      }
      history.replaceState(history.state, '', location.pathname + location.search);
      setRoute(next);
      return;
    }
    const hash = formatRoute(next);
    if (current.view === 'settings') {
      history.replaceState(history.state, '', hash);
      setRoute(next);
      return;
    }
    pushed.current = true;
    location.hash = hash;
  }, []);

  return { route, navigate };
}
```

- [ ] **Step 2: `SettingsView.module.css`**

```css
/* src/ui/SettingsView.module.css — impostazioni a pagina, sopra l'area di lavoro. */
.view {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  background: var(--c-bg);
  color: var(--c-text);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border-right: 1px solid var(--c-border);
  background: var(--c-sidebar);
  font-family: var(--font-pixel);
}

.navHeader {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.navHeader h1 {
  margin: 0;
  font-size: 16px;
  font-weight: normal;
}

.navLink {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--c-text);
  text-decoration: none;
}

.navLink[aria-current='true'] {
  background: var(--c-accent-soft);
}

.content {
  overflow: auto;
  padding: 24px clamp(16px, 4vw, 48px) 40vh;
}

.section {
  max-width: 52rem;
  margin: 0 0 40px;
  scroll-margin-top: 16px;
}

.section h2 {
  margin: 0 0 16px;
  font: 18px/1.3 var(--font-pixel);
}

.iconButton {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.iconButton:hover {
  background: var(--c-accent-soft);
}

@media (width < 700px) {
  .view {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .nav {
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--c-border);
  }

  .navHeader {
    margin: 0 8px 0 0;
  }
}
```

- [ ] **Step 3: `SettingsView.tsx`**

I campi di "Generale" sono quelli di `SettingsDialog.tsx`, spostati tali e quali (stesse classi di `Dialog.module.css`).

```tsx
// src/ui/SettingsView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiController } from '../ai/aiController';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { formatRoute, type SettingsSection } from '../lib/route';
import { THEME_PREFS, type ThemePref } from '../theme/theme';
import { AUTOSAVE_MODES, clampDelay, MAX_DELAY_MS, MIN_DELAY_MS, type AutosaveSettings } from '../workspace/autosave';
import { AiPresetsSection } from './ai/settings/AiPresetsSection';
import { AiProfilesSection } from './ai/settings/AiProfilesSection';
import { AiSyncSection, type SyncBinding } from './ai/settings/AiSyncSection';
import { ConfirmDialog } from './ConfirmDialog';
import dialog from './Dialog.module.css';
import { Icon } from './Icon';
import styles from './SettingsView.module.css';

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  onClose: () => void;
  ai: AiController | null;
  syncBinding: SyncBinding;
  theme: ThemePref;
  onTheme: (next: ThemePref) => void;
  autosave: AutosaveSettings;
  onAutosave: (next: AutosaveSettings) => void;
  onSaveAll: () => void;
}

const LABELS: Record<SettingsSection, MessageKey> = {
  general: 'settings.general',
  'ai-profiles': 'settings.aiProfiles',
  'ai-presets': 'settings.aiPresets',
  'ai-sync': 'settings.aiSync',
};

export function SettingsView({ section, onSection, onClose, ai, syncBinding, theme, onTheme, autosave, onAutosave, onSaveAll }: Props) {
  const { t, locale, setLocale } = useI18n();
  const [delay, setDelay] = useState(String(autosave.delayMs));
  const [dirty, setDirty] = useState<Set<SettingsSection>>(() => new Set());
  const [confirmClose, setConfirmClose] = useState(false);
  const [visible, setVisible] = useState<SettingsSection>(section);
  const content = useRef<HTMLDivElement>(null);
  const sections: SettingsSection[] = ai ? ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] : ['general'];

  const markDirty = (id: SettingsSection) => (value: boolean) =>
    setDirty((prev) => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  // Callback stabili: useDraft le mette nelle dipendenze dei suoi effetti.
  const profilesDirty = useCallback(markDirty('ai-profiles'), []);
  const presetsDirty = useCallback(markDirty('ai-presets'), []);

  const commitDelay = () => {
    const next = clampDelay(Number(delay));
    setDelay(String(next));
    if (next !== autosave.delayMs) onAutosave({ ...autosave, delayMs: next });
  };
  const close = () => {
    commitDelay();
    if (dirty.size > 0) setConfirmClose(true);
    else onClose();
  };

  // Entrando (o cambiando sezione dall'hash) si scorre alla sezione richiesta.
  useEffect(() => {
    content.current?.querySelector(`#settings-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section]);

  // La voce dell'indice segue la sezione visibile mentre si scorre.
  useEffect(() => {
    const root = content.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setVisible(top.target.id.replace('settings-', '') as SettingsSection);
      },
      { root, rootMargin: '0px 0px -60% 0px' },
    );
    root.querySelectorAll('section[id^="settings-"]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ai]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={styles.view} role="region" aria-label={t('settings.title')}>
      <nav className={styles.nav} aria-label={t('settings.sections')}>
        <div className={styles.navHeader}>
          <button type="button" className={`${styles.iconButton} tooltip`} aria-label={t('settings.close')} data-tooltip={t('settings.close')} onClick={close}>
            <Icon name="close" />
          </button>
          <h1>{t('settings.title')}</h1>
        </div>
        {sections.map((id) => (
          <a
            key={id}
            className={styles.navLink}
            href={formatRoute({ view: 'settings', section: id })}
            aria-current={visible === id ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSection(id);
            }}
          >
            {t(LABELS[id])}
          </a>
        ))}
      </nav>
      <div ref={content} className={styles.content}>
        <section id="settings-general" className={styles.section}>
          <h2>{t('settings.general')}</h2>
          <label className={dialog.field}>
            <span>{t('settings.language')}</span>
            <select className={dialog.input} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={dialog.group}>
            <legend>{t('settings.theme')}</legend>
            {THEME_PREFS.map((value) => (
              <label key={value} className={dialog.option}>
                <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => onTheme(value)} />
                {t(`theme.option.${value}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className={dialog.group}>
            <legend>{t('settings.autosave')}</legend>
            {AUTOSAVE_MODES.map((mode) => (
              <label key={mode} className={dialog.option}>
                <input type="radio" name="autosave" value={mode} checked={autosave.mode === mode} onChange={() => onAutosave({ ...autosave, mode })} />
                {t(`settings.autosave.${mode}`)}
              </label>
            ))}
            {autosave.mode === 'afterDelay' && (
              <label className={dialog.field}>
                <span>{t('settings.delay')}</span>
                <input
                  className={dialog.input}
                  type="number"
                  min={MIN_DELAY_MS}
                  max={MAX_DELAY_MS}
                  step={100}
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  onBlur={commitDelay}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDelay();
                  }}
                />
              </label>
            )}
          </fieldset>
          <button type="button" className={dialog.secondary} onClick={onSaveAll}>
            {t('settings.saveAll')}
          </button>
        </section>
        {ai && (
          <>
            <section id="settings-ai-profiles" className={styles.section}>
              <h2>{t('settings.aiProfiles')}</h2>
              <AiProfilesSection controller={ai} onDirty={profilesDirty} />
            </section>
            <section id="settings-ai-presets" className={styles.section}>
              <h2>{t('settings.aiPresets')}</h2>
              <AiPresetsSection controller={ai} onDirty={presetsDirty} />
            </section>
            <section id="settings-ai-sync" className={styles.section}>
              <h2>{t('settings.aiSync')}</h2>
              <AiSyncSection controller={ai} binding={syncBinding} />
            </section>
          </>
        )}
      </div>
      {confirmClose && (
        <ConfirmDialog
          title={t('ai.unsavedTitle')}
          message={t('ai.unsavedMessage')}
          confirmLabel={t('ai.discardChanges')}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
```


- [ ] **Step 4: `WorkspaceView` usa la vista**

1. Import: togliere `SettingsDialog`, aggiungere `import { SettingsView } from './SettingsView';` e `import { useRoute } from './useRoute';`.
2. Sostituire `const [settingsOpen, setSettingsOpen] = useState(false);` con:

```tsx
  const { route, navigate } = useRoute();
  const settingsOpen = route.view === 'settings';
  const openSettings = useCallback((section: SettingsSection = 'general') => navigate({ view: 'settings', section }), [navigate]);
```

   (import `type SettingsSection` da `../lib/route`).
3. Ogni `setSettingsOpen(true)` → `openSettings()`; in `AiSidebar` `onSettings={openSettings}` (ora la sezione arriva davvero).
4. Il `return` diventa un frammento: il `<div className={styles.layout} …>` con sidebar e `main` riceve `{...{ inert: settingsOpen ? '' : undefined }}`; `NameDialog`, `ConfirmDialog`, `AccessLostDialog` e `Toasts` escono dal `div` e restano fratelli (così non ereditano `inert`); al posto del vecchio blocco `{settingsOpen && <SettingsDialog …/>}`:

```tsx
      {settingsOpen && (
        <SettingsView
          section={route.section}
          onSection={(section) => navigate({ view: 'settings', section })}
          onClose={() => navigate({ view: 'workspace' })}
          ai={ai}
          syncBinding={syncBinding}
          theme={theme}
          onTheme={setTheme}
          autosave={state.autosave}
          onAutosave={(next) => {
            writePref('autosave', next);
            workspace.setAutosave(next);
          }}
          onSaveAll={() => void workspace.saveAll()}
        />
      )}
```

   (`route.section` è valido perché `settingsOpen` restringe `route` al ramo `settings`: se `tsc` non lo deduce dentro il JSX, usare `route.view === 'settings' && <SettingsView section={route.section} …/>` al posto di `settingsOpen && …`.)
5. Nell'effetto `onKey`: `if (settingsOpen) return;` come prima riga, così scorciatoie ed `Esc` dell'area di lavoro non agiscono sotto le impostazioni; aggiungere `settingsOpen` alle dipendenze.

```bash
git rm src/ui/SettingsDialog.tsx
grep -rn "SettingsDialog\|setSettingsOpen" src tests || echo "nessun riferimento"
```

- [ ] **Step 5: Verificare e committare**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

Verifica manuale: nuovo profilo, modifica del nome, `Esc` → conferma "Scartare le modifiche non salvate?"; ingranaggio → `#settings`; voce "AI · Profili" → `#settings/ai-profiles` senza nuova voce di cronologia; Indietro del browser → documento nella stessa modalità; aprire direttamente `http://localhost:5173/#settings/ai-sync` → impostazioni sulla sezione Sync, X → documento (niente `history.back()` fuori dall'app); `#foo` → documento.

```bash
git add -A src/ui
git commit -m "feat: impostazioni come vista a pagina indirizzata dall'hash"
```

---

### Task 15: smoke test nel browser aggiornato

**Files:**
- Modify: `tests/browser/run-ai-smoke.mjs`, `tests/browser/ai-smoke.tsx` (commento configurabile del provider finto)

**Interfaces:**
- Consumes: `aria-label` dei pulsanti modalità (`mode.ai` = "AI", `mode.editor` = "Editor"), `ai.send` = "Send", `ai.acceptAll` = "Accept all", `ai.discard` = "Discard", `ai.selectionLines`, `.cm-merge-revert button`.

- [ ] **Step 1: Helper per `aria-label` e per la textarea**

Sotto `const click=…` aggiungere:

```js
 const press=async(label)=>{assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)});if(!b||b.disabled)return false;b.click();return true;})()`),'Pulsante disponibile: '+label);await sleep(150);};
 const composer="document.querySelector('textarea[aria-label^=\"Ask about this document\"]')";
```

e sostituire `request` con una versione che invia con Invio:

```js
 const request=async()=>{await evaluate(`(()=>{const t=${composer};Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'fix');t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`);await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Accept all'&&!b.disabled)");};
```

- [ ] **Step 2: Flusso aggiornato**

Sostituire i passi che usavano i tab e la vista affiancata:
- `await click('AI');await until("!!document.querySelector('.ai-sidebar textarea')");` → `await press('AI');await until(\`!!${composer}\`);`
- `await click('Side by side');await click('Files');` → `await press('Editor');`
- `await click('AI');await click('Diff');` → `await press('AI');`
- il blocco "Selection only": sostituire le due `evaluate("[...document.querySelectorAll('.ai-sidebar label')]…click()")` con un'attesa sul chip dopo `setSelectedDocument()`:

```js
 await until("[...document.querySelectorAll('span')].some(s=>s.textContent.startsWith('Selection · '))");
```

  e, al posto del secondo click sulla checkbox (fine del blocco selezione), un clic sulla ✕ del chip:

```js
 await press('Use the whole document');
```

- il controllo del rendering sicuro oggi apre "Side by side" → "Source" per vedere la proposta come anteprima. Senza vista affiancata la proposta è solo testo nel diff (nessuna richiesta di rete), mentre il markdown sicuro con immagini a consenso resta nella **chat**, che mostra il *commento* della risposta (`proposalStream.ts`: il testo fuori da `<housemd-proposal>`). Il provider finto oggi usa il commento fisso `Fixed`: in `tests/browser/ai-smoke.tsx` sostituire `'Fixed<housemd-proposal>'` con `((window as any).smoke?.comment||'Fixed')+'<housemd-proposal>'`. Poi, in `run-ai-smoke.mjs`, sostituire `await request();await click('Side by side');await click('Source');await sleep(500);` e le tre righe successive (asserzioni su `:59999` e `[data-ai-image]`) con:

```js
 await evaluate(`smoke.comment='Nota ![x](http://127.0.0.1:59999/image) <img src="http://127.0.0.1:59999/raw"><iframe src="http://127.0.0.1:59999/frame"></iframe>'`);
 await request();await sleep(500);
 assert.equal(network.filter(url=>url.includes(':59999')).length,0,'Chat e diff non caricano immagini, frontmatter o HTML remoto');
 assert.ok(await evaluate("document.querySelectorAll('[role=log] [data-ai-image]').length>0"),'Segnaposto immagine presente nella chat');
 await evaluate("document.querySelector('[role=log] [data-ai-image]').click()");await sleep(200);assert.ok(network.some(url=>url.includes(':59999/image')),'Caricamento soltanto dopo clic esplicito');
 await evaluate("smoke.comment=''");
```

  (`smoke.reply` impostato subito prima con frontmatter e HTML remoti resta: finisce nel diff come testo e l'asserzione sulla rete lo copre.)
- `await click('Files');` prima del blocco di ripristino → `await press('Editor');`.
- messaggio finale: `'Chromium AI smoke: modalità AI, composer con Invio, proposta, accept-all, blocco, AI→Editor undo, before-ai, chip selezione e accettazione ripetuta e per blocchi, rendering sicuro, ripristino cronologia: OK'`.

- [ ] **Step 3: Eseguire**

Run: `npm run test:browser`
Expected: la riga `Chromium AI smoke: … OK` e uscita 0. Se Chromium non è in `chromium`, usare `CHROMIUM_BIN=$(which chromium-browser || which google-chrome) npm run test:browser`.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/run-ai-smoke.mjs tests/browser/ai-smoke.tsx
git commit -m "test: smoke test del browser sulla nuova UI AI"
```

---

### Task 16: pulizia finale, README, verifica completa

**Files:**
- Delete: `src/ui/ai/ai.css`
- Modify: `src/ui/WorkspaceView.tsx` (via `import './ai/ai.css';`)
- Modify: `src/i18n/locales/*.json` (via chiavi inutilizzate)
- Modify: `README.md` (sezione "Modalità AI")

- [ ] **Step 1: Togliere `ai.css`**

```bash
grep -rn "ai-sidebar\|ai-bar\|ai-review\|ai-chat\|ai-columns\|ai-diff\|ai-popover\|ai-settings\|ai-pane-labels\|ai-notice" src tests
```

Expected: solo `src/ui/ai/ai.css` e l'import in `WorkspaceView.tsx`. Se compaiono altri file, sostituire la classe con quella del CSS module corrispondente (Task 8/10/12/14) prima di proseguire. Poi:

```bash
git rm src/ui/ai/ai.css
sed -i "/import '.\/ai\/ai.css';/d" src/ui/WorkspaceView.tsx
```

- [ ] **Step 2: Togliere le chiavi inutilizzate**

```bash
for k in ai.files ai.selection ai.managePresets ai.parameters ai.collapse ai.linked ai.view.diff ai.view.side ai.right.source ai.right.preview ai.status.streaming ai.status.complete; do
  grep -rn "'$k'\|\"$k\"\|\`$k\`" src --include=*.ts --include=*.tsx | grep -v locales && echo "ANCORA USATA: $k"
done
grep -rn 'ai\.view\.\${\|ai\.right\.\${\|ai\.status\.\${' src --include=*.tsx && echo "chiave dinamica ancora usata"
```

Expected: nessuna riga `ANCORA USATA` né `chiave dinamica ancora usata`. Poi:

```bash
node -e '
const fs=require("fs");
const drop=["ai.files","ai.selection","ai.managePresets","ai.parameters","ai.collapse","ai.linked","ai.view.diff","ai.view.side","ai.right.source","ai.right.preview","ai.status.streaming","ai.status.complete"];
for(const l of ["en","it","es","fr","de","pt","nl","pl","ja"]){const p=`src/i18n/locales/${l}.json`;const m=JSON.parse(fs.readFileSync(p,"utf8"));for(const k of drop)delete m[k];fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n");}'
```

- [ ] **Step 3: README**

In `README.md`, sezione `### Modalità AI`, sostituire il primo paragrafo e quello su **Diff**/**Affiancata** con:

```markdown
L'icona **AI** accanto a Editor, Split e Preview (anche `Ctrl/Cmd+Shift+E`) apre la revisione del documento
corrente con la chat nella sidebar. **Invio** invia, **Shift+Invio** va a capo, **Stop**/`Esc` interrompe.
Selezionando del testo nell'editor compare il chip "Selezione": la richiesta riguarda solo quel tratto
(✕ per usare tutto il documento). I preset compaiono come suggerimenti finché la chat è vuota. Il chip del
modello apre profili, modello e parametri; l'effort ha un suo chip quando il profilo lo supporta.
`Ctrl/Cmd+K` torna ai file con il focus sulla ricerca. File e AI ricordano larghezze separate.

Le impostazioni sono una pagina: ingranaggio o `#settings` (`#settings/ai-profiles`, `#settings/ai-presets`,
`#settings/ai-sync` per le sezioni AI). Indietro del browser o `Esc` le chiudono.

La barra di revisione ha le frecce per le modifiche precedente/successiva, gli avvisi quando ci sono,
**Scarta** e **Accetta tutto**; ogni blocco del diff si accetta anche da solo.
```

Lasciare invariato il resto della sezione (transazione annullabile, snapshot `before-ai`, frontmatter, parti,
**Continua**, ambito Selezione, persistenza). Controllare con `grep -n "Affiancata\|Ctrl/Cmd+Enter\|Ctrl/Cmd+K\` torna" README.md` che non restino riferimenti vecchi.

- [ ] **Step 4: Verifica completa**

Run: `npm test && npm run lint && npm run build && npm run test:browser`
Expected: tutto verde.

Verifica manuale finale con `npm run dev` e il profilo "APE" (`https://ape.taila31b51.ts.net:11436`):
1. icona AI → sidebar chat, suggerimenti visibili;
2. "Clean transcript" su un documento → proposta, frecce, Accetta tutto, poi `Ctrl+Z` dall'Editor;
3. selezione di tre righe → chip "Selezione · 3 righe" → richiesta → solo quel tratto nel diff;
4. errore provocato con un profilo Claude Code puntato a `http://localhost:1` → toast di errore in basso, chiusura → sparisce (non toccare il servizio su APE);
5. `#settings/ai-profiles` da barra degli indirizzi, Indietro, X; tema chiaro e scuro su tutte le schermate nuove.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: via ai.css e chiavi inutilizzate, README della nuova UI AI"
```
