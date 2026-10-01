import * as z from 'zod/mini';

import { AiError } from '../errors';
import type { ModelOption } from '../types';

/**
 * Campi delle risposte dei modelli che i provider non controllavano. Sta in providers/ (unica
 * cartella che parla con la rete), quindi finisce nel chunk dei provider e non nel bundle principale.
 */
const TOKENS = z.number();
const OLLAMA_MODEL = z.object({ name: z.string() });
const OPENAI_MODEL = z.object({
  id: z.string(),
  max_context_length: z.optional(z.unknown()),
  state: z.optional(z.unknown()),
  type: z.optional(z.unknown()),
});

export function tokens(value: unknown): number | undefined {
  const parsed = TOKENS.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Elementi validi di una lista arrivata dalla rete; il resto si scarta. Lista assente = vuota;
 * lista di un altro tipo = null, l'esito di oggi (`.map` lanciava TypeError → unreachable → null).
 */
function validItems<T>(schema: z.ZodMiniType<T>, list: unknown): T[] | null {
  if (list === NO_BODY) return null;
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  return list.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Segnaposto per un corpo `null`/`undefined`: oggi `body.models` lì lancia TypeError → null. */
const NO_BODY = Symbol('noBody');

/** `body[key]` come lo legge JavaScript (su un numero o una stringa è undefined, non un errore). */
const field = (body: unknown, key: string): unknown =>
  body === null || body === undefined ? NO_BODY : (body as Record<string, unknown>)[key];

export function ollamaModels(body: unknown): ModelOption[] | null {
  return validItems(OLLAMA_MODEL, field(body, 'models'))?.map((m) => ({ value: m.name, label: m.name })) ?? null;
}

export function openaiModels(body: unknown): ModelOption[] | null {
  const models = validItems(OPENAI_MODEL, field(body, 'data'));
  if (models === null) return null;
  return models
    .filter((m) => m.type !== 'embeddings' && m.type !== 'embedding')
    .map((m) => ({ value: m.id, label: m.id + (m.state === 'loaded' ? ' ●' : ''), contextTokens: tokens(m.max_context_length) }));
}

/** Testo di un delta di Anthropic: assente = vuoto; di un altro tipo = flusso non valido. */
export function textDelta(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new AiError('badStream');
  return value;
}
