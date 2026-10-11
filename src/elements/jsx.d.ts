/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { Key, Ref } from 'react';
import type { TextRange } from '../ai/selectionChip';
import type { GenParams, ModelProfile, SelectionScope } from '../ai/types';
import type { HouseConfig } from '../config/config';
import type { DocSession } from '../editor/docSession';
import type { RestoreCommand } from '../editor/restoreCommand';
import type { UnsupportedReason } from '../fs/access';
import type { DocTitle } from '../search/searchIndex';
import type { UpdateFlow } from '../pwa/updateFlow';
import type { I18nStore } from '../state/i18nStore';
import type { ThemeStore } from '../state/themeStore';
import type { TreeNode } from '../ui/tree';
import type { ModelSelectController } from './ai/modelSelectView';
import type { ReviewController, ReviewDoc } from './ai/reviewView';
import type { SidebarController } from './ai/sidebar.element';
import type { SaveImage } from './editor/docElement';
import type { HmdEditor } from './editor/editor.element';
import type { HmdEvents } from './events';
import type { HistorySource } from './history-panel/history-panel.element';
import type { HmdPreview } from './preview/preview.element';
import type { HmdSearchPanel, SearchSource } from './search-panel/search-panel.element';
import type { StartMode } from './start-screen/startView';
import type { ToastItem } from './toasts/toasts.element';

/** Proprietà dell'elemento (tutte facoltative per JSX) più gli eventi che manda, come prop `on<nome>`. */
export type HmdProps<P, E extends keyof HmdEvents = never> = Partial<P> & {
  [K in E as `on${K}`]?: (event: HmdEvents[K]) => void;
};

/** Il documento aperto, comune a hmd-editor e hmd-ai-diff-pane (HmdDocElement), più gli eventi propri `E`. */
export type HmdDocProps<E extends keyof HmdEvents = never> = HmdProps<
  {
    text: string; resetKey: string; session: DocSession; restore: RestoreCommand | null; readOnly: boolean;
    getDocs: () => DocTitle[]; saveImage: SaveImage; i18n: I18nStore;
  },
  'hmd-doc-change' | 'hmd-selection' | E
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hmd-ai-model-select': HmdProps<{ controller: ModelSelectController; profile: ModelProfile; i18n: I18nStore }, 'hmd-ai-model-change'>;
      'hmd-ai-parameters': HmdProps<{ profile: ModelProfile; value: GenParams; hideEffort: boolean; i18n: I18nStore }, 'hmd-params-change'>;
      'hmd-ai-review': HmdProps<{ controller: ReviewController; doc: ReviewDoc; i18n: I18nStore }>;
      'hmd-ai-sidebar': HmdProps<
        {
          controller: SidebarController;
          text: string;
          selection: TextRange | null;
          getSelection: () => SelectionScope | undefined;
          syncNeedsPermission: boolean;
          i18n: I18nStore;
        },
        'hmd-ai-manage' | 'hmd-ai-sync-reactivate'
      >;
      'hmd-conflict-bar': HmdProps<{ i18n: I18nStore }, 'hmd-conflict'>;
      'hmd-editor': HmdDocProps<'hmd-top-line'> & { ref?: Ref<HmdEditor> };
      'hmd-file-tree': HmdProps<
        { nodes: readonly TreeNode[]; openPath: string | null; drafts: ReadonlySet<string>; i18n: I18nStore },
        'hmd-open' | 'hmd-tree-action'
      >;
      'hmd-history-panel': HmdProps<
        { workspace: HistorySource; path: string; currentText: string; i18n: I18nStore },
        'hmd-history-close' | 'hmd-history-restore'
      > & { key?: Key };
      'hmd-notice': HmdProps<
        { message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' },
        'hmd-notice-action' | 'hmd-notice-dismiss'
      >;
      'hmd-preview': HmdProps<
        { text: string; path: string; files: string[]; config: HouseConfig; readBlob: (path: string) => Promise<Blob>; highlight: string[]; i18n: I18nStore },
        'hmd-open' | 'hmd-open-wiki' | 'hmd-top-line'
      > & { ref?: Ref<HmdPreview> };
      'hmd-search-panel': HmdProps<{ index: SearchSource; indexRevision: number; i18n: I18nStore }, 'hmd-search-open'> & {
        ref?: Ref<HmdSearchPanel>;
      };
      'hmd-start-screen': HmdProps<
        { mode: StartMode; reason: UnsupportedReason; error: string; folderName: string; busy: boolean; i18n: I18nStore },
        'hmd-start-pick' | 'hmd-start-resume'
      >;
      'hmd-theme-switcher': HmdProps<{ store: ThemeStore; i18n: I18nStore }>;
      'hmd-toasts': HmdProps<{ items: readonly ToastItem[]; i18n: I18nStore }, 'hmd-toast-dismiss'>;
      'hmd-update-notice': HmdProps<{ flow: UpdateFlow; i18n: I18nStore }>;
    }
  }
}
