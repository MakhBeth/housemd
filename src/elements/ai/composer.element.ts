import { composerAction } from '../../ai/composerKeys';
import { resolveAttachments } from '../../ai/contextAttach';
import { BRIDGE_MAX_BODY, formatSize } from '../../ai/contextCheck';
import type { ContextCandidate } from '../../ai/contextIndex';
import { insertReference, reconcile, referenceText, removeReference, triggerAt, type Attachment, type Trigger } from '../../ai/contextRefs';
import { needsContextConfirmation } from '../../ai/profiles';
import type { TextRange } from '../../ai/selectionChip';
import type { SelectionScope } from '../../ai/types';
import { announce } from '../../dom/announce';
import { HmdElement } from '../../dom/element';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { uid } from '../../dom/uid';
import { pluralKey } from '../../i18n/i18n';
import { RenderLoop } from '../../dom/renderLoop';
import type { I18nStore } from '../../state/i18nStore';
import { ICONS } from '../../ui/icons';
import { emit } from '../events';
import type { HmdAiEffortChip } from './effort-chip.element';
import type { HmdAiModelChip } from './model-chip.element';
import { CONTROLLER_NOTES, outgoing, selectionChipText, sendBlocker, sendButton, type ComposerController, type SendBlocker } from './composerView';
import { candidateName, candidatePath, candidatesOf, chipText, moveActive, suggestions, type ContextSource, type SuggestionState } from './contextView';
import { showSendContextDialog } from '../dialogs/confirmDialog';
import { OriginNote } from './originNote';
import './composer.css';

interface Parts {
  box: HTMLDivElement;
  /** Chip della selezione: testo e ✕. */
  chip: HTMLSpanElement;
  chipText: Text;
  ignore: HTMLButtonElement;
  input: HTMLTextAreaElement;
  modelChip: HmdAiModelChip;
  effortChip: HmdAiEffortChip;
  /** Un solo pulsante, Invia o Stop, come il nodo che React riusava: il focus non salta. */
  send: HTMLButtonElement;
  sendIcon: HTMLSpanElement;
  /** Nota sotto il composer (`role="status"`): perché Invia non ha inviato. Vuota di norma. */
  note: HTMLParagraphElement;
  /** Elenco dei suggerimenti `@` (popover ancorato al composer) con la sua nota visiva. */
  popover: HTMLDivElement;
  list: HTMLUListElement;
  listNote: HTMLParagraphElement;
  /** Chip dei file e cartelle allegati. */
  chips: HTMLUListElement;
  /** Regione live del numero di risultati, separata dalla nota di invio. */
  results: HTMLParagraphElement;
  /** Nota del contesto allegato (lettura, limite, conferma): `role="status"`, scritta con `announce`. */
  contextNote: HTMLParagraphElement;
}

/**
 * Composer della chat AI (era Composer.tsx): chip della selezione, casella della richiesta, riga con il
 * chip del modello, il chip dell'effort e Invia/Stop. La casella è dell'elemento: si crea una volta e
 * l'elemento la svuota solo dopo l'invio di un testo scritto (nessun eco da fuori la riscrive). Invio
 * invia, Shift+Invio va a capo, Esc ferma (composerKeys.ts). `sendPreset()` per i suggerimenti. Invia
 * non si disattiva mai: quando il messaggio non può partire (generazione in corso, nessun documento aperto,
 * aggiornamento in corso: `controller.sendBlocker()`; senza profilo; senza testo) la nota sotto il composer
 * dice perché e la bozza resta. La nota si svuota quando la sua causa sparisce (la generazione finisce, un
 * documento si apre, l'aggiornamento finisce; per profilo e testo: scrivendo, cambiando profilo, con un
 * invio riuscito o quando parte una generazione).
 */
export class HmdAiComposer extends HmdElement {
  #controller: ComposerController | null = null;
  #text = '';
  #draft = '';
  /** `detail` del clic che ha inviato (null se l'invio non è venuto da un clic del mouse). */
  #sendDetail: number | null = null;
  #selection: TextRange | null = null;
  #getSelection: () => SelectionScope | undefined = () => undefined;
  #i18n: I18nStore | null = null;
  #source: ContextSource | null = null;
  #candidates: ContextCandidate[] = [];
  /** Allegati confermati con la scelta di un suggerimento (decisione 3: il testo resta testo). */
  #attachments: Attachment[] = [];
  #trigger: Trigger | null = null;
  #active = 0;
  #listKey = '';
  #resultsText = '';
  #resultsTimer: ReturnType<typeof setTimeout> | null = null;
  #ctx = { text: '', again: false };
  #preparing = false;
  #token = 0;
  #ids = uid('ai-context');

  #parts: Parts | null = null;
  /** Selezione ignorata con ✕: il chip ricompare con una selezione diversa. */
  #ignored: TextRange | null = null;
  /** Nota mostrata e il profilo di quel momento: un cambio di profilo la toglie. */
  /** Invio rifiutato (o selezione persa prima dell'invio): nota sotto la nota dell'invio. */
  #errorNote = new OriginNote(this, () => this.#controller);
  #note: { key: SendBlocker; profileId: string | undefined } | null = null;
  /** Il prossimo render riscrive la nota anche se il testo è lo stesso (un altro invio bloccato). */
  #announceAgain = false;
  #loop = new RenderLoop(this, {
    ready: () => !!this.#parts && !!this.#controller && !!this.#i18n && this.isConnected,
    render: () => this.#render(this.#parts!, this.#controller!, this.#i18n!),
    focusScope: () => this.#parts?.box ?? null,
    // Il nodo con il focus è sparito (la ✕ del chip della selezione): il focus va nella casella (decisione 3).
    refocus: () => this.#parts?.input.focus(),
  });

  get controller(): ComposerController | null { return this.#controller; }
  set controller(value: ComposerController | null) {
    value ??= null;
    if (value === this.#controller) return;
    this.#controller = value;
    this.#passDown();
    this.reconnect();
  }
  /**
   * Bozza con cui la casella nasce (la sidebar AI si ricrea a ogni ritorno nella modalità AI: LAB-10). Letta solo
   * alla costruzione: la casella non si riscrive mai dopo. Ogni cambio della casella esce con `hmd-ai-draft`.
   */
  get draft(): string { return this.#draft; }
  set draft(value: string) { this.#draft = value ?? ''; }
  /** Allegati con cui il composer nasce (come `draft`): poi li governa il composer e li comunica con `hmd-ai-draft`. */
  get attachments(): Attachment[] { return this.#attachments; }
  set attachments(value: Attachment[]) { if (!this.#parts) this.#attachments = value ?? []; }
  /** Indice dei file della cartella aperta e lettura per l'invio (dal workspace, passati dalla sidebar). */
  get contextSource(): ContextSource | null { return this.#source; }
  set contextSource(value: ContextSource | null) {
    value ??= null;
    if (value === this.#source) return;
    this.#source = value;
    this.#candidates = candidatesOf(value);
    this.#loop.update();
  }
  /** Testo del documento aperto, per contare la selezione. */
  get text(): string { return this.#text; }
  set text(value: string) {
    value ??= '';
    if (value === this.#text) return;
    this.#text = value;
    this.#loop.update();
  }
  get selection(): TextRange | null { return this.#selection; }
  set selection(value: TextRange | null) {
    value ??= null;
    if (value === this.#selection) return;
    this.#selection = value;
    this.#loop.update();
  }
  /** Scope della selezione calcolato al momento dell'invio dalla sessione dell'editor (come prima). */
  get getSelection(): () => SelectionScope | undefined { return this.#getSelection; }
  set getSelection(value: () => SelectionScope | undefined) {
    this.#getSelection = value ?? (() => undefined);
  }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.#passDown();
    this.reconnect();
  }

  /** Invia il preset (suggerimenti sotto il composer), come `sendPreset` del ref di Composer.tsx. */
  sendPreset(presetId: string): void {
    this.#send(presetId);
  }

  protected connect(signal: AbortSignal): void {
    if (!this.#parts) {
      const chipText = document.createTextNode('');
      const ignore = el('button', { type: 'button', class: 'selectionClose tooltip', on: { click: () => this.#ignore() } }, icon('close', { size: 12 }));
      const sendIcon = icon('send', { size: 16 });
      const parts: Parts = {
        box: el('div', { class: 'composer' }),
        chip: el('span', { class: 'selection' }, chipText, ignore),
        chipText,
        ignore,
        input: el('textarea', {
          class: 'input',
          'aria-autocomplete': 'list',
          'aria-haspopup': 'listbox',
          on: { input: () => this.#onInput(), keydown: (event) => this.#onKeyDown(event), keyup: (event) => this.#onKeyUp(event), click: () => this.#syncTrigger(), blur: () => this.#closeList() },
        }),
        modelChip: el('hmd-ai-model-chip'),
        effortChip: el('hmd-ai-effort-chip'),
        send: el('button', { type: 'button', class: 'send tooltip', on: { click: (event) => this.#onButton(event) } }, sendIcon),
        sendIcon,
        note: el('p', { class: 'note', role: 'status' }),
        popover: el('div', { class: 'suggestions', popover: 'manual' }),
        list: el('ul', { id: this.#ids, role: 'listbox', class: 'options' }),
        listNote: el('p', { class: 'listNote', 'aria-hidden': 'true' }),
        chips: el('ul', { class: 'attachments' }),
        results: el('p', { class: 'visuallyHidden', role: 'status' }),
        contextNote: el('p', { class: 'note', role: 'status' }),
      };
      parts.popover.append(parts.list, parts.listNote);
      parts.input.value = this.#draft;
      this.#parts = parts;
      // Le proprietà dei chip prima dell'inserimento, come fa React con i tag hmd-*.
      this.#passDown();
      parts.box.append(parts.input, parts.chips, el('div', { class: 'row' }, parts.modelChip, parts.effortChip, parts.send));
      this.append(parts.box, parts.popover, parts.note, parts.contextNote, parts.results);
    }
    const { controller, i18n } = { controller: this.#controller, i18n: this.#i18n };
    if (!controller || !i18n) return;
    this.watch(controller, () => this.#loop.update(), signal);
    this.watch(i18n, () => this.#loop.update(), signal);
  }

  /** Controller e lingua passano ai due chip (che si riallacciano da soli quando cambiano). */
  #passDown(): void {
    const parts = this.#parts;
    if (!parts) return;
    parts.modelChip.controller = this.#controller;
    parts.modelChip.i18n = this.#i18n;
    parts.effortChip.controller = this.#controller;
    parts.effortChip.i18n = this.#i18n;
  }

  #onInput(): void {
    const value = this.#parts!.input.value;
    this.#attachments = reconcile(value, this.#attachments);
    this.#emitDraft();
    this.#note = null;
    this.#syncTrigger();
  }

  #emitDraft(): void {
    emit(this, 'hmd-ai-draft', { text: this.#parts!.input.value, attachments: this.#attachments });
  }

  /** Il trigger `@` al cursore (nessuno con una selezione); la voce attiva riparte dalla prima a ogni cambio di filtro. */
  #syncTrigger(): void {
    const input = this.#parts?.input;
    if (!input) return;
    const next = this.#source && input.selectionStart === input.selectionEnd ? triggerAt(input.value, input.selectionStart) : null;
    const was = this.#trigger;
    this.#trigger = next;
    if (next && (!was || was.from !== next.from || was.query !== next.query)) this.#active = 0;
    this.#loop.update();
  }

  #onKeyUp(event: KeyboardEvent): void {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) this.#syncTrigger();
  }

  #closeList(): void {
    if (!this.#trigger) return;
    this.#trigger = null;
    this.#loop.update();
  }

  /** Voci mostrate adesso (vuote se l'elenco non è aperto con risultati). */
  #items(): ContextCandidate[] {
    const state = suggestions(this.#source, this.#candidates, this.#trigger?.query ?? null);
    return state.kind === 'items' ? state.items : [];
  }

  /** Sceglie una voce: il riferimento entra nel testo (unica riscrittura della casella oltre all'invio) e diventa allegato. */
  #pick(index: number): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    const trigger = this.#trigger;
    const item = this.#items()[index];
    if (!parts || !i18n || !trigger || !item) return;
    const inserted = insertReference(parts.input.value, trigger, referenceText(item.path, item.kind));
    parts.input.value = inserted.text;
    parts.input.setSelectionRange(inserted.cursor, inserted.cursor);
    parts.input.focus();
    const path = candidatePath(item);
    if (item.mdCount === 0) {
      this.#setContext(i18n.t('ai.context.emptyFolder', { path }));
    } else {
      if (!this.#attachments.some((a) => a.path === item.path && a.kind === item.kind)) this.#attachments = [...this.#attachments, { path: item.path, kind: item.kind }];
      this.#setContext(i18n.t('ai.context.added', { path }));
    }
    this.#trigger = null;
    this.#emitDraft();
    this.#loop.update();
  }

  /** ✕ di un chip: toglie il riferimento dal testo, il focus torna nella casella. */
  #removeAttachment(attachment: Attachment): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n) return;
    const removed = removeReference(parts.input.value, attachment.path);
    parts.input.value = removed.text;
    parts.input.setSelectionRange(removed.cursor, removed.cursor);
    this.#attachments = reconcile(removed.text, this.#attachments);
    parts.input.focus();
    const label = candidatePath({ path: attachment.path, kind: attachment.kind, name: '', mdCount: null });
    const including = attachment.kind === 'file' && this.#source ? resolveAttachments(this.#source.entries, this.#attachments).via.get(attachment.path) : undefined;
    this.#setContext(including === undefined ? i18n.t('ai.context.removed', { path: label }) : i18n.t('ai.context.stillIncluded', { path: label, folder: including === '' ? '/' : `${including}/` }));
    this.#emitDraft();
    this.#trigger = null;
    this.#loop.update();
  }

  /** Nota del contesto: ogni scrittura si ri-annuncia (un secondo invio fallito per lo stesso motivo si rilegge). */
  #setContext(text: string): void {
    this.#ctx = { text, again: true };
    this.#loop.update();
  }

  #ignore(): void {
    this.#ignored = this.#selection;
    this.#loop.update();
  }

  #onKeyDown(event: KeyboardEvent): void {
    const controller = this.#controller;
    if (!controller) return;
    const { key, shiftKey, ctrlKey, metaKey, altKey, isComposing } = event;
    const items = this.#items();
    const listOpen = items.length > 0;
    const action = composerAction({ key, shiftKey, ctrlKey, metaKey, altKey, isComposing }, !!controller.getState().running, listOpen, listOpen);
    if (action === 'next' || action === 'prev') {
      event.preventDefault();
      this.#active = moveActive(this.#active, action === 'next' ? 1 : -1, items.length);
      this.#loop.update();
    } else if (action === 'pick') {
      event.preventDefault();
      this.#pick(this.#active);
    } else if (action === 'close') {
      event.preventDefault();
      this.#closeList();
    } else if (action === 'dismiss') {
      this.#closeList();
    } else if (action === 'send') {
      event.preventDefault();
      this.#send();
    } else if (action === 'stop') {
      event.preventDefault();
      controller.stop();
    }
  }

  #onButton(event: MouseEvent): void {
    const controller = this.#controller;
    if (!controller) return;
    if (controller.getState().running) {
      // Il clic subito dopo quello che ha inviato, nella stessa sequenza (detail dell'invio + 1), è la seconda metà
      // di un doppio clic: non ferma la richiesta appena partita. Ogni altro clic ferma, anche una serie rapida
      // (detail 3, 4…: chi ha un tremore clicca così) e la tastiera (detail 0).
      const second = this.#sendDetail !== null && event.detail === this.#sendDetail + 1;
      this.#sendDetail = null;
      if (!second) controller.stop();
      return;
    }
    this.#send();
    this.#sendDetail = event.detail > 0 ? event.detail : null;
  }

  /**
   * Invio chiesto dall'utente (Invia, Invio, un suggerimento): se il messaggio risolto (testo scritto o
   * preset) non può partire, la nota dice perché; la casella e il focus restano come sono.
   */
  #send(presetId?: string): void {
    // Un invio che non viene da un clic (Invio, suggerimento) non ha un secondo clic da ignorare.
    this.#sendDetail = null;
    const controller = this.#controller;
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!controller || !parts || !i18n) return;
    const state = controller.getState();
    const preset = presetId ? state.presets.find((p) => p.id === presetId) : undefined;
    // Prima la guardia di send() (che altrimenti scarterebbe in silenzio e la bozza andrebbe persa), poi profilo e testo.
    const blocker = sendBlocker(parts.input.value, !!controller.profile(), !!preset, controller.sendBlocker());
    if (blocker) {
      this.#announceAgain = this.#note?.key === blocker;
      this.#note = { key: blocker, profileId: controller.profile()?.id };
      this.#loop.update();
      return;
    }
    const message = outgoing(parts.input.value, preset, i18n.t);
    if (!message) return;
    const scoped = selectionChipText(i18n.t, this.#text, this.#selection, this.#ignored) !== null;
    const scope = scoped ? this.#getSelection() : undefined;
    if (scoped && !scope) {
      // Una nota di prima (es. needText) non deve restare su questo percorso.
      this.#note = null;
      this.#loop.update();
      this.#errorNote.begin();
      this.#errorNote.report('send-scope')({ code: 'scopeLost' });
      return;
    }
    if (!preset && this.#attachments.length > 0 && this.#source) {
      this.#note = null;
      void this.#sendWithContext(message, scope);
      return;
    }
    this.#errorNote.begin();
    void controller.send(message, preset, scope).catch(this.#errorNote.report('send'));
    this.#note = null;
    if (preset) {
      this.#loop.update();
      return;
    }
    // L'unica scrittura della casella: dopo l'invio di un testo scritto si svuota (spec AI UI §4.2).
    parts.input.value = '';
    this.#attachments = [];
    this.#emitDraft();
    this.#loop.update();
  }

  /**
   * Invio con allegati, in due tempi: lettura (bozze al posto del disco) e controlli, poi l'eventuale conferma verso un
   * provider remoto. Nessun invio parziale né troncamento: ogni esito negativo scrive la nota e lascia casella e chip.
   * Un esito che arriva dopo che il componente si è staccato o è ripartito un altro invio si scarta (`#token`).
   */
  async #sendWithContext(message: string, scope: SelectionScope | undefined): Promise<void> {
    const parts = this.#parts;
    const controller = this.#controller;
    const i18n = this.#i18n;
    const source = this.#source;
    if (!parts || !controller || !i18n || !source) return;
    const t = i18n.t;
    if (this.#preparing) {
      this.#setContext(t('ai.context.preparing'));
      return;
    }
    this.#preparing = true;
    const token = ++this.#token;
    const alive = () => token === this.#token && this.isConnected;
    const locale = i18n.getState().locale;
    this.#setContext(t('ai.context.preparing'));
    try {
      const { paths, via } = resolveAttachments(source.entries, this.#attachments);
      const read = await source.read(paths);
      if (!alive()) return;
      if ('unreadable' in read) {
        this.#setContext(t('ai.context.readError', { path: read.unreadable[0]! }));
        return;
      }
      const result = controller.contextCheck(message, undefined, scope, read, via);
      if (!result) {
        this.#setContext('');
        return;
      }
      const { check, profile } = result;
      if (check.kind === 'bridgeTooLarge') {
        this.#setContext(t('ai.context.bridgeLimit', { size: formatSize(check.bytes, locale), limit: formatSize(BRIDGE_MAX_BODY, locale) }));
        return;
      }
      if (check.kind === 'overLimit') {
        const fmt = new Intl.NumberFormat(locale);
        const files = check.top.map((f) => (f.via === undefined ? f.path : `${f.path} (${f.via === '' ? '/' : `${f.via}/`})`)).join(', ');
        this.#setContext(`${t('ai.context.overLimit', { total: fmt.format(check.totalTokens), limit: fmt.format(check.limit), excess: fmt.format(check.excess), files })} ${t('ai.context.removeSuggestion')}`);
        return;
      }
      const folders = this.#attachments.filter((a) => a.kind !== 'file');
      if (folders.length > 0 && needsContextConfirmation(profile)) {
        this.#setContext('');
        const size = formatSize(read.reduce((n, f) => n + new TextEncoder().encode(f.text).length, 0), locale);
        const confirmed = await showSendContextDialog({ provider: profile.name, folders: folders.map((a) => (a.kind === 'root' ? '/' : `${a.path}/`)), count: read.length, size, locale, t });
        if (!alive()) return;
        if (!confirmed) {
          parts.send.focus();
          return;
        }
      }
      const blocker = controller.sendBlocker();
      if (blocker) {
        this.#note = { key: CONTROLLER_NOTES[blocker], profileId: controller.profile()?.id };
        this.#setContext('');
        return;
      }
      this.#errorNote.begin();
      void controller.send(message, undefined, scope, read).catch(this.#errorNote.report('send'));
      parts.input.value = '';
      this.#attachments = [];
      this.#emitDraft();
      this.#setContext(check.limit === null ? t('ai.context.unknownLimit') : '');
    } finally {
      if (token === this.#token) this.#preparing = false;
      this.#loop.update();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#token++;
    this.#preparing = false;
    if (this.#resultsTimer) clearTimeout(this.#resultsTimer);
    this.#errorNote.release();
  }

  #render(parts: Parts, controller: ComposerController, i18n: I18nStore): void {
    const t = i18n.t;
    const chipText = selectionChipText(t, this.#text, this.#selection, this.#ignored);
    if (chipText !== null) {
      setText(parts.chipText, chipText);
      toggleAttr(parts.ignore, 'aria-label', true, t('ai.selectionIgnore'));
      toggleAttr(parts.ignore, 'data-tooltip', true, t('ai.selectionIgnore'));
      if (parts.chip.parentNode !== parts.box) parts.box.prepend(parts.chip);
    } else {
      parts.chip.remove();
    }
    toggleAttr(parts.input, 'aria-label', true, t('ai.request'));
    toggleAttr(parts.input, 'placeholder', true, t('ai.request'));
    const button = sendButton(!!controller.getState().running);
    toggleAttr(parts.send, 'aria-label', true, t(button.label));
    toggleAttr(parts.send, 'data-tooltip', true, t(button.label));
    parts.sendIcon.style.setProperty('mask-image', `url("${ICONS[button.icon]}")`);
    // La nota se ne va quando la sua causa sparisce: per le ragioni del controller quando la ragione cambia;
    // per profilo e testo con un cambio di profilo o una generazione partita da qualunque parte (anche «Riprova»
    // nel registro). La stessa nota a un altro Invio si ri-annuncia (svuotata e riscritta dopo `ANNOUNCE_DELAY_MS`).
    if (this.#note) {
      const reason = controller.sendBlocker();
      const fromController = (Object.values(CONTROLLER_NOTES) as SendBlocker[]).includes(this.#note.key);
      const stale = fromController ? (reason ? CONTROLLER_NOTES[reason] : null) !== this.#note.key : this.#note.profileId !== controller.profile()?.id || !!reason;
      if (stale) this.#note = null;
    }
    announce(parts.note, this.#note ? t(this.#note.key) : '', this.#announceAgain);
    this.#announceAgain = false;
    this.#errorNote.update(controller.getState(), t, parts.note, parts.send);
    announce(parts.contextNote, this.#ctx.text, this.#ctx.again);
    this.#ctx.again = false;
    this.#renderContext(parts, i18n);
  }

  /** Elenco dei suggerimenti, annuncio dei risultati e chip. */
  #renderContext(parts: Parts, i18n: I18nStore): void {
    const t = i18n.t;
    const locale = i18n.getState().locale;
    const source = this.#source;
    const state: SuggestionState = suggestions(source, this.#candidates, this.#trigger?.query ?? null);
    const items = state.kind === 'items' ? state.items : [];
    this.#active = Math.min(this.#active, Math.max(0, items.length - 1));
    // Voci: si ricostruiscono solo se cambiano (percorsi o lingua); la voce attiva si aggiorna in loco.
    const key = `${locale}|${items.map((c) => `${c.kind}:${c.path}`).join('|')}`;
    if (key !== this.#listKey) {
      this.#listKey = key;
      parts.list.replaceChildren(
        ...items.map((c, i) =>
          el(
            'li',
            { id: `${this.#ids}-${i}`, role: 'option', class: 'option', on: { pointerdown: (event) => event.preventDefault(), click: () => this.#pick(i) } },
            el('span', { class: 'optionTop' }, icon(c.kind === 'file' ? 'file' : 'folder', { size: 14 }), el('span', { class: 'optionName' }, candidateName(c, t)), el('span', { class: 'optionKind' }, t(`ai.context.${c.kind}`))),
            el('span', { class: 'optionPath' }, candidatePath(c), c.mdCount === null ? '' : ` · ${t(pluralKey(locale, 'ai.context.folderCount', c.mdCount), { count: c.mdCount })}`),
          ),
        ),
      );
    }
    [...parts.list.children].forEach((li, i) => {
      toggleAttr(li as HTMLElement, 'aria-selected', true, String(i === this.#active));
      (li as HTMLElement).classList.toggle('active', i === this.#active);
    });
    const open = state.kind !== 'closed';
    const listOpen = items.length > 0;
    parts.list.hidden = !listOpen;
    toggleAttr(parts.list, 'aria-label', true, t('ai.context.suggestions'));
    toggleAttr(parts.input, 'aria-controls', listOpen, this.#ids);
    toggleAttr(parts.input, 'aria-activedescendant', listOpen, `${this.#ids}-${this.#active}`);
    const noteText = state.kind === 'loading' ? t('ai.context.loading') : state.kind === 'empty' ? (state.message === 'ai.context.noResults' ? t(state.message, { query: state.query }) : t(state.message)) : '';
    setText(parts.listNote, noteText);
    parts.listNote.hidden = noteText === '';
    if (open && !parts.popover.matches(':popover-open')) parts.popover.showPopover();
    else if (!open && parts.popover.matches(':popover-open')) parts.popover.hidePopover();
    if (listOpen) (parts.list.children[this.#active] as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
    // Annuncio dei risultati: raggruppato mentre si scrive (300 ms), subito alla chiusura.
    const announcement = state.kind === 'items' ? t(pluralKey(locale, 'ai.context.results', state.total), { count: state.total }) : noteText;
    if (announcement !== this.#resultsText) {
      this.#resultsText = announcement;
      if (this.#resultsTimer) clearTimeout(this.#resultsTimer);
      this.#resultsTimer = null;
      if (announcement === '') announce(parts.results, '');
      else this.#resultsTimer = setTimeout(() => announce(parts.results, this.#resultsText, true), 300);
    }
    // Chip: si ricostruiscono solo se cambiano gli allegati o il testo (conteggi, lingua).
    const chips = this.#attachments.map((a) => ({ a, text: chipText(a, this.#candidates, !!source?.loading, t, locale) }));
    const chipKey = `${t('ai.context.remove', { path: '' })}|${chips.map((c) => `${c.a.kind}:${c.a.path}:${c.text}`).join('|')}`;
    if (chipKey !== parts.chips.dataset.key) {
      parts.chips.dataset.key = chipKey;
      parts.chips.replaceChildren(
        ...chips.map(({ a, text }) =>
          el(
            'li',
            { class: 'attachment' },
            el('span', { class: 'attachmentText' }, text),
            el('button', { type: 'button', class: 'attachmentRemove', 'aria-label': t('ai.context.remove', { path: a.kind === 'file' ? a.path : a.kind === 'root' ? '/' : `${a.path}/` }), on: { click: () => this.#removeAttachment(a) } }, icon('close', { size: 12 })),
          ),
        ),
      );
    }
    parts.chips.hidden = chips.length === 0;
    toggleAttr(parts.chips, 'aria-label', true, t('ai.context.attachments'));
  
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-ai-composer': HmdAiComposer;
  }
}
