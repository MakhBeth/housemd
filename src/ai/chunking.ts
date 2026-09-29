import MarkdownIt from 'markdown-it';
import { splitFrontmatter } from '../preview/frontmatter';
import type { ModelProfile, GenParams } from './types';
const md = new MarkdownIt({ html: false });
export function keepFrontmatter(text: string): { prefix: string; body: string } {
  const { frontmatter, body } = splitFrontmatter(text);
  return frontmatter ? { prefix: text.slice(0, text.length - body.length), body } : { prefix: '', body: text };
}
/** Confini dei token di primo livello: recinti e tabelle restano indivisibili. */
export function splitForModel(text: string, maxChars: number): string[] {
  if (!text) return [''];
  const lines = text.split('\n'), offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
  const boundaries = new Set<number>([0, text.length]);
  for (const token of md.parse(text, {})) if (token.level === 0 && token.map) {
    const start=offsets[token.map[0]], end=Math.min(text.length,offsets[token.map[1]]);
    boundaries.add(Math.min(text.length,start));
    if(token.type==='paragraph_open'&&end-start>maxChars){
      const paragraph=text.slice(start,end);
      for(const match of paragraph.matchAll(/[.!?](?:["'’”)]*)\s+/g))boundaries.add(start+match.index!+match[0].length);
    }
  }
  const points = [...boundaries].sort((a,b) => a-b), chunks: string[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i] - start > maxChars && points[i-1] > start) { chunks.push(text.slice(start, points[i-1])); start = points[i-1]; }
  }
  if (start < text.length) chunks.push(text.slice(start));
  return chunks;
}
export function chunkLimit(profile: ModelProfile, params: GenParams): number {
  if (params.chunkChars) return Math.max(100, params.chunkChars);
  return Math.max(100, Math.min(params.maxOutputTokens ? params.maxOutputTokens * 3 : Infinity, profile.contextTokens ? profile.contextTokens * 2 : Infinity, profile.kind === 'claude-code' ? 40000 : 8000));
}
