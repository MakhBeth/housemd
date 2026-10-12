import type { MessageKey } from '../../i18n/messages';

/** Perché «Salva chiave» non può partire: il campo della chiave è vuoto (regola «mai disabled»). */
export function saveSecretBlocker(secret: string): MessageKey | null {
  return secret === '' ? 'ai.saveSecret.needKey' : null;
}

/** Perché «Sincronizza ora» non può partire: una sync è già in corso (decisione 17: non se ne accoda un'altra). */
export function syncNowBlocker(status: string): MessageKey | null {
  return status === 'syncing' ? 'ai.syncNow.running' : null;
}
