import type { ChangeDesc } from '@codemirror/state';

import type { AcceptBlocker, AiController, AiState } from '../../ai/aiController';
import { reviewStatus, type ReviewStatus } from '../../ai/reviewStatus';
import type { TextRange } from '../../ai/selectionChip';
import type { CheckWarning, Proposal } from '../../ai/types';
import type { DocSession } from '../../editor/docSession';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';

/** Il documento aperto come lo riceve la revisione AI (era `reviewDoc.ts` della vista React), per l'editor semplice e per il lato documento del diff. */
export interface ReviewDoc {
  path: string;
  text: string;
  resetKey: string;
  session: DocSession;
  restore: RestoreCommand | null;
  readOnly: boolean;
  getDocs(): DocTitle[];
  saveImage(file: File): Promise<string | null>;
  docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void;
  selectionChanged(range: TextRange | null): void;
}

/** Quello che la vista della revisione usa del controller. */
export type ReviewController = Pick<AiController, 'subscribe' | 'getState' | 'proposalText' | 'acceptBlocker' | 'canAccept' | 'beforeAccept' | 'edited' | 'discard' | 'continue'>;

/** Cosa mostra la vista, calcolato come nel corpo di ReviewView.tsx. */
export interface ReviewModel {
  proposal: Proposal | undefined;
  warnings: CheckWarning[];
  /** Testo della proposta applicato al documento (o il documento stesso senza proposta). */
  text: string;
  applied: boolean;
  status: ReviewStatus;
  /** Proposta in sola lettura nel diff: nessuna proposta, generazione in corso o selezione persa. */
  streaming: boolean;
  range: TextRange | null;
  view: 'plain' | 'diff';
  /** La barra c'è: nel diff sempre, nell'editor semplice solo durante la generazione senza proposta. */
  bar: boolean;
  /** Il suggerimento «Scrivi una richiesta…» sopra l'editor semplice: senza proposta e senza barra (una proposta applicata non lo mostra). */
  hint: boolean;
  acceptBlocker: AcceptBlocker | null;
}

export function reviewModel(
  state: AiState,
  doc: Pick<ReviewDoc, 'path' | 'text'>,
  elapsedSeconds: number,
  controller: Pick<ReviewController, 'proposalText' | 'acceptBlocker'>,
): ReviewModel {
  const proposal = state.proposals.get(doc.path);
  const warnings = [...state.chat.messages].reverse().find((m) => m.role === 'assistant' && m.docPath === doc.path)?.warnings ?? [];
  const text = proposal ? (controller.proposalText(proposal) ?? proposal.text) : doc.text;
  const applied = !!proposal && proposal.status !== 'streaming' && text === doc.text;
  const status = reviewStatus({ path: doc.path, proposal, running: state.running, elapsedSeconds, applied });
  const streaming = !proposal || status.kind === 'generating' || status.kind === 'scopeLost';
  const range = proposal?.scope ? { from: proposal.scope.from, to: proposal.scope.from + proposal.text.length } : null;
  const view: 'plain' | 'diff' = !proposal || (applied && status.kind === 'applied') ? 'plain' : 'diff';
  const bar = view === 'diff' || (!proposal && status.kind === 'generating');
  const hint = !proposal && !bar;
  const acceptBlocker = proposal ? controller.acceptBlocker(proposal, true) : 'generating';
  return { proposal, warnings, text, applied, status, streaming, range, view, bar, hint, acceptBlocker };
}

/** Secondi dall'inizio della generazione (il contatore della barra). */
export function elapsedSeconds(running: AiState['running'], now: number): number {
  return running ? Math.floor((now - running.startedAt) / 1000) : 0;
}

/** La proposta modificata a mano: con una selezione, solo il tratto dentro il documento (come `edit` di ReviewView.tsx). */
export function editedProposal(proposal: Proposal, docText: string, next: string): string {
  if (!proposal.scope) return next;
  const suffix = docText.length - proposal.scope.to;
  return next.slice(proposal.scope.from, suffix ? next.length - suffix : undefined);
}

/** «Accetta tutto» chiede conferma solo se il documento è cambiato dopo la proposta e la proposta è sull'intero documento. */
export function acceptNeedsConfirm(proposal: Proposal, docText: string): boolean {
  return docText !== proposal.baseText && !proposal.scope;
}
