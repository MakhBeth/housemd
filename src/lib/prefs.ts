import { LAST_FILE, PREFS, type PrefKey, type PrefValue } from '../state/prefs.schema';

/** Preferenze per questo browser (modalità, larghezza sidebar…). Mai dati importanti. */
const PREFIX = 'housemd:';

/** Valore grezzo salvato, oppure undefined se manca, è illeggibile o lo storage non c'è. */
function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Preferenza validata con il suo schema; il default se manca o non è valida. */
export function readPref<K extends PrefKey>(key: K): PrefValue<K> {
  const { schema, fallback } = PREFS[key];
  const parsed = schema.safeParse(readRaw(key));
  return (parsed.success ? parsed.data : fallback) as PrefValue<K>;
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage non disponibile (finestra privata, dati bloccati): si continua senza
  }
}

/** Legge una preferenza passando il valore grezzo (undefined se manca) a un validatore che dà il default. */
export function readValidPref<T>(key: string, parse: (raw: unknown) => T): T {
  return parse(readRaw(key));
}

export function readLastFile(workspaceId: string): string | null {
  const parsed = LAST_FILE.safeParse(readRaw(`lastFile:${workspaceId}`));
  return parsed.success ? parsed.data : null;
}

export function writeLastFile(workspaceId: string, path: string): void {
  writePref(`lastFile:${workspaceId}`, path);
}
