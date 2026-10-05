# HouseMD Web Components — Piano 6: fase 4b, dialog come funzioni-Promise

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i componenti React `NameDialog`, `ConfirmDialog` e `AccessLostDialog` con tre funzioni (`showNameDialog`, `showConfirmDialog`, `showAccessLostDialog`) che creano un `<dialog>` nativo, lo aprono con `showModal()` e restituiscono una Promise, senza cambiare aspetto né comportamento (con un'eccezione dichiarata sul focus, vedi "Scostamenti").

**Architecture:** Un nucleo comune (`src/elements/dialogs/modal.ts`) crea il `<dialog class="hmd-dialog">`, lo aggiunge a `document.body`, chiama `showModal()`, aspetta l'evento `close`, **poi** rimuove il dialog (chiudere prima di rimuovere fa tornare il focus all'elemento che l'aveva) e risolve con `returnValue`. Un `AbortSignal` opzionale chiude il dialog quando chi l'ha aperto sparisce (smontaggio React, StrictMode, cambio di stato). I chiamanti React passano da stato + JSX condizionale a una chiamata nell'handler dell'evento (`await showConfirmDialog(…)`); l'unico dialog guidato dallo stato (accesso perso) si apre in un `useEffect` con un `AbortController` nel cleanup. Il foglio `dialogs.css` è `@layer components { @scope (dialog.hmd-dialog) { … } }`, con lo stesso albero DOM di oggi, così l'audit degli stili calcolati resta confrontabile.

**Tech Stack:** TypeScript 7, React 19.3 (solo nei chiamanti), `<dialog>` + `closedby` + Invoker Commands (`command="close"` / `commandfor`), CSS `@scope`/`@layer`, `tsx --test` con jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md` (§3, §3.1 cartella `elements/dialogs/`, §4.2 radice `dialog.hmd-dialog`, §5.4, §7 fase 4, §8.2–8.4, §9 punti 5, 8, 11, 15, 16; R2, R3, R11). Il Task 7 aggiorna lo spec (vedi "Scostamenti dallo spec").

## Global Constraints

- **Branch** `feat/web-components`, worktree `../housemd-wc` (HEAD di partenza `943d309`, fase 4a fatta). Nessun merge in `main` (uno solo alla fine della fase 8, con il via di Davide). **Push solo con il via di Davide.**
- **Aspetto e comportamento invariati.** `npm run test:e2e` verde **con gli snapshot di oggi** (nessuno si rigenera); `npm run test:e2e:dev` verde (console senza errori né avvisi); `npm run test:e2e:audit` verde contro `dist-baseline/` ricostruita al Task 1 da questo branch.
- Regole di `CLAUDE.md` e spec §2: mai `alert/confirm/prompt`, dialog con `showModal()` e `closedby` (`any`, `none` per l'accesso perso); DOM solo con `el()` e `textContent` (mai stringhe HTML); testi solo da `t()`, **nessuna chiave nuova** in questo piano; tooltip mai con `title`; la File System Access API solo da `fs/fsaOps.ts` e `fs/access.ts` (i dialog ricevono `onResume`, non chiamano `requestAccess`).
- I dialog **non** sono custom element (spec §3: "funzioni, non elementi"): niente `define.ts`, niente `HmdElement`. Vivono in `src/elements/dialogs/` e il loro CSS ha la radice `dialog.hmd-dialog` (già ammessa da `architecture.test.ts`).
- Ogni `addEventListener` sul `signal` esterno usa `{ once: true }` ed è tolto alla chiusura: un dialog chiuso non lascia listener sul signal del chiamante (R3).
- **Mai ricreare un nodo che può avere il focus**: l'input del dialog del nome resta lo stesso nodo per tutta la vita del dialog; si inserisce e si toglie solo il `<p>` dell'errore (che non prende il focus).
- Commenti e commit in italiano, identificatori in inglese, prefisso convenzionale, **senza righe di attribuzione**.
- Le regole e2e di `CLAUDE.md` valgono (ruolo e nome accessibile, testi da `en.json`, mai classi CSS dell'app).
- **Mai giudicare un comando di verifica dal suo output filtrato** (niente `| grep`/`| tail` sui test).
- Verifica di ogni task che tocca l'app: `npm test`, `npm run lint`, `npm run test:e2e`, `npm run test:e2e:dev`, `npm run test:e2e:audit`. La macchina ha 7 GB di RAM: **mai due suite e2e in parallelo**.

## Misure prese scrivendo il piano (05/10, su `feat/web-components` = `943d309`)

1. **Focus alla chiusura, oggi** (probe Playwright sulla build di produzione):
   - menu ⋯ dell'albero → Rinomina → Esc: il focus torna sul pulsante «Actions for note.md»;
   - menu ⋯ → Elimina → Annulla: idem, sul pulsante «Actions for …»;
   - impostazioni con modifiche → Chiudi → Annulla: torna su «Close»;
   - nella conferma, il focus iniziale è su «Cancel»; nel dialog del nome, sull'input con selezionato `note` di `note.md` (`[0, 4]`);
   - **«New file» dalla testata → nome → Invio: il focus finisce sul `body`**. React smonta il dialog prima di chiuderlo (il cleanup dell'effetto gira a nodo già staccato) e il ripristino del focus del dialog non avviene. Con le funzioni il dialog si chiude e poi si rimuove: il focus torna su «New file» (vedi "Scostamenti", punto 2).
2. **Difetto preesistente**: nelle impostazioni con modifiche aperte, **Esc** apre la conferma e la stessa pressione la annulla subito (log: `added`, `cancel`, `close`): visivamente non succede nulla. Lo `showModal()` avviene durante il `keydown` di Esc, la cui azione predefinita (close request) colpisce il dialog appena aperto. Con `showConfirmDialog` chiamata nel listener succede lo stesso: il piano **lo conserva** (vedi "Scostamenti", punto 3).
3. In Chromium, dentro `@scope (dialog.hmd-dialog)`, `:scope::backdrop` e `:scope.access::backdrop` si applicano e `getComputedStyle(dialog, '::backdrop')` li legge (`rgba(0, 0, 0, 0.35)` / `0.45`); `button.command` è una proprietà stringa e `command="close"` + `commandfor` chiude il dialog; `dialog.closedBy` esiste.
4. jsdom 30: `HTMLDialogElement` esiste ma senza `showModal`, `close`, `returnValue`, `closedBy`; `button.command` non esiste (con `el()` diventa attributo, come serve); `button.autofocus` sì.
5. L'audit degli stili (`e2e/support/styleAudit.ts`) legge solo `::before`/`::after`: lo sfondo dei backdrop oggi **non è controllato** da nessun test, e non ci sono stati di audit per la conferma né per l'accesso perso (Task 1).

## Scostamenti dallo spec (da riportare nello spec al Task 7)

1. **Firme con `signal`.** Tutte e tre le funzioni accettano `signal?: AbortSignal`: all'interruzione il dialog si chiude e la Promise si risolve come un annullamento (`false`, `null`, `undefined`). Serve ai componenti React che si smontano con il dialog aperto (StrictMode compreso) e, dalla fase 7, agli elementi (`HmdElement` ha già il suo signal).
2. **Focus dopo una conferma.** Lo spec (§5.4) dice che il focus torna al pulsante che ha aperto il dialog: con le funzioni vale **anche dopo la conferma**, mentre oggi dopo «Create»/«Rename»/«Delete» il focus cadeva sul `body` (misura 1). Se l'elemento d'origine sparisce (riga eliminata o rinominata), il focus va al `body` come oggi. È l'unico cambio di comportamento del piano, coperto da un e2e nuovo (Task 5).
3. **Esc nelle impostazioni con modifiche aperte resta senza effetto** (misura 2), come i timer dei toast nella 4a: correggerlo (`event.preventDefault()` sul `keydown` prima di aprire la conferma) è una decisione a parte di Davide.
4. **`runTreeDialog`** (`src/elements/workspace/treeDialogs.ts`): la parte di `WorkspaceView` che, dato il `DialogState` di `dialogFor`, apre il dialog giusto e chiama il `Workspace`. Testata in jsdom; nella fase 7 la usa `hmd-workspace`.
5. **`showDiscardChangesDialog`**: la conferma «Discard unsaved changes?» compare in tre posti (impostazioni, profili, preset) con gli stessi testi: una funzione sola in `confirmDialog.ts`.
6. **`Dialog.module.css` non sparisce**: perde le classi dei dialog ma tiene `.field`, `.input`, `.group`, `.option`, `.secondary`, usate da `SettingsView` fino alla fase 7.

## Review Focus

1. **Focus che torna dove deve** dopo Esc, Annulla e conferma (al pulsante d'origine se c'è ancora, mai su un nodo staccato): e2e del Task 1 (Esc e Annulla, comportamento di oggi) e del Task 5 (conferma da «New file», comportamento nuovo).
2. **Conferma aperta due volte**: «Indietro» del browser con la conferma delle impostazioni già aperta richiama `close()`; deve restare **un** dialog. Guardia `confirming` nel Task 6 + e2e del Task 1.
3. **Chiamante che sparisce con il dialog aperto** (StrictMode in sviluppo, stato che esce da `access-lost`, revisione che cambia ramo): il dialog si chiude, nessun `InvalidStateError`, nessun listener rimasto sul signal. Test jsdom di `modal.ts` (Task 2) e di `showAccessLostDialog` (Task 4) + suite `test:e2e:dev` (console pulita).
4. **Stato letto alla conferma, non all'apertura**: nome già esistente controllato sui percorsi attuali (`paths()` chiamata al submit), «Accetta tutto» eseguito con la proposta dell'ultimo render (`acceptRef`). Test jsdom di `runTreeDialog` (Task 5) con i percorsi che cambiano a dialog aperto.
5. **Accesso perso**: Esc e clic fuori non chiudono; una chiusura sfuggita lo riapre; due rifiuti di fila mostrano **un** solo messaggio d'errore; un'eccezione di `onResume` mostra l'errore invece di rompere la Promise. Test jsdom (Task 4) + e2e esistente `external.spec.ts`.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `e2e/support/styleAudit.ts`, `e2e/computed-styles.audit.ts` | Backdrop dei dialog nell'audit; stati per conferma, modifiche aperte e accesso perso. |
| `e2e/tree.spec.ts`, `e2e/settings.spec.ts` | Focus alla chiusura, conferme dei profili/preset, conferma unica con «Indietro». |
| `src/testing/dialogStub.ts` | `showModal`/`close`/`returnValue`/`command="close"` finti per jsdom. |
| `src/elements/dialogs/modal.ts` (+ `modal.dom.test.ts`) | Nucleo: crea, apre, chiude con il signal, rimuove, risolve. Tipo `Translate`. |
| `src/elements/dialogs/dialogs.css` | Stili di `Dialog.module.css` (parte dialog) e di `.accessDialog`/`.accessError`/`.primary` di `WorkspaceView.module.css`. |
| `src/elements/dialogs/confirmDialog.ts` (+ test) | `showConfirmDialog`, `showDiscardChangesDialog` (era `ui/ConfirmDialog.tsx`). |
| `src/elements/dialogs/nameDialog.ts` (+ test) | `showNameDialog` (era `ui/NameDialog.tsx`). |
| `src/elements/dialogs/accessLostDialog.ts` (+ test) | `showAccessLostDialog` (era `AccessLostDialog` in `ui/WorkspaceView.tsx`). |
| `src/elements/workspace/treeDialogs.ts` (+ `treeDialogs.dom.test.ts`) | `runTreeDialog`: dialog dell'albero → operazione del `Workspace`. |
| `src/ui/useUnmountSignal.ts` | Hook React temporaneo (via nella fase 7): signal interrotto allo smontaggio. |
| `src/ui/WorkspaceView.tsx`, `src/ui/WorkspaceView.module.css` | Dialog dell'albero e accesso perso con le funzioni. |
| `src/ui/SettingsView.tsx`, `src/ui/ai/settings/AiProfilesSection.tsx`, `AiPresetsSection.tsx`, `AiSyncSection.tsx`, `src/ui/ai/ReviewView.tsx` | Conferme con le funzioni. |
| `src/ui/ConfirmDialog.tsx`, `src/ui/NameDialog.tsx` | Cancellati. |
| `src/ui/Dialog.module.css` | Tiene solo le classi dei campi delle impostazioni. |
| `src/architecture.test.ts` | `showModal(` e `<dialog` solo in `src/elements/dialogs/`. |

---

### Task 1: Baseline e rete di sicurezza sui dialog di oggi

Nessuna riga dell'app cambia: si aggiungono test che **passano sull'app React di oggi** e fissano ciò che la migrazione non deve rompere.

**Files:**
- Modify: `e2e/support/styleAudit.ts:40-46`, `e2e/computed-styles.audit.ts` (array `STATES`)
- Modify: `e2e/tree.spec.ts`, `e2e/settings.spec.ts`

**Interfaces:**
- Produces: stati di audit `confirm-dialog`, `unsaved-dialog`, `access-lost-dialog`; chiavi `…::backdrop` nel dump degli stili.

- [ ] **Step 1: Baseline e build di riferimento dal branch**

```bash
cd /home/davidedipumpo/Projects/housemd-wc
git status --short                                # vuoto, HEAD 943d309 (o il commit del piano)
npm test                                          # annotare il numero di pass
npm run lint
npm run build
gzip -c dist/assets/index-*.js | wc -c            # annotare
rm -rf dist-baseline && cp -r dist dist-baseline  # riferimento dell'audit: il branch prima della 4b
```

`dist-baseline/` resta per tutto il piano: **non ricostruirla** nei task successivi.

- [ ] **Step 2: Dialog con una chiave indipendente dalla posizione, e backdrop nell'audit**

Oggi i dialog React stanno dentro `#root` (fratelli del layout di `WorkspaceView`); con le funzioni stanno in `document.body`. La chiave del dump è il percorso nel DOM (`pathOf`), quindi senza correzione l'audit vedrebbe "elementi spariti e nuovi" anche con stili identici. Un dialog è nel top layer: la sua posizione nel DOM conta solo per l'ereditarietà, e `#root` non imposta proprietà ereditabili (`global.css`: solo `height` e `margin`), quindi la chiave del dialog si rende indipendente dal genitore e il confronto degli stili calcolati resta pieno.

In `e2e/support/styleAudit.ts`, in `pathOf`, il ciclo si ferma al primo `dialog` incontrato e lo chiama per indice tra i dialog del documento:

```ts
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement; node = parentOf(node)) {
      // Un dialog sta nel top layer: la chiave non dipende da dove è appeso nel DOM (#root o body).
      if (node.localName === 'dialog') {
        parts.unshift(`dialog#${[...document.querySelectorAll('dialog')].indexOf(node as HTMLDialogElement)}`);
        break;
      }
      const parent = parentOf(node);
      const index = parent ? flatChildren(parent).indexOf(node) : 0;
      parts.unshift(`${node.localName}:${index}`);
    }
    return parts.join('>') || 'html';
  };
```

Oggi il dialog è anche un figlio di `#root`, e il suo indice sposta quello dei fratelli che lo seguono (impostazioni, `hmd-toasts`): con il dialog in `body` gli indici cambierebbero. Per questo `flatChildren` salta i dialog, che hanno già la loro chiave:

```ts
  const flatChildren = (node: Element): Element[] =>
    [...node.children].flatMap((child) => (transparent(child) ? flatChildren(child) : child.localName === 'dialog' ? [] : [child]));
```

Poi, nel ciclo dei pseudo-elementi (oggi `for (const pseudo of ['::before', '::after'])`), aggiungere il backdrop dei dialog modali. Il ciclo diventa:

```ts
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo);
      if (style.content !== 'none' && style.content !== 'normal') out[`${path}${pseudo}`] = read(style);
    }
    // Il backdrop non ha `content`: esiste solo per i dialog modali (top layer).
    if (el.matches('dialog:modal')) out[`${path}::backdrop`] = read(getComputedStyle(el, '::backdrop'));
```

Aggiornare il commento in testa al file: «più `::before`/`::after`» → «più `::before`/`::after` e `::backdrop` dei dialog modali; i dialog hanno la chiave `dialog#<indice>`, qualunque sia il genitore».

- [ ] **Step 3: Stati di audit per i dialog**

In `e2e/computed-styles.audit.ts`, subito dopo lo stato `name-dialog`, aggiungere:

```ts
  {
    name: 'confirm-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
      await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
      await expect(page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) })).toBeVisible();
    },
  },
  {
    name: 'unsaved-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await page.getByRole('button', { name: app.t('toolbar.settings') }).click();
      const settings = page.getByRole('region', { name: app.t('settings.title') });
      await settings.getByRole('link', { name: app.t('settings.aiProfiles') }).click();
      await settings.getByRole('button', { name: `+ ${app.t('ai.create')}` }).first().click();
      await settings.getByLabel(app.t('ai.name'), { exact: true }).first().fill('Bozza');
      await settings.getByRole('button', { name: app.t('settings.close') }).click();
      await expect(page.getByRole('dialog', { name: app.t('ai.unsavedTitle') })).toBeVisible();
    },
  },
  {
    name: 'access-lost-dialog',
    async setup(app, page) {
      await app.openFolder({ 'note.md': '# Note' });
      await app.openFile('note.md');
      await app.setFlags({ denyWrites: true, request: 'denied' });
      await app.typeAtEnd('x');
      const dialog = page.getByRole('dialog', { name: app.t('access.title') });
      await dialog.getByRole('button', { name: app.t('access.resume') }).click();
      await expect(dialog.getByText(app.t('access.denied'))).toBeVisible();
    },
  },
```

Lo stato dell'accesso perso include il messaggio d'errore, così l'audit copre anche `.accessError`.

- [ ] **Step 4: E2e sul focus alla chiusura (albero)**

In `e2e/tree.spec.ts`, dentro `test.describe('dialogs and menu', …)`, dopo il test `'delete from the menu asks first; cancel keeps the file'`:

```ts
  test('closing a dialog opened from the ⋯ menu brings the focus back to the ⋯ button', async ({ app, page }) => {
    const trigger = page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) });
    await trigger.click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const rename = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) });
    await expect(rename.getByRole('textbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(rename).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('button', { name: app.t('tree.delete'), exact: true }).click();
    const remove = page.getByRole('dialog', { name: app.t('dialog.delete.title', { name: 'note.md' }) });
    // La scelta sicura ha il focus: Invio non elimina.
    await expect(remove.getByRole('button', { name: app.t('dialog.cancel') })).toBeFocused();
    await remove.getByRole('button', { name: app.t('dialog.cancel') }).click();
    await expect(remove).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the rename dialog selects the name without the extension', async ({ app, page }) => {
    await page.getByRole('button', { name: app.t('tree.actions', { name: 'note.md' }) }).click();
    await app.tree().getByRole('button', { name: app.t('tree.rename'), exact: true }).click();
    const input = page.getByRole('dialog', { name: app.t('dialog.rename.title', { name: 'note.md' }) }).getByRole('textbox');
    await expect(input).toHaveValue('note.md');
    expect(await input.evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 4]);
  });
```

Se il `beforeEach` del `describe` non crea `note.md`, usare un file che crea (il test `'delete from the menu…'` usa `note.md`: stessa cartella).

- [ ] **Step 5: E2e sulle conferme delle impostazioni**

In `e2e/settings.spec.ts`, dopo `'Close with unsaved changes asks first; Discard closes'`:

```ts
test('Back again with the confirmation already open keeps a single dialog', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  await page.goBack();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await expect(dialog).toBeVisible();
  await page.goBack();
  await page.waitForTimeout(200);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(settings(app)).toBeVisible();
});

test('switching profile with unsaved changes asks first; Cancel keeps the draft, Discard switches', async ({ app, page }) => {
  await openSettings(app);
  await dirtyProfile(app);
  const name = settings(app).getByLabel(app.t('ai.name'), { exact: true }).first();
  // «+ Create» con una bozza sporca passa da select() come il clic su un altro profilo.
  const other = settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).first();
  await other.click();
  const dialog = page.getByRole('dialog', { name: app.t('ai.unsavedTitle') });
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue('Bozza');

  await other.click();
  await page.getByRole('dialog', { name: app.t('ai.unsavedTitle') }).getByRole('button', { name: app.t('ai.discardChanges') }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(name).not.toHaveValue('Bozza');
});

test('deleting a preset asks first; Cancel keeps it, Delete removes it', async ({ app, page }) => {
  await openSettings(app);
  await settings(app).getByRole('link', { name: app.t('settings.aiPresets') }).click();
  // Seconda sezione AI (profili, preset, sync): stesso ordine dei link di navigazione.
  await settings(app).getByRole('button', { name: `+ ${app.t('ai.create')}` }).nth(1).click();
  // Solo la sezione dei preset ha un elemento aperto: un solo campo «Name» e un solo «Save».
  await settings(app).getByLabel(app.t('ai.name'), { exact: true }).fill('Temporaneo');
  await settings(app).getByRole('button', { name: app.t('ai.save'), exact: true }).click();
  const item = settings(app).getByRole('button', { name: 'Temporaneo', exact: true });
  await expect(item).toBeVisible();

  const remove = settings(app).getByRole('button', { name: app.t('ai.delete'), exact: true });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: app.t('ai.deleteTitle', { name: 'Temporaneo' }) });
  await expect(dialog.getByText(app.t('ai.deleteMessage'))).toBeVisible();
  await dialog.getByRole('button', { name: app.t('dialog.cancel') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(item).toBeVisible();

  await remove.click();
  await dialog.getByRole('button', { name: app.t('ai.delete'), exact: true }).click();
  await expect(item).toHaveCount(0);
});
```

Nel test della lista dei profili, «+ Create» con una bozza sporca passa da `select()` come il clic su un altro profilo (stessa strada `pick` → `select`), quindi apre la conferma. Se un localizzatore non trova l'elemento sull'app di oggi, correggere il **localizzatore** (ruolo e nome da `en.json`), mai l'asserzione sul comportamento; se il comportamento di oggi è diverso da quello scritto, fermarsi e riportarlo.

- [ ] **Step 6: Suite verdi sull'app di oggi**

```bash
npm run lint
npm run test:e2e            # annotare: +5 test rispetto al baseline (2 in tree, 3 in settings)
npm run test:e2e:dev        # annotare
npm run test:e2e:audit      # annotare (+3 stati); tutti verdi: le due build sono identiche
```

Expected: tutto verde. Se l'audit fallisce su una chiave `::backdrop`, la lettura non è stabile: fermarsi e riportarlo (le build sono uguali, non deve succedere).

- [ ] **Step 7: Commit**

```bash
git add e2e/
git commit -m "test: rete sui dialog prima della 4b (focus alla chiusura, conferme delle impostazioni, backdrop nell'audit)"
```

---

### Task 2: Nucleo dei dialog, stub per jsdom e `showConfirmDialog`

**Files:**
- Create: `src/testing/dialogStub.ts`
- Create: `src/elements/dialogs/modal.ts`, `src/elements/dialogs/modal.dom.test.ts`
- Create: `src/elements/dialogs/dialogs.css`
- Create: `src/elements/dialogs/confirmDialog.ts`, `src/elements/dialogs/confirmDialog.dom.test.ts`

**Interfaces:**
- Produces (`src/testing/dialogStub.ts`): `installDialogStub(): void`.
- Produces (`src/elements/dialogs/modal.ts`):
  - `type Translate = (key: MessageKey, params?: Params) => string`
  - `interface ModalOptions { id?: string; variant?: string; labelledBy: string; closedby: 'any' | 'none'; signal?: AbortSignal; reopen?: () => boolean }`
  - `openModal(options: ModalOptions, ...children: Child[]): { dialog: HTMLDialogElement; closed: Promise<string> }`
- Produces (`src/elements/dialogs/confirmDialog.ts`):
  - `interface ConfirmOptions { title: string; message: string; confirmLabel: string; t: Translate; signal?: AbortSignal }`
  - `showConfirmDialog(options: ConfirmOptions): Promise<boolean>`
  - `showDiscardChangesDialog(options: { t: Translate; signal?: AbortSignal }): Promise<boolean>`

- [ ] **Step 1: Stub di `<dialog>` per jsdom**

`src/testing/dialogStub.ts`:

```ts
/**
 * jsdom 30 non ha showModal/close/returnValue né i comandi `command="close"` (spec WC §8.2): questo stub
 * li imita quanto basta ai test. `close` arriva in un task successivo, come nel browser. Top layer,
 * inerzia del resto della pagina, `closedby` e ripristino del focus li verificano gli e2e.
 */
const values = new WeakMap<HTMLDialogElement, string>();
let installed = false;

export function installDialogStub(): void {
  if (installed) return;
  installed = true;
  const proto = window.HTMLDialogElement.prototype;
  Object.defineProperty(proto, 'returnValue', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return values.get(this) ?? '';
    },
    set(this: HTMLDialogElement, value: string) {
      values.set(this, String(value));
    },
  });
  Object.assign(proto, {
    showModal(this: HTMLDialogElement) {
      if (this.open) throw new DOMException('dialog già aperto', 'InvalidStateError');
      if (!this.isConnected) throw new DOMException('dialog non collegato', 'InvalidStateError');
      this.setAttribute('open', '');
      this.querySelector<HTMLElement>('[autofocus]')?.focus();
    },
    close(this: HTMLDialogElement, value?: string) {
      if (!this.open) return;
      this.removeAttribute('open');
      if (value !== undefined) this.returnValue = value;
      setTimeout(() => this.dispatchEvent(new Event('close')));
    },
  });
  // Invoker Commands: un clic su <button command="close" commandfor="id"> chiude quel dialog.
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.('button[command="close"][commandfor]');
    if (!button) return;
    const target = document.getElementById(button.getAttribute('commandfor')!);
    if (target?.localName === 'dialog') (target as HTMLDialogElement).close((button as HTMLButtonElement).value);
  });
}
```

- [ ] **Step 2: Test del nucleo che falliscono**

`src/elements/dialogs/modal.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { el } from '../../dom/el';
import { openModal } from './modal';

installDialogStub();

test('opens a modal dialog in the body, labelled and light-dismissable, with the children inside', () => {
  const title = el('h2', { id: 'm-title' }, 'Title');
  const { dialog } = openModal({ labelledBy: 'm-title', closedby: 'any' }, title);
  assert.equal(dialog.parentElement, document.body);
  assert.ok(dialog.open);
  assert.equal(dialog.className, 'hmd-dialog');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'm-title');
  assert.equal(dialog.getAttribute('closedby'), 'any');
  assert.equal(dialog.firstElementChild, title);
  dialog.close();
});

test('the variant is an extra class next to hmd-dialog; the id is the one given', () => {
  const { dialog } = openModal({ id: 'm-1', variant: 'access', labelledBy: 'x', closedby: 'none' });
  assert.equal(dialog.className, 'hmd-dialog access');
  assert.equal(dialog.id, 'm-1');
  dialog.close();
});

test('closing resolves with the return value and removes the dialog only after the close event', async () => {
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any' });
  dialog.close('confirm');
  assert.ok(dialog.isConnected, 'si rimuove dopo close: così il browser ripristina il focus');
  assert.equal(await closed, 'confirm');
  assert.equal(dialog.isConnected, false);
});

test('an abort closes the dialog, resolves with an empty value and leaves no listener on the signal', async () => {
  const controller = new AbortController();
  let added = 0;
  let removed = 0;
  const { signal } = controller;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = ((...args: Parameters<typeof add>) => (added++, add(...args))) as typeof add;
  signal.removeEventListener = ((...args: Parameters<typeof remove>) => (removed++, remove(...args))) as typeof remove;

  const first = openModal({ labelledBy: 'x', closedby: 'any', signal });
  first.dialog.close('confirm');
  assert.equal(await first.closed, 'confirm');
  assert.equal(removed, added, 'chiuso normalmente: il listener sul signal è tolto');

  const second = openModal({ labelledBy: 'x', closedby: 'any', signal });
  controller.abort();
  assert.equal(second.dialog.open, false);
  assert.equal(await second.closed, '');
  assert.equal(second.dialog.isConnected, false);
});

test('an abort after close() but before the close event wins: empty value', async () => {
  const controller = new AbortController();
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any', signal: controller.signal });
  dialog.close('confirm');
  controller.abort();
  assert.equal(await closed, '');
});

test('an already aborted signal opens nothing', async () => {
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'any', signal: AbortSignal.abort() });
  assert.equal(dialog.isConnected, false);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(await closed, '');
});

test('reopen keeps the dialog open after an unwanted close, but not after an abort', async () => {
  const controller = new AbortController();
  const { dialog, closed } = openModal({ labelledBy: 'x', closedby: 'none', signal: controller.signal, reopen: () => true });
  dialog.close();
  await new Promise((resolve) => setTimeout(resolve));
  assert.ok(dialog.open, 'riaperto');
  assert.ok(dialog.isConnected);
  controller.abort();
  assert.equal(await closed, '');
  assert.equal(dialog.isConnected, false);
});
```

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/modal.dom.test.ts`
Expected: FAIL, `Cannot find module './modal'`.

- [ ] **Step 4: Il nucleo**

`src/elements/dialogs/modal.ts`:

```ts
import { el, type Child } from '../../dom/el';
import type { Params } from '../../i18n/i18n';
import type { MessageKey } from '../../i18n/messages';
import './dialogs.css';

/** `t()` passato dal chiamante (React: `useT()`; elementi: `i18n.t`). */
export type Translate = (key: MessageKey, params?: Params) => string;

export interface ModalOptions {
  /** Id del dialog (bersaglio di `commandfor` dei pulsanti «Annulla»). */
  id?: string;
  /** Classe in più oltre a `hmd-dialog` (es. `access`). */
  variant?: string;
  /** Id del titolo dentro `children`. */
  labelledBy: string;
  /** `any`: Esc e clic fuori chiudono; `none`: solo il codice. */
  closedby: 'any' | 'none';
  /** Interrotto: il dialog si chiude e `closed` si risolve con ''. */
  signal?: AbortSignal;
  /** Dopo una chiusura non chiesta dal codice, `true` lo riapre (accesso perso). Ignorato dopo un abort. */
  reopen?: () => boolean;
}

/**
 * Dialog modale aggiunto a `document.body` (spec WC §5.4). `closed` si risolve con `returnValue`
 * all'evento `close`, **dopo** il quale il dialog si rimuove: chiudere prima di staccare fa tornare il
 * focus all'elemento che l'aveva prima di `showModal()`.
 */
export function openModal(options: ModalOptions, ...children: Child[]): { dialog: HTMLDialogElement; closed: Promise<string> } {
  const { id, variant, labelledBy, closedby, signal, reopen } = options;
  const dialog = el('dialog', { id, class: variant ? `hmd-dialog ${variant}` : 'hmd-dialog', 'aria-labelledby': labelledBy, closedby }, ...children);
  if (signal?.aborted) return { dialog, closed: Promise.resolve('') };

  let aborted = false;
  const onAbort = () => {
    aborted = true;
    dialog.close('');
  };
  const closed = new Promise<string>((resolve) => {
    const onClose = () => {
      if (!aborted && reopen?.() && dialog.isConnected) {
        dialog.showModal();
        return;
      }
      dialog.removeEventListener('close', onClose);
      signal?.removeEventListener('abort', onAbort);
      dialog.remove();
      resolve(aborted ? '' : dialog.returnValue);
    };
    dialog.addEventListener('close', onClose);
  });
  signal?.addEventListener('abort', onAbort, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, closed };
}
```

`dialogs.css` (stesso contenuto delle classi di `src/ui/Dialog.module.css` usate dai dialog, più `.accessDialog`, `.accessError` e `.primary` di `src/ui/WorkspaceView.module.css`; i valori sono copiati identici):

```css
/* Dialog nativi aggiunti a document.body da modal.ts (spec WC §4.2: radice dialog.hmd-dialog). */
@layer components {
  @scope (dialog.hmd-dialog) {
    :scope {
      border: 1px solid var(--c-border);
      border-radius: 12px;
      background: var(--c-surface);
      color: var(--c-text);
      padding: 20px;
      width: min(420px, calc(100vw - 32px));
    }

    :scope::backdrop {
      background: rgb(0 0 0 / 0.35);
    }

    /* Accesso perso (era .accessDialog di WorkspaceView.module.css). */
    :scope.access {
      padding: 24px;
      width: min(440px, calc(100vw - 32px));
    }

    :scope.access::backdrop {
      background: rgb(0 0 0 / 0.45);
    }

    .title {
      font-size: 17px;
      margin: 0 0 12px;
    }

    .message {
      margin: 0 0 8px;
      color: var(--c-muted);
    }

    .input {
      width: 100%;
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--c-border);
      border-radius: 8px;
      background: var(--c-bg);
      color: var(--c-text);
    }

    .error {
      color: var(--c-danger);
      margin: 8px 0 0;
      font-size: 14px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }

    .primary,
    .secondary,
    .danger {
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-weight: 600;
    }

    .primary {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      border: none;
    }

    .danger {
      background: var(--c-danger);
      color: light-dark(#fff, #450a0a);
      border: none;
    }

    .secondary {
      background: transparent;
      border: 1px solid var(--c-border);
    }

    /* Pulsante dell'accesso perso (era .primary di WorkspaceView.module.css: padding diverso). */
    .resume {
      background: var(--c-accent);
      color: light-dark(#fff, #042f2e);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: 600;
    }

    .access-error {
      color: var(--c-danger);
      font-weight: 600;
    }
  }
}
```

Prima di scrivere il CSS, aprire `src/ui/Dialog.module.css` e `src/ui/WorkspaceView.module.css` (`.primary`, `.accessDialog`, `.accessDialog::backdrop`, `.accessError`) e controllare che i valori qui sopra coincidano: se differiscono, vince il file sorgente.

- [ ] **Step 5: Il nucleo passa**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/modal.dom.test.ts`
Expected: PASS (7 test).

- [ ] **Step 6: Test della conferma che falliscono**

`src/elements/dialogs/confirmDialog.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showConfirmDialog, showDiscardChangesDialog } from './confirmDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const open = () => showConfirmDialog({ title: 'Delete a.md?', message: 'Gone for good.', confirmLabel: 'Delete', t });
const dialog = () => document.querySelector('dialog')!;
const buttons = () => [...dialog().querySelectorAll('button')];

test('title, message and the two buttons, Cancel first and focused', () => {
  void open();
  const d = dialog();
  const title = d.querySelector('h2')!;
  assert.equal(title.textContent, 'Delete a.md?');
  assert.equal(d.getAttribute('aria-labelledby'), title.id);
  assert.equal(d.getAttribute('closedby'), 'any');
  assert.equal(d.querySelector('p')!.textContent, 'Gone for good.');
  assert.deepEqual(buttons().map((b) => b.textContent), [EN_MESSAGES['dialog.cancel'], 'Delete']);
  assert.equal(document.activeElement, buttons()[0]);
  assert.ok(buttons().every((b) => b.type === 'button'));
  d.close();
});

test('Cancel closes through commandfor and resolves false', async () => {
  const result = open();
  const cancel = buttons()[0];
  assert.equal(cancel.getAttribute('command'), 'close');
  assert.equal(cancel.getAttribute('commandfor'), dialog().id);
  cancel.click();
  assert.equal(await result, false);
  assert.equal(document.querySelector('dialog'), null);
});

test('the confirm button resolves true', async () => {
  const result = open();
  buttons()[1].click();
  assert.equal(await result, true);
});

test('Esc or a click outside (a close without value) resolves false', async () => {
  const result = open();
  dialog().close();
  assert.equal(await result, false);
});

test('two dialogs open one after the other get different ids', async () => {
  const first = open();
  const firstId = dialog().id;
  buttons()[1].click();
  await first;
  const second = open();
  assert.notEqual(dialog().id, firstId);
  buttons()[0].click();
  await second;
});

test('an abort between the confirm click and the close event resolves false', async () => {
  const controller = new AbortController();
  const result = showConfirmDialog({ title: 'T', message: 'M', confirmLabel: 'OK', t, signal: controller.signal });
  buttons()[1].click();
  controller.abort();
  assert.equal(await result, false);
});

test('an abort resolves false and removes the dialog', async () => {
  const controller = new AbortController();
  const result = showConfirmDialog({ title: 'T', message: 'M', confirmLabel: 'OK', t, signal: controller.signal });
  controller.abort();
  assert.equal(await result, false);
  assert.equal(document.querySelector('dialog'), null);
});

test('the discard-changes confirmation uses the unsaved-changes texts', async () => {
  const result = showDiscardChangesDialog({ t });
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['ai.unsavedTitle']);
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['ai.unsavedMessage']);
  assert.equal(buttons()[1].textContent, EN_MESSAGES['ai.discardChanges']);
  buttons()[1].click();
  assert.equal(await result, true);
});
```

(Se `EN_MESSAGES` o `translate` hanno nomi diversi, usare quelli che importano i test della 4a, es. `conflict-bar.dom.test.ts`.)

- [ ] **Step 7: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/confirmDialog.dom.test.ts`
Expected: FAIL, `Cannot find module './confirmDialog'`.

- [ ] **Step 8: La conferma**

`src/elements/dialogs/confirmDialog.ts`:

```ts
import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { openModal, type Translate } from './modal';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Etichetta del pulsante che conferma (azione distruttiva: stile `danger`). */
  confirmLabel: string;
  t: Translate;
  signal?: AbortSignal;
}

/** Conferma di un'azione (era ConfirmDialog.tsx): `true` solo con il pulsante di conferma. */
export async function showConfirmDialog({ title, message, confirmLabel, t, signal }: ConfirmOptions): Promise<boolean> {
  const id = uid('confirm-dialog');
  const titleId = `${id}-title`;
  const confirm = el('button', { type: 'button', class: 'danger' }, confirmLabel);
  const { dialog, closed } = openModal(
    { id, labelledBy: titleId, closedby: 'any', signal },
    el('h2', { id: titleId, class: 'title' }, title),
    el('p', { class: 'message' }, message),
    el(
      'div',
      { class: 'actions' },
      // La scelta sicura ha il focus: Invio non conferma per sbaglio.
      el('button', { type: 'button', class: 'secondary', autofocus: true, command: 'close', commandfor: id }, t('dialog.cancel')),
      confirm,
    ),
  );
  confirm.addEventListener('click', () => dialog.close('confirm'));
  return (await closed) === 'confirm';
}

/** «Scartare le modifiche?»: impostazioni (Chiudi/Indietro), cambio di profilo o di preset. */
export function showDiscardChangesDialog({ t, signal }: { t: Translate; signal?: AbortSignal }): Promise<boolean> {
  return showConfirmDialog({ title: t('ai.unsavedTitle'), message: t('ai.unsavedMessage'), confirmLabel: t('ai.discardChanges'), t, signal });
}
```

Nota: `showModal()` dentro `openModal` mette il focus su `[autofocus]` già presente nei figli. Il listener di conferma sta sul nodo creato qui: sparisce con il nodo (come `on` di `el()`).

- [ ] **Step 9: La conferma passa, poi tutto**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/confirmDialog.dom.test.ts`
Expected: PASS (8 test).

Run: `npm test` e `npm run lint`
Expected: tutto verde; `architecture.test.ts` accetta `dialogs.css` (radice `dialog.hmd-dialog`); `uiText.test.ts` non trova testi letterali.

- [ ] **Step 10: Commit**

```bash
git add src/testing/dialogStub.ts src/elements/dialogs/
git commit -m "feat: nucleo dei dialog nativi e showConfirmDialog, con lo stub di dialog per jsdom"
```

---

### Task 3: `showNameDialog`

**Files:**
- Create: `src/elements/dialogs/nameDialog.ts`, `src/elements/dialogs/nameDialog.dom.test.ts`

**Interfaces:**
- Consumes: `openModal`, `Translate` (Task 2); `validateName(name, kind)` da `src/ui/names.ts` (`{ name } | { error: 'empty' | 'slash' | 'dot' }`).
- Produces: `interface NameOptions { title: string; kind: 'file' | 'directory'; initial: string; confirmLabel: string; validate: (name: string) => string | null; t: Translate; signal?: AbortSignal }`, `showNameDialog(options: NameOptions): Promise<string | null>`.

- [ ] **Step 1: Test che falliscono**

`src/elements/dialogs/nameDialog.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showNameDialog, type NameOptions } from './nameDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const open = (options: Partial<NameOptions> = {}) =>
  showNameDialog({ title: 'New file', kind: 'file', initial: '', confirmLabel: 'Create', validate: () => null, t, ...options });
const dialog = () => document.querySelector('dialog')!;
const input = () => dialog().querySelector('input')!;
const submit = () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!;
const cancel = () => dialog().querySelector<HTMLButtonElement>('button[type="button"]')!;
const type = (value: string) => {
  input().value = value;
  input().dispatchEvent(new Event('input', { bubbles: true }));
};

test('a form with the title, the focused input and Cancel / confirm', () => {
  void open({ initial: 'a.md' });
  const d = dialog();
  const form = d.querySelector('form')!;
  assert.equal(form.parentElement, d);
  const title = form.querySelector('h2')!;
  assert.equal(title.textContent, 'New file');
  assert.equal(d.getAttribute('aria-labelledby'), title.id);
  assert.equal(input().value, 'a.md');
  assert.equal(document.activeElement, input());
  assert.equal(input().spellcheck, false);
  assert.equal(input().autocomplete, 'off');
  assert.equal(input().getAttribute('aria-invalid'), 'false');
  assert.equal(input().hasAttribute('aria-describedby'), false);
  assert.deepEqual([cancel().textContent, submit().textContent], [EN_MESSAGES['dialog.cancel'], 'Create']);
  d.close();
});

test('a file selects the name without the extension; a folder or a dot file selects everything', async () => {
  for (const [kind, initial, end] of [['file', 'note.md', 4], ['file', 'README', 6], ['file', '.env', 4], ['directory', 'docs.v2', 7]] as const) {
    const result = open({ kind, initial });
    assert.deepEqual([input().selectionStart, input().selectionEnd], [0, end], `${kind} ${initial}`);
    dialog().close();
    await result;
  }
});

test('an invalid name shows the error, marks the input and keeps the dialog open; typing clears it', () => {
  void open();
  const field = input();
  type('  ');
  submit().click();
  const error = dialog().querySelector('p')!;
  assert.equal(error.textContent, EN_MESSAGES['name.error.empty']);
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(field.getAttribute('aria-describedby'), error.id);
  assert.ok(dialog().open);
  // L'errore sta tra l'input e i pulsanti, come in NameDialog.tsx.
  assert.equal(field.nextElementSibling, error);

  type('ok');
  assert.equal(dialog().querySelector('p'), null);
  assert.equal(field.getAttribute('aria-invalid'), 'false');
  assert.equal(field.hasAttribute('aria-describedby'), false);
  assert.equal(input(), field, 'stesso nodo: il focus non si perde');
  dialog().close();
});

test('two errors in a row leave a single message', () => {
  void open();
  type('a/b');
  submit().click();
  type('.x');
  submit().click();
  const errors = dialog().querySelectorAll('p');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].textContent, EN_MESSAGES['name.error.dot']);
  dialog().close();
});

test('validate receives the normalized name; its message is shown as is', () => {
  const seen: string[] = [];
  void open({ validate: (name) => (seen.push(name), 'Taken!') });
  type(' note ');
  submit().click();
  assert.deepEqual(seen, ['note.md']);
  assert.equal(dialog().querySelector('p')!.textContent, 'Taken!');
  dialog().close();
});

test('a valid name resolves with the normalized name and removes the dialog', async () => {
  const result = open({ kind: 'directory' });
  type(' drafts ');
  submit().click();
  assert.equal(await result, 'drafts');
  assert.equal(document.querySelector('dialog'), null);
});

test('an abort between the submit and the close event discards the name', async () => {
  const controller = new AbortController();
  const result = open({ signal: controller.signal });
  type('late');
  submit().click();
  controller.abort();
  assert.equal(await result, null);
  assert.equal(document.querySelector('dialog'), null);
});

test('Cancel, a light dismiss and an abort resolve null', async () => {
  let result = open();
  cancel().click();
  assert.equal(await result, null);

  result = open();
  dialog().close();
  assert.equal(await result, null);

  const controller = new AbortController();
  result = open({ signal: controller.signal });
  controller.abort();
  assert.equal(await result, null);
  assert.equal(document.querySelector('dialog'), null);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/nameDialog.dom.test.ts`
Expected: FAIL, `Cannot find module './nameDialog'`.

- [ ] **Step 3: Il dialog del nome**

`src/elements/dialogs/nameDialog.ts`:

```ts
import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { validateName } from '../../ui/names';
import { openModal, type Translate } from './modal';

export interface NameOptions {
  title: string;
  kind: 'file' | 'directory';
  initial: string;
  confirmLabel: string;
  /** Controllo aggiuntivo sul nome già normalizzato (es. già esistente): messaggio tradotto oppure null. */
  validate: (name: string) => string | null;
  t: Translate;
  signal?: AbortSignal;
}

/** Nome di un file o di una cartella (era NameDialog.tsx): il nome valido, o null se si annulla. */
export async function showNameDialog({ title, kind, initial, confirmLabel, validate, t, signal }: NameOptions): Promise<string | null> {
  const id = uid('name-dialog');
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  let result: string | null = null;

  const input = el('input', { class: 'input', value: initial, autofocus: true, spellcheck: false, autocomplete: 'off', 'aria-invalid': false });
  const error = el('p', { id: errorId, class: 'error' });
  const showError = (message: string | null) => {
    input.setAttribute('aria-invalid', String(message !== null));
    if (message === null) {
      input.removeAttribute('aria-describedby');
      error.remove();
      return;
    }
    error.textContent = message;
    input.setAttribute('aria-describedby', errorId);
    if (!error.isConnected) input.after(error);
  };
  input.addEventListener('input', () => showError(null));

  const form = el(
    'form',
    null,
    el('h2', { id: titleId, class: 'title' }, title),
    input,
    el(
      'div',
      { class: 'actions' },
      el('button', { type: 'button', class: 'secondary', command: 'close', commandfor: id }, t('dialog.cancel')),
      el('button', { type: 'submit', class: 'primary' }, confirmLabel),
    ),
  );
  const { dialog, closed } = openModal({ id, labelledBy: titleId, closedby: 'any', signal }, form);
  if (!dialog.isConnected) return null; // signal già interrotto

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = validateName(input.value, kind);
    if ('error' in checked) return showError(t(`name.error.${checked.error}`));
    const problem = validate(checked.name);
    if (problem) return showError(problem);
    result = checked.name;
    dialog.close('ok');
  });

  // Di un file si seleziona il nome senza estensione, così scrivere lo sostituisce lasciando ".md".
  const dot = initial.lastIndexOf('.');
  input.setSelectionRange(0, kind === 'file' && dot > 0 ? dot : initial.length);

  // Un abort arrivato tra il submit e l'evento close risolve '' (vedi openModal): nome scartato.
  return (await closed) === 'ok' ? result : null;
}
```

- [ ] **Step 4: Passa, poi tutto**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/nameDialog.dom.test.ts`
Expected: PASS (8 test).

Run: `npm test` e `npm run lint`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/elements/dialogs/nameDialog.ts src/elements/dialogs/nameDialog.dom.test.ts
git commit -m "feat: showNameDialog al posto di NameDialog (validazione, selezione del nome, errore accessibile)"
```

---

### Task 4: `showAccessLostDialog`

**Files:**
- Create: `src/elements/dialogs/accessLostDialog.ts`, `src/elements/dialogs/accessLostDialog.dom.test.ts`

**Interfaces:**
- Consumes: `openModal` con `variant: 'access'`, `closedby: 'none'`, `reopen` (Task 2).
- Produces: `interface AccessLostOptions { folderName: string; onResume: () => Promise<boolean>; t: Translate; signal?: AbortSignal }`, `showAccessLostDialog(options: AccessLostOptions): Promise<void>` — si risolve quando `onResume` restituisce `true` (dialog chiuso e rimosso) o all'abort.

- [ ] **Step 1: Test che falliscono**

`src/elements/dialogs/accessLostDialog.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { showAccessLostDialog } from './accessLostDialog';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const dialog = () => document.querySelector('dialog')!;
const resume = () => dialog().querySelector('button')!;
const tick = () => new Promise((resolve) => setTimeout(resolve));
const errorText = () => [...dialog().querySelectorAll('p')].map((p) => p.textContent).filter((text) => text === EN_MESSAGES['access.denied']);

function open(answers: (boolean | Error)[]) {
  const calls: number[] = [];
  const controller = new AbortController();
  const done = showAccessLostDialog({
    folderName: 'notes',
    t,
    signal: controller.signal,
    onResume: async () => {
      calls.push(calls.length);
      const answer = answers.shift() ?? false;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { done, calls, controller };
}

test('a blocking dialog with the folder name and the resume button', () => {
  const { controller } = open([]);
  const d = dialog();
  assert.equal(d.className, 'hmd-dialog access');
  assert.equal(d.getAttribute('closedby'), 'none');
  assert.equal(d.querySelector('h2')!.textContent, EN_MESSAGES['access.title']);
  assert.equal(d.getAttribute('aria-labelledby'), d.querySelector('h2')!.id);
  assert.equal(d.querySelector('p')!.textContent, t('access.body', { folder: 'notes' }));
  assert.equal(resume().textContent, EN_MESSAGES['access.resume']);
  controller.abort();
});

test('Esc is ignored (cancel prevented) and an unwanted close reopens it', async () => {
  const { controller } = open([]);
  const cancel = new Event('cancel', { cancelable: true });
  dialog().dispatchEvent(cancel);
  assert.ok(cancel.defaultPrevented);
  const d = dialog();
  d.close();
  await tick();
  assert.ok(d.open);
  assert.ok(d.isConnected);
  controller.abort();
});

test('denied twice: a single error message; granted: closed, removed, resolved', async () => {
  const { done, calls } = open([false, false, true]);
  resume().click();
  await tick();
  assert.deepEqual(errorText(), [EN_MESSAGES['access.denied']]);
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  resume().click();
  await done;
  assert.equal(calls.length, 3);
  assert.equal(document.querySelector('dialog'), null);
});

test('the error goes away while a new attempt is running', async () => {
  let release!: (granted: boolean) => void;
  const answers: Promise<boolean>[] = [Promise.resolve(false), new Promise((resolve) => (release = resolve))];
  const controller = new AbortController();
  void showAccessLostDialog({ folderName: 'notes', t, signal: controller.signal, onResume: () => answers.shift()! });
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  resume().click();
  assert.equal(errorText().length, 0);
  release(false);
  await tick();
  assert.equal(errorText().length, 1);
  controller.abort();
});

test('an exception from onResume shows the error instead of breaking', async () => {
  const { controller } = open([new Error('boom')]);
  resume().click();
  await tick();
  assert.equal(errorText().length, 1);
  assert.ok(dialog().open);
  controller.abort();
});

test('an abort closes and removes it, and resolves', async () => {
  const { done, controller } = open([]);
  controller.abort();
  await done;
  assert.equal(document.querySelector('dialog'), null);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/accessLostDialog.dom.test.ts`
Expected: FAIL, `Cannot find module './accessLostDialog'`.

- [ ] **Step 3: Il dialog dell'accesso perso**

`src/elements/dialogs/accessLostDialog.ts`:

```ts
import { el } from '../../dom/el';
import { uid } from '../../dom/uid';
import { openModal, type Translate } from './modal';

export interface AccessLostOptions {
  folderName: string;
  /** Chiede di nuovo il permesso (con il gesto dell'utente) e riprende il workspace: true se concesso. */
  onResume: () => Promise<boolean>;
  t: Translate;
  signal?: AbortSignal;
}

/**
 * Dialog bloccante dell'accesso perso (era AccessLostDialog in WorkspaceView.tsx): niente Esc, niente
 * clic fuori; si chiude solo con l'accesso concesso (o con l'abort di chi l'ha aperto).
 */
export async function showAccessLostDialog({ folderName, onResume, t, signal }: AccessLostOptions): Promise<void> {
  const titleId = uid('access-title');
  let granted = false;
  const denied = el('p', { class: 'access-error' }, t('access.denied'));
  const resume = el('button', { class: 'resume' }, t('access.resume'));
  const { dialog, closed } = openModal(
    // closedby="none" dovrebbe già impedire ogni chiusura non voluta: reopen è il ripiego.
    { variant: 'access', labelledBy: titleId, closedby: 'none', signal, reopen: () => !granted },
    el('h2', { id: titleId }, t('access.title')),
    el('p', null, t('access.body', { folder: folderName })),
    resume,
  );
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  resume.addEventListener('click', async () => {
    denied.remove();
    try {
      granted = await onResume();
    } catch {
      granted = false;
    }
    if (granted) dialog.close();
    else if (dialog.isConnected) resume.before(denied);
  });
  await closed;
}
```

- [ ] **Step 4: Passa, poi tutto**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/dialogs/accessLostDialog.dom.test.ts`
Expected: PASS (6 test).

Run: `npm test` e `npm run lint`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/elements/dialogs/accessLostDialog.ts src/elements/dialogs/accessLostDialog.dom.test.ts
git commit -m "feat: showAccessLostDialog, bloccante e chiuso solo con l'accesso concesso"
```

---

### Task 5: `WorkspaceView` con le funzioni (albero e accesso perso)

**Files:**
- Create: `src/elements/workspace/treeDialogs.ts`, `src/elements/workspace/treeDialogs.dom.test.ts`
- Create: `src/ui/useUnmountSignal.ts`
- Modify: `src/ui/WorkspaceView.tsx` (import, `onTreeAction`, JSX dei dialog, `AccessLostDialog`, `noDismiss`)
- Modify: `src/ui/WorkspaceView.module.css` (via `.accessDialog`, `.accessDialog::backdrop`, `.accessError`)
- Modify: `e2e/tree.spec.ts`

**Interfaces:**
- Consumes: `DialogState` da `src/elements/workspace/dialogFor.ts`; `showNameDialog`, `showConfirmDialog`, `showAccessLostDialog`, `Translate`; `renameTaken` da `src/ui/names.ts`; `joinPath`, `dirname` da `src/lib/paths.ts`.
- Produces:
  - `interface TreeDialogDeps { t: Translate; signal?: AbortSignal; paths: () => readonly string[]; workspace: Pick<Workspace, 'createFile' | 'createFolder' | 'rename' | 'remove'> }`
  - `runTreeDialog(dialog: NonNullable<DialogState>, deps: TreeDialogDeps): Promise<void>`
  - `useUnmountSignal(): () => AbortSignal` (`src/ui/useUnmountSignal.ts`)

- [ ] **Step 1: Test di `runTreeDialog` che falliscono**

`src/elements/workspace/treeDialogs.dom.test.ts`:

```ts
import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installDialogStub } from '../../testing/dialogStub';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import type { TreeNode } from '../../ui/tree';
import { runTreeDialog, type TreeDialogDeps } from './treeDialogs';

installDialogStub();
const t = (key: string, params?: Record<string, string | number>) => translate(EN_MESSAGES, key, params);
const file: TreeNode = { name: 'b.md', path: 'docs/b.md', kind: 'file', children: [] };
const folder: TreeNode = { name: 'docs', path: 'docs', kind: 'directory', children: [] };
const dialog = () => document.querySelector('dialog')!;

function deps(paths: string[]) {
  const calls: string[] = [];
  const value: TreeDialogDeps = {
    t,
    paths: () => paths,
    workspace: {
      createFile: async (path) => void calls.push(`file ${path}`),
      createFolder: async (path) => void calls.push(`folder ${path}`),
      rename: async (from, to) => void calls.push(`rename ${from} ${to}`),
      remove: async (path) => void calls.push(`remove ${path}`),
    },
  };
  return { value, calls };
}

function typeAndSubmit(name: string) {
  const input = dialog().querySelector('input')!;
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
}

test('new file: titled, created inside the folder with .md added', async () => {
  const { value, calls } = deps([]);
  const done = runTreeDialog({ kind: 'new-file', dir: 'docs' }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['file.new']);
  typeAndSubmit('idea');
  await done;
  assert.deepEqual(calls, ['file docs/idea.md']);
});

test('new folder at the root', async () => {
  const { value, calls } = deps([]);
  const done = runTreeDialog({ kind: 'new-folder', dir: '' }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, EN_MESSAGES['folder.new']);
  typeAndSubmit('drafts');
  await done;
  assert.deepEqual(calls, ['folder drafts']);
});

test('an existing name (any case) is refused with the paths read at submit time', async () => {
  const paths: string[] = [];
  const { value, calls } = deps(paths);
  const done = runTreeDialog({ kind: 'new-file', dir: '' }, value);
  // Il file compare mentre il dialog è aperto (modifica esterna): il controllo deve vederlo.
  paths.push('Idea.md');
  typeAndSubmit('idea');
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['name.error.taken']);
  typeAndSubmit('other');
  await done;
  assert.deepEqual(calls, ['file other.md']);
});

test('rename: initial name, rename in the same folder, case-only change allowed', async () => {
  const { value, calls } = deps(['docs/b.md', 'docs/c.md']);
  let done = runTreeDialog({ kind: 'rename', node: file }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, t('dialog.rename.title', { name: 'b.md' }));
  assert.equal(dialog().querySelector('input')!.value, 'b.md');
  typeAndSubmit('c.md');
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['name.error.taken']);
  typeAndSubmit('B.md');
  await done;
  done = runTreeDialog({ kind: 'rename', node: folder }, value);
  typeAndSubmit('manuals');
  await done;
  // La cartella docs sta alla radice: dirname('docs') è '' e la destinazione è 'manuals'.
  assert.deepEqual(calls, ['rename docs/b.md docs/B.md', 'rename docs manuals']);
});

test('delete: file and folder messages; Cancel does nothing, the confirm removes', async () => {
  const { value, calls } = deps(['docs', 'docs/b.md']);
  let done = runTreeDialog({ kind: 'delete', node: file }, value);
  assert.equal(dialog().querySelector('h2')!.textContent, t('dialog.delete.title', { name: 'b.md' }));
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['dialog.delete.file']);
  dialog().querySelectorAll('button')[0].click();
  await done;
  assert.deepEqual(calls, []);

  done = runTreeDialog({ kind: 'delete', node: folder }, value);
  assert.equal(dialog().querySelector('p')!.textContent, EN_MESSAGES['dialog.delete.folder']);
  dialog().querySelectorAll('button')[1].click();
  await done;
  assert.deepEqual(calls, ['remove docs']);
});

test('an abort closes the dialog without touching the workspace', async () => {
  const { value, calls } = deps([]);
  const controller = new AbortController();
  const done = runTreeDialog({ kind: 'new-file', dir: '' }, { ...value, signal: controller.signal });
  controller.abort();
  await done;
  assert.equal(document.querySelector('dialog'), null);
  assert.deepEqual(calls, []);
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/workspace/treeDialogs.dom.test.ts`
Expected: FAIL, `Cannot find module './treeDialogs'`.

- [ ] **Step 3: `runTreeDialog`**

`src/elements/workspace/treeDialogs.ts`:

```ts
import { match } from 'ts-pattern';

import { dirname, joinPath } from '../../lib/paths';
import { renameTaken } from '../../ui/names';
import type { Workspace } from '../../workspace/workspace';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import type { Translate } from '../dialogs/modal';
import { showNameDialog } from '../dialogs/nameDialog';
import type { DialogState } from './dialogFor';

export interface TreeDialogDeps {
  t: Translate;
  signal?: AbortSignal;
  /** Percorsi della cartella, letti alla conferma: il disco può cambiare a dialog aperto. */
  paths: () => readonly string[];
  workspace: Pick<Workspace, 'createFile' | 'createFolder' | 'rename' | 'remove'>;
}

/** Apre il dialog chiesto da `dialogFor` e, se confermato, esegue l'operazione sul workspace. */
export async function runTreeDialog(dialog: NonNullable<DialogState>, { t, signal, paths, workspace }: TreeDialogDeps): Promise<void> {
  const taken = t('name.error.taken');
  await match(dialog)
    .with({ kind: 'new-file' }, { kind: 'new-folder' }, async ({ kind, dir }) => {
      const exists = (path: string) => paths().some((p) => p.toLowerCase() === path.toLowerCase());
      const name = await showNameDialog({
        title: kind === 'new-file' ? t('file.new') : t('folder.new'),
        kind: kind === 'new-file' ? 'file' : 'directory',
        initial: '',
        confirmLabel: t('dialog.create'),
        validate: (n) => (exists(joinPath(dir, n)) ? taken : null),
        t,
        signal,
      });
      if (name === null) return;
      const path = joinPath(dir, name);
      await (kind === 'new-file' ? workspace.createFile(path) : workspace.createFolder(path));
    })
    .with({ kind: 'rename' }, async ({ node }) => {
      const to = (n: string) => joinPath(dirname(node.path), n);
      const name = await showNameDialog({
        title: t('dialog.rename.title', { name: node.name }),
        kind: node.kind === 'directory' ? 'directory' : 'file',
        initial: node.name,
        confirmLabel: t('dialog.rename.confirm'),
        validate: (n) => (renameTaken(node.path, to(n), paths()) ? taken : null),
        t,
        signal,
      });
      if (name !== null) await workspace.rename(node.path, to(name));
    })
    .with({ kind: 'delete' }, async ({ node }) => {
      const ok = await showConfirmDialog({
        title: t('dialog.delete.title', { name: node.name }),
        message: node.kind === 'directory' ? t('dialog.delete.folder') : t('dialog.delete.file'),
        confirmLabel: t('dialog.delete.confirm'),
        t,
        signal,
      });
      if (ok) await workspace.remove(node.path);
    })
    .exhaustive();
}
```

Se `ts-pattern` non accetta due pattern in `.with` per l'union di `DialogState`, usare `.with({ kind: P.union('new-file', 'new-folder') }, …)` con `import { match, P } from 'ts-pattern'`.

- [ ] **Step 4: Passa**

Run: `npx tsx --import ./src/testing/assetHooks.ts --test src/elements/workspace/treeDialogs.dom.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Hook del signal di smontaggio**

`src/ui/useUnmountSignal.ts`:

```ts
import { useEffect, useRef } from 'react';

/**
 * Signal interrotto allo smontaggio (e ricreato al rimontaggio di StrictMode): un dialog aperto da un
 * componente che sparisce si chiude con lui. Va chiamato negli handler, dopo il montaggio. Temporaneo:
 * nella fase 7 gli elementi usano il signal di HmdElement.
 */
export function useUnmountSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  return () => controller.current!.signal;
}
```

- [ ] **Step 6: `WorkspaceView` usa le funzioni**

In `src/ui/WorkspaceView.tsx`:

1. Import: togliere `ConfirmDialog`, `NameDialog`, `renameTaken`, `type DialogState` (resta `dialogFor`); togliere `joinPath`/`dirname` da `../lib/paths` **solo se** non restano usati; aggiungere:

```ts
import { showAccessLostDialog } from '../elements/dialogs/accessLostDialog';
import { runTreeDialog } from '../elements/workspace/treeDialogs';
import { useUnmountSignal } from './useUnmountSignal';
```

2. Togliere `const [dialog, setDialog] = useState<DialogState>(null);` e, accanto agli altri ref, aggiungere `const dialogSignal = useUnmountSignal();`.

3. In `onTreeAction`, il ramo `dialog` diventa:

```ts
      .with({ kind: 'dialog' }, ({ dialog }) =>
        void runTreeDialog(dialog, { t, signal: dialogSignal(), paths: () => workspace.getState().entries.map((e) => e.path), workspace }),
      )
```

4. Togliere `exists` e `taken` (erano solo per i dialog) e i tre blocchi JSX `{dialog && … <NameDialog …/>}`, `{dialog?.kind === 'rename' && …}`, `{dialog?.kind === 'delete' && …}`.

5. Al posto del blocco JSX `{state.status === 'access-lost' && (<AccessLostDialog … />)}`, un effetto (accanto agli altri effetti, prima del `return`):

```ts
  // Accesso perso: dialog bloccante finché il permesso non torna. Se lo stato cambia per altre vie (o il
  // componente si smonta, anche per StrictMode), l'abort lo chiude.
  const accessLost = state.status === 'access-lost';
  useEffect(() => {
    if (!accessLost) return;
    const controller = new AbortController();
    void showAccessLostDialog({
      folderName: workspace.getState().name,
      t: i18nStore.t,
      signal: controller.signal,
      onResume: async () => {
        const granted = await requestAccess(handle);
        if (granted) await workspace.resume();
        return granted;
      },
    });
    return () => controller.abort();
  }, [accessLost, workspace, handle, i18nStore]);
```

6. Cancellare la funzione `AccessLostDialog` e la costante `noDismiss` in fondo al file. Togliere `useT` dall'import di `I18nProvider` se non resta usato.

In `src/ui/WorkspaceView.module.css`: cancellare `.accessDialog`, `.accessDialog::backdrop`, `.accessError` (restano `.primary` e il resto).

- [ ] **Step 7: E2e del focus dopo la conferma (comportamento nuovo)**

In `e2e/tree.spec.ts`, dentro `test.describe('dialogs and menu', …)`:

```ts
  test('after creating from the sidebar button the focus is back on that button', async ({ app, page }) => {
    const button = page.getByRole('button', { name: app.t('file.new') }).first();
    await button.click();
    const dialog = page.getByRole('dialog', { name: app.t('file.new') });
    await dialog.getByRole('textbox').fill('fresh');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(app.treeFile('fresh.md')).toBeVisible();
    // Prima della fase 4b il focus cadeva sul body (React staccava il dialog prima di chiuderlo).
    await expect(button).toBeFocused();
  });
```

- [ ] **Step 8: Verifica completa**

```bash
npm test
npm run lint
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit
```

Expected: tutto verde; e2e = conteggio del Task 1 + 1. L'audit su `name-dialog`, `confirm-dialog` e `access-lost-dialog` (backdrop compresi) coincide con la baseline: grazie alla chiave `dialog#<indice>` del Task 1 lo spostamento da `#root` a `body` non conta, contano solo gli stili. Se l'audit trova differenze, **non toccare i test**: confrontare il CSS di `dialogs.css` con i moduli originali (ordine dei layer, specificità, `:scope.access`) e correggere il CSS.

- [ ] **Step 9: Commit**

```bash
git add src/elements/workspace/treeDialogs.ts src/elements/workspace/treeDialogs.dom.test.ts src/ui/useUnmountSignal.ts src/ui/WorkspaceView.tsx src/ui/WorkspaceView.module.css e2e/tree.spec.ts
git commit -m "feat: dialog dell'albero e dell'accesso perso come funzioni in WorkspaceView"
```

---

### Task 6: Conferme di impostazioni, AI e revisione; via i componenti React

**Files:**
- Modify: `src/ui/SettingsView.tsx`, `src/ui/ai/settings/AiProfilesSection.tsx`, `src/ui/ai/settings/AiPresetsSection.tsx`, `src/ui/ai/settings/AiSyncSection.tsx`, `src/ui/ai/ReviewView.tsx`
- Delete: `src/ui/ConfirmDialog.tsx`, `src/ui/NameDialog.tsx`
- Modify: `src/ui/Dialog.module.css`
- Modify: `src/architecture.test.ts`

**Interfaces:**
- Consumes: `showConfirmDialog`, `showDiscardChangesDialog` (Task 2), `useUnmountSignal` (Task 5); `useDraft` (già restituisce `dirty`, `select`, `confirmSwitch`, `cancelSwitch`).

- [ ] **Step 1: Test statico che fallisce**

In `src/architecture.test.ts`, dopo `DEFINE_ALLOWED`:

```ts
/** Dialog nativi: solo le funzioni di elements/dialogs/ li creano e li aprono (spec WC §5.4). */
const DIALOG = /\.showModal\s*\(|<dialog\b|createElement\(\s*['"]dialog['"]|\bel\(\s*['"]dialog['"]/;
const DIALOG_ALLOWED = (path: string) => path.startsWith('elements/dialogs/');
```

dopo il test di `customElements.define`:

```ts
test('native dialogs are created and opened only in elements/dialogs/', () => {
  assert.deepEqual(offenders(DIALOG, DIALOG_ALLOWED), []);
});
```

nel test `'the patterns fire on what they must and ignore what they must'`, prima della `}` finale:

```ts
  for (const bad of ['dialog.showModal()', '<dialog ref={ref}>', "document.createElement('dialog')", "el('dialog', { class: 'x' })"]) {
    assert.ok(DIALOG.test(bad), bad);
  }
  for (const ok of ["document.querySelector('dialog[open]')", 'showConfirmDialog({ t })', "getByRole('dialog')"]) {
    assert.ok(!DIALOG.test(ok), ok);
  }
```

e nel test `'offending files are reported by path…'` due sonde in `probes` e un'asserzione:

```ts
    { path: 'ui/Probe.tsx', source: 'ref.current?.showModal();' },
    { path: 'elements/dialogs/modal.ts', source: 'dialog.showModal();' },
```

```ts
  assert.deepEqual(offenders(DIALOG, DIALOG_ALLOWED, probes), ['ui/Probe.tsx']);
```

Run: `npm test`
Expected: FAIL nel test `native dialogs…` con `ui/ConfirmDialog.tsx`, `ui/NameDialog.tsx` (e `ui/SettingsView.tsx` se contiene ancora `<dialog`: non lo contiene, usa `ConfirmDialog`). È il caso negativo reale: il controllo scatta.

- [ ] **Step 2: `SettingsView`**

In `src/ui/SettingsView.tsx`:

1. Import: togliere `ConfirmDialog`; aggiungere `import { showDiscardChangesDialog } from '../elements/dialogs/confirmDialog';` e `import { useUnmountSignal } from './useUnmountSignal';`. Aggiungere `t` se non è già destrutturato da `useI18n()` (lo è).
2. Togliere `const [confirmClose, setConfirmClose] = useState(false);`; aggiungere `const confirming = useRef(false);` e `const dialogSignal = useUnmountSignal();`.
3. `close` diventa:

```ts
  const close = () => {
    commitDelay();
    commitWidths();
    if (dirty.size === 0) return onClose();
    // Una conferma alla volta: «Indietro» con la conferma già aperta richiama close() (closeRequest).
    if (confirming.current) return;
    confirming.current = true;
    void showDiscardChangesDialog({ t, signal: dialogSignal() }).then((discard) => {
      confirming.current = false;
      if (!discard) return;
      // Prima di uscire: altrimenti la guardia di useRoute bloccherebbe di nuovo la cronologia.
      onDirtyChange(false);
      onClose();
    });
  };
```

4. Togliere il blocco JSX `{confirmClose && (<ConfirmDialog … />)}`. L'handler di Esc (`!document.querySelector('dialog[open]')`) resta com'è.

- [ ] **Step 3: Profili e preset**

In `src/ui/ai/settings/AiProfilesSection.tsx`:

1. Import: togliere `ConfirmDialog`; aggiungere `import { showConfirmDialog, showDiscardChangesDialog } from '../../../elements/dialogs/confirmDialog';` e `import { useUnmountSignal } from '../../useUnmountSignal';`.
2. Da `useDraft` prendere anche `dirty`: `const { draft, dirty, setDraft, markSaved, select, confirmSwitch, cancelSwitch } = useDraft<ModelProfile>(onDirty);` (`pending` non serve più).
3. Togliere `const [deleting, setDeleting] = useState(false);`; aggiungere `const dialogSignal = useUnmountSignal();`.
4. `pick` chiede conferma quando la bozza ha modifiche aperte (`select` lascia la scelta in sospeso in `draftState`):

```ts
  const pick = (profile: ModelProfile | null) => {
    select(profile && { ...profile, params: { ...profile.params } });
    setKey('');
    setConnected(false);
    // Con modifiche aperte select() lascia la scelta in sospeso: si chiede se scartarle.
    if (dirty) void showDiscardChangesDialog({ t, signal: dialogSignal() }).then((discard) => (discard ? confirmSwitch() : cancelSwitch()));
  };
  const remove = (profile: ModelProfile) =>
    void showConfirmDialog({ title: t('ai.deleteTitle', { name: profile.name }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal: dialogSignal() }).then((ok) => {
      if (ok) run(controller.deleteProfile(profile.id).then(() => markSaved(null)));
    });
```

5. Il pulsante «Delete»: `onClick={() => setDeleting(true)}` → `onClick={() => remove(draft)}`.
6. Togliere i blocchi JSX `{deleting && draft && (<ConfirmDialog … />)}` e `{pending && (<ConfirmDialog … />)}`.

In `src/ui/ai/settings/AiPresetsSection.tsx`, lo stesso schema:

1. Import come sopra; `useDraft<PromptPreset>` con `dirty` al posto di `pending`; via `deleting`; `const dialogSignal = useUnmountSignal();`.
2. Una funzione per la scelta e una per l'eliminazione:

```ts
  const choose = (preset: PromptPreset) => {
    select(preset);
    if (dirty) void showDiscardChangesDialog({ t, signal: dialogSignal() }).then((discard) => (discard ? confirmSwitch() : cancelSwitch()));
  };
  const remove = (preset: PromptPreset) =>
    void showConfirmDialog({ title: t('ai.deleteTitle', { name: name(preset) }), message: t('ai.deleteMessage'), confirmLabel: t('ai.delete'), t, signal: dialogSignal() }).then((ok) => {
      if (ok) run(controller.deletePreset(preset.id).then(() => markSaved(null)));
    });
```

3. `ItemList`: `onSelect={(p) => choose({ ...p })}`, `onCreate={() => choose({ ...builtInPresets()[0], id: crypto.randomUUID(), builtInId: undefined, name: '', instructions: '', order: state.presets.length })}`.
4. «Delete»: `onClick={() => remove(draft)}`; via i due blocchi JSX `ConfirmDialog`.

- [ ] **Step 4: Ripristino del backup (sync)**

In `src/ui/ai/settings/AiSyncSection.tsx`, in `SyncDetails`:

1. Import: togliere `ConfirmDialog`; aggiungere `import { showConfirmDialog } from '../../../elements/dialogs/confirmDialog';` e `import { useUnmountSignal } from '../../useUnmountSignal';`.
2. Togliere lo stato `restore`; aggiungere `const dialogSignal = useUnmountSignal();`.
3. Il pulsante «Restore this backup» diventa:

```tsx
            <button
              type="button"
              onClick={() =>
                void sync
                  .backupCounts(path)
                  .then((counts) =>
                    showConfirmDialog({
                      title: t('ai.restoreTitle'),
                      message: t('ai.syncCounts', { profiles: counts.profiles, presets: counts.presets }) + '\n' + t('ai.syncRestoreWarning'),
                      confirmLabel: t('ai.restoreBackup'),
                      t,
                      signal: dialogSignal(),
                    }),
                  )
                  .then((ok) => (ok ? sync.restore(path).then(() => controller.reload()) : undefined))
                  .catch((e) => controller.report(e))
              }
            >
```

4. Togliere il blocco JSX `{restore && (<ConfirmDialog … />)}`.

- [ ] **Step 5: «Accetta tutto» nella revisione**

In `src/ui/ai/ReviewView.tsx`:

1. Import: togliere `ConfirmDialog`; aggiungere `import { showConfirmDialog } from '../../elements/dialogs/confirmDialog';` e `import { useUnmountSignal } from '../useUnmountSignal';`.
2. Togliere `const [confirm, setConfirm] = useState(false);`; aggiungere, tra gli hook in testa, `const dialogSignal = useUnmountSignal();`.
3. In `accept` togliere `setConfirm(false);`. Subito dopo la definizione di `accept` (prima dei `return` anticipati, perché è un hook):

```ts
  // La conferma risponde dopo qualche render: si accetta con la proposta dell'ultimo, come faceva onConfirm.
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
```

4. `onAcceptAll` diventa:

```tsx
        onAcceptAll={() => {
          if (editor.text === p.baseText || p.scope) return accept();
          void showConfirmDialog({ title: t('ai.acceptAll'), message: t('ai.changedWarning'), confirmLabel: t('ai.acceptAll'), t, signal: dialogSignal() }).then(
            (ok) => ok && acceptRef.current(),
          );
        }}
```

5. Togliere il blocco JSX `{confirm && (<ConfirmDialog … />)}`; togliere `useState` dall'import di React se non resta usato (resta per `elapsed`).

- [ ] **Step 6: Via i componenti e le classi dei dialog**

```bash
git rm src/ui/ConfirmDialog.tsx src/ui/NameDialog.tsx
grep -rn "ConfirmDialog\|NameDialog" src            # restano solo commenti (es. "era ConfirmDialog.tsx")
```

In `src/ui/Dialog.module.css` restano solo le classi usate da `SettingsView` (`.input`, `.field`, `.group`, `.group legend`, `.option`, `.secondary`). La regola comune `.primary, .secondary, .danger { … }` diventa `.secondary { … }` con le stesse dichiarazioni, seguita dalla regola `.secondary` esistente; via `.dialog`, `.dialog::backdrop`, `.title`, `.message`, `.error`, `.actions`, `.primary`, `.danger`. In testa al file un commento: `/* Campi delle impostazioni (SettingsView): le classi dei dialog sono in src/elements/dialogs/dialogs.css. */`. Prima di cancellare una classe, `grep -n "dialog\.<classe>" src/ui/SettingsView.tsx` per conferma.

- [ ] **Step 7: Verifica completa**

```bash
npm test                    # architecture.test.ts ora passa
npm run lint
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit
```

Expected: tutto verde; conteggi come al Task 5 (più il test statico in `npm test`). L'audit su `settings` e `unsaved-dialog` coincide con la baseline (il pulsante «Save all» usa ancora `.secondary` di `Dialog.module.css`).

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "feat: conferme di impostazioni, profili, preset, sync e revisione con showConfirmDialog; via ConfirmDialog e NameDialog"
```

---

### Task 7: Documenti, misure e chiusura della fase

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-housemd-web-components-design.md`
- Modify: `CLAUDE.md`, `src/testing/domEnv.ts` (commento sui limiti)

- [ ] **Step 1: Misure**

```bash
npm run build
gzip -c dist/assets/index-*.js | wc -c     # annotare accanto al valore del Task 1
```

- [ ] **Step 2: Spec**

Nello spec:

1. Riga `Stato:` in testa: «fase 4a sul branch `feat/web-components`» → «fasi 4a e 4b sul branch `feat/web-components`; fasi 4c–8 ancora piano».
2. §5.4: le firme diventano

```ts
const name = await showNameDialog({ title, kind, initial, confirmLabel, validate, t, signal });   // string | null
const ok   = await showConfirmDialog({ title, message, confirmLabel, t, signal });               // boolean
await showAccessLostDialog({ folderName, onResume, t, signal });                                 // si chiude solo con accesso concesso
```

   e dopo il paragrafo sul focus aggiungere: «`signal` (facoltativo) chiude il dialog quando chi l'ha aperto sparisce; la Promise si risolve come un annullamento. Il dialog si rimuove dopo l'evento `close`, così il focus torna all'elemento d'origine anche dopo una conferma (prima della 4b, con React, cadeva sul `body`). La conferma «Scartare le modifiche?» è `showDiscardChangesDialog({ t, signal })`; i dialog dell'albero passano da `runTreeDialog(dialog, deps)` (`elements/workspace/treeDialogs.ts`).»
3. §7 fase 4, dopo il punto della 4a: «- 4b **fatta**: `showNameDialog`, `showConfirmDialog`, `showDiscardChangesDialog`, `showAccessLostDialog` in `src/elements/dialogs/` (nucleo `modal.ts`, foglio `dialogs.css`), `runTreeDialog`, hook temporaneo `useUnmountSignal`; via `ConfirmDialog.tsx`, `NameDialog.tsx`, `AccessLostDialog`; `Dialog.module.css` resta per i campi delle impostazioni fino alla fase 7. Audit esteso ai `::backdrop` e agli stati conferma, modifiche aperte, accesso perso. Conservato un difetto: Esc nelle impostazioni con modifiche aperte apre e richiude subito la conferma.»
4. §8.2, paragrafo sui limiti di jsdom: aggiungere «Lo stub `src/testing/dialogStub.ts` imita `showModal`/`close`/`returnValue` e `command="close"`.»
5. §8.3: aggiungere il punto «`showModal(` e `<dialog` solo in `src/elements/dialogs/`».
6. §13: «4b e 4c da scrivere» → «`docs/superpowers/plans/2026-10-05-housemd-wc-06-fase-4b-dialog.md` (fase 4b); 4c da scrivere».

In `src/testing/domEnv.ts`, commento in testa: dopo «uno stub nel suo test» aggiungere «(`popoverStub.ts`, `dialogStub.ts`)».

- [ ] **Step 3: `CLAUDE.md`**

La regola «Mai `alert()` / `confirm()` / `prompt()`: usare `<dialog>` con `showModal()` e `closedby="any"`.» diventa:

```markdown
- Mai `alert()` / `confirm()` / `prompt()`: i dialog sono le funzioni di `src/elements/dialogs/`
  (`showConfirmDialog`, `showNameDialog`, `showAccessLostDialog`), che usano `<dialog>` con `showModal()` e `closedby`.
```

- [ ] **Step 4: Verifica finale**

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:dev
npm run test:e2e:audit
git status --short          # solo i file di questo task
```

Expected: tutto verde.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-27-housemd-web-components-design.md CLAUDE.md src/testing/domEnv.ts
git commit -m "docs: spec e CLAUDE.md allineati alla fase 4b (dialog come funzioni)"
```

- [ ] **Step 6: Checklist manuale per Davide** (da consegnare, non da eseguire)

Con `npm run dev` (URL a Davide), in Chrome:

1. Albero: nuovo file/cartella, rinomina, elimina dal menu ⋯ e da tastiera (Shift+F10); Esc e clic fuori chiudono; il focus torna sul ⋯ (o sul pulsante della testata).
2. Nome già esistente, nome vuoto, nome con `/` o con il punto iniziale: errore letto dallo screen reader (`aria-describedby`).
3. Accesso perso (revocare il permesso dalle impostazioni del sito): Esc e clic fuori non chiudono; «Riprendi accesso» con il prompt reale, rifiuto e concessione.
4. Impostazioni: Chiudi e Indietro con modifiche aperte, cambio di profilo e di preset con modifiche, elimina profilo/preset, ripristino di un backup del sync.
5. Revisione AI: «Accetta tutto» dopo aver modificato il documento → conferma.
6. Tema scuro: aspetto dei dialog e del backdrop come prima.
