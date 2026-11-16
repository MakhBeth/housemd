/**
 * Cartelle e file aperti di recente, per il menu «Apri» e la schermata iniziale. Solo con la File System Access
 * API: una voce tiene l'handle (salvato in IndexedDB) e il permesso si richiede al clic. L'handle resta opaco:
 * qui non si chiama nessun metodo della File System Access API, il confronto arriva da fuori (`same`).
 */
import * as z from 'zod/mini';

import { DB_NAME, openDb, request, transactionDone } from '../lib/db';

export type RecentKind = 'folder' | 'file';

export interface Recent<H = FileSystemHandle> {
  kind: RecentKind;
  name: string;
  handle: H;
  /** Solo per le cartelle: l'identità con cui riaprirle (bozze e ultimo file restano loro). */
  workspaceId?: string;
  openedAt: number;
}

export const MAX_RECENTS = 8;

const KEY = 'recent';

const RECORD = z.looseObject({
  kind: z.enum(['folder', 'file']),
  name: z.string(),
  handle: z.custom<object>((value) => typeof value === 'object' && value !== null),
  workspaceId: z.optional(z.string()),
  openedAt: z.number(),
});

/** Lista letta da IndexedDB: le voci illeggibili si scartano. */
export function parseRecents<H>(value: unknown): Recent<H>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = RECORD.safeParse(entry);
    return parsed.success ? [parsed.data as unknown as Recent<H>] : [];
  });
}

/**
 * La voce nuova va in cima; una voce dello stesso tipo per lo stesso elemento (`same`) sparisce; al massimo
 * `MAX_RECENTS` voci. Una cartella riaperta tiene il suo `workspaceId` se la voce nuova non ne porta uno.
 */
export async function pushRecent<H>(list: readonly Recent<H>[], entry: Recent<H>, same: (a: H, b: H) => Promise<boolean>): Promise<Recent<H>[]> {
  const rest: Recent<H>[] = [];
  let previous: Recent<H> | null = null;
  for (const item of list) {
    if (item.kind === entry.kind && (await same(item.handle, entry.handle).catch(() => false))) previous ??= item;
    else rest.push(item);
  }
  const merged = { ...entry, workspaceId: entry.workspaceId ?? previous?.workspaceId };
  if (merged.workspaceId === undefined) delete merged.workspaceId;
  return [merged, ...rest].slice(0, MAX_RECENTS);
}

/** Chiave stabile di una voce per il DOM (tipo, nome e momento dell'apertura). */
export function recentKey(recent: Pick<Recent<unknown>, 'kind' | 'name' | 'openedAt'>): string {
  return `${recent.kind}:${recent.openedAt}:${recent.name}`;
}

export async function loadRecents<H = FileSystemHandle>(dbName = DB_NAME): Promise<Recent<H>[]> {
  const db = await openDb(dbName);
  const value = await request(db.transaction('workspace', 'readonly').objectStore('workspace').get(KEY));
  db.close();
  return parseRecents<H>(value);
}

/** Aggiunge in cima e salva; restituisce la lista nuova. `same` riconosce lo stesso elemento (nel browser `isSameEntry`). */
export async function addRecent<H>(entry: Recent<H>, same: (a: H, b: H) => Promise<boolean>, dbName = DB_NAME): Promise<Recent<H>[]> {
  const list = await pushRecent(await loadRecents<H>(dbName), entry, same);
  const db = await openDb(dbName);
  const tx = db.transaction('workspace', 'readwrite');
  tx.objectStore('workspace').put(list, KEY);
  await transactionDone(tx);
  db.close();
  return list;
}
