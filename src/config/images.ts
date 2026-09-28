import { dirname, joinPath, normalizePath, relativePath, resolveRelative } from '../lib/paths';
import type { HouseConfig } from './config';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function cleanSrc(src: string): string {
  let s = src.trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1);
  s = s.replace(/[?#].*$/, '');
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Percorso nella cartella dell'immagine referenziata da `src`, oppure null se è esterna. */
export function resolveImageSrc(src: string, fromFile: string, config: HouseConfig): string | null {
  if (EXTERNAL.test(src.trim())) return null;
  const s = cleanSrc(src);
  const prefix = config.images.linkPrefix;
  if (prefix && (s === prefix || s.startsWith(`${prefix}/`))) {
    return joinPath(config.images.saveTo, s.slice(prefix.length));
  }
  if (s.startsWith('/')) return normalizePath(s);
  return resolveRelative(fromFile, s);
}

/** Link da inserire nel markdown per un'immagine salvata in `savedPath`. */
export function imageLink(savedPath: string, fromFile: string, config: HouseConfig): string {
  const { saveTo, linkPrefix } = config.images;
  const link =
    linkPrefix && savedPath.startsWith(`${saveTo}/`)
      ? `${linkPrefix}/${savedPath.slice(saveTo.length + 1)}`
      : relativePath(dirname(fromFile), savedPath);
  return link.replace(/ /g, '%20');
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

const pad = (n: number) => String(n).padStart(2, '0');

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nome del file per un'immagine incollata o trascinata. */
export function imageFileName(original: string | null, mime: string, now: Date): string {
  const fallbackExt = EXT_BY_MIME[mime] ?? 'png';
  // "image.png" è il nome generico che il browser dà alle immagini incollate
  if (original && !/^image\.(png|jpe?g|gif|webp)$/i.test(original)) {
    const dot = original.lastIndexOf('.');
    const stem = slugify(dot > 0 ? original.slice(0, dot) : original);
    const ext = dot > 0 ? original.slice(dot + 1).toLowerCase() : fallbackExt;
    if (stem) return `${stem}.${ext}`;
  }
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `incollata-${stamp}.${fallbackExt}`;
}

/** Primo percorso libero in `dir` per `name`, aggiungendo -1, -2… prima dell'estensione. */
export async function uniquePath(dir: string, name: string, exists: (path: string) => Promise<boolean>): Promise<string> {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = joinPath(dir, name);
  for (let i = 1; await exists(candidate); i++) candidate = joinPath(dir, `${stem}-${i}${ext}`);
  return candidate;
}
