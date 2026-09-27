import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import type { DocTitle } from '../search/searchIndex';
import { imageFiles, insertImageLinks } from './images';
import { initialRestoreSeq, pendingRestore, type RestoreCommand } from './restoreCommand';
import { wikiCompletionSource } from './wikiCompletion';
import styles from './Editor.module.css';

export interface EditorHandle {
  scrollToLine(line: number): void;
  focus(): void;
}

export interface EditorProps {
  text: string;
  /** Quando cambia, il contenuto viene sostituito e la cronologia azzerata (altro file, ricarica). */
  resetKey: string;
  getDocs: () => DocTitle[];
  onChange: (textLf: string) => void;
  onImage: (file: File) => Promise<string | null>;
  /** Riga (0-based, frazionaria) in cima alla vista, per lo scroll sincronizzato. */
  onTopLine: (line: number) => void;
  /** Ripristino dalla cronologia: sostituisce il testo con una transazione, quindi annullabile con Ctrl+Z. */
  restore?: RestoreCommand | null;
  /** Sola lettura (aggiornamento dell'app in corso). */
  readOnly?: boolean;
}

type Callbacks = MutableRefObject<EditorProps>;

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

const editable = new Compartment();
const readOnlyExtensions = (readOnly: boolean) => [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];

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

function createState(text: string, callbacks: Callbacks): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      basicSetup,
      markdown(),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      theme,
      editable.of(readOnlyExtensions(callbacks.current.readOnly ?? false)),
      autocompletion({ override: [wikiCompletionSource(() => callbacks.current.getDocs())] }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
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
    ],
  });
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const suppressUntil = useRef(0);
  // Ultimo ripristino applicato; quello già presente al montaggio conta come applicato.
  const appliedRestore = useRef(initialRestoreSeq(props.restore));

  useEffect(() => {
    const view = new EditorView({ parent: hostRef.current! });
    viewRef.current = view;
    const onScroll = () => {
      if (performance.now() < suppressUntil.current) return;
      const height = view.scrollDOM.scrollTop;
      const block = view.lineBlockAtHeight(height);
      const line = view.state.doc.lineAt(block.from).number - 1;
      const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0;
      callbacks.current.onTopLine(line + fraction);
    };
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Il testo viene riletto dalle props solo quando cambia resetKey: il resto arriva dall'editor stesso.
  useEffect(() => {
    viewRef.current?.setState(createState(props.text, callbacks));
  }, [props.resetKey]);

  // Non passa da resetKey: la sostituzione deve restare nella cronologia di annullamento. Una volta sola.
  useEffect(() => {
    const view = viewRef.current;
    const restore = pendingRestore(appliedRestore.current, props.restore);
    if (!view || !restore) return;
    appliedRestore.current = restore.seq;
    if (view.state.doc.toString() === restore.textLf) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: restore.textLf }, userEvent: 'input.restore' });
  }, [props.restore?.seq]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editable.reconfigure(readOnlyExtensions(props.readOnly ?? false)) });
  }, [props.readOnly]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line: number) {
        const view = viewRef.current;
        if (!view) return;
        const number = Math.min(Math.max(Math.floor(line) + 1, 1), view.state.doc.lines);
        const block = view.lineBlockAt(view.state.doc.line(number).from);
        suppressUntil.current = performance.now() + 150;
        view.scrollDOM.scrollTop = block.top + (line - Math.floor(line)) * block.height;
      },
      focus() {
        viewRef.current?.focus();
      },
    }),
    [],
  );

  return <div ref={hostRef} className={styles.editor} />;
});
