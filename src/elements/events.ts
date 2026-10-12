import type { ChangeDesc } from '@codemirror/state';

import type { TextRange } from '../ai/selectionChip';
import type { CheckWarning, GenParams, ModelProfile } from '../ai/types';
import type { SettingsSection } from '../lib/route';
import type { TextWidth } from '../lib/textWidth';
import type { TreeNode } from '../ui/tree';
import type { AutosaveSettings } from '../workspace/autosave';
import type { ReviewAction } from './ai/reviewBarView';
import type { TreeAction } from './workspace/dialogFor';

/**
 * Eventi che gli elementi mandano verso chi li usa (spec WC §5.1): `bubbles: true`, nomi minuscoli con
 * trattino. In React 19 si ascoltano con la prop `on<nome>` (es. `onhmd-toast-dismiss`).
 */
export interface HmdEvents {
  /** Diff della revisione AI: rifiutato l'ultimo blocco rimasto (equivale a scartare la proposta). */
  'hmd-ai-all-rejected': CustomEvent<null>;
  /** Composer AI: il testo scritto nella casella è cambiato (anche svuotata dopo l'invio), per conservarlo fuori. */
  'hmd-ai-draft': CustomEvent<{ text: string }>;
  /** Chip del modello: aprire le impostazioni dei profili («Gestisci profili…», o il chip senza profili). */
  'hmd-ai-manage': CustomEvent<null>;
  /** Selettore del modello: modello scelto dall'elenco o scritto in «Altro…», con il suo contesto se noto. */
  'hmd-ai-model-change': CustomEvent<{ selection: Pick<ModelProfile, 'model' | 'contextTokens'> }>;
  /** Chat AI: aprire il documento di un messaggio. */
  'hmd-ai-open-file': CustomEvent<{ path: string }>;
  /** Diff della revisione AI: proposta modificata a mano (anche da un rifiuto), testo intero del lato destro. */
  'hmd-ai-proposal-edit': CustomEvent<{ text: string }>;
  /** Chat AI: ripetere un messaggio fallito (`removeRejected`: senza i parametri che il provider ha rifiutato). */
  'hmd-ai-retry': CustomEvent<{ id: string; removeRejected: boolean }>;
  /** Barra della revisione AI: un pulsante attivato (frecce, Accetta tutto, Scarta, Continua). */
  'hmd-ai-review-action': CustomEvent<{ action: ReviewAction }>;
  /** Barra della revisione AI: un avviso scelto nel popover (portare in vista la riga). */
  'hmd-ai-review-warning': CustomEvent<{ warning: CheckWarning }>;
  /** Suggerimento scelto sotto il composer: invia il preset. */
  'hmd-ai-suggestion': CustomEvent<{ presetId: string }>;
  /** Sidebar AI: la cartella di sync ha perso il permesso, aprire le impostazioni della sync per riattivarlo. */
  'hmd-ai-sync-reactivate': CustomEvent<null>;
  /** Conflitto con il disco: l'utente sceglie se ricaricare o sovrascrivere. */
  'hmd-conflict': CustomEvent<{ choice: 'reload' | 'overwrite' }>;
  /** Editor e lato documento del diff: testo cambiato (`changes` e `before` per la proposta AI, `after` da salvare). */
  'hmd-doc-change': CustomEvent<{ changes: ChangeDesc; before: string; after: string }>;
  /** Cronologia: chiudere il pannello. */
  'hmd-history-close': CustomEvent<null>;
  /** Cronologia: ripristinare la versione `id` (il workspace la applica come transazione dell'editor, annullabile). */
  'hmd-history-restore': CustomEvent<{ id: number }>;
  /** Parametri di generazione modificati (popover del modello, impostazioni di profili e preset). */
  'hmd-params-change': CustomEvent<{ params: GenParams }>;
  /** Pulsante d'azione di un avviso (es. "Aggiorna"). */
  'hmd-notice-action': CustomEvent<null>;
  /** Chiusura di un avviso. */
  'hmd-notice-dismiss': CustomEvent<null>;
  /** Anteprima (link relativo nel testo) e albero dei file (clic su un file): aprire un file markdown. */
  'hmd-open': CustomEvent<{ path: string }>;
  /** Anteprima: seguire un wikilink (crea la nota se manca). */
  'hmd-open-wiki': CustomEvent<{ target: string }>;
  /**
   * Riga sorgente (0-based, frazionaria) in cima al pannello, per lo scroll sincronizzato (anteprima ed
   * editor). Va ascoltato sull'elemento che lo manda, mai su un antenato comune: risale da entrambi.
   */
  'hmd-top-line': CustomEvent<{ line: number }>;
  /** Editor e lato documento del diff: selezione principale cambiata (null se vuota), per il chip del composer AI. */
  'hmd-selection': CustomEvent<{ range: TextRange | null }>;
  /** Ricerca: aprire un risultato (clic o Invio sul primo), con i termini da evidenziare nell'anteprima. */
  'hmd-search-open': CustomEvent<{ path: string; terms: string[] }>;
  /** Impostazioni: il ritardo o la modalità dell'autosalvataggio confermati (da salvare e applicare). */
  'hmd-settings-autosave': CustomEvent<{ autosave: AutosaveSettings }>;
  /** Impostazioni: chiuse (con la conferma, se c'erano modifiche aperte). */
  'hmd-settings-close': CustomEvent<null>;
  /** Sezione di profili o preset: la bozza aperta è diventata (o non è più) da salvare. */
  'hmd-settings-dirty': CustomEvent<{ dirty: boolean }>;
  /** Impostazioni: «Salva tutto». */
  'hmd-settings-save-all': CustomEvent<null>;
  /** Impostazioni: voce dell'indice scelta (la rotta passa a quella sezione). */
  'hmd-settings-section': CustomEvent<{ section: SettingsSection }>;
  /** Impostazioni: larghezze del testo confermate (da salvare e applicare). */
  'hmd-settings-text-width': CustomEvent<{ textWidth: TextWidth }>;
  /** Schermata iniziale: scegliere una cartella (anche «Apri un'altra cartella»). */
  'hmd-start-pick': CustomEvent<null>;
  /** Schermata iniziale: riprendere l'accesso alla cartella ricordata. */
  'hmd-start-resume': CustomEvent<null>;
  /** Albero dei file: voce del menu ⋯ scelta (`node`: la riga del menu; null solo prima di aprirlo). */
  'hmd-tree-action': CustomEvent<{ action: TreeAction; node: TreeNode | null }>;
  /** Chiusura di un toast (dal pulsante o dal timer dei toast informativi). */
  'hmd-toast-dismiss': CustomEvent<{ key: string }>;
  /** Workspace: cambiare cartella (pulsante con il nome della cartella nella sidebar). */
  'hmd-workspace-change-folder': CustomEvent<null>;
}

export function emit<K extends keyof HmdEvents>(target: Element, type: K, detail: HmdEvents[K] extends CustomEvent<infer D> ? D : never): void {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

// Così `addEventListener('hmd-…', …)` e la chiave `on` di `el()` conoscono il tipo di `detail`.
declare global {
  interface HTMLElementEventMap extends HmdEvents {}
}
