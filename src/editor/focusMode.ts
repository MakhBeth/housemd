import { syntaxTree } from '@codemirror/language';
import { Compartment, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { dimSpans, focusSpans, type FocusUnit } from './focusRange';

export interface FocusConfig {
  enabled: boolean;
  unit: FocusUnit;
  /** Lingua dell'interfaccia: serve a `Intl.Segmenter` per le frasi. */
  locale: string;
}

const dim = Decoration.mark({ class: 'cm-focusDim' });

/** Grigio fuori dall'unità del cursore: solo classi sul testo visibile, il documento non si tocca mai. */
function focusPlugin(unit: FocusUnit, locale: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        // Il grigio dipende da selezione, testo, viewport e albero (il parser lavora a pezzi): altro non lo cambia.
        if (update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const lit = focusSpans(view.state, unit, locale);
        const visible = view.visibleRanges.map(({ from, to }) => ({ from, to }));
        return Decoration.set(dimSpans(lit, visible).map(({ from, to }) => dim.range(from, to)));
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** Rilegge a caldo la modalità focus; entra in `docExtensions` ma la riconfigura solo l'editor principale. */
export const focusCompartment = new Compartment();

export function focusExtensions(config: FocusConfig): Extension {
  return config.enabled ? focusPlugin(config.unit, config.locale) : [];
}

/** Senza `!important`: il prefisso del tema dà specificità (0,2,0), più alta delle classi di HighlightStyle. */
export const focusTheme = EditorView.theme({
  '& .cm-focusDim, & .cm-focusDim *': { color: 'var(--c-muted)' },
});
