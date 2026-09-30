import MarkdownIt from 'markdown-it';
const md = new MarkdownIt({ html: false });
export interface Alignment { pairs: Array<[number, number]>; proportional: boolean; linesA: number; linesB: number; }
export function align(a: string, b: string): Alignment {
  const blocks = (text: string) => md.parse(text, {}).filter(t => t.level === 0 && t.map && t.nesting !== -1);
  const aa = blocks(a), bb = blocks(b), ratio = aa.length / Math.max(1, bb.length);
  let pairs: Array<[number, number]> = [];
  if (ratio >= .8 && ratio <= 1.25) pairs = aa.slice(0, bb.length).map((t,i) => [t.map![0], bb[i].map![0]]);
  else { const ah = aa.filter(t => t.type === 'heading_open'), bh = bb.filter(t => t.type === 'heading_open'); pairs = ah.flatMap((t,i) => bh[i]?.tag === t.tag ? [[t.map![0], bh[i].map![0]] as [number,number]] : []); }
  return { pairs, proportional: pairs.length < 3, linesA: a.split('\n').length, linesB: b.split('\n').length };
}
export function alignedLine(line: number, alignment: Alignment, reverse = false): number {
  const { linesA, linesB } = alignment;
  if (alignment.proportional) return line * (reverse ? linesA / linesB : linesB / linesA);
  const pairs = [[0,0], ...alignment.pairs, [linesA, linesB]].map(([a,b]) => reverse ? [b,a] : [a,b]);
  for (let i=1;i<pairs.length;i++) if (line <= pairs[i][0]) { const [x,y]=pairs[i-1], [xx,yy]=pairs[i]; return y+(line-x)*(yy-y)/Math.max(1,xx-x); }
  return reverse ? linesA : linesB;
}
