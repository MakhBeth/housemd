/** Preferenze per questo browser (modalità, larghezza sidebar…). Mai dati importanti. */
const PREFIX = 'housemd:';

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage non disponibile (finestra privata, dati bloccati): si continua senza
  }
}
