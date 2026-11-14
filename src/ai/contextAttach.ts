import type { Entry } from '../fs/types';
import type { Attachment } from './contextRefs';
import { filesUnder } from './contextIndex';

export interface AttachedFile { path: string; text: string }
export interface ResolvedFiles {
  /** File unici e ordinati, cartelle espanse. */
  paths: string[];
  /** Per ogni file incluso da una cartella, la cartella (`''` = radice) che lo porta; un tag diretto del file non compare. */
  via: Map<string, string>;
}

const escapeAttr = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Espande le cartelle con `filesUnder` e deduplica le sovrapposizioni; i file taggati direttamente non hanno `via`. */
export function resolveAttachments(entries: Entry[], attachments: Attachment[]): ResolvedFiles {
  const direct = new Set<string>();
  const via = new Map<string, string>();
  for (const a of attachments) {
    if (a.kind === 'file') { direct.add(a.path); continue; }
    for (const p of filesUnder(entries, a.path)) if (!via.has(p)) via.set(p, a.path);
  }
  for (const p of direct) via.delete(p);
  return { paths: [...new Set([...direct, ...via.keys()])].sort(), via };
}

/** Blocco delimitato per il prompt: percorso escapato, `</file>` nel testo neutralizzata. Il documento aperto non si ripete (è già in `<document>`). */
export function attachedBlock(files: AttachedFile[], openPath?: string): string {
  const body = files.filter((f) => f.path !== openPath);
  if (body.length === 0) return '';
  const parts = body.map((f) => `<file path="${escapeAttr(f.path)}">\n${f.text.replaceAll('</file>', '&lt;/file>')}\n</file>`);
  return `<attached-context>\n${parts.join('\n')}\n</attached-context>`;
}
