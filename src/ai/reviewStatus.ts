import type { Proposal } from './types';

/** Stato mostrato dalla barra di revisione (puro): compare solo quando c'è qualcosa da dire. */
export type ReviewStatus =
  | { kind: 'none' }
  | { kind: 'generating'; seconds: number; done?: number; total?: number }
  | { kind: 'partial' }
  | { kind: 'truncated' }
  | { kind: 'scopeLost' }
  | { kind: 'applied' };

interface Input {
  /** Documento corrente: il run può esistere prima che arrivi la prima proposta. */
  path: string;
  proposal: Proposal | undefined;
  running: { path: string } | null;
  elapsedSeconds: number;
  /** Calcolato da ReviewView: il testo applicabile coincide con il documento. */
  applied: boolean;
}

export function reviewStatus({ path, proposal, running, elapsedSeconds, applied }: Input): ReviewStatus {
  const mine = running?.path === path;
  if (!proposal) return mine ? { kind: 'generating', seconds: elapsedSeconds } : { kind: 'none' };
  if (mine || proposal.status === 'streaming') {
    const seconds = mine ? elapsedSeconds : 0;
    return proposal.progress ? { kind: 'generating', seconds, ...proposal.progress } : { kind: 'generating', seconds };
  }
  if (proposal.scope?.status === 'lost') return { kind: 'scopeLost' };
  if (proposal.status === 'partial') return { kind: 'partial' };
  if (proposal.status === 'truncated') return { kind: 'truncated' };
  return applied ? { kind: 'applied' } : { kind: 'none' };
}

export function isBusy(status: ReviewStatus): boolean {
  return status.kind === 'generating';
}
