/**
 * Inserimento sicuro dell'HTML dell'anteprima.
 * Una cartella clonata da internet può contenere HTML malevolo e uno script in pagina
 * avrebbe accesso alla cartella aperta: l'HTML passa SEMPRE da qui.
 * Sanitizer API (`Element.setHTML`) se disponibile, altrimenti DOMPurify caricato al volo.
 */
export const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form'],
  ALLOW_DATA_ATTR: false,
};

export interface Purifier {
  sanitize(html: string, config: typeof PURIFY_CONFIG): string;
}

export function sanitizeWith(purify: Purifier, html: string): string {
  return purify.sanitize(html, PURIFY_CONFIG);
}

type MaybeSetHTML = Element & { setHTML?: (html: string) => void };

let purifier: Promise<Purifier> | null = null;

export async function setSafeHTML(el: Element, html: string): Promise<void> {
  const target = el as MaybeSetHTML;
  if (typeof target.setHTML === 'function') {
    target.setHTML(html);
    return;
  }
  purifier ??= import('dompurify').then((m) => m.default as unknown as Purifier);
  el.innerHTML = sanitizeWith(await purifier, html);
}
