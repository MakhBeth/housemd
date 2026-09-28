import { createUpdateFlow, type UpdateFlow, type UpdateHost } from './updateFlow';

/** Il sottoinsieme delle opzioni di `registerSW` (virtual:pwa-register) che usiamo. */
export interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onNeedReload?: () => void;
  onRegisterError?: (error: unknown) => void;
}

export type RegisterSW = (options: RegisterOptions) => (reloadPage?: boolean) => Promise<void>;

/**
 * Collega vite-plugin-pwa al flusso protetto. `onNeedReload` va passato SEMPRE: senza, il plugin
 * ricarica la pagina da solo all'evento `controlling`, saltando settle() e perdendo il testo.
 */
export function registerUpdates(registerSW: RegisterSW, host: UpdateHost): UpdateFlow {
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  const flow = createUpdateFlow(host, async () => {
    if (updateSW) await updateSW();
  });
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => flow.needRefresh(),
    onNeedReload: () => void flow.needReload(),
    onRegisterError: (error) => console.error('Service worker non registrato', error),
  });
  return flow;
}
