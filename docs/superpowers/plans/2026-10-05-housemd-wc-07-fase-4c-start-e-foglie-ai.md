# HouseMD Web Components — Piano 7: fase 4c, start screen e foglie AI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a custom element le ultime foglie della fase 4: `hmd-start-screen` (era `ui/StartScreen.tsx`), `hmd-ai-suggestions` (era `ui/ai/Suggestions.tsx`), `hmd-ai-effort-chip` (era `ui/ai/EffortChip.tsx`) e `hmd-ai-parameters` (era `ui/ai/Parameters.tsx`), senza cambiare aspetto né comportamento.

**Architecture:** Stesso schema della 4a: classe `Hmd<Nome>` che estende `HmdElement`, host con `display: contents`, DOM interno identico a quello di React (così l'audit degli stili calcolati resta confrontabile), foglio `@layer components { @scope (hmd-…) { … } }`, ingressi come proprietà JS, uscite come `CustomEvent` dichiarati in `src/elements/events.ts`. Le decisioni (cosa mostrare, quali campi, quale valore) stanno in moduli puri testati senza DOM. Gli elementi AI ricevono il controller come proprietà, tipizzato con un'interfaccia minima (`AiChipController`) così i test usano un controller finto.

**Tech Stack:** TypeScript 7, React 19.3 (solo nei chiamanti), Custom Elements, CSS `@scope`/`@layer`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§3.1 cartelle `elements/start-screen/` e `elements/ai/`, §4.2 radici `hmd-ai-*`, §5.1–5.2, §7 fase 4, §8.2–8.4, R1–R3, R11).

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza = `main` = `3dce89d`, fasi 4a e 4b fatte). Regola del 05/10 (spec §7): a fine piano, con suite verdi, review finale pulita e checklist provata, **merge in `main` e push** (anche del branch).
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/` ricostruita al Task 1 da questo branch.
- Regole degli elementi (spec §2, §5): elementi sottili (logica in moduli puri), DOM solo con `el()`/`textContent` (mai stringhe HTML), light DOM + `@scope`, un file `<nome>.element.ts` + `<nome>.css`, classe `Hmd<Nome>`, `customElements.define` solo in `src/elements/define.ts`, ogni `addEventListener` verso l'esterno con il `signal`, tipi JSX dei tag in `src/elements/jsx.d.ts`.
- Cartelle: `src/elements/start-screen/` (radice `hmd-start-screen`); `src/elements/ai/` (radici `hmd-ai-*`, già ammesse da `architecture.test.ts`).
- **Mai ricostruire un nodo che può avere il focus**: pulsanti, `select` e `input` si creano una volta e si aggiornano (`setText`, `toggleAttr`, `.value` solo se cambia); le liste con `reconcileList` per chiave. Un nodo si inserisce o si toglie solo dove React lo montava o smontava (il DOM deve coincidere con quello di React per l'audit).
- Testi solo da `t()` (store i18n); **nessuna chiave nuova**. Tooltip mai con `title`.
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale, senza righe di attribuzione.
- Le regole e2e di `CLAUDE.md` valgono (ruolo e nome accessibile, testi da `en.json`, mai classi CSS dell'app). Nessuna richiesta di rete vera dagli e2e: le richieste a provider cloud si bloccano con `page.route`.
- **Mai giudicare un comando di verifica dal suo output filtrato.**
- Verifica di ogni task che tocca l'app: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.

## Misure prese scrivendo il piano (05/10, su `3dce89d`)

1. **Copertura di oggi**: `StartScreen` ha e2e (`startup.spec.ts`: avvio, browser non supportato, ripresa) e stati di audit `start-light`/`start-dark`; **`Suggestions`, `EffortChip` e `Parameters` non hanno né e2e né snapshot né stati di audit** (Task 1).
2. **Cascata in impostazioni**: dentro il dettaglio di un profilo, le etichette di `Parameters` ricevono sia `.detail label` (`Settings.module.css`, gap 12px, span 11rem) sia `.popoverSection label` (`Composer.module.css`, gap 8px, span 45%). Nella build di oggi **vince `.detail`** (gap misurato 12px, span 176px: il foglio di Settings viene dopo nel bundle). Con il foglio dell'elemento nel layer `components` continua a vincere `.detail` (non ha layer): risultato uguale, lo verifica lo stato di audit `settings-profile` del Task 1.
3. **Tema dentro `@scope`** (probe Chromium): `:root[data-theme='light'] :scope .logo-light` e `@media (prefers-color-scheme: light) { :root:not([data-theme='dark']) :scope .logo-light { … } }` funzionano dentro `@scope (hmd-start-screen)` in tutti e quattro i casi (schema chiaro/scuro × tema esplicito/auto).
4. `.row > :last-child { margin-inline-start: auto }` del composer: con l'host `hmd-ai-effort-chip` in `display: contents` e vuoto, l'ultimo figlio resta il pulsante di invio; un host vuoto non genera box né gap.
5. `capabilities('anthropic', …).effort` è `true`: un profilo Anthropic (anche senza chiave) mostra il chip dell'effort. È la strada degli e2e del chip.

## Review Focus

1. **Input numerici dei parametri mentre si scrive** (`0.`, `1e`, campo svuotato): l'elemento non deve riscrivere `input.value` quando il numero non cambia, o il cursore salta e il testo parziale sparisce. Test jsdom nel Task 5 (valore `"0."` non riscritto) + e2e del Task 1 sulla temperatura.
2. **Focus durante gli aggiornamenti**: il `select` dell'effort e gli input dei parametri restano gli stessi nodi quando lo store notifica o React passa un oggetto `value` nuovo a ogni render. Test di identità dei nodi nei Task 4 e 5.
3. **Comparsa e scomparsa**: suggerimenti solo con chat vuota e nessuna richiesta in corso; chip dell'effort solo se il profilo effettivo lo supporta; start screen con i pulsanti giusti per modalità. Il DOM deve essere quello di React (nodo assente, non nascosto). Test jsdom + stati di audit del Task 1.
4. **Cambio di lingua a caldo** e **distacco senza iscrizioni residue** per ogni elemento (R1, R3). Un test per elemento.
5. **Cascata**: nessun cambio di stile nelle impostazioni (vedi misura 2), nel popover del modello e nella start screen con tema esplicito. Stati di audit del Task 1.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/support/app.ts`, `e2e/ai-chips.spec.ts`, `e2e/computed-styles.audit.ts` | Rete di sicurezza: suggerimenti, chip dell'effort, parametri; stati di audit nuovi. |
| `src/ai/capabilities.ts` (+ test) | `EFFORT_LEVELS` condiviso (oggi duplicato in due componenti). |
| `src/elements/start-screen/startView.ts` (+ test) | Messaggio e pulsanti per modalità. |
| `src/elements/start-screen/start-screen.element.ts`, `start-screen.css` (+ `.dom.test.ts`) | `hmd-start-screen`. |
| `src/elements/ai/aiChips.ts` (+ test) | `AiChipController`, `suggestionPresets`, `effortChipState`, `parameterFields`, `withParam`. |
| `src/elements/ai/suggestions.element.ts`, `suggestions.css` (+ test) | `hmd-ai-suggestions`. |
| `src/elements/ai/effort-chip.element.ts`, `effort-chip.css` (+ test) | `hmd-ai-effort-chip`. |
| `src/elements/ai/parameters.element.ts`, `parameters.css` (+ test) | `hmd-ai-parameters`. |
| `src/elements/define.ts`, `events.ts`, `jsx.d.ts` | Registrazione, eventi, tipi JSX. |
| `src/App.tsx`, `src/ui/ai/AiSidebar.tsx`, `Composer.tsx`, `ModelChip.tsx`, `settings/AiProfilesSection.tsx`, `settings/AiPresetsSection.tsx` | Montano i tag. |
| `src/ui/StartScreen.tsx`, `StartScreen.module.css`, `src/ui/ai/Suggestions.tsx`, `EffortChip.tsx`, `Parameters.tsx` | Cancellati. `Composer.module.css` perde `.suggestions`/`.suggestion` (`.chip` e `.popoverSection` restano: li usa `ModelChip`). |

---

### Task 1: Baseline e rete di sicurezza sulle foglie di oggi

Nessuna riga dell'app cambia: test che **passano sull'app React di oggi**.

**Files:**
- Modify: `e2e/support/app.ts` (metodo `createProfile`)
- Create: `e2e/ai-chips.spec.ts`
- Modify: `e2e/computed-styles.audit.ts` (stati nuovi)

**Interfaces:**
- Produces: `App.createProfile(kind: 'anthropic' | 'ollama', name: string): Promise<void>` (crea e salva un profilo dalle impostazioni, poi le chiude); stati di audit `start-theme-light`, `start-resume`, `settings-profile`, `model-popover`, `ai-suggestions`, `effort-chip`.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short && git log --oneline -1       # pulito, 3dce89d o il commit del piano
npm test                                          # annotare (05/10: 670)
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare (05/10: 434 481)
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 4c
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla**.

- [ ] **Step 2: Profilo da creare nei test**

In `e2e/support/app.ts`, nella classe `App`, dopo `openFile`:

```ts
  /**
   * Crea e salva un profilo AI dalle impostazioni, poi le chiude. Il profilo non viene selezionato:
   * si sceglie dal chip del modello. Un profilo Anthropic senza chiave basta per i chip (niente rete).
   */
  async createProfile(kind: 'anthropic' | 'ollama', name: string): Promise<void> {
    const settings = this.page.getByRole('region', { name: this.t('settings.title') });
    await this.page.getByRole('button', { name: this.t('toolbar.settings') }).click();
    await settings.getByRole('link', { name: this.t('settings.aiProfiles') }).click();
    // La sezione dei profili è la prima sezione AI: «+ Create» e i campi sono i primi.
    await settings.getByRole('button', { name: `+ ${this.t('ai.create')}` }).first().click();
    await settings.getByLabel(this.t('ai.name'), { exact: true }).first().fill(name);
    await settings.getByLabel(this.t('ai.provider'), { exact: true }).first().selectOption(kind);
    await settings.getByRole('button', { name: this.t('ai.save'), exact: true }).first().click();
    await expect(settings.getByRole('button', { name, exact: true })).toBeVisible();
    await settings.getByRole('button', { name: this.t('settings.close') }).click();
    await expect(settings).toHaveCount(0);
  }
```

- [ ] **Step 3: E2e dei suggerimenti, del chip dell'effort e dei parametri**

`e2e/ai-chips.spec.ts`:

```ts
import { expect, test, type App } from './support/app.ts';

const suggestions = (app: App) => app.page.getByRole('group', { name: app.t('ai.suggestions') });
const effort = (app: App) => app.page.getByRole('combobox', { name: app.t('ai.param.effort') });
const settings = (app: App) => app.page.getByRole('region', { name: app.t('settings.title') });

test.beforeEach(async ({ app, page }) => {
  // Nessuna richiesta verso provider cloud: un profilo Anthropic senza chiave non deve uscire in rete.
  await page.route('https://api.anthropic.com/**', (route) => route.abort());
  await app.openFolder({ 'a.md': 'Alpha' });
  await app.openFile('a.md');
  await expect(app.mode('mode.ai')).toBeVisible();
});

test('suggestions show the visible presets with an empty chat, go away after a request and come back with New chat', async ({ app, page, ai }) => {
  await app.mode('mode.ai').click();
  await expect(suggestions(app)).toBeVisible();
  const first = suggestions(app).getByRole('button').first();
  await expect(first).toHaveText(app.t('ai.preset.pulisci'));
  await first.click();
  await expect.poll(() => ai.requests).toBe(1);
  await expect(suggestions(app)).toHaveCount(0);
  await page.getByRole('button', { name: app.t('ai.newChat') }).click();
  await expect(suggestions(app)).toBeVisible();
});

test('the effort chip appears only for a profile that supports it and overrides the effort', async ({ app, page }) => {
  await app.createProfile('anthropic', 'Cloud');
  await app.mode('mode.ai').click();
  // Il profilo predefinito (Ollama) non ha effort.
  await expect(effort(app)).toHaveCount(0);
  const chip = page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) });
  await chip.click();
  await page.getByRole('radio', { name: 'Cloud' }).check();
  // Nel popover del modello l'effort non si ripete (ha il suo chip).
  await expect(page.getByRole('combobox', { name: app.t('ai.param.effort') })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(effort(app)).toHaveValue('');
  await expect(effort(app).getByRole('option')).toHaveText([app.t('ai.default'), 'low', 'medium', 'high', 'xhigh', 'max']);
  await effort(app).selectOption('high');
  await expect(effort(app)).toHaveValue('high');
  // Un override aggiunge il pallino al testo del chip del modello (il nome accessibile è l'aria-label).
  await expect(chip).toContainText('•');
});

test('profile parameters: the fields follow the provider and a saved temperature comes back', async ({ app }) => {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  for (const key of ['ai.param.temperature', 'ai.param.topP', 'ai.param.maxOutputTokens', 'ai.param.chunkChars']) {
    await expect(settings(app).getByRole('spinbutton', { name: app.t(key) })).toBeVisible();
  }
  await expect(settings(app).getByRole('combobox', { name: app.t('ai.param.effort') })).toHaveCount(0);
  const temperature = settings(app).getByRole('spinbutton', { name: app.t('ai.param.temperature') });
  await temperature.fill('0.7');
  await expect(temperature).toHaveValue('0.7');
  await settings(app).getByRole('button', { name: app.t('ai.save'), exact: true }).first().click();
  await settings(app).getByRole('button', { name: app.t('settings.close') }).click();
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  await expect(settings(app).getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toHaveValue('0.7');
});

test('typing a partial number keeps the text in the field', async ({ app }) => {
  await app.page.getByRole('button', { name: app.t('toolbar.settings') }).click();
  await settings(app).getByRole('link', { name: app.t('settings.aiProfiles') }).click();
  await settings(app).getByRole('button', { name: 'ollama', exact: true }).click();
  const topP = settings(app).getByRole('spinbutton', { name: app.t('ai.param.topP') });
  await topP.fill('');
  await topP.pressSequentially('0.');
  await topP.pressSequentially('5');
  await expect(topP).toHaveValue('0.5');
  await expect(topP).toBeFocused();
});
```

Note per chi esegue:
- Il nome del profilo predefinito, il testo del primo preset (`ai.preset.pulisci`), i nomi accessibili di chip, radio e campi vanno verificati sull'app di oggi: se un **localizzatore** non trova l'elemento, si corregge il localizzatore (ruolo e nome da `en.json`), mai l'asserzione sul comportamento. Se il comportamento di oggi è diverso, fermarsi e riportarlo.
- `getByLabel` / `getByRole('spinbutton', { name })` funziona perché le etichette avvolgono i campi (`<label><span>…</span><input></label>`).
- Il secondo test conta **un** combobox «Reasoning effort» con il popover aperto: è il chip nel composer, il popover non lo ripete.

- [ ] **Step 4: Stati di audit nuovi**

In `e2e/computed-styles.audit.ts`, nell'array `STATES` (dopo `start-dark` i primi due, gli altri dopo `settings`):

```ts
  {
    name: 'start-theme-light',
    scheme: 'dark',
    async setup(app, page) {
      // Tema chiaro esplicito con il sistema scuro: deve vedersi il logo in negativo.
      await page.addInitScript(() => localStorage.setItem('housemd:theme', JSON.stringify('light')));
      await app.start();
      await expect(page.getByRole('button', { name: app.t('start.openFolder') })).toBeVisible();
    },
  },
  {
    name: 'start-resume',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'alpha' });
      await app.setFlags({ query: 'prompt', request: 'granted' });
      await page.reload();
      await expect(page.getByRole('button', { name: app.t('start.openOther') })).toBeVisible();
    },
  },
```

```ts
  {
    name: 'settings-profile',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: 'ollama', exact: true }).click();
      await expect(settings.getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
    },
  },
  {
    name: 'model-popover',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await expect(page.getByRole('spinbutton', { name: app.t('ai.param.temperature') })).toBeVisible();
    },
  },
  {
    name: 'ai-suggestions',
    async setup(app, page) {
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.mode('mode.ai').click();
      await expect(page.getByRole('group', { name: app.t('ai.suggestions') })).toBeVisible();
    },
  },
  {
    name: 'effort-chip',
    async setup(app, page) {
      await page.route('https://api.anthropic.com/**', (route) => route.abort());
      await app.openFolder({ 'a.md': 'Alpha' });
      await app.openFile('a.md');
      await expect(app.mode('mode.ai')).toBeVisible();
      await app.createProfile('anthropic', 'Cloud');
      await app.mode('mode.ai').click();
      await page.getByRole('button', { name: new RegExp(`^${app.t('ai.profile')}: `) }).click();
      await page.getByRole('radio', { name: 'Cloud' }).check();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('combobox', { name: app.t('ai.param.effort') })).toBeVisible();
    },
  },
```

Se la forma `setup(app, page)` o i campi `scheme` sono diversi nel file, seguire quella degli stati esistenti (`start-dark`, `settings`, `ai-review`).

- [ ] **Step 5: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: +4 test rispetto a 108
npm run test:e2e:dev        # annotare: +4 rispetto a 93
npm run test:e2e:audit      # annotare: +12 rispetto a 40 (due test per stato)
```

Expected: tutto verde (le due build dell'audit sono identiche).

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "test: rete su start screen, suggerimenti, chip dell'effort e parametri prima della 4c"
```

---

### Task 2: Logica pura delle foglie

**Files:**
- Modify: `src/ai/capabilities.ts`, test esistente di capabilities (o Create `src/ai/capabilities.test.ts` se manca)
- Create: `src/elements/start-screen/startView.ts`, `startView.test.ts`
- Create: `src/elements/ai/aiChips.ts`, `aiChips.test.ts`

**Interfaces:**
- Produces:
  - `EFFORT_LEVELS: readonly ['low', 'medium', 'high', 'xhigh', 'max']` da `src/ai/capabilities.ts`
  - `type StartMode = 'unsupported' | 'start' | 'resume'`; `interface StartView { message: { key: MessageKey; params?: Params } | null; buttons: readonly ('pick' | 'resume' | 'pick-other')[] }`; `startView(input: { mode: StartMode; reason?: UnsupportedReason; error?: string }): StartView`
  - `type AiChipController = Pick<AiController, 'subscribe' | 'getState' | 'profile' | 'override'>`
  - `suggestionPresets(state: Pick<AiState, 'chat' | 'running' | 'presets'>): PromptPreset[]`
  - `effortChipState(profile: ModelProfile | undefined, overrides: ProfileOverrides): { visible: false } | { visible: true; value: string }`
  - `type ParamKey = 'temperature' | 'topP' | 'maxOutputTokens' | 'chunkChars'`; `type ParamField = { key: ParamKey; kind: 'number'; min: number; max?: number; step: number } | { key: 'effort'; kind: 'effort' }`; `parameterFields(profile: ModelProfile, hideEffort: boolean): ParamField[]`
  - `withParam(value: GenParams, key: ParamKey | 'effort', raw: string): GenParams`

- [ ] **Step 1: Test che falliscono**

In fondo al test di `capabilities` (cercarlo con `ls src/ai/*capab*`; se manca, creare `src/ai/capabilities.test.ts` con gli import di `node:test` e `assert/strict` come gli altri test di `src/ai/`):

```ts
test('the effort levels are the five of GenParams, in order', () => {
  assert.deepEqual([...EFFORT_LEVELS], ['low', 'medium', 'high', 'xhigh', 'max']);
});
```

`src/elements/start-screen/startView.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { startView } from './startView';

test('unsupported: the reason message and no buttons', () => {
  assert.deepEqual(startView({ mode: 'unsupported', reason: 'firefox' }), { message: { key: 'unsupported.firefox' }, buttons: [] });
  assert.deepEqual(startView({ mode: 'unsupported' }), { message: { key: 'unsupported.other' }, buttons: [] });
});

test('start: the open button, with the error message only after a failed open', () => {
  assert.deepEqual(startView({ mode: 'start' }), { message: null, buttons: ['pick'] });
  assert.deepEqual(startView({ mode: 'start', error: 'boom' }), { message: { key: 'start.openError', params: { detail: 'boom' } }, buttons: ['pick'] });
  // Un errore vuoto è comunque un errore (come `error !== undefined` in StartScreen.tsx).
  assert.deepEqual(startView({ mode: 'start', error: '' }).message, { key: 'start.openError', params: { detail: '' } });
});

test('resume: resume first, then open another folder', () => {
  assert.deepEqual(startView({ mode: 'resume' }), { message: null, buttons: ['resume', 'pick-other'] });
});
```

`src/elements/ai/aiChips.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile } from '../../ai/profiles';
import type { PromptPreset } from '../../ai/types';
import { effortChipState, parameterFields, suggestionPresets, withParam } from './aiChips';

const preset = (id: string, order: number, hidden = false) => ({ id, order, hidden }) as PromptPreset;
const chat = (messages: number) => ({ id: 'c', messages: Array.from({ length: messages }), overrides: {} }) as never;

test('suggestions: visible presets by order, none with messages or a request running', () => {
  const presets = [preset('b', 2), preset('a', 1), preset('h', 0, true)];
  assert.deepEqual(suggestionPresets({ chat: chat(0), running: null, presets }).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(suggestionPresets({ chat: chat(1), running: null, presets }), []);
  assert.deepEqual(suggestionPresets({ chat: chat(0), running: { messageId: 'm', path: 'a.md', startedAt: 0 }, presets }), []);
});

test('effort chip: hidden without profile or support; the override wins over the profile value', () => {
  const ollama = defaultProfile('ollama', 'o');
  const cloud = { ...defaultProfile('anthropic', 'c'), params: { effort: 'low' as const } };
  assert.deepEqual(effortChipState(undefined, {}), { visible: false });
  assert.deepEqual(effortChipState(ollama, {}), { visible: false });
  assert.deepEqual(effortChipState({ ...ollama, kind: 'openai-compatible', params: { effort: 'high' } }, {}), { visible: true, value: 'high' });
  assert.deepEqual(effortChipState(cloud, {}), { visible: true, value: 'low' });
  assert.deepEqual(effortChipState(cloud, { effort: 'max' }), { visible: true, value: 'max' });
  assert.deepEqual(effortChipState({ ...cloud, params: {} }, {}), { visible: true, value: '' });
});

test('parameter fields follow the capabilities; effort last and only when not hidden', () => {
  const ollama = defaultProfile('ollama', 'o');
  assert.deepEqual(parameterFields(ollama, false), [
    { key: 'temperature', kind: 'number', min: 0, max: 2, step: 0.1 },
    { key: 'topP', kind: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'maxOutputTokens', kind: 'number', min: 1, step: 1 },
    { key: 'chunkChars', kind: 'number', min: 1, step: 1 },
  ]);
  const cloud = defaultProfile('anthropic', 'c');
  assert.deepEqual(parameterFields(cloud, false).at(-1), { key: 'effort', kind: 'effort' });
  assert.equal(parameterFields(cloud, true).some((f) => f.key === 'effort'), false);
  const cli = defaultProfile('claude-code', 'x');
  assert.deepEqual(parameterFields(cli, false).map((f) => f.key), ['chunkChars']);
});

test('withParam: empty string removes the key, numbers are parsed, effort is kept as is', () => {
  assert.deepEqual(withParam({ temperature: 1 }, 'temperature', '0.5'), { temperature: 0.5 });
  assert.deepEqual(withParam({ temperature: 1, topP: 1 }, 'temperature', ''), { temperature: undefined, topP: 1 });
  assert.deepEqual(withParam({}, 'effort', 'high'), { effort: 'high' });
  assert.deepEqual(withParam({ effort: 'high' }, 'effort', ''), { effort: undefined });
});
```

Prima di scrivere i test, verificare con `grep -n "export function defaultProfile" src/ai/profiles.ts` la firma di `defaultProfile` (tipo e id) e adeguare le chiamate; verificare che il modello di default di `anthropic` non sia uno di quelli che disattivano temperatura/topP: le asserzioni sul cloud qui guardano solo l'effort.

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/start-screen/startView.test.ts src/elements/ai/aiChips.test.ts`
Expected: FAIL, moduli mancanti; il test di `EFFORT_LEVELS` fallisce sull'import.

- [ ] **Step 3: Implementazione**

In `src/ai/capabilities.ts`, in testa (dopo l'import):

```ts
/** Livelli di effort di GenParams, nell'ordine dei menu. */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const satisfies readonly NonNullable<GenParams['effort']>[];
```

`src/elements/start-screen/startView.ts`:

```ts
import type { UnsupportedReason } from '../../fs/access';
import type { Params } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';

export type StartMode = 'unsupported' | 'start' | 'resume';

export interface StartView {
  message: { key: MessageKey; params?: Params } | null;
  /** Pulsanti nell'ordine in cui compaiono: `pick` primario, `resume` primario, `pick-other` secondario. */
  buttons: readonly ('pick' | 'resume' | 'pick-other')[];
}

/** Cosa mostra la schermata iniziale per modalità (era il calcolo inline di StartScreen.tsx). */
export function startView({ mode, reason, error }: { mode: StartMode; reason?: UnsupportedReason; error?: string }): StartView {
  if (mode === 'unsupported') return { message: { key: `unsupported.${reason ?? 'other'}` }, buttons: [] };
  const message = error !== undefined ? { key: 'start.openError' as const, params: { detail: error } } : null;
  return { message, buttons: mode === 'start' ? ['pick'] : ['resume', 'pick-other'] };
}
```

(Se `` `unsupported.${reason ?? 'other'}` `` non è assegnabile a `MessageKey` per tsc, usare `as MessageKey` come fa oggi `StartScreen.tsx` con `t()`.)

`src/elements/ai/aiChips.ts`:

```ts
import type { AiController, AiState } from '../../ai/aiController';
import { capabilities } from '../../ai/capabilities';
import { effectiveProfile } from '../../ai/profiles';
import type { GenParams, ModelProfile, ProfileOverrides, PromptPreset } from '../../ai/types';

/** Quello che i chip AI usano del controller: così i test passano un controller finto. */
export type AiChipController = Pick<AiController, 'subscribe' | 'getState' | 'profile' | 'override'>;

/** Preset proposti come suggerimenti: solo con la chat vuota e nessuna richiesta in corso. */
export function suggestionPresets(state: Pick<AiState, 'chat' | 'running' | 'presets'>): PromptPreset[] {
  if (state.chat.messages.length > 0 || state.running) return [];
  return state.presets.filter((p) => !p.hidden).sort((a, b) => a.order - b.order);
}

/** Chip dell'effort: solo se il profilo effettivo lo supporta; valore dell'override, poi del profilo. */
export function effortChipState(profile: ModelProfile | undefined, overrides: ProfileOverrides): { visible: false } | { visible: true; value: string } {
  if (!profile) return { visible: false };
  const effective = effectiveProfile(profile, overrides);
  if (!capabilities(effective.kind, effective.model, { effort: !!profile.params.effort }).effort) return { visible: false };
  return { visible: true, value: overrides.effort ?? profile.params.effort ?? '' };
}

export type ParamKey = 'temperature' | 'topP' | 'maxOutputTokens' | 'chunkChars';
export type ParamField = { key: ParamKey; kind: 'number'; min: number; max?: number; step: number } | { key: 'effort'; kind: 'effort' };

const NUMERIC: readonly ParamKey[] = ['temperature', 'topP', 'maxOutputTokens', 'chunkChars'];

/** Campi dei parametri per il profilo (era Parameters.tsx); l'effort in fondo, se non ha già il suo chip. */
export function parameterFields(profile: ModelProfile, hideEffort: boolean): ParamField[] {
  const caps = capabilities(profile.kind, profile.model, { effort: !!profile.params.effort });
  const fields: ParamField[] = NUMERIC.filter((key) => caps[key]).map((key) => {
    const unit = key === 'temperature' || key === 'topP';
    return { key, kind: 'number', min: unit ? 0 : 1, ...(key === 'temperature' ? { max: 2 } : key === 'topP' ? { max: 1 } : {}), step: unit ? 0.1 : 1 };
  });
  if (caps.effort && !hideEffort) fields.push({ key: 'effort', kind: 'effort' });
  return fields;
}

/** Il valore dei parametri dopo una modifica: stringa vuota = parametro tolto (come Parameters.tsx). */
export function withParam(value: GenParams, key: ParamKey | 'effort', raw: string): GenParams {
  if (key === 'effort') return { ...value, effort: (raw as GenParams['effort']) || undefined };
  return { ...value, [key]: raw === '' ? undefined : Number(raw) };
}

```

(Verificare che `ProfileOverrides` sia esportato da `src/ai/types.ts`; se sta altrove, importarlo da lì. L'ordine delle chiavi in `parameterFields` deve dare oggetti uguali a quelli del test: `max` solo per temperatura e topP.)

- [ ] **Step 4: Passano, poi tutto**

Run: i due file di test + il test di capabilities, poi `npm test` e `npm run lint`.
Expected: PASS; `npm test` = baseline + i test nuovi.

- [ ] **Step 5: Commit**

```bash
git add src/ai/capabilities.ts src/ai/*capabilities*.test.ts src/elements/start-screen/ src/elements/ai/
git commit -m "feat: logica pura di start screen, suggerimenti, chip dell'effort e parametri"
```

---

### Task 3: `hmd-start-screen`

**Files:**
- Create: `src/elements/start-screen/start-screen.element.ts`, `start-screen.css`, `start-screen.dom.test.ts`
- Modify: `src/elements/define.ts`, `src/elements/events.ts`, `src/elements/jsx.d.ts`, `src/App.tsx`
- Delete: `src/ui/StartScreen.tsx`, `src/ui/StartScreen.module.css`

**Interfaces:**
- Consumes: `startView`, `StartMode` (Task 2); `LOGO`, `LOGO_INVERTED`, `WORDMARK` da `src/ui/logo.ts`; `UnsupportedReason` da `src/fs/access.ts`.
- Produces: `HmdStartScreen` con proprietà `mode: StartMode`, `reason: UnsupportedReason | undefined`, `error: string | undefined`, `folderName: string`, `busy: boolean`, `i18n: I18nStore | null`; eventi `hmd-start-pick`, `hmd-start-resume` (`CustomEvent<null>`).

- [ ] **Step 1: Test che falliscono**

`src/elements/start-screen/start-screen.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { LOGO, LOGO_INVERTED, WORDMARK } from '../../ui/logo';

const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);

function mount(props: Partial<HTMLElementTagNameMap['hmd-start-screen']> = {}) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'start.openFolder': 'APRI' } }), persist() {} });
  const el = document.createElement('hmd-start-screen');
  Object.assign(el, { mode: 'start', ...props });
  el.i18n = i18n;
  document.body.append(el);
  return { el, i18n, buttons: () => [...el.querySelectorAll('button')] };
}

test('the same tree as StartScreen.tsx: main, panel, hidden title, three logos, tagline', () => {
  const { el } = mount();
  const main = el.querySelector('main')!;
  assert.equal(main.className, 'start');
  const panel = main.firstElementChild!;
  assert.equal(panel.className, 'panel');
  const [h1, dark, light, word, tagline] = panel.children;
  assert.equal(h1.localName, 'h1');
  assert.equal(h1.className, 'visually-hidden');
  assert.equal(h1.textContent, EN_MESSAGES['app.name']);
  assert.deepEqual([dark, light, word].map((p) => [p.localName, p.className, p.getAttribute('aria-hidden'), p.textContent]), [
    ['pre', 'logo logo-dark', 'true', LOGO],
    ['pre', 'logo logo-light', 'true', LOGO_INVERTED],
    ['pre', 'logo wordmark', 'true', WORDMARK],
  ]);
  assert.equal(tagline.textContent, EN_MESSAGES['start.tagline']);
  el.remove();
});

test('start: one primary button that sends hmd-start-pick; no message without an error', () => {
  const { el, buttons } = mount();
  let picks = 0;
  el.addEventListener('hmd-start-pick', () => picks++);
  assert.deepEqual(buttons().map((b) => [b.className, b.textContent]), [['primary', EN_MESSAGES['start.openFolder']]]);
  assert.equal(el.querySelector('.message'), null);
  buttons()[0].click();
  assert.equal(picks, 1);
  el.remove();
});

test('start with an error: the message sits between the tagline and the button', () => {
  const { el } = mount({ error: 'boom' });
  const message = el.querySelector('.message')!;
  assert.equal(message.textContent, t('start.openError', { detail: 'boom' }));
  assert.equal(message.previousElementSibling!.className, 'tagline');
  assert.equal(message.nextElementSibling!.localName, 'button');
  el.error = undefined;
  assert.equal(el.querySelector('.message'), null);
  el.remove();
});

test('resume: resume (primary) then open another (secondary), each with its event', () => {
  const { el, buttons } = mount({ mode: 'resume', folderName: 'notes' });
  const events: string[] = [];
  el.addEventListener('hmd-start-resume', () => events.push('resume'));
  el.addEventListener('hmd-start-pick', () => events.push('pick'));
  assert.deepEqual(buttons().map((b) => [b.className, b.textContent]), [
    ['primary', t('start.resume', { folder: 'notes' })],
    ['secondary', EN_MESSAGES['start.openOther']],
  ]);
  buttons()[0].click();
  buttons()[1].click();
  assert.deepEqual(events, ['resume', 'pick']);
  el.remove();
});

test('unsupported: the reason and no buttons', () => {
  const { el, buttons } = mount({ mode: 'unsupported', reason: 'firefox' });
  assert.equal(el.querySelector('.message')!.textContent, EN_MESSAGES['unsupported.firefox']);
  assert.deepEqual(buttons(), []);
  el.remove();
});

test('busy disables the buttons without recreating them', () => {
  const { el, buttons } = mount({ mode: 'resume', folderName: 'notes' });
  const before = buttons();
  el.busy = true;
  assert.deepEqual(buttons(), before);
  assert.ok(before.every((b) => b.disabled));
  el.busy = false;
  assert.ok(before.every((b) => !b.disabled));
  el.remove();
});

test('a language change relabels in place; detached, it no longer does', async () => {
  const { el, i18n, buttons } = mount();
  const button = buttons()[0];
  await i18n.setLocale('it');
  assert.equal(buttons()[0], button);
  assert.equal(button.textContent, 'APRI');
  const other = mount();
  other.el.remove();
  await other.i18n.setLocale('it');
  assert.equal(other.buttons()[0].textContent, EN_MESSAGES['start.openFolder']);
  el.remove();
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/start-screen/start-screen.dom.test.ts`
Expected: FAIL (tag non definito: `document.createElement` restituisce un elemento senza proprietà; i test sui figli falliscono).

- [ ] **Step 3: Elemento, foglio, registrazione**

`src/elements/start-screen/start-screen.element.ts`:

```ts
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import type { UnsupportedReason } from '../../fs/access';
import type { I18nStore } from '../../state/i18nStore';
import { LOGO, LOGO_INVERTED, WORDMARK } from '../../ui/logo';
import { emit } from '../events';
import { startView, type StartMode } from './startView';
import './start-screen.css';

/** Schermata iniziale (era StartScreen.tsx): browser non supportato, prima apertura, ripresa dell'accesso. */
export class HmdStartScreen extends HmdElement {
  #mode: StartMode = 'start';
  #reason: UnsupportedReason | undefined;
  #error: string | undefined;
  #folderName = '';
  #busy = false;
  #i18n: I18nStore | null = null;
  #parts: { panel: HTMLDivElement; title: HTMLHeadingElement; tagline: HTMLParagraphElement; message: HTMLParagraphElement; pick: HTMLButtonElement; resume: HTMLButtonElement; other: HTMLButtonElement } | null = null;

  get mode(): StartMode { return this.#mode; }
  set mode(value: StartMode) { this.#mode = value ?? 'start'; this.#render(); }
  get reason(): UnsupportedReason | undefined { return this.#reason; }
  set reason(value: UnsupportedReason | undefined) { this.#reason = value ?? undefined; this.#render(); }
  get error(): string | undefined { return this.#error; }
  set error(value: string | undefined) { this.#error = value ?? undefined; this.#render(); }
  get folderName(): string { return this.#folderName; }
  set folderName(value: string) { this.#folderName = value ?? ''; this.#render(); }
  get busy(): boolean { return this.#busy; }
  set busy(value: boolean) { this.#busy = !!value; this.#render(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const title = el('h1', { class: 'visually-hidden' });
      const tagline = el('p', { class: 'tagline' });
      const panel = el(
        'div',
        { class: 'panel' },
        title,
        el('pre', { class: 'logo logo-dark', 'aria-hidden': 'true' }, LOGO),
        el('pre', { class: 'logo logo-light', 'aria-hidden': 'true' }, LOGO_INVERTED),
        el('pre', { class: 'logo wordmark', 'aria-hidden': 'true' }, WORDMARK),
        tagline,
      );
      this.append(el('main', { class: 'start' }, panel));
      this.#parts = {
        panel,
        title,
        tagline,
        message: el('p', { class: 'message' }),
        pick: el('button', { class: 'primary', on: { click: () => emit(this, 'hmd-start-pick', null) } }),
        resume: el('button', { class: 'primary', on: { click: () => emit(this, 'hmd-start-resume', null) } }),
        other: el('button', { class: 'secondary', on: { click: () => emit(this, 'hmd-start-pick', null) } }),
      };
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n) return;
    const view = startView({ mode: this.#mode, reason: this.#reason, error: this.#error });
    setText(parts.title, i18n.t('app.name'));
    setText(parts.tagline, i18n.t('start.tagline'));
    setText(parts.pick, i18n.t('start.openFolder'));
    setText(parts.resume, i18n.t('start.resume', { folder: this.#folderName }));
    setText(parts.other, i18n.t('start.openOther'));
    if (view.message) setText(parts.message, i18n.t(view.message.key, view.message.params));
    // Messaggio e pulsanti si montano e si smontano come in React: nodi assenti, non nascosti.
    const wanted: HTMLElement[] = [
      ...(view.message ? [parts.message] : []),
      ...view.buttons.map((b) => (b === 'pick' ? parts.pick : b === 'resume' ? parts.resume : parts.other)),
    ];
    for (const node of [parts.message, parts.pick, parts.resume, parts.other]) if (!wanted.includes(node)) node.remove();
    let anchor: Element = parts.tagline;
    for (const node of wanted) {
      if (anchor.nextElementSibling !== node) anchor.after(node);
      anchor = node;
    }
    for (const button of [parts.pick, parts.resume, parts.other]) button.disabled = this.#busy;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-start-screen': HmdStartScreen;
  }
}
```

`src/elements/start-screen/start-screen.css`: copia di `src/ui/StartScreen.module.css` con le classi rinominate in kebab-case (`logoDark` → `logo-dark`, `logoLight` → `logo-light`, `visuallyHidden` → `visually-hidden`; le altre uguali) e le regole del tema riscritte con `:scope` (misura 3):

```css
@layer components {
  @scope (hmd-start-screen) {
    :scope {
      display: contents;
    }

    /* … tutte le regole di StartScreen.module.css, valori identici, classi rinominate … */

    /* La casa è disegnata a punti accesi su fondo scuro: col tema chiaro si mostra il negativo. */
    .logo-light {
      display: none;
    }

    :root[data-theme='light'] :scope .logo-light {
      display: block;
    }

    :root[data-theme='light'] :scope .logo-dark {
      display: none;
    }

    @media (prefers-color-scheme: light) {
      :root:not([data-theme='dark']) :scope .logo-light {
        display: block;
      }

      :root:not([data-theme='dark']) :scope .logo-dark {
        display: none;
      }
    }
  }
}
```

Scrivere il file per intero copiando **ogni** regola del modulo (`.start`, `.panel`, `.logo`, `.wordmark`, `.visually-hidden`, `.tagline`, `.message`, `.primary, .secondary`, `.primary`, `.secondary`, `:disabled`) con gli stessi valori e lo stesso ordine; solo le tre regole `:global(...)` cambiano forma come sopra.

`src/elements/events.ts`, in `HmdEvents`:

```ts
  /** Schermata iniziale: scegliere una cartella (anche «Apri un'altra cartella»). */
  'hmd-start-pick': CustomEvent<null>;
  /** Schermata iniziale: riprendere l'accesso alla cartella ricordata. */
  'hmd-start-resume': CustomEvent<null>;
```

`src/elements/define.ts`: import di `HmdStartScreen` e riga `['hmd-start-screen', HmdStartScreen],` (ordine alfabetico come le altre).

`src/elements/jsx.d.ts`: import `type { UnsupportedReason } from '../fs/access'` e `type { StartMode } from './start-screen/startView'`, e in `IntrinsicElements`:

```ts
      'hmd-start-screen': HmdProps<
        { mode: StartMode; reason: UnsupportedReason; error: string; folderName: string; busy: boolean; i18n: I18nStore },
        'hmd-start-pick' | 'hmd-start-resume'
      >;
```

- [ ] **Step 4: `App.tsx` monta il tag**

In `src/App.tsx`: togliere l'import di `StartScreen`; i tre rami diventano

```tsx
    .with({ kind: 'unsupported' }, () => <hmd-start-screen mode="unsupported" reason={unsupportedReason(navigator.userAgent)} i18n={i18nStore} />)
    .with({ kind: 'start' }, (s) => <hmd-start-screen mode="start" error={s.error} busy={switching} i18n={i18nStore} onhmd-start-pick={choose} />)
    .with({ kind: 'resume' }, (s) => (
      <hmd-start-screen mode="resume" folderName={s.stored.handle.name} busy={switching} i18n={i18nStore} onhmd-start-resume={resume} onhmd-start-pick={choose} />
    ))
```

(`choose`/`resume` sono callback senza argomenti: ricevono l'evento e lo ignorano. Se tsc lamenta la firma, usare `onhmd-start-pick={() => void choose()}`.)

Poi `git rm src/ui/StartScreen.tsx src/ui/StartScreen.module.css`.

- [ ] **Step 5: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/start-screen/start-screen.dom.test.ts   # 7 pass
npm test
npm run lint
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit       # start-light, start-dark, start-theme-light, start-resume uguali alla baseline
```

Se l'audit trova differenze, **non toccare i test**: confrontare il CSS con il modulo originale e correggere il CSS.

- [ ] **Step 6: Commit**

```bash
git add -A src/elements/start-screen src/elements/define.ts src/elements/events.ts src/elements/jsx.d.ts src/App.tsx src/ui/StartScreen.tsx src/ui/StartScreen.module.css
git commit -m "feat: hmd-start-screen al posto di StartScreen"
```

---

### Task 4: `hmd-ai-suggestions` e `hmd-ai-effort-chip`

**Files:**
- Create: `src/elements/ai/suggestions.element.ts`, `suggestions.css`, `suggestions.dom.test.ts`
- Create: `src/elements/ai/effort-chip.element.ts`, `effort-chip.css`, `effort-chip.dom.test.ts`
- Create: `src/testing/fakeAi.ts`
- Modify: `src/elements/define.ts`, `events.ts`, `jsx.d.ts`, `src/ui/ai/AiSidebar.tsx`, `src/ui/ai/Composer.tsx`, `src/ui/ai/Composer.module.css`
- Delete: `src/ui/ai/Suggestions.tsx`, `src/ui/ai/EffortChip.tsx`

**Interfaces:**
- Consumes: `AiChipController`, `suggestionPresets`, `effortChipState`, `EFFORT_LEVELS` (Task 2); `presetLabel` da `src/ai/presetName.ts`.
- Produces:
  - `src/testing/fakeAi.ts`: `fakeAi(state?: Partial<AiState>, profile?: ModelProfile): AiChipController & { set(patch: Partial<AiState>): void; overrides: ProfileOverrides[] }` (registra le chiamate a `override`)
  - `HmdAiSuggestions`: proprietà `controller: AiChipController | null`, `i18n: I18nStore | null`; evento `hmd-ai-suggestion` (`CustomEvent<{ presetId: string }>`)
  - `HmdAiEffortChip`: proprietà `controller`, `i18n`; nessun evento (chiama `controller.override`)

- [ ] **Step 1: Controller finto per i test**

`src/testing/fakeAi.ts`:

```ts
import type { AiState } from '../ai/aiController';
import type { ModelProfile, ProfileOverrides } from '../ai/types';
import type { AiChipController } from '../elements/ai/aiChips';

/** Controller AI finto per i test degli elementi: stato in memoria, notifiche sincrone, override registrati. */
export function fakeAi(initial: Partial<AiState> = {}, profile?: ModelProfile) {
  let state = { chat: { id: 'c', messages: [], overrides: {} }, running: null, presets: [], profiles: [], profileId: '', ...initial } as unknown as AiState;
  const listeners = new Set<() => void>();
  const overrides: ProfileOverrides[] = [];
  const set = (patch: Partial<AiState>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn();
  };
  const controller: AiChipController & { set: typeof set; overrides: ProfileOverrides[]; listeners: () => number } = {
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    getState: () => state,
    profile: () => profile,
    override: (next: ProfileOverrides) => {
      overrides.push(next);
      set({ chat: { ...state.chat, overrides: next } });
    },
    set,
    overrides,
    listeners: () => listeners.size,
  };
  return controller;
}
```

(Se tsc non accetta l'oggetto come `AiChipController` per via dei metodi della classe, tipizzare con `as unknown as AiChipController & {…}`.)

- [ ] **Step 2: Test che falliscono**

`src/elements/ai/suggestions.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import type { PromptPreset } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { fakeAi } from '../../testing/fakeAi';

const preset = (id: string, order: number, name = '', builtInId?: string) => ({ id, order, name, builtInId, hidden: false }) as PromptPreset;
const presets = [preset('builtin:pulisci', 0, '', 'pulisci'), preset('mine', 1, 'Mine')];

function mount() {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.suggestions': 'SUGGERIMENTI' } }), persist() {} });
  const ai = fakeAi({ presets });
  const el = document.createElement('hmd-ai-suggestions');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  return { el, ai, i18n, group: () => el.querySelector<HTMLDivElement>('[role="group"]') };
}

test('a group of preset buttons, labelled, in preset order', () => {
  const { el, group } = mount();
  assert.equal(group()!.className, 'suggestions');
  assert.equal(group()!.getAttribute('aria-label'), EN_MESSAGES['ai.suggestions']);
  assert.deepEqual([...group()!.querySelectorAll('button')].map((b) => [b.type, b.className, b.textContent]), [
    ['button', 'suggestion', EN_MESSAGES['ai.preset.pulisci']],
    ['button', 'suggestion', 'Mine'],
  ]);
  el.remove();
});

test('a click sends hmd-ai-suggestion with the preset id', () => {
  const { el, group } = mount();
  const ids: string[] = [];
  el.addEventListener('hmd-ai-suggestion', (event) => ids.push(event.detail.presetId));
  group()!.querySelectorAll('button')[1].click();
  assert.deepEqual(ids, ['mine']);
  el.remove();
});

test('the group goes away with messages or a running request, and comes back reusing the buttons', () => {
  const { el, ai, group } = mount();
  const first = group()!.querySelector('button');
  ai.set({ chat: { id: 'c', messages: [{}] as never, overrides: {} } });
  assert.equal(group(), null);
  ai.set({ chat: { id: 'c', messages: [], overrides: {} }, running: { messageId: 'm', path: 'a.md', startedAt: 0 } });
  assert.equal(group(), null);
  ai.set({ running: null });
  assert.equal(group()!.querySelector('button'), first);
  el.remove();
});

test('no visible presets: no group', () => {
  const { el, ai, group } = mount();
  ai.set({ presets: [{ ...presets[0], hidden: true }] });
  assert.equal(group(), null);
  el.remove();
});

test('language change relabels; detached, the controller has no listener left', async () => {
  const { el, ai, i18n, group } = mount();
  await i18n.setLocale('it');
  assert.equal(group()!.getAttribute('aria-label'), 'SUGGERIMENTI');
  el.remove();
  assert.equal(ai.listeners(), 0);
});
```

`src/elements/ai/effort-chip.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { fakeAi } from '../../testing/fakeAi';

function mount(kind: 'anthropic' | 'ollama' = 'anthropic') {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.default': 'PREDEFINITO' } }), persist() {} });
  const ai = fakeAi({}, defaultProfile(kind, 'p'));
  const el = document.createElement('hmd-ai-effort-chip');
  el.controller = ai;
  el.i18n = i18n;
  document.body.append(el);
  return { el, ai, i18n, select: () => el.querySelector('select') };
}

test('a labelled chip select with Default and the five levels', () => {
  const { el, select } = mount();
  assert.equal(select()!.className, 'chip');
  assert.equal(select()!.getAttribute('aria-label'), EN_MESSAGES['ai.param.effort']);
  assert.deepEqual([...select()!.options].map((o) => [o.value, o.textContent]), [
    ['', EN_MESSAGES['ai.default']], ['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['xhigh', 'xhigh'], ['max', 'max'],
  ]);
  assert.equal(select()!.value, '');
  el.remove();
});

test('no chip for a profile without effort', () => {
  const { el, select } = mount('ollama');
  assert.equal(select(), null);
  el.remove();
});

test('choosing a level overrides the effort, keeping the other overrides; Default removes it', () => {
  const { el, ai, select } = mount();
  ai.set({ chat: { id: 'c', messages: [], overrides: { temperature: 0.3 } } });
  select()!.value = 'high';
  select()!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { temperature: 0.3, effort: 'high' });
  select()!.value = '';
  select()!.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(ai.overrides.at(-1), { temperature: 0.3, effort: undefined });
  el.remove();
});

test('store updates keep the same select and follow the override', () => {
  const { el, ai, select } = mount();
  const node = select();
  ai.set({ chat: { id: 'c', messages: [], overrides: { effort: 'max' } } });
  assert.equal(select(), node);
  assert.equal(node!.value, 'max');
  el.remove();
});

test('language change relabels Default; detached, no listener left', async () => {
  const { el, ai, i18n, select } = mount();
  await i18n.setLocale('it');
  assert.equal(select()!.options[0].textContent, 'PREDEFINITO');
  el.remove();
  assert.equal(ai.listeners(), 0);
});
```

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/suggestions.dom.test.ts src/elements/ai/effort-chip.dom.test.ts`
Expected: FAIL (tag non definiti).

- [ ] **Step 4: Gli elementi**

`src/elements/ai/suggestions.element.ts`:

```ts
import { presetLabel } from '../../ai/presetName';
import type { PromptPreset } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { suggestionPresets, type AiChipController } from './aiChips';
import './suggestions.css';

/** Preset come suggerimenti sotto il composer (era Suggestions.tsx): solo con la chat vuota. */
export class HmdAiSuggestions extends HmdElement {
  #controller: AiChipController | null = null;
  #i18n: I18nStore | null = null;
  #group: HTMLDivElement | null = null;

  get controller(): AiChipController | null { return this.#controller; }
  set controller(value: AiChipController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#group ??= el('div', { class: 'suggestions', role: 'group' });
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#render(controller, i18n), signal);
    this.watch(i18n, () => this.#render(controller, i18n), signal);
  }

  #render(controller: AiChipController, i18n: I18nStore): void {
    const group = this.#group!;
    const presets = suggestionPresets(controller.getState());
    if (presets.length === 0) {
      group.remove();
      return;
    }
    toggleAttr(group, 'aria-label', true, i18n.t('ai.suggestions'));
    reconcileList(
      group,
      presets,
      (p: PromptPreset) => p.id,
      (p) => el('button', { type: 'button', class: 'suggestion', on: { click: () => emit(this, 'hmd-ai-suggestion', { presetId: p.id }) } }),
      (node, p) => setText(node, presetLabel(p, i18n.t)),
    );
    if (!group.isConnected) this.append(group);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-suggestions': HmdAiSuggestions;
  }
}
```

(Il `click` del pulsante creato in `create` chiude su `p` del primo render: se un preset cambia id resta un nodo nuovo, perché la chiave è l'id; nessun problema. Verificare la firma di `reconcileList` in `src/dom/list.ts` e adattare l'ordine degli argomenti se diverso.)

`src/elements/ai/suggestions.css`:

```css
@layer components {
  @scope (hmd-ai-suggestions) {
    :scope {
      display: contents;
    }

    /* Valori copiati da .suggestions / .suggestion di Composer.module.css. */
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
  }
}
```

`src/elements/ai/effort-chip.element.ts`:

```ts
import { EFFORT_LEVELS } from '../../ai/capabilities';
import type { GenParams } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import type { I18nStore } from '../../state/i18nStore';
import { effortChipState, type AiChipController } from './aiChips';
import './effort-chip.css';

/** Chip dell'effort nel composer (era EffortChip.tsx): solo se il profilo lo supporta. */
export class HmdAiEffortChip extends HmdElement {
  #controller: AiChipController | null = null;
  #i18n: I18nStore | null = null;
  #select: HTMLSelectElement | null = null;

  get controller(): AiChipController | null { return this.#controller; }
  set controller(value: AiChipController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.reconnect();
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#select ??= el(
      'select',
      {
        class: 'chip',
        on: {
          change: () => {
            const controller = this.#controller;
            if (!controller) return;
            const overrides = controller.getState().chat.overrides;
            controller.override({ ...overrides, effort: (this.#select!.value as GenParams['effort']) || undefined });
          },
        },
      },
      el('option', { value: '' }),
      EFFORT_LEVELS.map((level) => el('option', null, level)),
    );
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#render(controller, i18n), signal);
    this.watch(i18n, () => this.#render(controller, i18n), signal);
  }

  #render(controller: AiChipController, i18n: I18nStore): void {
    const select = this.#select!;
    const state = effortChipState(controller.profile(), controller.getState().chat.overrides);
    if (!state.visible) {
      select.remove();
      return;
    }
    toggleAttr(select, 'aria-label', true, i18n.t('ai.param.effort'));
    setText(select.options[0], i18n.t('ai.default'));
    if (!select.isConnected) this.append(select);
    if (select.value !== state.value) select.value = state.value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-effort-chip': HmdAiEffortChip;
  }
}
```

(Il `value` si imposta dopo l'inserimento: un `select` fuori dal documento lo accetta lo stesso, ma così l'ordine è lo stesso del render di React.)

`src/elements/ai/effort-chip.css`: `:scope { display: contents; }` e le regole `.chip` e `.chip:hover` copiate identiche da `src/ui/ai/Composer.module.css`, dentro `@layer components { @scope (hmd-ai-effort-chip) { … } }`.

`src/elements/events.ts`:

```ts
  /** Suggerimento scelto sotto il composer: invia il preset. */
  'hmd-ai-suggestion': CustomEvent<{ presetId: string }>;
```

`define.ts`: `['hmd-ai-effort-chip', HmdAiEffortChip]`, `['hmd-ai-suggestions', HmdAiSuggestions]` (con gli import). `jsx.d.ts` (import `type { AiChipController } from './ai/aiChips'`):

```ts
      'hmd-ai-effort-chip': HmdProps<{ controller: AiChipController; i18n: I18nStore }>;
      'hmd-ai-suggestions': HmdProps<{ controller: AiChipController; i18n: I18nStore }, 'hmd-ai-suggestion'>;
```

- [ ] **Step 5: I chiamanti**

`src/ui/ai/AiSidebar.tsx`: togliere l'import di `Suggestions`; importare `useI18nStore` da `../../i18n/I18nProvider` (accanto a `useT`); `const i18nStore = useI18nStore();`; al posto di `<Suggestions …/>`:

```tsx
        <hmd-ai-suggestions controller={controller} i18n={i18nStore} onhmd-ai-suggestion={(event) => composer.current?.sendPreset(event.detail.presetId)} />
```

`src/ui/ai/Composer.tsx`: togliere l'import di `EffortChip`; `useI18nStore` come sopra; al posto di `<EffortChip controller={controller} />`:

```tsx
        <hmd-ai-effort-chip controller={controller} i18n={i18nStore} />
```

`src/ui/ai/Composer.module.css`: cancellare `.suggestions`, `.suggestion`, `.suggestion:hover:not(:disabled)` (non le usa più nessuno: `grep -rn "styles.suggestion" src` vuoto). `.chip` resta (la usa `ModelChip`).

`git rm src/ui/ai/Suggestions.tsx src/ui/ai/EffortChip.tsx`.

- [ ] **Step 6: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/suggestions.dom.test.ts src/elements/ai/effort-chip.dom.test.ts   # 5 + 5
npm test
npm run lint
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit       # ai-suggestions, effort-chip, model-popover, ai-review uguali alla baseline
```

- [ ] **Step 7: Commit**

```bash
git add -A src/elements src/testing/fakeAi.ts src/ui/ai
git commit -m "feat: hmd-ai-suggestions e hmd-ai-effort-chip al posto di Suggestions ed EffortChip"
```

---

### Task 5: `hmd-ai-parameters`

**Files:**
- Create: `src/elements/ai/parameters.element.ts`, `parameters.css`, `parameters.dom.test.ts`
- Modify: `src/elements/define.ts`, `events.ts`, `jsx.d.ts`, `src/ui/ai/ModelChip.tsx`, `src/ui/ai/settings/AiProfilesSection.tsx`, `src/ui/ai/settings/AiPresetsSection.tsx`
- Delete: `src/ui/ai/Parameters.tsx`

**Interfaces:**
- Consumes: `parameterFields`, `withParam`, `ParamField`, `EFFORT_LEVELS` (Task 2).
- Produces: `HmdAiParameters` con proprietà `profile: ModelProfile | null`, `value: GenParams`, `hideEffort: boolean`, `i18n: I18nStore | null`; evento `hmd-params-change` (`CustomEvent<{ params: GenParams }>`).

- [ ] **Step 1: Test che falliscono**

`src/elements/ai/parameters.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { defaultProfile } from '../../ai/profiles';
import type { GenParams } from '../../ai/types';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';

function mount(kind: 'anthropic' | 'ollama' = 'ollama', value: GenParams = {}, hideEffort = false) {
  const i18n = createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'ai.param.topP': 'TOP P' } }), persist() {} });
  const el = document.createElement('hmd-ai-parameters');
  el.profile = defaultProfile(kind, 'p');
  el.value = value;
  el.hideEffort = hideEffort;
  el.i18n = i18n;
  document.body.append(el);
  const changes: GenParams[] = [];
  el.addEventListener('hmd-params-change', (event) => changes.push(event.detail.params));
  const input = (name: string) => [...el.querySelectorAll('label')].find((l) => l.querySelector('span')!.textContent === name)!.querySelector('input')!;
  return { el, i18n, changes, input };
}

test('a section with one label per field: span text and a number input with its limits', () => {
  const { el } = mount('ollama', { temperature: 0.7 });
  const section = el.firstElementChild!;
  assert.equal(section.className, 'section');
  assert.deepEqual([...section.querySelectorAll('label')].map((l) => {
    const i = l.querySelector('input')!;
    return [l.querySelector('span')!.textContent, i.type, i.min, i.max, i.step, i.value];
  }), [
    [EN_MESSAGES['ai.param.temperature'], 'number', '0', '2', '0.1', '0.7'],
    [EN_MESSAGES['ai.param.topP'], 'number', '0', '1', '0.1', ''],
    [EN_MESSAGES['ai.param.maxOutputTokens'], 'number', '1', '', '1', ''],
    [EN_MESSAGES['ai.param.chunkChars'], 'number', '1', '', '1', ''],
  ]);
  el.remove();
});

test('typing sends the new params; an empty field removes the key', () => {
  const { el, changes, input } = mount('ollama', { temperature: 0.7, topP: 0.9 });
  const t = input(EN_MESSAGES['ai.param.temperature']);
  t.value = '1.2';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  t.value = '';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(changes, [{ temperature: 1.2, topP: 0.9 }, { temperature: undefined, topP: 0.9 }]);
  el.remove();
});

test('a new value object with the same number does not rewrite the text the user typed ("1.50")', () => {
  const { el, input } = mount('ollama', { topP: 1.5 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  p.value = '1.50';
  // React ripassa un oggetto nuovo a ogni render: lo stesso numero non deve toccare il campo.
  el.value = { topP: 1.5 };
  assert.equal(p.value, '1.50');
  el.value = { topP: 0.4 };
  assert.equal(p.value, '0.4');
  el.value = {};
  assert.equal(p.value, '');
  el.remove();
});

test('a partial number the browser cannot parse ("0.") arrives as an empty value and is not rewritten', () => {
  const { el, changes, input } = mount('ollama', { topP: 0.9 });
  const p = input(EN_MESSAGES['ai.param.topP']);
  // jsdom, come Chromium, dà value "" per un numero non valido mentre si scrive.
  p.value = '0.';
  p.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(changes.at(-1), { topP: undefined });
  el.value = { topP: undefined };
  assert.equal(p.value, '');
  el.remove();
});

test('the inputs stay the same nodes across value updates and profile changes with the same fields', () => {
  const { el, input } = mount('ollama');
  const t = input(EN_MESSAGES['ai.param.temperature']);
  el.value = { temperature: 1 };
  el.profile = { ...defaultProfile('ollama', 'other') };
  assert.equal(input(EN_MESSAGES['ai.param.temperature']), t);
  el.remove();
});

test('effort: a select at the end for profiles that support it, unless hidden', () => {
  const shown = mount('anthropic', { effort: 'high' });
  const label = [...shown.el.querySelectorAll('label')].at(-1)!;
  assert.equal(label.querySelector('span')!.textContent, EN_MESSAGES['ai.param.effort']);
  const select = label.querySelector('select')!;
  assert.deepEqual([...select.options].map((o) => o.value), ['', 'low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(select.options[0].textContent, EN_MESSAGES['ai.default']);
  assert.equal(select.value, 'high');
  select.value = '';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(shown.changes.at(-1), { effort: undefined });
  shown.el.remove();
  const hidden = mount('anthropic', {}, true);
  assert.equal(hidden.el.querySelector('select'), null);
  hidden.el.remove();
});

test('language change relabels in place', async () => {
  const { el, i18n } = mount();
  const span = el.querySelectorAll('label span')[1];
  await i18n.setLocale('it');
  assert.equal(el.querySelectorAll('label span')[1], span);
  assert.equal(span.textContent, 'TOP P');
  el.remove();
});
```

(Il terzo test usa `select` con evento `change`: l'elemento ascolta `change` sul `select` e `input` sugli input numerici, come React.)

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/parameters.dom.test.ts`
Expected: FAIL (tag non definito).

- [ ] **Step 3: L'elemento**

`src/elements/ai/parameters.element.ts`:

```ts
import { EFFORT_LEVELS } from '../../ai/capabilities';
import type { GenParams, ModelProfile } from '../../ai/types';
import { HmdElement } from '../../dom/element';
import { el, setText } from '../../dom/el';
import { reconcileList } from '../../dom/list';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { parameterFields, withParam, type ParamField } from './aiChips';
import './parameters.css';

/** Parametri di generazione (era Parameters.tsx): nel popover del modello e nelle impostazioni. */
export class HmdAiParameters extends HmdElement {
  #profile: ModelProfile | null = null;
  #value: GenParams = {};
  #hideEffort = false;
  #i18n: I18nStore | null = null;
  #section: HTMLDivElement | null = null;

  get profile(): ModelProfile | null { return this.#profile; }
  set profile(value: ModelProfile | null) { this.#profile = value ?? null; this.#render(); }
  get value(): GenParams { return this.#value; }
  set value(value: GenParams) { this.#value = value ?? {}; this.#render(); }
  get hideEffort(): boolean { return this.#hideEffort; }
  set hideEffort(value: boolean) { this.#hideEffort = !!value; this.#render(); }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.reconnect();
  }

  protected connect(signal: AbortSignal): void {
    this.#section ??= this.appendChild(el('div', { class: 'section' }));
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #change(field: ParamField, raw: string): void {
    emit(this, 'hmd-params-change', { params: withParam(this.#value, field.key, raw) });
  }

  #create(field: ParamField): HTMLLabelElement {
    const control =
      field.kind === 'effort'
        ? el(
            'select',
            { on: { change: (event) => this.#change(field, (event.currentTarget as HTMLSelectElement).value) } },
            el('option', { value: '' }),
            EFFORT_LEVELS.map((level) => el('option', null, level)),
          )
        : el('input', { type: 'number', min: String(field.min), max: field.max === undefined ? undefined : String(field.max), step: String(field.step), on: { input: (event) => this.#change(field, (event.currentTarget as HTMLInputElement).value) } });
    return el('label', null, el('span'), control);
  }

  #render(): void {
    const section = this.#section;
    const i18n = this.#i18n;
    if (!section || !i18n || !this.#profile) return;
    const value = this.#value;
    reconcileList(
      section,
      parameterFields(this.#profile, this.#hideEffort),
      (field) => field.key,
      (field) => this.#create(field),
      (label, field) => {
        setText(label.querySelector('span')!, i18n.t(`ai.param.${field.key}`));
        if (field.kind === 'effort') {
          const select = label.querySelector('select')!;
          setText(select.options[0], i18n.t('ai.default'));
          const next = value.effort ?? '';
          if (select.value !== next) select.value = next;
          return;
        }
        const input = label.querySelector('input')!;
        const next = value[field.key];
        // Come React con gli input numerici: si riscrive solo se il numero cambia, così "0." resta.
        const current = input.value === '' ? undefined : Number(input.value);
        if (current !== next) input.value = next === undefined ? '' : String(next);
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-parameters': HmdAiParameters;
  }
}
```

(Note: nel `create` di `reconcileList` i limiti `min/max/step` dipendono solo dalla chiave, che è anche la chiave della lista: un nodo riusato ha già quelli giusti. Testo parziale come `"0."`: il browser riporta `value === ""`, l'evento manda il parametro tolto e il genitore ripassa `undefined`, quindi `current === next` e il campo non si tocca; è lo stesso percorso di React (`node.value != value`). Lo verifica in Chromium l'e2e del Task 1 «typing a partial number keeps the text».)

`src/elements/ai/parameters.css`: dentro `@layer components { @scope (hmd-ai-parameters) { … } }`, `:scope { display: contents; }` e le regole di `.popoverSection` di `src/ui/ai/Composer.module.css` con la classe rinominata in `.section`, valori identici:

```css
    .section { display: flex; flex-direction: column; gap: 6px; margin: 0 0 10px; padding: 0; border: none; }
    .section label { display: flex; align-items: center; gap: 8px; }
    .section label > span { flex: 0 0 45%; }
    .section input:not([type='radio']),
    .section select { flex: 1; min-width: 0; }
```

(scritte su più righe come negli altri fogli; `.popoverSection legend` non serve: Parameters non ha `legend`. `.popoverSection` resta in `Composer.module.css`: la usano `ModelSelect` e il fieldset dei profili in `ModelChip`.)

`events.ts`:

```ts
  /** Parametri di generazione modificati (popover del modello, impostazioni di profili e preset). */
  'hmd-params-change': CustomEvent<{ params: GenParams }>;
```

(import `type { GenParams } from '../ai/types'` in testa a `events.ts`.)

`define.ts`: `['hmd-ai-parameters', HmdAiParameters]`. `jsx.d.ts` (import `type { GenParams, ModelProfile } from '../ai/types'`):

```ts
      'hmd-ai-parameters': HmdProps<{ profile: ModelProfile; value: GenParams; hideEffort: boolean; i18n: I18nStore }, 'hmd-params-change'>;
```

- [ ] **Step 4: I chiamanti**

`src/ui/ai/ModelChip.tsx` (import `useI18nStore`, `const i18nStore = useI18nStore();`, via l'import di `Parameters`):

```tsx
        <hmd-ai-parameters
          profile={effective}
          value={{ ...profile.params, ...overrides }}
          hideEffort
          i18n={i18nStore}
          onhmd-params-change={(event) => controller.override({ ...overrides, ...event.detail.params })}
        />
```

`src/ui/ai/settings/AiProfilesSection.tsx`:

```tsx
          <hmd-ai-parameters profile={draft} value={draft.params} i18n={i18nStore} onhmd-params-change={(event) => setDraft({ ...draft, params: event.detail.params })} />
```

`src/ui/ai/settings/AiPresetsSection.tsx`:

```tsx
          <hmd-ai-parameters profile={defaultProfile()} value={draft.params ?? {}} i18n={i18nStore} onhmd-params-change={(event) => setDraft({ ...draft, params: event.detail.params })} />
```

(in entrambe: `useI18nStore` importato accanto a `useT`, `const i18nStore = useI18nStore();`, via l'import di `Parameters`). Attenzione: `defaultProfile()` crea un oggetto nuovo a ogni render; l'elemento rifà solo il `reconcileList` (stessi campi, stessi nodi): va bene.

`git rm src/ui/ai/Parameters.tsx`.

- [ ] **Step 5: Verifica completa**

```bash
npx tsx --import ./src/testing/assetHooks.ts --test src/elements/ai/parameters.dom.test.ts   # 7 pass
npm test
npm run lint
npm run test:e2e             # compreso "typing a partial number keeps the text"
npm run test:e2e:dev
npm run test:e2e:audit       # settings-profile, model-popover, effort-chip uguali alla baseline
```

- [ ] **Step 6: Commit**

```bash
git add -A src/elements src/ui/ai
git commit -m "feat: hmd-ai-parameters al posto di Parameters (popover del modello e impostazioni)"
```

---

### Task 6: Documenti, misure, chiusura e merge

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`, `src/elements/jsx.d.ts` (solo se serve il commento), memoria non nel repo

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1
```

- [ ] **Step 2: Spec**

1. Riga `Stato:`: «fasi 4a e 4b in `main` …; fasi 4c–8 ancora piano» → «fasi 4a–4c in `main` (merge locali del 05/10, dal branch `feat/web-components`); fasi 5–8 ancora piano».
2. §7 fase 4, dopo il punto della 4b: «- 4c **fatta**: `hmd-start-screen`, `hmd-ai-suggestions`, `hmd-ai-effort-chip`, `hmd-ai-parameters`; logica in `start-screen/startView.ts` e `ai/aiChips.ts` (`AiChipController`: gli elementi AI ricevono il controller con un'interfaccia minima, `src/testing/fakeAi.ts` nei test); `EFFORT_LEVELS` in `ai/capabilities.ts`. Regole del tema dentro `@scope` con `:root[…] :scope …`. Audit esteso a start con tema esplicito, ripresa, dettaglio del profilo, popover del modello, suggerimenti, chip dell'effort. Bundle principale gzip: <Task 1> → <oggi> B.»
3. §13: aggiungere `docs/superpowers/plans/2026-10-05-housemd-wc-07-fase-4c-start-e-foglie-ai.md` (fase 4c).

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
git commit -m "docs: spec allineato alla fase 4c (start screen e foglie AI)"
```

- [ ] **Step 5: Merge in `main` (regola del 05/10)** — lo fa il controller dopo la review finale e la checklist, non l'implementer:

```bash
cd /home/davidedipumpo/Projects/housemd && git status --short   # pulito
git merge --no-ff feat/web-components -m "Merge: fase 4c Web Components (start screen e foglie AI)"
npm test && npm run lint
git push origin main
cd ../housemd-wc && git merge --ff-only main && git push origin feat/web-components
```

- [ ] **Step 6: Checklist manuale** (la prova il controller in Chrome sul server di sviluppo del worktree, porta 5173): start screen in tema chiaro/scuro/auto; suggerimenti con chat vuota, scelta di uno, Nuova chat; chip dell'effort con un profilo Anthropic; parametri nel popover del modello e nelle impostazioni (scrivere `0.5`, svuotare, salvare); cambio di lingua con un parametro visibile.
