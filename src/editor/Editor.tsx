import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, type ChangeDesc } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { DocTitle } from '../search/searchIndex';
import { initialRestoreSeq, type RestoreCommand } from './restoreCommand';
import { applyDocRestore } from './useDocBinding';
import { docExtensions, editable, mainSelectionRange, readOnlyExtensions } from './docExtensions';
import { docStateConfig, saveDocSession, type DocSession } from './docSession';
import { useT } from '../i18n/I18nProvider';
import styles from './Editor.module.css';

export interface EditorHandle {
  scrollToLine(line: number): void;
  focus(): void;
  getView(): EditorView | null;
  replace(text: string): void;
}

export interface EditorProps {
  text: string;
  session?: DocSession;
  onTransactions?: (changes: ChangeDesc, texts: { before: string; after: string }) => void;
  canChange?: (changes: ChangeDesc) => boolean;
  /** Quando cambia, il contenuto viene sostituito e la cronologia azzerata (altro file, ricarica). */
  resetKey: string;
  getDocs: () => DocTitle[];
  onChange: (textLf: string) => void;
  onImage: (file: File) => Promise<string | null>;
  /** Riga (0-based, frazionaria) in cima alla vista, per lo scroll sincronizzato. */
  onTopLine: (line: number) => void;
  /** Selezione principale cambiata (null se vuota): usata dal chip della selezione del composer AI. */
  onSelection?: (range: { from: number; to: number } | null) => void;
  /** Ripristino dalla cronologia: sostituisce il testo con una transazione, quindi annullabile con Ctrl+Z. */
  restore?: RestoreCommand | null;
  /** Sola lettura (aggiornamento dell'app in corso). */
  readOnly?: boolean;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const t = useT();
  const callbacks = useRef({ ...props, t });
  callbacks.current = { ...props, t };
  const suppressUntil = useRef(0);
  // Ultimo ripristino applicato; quello già presente al montaggio conta come applicato.
  const appliedRestore = useRef(initialRestoreSeq(props.restore));
  // L'EditorView distrutta aveva il focus: la prossima lo riprende. Serve solo a StrictMode (sviluppo), che
  // distrugge e ricrea l'editor appena montato dopo che il genitore gli ha già dato il focus; in produzione
  // la pulizia dell'effetto avviene solo allo smontaggio e il valore non viene più letto.
  const refocus = useRef(false);

  useEffect(() => {
    const view = new EditorView({ parent: hostRef.current! });
    viewRef.current = view;
    if (refocus.current) view.focus();
    refocus.current = false;
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
      if (callbacks.current.session) saveDocSession(callbacks.current.session, view.state);
      refocus.current = view.hasFocus;
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Il testo viene riletto dalle props solo quando cambia resetKey: il resto arriva dall'editor stesso.
  useEffect(() => {
    const session = props.session;
    if (session && session.resetKey !== props.resetKey) { session.resetKey = props.resetKey; session.textLf = props.text; session.history = undefined; session.selection = undefined; }
    const view = viewRef.current;
    if (!view) return;
    view.setState(EditorState.create(session ? docStateConfig(session, docExtensions(callbacks)) : { doc: props.text, extensions: docExtensions(callbacks) }));
    // setState non passa dall'updateListener: la selezione ripristinata dalla sessione va annunciata qui.
    callbacks.current.onSelection?.(mainSelectionRange(view.state));
  }, [props.resetKey]);

  // Non passa da resetKey: la sostituzione deve restare nella cronologia di annullamento. Una volta sola.
  useEffect(() => {
    const view = viewRef.current;
    if (view) appliedRestore.current = applyDocRestore(view, appliedRestore.current, props.restore);
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
      getView() { return viewRef.current; },
      replace(text) { const view = viewRef.current; if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, userEvent: 'input.ai' }); },
      focus() {
        viewRef.current?.focus();
      },
    }),
    [],
  );

  return <div ref={hostRef} className={styles.editor} />;
});
