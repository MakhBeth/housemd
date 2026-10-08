/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { GenParams, ModelProfile } from '../ai/types';
import type { UnsupportedReason } from '../fs/access';
import type { UpdateFlow } from '../pwa/updateFlow';
import type { I18nStore } from '../state/i18nStore';
import type { ThemeStore } from '../state/themeStore';
import type { AiChipController } from './ai/aiChips';
import type { HmdEvents } from './events';
import type { StartMode } from './start-screen/startView';
import type { ToastItem } from './toasts/toasts.element';

/** Proprietà dell'elemento (tutte facoltative per JSX) più gli eventi che manda, come prop `on<nome>`. */
export type HmdProps<P, E extends keyof HmdEvents = never> = Partial<P> & {
  [K in E as `on${K}`]?: (event: HmdEvents[K]) => void;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hmd-ai-effort-chip': HmdProps<{ controller: AiChipController; i18n: I18nStore }>;
      'hmd-ai-parameters': HmdProps<{ profile: ModelProfile; value: GenParams; hideEffort: boolean; i18n: I18nStore }, 'hmd-params-change'>;
      'hmd-ai-suggestions': HmdProps<{ controller: AiChipController; i18n: I18nStore }, 'hmd-ai-suggestion'>;
      'hmd-conflict-bar': HmdProps<{ i18n: I18nStore }, 'hmd-conflict'>;
      'hmd-notice': HmdProps<
        { message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' },
        'hmd-notice-action' | 'hmd-notice-dismiss'
      >;
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
