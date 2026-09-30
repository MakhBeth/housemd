import MarkdownIt from 'markdown-it';
import { diffLines } from 'diff';
import { keepFrontmatter } from './chunking';
const md = new MarkdownIt({ html: false });
export interface CheckWarning { code: 'code' | 'wikilinks' | 'urls' | 'frontmatter' | 'length' | 'truncated'; line: number; }
function resources(text: string): { code: string[]; urls: string[]; wiki: string[] } {
  const tokens = md.parse(text, {});
  return { code: tokens.filter(t => t.type === 'fence').map(t => t.content), urls: tokens.flatMap(t => (t.children || []).flatMap(c => c.type === 'image' ? [String(c.attrGet('src') || '')] : c.type === 'link_open' ? [String(c.attrGet('href') || '')] : [])), wiki: [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1]) };
}
export function checkProposal(original: string, proposal: string, preset?: string, truncated = false): CheckWarning[] {
  const a=resources(original), b=resources(proposal), warnings: CheckWarning[] = [], warn=(code:CheckWarning['code'],needle?:string)=>warnings.push({code,line:needle?Math.max(0,original.slice(0,Math.max(0,original.indexOf(needle))).split('\n').length-1):0});
  if (preset === 'traduci' ? a.code.length !== b.code.length : JSON.stringify(a.code) !== JSON.stringify(b.code)) warn('code','```');
  if (a.wiki.some(x=>!b.wiki.includes(x))) warn('wikilinks',a.wiki.find(x=>!b.wiki.includes(x)));
  if (a.urls.some(x=>!b.urls.includes(x))) warn('urls',a.urls.find(x=>!b.urls.includes(x)));
  if (keepFrontmatter(original).prefix !== keepFrontmatter(proposal).prefix) warn('frontmatter');
  const ratio = proposal.length / Math.max(1, original.length);
  if ((preset === 'sbobina' && ratio < .6) || (preset === 'traduci' && (ratio < .6 || ratio > 1.6)) || (preset === 'consecutio' && diffLines(original,proposal).filter(x=>x.removed).reduce((n,x)=>n+(x.count||0),0)/Math.max(1,original.split('\n').length)>.15)) warn('length');
  if (truncated) warn('truncated');
  return warnings;
}
