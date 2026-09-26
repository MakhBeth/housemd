import MarkdownIt from 'markdown-it';

import { parseWikiInner, resolveWikiLink, type WikiTarget } from '../wikilinks/wikilinks';

export interface RenderContext {
  /** File renderizzato, per risolvere i wikilink. */
  currentPath: string;
  /** Tutti i file .md della cartella. */
  files: string[];
  /** Righe del file prima del corpo (frontmatter), da sommare alle righe sorgente. */
  lineOffset: number;
}

export const LINE_CLASS_PREFIX = 'hmd-l-';
export const WIKI_HREF_PREFIX = '#wiki=';

const md = new MarkdownIt({ html: true, linkify: true });

md.inline.ruler.before('link', 'wikilink', (state, silent) => {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x5b || state.src.charCodeAt(start + 1) !== 0x5b) return false;
  const end = state.src.indexOf(']]', start + 2);
  if (end === -1) return false;
  const inner = state.src.slice(start + 2, end);
  if (inner.includes('\n') || inner.includes('[')) return false;
  const parsed = parseWikiInner(inner);
  if (!parsed) return false;
  if (!silent) {
    const token = state.push('wikilink', '', 0);
    token.meta = parsed as unknown as Record<string, unknown>;
  }
  state.pos = end + 2;
  return true;
});

md.renderer.rules.wikilink = (tokens, idx, _options, env) => {
  const ctx = env as unknown as RenderContext;
  const meta = tokens[idx].meta as unknown as WikiTarget;
  const { target, label } = meta;
  const found = resolveWikiLink(target, ctx.currentPath, ctx.files) !== null;
  const cls = found ? 'wikilink' : 'wikilink missing';
  return `<a class="${cls}" href="${WIKI_HREF_PREFIX}${encodeURIComponent(target)}">${md.utils.escapeHtml(label)}</a>`;
};

md.core.ruler.push('source_lines', (state) => {
  const ctx = state.env as unknown as RenderContext;
  const offset = ctx.lineOffset ?? 0;
  for (const token of state.tokens) {
    if (token.map && token.block && token.nesting !== -1 && token.type !== 'inline') {
      token.attrJoin('class', `${LINE_CLASS_PREFIX}${token.map[0] + offset}`);
    }
  }
});

/** HTML (NON sanitizzato) del corpo markdown. Va sempre inserito con `setSafeHTML`. */
export function renderMarkdown(body: string, ctx: RenderContext): string {
  return md.render(body, ctx as unknown as Record<string, unknown>);
}

export function sourceLineOf(el: { className: string }): number | null {
  const m = new RegExp(`(?:^|\\s)${LINE_CLASS_PREFIX}(\\d+)(?:\\s|$)`).exec(el.className);
  return m ? Number(m[1]) : null;
}

export function wikiTargetOfHref(href: string): string | null {
  const i = href.indexOf(WIKI_HREF_PREFIX);
  if (i === -1) return null;
  try {
    return decodeURIComponent(href.slice(i + WIKI_HREF_PREFIX.length));
  } catch {
    return null;
  }
}
