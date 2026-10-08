/**
 * Eventi che gli elementi mandano verso chi li usa (spec WC §5.1): `bubbles: true`, nomi minuscoli con
 * trattino. In React 19 si ascoltano con la prop `on<nome>` (es. `onhmd-toast-dismiss`).
 */
export interface HmdEvents {
  /** Suggerimento scelto sotto il composer: invia il preset. */
  'hmd-ai-suggestion': CustomEvent<{ presetId: string }>;
  /** Conflitto con il disco: l'utente sceglie se ricaricare o sovrascrivere. */
  'hmd-conflict': CustomEvent<{ choice: 'reload' | 'overwrite' }>;
  /** Pulsante d'azione di un avviso (es. "Aggiorna"). */
  'hmd-notice-action': CustomEvent<null>;
  /** Chiusura di un avviso. */
  'hmd-notice-dismiss': CustomEvent<null>;
  /** Schermata iniziale: scegliere una cartella (anche «Apri un'altra cartella»). */
  'hmd-start-pick': CustomEvent<null>;
  /** Schermata iniziale: riprendere l'accesso alla cartella ricordata. */
  'hmd-start-resume': CustomEvent<null>;
  /** Chiusura di un toast (dal pulsante o dal timer dei toast informativi). */
  'hmd-toast-dismiss': CustomEvent<{ key: string }>;
}

export function emit<K extends keyof HmdEvents>(target: Element, type: K, detail: HmdEvents[K] extends CustomEvent<infer D> ? D : never): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

// Così `addEventListener('hmd-…', …)` e la chiave `on` di `el()` conoscono il tipo di `detail`.
declare global {
  interface HTMLElementEventMap extends HmdEvents {}
}
