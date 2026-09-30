import MarkdownIt from 'markdown-it';
import { splitFrontmatter, toCard } from '../preview/frontmatter';
export interface UntrustedOptions { allowedUrls: ReadonlySet<string>; isLocal?: (src: string) => boolean; imageLabel?: (host: string) => string; }
const parser = new MarkdownIt({ html: false });
export function imageUrls(text: string): Set<string> {
  const { body, frontmatter } = splitFrontmatter(text), urls = new Set<string>();
  for (const token of parser.parse(body, {})) for (const child of token.children || []) if (child.type === 'image') urls.add(String(child.attrGet('src') || ''));
  const image = frontmatter?.data && toCard(frontmatter.data).image;
  if (image) urls.add(image);
  return urls;
}
export function resourceHost(src: string): string { try { return new URL(src).host || 'local'; } catch { return 'local'; } }
export function allowedImage(src: string, options: UntrustedOptions): boolean { return options.allowedUrls.has(src) || !!options.isLocal?.(src); }
/** Non crea mai DOM dal testo del modello: filtra risorse prima dell'HTML. */
export function safeRender(text: string, options?: UntrustedOptions, lineOffset = 0): string {
  const md = new MarkdownIt({ html: false, linkify: true });
  md.renderer.rules.image = (tokens, i) => {
    const token = tokens[i], src = String(token.attrGet('src') || ''), alt = token.content;
    if (options && allowedImage(src, options)) {
      // Anche le immagini locali si risolvono PRIMA di assegnare src: niente richieste HTTP relative.
      return options.isLocal?.(src) ? `<img data-local-src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}">` : `<img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}">`;
    }
    const label = options?.imageLabel?.(resourceHost(src)) || `${alt} (${resourceHost(src)})`;
    return options ? `<button type="button" data-ai-image="${md.utils.escapeHtml(src)}">${md.utils.escapeHtml(label)}</button>` : `<span>${md.utils.escapeHtml(label)}</span>`;
  };
  md.renderer.rules.link_open = (tokens, i, opts, _env, self) => { tokens[i].attrSet('rel', 'noopener noreferrer'); tokens[i].attrSet('target','_blank'); return self.renderToken(tokens,i,opts); };
  md.core.ruler.push('source-lines', state => { for (const token of state.tokens) if (token.map && token.block && token.nesting !== -1 && token.type !== 'inline') token.attrJoin('class', `hmd-l-${token.map[0]+lineOffset}`); });
  return md.render(text);
}
