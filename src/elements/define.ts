import { HmdConflictBar } from './conflict-bar/conflict-bar.element';
import { HmdNotice } from './notice/notice.element';
import { HmdToasts } from './toasts/toasts.element';
import { HmdThemeSwitcher } from './theme-switcher/theme-switcher.element';
import { HmdUpdateNotice } from './update-notice/update-notice.element';

/**
 * Unico punto con `customElements.define` (spec WC §8.3). `main.tsx` lo importa prima del primo render:
 * React 19 assegna come proprietà solo ciò che esiste già sull'istanza (spec §5.1, R9). Con l'HMR di Vite il
 * modulo può rieseguire: un nome già definito si salta (R8).
 */
type Definitions = readonly (readonly [string, CustomElementConstructor])[];

const ELEMENTS: Definitions = [
  ['hmd-conflict-bar', HmdConflictBar],
  ['hmd-notice', HmdNotice],
  ['hmd-theme-switcher', HmdThemeSwitcher],
  ['hmd-toasts', HmdToasts],
  ['hmd-update-notice', HmdUpdateNotice],
];

export function defineElements(elements: Definitions): void {
  for (const [name, ctor] of elements) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }
}

defineElements(ELEMENTS);
