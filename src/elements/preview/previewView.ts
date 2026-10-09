import type { HouseConfig } from '../../config/config';
import { resolveImageSrc } from '../../config/images';
import { isMarkdown, normalizePath, resolveRelative } from '../../lib/paths';
import { toCard, type Frontmatter, type FrontmatterCardData, type SplitDocument } from '../../preview/frontmatter';
import { wikiTargetOfHref } from '../../preview/render';

/** Pausa tra l'ultima modifica del testo e il render dell'anteprima (era PREVIEW_DEBOUNCE_MS di Preview.tsx). */
export const PREVIEW_DEBOUNCE_MS = 150;
/** Dopo uno scroll comandato dall'altro pannello, per questo tempo lo scroll non torna indietro (niente rimbalzi). */
export const SCROLL_SUPPRESS_MS = 150;

/** Risolve la sorgente di un'immagine in un URL da mostrare (blob della cartella o remoto), null se manca. */
export type ResolveImage = (src: string) => Promise<string | null>;

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Link con schema (`https:`, `mailto:`…) o `//host`: lo apre il browser, in una scheda nuova. */
export function isExternalHref(href: string): boolean {
  return EXTERNAL.test(href);
}

export type LinkAction = { kind: 'native' } | { kind: 'wiki'; target: string } | { kind: 'open'; path: string } | { kind: 'block' };

/** Cosa fa un clic su un link dell'anteprima (era onClick di Preview.tsx). `block` = niente, ma senza navigare. */
export function linkAction(href: string, docPath: string): LinkAction {
  const wiki = wikiTargetOfHref(href);
  if (wiki !== null) return { kind: 'wiki', target: wiki };
  if (href.startsWith('#') || isExternalHref(href)) return { kind: 'native' };
  let clean = href.replace(/[?#].*$/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // lascia il link così com'è
  }
  const target = clean.startsWith('/') ? normalizePath(clean) : resolveRelative(docPath, clean);
  return isMarkdown(target) ? { kind: 'open', path: target } : { kind: 'block' };
}

/** Documento mostrato dall'anteprima: cambia subito con il file, con il debounce con il testo. */
export interface PreviewDoc {
  path: string;
  split: SplitDocument;
}

/** Quando rifare il documento mostrato (era l'effetto [text, path] di Preview.tsx). */
export function docUpdate(doc: Pick<PreviewDoc, 'path'> | null, path: string, textChanged: boolean): 'now' | 'debounce' | 'keep' {
  if (!doc || doc.path !== path) return 'now';
  return textChanged ? 'debounce' : 'keep';
}

export type CardView = { kind: 'none' } | { kind: 'error'; detail: string } | { kind: 'card'; card: FrontmatterCardData };

/** Cosa mostra la scheda del frontmatter (era il ramo iniziale di FrontmatterCard.tsx). */
export function cardView(frontmatter: Frontmatter | null): CardView {
  if (!frontmatter) return { kind: 'none' };
  if (frontmatter.error) return { kind: 'error', detail: frontmatter.error };
  if (!frontmatter.data) return { kind: 'none' };
  return { kind: 'card', card: toCard(frontmatter.data) };
}

/** Percorso nella cartella dell'immagine della scheda: va tenuto nella cache delle immagini usate. */
export function cardImagePath(split: SplitDocument, docPath: string, config: HouseConfig): string | null {
  const image = split.frontmatter?.data ? toCard(split.frontmatter.data).image : null;
  return image ? resolveImageSrc(image, docPath, config) : null;
}
