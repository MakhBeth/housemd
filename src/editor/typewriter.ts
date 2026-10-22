import { Compartment, EditorState, type Extension, type Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Cosa è successo nella transazione, per decidere se la riga del cursore va ricentrata. */
export interface CenterInput {
  selection: boolean;
  docChanged: boolean;
  /** Clic o trascinamento col mouse (`select.pointer`): la vista non salta mai sotto il puntatore. */
  pointer: boolean;
}

/** Digitazione, tastiera, annulla/ripeti, formattazione e ricerca sì; il mouse no (si ricentra al tasto dopo). */
export function shouldCenter({ selection, docChanged, pointer }: CenterInput): boolean {
  return (selection || docChanged) && !pointer;
}

export function centerInput(tr: Transaction): CenterInput {
  return { selection: tr.selection !== undefined, docChanged: tr.docChanged, pointer: tr.isUserEvent('select.pointer') };
}

/** Centra `head` della selezione principale; nessuna animazione (lo scorrimento di CodeMirror è istantaneo). */
export function centerEffect(state: EditorState) {
  return EditorView.scrollIntoView(state.selection.main.head, { y: 'center' });
}

/** Nella stessa transazione, così la barra di formattazione si misura una volta sola dopo lo scroll. */
const centerOnInput = EditorState.transactionExtender.of((tr) =>
  shouldCenter(centerInput(tr)) ? { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: 'center' }) } : null,
);

/** Il riempimento sopra e sotto entra da una classe sul root: a modalità spenta il DOM non cambia. */
const typewriterTheme = EditorView.theme({
  '&.cm-typewriter': { containerType: 'size' },
  // 12px ≈ metà riga (14px × 1.65 / 2): la prima e l'ultima riga possono stare al centro.
  '&.cm-typewriter .cm-content': { paddingBlock: 'calc(50cqb - 12px)' },
});

/** Rilegge a caldo il typewriter; come il focus, entra in `docExtensions` ma la riconfigura solo l'editor principale. */
export const typewriterCompartment = new Compartment();

export function typewriterExtensions(enabled: boolean): Extension {
  return enabled ? [centerOnInput, typewriterTheme, EditorView.editorAttributes.of({ class: 'cm-typewriter' })] : [];
}
