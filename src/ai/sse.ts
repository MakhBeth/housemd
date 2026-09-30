import { AiError } from './errors';
export async function* parseSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let data: string[] = [];
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted(); const { value, done } = await reader.read(); signal?.throwIfAborted(); buffer += decoder.decode(value, { stream: !done });
      if (done && buffer && !/[\r\n]$/.test(buffer)) buffer += '\n';
      while (true) {
        const match = /\r\n|\r|\n/.exec(buffer); if (!match || (!done && match[0] === '\r' && match.index === buffer.length - 1)) break;
        const line = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
        if (!line) { if (data.length) { const event = data.join('\n'); data = []; yield event; if (event === '[DONE]') return; } }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (done) { if (data.length) yield data.join('\n'); break; }
      if (buffer.length > 5 * 1024 * 1024) throw new AiError('badStream');
    }
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function* parseSseJson(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<unknown> { for await (const data of parseSse(body, signal)) { if (data === '[DONE]') return; try { yield JSON.parse(data); } catch { throw new AiError('badStream'); } } }
