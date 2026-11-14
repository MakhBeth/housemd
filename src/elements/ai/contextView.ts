import { contextCandidates, rankCandidates, type ContextCandidate } from '../../ai/contextIndex';
import type { AttachedFile } from '../../ai/contextAttach';
import type { Attachment } from '../../ai/contextRefs';
import { pluralKey, type Locale } from '../../i18n/i18n';
import type { Entry } from '../../fs/types';
import type { I18nStore } from '../../state/i18nStore';

/** Quello che il composer usa del workspace per il tag `@`: l'indice dei file, se sta caricando e la lettura per l'invio. */
export interface ContextSource {
  entries: Entry[];
  loading: boolean;
  read(paths: string[]): Promise<AttachedFile[] | { unreadable: string[] }>;
}

export type SuggestionState =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'empty'; message: 'ai.context.noMarkdown' | 'ai.context.noResults'; query: string }
  | { kind: 'items'; items: ContextCandidate[]; total: number };

/** Che cosa mostra l'elenco per una query (`null` = trigger assente: chiuso). */
export function suggestions(source: ContextSource | null, all: ContextCandidate[], query: string | null): SuggestionState {
  if (query === null || !source) return { kind: 'closed' };
  if (source.loading) return { kind: 'loading' };
  if (all.length <= 1 && query === '') return { kind: 'empty', message: 'ai.context.noMarkdown', query };
  const { items, total } = rankCandidates(all, query);
  return items.length === 0 ? { kind: 'empty', message: 'ai.context.noResults', query } : { kind: 'items', items, total };
}

export const candidatesOf = (source: ContextSource | null): ContextCandidate[] => (source ? contextCandidates(source.entries) : []);

/** Nome mostrato per un candidato (la radice non ha nome nel percorso). */
export const candidateName = (c: ContextCandidate, t: I18nStore['t']) => (c.kind === 'root' ? t('ai.context.root') : c.name);
export const candidatePath = (c: ContextCandidate) => (c.kind === 'root' ? '/' : c.kind === 'folder' ? `${c.path}/` : c.path);

/** Testo del chip: il percorso e, per le cartelle, quanti file porta (o «conteggio…» finché l'indice carica). */
export function chipText(a: Attachment, all: ContextCandidate[], loading: boolean, t: I18nStore['t'], locale: Locale): string {
  const path = a.kind === 'root' ? '/' : a.kind === 'folder' ? `${a.path}/` : a.path;
  if (a.kind === 'file') return path;
  const count = all.find((c) => c.path === a.path && c.kind === a.kind)?.mdCount;
  if (count === null || count === undefined) return `${path} · ${loading ? t('ai.context.counting') : ''}`.replace(/ · $/, '');
  return `${path} · ${t(pluralKey(locale, 'ai.context.folderCount', count), { count })}`;
}

/** Voce attiva dopo un movimento: ciclica. */
export const moveActive = (active: number, delta: 1 | -1, length: number) => (length === 0 ? 0 : (active + delta + length) % length);

export const sameAttachments = (a: Attachment[], b: Attachment[]) => a.length === b.length && a.every((x, i) => x.path === b[i]!.path && x.kind === b[i]!.kind);
