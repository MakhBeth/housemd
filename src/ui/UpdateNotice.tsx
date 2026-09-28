import { useSyncExternalStore } from 'react';

import { useT } from '../i18n/I18nProvider';
import type { UpdateFlow } from '../pwa/updateFlow';
import { Notice } from './Notice';

/** Toast persistente "nuova versione" con "Aggiorna" (disabilitato mentre si mette al sicuro il documento). */
export function UpdateNotice({ flow }: { flow: UpdateFlow }) {
  const t = useT();
  const state = useSyncExternalStore(flow.subscribe, flow.getState);
  if (!state.available) return null;
  return (
    <Notice
      message={t('toast.newVersion')}
      actionLabel={t('update.apply')}
      onAction={() => void flow.apply()}
      busy={state.busy}
      dismissLabel={t('update.dismiss')}
      onDismiss={state.busy ? undefined : () => flow.dismiss()}
    />
  );
}
