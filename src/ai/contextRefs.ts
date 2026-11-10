import type { ContextKind } from './contextIndex';

export interface Trigger { from: number; to: number; query: string }
export interface Attachment { path: string; kind: ContextKind }

/** Da `@` al cursore, se `@` è a inizio testo o dopo uno spazio/a capo e la query non contiene spazi (salvo tra virgolette). */
export function triggerAt(text: string, cursor: number): Trigger | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const raw = before.slice(at + 1);
  const quoted = raw.startsWith('"');
  if (quoted ? raw.slice(1).includes('"') || raw.includes('\n') : /\s/.test(raw)) return null;
  return { from: at, to: cursor, query: quoted ? raw.slice(1) : raw };
}

/** `@note/idee.md`, `@progetti/`, `@/`, `@"a b.md"`. */
export function referenceText(path: string, kind: ContextKind): string {
  if (kind === 'root') return '@/';
  const p = kind === 'folder' ? `${path}/` : path;
  return /\s/.test(p) ? `@"${p}"` : `@${p}`;
}

/** Sostituisce `@query` con il riferimento, uno spazio e il cursore dopo lo spazio. */
export function insertReference(text: string, trigger: Trigger, ref: string): { text: string; cursor: number } {
  const rest = text.slice(trigger.to);
  const head = `${text.slice(0, trigger.from)}${ref} `;
  return { text: head + (rest.startsWith(' ') ? rest.slice(1) : rest), cursor: head.length };
}

const REF = /(?<![^\s])@(?:"([^"\n]+)"|(\S+))/g;
const toPath = (raw: string) => (raw === '/' ? '' : raw.replace(/\/$/, ''));

/** Percorsi citati (con e senza virgolette); la radice è `''`, le cartelle senza `/` finale. */
export function referencesIn(text: string): string[] {
  return [...text.matchAll(REF)].map((m) => toPath(m[1] ?? m[2]!));
}

/** Toglie gli allegati senza occorrenze nel testo; non ne aggiunge mai. */
export function reconcile(text: string, attachments: Attachment[]): Attachment[] {
  const cited = new Set(referencesIn(text));
  return attachments.filter((a) => cited.has(a.path));
}

/** Toglie tutte le occorrenze del percorso (e lo spazio doppio che resta); cursore alla prima rimossa. */
export function removeReference(text: string, path: string): { text: string; cursor: number } {
  let cursor = -1;
  const out = text.replace(REF, (whole, quoted: string | undefined, bare: string | undefined, offset: number) => {
    if (toPath(quoted ?? bare!) !== path) return whole;
    if (cursor < 0) cursor = offset;
    return '\0';
  });
  const cleaned = out.replace(/ ?\0 ?/g, (m, off: number) => (m.startsWith(' ') && m.endsWith(' ') && off > 0 ? ' ' : '')).replace(/\0/g, '');
  return { text: cleaned, cursor: cursor < 0 ? text.length : Math.min(cursor, cleaned.length) };
}
