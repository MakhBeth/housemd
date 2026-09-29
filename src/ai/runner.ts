import type { ChatProvider, ModelProfile, PromptPreset, ChatMessage, GenParams } from './types';
import { AiError } from './errors';
import { buildPrompt, estimateTokens } from './prompt';
import { ProposalStream } from './proposalStream';
import { keepFrontmatter, splitForModel, chunkLimit } from './chunking';
export interface RunInput { path: string; document: string; proposal?: string; request: string; history: ChatMessage[]; profile: ModelProfile; params: GenParams; preset?: PromptPreset; }
export interface RunCursor { chunks: string[]; results: string[]; prefix: string; next: number; }
export type RunEvent = { type: 'progress'; text: string | null; comment: string; done: number; total: number } | { type: 'usage'; inputTokens?: number; outputTokens?: number } | { type: 'done'; text: string | null; comment: string; truncated: boolean } | { type: 'thinking' };
export function createCursor(input: RunInput): RunCursor {
  const source = input.preset ? input.proposal ?? input.document : input.document;
  const { prefix, body } = input.preset?.frontmatter === 'keep' ? keepFrontmatter(source) : { prefix: '', body: source };
  const overhead = buildPrompt({...input,model:input.profile.model,document:'',proposal:input.preset?undefined:input.proposal});
  const budget=input.profile.contextTokens?Math.max(1,input.profile.contextTokens-(input.params.maxOutputTokens||0)-estimateTokens(overhead.system+overhead.messages.map(m=>m.text).join(''))-150):Infinity;
  const limit = Math.min(chunkLimit(input.profile,input.params),Math.max(100,budget*4));
  const chunks = input.preset && (input.preset.strategy === 'chunked' || estimateTokens(body) > budget) ? splitForModel(body,limit) : [body];
  return { chunks, results: [], prefix, next: 0 };
}
export function partialText(cursor: RunCursor): string { return cursor.prefix + cursor.chunks.map((chunk,i)=>cursor.results[i] ?? chunk).join(''); }
export async function* runRequest(input: RunInput, provider: ChatProvider, signal: AbortSignal, cursor: RunCursor): AsyncGenerator<RunEvent> {
  let finalComment = '', finalText: string | null = null;
  let previousInput=0,previousOutput=0;
  for (let i=cursor.next;i<cursor.chunks.length;i++) {
    signal.throwIfAborted();
    const request = buildPrompt({ ...input, model: input.profile.model, document: cursor.chunks[i], proposal: input.preset ? undefined : input.proposal, part: input.preset ? `Part ${i+1} of ${cursor.chunks.length}. Preserve leading/trailing separators.` : undefined, context: cursor.results[i-1]?.slice(-500) });
    if (input.profile.contextTokens && estimateTokens(request.system + request.messages.map(m=>m.text).join('')) + (input.params.maxOutputTokens || 0) > input.profile.contextTokens) throw new AiError('tooLong');
    const parser = new ProposalStream(!!input.preset);
    let truncated = false,partInput=0,partOutput=0;
    for await (const event of provider.stream(request,signal)) {
      signal.throwIfAborted();
      if (event.type === 'thinking') { yield event; continue; }
      if (event.type === 'usage') { if(event.inputTokens!==undefined)partInput=event.inputTokens;if(event.outputTokens!==undefined)partOutput=event.outputTokens;yield {type:'usage',inputTokens:previousInput+partInput,outputTokens:previousOutput+partOutput};continue; }
      if (event.type === 'done') { if (event.stop === 'refusal') throw new AiError('refused'); truncated = event.stop === 'length'; continue; }
      const parsed = parser.push(event.text);
      const text = parsed.proposal === null ? null : input.preset ? cursor.prefix + cursor.results.join('') + parsed.proposal + cursor.chunks.slice(i+1).join('') : parsed.proposal;
      yield { type:'progress', text, comment: parsed.comment, done:i, total:cursor.chunks.length };
    }
    const parsed = parser.finish();
    finalComment = parsed.comment;
    if (parsed.proposal !== null) {
      // Mantiene i separatori tra parti anche se il modello li normalizza.
      let transformed = parsed.proposal;
      if (input.preset && i < cursor.chunks.length-1) { const separator = /\n+$/.exec(cursor.chunks[i])?.[0] || ''; transformed = transformed.replace(/\n+$/, '') + separator; }
      cursor.results[i] = transformed;
      finalText = input.preset ? partialText(cursor) : transformed;
    }
    if (truncated) { yield { type:'done', text: finalText, comment: finalComment, truncated:true }; return; }
    previousInput+=partInput;previousOutput+=partOutput;
    cursor.next = i+1;
    yield { type:'progress', text:finalText, comment:finalComment, done:cursor.next, total:cursor.chunks.length };
  }
  yield { type:'done', text:finalText, comment:finalComment, truncated:false };
}
