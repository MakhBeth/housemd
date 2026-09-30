import { openDb, request, transactionDone } from '../lib/db';
import { emptyData, storesFromAccess, type AiStores, type StoreData, type StoreAccess } from './stores';
const names = ['aiProfiles', 'aiPresets', 'aiSecrets', 'aiSyncMeta'];
export async function createIdbAiStores(options: { now?: () => number; dbName?: string } = {}): Promise<AiStores> {
  const db = await openDb(options.dbName);
  const access: StoreAccess = async change => {
    const tx = db.transaction(names, 'readwrite');
    const done = transactionDone(tx);
    try {
      const [profiles, presets, secrets, keys, values] = await Promise.all([
        request(tx.objectStore('aiProfiles').getAll()), request(tx.objectStore('aiPresets').getAll()), request(tx.objectStore('aiSecrets').getAll()),
        request(tx.objectStore('aiSyncMeta').getAllKeys()), request(tx.objectStore('aiSyncMeta').getAll()),
      ]);
      const meta = Object.fromEntries(keys.map((key, i) => [String(key), values[i]]));
      const data: StoreData = { ...emptyData(String(meta.writerId ?? crypto.randomUUID())), profiles, presets, secrets, meta: { ...meta, writerId: meta.writerId ?? crypto.randomUUID() }, tombstones: meta.tombstones ?? [], epoch: meta.localEpoch ?? null };
      const result = change(data);
      for (const [name, rows] of [['aiProfiles', data.profiles], ['aiPresets', data.presets], ['aiSecrets', data.secrets]] as const) {
        tx.objectStore(name).clear(); for (const row of rows) tx.objectStore(name).put(row);
      }
      Object.assign(data.meta, { tombstones: data.tombstones, localEpoch: data.epoch });
      for (const [key, value] of Object.entries(data.meta)) tx.objectStore('aiSyncMeta').put(value, key);
      await done; return result;
    } catch (error) { try { tx.abort(); } catch { /* Transazione già conclusa. */ } await done.catch(() => {}); throw error; }
  };
  return storesFromAccess(access, options.now);
}
