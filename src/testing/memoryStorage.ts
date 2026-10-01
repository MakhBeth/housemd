/** `localStorage` in memoria per i test in Node; restituisce la mappa per prepararla o leggerla. */
export function installMemoryStorage(): Map<string, string> {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return items;
}
