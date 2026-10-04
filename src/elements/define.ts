import { HmdThemeSwitcher } from './theme-switcher/theme-switcher.element';

/**
 * Unico punto con `customElements.define` (spec WC §8.3). `main.tsx` lo importa prima del primo render:
 * React 19 assegna come proprietà solo ciò che esiste già sull'istanza (spec §5.1, R9). Con l'HMR di Vite il
 * modulo può rieseguire: un nome già definito si salta (R8).
 */
type Definitions = readonly (readonly [string, CustomElementConstructor])[];

const ELEMENTS: Definitions = [['hmd-theme-switcher', HmdThemeSwitcher]];

export function defineElements(elements: Definitions): void {
  for (const [name, ctor] of elements) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }
}

defineElements(ELEMENTS);
