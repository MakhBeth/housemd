/**
 * Barra di formattazione sopra la selezione e scorciatoie (Ctrl+B, Ctrl+I…). La logica è in
 * `formatting.ts`; qui solo il tooltip di CodeMirror e il keymap.
 */
import { Prec, StateEffect, StateField, type EditorState } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap, showTooltip, tooltips, type Tooltip, type TooltipView } from '@codemirror/view';

import { ICONS, type IconName } from '../ui/icons';
import type { MessageKey } from '../i18n/messages';
import { FORMAT_ACTIONS, FORMAT_KEYS, formatTransaction, type FormatAction } from './formatting';

export type Translate = (key: MessageKey) => string;

/** Icona, oppure un segno tradotto (G/C/S in italiano) dove Pixelarticons non ne ha una. */
const LOOK: Record<FormatAction, { icon: IconName } | { glyph: MessageKey | '1.' }> = {
  bold: { glyph: 'format.boldGlyph' },
  italic: { glyph: 'format.italicGlyph' },
  strike: { glyph: 'format.strikeGlyph' },
  code: { icon: 'formatCode' },
  link: { icon: 'formatLink' },
  heading: { icon: 'formatHeading' },
  quote: { icon: 'formatQuote' },
  bullet: { icon: 'formatBullet' },
  ordered: { glyph: '1.' },
  task: { icon: 'formatTask' },
};

function run(view: EditorView, action: FormatAction): boolean {
  const spec = formatTransaction(view.state, action);
  if (spec) view.dispatch({ ...spec, scrollIntoView: true, userEvent: 'input.format' });
  // Anche a vuoto (sola lettura) il tasto resta dell'editor: Ctrl+B non deve aprire la barra laterale.
  return true;
}

/** Focus e trascinamento del mouse: durante la selezione col mouse la barra non insegue il puntatore. */
interface Ui { focused: boolean; pointer: boolean }
const setUi = StateEffect.define<Partial<Ui>>();
const uiField = StateField.define<Ui>({
  create: () => ({ focused: false, pointer: false }),
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setUi)) value = { ...value, ...effect.value };
    return value;
  },
});

const tracker = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {
      document.addEventListener('pointerup', this.up);
      // Lo stato nuovo (altro file) parte senza focus anche se l'editor ce l'ha.
      queueMicrotask(() => { if (view.hasFocus && !view.state.field(uiField).focused) view.dispatch({ effects: setUi.of({ focused: true }) }); });
    }
    up = () => { if (this.view.state.field(uiField).pointer) this.view.dispatch({ effects: setUi.of({ pointer: false }) }); };
    destroy() { document.removeEventListener('pointerup', this.up); }
  },
  {
    eventHandlers: {
      pointerdown(event) { if (event.button === 0) this.view.dispatch({ effects: setUi.of({ pointer: true }) }); },
      focus() { this.view.dispatch({ effects: setUi.of({ focused: true }) }); },
      blur() { this.view.dispatch({ effects: setUi.of({ focused: false, pointer: false }) }); },
    },
  },
);

function toolbarView(view: EditorView, translate: Translate): TooltipView {
  const dom = document.createElement('div');
  dom.className = 'cm-formatToolbar';
  dom.setAttribute('role', 'toolbar');
  dom.setAttribute('aria-label', translate('format.toolbar'));
  // Il clic non toglie il focus all'editor: la selezione resta e Ctrl+Z annulla subito.
  dom.addEventListener('mousedown', (event) => event.preventDefault());
  for (const action of FORMAT_ACTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    const label = translate(`format.${action}` as MessageKey);
    button.className = 'tooltip';
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    const look = LOOK[action];
    const inner = document.createElement('span');
    if ('icon' in look) {
      inner.className = 'icon';
      inner.style.maskImage = `url("${ICONS[look.icon]}")`;
      inner.setAttribute('aria-hidden', 'true');
    } else {
      inner.className = `cm-formatGlyph cm-formatGlyph-${action}`;
      inner.textContent = look.glyph === '1.' ? look.glyph : translate(look.glyph);
      inner.setAttribute('aria-hidden', 'true');
    }
    button.append(inner);
    button.addEventListener('click', () => run(view, action));
    dom.append(button);
  }
  return { dom };
}

const theme = EditorView.theme({
  '.cm-tooltip.cm-formatToolbar': {
    display: 'flex',
    gap: '2px',
    padding: '3px',
    borderRadius: '6px',
    boxShadow: '0 4px 14px color-mix(in srgb, var(--c-text) 18%, transparent)',
  },
  '.cm-formatToolbar button': {
    display: 'grid',
    placeItems: 'center',
    minWidth: '28px',
    height: '28px',
    padding: '0 4px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--c-text)',
    cursor: 'pointer',
    '--icon-size': '18px',
  },
  '.cm-formatToolbar button:hover, .cm-formatToolbar button:focus-visible': {
    backgroundColor: 'color-mix(in srgb, var(--c-accent) 18%, transparent)',
  },
  '.cm-formatGlyph': { fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: '1' },
  '.cm-formatGlyph-bold': { fontWeight: '700' },
  '.cm-formatGlyph-italic': { fontStyle: 'italic' },
  '.cm-formatGlyph-strike': { textDecoration: 'line-through' },
});

/** `translate` si legge a ogni apertura della barra: segue il cambio di lingua. */
export function formatToolbar(translate: () => Translate) {
  const create = (view: EditorView) => toolbarView(view, translate());
  const tooltipFor = (state: EditorState): Tooltip | null => {
    const ui = state.field(uiField);
    const main = state.selection.main;
    if (!ui.focused || ui.pointer || main.empty || state.readOnly) return null;
    return { pos: main.from, above: true, arrow: false, create };
  };
  const toolbarField = StateField.define<Tooltip | null>({
    create: tooltipFor,
    update(value, tr) {
      const same = !tr.docChanged && !tr.selection && tr.startState.readOnly === tr.state.readOnly && !tr.effects.some((e) => e.is(setUi));
      return same ? value : tooltipFor(tr.state);
    },
    provide: (field) => showTooltip.from(field),
  });
  const keys = Prec.high(keymap.of(
    (Object.entries(FORMAT_KEYS) as [FormatAction, string][]).map(([action, key]) => ({ key, run: (view: EditorView) => run(view, action) })),
  ));
  // Lo spazio dei tooltip è l'area dell'editor: sulla prima riga la barra va sotto invece di coprire l'intestazione.
  const space = tooltips({ tooltipSpace: (view) => view.scrollDOM.getBoundingClientRect() });
  return [uiField, tracker, toolbarField, keys, theme, space];
}
