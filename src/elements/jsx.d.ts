/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { Ref } from 'react';
import type { ChatMessage, GenParams, ModelProfile } from '../ai/types';
import type { HouseConfig } from '../config/config';
import type { DocSession } from '../editor/docSession';
import type { RestoreCommand } from '../editor/restoreCommand';
import type { UnsupportedReason } from '../fs/access';
import type { DocTitle } from '../search/searchIndex';
import type { UpdateFlow } from '../pwa/updateFlow';
import type { I18nStore } from '../state/i18nStore';
import type { ThemeStore } from '../state/themeStore';
import type { AiChipController } from './ai/aiChips';
import type { SaveImage } from './editor/docElement';
import type { HmdEditor } from './editor/editor.element';
import type { HmdEvents } from './events';
import type { HmdPreview } from './preview/preview.element';
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
      'hmd-ai-chat-log': HmdProps<{ messages: readonly ChatMessage[]; i18n: I18nStore }, 'hmd-ai-open-file' | 'hmd-ai-retry'>;
      'hmd-ai-effort-chip': HmdProps<{ controller: AiChipController; i18n: I18nStore }>;
      'hmd-ai-parameters': HmdProps<{ profile: ModelProfile; value: GenParams; hideEffort: boolean; i18n: I18nStore }, 'hmd-params-change'>;
      'hmd-ai-suggestions': HmdProps<{ controller: AiChipController; i18n: I18nStore }, 'hmd-ai-suggestion'>;
      'hmd-conflict-bar': HmdProps<{ i18n: I18nStore }, 'hmd-conflict'>;
      'hmd-editor': HmdDocProps<'hmd-top-line'> & { ref?: Ref<HmdEditor> };
      'hmd-notice': HmdProps<
        { message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' },
        'hmd-notice-action' | 'hmd-notice-dismiss'
      >;
      'hmd-preview': HmdProps<
        { text: string; path: string; files: string[]; config: HouseConfig; readBlob: (path: string) => Promise<Blob>; highlight: string[]; i18n: I18nStore },
        'hmd-open' | 'hmd-open-wiki' | 'hmd-top-line'
      > & { ref?: Ref<HmdPreview> };
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
