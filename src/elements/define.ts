import { HmdAiChatLog } from './ai/chat-log.element';
import { HmdAiComposer } from './ai/composer.element';
import { HmdAiDiffPane } from './ai/diff-pane.element';
import { HmdAiEffortChip } from './ai/effort-chip.element';
import { HmdAiModelChip } from './ai/model-chip.element';
import { HmdAiModelSelect } from './ai/model-select.element';
import { HmdAiParameters } from './ai/parameters.element';
import { HmdAiSidebar } from './ai/sidebar.element';
import { HmdAiSuggestions } from './ai/suggestions.element';
import { HmdConflictBar } from './conflict-bar/conflict-bar.element';
import { HmdEditor } from './editor/editor.element';
import { HmdFileTree } from './file-tree/file-tree.element';
import { HmdHistoryPanel } from './history-panel/history-panel.element';
import { HmdNotice } from './notice/notice.element';
import { HmdFrontmatterCard } from './preview/frontmatter-card.element';
import { HmdPreview } from './preview/preview.element';
import { HmdSearchPanel } from './search-panel/search-panel.element';
import { HmdStartScreen } from './start-screen/start-screen.element';
import { HmdToasts } from './toasts/toasts.element';
import { HmdThemeSwitcher } from './theme-switcher/theme-switcher.element';
import { HmdUpdateNotice } from './update-notice/update-notice.element';

/**
 * Unico punto con `customElements.define` (spec WC §8.3). `main.tsx` lo importa prima del primo render:
 * React 19 assegna come proprietà solo ciò che esiste già sull'istanza (spec §5.1, R9). Con l'HMR di Vite il
 * modulo può rieseguire: un nome già definito si salta (R8).
 */
type Definitions = readonly (readonly [string, CustomElementConstructor])[];

const ELEMENTS: Definitions = [
  ['hmd-ai-chat-log', HmdAiChatLog],
  ['hmd-ai-composer', HmdAiComposer],
  ['hmd-ai-diff-pane', HmdAiDiffPane],
  ['hmd-ai-effort-chip', HmdAiEffortChip],
  ['hmd-ai-model-chip', HmdAiModelChip],
  ['hmd-ai-model-select', HmdAiModelSelect],
  ['hmd-ai-parameters', HmdAiParameters],
  ['hmd-ai-sidebar', HmdAiSidebar],
  ['hmd-ai-suggestions', HmdAiSuggestions],
  ['hmd-conflict-bar', HmdConflictBar],
  ['hmd-editor', HmdEditor],
  ['hmd-file-tree', HmdFileTree],
  ['hmd-frontmatter-card', HmdFrontmatterCard],
  ['hmd-history-panel', HmdHistoryPanel],
  ['hmd-notice', HmdNotice],
  ['hmd-preview', HmdPreview],
  ['hmd-search-panel', HmdSearchPanel],
  ['hmd-start-screen', HmdStartScreen],
  ['hmd-theme-switcher', HmdThemeSwitcher],
  ['hmd-toasts', HmdToasts],
  ['hmd-update-notice', HmdUpdateNotice],
];

export function defineElements(elements: Definitions): void {
  for (const [name, ctor] of elements) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }
}

defineElements(ELEMENTS);
