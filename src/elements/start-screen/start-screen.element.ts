import { HmdElement } from '../../dom/element';
import { announce } from '../../dom/announce';
import { el, setText, toggleAttr } from '../../dom/el';
import { icon } from '../../dom/icon';
import { reconcileList } from '../../dom/list';
import { uid } from '../../dom/uid';
import { recentLabel, type RecentItem } from '../open-menu/openView';
import type { UnsupportedReason } from '../../fs/access';
import type { I18nStore } from '../../state/i18nStore';
import { LOGO, LOGO_INVERTED, WORDMARK } from '../../ui/logo';
import { emit } from '../events';
import { folderBlocker } from '../workspace/workspaceView';
import { startView, type StartMode } from './startView';
import './start-screen.css';

/** Schermata iniziale (era StartScreen.tsx): browser senza cartelle (solo file singolo), prima apertura, ripresa dell'accesso. */
export class HmdStartScreen extends HmdElement {
  #mode: StartMode = 'start';
  #reason: UnsupportedReason | undefined;
  #error: string | undefined;
  /** Numero dell'errore mostrato: cambia a ogni apertura fallita, anche con lo stesso testo (si riannuncia). */
  #errorSeq = 0;
  #announcedSeq = 0;
  #folderName = '';
  #recoverName = '';
  #recents: readonly RecentItem[] = [];
  #busy = false;
  #i18n: I18nStore | null = null;
  /** Un pulsante è stato attivato durante un cambio: la nota resta finché il cambio dura. */
  #note = false;
  #announceAgain = false;
  #parts: { main: HTMLElement; panel: HTMLElement; note: HTMLParagraphElement; errorStatus: HTMLParagraphElement; title: HTMLHeadingElement; tagline: HTMLParagraphElement; message: HTMLParagraphElement; pick: HTMLButtonElement; resume: HTMLButtonElement; other: HTMLButtonElement; file: HTMLButtonElement; recover: HTMLButtonElement; recentSection: HTMLElement; recentTitle: HTMLHeadingElement; recentList: HTMLUListElement } | null = null;

  get mode(): StartMode { return this.#mode; }
  set mode(value: StartMode) { this.#mode = value ?? 'start'; this.#render(); }
  get reason(): UnsupportedReason | undefined { return this.#reason; }
  set reason(value: UnsupportedReason | undefined) { this.#reason = value ?? undefined; this.#render(); }
  get errorSeq(): number { return this.#errorSeq; }
  set errorSeq(value: number) { this.#errorSeq = value ?? 0; this.#render(); }
  get error(): string | undefined { return this.#error; }
  set error(value: string | undefined) { this.#error = value ?? undefined; this.#render(); }
  get folderName(): string { return this.#folderName; }
  set folderName(value: string) { this.#folderName = value ?? ''; this.#render(); }
  /** Nome del file singolo con una copia non scaricata da riprendere ('' = nessuna). */
  get recoverName(): string { return this.#recoverName; }
  set recoverName(value: string) { this.#recoverName = value ?? ''; this.#render(); }
  /** Cartelle e file aperti di recente: un pulsante ciascuno sotto le azioni (il permesso lo chiede `hmd-app`). */
  get recents(): readonly RecentItem[] { return this.#recents; }
  set recents(value: readonly RecentItem[]) { this.#recents = value ?? []; this.#render(); }
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
      const main = el('main', { class: 'start' }, panel);
      this.append(main);
      this.#parts = {
        main,
        panel,
        note: el('p', { class: 'note', role: 'status' }),
        errorStatus: el('p', { class: 'visually-hidden', role: 'status' }),
        title,
        tagline,
        message: el('p', { class: 'message' }),
        pick: el('button', { class: 'primary', on: { click: () => this.#activate('hmd-start-pick') } }),
        resume: el('button', { class: 'primary', on: { click: () => this.#activate('hmd-start-resume') } }),
        other: el('button', { class: 'secondary', on: { click: () => this.#activate('hmd-start-pick') } }),
        file: el('button', { class: 'secondary', on: { click: () => this.#activate('hmd-start-pick-file') } }),
        recover: el('button', { class: 'secondary', on: { click: () => this.#activate('hmd-start-recover') } }),
        ...recentSection(),
      };
    }
    if (this.#i18n) this.watch(this.#i18n, () => this.#render(), signal);
  }

  #openRecent(key: string): void {
    if (folderBlocker(this.#busy)) {
      this.#announceAgain = this.#note;
      this.#note = true;
      this.#render();
    } else emit(this, 'hmd-open-choose', { action: 'recent', key });
  }

  /** Durante un cambio non se ne chiede un altro: solo la nota, e il focus resta sul pulsante (mai disabled). */
  #activate(name: 'hmd-start-pick' | 'hmd-start-resume' | 'hmd-start-pick-file' | 'hmd-start-recover'): void {
    if (folderBlocker(this.#busy)) {
      this.#announceAgain = this.#note;
      this.#note = true;
      this.#render();
    } else emit(this, name, null);
  }

  #render(): void {
    const parts = this.#parts;
    const i18n = this.#i18n;
    if (!parts || !i18n) return;
    const view = startView({ mode: this.#mode, reason: this.#reason, error: this.#error, recover: this.#recoverName !== '' });
    setText(parts.title, i18n.t('app.name'));
    setText(parts.tagline, i18n.t('start.tagline'));
    setText(parts.pick, i18n.t('start.openFolder'));
    setText(parts.resume, i18n.t('start.resume', { folder: this.#folderName }));
    setText(parts.other, i18n.t('start.openOther'));
    setText(parts.file, i18n.t('start.openFile'));
    setText(parts.recover, i18n.t('start.recover', { file: this.#recoverName }));
    // Dove le cartelle non si aprono, «Apri un file» è l'azione principale.
    parts.file.className = this.#mode === 'unsupported' ? 'primary' : 'secondary';
    if (view.message) setText(parts.message, i18n.t(view.message.key, view.message.params));
    // L'errore di un'apertura (anche un recente negato) si annuncia: il focus resta sul pulsante e il messaggio da
    // solo non si sente. Una regione sempre presente, riscritta con `announce` a ogni errore nuovo, anche uguale.
    if (parts.errorStatus.parentNode !== parts.main) parts.main.append(parts.errorStatus);
    if (this.#error !== undefined && view.message && this.#errorSeq !== this.#announcedSeq) {
      this.#announcedSeq = this.#errorSeq;
      announce(parts.errorStatus, i18n.t(view.message.key, view.message.params), true);
    }
    // Messaggio e pulsanti si montano e si smontano come in React: nodi assenti, non nascosti.
    const wanted: HTMLElement[] = [
      ...(view.message ? [parts.message] : []),
      ...view.buttons.map((b) => ({ pick: parts.pick, resume: parts.resume, 'pick-other': parts.other, 'pick-file': parts.file, recover: parts.recover })[b]),
    ];
    for (const node of [parts.message, parts.pick, parts.resume, parts.other, parts.file, parts.recover]) if (!wanted.includes(node)) node.remove();
    let anchor: Element = parts.tagline;
    for (const node of wanted) {
      if (anchor.nextElementSibling !== node) anchor.after(node);
      anchor = node;
    }
    // I recenti dopo le azioni: solo se ce ne sono (senza File System Access API non ce ne sono mai).
    setText(parts.recentTitle, i18n.t('open.recent'));
    reconcileList(
      parts.recentList,
      this.#recents,
      (recent) => recent.key,
      (recent) => el('li', null, el('button', { class: 'recentItem', on: { click: () => this.#openRecent(recent.key) } }, icon(recent.kind === 'folder' ? 'folder' : 'file', { size: 16 }), el('span'))),
      (li, recent) => {
        const button = li.firstElementChild as HTMLButtonElement;
        setText(button.lastElementChild!, recent.name);
        toggleAttr(button, 'aria-label', true, i18n.t(recentLabel(recent.kind), { name: recent.name }));
      },
    );
    if (this.#recents.length > 0 && anchor.nextElementSibling !== parts.recentSection) anchor.after(parts.recentSection);
    if (this.#recents.length === 0) parts.recentSection.remove();
    toggleAttr(parts.main, 'data-busy', this.#busy, '');
    if (!this.#busy) this.#note = false;
    // La nota è l'ultimo figlio del pannello, fuori dal flusso: entra vuota e il testo arriva dopo `ANNOUNCE_DELAY_MS`.
    if (this.#note) {
      announce(parts.note, i18n.t('folder.opening'), this.#announceAgain || !parts.note.isConnected);
      if (parts.note.parentNode !== parts.panel || parts.panel.lastElementChild !== parts.note) parts.panel.append(parts.note);
    } else {
      announce(parts.note, '');
      parts.note.remove();
    }
    this.#announceAgain = false;
  }
}

/** Sezione dei recenti: titolo e lista collegati per nome (la lista si annuncia come «Recenti»). */
function recentSection(): { recentSection: HTMLElement; recentTitle: HTMLHeadingElement; recentList: HTMLUListElement } {
  const id = uid('start-recent');
  const recentTitle = el('h2', { class: 'recentTitle', id });
  const recentList = el('ul', { class: 'recentList', 'aria-labelledby': id });
  return { recentSection: el('section', { class: 'recents', 'aria-labelledby': id }, recentTitle, recentList), recentTitle, recentList };
}

declare global {
  interface HTMLElementTagNameMap {
    'hmd-start-screen': HmdStartScreen;
  }
}
