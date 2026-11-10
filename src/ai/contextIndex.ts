import type { Entry } from '../fs/types';

export type ContextKind = 'file' | 'folder' | 'root';
/** `mdCount`: file `.md` sotto la cartella (ricorsivo); `null` per i file. */
export interface ContextCandidate { path: string; kind: ContextKind; name: string; mdCount: number | null }

const norm = (s: string) => s.normalize('NFC').toLowerCase();
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const under = (path: string, folder: string) => folder === '' || path.startsWith(`${folder}/`);

/** Radice, cartelle e file `.md` della cartella aperta (gli asset non sono contesto). */
export function contextCandidates(entries: Entry[]): ContextCandidate[] {
  const files = entries.filter((e) => e.kind === 'file').map((e) => e.path);
  const count = (folder: string) => files.filter((p) => under(p, folder)).length;
  const out: ContextCandidate[] = [{ path: '', kind: 'root', name: '', mdCount: files.length }];
  for (const e of entries) {
    if (e.kind === 'directory') out.push({ path: e.path, kind: 'folder', name: baseName(e.path), mdCount: count(e.path) });
    else if (e.kind === 'file') out.push({ path: e.path, kind: 'file', name: baseName(e.path), mdCount: null });
  }
  return out.sort((a, b) => (a.kind === 'root' ? -1 : b.kind === 'root' ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** File `.md` sotto `folder` (`''` = radice), ricorsivo e ordinato. */
export function filesUnder(entries: Entry[], folder: string): string[] {
  return entries.filter((e) => e.kind === 'file' && under(e.path, folder)).map((e) => e.path).sort();
}

const isSubsequence = (needle: string, hay: string) => {
  let i = 0;
  for (const c of hay) if (c === needle[i] && ++i === needle.length) return true;
  return needle.length === 0;
};

/** Gradino di corrispondenza (0 = migliore), `null` = nessuna. */
function rank(c: ContextCandidate, q: string): number | null {
  const path = norm(c.path);
  const name = norm(c.name);
  if (name === q || path === q) return 0;
  if (name.startsWith(q)) return 1;
  if (path.split('/').some((seg) => seg.startsWith(q))) return 2;
  if (path.includes(q)) return 3;
  if (isSubsequence(q, path)) return 4;
  return null;
}

/** Ranking della decisione 2 del piano: esatto > prefisso del nome > prefisso di un segmento > sottostringa > sottosequenza; poi percorso più corto, poi alfabetico. */
export function rankCandidates(all: ContextCandidate[], query: string, limit = 50): { items: ContextCandidate[]; total: number } {
  const q = norm(query).replace(/^\//, '');
  if (q === '') return { items: all.slice(0, limit), total: all.length };
  const scored: { c: ContextCandidate; r: number }[] = [];
  for (const c of all) {
    if (c.kind === 'root') continue;
    const r = rank(c, q);
    if (r !== null) scored.push({ c, r });
  }
  scored.sort((a, b) => a.r - b.r || a.c.path.length - b.c.path.length || (a.c.path < b.c.path ? -1 : a.c.path > b.c.path ? 1 : 0));
  return { items: scored.slice(0, limit).map((s) => s.c), total: scored.length };
}
