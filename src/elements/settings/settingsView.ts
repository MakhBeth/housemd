import type { MessageKey } from '../../i18n/messages';
import type { SettingsSection } from '../../lib/route';
import { clampTextWidth, type TextWidth, type TextWidthPane } from '../../lib/textWidth';
import { clampDelay, type AutosaveSettings } from '../../workspace/autosave';

/** Etichetta di ogni sezione: voce dell'indice e titolo `h2`. */
export const SECTION_LABELS: Record<SettingsSection, MessageKey> = {
  general: 'settings.general',
  'ai-profiles': 'settings.aiProfiles',
  'ai-presets': 'settings.aiPresets',
  'ai-sync': 'settings.aiSync',
};

/** Sezioni mostrate: quelle AI solo con il controller pronto (come SettingsView.tsx). */
export function settingsSections(hasAi: boolean): SettingsSection[] {
  return hasAi ? ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] : ['general'];
}

/** Id del `section` di una sezione, bersaglio dello scorrimento e dell'IntersectionObserver. */
export const sectionId = (section: SettingsSection) => `settings-${section}`;

/** Sezione di un id `settings-…` (l'inverso di `sectionId`), o null. */
export function sectionOf(id: string, sections: readonly SettingsSection[]): SettingsSection | null {
  const section = id.replace(/^settings-/, '');
  return (sections as readonly string[]).includes(section) ? (section as SettingsSection) : null;
}

/**
 * Sezione da segnare nell'indice mentre si scorre: in fondo allo scorrimento l'ultima (le ultime sezioni sono
 * corte e non arrivano mai in cima), altrimenti l'ultima il cui inizio sta nel 40 % alto del contenitore, o la
 * prima. `top` è misurato dal bordo alto del contenitore che scorre. Null senza sezioni.
 */
export function currentSection(
  tops: readonly { section: SettingsSection; top: number }[],
  view: { scrollTop: number; clientHeight: number; scrollHeight: number },
): SettingsSection | null {
  if (tops.length === 0) return null;
  if (view.scrollTop + view.clientHeight >= view.scrollHeight - 1) return tops[tops.length - 1].section;
  const band = view.clientHeight * 0.4;
  return tops.filter((t) => t.top <= band).at(-1)?.section ?? tops[0].section;
}

/** Testo del campo di una larghezza: vuoto = nessun limite. */
export const widthText = (width: TextWidth, pane: TextWidthPane) => String(width[pane] ?? '');

/**
 * Conferma dei due campi delle larghezze insieme (chiudendo con un campo ancora a fuoco la modifica non va
 * persa): i testi riscritti nei limiti e il valore nuovo, o `next: null` se non cambia nulla.
 */
export function commitWidths(texts: Record<TextWidthPane, string>, current: TextWidth): { texts: Record<TextWidthPane, string>; next: TextWidth | null } {
  const next: TextWidth = { editor: clampTextWidth(texts.editor), preview: clampTextWidth(texts.preview) };
  const changed = next.editor !== current.editor || next.preview !== current.preview;
  return { texts: { editor: widthText(next, 'editor'), preview: widthText(next, 'preview') }, next: changed ? next : null };
}

/** Conferma del ritardo dell'autosalvataggio: il testo nei limiti e le impostazioni nuove, o `next: null`. */
export function commitDelay(text: string, autosave: AutosaveSettings): { text: string; next: AutosaveSettings | null } {
  const delayMs = clampDelay(Number(text));
  return { text: String(delayMs), next: delayMs === autosave.delayMs ? null : { ...autosave, delayMs } };
}
