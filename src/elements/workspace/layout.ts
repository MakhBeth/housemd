import type { MessageKey } from '../../i18n/messages';
import type { IconName } from '../../ui/icons';

/** Vista del workspace: tre viste del documento più la revisione AI. */
export type Mode = 'editor' | 'split' | 'preview' | 'ai';
export type PaneMode = Exclude<Mode, 'ai'>;

export const MODES: ReadonlyArray<{ id: Mode; label: MessageKey; icon: IconName }> = [
  { id: 'editor', label: 'mode.editor', icon: 'modeEditor' },
  { id: 'split', label: 'mode.split', icon: 'modeSplit' },
  { id: 'preview', label: 'mode.preview', icon: 'modePreview' },
  { id: 'ai', label: 'mode.ai', icon: 'modeAi' },
];

/** Ctrl+\ scorre solo le viste del documento, non la revisione AI. */
export const PANE_MODES = MODES.filter((m): m is (typeof MODES)[number] & { id: PaneMode } => m.id !== 'ai');

/** Pannello a sinistra: l'albero dei file o, in modalità AI, la chat. Hanno larghezze separate. */
export type SidePanel = 'sidebar' | 'ai';

export const WIDTH_LIMITS: Record<SidePanel, { min: number; max: number; initial: number }> = {
  sidebar: { min: 180, max: 480, initial: 280 },
  ai: { min: 300, max: 640, initial: 380 },
};

/** Passo del ridimensionamento con le frecce sul separatore. */
export const RESIZE_STEP = 16;

export function sidePanel(mode: Mode): SidePanel {
  return mode === 'ai' ? 'ai' : 'sidebar';
}

/** Larghezza nei limiti del pannello. Come oggi, solo quella dell'albero dei file si arrotonda al pixel. */
export function clampWidth(panel: SidePanel, width: number): number {
  const { min, max } = WIDTH_LIMITS[panel];
  return Math.min(max, Math.max(min, panel === 'sidebar' ? Math.round(width) : width));
}

/** Nuova larghezza dopo una freccia sinistra/destra, oppure null per gli altri tasti. */
export function resizeByKey(panel: SidePanel, width: number, key: string): number | null {
  if (key === 'ArrowLeft') return clampWidth(panel, width - RESIZE_STEP);
  if (key === 'ArrowRight') return clampWidth(panel, width + RESIZE_STEP);
  return null;
}

/** Vista successiva nel ciclo di Ctrl+\ (dalla modalità AI si riparte dall'editor). */
export function nextPaneMode(mode: Mode): PaneMode {
  const index = PANE_MODES.findIndex((m) => m.id === mode);
  return PANE_MODES[(index + 1) % PANE_MODES.length].id;
}

/** `grid-template-columns` del layout: pannello, separatore di 5px, area principale. */
export function gridColumns(sidebarOpen: boolean, width: number): string {
  return sidebarOpen ? `${width}px 5px minmax(0, 1fr)` : 'minmax(0, 1fr)';
}

/** Disposizione dei pannelli: con la cronologia aperta la vista editor ne mostra due, come split. */
export function panesMode(mode: Mode, historyOpen: boolean): Mode {
  return historyOpen && mode === 'editor' ? 'split' : mode;
}
