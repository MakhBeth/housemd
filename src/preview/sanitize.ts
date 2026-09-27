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

interface SetHTMLOptions {
  sanitizer: { removeElements: string[] };
}

type MaybeSetHTML = Element & { setHTML?: (html: string, options?: SetHTMLOptions) => void };

/** Configurazione esplicita per la Sanitizer API: di default lascerebbe passare <style> e <form>. */
const SET_HTML_OPTIONS: SetHTMLOptions = { sanitizer: { removeElements: ['style', 'form'] } };

let purifier: Promise<Purifier> | null = null;

export async function setSafeHTML(el: Element, html: string): Promise<void> {
  const target = el as MaybeSetHTML;
  if (typeof target.setHTML === 'function') {
    target.setHTML(html, SET_HTML_OPTIONS);
    return;
  }
  purifier ??= import('dompurify').then((m) => m.default as unknown as Purifier);
  let purify: Purifier;
  try {
    purify = await purifier;
  } catch (err) {
    // L'import dinamico è fallito: non tenere in cache una promise rifiutata, altrimenti ogni
    // chiamata successiva fallirebbe subito senza più ritentare il caricamento.
    purifier = null;
    throw err;
  }
  el.innerHTML = sanitizeWith(purify, html);
}
