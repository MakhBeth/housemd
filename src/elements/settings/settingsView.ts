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
 * Sezione da segnare nell'indice: la più in alto tra quelle che si intersecano (come il callback
 * dell'IntersectionObserver di SettingsView.tsx). Null = nessuna, l'indice resta com'è.
 */
export function topSection(entries: readonly { id: string; top: number; intersecting: boolean }[], sections: readonly SettingsSection[]): SettingsSection | null {
  const top = entries.filter((e) => e.intersecting).sort((a, b) => a.top - b.top)[0];
  return top ? sectionOf(top.id, sections) : null;
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
