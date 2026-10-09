import type { Subscribable } from '../dom/element';

/**
 * Avvolge uno store e conta le iscrizioni attive: dopo il distacco di un elemento devono essere zero.
 * Copia le proprietà proprie dello store: va bene per gli store fatti di closure (i18nStore), non per le classi.
 */
export function countListeners<S extends Subscribable>(store: S): { store: S; listeners: () => number } {
  let active = 0;
  const wrapped = {
    ...store,
    subscribe(listener: () => void): () => void {
      active++;
      const off = store.subscribe(listener);
      return () => {
        active--;
        off();
      };
    },
  };
  return { store: wrapped, listeners: () => active };
}
