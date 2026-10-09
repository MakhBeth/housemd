import { basicSetup } from 'codemirror';
import { Compartment, EditorState, type ChangeDesc } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import type { TextRange } from '../ai/selectionChip';
import type { DocTitle } from '../search/searchIndex';
import { imageFiles, insertImageLinks } from './images';
import { wikiCompletionSource } from './wikiCompletion';
import { saveDocSession, type DocSession } from './docSession';
import { formatToolbar, type Translate } from './formatToolbar';

/**
 * Ciò che le estensioni del documento chiedono a chi ospita l'editor (hmd-editor, lato documento di
 * hmd-ai-diff-pane). Ogni valore si legge al momento dell'uso, mai copiato: l'ospite cambia sotto
 * (altro file, sola lettura, lingua) senza ricreare le estensioni.
 */
export interface DocHost {
  /** Chiave del documento mostrato: un'immagine salvata dopo un cambio di documento non si inserisce. */
  resetKey(): string;
  readOnly(): boolean;
  /** Sessione in cui salvare testo, selezione e cronologia a ogni aggiornamento (null = nessuna). */
  session(): DocSession | null;
  t(): Translate;
  getDocs(): DocTitle[];
  /** Salva un'immagine incollata o trascinata; restituisce il link relativo, null se non salvata. */
  saveImage(file: File): Promise<string | null>;
  /** Il testo è cambiato: prima e dopo, con le modifiche (per la proposta AI e per il salvataggio). */
  docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void;
  /** Selezione principale cambiata (null se vuota): chip della selezione del composer AI. */
  selectionChanged(range: TextRange | null): void;
}

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--c-surface)', color: 'var(--c-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', fontSize: '14px' },
  // Larghezza del testo dalle impostazioni (src/lib/textWidth.ts), più il padding delle righe; centrato.
  '.cm-content': { padding: '20px 0 40vh', caretColor: 'var(--c-text)', maxWidth: 'calc(var(--editor-text-width, 100%) + 48px)', margin: '0 auto' },
  '.cm-line': { padding: '0 24px' },
  '.cm-gutters': { backgroundColor: 'var(--c-surface)', color: 'var(--c-muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--c-accent-soft) 35%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--c-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--c-accent) 25%, transparent) !important',
  },
  '.cm-tooltip': { backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)' },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.heading1, fontSize: '1.25em' },
  { tag: tags.heading2, fontSize: '1.12em' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--c-accent)' },
  { tag: tags.monospace, color: 'var(--c-accent)' },
  { tag: tags.quote, color: 'var(--c-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--c-muted)' },
]);

export const editable = new Compartment();
export const readOnlyExtensions = (readOnly: boolean) => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];

/**
 * Vita di una vista con il suo stato: `alive` torna false quando la vista viene distrutta (distacco
 * dell'elemento) o il suo stato sostituito (`setState`, che reinizializza i plugin).
 */
const lifecycle = ViewPlugin.define(() => ({
  alive: true,
  destroy() {
    this.alive = false;
  },
}));

/** Chiave di una vista che non c'è più: diversa da qualsiasi resetKey. */
const GONE = '\u0000gone';

function insertImages(view: EditorView, files: File[], pos: number, host: DocHost): void {
  // insertImageLinks legge la chiave subito (al momento dell'incolla/trascinamento) e dopo ogni
  // salvataggio la riconfronta: se l'editor è passato a un altro documento, o questa vista è stata
  // distrutta (anche se l'elemento è tornato con lo stesso resetKey), non salva altro e non la tocca.
  const life = view.plugin(lifecycle);
  void insertImageLinks(files, pos, (file) => host.saveImage(file), {
    key: () => (life?.alive ? host.resetKey() : GONE),
    length: () => view.state.doc.length,
    insert(at, insert) {
      view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
    },
  });
}

/** Selezione principale come tratto, null se vuota (chip della selezione del composer AI). */
export function mainSelectionRange(state: EditorState): { from: number; to: number } | null {
  const main = state.selection.main;
  return main.empty ? null : { from: main.from, to: main.to };
}

/** Aspetto del documento (markdown, colori, carattere, a capo): condiviso con il lato AI del diff. */
export function docAppearance() {
  return [markdown(), syntaxHighlighting(highlight), EditorView.lineWrapping, theme];
}

export function docExtensions(host: DocHost) {
  return [
      basicSetup,
      lifecycle,
      docAppearance(),
      editable.of(readOnlyExtensions(host.readOnly())),
      autocompletion({ override: [wikiCompletionSource(() => host.getDocs())] }),
      formatToolbar(() => host.t()),
      EditorView.updateListener.of((update) => {
        // La sessione si salva prima di emettere: un listener sincrono può cambiare documento (anche staccare
        // e ricollegare l'elemento), e da lì host.session() sarebbe la sessione del documento nuovo.
        const session = host.session();
        if (session) saveDocSession(session, update.state);
        const life = update.view.plugin(lifecycle);
        if (update.docChanged) host.docChanged(update.changes, { before: update.startState.doc.toString(), after: update.state.doc.toString() });
        // Un update superato (vista distrutta, stato sostituito o già più avanti) non annuncia la sua selezione.
        const current = life?.alive && update.view.state === update.state;
        if (current && (update.selectionSet || update.docChanged)) host.selectionChanged(mainSelectionRange(update.state));
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = imageFiles(event.clipboardData?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          insertImages(view, files, view.state.selection.main.head, host);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
          insertImages(view, files, pos, host);
          return true;
        },
      }),
    ];
}
