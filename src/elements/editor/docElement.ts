import type { EditorState, EditorStateConfig } from '@codemirror/state';

import { HmdElement } from '../../dom/element';
import { docExtensions, type DocHost } from '../../editor/docExtensions';
import { docStateConfig, saveDocSession, type DocSession } from '../../editor/docSession';
import type { Translate } from '../../editor/formatToolbar';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';
import type { I18nStore } from '../../state/i18nStore';
import { emit } from '../events';
import { adoptResetKey } from './editorLogic';

/** Salva un'immagine incollata o trascinata e restituisce il link relativo (null se non salvata). */
export type SaveImage = (file: File) => Promise<string | null>;

const NO_DOCS = (): DocTitle[] => [];
const KEY_ONLY: Translate = (key) => key;

/**
 * Il documento aperto come lo ricevono hmd-editor e hmd-ai-diff-pane (lato documento): stesse proprietà,
 * stesse estensioni, stessi eventi `hmd-doc-change` e `hmd-selection`. I setter segnano soltanto; ciò che
 * cambia la vista (documento nuovo, ripristino, sola lettura) la sottoclasse lo applica in un microtask
 * (`docInputChanged`), qualunque sia l'ordine in cui React assegna le proprietà.
 */
export abstract class HmdDocElement extends HmdElement {
  #text = '';
  #resetKey = '';
  #session: DocSession | null = null;
  #restore: RestoreCommand | null = null;
  #readOnly = false;
  #getDocs: () => DocTitle[] = NO_DOCS;
  #saveImage: SaveImage | null = null;
  #i18n: I18nStore | null = null;
  /**
   * Sessione da cui è nata la vista mostrata: la vista salva lì, anche quando la proprietà `session` è già
   * quella del documento nuovo (la sostituzione arriva nel microtask dopo).
   */
  #shownSession: DocSession | null = null;

  /** Le estensioni del documento leggono da qui a ogni uso: valori sempre attuali, senza ricrearle. */
  protected readonly docHost: DocHost = {
    resetKey: () => this.#resetKey,
    readOnly: () => this.#readOnly,
    session: () => this.#shownSession,
    t: () => this.translator(),
    getDocs: () => this.#getDocs(),
    saveImage: (file) => this.#saveImage?.(file) ?? Promise.resolve(null),
    docChanged: (changes, texts) => emit(this, 'hmd-doc-change', { changes, before: texts.before, after: texts.after }),
    selectionChanged: (range) => emit(this, 'hmd-selection', { range }),
  };

  /** Letto solo quando cambia `resetKey`: mentre si scrive il testo arriva dall'editor stesso. */
  get text(): string { return this.#text; }
  set text(value: string) { this.#text = value ?? ''; }
  /** Quando cambia, il contenuto si sostituisce e la cronologia riparte (altro file, ricarica). */
  get resetKey(): string { return this.#resetKey; }
  set resetKey(value: string) {
    value ??= '';
    if (value === this.#resetKey) return;
    this.#resetKey = value;
    this.docInputChanged();
  }
  get session(): DocSession | null { return this.#session; }
  set session(value: DocSession | null) { this.#session = value ?? null; }
  /** Ripristino dalla cronologia: una transazione, quindi annullabile con Ctrl+Z. */
  get restore(): RestoreCommand | null { return this.#restore; }
  set restore(value: RestoreCommand | null) {
    this.#restore = value ?? null;
    this.docInputChanged();
  }
  /** Sola lettura (aggiornamento dell'app in corso). */
  get readOnly(): boolean { return this.#readOnly; }
  set readOnly(value: boolean) {
    this.#readOnly = value ?? false;
    this.docInputChanged();
  }
  get getDocs(): () => DocTitle[] { return this.#getDocs; }
  set getDocs(value: () => DocTitle[]) { this.#getDocs = value ?? NO_DOCS; }
  /** Non `onImage`: React 19 tratta ogni prop `on…` di un custom element come un listener. */
  get saveImage(): SaveImage | null { return this.#saveImage; }
  set saveImage(value: SaveImage | null) { this.#saveImage = value ?? null; }
  get i18n(): I18nStore | null { return this.#i18n; }
  set i18n(value: I18nStore | null) {
    value ??= null;
    if (value === this.#i18n) return;
    this.#i18n = value;
    this.i18nChanged();
  }

  /** Traduzione attuale (la barra di formattazione la legge quando compare). Non `translate`: è di HTMLElement. */
  protected translator(): Translate {
    return this.#i18n?.t ?? KEY_ONLY;
  }

  /** `resetKey`, `restore` o `readOnly` assegnati: da applicare in un microtask. */
  protected abstract docInputChanged(): void;

  /** Store della lingua cambiato: niente di default (hmd-editor legge le traduzioni quando servono). */
  protected i18nChanged(): void {}

  /** Configurazione del documento: dalla sessione (testo, selezione, cronologia) o dal testo. */
  protected docConfig(): EditorStateConfig {
    const session = this.#session;
    this.#shownSession = session;
    if (session) adoptResetKey(session, this.#resetKey, this.#text);
    const extensions = docExtensions(this.docHost);
    return session ? docStateConfig(session, extensions) : { doc: this.#text, extensions };
  }

  /** Prima di distruggere la vista: testo, selezione e cronologia nella sua sessione, per la vista dopo. */
  protected saveSession(state: EditorState): void {
    if (this.#shownSession) saveDocSession(this.#shownSession, state);
  }
}
