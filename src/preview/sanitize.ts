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

interface SanitizerLike {
  removeElement(name: string): void;
}

type MaybeSetHTML = Element & { setHTML?: (html: string, options?: { sanitizer: SanitizerLike }) => void };

/**
 * Un'istanza di Sanitizer creata una sola volta e riusata: parte dalla configurazione PREDEFINITA
 * (l'allowlist sicura di setHTML) e toglie in più <style>/<form>. Un dizionario `{ removeElements }`
 * da solo sarebbe invece una BLOCKLIST per la spec Sanitizer: tutto il resto (<meta http-equiv>,
 * <base href>, <link rel=stylesheet>, controlli di form…) passerebbe, più permissivo del default
 * e del fallback DOMPurify.
 */
let sanitizerInstance: SanitizerLike | null = null;

function getSanitizer(): SanitizerLike | null {
  const SanitizerCtor = (globalThis as { Sanitizer?: new () => SanitizerLike }).Sanitizer;
  if (!SanitizerCtor) return null;
  if (sanitizerInstance) return sanitizerInstance;
  try {
    const s = new SanitizerCtor();
    s.removeElement('style');
    s.removeElement('form');
    sanitizerInstance = s;
    return sanitizerInstance;
  } catch {
    // Costruzione o removeElement falliti: niente sanitizer custom, si resta sul default sicuro.
    return null;
  }
}

let purifier: Promise<Purifier> | null = null;

export async function setSafeHTML(el: Element, html: string): Promise<void> {
  const target = el as MaybeSetHTML;
  if (typeof target.setHTML === 'function') {
    const sanitizer = getSanitizer();
    if (sanitizer) target.setHTML(html, { sanitizer });
    else target.setHTML(html); // configurazione predefinita: già l'allowlist sicura
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
