const OPEN = '<housemd-proposal>', CLOSE = '</housemd-proposal>';
export interface ParsedProposal { comment: string; proposal: string | null; inProposal: boolean; }
function withoutPrefix(text: string, tag: string): string {
  for (let i = Math.min(text.length, tag.length - 1); i > 0; i--) if (text.endsWith(tag.slice(0, i))) return text.slice(0, -i);
  return text;
}
export function parseProposal(text: string, transform = false, final = false): ParsedProposal {
  if (transform) {
    let proposal = text;
    if (final) proposal = proposal.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, '$1');
    return { comment: '', proposal, inProposal: !final };
  }
  const start = text.indexOf(OPEN);
  if (start < 0) return { comment: final ? text : withoutPrefix(text, OPEN), proposal: null, inProposal: false };
  const body = text.slice(start + OPEN.length), end = body.indexOf(CLOSE);
  return end < 0 ? { comment: text.slice(0, start), proposal: final ? body : withoutPrefix(body, CLOSE), inProposal: true } : { comment: text.slice(0, start) + body.slice(end + CLOSE.length), proposal: body.slice(0, end), inProposal: false };
}
export class ProposalStream {
  private text = '';
  constructor(private transform = false) {}
  push(chunk: string): ParsedProposal { this.text += chunk; return parseProposal(this.text, this.transform); }
  finish(): ParsedProposal { return parseProposal(this.text, this.transform, true); }
}
