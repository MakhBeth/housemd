import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import { imageFiles, insertImageLinks } from './images';
import { wikiCompletionSource } from './wikiCompletion';
import type { MutableRefObject } from 'react';
import type { EditorProps } from './Editor';
import { saveDocSession } from './docSession';


export type Callbacks = MutableRefObject<EditorProps>;

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--c-surface)', color: 'var(--c-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', fontSize: '14px' },
  '.cm-content': { padding: '20px 0 40vh', caretColor: 'var(--c-text)' },
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

function insertImages(view: EditorView, files: File[], pos: number, callbacks: Callbacks): void {
  // insertImageLinks legge il resetKey subito (al momento dell'incolla/trascinamento) e dopo ogni
  // salvataggio lo riconfronta: se l'editor è passato a un altro documento, non lo tocca.
  void insertImageLinks(files, pos, (file) => callbacks.current.onImage(file), {
    key: () => callbacks.current.resetKey,
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

export function docExtensions(callbacks: Callbacks) {
  return [
      basicSetup,
      EditorState.transactionFilter.of(tr => !tr.docChanged || tr.isUserEvent('input.restore') || callbacks.current.canChange?.(tr.changes) !== false ? tr : []),
      markdown(),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      theme,
      editable.of(readOnlyExtensions(callbacks.current.readOnly ?? false)),
      autocompletion({ override: [wikiCompletionSource(() => callbacks.current.getDocs())] }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const after = update.state.doc.toString();
          callbacks.current.onTransactions?.(update.changes, { before: update.startState.doc.toString(), after });
          callbacks.current.onChange(after);
        }
        if (update.selectionSet || update.docChanged) callbacks.current.onSelection?.(mainSelectionRange(update.state));
        if (callbacks.current.session) saveDocSession(callbacks.current.session, update.state);
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = imageFiles(event.clipboardData?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          insertImages(view, files, view.state.selection.main.head, callbacks);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
          insertImages(view, files, pos, callbacks);
          return true;
        },
      }),
    ];
}
