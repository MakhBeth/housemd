/**
 * Tipi JSX dei tag `hmd-*` usati da React durante la convivenza (fasi 4–7). File temporaneo: sparisce con
 * React nella fase 7 (spec WC §5.1).
 */
import type { Key } from 'react';
import type { UnsupportedReason } from '../fs/access';
import type { UpdateFlow } from '../pwa/updateFlow';
import type { I18nStore } from '../state/i18nStore';
import type { RouteStore } from '../state/routeStore';
import type { ThemeStore } from '../state/themeStore';
import type { Workspace } from '../workspace/workspace';
import type { HmdEvents } from './events';
import type { StartMode } from './start-screen/startView';

/** Proprietà dell'elemento (tutte facoltative per JSX) più gli eventi che manda, come prop `on<nome>`. */
export type HmdProps<P, E extends keyof HmdEvents = never> = Partial<P> & {
  [K in E as `on${K}`]?: (event: HmdEvents[K]) => void;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hmd-notice': HmdProps<
        { message: string; actionLabel: string; busy: boolean; dismissLabel: string; dismissible: boolean; placement: 'top' | 'bottom' },
        'hmd-notice-action' | 'hmd-notice-dismiss'
      >;
      'hmd-start-screen': HmdProps<
        { mode: StartMode; reason: UnsupportedReason; error: string; folderName: string; busy: boolean; i18n: I18nStore },
        'hmd-start-pick' | 'hmd-start-resume'
      >;
      'hmd-update-notice': HmdProps<{ flow: UpdateFlow; i18n: I18nStore }>;
      'hmd-workspace': HmdProps<
        {
          workspace: Workspace;
          workspaceId: string;
          handle: FileSystemDirectoryHandle;
          switchingFolder: boolean;
          i18n: I18nStore;
          theme: ThemeStore;
          route: RouteStore;
        },
        'hmd-workspace-change-folder'
      > & { key?: Key };
    }
  }
}
