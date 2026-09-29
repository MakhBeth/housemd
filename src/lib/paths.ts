/** Utility per percorsi relativi alla radice della cartella (separatore '/'). */

export function splitPath(path: string): string[] {
  return path.split('/').filter((p) => p.length > 0 && p !== '.');
}

export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of splitPath(path)) {
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter((p) => p.length > 0).join('/'));
}

export function dirname(path: string): string {
  const parts = splitPath(path);
  parts.pop();
  return parts.join('/');
}

export function basename(path: string): string {
  const parts = splitPath(path);
  return parts[parts.length - 1] ?? '';
}

export function stripMd(path: string): string {
  return path.replace(/\.md$/i, '');
}

export function isMarkdown(path: string): boolean {
  return /\.md$/i.test(path);
}

export function isImage(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i.test(path);
}

export function resolveRelative(fromFile: string, rel: string): string {
  return joinPath(dirname(fromFile), rel);
}

export function relativePath(fromDir: string, to: string): string {
  const from = splitPath(fromDir);
  const target = splitPath(to);
  let common = 0;
  while (common < from.length && common < target.length - 1 && from[common] === target[common]) common++;
  const up = from.slice(common).map(() => '..');
  return [...up, ...target.slice(common)].join('/');
}

export type Eol = '\n' | '\r\n';

/** Fine riga del file: CRLF se la prima fine riga è CRLF. */
export function detectEol(text: string): Eol {
  const i = text.indexOf('\n');
  return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}

/** Converte un testo con '\n' (come lo produce CodeMirror) nella fine riga del file. */
export function withEol(textLf: string, eol: Eol): string {
  return eol === '\n' ? textLf : textLf.replace(/\r?\n/g, '\r\n');
}

/** Nuovo percorso dopo aver rinominato `from` in `to`, oppure null se `path` non è coinvolto. */
export function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return null;
}
